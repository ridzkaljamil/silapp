/** Sertifikat: status & masa berlaku, riwayat + alasan, tampil di Directory, larangan unduh sertifikat dicabut, penerbitan lewat tahapan. */
module.exports = {
  name: 'Sertifikat & Directory',
  async run(t) {
    const { ok, call, pdf, today, plus } = t;
    const sa = await t.tok('superadmin@penilaistandaruji.com');
    const budi = await t.tok('budi@penilaistandaruji.com');
    const sari = await t.tok('sari@penilaistandaruji.com');
    const rina = await t.tok('rina@sinarcontoh.co.id');
    const td = today();
    const certs = async (tok = sa) => (await call(tok, 'GET', '/certificates')).j;

    let rows = await certs();
    const by = (no) => rows.find((x) => x.certificate_no === no);
    ok(by('PSU-SPPT-2023-0012')?.state === 'aktif', 'aktif');
    ok(by('PSU-SPPT-2024-0045')?.state === 'ditangguhkan', 'ditangguhkan');
    ok(by('PSU-SPPT-2022-0031')?.state === 'berakhir' && by('PSU-SPPT-2022-0031').status === 'aktif', 'aktif tapi lewat tanggal = berakhir');
    ok(by('PSU-SPPT-2021-0007')?.state === 'dicabut', 'dicabut tetap dicabut walau lewat');
    ok(by('PSU-SPPT-2026-0001')?.expires_at && by('PSU-SPPT-2026-0001').source === 'silapp', 'sertifikat SILAPP punya tanggal berakhir');
    ok(rows.every((x) => typeof x.show_in_directory === 'boolean'), 'kolom tampil di Directory');
    ok((await call(sari, 'GET', '/certificates')).s === 403, 'admin lab tidak boleh');

    const pub = await call(null, 'GET', '/public/directory');
    ok(pub.s === 200 && pub.j.every((x) => x.state && 'expires_at' in x && !('status' in x)), 'directory publik: state + expires_at');
    ok(pub.j.find((x) => x.certificate_no === 'PSU-SPPT-2022-0031').state === 'berakhir', 'directory: berakhir');

    // --- proyek lama: validasi tanggal
    const base = { factory_name: 'PT Uji', factory_address: 'Bekasi', product: 'Teh', sni_no: 'SNI 1', certificate_no: `PSU-T-${Date.now()}`, issued_at: '2025-01-10', status: 'aktif' };
    let r = await call(budi, 'POST', '/certificates/legacy', base);
    ok(r.s === 400 && /wajib/.test(r.j.message), 'tanggal berakhir wajib');
    r = await call(budi, 'POST', '/certificates/legacy', { ...base, expires_at: '2025-01-10' });
    ok(r.s === 400 && /setelah/.test(r.j.message), 'berakhir harus setelah terbit');
    r = await call(budi, 'POST', '/certificates/legacy', { ...base, issued_at: plus(td, 2), expires_at: plus(td, 400) });
    ok(r.s === 400 && /hari ini/.test(r.j.message), 'terbit tidak boleh di masa depan');
    r = await call(budi, 'POST', '/certificates/legacy', { ...base, issued_at: '2025-02-30', expires_at: '2029-01-01' });
    ok(r.s === 400, 'tanggal tidak valid');
    r = await call(budi, 'POST', '/certificates/legacy', { ...base, expires_at: '2029-01-09', status: 'xyz' });
    ok(r.s === 201, `tambah proyek lama ${r.s} ${r.j.message || ''}`);
    rows = await certs(budi);
    let row = rows.find((x) => x.certificate_no === base.certificate_no);
    ok(row.status === 'aktif' && row.expires_at === '2029-01-09' && row.show_in_directory === true, 'status tak dikenal jadi aktif, tampil di Directory');

    // --- alasan wajib saat ditangguhkan / dicabut, tercatat di riwayat
    r = await call(budi, 'PUT', `/certificates/legacy/${row.id}`, { ...row, status: 'ditangguhkan' });
    ok(r.s === 400 && /Alasan ditangguhkan wajib/.test(r.j.message), `ditangguhkan tanpa alasan ditolak (${r.j.message})`);
    r = await call(budi, 'PUT', `/certificates/legacy/${row.id}`, { ...row, status: 'ditangguhkan', reason: 'Hasil surveilan tidak sesuai' });
    row = (await certs(budi)).find((x) => x.id === row.id && x.source === 'lama');
    ok(r.s === 200 && row.state === 'ditangguhkan', 'ubah status ditangguhkan dengan alasan');
    r = await call(budi, 'PUT', `/certificates/legacy/${row.id}`, { ...row, status: 'ditangguhkan', expires_at: '2029-02-01', show_in_directory: false });
    ok(r.s === 200, 'ubah data tanpa ganti status tidak perlu alasan');
    const hist = (await call(budi, 'GET', `/certificates/legacy/${row.id}/history`)).j;
    ok(hist.length === 4 && hist.some((h) => h.action === 'status' && h.note === 'Hasil surveilan tidak sesuai' && /Admin/.test(h.pic_label))
      && hist.some((h) => h.action === 'ubah' && /2029-01-09 → 2029-02-01/.test(h.note)) && hist.some((h) => h.action === 'tampil') && hist.some((h) => h.action === 'terbit'),
    `riwayat: terbit, status+alasan, ubah tanggal, tampil (${hist.map((h) => h.action)})`);
    ok(!(await call(null, 'GET', '/public/directory')).j.some((x) => x.certificate_no === base.certificate_no), 'disembunyikan dari Directory publik');
    ok((await call(budi, 'GET', '/certificates/xyz/1/history')).s === 404, 'sumber riwayat tak dikenal 404');
    await call(budi, 'DELETE', `/certificates/legacy/${row.id}`);
    ok(!(await t.sql("SELECT id FROM certificate_logs WHERE source='lama' AND cert_id=?", [row.id])).length, 'hapus proyek lama ikut menghapus riwayatnya');

    // --- sertifikat SILAPP
    const sc = (await certs()).find((x) => x.source === 'silapp');
    r = await call(sa, 'PUT', `/certificates/silapp/${sc.id}`, { issued_at: sc.issued_at, expires_at: '', status: 'aktif' });
    ok(r.s === 400, 'SILAPP: berakhir wajib');
    r = await call(sa, 'PUT', `/certificates/silapp/${sc.id}`, { issued_at: plus(td, -10), expires_at: plus(td, -1), status: 'aktif' });
    let s2 = (await certs()).find((x) => x.id === sc.id && x.source === 'silapp');
    ok(r.s === 200 && s2.state === 'berakhir', 'SILAPP: lewat kemarin = berakhir');
    r = await call(sa, 'PUT', `/certificates/silapp/${sc.id}`, { issued_at: sc.issued_at, expires_at: td, status: 'dicabut', reason: 'Pelanggaran penggunaan tanda SNI' });
    s2 = (await certs()).find((x) => x.id === sc.id && x.source === 'silapp');
    ok(s2.state === 'dicabut' && s2.expires_at === td, 'SILAPP: dicabut, berakhir hari ini');

    // pelanggan dikabari + tidak bisa mengunduh sertifikat yang dicabut
    const notif = (await call(rina, 'GET', '/notifications')).j;
    const list = notif.rows || notif.items || notif;
    ok(JSON.stringify(list).includes('Status sertifikat: Dicabut'), 'notifikasi pelanggan: status dicabut');
    ok(/DICABUT/.test(t.lastMail('rina@sinarcontoh.co.id') || '') && /Pelanggaran penggunaan tanda SNI/.test(t.lastMail('rina@sinarcontoh.co.id')), 'email pelanggan berisi alasan');
    const det = (await call(rina, 'GET', `/applications/${sc.application_id}`)).j;
    ok(det.certificate.state === 'dicabut' && det.certificate.can_download === false && det.certificate.status_note === 'Pelanggaran penggunaan tanda SNI', 'detail pelanggan: dicabut + alasan, tidak bisa unduh');
    r = await call(rina, 'GET', `/applications/${sc.application_id}/certificate`);
    ok(r.s === 403 && r.j.code === 'CERT_REVOKED', `unduh sertifikat dicabut ditolak (${r.s})`);
    r = await t.raw(sa, `/admin/applications/${sc.application_id}/certificate`);
    ok(r.s === 200, 'Admin tetap bisa membuka arsip sertifikat dicabut');
    const trk = (await call(null, 'GET', `/public/track/${det.tracking_code}`)).j;
    ok(!trk.certificate?.status_note, 'lacak publik tidak menampilkan alasan');

    r = await call(sa, 'PUT', `/certificates/silapp/${sc.id}`, { issued_at: sc.issued_at, expires_at: td, status: 'aktif' });
    s2 = (await certs()).find((x) => x.id === sc.id && x.source === 'silapp');
    ok(s2.state === 'aktif', 'aktif kembali tanpa alasan; berakhir hari ini masih aktif');
    r = await call(sa, 'PUT', `/certificates/silapp/${sc.id}`, { issued_at: sc.issued_at, expires_at: td, status: 'aktif', show_in_directory: false });
    ok(!(await call(null, 'GET', '/public/directory')).j.some((x) => x.certificate_no === sc.certificate_no), 'SILAPP disembunyikan dari Directory');
    ok((await call(sa, 'PUT', '/certificates/silapp/999999', { issued_at: sc.issued_at, expires_at: td, status: 'aktif' })).s === 404, 'SILAPP: id tidak ada 404');
    const sh = (await call(sa, 'GET', `/certificates/silapp/${sc.id}/history`)).j;
    ok(sh.filter((h) => h.action === 'status').length === 2 && sh.some((h) => h.action === 'tampil'), 'riwayat SILAPP tercatat');

    // --- terbitkan sertifikat SP lewat tahapan (pengajuan Tipe 1b di tahap Sampling)
    const app = (await call(sa, 'GET', '/admin/applications')).j.find((x) => x.application_no === 'PSU-SP-2610-0004');
    let a = await t.adminApp(sa, app.id);
    while (!a.current_step.is_certificate_step) {
      r = await t.approve(sa, app.id, a.current_step.order);
      if (r.s !== 200) { ok(false, `maju ${a.current_step.code} ${r.j.message}`); break; }
      a = await t.adminApp(sa, app.id);
    }
    const issue = (extra) => {
      const fd = new FormData(); fd.append('action', 'setujui'); fd.append('step', a.current_step.order); fd.append('certificate_no', 'PSU-SPPT-UJI-9001'); fd.append('certificate', pdf(), 's.pdf');
      for (const [k, v] of Object.entries(extra)) fd.append(k, v);
      return call(sa, 'POST', `/admin/applications/${app.id}/action`, null, fd);
    };
    r = await issue({ issued_at: td }); ok(r.s === 400 && /berakhir wajib/.test(r.j.message), `terbit SP tanpa berakhir ditolak (${r.j.message})`);
    r = await issue({ issued_at: plus(td, 1), expires_at: plus(td, 900) }); ok(r.s === 400 && /hari ini/.test(r.j.message), 'terbit masa depan ditolak');
    r = await issue({ issued_at: td, expires_at: td }); ok(r.s === 400 && /setelah/.test(r.j.message), 'berakhir = terbit ditolak');
    r = await issue({ issued_at: plus(td, -3), expires_at: plus(td, 1457) });
    ok(r.s === 200 && r.j.status === 'aktif' && r.j.current_step.is_billing_step && r.j.work_done && r.j.certificate.expires_at === plus(td, 1457) && r.j.certificate.issued_at === plus(td, -3), `terbit SP dengan tanggal (${r.s} ${r.j.message || ''})`);
    const dir = (await call(null, 'GET', '/public/directory')).j.find((x) => x.certificate_no === 'PSU-SPPT-UJI-9001');
    ok(dir && dir.state === 'aktif' && dir.expires_at === plus(td, 1457), 'tampil di directory dengan tanggal berakhir');
    const newCert = (await certs()).find((x) => x.certificate_no === 'PSU-SPPT-UJI-9001');
    const nh = (await call(sa, 'GET', `/certificates/silapp/${newCert.id}/history`)).j;
    ok(nh.length === 1 && nh[0].action === 'terbit' && nh[0].pic_label === 'Super Admin PSU', 'riwayat: terbit lewat pengajuan');
  },
};
