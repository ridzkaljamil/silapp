/**
 * Login, profil & kata sandi. Tidak ada pendaftaran mandiri: akun pelanggan dibuat oleh Admin/Super Admin
 * setelah harga disepakati (lihat routes/customers.js).
 */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { q, one } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { UPLOAD_DIR } = require('../utils/upload');

const sign = (u) => jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '1d' });
const publicUser = (u) => ({
  id: u.id, role: u.role, name: u.name, email: u.email, jabatan: u.jabatan, bidang: u.bidang, company_name: u.company_name,
  phone: u.phone || '', address: u.address || '',
  avatar_url: u.avatar ? `/api/public/avatar/${u.avatar}` : null,
  must_change_password: !!u.must_change_password,
});

/** Foto profil: hanya JPG/PNG, maks. 2 MB. */
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `avatar-${req.user.id}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png'].includes(path.extname(file.originalname).toLowerCase()) && /^image\/(jpeg|png)$/.test(file.mimetype);
    cb(ok ? null : new Error('Format file harus JPG atau PNG.'), ok);
  },
});
const removeFile = (name) => { if (name) fs.rm(path.join(UPLOAD_DIR, path.basename(name)), { force: true }, () => {}); };

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

/** Pengaturan akun: nama, telepon, alamat. Email & perusahaan dikelola Admin. */
router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    const address = String(req.body.address || '').trim();
    if (name.length < 2 || name.length > 120) return res.status(400).json({ message: 'Nama minimal 2 dan maksimal 120 karakter.' });
    if (phone && !/^[0-9+()\-\s]{6,30}$/.test(phone)) return res.status(400).json({ message: 'Nomor telepon tidak valid.' });
    if (address.length > 255) return res.status(400).json({ message: 'Alamat maksimal 255 karakter.' });
    await q('UPDATE users SET name=?, phone=?, address=? WHERE id=?', [name, phone || null, address || null, req.user.id]);
    res.json({ user: publicUser({ ...req.user, name, phone, address }) });
  } catch (e) { next(e); }
});

router.post('/avatar', requireAuth, avatarUpload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Pilih foto terlebih dahulu.' });
    await q('UPDATE users SET avatar=? WHERE id=?', [req.file.filename, req.user.id]);
    removeFile(req.user.avatar);
    res.json({ user: publicUser({ ...req.user, avatar: req.file.filename }) });
  } catch (e) { next(e); }
});

router.delete('/avatar', requireAuth, async (req, res, next) => {
  try {
    await q('UPDATE users SET avatar=NULL WHERE id=?', [req.user.id]);
    removeFile(req.user.avatar);
    res.json({ user: publicUser({ ...req.user, avatar: null }) });
  } catch (e) { next(e); }
});

/** Ganti kata sandi (wajib saat login pertama dengan sandi sementara). */
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { old_password, new_password } = req.body;
    const u = await one('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!(await bcrypt.compare(old_password || '', u.password_hash))) return res.status(400).json({ message: 'Kata sandi lama salah.' });
    if (!new_password || new_password.length < 8) return res.status(400).json({ message: 'Kata sandi baru minimal 8 karakter.' });
    if (new_password === old_password) return res.status(400).json({ message: 'Kata sandi baru harus berbeda dari kata sandi lama.' });
    await q('UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?', [await bcrypt.hash(new_password, 10), u.id]);
    res.json({ user: publicUser({ ...u, must_change_password: 0 }) });
  } catch (e) { next(e); }
});

module.exports = router;
