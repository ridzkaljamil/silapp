const jwt = require('jsonwebtoken');
const { one } = require('../config/db');

/** Wajib login: membaca token Bearer dan memuat data user terbaru. */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Silakan masuk terlebih dahulu.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await one(
      'SELECT id, role, name, email, jabatan, bidang, company_name, is_active FROM users WHERE id=?', [payload.id]);
    if (!user || !user.is_active) return res.status(401).json({ message: 'Akun tidak aktif.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Sesi berakhir, silakan masuk kembali.' });
  }
}

/** RBAC: batasi endpoint untuk role tertentu. */
const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Anda tidak memiliki akses ke fitur ini.' });

module.exports = { requireAuth, allow };
