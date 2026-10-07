/**
 * Logika alur status SILAPP, sesuai Rancangan Sistem Tracking
 * LSPro (ST-01..ST-10), Laboratorium Pengujian (LAB-01..LAB-08), dan Laboratorium Kalibrasi (KAL-01..KAL-09).
 *
 * Aksi Admin di setiap tahap: setujui, minta_tindakan, abaikan, tolak (+ lampiran file).
 * Tambahan iterasi 2: invoice sebelum bayar, verifikasi bayar, temuan audit + perpanjangan,
 * tahap 3 SP otomatis selesai, info pengujian lab (ST-06), survei sebelum unduh sertifikat.
 */
const path = require('path');
const { q, one } = require('../config/db');
const { sendMail } = require('../utils/mailer');
const { UPLOAD_DIR } = require('../utils/upload');

const httpError = (status, message) => Object.assign(new Error(message), { status });
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
/** '2026-12-17' -> '17 Des 2026' */
const tgl = (d) => { if (!d) return '-'; const [y, m, dd] = String(d).slice(0, 10).split('-'); return `${+dd} ${BLN[+m - 1]} ${y}`; };
const rupiah = (n) => `Rp${Number(n || 0).toLocaleString('id-ID')}`;
const APP_URL = () => process.env.CLIENT_URL || 'http://localhost:5173';
const OPEN_FINDINGS = `(SELECT COUNT(*) FROM findings f WHERE f.application_id=a.id AND f.category<>'observasi' AND f.status<>'ditutup')`;

async function getSteps(serviceId) {
  return q('SELECT * FROM service_steps WHERE service_id=? ORDER BY step_order', [serviceId]);
}

async function loadApp(id) {
  const app = await one(
    `SELECT a.*, s.code AS service_code, s.name AS service_name, s.bidang AS service_bidang,
            u.email AS user_email, u.name AS user_name, u.company_name, ${OPEN_FINDINGS} AS open_findings
       FROM applications a JOIN services s ON s.id=a.service_id JOIN users u ON u.id=a.user_id
      WHERE a.id=?`, [id]);
  if (!app) throw httpError(404, 'Pengajuan tidak ditemukan.');
  app.steps = await getSteps(app.service_id);
  return app;
}

const picLabel = (u) => (u.role === 'superadmin' ? 'Super Admin PSU' : u.role === 'admin' ? `${u.name} · ${u.jabatan || 'Admin'}` : 'Pelanggan');
const stepOf = (app, order = app.current_step_order) => app.steps.find((s) => s.step_order === order);
const isLabTesting = (app) => ['KIM', 'FIS', 'MIK'].includes(app.service_code);
const docWord = (app) => (isLabTesting(app) ? 'LHU' : 'Sertifikat');

/** Admin hanya boleh menangani pengajuan di bidangnya; Super Admin semua bidang. */
function assertCanHandle(user, app) {
  if (user.role === 'superadmin') return;
  if (user.role === 'admin' && user.bidang === app.service_bidang) return;
  throw httpError(403, 'Pengajuan ini bukan bidang Anda.');
}
const assertOpen = (app) => {
  if (!['aktif', 'aksi'].includes(app.status)) throw httpError(400, 'Pengajuan ini sudah ditutup atau selesai.');
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
      VALUES (?,?,?,?,?,?,?,?,?,?)`, [app.id, docName || (user?.role === 'user' ? 'Dokumen pelanggan' : 'Lampiran dari PSU'), f.originalname, f.filename,
      user?.role === 'user' ? 'pelanggan' : 'admin', app.current_step_order, logId, findingId, visible ? 1 : 0, user ? user.id : null]);
  }
}

function notify(app, subject, body, attachments) {
  return sendMail(app.user_email, `[SILAPP] ${subject} · ${app.application_no}`,
    `Yth. ${app.user_name} (${app.company_name || '-'}),\n\n${body}\n\nNomor pengajuan : ${app.application_no}\nKode lacak      : ${app.tracking_code}\nBuka SILAPP     : ${APP_URL()}/klien/pengajuan/${app.id}\n\nHormat kami,\nPT Penilai Standar Uji`,
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
  if (app.status === 'aksi' || app.open_findings > 0) return 'Action Required';
  if (st.is_payment_step && ['invoice', 'menunggu'].includes(app.payment_status)) return 'Waiting for Payment';
  if (app.service_code === 'KAL' && st.status_code === 'KAL-09') return 'Ready for Collection';
  if (app.service_code === 'KAL' && app.location === 'onsite' && ['KAL-04', 'KAL-05'].includes(st.status_code)) return 'On-Site Calibration';
  if (isLabTesting(app) && st.status_code === 'LAB-03') return 'Waiting for Sample';
  if (app.service_code === 'SP' && st.status_code === 'ST-04') return 'Scheduling';
  return 'On Progress';
}

async function setStep(app, order, user) {
  await q('UPDATE applications SET current_step_order=?, status=?, action_note=NULL WHERE id=?', [order, 'aktif', app.id]);
  app.current_step_order = order;
  await addLog(app, 'mulai', 'Tahap dimulai.', user);
}

/* ------------------------- AKSI ADMIN ------------------------- */

async function approve(app, user, { note, internal, certificateNo, certFile, files, docName, auto } = {}) {
  assertOpen(app);
  const st = stepOf(app);

  if (st.is_payment_step && app.payment_status !== 'terverifikasi') {
    if (app.payment_status !== 'menunggu') throw httpError(400, app.payment_status === 'belum'
      ? 'Terbitkan invoice terlebih dahulu, lalu tunggu pelanggan mengunggah bukti bayar.'
      : 'Pelanggan belum mengunggah bukti bayar untuk invoice ini.');
    await markPaid(app, user);
  }
  if (isLabTesting(app) && st.status_code === 'LAB-05') {
    const open = await one('SELECT COUNT(*) n FROM application_parameters WHERE application_id=? AND status<>"selesai"', [app.id]);
    if (open.n > 0) throw httpError(400, `Masih ada ${open.n} parameter yang belum selesai diuji.`);
  }
  if (app.service_code === 'SP' && st.status_code === 'ST-07' && app.open_findings > 0) {
    throw httpError(400, `Masih ada ${app.open_findings} temuan mayor/minor yang belum ditutup.`);
  }
  if (st.is_certificate_step) {
    if (!certificateNo) throw httpError(400, `Nomor ${docWord(app).toLowerCase()} wajib diisi.`);
    if (!certFile) throw httpError(400, `File ${docWord(app).toLowerCase()} (PDF) wajib diunggah.`);
    const dup = await one('SELECT id FROM certificates WHERE certificate_no=?', [certificateNo]);
    if (dup) throw httpError(400, 'Nomor sertifikat sudah dipakai.');
    await q('INSERT INTO certificates (application_id, certificate_no, issued_at, file_path) VALUES (?,?,CURDATE(),?)',
      [app.id, certificateNo, certFile]);
    await addLog(app, 'terbit', `${docWord(app)} ${certificateNo} terbit.`, user);
  }
  const hidden = !!(internal && note);
  const logId = await addLog(app, 'setujui', note || (auto ? auto : 'Tahap disetujui.'), user, !hidden);
  await saveDocs(app, user, files, { docName, logId, visible: !hidden });

  // SP: temuan mayor/minor yang masih terbuka -> ST-07 Tindakan perbaikan wajib dilalui
  if (app.service_code === 'SP' && app.open_findings > 0 && !app.nc_flag) {
    await q('UPDATE applications SET nc_flag=1 WHERE id=?', [app.id]);
    app.nc_flag = 1;
  }

  // tentukan tahap berikutnya
  const last = app.steps[app.steps.length - 1].step_order;
  let next = app.current_step_order + 1;
  while (next <= last && isSkipped(app, stepOf(app, next))) next++;
  const onsiteDone = app.service_code === 'KAL' && app.location === 'onsite' && st.status_code === 'KAL-08';

  if (next > last || onsiteDone) {
    await q('UPDATE applications SET status="selesai", action_note=NULL WHERE id=?', [app.id]);
    await notifyIssued(app);
    return;
  }
  const nextStep = stepOf(app, next);
  const certIssued = app.steps.some((s) => s.is_certificate_step && s.step_order < next);
  await setStep(app, next, user);
  if (next === last && !nextStep.is_optional && certIssued && app.service_code !== 'KAL') {
    // LAB-08: LHU terbit = selesai otomatis
    await q('UPDATE applications SET status="selesai" WHERE id=?', [app.id]);
    await notifyIssued(app);
    return;
  }
  await notify(app, `Status: ${nextStep.status_code} ${nextStep.name}`,
    `Pengajuan Anda masuk tahap ${nextStep.status_code} · ${nextStep.name} (progres ${nextStep.progress_pct}%).`);
}

/** Email pertama setelah terbit: minta isi survei (mengikuti alur email SPPT SNI BSN). */
function notifyIssued(app) {
  const w = docWord(app);
  return notify(app, `${w} telah terbit`,
    `Dengan hormat, kami informasikan bahwa ${w.toLowerCase()} untuk pengajuan ${app.service_name} (${app.product_label}) telah terbit.\n\n` +
    `Untuk memperoleh dokumen ${w.toLowerCase()}, mohon terlebih dahulu mengisi Survei Kepuasan Pelanggan melalui akun SILAPP Anda:\n${APP_URL()}/klien/pengajuan/${app.id}\n\n` +
    'Catatan: survei wajib diisi untuk setiap penerbitan dokumen, termasuk bagi pelanggan yang sudah pernah mengisi survei sebelumnya.');
}

async function requestAction(app, user, note, { files, docName } = {}) {
  if (!note) throw httpError(400, 'Catatan tindakan yang diminta wajib diisi.');
  assertOpen(app);
  const st = stepOf(app);
  if (app.service_code === 'SP' && st.status_code === 'ST-06') {
    // ditemukan ketidaksesuaian hasil uji -> masuk ST-07 Tindakan perbaikan
    await addLog(app, 'setujui', 'Pengujian selesai, ditemukan ketidaksesuaian.', user);
    await q('UPDATE applications SET nc_flag=1 WHERE id=?', [app.id]);
    app.nc_flag = 1;
    await setStep(app, app.current_step_order + 1, user);
  }
  await q('UPDATE applications SET status="aksi", action_note=? WHERE id=?', [note, app.id]);
  const logId = await addLog(app, 'minta_tindakan', `Tindakan pelanggan diperlukan: ${note}`, user);
  await saveDocs(app, user, files, { docName, logId });
  await notify(app, 'Tindakan Anda diperlukan', `Mohon tindak lanjuti catatan berikut melalui akun SILAPP:\n${note}`);
}

async function ignore(app, user, note, internal, { files, docName } = {}) {
  const logId = await addLog(app, files?.length ? 'lampiran' : 'abaikan', note || (files?.length ? 'PSU melampirkan dokumen.' : 'Masih dalam proses pada tahap ini.'), user, !internal);
  await saveDocs(app, user, files, { docName, logId, visible: !internal });
  if (files?.length && !internal) await notify(app, 'Dokumen baru dari PSU', `PSU mengirimkan dokumen pada tahap ${stepOf(app).status_code} · ${stepOf(app).name}${note ? `:\n${note}` : '.'}`);
}

async function reject(app, user, note, { files, docName } = {}) {
  if (!note) throw httpError(400, 'Alasan penolakan wajib diisi.');
  await q('UPDATE applications SET status="ditolak", reject_note=? WHERE id=?', [note, app.id]);
  const logId = await addLog(app, 'tolak', `Pengajuan ditutup: ${note}`, user);
  await saveDocs(app, user, files, { docName, logId });
  await notify(app, 'Pengajuan ditutup', `Pengajuan tidak dapat dilanjutkan dengan alasan:\n${note}`);
}

async function updateParameter(app, user, paramId, status) {
  if (!['antri', 'uji', 'selesai'].includes(status)) throw httpError(400, 'Status parameter tidak valid.');
  const p = await one('SELECT * FROM application_parameters WHERE id=? AND application_id=?', [paramId, app.id]);
  if (!p) throw httpError(404, 'Parameter tidak ditemukan.');
  await q('UPDATE application_parameters SET status=?, analyst_user_id=?, updated_at=NOW() WHERE id=?', [status, user.id, paramId]);
  await addLog(app, 'parameter', `Parameter ${p.name}: ${status === 'uji' ? 'mulai diuji' : status === 'selesai' ? 'selesai diuji' : 'antrian'}.`, user);
}

/* ------------------------- INVOICE & PEMBAYARAN ------------------------- */

/**
 * Hitung tagihan. Lab: dari daftar harga (paket SNI / per parameter) × jumlah sampel,
 * parameter "Lainnya" diisi Admin. SP & Kalibrasi: nominal hasil kesepakatan diisi Admin.
 * Semua harga sudah termasuk PPN 11%.
 */
async function computeInvoice(app, { amount, customPrices = {} }) {
  if (!isLabTesting(app)) {
    const n = Math.round(+amount);
    if (!n || n <= 0) throw httpError(400, 'Nominal invoice (hasil kesepakatan harga) wajib diisi.');
    return { total: n, items: [{ label: `Biaya ${app.service_name} (sesuai kesepakatan)`, amount: n }] };
  }
  const qty = Number((await one('SELECT COALESCE(SUM(quantity),1) n FROM samples WHERE application_id=?', [app.id])).n) || 1;
  const params = await q('SELECT * FROM application_parameters WHERE application_id=? ORDER BY id', [app.id]);
  const items = [];
  if (app.full_sni) {
    const prod = await one('SELECT name, package_price FROM products WHERE id=?', [app.product_id]);
    if (!prod?.package_price) throw httpError(400, 'Harga paket "parameter lengkap sesuai SNI" untuk produk ini belum diatur di Daftar harga lab.');
    items.push({ label: `Paket parameter lengkap sesuai SNI · ${prod.name}`, qty, price: +prod.package_price, amount: +prod.package_price * qty });
  }
  for (const p of params) {
    if (app.full_sni && !p.is_custom) continue;
    let price = p.price_snapshot;
    if (p.is_custom) {
      price = customPrices[p.id] ?? customPrices[String(p.id)] ?? price;
      if (price === undefined || price === null || price === '' || +price < 0) throw httpError(400, `Isi harga parameter "${p.name}" (parameter lainnya).`);
      await q('UPDATE application_parameters SET price_snapshot=? WHERE id=?', [+price, p.id]);
    }
    if (price === null) throw httpError(400, `Harga parameter "${p.name}" belum diatur di Daftar harga lab.`);
    items.push({ label: p.name + (p.is_custom ? ' (lainnya)' : ''), qty, price: +price, amount: +price * qty });
  }
  const extra = Math.round(+amount || 0);
  if (extra > 0) items.push({ label: 'Biaya tambahan', amount: extra });
  return { total: items.reduce((t, i) => t + i.amount, 0), items };
}

async function issueInvoice(app, user, { amount, customPrices, dueDate, note, file }) {
  assertOpen(app);
  if (!stepOf(app).is_payment_step) throw httpError(400, 'Invoice hanya dapat diterbitkan pada tahap pembayaran.');
  if (!['belum', 'invoice'].includes(app.payment_status)) throw httpError(400, 'Invoice tidak dapat diubah karena bukti bayar sudah diunggah.');
  const { total, items } = await computeInvoice(app, { amount, customPrices });
  const dpp = Math.round(total / 1.11);
  const existing = await one('SELECT * FROM payments WHERE application_id=? AND status="invoice" ORDER BY id DESC LIMIT 1', [app.id]);
  const invoiceNo = existing?.invoice_no || `INV/PSU/${new Date().getFullYear()}/${String(app.id).padStart(5, '0')}`;
  const vals = [total, dpp, total - dpp, JSON.stringify(items), dueDate || null, note || null, user.id];
  if (existing) {
    await q('UPDATE payments SET amount=?, dpp=?, ppn=?, items=?, due_date=?, note=?, issued_by=?, created_at=NOW() WHERE id=?', [...vals, existing.id]);
    if (file) await q('UPDATE payments SET invoice_file=? WHERE id=?', [file, existing.id]);
  } else {
    await q('INSERT INTO payments (application_id, invoice_no, amount, dpp, ppn, items, due_date, note, issued_by, invoice_file, status) VALUES (?,?,?,?,?,?,?,?,?,?,"invoice")',
      [app.id, invoiceNo, ...vals, file || null]);
  }
  await q('UPDATE applications SET payment_status="invoice" WHERE id=?', [app.id]);
  await addLog(app, 'invoice', `Invoice ${invoiceNo} ${existing ? 'diperbarui' : 'diterbitkan'}: ${rupiah(total)} (termasuk PPN 11%).${note ? ' ' + note : ''}`, user);
  await notify(app, `Invoice ${invoiceNo}`, `Invoice untuk pengajuan Anda telah terbit sebesar ${rupiah(total)} (sudah termasuk PPN 11%).${dueDate ? `\nBatas pembayaran: ${tgl(dueDate)}.` : ''}\nSilakan lakukan pembayaran lalu unggah bukti transfer melalui akun SILAPP.`);
}

async function markPaid(app, user) {
  await q('UPDATE applications SET payment_status="terverifikasi" WHERE id=?', [app.id]);
  await q('UPDATE payments SET status="terverifikasi", verified_by=?, verified_at=NOW() WHERE application_id=? AND status="menunggu"', [user ? user.id : null, app.id]);
  app.payment_status = 'terverifikasi';
}

async function verifyPayment(app, user, valid, note) {
  assertOpen(app);
  if (app.payment_status !== 'menunggu') throw httpError(400, 'Tidak ada bukti bayar yang menunggu verifikasi.');
  if (!valid) {
    if (!note) throw httpError(400, 'Isi alasan bukti bayar ditolak.');
    await q('UPDATE payments SET status="invoice" WHERE application_id=? AND status="menunggu"', [app.id]);
    await q('UPDATE applications SET payment_status="invoice" WHERE id=?', [app.id]);
    await addLog(app, 'bayar', `Bukti bayar belum dapat diterima: ${note}`, user);
    await notify(app, 'Bukti bayar perlu diunggah ulang', `Bukti pembayaran Anda belum dapat kami terima:\n${note}\n\nSilakan unggah ulang bukti pembayaran melalui akun SILAPP.`);
    return;
  }
  await markPaid(app, user);
  await addLog(app, 'bayar', `Pembayaran terverifikasi.${note ? ' ' + note : ''}`, user);
  await tryAutoAdvance(app);
}

/** Semua berkas pelanggan sudah diunduh Super Admin (setelah unggahan terakhir)? */
async function allDocsDownloaded(app) {
  if (!app.docs_downloaded_at) return false;
  const r = await one(`SELECT GREATEST(
      COALESCE((SELECT MAX(created_at) FROM documents WHERE application_id=? AND source="pelanggan"), '1970-01-01'),
      COALESCE((SELECT MAX(paid_at) FROM payments WHERE application_id=?), '1970-01-01')) latest`, [app.id, app.id]);
  return String(app.docs_downloaded_at) >= String(r.latest);
}

/**
 * Tahap 3 Sertifikasi Produk (ST-03) selesai otomatis jika:
 * pembayaran terverifikasi DAN seluruh berkas pelanggan sudah diunduh Super Admin.
 */
async function tryAutoAdvance(app) {
  const fresh = await loadApp(app.id);
  if (fresh.service_code !== 'SP' || stepOf(fresh).status_code !== 'ST-03' || fresh.status !== 'aktif') return false;
  if (fresh.payment_status !== 'terverifikasi' || !(await allDocsDownloaded(fresh))) return false;
  await approve(fresh, null, { auto: 'Pembayaran terverifikasi dan seluruh berkas telah diunduh Super Admin. Tahap selesai otomatis.' });
  return true;
}

/* ------------------------- TEMUAN AUDIT (SP) ------------------------- */

const MONTHS = { mayor: 1, minor: 2 };
const assertFindingStage = (app) => {
  if (app.service_code !== 'SP') throw httpError(400, 'Temuan audit hanya untuk Sertifikasi Produk.');
  assertOpen(app);
  const code = stepOf(app).status_code;
  if (!['ST-05', 'ST-06', 'ST-07'].includes(code)) throw httpError(400, 'Temuan dapat diinput pada tahap ST-05 s.d. ST-07.');
};

/** Admin menginput laporan audit + temuan. Tenggat otomatis (mayor 1 bln, minor 2 bln), dapat diubah. */
async function addFindings(app, user, { reportDate, items }) {
  assertFindingStage(app);
  if (!reportDate) throw httpError(400, 'Tanggal laporan audit wajib diisi.');
  const list = (items || []).filter((i) => i.description?.trim());
  if (!list.length) throw httpError(400, 'Isi minimal satu temuan.');
  const count = { mayor: 0, minor: 0, observasi: 0 };
  for (const it of list) {
    if (!MONTHS[it.category] && it.category !== 'observasi') throw httpError(400, 'Kategori temuan tidak valid.');
    count[it.category]++;
    const due = it.category === 'observasi' ? null
      : it.due_date || (await one(`SELECT DATE_ADD(?, INTERVAL ${MONTHS[it.category]} MONTH) d`, [reportDate])).d;
    await q('INSERT INTO findings (application_id, category, description, report_date, due_date, created_by) VALUES (?,?,?,?,?,?)',
      [app.id, it.category, it.description.trim(), reportDate, due, user.id]);
  }
  await q('UPDATE applications SET audit_report_date=? WHERE id=?', [reportDate, app.id]);
  if (count.mayor + count.minor > 0) await q('UPDATE applications SET nc_flag=1 WHERE id=?', [app.id]);
  const parts = Object.entries(count).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(', ');
  await addLog(app, 'temuan', `Laporan audit (${tgl(reportDate)}): ${parts}. ${count.mayor + count.minor ? 'Mohon kirim bukti perbaikan sebelum tenggat.' : 'Tidak ada tindakan wajib.'}`, user);
  await notify(app, 'Hasil audit: temuan', `Laporan audit tanggal ${tgl(reportDate)} mencatat temuan: ${parts}.\n` +
    'Tenggat perbaikan: mayor 1 bulan dan minor 2 bulan sejak tanggal laporan audit. Temuan observasi tidak memerlukan tindakan wajib.\n' +
    'Silakan lihat rincian temuan dan unggah bukti perbaikan melalui akun SILAPP. Jika tenggat terlewat, Anda dapat mengajukan perpanjangan waktu 1 bulan.');
}

async function getFinding(app, id) {
  const f = await one('SELECT * FROM findings WHERE id=? AND application_id=?', [id, app.id]);
  if (!f) throw httpError(404, 'Temuan tidak ditemukan.');
  return f;
}
const fLabel = (f) => `Temuan ${f.category} #${f.id}`;

/** Admin: tutup / minta perbaikan ulang / ubah tenggat / putuskan perpanjangan. */
async function adminFinding(app, user, id, { op, note, dueDate, description }) {
  assertOpen(app);
  const f = await getFinding(app, id);
  if (op === 'tutup') {
    await q('UPDATE findings SET status="ditutup", closed_at=NOW(), admin_note=? WHERE id=?', [note || null, id]);
    await addLog(app, 'temuan', `${fLabel(f)} ditutup${note ? ': ' + note : '.'}`, user);
  } else if (op === 'ulang') {
    if (!note) throw httpError(400, 'Isi catatan perbaikan yang masih diperlukan.');
    await q('UPDATE findings SET status="terbuka", admin_note=? WHERE id=?', [note, id]);
    await addLog(app, 'temuan', `${fLabel(f)}: perbaikan belum memadai. ${note}`, user);
    await notify(app, 'Perbaikan temuan perlu dilengkapi', `${fLabel(f)} (${f.description})\nCatatan PSU: ${note}`);
  } else if (op === 'ubah') {
    await q('UPDATE findings SET due_date=?, description=? WHERE id=?', [f.category === 'observasi' ? null : dueDate || f.due_date, description?.trim() || f.description, id]);
    await addLog(app, 'temuan', `${fLabel(f)} diperbarui${dueDate && dueDate !== f.due_date ? `, tenggat menjadi ${tgl(dueDate)}` : ''}.`, user);
  } else if (op === 'perpanjang_setuju' || op === 'perpanjang_tolak') {
    if (f.extension_status !== 'diajukan') throw httpError(400, 'Tidak ada pengajuan perpanjangan untuk temuan ini.');
    if (op === 'perpanjang_setuju') {
      await q('UPDATE findings SET extension_status="disetujui", due_date=DATE_ADD(GREATEST(COALESCE(due_date, CURDATE()), CURDATE()), INTERVAL 1 MONTH) WHERE id=?', [id]);
      const nf = await getFinding(app, id);
      await addLog(app, 'perpanjangan', `Perpanjangan ${fLabel(f)} disetujui. Tenggat baru ${tgl(nf.due_date)}.`, user);
      await notify(app, 'Perpanjangan disetujui', `Perpanjangan waktu ${fLabel(f)} disetujui. Tenggat baru: ${tgl(nf.due_date)}.`);
    } else {
      await q('UPDATE findings SET extension_status="ditolak", admin_note=? WHERE id=?', [note || null, id]);
      await addLog(app, 'perpanjangan', `Perpanjangan ${fLabel(f)} tidak disetujui${note ? ': ' + note : '.'}`, user);
      await notify(app, 'Perpanjangan tidak disetujui', `Perpanjangan waktu ${fLabel(f)} tidak disetujui.${note ? '\nCatatan: ' + note : ''}`);
    }
  } else throw httpError(400, 'Aksi temuan tidak dikenal.');
}

/** Pelanggan mengirim bukti perbaikan untuk satu temuan. */
async function customerFindingReply(app, user, id, note, files) {
  assertOpen(app);
  const f = await getFinding(app, id);
  if (f.status === 'ditutup') throw httpError(400, 'Temuan ini sudah ditutup.');
  if (!files?.length && !note) throw httpError(400, 'Unggah bukti perbaikan atau isi keterangan.');
  await q('UPDATE findings SET status="dikirim", customer_note=? WHERE id=?', [note || null, id]);
  const logId = await addLog(app, 'tanggapan', `Bukti perbaikan ${fLabel(f)} dikirim.${note ? ' ' + note : ''}`, user);
  await saveDocs(app, user, files, { docName: `Bukti perbaikan ${fLabel(f)}`, logId, findingId: id });
}

/** Pelanggan mengajukan perpanjangan 1 bulan (maksimal 1 kali per temuan). */
async function customerExtension(app, user, id, reason) {
  assertOpen(app);
  const f = await getFinding(app, id);
  if (f.category === 'observasi') throw httpError(400, 'Temuan observasi tidak memiliki tenggat.');
  if (f.status === 'ditutup') throw httpError(400, 'Temuan ini sudah ditutup.');
  if (f.extension_status !== 'tidak') throw httpError(400, 'Perpanjangan hanya dapat diajukan satu kali per temuan.');
  if (!reason) throw httpError(400, 'Isi alasan perpanjangan.');
  await q('UPDATE findings SET extension_status="diajukan", extension_reason=? WHERE id=?', [reason, id]);
  await addLog(app, 'perpanjangan', `Pelanggan mengajukan perpanjangan 1 bulan untuk ${fLabel(f)}: ${reason}`, user);
}

/* ------------------------- INFO PENGUJIAN LAB (SP ST-06) ------------------------- */

async function updateLabInfo(app, user, { labName, labEstimate, labLink, files }) {
  if (app.service_code !== 'SP') throw httpError(400, 'Info pengujian lab hanya untuk Sertifikasi Produk.');
  assertOpen(app);
  if (labLink && !/^https?:\/\//i.test(labLink)) throw httpError(400, 'Tautan LHU harus diawali http:// atau https://');
  await q('UPDATE applications SET lab_name=?, lab_estimate=?, lab_link=? WHERE id=?', [labName || null, labEstimate || null, labLink || null, app.id]);
  const parts = [labName && `Pengujian dilakukan di ${labName}`, labEstimate && `estimasi ${labEstimate}`, labLink && 'tautan LHU tersedia', files?.length && 'LHU diunggah'].filter(Boolean);
  const logId = await addLog(app, 'info', `${parts.join(', ') || 'Info pengujian laboratorium diperbarui'}.`, user);
  await saveDocs(app, user, files, { docName: 'Laporan Hasil Uji (LHU)', logId });
  if (files?.length || labLink) await notify(app, 'Hasil pengujian laboratorium', 'Laporan Hasil Uji (LHU) untuk pengajuan Anda sudah tersedia dan dapat dilihat pada tahap Pengujian laboratorium di akun SILAPP.');
}

/* ------------------------- AKSI PELANGGAN ------------------------- */

async function customerReply(app, user, note, files) {
  if (app.status !== 'aksi') throw httpError(400, 'Tidak ada tindakan yang diminta saat ini.');
  await q('UPDATE applications SET status="aktif" WHERE id=?', [app.id]);
  const logId = await addLog(app, 'tanggapan', note || 'Pelanggan mengirim tanggapan / dokumen perbaikan.', user);
  await saveDocs(app, user, files, { docName: 'Tanggapan / perbaikan', logId });
}

async function customerPay(app, user, proofPath) {
  const st = stepOf(app);
  if (!st.is_payment_step) throw httpError(400, 'Pengajuan belum berada di tahap pembayaran.');
  if (app.payment_status === 'belum') throw httpError(400, 'Invoice belum diterbitkan PSU.');
  if (app.payment_status !== 'invoice') throw httpError(400, 'Bukti bayar sudah diunggah.');
  await q('UPDATE payments SET proof_path=?, paid_at=NOW(3), status="menunggu" WHERE application_id=? AND status="invoice"', [proofPath, app.id]);
  await q('UPDATE applications SET payment_status="menunggu" WHERE id=?', [app.id]);
  await addLog(app, 'bayar', 'Pelanggan mengunggah bukti pembayaran.', user);
}

/** Survei kepuasan: wajib sebelum unduh sertifikat/LHU. Setelah terkirim, dokumen dikirim lewat email. */
async function submitSurvey(app, user, { scores, suggestion }) {
  if (app.status !== 'selesai') throw httpError(400, 'Survei dapat diisi setelah dokumen terbit.');
  const cert = await one('SELECT * FROM certificates WHERE application_id=?', [app.id]);
  if (!cert) throw httpError(400, 'Dokumen belum terbit.');
  if (await one('SELECT id FROM survey_responses WHERE application_id=?', [app.id])) throw httpError(400, 'Survei untuk pengajuan ini sudah diisi.');
  const questions = await q('SELECT * FROM survey_questions WHERE is_active=1 ORDER BY sort_order, id');
  for (const qu of questions) {
    const v = +(scores || {})[qu.id];
    if (!(v >= 1 && v <= 5)) throw httpError(400, 'Mohon beri nilai 1–5 untuk semua pertanyaan.');
  }
  const r = await q('INSERT INTO survey_responses (application_id, user_id, suggestion) VALUES (?,?,?)', [app.id, user.id, suggestion || null]);
  for (const qu of questions) {
    await q('INSERT INTO survey_answers (response_id, question_id, question, score) VALUES (?,?,?,?)', [r.insertId, qu.id, qu.question, +scores[qu.id]]);
  }
  await addLog(app, 'survei', 'Pelanggan mengisi Survei Kepuasan Pelanggan. Dokumen dapat diunduh.', user);
  const w = docWord(app);
  await notify(app, `Penyampaian dokumen ${w}`,
    `Terima kasih atas partisipasi Saudara dalam mengisi Survei Kepuasan Pelanggan.\n\nBersama email ini kami lampirkan ${w.toLowerCase()} nomor ${cert.certificate_no}. ` +
    `Dokumen juga dapat diunduh kapan saja melalui akun SILAPP.`,
    cert.file_path ? [{ filename: `${cert.certificate_no.replace(/[\/\\]/g, '-')}.pdf`, path: path.join(UPLOAD_DIR, cert.file_path) }] : []);
}

module.exports = {
  httpError, getSteps, loadApp, stepOf, condition, isSkipped, assertCanHandle, addLog, notify,
  OPEN_FINDINGS, approve, requestAction, ignore, reject, updateParameter, issueInvoice, verifyPayment, tryAutoAdvance, allDocsDownloaded,
  addFindings, adminFinding, customerFindingReply, customerExtension, updateLabInfo, customerReply, customerPay, submitSurvey,
};
