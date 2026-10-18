/**
 * Pengiriman email lewat antrean (tabel email_outbox).
 * - Setiap email dicatat dulu, lalu dikirim. Yang gagal (SMTP sibuk/putus) dicoba ulang otomatis oleh tugas terjadwal
 *   (lihat src/jobs), dan bisa dikirim ulang manual dari menu Log Email (Super Admin).
 * - Isi email dihapus dari log setelah terkirim. Email berisi rahasia (kata sandi sementara, tautan reset) tidak pernah
 *   disimpan isinya: bila gagal, Admin cukup mengulang reset.
 * - Lampiran disimpan sebagai kunci file penyimpanan ({ filename, key }), dibaca ulang saat dikirim.
 * - SMTP belum diatur (pengembangan lokal): email dicetak di console dan dicatat "dilewati".
 */
const nodemailer = require('nodemailer');
const { q, one } = require('../config/db');
const { getContact } = require('./settings');
const storage = require('./storage');

let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: +process.env.SMTP_PORT || 465,
    secure: process.env.SMTP_SECURE !== 'false',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
}
const smtpReady = () => !!transporter;

/** Coba ulang otomatis maksimal sekian kali, dalam batas sekian hari sejak email dibuat. */
const MAX_ATTEMPTS = 5;
const RETRY_DAYS = 3;

async function withFooter(body) {
  try {
    const { phone, email } = await getContact();
    return `${body}\n\n—\nKontak PSU: WhatsApp ${phone} · Email ${email}\nEmail ini dikirim otomatis oleh SILAPP. Untuk pertanyaan, hubungi kontak di atas.`;
  } catch { return body; } // kontak opsional
}

const parseAtt = (v) => { try { return JSON.parse(v || '[]'); } catch { return []; } };

/** Kirim satu baris antrean. text dipakai untuk email rahasia (isinya tidak ada di tabel). */
async function deliver(row, text = row.body) {
  if (text == null) {
    await q("UPDATE email_outbox SET status='gagal', last_error=? WHERE id=?", ['Isi email tidak disimpan karena berisi kata sandi/tautan rahasia. Ulangi dari menu terkait (mis. Reset Kata Sandi).', row.id]);
    return false;
  }
  try {
    const attachments = [];
    for (const a of parseAtt(row.attachments)) {
      const content = await storage.stream(a.key);
      if (content) attachments.push({ filename: a.filename, content });
    }
    await transporter.sendMail({ from: process.env.MAIL_FROM, to: row.to_addr, subject: row.subject, text, attachments });
    await q("UPDATE email_outbox SET status='terkirim', attempts=attempts+1, last_error=NULL, sent_at=NOW(), body=NULL WHERE id=?", [row.id]);
    return true;
  } catch (e) {
    console.error(`[email] gagal mengirim #${row.id}:`, e.message);
    await q("UPDATE email_outbox SET status='gagal', attempts=attempts+1, last_error=? WHERE id=?", [String(e.message).slice(0, 500), row.id]);
    return false;
  }
}

/**
 * Kirim email notifikasi.
 * attachments: [{ filename, key }] — key = kunci file di penyimpanan (storage)
 * opts.secret: isi email tidak disimpan di log (kata sandi sementara, tautan reset)
 */
async function sendMail(to, subject, body, attachments = [], { secret = false } = {}) {
  if (!to) return;
  const text = await withFooter(body);
  const att = attachments.length ? JSON.stringify(attachments.map(({ filename, key }) => ({ filename, key }))) : null;
  let id = null;
  try {
    const r = await q('INSERT INTO email_outbox (to_addr, subject, body, attachments, status) VALUES (?,?,?,?,?)',
      [to, String(subject).slice(0, 255), secret ? null : text, att, transporter ? 'antri' : 'dilewati']);
    id = r.insertId;
  } catch (e) { console.error('[email] gagal mencatat antrean:', e.message); }
  if (!transporter) {
    const names = attachments.length ? `\n[lampiran: ${attachments.map((a) => a.filename).join(', ')}]` : '';
    console.log(`[email-simulasi] ke=${to} | ${subject}\n${text}${names}\n`);
    return;
  }
  // Pengiriman SMTP bisa makan 1–3 detik: di server biasa email dikirim di latar belakang agar aksi pengguna
  // langsung selesai. Di serverless (Vercel) proses berhenti setelah respons terkirim, jadi tetap ditunggu.
  const row = { id, to_addr: to, subject, attachments: att };
  const job = id
    ? deliver(row, text).catch((e) => console.error('[email]', e.message))
    : transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, text }).catch((e) => console.error('[email] gagal mengirim:', e.message));
  if (process.env.VERCEL) await job;
}

/** Coba ulang email yang gagal / tertahan (dipanggil tugas terjadwal). Mengembalikan jumlah yang terkirim. */
async function retryFailed(limit = 20) {
  if (!transporter) return 0;
  const rows = await q(`SELECT * FROM email_outbox
    WHERE body IS NOT NULL AND attempts < ? AND created_at > NOW() - INTERVAL ? DAY
      AND (status='gagal' OR (status='antri' AND created_at < NOW() - INTERVAL 10 MINUTE))
    ORDER BY id LIMIT ?`, [MAX_ATTEMPTS, RETRY_DAYS, limit]);
  let sent = 0;
  for (const r of rows) if (await deliver(r)) sent += 1;
  return sent;
}

/** Kirim ulang manual dari menu Log Email. */
async function resend(id) {
  const row = await one('SELECT * FROM email_outbox WHERE id=?', [id]);
  if (!row) return { ok: false, status: 404, message: 'Email tidak ditemukan.' };
  if (row.status === 'terkirim') return { ok: false, status: 400, message: 'Email ini sudah terkirim.' };
  if (!transporter) return { ok: false, status: 400, message: 'SMTP belum diatur di server, email belum bisa dikirim.' };
  if (row.body == null) return { ok: false, status: 400, message: 'Isi email ini tidak disimpan (berisi kata sandi/tautan rahasia). Ulangi dari menu terkait, mis. Reset Kata Sandi.' };
  const ok = await deliver(row);
  const after = await one('SELECT last_error FROM email_outbox WHERE id=?', [id]);
  return ok ? { ok: true } : { ok: false, status: 502, message: `Masih gagal: ${after?.last_error || 'tidak diketahui'}` };
}

/** Alamat aplikasi untuk tautan di email: CLIENT_URL, atau domain produksi Vercel, atau localhost. */
function appUrl() {
  if (process.env.CLIENT_URL) return process.env.CLIENT_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'http://localhost:5173';
}

module.exports = { sendMail, appUrl, retryFailed, resend, smtpReady, MAX_ATTEMPTS, RETRY_DAYS };
