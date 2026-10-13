require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET belum diatur di file .env');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
// di belakang reverse proxy (cPanel/Nginx) isi TRUST_PROXY=1 agar IP asli pengunjung terbaca
if (process.env.TRUST_PROXY) app.set('trust proxy', +process.env.TRUST_PROXY || process.env.TRUST_PROXY);
app.use(compression());
// header keamanan dasar
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
  next();
});
app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json({ limit: '1mb' }));
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
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Produksi: sajikan hasil build React dari client/dist (satu domain, satu proses)
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  // file di /assets punya hash di namanya, jadi aman di-cache lama; index.html selalu diambil ulang
  app.use('/assets', express.static(path.join(dist, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get(/^\/(?!api).*/, (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(dist, 'index.html')));
}

// Penanganan error terpusat
const DB_DOWN = ['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ETIMEDOUT'];
app.use((err, req, res, next) => {
  if (DB_DOWN.includes(err.code)) {
    // MySQL mati / belum dinyalakan: cukup satu baris log, bukan stack trace panjang
    console.error(`[DB] ${err.code}: database tidak dapat dihubungi (${req.method} ${req.originalUrl})`);
    return res.status(503).json({ message: 'Database sedang tidak dapat dihubungi. Coba lagi beberapa saat.' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: `Ukuran file maksimal ${req.path.endsWith('/avatar') ? '2' : '10'} MB.` });
  const status = err.status || (err.message && err.message.startsWith('Format file') ? 400 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ message: status === 500 ? 'Terjadi kesalahan pada server.' : err.message });
});

const port = +process.env.PORT || 5000;
// Pastikan kolom baru ada (database lama tidak perlu di-reset), lalu jalankan server.
require('./config/migrate')()
  .catch((e) => console.warn('Migrasi otomatis dilewati:', e.message))
  .finally(() => {
    const server = app.listen(port, () => {
      console.log(`SILAPP API berjalan di http://localhost:${port}`);
      // pustaka Excel & PDF dimuat di awal agar ekspor/unduh pertama tidak lambat
      setTimeout(() => { require('exceljs'); require('pdfkit'); }, 500);
    });
    // Koneksi keep-alive dibiarkan lebih lama dari proxy/browser agar socket tidak ditutup saat sedang dipakai ulang.
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // Saat di-restart (node --watch, nodemon, PM2) atau Ctrl+C: berhenti menerima request baru,
    // selesaikan request yang sedang berjalan, lalu keluar. Tanpa ini request yang sedang diproses
    // terputus dan proxy Vite mencatat "read ECONNRESET".
    let closing = false;
    const shutdown = (signal) => {
      if (closing) return;
      closing = true;
      server.close(() => require('./config/db').end().finally(() => process.exit(0)));
      server.closeIdleConnections();
      setTimeout(() => process.exit(0), 5000).unref();
      if (signal === 'SIGINT') console.log('SILAPP API dihentikan.');
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  });
