const router = require('express').Router();
const storage = require('../utils/storage');
const { SILAPP_SQL } = require('./certificates');
const { q, one } = require('../config/db');
const { loadApp } = require('../services/workflow');
const { detail } = require('../services/present');
const { getContact } = require('../utils/settings');
const { certState, todayJkt } = require('../utils/certificate');

/** Kontak umum PSU (WhatsApp & email) untuk halaman publik dan bantuan. */
router.get('/contact', async (req, res, next) => {
  try { res.json(await getContact()); } catch (e) { next(e); }
});

/** Daftar layanan bertingkat + status tracking + jumlah ruang lingkup. */
router.get('/services', async (req, res, next) => {
  try {
    const services = await q('SELECT id, parent_id, code, name, description, bidang, cp_name, cp_phone, est_text, state FROM services WHERE is_active=1 ORDER BY sort_order');
    const steps = await q('SELECT service_id, flow, step_order, status_code, name, progress_pct, is_optional, is_payment_step FROM service_steps ORDER BY service_id, step_order');
    const counts = await q(`SELECT p.service_id, COUNT(DISTINCT p.id) products, COUNT(pp.id) parameters
      FROM products p LEFT JOIN product_parameters pp ON pp.product_id=p.id GROUP BY p.service_id`);
    const out = services.map((s) => ({
      ...s,
      steps: steps.filter((x) => x.service_id === s.id && !x.flow),
      // alur khusus (SP: skema Tipe 1b)
      steps_1b: steps.filter((x) => x.service_id === s.id && x.flow === '1B'),
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
    const products = await q('SELECT id, category, sub_category, name, standard_no, scheme_reference, scheme_types, package_price, package_price_alt, alt_available, note, custom_name FROM products WHERE service_id=? ORDER BY id', [s.id]);
    const params = await q('SELECT pp.id, pp.product_id, pp.name, pp.method, pp.price, pp.price_alt FROM product_parameters pp JOIN products p ON p.id=pp.product_id WHERE p.service_id=? ORDER BY pp.id', [s.id]);
    // SP: produk yang juga ada di ruang lingkup lab PSU (SNI sama) bisa diambil sebagai Paket LSPro + Lab
    const labs = req.params.code === 'SP' ? await q(`SELECT p.standard_no, p.package_price, s.name service_name FROM products p JOIN services s ON s.id=p.service_id
      WHERE s.code IN ('KIM','FIS','MIK') AND p.standard_no IS NOT NULL ORDER BY p.package_price IS NULL, p.id`) : [];
    res.json(products.map((p) => {
      const lab = p.standard_no && labs.find((l) => l.standard_no === p.standard_no);
      return { ...p, alt_available: !!p.alt_available, custom_name: !!p.custom_name, parameters: params.filter((x) => x.product_id === p.id),
        ...(req.params.code === 'SP' ? { lab_test: lab ? { service: lab.service_name, price: lab.package_price == null ? null : +lab.package_price } : null } : {}) };
    }));
  } catch (e) { next(e); }
});

/** Lacak tanpa login: hanya progres. */
router.get('/track/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code).trim().toUpperCase();
    let row = await one('SELECT id FROM applications WHERE tracking_code=?', [code]);
    // kode format lama (SLP-XXXX-XXXX) dari email sebelum Oktober 2026 tetap bisa dipakai
    const old = !row && /^SLP-([A-Z0-9]{4})-([A-Z0-9]{4})$/.exec(code);
    if (old) row = await one('SELECT id FROM applications WHERE tracking_code LIKE ?', [`SLP__-${old[1]}${old[2]}`]);
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
      fields: await q('SELECT field_key `key`, label, type, options, required, show_when, multiple FROM service_fields WHERE service_id=? AND is_active=1 ORDER BY sort_order, id', [s.id]),
      documents: await q('SELECT id, name, required, admin_if_package, show_when, hide_schemes FROM service_documents WHERE service_id=? AND is_active=1 ORDER BY sort_order, id', [s.id]),
    });
  } catch (e) { next(e); }
});

/**
 * Directory publik: perusahaan bersertifikat Sertifikasi Produk
 * (terbit lewat SILAPP + proyek sebelum SILAPP) dengan statusnya: Aktif, Ditangguhkan, Dicabut, atau Berakhir (masa berlaku lewat).
 */
router.get('/directory', async (req, res, next) => {
  try {
    const silapp = await q(`${SILAPP_SQL} AND c.show_in_directory=1`);
    const legacy = await q('SELECT certificate_no, issued_at, expires_at, status, factory_name, factory_address, product, sni_no FROM legacy_certificates WHERE show_in_directory=1');
    const today = todayJkt();
    const pick = ({ certificate_no, issued_at, expires_at, status, factory_name, factory_address, product, sni_no }) => ({
      certificate_no, issued_at, expires_at, state: certState({ status, expires_at }, today), factory_name, factory_address, product, sni_no });
    res.json([...silapp, ...legacy].map(pick).sort((a, b) => String(b.issued_at).localeCompare(String(a.issued_at))));
  } catch (e) { next(e); }
});

/** Foto profil pengguna (berdasarkan id; file disimpan dengan nama acak). */
router.get('/avatar/:id', async (req, res, next) => {
  try {
    const u = await one('SELECT avatar FROM users WHERE id=?', [+req.params.id || 0]);
    if (!u?.avatar || !/\.(png|jpe?g)$/i.test(u.avatar) || req.query.v !== storage.version(u.avatar)) return res.status(404).end();
    await storage.send(res, u.avatar, null, { inline: true, cache: 'public, max-age=86400' });
  } catch (e) { next(e); }
});

module.exports = router;
