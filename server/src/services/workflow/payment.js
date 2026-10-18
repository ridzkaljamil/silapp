/** Proforma invoice, nomor invoice, verifikasi pembayaran, dan tahap ST-03 yang selesai otomatis. */
const { q, one } = require('../../config/db');
const { optionLabel, taxes, PPN_LABEL, parseMoney } = require('../../utils/pricing');
const { getSettings } = require('../../utils/settings');
const { httpError, tgl, rupiah, loadApp, stepOf, isLabTesting, assertOpen, addLog, notify } = require('./core');
const { approve } = require('./steps');

/* ------------------------- INVOICE & PEMBAYARAN ------------------------- */

/**
 * Rincian pekerjaan invoice.
 * Lab: dari daftar harga (paket SNI / per parameter) × jumlah sampel; harga parameter "Lainnya" diisi Admin,
 *   ditambah pekerjaan / biaya tambahan yang diisi Admin (uraian, metode, jumlah × harga).
 * SP & Kalibrasi: baris pekerjaan (jumlah × harga satuan) diisi Admin; paket LSPro + Lab = baris sertifikasi + baris uji lab.
 * Semua harga belum termasuk PPN; pajak dihitung oleh utils/pricing.taxes().
 */
async function invoiceItems(app, { items: manual = [], customPrices = {} }) {
  // baris isian Admin: uraian, (metode), jumlah × harga satuan (mis. "2 sampel × Rp2.500.000"); invoice lama hanya punya amount
  const rows = (Array.isArray(manual) ? manual : []).map((x) => {
    const qty = Math.min(999, Math.max(1, Math.round(+x.qty || 1)));
    const price = parseMoney(x.price ?? x.amount) || 0;
    const method = String(x.method || '').trim().slice(0, 80);
    return { label: String(x.label || '').trim().slice(0, 600), ...(method && { method }), qty, unit: String(x.unit || '').trim().slice(0, 20), price, amount: qty * price };
  }).filter((x) => x.label || x.price);
  const bad = rows.find((x) => !x.label || x.price <= 0);
  if (bad) throw httpError(400, 'Setiap baris pekerjaan wajib berisi uraian dan harga lebih dari 0.');
  if (!isLabTesting(app)) {
    if (!rows.length) throw httpError(400, 'Isi minimal satu baris pekerjaan beserta harganya.');
    return rows;
  }
  const qty = Number((await one('SELECT COALESCE(SUM(quantity),1) n FROM samples WHERE application_id=?', [app.id])).n) || 1;
  const params = await q('SELECT * FROM application_parameters WHERE application_id=? ORDER BY id', [app.id]);
  const items = [];
  const opt = optionLabel(app.service_code, app.price_option);
  // format tabel invoice lab PSU: tiap baris punya metode uji; brand/spesifikasi produk dicetak di baris pertama
  const { labContext, labLabel } = require('../invoice');
  const ctx = await labContext(app);
  if (app.full_sni) {
    const prod = await one('SELECT name, package_price, package_price_alt FROM products WHERE id=?', [app.product_id]);
    // harga saat diajukan; pengajuan lama tanpa catatan harga memakai daftar harga terbaru
    const pkg = app.package_snapshot ?? (app.price_option === 'alt' ? (prod?.package_price_alt ?? prod?.package_price) : prod?.package_price);
    if (!pkg) throw httpError(400, `Harga paket "parameter lengkap sesuai SNI"${opt ? ` (${opt})` : ''} untuk produk ini belum diatur. Atur dulu di Kelola Layanan > Ruang Lingkup & Harga.`);
    items.push({ label: labLabel(ctx, 'lengkap sesuai SNI', opt), method: ctx.sni || '-', qty, price: +pkg, amount: +pkg * qty });
  }
  for (const p of params) {
    if (app.full_sni && !p.is_custom) continue;
    let price = p.price_snapshot;
    if (p.is_custom) {
      price = parseMoney(customPrices[p.id] ?? customPrices[String(p.id)] ?? price);
      if (price === null) throw httpError(400, `Isi harga parameter "${p.name}" (parameter lainnya).`);
      await q('UPDATE application_parameters SET price_snapshot=? WHERE id=?', [+price, p.id]);
    }
    if (price === null) {
      // harga belum ada saat diajukan: ambil harga terbaru dari daftar harga
      const cur = p.parameter_id ? await one('SELECT price, price_alt FROM product_parameters WHERE id=?', [p.parameter_id]) : null;
      price = cur ? (app.price_option === 'alt' ? (cur.price_alt ?? cur.price) : cur.price) : null;
      if (price === null || price === undefined) throw httpError(400, `Harga parameter "${p.name}" belum diatur. Atur dulu di Kelola Layanan > Ruang Lingkup & Harga.`);
      await q('UPDATE application_parameters SET price_snapshot=? WHERE id=?', [+price, p.id]);
    }
    items.push({ label: labLabel(ctx, `${p.name}${p.is_custom ? ' (lainnya)' : ''}`, opt), method: p.method || (p.is_custom ? '-' : ctx.sni || '-'), qty, price: +price, amount: +price * qty });
  }
  // pekerjaan / biaya tambahan dari Admin (mis. biaya tambahan Ekspress), ditandai extra agar bisa diedit lagi
  rows.forEach((r) => items.push({ ...r, method: r.method || '-', extra: true }));
  // brand / spesifikasi produk dari pengajuan pelanggan, dicetak bernomor di baris pertama
  if (items.length && ctx.specs.length) items[0].specs = ctx.specs.slice(0, 50);
  return items;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
/**
 * Nomor invoice: 001/PSU/KIM/X/2026 = urut/kode perusahaan/kode layanan/bulan Romawi/tahun.
 * Urutan dipisah per layanan dan mulai lagi dari 001 setiap tahun (kode perusahaan diatur di Pengaturan Umum).
 */
async function nextInvoiceNo(app) {
  const now = new Date();
  const year = now.getFullYear();
  const { invoice_code: code } = await getSettings(['invoice_code']);
  const r = await one(`SELECT COALESCE(MAX(p.invoice_seq),0)+1 n FROM payments p JOIN applications a ON a.id=p.application_id
    WHERE a.service_id=? AND p.invoice_year=?`, [app.service_id, year]);
  return { seq: r.n, year, no: `${String(r.n).padStart(3, '0')}/${code || 'PSU'}/${app.service_code}/${ROMAN[now.getMonth()]}/${year}` };
}

async function issueInvoice(app, user, { items: manual, customPrices, withPph23, dueDate, note }) {
  assertOpen(app);
  if (!stepOf(app).is_payment_step) throw httpError(400, 'Proforma invoice hanya dapat diterbitkan pada tahap pembayaran.');
  if (!['belum', 'invoice'].includes(app.payment_status)) throw httpError(400, 'Proforma invoice tidak dapat diubah karena bukti bayar sudah diunggah.');
  const items = await invoiceItems(app, { items: manual, customPrices });
  const t = taxes(items.reduce((s, i) => s + i.amount, 0), !!withPph23);
  if (t.price <= 0) throw httpError(400, 'Total harga invoice harus lebih dari 0.');
  const vals = [t.grandTotal, t.price, t.dppLain, t.ppn, t.total, t.pph23, withPph23 ? 1 : 0, JSON.stringify(items), dueDate || null, note || null, user.id];
  const pending = () => one('SELECT * FROM payments WHERE application_id=? AND status="invoice" ORDER BY id DESC LIMIT 1', [app.id]);
  const update = (p) => q(`UPDATE payments SET amount=?, dpp=?, dpp_lain=?, ppn=?, total=?, pph23=?, with_pph23=?, items=?, due_date=?, note=?, issued_by=?, created_at=NOW()
      WHERE id=?`, [...vals, p.id]);
  const existing = await pending();
  let num;
  if (existing) {
    num = { no: existing.invoice_no };
    await update(existing);
  } else {
    // nomor urut diambil ulang bila bentrok dengan invoice lain yang terbit pada saat bersamaan
    for (let attempt = 0; ; attempt++) {
      num = await nextInvoiceNo(app);
      try {
        await q(`INSERT INTO payments (application_id, invoice_no, invoice_seq, invoice_year, amount, dpp, dpp_lain, ppn, total, pph23, with_pph23, items, due_date, note, issued_by, status)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,"invoice")`, [app.id, num.no, num.seq, num.year, ...vals]);
        break;
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY' || attempt >= 4) throw e;
        const same = await pending(); // permintaan ganda untuk pengajuan yang sama: perbarui saja
        if (same) { num = { no: same.invoice_no }; await update(same); break; }
      }
    }
  }
  await q('UPDATE applications SET payment_status="invoice" WHERE id=?', [app.id]);
  const breakdown = `Harga ${rupiah(t.price)} + ${PPN_LABEL} ${rupiah(t.ppn)}${t.pph23 ? ` − PPh 23 ${rupiah(t.pph23)}` : ''}`;
  await addLog(app, 'invoice', `Proforma invoice ${num.no} ${existing ? 'diperbarui' : 'diterbitkan'}: ${rupiah(t.grandTotal)} (${breakdown}).${note ? ' ' + note : ''}`, user);
  await notify(app, `Proforma Invoice ${num.no}`, `Proforma invoice untuk pengajuan Anda telah terbit dengan total pembayaran ${rupiah(t.grandTotal)} (${breakdown}).${dueDate ? `\nJatuh tempo: ${tgl(dueDate)}.` : ''}\nProforma invoice dapat diunduh di akun SILAPP. Setelah membayar, unggah bukti transfer melalui akun SILAPP.`);
}

async function markPaid(app, user) {
  await q('UPDATE applications SET payment_status="terverifikasi" WHERE id=?', [app.id]);
  await q('UPDATE payments SET status="terverifikasi", verified_by=?, verified_at=NOW() WHERE application_id=? AND status="menunggu"', [user ? user.id : null, app.id]);
  app.payment_status = 'terverifikasi';
}

async function verifyPayment(app, user, valid, note) {
  assertOpen(app);
  if (app.payment_status !== 'menunggu') throw httpError(400, 'Tidak ada bukti bayar yang menunggu verifikasi.');
  if (!valid) {
    if (!note) throw httpError(400, 'Isi alasan bukti bayar ditolak.');
    await q('UPDATE payments SET status="invoice" WHERE application_id=? AND status="menunggu"', [app.id]);
    await q('UPDATE applications SET payment_status="invoice" WHERE id=?', [app.id]);
    await addLog(app, 'bayar', `Bukti bayar belum dapat diterima: ${note}`, user);
    await notify(app, 'Bukti bayar perlu diunggah ulang', `Bukti pembayaran Anda belum dapat kami terima:\n${note}\n\nSilakan unggah ulang bukti pembayaran melalui akun SILAPP.`);
    return;
  }
  await markPaid(app, user);
  await addLog(app, 'bayar', `Pembayaran terverifikasi.${note ? ' ' + note : ''}`, user);
  await tryAutoAdvance(app);
}

/** Semua berkas pelanggan sudah diunduh Super Admin (setelah unggahan terakhir)? */
async function allDocsDownloaded(app) {
  if (!app.docs_downloaded_at) return false;
  const r = await one(`SELECT GREATEST(
      COALESCE((SELECT MAX(created_at) FROM documents WHERE application_id=? AND source="pelanggan"), '1970-01-01'),
      COALESCE((SELECT MAX(paid_at) FROM payments WHERE application_id=?), '1970-01-01')) latest`, [app.id, app.id]);
  return String(app.docs_downloaded_at) >= String(r.latest);
}

/**
 * Tahap 3 Sertifikasi Produk (ST-03) selesai otomatis jika:
 * pembayaran terverifikasi DAN seluruh berkas pelanggan sudah diunduh Super Admin.
 */
async function tryAutoAdvance(app) {
  const fresh = await loadApp(app.id);
  if (fresh.service_code !== 'SP' || stepOf(fresh).status_code !== 'ST-03' || fresh.status !== 'aktif') return false;
  if (fresh.payment_status !== 'terverifikasi' || !(await allDocsDownloaded(fresh))) return false;
  try {
    await approve(fresh, null, { auto: 'Pembayaran terverifikasi dan seluruh berkas telah diunduh Super Admin. Tahap selesai otomatis.' });
  } catch (e) {
    if (e.status === 409) return false; // sudah dimajukan oleh permintaan lain pada saat yang sama
    throw e;
  }
  return true;
}

module.exports = { invoiceItems, nextInvoiceNo, issueInvoice, markPaid, verifyPayment, allDocsDownloaded, tryAutoAdvance };
