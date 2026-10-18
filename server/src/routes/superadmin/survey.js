/** Survei kepuasan per layanan: pertanyaan, teks, rekap, tindak lanjut, ekspor Excel/CSV. */
const router = require('express').Router();
const { q, one } = require('../../config/db');
const { setSetting, getSettings } = require('../../utils/settings');

/* ---------- survei kepuasan per layanan: pertanyaan, teks, rekap, tindak lanjut, ekspor ---------- */
const SURVEY_BIDANG = ['SP', 'LAB', 'KAL'];
const bidangOf = (req) => (SURVEY_BIDANG.includes(req.query.bidang || req.body?.bidang) ? (req.query.bidang || req.body.bidang) : 'SP');
const RESP_SQL = `SELECT r.id, r.created_at, r.company_name, r.respondent_name, r.reference_no, r.avg_score, r.suggestion, r.contact_ok, r.contact_info,
    a.id application_id, a.application_no, s.name service_name, (SELECT COUNT(*) FROM survey_followups f WHERE f.response_id=r.id) followups
  FROM survey_responses r JOIN applications a ON a.id=r.application_id JOIN services s ON s.id=a.service_id`;

router.get('/survey', async (req, res, next) => {
  try {
    const bidang = bidangOf(req);
    const questions = await q('SELECT * FROM survey_questions WHERE bidang=? ORDER BY sort_order, id', [bidang]);
    const set = await getSettings(['thank_you_text', `survey_intro_${bidang}`]);
    const summary = await q(`SELECT sa.question, COUNT(*) n, ROUND(AVG(sa.score),2) avg FROM survey_answers sa
      JOIN survey_responses r ON r.id=sa.response_id WHERE r.bidang=? GROUP BY sa.question ORDER BY MIN(sa.id)`, [bidang]);
    const counts = await q('SELECT bidang, COUNT(*) n, ROUND(AVG(avg_score),2) avg FROM survey_responses GROUP BY bidang');
    const responses = await q(`${RESP_SQL} WHERE r.bidang=? ORDER BY r.id DESC`, [bidang]);
    res.json({ bidang, questions, intro: set[`survey_intro_${bidang}`] || '', thank_you_text: set.thank_you_text || '', summary, counts, responses });
  } catch (e) { next(e); }
});

router.get('/survey/responses/:id', async (req, res, next) => {
  try {
    const r = await one(`${RESP_SQL} WHERE r.id=?`, [req.params.id]);
    if (!r) return res.status(404).json({ message: 'Data survei tidak ditemukan.' });
    r.answers = await q('SELECT question, score FROM survey_answers WHERE response_id=? ORDER BY id', [r.id]);
    r.followup_list = await q(`SELECT f.id, f.note, f.created_at, u.name user_name FROM survey_followups f LEFT JOIN users u ON u.id=f.user_id
      WHERE f.response_id=? ORDER BY f.id`, [r.id]);
    res.json(r);
  } catch (e) { next(e); }
});

router.post('/survey/responses/:id/followups', async (req, res, next) => {
  try {
    const note = String(req.body.note || '').trim();
    if (!note) return res.status(400).json({ message: 'Isi catatan tindak lanjut.' });
    if (!(await one('SELECT id FROM survey_responses WHERE id=?', [req.params.id]))) return res.status(404).json({ message: 'Data survei tidak ditemukan.' });
    await q('INSERT INTO survey_followups (response_id, user_id, note) VALUES (?,?,?)', [req.params.id, req.user.id, note.slice(0, 2000)]);
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.put('/survey', async (req, res, next) => {
  try {
    const bidang = bidangOf(req);
    const { questions = [], thank_you_text, intro } = req.body;
    if (!questions.some((x) => x.question?.trim() && !x.deleted && x.is_active !== false)) return res.status(400).json({ message: 'Minimal satu pertanyaan aktif.' });
    for (const [i, x] of questions.entries()) {
      const text = x.question?.trim();
      if (x.id && (x.deleted || !text)) { await q('UPDATE survey_questions SET is_active=0 WHERE id=? AND bidang=?', [x.id, bidang]); continue; }
      if (!text) continue;
      if (x.id) await q('UPDATE survey_questions SET question=?, sort_order=?, is_active=? WHERE id=? AND bidang=?', [text.slice(0, 255), i, x.is_active === false ? 0 : 1, x.id, bidang]);
      else await q('INSERT INTO survey_questions (bidang, question, sort_order, is_active) VALUES (?,?,?,?)', [bidang, text.slice(0, 255), i, x.is_active === false ? 0 : 1]);
    }
    if (typeof thank_you_text === 'string') await setSetting('thank_you_text', thank_you_text.trim());
    if (typeof intro === 'string') await setSetting(`survey_intro_${bidang}`, intro.trim());
    // kirim balik data terbaru agar form langsung menampilkan yang tersimpan
    const set = await getSettings(['thank_you_text', `survey_intro_${bidang}`]);
    res.json({ questions: await q('SELECT * FROM survey_questions WHERE bidang=? ORDER BY sort_order, id', [bidang]), intro: set[`survey_intro_${bidang}`] || '', thank_you_text: set.thank_you_text || '' });
  } catch (e) { next(e); }
});

/** Rekap survei untuk Excel/CSV: tanggal, identitas, nilai tiap pertanyaan, rata-rata, saran, kontak, riwayat tindak lanjut. */
router.get('/survey/export', async (req, res, next) => {
  try {
    const bidang = bidangOf(req);
    const rows = await q(`${RESP_SQL} WHERE r.bidang=? ORDER BY r.id`, [bidang]);
    const ids = rows.map((r) => r.id);
    const answers = ids.length ? await q('SELECT response_id, question, score FROM survey_answers WHERE response_id IN (?) ORDER BY id', [ids]) : [];
    const fups = ids.length ? await q(`SELECT f.response_id, f.note, f.created_at, u.name FROM survey_followups f LEFT JOIN users u ON u.id=f.user_id
      WHERE f.response_id IN (?) ORDER BY f.id`, [ids]) : [];
    const qs = [...new Set(answers.map((a) => a.question))];
    const day = (d) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const head = ['Tanggal pengisian', 'Nama perusahaan/instansi', 'Nama responden', 'No. layanan/order/sertifikat', 'No. pengajuan', 'Layanan',
      ...qs.map((_, i) => `P${i + 1}`), 'Nilai rata-rata', 'Saran dan masukan', 'Bersedia dihubungi', 'Email/No. HP', 'Riwayat tindak lanjut'];
    const body = rows.map((r) => {
      const sc = Object.fromEntries(answers.filter((a) => a.response_id === r.id).map((a) => [a.question, a.score]));
      const f = fups.filter((x) => x.response_id === r.id).map((x) => `${day(x.created_at)} (${x.name || '-'}): ${x.note}`).join('\n');
      return [day(r.created_at), r.company_name, r.respondent_name, r.reference_no, r.application_no, r.service_name,
        ...qs.map((x) => sc[x] ?? ''), r.avg_score === null ? '' : +r.avg_score, r.suggestion || '', r.contact_ok === 1 ? 'Ya' : r.contact_ok === 0 ? 'Tidak' : '', r.contact_info || '', f];
    });
    const name = `rekap-survei-${bidang.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;

    if (req.query.format === 'csv') {
      const cell = (v) => { const t = String(v ?? ''); return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
      const csv = [head, ...body].map((r) => r.map(cell).join(',')).join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
      return res.send(`﻿${csv}`);
    }
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Rekap survei');
    ws.addRow(head).font = { bold: true };
    body.forEach((r) => ws.addRow(r));
    ws.columns.forEach((c, i) => { c.width = i < 6 ? 22 : i < 6 + qs.length ? 6 : 28; c.alignment = { vertical: 'top', wrapText: i >= 6 + qs.length }; });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    const wq = wb.addWorksheet('Daftar pertanyaan');
    wq.addRow(['Kode', 'Pertanyaan']).font = { bold: true };
    qs.forEach((x, i) => wq.addRow([`P${i + 1}`, x]));
    wq.getColumn(2).width = 110;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

module.exports = router;
