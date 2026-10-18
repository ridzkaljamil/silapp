/**
 * Data sertifikat Sertifikasi Produk untuk Directory publik:
 * sertifikat yang terbit lewat SILAPP + proyek sebelum SILAPP (diinput manual Admin).
 * Akses: Super Admin dan Admin bidang Sertifikasi Produk.
 *
 * Setiap perubahan dicatat di riwayat sertifikat. Mengubah status menjadi Ditangguhkan/Dicabut wajib disertai alasan;
 * untuk sertifikat SILAPP, pelanggan dikabari lewat notifikasi dan email.
 */
const router = require('express').Router();
const { q, one } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { CERT_STATUS, certState, checkDates } = require('../utils/certificate');
const { logCert, history } = require('../services/certificates');

router.use(requireAuth, (req, res, next) =>
  req.user.role === 'superadmin' || (req.user.role === 'admin' && req.user.bidang === 'SP') ? next() : res.status(403).json({ message: 'Khusus Admin Sertifikasi Produk.' }));

/** Daftar sertifikat SILAPP (SP) dalam format kolom Directory. */
const SILAPP_SQL = `SELECT c.id, 'silapp' source, c.certificate_no, c.issued_at, c.expires_at, c.status, c.show_in_directory, a.id application_id, a.application_no,
    COALESCE((SELECT field_value FROM application_details d WHERE d.application_id=a.id AND d.field_key='nama_pabrik' LIMIT 1), u.company_name) factory_name,
    COALESCE((SELECT field_value FROM application_details d WHERE d.application_id=a.id AND d.field_key='kota_provinsi' LIMIT 1), '-') factory_address,
    COALESCE(p.name, a.product_label) product, COALESCE(p.standard_no, '-') sni_no
  FROM certificates c JOIN applications a ON a.id=c.application_id JOIN services s ON s.id=a.service_id JOIN users u ON u.id=a.user_id
  LEFT JOIN products p ON p.id=a.product_id WHERE s.code='SP' AND a.status='selesai'`;
const LEGACY_SQL = `SELECT id, 'lama' source, certificate_no, issued_at, expires_at, status, show_in_directory, factory_name, factory_address, product, sni_no FROM legacy_certificates`;

router.get('/', async (req, res, next) => {
  try {
    const rows = [...(await q(SILAPP_SQL)), ...(await q(LEGACY_SQL))];
    res.json(rows.map((r) => ({ ...r, show_in_directory: !!r.show_in_directory, state: certState(r) }))
      .sort((a, b) => String(b.issued_at).localeCompare(String(a.issued_at))));
  } catch (e) { next(e); }
});

/** Riwayat satu sertifikat. */
router.get('/:source/:id/history', async (req, res, next) => {
  const source = { silapp: 'silapp', legacy: 'lama' }[req.params.source];
  if (!source) return res.status(404).json({ message: 'Sumber sertifikat tidak dikenal.' });
  try { res.json(await history(source, +req.params.id || 0)); } catch (e) { next(e); }
});

const status = (v) => (CERT_STATUS.includes(v) ? v : 'aktif');
const LABEL = { aktif: 'Aktif', ditangguhkan: 'Ditangguhkan', dicabut: 'Dicabut' };
const ymd = (v) => (v ? String(v).slice(0, 10) : '');
const showFlag = (v, prev = 1) => (v === undefined ? prev : v === false || v === 0 || v === '0' ? 0 : 1);

/**
 * Validasi perubahan status: Ditangguhkan/Dicabut wajib beralasan (minimal 5 karakter).
 * Mengembalikan [alasan, pesan error].
 */
function checkReason(prevStatus, nextStatus, reason) {
  const r = String(reason || '').trim().slice(0, 2000);
  if (nextStatus !== prevStatus && nextStatus !== 'aktif' && r.length < 5) {
    return [null, `Alasan ${LABEL[nextStatus].toLowerCase()} wajib diisi (minimal 5 karakter).`];
  }
  return [r];
}

/** Catat perbedaan data lama vs baru di riwayat. */
async function logChanges(source, before, after, reason, user) {
  const cert = { id: before.id, certificate_no: after.certificate_no || before.certificate_no };
  if (after.status !== before.status) {
    await logCert(source, cert, 'status', { status: after.status, note: reason || (after.status === 'aktif' ? 'Diaktifkan kembali.' : null), user });
  }
  const changes = [];
  if (ymd(after.issued_at) !== ymd(before.issued_at)) changes.push(`terbit ${ymd(before.issued_at)} → ${ymd(after.issued_at)}`);
  if (ymd(after.expires_at) !== ymd(before.expires_at)) changes.push(`berakhir ${ymd(before.expires_at) || '-'} → ${ymd(after.expires_at)}`);
  if (after.certificate_no && after.certificate_no !== before.certificate_no) changes.push(`nomor ${before.certificate_no} → ${after.certificate_no}`);
  if (changes.length) await logCert(source, cert, 'ubah', { note: `Tanggal/data diubah: ${changes.join('; ')}.`, user });
  if (!!after.show_in_directory !== !!before.show_in_directory) {
    await logCert(source, cert, 'tampil', { note: after.show_in_directory ? 'Ditampilkan di Directory.' : 'Disembunyikan dari Directory.', user });
  }
}

function body(b) {
  const keys = ['factory_name', 'factory_address', 'product', 'sni_no', 'certificate_no', 'issued_at', 'expires_at'];
  for (const k of keys) if (!String(b[k] || '').trim()) return [null, 'Semua kolom wajib diisi.'];
  const err = checkDates(b.issued_at, b.expires_at);
  if (err) return [null, err];
  return [Object.fromEntries(keys.map((k) => [k, String(b[k]).trim()]))];
}
const dupNo = async (no, id = 0) => (await one('SELECT id FROM legacy_certificates WHERE certificate_no=? AND id<>?', [no, id])) || (await one('SELECT id FROM certificates WHERE certificate_no=?', [no]));

router.post('/legacy', async (req, res, next) => {
  try {
    const [v, err] = body(req.body);
    if (err) return res.status(400).json({ message: err });
    const st = status(req.body.status);
    const [reason, rErr] = checkReason('aktif', st, req.body.reason);
    if (rErr) return res.status(400).json({ message: rErr });
    if (await dupNo(v.certificate_no)) return res.status(409).json({ message: 'Nomor sertifikat sudah ada.' });
    const show = showFlag(req.body.show_in_directory);
    const r = await q(`INSERT INTO legacy_certificates (factory_name, factory_address, product, sni_no, certificate_no, issued_at, expires_at, status, show_in_directory, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?)`, [v.factory_name, v.factory_address, v.product, v.sni_no, v.certificate_no, v.issued_at, v.expires_at, st, show, req.user.id]);
    const cert = { id: r.insertId, certificate_no: v.certificate_no };
    await logCert('lama', cert, 'terbit', { status: st, note: `Data proyek sebelum SILAPP ditambahkan (terbit ${v.issued_at}, berlaku sampai ${v.expires_at}).`, user: req.user });
    if (st !== 'aktif') await logCert('lama', cert, 'status', { status: st, note: reason, user: req.user });
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) { next(e); }
});

router.put('/legacy/:id', async (req, res, next) => {
  try {
    const before = await one('SELECT * FROM legacy_certificates WHERE id=?', [req.params.id]);
    if (!before) return res.status(404).json({ message: 'Data sertifikat tidak ditemukan.' });
    const [v, err] = body(req.body);
    if (err) return res.status(400).json({ message: err });
    const st = status(req.body.status);
    const [reason, rErr] = checkReason(before.status, st, req.body.reason);
    if (rErr) return res.status(400).json({ message: rErr });
    if (await dupNo(v.certificate_no, before.id)) return res.status(409).json({ message: 'Nomor sertifikat sudah ada.' });
    const show = showFlag(req.body.show_in_directory, before.show_in_directory);
    await q(`UPDATE legacy_certificates SET factory_name=?, factory_address=?, product=?, sni_no=?, certificate_no=?, issued_at=?, expires_at=?, status=?, show_in_directory=? WHERE id=?`,
      [v.factory_name, v.factory_address, v.product, v.sni_no, v.certificate_no, v.issued_at, v.expires_at, st, show, before.id]);
    await logChanges('lama', before, { ...v, status: st, show_in_directory: show }, reason, req.user);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/legacy/:id', async (req, res, next) => {
  try {
    await q('DELETE FROM legacy_certificates WHERE id=?', [req.params.id]);
    await q("DELETE FROM certificate_logs WHERE source='lama' AND cert_id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/** Ubah sertifikat SILAPP: tanggal terbit, tanggal berakhir, status, tampil di Directory. Nomor & file mengikuti pengajuannya. */
router.put('/silapp/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const before = await one('SELECT * FROM certificates WHERE id=?', [req.params.id]);
    if (!before) return res.status(404).json({ message: 'Sertifikat tidak ditemukan.' });
    const err = checkDates(b.issued_at, b.expires_at);
    if (err) return res.status(400).json({ message: err });
    const st = status(b.status);
    const [reason, rErr] = checkReason(before.status, st, b.reason);
    if (rErr) return res.status(400).json({ message: rErr });
    const show = showFlag(b.show_in_directory, before.show_in_directory);
    await q('UPDATE certificates SET issued_at=?, expires_at=?, status=?, show_in_directory=? WHERE id=?', [b.issued_at, b.expires_at, st, show, before.id]);
    await logChanges('silapp', before, { issued_at: b.issued_at, expires_at: b.expires_at, status: st, show_in_directory: show }, reason, req.user);
    if (st !== before.status) await tellCustomer(before, st, reason);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/** Kabari pemilik sertifikat SILAPP bahwa status sertifikatnya berubah. */
async function tellCustomer(cert, st, reason) {
  const { loadApp, notify } = require('../services/workflow');
  const app = await loadApp(cert.application_id);
  if (!app) return;
  const text = {
    ditangguhkan: `Sertifikat ${cert.certificate_no} DITANGGUHKAN (dibekukan sementara) oleh PSU.`,
    dicabut: `Sertifikat ${cert.certificate_no} DICABUT dan tidak berlaku lagi. File sertifikat tidak dapat diunduh lagi melalui SILAPP.`,
    aktif: `Sertifikat ${cert.certificate_no} kembali AKTIF.`,
  }[st];
  await notify(app, `Status sertifikat: ${LABEL[st]}`, `${text}${reason && st !== 'aktif' ? `\n\nAlasan: ${reason}` : ''}\n\nUntuk informasi lebih lanjut, silakan hubungi PSU.`);
}

module.exports = { router, SILAPP_SQL };
