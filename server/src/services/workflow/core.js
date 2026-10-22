/** Inti alur status: data pengajuan & tahapan, kondisi, riwayat, notifikasi, dan pemeriksaan hak/tahap. */
const { q, one } = require('../../config/db');
const { sendMail, appUrl } = require('../../utils/mailer');
const { notifyCustomer } = require('../notifications');

const httpError = (status, message) => Object.assign(new Error(message), { status });
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
/** '2026-12-17' -> '17 Des 2026' */
const tgl = (d) => { if (!d) return '-'; const [y, m, dd] = String(d).slice(0, 10).split('-'); return `${+dd} ${BLN[+m - 1]} ${y}`; };
const rupiah = (n) => `Rp${Number(n || 0).toLocaleString('id-ID')}`;
const OPEN_FINDINGS = `(SELECT COUNT(*) FROM findings f WHERE f.application_id=a.id AND f.category<>'observasi' AND f.status<>'ditutup')`;
/** Sejak kapan tahap ini ditangani PSU: tahap dimulai, atau terakhir kali pelanggan menanggapi / mengunggah bukti bayar. */
const STEP_SINCE = `(SELECT MAX(l.created_at) FROM status_logs l WHERE l.application_id=a.id AND l.step_order=a.current_step_order
  AND l.action IN ('buat','mulai','tanggapan','bayar','tagihan'))`;
/** Status tahap akhir Invoice & Faktur (null bila pengajuan belum sampai tahap itu). */
const BILLING_COLS = `bl.sent_at AS billing_sent, bl.pay_status AS billing_pay, bl.cut_status AS billing_cut`;
const BILLING_JOIN = 'LEFT JOIN billings bl ON bl.application_id=a.id';

/** Tahapan layanan; flow '1B' = alur khusus skema Tipe 1b (jika layanan memilikinya), selain itu alur utama. */
async function getSteps(serviceId, flow = '') {
  if (flow) {
    const rows = await q('SELECT * FROM service_steps WHERE service_id=? AND flow=? ORDER BY step_order', [serviceId, flow]);
    if (rows.length) return rows;
  }
  return q("SELECT * FROM service_steps WHERE service_id=? AND flow='' ORDER BY step_order", [serviceId]);
}
/** Alur tahapan untuk pengajuan baru: SP skema Tipe 1b memakai alur 1B bila sudah disiapkan. */
async function flowFor(serviceId, serviceCode, scheme) {
  if (serviceCode !== 'SP' || !/1b/i.test(scheme || '')) return '';
  return (await one("SELECT id FROM service_steps WHERE service_id=? AND flow='1B' LIMIT 1", [serviceId])) ? '1B' : '';
}
/** Pengajuan Tipe 1b: tanpa audit & temuan (tahap 5 Sampling). */
const is1BFlow = (app) => app.flow === '1B';

async function loadApp(id) {
  const app = await one(
    `SELECT a.*, s.code AS service_code, s.name AS service_name, s.bidang AS service_bidang, s.est_text AS service_est,
            u.email AS user_email, u.name AS user_name, u.company_name, ${OPEN_FINDINGS} AS open_findings, ${STEP_SINCE} AS step_since, ${BILLING_COLS}
       FROM applications a JOIN services s ON s.id=a.service_id JOIN users u ON u.id=a.user_id ${BILLING_JOIN}
      WHERE a.id=?`, [id]);
  if (!app) throw httpError(404, 'Pengajuan tidak ditemukan.');
  app.steps = await getSteps(app.service_id, app.flow);
  return app;
}

const picLabel = (u) => (u.role === 'superadmin' ? 'Super Admin PSU' : u.role === 'admin' ? `${u.name} · ${u.jabatan || 'Admin'}` : 'Pelanggan');
const stepOf = (app, order = app.current_step_order) => app.steps.find((s) => s.step_order === order);
const isLabTesting = (app) => ['KIM', 'FIS', 'MIK'].includes(app.service_code);
const docWord = (app) => (isLabTesting(app) ? 'LHU' : 'Sertifikat');
/** Pekerjaan selesai (sertifikat/LHU terbit): status selesai, atau sedang di tahap akhir Invoice & Faktur. */
const workDone = (app) => app.status === 'selesai' || !!stepOf(app)?.is_billing_step;
/** Skema pembayaran efektif: pengajuan lama tanpa skema dianggap Full di Awal. */
const schemeOf = (app) => app.payment_scheme || 'full';
const SCHEME_LABEL = { full: 'Full di Awal', '5050': '50 : 50', akhir: 'Full di Akhir' };
/** Bukti bayar akhir sudah beres (atau memang tidak perlu): sertifikat/LHU boleh diunduh pelanggan. */
const finalPaid = (app) => !app.billing_pay || ['disetujui', 'tidak_perlu'].includes(app.billing_pay);

/** Admin hanya boleh menangani pengajuan di bidangnya; Super Admin semua bidang. */
function assertCanHandle(user, app) {
  if (user.role === 'superadmin') return;
  if (user.role === 'admin' && user.bidang === app.service_bidang) return;
  throw httpError(403, 'Pengajuan ini bukan bidang Anda.');
}
const assertOpen = (app) => {
  if (!['aktif', 'aksi'].includes(app.status)) throw httpError(400, app.status === 'batal' ? 'Pengajuan ini sudah dibatalkan pelanggan.' : 'Pengajuan ini sudah ditutup atau selesai.');
};

/**
 * Cegah aksi ganda: halaman Admin mengirim nomor tahap yang sedang dilihat. Jika tahap sudah berubah
 * (diproses Admin lain / tab lain), aksi ditolak agar tahap tidak ikut terlewati.
 */
const assertStep = (app, seen) => {
  if (seen === undefined || seen === null || seen === '') return;
  if (+seen !== app.current_step_order) throw httpError(409, 'Tahap pengajuan ini baru saja diperbarui oleh pengguna lain. Halaman dimuat ulang, silakan periksa lagi.');
};

async function addLog(app, action, note, user, visible = true, order = app.current_step_order) {
  const st = stepOf(app, order);
  const r = await q(
    `INSERT INTO status_logs (application_id, step_order, status_code, step_name, action, note, customer_visible, pic_user_id, pic_label)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [app.id, order, st.status_code, st.name, action, note || null, visible ? 1 : 0, user ? user.id : null, user ? picLabel(user) : 'Sistem']);
  return r.insertId;
}

/** Simpan file unggahan sebagai dokumen pengajuan (lampiran tahap, bukti perbaikan, dll.). */
async function saveDocs(app, user, files, { docName, logId = null, findingId = null, visible = true } = {}) {
  for (const f of files || []) {
    await q(`INSERT INTO documents (application_id, doc_type, original_name, file_path, source, step_order, log_id, finding_id, customer_visible, uploaded_by)
      VALUES (?,?,?,?,?,?,?,?,?,?)`, [app.id, docName || (user?.role === 'user' ? 'Dokumen Pelanggan' : 'Lampiran dari PSU'), f.originalname, f.filename,
      user?.role === 'user' ? 'pelanggan' : 'admin', app.current_step_order, logId, findingId, visible ? 1 : 0, user ? user.id : null]);
  }
}

/** Kabari pelanggan: notifikasi di aplikasi + email. */
async function notify(app, subject, body, attachments) {
  await notifyCustomer(app, subject, `${app.application_no} · ${String(body).split('\n')[0]}`);
  return sendMail(app.user_email, `[SILAPP] ${subject} · ${app.application_no}`,
    `Yth. ${app.user_name} (${app.company_name || '-'}),\n\n${body}\n\nNomor pengajuan : ${app.application_no}\nKode lacak      : ${app.tracking_code}\nBuka SILAPP     : ${appUrl()}/klien/pengajuan/${app.id}\n\nHormat kami,\nPT Penilai Standar Uji`,
    attachments);
}

/** Apakah tahap kondisional dilewati: ST-07 tanpa ketidaksesuaian, KAL-09 untuk on-site. */
function isSkipped(app, step) {
  if (!step.is_optional) return false;
  if (app.service_code === 'SP') return !app.nc_flag;
  if (app.service_code === 'KAL') return app.location === 'onsite';
  return false;
}

/** Kondisi yang tampil ke pelanggan (warna status sesuai dokumen rancangan). */
function condition(app) {
  const st = stepOf(app);
  if (app.status === 'selesai') return app.service_code === 'SP' ? 'Certified' : 'Completed';
  if (app.status === 'ditolak') return 'Closed';
  if (app.status === 'batal') return 'Cancelled';
  if (app.status === 'aksi' || app.open_findings > 0) return 'Action Required';
  if (st.is_payment_step && ['invoice', 'menunggu'].includes(app.payment_status)) return 'Waiting for Payment';
  // tahap akhir: menunggu pelunasan selama bukti bayar belum disetujui
  if (st.is_billing_step) return app.billing_sent && !finalPaid(app) ? 'Waiting for Payment' : 'On Progress';
  if (app.service_code === 'KAL' && st.status_code === 'KAL-09') return 'Ready for Collection';
  if (app.service_code === 'KAL' && app.location === 'onsite' && ['KAL-04', 'KAL-05'].includes(st.status_code)) return 'On-Site Calibration';
  if (isLabTesting(app) && st.status_code === 'LAB-02') return 'Waiting for Sample';
  if (app.service_code === 'SP' && st.status_code === 'ST-04') return 'Scheduling';
  return 'On Progress';
}

async function setStep(app, order, user) {
  const r = await q('UPDATE applications SET current_step_order=?, status=?, action_note=NULL WHERE id=? AND current_step_order=?', [order, 'aktif', app.id, app.current_step_order]);
  if (!r.affectedRows) throw httpError(409, 'Tahap pengajuan ini baru saja diperbarui oleh pengguna lain. Halaman dimuat ulang, silakan periksa lagi.');
  app.current_step_order = order;
  await addLog(app, 'mulai', 'Tahap dimulai.', user);
}

module.exports = { httpError, BLN, tgl, rupiah, OPEN_FINDINGS, STEP_SINCE, BILLING_COLS, BILLING_JOIN, workDone, schemeOf, SCHEME_LABEL, finalPaid, getSteps, flowFor, is1BFlow, loadApp, picLabel, stepOf, isLabTesting, docWord, assertCanHandle, assertOpen, assertStep, addLog, saveDocs, notify, isSkipped, condition, setStep };
