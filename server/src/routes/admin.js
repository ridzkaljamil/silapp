/** Area Admin & Super Admin: antrean per bidang, aksi workflow, invoice, temuan, parameter, dashboard. */
const router = require('express').Router();
const path = require('path');
const archiver = require('archiver');
const { q, one } = require('../config/db');
const { requireAuth, allow } = require('../middleware/auth');
const { upload } = require('../utils/upload');
const storage = require('../utils/storage');
const wf = require('../services/workflow');
const { detail } = require('../services/present');
const { listApps } = require('../services/listing');
const { sendInvoicePdf, invoiceDraft } = require('../services/invoice');
const { todayJkt } = require('../utils/certificate');

router.use(requireAuth, allow('admin', 'superadmin'));

/** Filter bidang: Admin hanya bidangnya, Super Admin semua. */
const scope = (u) => (u.role === 'superadmin' ? ['1=1', []] : ['s.bidang=?', [u.bidang]]);

async function handledApp(req) {
  const app = await wf.loadApp(+req.params.id);
  wf.assertCanHandle(req.user, app);
  return app;
}

/** Pengajuan yang menunggu tindakan PSU: baru masuk, bukti/perpanjangan temuan, bukti bayar, invoice belum terbit. */
const needsPsu = (a) => ['aktif', 'aksi'].includes(a.status) && (a.current_step.code.endsWith('-01') || a.findings_review > 0
  || a.payment_status === 'menunggu' || (a.payment_status === 'belum' && a.current_step.is_payment_step));

/** Angka badge menu Antrean. */
router.get('/counts', async (req, res, next) => {
  try { const [w, p] = scope(req.user); res.json({ need_action: (await listApps(w, p)).filter(needsPsu).length }); } catch (e) { next(e); }
});

/** Sertifikat Sertifikasi Produk yang berakhir dalam 90 hari (untuk Super Admin & Admin SP). */
async function expiringCerts(u) {
  if (!(u.role === 'superadmin' || u.bidang === 'SP')) return [];
  const rows = await q(`SELECT 'silapp' source, c.id, c.certificate_no, c.expires_at, c.status, a.id application_id, a.application_no, u.company_name factory_name
      FROM certificates c JOIN applications a ON a.id=c.application_id JOIN services s ON s.id=a.service_id JOIN users u ON u.id=a.user_id
     WHERE s.code='SP' AND a.status='selesai' AND c.status<>'dicabut' AND c.expires_at BETWEEN CURDATE() AND CURDATE() + INTERVAL 90 DAY
    UNION ALL
    SELECT 'lama', id, certificate_no, expires_at, status, NULL, NULL, factory_name FROM legacy_certificates
     WHERE status<>'dicabut' AND expires_at BETWEEN CURDATE() AND CURDATE() + INTERVAL 90 DAY
    ORDER BY expires_at`);
  const today = new Date(`${todayJkt()}T00:00:00Z`);
  return rows.map((r) => ({ ...r, days_left: Math.round((new Date(`${String(r.expires_at).slice(0, 10)}T00:00:00Z`) - today) / 86400000) }));
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const [w, p] = scope(req.user);
    const months = [3, 6, 12].includes(+req.query.months) ? +req.query.months : 6;
    const apps = await listApps(w, p);
    const by = (k) => apps.filter((a) => a.condition === k || a.status === k).length;
    const running = apps.filter((a) => ['aktif', 'aksi'].includes(a.status));
    const group = (a) => (a.service_code === 'SP' ? 'SP' : a.service_code === 'KAL' ? 'Kalibrasi' : 'Lab');
    const perGroup = {};
    running.forEach((a) => { perGroup[group(a)] = (perGroup[group(a)] || 0) + 1; });
    const perService = await q(`SELECT s.code, s.name, COUNT(a.id) total FROM services s LEFT JOIN applications a ON a.service_id=s.id
      WHERE s.bidang IS NOT NULL ${req.user.role === 'superadmin' ? '' : 'AND s.bidang=?'} GROUP BY s.id ORDER BY s.sort_order`, req.user.role === 'superadmin' ? [] : [req.user.bidang]);
    const perMonth = await q(`SELECT DATE_FORMAT(a.created_at,'%Y-%m') ym, COUNT(*) total FROM applications a JOIN services s ON s.id=a.service_id
      WHERE ${w} AND a.created_at >= DATE_SUB(DATE_FORMAT(CURDATE(),'%Y-%m-01'), INTERVAL ${months - 1} MONTH) GROUP BY ym ORDER BY ym`, p);
    const fnd = await q(`SELECT COUNT(*) n, MIN(f.due_date) nearest FROM findings f JOIN applications a ON a.id=f.application_id JOIN services s ON s.id=a.service_id
      WHERE ${w} AND a.status IN ('aktif','aksi') AND f.status<>'ditutup' AND f.category<>'observasi'`, p);
    const sv = await q(`SELECT ROUND(AVG(x.score),2) avg, COUNT(DISTINCT r.id) n FROM survey_responses r JOIN survey_answers x ON x.response_id=r.id
      JOIN applications a ON a.id=r.application_id JOIN services s ON s.id=a.service_id WHERE ${w}`, p);
    res.json({
      stats: {
        aktif: apps.filter((x) => x.status === 'aktif' && x.condition !== 'Action Required').length, aksi: by('Action Required'), payment: by('Waiting for Payment'), selesai: by('selesai'), total: apps.length,
        running: running.length, per_group: perGroup,
        findings_open: +fnd[0].n, findings_nearest: fnd[0].nearest,
        survey_avg: sv[0].avg === null ? null : +sv[0].avg, survey_n: +sv[0].n,
      },
      need_action: apps.filter(needsPsu),
      // melewati target SLA tahap (hanya saat ditangani PSU), terlama di atas
      sla_late: apps.filter((a) => a.sla?.late).sort((a, b) => b.sla.over - a.sla.over),
      cert_expiring: await expiringCerts(req.user),
      per_service: perService, per_month: perMonth, months,
    });
  } catch (e) { next(e); }
});

router.get('/applications', async (req, res, next) => {
  try {
    const [w, p] = scope(req.user);
    let where = w; const params = [...p];
    if (req.query.service) { where += ' AND s.code=?'; params.push(req.query.service); }
    if (req.query.q) { where += ' AND (a.application_no LIKE ? OR a.tracking_code LIKE ? OR u.company_name LIKE ? OR a.product_label LIKE ?)'; params.push(...Array(4).fill(`%${req.query.q}%`)); }
    const rows = await listApps(where, params);
    // filter kondisi memakai kondisi yang tampil di layar (mis. Action Required juga karena temuan terbuka)
    const c = req.query.condition;
    res.json(!c ? rows : rows.filter((r) => (c === 'berjalan' ? ['aktif', 'aksi'].includes(r.status) : r.condition === c)));
  } catch (e) { next(e); }
});

router.get('/applications/:id', async (req, res, next) => {
  try { res.json(await detail(await handledApp(req), 'admin')); } catch (e) { next(e); }
});

const fresh = async (app) => detail(await wf.loadApp(app.id), 'admin');

/**
 * Aksi admin: action = setujui | minta_tindakan | abaikan | tolak
 * body: note, internal ("1"), certificate_no, issued_at & expires_at (tahap sertifikat; berakhir wajib untuk SP), doc_name (nama lampiran)
 * file: certificate (PDF, tahap sertifikat), attachments[] (lampiran untuk pelanggan, maks. 5)
 * "abaikan" + lampiran = kirim file tanpa mengubah status.
 */
router.post('/applications/:id/action', upload.fields([{ name: 'certificate', maxCount: 1 }, { name: 'attachments', maxCount: 5 }]), async (req, res, next) => {
  try {
    const app = await handledApp(req);
    wf.assertStep(app, req.body.step);
    const { action, note } = req.body;
    const internal = req.body.internal === '1' || req.body.internal === true;
    const opts = { files: req.files?.attachments || [], docName: (req.body.doc_name || '').trim() || undefined };
    if (action === 'setujui') await wf.approve(app, req.user, { ...opts, note, internal, certificateNo: String(req.body.certificate_no || '').trim().slice(0, 60), certFile: req.files?.certificate?.[0]?.filename,
      issuedAt: String(req.body.issued_at || '').trim() || undefined, expiresAt: String(req.body.expires_at || '').trim() || undefined });
    else if (action === 'minta_tindakan') await wf.requestAction(app, req.user, note, opts);
    else if (action === 'abaikan') await wf.ignore(app, req.user, note, internal, opts);
    else if (action === 'tolak') await wf.reject(app, req.user, note, opts);
    else return res.status(400).json({ message: 'Aksi tidak dikenal.' });
    res.json(await fresh(app));
  } catch (e) { next(e); }
});

/**
 * Terbitkan / perbarui invoice. body (JSON): items [{label, method, qty, unit, price}] (pekerjaan SP/Kalibrasi, atau pekerjaan/biaya tambahan lab),
 * custom_prices {paramId: harga} (parameter lainnya lab), with_pph23 (bool), due_date, note.
 */
router.post('/applications/:id/invoice', async (req, res, next) => {
  try {
    const app = await handledApp(req);
    const b = req.body || {};
    wf.assertStep(app, b.step);
    await wf.issueInvoice(app, req.user, { items: b.items, customPrices: b.custom_prices || {}, withPph23: !!b.with_pph23, dueDate: b.due_date, note: b.note });
    res.json(await fresh(app));
  } catch (e) { next(e); }
});

/** Data awal form invoice: uraian pekerjaan bawaan + jatuh tempo default. */
router.get('/applications/:id/invoice-draft', async (req, res, next) => {
  try {
    const app = await handledApp(req);
    res.json(await invoiceDraft(app));
  } catch (e) { next(e); }
});

/** Verifikasi bukti bayar. body: valid (true/false), note */
router.post('/applications/:id/payment/verify', async (req, res, next) => {
  try {
    const app = await handledApp(req);
    wf.assertStep(app, req.body.step);
    await wf.verifyPayment(app, req.user, req.body.valid !== false && req.body.valid !== 'false', req.body.note);
    res.json(await fresh(app));
  } catch (e) { next(e); }
});

/** Temuan audit (SP). body: report_date, items [{category, description, due_date?}] */
router.post('/applications/:id/findings', async (req, res, next) => {
  try {
    const app = await handledApp(req);
    await wf.addFindings(app, req.user, { reportDate: req.body.report_date, items: req.body.items });
    res.json(await fresh(app));
  } catch (e) { next(e); }
});

/** op: tutup | ulang | ubah | perpanjang_setuju | perpanjang_tolak */
router.patch('/applications/:id/findings/:fid', async (req, res, next) => {
  try {
    const app = await handledApp(req);
    await wf.adminFinding(app, req.user, +req.params.fid, { op: req.body.op, note: req.body.note, dueDate: req.body.due_date, description: req.body.description });
    res.json(await fresh(app));
  } catch (e) { next(e); }
});

/** Info pengujian laboratorium (SP ST-06): lab, estimasi, tautan / file LHU. */
router.post('/applications/:id/lab-info', upload.array('lhu', 3), async (req, res, next) => {
  try {
    const app = await handledApp(req);
    await wf.updateLabInfo(app, req.user, { labName: req.body.lab_name, labEstimate: req.body.lab_estimate, labLink: req.body.lab_link, files: req.files });
    res.json(await fresh(app));
  } catch (e) { next(e); }
});

/** Lab pengujian: kode / identitas sampel diisi Admin saat sampel diregistrasi. body: code */
router.post('/applications/:id/sample-code', async (req, res, next) => {
  try {
    const app = await handledApp(req);
    if (!['KIM', 'FIS', 'MIK'].includes(app.service_code)) return res.status(400).json({ message: 'Kode sampel hanya untuk pengujian laboratorium.' });
    const code = String(req.body.code || '').trim().slice(0, 120);
    await q("DELETE FROM application_details WHERE application_id=? AND field_key='kode_sampel'", [app.id]);
    if (code) await q("INSERT INTO application_details (application_id, field_key, field_label, field_value) VALUES (?,'kode_sampel','Kode Sampel',?)", [app.id, code]);
    res.json(await fresh(app));
  } catch (e) { next(e); }
});

/**
 * Super Admin: unduh semua berkas pengajuan (ZIP). Untuk SP di tahap 3, jika pembayaran sudah terverifikasi,
 * tahap 3 otomatis selesai dan lanjut ke tahap 4.
 */
router.get('/applications/:id/documents-zip', allow('superadmin'), async (req, res, next) => {
  try {
    const app = await handledApp(req);
    const docs = await q('SELECT * FROM documents WHERE application_id=? ORDER BY id', [app.id]);
    const pays = await q('SELECT * FROM payments WHERE application_id=? ORDER BY id', [app.id]);
    const files = [];
    const used = new Set();
    const uniq = (n) => { let x = n, i = 2; while (used.has(x)) x = n.replace(/(\.[^.]*)?$/, `-${i++}$1`); used.add(x); return x; };
    for (const d of docs) files.push([d.file_path, uniq(`${d.source === 'admin' ? 'dari-PSU' : 'pelanggan'}/${d.doc_type.replace(/[\\/:*?"<>|]/g, '-')} - ${d.original_name}`)]);
    for (const p of pays) {
      if (p.invoice_file) files.push([p.invoice_file, uniq(`pembayaran/invoice-${p.invoice_no.replace(/[\\/]/g, '-')}${path.extname(p.invoice_file)}`)]);
      if (p.proof_path) files.push([p.proof_path, uniq(`pembayaran/bukti-bayar-${p.invoice_no.replace(/[\\/]/g, '-')}${path.extname(p.proof_path)}`)]);
    }
    const existing = [];
    for (const [f, name] of files) { const s = await storage.stream(f); if (s) existing.push([s, name]); }
    if (!existing.length) return res.status(404).json({ message: 'Belum ada berkas untuk diunduh.' });

    await q('UPDATE applications SET docs_downloaded_at=NOW(3) WHERE id=?', [app.id]);
    await wf.addLog(app, 'unduh', `Super Admin mengunduh semua berkas (${existing.length} file).`, req.user, false);
    await wf.tryAutoAdvance(app);

    const zip = archiver('zip', { zlib: { level: 6 } });
    zip.on('error', next);
    for (const [s, name] of existing) zip.append(s, { name });
    zip.finalize();
    await storage.sendLarge(res, zip, `berkas-${app.application_no}.zip`, 'application/zip');
  } catch (e) { next(e); }
});

router.patch('/applications/:id/parameters/:pid', async (req, res, next) => {
  try {
    const app = await handledApp(req);
    await wf.updateParameter(app, req.user, +req.params.pid, req.body.status);
    res.json(await detail(await wf.loadApp(app.id), 'admin'));
  } catch (e) { next(e); }
});

router.get('/applications/:id/documents/:docId', async (req, res, next) => {
  try {
    const app = await handledApp(req);
    const doc = await one('SELECT * FROM documents WHERE id=? AND application_id=?', [req.params.docId, app.id]);
    if (!doc) return res.status(404).json({ message: 'Dokumen tidak ditemukan.' });
    await storage.send(res, doc.file_path, doc.original_name);
  } catch (e) { next(e); }
});

router.get('/applications/:id/invoice', async (req, res, next) => {
  try {
    const app = await handledApp(req);
    await sendInvoicePdf(app, res);
  } catch (e) { next(e); }
});

router.get('/applications/:id/certificate', async (req, res, next) => {
  try {
    const app = await handledApp(req);
    const cert = await one('SELECT * FROM certificates WHERE application_id=?', [app.id]);
    if (!cert?.file_path) return res.status(404).json({ message: 'File belum ada.' });
    await storage.send(res, cert.file_path, `${cert.certificate_no.replace(/[\/\\]/g, '-')}.pdf`);
  } catch (e) { next(e); }
});

router.get('/applications/:id/payment-proof', async (req, res, next) => {
  try {
    const app = await handledApp(req);
    const pay = await one('SELECT * FROM payments WHERE application_id=? ORDER BY id DESC LIMIT 1', [app.id]);
    if (!pay?.proof_path) return res.status(404).json({ message: 'Bukti bayar belum ada.' });
    await storage.send(res, pay.proof_path, `bukti-bayar-${app.application_no}${path.extname(pay.proof_path)}`);
  } catch (e) { next(e); }
});

module.exports = router;
