/** Pengguna internal (Admin & Super Admin) dan daftar jabatan per bidang. Akun pelanggan dikelola di routes/customers.js. */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { q, one } = require('../../config/db');
const { inUse } = require('./helpers');

const JABATAN = {
  SP: ['Admin Sertifikasi', 'Manager Sertifikasi', 'Auditor', 'PPC', 'Reviewer', 'Decision Maker'],
  LAB: ['Admin Lab', 'Admin Penerimaan', 'Koordinator Lab', 'Petugas Preparasi', 'Analis', 'Reviewer/Verifikator', 'Penandatangan berwenang'],
  KAL: ['Admin Kalibrasi', 'Koordinator', 'Personel Kalibrasi', 'Reviewer/Verifikator', 'Penandatangan berwenang'],
};
router.get('/jabatan', (req, res) => res.json(JABATAN));

/* ---------- pengguna internal (Admin & Super Admin). Akun pelanggan dikelola di routes/customers.js ---------- */
router.get('/users', async (req, res, next) => {
  try {
    res.json(await q('SELECT id, role, name, email, jabatan, bidang, phone, is_active, created_at FROM users WHERE role<>"user" ORDER BY FIELD(role,"superadmin","admin"), name'));
  } catch (e) { next(e); }
});

/** Rapikan isian akun (spasi, huruf kecil email, panjang maksimal kolom). */
function cleanUser(b) {
  return { ...b, name: String(b.name ?? '').trim().slice(0, 120), email: String(b.email ?? '').trim().toLowerCase().slice(0, 160),
    company_name: String(b.company_name ?? '').trim().slice(0, 160), phone: String(b.phone ?? '').trim().slice(0, 30) };
}

function validUser(b) {
  if (!['superadmin', 'admin'].includes(b.role)) return 'Role tidak valid. Akun pelanggan dibuat lewat menu Akun Pelanggan.';
  if (!b.name || !b.email) return 'Nama dan email wajib diisi.';
  if (!/^\S+@\S+\.\S+$/.test(b.email)) return 'Format email tidak valid.';
  if (b.phone && !/^[0-9+()\-\s]{6,30}$/.test(b.phone)) return 'Nomor telepon tidak valid.';
  if (b.role === 'admin' && (!JABATAN[b.bidang] || !JABATAN[b.bidang].includes(b.jabatan))) return 'Admin wajib memiliki bidang dan jabatan yang sesuai.';
  return null;
}

router.post('/users', async (req, res, next) => {
  try {
    const b = cleanUser(req.body);
    const err = validUser(b) || (!b.password || b.password.length < 8 ? 'Kata sandi awal minimal 8 karakter.' : null);
    if (err) return res.status(400).json({ message: err });
    if (await one('SELECT id FROM users WHERE email=?', [b.email])) return res.status(409).json({ message: 'Email sudah dipakai.' });
    const r = await q('INSERT INTO users (role, name, email, password_hash, jabatan, bidang, company_name, phone) VALUES (?,?,?,?,?,?,?,?)',
      [b.role, b.name, b.email, await bcrypt.hash(b.password, 10), b.role === 'admin' ? b.jabatan : null, b.role === 'admin' ? b.bidang : null,
        'PT Penilai Standar Uji', b.phone || null]);
    res.status(201).json({ id: r.insertId });
  } catch (e) { next(e); }
});

router.put('/users/:id', async (req, res, next) => {
  try {
    const b = cleanUser(req.body);
    const err = validUser(b) || (b.password && b.password.length < 8 ? 'Kata sandi minimal 8 karakter.' : null);
    if (err) return res.status(400).json({ message: err });
    if (!(await one('SELECT id FROM users WHERE id=? AND role<>"user"', [req.params.id]))) return res.status(404).json({ message: 'Pengguna internal tidak ditemukan.' });
    if (+req.params.id === req.user.id && (b.role !== 'superadmin' || b.is_active === false)) {
      return res.status(400).json({ message: 'Anda tidak bisa menurunkan role atau menonaktifkan akun Anda sendiri.' });
    }
    if (await one('SELECT id FROM users WHERE email=? AND id<>?', [b.email, req.params.id])) return res.status(409).json({ message: 'Email sudah dipakai.' });
    await q('UPDATE users SET role=?, name=?, email=?, jabatan=?, bidang=?, phone=?, is_active=? WHERE id=?',
      [b.role, b.name, b.email, b.role === 'admin' ? b.jabatan : null, b.role === 'admin' ? b.bidang : null, b.phone || null, b.is_active === false ? 0 : 1, req.params.id]);
    if (b.password) {
      await q('UPDATE users SET password_hash=?, token_version=token_version+1 WHERE id=?', [await bcrypt.hash(b.password, 10), req.params.id]);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    if (+req.params.id === req.user.id) return res.status(400).json({ message: 'Tidak bisa menghapus akun sendiri.' });
    if (!(await one('SELECT id FROM users WHERE id=? AND role<>"user"', [req.params.id]))) return res.status(404).json({ message: 'Pengguna internal tidak ditemukan.' });
    const used = await one('SELECT (SELECT COUNT(*) FROM applications WHERE user_id=?) + (SELECT COUNT(*) FROM status_logs WHERE pic_user_id=?) n', [req.params.id, req.params.id]);
    if (used.n > 0) {
      // jejak audit tidak boleh hilang: nonaktifkan saja
      await q('UPDATE users SET is_active=0 WHERE id=?', [req.params.id]);
      return res.json({ ok: true, deactivated: true, message: 'Akun memiliki riwayat, jadi dinonaktifkan (tidak dihapus) agar audit trail tetap utuh.' });
    }
    try {
      await q('DELETE FROM users WHERE id=?', [req.params.id]);
    } catch (e) {
      // masih dirujuk data lain (mis. lampiran atau verifikasi pembayaran): nonaktifkan saja
      if (!inUse(e)) throw e;
      await q('UPDATE users SET is_active=0 WHERE id=?', [req.params.id]);
      return res.json({ ok: true, deactivated: true, message: 'Akun memiliki riwayat, jadi dinonaktifkan (tidak dihapus) agar audit trail tetap utuh.' });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
