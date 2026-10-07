require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET belum diatur di file .env');
  process.exit(1);
}

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/certificates', require('./routes/certificates').router);
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Produksi: sajikan hasil build React dari client/dist (satu domain, satu proses)
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Penanganan error terpusat
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: `Ukuran file maksimal ${req.path.endsWith('/avatar') ? '2' : '10'} MB.` });
  const status = err.status || (err.message && err.message.startsWith('Format file') ? 400 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ message: status === 500 ? 'Terjadi kesalahan pada server.' : err.message });
});

const port = +process.env.PORT || 5000;
// Pastikan kolom baru ada (database lama tidak perlu di-reset), lalu jalankan server.
require('./config/migrate')()
  .catch((e) => console.warn('Migrasi otomatis dilewati:', e.message))
  .finally(() => app.listen(port, () => console.log(`SILAPP API berjalan di http://localhost:${port}`)));
