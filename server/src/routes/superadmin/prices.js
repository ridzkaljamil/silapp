/** Daftar harga lab: produk, parameter uji, harga utama dan opsi kedua. */
const router = require('express').Router();
const { q, one } = require('../../config/db');
const { money, text, inUse } = require('./helpers');

/* ---------- daftar harga lab (Lab Kimia & Lab Fisika): harga utama + opsi kedua (Ekspress / Luar Negeri) ---------- */
const PRICE_SVC = ['KIM', 'FIS', 'MIK'];
/** Harga kosong / bukan angka = belum ada harga (null). */

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

module.exports = router;
