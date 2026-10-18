const bcrypt = require('bcryptjs');
const { q, one } = require('./db');

/**
 * Akun Super Admin pertama untuk server baru (database hasil import silapp-init.sql belum punya akun).
 * Dibuat saat server menyala jika SUPERADMIN_EMAIL dan SUPERADMIN_PASSWORD diisi di .env
 * dan belum ada Super Admin sama sekali. Setelah berhasil masuk, kosongkan SUPERADMIN_PASSWORD di .env.
 */
module.exports = async function ensureSuperAdmin() {
  const email = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.SUPERADMIN_PASSWORD || '');
  const exists = await one("SELECT id FROM users WHERE role='superadmin' LIMIT 1");

  if (!email || !password) {
    if (!exists) console.warn('! Belum ada akun Super Admin. Isi SUPERADMIN_EMAIL dan SUPERADMIN_PASSWORD di .env lalu restart aplikasi.');
    return;
  }
  if (exists) {
    console.warn('! SUPERADMIN_PASSWORD diabaikan karena Super Admin sudah ada. Kosongkan SUPERADMIN_PASSWORD di .env.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.warn('! SUPERADMIN_EMAIL tidak valid, akun Super Admin belum dibuat.');
    return;
  }
  if (password.length < 8) {
    console.warn('! SUPERADMIN_PASSWORD minimal 8 karakter, akun Super Admin belum dibuat.');
    return;
  }
  if (await one('SELECT id FROM users WHERE email=?', [email])) {
    console.warn(`! Email ${email} sudah dipakai akun lain, akun Super Admin belum dibuat.`);
    return;
  }
  await q("INSERT INTO users (role, name, email, password_hash, company_name) VALUES ('superadmin', ?, ?, ?, 'PT Penilai Standar Uji')",
    [String(process.env.SUPERADMIN_NAME || 'Super Admin PSU').trim().slice(0, 120), email, await bcrypt.hash(password, 10)]);
  console.log(`> akun Super Admin ${email} dibuat. Kosongkan SUPERADMIN_PASSWORD di .env setelah berhasil masuk.`);
};
