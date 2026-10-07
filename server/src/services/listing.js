const { q } = require('../config/db');
const { getSteps, OPEN_FINDINGS } = require('./workflow');
const { summary } = require('./present');

/** Ambil daftar pengajuan (dengan status tracking) berdasarkan kondisi WHERE. */
async function listApps(where = '1=1', params = []) {
  const rows = await q(
    `SELECT a.*, s.code service_code, s.name service_name, s.bidang service_bidang, u.company_name, u.name user_name, u.email user_email,
            ${OPEN_FINDINGS} open_findings,
            (SELECT COUNT(*) FROM findings f WHERE f.application_id=a.id AND (f.status='dikirim' OR f.extension_status='diajukan')) findings_review,
            (SELECT COUNT(*) FROM findings f WHERE f.application_id=a.id AND f.status<>'ditutup' AND f.extension_status='diajukan') ext_requests,
            (SELECT MIN(f.due_date) FROM findings f WHERE f.application_id=a.id AND f.status='terbuka' AND f.category<>'observasi') finding_due,
            (SELECT p.amount FROM payments p WHERE p.application_id=a.id ORDER BY p.id DESC LIMIT 1) pay_amount,
            (SELECT COUNT(*) FROM survey_responses r WHERE r.application_id=a.id) survey_done
       FROM applications a JOIN services s ON s.id=a.service_id JOIN users u ON u.id=a.user_id
      WHERE ${where} ORDER BY a.updated_at DESC, a.id DESC`, params);
  const cache = {};
  for (const r of rows) {
    cache[r.service_id] = cache[r.service_id] || await getSteps(r.service_id);
    r.steps = cache[r.service_id];
  }
  return rows.map((r) => ({ ...summary(r), findings_review: +r.findings_review, ext_requests: +r.ext_requests, finding_due: r.finding_due, pay_amount: r.pay_amount === null ? null : +r.pay_amount, survey_done: !!r.survey_done }));
}

module.exports = { listApps };
