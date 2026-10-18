/**
 * Template dokumen (Surat Permohonan, Surat Kesediaan Surveillance, Surat Pernyataan Keaslian Dokumen).
 * Semua pengguna yang login dapat mengunduh; hanya Super Admin yang dapat mengganti file.
 */
const router = require('express').Router();
const { q, one } = require('../config/db');
const { requireAuth, allow } = require('../middleware/auth');
const { makeUpload } = require('../utils/upload');
const storage = require('../utils/storage');

const upload = makeUpload({ allowed: ['.doc', '.docx'], message: 'Template harus file Word (.doc atau .docx).', prefix: 'template-' });

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try { res.json(await q('SELECT id, name, description, original_name, updated_at FROM doc_templates ORDER BY sort_order, id')); } catch (e) { next(e); }
});

router.get('/:id/download', async (req, res, next) => {
  try {
    const t = await one('SELECT * FROM doc_templates WHERE id=?', [req.params.id]);
    if (!t) return res.status(404).json({ message: 'Template tidak ditemukan.' });
    await storage.send(res, t.file_path, t.original_name);
  } catch (e) { next(e); }
});

router.put('/:id', allow('superadmin'), upload.single('file'), async (req, res, next) => {
  try {
    const t = await one('SELECT * FROM doc_templates WHERE id=?', [req.params.id]);
    if (!t) return res.status(404).json({ message: 'Template tidak ditemukan.' });
    if (!req.file) return res.status(400).json({ message: 'Pilih file Word pengganti.' });
    await q('UPDATE doc_templates SET file_path=?, original_name=?, updated_at=NOW() WHERE id=?', [req.file.filename, req.file.originalname, t.id]);
    if (t.file_path !== req.file.filename) await storage.remove(t.file_path);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
