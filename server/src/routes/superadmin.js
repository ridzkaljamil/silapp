/** Khusus Super Admin: pengguna, master layanan, daftar harga lab, form pengajuan, survei. */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { q, one } = require('../config/db');
const { requireAuth, allow } = require('../middleware/auth');
const { setSetting, getSettings, INVOICE_KEYS } = require('../utils/settings');
const { parseMoney } = require('../utils/pricing');

router.use(requireAuth, allow('superadmin'));

const JABATAN = {
  SP: ['Admin Sertifikasi', 'Manager Sertifikasi', 'Auditor', 'PPC', 'Reviewer', 'Decision Maker'],
  LAB: ['Admin Lab', 'Admin Penerimaan', 'Koordinator Lab', 'Petugas Preparasi', 'Analis', 'Reviewer/Verifikator', 'Penandatangan berwenang'],
  KAL: ['Admin Kalibrasi', 'Koordinator', 'Personel Kalibrasi', 'Reviewer/Verifikator', 'Penandatangan berwenang'],
};
router.get('/jabatan', (req, res) => res.json(JABATAN));

/* ---------- pengguna internal (Admin & Super Admin). Akun pelanggan dikelola di routes/customers.js ---------- */
router.get('/users', async (req, res, next) => {
  try {
    res.json(await q('SELECT id, role, name, email, jabatan, bidang, phone, is_active, created_at FROM users WHERE role<>"user" ORDER BY FIELD(role,"superadmin","admin"), name'));
  } catch (e) { next(e); }
});

/** Rapikan isian akun (spasi, huruf kecil email, panjang maksimal kolom). */
function cleanUser(b) {
  return { ...b, name: String(b.name ?? '').trim().slice(0, 120), email: String(b.email ?? '').trim().toLowerCase().slice(0, 160),
    company_name: String(b.company_name ?? '').trim().slice(0, 160), phone: String(b.phone ?? '').trim().slice(0, 30) };
}

function validUser(b) {
  if (!['superadmin', 'admin'].includes(b.role)) return 'Role tidak valid. Akun pelanggan dibuat lewat menu Akun Pelanggan.';
  if (!b.name || !b.email) return 'Nama dan email wajib diisi.';
  if (!/^\S+@\S+\.\S+$/.test(b.email)) return 'Format email tidak valid.';
  if (b.phone && !/^[0-9+()\-\s]{6,30}$/.test(b.phone)) return 'Nomor telepon tidak valid.';
  if (b.role === 'admin' && (!JABATAN[b.bidang] || !JABATAN[b.bidang].includes(b.jabatan))) return 'Admin wajib memiliki bidang dan jabatan yang sesuai.';
  return null;
}

router.post('/users', async (req, res, next) => {
  try {
    const b = cleanUser(req.body);
    const err = validUser(b) || (!b.password || b.password.length < 8 ? 'Kata sandi awal minimal 8 karakter.' : null);
    if (err) return res.status(400).json({ message: err });
    if (await one('SELECT id FROM users WHERE email=?', [b.email])) return res.status(409).json({ message: 'Email sudah dipakai.' });
    const r = await q('INSERT INTO users (role, name, email, password_hash, jabatan, bidang, company_name, phone) VALUES (?,?,?,?,?,?,?,?)',
      [b.role, b.name, b.email, await bcrypt.hash(b.password, 10), b.role === 'admin' ? b.jabatan : null, b.role === 'admin' ? b.bidang : null,
        'PT Penilai Standar Uji', b.phone || null]);
    res.status(201).json({ id: r.insertId });
  } catch (e) { next(e); }
});

router.put('/users/:id', async (req, res, next) => {
  try {
    const b = cleanUser(req.body);
    const err = validUser(b) || (b.password && b.password.length < 8 ? 'Kata sandi minimal 8 karakter.' : null);
    if (err) return res.status(400).json({ message: err });
    if (!(await one('SELECT id FROM users WHERE id=? AND role<>"user"', [req.params.id]))) return res.status(404).json({ message: 'Pengguna internal tidak ditemukan.' });
    if (+req.params.id === req.user.id && (b.role !== 'superadmin' || b.is_active === false)) {
      return res.status(400).json({ message: 'Anda tidak bisa menurunkan role atau menonaktifkan akun Anda sendiri.' });
    }
    if (await one('SELECT id FROM users WHERE email=? AND id<>?', [b.email, req.params.id])) return res.status(409).json({ message: 'Email sudah dipakai.' });
    await q('UPDATE users SET role=?, name=?, email=?, jabatan=?, bidang=?, phone=?, is_active=? WHERE id=?',
      [b.role, b.name, b.email, b.role === 'admin' ? b.jabatan : null, b.role === 'admin' ? b.bidang : null, b.phone || null, b.is_active === false ? 0 : 1, req.params.id]);
    if (b.password) {
      await q('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(b.password, 10), req.params.id]);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    if (+req.params.id === req.user.id) return res.status(400).json({ message: 'Tidak bisa menghapus akun sendiri.' });
    if (!(await one('SELECT id FROM users WHERE id=? AND role<>"user"', [req.params.id]))) return res.status(404).json({ message: 'Pengguna internal tidak ditemukan.' });
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

/* ---------- daftar harga lab (Lab Kimia & Lab Fisika): harga utama + opsi kedua (Ekspress / Luar Negeri) ---------- */
const PRICE_SVC = ['KIM', 'FIS', 'MIK'];
/** Harga kosong / bukan angka = belum ada harga (null). */
const money = parseMoney;
const text = (v, n) => String(v ?? '').trim().slice(0, n);
const inUse = (e) => e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED';

router.get('/prices', async (req, res, next) => {
  try {
    const products = await q(`SELECT p.id, p.name, p.category, p.standard_no, p.package_price, p.package_price_alt, p.alt_available, p.note, p.custom_name, s.code service_code, s.name service_name
      FROM products p JOIN services s ON s.id=p.service_id WHERE s.code IN (?) ORDER BY s.sort_order, p.id`, [PRICE_SVC]);
    const params = await q(`SELECT pp.id, pp.product_id, pp.name, pp.method, pp.price, pp.price_alt FROM product_parameters pp
      JOIN products p ON p.id=pp.product_id JOIN services s ON s.id=p.service_id WHERE s.code IN (?) ORDER BY pp.id`, [PRICE_SVC]);
    res.json(products.map((p) => ({ ...p, alt_available: !!p.alt_available, custom_name: !!p.custom_name, parameters: params.filter((x) => x.product_id === p.id) })));
  } catch (e) { next(e); }
});

/** Simpan parameter produk: baru (tanpa id), ubah (id), hapus (id + deleted). */
async function saveParams(productId, list = []) {
  for (const p of list) {
    if (p.id && p.deleted) {
      try { await q('DELETE FROM product_parameters WHERE id=? AND product_id=?', [p.id, productId]); } catch (e) {
        if (inUse(e)) throw Object.assign(new Error(`Parameter "${p.name}" sudah dipakai di pengajuan, jadi tidak bisa dihapus. Ubah namanya atau biarkan.`), { status: 400 });
        throw e;
      }
      continue;
    }
    const name = text(p.name, 160);
    if (!name) continue;
    if (p.id) await q('UPDATE product_parameters SET name=?, method=?, price=?, price_alt=? WHERE id=? AND product_id=?', [name, text(p.method, 160) || null, money(p.price), money(p.price_alt), p.id, productId]);
    else await q('INSERT INTO product_parameters (product_id, name, method, price, price_alt) VALUES (?,?,?,?,?)', [productId, name, text(p.method, 160) || null, money(p.price), money(p.price_alt)]);
  }
}
const productBody = (b) => [text(b.name, 160), text(b.standard_no, 80) || null, money(b.package_price), money(b.package_price_alt), b.alt_available === false ? 0 : 1, text(b.note, 255) || null, b.custom_name ? 1 : 0];

router.post('/prices/products', async (req, res, next) => {
  try {
    const b = req.body;
    const svc = await one('SELECT id FROM services WHERE code=? AND code IN (?)', [b.service_code, PRICE_SVC]);
    if (!svc) return res.status(400).json({ message: 'Pilih laboratorium yang valid.' });
    if (!text(b.name, 160)) return res.status(400).json({ message: 'Nama produk wajib diisi.' });
    if (!b.custom_name && !(b.parameters || []).some((p) => text(p.name, 160))) return res.status(400).json({ message: 'Tambahkan minimal satu parameter uji.' });
    const r = await q('INSERT INTO products (service_id, category, name, standard_no, package_price, package_price_alt, alt_available, note, custom_name) VALUES (?,?,?,?,?,?,?,?,?)',
      [svc.id, 'Uji SNI', ...productBody(b)]);
    await saveParams(r.insertId, b.parameters);
    res.status(201).json({ id: r.insertId });
  } catch (e) { if (e.status) return res.status(e.status).json({ message: e.message }); next(e); }
});

router.put('/prices/products/:id', async (req, res, next) => {
  try {
    const prod = await one('SELECT p.id FROM products p JOIN services s ON s.id=p.service_id WHERE p.id=? AND s.code IN (?)', [req.params.id, PRICE_SVC]);
    if (!prod) return res.status(404).json({ message: 'Produk lab tidak ditemukan.' });
    if (!text(req.body.name, 160)) return res.status(400).json({ message: 'Nama produk wajib diisi.' });
    await q('UPDATE products SET name=?, standard_no=?, package_price=?, package_price_alt=?, alt_available=?, note=?, custom_name=? WHERE id=?', [...productBody(req.body), prod.id]);
    await saveParams(prod.id, req.body.parameters);
    res.json({ ok: true });
  } catch (e) { if (e.status) return res.status(e.status).json({ message: e.message }); next(e); }
});

router.delete('/prices/products/:id', async (req, res, next) => {
  try {
    const prod = await one('SELECT p.id FROM products p JOIN services s ON s.id=p.service_id WHERE p.id=? AND s.code IN (?)', [req.params.id, PRICE_SVC]);
    if (!prod) return res.status(404).json({ message: 'Produk lab tidak ditemukan.' });
    try { await q('DELETE FROM products WHERE id=?', [prod.id]); } catch (e) {
      if (inUse(e)) return res.status(400).json({ message: 'Produk ini sudah dipakai di pengajuan, jadi tidak bisa dihapus.' });
      throw e;
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

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

/* ---------- form builder: isian & berkas per layanan ---------- */
const TYPES = ['text', 'number', 'textarea', 'select', 'date', 'nomor_tanggal'];
/** Tipe skema sertifikasi yang ada di ruang lingkup SP (mis. Tipe 1b, Tipe 4, Tipe 5). */
async function schemeTypes() {
  const rows = await q("SELECT DISTINCT p.scheme_types t FROM products p JOIN services s ON s.id=p.service_id WHERE s.code='SP' AND p.scheme_types IS NOT NULL");
  const set = new Map();
  for (const r of rows) for (const t of r.t.split('/').map((x) => x.trim()).filter(Boolean)) set.set(t.toLowerCase(), set.get(t.toLowerCase()) || t);
  return [...set.values()].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
}
/** hide_schemes: hanya tipe skema yang dikenal, dipisah koma. */
const hideSchemes = (list, known) => {
  const ok = (Array.isArray(list) ? list : String(list || '').split(',')).map((x) => String(x).trim()).filter((x) => known.some((k) => k.toLowerCase() === x.toLowerCase()));
  return ok.length ? ok.join(', ').slice(0, 160) : null;
};
const svcByCode = (code) => one('SELECT id, code, name FROM services WHERE code=? AND bidang IS NOT NULL', [code]);

router.get('/forms/:code', async (req, res, next) => {
  try {
    const svc = await svcByCode(req.params.code);
    if (!svc) return res.status(404).json({ message: 'Layanan tidak ditemukan.' });
    res.json({
      service: svc,
      fields: await q('SELECT * FROM service_fields WHERE service_id=? ORDER BY sort_order, id', [svc.id]),
      documents: await q('SELECT * FROM service_documents WHERE service_id=? ORDER BY sort_order, id', [svc.id]),
      schemes: svc.code === 'SP' ? await schemeTypes() : [],
    });
  } catch (e) { next(e); }
});

function fieldBody(b) {
  if (!b.label?.trim()) return [null, 'Label isian wajib diisi.'];
  const type = TYPES.includes(b.type) ? b.type : 'text';
  const options = type === 'select' ? String(b.options || '').split(',').map((x) => x.trim()).filter(Boolean).join(', ') : null;
  if (type === 'select' && !options) return [null, 'Isi pilihan untuk tipe pilihan (pisahkan dengan koma).'];
  return [{ label: b.label.trim().slice(0, 120), type, options, required: b.required ? 1 : 0, show_when: b.show_when === '1B' ? '1B' : null, is_active: b.is_active === false ? 0 : 1, sort_order: +b.sort_order || 0,
    multiple: type === 'nomor_tanggal' && b.multiple ? 1 : 0 }];
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
    await q('INSERT INTO service_fields (service_id, field_key, label, type, options, required, show_when, multiple, sort_order, is_active) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [svc.id, key, f.label, f.type, f.options, f.required, f.show_when, f.multiple, req.body.sort_order ? f.sort_order : max.n, f.is_active]);
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.put('/fields/:id', async (req, res, next) => {
  try {
    const [f, err] = fieldBody(req.body);
    if (err) return res.status(400).json({ message: err });
    await q('UPDATE service_fields SET label=?, type=?, options=?, required=?, show_when=?, multiple=?, sort_order=?, is_active=? WHERE id=?',
      [f.label, f.type, f.options, f.required, f.show_when, f.multiple, f.sort_order, f.is_active, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/** Urutan baru hasil drag & drop. body: { fields: [id...] } atau { documents: [id...] } */
router.put('/forms/:code/order', async (req, res, next) => {
  try {
    const svc = await svcByCode(req.params.code);
    if (!svc) return res.status(404).json({ message: 'Layanan tidak ditemukan.' });
    for (const [key, table] of [['fields', 'service_fields'], ['documents', 'service_documents']]) {
      for (const [i, id] of (Array.isArray(req.body[key]) ? req.body[key] : []).entries()) {
        await q(`UPDATE ${table} SET sort_order=? WHERE id=? AND service_id=?`, [i + 1, +id, svc.id]);
      }
    }
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
    const hide = svc.code === 'SP' ? hideSchemes(req.body.hide_schemes, await schemeTypes()) : null;
    await q('INSERT INTO service_documents (service_id, name, required, admin_if_package, show_when, hide_schemes, sort_order) VALUES (?,?,?,?,?,?,?)',
      [svc.id, req.body.name.trim().slice(0, 120), req.body.required ? 1 : 0, svc.code === 'SP' && req.body.admin_if_package ? 1 : 0, svc.code === 'SP' && req.body.show_when === 'SURV' ? 'SURV' : null, hide, max.n]);
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.put('/documents/:id', async (req, res, next) => {
  try {
    if (!req.body.name?.trim()) return res.status(400).json({ message: 'Nama berkas wajib diisi.' });
    const doc = await one('SELECT d.id, s.code FROM service_documents d JOIN services s ON s.id=d.service_id WHERE d.id=?', [req.params.id]);
    if (!doc) return res.status(404).json({ message: 'Berkas tidak ditemukan.' });
    const hide = doc.code === 'SP' ? hideSchemes(req.body.hide_schemes, await schemeTypes()) : null;
    await q('UPDATE service_documents SET name=?, required=?, admin_if_package=?, show_when=?, hide_schemes=?, sort_order=?, is_active=? WHERE id=?',
      [req.body.name.trim().slice(0, 120), req.body.required ? 1 : 0, req.body.admin_if_package ? 1 : 0, req.body.show_when === 'SURV' ? 'SURV' : null, hide, +req.body.sort_order || 0, req.body.is_active === false ? 0 : 1, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/documents/:id', async (req, res, next) => {
  try { await q('DELETE FROM service_documents WHERE id=?', [req.params.id]); res.json({ ok: true }); } catch (e) { next(e); }
});

/* ---------- survei kepuasan per layanan: pertanyaan, teks, rekap, tindak lanjut, ekspor ---------- */
const SURVEY_BIDANG = ['SP', 'LAB', 'KAL'];
const bidangOf = (req) => (SURVEY_BIDANG.includes(req.query.bidang || req.body?.bidang) ? (req.query.bidang || req.body.bidang) : 'SP');
const RESP_SQL = `SELECT r.id, r.created_at, r.company_name, r.respondent_name, r.reference_no, r.avg_score, r.suggestion, r.contact_ok, r.contact_info,
    a.id application_id, a.application_no, s.name service_name, (SELECT COUNT(*) FROM survey_followups f WHERE f.response_id=r.id) followups
  FROM survey_responses r JOIN applications a ON a.id=r.application_id JOIN services s ON s.id=a.service_id`;

router.get('/survey', async (req, res, next) => {
  try {
    const bidang = bidangOf(req);
    const questions = await q('SELECT * FROM survey_questions WHERE bidang=? ORDER BY sort_order, id', [bidang]);
    const set = await getSettings(['thank_you_text', `survey_intro_${bidang}`]);
    const summary = await q(`SELECT sa.question, COUNT(*) n, ROUND(AVG(sa.score),2) avg FROM survey_answers sa
      JOIN survey_responses r ON r.id=sa.response_id WHERE r.bidang=? GROUP BY sa.question ORDER BY MIN(sa.id)`, [bidang]);
    const counts = await q('SELECT bidang, COUNT(*) n, ROUND(AVG(avg_score),2) avg FROM survey_responses GROUP BY bidang');
    const responses = await q(`${RESP_SQL} WHERE r.bidang=? ORDER BY r.id DESC`, [bidang]);
    res.json({ bidang, questions, intro: set[`survey_intro_${bidang}`] || '', thank_you_text: set.thank_you_text || '', summary, counts, responses });
  } catch (e) { next(e); }
});

router.get('/survey/responses/:id', async (req, res, next) => {
  try {
    const r = await one(`${RESP_SQL} WHERE r.id=?`, [req.params.id]);
    if (!r) return res.status(404).json({ message: 'Data survei tidak ditemukan.' });
    r.answers = await q('SELECT question, score FROM survey_answers WHERE response_id=? ORDER BY id', [r.id]);
    r.followup_list = await q(`SELECT f.id, f.note, f.created_at, u.name user_name FROM survey_followups f LEFT JOIN users u ON u.id=f.user_id
      WHERE f.response_id=? ORDER BY f.id`, [r.id]);
    res.json(r);
  } catch (e) { next(e); }
});

router.post('/survey/responses/:id/followups', async (req, res, next) => {
  try {
    const note = String(req.body.note || '').trim();
    if (!note) return res.status(400).json({ message: 'Isi catatan tindak lanjut.' });
    if (!(await one('SELECT id FROM survey_responses WHERE id=?', [req.params.id]))) return res.status(404).json({ message: 'Data survei tidak ditemukan.' });
    await q('INSERT INTO survey_followups (response_id, user_id, note) VALUES (?,?,?)', [req.params.id, req.user.id, note.slice(0, 2000)]);
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.put('/survey', async (req, res, next) => {
  try {
    const bidang = bidangOf(req);
    const { questions = [], thank_you_text, intro } = req.body;
    if (!questions.some((x) => x.question?.trim() && !x.deleted && x.is_active !== false)) return res.status(400).json({ message: 'Minimal satu pertanyaan aktif.' });
    for (const [i, x] of questions.entries()) {
      const text = x.question?.trim();
      if (x.id && (x.deleted || !text)) { await q('UPDATE survey_questions SET is_active=0 WHERE id=? AND bidang=?', [x.id, bidang]); continue; }
      if (!text) continue;
      if (x.id) await q('UPDATE survey_questions SET question=?, sort_order=?, is_active=? WHERE id=? AND bidang=?', [text.slice(0, 255), i, x.is_active === false ? 0 : 1, x.id, bidang]);
      else await q('INSERT INTO survey_questions (bidang, question, sort_order, is_active) VALUES (?,?,?,?)', [bidang, text.slice(0, 255), i, x.is_active === false ? 0 : 1]);
    }
    if (typeof thank_you_text === 'string') await setSetting('thank_you_text', thank_you_text.trim());
    if (typeof intro === 'string') await setSetting(`survey_intro_${bidang}`, intro.trim());
    // kirim balik data terbaru agar form langsung menampilkan yang tersimpan
    const set = await getSettings(['thank_you_text', `survey_intro_${bidang}`]);
    res.json({ questions: await q('SELECT * FROM survey_questions WHERE bidang=? ORDER BY sort_order, id', [bidang]), intro: set[`survey_intro_${bidang}`] || '', thank_you_text: set.thank_you_text || '' });
  } catch (e) { next(e); }
});

/** Rekap survei untuk Excel/CSV: tanggal, identitas, nilai tiap pertanyaan, rata-rata, saran, kontak, riwayat tindak lanjut. */
router.get('/survey/export', async (req, res, next) => {
  try {
    const bidang = bidangOf(req);
    const rows = await q(`${RESP_SQL} WHERE r.bidang=? ORDER BY r.id`, [bidang]);
    const ids = rows.map((r) => r.id);
    const answers = ids.length ? await q('SELECT response_id, question, score FROM survey_answers WHERE response_id IN (?) ORDER BY id', [ids]) : [];
    const fups = ids.length ? await q(`SELECT f.response_id, f.note, f.created_at, u.name FROM survey_followups f LEFT JOIN users u ON u.id=f.user_id
      WHERE f.response_id IN (?) ORDER BY f.id`, [ids]) : [];
    const qs = [...new Set(answers.map((a) => a.question))];
    const day = (d) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const head = ['Tanggal pengisian', 'Nama perusahaan/instansi', 'Nama responden', 'No. layanan/order/sertifikat', 'No. pengajuan', 'Layanan',
      ...qs.map((_, i) => `P${i + 1}`), 'Nilai rata-rata', 'Saran dan masukan', 'Bersedia dihubungi', 'Email/No. HP', 'Riwayat tindak lanjut'];
    const body = rows.map((r) => {
      const sc = Object.fromEntries(answers.filter((a) => a.response_id === r.id).map((a) => [a.question, a.score]));
      const f = fups.filter((x) => x.response_id === r.id).map((x) => `${day(x.created_at)} (${x.name || '-'}): ${x.note}`).join('\n');
      return [day(r.created_at), r.company_name, r.respondent_name, r.reference_no, r.application_no, r.service_name,
        ...qs.map((x) => sc[x] ?? ''), r.avg_score === null ? '' : +r.avg_score, r.suggestion || '', r.contact_ok === 1 ? 'Ya' : r.contact_ok === 0 ? 'Tidak' : '', r.contact_info || '', f];
    });
    const name = `rekap-survei-${bidang.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;

    if (req.query.format === 'csv') {
      const cell = (v) => { const t = String(v ?? ''); return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
      const csv = [head, ...body].map((r) => r.map(cell).join(',')).join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
      return res.send(`﻿${csv}`);
    }
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Rekap survei');
    ws.addRow(head).font = { bold: true };
    body.forEach((r) => ws.addRow(r));
    ws.columns.forEach((c, i) => { c.width = i < 6 ? 22 : i < 6 + qs.length ? 6 : 28; c.alignment = { vertical: 'top', wrapText: i >= 6 + qs.length }; });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    const wq = wb.addWorksheet('Daftar pertanyaan');
    wq.addRow(['Kode', 'Pertanyaan']).font = { bold: true };
    qs.forEach((x, i) => wq.addRow([`P${i + 1}`, x]));
    wq.getColumn(2).width = 110;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

module.exports = router;
