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
    const products = await q('SELECT id, category, sub_category, name, standard_no, scheme_reference, scheme_types FROM products WHERE service_id=? ORDER BY id', [s.id]);
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

/** Directory publik: sertifikat/LHU yang terbit, data terbatas. */
router.get('/directory', async (req, res, next) => {
  try {
    res.json(await q(`SELECT c.certificate_no, c.issued_at, c.status, u.company_name, s.name service_name, a.product_label
      FROM certificates c JOIN applications a ON a.id=c.application_id JOIN users u ON u.id=a.user_id JOIN services s ON s.id=a.service_id
      WHERE c.show_in_directory=1 AND a.status='selesai' ORDER BY c.issued_at DESC`));
  } catch (e) { next(e); }
});

module.exports = router;
