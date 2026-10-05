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
 */
async function sendMail(to, subject, text) {
  if (!to) return;
  if (!transporter) {
    console.log(`[email-simulasi] ke=${to} | ${subject}\n${text}\n`);
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
  } catch (e) {
    console.error('[email] gagal mengirim:', e.message);
  }
}

module.exports = { sendMail };
