/**
 * Membuat paket siap upload ke cPanel: deploy/silapp-cpanel.zip
 *
 *   npm run pack:cpanel -- https://silapp.penilaistandaruji.com
 *   (alamat opsional, dipakai untuk gambar pratinjau saat tautan dibagikan)
 * Isi ZIP (folder induk "silapp"):
 *   silapp/server/       kode API, database/silapp-init.sql, template Word, env.example
 *   silapp/client/dist/  hasil build React (disajikan langsung oleh Express)
 *   silapp/DEPLOY-CPANEL.md
 * Tidak ikut: node_modules, file .env, isi folder uploads, kode sumber React.
 * Karena .env dan uploads tidak ikut, ZIP yang sama aman dipakai untuk memperbarui server yang sudah berjalan.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server');
const DIST = path.join(ROOT, 'client', 'dist');
const OUT_DIR = path.join(ROOT, 'deploy');
const OUT = path.join(OUT_DIR, 'silapp-cpanel.zip');

let archiver;
try {
  archiver = require(path.join(SERVER, 'node_modules', 'archiver'));
} catch {
  console.error('\n✗ Dependensi belum terpasang. Jalankan "npm install" dari folder utama project terlebih dahulu.\n');
  process.exit(1);
}

// alamat aplikasi (opsional) untuk pratinjau tautan: npm run pack:cpanel -- https://silapp.domain.com
const siteUrl = process.argv.slice(2).find((a) => /^https?:\/\//.test(a));
console.log('> build client (React) ...');
execSync('npm --prefix client run build', { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...(siteUrl && { SITE_URL: siteUrl }), BLOB_READ_WRITE_TOKEN: '' } });
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('\n✗ Build client gagal: client/dist/index.html tidak ditemukan.\n');
  process.exit(1);
}
if (!fs.existsSync(path.join(SERVER, 'database', 'silapp-init.sql'))) {
  console.warn('! server/database/silapp-init.sql belum ada. Jalankan "npm run db:sql" bila server baru perlu data awal.');
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const output = fs.createWriteStream(OUT);
const zip = archiver('zip', { zlib: { level: 9 } });
zip.on('warning', (e) => console.warn('!', e.message));
zip.on('error', (e) => { throw e; });
output.on('close', () => {
  console.log(`✓ ${path.relative(ROOT, OUT)} dibuat (${(zip.pointer() / 1024 / 1024).toFixed(2)} MB).`);
  console.log('  Upload ke cPanel lalu ikuti langkah di DEPLOY-CPANEL.md.');
});
zip.pipe(output);

zip.directory(path.join(SERVER, 'src'), 'silapp/server/src');
zip.glob('**/*', { cwd: path.join(SERVER, 'database'), ignore: ['build-init-sql.js'] }, { prefix: 'silapp/server/database' });
for (const f of ['package.json', 'package-lock.json', 'env.example']) zip.file(path.join(SERVER, f), { name: `silapp/server/${f}` });
zip.append('', { name: 'silapp/server/uploads/.gitkeep' });
zip.directory(DIST, 'silapp/client/dist');
zip.file(path.join(ROOT, 'DEPLOY-CPANEL.md'), { name: 'silapp/DEPLOY-CPANEL.md' });
zip.finalize();
