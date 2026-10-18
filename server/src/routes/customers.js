/**
 * Akun pelanggan dibuat Admin / Super Admin setelah harga disepakati.
 * Sistem membuat kata sandi sementara, mengirimkannya lewat email, dan pelanggan wajib menggantinya saat login pertama.
 */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { q, one } = require('../config/db');
const { requireAuth, allow } = require('../middleware/auth');
const { sendMail, appUrl } = require('../utils/mailer');

router.use(requireAuth, allow('admin', 'superadmin'));

const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const tempPassword = () => Array.from(crypto.randomBytes(10), (b) => CH[b % CH.length]).join('');

function sendLogin(u, pass, reset) {
  return sendMail(u.email, reset ? '[SILAPP] Kata sandi akun Anda direset' : '[SILAPP] Akun SILAPP Anda telah dibuat',
    `Yth. ${u.name} (${u.company_name}),\n\n${reset ? 'Kata sandi akun SILAPP Anda telah direset oleh Admin PSU.' : 'Akun SILAPP Anda telah dibuat oleh PT Penilai Standar Uji. Melalui SILAPP Anda dapat mengajukan layanan dan memantau progres pengajuan.'}\n\n` +
    `Alamat  : ${appUrl()}/masuk\nEmail   : ${u.email}\nKata sandi sementara: ${pass}\n\nDemi keamanan, Anda wajib mengganti kata sandi saat pertama kali masuk.\n\nHormat kami,\nPT Penilai Standar Uji`,
    [], { secret: true }); // berisi kata sandi: isi email tidak disimpan di log
}

/**
 * Peringatan data ganda: NIB/NPWP yang sama sudah dipakai akun lain (mis. cabang perusahaan dengan PIC berbeda).
 * Tidak memblokir: Admin bisa tetap menyimpan setelah konfirmasi (confirm_duplicate).
 */
async function duplicateOf(b, exceptId = 0) {
  const rows = await q(`SELECT company_name, email, nib, npwp FROM users WHERE role='user' AND id<>? AND (nib=? OR npwp=?) ORDER BY id LIMIT 3`, [exceptId, b.nib, b.npwp]);
  if (!rows.length) return null;
  const what = rows.some((r) => r.nib === b.nib) ? (rows.some((r) => r.npwp === b.npwp) ? 'NIB dan NPWP' : 'NIB') : 'NPWP';
  return { code: 'DUPLICATE_COMPANY', message: `${what} ini sudah dipakai akun lain: ${rows.map((r) => `${r.company_name} (${r.email})`).join(', ')}. Tetap simpan sebagai akun terpisah?` };
}

const FIELDS = ['name', 'email', 'company_name', 'nib', 'npwp', 'phone', 'address'];
const LABEL = { company_name: 'Nama Perusahaan', nib: 'NIB', npwp: 'NPWP', address: 'Alamat Perusahaan (Sesuai NPWP)', name: 'Nama Penanggung Jawab', email: 'Email', phone: 'Nomor Telepon' };
/** NIB / NPWP disimpan sebagai angka saja (titik, strip, spasi dibuang). */
const digits = (v) => String(v ?? '').replace(/[\s.\-]/g, '');
/** Semua data akun pelanggan wajib diisi. */
function checkCustomer(b) {
  if (String(b.name ?? '').trim().length > 120 || String(b.company_name ?? '').trim().length > 160) return 'Nama terlalu panjang.';
  for (const k of ['company_name', 'nib', 'npwp', 'address', 'name', 'email', 'phone']) {
    if (!String(b[k] ?? '').trim()) return `${LABEL[k]} wajib diisi.`;
  }
  if (!/^\d{13}$/.test(b.nib)) return 'NIB harus 13 digit angka.';
  if (!/^(\d{15}|\d{16})$/.test(b.npwp)) return 'NPWP harus 15 atau 16 digit angka.';
  if (!/^\S+@\S+\.\S+$/.test(b.email)) return 'Format email tidak valid.';
  if (!/^[0-9+()\-\s]{6,30}$/.test(b.phone)) return 'Nomor telepon tidak valid.';
  if (String(b.address).length > 255) return 'Alamat maksimal 255 karakter.';
  return null;
}

router.get('/', async (req, res, next) => {
  try {
    res.json(await q(`SELECT u.id, u.name, u.email, u.company_name, u.nib, u.npwp, u.phone, u.address, u.is_active, u.must_change_password, u.created_at,
        c.name created_by_name, (SELECT COUNT(*) FROM applications a WHERE a.user_id=u.id) applications
      FROM users u LEFT JOIN users c ON c.id=u.created_by WHERE u.role='user' ORDER BY u.created_at DESC, u.id DESC`));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = Object.fromEntries(FIELDS.map((k) => [k, String(req.body[k] ?? '').trim()]));
    b.email = b.email.toLowerCase();
    b.nib = digits(b.nib); b.npwp = digits(b.npwp);
    const err = checkCustomer(b);
    if (err) return res.status(400).json({ message: err });
    if (await one('SELECT id FROM users WHERE email=?', [b.email])) return res.status(409).json({ message: 'Email sudah terdaftar.' });
    const dup = req.body.confirm_duplicate === true ? null : await duplicateOf(b);
    if (dup) return res.status(409).json(dup);
    const pass = tempPassword();
    const r = await q(`INSERT INTO users (role, name, email, password_hash, company_name, nib, npwp, phone, address, must_change_password, created_by)
      VALUES ('user',?,?,?,?,?,?,?,?,1,?)`, [b.name, b.email, await bcrypt.hash(pass, 10), b.company_name, b.nib, b.npwp, b.phone || null, b.address || null, req.user.id]);
    await sendLogin(b, pass);
    // sandi sementara ditampilkan sekali ke Admin, untuk berjaga jika email tidak terkirim
    res.status(201).json({ id: r.insertId, temp_password: pass });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const u = await one('SELECT * FROM users WHERE id=? AND role="user"', [req.params.id]);
    if (!u) return res.status(404).json({ message: 'Pelanggan tidak ditemukan.' });
    const b = { ...u, ...Object.fromEntries(FIELDS.filter((k) => k in req.body).map((k) => [k, String(req.body[k] ?? '').trim()])) };
    b.email = b.email.toLowerCase();
    b.nib = digits(b.nib); b.npwp = digits(b.npwp);
    const err = checkCustomer(b);
    if (err) return res.status(400).json({ message: err });
    if (await one('SELECT id FROM users WHERE email=? AND id<>?', [b.email, u.id])) return res.status(409).json({ message: 'Email sudah dipakai.' });
    const changedIds = b.nib !== u.nib || b.npwp !== u.npwp;
    const dup = !changedIds || req.body.confirm_duplicate === true ? null : await duplicateOf(b, u.id);
    if (dup) return res.status(409).json(dup);
    await q('UPDATE users SET name=?, email=?, company_name=?, nib=?, npwp=?, phone=?, address=?, is_active=? WHERE id=?',
      [b.name, b.email, b.company_name, b.nib, b.npwp, b.phone || null, b.address || null, 'is_active' in req.body ? (req.body.is_active === false ? 0 : 1) : u.is_active, u.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const u = await one('SELECT * FROM users WHERE id=? AND role="user"', [req.params.id]);
    if (!u) return res.status(404).json({ message: 'Pelanggan tidak ditemukan.' });
    const pass = tempPassword();
    await q('UPDATE users SET password_hash=?, must_change_password=1, token_version=token_version+1 WHERE id=?', [await bcrypt.hash(pass, 10), u.id]);
    await sendLogin(u, pass, true);
    res.json({ temp_password: pass });
  } catch (e) { next(e); }
});

module.exports = router;
