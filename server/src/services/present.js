/**
 * Menyusun data pengajuan untuk dikirim ke frontend.
 * Pelanggan hanya melihat log & dokumen customer_visible dan nama unit (bukan nama personel),
 * sesuai ketentuan kerahasiaan di ketiga dokumen rancangan sistem tracking.
 */
const { q, one } = require('../config/db');
const { stepOf, condition, isSkipped, allDocsDownloaded, workDone, finalPaid, billing } = require('./workflow');
const { optionLabel, taxes } = require('../utils/pricing');
const { certState } = require('../utils/certificate');

const UNIT = { SP: 'LSPro PSU', KAL: 'Laboratorium Kalibrasi PSU' };
const unitOf = (code) => UNIT[code] || 'Laboratorium Pengujian PSU';

function progress(app) {
  return app.status === 'selesai' ? 100 : stepOf(app).progress_pct;
}

/** Kondisi ketika bola ada di PSU (bukan menunggu pelanggan): dihitung terhadap target SLA tahap. */
const PSU_TURN = ['On Progress', 'Scheduling', 'On-Site Calibration'];
const DAY = 86400000;
/** Tanggal kalender WIB (YYYY-MM-DD). Waktu dari database sudah berupa teks WIB (dateStrings + time_zone +07:00). */
const ymdJkt = (d) => (typeof d === 'string' ? d.slice(0, 10) : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d));

/**
 * SLA tahap berjalan: { days, elapsed, late, over } dalam hari kalender sejak tahap ditangani PSU.
 * null bila tahap tidak punya target SLA, pengajuan sudah ditutup, atau sedang menunggu pelanggan.
 */
function slaOf(app, st, cond) {
  if (st.sla_days == null || !app.step_since || app.status !== 'aktif') return null;
  // tahap akhir: giliran PSU saat invoice belum dikirim atau ada bukti yang menunggu verifikasi
  const psu = st.is_billing_step
    ? !app.billing_sent || app.billing_pay === 'menunggu' || app.billing_cut === 'menunggu'
    : PSU_TURN.includes(cond) || (cond === 'Waiting for Payment' && app.payment_status === 'menunggu');
  if (!psu) return null;
  const elapsed = Math.round((new Date(`${ymdJkt(new Date())}T00:00:00Z`) - new Date(`${ymdJkt(app.step_since)}T00:00:00Z`)) / DAY);
  const days = +st.sla_days;
  return { days, elapsed, late: elapsed > days, over: Math.max(0, elapsed - days) };
}

function summary(app) {
  const st = stepOf(app);
  const cond = condition(app);
  return {
    id: app.id, application_no: app.application_no, tracking_code: app.tracking_code,
    service_code: app.service_code, service_name: app.service_name, product_label: app.product_label,
    company_name: app.company_name, status: app.status, condition: cond, sla: slaOf(app, st, cond),
    current_step: { order: app.current_step_order, code: st.status_code, name: st.name, index: app.steps.findIndex((x) => x.step_order === app.current_step_order) + 1, total: app.steps.length, is_payment_step: !!st.is_payment_step, is_billing_step: !!st.is_billing_step },
    progress: progress(app),
    work_done: workDone(app),
    // tahap akhir Invoice & Faktur: sent = invoice sudah dikirim; pay/cut = status bukti bayar & bukti potong
    billing: app.billing_pay ? { sent: !!app.billing_sent, pay: app.billing_pay, cut: app.billing_cut } : null,
    payment_status: app.payment_status, payment_scheme: app.payment_scheme || null, open_findings: +app.open_findings || 0, is_package: !!app.is_package, flow: app.flow || '',
    created_at: app.created_at, updated_at: app.updated_at,
  };
}

async function timeline(app) {
  const logs = await q('SELECT step_order, MIN(created_at) started FROM status_logs WHERE application_id=? GROUP BY step_order', [app.id]);
  const started = Object.fromEntries(logs.map((l) => [l.step_order, l.started]));
  return app.steps.map((s) => {
    let state = 'todo';
    if (isSkipped(app, s) && (s.step_order < app.current_step_order || app.service_code === 'KAL')) state = 'skipped';
    // pengajuan yang selesai sebelum ada tahap Invoice & Faktur: tahap itu dilewati
    else if (s.is_billing_step && app.status === 'selesai' && !app.billing_pay) state = 'skipped';
    else if (app.status === 'selesai' || s.step_order < app.current_step_order) state = 'done';
    else if (s.step_order === app.current_step_order) state = app.status === 'aksi' ? 'action' : ['ditolak', 'batal'].includes(app.status) ? 'closed' : 'current';
    return { order: s.step_order, code: s.status_code, name: s.name, pct: s.progress_pct, optional: !!s.is_optional, pay: !!s.is_payment_step, bill: !!s.is_billing_step, state, started_at: started[s.step_order] || null };
  });
}

/** Sisa hari menuju tenggat (negatif = terlambat). */
const daysLeft = (due) => {
  if (!due) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${due}T00:00:00`) - t) / 86400000);
};

/** Detail lengkap. viewer: 'public' | 'customer' | 'admin' */
async function detail(app, viewer) {
  const admin = viewer === 'admin';
  const [steps, lastLog] = await Promise.all([
    timeline(app),
    one('SELECT created_at FROM status_logs WHERE application_id=? AND customer_visible=1 ORDER BY id DESC LIMIT 1', [app.id]),
  ]);
  const base = { ...summary(app), steps };
  if (!admin) delete base.sla; // target SLA hanya untuk internal PSU
  base.last_update = lastLog ? lastLog.created_at : app.created_at;
  const billWait = (s) => ['belum', 'ditolak'].includes(s);
  base.customer_action_needed = app.status === 'aksi' || +app.open_findings > 0 || (stepOf(app).is_payment_step && app.payment_status === 'invoice' && app.status === 'aktif')
    || (stepOf(app).is_billing_step && app.status === 'aktif' && !!app.billing_sent && (billWait(app.billing_pay) || billWait(app.billing_cut)));
  base.service_est = app.service_est || null;
  if (viewer === 'public') {
    // lacak tanpa login: hanya progres, tanpa data perusahaan/produk
    delete base.company_name; delete base.product_label; delete base.id; delete base.payment_status; delete base.open_findings; delete base.is_package;
    delete base.payment_scheme; delete base.billing;
    return base;
  }

  const vis = admin ? '' : 'AND customer_visible=1';
  // data pengajuan dibaca bersamaan agar halaman detail lebih cepat dimuat
  const [docs, logs, details, parameters, equipment, samples, pay, findings, cert, survey] = await Promise.all([
    q(`SELECT id, doc_type, original_name, source, step_order, log_id, finding_id, customer_visible, created_at FROM documents
       WHERE application_id=? ${vis} ORDER BY id`, [app.id]),
    q(`SELECT id, status_code, step_name, action, note, customer_visible, pic_label, created_at FROM status_logs
       WHERE application_id=? ${vis} ORDER BY id DESC`, [app.id]),
    q('SELECT field_key `key`, field_label label, field_value value FROM application_details WHERE application_id=? ORDER BY id', [app.id]),
    q('SELECT id, name, method, status, is_custom, price_snapshot price FROM application_parameters WHERE application_id=? ORDER BY id', [app.id]),
    q('SELECT * FROM equipment WHERE application_id=?', [app.id]),
    q('SELECT * FROM samples WHERE application_id=?', [app.id]),
    one('SELECT * FROM payments WHERE application_id=? ORDER BY id DESC LIMIT 1', [app.id]),
    q('SELECT * FROM findings WHERE application_id=? ORDER BY FIELD(category,"mayor","minor","observasi"), id', [app.id]),
    one('SELECT id, certificate_no, issued_at, expires_at, status, file_path IS NOT NULL has_file FROM certificates WHERE application_id=?', [app.id]),
    one('SELECT id, respondent_name, reference_no, avg_score, suggestion, contact_ok, contact_info, created_at FROM survey_responses WHERE application_id=?', [app.id]),
  ]);
  base.documents = docs.map((d) => ({ ...d, customer_visible: !!d.customer_visible }));

  base.logs = logs.map((l) => ({
    ...l, customer_visible: !!l.customer_visible,
    pic_label: admin || l.pic_label === 'Pelanggan' ? l.pic_label : l.pic_label === 'Sistem' ? 'Sistem SILAPP' : unitOf(app.service_code),
    files: base.documents.filter((d) => d.log_id === l.id),
  }));
  Object.assign(base, {
    action_note: app.action_note, reject_note: app.reject_note, application_type: app.application_type, scheme: app.scheme, origin: app.origin === 'ln' ? 'Luar Negeri' : app.origin === 'dn' ? 'Dalam Negeri' : null,
    location: app.location, full_sni: !!app.full_sni, price_option: optionLabel(app.service_code, app.price_option), audit_report_date: app.audit_report_date,
    lab_info: app.lab_name || app.lab_estimate || app.lab_link ? { name: app.lab_name, estimate: app.lab_estimate, link: app.lab_link } : null,
  });
  Object.assign(base, { details, parameters, equipment, samples });
  base.payment = pay && (() => {
    // invoice lama (sebelum format PSU) belum punya DPP nilai lain / total: hitung dari harga
    const t = pay.dpp_lain == null ? taxes(pay.dpp ?? pay.amount) : { price: +pay.dpp, dppLain: +pay.dpp_lain, ppn: +pay.ppn, total: +pay.total, pph23: +pay.pph23 };
    return {
      invoice_no: pay.invoice_no, price: t.price, dpp_lain: t.dppLain, ppn: t.ppn, total: t.total, pph23: t.pph23 || 0, amount: t.total - (t.pph23 || 0),
      // dibayar di tahap Penawaran & Kontrak sesuai skema (proforma lama: seluruhnya)
      due_now: pay.due_now == null ? t.total - (t.pph23 || 0) : +pay.due_now, with_pph23: !!pay.with_pph23,
      items: pay.items ? JSON.parse(pay.items) : [], due_date: pay.due_date, note: pay.note, status: pay.status,
      has_proof: !!pay.proof_path, created_at: pay.created_at, paid_at: pay.paid_at, verified_at: pay.verified_at,
    };
  })();

  base.findings = findings.map((f) => ({
    id: f.id, category: f.category, description: f.description, report_date: f.report_date, due_date: f.due_date,
    days_left: f.status === 'ditutup' ? null : daysLeft(f.due_date), status: f.status,
    extension_status: f.extension_status, extension_reason: f.extension_reason, customer_note: f.customer_note, admin_note: f.admin_note,
    correction: f.correction, root_cause: f.root_cause, corrective_action: f.corrective_action,
    // bukti perbaikan dan lampiran pengajuan perpanjangan dipisah agar tampil di tempatnya masing-masing
    files: base.documents.filter((d) => d.finding_id === f.id && !d.doc_type.startsWith('Lampiran Perpanjangan')),
    extension_files: base.documents.filter((d) => d.finding_id === f.id && d.doc_type.startsWith('Lampiran Perpanjangan')),
  }));

  if (cert) {
    const { id, ...c } = cert;
    // alasan ditangguhkan/dicabut ikut ditampilkan; pelanggan tidak bisa mengunduh sertifikat yang dicabut
    const note = c.status !== 'aktif' && viewer !== 'public' ? await require('./certificates').statusNote('silapp', id) : null;
    // pelanggan: sertifikat dicabut tidak bisa diunduh; skema 50:50 / Full di Akhir menunggu pelunasan disetujui
    const locked = c.status === 'dicabut' ? 'dicabut' : !finalPaid(app) ? 'pelunasan' : null;
    base.certificate = { ...c, has_file: !!c.has_file, state: certState(c), status_note: note, locked: admin ? null : locked, can_download: admin || !locked };
  } else base.certificate = null;
  base.survey_done = !!survey;
  base.billing = viewer === 'public' ? null : await billing.billingView(app.id);
  base.contract = viewer === 'public' ? null : base.documents.filter((d) => d.doc_type === 'Persetujuan Penawaran / Kontrak').pop() || null;
  if (admin && survey) {
    survey.answers = await q('SELECT question, score FROM survey_answers WHERE response_id=? ORDER BY id', [survey.id]);
    base.survey = survey;
  }

  const st = stepOf(app);
  base.current_step.is_certificate_step = !!st.is_certificate_step;
  if (admin) {
    base.user_name = app.user_name;
    base.user_email = app.user_email;
    base.nc_flag = !!app.nc_flag;
    base.docs_downloaded_at = app.docs_downloaded_at;
    base.all_docs_downloaded = await allDocsDownloaded(app);
  }
  return base;
}

module.exports = { summary, detail };
