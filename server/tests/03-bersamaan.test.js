/** Kondisi bersamaan & data: nomor invoice tidak kembar, klik ganda, zona waktu WIB, hapus admin yang punya riwayat. */
module.exports = {
  name: 'Bersamaan, zona waktu, hapus pengguna',
  async run(t) {
    const { ok, call, pdf } = t;
    const sa = await t.tok('superadmin@penilaistandaruji.com');
    const rina = await t.tok('rina@sinarcontoh.co.id');

    // dua pengajuan lab fisika baru, dimajukan ke tahap pembayaran
    const prod = (await call(rina, 'GET', '/public/services/FIS/scope')).j.find((x) => x.custom_name);
    const ids = [];
    for (const name of ['Panci A', 'Panci B']) {
      const f = new FormData(); f.append('service_code', 'FIS');
      f.append('data', JSON.stringify({ product_id: prod.id, custom_product: name, custom_params: ['Kekerasan'], sample: { quantity: 1 }, fields: {}, confirm_duplicate: true }));
      f.append('documents', pdf(), 'sp.pdf'); f.append('doc_types', JSON.stringify(['Surat Permohonan Pengujian']));
      const r = await call(rina, 'POST', '/applications', null, f);
      ok(r.s === 201, `ajukan ${name} ${r.s} ${r.j.message || ''}`);
      ids.push(r.j.id);
    }
    for (const id of ids) {
      for (let i = 0; i < 4; i++) {
        const a = await t.adminApp(sa, id);
        if (a.current_step.is_payment_step) break;
        await t.approve(sa, id, a.current_step.order, { sample_code: `S-${id}` });
      }
    }
    const steps = await Promise.all(ids.map((id) => t.adminApp(sa, id)));
    ok(steps.every((a) => a.current_step.is_payment_step), `keduanya di tahap bayar (${steps.map((a) => a.current_step.code)})`);
    const drafts = await Promise.all(ids.map((id) => call(sa, 'GET', `/admin/applications/${id}/invoice-draft`)));
    const body = (i) => ({ step: steps[i].current_step.order, items: [], custom_prices: { [drafts[i].j.lab_lines[0].key]: 100000 }, with_pph23: false });
    // terbit bersamaan untuk dua pengajuan berbeda: nomor tidak boleh kembar
    const res = await Promise.all(ids.map((id, i) => call(sa, 'POST', `/admin/applications/${id}/invoice`, body(i))));
    const nos = res.map((r) => r.j.payment?.invoice_no);
    ok(res.every((r) => r.s === 200) && nos[0] && nos[0] !== nos[1], `nomor invoice beda: ${nos} ${res.map((r) => r.j.message || '')}`);
    // klik ganda pada pengajuan yang sama: tetap satu invoice
    const dbl = await Promise.all([0, 1].map(() => call(sa, 'POST', `/admin/applications/${ids[0]}/invoice`, body(0))));
    ok(dbl.every((r) => r.s === 200) && dbl.every((r) => r.j.payment.invoice_no === nos[0]), `klik ganda: nomor tetap ${dbl.map((r) => r.j.payment?.invoice_no)}`);

    // zona waktu: created_at pengajuan baru = jam WIB sekarang
    const a0 = await t.adminApp(sa, ids[0]);
    const wib = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' }).format(new Date()).replace(' ', 'T');
    ok(String(a0.created_at).replace(' ', 'T').slice(0, 13) === wib.slice(0, 13), `created_at WIB (${a0.created_at} vs ${wib})`);

    // status sertifikat tampil di detail pengajuan
    const done = (await call(sa, 'GET', '/admin/applications')).j.find((x) => x.application_no === 'PSU-SP-2608-0003');
    const c = (await call(sa, 'GET', '/certificates')).j.find((x) => x.application_no === 'PSU-SP-2608-0003');
    await call(sa, 'PUT', `/certificates/silapp/${c.id}`, { issued_at: c.issued_at, expires_at: c.expires_at, status: 'ditangguhkan', reason: 'Surveilan tertunda' });
    const cust = (await call(rina, 'GET', `/applications/${done.id}`)).j;
    ok(cust.certificate?.state === 'ditangguhkan' && cust.certificate.can_download === true, `pelanggan melihat status ditangguhkan, tetap bisa unduh (${cust.certificate?.state})`);

    // hapus admin yang punya riwayat: dinonaktifkan, bukan error
    const users = (await call(sa, 'GET', '/superadmin/users')).j;
    const tono = (users.rows || users).find((u) => u.email === 'tono@penilaistandaruji.com');
    const r = await call(sa, 'DELETE', `/superadmin/users/${tono.id}`);
    ok(r.s === 200, `hapus admin ${r.s} ${r.j.message || ''}`);
  },
};
