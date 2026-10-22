/**
 * Tugas terjadwal SILAPP. Satu pintu, tiga cara memicu:
 *   - server biasa (XAMPP/VPS/cPanel): otomatis setiap 30 menit selama aplikasi berjalan (src/index.js)
 *   - cPanel Cron Jobs (disarankan, karena aplikasi Node di cPanel bisa "tidur"): `npm run jobs` sekali sehari
 *   - Vercel Cron: GET /api/cron (vercel.json), dilindungi CRON_SECRET
 *
 * Isi:
 *   - setiap kali: kirim ulang email yang gagal (maks. 5 kali dalam 3 hari)
 *   - sekali per hari (WIB): pengingat sertifikat akan/sudah berakhir (90 & 30 hari), proforma invoice jatuh tempo,
 *     batas waktu temuan (H-7 & lewat), lalu bersih-bersih log lama
 * Pengingat yang sudah terkirim dicatat di reminder_log sehingga tidak terkirim dua kali walau tugas dipicu berkali-kali.
 */
const { q } = require('../config/db');
const { retryFailed } = require('../utils/mailer');
const { todayJkt } = require('../utils/certificate');
const { notifyBidang } = require('../services/notifications');

const tgl = (d) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${String(d).slice(0, 10)}T00:00:00Z`));

/** Tandai pengingat; true bila belum pernah dikirim (aman dipanggil bersamaan oleh beberapa proses). */
async function claim(kind, refId, mark) {
  const r = await q('INSERT IGNORE INTO reminder_log (kind, ref_id, mark) VALUES (?,?,?)', [kind, refId, mark]);
  return r.affectedRows === 1;
}

/** Bagian harian hanya jalan sekali per tanggal WIB, walau dipicu dari beberapa tempat. */
async function claimDay(today) {
  await q("INSERT IGNORE INTO settings (skey, svalue) VALUES ('job:daily', '')");
  // hanya satu proses yang berhasil mengganti tanggal; yang lain tidak menemukan baris yang cocok
  const r = await q("UPDATE settings SET svalue=? WHERE skey='job:daily' AND svalue<>?", [today, today]);
  return r.affectedRows === 1;
}

const workflow = () => require('../services/workflow'); // dimuat saat dipakai (hindari require melingkar)

/* ---------- 1. Sertifikat akan / sudah berakhir ---------- */
async function certReminders() {
  let n = 0;
  // sertifikat SILAPP: pelanggan (email + notifikasi) dan Admin SP
  const silapp = await q(`SELECT c.id, c.application_id, c.certificate_no, c.expires_at, DATEDIFF(c.expires_at, CURDATE()) days_left
      FROM certificates c JOIN applications a ON a.id=c.application_id JOIN services s ON s.id=a.service_id
     WHERE s.code='SP' AND (a.status='selesai' OR EXISTS (SELECT 1 FROM billings bx WHERE bx.application_id=a.id)) AND c.status<>'dicabut' AND c.expires_at IS NOT NULL
       AND c.expires_at BETWEEN CURDATE() - INTERVAL 7 DAY AND CURDATE() + INTERVAL 90 DAY`);
  const legacy = await q(`SELECT id, certificate_no, factory_name, expires_at, DATEDIFF(expires_at, CURDATE()) days_left FROM legacy_certificates
     WHERE status<>'dicabut' AND expires_at BETWEEN CURDATE() - INTERVAL 7 DAY AND CURDATE() + INTERVAL 90 DAY`);
  const markOf = (d) => (d < 0 ? 'berakhir' : d <= 30 ? '30' : '90');
  for (const c of silapp) {
    const mark = markOf(+c.days_left);
    if (!(await claim('cert_silapp', c.id, `${mark}:${String(c.expires_at).slice(0, 10)}`))) continue;
    const app = await workflow().loadApp(c.application_id);
    const msg = mark === 'berakhir'
      ? `Sertifikat ${c.certificate_no} telah berakhir pada ${tgl(c.expires_at)}. Untuk tetap dapat menggunakan SPPT SNI, silakan ajukan sertifikasi ulang melalui SILAPP atau hubungi PSU.`
      : `Sertifikat ${c.certificate_no} akan berakhir pada ${tgl(c.expires_at)} (${c.days_left} hari lagi). Mohon persiapkan perpanjangan / sertifikasi ulang agar sertifikat tidak terputus.`;
    await workflow().notify(app, mark === 'berakhir' ? 'Sertifikat telah berakhir' : 'Sertifikat akan berakhir', msg);
    await notifyBidang('SP', mark === 'berakhir' ? 'Sertifikat berakhir' : `Sertifikat berakhir ${c.days_left} hari lagi`, `${c.certificate_no} · ${app.company_name}`, '/admin/sertifikat');
    n += 1;
  }
  for (const c of legacy) {
    const mark = markOf(+c.days_left);
    if (!(await claim('cert_lama', c.id, `${mark}:${String(c.expires_at).slice(0, 10)}`))) continue;
    await notifyBidang('SP', mark === 'berakhir' ? 'Sertifikat berakhir' : `Sertifikat berakhir ${c.days_left} hari lagi`,
      `${c.certificate_no} · ${c.factory_name} (proyek sebelum SILAPP, pelanggan perlu dihubungi manual)`, '/admin/sertifikat');
    n += 1;
  }
  return n;
}

/* ---------- 2. Proforma invoice jatuh tempo ---------- */
async function invoiceReminders() {
  let n = 0;
  const rows = await q(`SELECT p.id, p.application_id, p.invoice_no, p.due_date, DATEDIFF(p.due_date, CURDATE()) days_left
      FROM payments p JOIN applications a ON a.id=p.application_id
     WHERE p.status='invoice' AND a.status IN ('aktif','aksi') AND a.payment_status='invoice' AND p.due_date IS NOT NULL
       AND p.due_date BETWEEN CURDATE() - INTERVAL 14 DAY AND CURDATE() + INTERVAL 1 DAY`);
  for (const p of rows) {
    const late = +p.days_left < 0;
    if (!(await claim('invoice', p.id, `${late ? 'lewat' : 'h1'}:${String(p.due_date).slice(0, 10)}`))) continue;
    const app = await workflow().loadApp(p.application_id);
    await workflow().notify(app, late ? 'Proforma invoice melewati jatuh tempo' : 'Proforma invoice segera jatuh tempo',
      late
        ? `Proforma invoice ${p.invoice_no} telah melewati jatuh tempo (${tgl(p.due_date)}). Mohon segera lakukan pembayaran dan unggah bukti bayar melalui SILAPP agar proses dapat dilanjutkan.`
        : `Proforma invoice ${p.invoice_no} jatuh tempo pada ${tgl(p.due_date)}. Mohon lakukan pembayaran dan unggah bukti bayar melalui SILAPP.`);
    if (late) await notifyBidang(app.service_bidang, 'Invoice lewat jatuh tempo', `${app.application_no} · ${app.company_name} · ${p.invoice_no}`, `/admin/pengajuan/${app.id}`);
    n += 1;
  }
  return n;
}

/* ---------- 3. Batas waktu temuan (H-7 dan lewat) ---------- */
async function findingReminders() {
  const rows = await q(`SELECT f.id, f.application_id, f.category, f.due_date, DATEDIFF(f.due_date, CURDATE()) days_left
      FROM findings f JOIN applications a ON a.id=f.application_id
     WHERE f.status='terbuka' AND f.category<>'observasi' AND f.due_date IS NOT NULL AND a.status IN ('aktif','aksi')
       AND f.due_date BETWEEN CURDATE() - INTERVAL 14 DAY AND CURDATE() + INTERVAL 7 DAY ORDER BY f.due_date`);
  // satu email per pengajuan berisi semua temuan yang perlu diingatkan
  const perApp = new Map();
  for (const f of rows) {
    const late = +f.days_left < 0;
    if (!(await claim('finding', f.id, `${late ? 'lewat' : 'h7'}:${String(f.due_date).slice(0, 10)}`))) continue;
    if (!perApp.has(f.application_id)) perApp.set(f.application_id, []);
    perApp.get(f.application_id).push({ ...f, late });
  }
  for (const [appId, list] of perApp) {
    const app = await workflow().loadApp(appId);
    const lines = list.map((f) => `- Temuan ${f.category} · batas ${tgl(f.due_date)} (${f.late ? `lewat ${-f.days_left} hari` : `${f.days_left} hari lagi`})`).join('\n');
    const late = list.some((f) => f.late);
    await workflow().notify(app, late ? 'Batas waktu tindakan perbaikan terlewati' : 'Batas waktu tindakan perbaikan segera berakhir',
      `Mohon segera kirimkan bukti tindakan perbaikan untuk temuan berikut melalui SILAPP${late ? ', atau ajukan perpanjangan waktu bila diperlukan' : ''}:\n${lines}`);
    if (late) await notifyBidang(app.service_bidang, 'Temuan melewati batas waktu', `${app.application_no} · ${app.company_name}`, `/admin/pengajuan/${app.id}`);
  }
  return perApp.size;
}

/* ---------- 4. Bersih-bersih ---------- */
async function cleanup() {
  await q('DELETE FROM email_outbox WHERE created_at < NOW() - INTERVAL 90 DAY');
  await q('DELETE FROM password_resets WHERE expires_at < NOW() - INTERVAL 1 DAY');
  await q('DELETE FROM notifications WHERE is_read=1 AND created_at < NOW() - INTERVAL 180 DAY');
}

let running = null;
/**
 * Jalankan semua tugas. force=true menjalankan bagian harian walau hari ini sudah jalan (dipakai pengujian).
 * Mengembalikan ringkasan untuk log.
 */
function runJobs({ force = false } = {}) {
  running ||= (async () => {
    const out = { emails_resent: await retryFailed() };
    const today = todayJkt();
    if (force || await claimDay(today)) {
      const steps = { cert_reminders: certReminders, invoice_reminders: invoiceReminders, finding_reminders: findingReminders, cleanup };
      for (const [k, fn] of Object.entries(steps)) {
        // satu bagian gagal tidak menghentikan bagian lain
        try { out[k] = (await fn()) ?? 'ok'; } catch (e) { out[k] = `gagal: ${e.message}`; console.error(`[tugas] ${k}:`, e.message); }
      }
      out.daily = today;
    }
    return out;
  })().finally(() => { running = null; });
  return running;
}

module.exports = { runJobs };
