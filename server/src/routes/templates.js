/**
 * Template dokumen yang diunduh pelanggan (mis. Surat Permohonan, Surat Kesediaan Surveillance).
 * Semua pengguna yang login dapat mengunduh. Super Admin dan Admin dapat menambah, mengganti, dan menghapus.
 * Template yang namanya sama dengan berkas di Form Pengajuan muncul sebagai tombol "Unduh Template" di form itu.
 */
const router = require('express').Router();
const { q, one } = require('../config/db');
const { requireAuth, allow } = require('../middleware/auth');
const { makeUpload } = require('../utils/upload');
const storage = require('../utils/storage');

const upload = makeUpload({ allowed: ['.doc', '.docx', '.pdf', '.xls', '.xlsx'], message: 'Template harus file Word, PDF, atau Excel.', prefix: 'template-' });
const staff = allow('admin', 'superadmin');
/** Nama & keterangan template. Mengembalikan [data, pesan error]. */
function fields(b) {
  const name = String(b.name ?? '').trim().replace(/\s+/g, ' ');
  const description = String(b.description ?? '').trim();
  if (name.length < 3 || name.length > 120) return [null, 'Nama template 3–120 karakter.'];
  if (description.length > 255) return [null, 'Keterangan maksimal 255 karakter.'];
  return [{ name, description: description || null }];
}
const dupName = (name, id = 0) => one('SELECT id FROM doc_templates WHERE name=? AND id<>?', [name, id]);

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

/** Tambah template. multipart: name, description; file */
router.post('/', staff, upload.single('file'), async (req, res, next) => {
  try {
    const [f, err] = fields(req.body);
    if (err) return res.status(400).json({ message: err });
    if (!req.file) return res.status(400).json({ message: 'Pilih file template.' });
    if (await dupName(f.name)) return res.status(409).json({ message: 'Nama template sudah dipakai.' });
    const { n } = await one('SELECT COALESCE(MAX(sort_order),0)+1 n FROM doc_templates');
    const r = await q('INSERT INTO doc_templates (name, description, file_path, original_name, sort_order) VALUES (?,?,?,?,?)',
      [f.name, f.description, req.file.filename, req.file.originalname, n]);
    res.status(201).json({ id: r.insertId });
  } catch (e) { next(e); }
});

/** Ubah nama/keterangan dan (opsional) ganti file. multipart: name, description; file */
router.put('/:id', staff, upload.single('file'), async (req, res, next) => {
  try {
    const t = await one('SELECT * FROM doc_templates WHERE id=?', [req.params.id]);
    if (!t) return res.status(404).json({ message: 'Template tidak ditemukan.' });
    // kompatibel dengan versi lama yang hanya mengirim file
    const [f, err] = fields({ name: req.body.name ?? t.name, description: req.body.description ?? t.description });
    if (err) return res.status(400).json({ message: err });
    if (!req.file && req.body.name === undefined) return res.status(400).json({ message: 'Pilih file pengganti.' });
    if (await dupName(f.name, t.id)) return res.status(409).json({ message: 'Nama template sudah dipakai.' });
    await q('UPDATE doc_templates SET name=?, description=?, file_path=?, original_name=?, updated_at=NOW() WHERE id=?',
      [f.name, f.description, req.file?.filename || t.file_path, req.file?.originalname || t.original_name, t.id]);
    if (req.file && t.file_path !== req.file.filename) await storage.remove(t.file_path);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', staff, async (req, res, next) => {
  try {
    const t = await one('SELECT * FROM doc_templates WHERE id=?', [req.params.id]);
    if (!t) return res.status(404).json({ message: 'Template tidak ditemukan.' });
    await q('DELETE FROM doc_templates WHERE id=?', [t.id]);
    await storage.remove(t.file_path);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
