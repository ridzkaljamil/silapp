/**
 * Jalankan tugas terjadwal sekali lalu keluar: `npm run jobs` (folder server).
 * Untuk cPanel > Cron Jobs (contoh perintah ada di DEPLOY-CPANEL.md). Tambahkan `-- --paksa` untuk mengulang
 * bagian harian walau hari ini sudah dijalankan.
 */
const app = require('../app'); // memuat .env dan zona waktu WIB
const { runJobs } = require('.');
const db = require('../config/db');

app.migrate()
  .then(() => runJobs({ force: process.argv.includes('--paksa') }))
  .then((out) => { console.log(`[tugas] ${new Date().toISOString()}`, JSON.stringify(out)); })
  .catch((e) => { console.error('[tugas] gagal:', e.message); process.exitCode = 1; })
  .finally(() => db.end());
