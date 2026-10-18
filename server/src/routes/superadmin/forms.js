/** Form builder: isian tambahan & berkas per layanan. */
const router = require('express').Router();
const { q, one } = require('../../config/db');

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

module.exports = router;
