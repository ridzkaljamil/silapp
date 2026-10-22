/**
 * Penyimpanan file unggahan (dokumen, bukti bayar, sertifikat, template, foto profil).
 *
 * Dua mode, dipilih otomatis:
 *   - local : folder server/uploads (XAMPP / VPS). Kunci file = nama file di folder itu.
 *   - blob  : Vercel Blob privat (hosting Vercel), aktif jika BLOB_READ_WRITE_TOKEN diisi.
 *             Kunci file = pathname blob, mis. "silapp/1791...-ab12.pdf". File tidak bisa dibuka
 *             lewat URL langsung; selalu diunduh lewat API setelah pengecekan hak akses.
 * Kode lain cukup memakai fungsi di sini dan tidak perlu tahu mode yang sedang dipakai.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');

const IS_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
// UPLOAD_DIR bisa diganti lewat env (dipakai pengujian otomatis agar tidak menyentuh file asli)
const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(__dirname, '..', '..', 'uploads');
const PREFIX = 'silapp/';
/** Batas per file. Di Vercel 4 MB karena unduhan lewat fungsi Vercel dibatasi 4,5 MB per respons. */
const MAX_MB = IS_BLOB ? 4 : 10;
if (!IS_BLOB) {
  try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {
    console.error('Folder uploads tidak bisa dibuat. Di Vercel, hubungkan Blob store agar BLOB_READ_WRITE_TOKEN terisi.');
  }
}

// SDK Vercel Blob hanya dimuat saat dipakai, jadi mode lokal tidak bergantung padanya
let sdk;
const blob = () => (sdk ||= require('@vercel/blob'));

/** Nama file acak dengan ekstensi asli, mis. 1791...-ab12cd34ef56.pdf */
const randomName = (original, prefix = '') => `${prefix}${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(original || '').toLowerCase()}`;
const localPath = (key) => path.join(UPLOAD_DIR, path.basename(String(key)));
/** Kunci blob yang sah: berada di folder aplikasi dan tanpa "..". */
const validBlobKey = (key) => typeof key === 'string' && key.startsWith(PREFIX) && !key.includes('..') && key.length <= 255;

/** Simpan isi file (Buffer) dan kembalikan kuncinya. Dipakai seed, migrasi, dan PDF contoh. */
async function save(buffer, originalName, prefix = '') {
  if (!IS_BLOB) {
    const name = randomName(originalName, prefix);
    fs.writeFileSync(localPath(name), buffer);
    return name;
  }
  const r = await blob().put(`${PREFIX}${prefix}${path.basename(originalName)}`, buffer, { access: 'private', addRandomSuffix: true });
  return r.pathname;
}

/** Stream isi file, atau null jika tidak ada. */
async function stream(key) {
  if (!key) return null;
  if (!IS_BLOB) return fs.existsSync(localPath(key)) ? fs.createReadStream(localPath(key)) : null;
  if (!validBlobKey(key)) return null;
  const r = await blob().get(key, { access: 'private' }).catch(() => null);
  return r?.statusCode === 200 ? Readable.fromWeb(r.stream) : null;
}

/** Isi file sebagai Buffer (mis. gambar tanda tangan untuk PDF), atau null jika tidak ada. */
async function buffer(key) {
  const s = await stream(key);
  if (!s) return null;
  const chunks = [];
  for await (const c of s) chunks.push(c);
  return Buffer.concat(chunks);
}

/**
 * Kirim file ke browser. inline=true untuk gambar (foto profil), selain itu sebagai unduhan dengan nama asli.
 * Jika file hilang, balas 404 berbahasa Indonesia.
 */
async function send(res, key, downloadName, { inline = false, cache } = {}) {
  const s = await stream(key);
  if (!s) return res.status(404).json({ message: 'File tidak ditemukan.' });
  const name = downloadName || path.basename(String(key));
  res.type(path.extname(name) || 'application/octet-stream');
  if (!inline) res.attachment(name);
  res.set('Cache-Control', cache || 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  s.on('error', () => { if (!res.headersSent) res.status(404).end(); else res.destroy(); });
  s.pipe(res);
  return undefined;
}

/**
 * Kirim file hasil buatan server yang bisa besar (ZIP semua berkas).
 * Lokal: langsung di-stream. Vercel: disimpan sementara di Blob lalu dibalas tautan unduh 10 menit
 * ({ download_url }), karena respons fungsi Vercel maksimal 4,5 MB.
 */
async function sendLarge(res, readable, name, contentType) {
  if (!IS_BLOB) {
    res.attachment(name);
    readable.pipe(res);
    return;
  }
  const { put, issueSignedToken, presignUrl } = blob();
  const pathname = `${PREFIX}tmp/${crypto.randomBytes(12).toString('hex')}/${name.replace(/[^\w.-]+/g, '-')}`;
  await put(pathname, readable, { access: 'private', contentType, addRandomSuffix: false });
  const validUntil = Date.now() + 10 * 60 * 1000;
  const token = await issueSignedToken({ pathname, operations: ['get'], validUntil });
  const { presignedUrl } = await presignUrl(token, { operation: 'get', pathname, validUntil, access: 'private' });
  res.json({ download_url: presignedUrl });
  // bersihkan file sementara yang lebih dari 1 hari (tanpa ditunggu)
  blob().list({ prefix: `${PREFIX}tmp/`, limit: 100 }).then((r) => {
    const old = r.blobs.filter((b) => Date.now() - new Date(b.uploadedAt).getTime() > 86400000).map((b) => b.url);
    return old.length ? blob().del(old) : null;
  }).catch(() => {});
}

/** Hapus file (diam saja jika sudah tidak ada). */
async function remove(key) {
  if (!key) return;
  if (!IS_BLOB) { fs.rm(localPath(key), { force: true }, () => {}); return; }
  if (validBlobKey(key)) await blob().del(key).catch(() => {});
}

/** Hapus semua file aplikasi (dipakai saat reset data demo). */
async function clearAll() {
  if (!IS_BLOB) {
    for (const f of fs.readdirSync(UPLOAD_DIR)) if (f !== '.gitkeep') fs.rmSync(path.join(UPLOAD_DIR, f), { force: true });
    return;
  }
  let cursor;
  do {
    const r = await blob().list({ prefix: PREFIX, cursor, limit: 1000 });
    if (r.blobs.length) await blob().del(r.blobs.map((b) => b.url));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
}

/** Sidik pendek kunci file (untuk ?v= di URL foto profil: penanda cache sekaligus mencegah tebak-tebakan id). */
const version = (key) => crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 12);

module.exports = { version, buffer, sendLarge, MAX_MB, IS_BLOB, UPLOAD_DIR, PREFIX, randomName, validBlobKey, save, stream, send, remove, clearAll };
