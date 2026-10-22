/**
 * Login, profil & kata sandi. Tidak ada pendaftaran mandiri: akun pelanggan dibuat oleh Admin/Super Admin
 * setelah harga disepakati (lihat routes/customers.js).
 */
const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { q, one } = require('../config/db');
const { requireAuth, signToken: sign } = require('../middleware/auth');
const { makeUpload } = require('../utils/upload');
const storage = require('../utils/storage');
const { sendMail, appUrl } = require('../utils/mailer');

const publicUser = (u) => ({
  id: u.id, role: u.role, name: u.name, email: u.email, jabatan: u.jabatan, bidang: u.bidang, company_name: u.company_name,
  phone: u.phone || '', address: u.address || '', nib: u.nib || '', npwp: u.npwp || '',
  // ?v= berubah setiap foto diganti agar browser tidak memakai foto lama dari cache
  avatar_url: u.avatar ? `/api/public/avatar/${u.id}?v=${storage.version(u.avatar)}` : null,
  must_change_password: !!u.must_change_password,
});

/** Foto profil: hanya JPG/PNG, maks. 2 MB. */
const avatarUpload = makeUpload({ allowed: ['.jpg', '.jpeg', '.png'], maxMB: 2, message: 'Format file harus JPG atau PNG.', prefix: 'avatar-' });
const removeFile = (key) => storage.remove(key);

/* Batasi percobaan masuk: 8 kali gagal per email + IP dalam 15 menit, lalu dikunci sementara. */
const FAILS = new Map();
const WINDOW = 15 * 60 * 1000;
const MAX_FAILS = 8;
const failKey = (req, email) => `${req.ip}|${String(email || '').toLowerCase()}`;
const lockedFor = (key) => {
  const f = FAILS.get(key);
  if (!f || Date.now() - f.first > WINDOW) { FAILS.delete(key); return 0; }
  return f.count >= MAX_FAILS ? Math.ceil((f.first + WINDOW - Date.now()) / 60000) : 0;
};
const addFail = (key) => {
  const f = FAILS.get(key);
  if (!f || Date.now() - f.first > WINDOW) FAILS.set(key, { count: 1, first: Date.now() }); else f.count += 1;
  if (FAILS.size > 5000) FAILS.clear(); // jaga memori
};
const PW_MIN = 8;
const pwError = (pw) => (!pw || String(pw).length < PW_MIN ? `Kata sandi baru minimal ${PW_MIN} karakter.` : String(pw).length > 72 ? 'Kata sandi maksimal 72 karakter.' : null);

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { password } = req.body;
    const key = failKey(req, email);
    const wait = lockedFor(key);
    if (wait) return res.status(429).json({ message: `Terlalu banyak percobaan masuk. Coba lagi dalam ${wait} menit.` });
    const user = await one('SELECT * FROM users WHERE email=?', [email]);
    if (!user || !user.is_active || !(await bcrypt.compare(password || '', user.password_hash))) {
      addFail(key);
      return res.status(401).json({ message: 'Email atau kata sandi salah.' });
    }
    FAILS.delete(key);
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) { next(e); }
});

router.get('/me', requireAuth, (req, res) => res.json(publicUser(req.user)));

/** Pengaturan akun: nama, telepon, alamat. Email & perusahaan dikelola Admin. */
router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    // pelanggan hanya dapat mengubah nama penanggung jawab & telepon; data perusahaan (nama, NIB, NPWP, alamat)
    // dipakai di invoice & sertifikat sehingga diubah lewat Admin PSU (menu Akun Pelanggan)
    const customer = req.user.role === 'user';
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    const address = customer ? String(req.user.address || '') : String(req.body.address || '').trim();
    if (customer && !phone) return res.status(400).json({ message: 'Nomor telepon wajib diisi.' });
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
    const bad = pwError(new_password);
    if (bad) return res.status(400).json({ message: bad });
    if (new_password === old_password) return res.status(400).json({ message: 'Kata sandi baru harus berbeda dari kata sandi lama.' });
    await q('UPDATE users SET password_hash=?, must_change_password=0, token_version=token_version+1 WHERE id=?', [await bcrypt.hash(new_password, 10), u.id]);
    // sesi di perangkat lain keluar; perangkat ini langsung memakai token baru
    const fresh = { ...u, must_change_password: 0, token_version: u.token_version + 1 };
    res.json({ token: sign(fresh), user: publicUser(fresh) });
  } catch (e) { next(e); }
});

/* ---------- Lupa kata sandi (mandiri lewat email) ---------- */
const RESET_MINUTES = 30;
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const RESET_HITS = new Map(); // batasi permintaan: 5 per IP dalam 15 menit
const tooMany = (ip) => {
  const now = Date.now();
  const hits = (RESET_HITS.get(ip) || []).filter((t) => now - t < WINDOW);
  hits.push(now);
  RESET_HITS.set(ip, hits);
  if (RESET_HITS.size > 5000) RESET_HITS.clear();
  return hits.length > 5;
};

/**
 * Kirim tautan reset ke email akun. Jawaban selalu sama (berhasil) agar tidak bisa dipakai untuk mengecek
 * email mana yang terdaftar. Satu akun hanya bisa meminta tautan baru setiap 2 menit.
 */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Masukkan alamat email yang valid.' });
    if (tooMany(req.ip)) return res.status(429).json({ message: 'Terlalu banyak permintaan. Coba lagi dalam 15 menit.' });
    const done = { message: 'Jika email terdaftar, tautan untuk membuat kata sandi baru sudah dikirim. Periksa kotak masuk atau folder spam.' };
    const u = await one('SELECT id, name, email, is_active FROM users WHERE email=?', [email]);
    if (!u || !u.is_active) return res.json(done);
    if (await one('SELECT id FROM password_resets WHERE user_id=? AND used_at IS NULL AND created_at > NOW() - INTERVAL 2 MINUTE', [u.id])) return res.json(done);
    const token = crypto.randomBytes(32).toString('hex');
    await q('UPDATE password_resets SET used_at=NOW() WHERE user_id=? AND used_at IS NULL', [u.id]); // tautan lama tidak berlaku
    await q(`INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?,?, NOW() + INTERVAL ${RESET_MINUTES} MINUTE)`, [u.id, hashToken(token)]);
    await sendMail(u.email, '[SILAPP] Buat kata sandi baru',
      `Halo ${u.name},\n\nKami menerima permintaan untuk membuat kata sandi baru akun SILAPP Anda. Buka tautan berikut (berlaku ${RESET_MINUTES} menit, hanya bisa dipakai sekali):\n\n${appUrl()}/reset-sandi?token=${token}\n\nJika Anda tidak meminta ini, abaikan email ini. Kata sandi Anda tidak berubah.`,
      [], { secret: true });
    res.json(done);
  } catch (e) { next(e); }
});

/** Cek tautan reset sebelum formulir ditampilkan. */
router.get('/reset-password/:token', async (req, res, next) => {
  try {
    const r = await one(`SELECT u.email FROM password_resets p JOIN users u ON u.id=p.user_id
      WHERE p.token_hash=? AND p.used_at IS NULL AND p.expires_at > NOW() AND u.is_active=1`, [hashToken(req.params.token)]);
    if (!r) return res.status(400).json({ message: 'Tautan tidak berlaku atau sudah kedaluwarsa. Minta tautan baru.' });
    res.json({ email: r.email });
  } catch (e) { next(e); }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, new_password } = req.body;
    const bad = pwError(new_password);
    if (bad) return res.status(400).json({ message: bad });
    const r = await one(`SELECT p.id, p.user_id FROM password_resets p JOIN users u ON u.id=p.user_id
      WHERE p.token_hash=? AND p.used_at IS NULL AND p.expires_at > NOW() AND u.is_active=1`, [hashToken(token)]);
    if (!r) return res.status(400).json({ message: 'Tautan tidak berlaku atau sudah kedaluwarsa. Minta tautan baru.' });
    // tandai terpakai lebih dulu (sekali pakai, aman dari klik ganda)
    const used = await q('UPDATE password_resets SET used_at=NOW() WHERE id=? AND used_at IS NULL', [r.id]);
    if (!used.affectedRows) return res.status(400).json({ message: 'Tautan sudah dipakai. Silakan masuk dengan kata sandi baru.' });
    await q('UPDATE users SET password_hash=?, must_change_password=0, token_version=token_version+1 WHERE id=?', [await bcrypt.hash(new_password, 10), r.user_id]);
    res.json({ message: 'Kata sandi baru tersimpan. Silakan masuk.' });
  } catch (e) { next(e); }
});

module.exports = router;
