/** Notifikasi milik pengguna yang sedang login (semua role). */
const router = require('express').Router();
const { q, one } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const items = await q('SELECT id, title, body, link, is_read, created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 30', [req.user.id]);
    const { n } = await one('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND is_read=0', [req.user.id]);
    res.json({ unread: +n, items: items.map((x) => ({ ...x, is_read: !!x.is_read })) });
  } catch (e) { next(e); }
});

router.post('/read-all', async (req, res, next) => {
  try { await q('UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0', [req.user.id]); res.json({ ok: true }); } catch (e) { next(e); }
});

router.post('/:id/read', async (req, res, next) => {
  try { await q('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [req.params.id, req.user.id]); res.json({ ok: true }); } catch (e) { next(e); }
});

module.exports = router;
