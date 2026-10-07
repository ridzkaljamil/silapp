const router = require('express').Router();
const { q, one } = require('../config/db');
const { loadApp } = require('../services/workflow');
const { detail } = require('../services/present');

/** Daftar layanan bertingkat + status tracking + jumlah ruang lingkup. */
router.get('/services', async (req, res, next) => {
  try {
    const services = await q('SELECT id, parent_id, code, name, description, bidang, cp_name, cp_phone, est_text, state FROM services WHERE is_active=1 ORDER BY sort_order');
    const steps = await q('SELECT service_id, step_order, status_code, name, progress_pct, is_optional, is_payment_step FROM service_steps ORDER BY service_id, step_order');
    const counts = await q(`SELECT p.service_id, COUNT(DISTINCT p.id) products, COUNT(pp.id) parameters
      FROM products p LEFT JOIN product_parameters pp ON pp.product_id=p.id GROUP BY p.service_id`);
    const out = services.map((s) => ({
      ...s,
      steps: steps.filter((x) => x.service_id === s.id),
      scope: counts.find((c) => c.service_id === s.id) || { products: 0, parameters: 0 },
    }));
    res.json(out);
  } catch (e) { next(e); }
});

/** Ruang lingkup satu layanan: produk + parameter. */
router.get('/services/:code/scope', async (req, res, next) => {
  try {
    const s = await one('SELECT id FROM services WHERE code=?', [req.params.code]);
    if (!s) return res.status(404).json({ message: 'Layanan tidak ditemukan.' });
    const products = await q('SELECT id, category, sub_category, name, standard_no, scheme_reference, scheme_types, package_price FROM products WHERE service_id=? ORDER BY id', [s.id]);
    const params = await q('SELECT pp.id, pp.product_id, pp.name, pp.method, pp.price FROM product_parameters pp JOIN products p ON p.id=pp.product_id WHERE p.service_id=? ORDER BY pp.id', [s.id]);
    res.json(products.map((p) => ({ ...p, parameters: params.filter((x) => x.product_id === p.id) })));
  } catch (e) { next(e); }
});

/** Lacak tanpa login: hanya progres. */
router.get('/track/:code', async (req, res, next) => {
  try {
    const row = await one('SELECT id FROM applications WHERE tracking_code=?', [String(req.params.code).toUpperCase()]);
    if (!row) return res.status(404).json({ message: 'Kode lacak tidak ditemukan.' });
    res.json(await detail(await loadApp(row.id), 'public'));
  } catch (e) { next(e); }
});

/** Form pengajuan per layanan (form builder): isian tambahan + daftar berkas. */
router.get('/services/:code/form', async (req, res, next) => {
  try {
    const s = await one('SELECT id FROM services WHERE code=?', [req.params.code]);
    if (!s) return res.status(404).json({ message: 'Layanan tidak ditemukan.' });
    res.json({
      fields: await q('SELECT field_key `key`, label, type, options, required, show_when FROM service_fields WHERE service_id=? AND is_active=1 ORDER BY sort_order, id', [s.id]),
      documents: await q('SELECT id, name, required, admin_if_package FROM service_documents WHERE service_id=? AND is_active=1 ORDER BY sort_order, id', [s.id]),
    });
  } catch (e) { next(e); }
});

/**
 * Directory publik: perusahaan bersertifikat Sertifikasi Produk
 * (terbit lewat SILAPP + proyek sebelum SILAPP). Status Aktif & Tidak Aktif ditampilkan.
 */
router.get('/directory', async (req, res, next) => {
  try {
    const { SILAPP_SQL } = require('./certificates');
    const silapp = await q(`${SILAPP_SQL} AND c.show_in_directory=1`);
    const legacy = await q('SELECT certificate_no, issued_at, status, factory_name, factory_address, product, sni_no FROM legacy_certificates');
    const pick = ({ certificate_no, issued_at, status, factory_name, factory_address, product, sni_no }) => ({ certificate_no, issued_at, status, factory_name, factory_address, product, sni_no });
    res.json([...silapp, ...legacy].map(pick).sort((a, b) => String(b.issued_at).localeCompare(String(a.issued_at))));
  } catch (e) { next(e); }
});

/** Foto profil pengguna (nama file acak, hanya pola avatar-*). */
router.get('/avatar/:file', (req, res) => {
  const f = req.params.file;
  if (!/^avatar-\d+-[a-f0-9]+\.(png|jpe?g)$/.test(f)) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=86400');
  res.sendFile(require('path').join(require('../utils/upload').UPLOAD_DIR, f), (err) => err && !res.headersSent && res.status(404).end());
});

module.exports = router;
