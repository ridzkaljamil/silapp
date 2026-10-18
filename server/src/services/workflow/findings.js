/** Temuan audit Sertifikasi Produk: input, tinjauan, perbaikan, dan perpanjangan tenggat. */
const { q, one } = require('../../config/db');
const { notifyStaff } = require('../notifications');
const { httpError, tgl, is1BFlow, stepOf, assertOpen, addLog, saveDocs, notify } = require('./core');

/* ------------------------- TEMUAN AUDIT (SP) ------------------------- */

const MONTHS = { mayor: 1, minor: 2 };
const assertFindingStage = (app) => {
  if (app.service_code !== 'SP') throw httpError(400, 'Temuan audit hanya untuk Sertifikasi Produk.');
  if (is1BFlow(app)) throw httpError(400, 'Skema Tipe 1b tidak melalui audit, jadi tidak ada temuan audit.');
  assertOpen(app);
  const code = stepOf(app).status_code;
  if (!['ST-05', 'ST-06', 'ST-07'].includes(code)) throw httpError(400, 'Temuan dapat diinput pada tahap ST-05 s.d. ST-07.');
};

/** Admin menginput laporan audit + temuan. Tenggat otomatis (mayor 1 bln, minor 2 bln), dapat diubah. */
async function addFindings(app, user, { reportDate, items }) {
  assertFindingStage(app);
  if (!reportDate) throw httpError(400, 'Tanggal laporan audit wajib diisi.');
  const list = (items || []).filter((i) => i.description?.trim());
  if (!list.length) throw httpError(400, 'Isi minimal satu temuan.');
  const count = { mayor: 0, minor: 0, observasi: 0 };
  for (const it of list) {
    if (!MONTHS[it.category] && it.category !== 'observasi') throw httpError(400, 'Kategori temuan tidak valid.');
    count[it.category]++;
    const due = it.category === 'observasi' ? null
      : it.due_date || (await one(`SELECT DATE_ADD(?, INTERVAL ${MONTHS[it.category]} MONTH) d`, [reportDate])).d;
    await q('INSERT INTO findings (application_id, category, description, report_date, due_date, created_by) VALUES (?,?,?,?,?,?)',
      [app.id, it.category, it.description.trim(), reportDate, due, user.id]);
  }
  await q('UPDATE applications SET audit_report_date=? WHERE id=?', [reportDate, app.id]);
  if (count.mayor + count.minor > 0) await q('UPDATE applications SET nc_flag=1 WHERE id=?', [app.id]);
  const parts = Object.entries(count).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(', ');
  await addLog(app, 'temuan', `Laporan audit (${tgl(reportDate)}): ${parts}. ${count.mayor + count.minor ? 'Mohon kirim bukti perbaikan sebelum tenggat.' : 'Tidak ada tindakan wajib.'}`, user);
  await notify(app, 'Hasil audit: temuan', `Laporan audit tanggal ${tgl(reportDate)} mencatat temuan: ${parts}.\n` +
    'Tenggat perbaikan: mayor 1 bulan dan minor 2 bulan sejak tanggal laporan audit. Temuan observasi tidak memerlukan tindakan wajib.\n' +
    'Silakan lihat rincian temuan dan unggah bukti perbaikan melalui akun SILAPP. Bila membutuhkan waktu lebih, Anda dapat mengajukan perpanjangan 1 bulan (satu kali per temuan).');
}

async function getFinding(app, id) {
  const f = await one('SELECT * FROM findings WHERE id=? AND application_id=?', [id, app.id]);
  if (!f) throw httpError(404, 'Temuan tidak ditemukan.');
  return f;
}
const fLabel = (f) => `Temuan ${f.category} #${f.id}`;

/** Admin: tutup / minta perbaikan ulang / ubah tenggat / putuskan perpanjangan. */
async function adminFinding(app, user, id, { op, note, dueDate, description }) {
  assertOpen(app);
  const f = await getFinding(app, id);
  if (op === 'tutup') {
    await q('UPDATE findings SET status="ditutup", closed_at=NOW(), admin_note=? WHERE id=?', [note || null, id]);
    await addLog(app, 'temuan', `${fLabel(f)} ditutup${note ? ': ' + note : '.'}`, user);
  } else if (op === 'ulang') {
    if (!note) throw httpError(400, 'Isi catatan perbaikan yang masih diperlukan.');
    await q('UPDATE findings SET status="terbuka", admin_note=? WHERE id=?', [note, id]);
    await addLog(app, 'temuan', `${fLabel(f)}: perbaikan belum memadai. ${note}`, user);
    await notify(app, 'Perbaikan temuan perlu dilengkapi', `${fLabel(f)} (${f.description})\nCatatan PSU: ${note}`);
  } else if (op === 'ubah') {
    await q('UPDATE findings SET due_date=?, description=? WHERE id=?', [f.category === 'observasi' ? null : dueDate || f.due_date, description?.trim() || f.description, id]);
    await addLog(app, 'temuan', `${fLabel(f)} diperbarui${dueDate && dueDate !== f.due_date ? `, tenggat menjadi ${tgl(dueDate)}` : ''}.`, user);
  } else if (op === 'perpanjang_setuju' || op === 'perpanjang_tolak') {
    if (f.extension_status !== 'diajukan') throw httpError(400, 'Tidak ada pengajuan perpanjangan untuk temuan ini.');
    if (op === 'perpanjang_setuju') {
      await q('UPDATE findings SET extension_status="disetujui", due_date=DATE_ADD(GREATEST(COALESCE(due_date, CURDATE()), CURDATE()), INTERVAL 1 MONTH) WHERE id=?', [id]);
      const nf = await getFinding(app, id);
      await addLog(app, 'perpanjangan', `Perpanjangan ${fLabel(f)} disetujui. Tenggat baru ${tgl(nf.due_date)}.`, user);
      await notify(app, 'Perpanjangan disetujui', `Perpanjangan waktu ${fLabel(f)} disetujui. Tenggat baru: ${tgl(nf.due_date)}.`);
    } else {
      await q('UPDATE findings SET extension_status="ditolak", admin_note=? WHERE id=?', [note || null, id]);
      await addLog(app, 'perpanjangan', `Perpanjangan ${fLabel(f)} tidak disetujui${note ? ': ' + note : '.'}`, user);
      await notify(app, 'Perpanjangan tidak disetujui', `Perpanjangan waktu ${fLabel(f)} tidak disetujui.${note ? '\nCatatan: ' + note : ''}`);
    }
  } else throw httpError(400, 'Aksi temuan tidak dikenal.');
}

/**
 * Pelanggan mengirim bukti perbaikan untuk satu temuan: koreksi, akar penyebab masalah, tindakan korektif untuk
 * mencegah pengulangan (wajib), keterangan tambahan (opsional), dan file bukti (wajib).
 */
async function customerFindingReply(app, user, id, { note, correction, rootCause, correctiveAction }, files) {
  assertOpen(app);
  const f = await getFinding(app, id);
  if (f.status === 'ditutup') throw httpError(400, 'Temuan ini sudah ditutup.');
  const t = (v) => String(v ?? '').trim().slice(0, 3000);
  [note, correction, rootCause, correctiveAction] = [t(note), t(correction), t(rootCause), t(correctiveAction)];
  if (!correction) throw httpError(400, 'Isi Koreksi.');
  if (!rootCause) throw httpError(400, 'Isi Akar Penyebab Masalah.');
  if (!correctiveAction) throw httpError(400, 'Isi Tindakan Korektif untuk Mencegah Pengulangan.');
  if (!files?.length) throw httpError(400, 'Unggah minimal satu file bukti perbaikan.');
  await q('UPDATE findings SET status="dikirim", customer_note=?, correction=?, root_cause=?, corrective_action=? WHERE id=?',
    [note || null, correction, rootCause, correctiveAction, id]);
  const logId = await addLog(app, 'tanggapan', `Bukti perbaikan ${fLabel(f)} dikirim.\nKoreksi: ${correction}\nAkar penyebab: ${rootCause}\nTindakan korektif: ${correctiveAction}${note ? `\nKeterangan: ${note}` : ''}`, user);
  await saveDocs(app, user, files, { docName: `Bukti Perbaikan ${fLabel(f)}`, logId, findingId: id });
  await notifyStaff(app, 'Bukti perbaikan temuan masuk', `${app.application_no} · ${app.company_name} · ${fLabel(f)}`);
}

/** Pelanggan mengajukan perpanjangan 1 bulan (maksimal 1 kali per temuan), boleh disertai lampiran pendukung. */
async function customerExtension(app, user, id, reason, files) {
  assertOpen(app);
  const f = await getFinding(app, id);
  if (f.category === 'observasi') throw httpError(400, 'Temuan observasi tidak memiliki tenggat.');
  if (f.status === 'ditutup') throw httpError(400, 'Temuan ini sudah ditutup.');
  if (f.extension_status !== 'tidak') throw httpError(400, 'Perpanjangan hanya dapat diajukan satu kali per temuan.');
  if (!reason) throw httpError(400, 'Isi alasan perpanjangan.');
  await q('UPDATE findings SET extension_status="diajukan", extension_reason=? WHERE id=?', [String(reason).slice(0, 500), id]);
  const logId = await addLog(app, 'perpanjangan', `Pelanggan mengajukan perpanjangan 1 bulan untuk ${fLabel(f)}: ${reason}`, user);
  await saveDocs(app, user, files, { docName: `Lampiran Perpanjangan ${fLabel(f)}`, logId, findingId: id });
  await notifyStaff(app, 'Permintaan perpanjangan temuan', `${app.application_no} · ${app.company_name} · ${fLabel(f)}`);
}

module.exports = { addFindings, getFinding, adminFinding, customerFindingReply, customerExtension };
