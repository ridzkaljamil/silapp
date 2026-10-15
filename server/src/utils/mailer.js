const nodemailer = require('nodemailer');
const { getContact } = require('./settings');

let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: +process.env.SMTP_PORT || 465,
    secure: process.env.SMTP_SECURE !== 'false',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

/**
 * Kirim email notifikasi. Jika SMTP belum diatur, email dicetak di console
 * supaya alur tetap bisa diuji tanpa server email.
 * attachments: [{ filename, path }] (opsional)
 */
async function sendMail(to, subject, body, attachments = []) {
  if (!to) return;
  let text = body;
  try {
    const { phone, email } = await getContact();
    text += `\n\n—\nKontak PSU: WhatsApp ${phone} · Email ${email}\nEmail ini dikirim otomatis oleh SILAPP. Untuk pertanyaan, hubungi kontak di atas.`;
  } catch { /* kontak opsional */ }
  if (!transporter) {
    const att = attachments.length ? `\n[lampiran: ${attachments.map((a) => a.filename).join(', ')}]` : '';
    console.log(`[email-simulasi] ke=${to} | ${subject}\n${text}${att}\n`);
    return;
  }
  // Pengiriman SMTP bisa makan 1–3 detik: di server biasa email dikirim di latar belakang agar aksi pengguna
  // langsung selesai. Di serverless (Vercel) proses berhenti setelah respons terkirim, jadi tetap ditunggu.
  const job = transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, text, attachments })
    .catch((e) => console.error('[email] gagal mengirim:', e.message));
  if (process.env.VERCEL) await job;
}

module.exports = { sendMail };
