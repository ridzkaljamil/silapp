/**
 * Menyusun data pengajuan untuk dikirim ke frontend.
 * Pelanggan hanya melihat log customer_visible dan nama unit (bukan nama personel),
 * sesuai ketentuan kerahasiaan di ketiga dokumen rancangan sistem tracking.
 */
const { q, one } = require('../config/db');
const { stepOf, condition, isSkipped } = require('./workflow');

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
    current_step: { code: st.status_code, name: st.name }, progress: progress(app),
    payment_status: app.payment_status, created_at: app.created_at, updated_at: app.updated_at,
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

/** Detail lengkap. viewer: 'public' | 'customer' | 'admin' */
async function detail(app, viewer) {
  const base = { ...summary(app), steps: await timeline(app) };
  const lastLog = await one('SELECT created_at FROM status_logs WHERE application_id=? AND customer_visible=1 ORDER BY id DESC LIMIT 1', [app.id]);
  base.last_update = lastLog ? lastLog.created_at : app.created_at;
  base.customer_action_needed = app.status === 'aksi' || (stepOf(app).is_payment_step && app.payment_status === 'belum' && app.status === 'aktif');

  if (viewer === 'public') {
    // lacak tanpa login: hanya progres, tanpa data perusahaan/produk
    delete base.company_name; delete base.product_label; delete base.id; delete base.payment_status;
    return base;
  }

  const logs = await q(
    `SELECT id, status_code, step_name, action, note, customer_visible, pic_label, created_at FROM status_logs
      WHERE application_id=? ${viewer === 'admin' ? '' : 'AND customer_visible=1'} ORDER BY id DESC`, [app.id]);
  base.logs = logs.map((l) => ({
    ...l, customer_visible: !!l.customer_visible,
    pic_label: viewer === 'admin' || l.pic_label === 'Pelanggan' ? l.pic_label : unitOf(app.service_code),
  }));
  base.action_note = app.action_note;
  base.reject_note = app.reject_note;
  base.application_type = app.application_type;
  base.scheme = app.scheme;
  base.location = app.location;
  base.details = await q('SELECT field_label label, field_value value FROM application_details WHERE application_id=?', [app.id]);
  base.parameters = await q('SELECT id, name, method, status FROM application_parameters WHERE application_id=? ORDER BY id', [app.id]);
  base.equipment = await q('SELECT * FROM equipment WHERE application_id=?', [app.id]);
  base.samples = await q('SELECT * FROM samples WHERE application_id=?', [app.id]);
  base.documents = await q('SELECT id, doc_type, original_name, created_at FROM documents WHERE application_id=? ORDER BY id', [app.id]);
  base.payment = await one('SELECT invoice_no, status, created_at, verified_at FROM payments WHERE application_id=? ORDER BY id DESC LIMIT 1', [app.id]);
  base.certificate = await one('SELECT certificate_no, issued_at, status, file_path IS NOT NULL has_file FROM certificates WHERE application_id=?', [app.id]);
  const st = stepOf(app);
  base.current_step.is_payment_step = !!st.is_payment_step;
  base.current_step.is_certificate_step = !!st.is_certificate_step;
  if (viewer === 'admin') {
    base.user_name = app.user_name;
    base.user_email = app.user_email;
  }
  return base;
}

module.exports = { summary, detail, progress, unitOf };
