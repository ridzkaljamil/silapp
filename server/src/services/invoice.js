/**
 * Invoice PSU: data awal form invoice dan berkas PDF yang diunduh Admin/pelanggan.
 * Format mengikuti invoice resmi PSU: identitas perusahaan, data pelanggan, tabel pekerjaan,
 * DPP nilai lain, PPN 12%, Total, PPh 23 (opsional), Grand Total, terbilang, detail pembayaran, tanda tangan.
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { q, one } = require('../config/db');
const { getSettings, INVOICE_KEYS } = require('../utils/settings');
const { taxes, optionLabel } = require('../utils/pricing');

const LOGO = path.join(__dirname, '..', '..', '..', 'client', 'public', 'logo-psu.png');
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const tanggal = (d) => { const x = new Date(d); return `${x.getDate()} ${BLN[x.getMonth()]} ${x.getFullYear()}`; };
const num = (n) => Math.round(+n || 0).toLocaleString('id-ID');
const ymd = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/** Angka → kata (Rupiah), contoh 41965000 → "Empat Puluh Satu Juta Sembilan Ratus Enam Puluh Lima Ribu". */
function terbilang(n) {
  const S = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  const f = (x) => {
    if (x < 12) return S[x];
    if (x < 20) return `${f(x - 10)} Belas`;
    if (x < 100) return `${f(Math.floor(x / 10))} Puluh ${f(x % 10)}`;
    if (x < 200) return `Seratus ${f(x - 100)}`;
    if (x < 1000) return `${f(Math.floor(x / 100))} Ratus ${f(x % 100)}`;
    if (x < 2000) return `Seribu ${f(x - 1000)}`;
    if (x < 1e6) return `${f(Math.floor(x / 1000))} Ribu ${f(x % 1000)}`;
    if (x < 1e9) return `${f(Math.floor(x / 1e6))} Juta ${f(x % 1e6)}`;
    if (x < 1e12) return `${f(Math.floor(x / 1e9))} Miliar ${f(x % 1e9)}`;
    return `${f(Math.floor(x / 1e12))} Triliun ${f(x % 1e12)}`;
  };
  const v = Math.round(+n || 0);
  return v === 0 ? 'Nol' : f(v).replace(/\s+/g, ' ').trim();
}

/** Huruf yang tidak ada di font PDF standar (mis. subskrip P₂O₅) diganti huruf biasa. */
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const clean = (t) => String(t ?? '').replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c))).replace(/[–—]/g, '-').replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, '');

const detail = async (appId, key) => (await one('SELECT field_value v FROM application_details WHERE application_id=? AND field_key=?', [appId, key]))?.v || '';

const row = (label, qty = 1, unit = '', price = '') => ({ label, qty, unit, price });

/**
 * Uraian pekerjaan bawaan untuk SP & Kalibrasi (bisa diubah Admin sebelum invoice terbit).
 * Paket LSPro + Lab: dua pekerjaan dalam satu invoice — biaya sertifikasi dan biaya uji laboratorium
 * (jumlah sampel = jumlah merek, harga per sampel dari paket lengkap lab dengan nomor SNI yang sama).
 */
async function defaultItems(app) {
  if (app.service_code === 'SP') {
    const prod = app.product_id ? await one('SELECT name, standard_no FROM products WHERE id=?', [app.product_id]) : null;
    const produk = prod ? `${prod.standard_no ? `${prod.standard_no} ` : ''}${prod.name}` : app.product_label;
    const pabrik = await detail(app.id, 'nama_pabrik');
    const jenis = app.application_type ? ` - ${app.application_type}` : '';
    const items = [row([`Biaya Sertifikasi Produk${app.scheme ? ` (${app.scheme})` : ''}${jenis}`, produk, pabrik && `Pabrik : ${pabrik}`].filter(Boolean).join('\n'))];
    if (app.is_package) {
      const merek = (await detail(app.id, 'merek_jenis')).split('\n').map((l) => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
        .map((l) => { const [m, ...j] = l.split(' · '); return j.length ? `${m} (${j.join(' · ')})` : m; });
      const lab = prod?.standard_no ? await one(`SELECT p.package_price FROM products p JOIN services s ON s.id=p.service_id
        WHERE s.code IN ('KIM','FIS','MIK') AND p.standard_no=? AND p.package_price IS NOT NULL ORDER BY p.id LIMIT 1`, [prod.standard_no]) : null;
      items.push(row([`Biaya Uji Laboratorium ${prod ? `${prod.name}${prod.standard_no ? ` ${prod.standard_no}` : ''}` : app.product_label}`, merek.length && `Merek : ${merek.join('; ')}`].filter(Boolean).join('\n'),
        Math.max(1, merek.length), 'sampel', lab ? +lab.package_price : ''));
    }
    return items;
  }
  if (app.service_code === 'KAL') {
    const e = await one('SELECT name, brand_model, serial_number, quantity FROM equipment WHERE application_id=? LIMIT 1', [app.id]);
    const label = `Biaya Kalibrasi ${e ? `${e.name}${e.brand_model ? ` ${e.brand_model}` : ''}${e.serial_number ? ` (S/N ${e.serial_number})` : ''}` : app.product_label}${app.location === 'onsite' ? '\nOn-site di lokasi pelanggan' : ''}`;
    return [row(label, Math.max(1, +e?.quantity || 1), 'alat')];
  }
  return [];
}

/** Rincian lab untuk pratinjau form invoice (harga kosong diambil dari daftar harga terbaru, tanpa menyimpan). */
async function labLines(app) {
  const qty = Number((await one('SELECT COALESCE(SUM(quantity),1) n FROM samples WHERE application_id=?', [app.id])).n) || 1;
  const alt = app.price_option === 'alt';
  const opt = optionLabel(app.service_code, app.price_option);
  const lines = [];
  if (app.full_sni) {
    const p = await one('SELECT name, package_price, package_price_alt FROM products WHERE id=?', [app.product_id]);
    const pkg = alt ? (p?.package_price_alt ?? p?.package_price) : p?.package_price;
    lines.push({ key: 'pkg', label: `Paket parameter lengkap sesuai SNI · ${p?.name || ''}${opt ? ` · ${opt}` : ''}`, qty, price: pkg == null ? null : +pkg });
  }
  const params = await q(`SELECT ap.id, ap.name, ap.is_custom, ap.price_snapshot, pp.price, pp.price_alt FROM application_parameters ap
    LEFT JOIN product_parameters pp ON pp.id=ap.parameter_id WHERE ap.application_id=? ORDER BY ap.id`, [app.id]);
  for (const p of params) {
    if (app.full_sni && !p.is_custom) continue;
    const cur = alt ? (p.price_alt ?? p.price) : p.price;
    const price = p.price_snapshot ?? (p.is_custom ? null : cur);
    lines.push({ key: p.id, label: p.name, custom: !!p.is_custom, qty, price: price == null ? null : +price });
  }
  return lines;
}

async function invoiceDraft(app) {
  const s = await getSettings(['invoice_due_days']);
  const due = new Date(); due.setDate(due.getDate() + (+s.invoice_due_days || 14));
  const company = String(app.company_name || '');
  const lab = ['KIM', 'FIS', 'MIK'].includes(app.service_code);
  return {
    items: lab ? [] : await defaultItems(app), lab_lines: lab ? await labLines(app) : [], option: optionLabel(app.service_code, app.price_option),
    due_date: ymd(due), with_pph23: /^(PT|CV|PERUM|PERSERO|KOPERASI|YAYASAN)\b/i.test(company.trim()),
  };
}

/** Tulis PDF invoice terakhir pengajuan ke response. */
async function sendInvoicePdf(app, res) {
  const pay = await one('SELECT * FROM payments WHERE application_id=? ORDER BY id DESC LIMIT 1', [app.id]);
  if (!pay) return res.status(404).json({ message: 'Invoice belum diterbitkan.' });
  const [s, cust] = await Promise.all([
    getSettings([...INVOICE_KEYS, 'contact_phone', 'contact_email']),
    one('SELECT name, company_name, address, nib_npwp, phone FROM users WHERE id=?', [app.user_id]),
  ]);
  // invoice lama (sebelum format PSU) belum punya kolom pajak lengkap: hitung ulang dari harga
  const t = pay.dpp_lain == null ? { ...taxes(pay.dpp ?? pay.amount), pph23: 0 } : {
    price: +pay.dpp, dppLain: +pay.dpp_lain, ppn: +pay.ppn, total: +pay.total, pph23: +pay.pph23,
  };
  t.grandTotal = t.total - t.pph23;
  let items = [];
  try { items = JSON.parse(pay.items || '[]'); } catch { /* rincian rusak: tampilkan total saja */ }
  if (!items.length) items = [{ label: `Biaya ${app.service_name}`, amount: t.price }];

  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Invoice ${pay.invoice_no}`, Author: s.company_name } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Invoice-${pay.invoice_no.replace(/[/\\]/g, '-')}.pdf"`);
  doc.pipe(res);
  const L = 40; const R = 555; const W = R - L;
  const F = 'Helvetica'; const FB = 'Helvetica-Bold'; const FI = 'Helvetica-BoldOblique';

  // kop
  if (fs.existsSync(LOGO)) doc.image(LOGO, L, 40, { fit: [86, 72] });
  const kx = L + 105;
  doc.font(FB).fontSize(12).text(clean(s.company_name), kx, 42, { width: R - kx });
  const kop = [s.company_address, [s.company_phone || s.contact_phone ? `Telp. ${s.company_phone || s.contact_phone}` : '', s.contact_email ? `Email : ${s.contact_email}` : ''].filter(Boolean).join(' ; '),
    s.company_npwp ? `NPWP : ${s.company_npwp}` : ''].filter(Boolean);
  doc.font(F).fontSize(9.5).text(clean(kop.join('\n')), kx, doc.y + 3, { width: R - kx, lineGap: 1.5 });
  let y = Math.max(doc.y, 118) + 12;

  // garis + INVOICE
  doc.font(FB).fontSize(11);
  const tw = doc.widthOfString('INVOICE') + 16;
  doc.moveTo(L, y + 6).lineTo(L + (W - tw) * 0.62, y + 6).dash(2, { space: 2 }).stroke();
  doc.text('INVOICE', L + (W - tw) * 0.62 + 8, y);
  doc.moveTo(L + (W - tw) * 0.62 + tw, y + 6).lineTo(R, y + 6).stroke().undash();
  y += 26;

  // data pelanggan (kiri) & invoice (kanan)
  const row = (label, value, x, yy, lw, vw, bold) => {
    doc.font(FB).fontSize(9).text(label, x, yy, { width: lw });
    doc.font(F).text(':', x + lw, yy);
    doc.font(bold ? FB : F).text(clean(value || '-'), x + lw + 10, yy, { width: vw, align: 'left' });
    return doc.y;
  };
  const lx = L; const rx = L + 325;
  let ly = y;
  ly = row('Perusahaan', (cust?.company_name || app.company_name || '').toUpperCase(), lx, ly, 62, 255) + 4;
  ly = row('Alamat', (cust?.address || '').toUpperCase(), lx, ly, 62, 255) + 4;
  ly = row('NPWP', cust?.nib_npwp, lx, ly, 62, 255) + 4;
  ly = row('Up. / Telp', [cust?.name, cust?.phone].filter(Boolean).join(' / '), lx, ly, 62, 255) + 4;
  let ry = y;
  ry = row('Tanggal', tanggal(pay.created_at), rx, ry, 72, 105) + 4;
  ry = row('No. Invoice', pay.invoice_no, rx, ry, 72, 105) + 4;
  ry = row('Jatuh Tempo', pay.due_date ? tanggal(pay.due_date) : '-', rx, ry, 72, 105) + 4;
  ry = row('No. Pengajuan', app.application_no, rx, ry, 72, 105) + 4;
  y = Math.max(ly, ry) + 12;

  // tabel pekerjaan
  const c1 = 34; const c3 = 130; const c2 = W - c1 - c3;
  const cell = (x, yy, w, h, fill) => { if (fill) doc.rect(x, yy, w, h).fillAndStroke('#D9D9D9', '#000'); else doc.rect(x, yy, w, h).stroke(); doc.fillColor('#000'); };
  doc.lineWidth(0.7);
  cell(L, y, c1, 20, true); cell(L + c1, y, c2, 20, true); cell(L + c1 + c2, y, c3, 20, true);
  doc.font(FB).fontSize(9).text('NO', L, y + 6, { width: c1, align: 'center' }).text('PEKERJAAN', L + c1, y + 6, { width: c2, align: 'center' }).text('HARGA ( Rp )', L + c1 + c2, y + 6, { width: c3, align: 'center' });
  y += 20;
  const money = (v, yy, h, bold) => {
    doc.font(bold ? FB : F).fontSize(9.5).text('Rp', L + c1 + c2 + 6, yy + (h - 10) / 2).text(num(v), L + c1 + c2 + 6, yy + (h - 10) / 2, { width: c3 - 12, align: 'right' });
  };
  items.forEach((it, i) => {
    const qty = +it.qty > 1 ? `\n(${num(it.qty)} ${it.unit || 'sampel'} x @ Rp ${num(it.price)})` : '';
    const text = clean(`${it.label}${qty}`);
    doc.font(F).fontSize(9.5);
    const h = Math.max(24, doc.heightOfString(text, { width: c2 - 16, align: 'center' }) + 14);
    if (y + h > 700) { doc.addPage(); y = 50; }
    cell(L, y, c1, h); cell(L + c1, y, c2, h); cell(L + c1 + c2, y, c3, h);
    doc.text(String(i + 1), L, y + h / 2 - 5, { width: c1, align: 'center' });
    doc.text(text, L + c1 + 8, y + 7, { width: c2 - 16, align: 'center' });
    money(it.amount, y, h);
    y += h;
  });
  const sum = (label, v, bold, noRp) => {
    const h = 20;
    cell(L, y, c1 + c2, h); cell(L + c1 + c2, y, c3, h);
    doc.font(FI).fontSize(9).text(label, L, y + 6, { width: c1 + c2 - 8, align: 'right' });
    if (noRp) doc.font(bold ? FB : F).fontSize(9.5).text(num(v), L + c1 + c2 + 6, y + 5, { width: c3 - 12, align: 'right' });
    else money(v, y, h, bold);
    y += h;
  };
  if (items.length > 1) sum('JUMLAH HARGA', t.price);
  sum('DPP NILAI LAIN', t.dppLain, false, true);
  sum('PPN 12%', t.ppn);
  sum('TOTAL', t.total);
  if (t.pph23) sum('PPh 23', t.pph23);
  sum('GRAND TOTAL', t.grandTotal, true);
  y += 14;
  doc.font(FI).fontSize(9.5).text(`Terbilang : ${terbilang(t.grandTotal)} Rupiah`, L, y, { width: W });
  y = doc.y + 8;
  if (pay.note) { doc.font(F).fontSize(9).text(clean(`Catatan: ${pay.note}`), L, y, { width: W }); y = doc.y + 6; }
  if (y > 610) { doc.addPage(); y = 50; }

  // detail pembayaran (kiri) & tanda tangan (kanan)
  const sy = y + 18;
  const bank = [['NAMA BANK', s.bank_name], ['KOTA', s.bank_city], ['NO. REKENING', s.bank_account], ['NAMA', s.bank_holder]].filter(([, v]) => v);
  if (bank.length) {
    const bh = 30 + bank.length * 15;
    doc.lineWidth(1.5).rect(L, sy + 40, 300, bh).stroke().lineWidth(0.7);
    doc.font(FB).fontSize(9).text('DETAIL PEMBAYARAN :', L + 12, sy + 50, { underline: true });
    bank.forEach(([k, v], i) => { doc.font(F).text(k, L + 12, sy + 68 + i * 15).font(FB).text(`: ${clean(v)}`, L + 95, sy + 68 + i * 15, { width: 195 }); });
  }
  const tx = R - 190;
  doc.font(F).fontSize(9.5).text('Hormat Kami,', tx, sy, { width: 190, align: 'right' }).text(clean(s.company_name), tx, sy + 14, { width: 190, align: 'right' });
  doc.font(F).text(clean(s.signer_name || '(.................................)'), tx, sy + 92, { width: 190, align: 'right', underline: !!s.signer_name });
  doc.text(clean(s.signer_title || ''), tx, sy + 106, { width: 190, align: 'right' });
  doc.end();
  return undefined;
}

module.exports = { sendInvoicePdf, invoiceDraft, terbilang };
