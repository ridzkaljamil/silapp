/**
 * Penerima file unggahan untuk route Express. Pemakaiannya sama seperti multer:
 *   upload.single('proof'), upload.array('documents', 20), upload.fields([...])
 * dan hasilnya tetap di req.file / req.files dengan properti originalname, filename (= kunci file), size.
 *
 * Mode lokal  : file dikirim dalam form (multipart) dan disimpan multer ke server/uploads.
 * Mode Vercel : browser lebih dulu mengunggah file langsung ke Vercel Blob (lihat routes/uploads.js),
 *               lalu form hanya membawa penanda "blob:{...}" di nama field yang sama. Ini menghindari
 *               batas ukuran request fungsi Vercel (±4,5 MB).
 */
const multer = require('multer');
const path = require('path');
const storage = require('./storage');

const DOC_EXT = ['.pdf', '.doc', '.docx', '.zip', '.jpg', '.jpeg', '.png'];
const DOC_MSG = 'Format file harus PDF, Word, ZIP, JPG, atau PNG.';
const MARK = 'blob:';

const err400 = (message) => Object.assign(new Error(message), { status: 400 });

/** Ubah penanda blob di form menjadi objek file ala multer, lalu cek ekstensi & ukurannya. */
function fromMarkers(req, name, max, { allowed, maxBytes, message }) {
  const raw = [].concat(req.body?.[name] ?? []).filter((v) => typeof v === 'string' && v.startsWith(MARK));
  if (req.body) delete req.body[name];
  if (raw.length > max) throw err400(`Maksimal ${max} file.`);
  return raw.map((v) => {
    let m;
    try { m = JSON.parse(v.slice(MARK.length)); } catch { throw err400('Data file unggahan tidak valid. Coba unggah ulang.'); }
    if (!storage.validBlobKey(m.pathname)) throw err400('Data file unggahan tidak valid. Coba unggah ulang.');
    const originalname = String(m.name || path.basename(m.pathname)).slice(0, 200);
    if (!allowed.includes(path.extname(originalname).toLowerCase())) throw err400(message);
    if (+m.size > maxBytes) throw Object.assign(new Error('File terlalu besar.'), { code: 'LIMIT_FILE_SIZE' });
    return { fieldname: name, originalname, filename: m.pathname, size: +m.size || 0 };
  });
}

/**
 * Buat penerima unggahan. allowed: daftar ekstensi, maxMB: batas per file, prefix: awalan nama file lokal.
 */
function makeUpload({ allowed = DOC_EXT, maxMB = storage.MAX_MB, message = DOC_MSG, prefix = '' } = {}) {
  const maxBytes = maxMB * 1024 * 1024;
  const disk = multer({
    storage: multer.diskStorage({
      destination: storage.UPLOAD_DIR,
      filename: (req, file, cb) => { fixName(file); cb(null, storage.randomName(file.originalname, prefix)); },
    }),
    limits: { fileSize: maxBytes },
    fileFilter: (req, file, cb) => {
      const ok = allowed.includes(path.extname(file.originalname).toLowerCase());
      cb(ok ? null : err400(message), ok);
    },
  });
  // mode Vercel: form tanpa file (hanya teks), file sudah ada di Blob
  const textOnly = multer({ limits: { fieldSize: 2 * 1024 * 1024 } }).none();
  const viaBlob = (assign) => (req, res, next) => textOnly(req, res, (e) => {
    if (e) return next(e);
    try { assign(req); next(); } catch (x) { next(x); }
  });
  const opts = { allowed, maxBytes, message };
  if (!storage.IS_BLOB) return disk;
  return {
    single: (name) => viaBlob((req) => { req.file = fromMarkers(req, name, 1, opts)[0]; }),
    array: (name, max = 20) => viaBlob((req) => { req.files = fromMarkers(req, name, max, opts); }),
    fields: (list) => viaBlob((req) => { req.files = Object.fromEntries(list.map((f) => [f.name, fromMarkers(req, f.name, f.maxCount || 1, opts)])); }),
  };
}

/**
 * Multer membaca nama file sebagai latin1, sehingga huruf non-ASCII (mis. "–", "é") menjadi rusak saat diunduh lagi.
 * Ubah ke UTF-8 bila hasilnya valid. (Mode Vercel tidak perlu: nama file dikirim browser sebagai JSON UTF-8.)
 */
function fixName(file) {
  const utf = Buffer.from(file.originalname, 'latin1').toString('utf8');
  if (!utf.includes('�')) file.originalname = utf;
  file.originalname = file.originalname.slice(-200);
}

const upload = makeUpload();

/**
 * File unggahan disimpan sebelum isi form divalidasi. Jika permintaan akhirnya gagal (status 4xx/5xx),
 * file yang terlanjur tersimpan dihapus agar tidak ada file yatim.
 */
function cleanupOnError(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode < 400) return;
    const files = [req.file, ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat())].filter(Boolean);
    for (const f of files) if (f.filename) storage.remove(f.filename);
  });
  next();
}

module.exports = { upload, makeUpload, cleanupOnError, fixName, DOC_EXT, UPLOAD_DIR: storage.UPLOAD_DIR };
