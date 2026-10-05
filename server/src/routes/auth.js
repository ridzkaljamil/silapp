const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { q, one } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const sign = (u) => jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '1d' });
const publicUser = (u) => ({ id: u.id, role: u.role, name: u.name, email: u.email, jabatan: u.jabatan, bidang: u.bidang, company_name: u.company_name });

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, company_name, nib_npwp, phone } = req.body;
    if (!name || !email || !password || !company_name) return res.status(400).json({ message: 'Nama, email, kata sandi, dan nama perusahaan wajib diisi.' });
    if (password.length < 8) return res.status(400).json({ message: 'Kata sandi minimal 8 karakter.' });
    if (await one('SELECT id FROM users WHERE email=?', [email])) return res.status(409).json({ message: 'Email sudah terdaftar.' });
    const hash = await bcrypt.hash(password, 10);
    const r = await q('INSERT INTO users (role, name, email, password_hash, company_name, nib_npwp, phone) VALUES ("user",?,?,?,?,?,?)',
      [name, email, hash, company_name, nib_npwp || null, phone || null]);
    const user = await one('SELECT * FROM users WHERE id=?', [r.insertId]);
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await one('SELECT * FROM users WHERE email=?', [email || '']);
    if (!user || !user.is_active || !(await bcrypt.compare(password || '', user.password_hash))) {
      return res.status(401).json({ message: 'Email atau kata sandi salah.' });
    }
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) { next(e); }
});

router.get('/me', requireAuth, (req, res) => res.json(publicUser(req.user)));

module.exports = router;
