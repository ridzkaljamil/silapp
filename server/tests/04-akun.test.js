/** Keamanan akun: sesi lama keluar setelah ganti/reset sandi, lupa kata sandi lewat email, data pelanggan ganda. */
module.exports = {
  name: 'Akun & kata sandi',
  async run(t) {
    const { ok, call } = t;
    const sa = await t.tok('superadmin@penilaistandaruji.com');
    const email = 'rina@sinarcontoh.co.id';

    // --- ganti sandi: sesi di perangkat lain keluar, perangkat ini dapat token baru
    const hp = await t.tok(email);
    const laptop = await t.tok(email);
    let r = await call(laptop, 'POST', '/auth/change-password', { old_password: 'password123', new_password: 'SandiBaru#1' });
    ok(r.s === 200 && r.j.token && r.j.user, 'ganti sandi mengembalikan token baru');
    const fresh = r.j.token;
    r = await call(hp, 'GET', '/auth/me');
    ok(r.s === 401 && /sudah diganti/.test(r.j.message), `sesi lama keluar (${r.s} ${r.j.message})`);
    ok((await call(fresh, 'GET', '/auth/me')).s === 200, 'token baru tetap berlaku');
    ok((await call(fresh, 'POST', '/auth/change-password', { old_password: 'SandiBaru#1', new_password: 'pendek' })).s === 400, 'sandi baru minimal 8 karakter');

    // --- lupa kata sandi
    r = await call(null, 'POST', '/auth/forgot-password', { email: 'tidak-ada@contoh.co.id' });
    ok(r.s === 200 && /Jika email terdaftar/.test(r.j.message), 'email tak terdaftar: jawaban sama (tidak membocorkan akun)');
    ok(!t.lastMail('tidak-ada@contoh.co.id'), 'tidak ada email ke alamat tak terdaftar');
    ok((await call(null, 'POST', '/auth/forgot-password', { email: 'bukan-email' })).s === 400, 'format email salah ditolak');
    r = await call(null, 'POST', '/auth/forgot-password', { email: email.toUpperCase() });
    ok(r.s === 200, 'minta tautan reset');
    const mail = t.lastMail(email) || '';
    const token = (mail.match(/reset-sandi\?token=([a-f0-9]{64})/) || [])[1];
    ok(!!token && /berlaku 30 menit/.test(mail), 'email berisi tautan reset 30 menit');
    const stored = await t.sql("SELECT body FROM email_outbox WHERE to_addr=? AND subject LIKE '%kata sandi baru%'", [email]);
    ok(stored.length === 1 && stored[0].body === null, 'isi email reset tidak disimpan di log');
    ok(!(await t.sql('SELECT id FROM password_resets WHERE token_hash=?', [token])).length, 'token disimpan dalam bentuk hash');
    await call(null, 'POST', '/auth/forgot-password', { email });
    ok((t.mails.filter((m) => m.includes(`ke=${email} `) && /reset-sandi/.test(m))).length === 1, 'permintaan ulang dalam 2 menit tidak mengirim email lagi');

    r = await call(null, 'GET', `/auth/reset-password/${token}`);
    ok(r.s === 200 && r.j.email === email, 'cek tautan reset');
    ok((await call(null, 'GET', `/auth/reset-password/${'0'.repeat(64)}`)).s === 400, 'tautan palsu ditolak');
    ok((await call(null, 'POST', '/auth/reset-password', { token, new_password: '123' })).s === 400, 'reset: sandi pendek ditolak');
    r = await call(null, 'POST', '/auth/reset-password', { token, new_password: 'DariEmail#2026' });
    ok(r.s === 200, `reset sandi lewat email (${r.j.message})`);
    ok((await call(fresh, 'GET', '/auth/me')).s === 401, 'reset sandi mengeluarkan semua sesi');
    ok((await call(null, 'POST', '/auth/reset-password', { token, new_password: 'LagiLagi#2026' })).s === 400, 'tautan hanya sekali pakai');
    ok(!!(await t.tok(email, 'DariEmail#2026')), 'masuk dengan sandi baru');
    // tautan kedaluwarsa
    await t.sql('DELETE FROM password_resets');
    await call(null, 'POST', '/auth/forgot-password', { email: 'budi@penilaistandaruji.com' });
    const tk2 = ((t.lastMail('budi@penilaistandaruji.com') || '').match(/token=([a-f0-9]{64})/) || [])[1];
    await t.sql('UPDATE password_resets SET expires_at = NOW() - INTERVAL 1 MINUTE');
    ok((await call(null, 'POST', '/auth/reset-password', { token: tk2, new_password: 'Kedaluwarsa#1' })).s === 400, 'tautan kedaluwarsa ditolak');
    // pembatasan per IP: maks. 5 permintaan / 15 menit
    let limited = false;
    for (let i = 0; i < 6; i++) if ((await call(null, 'POST', '/auth/forgot-password', { email: `x${i}@contoh.co.id` })).s === 429) limited = true;
    ok(limited, 'permintaan reset dibatasi');

    // --- reset oleh Admin & ganti sandi oleh Super Admin juga mengeluarkan sesi lama
    const cust = (await call(sa, 'GET', '/customers')).j.find((c) => c.email === email);
    const before = await t.tok(email, 'DariEmail#2026');
    r = await call(sa, 'POST', `/customers/${cust.id}/reset-password`);
    ok(r.s === 200 && (await call(before, 'GET', '/auth/me')).s === 401, 'reset oleh Admin: sesi pelanggan keluar');
    const budi = await t.tok('budi@penilaistandaruji.com');
    const users = (await call(sa, 'GET', '/superadmin/users')).j;
    const bu = (users.rows || users).find((u) => u.email === 'budi@penilaistandaruji.com');
    await call(sa, 'PUT', `/superadmin/users/${bu.id}`, { ...bu, password: 'SandiAdmin#9' });
    ok((await call(budi, 'GET', '/auth/me')).s === 401, 'sandi admin diganti Super Admin: sesi admin keluar');
    await call(sa, 'PUT', `/superadmin/users/${bu.id}`, { ...bu });
    ok(!!(await t.tok('budi@penilaistandaruji.com', 'SandiAdmin#9')), 'ubah data tanpa sandi tidak mengganti sandi');

    // --- data pelanggan ganda (NPWP sama), ubah data pelanggan
    const base = { name: 'Cabang Bekasi', email: 'cabang@sinarcontoh.co.id', company_name: 'PT Sinar Contoh Abadi', phone: '0812000111', address: 'Bekasi', nib: '9999999999999', npwp: '0123456789012345' };
    r = await call(sa, 'POST', '/customers', base);
    ok(r.s === 409 && r.j.code === 'DUPLICATE_COMPANY' && /^NPWP/.test(r.j.message), `NPWP sama: peringatan (${r.j.message})`);
    r = await call(sa, 'POST', '/customers', { ...base, confirm_duplicate: true });
    ok(r.s === 201, 'tetap simpan setelah konfirmasi');
    const cab = (await call(sa, 'GET', '/customers')).j.find((c) => c.email === base.email);
    r = await call(sa, 'PUT', `/customers/${cab.id}`, { phone: '0812000222' });
    ok(r.s === 200, 'ubah data lain tanpa mengganti NIB/NPWP tidak perlu konfirmasi');
    r = await call(sa, 'PUT', `/customers/${cab.id}`, { nib: '9120001234567' });
    ok(r.s === 409 && /NIB dan NPWP/.test(r.j.message), 'ganti NIB jadi milik akun lain: peringatan');
  },
};
