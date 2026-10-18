/** Master layanan & tahapan, kontak umum PSU, dan identitas invoice. */
const router = require('express').Router();
const { q } = require('../../config/db');
const { setSetting, getSettings, INVOICE_KEYS } = require('../../utils/settings');

/* ---------- master layanan ---------- */
router.get('/services', async (req, res, next) => {
  try {
    const services = await q('SELECT * FROM services ORDER BY sort_order');
    const steps = await q('SELECT * FROM service_steps ORDER BY service_id, flow, step_order');
    res.json(services.map((s) => ({ ...s, steps: steps.filter((x) => x.service_id === s.id) })));
  } catch (e) { next(e); }
});

router.put('/services/:id', async (req, res, next) => {
  try {
    const b = req.body;
    if (!String(b.name || '').trim()) return res.status(400).json({ message: 'Nama layanan wajib diisi.' });
    await q('UPDATE services SET name=?, description=?, cp_name=?, cp_phone=?, est_text=?, state=?, is_active=? WHERE id=?',
      [b.name, b.description, b.cp_name || null, b.cp_phone || null, b.est_text || null, ['ok', 'dev', 'prep'].includes(b.state) ? b.state : 'ok', b.is_active === false ? 0 : 1, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ---------- kontak umum PSU (tampil di halaman publik, halaman masuk, dan email) ---------- */
router.put('/contact', async (req, res, next) => {
  try {
    const phone = String(req.body.phone || '').trim();
    const email = String(req.body.email || '').trim();
    if (!/^[0-9+()\-\s]{6,30}$/.test(phone)) return res.status(400).json({ message: 'Nomor WhatsApp tidak valid.' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Email tidak valid.' });
    await setSetting('contact_phone', phone);
    await setSetting('contact_email', email);
    res.json({ phone, email });
  } catch (e) { next(e); }
});

/* ---------- identitas invoice (nama perusahaan, alamat, NPWP, rekening, penanda tangan) ---------- */
router.get('/invoice-settings', async (req, res, next) => {
  try { res.json(await getSettings(INVOICE_KEYS)); } catch (e) { next(e); }
});

router.put('/invoice-settings', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!String(b.company_name || '').trim()) return res.status(400).json({ message: 'Nama perusahaan wajib diisi.' });
    if (!/^[A-Za-z0-9]{2,10}$/.test(String(b.invoice_code || ''))) return res.status(400).json({ message: 'Kode invoice 2–10 huruf/angka, contoh: PSU.' });
    const days = Math.round(+b.invoice_due_days);
    if (!(days >= 0 && days <= 120)) return res.status(400).json({ message: 'Jatuh tempo default 0–120 hari.' });
    for (const k of INVOICE_KEYS) await setSetting(k, k === 'invoice_due_days' ? String(days) : String(b[k] ?? '').trim().slice(0, 300));
    res.json(await getSettings(INVOICE_KEYS));
  } catch (e) { next(e); }
});

router.put('/steps/:id', async (req, res, next) => {
  try {
    const b = req.body;
    if (!String(b.name || '').trim()) return res.status(400).json({ message: 'Nama tahap wajib diisi.' });
    if (b.sla_days !== '' && b.sla_days != null && !(Number.isInteger(+b.sla_days) && +b.sla_days >= 0 && +b.sla_days <= 365)) return res.status(400).json({ message: 'SLA 0–365 hari.' });
    await q('UPDATE service_steps SET name=?, sla_days=? WHERE id=?', [b.name, b.sla_days === '' || b.sla_days == null ? null : +b.sla_days, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
