/** Tugas terjadwal (pengingat), SLA tahap, antrean email (gagal → coba ulang → terkirim), Log Email Super Admin. */
const net = require('net');

/** Server SMTP tiruan: menerima email, atau menolak semuanya (mode gagal). */
function fakeSmtp() {
  const s = { received: [], reject: false };
  s.server = net.createServer((c) => {
    c.write('220 uji ESMTP\r\n');
    let data = false; let buf = '';
    c.on('data', (chunk) => {
      buf += chunk.toString();
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (data) { if (line === '.') { data = false; s.received.push(1); c.write('250 OK\r\n'); } continue; }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') c.write('250 uji\r\n');
        else if (cmd === 'MAIL') c.write(s.reject ? '451 Server sibuk\r\n' : '250 OK\r\n');
        else if (cmd === 'RCPT') c.write('250 OK\r\n');
        else if (cmd === 'DATA') { data = true; c.write('354 Lanjut\r\n'); } else if (cmd === 'QUIT') { c.write('221 Bye\r\n'); c.end(); } else c.write('250 OK\r\n');
      }
    });
    c.on('error', () => {});
  });
  return new Promise((r) => { s.server.listen(0, '127.0.0.1', () => { s.port = s.server.address().port; r(s); }); });
}

module.exports = {
  name: 'Tugas terjadwal, SLA, antrean email',
  async run(t) {
    const { ok, call, today, plus } = t;
    const td = today();
    const sa = await t.tok('superadmin@penilaistandaruji.com');
    const rina = await t.tok('rina@sinarcontoh.co.id');
    const { runJobs } = require('../src/jobs');
    const apps = (await call(sa, 'GET', '/admin/applications')).j;
    const appNo = (no) => apps.find((a) => a.application_no === no);

    // --- data untuk pengingat
    const cert = (await call(sa, 'GET', '/certificates')).j.find((c) => c.application_no === 'PSU-SP-2608-0003');
    await t.sql('UPDATE certificates SET expires_at=? WHERE id=?', [plus(td, 20), cert.id]);
    await t.sql("UPDATE legacy_certificates SET expires_at=? WHERE certificate_no='PSU-SPPT-2023-0012'", [plus(td, 60)]);
    const sp = appNo('PSU-SP-2610-0002');
    await t.offer(sa, sp.id, 3, 'full');
    let r = await call(sa, 'POST', `/admin/applications/${sp.id}/invoice`, { step: 3, items: [{ label: 'Sertifikasi', qty: 1, price: 1000000 }], with_pph23: false });
    ok(r.s === 200, `terbit invoice ${r.s} ${r.j.message || ''}`);
    await t.sql("UPDATE payments SET due_date=? WHERE application_id=? AND status='invoice'", [plus(td, -2), sp.id]);
    const audit = appNo('PSU-SP-2609-0001');
    await t.sql("UPDATE findings SET due_date=? WHERE application_id=? AND category='minor'", [plus(td, 5), audit.id]);

    // --- lewat endpoint cron (Vercel): wajib CRON_SECRET
    ok((await call(null, 'GET', '/cron')).s === 401, 'cron tanpa rahasia ditolak');
    r = await call('salah', 'GET', '/cron');
    ok(r.s === 401, 'cron dengan rahasia salah ditolak');
    r = await call('rahasia-uji', 'GET', '/cron');
    ok(r.s === 200 && r.j.daily === td && r.j.cert_reminders === 2 && r.j.invoice_reminders === 1 && r.j.finding_reminders === 1, `cron harian jalan ${JSON.stringify(r.j)}`);
    const mailRina = t.mails.filter((m) => m.includes('ke=rina@sinarcontoh.co.id '));
    ok(mailRina.some((m) => /Sertifikat akan berakhir/.test(m) && /20 hari lagi/.test(m)), 'email pelanggan: sertifikat berakhir 20 hari lagi');
    ok(mailRina.some((m) => /Batas waktu tindakan perbaikan segera berakhir/.test(m) && /5 hari lagi/.test(m)), 'email pelanggan: temuan H-7');
    ok(t.mails.some((m) => m.includes('ke=dimas') && /melewati jatuh tempo/.test(m)), 'email pelanggan: invoice lewat jatuh tempo');
    const budi = await t.tok('budi@penilaistandaruji.com');
    const nb = JSON.stringify((await call(budi, 'GET', '/notifications')).j.items);
    ok(/Sertifikat berakhir 20 hari lagi/.test(nb) && /Sertifikat berakhir 60 hari lagi/.test(nb) && /proyek sebelum SILAPP/.test(nb), 'notifikasi Admin SP: SILAPP + proyek lama');
    ok(/Invoice lewat jatuh tempo/.test(nb), 'notifikasi Admin SP: invoice lewat jatuh tempo');

    // dipicu lagi di hari yang sama: bagian harian tidak berulang; dipaksa pun pengingat tidak terkirim dua kali
    r = await call('rahasia-uji', 'GET', '/cron');
    ok(r.s === 200 && !r.j.daily, 'hari yang sama: bagian harian dilewati');
    const before = t.mails.length;
    const out = await runJobs({ force: true });
    ok(out.cert_reminders === 0 && out.invoice_reminders === 0 && out.finding_reminders === 0 && t.mails.length === before, 'pengingat tidak terkirim dua kali');
    // tanggal berakhir diperpanjang lalu mendekat lagi: pengingat baru
    await t.sql('UPDATE certificates SET expires_at=? WHERE id=?', [plus(td, 25), cert.id]);
    ok((await runJobs({ force: true })).cert_reminders === 1, 'tanggal berakhir berubah: pengingat dikirim lagi');
    // sertifikat dicabut tidak diingatkan; sudah lewat → "berakhir"
    await t.sql('UPDATE certificates SET expires_at=?, status="dicabut" WHERE id=?', [plus(td, 10), cert.id]);
    ok((await runJobs({ force: true })).cert_reminders === 0, 'sertifikat dicabut tidak diingatkan');
    await t.sql('UPDATE certificates SET expires_at=?, status="aktif" WHERE id=?', [plus(td, -1), cert.id]);
    await runJobs({ force: true });
    ok(t.mails.some((m) => m.includes('ke=rina@') && /Sertifikat telah berakhir/.test(m)), 'pengingat sertifikat telah berakhir');

    // --- dashboard: sertifikat akan berakhir
    await t.sql('UPDATE certificates SET expires_at=? WHERE id=?', [plus(td, 30), cert.id]);
    const dash = (await call(sa, 'GET', '/admin/dashboard')).j;
    ok(dash.cert_expiring.some((c) => c.certificate_no === cert.certificate_no && c.days_left === 30 && c.application_id) && dash.cert_expiring.some((c) => c.source === 'lama'), 'dashboard: daftar sertifikat akan berakhir');
    const sari = await t.tok('sari@penilaistandaruji.com');
    ok((await call(sari, 'GET', '/admin/dashboard')).j.cert_expiring.length === 0, 'admin lab tidak melihat daftar sertifikat');

    // --- SLA tahap
    const kim = appNo('PSU-KIM-2609-0001');
    ok(kim.sla === null, 'tanpa target SLA: tidak dihitung');
    const kimDet = await t.adminApp(sa, kim.id);
    await t.sql('UPDATE service_steps SET sla_days=2 WHERE service_id=(SELECT service_id FROM applications WHERE id=?) AND step_order=?', [kim.id, kimDet.current_step.order]);
    await t.sql('UPDATE status_logs SET created_at = NOW() - INTERVAL 5 DAY WHERE application_id=? AND step_order=?', [kim.id, kimDet.current_step.order]);
    let row = (await call(sa, 'GET', '/admin/applications')).j.find((a) => a.id === kim.id);
    ok(row.sla && row.sla.days === 2 && row.sla.elapsed === 5 && row.sla.late && row.sla.over === 3, `SLA terlambat 3 hari (${JSON.stringify(row.sla)})`);
    ok((await call(sa, 'GET', '/admin/dashboard')).j.sla_late.some((a) => a.id === kim.id), 'dashboard: daftar melewati SLA');
    ok((await t.adminApp(sa, kim.id)).sla?.late, 'detail admin: SLA');
    const mine = (await call(rina, 'GET', '/applications')).j.find((a) => a.id === kim.id);
    ok(mine && !('sla' in mine) && !('sla' in (await call(rina, 'GET', `/applications/${kim.id}`)).j), 'pelanggan tidak melihat SLA internal');
    // menunggu pelanggan: jam SLA tidak berjalan
    const fd = new FormData(); fd.append('action', 'minta_tindakan'); fd.append('step', kimDet.current_step.order); fd.append('note', 'Kirim sampel tambahan');
    await call(sa, 'POST', `/admin/applications/${kim.id}/action`, null, fd);
    row = (await call(sa, 'GET', '/admin/applications')).j.find((a) => a.id === kim.id);
    ok(row.sla === null, 'menunggu tindakan pelanggan: SLA tidak dihitung');
    const rp = new FormData(); rp.append('note', 'sudah dikirim');
    await call(rina, 'POST', `/applications/${kim.id}/reply`, null, rp);
    row = (await call(sa, 'GET', '/admin/applications')).j.find((a) => a.id === kim.id);
    ok(row.sla && row.sla.elapsed === 0 && !row.sla.late, 'pelanggan menanggapi: hitungan SLA mulai lagi');

    // --- antrean email dengan SMTP tiruan: gagal → coba ulang otomatis → terkirim; kirim ulang manual
    const smtp = await fakeSmtp();
    const keep = { ...process.env };
    Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_SECURE: 'false', SMTP_USER: '', SMTP_PASS: '', MAIL_FROM: 'SILAPP <noreply@uji.local>' });
    const mpath = require.resolve('../src/utils/mailer');
    const original = require.cache[mpath];
    delete require.cache[mpath];
    const mailer = require('../src/utils/mailer');
    // email dikirim di latar belakang (server biasa): tunggu sampai statusnya bukan "antri"
    const settled = async (to) => {
      for (let i = 0; i < 40; i++) {
        const [row] = await t.sql('SELECT * FROM email_outbox WHERE to_addr=?', [to]);
        if (row && row.status !== 'antri') return row;
        await new Promise((res) => { setTimeout(res, 50); });
      }
      return (await t.sql('SELECT * FROM email_outbox WHERE to_addr=?', [to]))[0];
    };
    try {
      await mailer.sendMail('a@contoh.co.id', 'Uji kirim', 'Halo');
      let m = await settled('a@contoh.co.id');
      ok(m.status === 'terkirim' && m.body === null && m.attempts === 1 && smtp.received.length === 1, `SMTP: terkirim, isi dihapus (${m.status} ${m.last_error || ''})`);
      smtp.reject = true;
      await mailer.sendMail('b@contoh.co.id', 'Uji gagal', 'Halo B', [{ filename: 'x.pdf', key: 'tidak-ada.pdf' }]);
      m = await settled('b@contoh.co.id');
      ok(m.status === 'gagal' && m.body && /451/.test(m.last_error), `SMTP sibuk: dicatat gagal (${m.status})`);
      await mailer.sendMail('c@contoh.co.id', 'Sandi', 'rahasia', [], { secret: true });
      await settled('c@contoh.co.id');
      ok(await mailer.retryFailed() === 0, 'masih sibuk: belum terkirim');
      smtp.reject = false;
      ok(await mailer.retryFailed() === 1, 'coba ulang otomatis: terkirim');
      [m] = await t.sql("SELECT * FROM email_outbox WHERE to_addr='b@contoh.co.id'");
      ok(m.status === 'terkirim' && m.attempts === 3, `status akhir terkirim setelah 3 percobaan (${m.attempts})`);
      const [c] = await t.sql("SELECT * FROM email_outbox WHERE to_addr='c@contoh.co.id'");
      ok(c.status === 'gagal' && c.body === null, 'email rahasia yang gagal tidak bisa dikirim ulang (isi tidak disimpan)');
      const rs = await mailer.resend(c.id);
      ok(!rs.ok && /tidak disimpan/.test(rs.message), 'kirim ulang email rahasia ditolak dengan penjelasan');
      smtp.reject = true;
      await mailer.sendMail('d@contoh.co.id', 'Manual', 'Halo D');
      await settled('d@contoh.co.id');
      smtp.reject = false;
      const [d] = await t.sql("SELECT id FROM email_outbox WHERE to_addr='d@contoh.co.id'");
      ok((await mailer.resend(d.id)).ok, 'kirim ulang manual berhasil');
      ok(!(await mailer.resend(d.id)).ok, 'yang sudah terkirim tidak dikirim ulang');
    } finally {
      process.env = keep;
      require.cache[mpath] = original;
      smtp.server.close();
    }

    // --- Log Email (Super Admin)
    r = await call(sa, 'GET', '/superadmin/emails');
    ok(r.s === 200 && r.j.rows.length > 5 && r.j.counts.terkirim >= 3 && r.j.smtp === false, 'daftar log email + ringkasan status');
    ok(r.j.rows.every((x) => !('body' in x)), 'isi email tidak dikirim ke daftar');
    const failed = r.j.rows.find((x) => x.status === 'gagal');
    ok(failed && failed.can_resend === false, 'email rahasia gagal: tidak bisa kirim ulang');
    r = await call(sa, 'POST', `/superadmin/emails/${r.j.rows.find((x) => x.status === 'dilewati' && x.can_resend).id}/resend`);
    ok(r.s === 400 && /SMTP belum diatur/.test(r.j.message), 'kirim ulang tanpa SMTP: pesan jelas');
    ok((await call(budi, 'GET', '/superadmin/emails')).s === 403, 'Log Email khusus Super Admin');
  },
};
