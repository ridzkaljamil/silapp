const jwt = require('jsonwebtoken');
const { one } = require('../config/db');

/** Token login. tv (token_version) naik setiap kata sandi diganti/di-reset, sehingga token lama tidak berlaku lagi. */
const signToken = (u) => jwt.sign({ id: u.id, role: u.role, tv: u.token_version || 0 }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '1d' });
/** Sesi diperpanjang otomatis selama pengguna aktif: token baru dikirim bila token lama berumur lebih dari 30 menit. */
const REFRESH_AFTER = 30 * 60;

/**
 * Wajib login: membaca token Bearer dan memuat data user terbaru.
 * Akun yang dibuat Admin (sandi sementara) wajib ganti sandi dulu sebelum memakai fitur lain.
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Silakan masuk terlebih dahulu.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await one(
      'SELECT id, role, name, email, jabatan, bidang, company_name, nib, npwp, phone, address, avatar, is_active, must_change_password, token_version FROM users WHERE id=?', [payload.id]);
    if (!user || !user.is_active) return res.status(401).json({ message: 'Akun tidak aktif.' });
    // kata sandi sudah diganti/di-reset sejak token ini dibuat: sesi di perangkat lain otomatis keluar
    if ((payload.tv || 0) !== user.token_version) return res.status(401).json({ message: 'Kata sandi akun ini sudah diganti. Silakan masuk kembali.' });
    req.user = user;
    if (payload.iat && Date.now() / 1000 - payload.iat > REFRESH_AFTER) res.set('X-New-Token', signToken(user));
  } catch {
    return res.status(401).json({ message: 'Sesi berakhir, silakan masuk kembali.' });
  }
  if (req.user.must_change_password && !req.originalUrl.startsWith('/api/auth/')) {
    return res.status(403).json({ code: 'MUST_CHANGE_PASSWORD', message: 'Silakan ganti kata sandi sementara terlebih dahulu.' });
  }
  next();
}

/** RBAC: batasi endpoint untuk role tertentu. */
const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Anda tidak memiliki akses ke fitur ini.' });

module.exports = { requireAuth, allow, signToken };
