/** Khusus Super Admin: kelola pengguna (role, jabatan, bidang) dan master layanan. */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { q, one } = require('../config/db');
const { requireAuth, allow } = require('../middleware/auth');

router.use(requireAuth, allow('superadmin'));

const JABATAN = {
  SP: ['Admin Sertifikasi', 'Manager Sertifikasi', 'Auditor', 'PPC', 'Reviewer', 'Decision Maker'],
  LAB: ['Admin Lab', 'Admin Penerimaan', 'Koordinator Lab', 'Petugas Preparasi', 'Analis', 'Reviewer/Verifikator', 'Penandatangan berwenang'],
  KAL: ['Admin Kalibrasi', 'Koordinator', 'Personel Kalibrasi', 'Reviewer/Verifikator', 'Penandatangan berwenang'],
};
router.get('/jabatan', (req, res) => res.json(JABATAN));

/* ---------- pengguna ---------- */
router.get('/users', async (req, res, next) => {
  try {
    res.json(await q('SELECT id, role, name, email, jabatan, bidang, company_name, phone, is_active, created_at FROM users ORDER BY FIELD(role,"superadmin","admin","user"), name'));
  } catch (e) { next(e); }
});

function validUser(b) {
  if (!['superadmin', 'admin', 'user'].includes(b.role)) return 'Role tidak valid.';
  if (!b.name || !b.email) return 'Nama dan email wajib diisi.';
  if (b.role === 'admin' && (!JABATAN[b.bidang] || !JABATAN[b.bidang].includes(b.jabatan))) return 'Admin wajib memiliki bidang dan jabatan yang sesuai.';
  return null;
}

router.post('/users', async (req, res, next) => {
  try {
    const b = req.body;
    const err = validUser(b) || (!b.password || b.password.length < 8 ? 'Kata sandi awal minimal 8 karakter.' : null);
    if (err) return res.status(400).json({ message: err });
    if (await one('SELECT id FROM users WHERE email=?', [b.email])) return res.status(409).json({ message: 'Email sudah dipakai.' });
    const r = await q('INSERT INTO users (role, name, email, password_hash, jabatan, bidang, company_name, phone) VALUES (?,?,?,?,?,?,?,?)',
      [b.role, b.name, b.email, await bcrypt.hash(b.password, 10), b.role === 'admin' ? b.jabatan : null, b.role === 'admin' ? b.bidang : null,
        b.company_name || (b.role === 'user' ? null : 'PT Penilai Standar Uji'), b.phone || null]);
    res.status(201).json({ id: r.insertId });
  } catch (e) { next(e); }
});

router.put('/users/:id', async (req, res, next) => {
  try {
    const b = req.body;
    const err = validUser(b);
    if (err) return res.status(400).json({ message: err });
    if (await one('SELECT id FROM users WHERE email=? AND id<>?', [b.email, req.params.id])) return res.status(409).json({ message: 'Email sudah dipakai.' });
    await q('UPDATE users SET role=?, name=?, email=?, jabatan=?, bidang=?, company_name=?, phone=?, is_active=? WHERE id=?',
      [b.role, b.name, b.email, b.role === 'admin' ? b.jabatan : null, b.role === 'admin' ? b.bidang : null, b.company_name || null, b.phone || null, b.is_active === false ? 0 : 1, req.params.id]);
    if (b.password) {
      if (b.password.length < 8) return res.status(400).json({ message: 'Kata sandi minimal 8 karakter.' });
      await q('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(b.password, 10), req.params.id]);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    if (+req.params.id === req.user.id) return res.status(400).json({ message: 'Tidak bisa menghapus akun sendiri.' });
    const used = await one('SELECT (SELECT COUNT(*) FROM applications WHERE user_id=?) + (SELECT COUNT(*) FROM status_logs WHERE pic_user_id=?) n', [req.params.id, req.params.id]);
    if (used.n > 0) {
      // jejak audit tidak boleh hilang: nonaktifkan saja
      await q('UPDATE users SET is_active=0 WHERE id=?', [req.params.id]);
      return res.json({ ok: true, deactivated: true, message: 'Akun memiliki riwayat, jadi dinonaktifkan (tidak dihapus) agar audit trail tetap utuh.' });
    }
    await q('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ---------- master layanan ---------- */
router.get('/services', async (req, res, next) => {
  try {
    const services = await q('SELECT * FROM services ORDER BY sort_order');
    const steps = await q('SELECT * FROM service_steps ORDER BY service_id, step_order');
    res.json(services.map((s) => ({ ...s, steps: steps.filter((x) => x.service_id === s.id) })));
  } catch (e) { next(e); }
});

router.put('/services/:id', async (req, res, next) => {
  try {
    const b = req.body;
    await q('UPDATE services SET name=?, description=?, cp_name=?, cp_phone=?, est_text=?, state=?, is_active=? WHERE id=?',
      [b.name, b.description, b.cp_name || null, b.cp_phone || null, b.est_text || null, ['ok', 'dev', 'prep'].includes(b.state) ? b.state : 'ok', b.is_active === false ? 0 : 1, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.put('/steps/:id', async (req, res, next) => {
  try {
    const b = req.body;
    await q('UPDATE service_steps SET name=?, sla_days=? WHERE id=?', [b.name, b.sla_days === '' || b.sla_days == null ? null : +b.sla_days, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
