/**
 * Logika alur status SILAPP, sesuai Rancangan Sistem Tracking
 * LSPro (ST-01..ST-10), Laboratorium Pengujian (LAB-01..LAB-08), dan Laboratorium Kalibrasi (KAL-01..KAL-09).
 *
 * Aksi Admin di setiap tahap: setujui, minta_tindakan, abaikan, tolak.
 */
const { q, one } = require('../config/db');
const { sendMail } = require('../utils/mailer');

const httpError = (status, message) => Object.assign(new Error(message), { status });

async function getSteps(serviceId) {
  return q('SELECT * FROM service_steps WHERE service_id=? ORDER BY step_order', [serviceId]);
}

async function loadApp(id) {
  const app = await one(
    `SELECT a.*, s.code AS service_code, s.name AS service_name, s.bidang AS service_bidang,
            u.email AS user_email, u.name AS user_name, u.company_name
       FROM applications a JOIN services s ON s.id=a.service_id JOIN users u ON u.id=a.user_id
      WHERE a.id=?`, [id]);
  if (!app) throw httpError(404, 'Pengajuan tidak ditemukan.');
  app.steps = await getSteps(app.service_id);
  return app;
}

const picLabel = (u) => (u.role === 'superadmin' ? 'Super Admin PSU' : u.role === 'admin' ? `${u.name} · ${u.jabatan || 'Admin'}` : 'Pelanggan');
const stepOf = (app, order = app.current_step_order) => app.steps.find((s) => s.step_order === order);
const isLabTesting = (app) => ['KIM', 'FIS', 'MIK'].includes(app.service_code);

/** Admin hanya boleh menangani pengajuan di bidangnya; Super Admin semua bidang. */
function assertCanHandle(user, app) {
  if (user.role === 'superadmin') return;
  if (user.role === 'admin' && user.bidang === app.service_bidang) return;
  throw httpError(403, 'Pengajuan ini bukan bidang Anda.');
}

async function addLog(app, action, note, user, visible = true, order = app.current_step_order) {
  const st = stepOf(app, order);
  await q(
    `INSERT INTO status_logs (application_id, step_order, status_code, step_name, action, note, customer_visible, pic_user_id, pic_label)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [app.id, order, st.status_code, st.name, action, note || null, visible ? 1 : 0, user ? user.id : null, user ? picLabel(user) : 'Sistem']);
}

function notify(app, subject, body) {
  return sendMail(app.user_email, `[SILAPP] ${subject} · ${app.application_no}`,
    `Yth. ${app.user_name} (${app.company_name || '-'}),\n\n${body}\n\nNomor pengajuan : ${app.application_no}\nKode lacak      : ${app.tracking_code}\n\nSalam,\nPT Penilai Standar Uji`);
}

/** Apakah tahap kondisional dilewati: ST-07 tanpa ketidaksesuaian, KAL-09 untuk on-site. */
function isSkipped(app, step) {
  if (!step.is_optional) return false;
  if (app.service_code === 'SP') return !app.nc_flag;
  if (app.service_code === 'KAL') return app.location === 'onsite';
  return false;
}

/** Kondisi yang tampil ke pelanggan (warna status sesuai dokumen rancangan). */
function condition(app) {
  const st = stepOf(app);
  if (app.status === 'selesai') return app.service_code === 'SP' ? 'Certified' : 'Completed';
  if (app.status === 'ditolak') return 'Closed';
  if (app.status === 'aksi') return 'Action Required';
  if (st.is_payment_step && app.payment_status !== 'terverifikasi') return 'Waiting for Payment';
  if (app.service_code === 'KAL' && st.status_code === 'KAL-09') return 'Ready for Collection';
  if (app.service_code === 'KAL' && app.location === 'onsite' && ['KAL-04', 'KAL-05'].includes(st.status_code)) return 'On-Site Calibration';
  if (isLabTesting(app) && st.status_code === 'LAB-03') return 'Waiting for Sample';
  if (app.service_code === 'SP' && st.status_code === 'ST-04') return 'Scheduling';
  return 'On Progress';
}

async function setStep(app, order, user) {
  await q('UPDATE applications SET current_step_order=?, status=?, action_note=NULL WHERE id=?', [order, 'aktif', app.id]);
  app.current_step_order = order;
  await addLog(app, 'mulai', 'Tahap dimulai.', user);
}

/* ------------------------- AKSI ADMIN ------------------------- */

async function approve(app, user, { note, internal, certificateNo, certFile }) {
  if (!['aktif', 'aksi'].includes(app.status)) throw httpError(400, 'Pengajuan ini sudah ditutup atau selesai.');
  const st = stepOf(app);

  if (st.is_payment_step) {
    if (app.payment_status === 'belum') throw httpError(400, 'Tahap pembayaran baru bisa disetujui setelah pelanggan mengunggah bukti bayar.');
    if (app.payment_status === 'menunggu') {
      await q('UPDATE applications SET payment_status="terverifikasi" WHERE id=?', [app.id]);
      await q('UPDATE payments SET status="terverifikasi", verified_by=?, verified_at=NOW() WHERE application_id=? AND status="menunggu"', [user.id, app.id]);
      app.payment_status = 'terverifikasi';
    }
  }
  if (isLabTesting(app) && st.status_code === 'LAB-05') {
    const open = await one('SELECT COUNT(*) n FROM application_parameters WHERE application_id=? AND status<>"selesai"', [app.id]);
    if (open.n > 0) throw httpError(400, `Masih ada ${open.n} parameter yang belum selesai diuji.`);
  }
  if (st.is_certificate_step) {
    if (!certificateNo) throw httpError(400, 'Nomor sertifikat / LHU wajib diisi.');
    const dup = await one('SELECT id FROM certificates WHERE certificate_no=?', [certificateNo]);
    if (dup) throw httpError(400, 'Nomor sertifikat sudah dipakai.');
    await q('INSERT INTO certificates (application_id, certificate_no, issued_at, file_path) VALUES (?,?,CURDATE(),?)',
      [app.id, certificateNo, certFile || null]);
    await addLog(app, 'terbit', `${app.service_code === 'SP' || app.service_code === 'KAL' ? 'Sertifikat' : 'LHU'} ${certificateNo} terbit.`, user);
  }
  await addLog(app, 'setujui', note || 'Tahap disetujui.', user, !(internal && note));

  // tentukan tahap berikutnya
  const last = app.steps[app.steps.length - 1].step_order;
  let next = app.current_step_order + 1;
  while (next <= last && isSkipped(app, stepOf(app, next))) next++;
  const onsiteDone = app.service_code === 'KAL' && app.location === 'onsite' && st.status_code === 'KAL-08';

  if (next > last || onsiteDone) {
    await q('UPDATE applications SET status="selesai", action_note=NULL WHERE id=?', [app.id]);
    await notify(app, 'Pengajuan selesai', `Seluruh tahap ${app.service_name} telah selesai. Dokumen hasil dapat diunduh pada akun Anda.`);
    return;
  }
  const nextStep = stepOf(app, next);
  const certIssued = app.steps.some((s) => s.is_certificate_step && s.step_order < next);
  await setStep(app, next, user);
  if (next === last && !nextStep.is_optional && certIssued && app.service_code !== 'KAL') {
    // LAB-08: LHU terbit = selesai otomatis
    await q('UPDATE applications SET status="selesai" WHERE id=?', [app.id]);
    await notify(app, 'LHU terbit', 'Pengujian telah selesai. Laporan Hasil Uji tersedia pada akun Anda.');
    return;
  }
  await notify(app, `Status: ${nextStep.status_code} ${nextStep.name}`,
    `Pengajuan Anda masuk tahap ${nextStep.status_code} · ${nextStep.name} (progres ${nextStep.progress_pct}%).`);
}

async function requestAction(app, user, note) {
  if (!note) throw httpError(400, 'Catatan tindakan yang diminta wajib diisi.');
  if (!['aktif', 'aksi'].includes(app.status)) throw httpError(400, 'Pengajuan ini sudah ditutup atau selesai.');
  const st = stepOf(app);
  if (app.service_code === 'SP' && st.status_code === 'ST-06') {
    // ditemukan ketidaksesuaian -> masuk ST-07 Tindakan perbaikan
    await addLog(app, 'setujui', 'Pengujian selesai, ditemukan ketidaksesuaian.', user);
    await q('UPDATE applications SET nc_flag=1 WHERE id=?', [app.id]);
    app.nc_flag = 1;
    await setStep(app, app.current_step_order + 1, user);
  }
  await q('UPDATE applications SET status="aksi", action_note=? WHERE id=?', [note, app.id]);
  await addLog(app, 'minta_tindakan', `Tindakan pelanggan diperlukan: ${note}`, user);
  await notify(app, 'Tindakan Anda diperlukan', `Mohon tindak lanjuti catatan berikut melalui akun SILAPP:\n${note}`);
}

async function ignore(app, user, note, internal) {
  await addLog(app, 'abaikan', note || 'Masih dalam proses pada tahap ini.', user, !internal);
}

async function reject(app, user, note) {
  if (!note) throw httpError(400, 'Alasan penolakan wajib diisi.');
  await q('UPDATE applications SET status="ditolak", reject_note=? WHERE id=?', [note, app.id]);
  await addLog(app, 'tolak', `Pengajuan ditutup: ${note}`, user);
  await notify(app, 'Pengajuan ditutup', `Pengajuan tidak dapat dilanjutkan dengan alasan:\n${note}`);
}

async function updateParameter(app, user, paramId, status) {
  if (!['antri', 'uji', 'selesai'].includes(status)) throw httpError(400, 'Status parameter tidak valid.');
  const p = await one('SELECT * FROM application_parameters WHERE id=? AND application_id=?', [paramId, app.id]);
  if (!p) throw httpError(404, 'Parameter tidak ditemukan.');
  await q('UPDATE application_parameters SET status=?, analyst_user_id=?, updated_at=NOW() WHERE id=?', [status, user.id, paramId]);
  await addLog(app, 'parameter', `Parameter ${p.name}: ${status === 'uji' ? 'mulai diuji' : status === 'selesai' ? 'selesai diuji' : 'antrian'}.`, user);
}

/* ------------------------- AKSI PELANGGAN ------------------------- */

async function customerReply(app, user, note) {
  if (app.status !== 'aksi') throw httpError(400, 'Tidak ada tindakan yang diminta saat ini.');
  await q('UPDATE applications SET status="aktif" WHERE id=?', [app.id]);
  await addLog(app, 'tanggapan', note || 'Pelanggan mengirim tanggapan / dokumen perbaikan.', user);
}

async function customerPay(app, user, proofPath) {
  const st = stepOf(app);
  if (!st.is_payment_step) throw httpError(400, 'Pengajuan belum berada di tahap pembayaran.');
  if (app.payment_status !== 'belum') throw httpError(400, 'Bukti bayar sudah diunggah.');
  await q('INSERT INTO payments (application_id, invoice_no, proof_path) VALUES (?,?,?)',
    [app.id, `INV/PSU/${new Date().getFullYear()}/${String(app.id).padStart(5, '0')}`, proofPath]);
  await q('UPDATE applications SET payment_status="menunggu" WHERE id=?', [app.id]);
  await addLog(app, 'bayar', 'Pelanggan mengunggah bukti pembayaran.', user);
}

module.exports = {
  httpError, getSteps, loadApp, picLabel, stepOf, condition, isSkipped, isLabTesting, assertCanHandle, addLog, notify,
  approve, requestAction, ignore, reject, updateParameter, customerReply, customerPay,
};
