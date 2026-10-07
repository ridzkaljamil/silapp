/**
 * Menyusun data pengajuan untuk dikirim ke frontend.
 * Pelanggan hanya melihat log & dokumen customer_visible dan nama unit (bukan nama personel),
 * sesuai ketentuan kerahasiaan di ketiga dokumen rancangan sistem tracking.
 */
const { q, one } = require('../config/db');
const { stepOf, condition, isSkipped, allDocsDownloaded } = require('./workflow');

const UNIT = { SP: 'LSPro PSU', KAL: 'Laboratorium Kalibrasi PSU' };
const unitOf = (code) => UNIT[code] || 'Laboratorium Pengujian PSU';

function progress(app) {
  return app.status === 'selesai' ? 100 : stepOf(app).progress_pct;
}

function summary(app) {
  const st = stepOf(app);
  return {
    id: app.id, application_no: app.application_no, tracking_code: app.tracking_code,
    service_code: app.service_code, service_name: app.service_name, product_label: app.product_label,
    company_name: app.company_name, status: app.status, condition: condition(app),
    current_step: { code: st.status_code, name: st.name, index: app.steps.findIndex((x) => x.step_order === app.current_step_order) + 1, total: app.steps.length }, progress: progress(app),
    payment_status: app.payment_status, open_findings: +app.open_findings || 0, is_package: !!app.is_package,
    created_at: app.created_at, updated_at: app.updated_at,
  };
}

async function timeline(app) {
  const logs = await q('SELECT step_order, MIN(created_at) started FROM status_logs WHERE application_id=? GROUP BY step_order', [app.id]);
  const started = Object.fromEntries(logs.map((l) => [l.step_order, l.started]));
  return app.steps.map((s) => {
    let state = 'todo';
    if (isSkipped(app, s) && (s.step_order < app.current_step_order || app.service_code === 'KAL')) state = 'skipped';
    else if (app.status === 'selesai' || s.step_order < app.current_step_order) state = 'done';
    else if (s.step_order === app.current_step_order) state = app.status === 'aksi' ? 'action' : app.status === 'ditolak' ? 'closed' : 'current';
    return { order: s.step_order, code: s.status_code, name: s.name, pct: s.progress_pct, optional: !!s.is_optional, state, started_at: started[s.step_order] || null };
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
  const base = { ...summary(app), steps: await timeline(app) };
  const lastLog = await one('SELECT created_at FROM status_logs WHERE application_id=? AND customer_visible=1 ORDER BY id DESC LIMIT 1', [app.id]);
  base.last_update = lastLog ? lastLog.created_at : app.created_at;
  base.customer_action_needed = app.status === 'aksi' || +app.open_findings > 0 || (stepOf(app).is_payment_step && app.payment_status === 'invoice' && app.status === 'aktif');

  base.service_est = (await one('SELECT est_text FROM services WHERE id=?', [app.service_id]))?.est_text || null;
  if (viewer === 'public') {
    // lacak tanpa login: hanya progres, tanpa data perusahaan/produk
    delete base.company_name; delete base.product_label; delete base.id; delete base.payment_status; delete base.open_findings; delete base.is_package;
    return base;
  }

  const vis = admin ? '' : 'AND customer_visible=1';
  const docs = await q(`SELECT id, doc_type, original_name, source, step_order, log_id, finding_id, customer_visible, created_at FROM documents
     WHERE application_id=? ${vis} ORDER BY id`, [app.id]);
  base.documents = docs.map((d) => ({ ...d, customer_visible: !!d.customer_visible }));

  const logs = await q(
    `SELECT id, status_code, step_name, action, note, customer_visible, pic_label, created_at FROM status_logs
      WHERE application_id=? ${vis} ORDER BY id DESC`, [app.id]);
  base.logs = logs.map((l) => ({
    ...l, customer_visible: !!l.customer_visible,
    pic_label: admin || l.pic_label === 'Pelanggan' ? l.pic_label : l.pic_label === 'Sistem' ? 'Sistem SILAPP' : unitOf(app.service_code),
    files: base.documents.filter((d) => d.log_id === l.id),
  }));
  Object.assign(base, {
    action_note: app.action_note, reject_note: app.reject_note, application_type: app.application_type, scheme: app.scheme,
    location: app.location, full_sni: !!app.full_sni, audit_report_date: app.audit_report_date,
    lab_info: app.lab_name || app.lab_estimate || app.lab_link ? { name: app.lab_name, estimate: app.lab_estimate, link: app.lab_link } : null,
  });
  base.details = await q('SELECT field_key `key`, field_label label, field_value value FROM application_details WHERE application_id=? ORDER BY id', [app.id]);
  base.parameters = await q('SELECT id, name, method, status, is_custom, price_snapshot price FROM application_parameters WHERE application_id=? ORDER BY id', [app.id]);
  base.equipment = await q('SELECT * FROM equipment WHERE application_id=?', [app.id]);
  base.samples = await q('SELECT * FROM samples WHERE application_id=?', [app.id]);

  const pay = await one('SELECT * FROM payments WHERE application_id=? ORDER BY id DESC LIMIT 1', [app.id]);
  base.payment = pay && {
    invoice_no: pay.invoice_no, amount: pay.amount && +pay.amount, dpp: pay.dpp && +pay.dpp, ppn: pay.ppn && +pay.ppn,
    items: pay.items ? JSON.parse(pay.items) : [], due_date: pay.due_date, note: pay.note, status: pay.status,
    has_invoice_file: !!pay.invoice_file, has_proof: !!pay.proof_path, created_at: pay.created_at, paid_at: pay.paid_at, verified_at: pay.verified_at,
  };

  const findings = await q('SELECT * FROM findings WHERE application_id=? ORDER BY FIELD(category,"mayor","minor","observasi"), id', [app.id]);
  base.findings = findings.map((f) => ({
    id: f.id, category: f.category, description: f.description, report_date: f.report_date, due_date: f.due_date,
    days_left: f.status === 'ditutup' ? null : daysLeft(f.due_date), status: f.status,
    extension_status: f.extension_status, extension_reason: f.extension_reason, customer_note: f.customer_note, admin_note: f.admin_note,
    files: base.documents.filter((d) => d.finding_id === f.id),
  }));

  base.certificate = await one('SELECT certificate_no, issued_at, status, file_path IS NOT NULL has_file FROM certificates WHERE application_id=?', [app.id]);
  if (base.certificate) base.certificate.has_file = !!base.certificate.has_file;
  const survey = await one('SELECT id, suggestion, created_at FROM survey_responses WHERE application_id=?', [app.id]);
  base.survey_done = !!survey;
  if (admin && survey) {
    survey.answers = await q('SELECT question, score FROM survey_answers WHERE response_id=? ORDER BY id', [survey.id]);
    base.survey = survey;
  }

  const st = stepOf(app);
  base.current_step.is_payment_step = !!st.is_payment_step;
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

module.exports = { summary, detail, progress, unitOf, daysLeft };
