/** Area Admin & Super Admin: antrean per bidang, aksi workflow, parameter, dashboard. */
const router = require('express').Router();
const path = require('path');
const { q, one } = require('../config/db');
const { requireAuth, allow } = require('../middleware/auth');
const { upload, UPLOAD_DIR } = require('../utils/upload');
const wf = require('../services/workflow');
const { detail } = require('../services/present');
const { listApps } = require('../services/listing');

router.use(requireAuth, allow('admin', 'superadmin'));

/** Filter bidang: Admin hanya bidangnya, Super Admin semua. */
const scope = (u) => (u.role === 'superadmin' ? ['1=1', []] : ['s.bidang=?', [u.bidang]]);

async function handledApp(req) {
  const app = await wf.loadApp(+req.params.id);
  wf.assertCanHandle(req.user, app);
  return app;
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const [w, p] = scope(req.user);
    const apps = await listApps(w, p);
    const by = (k) => apps.filter((a) => a.condition === k || a.status === k).length;
    const perService = await q(`SELECT s.code, s.name, COUNT(a.id) total FROM services s LEFT JOIN applications a ON a.service_id=s.id
      WHERE s.bidang IS NOT NULL ${req.user.role === 'superadmin' ? '' : 'AND s.bidang=?'} GROUP BY s.id ORDER BY s.sort_order`, req.user.role === 'superadmin' ? [] : [req.user.bidang]);
    const perMonth = await q(`SELECT DATE_FORMAT(a.created_at,'%Y-%m') ym, COUNT(*) total FROM applications a JOIN services s ON s.id=a.service_id
      WHERE ${w} AND a.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) GROUP BY ym ORDER BY ym`, p);
    res.json({
      stats: { aktif: by('aktif'), aksi: by('aksi'), payment: by('Waiting for Payment'), selesai: by('selesai'), total: apps.length },
      need_action: apps.filter((a) => a.status === 'aktif' && (a.current_step.code.endsWith('-01') || (a.condition === 'Waiting for Payment' && a.payment_status === 'menunggu'))),
      per_service: perService, per_month: perMonth,
    });
  } catch (e) { next(e); }
});

router.get('/applications', async (req, res, next) => {
  try {
    const [w, p] = scope(req.user);
    let where = w; const params = [...p];
    if (req.query.status) { where += ' AND a.status=?'; params.push(req.query.status); }
    if (req.query.service) { where += ' AND s.code=?'; params.push(req.query.service); }
    if (req.query.q) { where += ' AND (a.application_no LIKE ? OR u.company_name LIKE ? OR a.product_label LIKE ?)'; params.push(...Array(3).fill(`%${req.query.q}%`)); }
    res.json(await listApps(where, params));
  } catch (e) { next(e); }
});

router.get('/applications/:id', async (req, res, next) => {
  try { res.json(await detail(await handledApp(req), 'admin')); } catch (e) { next(e); }
});

/**
 * Aksi admin: action = setujui | minta_tindakan | abaikan | tolak
 * body: note, internal ("1"), certificate_no; file opsional: certificate (PDF)
 */
router.post('/applications/:id/action', upload.single('certificate'), async (req, res, next) => {
  try {
    const app = await handledApp(req);
    const { action, note } = req.body;
    const internal = req.body.internal === '1' || req.body.internal === true;
    if (action === 'setujui') await wf.approve(app, req.user, { note, internal, certificateNo: req.body.certificate_no, certFile: req.file?.filename });
    else if (action === 'minta_tindakan') await wf.requestAction(app, req.user, note);
    else if (action === 'abaikan') await wf.ignore(app, req.user, note, internal);
    else if (action === 'tolak') await wf.reject(app, req.user, note);
    else return res.status(400).json({ message: 'Aksi tidak dikenal.' });
    res.json(await detail(await wf.loadApp(app.id), 'admin'));
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
    res.download(path.join(UPLOAD_DIR, doc.file_path), doc.original_name);
  } catch (e) { next(e); }
});

router.get('/applications/:id/payment-proof', async (req, res, next) => {
  try {
    const app = await handledApp(req);
    const pay = await one('SELECT * FROM payments WHERE application_id=? ORDER BY id DESC LIMIT 1', [app.id]);
    if (!pay?.proof_path) return res.status(404).json({ message: 'Bukti bayar belum ada.' });
    res.download(path.join(UPLOAD_DIR, pay.proof_path), `bukti-bayar-${app.application_no}${path.extname(pay.proof_path)}`);
  } catch (e) { next(e); }
});

module.exports = router;
