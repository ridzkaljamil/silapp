/** Khusus Super Admin: pengguna, master layanan, daftar harga lab, form pengajuan, survei. */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { q, one } = require('../config/db');
const { requireAuth, allow } = require('../middleware/auth');

router.use(requireAuth, allow('superadmin'));

const JABATAN = {
  SP: ['Admin Sertifikasi', 'Manager Sertifikasi', 'Auditor', 'PPC', 'Reviewer', 'Decision Maker'],
  LAB: ['Admin Lab', 'Admin Penerimaan', 'Koordinator Lab', 'Petugas Preparasi', 'Analis', 'Reviewer/Verifikator', 'Penandatangan berwenang'],
  KAL: ['Admin Kalibrasi', 'Koordinator', 'Personel Kalibrasi', 'Reviewer/Verifikator', 'Penandatangan berwenang'],
};
router.get('/jabatan', (req, res) => res.json(JABATAN));

/* ---------- pengguna ---------- */
router.get('/users', async (req, res, next) => {
  try {
    res.json(await q('SELECT id, role, name, email, jabatan, bidang, company_name, phone, is_active, created_at FROM users ORDER BY FIELD(role,"superadmin","admin","user"), name'));
  } catch (e) { next(e); }
});

function validUser(b) {
  if (!['superadmin', 'admin', 'user'].includes(b.role)) return 'Role tidak valid.';
  if (!b.name || !b.email) return 'Nama dan email wajib diisi.';
  if (b.role === 'admin' && (!JABATAN[b.bidang] || !JABATAN[b.bidang].includes(b.jabatan))) return 'Admin wajib memiliki bidang dan jabatan yang sesuai.';
  return null;
}

router.post('/users', async (req, res, next) => {
  try {
    const b = req.body;
    const err = validUser(b) || (!b.password || b.password.length < 8 ? 'Kata sandi awal minimal 8 karakter.' : null);
    if (err) return res.status(400).json({ message: err });
    if (await one('SELECT id FROM users WHERE email=?', [b.email])) return res.status(409).json({ message: 'Email sudah dipakai.' });
    const r = await q('INSERT INTO users (role, name, email, password_hash, jabatan, bidang, company_name, phone) VALUES (?,?,?,?,?,?,?,?)',
      [b.role, b.name, b.email, await bcrypt.hash(b.password, 10), b.role === 'admin' ? b.jabatan : null, b.role === 'admin' ? b.bidang : null,
        b.company_name || (b.role === 'user' ? null : 'PT Penilai Standar Uji'), b.phone || null]);
    res.status(201).json({ id: r.insertId });
  } catch (e) { next(e); }
});

router.put('/users/:id', async (req, res, next) => {
  try {
    const b = req.body;
    const err = validUser(b);
    if (err) return res.status(400).json({ message: err });
    if (await one('SELECT id FROM users WHERE email=? AND id<>?', [b.email, req.params.id])) return res.status(409).json({ message: 'Email sudah dipakai.' });
    await q('UPDATE users SET role=?, name=?, email=?, jabatan=?, bidang=?, company_name=?, phone=?, is_active=? WHERE id=?',
      [b.role, b.name, b.email, b.role === 'admin' ? b.jabatan : null, b.role === 'admin' ? b.bidang : null, b.company_name || null, b.phone || null, b.is_active === false ? 0 : 1, req.params.id]);
    if (b.password) {
      if (b.password.length < 8) return res.status(400).json({ message: 'Kata sandi minimal 8 karakter.' });
      await q('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(b.password, 10), req.params.id]);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    if (+req.params.id === req.user.id) return res.status(400).json({ message: 'Tidak bisa menghapus akun sendiri.' });
    const used = await one('SELECT (SELECT COUNT(*) FROM applications WHERE user_id=?) + (SELECT COUNT(*) FROM status_logs WHERE pic_user_id=?) n', [req.params.id, req.params.id]);
    if (used.n > 0) {
      // jejak audit tidak boleh hilang: nonaktifkan saja
      await q('UPDATE users SET is_active=0 WHERE id=?', [req.params.id]);
      return res.json({ ok: true, deactivated: true, message: 'Akun memiliki riwayat, jadi dinonaktifkan (tidak dihapus) agar audit trail tetap utuh.' });
    }
    await q('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ---------- master layanan ---------- */
router.get('/services', async (req, res, next) => {
  try {
    const services = await q('SELECT * FROM services ORDER BY sort_order');
    const steps = await q('SELECT * FROM service_steps ORDER BY service_id, step_order');
    res.json(services.map((s) => ({ ...s, steps: steps.filter((x) => x.service_id === s.id) })));
  } catch (e) { next(e); }
});

router.put('/services/:id', async (req, res, next) => {
  try {
    const b = req.body;
    await q('UPDATE services SET name=?, description=?, cp_name=?, cp_phone=?, est_text=?, state=?, is_active=? WHERE id=?',
      [b.name, b.description, b.cp_name || null, b.cp_phone || null, b.est_text || null, ['ok', 'dev', 'prep'].includes(b.state) ? b.state : 'ok', b.is_active === false ? 0 : 1, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.put('/steps/:id', async (req, res, next) => {
  try {
    const b = req.body;
    await q('UPDATE service_steps SET name=?, sla_days=? WHERE id=?', [b.name, b.sla_days === '' || b.sla_days == null ? null : +b.sla_days, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ---------- daftar harga lab (sudah termasuk PPN 11%) ---------- */
router.get('/prices', async (req, res, next) => {
  try {
    const products = await q(`SELECT p.id, p.name, p.category, p.package_price, s.code service_code, s.name service_name
      FROM products p JOIN services s ON s.id=p.service_id WHERE s.code IN ('KIM','FIS','MIK') ORDER BY s.sort_order, p.id`);
    const params = await q(`SELECT pp.id, pp.product_id, pp.name, pp.method, pp.price FROM product_parameters pp
      JOIN products p ON p.id=pp.product_id JOIN services s ON s.id=p.service_id WHERE s.code IN ('KIM','FIS','MIK') ORDER BY pp.id`);
    res.json(products.map((p) => ({ ...p, parameters: params.filter((x) => x.product_id === p.id) })));
  } catch (e) { next(e); }
});

const money = (v) => (v === '' || v === null || v === undefined ? null : Math.max(0, Math.round(+v)) || 0);
router.put('/prices/products/:id', async (req, res, next) => {
  try {
    const prod = await one(`SELECT p.id FROM products p JOIN services s ON s.id=p.service_id WHERE p.id=? AND s.code IN ('KIM','FIS','MIK')`, [req.params.id]);
    if (!prod) return res.status(404).json({ message: 'Produk lab tidak ditemukan.' });
    await q('UPDATE products SET package_price=? WHERE id=?', [money(req.body.package_price), prod.id]);
    for (const p of req.body.parameters || []) {
      await q('UPDATE product_parameters SET price=? WHERE id=? AND product_id=?', [money(p.price), p.id, prod.id]);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ---------- form builder: isian & berkas per layanan ---------- */
const TYPES = ['text', 'number', 'textarea', 'select', 'date'];
const svcByCode = (code) => one('SELECT id, code, name FROM services WHERE code=? AND bidang IS NOT NULL', [code]);

router.get('/forms/:code', async (req, res, next) => {
  try {
    const svc = await svcByCode(req.params.code);
    if (!svc) return res.status(404).json({ message: 'Layanan tidak ditemukan.' });
    res.json({
      service: svc,
      fields: await q('SELECT * FROM service_fields WHERE service_id=? ORDER BY sort_order, id', [svc.id]),
      documents: await q('SELECT * FROM service_documents WHERE service_id=? ORDER BY sort_order, id', [svc.id]),
    });
  } catch (e) { next(e); }
});

function fieldBody(b) {
  if (!b.label?.trim()) return [null, 'Label isian wajib diisi.'];
  const type = TYPES.includes(b.type) ? b.type : 'text';
  const options = type === 'select' ? String(b.options || '').split(',').map((x) => x.trim()).filter(Boolean).join(', ') : null;
  if (type === 'select' && !options) return [null, 'Isi pilihan untuk tipe pilihan (pisahkan dengan koma).'];
  return [{ label: b.label.trim().slice(0, 120), type, options, required: b.required ? 1 : 0, show_when: b.show_when === '1B' ? '1B' : null, is_active: b.is_active === false ? 0 : 1, sort_order: +b.sort_order || 0 }];
}

router.post('/forms/:code/fields', async (req, res, next) => {
  try {
    const svc = await svcByCode(req.params.code);
    if (!svc) return res.status(404).json({ message: 'Layanan tidak ditemukan.' });
    const [f, err] = fieldBody(req.body);
    if (err) return res.status(400).json({ message: err });
    let key = f.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50) || 'isian';
    while (await one('SELECT id FROM service_fields WHERE service_id=? AND field_key=?', [svc.id, key])) key += '_2';
    const max = await one('SELECT COALESCE(MAX(sort_order),0)+1 n FROM service_fields WHERE service_id=?', [svc.id]);
    await q('INSERT INTO service_fields (service_id, field_key, label, type, options, required, show_when, sort_order, is_active) VALUES (?,?,?,?,?,?,?,?,?)',
      [svc.id, key, f.label, f.type, f.options, f.required, f.show_when, req.body.sort_order ? f.sort_order : max.n, f.is_active]);
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.put('/fields/:id', async (req, res, next) => {
  try {
    const [f, err] = fieldBody(req.body);
    if (err) return res.status(400).json({ message: err });
    await q('UPDATE service_fields SET label=?, type=?, options=?, required=?, show_when=?, sort_order=?, is_active=? WHERE id=?',
      [f.label, f.type, f.options, f.required, f.show_when, f.sort_order, f.is_active, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/fields/:id', async (req, res, next) => {
  try { await q('DELETE FROM service_fields WHERE id=?', [req.params.id]); res.json({ ok: true }); } catch (e) { next(e); }
});

router.post('/forms/:code/documents', async (req, res, next) => {
  try {
    const svc = await svcByCode(req.params.code);
    if (!svc) return res.status(404).json({ message: 'Layanan tidak ditemukan.' });
    if (!req.body.name?.trim()) return res.status(400).json({ message: 'Nama berkas wajib diisi.' });
    const max = await one('SELECT COALESCE(MAX(sort_order),0)+1 n FROM service_documents WHERE service_id=?', [svc.id]);
    await q('INSERT INTO service_documents (service_id, name, required, admin_if_package, sort_order) VALUES (?,?,?,?,?)',
      [svc.id, req.body.name.trim().slice(0, 120), req.body.required ? 1 : 0, svc.code === 'SP' && req.body.admin_if_package ? 1 : 0, max.n]);
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.put('/documents/:id', async (req, res, next) => {
  try {
    if (!req.body.name?.trim()) return res.status(400).json({ message: 'Nama berkas wajib diisi.' });
    await q('UPDATE service_documents SET name=?, required=?, admin_if_package=?, sort_order=?, is_active=? WHERE id=?',
      [req.body.name.trim().slice(0, 120), req.body.required ? 1 : 0, req.body.admin_if_package ? 1 : 0, +req.body.sort_order || 0, req.body.is_active === false ? 0 : 1, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/documents/:id', async (req, res, next) => {
  try { await q('DELETE FROM service_documents WHERE id=?', [req.params.id]); res.json({ ok: true }); } catch (e) { next(e); }
});

/* ---------- survei kepuasan: pertanyaan, teks terima kasih, hasil ---------- */
router.get('/survey', async (req, res, next) => {
  try {
    const questions = await q('SELECT * FROM survey_questions ORDER BY sort_order, id');
    const thanks = await one('SELECT svalue FROM settings WHERE skey="thank_you_text"');
    const summary = await q(`SELECT question, COUNT(*) n, ROUND(AVG(score),2) avg FROM survey_answers GROUP BY question ORDER BY MIN(id)`);
    const total = await one('SELECT COUNT(*) n FROM survey_responses');
    const perService = await q(`SELECT s.name service, COUNT(DISTINCT r.id) n, ROUND(AVG(sa.score),2) avg FROM survey_responses r
      JOIN applications a ON a.id=r.application_id JOIN services s ON s.id=a.service_id JOIN survey_answers sa ON sa.response_id=r.id GROUP BY s.id ORDER BY s.sort_order`);
    const recent = await q(`SELECT r.created_at, r.suggestion, a.application_no, u.company_name, (SELECT ROUND(AVG(score),2) FROM survey_answers x WHERE x.response_id=r.id) avg
      FROM survey_responses r JOIN applications a ON a.id=r.application_id JOIN users u ON u.id=r.user_id ORDER BY r.id DESC LIMIT 20`);
    res.json({ questions, thank_you_text: thanks?.svalue || '', total: total.n, summary, per_service: perService, recent });
  } catch (e) { next(e); }
});

router.put('/survey', async (req, res, next) => {
  try {
    const { questions = [], thank_you_text } = req.body;
    if (!questions.some((x) => x.question?.trim() && x.is_active !== false)) return res.status(400).json({ message: 'Minimal satu pertanyaan aktif.' });
    for (const [i, x] of questions.entries()) {
      const text = x.question?.trim();
      if (x.id && (x.deleted || !text)) { await q('UPDATE survey_questions SET is_active=0 WHERE id=?', [x.id]); continue; }
      if (!text) continue;
      if (x.id) await q('UPDATE survey_questions SET question=?, sort_order=?, is_active=? WHERE id=?', [text.slice(0, 255), i, x.is_active === false ? 0 : 1, x.id]);
      else await q('INSERT INTO survey_questions (question, sort_order, is_active) VALUES (?,?,?)', [text.slice(0, 255), i, x.is_active === false ? 0 : 1]);
    }
    if (typeof thank_you_text === 'string') {
      await q('INSERT INTO settings (skey, svalue) VALUES ("thank_you_text", ?) ON DUPLICATE KEY UPDATE svalue=VALUES(svalue)', [thank_you_text.trim()]);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
