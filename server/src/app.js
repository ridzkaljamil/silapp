/**
 * Aplikasi Express SILAPP (tanpa listen). Dipakai oleh:
 *   - src/index.js  : server biasa (XAMPP / VPS), menyajikan API + hasil build React
 *   - api/index.js  : fungsi serverless Vercel (file statis disajikan CDN Vercel)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
// tanggal di nomor pengajuan, invoice, dan tenggat memakai WIB walau server (mis. Vercel) memakai UTC
process.env.TZ = process.env.APP_TZ || 'Asia/Jakarta';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const compression = require('compression');
const storage = require('./utils/storage');

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET belum diatur (server/.env atau Environment Variables Vercel).');
// alamat aplikasi dipakai di tautan email: buang garis miring di akhir (https://domain/ -> https://domain)
if (process.env.CLIENT_URL) process.env.CLIENT_URL = process.env.CLIENT_URL.trim().replace(/\/+$/, '');

const ON_VERCEL = !!process.env.VERCEL;
const app = express();
app.disable('x-powered-by');
// di belakang reverse proxy (cPanel/Nginx/Vercel) isi TRUST_PROXY=1 agar IP asli pengunjung terbaca
if (process.env.TRUST_PROXY || ON_VERCEL) app.set('trust proxy', +process.env.TRUST_PROXY || 1);
if (!ON_VERCEL) app.use(compression()); // Vercel sudah mengompresi respons sendiri
// header keamanan dasar
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
  next();
});
app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json({ limit: '1mb' }));

// Pastikan kolom/tabel baru ada sebelum request pertama dilayani (sekali per proses / instance fungsi),
// lalu buat akun Super Admin pertama dari .env bila database masih baru.
let ready;
const migrate = () => (ready ||= require('./config/migrate')()
  .then(() => require('./config/superadmin')())
  .catch((e) => { ready = null; console.warn('Migrasi otomatis gagal:', e.message); }));
app.use('/api', (req, res, next) => (req.path === '/health' ? next() : migrate().then(() => next(), next)));

app.use('/api', require('./utils/upload').cleanupOnError);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/drafts', require('./routes/drafts'));
app.use('/api/certificates', require('./routes/certificates').router);
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/search', require('./routes/search'));
app.use('/api/uploads', require('./routes/uploads'));
app.get('/api/health', (req, res) => {
  // di Vercel file wajib di Blob; tanpa token unggahan tidak akan tersimpan
  const problem = ON_VERCEL && !storage.IS_BLOB ? 'BLOB_READ_WRITE_TOKEN belum diisi di Environment Variables Vercel.' : undefined;
  res.status(problem ? 500 : 200).json({ ok: !problem, storage: storage.IS_BLOB ? 'blob' : 'local', max_upload_mb: storage.MAX_MB, problem });
});
/**
 * Tugas terjadwal lewat HTTP (Vercel Cron, atau layanan cron eksternal). Wajib CRON_SECRET:
 * Vercel otomatis mengirim header "Authorization: Bearer <CRON_SECRET>".
 */
app.get('/api/cron', (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ message: 'Tidak diizinkan.' });
  require('./jobs').runJobs().then((out) => res.json(out), next);
});
app.use('/api', (req, res) => res.status(404).json({ message: 'Alamat API tidak ditemukan.' }));

// Server biasa: sajikan hasil build React dari client/dist (satu domain, satu proses). Di Vercel bagian ini dilewati.
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (!ON_VERCEL && fs.existsSync(dist)) {
  // file di /assets punya hash di namanya, jadi aman di-cache lama; index.html selalu diambil ulang
  app.use('/assets', express.static(path.join(dist, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get(/^\/(?!api).*/, (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(dist, 'index.html')));
}

// Penanganan error terpusat
const DB_DOWN = ['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH'];
app.use((err, req, res, next) => {
  if (DB_DOWN.includes(err.code)) {
    // MySQL mati / tidak terjangkau: cukup satu baris log, bukan stack trace panjang
    console.error(`[DB] ${err.code}: database tidak dapat dihubungi (${req.method} ${req.originalUrl})`);
    return res.status(503).json({ message: 'Database sedang tidak dapat dihubungi. Coba lagi beberapa saat.' });
  }
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Data yang dikirim terlalu besar.' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: `Ukuran file maksimal ${req.path.endsWith('/avatar') ? 2 : storage.MAX_MB} MB.` });
  const status = err.status || (err.message && err.message.startsWith('Format file') ? 400 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ message: status === 500 ? 'Terjadi kesalahan pada server.' : err.message });
});

module.exports = app;
module.exports.migrate = migrate;
