/**
 * Akun pelanggan dibuat Admin / Super Admin setelah harga disepakati.
 * Sistem membuat kata sandi sementara, mengirimkannya lewat email, dan pelanggan wajib menggantinya saat login pertama.
 */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { q, one } = require('../config/db');
const { requireAuth, allow } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');

router.use(requireAuth, allow('admin', 'superadmin'));

const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const tempPassword = () => Array.from(crypto.randomBytes(10), (b) => CH[b % CH.length]).join('');
const APP_URL = () => process.env.CLIENT_URL || 'http://localhost:5173';

function sendLogin(u, pass, reset) {
  return sendMail(u.email, reset ? '[SILAPP] Kata sandi akun Anda direset' : '[SILAPP] Akun SILAPP Anda telah dibuat',
    `Yth. ${u.name} (${u.company_name}),\n\n${reset ? 'Kata sandi akun SILAPP Anda telah direset oleh Admin PSU.' : 'Akun SILAPP Anda telah dibuat oleh PT Penilai Standar Uji. Melalui SILAPP Anda dapat mengajukan layanan dan memantau progres pengajuan.'}\n\n` +
    `Alamat  : ${APP_URL()}/masuk\nEmail   : ${u.email}\nKata sandi sementara: ${pass}\n\nDemi keamanan, Anda wajib mengganti kata sandi saat pertama kali masuk.\n\nHormat kami,\nPT Penilai Standar Uji`);
}

const FIELDS = ['name', 'email', 'company_name', 'nib_npwp', 'phone', 'address'];

router.get('/', async (req, res, next) => {
  try {
    res.json(await q(`SELECT u.id, u.name, u.email, u.company_name, u.nib_npwp, u.phone, u.address, u.is_active, u.must_change_password, u.created_at,
        c.name created_by_name, (SELECT COUNT(*) FROM applications a WHERE a.user_id=u.id) applications
      FROM users u LEFT JOIN users c ON c.id=u.created_by WHERE u.role='user' ORDER BY u.created_at DESC, u.id DESC`));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.name || !b.email || !b.company_name) return res.status(400).json({ message: 'Nama penanggung jawab, email, dan nama perusahaan wajib diisi.' });
    if (!/^\S+@\S+\.\S+$/.test(b.email)) return res.status(400).json({ message: 'Format email tidak valid.' });
    if (await one('SELECT id FROM users WHERE email=?', [b.email])) return res.status(409).json({ message: 'Email sudah terdaftar.' });
    const pass = tempPassword();
    const r = await q(`INSERT INTO users (role, name, email, password_hash, company_name, nib_npwp, phone, address, must_change_password, created_by)
      VALUES ("user",?,?,?,?,?,?,?,1,?)`, [b.name, b.email, await bcrypt.hash(pass, 10), b.company_name, b.nib_npwp || null, b.phone || null, b.address || null, req.user.id]);
    await sendLogin(b, pass);
    // sandi sementara ditampilkan sekali ke Admin, untuk berjaga jika email tidak terkirim
    res.status(201).json({ id: r.insertId, temp_password: pass });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const u = await one('SELECT * FROM users WHERE id=? AND role="user"', [req.params.id]);
    if (!u) return res.status(404).json({ message: 'Pelanggan tidak ditemukan.' });
    const b = { ...u, ...Object.fromEntries(FIELDS.filter((k) => k in req.body).map((k) => [k, req.body[k]])) };
    if (!b.name || !b.email || !b.company_name) return res.status(400).json({ message: 'Nama, email, dan perusahaan wajib diisi.' });
    if (await one('SELECT id FROM users WHERE email=? AND id<>?', [b.email, u.id])) return res.status(409).json({ message: 'Email sudah dipakai.' });
    await q('UPDATE users SET name=?, email=?, company_name=?, nib_npwp=?, phone=?, address=?, is_active=? WHERE id=?',
      [b.name, b.email, b.company_name, b.nib_npwp || null, b.phone || null, b.address || null, req.body.is_active === false ? 0 : 1, u.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const u = await one('SELECT * FROM users WHERE id=? AND role="user"', [req.params.id]);
    if (!u) return res.status(404).json({ message: 'Pelanggan tidak ditemukan.' });
    const pass = tempPassword();
    await q('UPDATE users SET password_hash=?, must_change_password=1 WHERE id=?', [await bcrypt.hash(pass, 10), u.id]);
    await sendLogin(u, pass, true);
    res.json({ temp_password: pass });
  } catch (e) { next(e); }
});

module.exports = router;
