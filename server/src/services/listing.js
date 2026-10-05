const { q } = require('../config/db');
const { getSteps } = require('./workflow');
const { summary } = require('./present');

/** Ambil daftar pengajuan (dengan status tracking) berdasarkan kondisi WHERE. */
async function listApps(where = '1=1', params = []) {
  const rows = await q(
    `SELECT a.*, s.code service_code, s.name service_name, s.bidang service_bidang, u.company_name, u.name user_name, u.email user_email
       FROM applications a JOIN services s ON s.id=a.service_id JOIN users u ON u.id=a.user_id
      WHERE ${where} ORDER BY a.updated_at DESC, a.id DESC`, params);
  const cache = {};
  for (const r of rows) {
    cache[r.service_id] = cache[r.service_id] || await getSteps(r.service_id);
    r.steps = cache[r.service_id];
  }
  return rows.map(summary);
}

module.exports = { listApps };
