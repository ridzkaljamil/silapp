/** Area pelanggan (role user): ajukan layanan, lihat pengajuan sendiri, tanggapi, bayar, temuan, survei, unduh. */
const router = require('express').Router();
const path = require('path');
const crypto = require('crypto');
const { q, one } = require('../config/db');
const { requireAuth, allow } = require('../middleware/auth');
const { upload } = require('../utils/upload');
const storage = require('../utils/storage');
const wf = require('../services/workflow');
const { detail } = require('../services/present');
const { listApps } = require('../services/listing');
const { sendInvoicePdf } = require('../services/invoice');
const { PRICE_OPTIONS } = require('../utils/pricing');
const { getSettings } = require('../utils/settings');
const { notifyStaff } = require('../services/notifications');
const { readPairs, formatPairs, parsePairs, hiddenFor } = require('../utils/fields');

router.use(requireAuth, allow('user'));

const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Jumlah sampel / alat: bilangan bulat 1–999, selain itu null. */
const qty = (v) => { const n = Number(v ?? 1); return Number.isInteger(n) && n >= 1 && n <= 999 ? n : null; };
const rand = (n) => Array.from(crypto.randomBytes(n), (b) => CH[b % CH.length]).join('');

async function ownApp(req) {
  const app = await wf.loadApp(+req.params.id);
  if (app.user_id !== req.user.id) throw wf.httpError(404, 'Pengajuan tidak ditemukan.');
  return app;
}

router.get('/', async (req, res, next) => {
  try { res.json((await listApps('a.user_id=?', [req.user.id])).map(({ sla, ...r }) => r)); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const app = await ownApp(req);
    res.json(await custDetail(app.id, app));
  } catch (e) { next(e); }
});

/**
 * Batalkan pengajuan: hanya selama PSU belum memproses (masih tahap 1 dan belum ada tindakan Admin).
 * body: reason
 */
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const app = await ownApp(req);
    const reason = String(req.body.reason || '').trim().slice(0, 300);
    if (!reason) return res.status(400).json({ message: 'Tuliskan alasan pembatalan.' });
    if (!(await canCancel(app))) return res.status(400).json({ message: 'Pengajuan sudah diproses PSU, jadi tidak bisa dibatalkan sendiri. Hubungi PSU bila perlu.' });
    await q('UPDATE applications SET status="batal", reject_note=? WHERE id=?', [reason, app.id]);
    await wf.addLog(app, 'batal', `Pengajuan dibatalkan pelanggan: ${reason}`, req.user);
    await notifyStaff(app, 'Pengajuan dibatalkan pelanggan', `${app.application_no} · ${app.company_name} · ${reason}`);
    res.json(await custDetail(app.id));
  } catch (e) { next(e); }
});

/** Data pengajuan lama dalam bentuk isian form Ajukan (untuk "Ajukan Ulang"). Berkas tidak ikut. */
router.get('/:id/prefill', async (req, res, next) => {
  try {
    const app = await ownApp(req);
    const details = await q('SELECT field_key, field_value FROM application_details WHERE application_id=?', [app.id]);
    const val = (k) => details.find((d) => d.field_key === k)?.field_value || '';
    const pairKeys = new Set((await q("SELECT field_key FROM service_fields WHERE service_id=? AND type='nomor_tanggal'", [app.service_id])).map((f) => f.field_key));
    const values = Object.fromEntries(details.filter((d) => !['merek_jenis', 'pernyataan_surveillance', 'kode_sampel', 'nama_produk', 'merek_spesifikasi'].includes(d.field_key))
      .map((d) => [d.field_key, pairKeys.has(d.field_key) ? parsePairs(d.field_value) : d.field_value]));
    const payload = { values };
    if (app.service_code === 'SP') {
      const prod = app.product_id ? await one('SELECT category FROM products WHERE id=?', [app.product_id]) : null;
      const brands = val('merek_jenis').split('\n').map((l) => l.replace(/^\d+\.\s*/, '')).filter(Boolean)
        .map((l) => { const [merek, ...rest] = l.split(' · '); return { merek: merek.trim(), jenis: rest.join(' · ').trim() }; });
      payload.sp = { category: prod?.category || '', product_id: app.product_id ? String(app.product_id) : '', scheme: app.scheme || '',
        types: String(app.application_type || '').split(',').map((x) => x.trim()).filter(Boolean), origin: app.origin || '',
        brands: brands.length ? brands : [{ merek: '', jenis: '' }], is_package: !!app.is_package };
    } else if (app.service_code === 'KAL') {
      const e = await one('SELECT * FROM equipment WHERE application_id=? LIMIT 1', [app.id]);
      payload.kal = { name: e?.name || '', brand_model: e?.brand_model || '', serial_number: e?.serial_number || '', range_capacity: e?.range_capacity || '',
        resolution: e?.resolution || '', calibration_points: e?.calibration_points || '', accessories: e?.accessories || '', quantity: e?.quantity || 1, location: app.location || 'lab' };
    } else {
      const params = await q('SELECT parameter_id, name, is_custom FROM application_parameters WHERE application_id=? ORDER BY id', [app.id]);
      const sample = await one('SELECT quantity FROM samples WHERE application_id=? LIMIT 1', [app.id]);
      const custom = params.filter((p) => p.is_custom).map((p) => p.name);
      const specs = val('merek_spesifikasi').split('\n').map((l) => l.replace(/^\d+\.\s*/, '')).filter(Boolean)
        .map((l) => { const [brand, ...rest] = l.split(' / '); return { brand: brand.trim(), spec: rest.join(' / ').trim() }; });
      payload.lab = { product_id: app.product_id || '', quantity: sample?.quantity || 1, full_sni: !!app.full_sni, option: app.price_option || 'std', custom_product: val('nama_produk'),
        specs: specs.length ? specs : [{ brand: '', spec: '' }],
        params: app.full_sni ? [] : params.filter((p) => !p.is_custom && p.parameter_id).map((p) => p.parameter_id), custom: custom.length ? custom : [''] };
    }
    res.json({ service_code: app.service_code, stage: 2, payload });
  } catch (e) { next(e); }
});

/** Detail untuk pelanggan + apakah masih bisa dibatalkan. */
async function custDetail(id, loaded) {
  const app = loaded || await wf.loadApp(id);
  return { ...(await detail(app, 'customer')), can_cancel: await canCancel(app) };
}

/** Bisa dibatalkan pelanggan: tahap 1, belum selesai/ditutup, dan Admin belum melakukan tindakan apa pun. */
async function canCancel(app) {
  if (app.current_step_order !== 1 || !['aktif', 'aksi'].includes(app.status)) return false;
  const staff = await one(`SELECT COUNT(*) n FROM status_logs l JOIN users u ON u.id=l.pic_user_id WHERE l.application_id=? AND u.role<>'user'`, [app.id]);
  return !staff.n;
}

/**
 * Buat pengajuan baru (multipart/form-data)
 * fields: service_code, data (JSON), doc_types (JSON array, sejajar dengan files)
 * files : documents[]
 * data  : product_id, scheme, application_type, is_package (SP), fields {key: value} (form builder),
 *         parameter_ids / full_sni / custom_params / price_option std|alt (Lab), equipment & location (Kalibrasi)
 */
/** Pengajuan aktif milik pelanggan yang sama untuk produk (atau alat kalibrasi) yang sama. */
async function findDuplicate(userId, svc, product, data) {
  if (product?.custom_name) {
    // produk di luar lingkup KAN: satu produk umum dipakai banyak nama produk, jadi bandingkan nama yang ditulis pelanggan
    if (!data.custom_product) return null;
    return one(`SELECT a.id, a.application_no, a.product_label FROM applications a JOIN application_details d ON d.application_id=a.id AND d.field_key='nama_produk'
      WHERE a.user_id=? AND a.service_id=? AND a.status IN ('aktif','aksi') AND d.field_value=? ORDER BY a.id DESC LIMIT 1`, [userId, svc.id, data.custom_product]);
  }
  if (product) {
    return one(`SELECT id, application_no, product_label FROM applications WHERE user_id=? AND service_id=? AND product_id=? AND status IN ('aktif','aksi')
      ORDER BY id DESC LIMIT 1`, [userId, svc.id, product.id]);
  }
  if (svc.code === 'KAL' && data.equipment?.name) {
    return one(`SELECT a.id, a.application_no, a.product_label FROM applications a JOIN equipment e ON e.application_id=a.id
      WHERE a.user_id=? AND a.service_id=? AND a.status IN ('aktif','aksi') AND e.name=? AND COALESCE(e.serial_number,'')=? ORDER BY a.id DESC LIMIT 1`,
    [userId, svc.id, data.equipment.name, data.equipment.serial_number || '']);
  }
  return null;
}

/** Pernyataan yang disetujui pelanggan saat mencentang Surveillance. */
const SURV_TEXT = 'Kami bersedia dilakukan surveilan oleh PT Penilai Standar Uji selama masa berlaku sertifikat.';

router.post('/', upload.array('documents', 20), async (req, res, next) => {
  try {
    const svc = await one('SELECT * FROM services WHERE code=? AND is_active=1', [req.body.service_code]);
    if (!svc || !svc.bidang) return res.status(400).json({ message: 'Layanan tidak valid.' });
    if (svc.state !== 'ok') return res.status(400).json({ message: `${svc.name} belum beroperasi, jadi belum bisa diajukan.` });
    let data; let docTypes;
    try { data = JSON.parse(req.body.data || '{}'); docTypes = JSON.parse(req.body.doc_types || '[]'); } catch {
      return res.status(400).json({ message: 'Data pengajuan tidak valid. Muat ulang halaman lalu coba lagi.' });
    }
    if (!Array.isArray(docTypes)) docTypes = [];

    // form builder: isian & berkas yang diatur Super Admin
    const fieldDefs = await q('SELECT * FROM service_fields WHERE service_id=? AND is_active=1 ORDER BY sort_order, id', [svc.id]);
    const docDefs = await q('SELECT * FROM service_documents WHERE service_id=? AND is_active=1 ORDER BY sort_order, id', [svc.id]);
    const is1B = /1b/i.test(data.scheme || '');
    const isPackage = svc.code === 'SP' && !!data.is_package;
    const values = data.fields || {};
    const fieldText = {};
    for (const f of fieldDefs) {
      if (f.show_when === '1B' && !is1B) continue;
      if (f.type === 'nomor_tanggal') {
        const r = readPairs(values[f.field_key], { label: f.label, required: !!f.required, multiple: !!f.multiple });
        if (r.error) return res.status(400).json({ message: r.error });
        fieldText[f.field_key] = formatPairs(r.rows);
        continue;
      }
      fieldText[f.field_key] = String(values[f.field_key] ?? '').trim();
      if (f.required && !fieldText[f.field_key]) return res.status(400).json({ message: `${f.label} wajib diisi.` });
    }
    if (['SP', 'KAL'].includes(svc.code)) data.specs = []; // brand/spesifikasi hanya untuk layanan lab
    const types = String(data.application_type || '').split(',').map((x) => x.trim()).filter(Boolean);
    const surveillance = svc.code === 'SP' && types.includes('Surveillance');
    if (svc.code === 'SP' && !types.length) return res.status(400).json({ message: 'Pilih jenis permohonan.' });
    if (svc.code === 'SP' && !['dn', 'ln'].includes(data.origin)) return res.status(400).json({ message: 'Pilih asal produk: Dalam Negeri atau Luar Negeri.' });
    const brands = svc.code === 'SP' ? (data.brands || []).map((b) => ({ merek: String(b.merek || '').trim(), jenis: String(b.jenis || '').trim() })).filter((b) => b.merek || b.jenis).slice(0, 30) : [];
    if (svc.code === 'SP' && (!brands.length || brands.some((b) => !b.merek))) return res.status(400).json({ message: 'Isi minimal satu Merek beserta Jenisnya.' });
    for (const d of docDefs) {
      if (d.show_when === 'SURV' && !surveillance) continue;
      if (svc.code === 'SP' && hiddenFor(d.hide_schemes, data.scheme)) continue;
      if (d.required && !(d.admin_if_package && isPackage) && !docTypes.includes(d.name)) return res.status(400).json({ message: `Berkas "${d.name}" wajib diunggah.` });
    }

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
      const e = data.equipment || {};
      // panjang maksimal mengikuti kolom tabel equipment
      const MAX = { name: 160, brand_model: 160, serial_number: 80, range_capacity: 80, resolution: 40, calibration_points: 255, accessories: 255 };
      data.equipment = Object.fromEntries(Object.entries(MAX).map(([k, n]) => [k, String(e[k] ?? '').trim().slice(0, n) || null]));
      data.equipment.quantity = qty(e.quantity);
      if (!data.equipment.quantity) return res.status(400).json({ message: 'Jumlah alat harus 1–999.' });
      if (!data.equipment.name) return res.status(400).json({ message: 'Nama alat wajib diisi.' });
      label = `${data.equipment.name}${data.equipment.brand_model ? ' ' + data.equipment.brand_model : ''}${data.location === 'onsite' ? ' · on-site' : ''}`;
    } else {
      // produk di luar lingkup akreditasi KAN: pelanggan menulis nama produknya sendiri
      data.custom_product = product?.custom_name ? String(data.custom_product || '').trim().slice(0, 120) : '';
      if (product?.custom_name && !data.custom_product) return res.status(400).json({ message: 'Tuliskan nama produk yang akan diuji.' });
      if (data.custom_product) data.sample = { ...data.sample, description: data.custom_product };
      // brand / spesifikasi produk (opsional): dicetak bernomor di kolom pekerjaan proforma invoice lab
      data.specs = (Array.isArray(data.specs) ? data.specs : []).slice(0, 50)
        .map((x) => [String(x?.brand || '').trim().slice(0, 80), String(x?.spec || '').trim().slice(0, 80)].filter(Boolean).join(' / ')).filter(Boolean);
      data.custom_params = (data.custom_params || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 20);
      data.sample = { description: String(data.sample?.description || '').trim().slice(0, 160), quantity: qty(data.sample?.quantity) };
      if (!data.sample.quantity) return res.status(400).json({ message: 'Jumlah sampel harus 1–999.' });
      data.parameter_ids = (Array.isArray(data.parameter_ids) ? data.parameter_ids : []).map(Number).filter(Boolean);
      if (data.parameter_ids.length) {
        // hanya parameter milik produk yang dipilih (atau milik layanan ini jika tanpa produk)
        const valid = await q(`SELECT pp.id FROM product_parameters pp JOIN products p ON p.id=pp.product_id WHERE p.service_id=? AND pp.id IN (?)${product ? ' AND p.id=?' : ''}`,
          [svc.id, data.parameter_ids, ...(product ? [product.id] : [])]);
        data.parameter_ids = valid.map((x) => x.id);
      }
      if (!data.full_sni && !data.parameter_ids?.length && !data.custom_params.length) return res.status(400).json({ message: 'Pilih minimal satu parameter uji.' });
      if (data.full_sni && !product) return res.status(400).json({ message: 'Pilih produk untuk parameter lengkap sesuai SNI.' });
      label = `${data.custom_product ? `${data.custom_product} · di luar lingkup KAN` : product ? product.name : data.sample.description || 'Sampel'} (${data.sample.quantity} sampel)`;
    }
    // opsi harga lab: Reguler/Ekspress (Kimia) atau Dalam/Luar Negeri (Fisika).
    // Harga opsi kedua yang kosong memakai harga utama; biaya tambahan Ekspress dikonfirmasi PSU di invoice.
    const priceOption = PRICE_OPTIONS[svc.code] && data.price_option === 'alt' ? 'alt' : 'std';
    if (priceOption === 'alt' && product && !product.alt_available) {
      return res.status(400).json({ message: `${PRICE_OPTIONS[svc.code][1]} belum tersedia untuk ${product.name}.` });
    }

    // harga paket lengkap SNI dikunci saat diajukan, sama seperti harga per parameter (price_snapshot)
    const pkgSnapshot = data.full_sni && product ? ((priceOption === 'alt' ? product.package_price_alt ?? product.package_price : product.package_price) ?? null) : null;

    // pengajuan ganda: produk/alat yang sama masih berjalan → minta konfirmasi pelanggan dulu
    if (!data.confirm_duplicate) {
      const dup = await findDuplicate(req.user.id, svc, product, data);
      if (dup) return res.status(409).json({ code: 'DUPLICATE', message: `Anda masih punya pengajuan ${dup.application_no} untuk ${dup.product_label} yang sedang berjalan.`, existing: dup });
    }

    // nomor pengajuan PSU-SP-2610-0003: bulan (waktu lokal server) + urutan per layanan; dicoba ulang bila bentrok
    const now = new Date();
    const ym = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const flow = await wf.flowFor(svc.id, svc.code, data.scheme);
    let appId; let appNo; let code;
    for (let attempt = 0; !appId; attempt++) {
      const last = await one("SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(application_no,'-',-1) AS UNSIGNED)),0) n FROM applications WHERE service_id=?", [svc.id]);
      appNo = `PSU-${svc.code}-${ym}-${String(+last.n + 1 + attempt).padStart(4, '0')}`;
      code = `SLP${String(now.getFullYear()).slice(2)}-${rand(8)}`;
      try {
        const r = await q(
          `INSERT INTO applications (application_no, tracking_code, user_id, service_id, product_id, product_label, application_type, scheme, origin, location, is_package, full_sni, package_snapshot, price_option, flow)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [appNo, code, req.user.id, svc.id, product ? product.id : null, label.slice(0, 255), types.join(', ').slice(0, 80) || null, svc.code === 'SP' ? data.scheme || null : null, svc.code === 'SP' ? data.origin : null,
            svc.code === 'KAL' ? (data.location === 'onsite' ? 'onsite' : 'lab') : null, isPackage ? 1 : 0, data.full_sni ? 1 : 0, pkgSnapshot, priceOption, flow]);
        appId = r.insertId;
      } catch (e) { if (e.code !== 'ER_DUP_ENTRY' || attempt >= 4) throw e; }
    }

    if (data.custom_product) {
      await q('INSERT INTO application_details (application_id, field_key, field_label, field_value) VALUES (?,?,?,?)', [appId, 'nama_produk', 'Nama Produk (di luar lingkup KAN)', data.custom_product]);
    }
    if (data.specs?.length) {
      await q('INSERT INTO application_details (application_id, field_key, field_label, field_value) VALUES (?,?,?,?)',
        [appId, 'merek_spesifikasi', 'Brand / Spesifikasi Produk', data.specs.map((x, i) => `${i + 1}. ${x}`).join('\n')]);
    }
    for (const f of fieldDefs) {
      if (f.show_when === '1B' && !is1B) continue;
      const v = fieldText[f.field_key];
      if (v) await q('INSERT INTO application_details (application_id, field_key, field_label, field_value) VALUES (?,?,?,?)', [appId, f.field_key, f.label, v.slice(0, 500)]);
    }
    if (brands.length) {
      const v = brands.map((b, i) => `${brands.length > 1 ? `${i + 1}. ` : ''}${b.merek}${b.jenis ? ` · ${b.jenis}` : ''}`).join('\n');
      await q('INSERT INTO application_details (application_id, field_key, field_label, field_value) VALUES (?,?,?,?)', [appId, 'merek_jenis', 'Merek & Jenis', v.slice(0, 500)]);
    }
    if (surveillance) {
      await q('INSERT INTO application_details (application_id, field_key, field_label, field_value) VALUES (?,?,?,?)', [appId, 'pernyataan_surveillance', 'Pernyataan Surveillance', SURV_TEXT]);
    }
    if (data.full_sni || data.parameter_ids?.length) {
      const params = data.full_sni
        ? await q('SELECT * FROM product_parameters WHERE product_id=? ORDER BY id', [product.id])
        : await q('SELECT * FROM product_parameters WHERE id IN (?) ORDER BY id', [data.parameter_ids]);
      for (const p of params) {
        await q('INSERT INTO application_parameters (application_id, parameter_id, name, method, price_snapshot) VALUES (?,?,?,?,?)', [appId, p.id, p.name, p.method, priceOption === 'alt' ? (p.price_alt ?? p.price) : p.price]);
      }
    }
    for (const name of data.custom_params || []) {
      await q('INSERT INTO application_parameters (application_id, name, is_custom) VALUES (?,?,1)', [appId, name.slice(0, 160)]);
    }
    if (svc.code !== 'SP' && svc.code !== 'KAL') {
      await q('INSERT INTO samples (application_id, description, quantity) VALUES (?,?,?)', [appId, data.custom_product || product?.name || data.sample.description || 'Sampel', data.sample.quantity]);
    }
    if (svc.code === 'KAL') {
      const e = data.equipment;
      await q(`INSERT INTO equipment (application_id, name, brand_model, serial_number, range_capacity, resolution, calibration_points, accessories, quantity)
        VALUES (?,?,?,?,?,?,?,?,?)`, [appId, e.name, e.brand_model, e.serial_number, e.range_capacity, e.resolution, e.calibration_points, e.accessories, e.quantity]);
    }
    for (const [i, f] of (req.files || []).entries()) {
      await q('INSERT INTO documents (application_id, doc_type, original_name, file_path, step_order, uploaded_by) VALUES (?,?,?,?,1,?)', [appId, docTypes[i] || 'Dokumen', f.originalname, f.filename, req.user.id]);
    }

    const app = await wf.loadApp(appId);
    await wf.addLog(app, 'buat', 'Pengajuan dibuat oleh pelanggan.', req.user);
    await notifyStaff(app, 'Pengajuan baru masuk', `${appNo} · ${app.company_name} · ${label}`);
    await wf.notify(app, 'Pengajuan diterima', `Pengajuan ${svc.name} Anda telah kami terima.\nGunakan kode lacak ${code} untuk memantau progres tanpa login.`);
    await q('DELETE FROM drafts WHERE user_id=?', [req.user.id]);
    res.status(201).json({ id: appId, application_no: appNo, tracking_code: code });
  } catch (e) { next(e); }
});

/** Tanggapi Action Required: unggah dokumen perbaikan / data tambahan. */
router.post('/:id/reply', upload.array('documents', 5), async (req, res, next) => {
  try {
    const app = await ownApp(req);
    await wf.customerReply(app, req.user, req.body.note, req.files);
    res.json(await custDetail(app.id));
  } catch (e) { next(e); }
});

/** Unggah bukti pembayaran (transfer manual). */
router.post('/:id/payment', upload.single('proof'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'File bukti bayar wajib diunggah.' });
    const app = await ownApp(req);
    await wf.customerPay(app, req.user, req.file.filename);
    res.json(await custDetail(app.id));
  } catch (e) { next(e); }
});

router.get('/:id/documents/:docId', async (req, res, next) => {
  try {
    const app = await ownApp(req);
    const doc = await one('SELECT * FROM documents WHERE id=? AND application_id=? AND customer_visible=1', [req.params.docId, app.id]);
    if (!doc) return res.status(404).json({ message: 'Dokumen tidak ditemukan.' });
    await storage.send(res, doc.file_path, doc.original_name);
  } catch (e) { next(e); }
});

router.get('/:id/invoice', async (req, res, next) => {
  try {
    const app = await ownApp(req);
    await sendInvoicePdf(app, res);
  } catch (e) { next(e); }
});

/** Tahap Invoice & Faktur: unggah bukti bayar pelunasan / bukti potong PPh 23. kind: bayar | potong */
router.post('/:id/billing/:kind', upload.single('file'), async (req, res, next) => {
  try {
    const app = await ownApp(req);
    await wf.billing.customerUpload(app, req.user, req.params.kind, req.file);
    res.json(await custDetail(app.id));
  } catch (e) { next(e); }
});

/** Unduh invoice / faktur pajak dari PSU, atau bukti yang diunggah sendiri. */
router.get('/:id/billing/:file', async (req, res, next) => {
  try { await wf.billing.sendFile(res, await ownApp(req), req.params.file); } catch (e) { next(e); }
});

/** Bukti bayar yang pernah diunggah pelanggan sendiri. */
router.get('/:id/payment-proof', async (req, res, next) => {
  try {
    const app = await ownApp(req);
    const pay = await one('SELECT proof_path FROM payments WHERE application_id=? AND proof_path IS NOT NULL ORDER BY id DESC LIMIT 1', [app.id]);
    if (!pay) return res.status(404).json({ message: 'Bukti bayar belum ada.' });
    await storage.send(res, pay.proof_path, `bukti-bayar-${app.application_no}${path.extname(pay.proof_path)}`);
  } catch (e) { next(e); }
});

/* ---------- temuan audit ---------- */
router.post('/:id/findings/:fid/reply', upload.array('documents', 5), async (req, res, next) => {
  try {
    const app = await ownApp(req);
    const b = req.body;
    await wf.customerFindingReply(app, req.user, +req.params.fid, { note: b.note, correction: b.correction, rootCause: b.root_cause, correctiveAction: b.corrective_action }, req.files);
    res.json(await custDetail(app.id));
  } catch (e) { next(e); }
});

router.post('/:id/findings/:fid/extension', upload.array('documents', 5), async (req, res, next) => {
  try {
    const app = await ownApp(req);
    await wf.customerExtension(app, req.user, +req.params.fid, String(req.body.reason || '').trim(), req.files);
    res.json(await custDetail(app.id));
  } catch (e) { next(e); }
});

/* ---------- survei kepuasan (wajib sebelum unduh dokumen), kuesioner per layanan ---------- */
const SURVEY_TITLE = { SP: 'Lembaga Sertifikasi Produk (LSPro)', LAB: 'Laboratorium Pengujian', KAL: 'Laboratorium Kalibrasi' };
router.get('/:id/survey', async (req, res, next) => {
  try {
    const app = await ownApp(req);
    const bidang = app.service_bidang;
    const done = await one('SELECT id, created_at FROM survey_responses WHERE application_id=?', [app.id]);
    const set = await getSettings(['thank_you_text', `survey_intro_${bidang}`]);
    const cert = await one('SELECT certificate_no FROM certificates WHERE application_id=?', [app.id]);
    const u = await one('SELECT name, email, phone, company_name FROM users WHERE id=?', [req.user.id]);
    res.json({
      done: !!done, bidang,
      title: `Survei Kepuasan Pelanggan – ${SURVEY_TITLE[bidang]}`,
      intro: set[`survey_intro_${bidang}`],
      questions: done ? [] : await q('SELECT id, question FROM survey_questions WHERE bidang=? AND is_active=1 ORDER BY sort_order, id', [bidang]),
      defaults: { company_name: u.company_name || '', respondent_name: u.name || '', reference_no: cert?.certificate_no || app.application_no, contact_info: [u.email, u.phone].filter(Boolean).join(' / ') },
      thank_you_text: set.thank_you_text || 'Terima kasih telah mengisi survei kepuasan pelanggan.',
    });
  } catch (e) { next(e); }
});

router.post('/:id/survey', async (req, res, next) => {
  try {
    const app = await ownApp(req);
    await wf.submitSurvey(app, req.user, req.body);
    const { thank_you_text } = await getSettings(['thank_you_text']);
    res.json({ thank_you_text, app: await custDetail(app.id) });
  } catch (e) { next(e); }
});

router.get('/:id/certificate', async (req, res, next) => {
  try {
    const app = await ownApp(req);
    const cert = await one('SELECT * FROM certificates WHERE application_id=?', [app.id]);
    if (!cert || !cert.file_path || !wf.workDone(app)) return res.status(404).json({ message: 'File sertifikat belum tersedia.' });
    // sertifikat yang dicabut tidak berlaku lagi: file tidak bisa diunduh pelanggan (Admin tetap bisa melihat arsipnya)
    if (cert.status === 'dicabut') return res.status(403).json({ code: 'CERT_REVOKED', message: 'Sertifikat ini telah dicabut dan tidak berlaku lagi, sehingga tidak dapat diunduh. Hubungi PSU untuk informasi lebih lanjut.' });
    // skema 50:50 / Full di Akhir: sertifikat/LHU baru bisa diunduh setelah pelunasan disetujui
    if (!wf.finalPaid(app)) return res.status(403).json({ code: 'CERT_UNPAID', message: 'Dokumen dapat diunduh setelah bukti bayar pelunasan disetujui PSU.' });
    if (!(await one('SELECT id FROM survey_responses WHERE application_id=?', [app.id]))) return res.status(403).json({ message: 'Isi survei kepuasan pelanggan terlebih dahulu.' });
    await storage.send(res, cert.file_path, `${cert.certificate_no.replace(/[\/\\]/g, '-')}.pdf`);
  } catch (e) { next(e); }
});

module.exports = router;
