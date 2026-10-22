/**
 * Tahap akhir "Invoice & Faktur" (setelah sertifikat/LHU terbit).
 *   - PSU mengunggah invoice dan faktur pajak (tidak dibuat otomatis) beserta catatan.
 *   - Pelanggan mengunggah bukti bayar pelunasan (skema 50:50 / Full di Akhir) dan bukti potong PPh 23
 *     (bila pelanggan memotong PPh 23). Keduanya boleh diunggah tidak bersamaan; bukti potong bisa menyusul 1–2 bulan.
 *   - Admin menyetujui masing-masing. Setelah semuanya lengkap, pengajuan selesai.
 *   - Sertifikat/LHU baru bisa diunduh pelanggan setelah bukti bayar pelunasan disetujui (bukti potong tidak mengunci).
 */
const { q, one } = require('../../config/db');
const storage = require('../../utils/storage');
const { taxes } = require('../../utils/pricing');
const { notifyStaff } = require('../notifications');
const { httpError, rupiah, stepOf, docWord, assertOpen, addLog, notify, schemeOf, SCHEME_LABEL } = require('./core');

const OK = ['disetujui', 'tidak_perlu'];
const KIND = {
  bayar: { col: 'pay', label: 'Bukti bayar', file: 'bukti-bayar' },
  potong: { col: 'cut', label: 'Bukti potong PPh 23', file: 'bukti-potong-pph23' },
};
/** Pesan dari PSU untuk pelanggan yang memotong PPh 23. */
const PPH_MESSAGE = 'Mohon melampirkan bukti potong PPh dan mengirimkannya ke alamat email psuindonesia.info@gmail.com sebagai kelengkapan administrasi perpajakan.';

const getBilling = (appId) => one('SELECT * FROM billings WHERE application_id=?', [appId]);
const latestPayment = (appId) => one('SELECT * FROM payments WHERE application_id=? ORDER BY id DESC LIMIT 1', [appId]);

/**
 * Sisa tagihan di tahap akhir: Full di Awal = 0, 50:50 = grand total − DP, Full di Akhir = grand total.
 * Grand total dihitung ulang bila status potong PPh 23 diubah di tahap ini.
 */
function amountDue(pay, scheme, withPph23) {
  if (!pay || scheme === 'full') return 0;
  const grand = taxes(pay.dpp ?? pay.amount, withPph23).grandTotal;
  const paid = scheme === '5050' ? +(pay.due_now ?? Math.round(+pay.amount / 2)) : 0;
  return Math.max(0, grand - paid);
}

function assertBillingStep(app) {
  assertOpen(app);
  if (!stepOf(app).is_billing_step) throw httpError(400, 'Pengajuan belum berada di tahap Invoice & Faktur.');
}

/** Dipanggil saat pekerjaan selesai (sertifikat/LHU terbit) dan pengajuan masuk tahap Invoice & Faktur. */
async function openBilling(app) {
  if (await getBilling(app.id)) return;
  const pay = await latestPayment(app.id);
  const scheme = schemeOf(app);
  const pph = !!pay?.with_pph23;
  const due = amountDue(pay, scheme, pph);
  await q('INSERT INTO billings (application_id, amount_due, with_pph23, pay_status, cut_status) VALUES (?,?,?,?,?)',
    [app.id, due, pph ? 1 : 0, due > 0 ? 'belum' : 'tidak_perlu', pph ? 'belum' : 'tidak_perlu']);
  app.billing_pay = due > 0 ? 'belum' : 'tidak_perlu';
  app.billing_cut = pph ? 'belum' : 'tidak_perlu';
  await notifyStaff(app, 'Unggah invoice & faktur pajak', `${app.application_no} · ${app.company_name} · ${docWord(app)} sudah terbit`);
}

/** Semua kelengkapan disetujui: seluruh tahap selesai. */
async function tryFinish(app, user) {
  const b = await getBilling(app.id);
  if (!b || !b.sent_at || !OK.includes(b.pay_status) || !OK.includes(b.cut_status)) return false;
  const r = await q('UPDATE applications SET status="selesai", action_note=NULL WHERE id=? AND status IN ("aktif","aksi")', [app.id]);
  if (!r.affectedRows) return false;
  await q('UPDATE billings SET completed_at=NOW() WHERE application_id=?', [app.id]);
  await addLog(app, 'setujui', 'Invoice, faktur pajak, dan kelengkapan pembayaran sudah lengkap. Seluruh tahap selesai.', user);
  await notify(app, 'Seluruh tahapan selesai', 'Terima kasih. Invoice, faktur pajak, dan kelengkapan pembayaran sudah lengkap, sehingga seluruh tahapan pengajuan Anda telah selesai.');
  return true;
}

/**
 * PSU mengirim invoice & faktur pajak. files: { invoice, faktur } (hasil unggahan; wajib saat pertama kali).
 * withPph23: pelanggan memotong PPh 23 (bawaan mengikuti proforma) — menentukan wajib tidaknya bukti potong.
 */
async function saveBilling(app, user, { invoice, faktur, note, withPph23 }) {
  assertBillingStep(app);
  if (!(await getBilling(app.id))) await openBilling(app);
  const b = await getBilling(app.id);
  if ((!b.invoice_path && !invoice) || (!b.faktur_path && !faktur)) throw httpError(400, 'Unggah file invoice dan faktur pajak.');
  const pph = withPph23 === undefined ? !!b.with_pph23 : !!withPph23;
  const due = amountDue(await latestPayment(app.id), schemeOf(app), pph);
  let pay = b.pay_status;
  if (due <= 0 && pay !== 'disetujui') pay = 'tidak_perlu';
  else if (due > 0 && pay === 'tidak_perlu') pay = 'belum';
  let cut = b.cut_status;
  if (!pph && cut !== 'disetujui') cut = 'tidak_perlu';
  else if (pph && cut === 'tidak_perlu') cut = 'belum';
  const text = String(note ?? b.note ?? '').trim().slice(0, 2000) || null;
  await q(`UPDATE billings SET amount_due=?, with_pph23=?, pay_status=?, cut_status=?, note=?, sent_at=COALESCE(sent_at, NOW()),
      invoice_path=COALESCE(?, invoice_path), invoice_name=COALESCE(?, invoice_name), faktur_path=COALESCE(?, faktur_path), faktur_name=COALESCE(?, faktur_name)
    WHERE application_id=?`, [due, pph ? 1 : 0, pay, cut, text, invoice?.filename || null, invoice?.originalname || null, faktur?.filename || null, faktur?.originalname || null, app.id]);
  if (invoice && b.invoice_path) await storage.remove(b.invoice_path);
  if (faktur && b.faktur_path) await storage.remove(b.faktur_path);
  Object.assign(app, { billing_sent: true, billing_pay: pay, billing_cut: cut });

  const first = !b.sent_at;
  await addLog(app, 'tagihan', `${first ? 'Invoice dan faktur pajak dikirim ke pelanggan' : 'Invoice / faktur pajak diperbarui'}${due > 0 ? `, sisa tagihan ${rupiah(due)}` : ''}.${text ? ` Catatan: ${text}` : ''}`, user);
  if (first) {
    const lines = [
      `Invoice dan faktur pajak untuk pengajuan Anda sudah tersedia di akun SILAPP.`,
      due > 0 ? `Sisa tagihan (skema ${SCHEME_LABEL[schemeOf(app)]}): ${rupiah(due)}. Setelah membayar, unggah bukti bayar pada tahap Invoice & Faktur. ${docWord(app)} dapat diunduh setelah pembayaran disetujui PSU.` : '',
      text ? `Catatan PSU: ${text}` : '',
      pph ? PPH_MESSAGE : '',
    ].filter(Boolean);
    await notify(app, 'Invoice & faktur pajak', lines.join('\n\n'));
  }
  await tryFinish(app, user);
}

/** Pelanggan mengunggah bukti bayar pelunasan / bukti potong PPh 23. */
async function customerUpload(app, user, kind, file) {
  const k = KIND[kind];
  if (!k) throw httpError(404, 'Jenis berkas tidak dikenal.');
  if (!file) throw httpError(400, `File ${k.label.toLowerCase()} wajib diunggah.`);
  assertBillingStep(app);
  const b = await getBilling(app.id);
  if (!b?.sent_at) throw httpError(400, 'Invoice dan faktur pajak belum dikirim PSU.');
  const st = b[`${k.col}_status`];
  if (st === 'tidak_perlu') throw httpError(400, `${k.label} tidak diperlukan untuk pengajuan ini.`);
  if (st === 'menunggu') throw httpError(400, `${k.label} sedang diverifikasi PSU.`);
  if (st === 'disetujui') throw httpError(400, `${k.label} sudah disetujui.`);
  await q(`UPDATE billings SET ${k.col}_status='menunggu', ${k.col}_path=?, ${k.col}_at=NOW(), ${k.col}_note=NULL WHERE application_id=?`, [file.filename, app.id]);
  if (b[`${k.col}_path`]) await storage.remove(b[`${k.col}_path`]);
  await addLog(app, kind === 'bayar' ? 'bayar' : 'tagihan', `Pelanggan mengunggah ${k.label.toLowerCase()}.`, user);
  await notifyStaff(app, `${k.label} masuk, perlu diverifikasi`, `${app.application_no} · ${app.company_name}`);
}

/** Admin menyetujui / menolak bukti bayar atau bukti potong. */
async function verify(app, user, kind, valid, note) {
  const k = KIND[kind];
  if (!k) throw httpError(404, 'Jenis berkas tidak dikenal.');
  assertBillingStep(app);
  const b = await getBilling(app.id);
  if (b?.[`${k.col}_status`] !== 'menunggu') throw httpError(400, `Tidak ada ${k.label.toLowerCase()} yang menunggu verifikasi.`);
  const text = String(note || '').trim().slice(0, 500);
  if (!valid) {
    if (!text) throw httpError(400, `Isi alasan ${k.label.toLowerCase()} ditolak.`);
    await q(`UPDATE billings SET ${k.col}_status='ditolak', ${k.col}_note=? WHERE application_id=?`, [text, app.id]);
    await addLog(app, 'tagihan', `${k.label} belum dapat diterima: ${text}`, user);
    await notify(app, `${k.label} perlu diunggah ulang`, `${k.label} Anda belum dapat kami terima:\n${text}\n\nSilakan unggah ulang melalui akun SILAPP pada tahap Invoice & Faktur.`);
    return;
  }
  await q(`UPDATE billings SET ${k.col}_status='disetujui', ${k.col}_note=? WHERE application_id=?`, [text || null, app.id]);
  app[kind === 'bayar' ? 'billing_pay' : 'billing_cut'] = 'disetujui';
  await addLog(app, kind === 'bayar' ? 'bayar' : 'tagihan', `${k.label} disetujui.${text ? ` ${text}` : ''}`, user);
  if (kind === 'bayar') {
    // pelunasan diterima: sertifikat/LHU kini bisa diunduh (dilampirkan bila survei sudah diisi)
    const cert = await one('SELECT * FROM certificates WHERE application_id=?', [app.id]);
    const surveyed = await one('SELECT id FROM survey_responses WHERE application_id=?', [app.id]);
    const w = docWord(app);
    await notify(app, 'Pembayaran diterima',
      `Pembayaran pelunasan Anda sudah kami terima. ${surveyed ? `Bersama email ini kami lampirkan ${w.toLowerCase()} nomor ${cert?.certificate_no}; dokumen juga dapat diunduh melalui akun SILAPP.` : `${w} dapat diunduh melalui akun SILAPP setelah Anda mengisi Survei Kepuasan Pelanggan.`}`,
      surveyed && cert ? require('./customer').certAttachment(cert, app) : []);
  }
  await tryFinish(app, user);
}

/** Data tahap akhir untuk tampilan (tanpa lokasi file). */
async function billingView(appId) {
  const b = await getBilling(appId);
  if (!b) return null;
  const part = (c) => ({ status: b[`${c}_status`], at: b[`${c}_at`], note: b[`${c}_note`], has_file: !!b[`${c}_path`] });
  return {
    amount_due: +b.amount_due, with_pph23: !!b.with_pph23, sent: !!b.sent_at, sent_at: b.sent_at, note: b.note,
    invoice_name: b.invoice_name, faktur_name: b.faktur_name, pay: part('pay'), cut: part('cut'), completed_at: b.completed_at,
    pph_message: b.with_pph23 ? PPH_MESSAGE : null,
  };
}

/** Kirim file tahap akhir: invoice | faktur | bayar | potong. */
async function sendFile(res, app, file) {
  const col = { invoice: 'invoice_path', faktur: 'faktur_path', bayar: 'pay_path', potong: 'cut_path' }[file];
  if (!col) return res.status(404).json({ message: 'Berkas tidak dikenal.' });
  const b = await getBilling(app.id);
  if (!b?.[col]) return res.status(404).json({ message: 'Berkas belum diunggah.' });
  const name = file === 'invoice' ? b.invoice_name : file === 'faktur' ? b.faktur_name
    : `${KIND[file].file}-${app.application_no}${require('path').extname(b[col])}`;
  return storage.send(res, b[col], name);
}

module.exports = { openBilling, saveBilling, customerUpload, verify, billingView, sendFile, amountDue, PPH_MESSAGE, OK };
