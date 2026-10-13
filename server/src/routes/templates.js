/**
 * Template dokumen (Surat Permohonan, Surat Kesediaan Surveillance, Surat Pernyataan Keaslian Dokumen).
 * Semua pengguna yang login dapat mengunduh; hanya Super Admin yang dapat mengganti file.
 */
const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { q, one } = require('../config/db');
const { requireAuth, allow } = require('../middleware/auth');
const { UPLOAD_DIR } = require('../utils/upload');

const WORD = ['.doc', '.docx'];
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `template-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = WORD.includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : Object.assign(new Error('Template harus file Word (.doc atau .docx).'), { status: 400 }), ok);
  },
});

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try { res.json(await q('SELECT id, name, description, original_name, updated_at FROM doc_templates ORDER BY sort_order, id')); } catch (e) { next(e); }
});

router.get('/:id/download', async (req, res, next) => {
  try {
    const t = await one('SELECT * FROM doc_templates WHERE id=?', [req.params.id]);
    if (!t) return res.status(404).json({ message: 'Template tidak ditemukan.' });
    res.download(path.join(UPLOAD_DIR, t.file_path), t.original_name, (err) => err && !res.headersSent && res.status(404).json({ message: 'File template tidak ditemukan.' }));
  } catch (e) { next(e); }
});

router.put('/:id', allow('superadmin'), upload.single('file'), async (req, res, next) => {
  try {
    const t = await one('SELECT * FROM doc_templates WHERE id=?', [req.params.id]);
    if (!t) return res.status(404).json({ message: 'Template tidak ditemukan.' });
    if (!req.file) return res.status(400).json({ message: 'Pilih file Word pengganti.' });
    await q('UPDATE doc_templates SET file_path=?, original_name=?, updated_at=NOW() WHERE id=?', [req.file.filename, req.file.originalname, t.id]);
    if (t.file_path !== req.file.filename) fs.rm(path.join(UPLOAD_DIR, t.file_path), { force: true }, () => {});
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
