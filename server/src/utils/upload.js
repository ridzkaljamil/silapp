const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = ['.pdf', '.doc', '.docx', '.zip', '.jpg', '.jpeg', '.png'];

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // maks. 10 MB per file
  fileFilter: (req, file, cb) => {
    const ok = ALLOWED.includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Format file harus PDF, Word, ZIP, JPG, atau PNG.'), ok);
  },
});

/**
 * File unggahan disimpan sebelum isi form divalidasi. Jika permintaan akhirnya gagal (status 4xx/5xx),
 * file yang terlanjur tersimpan dihapus agar folder uploads tidak berisi file yatim.
 */
function cleanupOnError(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode < 400) return;
    const files = [req.file, ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat())].filter(Boolean);
    for (const f of files) if (f.filename) fs.rm(path.join(UPLOAD_DIR, path.basename(f.filename)), { force: true }, () => {});
  });
  next();
}

module.exports = { upload, UPLOAD_DIR, cleanupOnError };
