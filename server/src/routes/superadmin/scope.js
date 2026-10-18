/** Ruang lingkup layanan tanpa harga per parameter (Sertifikasi Produk, Kalibrasi, Sistem Manajemen). */
const router = require('express').Router();
const { q, one } = require('../../config/db');
const { text, inUse } = require('./helpers');

/* ---------- ruang lingkup layanan (tampil di halaman Layanan publik & form Ajukan) ---------- */
// Lab Kimia & Fisika dikelola lewat Daftar Harga Lab karena punya parameter dan harga.
const SCOPE_SVC = ['SP', 'KAL', 'LSM'];
const scopeSvc = (code) => one('SELECT id, code, name FROM services WHERE code=? AND code IN (?)', [code, SCOPE_SVC]);
const scopeBody = (b) => [text(b.category, 120) || null, text(b.sub_category, 120) || null, text(b.name, 160), text(b.standard_no, 80) || null,
  text(b.scheme_reference, 160) || null, text(b.scheme_types, 40) || null];

router.get('/scope/:code', async (req, res, next) => {
  try {
    const svc = await scopeSvc(req.params.code);
    if (!svc) return res.status(404).json({ message: 'Layanan tidak ditemukan.' });
    const rows = await q(`SELECT p.id, p.category, p.sub_category, p.name, p.standard_no, p.scheme_reference, p.scheme_types,
      (SELECT COUNT(*) FROM applications a WHERE a.product_id=p.id) used FROM products p WHERE p.service_id=? ORDER BY p.category, p.id`, [svc.id]);
    res.json({ service: svc, rows });
  } catch (e) { next(e); }
});

router.post('/scope/:code', async (req, res, next) => {
  try {
    const svc = await scopeSvc(req.params.code);
    if (!svc) return res.status(404).json({ message: 'Layanan tidak ditemukan.' });
    const v = scopeBody(req.body);
    if (!v[2]) return res.status(400).json({ message: 'Nama produk / ruang lingkup wajib diisi.' });
    const r = await q('INSERT INTO products (service_id, category, sub_category, name, standard_no, scheme_reference, scheme_types) VALUES (?,?,?,?,?,?,?)', [svc.id, ...v]);
    res.status(201).json({ id: r.insertId });
  } catch (e) { next(e); }
});

router.put('/scope/item/:id', async (req, res, next) => {
  try {
    const prod = await one('SELECT p.id FROM products p JOIN services s ON s.id=p.service_id WHERE p.id=? AND s.code IN (?)', [req.params.id, SCOPE_SVC]);
    if (!prod) return res.status(404).json({ message: 'Data ruang lingkup tidak ditemukan.' });
    const v = scopeBody(req.body);
    if (!v[2]) return res.status(400).json({ message: 'Nama produk / ruang lingkup wajib diisi.' });
    await q('UPDATE products SET category=?, sub_category=?, name=?, standard_no=?, scheme_reference=?, scheme_types=? WHERE id=?', [...v, prod.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/scope/item/:id', async (req, res, next) => {
  try {
    const prod = await one('SELECT p.id FROM products p JOIN services s ON s.id=p.service_id WHERE p.id=? AND s.code IN (?)', [req.params.id, SCOPE_SVC]);
    if (!prod) return res.status(404).json({ message: 'Data ruang lingkup tidak ditemukan.' });
    try { await q('DELETE FROM products WHERE id=?', [prod.id]); } catch (e) {
      if (inUse(e)) return res.status(400).json({ message: 'Produk ini sudah dipakai di pengajuan, jadi tidak bisa dihapus.' });
      throw e;
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
