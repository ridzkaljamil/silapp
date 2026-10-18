/** Log Email (Super Admin): semua email yang dikirim SILAPP, status pengirimannya, dan kirim ulang yang gagal. */
const router = require('express').Router();
const { q } = require('../../config/db');
const { resend, smtpReady, MAX_ATTEMPTS, RETRY_DAYS } = require('../../utils/mailer');

router.get('/emails', async (req, res, next) => {
  try {
    const rows = await q(`SELECT id, to_addr, subject, status, attempts, last_error, created_at, sent_at, body IS NOT NULL can_resend,
        attachments IS NOT NULL has_attachment
      FROM email_outbox ORDER BY id DESC LIMIT 1000`);
    const counts = await q('SELECT status, COUNT(*) n FROM email_outbox GROUP BY status');
    res.json({
      rows: rows.map((r) => ({ ...r, can_resend: !!r.can_resend && r.status !== 'terkirim', has_attachment: !!r.has_attachment })),
      counts: Object.fromEntries(counts.map((c) => [c.status, +c.n])),
      smtp: smtpReady(), max_attempts: MAX_ATTEMPTS, retry_days: RETRY_DAYS,
    });
  } catch (e) { next(e); }
});

router.post('/emails/:id/resend', async (req, res, next) => {
  try {
    const r = await resend(+req.params.id || 0);
    if (!r.ok) return res.status(r.status).json({ message: r.message });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
