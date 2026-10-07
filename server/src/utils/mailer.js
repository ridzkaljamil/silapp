const nodemailer = require('nodemailer');

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
async function sendMail(to, subject, text, attachments = []) {
  if (!to) return;
  if (!transporter) {
    const att = attachments.length ? `\n[lampiran: ${attachments.map((a) => a.filename).join(', ')}]` : '';
    console.log(`[email-simulasi] ke=${to} | ${subject}\n${text}${att}\n`);
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, text, attachments });
  } catch (e) {
    console.error('[email] gagal mengirim:', e.message);
  }
}

module.exports = { sendMail };
