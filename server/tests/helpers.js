/** Alat bantu pengujian: panggilan API, login, berkas contoh, tanggal WIB. */
const { execFileSync } = require('child_process');

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
const plus = (d, days) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + days); return x.toISOString().slice(0, 10); };
const pdf = () => new Blob([Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')], { type: 'application/pdf' });

/** Teks dari PDF (butuh pdftotext/poppler). null bila alat tidak tersedia, pemeriksaan isi PDF dilewati. */
function pdfText(buf, layout = false) {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const f = path.join(os.tmpdir(), `silapp-uji-${Date.now()}.pdf`);
  fs.writeFileSync(f, buf);
  try { return execFileSync('pdftotext', [...(layout ? ['-layout'] : []), f, '-'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { return null; } finally { fs.rmSync(f, { force: true }); }
}

function context(B, mails) {
  const t = {
    B, mails, passed: 0, failed: [], skipped: 0, today, plus, pdf, pdfText,
    ok(cond, msg) { if (cond) t.passed += 1; else t.failed.push(msg); },
    fail(msg) { t.failed.push(msg); },
    skip() { t.skipped += 1; },
    async call(token, method, url, body, form) {
      const r = await fetch(B + url, { method, headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(form ? {} : { 'Content-Type': 'application/json' }) }, body: form || (body ? JSON.stringify(body) : undefined) });
      const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { j = txt; }
      return { s: r.status, j, h: r.headers };
    },
    async raw(token, url) {
      const r = await fetch(B + url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      return { s: r.status, h: r.headers, buf: Buffer.from(await r.arrayBuffer()) };
    },
    login: async (email, password = 'password123') => (await t.call(null, 'POST', '/auth/login', { email, password })).j,
    tok: async (email, password) => (await t.login(email, password)).token,
    /** Setujui tahap berjalan (FormData seperti dari halaman Admin). */
    approve(token, id, order, extra = {}) {
      const fd = new FormData(); fd.append('action', 'setujui'); fd.append('step', order);
      for (const [k, v] of Object.entries(extra)) { if (v instanceof Blob) fd.append(k, v, `${k}.pdf`); else fd.append(k, v); }
      return t.call(token, 'POST', `/admin/applications/${id}/action`, null, fd);
    },
    /** Tahap Penawaran & Kontrak: atur skema pembayaran + unggah kontrak (wajib sebelum proforma). */
    offer(token, id, step, scheme = 'full', note = '') {
      const fd = new FormData(); fd.append('step', step); fd.append('scheme', scheme); fd.append('note', note);
      fd.append('contract', pdf(), 'kontrak.pdf');
      return t.call(token, 'POST', `/admin/applications/${id}/offer`, null, fd);
    },
    /** Tahap akhir: kirim invoice & faktur pajak (PDF). */
    billing(token, id, step, { note = '', pph } = {}) {
      const fd = new FormData(); fd.append('step', step); fd.append('note', note);
      if (pph !== undefined) fd.append('with_pph23', pph ? '1' : '0');
      fd.append('invoice', pdf(), 'invoice-akhir.pdf'); fd.append('faktur', pdf(), 'faktur-pajak.pdf');
      return t.call(token, 'POST', `/admin/applications/${id}/billing`, null, fd);
    },
    adminApp: async (token, id) => (await t.call(token, 'GET', `/admin/applications/${id}`)).j,
    /** Email simulasi terakhir ke alamat tertentu. */
    lastMail: (to) => [...mails].reverse().find((m) => m.includes(`ke=${to} `)),
    sql: (...a) => require('../src/config/db').q(...a),
  };
  return t;
}

module.exports = { context, today, plus };
