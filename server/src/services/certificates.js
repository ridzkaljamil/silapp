/**
 * Riwayat sertifikat (certificate_logs): terbit, perubahan status beserta alasannya, perubahan tanggal,
 * dan tampil/tidak di Directory. Dipakai untuk sertifikat SILAPP maupun proyek sebelum SILAPP.
 */
const { q, one } = require('../config/db');
const { picLabel } = require('./workflow/core');

async function logCert(source, cert, action, { status = null, note = null, user = null } = {}) {
  await q('INSERT INTO certificate_logs (source, cert_id, certificate_no, action, status, note, user_id, pic_label) VALUES (?,?,?,?,?,?,?,?)',
    [source, cert.id, cert.certificate_no, action, status, note ? String(note).slice(0, 2000) : null, user ? user.id : null, user ? picLabel(user) : 'Sistem']);
}

const history = (source, id) => q(`SELECT id, action, status, note, pic_label, created_at FROM certificate_logs
  WHERE source=? AND cert_id=? ORDER BY created_at DESC, id DESC`, [source, id]);

/** Alasan terakhir status ditangguhkan/dicabut (ditampilkan ke pelanggan di detail pengajuan). */
async function statusNote(source, id) {
  const r = await one(`SELECT note FROM certificate_logs WHERE source=? AND cert_id=? AND action='status' ORDER BY id DESC LIMIT 1`, [source, id]);
  return r?.note || null;
}

module.exports = { logCert, history, statusNote };
