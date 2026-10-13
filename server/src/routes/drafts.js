/** Draft Ajukan Layanan: satu draft per pelanggan, disimpan di server agar bisa dilanjutkan dari perangkat lain. */
const router = require('express').Router();
const { q, one } = require('../config/db');
const { requireAuth, allow } = require('../middleware/auth');

router.use(requireAuth, allow('user'));

router.get('/', async (req, res, next) => {
  try {
    const d = await one(`SELECT d.service_code, d.stage, d.payload, d.updated_at, s.name service_name
      FROM drafts d LEFT JOIN services s ON s.code=d.service_code WHERE d.user_id=?`, [req.user.id]);
    if (!d) return res.json(null);
    let payload = {};
    try { payload = JSON.parse(d.payload); } catch { /* draft rusak: kosongkan */ }
    res.json({ ...d, payload });
  } catch (e) { next(e); }
});

router.put('/', async (req, res, next) => {
  try {
    const code = String(req.body.service_code || '').slice(0, 10);
    if (!code) return res.status(400).json({ message: 'Pilih layanan terlebih dahulu.' });
    const payload = JSON.stringify(req.body.payload || {});
    if (payload.length > 200000) return res.status(400).json({ message: 'Draft terlalu besar.' });
    const stage = Math.min(4, Math.max(1, +req.body.stage || 1));
    await q(`INSERT INTO drafts (user_id, service_code, stage, payload) VALUES (?,?,?,?)
      ON DUPLICATE KEY UPDATE service_code=VALUES(service_code), stage=VALUES(stage), payload=VALUES(payload), updated_at=NOW()`, [req.user.id, code, stage, payload]);
    res.json({ ok: true, updated_at: new Date() });
  } catch (e) { next(e); }
});

router.delete('/', async (req, res, next) => {
  try { await q('DELETE FROM drafts WHERE user_id=?', [req.user.id]); res.json({ ok: true }); } catch (e) { next(e); }
});

module.exports = router;
