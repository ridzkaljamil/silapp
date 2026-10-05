/** Area pelanggan (role user): ajukan layanan, lihat pengajuan sendiri, tanggapi, bayar, unduh. */
const router = require('express').Router();
const path = require('path');
const crypto = require('crypto');
const { q, one } = require('../config/db');
const { requireAuth, allow } = require('../middleware/auth');
const { upload, UPLOAD_DIR } = require('../utils/upload');
const wf = require('../services/workflow');
const { detail } = require('../services/present');
const { listApps } = require('../services/listing');

router.use(requireAuth, allow('user'));

const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rand = (n) => Array.from(crypto.randomBytes(n), (b) => CH[b % CH.length]).join('');

async function ownApp(req) {
  const app = await wf.loadApp(+req.params.id);
  if (app.user_id !== req.user.id) throw wf.httpError(404, 'Pengajuan tidak ditemukan.');
  return app;
}

router.get('/', async (req, res, next) => {
  try { res.json(await listApps('a.user_id=?', [req.user.id])); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try { res.json(await detail(await ownApp(req), 'customer')); } catch (e) { next(e); }
});

/**
 * Buat pengajuan baru (multipart/form-data)
 * fields: service_code, data (JSON), doc_types (JSON array, sejajar dengan files)
 * files : documents[]
 */
router.post('/', upload.array('documents', 10), async (req, res, next) => {
  try {
    const svc = await one('SELECT * FROM services WHERE code=? AND is_active=1', [req.body.service_code]);
    if (!svc || !svc.bidang) return res.status(400).json({ message: 'Layanan tidak valid.' });
    const data = JSON.parse(req.body.data || '{}');
    const docTypes = JSON.parse(req.body.doc_types || '[]');

    let label = svc.name;
    let product = null;
    if (data.product_id) {
      product = await one('SELECT * FROM products WHERE id=? AND service_id=?', [data.product_id, svc.id]);
      if (!product) return res.status(400).json({ message: 'Produk tidak termasuk ruang lingkup layanan ini.' });
    }
    if (svc.code === 'SP') {
      if (!product) return res.status(400).json({ message: 'Pilih produk dari ruang lingkup.' });
      label = `${product.name} · ${product.standard_no}${data.scheme ? ' · ' + data.scheme : ''}`;
    } else if (svc.code === 'KAL') {
      if (!data.equipment?.name) return res.status(400).json({ message: 'Nama alat wajib diisi.' });
      label = `${data.equipment.name}${data.equipment.brand_model ? ' ' + data.equipment.brand_model : ''}${data.location === 'onsite' ? ' · on-site' : ''}`;
    } else {
      if (!data.parameter_ids?.length) return res.status(400).json({ message: 'Pilih minimal satu parameter uji.' });
      label = `${product ? product.name : data.sample?.description || 'Sampel'} (${data.sample?.quantity || 1} sampel)`;
    }

    const ym = new Date().toISOString().slice(2, 7).replace('-', '');
    const seq = (await one('SELECT COUNT(*) n FROM applications WHERE service_id=?', [svc.id])).n + 1;
    const appNo = `PSU-${svc.code}-${ym}-${String(seq).padStart(4, '0')}`;
    let code;
    do { code = `SLP-${rand(4)}-${rand(4)}`; } while (await one('SELECT id FROM applications WHERE tracking_code=?', [code]));

    const r = await q(
      `INSERT INTO applications (application_no, tracking_code, user_id, service_id, product_id, product_label, application_type, scheme, location)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [appNo, code, req.user.id, svc.id, product ? product.id : null, label, data.application_type || null, data.scheme || null,
        svc.code === 'KAL' ? (data.location === 'onsite' ? 'onsite' : 'lab') : null]);
    const appId = r.insertId;

    for (const d of data.details || []) {
      if (d.value) await q('INSERT INTO application_details (application_id, field_key, field_label, field_value) VALUES (?,?,?,?)', [appId, d.key, d.label, String(d.value).slice(0, 500)]);
    }
    if (data.parameter_ids?.length) {
      const params = await q(
        `SELECT pp.* FROM product_parameters pp JOIN products p ON p.id=pp.product_id WHERE p.service_id=? AND pp.id IN (?)`, [svc.id, data.parameter_ids]);
      for (const p of params) {
        await q('INSERT INTO application_parameters (application_id, parameter_id, name, method, price_snapshot) VALUES (?,?,?,?,?)', [appId, p.id, p.name, p.method, p.price]);
      }
    }
    if (svc.code !== 'SP' && svc.code !== 'KAL') {
      await q('INSERT INTO samples (application_id, description, quantity) VALUES (?,?,?)', [appId, product ? product.name : data.sample?.description || 'Sampel', +data.sample?.quantity || 1]);
    }
    if (svc.code === 'KAL') {
      const e = data.equipment;
      await q(`INSERT INTO equipment (application_id, name, brand_model, serial_number, range_capacity, resolution, calibration_points, accessories, quantity)
        VALUES (?,?,?,?,?,?,?,?,?)`, [appId, e.name, e.brand_model, e.serial_number, e.range_capacity, e.resolution, e.calibration_points, e.accessories, +e.quantity || 1]);
    }
    for (const [i, f] of (req.files || []).entries()) {
      await q('INSERT INTO documents (application_id, doc_type, original_name, file_path, uploaded_by) VALUES (?,?,?,?,?)', [appId, docTypes[i] || 'Dokumen', f.originalname, f.filename, req.user.id]);
    }

    const app = await wf.loadApp(appId);
    await wf.addLog(app, 'buat', 'Pengajuan dibuat oleh pelanggan.', req.user);
    await wf.notify(app, 'Pengajuan diterima', `Pengajuan ${svc.name} Anda telah kami terima.\nGunakan kode lacak ${code} untuk memantau progres tanpa login.`);
    res.status(201).json({ id: appId, application_no: appNo, tracking_code: code });
  } catch (e) { next(e); }
});

/** Tanggapi Action Required: unggah dokumen perbaikan / data tambahan. */
router.post('/:id/reply', upload.array('documents', 5), async (req, res, next) => {
  try {
    const app = await ownApp(req);
    for (const f of req.files || []) {
      await q('INSERT INTO documents (application_id, doc_type, original_name, file_path, uploaded_by) VALUES (?,?,?,?,?)', [app.id, 'Tanggapan / perbaikan', f.originalname, f.filename, req.user.id]);
    }
    await wf.customerReply(app, req.user, req.body.note);
    res.json(await detail(await wf.loadApp(app.id), 'customer'));
  } catch (e) { next(e); }
});

/** Unggah bukti pembayaran (transfer manual). */
router.post('/:id/payment', upload.single('proof'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'File bukti bayar wajib diunggah.' });
    const app = await ownApp(req);
    await wf.customerPay(app, req.user, req.file.filename);
    res.json(await detail(await wf.loadApp(app.id), 'customer'));
  } catch (e) { next(e); }
});

router.get('/:id/documents/:docId', async (req, res, next) => {
  try {
    const app = await ownApp(req);
    const doc = await one('SELECT * FROM documents WHERE id=? AND application_id=?', [req.params.docId, app.id]);
    if (!doc) return res.status(404).json({ message: 'Dokumen tidak ditemukan.' });
    res.download(path.join(UPLOAD_DIR, doc.file_path), doc.original_name);
  } catch (e) { next(e); }
});

router.get('/:id/certificate', async (req, res, next) => {
  try {
    const app = await ownApp(req);
    const cert = await one('SELECT * FROM certificates WHERE application_id=?', [app.id]);
    if (!cert || !cert.file_path || app.status !== 'selesai') return res.status(404).json({ message: 'File sertifikat belum tersedia.' });
    res.download(path.join(UPLOAD_DIR, cert.file_path), `${cert.certificate_no.replace(/[\/\\]/g, '-')}.pdf`);
  } catch (e) { next(e); }
});

module.exports = router;
