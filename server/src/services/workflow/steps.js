/** Aksi Admin per tahap: setujui (termasuk penerbitan sertifikat/LHU), minta tindakan, catatan, tolak, parameter uji, info lab. */
const { q, one } = require('../../config/db');
const { appUrl } = require('../../utils/mailer');
const { todayJkt, checkDates } = require('../../utils/certificate');
const { httpError, tgl, is1BFlow, stepOf, isLabTesting, docWord, assertOpen, addLog, saveDocs, notify, isSkipped, setStep } = require('./core');

/* ------------------------- AKSI ADMIN ------------------------- */

async function approve(app, user, { note, internal, certificateNo, certFile, issuedAt, expiresAt, files, docName, auto } = {}) {
  assertOpen(app);
  const st = stepOf(app);

  if (st.is_payment_step && app.payment_status !== 'terverifikasi') {
    throw httpError(400, app.payment_status === 'belum' ? 'Terbitkan proforma invoice terlebih dahulu, lalu tunggu pelanggan mengunggah bukti bayar.'
      : app.payment_status === 'invoice' ? 'Pelanggan belum mengunggah bukti bayar untuk proforma invoice ini.'
        : 'Periksa dan verifikasi bukti bayar terlebih dahulu.');
  }
  if (isLabTesting(app) && st.status_code === 'LAB-04') {
    const open = await one('SELECT COUNT(*) n FROM application_parameters WHERE application_id=? AND status<>"selesai"', [app.id]);
    if (open.n > 0) throw httpError(400, `Masih ada ${open.n} parameter yang belum selesai diuji.`);
  }
  if (app.service_code === 'SP' && st.status_code === 'ST-07' && app.open_findings > 0) {
    throw httpError(400, `Masih ada ${app.open_findings} temuan mayor/minor yang belum ditutup.`);
  }
  if (st.is_certificate_step) {
    if (!certificateNo) throw httpError(400, `Nomor ${docWord(app).toLowerCase()} wajib diisi.`);
    if (!certFile) throw httpError(400, `File ${docWord(app).toLowerCase()} (PDF) wajib diunggah.`);
    if (!/\.pdf$/i.test(certFile)) throw httpError(400, `File ${docWord(app).toLowerCase()} harus berformat PDF.`);
    // tanggal terbit (bawaan hari ini); masa berlaku hanya untuk sertifikat Sertifikasi Produk
    const isSP = app.service_code === 'SP';
    const issued = issuedAt || todayJkt();
    const expires = isSP ? expiresAt || null : null;
    const dateErr = checkDates(issued, expires, { expiresRequired: isSP });
    if (dateErr) throw httpError(400, dateErr);
    // nomor tidak boleh sama dengan sertifikat SILAPP lain maupun sertifikat lama (Directory)
    const dup = (await one('SELECT id FROM certificates WHERE certificate_no=?', [certificateNo])) || (await one('SELECT id FROM legacy_certificates WHERE certificate_no=?', [certificateNo]));
    if (dup) throw httpError(400, `Nomor ${docWord(app).toLowerCase()} sudah dipakai.`);
    const ins = await q('INSERT INTO certificates (application_id, certificate_no, issued_at, expires_at, file_path) VALUES (?,?,?,?,?)',
      [app.id, certificateNo, issued, expires, certFile]);
    if (isSP) {
      await require('../certificates').logCert('silapp', { id: ins.insertId, certificate_no: certificateNo }, 'terbit',
        { status: 'aktif', note: `Terbit lewat pengajuan ${app.application_no} (terbit ${issued}, berlaku sampai ${expires}).`, user });
    }
    await addLog(app, 'terbit', `${docWord(app)} ${certificateNo} terbit ${tgl(issued)}${expires ? `, berlaku sampai ${tgl(expires)}` : ''}.`, user);
  }
  const hidden = !!(internal && note);
  const logId = await addLog(app, 'setujui', note || (auto ? auto : 'Tahap disetujui.'), user, !hidden);
  await saveDocs(app, user, files, { docName, logId, visible: !hidden });

  // SP: temuan mayor/minor yang masih terbuka -> ST-07 Tindakan perbaikan wajib dilalui
  if (app.service_code === 'SP' && app.open_findings > 0 && !app.nc_flag) {
    await q('UPDATE applications SET nc_flag=1 WHERE id=?', [app.id]);
    app.nc_flag = 1;
  }

  // tentukan tahap berikutnya
  const last = app.steps[app.steps.length - 1].step_order;
  let next = app.current_step_order + 1;
  while (next <= last && isSkipped(app, stepOf(app, next))) next++;
  const onsiteDone = app.service_code === 'KAL' && app.location === 'onsite' && st.status_code === 'KAL-08';

  if (next > last || onsiteDone) {
    await q('UPDATE applications SET status="selesai", action_note=NULL WHERE id=?', [app.id]);
    await notifyIssued(app);
    return;
  }
  const nextStep = stepOf(app, next);
  const certIssued = app.steps.some((s) => s.is_certificate_step && s.step_order < next);
  await setStep(app, next, user);
  if (next === last && !nextStep.is_optional && certIssued && app.service_code !== 'KAL') {
    // LAB-07: LHU terbit = selesai otomatis
    await q('UPDATE applications SET status="selesai" WHERE id=?', [app.id]);
    await notifyIssued(app);
    return;
  }
  await notify(app, `Status: ${nextStep.status_code} ${nextStep.name}`,
    `Pengajuan Anda masuk tahap ${nextStep.status_code} · ${nextStep.name} (progres ${nextStep.progress_pct}%).`);
}

/** Email pertama setelah terbit: minta isi survei (mengikuti alur email SPPT SNI BSN). */
function notifyIssued(app) {
  const w = docWord(app);
  return notify(app, `${w} telah terbit`,
    `Dengan hormat, kami informasikan bahwa ${w.toLowerCase()} untuk pengajuan ${app.service_name} (${app.product_label}) telah terbit.\n\n` +
    `Untuk memperoleh dokumen ${w.toLowerCase()}, mohon terlebih dahulu mengisi Survei Kepuasan Pelanggan melalui akun SILAPP Anda:\n${appUrl()}/klien/pengajuan/${app.id}\n\n` +
    'Catatan: survei wajib diisi untuk setiap penerbitan dokumen, termasuk bagi pelanggan yang sudah pernah mengisi survei sebelumnya.');
}

async function requestAction(app, user, note, { files, docName } = {}) {
  if (!note) throw httpError(400, 'Catatan tindakan yang diminta wajib diisi.');
  assertOpen(app);
  const st = stepOf(app);
  if (app.service_code === 'SP' && st.status_code === 'ST-06' && !is1BFlow(app)) {
    // ditemukan ketidaksesuaian hasil uji -> masuk ST-07 Tindakan perbaikan (alur Tipe 1b tidak punya tahap perbaikan)
    await addLog(app, 'setujui', 'Pengujian selesai, ditemukan ketidaksesuaian.', user);
    await q('UPDATE applications SET nc_flag=1 WHERE id=?', [app.id]);
    app.nc_flag = 1;
    await setStep(app, app.current_step_order + 1, user);
  }
  await q('UPDATE applications SET status="aksi", action_note=? WHERE id=?', [note, app.id]);
  const logId = await addLog(app, 'minta_tindakan', `Tindakan pelanggan diperlukan: ${note}`, user);
  await saveDocs(app, user, files, { docName, logId });
  await notify(app, 'Tindakan Anda diperlukan', `Mohon tindak lanjuti catatan berikut melalui akun SILAPP:\n${note}`);
}

async function ignore(app, user, note, internal, { files, docName } = {}) {
  const logId = await addLog(app, files?.length ? 'lampiran' : 'abaikan', note || (files?.length ? 'PSU melampirkan dokumen.' : 'Masih dalam proses pada tahap ini.'), user, !internal);
  await saveDocs(app, user, files, { docName, logId, visible: !internal });
  if (files?.length && !internal) await notify(app, 'Dokumen baru dari PSU', `PSU mengirimkan dokumen pada tahap ${stepOf(app).status_code} · ${stepOf(app).name}${note ? `:\n${note}` : '.'}`);
}

async function reject(app, user, note, { files, docName } = {}) {
  if (!note) throw httpError(400, 'Alasan penolakan wajib diisi.');
  assertOpen(app);
  await q('UPDATE applications SET status="ditolak", reject_note=? WHERE id=?', [note, app.id]);
  const logId = await addLog(app, 'tolak', `Pengajuan ditutup: ${note}`, user);
  await saveDocs(app, user, files, { docName, logId });
  await notify(app, 'Pengajuan ditutup', `Pengajuan tidak dapat dilanjutkan dengan alasan:\n${note}`);
}

async function updateParameter(app, user, paramId, status) {
  if (!isLabTesting(app)) throw httpError(400, 'Status parameter hanya untuk pengujian laboratorium.');
  assertOpen(app);
  if (!['antri', 'uji', 'selesai'].includes(status)) throw httpError(400, 'Status parameter tidak valid.');
  const p = await one('SELECT * FROM application_parameters WHERE id=? AND application_id=?', [paramId, app.id]);
  if (!p) throw httpError(404, 'Parameter tidak ditemukan.');
  await q('UPDATE application_parameters SET status=?, analyst_user_id=?, updated_at=NOW() WHERE id=?', [status, user.id, paramId]);
  await addLog(app, 'parameter', `Parameter ${p.name}: ${status === 'uji' ? 'mulai diuji' : status === 'selesai' ? 'selesai diuji' : 'antrian'}.`, user);
}

/* ------------------------- INFO PENGUJIAN LAB (SP ST-06) ------------------------- */

async function updateLabInfo(app, user, { labName, labEstimate, labLink, files }) {
  if (app.service_code !== 'SP') throw httpError(400, 'Info pengujian lab hanya untuk Sertifikasi Produk.');
  assertOpen(app);
  if (labLink && !/^https?:\/\//i.test(labLink)) throw httpError(400, 'Tautan LHU harus diawali http:// atau https://');
  await q('UPDATE applications SET lab_name=?, lab_estimate=?, lab_link=? WHERE id=?', [labName || null, labEstimate || null, labLink || null, app.id]);
  const parts = [labName && `Pengujian dilakukan di ${labName}`, labEstimate && `estimasi ${labEstimate}`, labLink && 'tautan LHU tersedia', files?.length && 'LHU diunggah'].filter(Boolean);
  const logId = await addLog(app, 'info', `${parts.join(', ') || 'Info pengujian laboratorium diperbarui'}.`, user);
  await saveDocs(app, user, files, { docName: 'Laporan Hasil Uji (LHU)', logId });
  if (files?.length || labLink) await notify(app, 'Hasil pengujian laboratorium', 'Laporan Hasil Uji (LHU) untuk pengajuan Anda sudah tersedia dan dapat dilihat pada tahap Pengujian laboratorium di akun SILAPP.');
}

module.exports = { approve, notifyIssued, requestAction, ignore, reject, updateParameter, updateLabInfo };
