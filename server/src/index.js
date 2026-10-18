/** Server biasa (XAMPP / VPS): `npm start` atau `npm run dev`. Untuk Vercel lihat api/index.js di folder utama. */
let app;
try { app = require('./app'); } catch (e) { console.error(e.message); process.exit(1); }

if (process.env.NODE_ENV === 'production') {
  if (!process.env.SMTP_HOST) console.warn('! SMTP_HOST kosong: email tidak dikirim, isinya hanya dicatat di log.');
  if (!/^https:\/\//.test(process.env.CLIENT_URL || '')) console.warn('! CLIENT_URL sebaiknya diisi alamat https aplikasi, mis. https://silapp.domain.com');
}

const port = +process.env.PORT || 5000;
// Pastikan kolom baru ada (database lama tidak perlu di-reset), lalu jalankan server.
app.migrate().finally(() => {
  const server = app.listen(port, () => {
    console.log(`SILAPP API berjalan di http://localhost:${port}`);
    // pustaka Excel & PDF dimuat di awal agar ekspor/unduh pertama tidak lambat
    setTimeout(() => { require('exceljs'); require('pdfkit'); }, 500);
  });
  // tugas terjadwal (pengingat & kirim ulang email): 1 menit setelah mulai, lalu setiap 30 menit.
  // JOBS_INTERVAL_MIN=0 mematikannya (mis. bila sudah memakai Cron Jobs cPanel saja).
  const every = process.env.JOBS_INTERVAL_MIN === undefined ? 30 : +process.env.JOBS_INTERVAL_MIN;
  if (every > 0) {
    const tick = () => require('./jobs').runJobs().catch((e) => console.error('[tugas]', e.message));
    setTimeout(tick, 60000).unref();
    setInterval(tick, every * 60000).unref();
  }
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
