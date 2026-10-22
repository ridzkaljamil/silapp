/** Aksi pelanggan: tanggapan, bukti bayar, dan survei kepuasan (dokumen terkirim setelah survei). */
const { q, one } = require('../../config/db');
const { notifyStaff } = require('../notifications');
const { httpError, stepOf, docWord, assertOpen, addLog, saveDocs, notify, workDone, finalPaid } = require('./core');

/* ------------------------- AKSI PELANGGAN ------------------------- */

async function customerReply(app, user, note, files) {
  if (app.status !== 'aksi') throw httpError(400, 'Tidak ada tindakan yang diminta saat ini.');
  await q('UPDATE applications SET status="aktif" WHERE id=?', [app.id]);
  const logId = await addLog(app, 'tanggapan', note || 'Pelanggan mengirim tanggapan / dokumen perbaikan.', user);
  await saveDocs(app, user, files, { docName: 'Tanggapan / Perbaikan', logId });
  await notifyStaff(app, 'Pelanggan mengirim tanggapan', `${app.application_no} · ${app.company_name}`);
}

async function customerPay(app, user, proofPath) {
  assertOpen(app);
  const st = stepOf(app);
  if (!st.is_payment_step) throw httpError(400, 'Pengajuan belum berada di tahap pembayaran.');
  if (app.payment_status === 'belum') throw httpError(400, 'Proforma invoice belum diterbitkan PSU.');
  if (app.payment_status === 'tunda') throw httpError(400, 'Sesuai skema Full di Akhir, pembayaran dilakukan setelah sertifikat/LHU terbit.');
  if (app.payment_status !== 'invoice') throw httpError(400, 'Bukti bayar sudah diunggah.');
  await q('UPDATE payments SET proof_path=?, paid_at=NOW(3), status="menunggu" WHERE application_id=? AND status="invoice"', [proofPath, app.id]);
  await q('UPDATE applications SET payment_status="menunggu" WHERE id=?', [app.id]);
  await addLog(app, 'bayar', 'Pelanggan mengunggah bukti pembayaran.', user);
  await notifyStaff(app, 'Bukti bayar masuk, perlu diverifikasi', `${app.application_no} · ${app.company_name}`);
}

/** Lampiran email sertifikat/LHU (jika file-nya ada). */
function certAttachment(cert, app) {
  // sertifikat yang dicabut, atau yang belum dilunasi (skema 50:50 / Full di Akhir), tidak dikirim
  if (!cert.file_path || cert.status === 'dicabut' || (app && !finalPaid(app))) return [];
  return [{ filename: `${cert.certificate_no.replace(/[\/\\]/g, '-')}.pdf`, key: cert.file_path }];
}

/** Survei kepuasan: wajib sebelum unduh sertifikat/LHU. Setelah terkirim, dokumen dikirim lewat email. */
async function submitSurvey(app, user, b) {
  if (!workDone(app)) throw httpError(400, 'Survei dapat diisi setelah dokumen terbit.');
  const cert = await one('SELECT * FROM certificates WHERE application_id=?', [app.id]);
  if (!cert) throw httpError(400, 'Dokumen belum terbit.');
  if (await one('SELECT id FROM survey_responses WHERE application_id=?', [app.id])) throw httpError(400, 'Survei untuk pengajuan ini sudah diisi.');
  const txt = (v, n) => String(v ?? '').trim().slice(0, n);
  const company = txt(b.company_name, 160);
  const respondent = txt(b.respondent_name, 120);
  if (!company || !respondent) throw httpError(400, 'Nama perusahaan/instansi dan nama responden wajib diisi.');
  const bidang = app.service_bidang;
  const questions = await q('SELECT * FROM survey_questions WHERE bidang=? AND is_active=1 ORDER BY sort_order, id', [bidang]);
  const scores = b.scores || {};
  for (const qu of questions) {
    const v = +scores[qu.id];
    if (!(v >= 1 && v <= 5)) throw httpError(400, 'Mohon beri nilai 1–5 untuk semua pertanyaan penilaian.');
  }
  const avg = questions.length ? questions.reduce((t, qu) => t + +scores[qu.id], 0) / questions.length : null;
  const contactOk = b.contact_ok === true ? 1 : b.contact_ok === false ? 0 : null;
  const r = await q(`INSERT INTO survey_responses (application_id, user_id, bidang, company_name, respondent_name, reference_no, avg_score, suggestion, contact_ok, contact_info)
    VALUES (?,?,?,?,?,?,?,?,?,?)`, [app.id, user.id, bidang, company, respondent, txt(b.reference_no, 80) || null, avg === null ? null : avg.toFixed(2),
    txt(b.suggestion, 3000) || null, contactOk, contactOk ? txt(b.contact_info, 160) || null : null]);
  for (const qu of questions) {
    await q('INSERT INTO survey_answers (response_id, question_id, question, score) VALUES (?,?,?,?)', [r.insertId, qu.id, qu.question, +scores[qu.id]]);
  }
  await addLog(app, 'survei', 'Pelanggan mengisi Survei Kepuasan Pelanggan. Dokumen dapat diunduh.', user);
  await notifyStaff(app, 'Survei kepuasan diisi', `${app.application_no} · ${app.company_name} · rata-rata ${avg === null ? '-' : avg.toFixed(2)}`);
  const w = docWord(app);
  if (!finalPaid(app)) {
    // skema 50:50 / Full di Akhir: dokumen dikirim setelah pelunasan disetujui (lihat billing.js)
    await notify(app, 'Terima kasih telah mengisi survei',
      `Terima kasih atas partisipasi Saudara dalam mengisi Survei Kepuasan Pelanggan.\n\n${w} nomor ${cert.certificate_no} dapat diunduh setelah pelunasan disetujui PSU. Silakan unggah bukti bayar pada tahap Invoice & Faktur di akun SILAPP.`);
    return;
  }
  await notify(app, `Penyampaian dokumen ${w}`,
    `Terima kasih atas partisipasi Saudara dalam mengisi Survei Kepuasan Pelanggan.\n\nBersama email ini kami lampirkan ${w.toLowerCase()} nomor ${cert.certificate_no}. ` +
    `Dokumen juga dapat diunduh kapan saja melalui akun SILAPP.`,
    certAttachment(cert, app));
}

module.exports = { customerReply, customerPay, certAttachment, submitSurvey };
