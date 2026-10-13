/** Pencarian cepat di topbar: pengajuan, layanan, dan pelanggan (pelanggan hanya untuk tim PSU). */
const router = require('express').Router();
const { q } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const term = String(req.query.q || '').trim().slice(0, 60);
    if (term.length < 2) return res.json({ groups: [] });
    const like = `%${term}%`;
    const u = req.user;
    const staff = u.role !== 'user';
    const base = staff ? '/admin' : '/klien';

    // pengajuan: Admin hanya bidangnya, pelanggan hanya miliknya sendiri
    let where = '1=1';
    const params = [];
    if (u.role === 'admin') { where = 's.bidang=?'; params.push(u.bidang); }
    if (!staff) { where = 'a.user_id=?'; params.push(u.id); }
    const apps = await q(
      `SELECT a.id, a.application_no, a.tracking_code, a.product_label, s.name service_name, uu.company_name
         FROM applications a JOIN services s ON s.id=a.service_id JOIN users uu ON uu.id=a.user_id
        WHERE ${where} AND (a.application_no LIKE ? OR a.tracking_code LIKE ? OR a.product_label LIKE ?${staff ? ' OR uu.company_name LIKE ?' : ''})
        ORDER BY a.updated_at DESC LIMIT 6`,
      [...params, like, like, like, ...(staff ? [like] : [])],
    );

    // layanan yang bisa diajukan (bukan induk "Laboratorium Pengujian")
    const svcWhere = u.role === 'admin' ? 'AND s.bidang=?' : '';
    const services = await q(
      `SELECT s.code, s.name, s.state FROM services s
        WHERE s.is_active=1 AND NOT EXISTS (SELECT 1 FROM services c WHERE c.parent_id=s.id) ${svcWhere}
          AND (s.name LIKE ? OR s.code LIKE ?) ORDER BY s.sort_order LIMIT 4`,
      [...(u.role === 'admin' ? [u.bidang] : []), like, like],
    );

    const customers = staff ? await q(
      `SELECT id, company_name, name, email FROM users
        WHERE role='user' AND (company_name LIKE ? OR name LIKE ? OR email LIKE ?) ORDER BY company_name LIMIT 4`,
      [like, like, like],
    ) : [];

    const short = (label) => String(label || '').split(' · ')[0];
    const groups = [
      { label: 'Pengajuan', items: apps.map((a) => ({
        title: a.application_no, sub: [staff && a.company_name, short(a.product_label), a.service_name].filter(Boolean).join(' · '),
        link: `${base}/pengajuan/${a.id}`,
      })) },
      { label: 'Layanan', items: services.map((s) => ({
        title: s.name, sub: s.state === 'ok' ? 'Beroperasi' : s.state === 'dev' ? 'Pengembangan' : 'Persiapan',
        link: staff ? `/admin/antrean?service=${s.code}` : '/klien/ajukan',
      })) },
      { label: 'Pelanggan', items: customers.map((c) => ({
        title: c.company_name || c.name, sub: `${c.name} · ${c.email}`,
        link: `/admin/pelanggan?q=${encodeURIComponent(c.company_name || c.email)}`,
      })) },
    ].filter((g) => g.items.length);
    res.json({ groups });
  } catch (e) { next(e); }
});

module.exports = router;
