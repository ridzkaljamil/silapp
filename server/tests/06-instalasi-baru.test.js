/**
 * Server baru (database bersih, seperti hasil import silapp-init.sql): Super Admin pertama dari .env, template dokumen,
 * lalu satu alur lab lengkap dari akun baru sampai LHU diunduh.
 */
module.exports = {
  name: 'Instalasi baru (database bersih)',
  seed: 'bersih',
  async run(t) {
    const { ok, call, pdf } = t;
    // migrasi data satu kali yang dijalankan server saat pertama menyala + akun Super Admin dari .env
    await t.sql("DELETE FROM settings WHERE skey='migr:template_dokumen'");
    await require('../src/config/migrate')();
    ok(!(await t.sql("SELECT id FROM users WHERE role='superadmin'")).length, 'database bersih tanpa akun');
    Object.assign(process.env, { SUPERADMIN_EMAIL: 'Admin@PenilaiStandarUji.com', SUPERADMIN_PASSWORD: 'UjiCoba#2026' });
    try { await require('../src/config/superadmin')(); } finally { Object.assign(process.env, { SUPERADMIN_EMAIL: '', SUPERADMIN_PASSWORD: '' }); }
    const saL = await t.login('admin@penilaistandaruji.com', 'UjiCoba#2026');
    ok(saL.user?.role === 'superadmin', 'login Super Admin dari .env');
    const sa = saL.token;

    let r = await call(sa, 'GET', '/superadmin/invoice-settings');
    ok(r.s === 200 && JSON.stringify(r.j).includes('43.419.874.3-008.000'), `identitas invoice terisi ${r.s}`);
    r = await call(sa, 'GET', '/templates');
    ok(r.s === 200 && r.j.length === 3, `3 template dokumen (${r.j.length})`);
    const tpl = await t.raw(sa, `/templates/${r.j[0].id}/download`);
    ok(tpl.s === 200 && tpl.buf.slice(0, 2).toString() === 'PK' && tpl.buf.length > 30000, `unduh template ${tpl.s} ${tpl.buf.length}`);
    ok((await call(sa, 'GET', '/admin/applications')).j.length === 0, 'antrean kosong (tanpa data contoh)');
    ok((await call(sa, 'GET', '/certificates')).s === 200, 'data sertifikat');

    // admin lab + pelanggan baru
    const adm = { role: 'admin', name: 'Admin Lab Uji', email: 'lab@penilaistandaruji.com', jabatan: 'Admin Lab', bidang: 'LAB', password: 'AdminLab#2026' };
    ok((await call(sa, 'POST', '/superadmin/users', adm)).s === 201, 'buat admin');
    const cust = { name: 'Pelanggan Uji', email: 'pelanggan@contoh.co.id', company_name: 'PT Uji Coba', phone: '081200000000', address: 'Jl. Uji 1', nib: '9120001234567', npwp: '0123456789012345' };
    r = await call(sa, 'POST', '/customers', cust);
    ok(r.s === 201, `buat pelanggan ${r.s} ${r.j.message || ''}`);
    const temp = ((t.lastMail(cust.email) || '').match(/Kata sandi sementara: (\S+)/) || [])[1];
    ok(temp && temp === r.j.temp_password, 'email berisi sandi sementara');
    const cl = await t.login(cust.email, temp);
    ok(cl.user?.must_change_password === true, 'wajib ganti sandi');
    ok((await call(cl.token, 'GET', '/applications')).s === 403, 'belum ganti sandi: fitur lain ditolak');
    r = await call(cl.token, 'POST', '/auth/change-password', { old_password: temp, new_password: 'Pelanggan#2026' });
    ok(r.s === 200 && r.j.user.must_change_password === false, `ganti sandi ${r.s}`);
    const cu = r.j.token;
    const al = await t.tok(adm.email, adm.password);

    // pengajuan lab kimia paket sampai LHU
    const kim = (await call(cu, 'GET', '/public/services/KIM/scope')).j.find((x) => x.package_price);
    const fk = new FormData(); fk.append('service_code', 'KIM');
    fk.append('data', JSON.stringify({ product_id: kim.id, full_sni: true, sample: { quantity: 2 }, fields: {}, specs: ['MEREK A / Tipe 1'] }));
    fk.append('documents', pdf(), 'sp.pdf'); fk.append('doc_types', JSON.stringify(['Surat Permohonan Pengujian']));
    r = await call(cu, 'POST', '/applications', null, fk);
    ok(r.s === 201 && /^SLP\d\d-/.test(r.j.tracking_code), `ajukan KIM ${r.s} ${r.j.message || ''}`);
    const { id } = r.j; const code = r.j.tracking_code;
    ok((await call(null, 'GET', `/public/track/${code}`)).s === 200, 'lacak publik');
    const step = () => t.adminApp(al, id);
    const act = async (extra = {}) => t.approve(al, id, (await step()).current_step.order, extra);
    r = await act(); ok(r.s === 200, `LAB-01 ${r.s} ${r.j.message || ''}`);
    let a = await step();
    if (a.current_step.code === 'LAB-02') { await act({ sample_code: 'NPK-01' }); a = await step(); }
    ok(a.current_step.is_payment_step, `sampai tahap pembayaran (${a.current_step.code})`);
    r = await t.offer(al, id, a.current_step.order, 'full');
    ok(r.s === 200, `penawaran & kontrak ${r.s} ${r.j.message || ''}`);
    r = await call(al, 'POST', `/admin/applications/${id}/invoice`, { step: a.current_step.order, items: [], custom_prices: {}, with_pph23: false });
    ok(r.s === 200 && /^001\/PSU\/KIM\/[IVX]+\/\d{4}$/.test(r.j.payment?.invoice_no || ''), `invoice pertama 001 (${r.j.payment?.invoice_no} ${r.j.message || ''})`);
    const inv = await t.raw(cu, `/applications/${id}/invoice`);
    ok(inv.s === 200 && (inv.h.get('content-type') || '').includes('pdf'), `unduh invoice PDF ${inv.s}`);
    const fp = new FormData(); fp.append('proof', pdf(), 'bukti.pdf');
    ok((await call(cu, 'POST', `/applications/${id}/payment`, null, fp)).s === 200, 'unggah bukti');
    r = await call(al, 'POST', `/admin/applications/${id}/payment/verify`, { step: a.current_step.order, valid: true }); ok(r.s === 200, `verifikasi ${r.s} ${r.j.message || ''}`);
    for (let guard = 0; guard < 10; guard++) {
      a = await step();
      if (a.current_step.is_billing_step) break;
      for (const p of a.parameters || []) if (p.status !== 'selesai') await call(al, 'PATCH', `/admin/applications/${id}/parameters/${p.id}`, { status: 'selesai' });
      const extra = a.current_step.is_certificate_step ? { certificate_no: 'LHU-UJI-0001', certificate: pdf() } : {};
      r = await t.approve(al, id, a.current_step.order, extra);
      if (r.s !== 200) { ok(false, `tahap ${a.current_step.code}: ${r.s} ${r.j.message}`); break; }
    }
    a = await step();
    ok(a.status === 'aktif' && a.current_step.code === 'LAB-08' && a.work_done, `LHU terbit → tahap Invoice & Faktur (${a.status} ${a.current_step.code})`);
    ok((await call(cu, 'GET', `/applications/${id}/certificate`)).s === 403, 'LHU terkunci sebelum survei');
    const sv = (await call(cu, 'GET', `/applications/${id}/survey`)).j;
    const scores = Object.fromEntries((sv.questions || []).map((q) => [q.id, 5]));
    r = await call(cu, 'POST', `/applications/${id}/survey`, { scores, respondent_name: 'Pelanggan Uji', company_name: 'PT Uji Coba', reference_no: code, suggestion: 'ok', contact_ok: false });
    ok(r.s === 200, `isi survei ${r.s} ${r.j.message || ''}`);
    const out = await t.sql("SELECT attachments FROM email_outbox WHERE to_addr=? AND subject LIKE '%Penyampaian dokumen%'", [cust.email]);
    ok(out.length === 1 && /LHU-UJI-0001\.pdf/.test(out[0].attachments), 'email LHU dengan lampiran tercatat');
    const lhu = await t.raw(cu, `/applications/${id}/certificate`);
    ok(lhu.s === 200 && lhu.buf.slice(0, 4).toString() === '%PDF', `unduh LHU ${lhu.s}`);
    ok((await t.raw(sa, '/superadmin/survey/export?format=xlsx')).s === 200, 'ekspor survei');
    // skema Full tanpa PPh 23: tahap akhir selesai begitu invoice & faktur dikirim
    r = await t.billing(al, id, a.current_step.order, { note: 'Terima kasih.' });
    ok(r.s === 200 && r.j.status === 'selesai' && r.j.billing.pay.status === 'tidak_perlu' && r.j.billing.cut.status === 'tidak_perlu', `invoice & faktur → selesai (${r.s} ${r.j.status} ${r.j.message || ''})`);
  },
};
