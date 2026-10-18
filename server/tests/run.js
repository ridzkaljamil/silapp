/**
 * Pengujian otomatis SILAPP: `npm test` (folder server atau folder utama).
 *
 * Aman untuk data asli:
 *   - memakai database terpisah  <DB_NAME>_test  (dibuat otomatis; ganti dengan TEST_DB_NAME bila perlu)
 *   - file unggahan di folder sementara sistem, bukan server/uploads
 *   - Vercel Blob dan SMTP dimatikan (email hanya dicatat, tidak terkirim)
 * Database uji diisi ulang (seed) sebelum setiap file uji. Jalankan sebagian: `npm test -- sertifikat`.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const baseDb = process.env.DB_NAME || 'silapp';
Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_NAME: process.env.TEST_DB_NAME || `${baseDb}_test`,
  UPLOAD_DIR: path.join(os.tmpdir(), 'silapp-test-uploads'),
  BLOB_READ_WRITE_TOKEN: '',
  SMTP_HOST: '',
  JOBS_INTERVAL_MIN: '0',
  CRON_SECRET: 'rahasia-uji',
  CLIENT_URL: 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET || 'rahasia-jwt-uji',
  SUPERADMIN_EMAIL: '', SUPERADMIN_PASSWORD: '',
});
if (process.env.DB_NAME === baseDb && !process.env.TEST_DB_NAME) throw new Error('Database uji tidak boleh sama dengan database utama.');

const SERVER = path.join(__dirname, '..');
const seed = (mode) => {
  const r = spawnSync(process.execPath, ['database/seed.js', ...(mode === 'bersih' ? ['--bersih'] : [])], { cwd: SERVER, env: process.env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`Seed gagal:\n${r.stdout}\n${r.stderr}`);
};

async function createDb() {
  const mysql = require('mysql2/promise');
  const conn = await mysql.createConnection({ host: process.env.DB_HOST, port: +process.env.DB_PORT || 3306, user: process.env.DB_USER, password: process.env.DB_PASS });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } catch (e) {
    // user tanpa hak CREATE DATABASE tetap bisa memakai database uji yang sudah dibuat lewat phpMyAdmin
    if (await conn.query(`USE \`${process.env.DB_NAME}\``).then(() => true, () => false)) return;
    throw new Error(`Tidak bisa membuat database uji "${process.env.DB_NAME}" (${e.message}). Buat manual lewat phpMyAdmin atau pakai user MySQL yang boleh CREATE DATABASE.`);
  } finally { await conn.end(); }
}

/** Email simulasi yang dicetak mailer (SMTP mati) ditangkap agar bisa diperiksa, mis. tautan reset sandi. */
const mails = [];
const origLog = console.log;
console.log = (...a) => {
  const s = a.join(' ');
  if (s.startsWith('[email-simulasi]')) { mails.push(s); return; }
  if (process.env.TEST_VERBOSE) origLog(...a);
};
// kegagalan kirim email yang memang disengaja di pengujian tidak perlu memenuhi layar
const origErr = console.error;
console.error = (...a) => { if (process.env.TEST_VERBOSE || !String(a[0]).startsWith('[email]')) origErr(...a); };
console.warn = (...a) => { if (process.env.TEST_VERBOSE) origErr(...a); };

async function main() {
  const filter = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js') && (!filter.length || filter.some((x) => f.includes(x)))).sort();
  if (!files.length) { origLog('Tidak ada file uji yang cocok.'); return 1; }
  await createDb();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
  seed('demo');
  const app = require('../src/app');
  await app.migrate();
  const server = app.listen(0);
  await new Promise((r) => { server.once('listening', r); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const helpers = require('./helpers');
  let total = 0; let failed = 0;
  for (const file of files) {
    const suite = require(path.join(__dirname, file));
    seed(suite.seed || 'demo');
    mails.length = 0;
    const t = helpers.context(base, mails);
    const started = Date.now();
    try { await suite.run(t); } catch (e) { t.fail(`error: ${e.stack || e.message}`); }
    total += t.passed + t.failed.length; failed += t.failed.length;
    origLog(`${t.failed.length ? '✗' : '✓'} ${suite.name || file}  ${t.passed} lulus${t.failed.length ? `, ${t.failed.length} gagal` : ''}${t.skipped ? `, ${t.skipped} dilewati` : ''}  (${((Date.now() - started) / 1000).toFixed(1)} dtk)`);
    t.failed.forEach((m) => origLog(`    GAGAL: ${m}`));
  }
  origLog(`\n${total - failed}/${total} lulus${failed ? ` — ${failed} GAGAL` : ''}`);
  server.close();
  await require('../src/config/db').end();
  return failed ? 1 : 0;
}

main().then((code) => process.exit(code), (e) => { origLog(`\n✗ ${e.message}`); process.exit(1); });
