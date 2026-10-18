/**
 * Notifikasi di dalam aplikasi (ikon lonceng). Melengkapi email:
 * pelanggan menerima kabar setiap ada perubahan pengajuannya, Admin/Super Admin menerima kabar
 * saat pelanggan melakukan sesuatu yang perlu ditindaklanjuti.
 */
const { q } = require('../config/db');

const clip = (t, n) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

async function notifyUser(userId, title, body, link) {
  if (!userId) return;
  await q('INSERT INTO notifications (user_id, title, body, link) VALUES (?,?,?,?)', [userId, clip(title, 160), clip(body, 300) || null, link || null]);
}

/** Pelanggan pemilik pengajuan. */
const notifyCustomer = (app, title, body) => notifyUser(app.user_id, title, body, `/klien/pengajuan/${app.id}`);

/** Super Admin + Admin di satu bidang (kecuali pelaku aksi). */
async function notifyBidang(bidang, title, body, link, exceptId = null) {
  const staff = await q("SELECT id FROM users WHERE is_active=1 AND (role='superadmin' OR (role='admin' AND bidang=?))", [bidang]);
  const to = staff.filter((u) => u.id !== exceptId);
  if (!to.length) return;
  // satu query untuk semua penerima
  await q('INSERT INTO notifications (user_id, title, body, link) VALUES ?', [to.map((u) => [u.id, clip(title, 160), clip(body, 300) || null, link || null])]);
}

/** Super Admin + Admin di bidang pengajuan (kecuali pelaku aksi). */
const notifyStaff = (app, title, body, exceptId = null) =>
  notifyBidang(app.service_bidang, title, body || `${app.application_no} · ${app.company_name || ''}`, `/admin/pengajuan/${app.id}`, exceptId);

module.exports = { notifyUser, notifyCustomer, notifyStaff, notifyBidang };
