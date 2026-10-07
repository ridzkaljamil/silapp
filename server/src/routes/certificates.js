/**
 * Data sertifikat Sertifikasi Produk untuk Directory publik:
 * sertifikat yang terbit lewat SILAPP + proyek sebelum SILAPP (diinput manual Admin).
 * Akses: Super Admin dan Admin bidang Sertifikasi Produk.
 */
const router = require('express').Router();
const { q, one } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth, (req, res, next) =>
  req.user.role === 'superadmin' || (req.user.role === 'admin' && req.user.bidang === 'SP') ? next() : res.status(403).json({ message: 'Khusus Admin Sertifikasi Produk.' }));

/** Daftar sertifikat SILAPP (SP) dalam format kolom Directory. */
const SILAPP_SQL = `SELECT c.id, 'silapp' source, c.certificate_no, c.issued_at, c.status, a.id application_id, a.application_no,
    COALESCE((SELECT field_value FROM application_details d WHERE d.application_id=a.id AND d.field_key='nama_pabrik' LIMIT 1), u.company_name) factory_name,
    COALESCE((SELECT field_value FROM application_details d WHERE d.application_id=a.id AND d.field_key='kota_provinsi' LIMIT 1), '-') factory_address,
    COALESCE(p.name, a.product_label) product, COALESCE(p.standard_no, '-') sni_no
  FROM certificates c JOIN applications a ON a.id=c.application_id JOIN services s ON s.id=a.service_id JOIN users u ON u.id=a.user_id
  LEFT JOIN products p ON p.id=a.product_id WHERE s.code='SP' AND a.status='selesai'`;

router.get('/', async (req, res, next) => {
  try {
    const silapp = await q(SILAPP_SQL);
    const legacy = await q(`SELECT id, 'lama' source, certificate_no, issued_at, status, factory_name, factory_address, product, sni_no FROM legacy_certificates`);
    res.json([...silapp, ...legacy].sort((a, b) => String(b.issued_at).localeCompare(String(a.issued_at))));
  } catch (e) { next(e); }
});

function body(b) {
  const keys = ['factory_name', 'factory_address', 'product', 'sni_no', 'certificate_no', 'issued_at'];
  for (const k of keys) if (!String(b[k] || '').trim()) return [null, 'Semua kolom wajib diisi.'];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.issued_at)) return [null, 'Format tanggal terbit tidak valid.'];
  return [[...keys.map((k) => String(b[k]).trim()), b.status === 'tidak_aktif' ? 'tidak_aktif' : 'aktif']];
}
const dupNo = async (no, id = 0) => (await one('SELECT id FROM legacy_certificates WHERE certificate_no=? AND id<>?', [no, id])) || (await one('SELECT id FROM certificates WHERE certificate_no=?', [no]));

router.post('/legacy', async (req, res, next) => {
  try {
    const [v, err] = body(req.body);
    if (err) return res.status(400).json({ message: err });
    if (await dupNo(v[4])) return res.status(409).json({ message: 'Nomor sertifikat sudah ada.' });
    await q('INSERT INTO legacy_certificates (factory_name, factory_address, product, sni_no, certificate_no, issued_at, status, created_by) VALUES (?,?,?,?,?,?,?,?)', [...v, req.user.id]);
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.put('/legacy/:id', async (req, res, next) => {
  try {
    const [v, err] = body(req.body);
    if (err) return res.status(400).json({ message: err });
    if (await dupNo(v[4], +req.params.id)) return res.status(409).json({ message: 'Nomor sertifikat sudah ada.' });
    await q('UPDATE legacy_certificates SET factory_name=?, factory_address=?, product=?, sni_no=?, certificate_no=?, issued_at=?, status=? WHERE id=?', [...v, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/legacy/:id', async (req, res, next) => {
  try { await q('DELETE FROM legacy_certificates WHERE id=?', [req.params.id]); res.json({ ok: true }); } catch (e) { next(e); }
});

/** Ubah status sertifikat SILAPP (Aktif / Tidak Aktif). */
router.patch('/silapp/:id', async (req, res, next) => {
  try {
    await q('UPDATE certificates SET status=? WHERE id=?', [req.body.status === 'tidak_aktif' ? 'tidak_aktif' : 'aktif', req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = { router, SILAPP_SQL };
