/** Alur lengkap: akun pelanggan, pengajuan SP Tipe 1b, invoice, temuan, laboratorium, harga, form builder, lacak. */
module.exports = {
  name: 'Alur pengajuan end-to-end',
  async run(t) {
    const { ok, call, pdf } = t;
    const sa = await t.tok('superadmin@penilaistandaruji.com');
    const rinaLogin = await t.login('rina@sinarcontoh.co.id');
    const rina = rinaLogin.token;
    ok(rinaLogin.user.nib === '9120001234567' && rinaLogin.user.npwp === '0123456789012345', 'login berisi NIB/NPWP');

    // --- akun pelanggan: NIB & NPWP terpisah
    const base = { name: 'Budi Uji', email: `uji${Date.now()}@contoh.co.id`, company_name: 'PT Uji', phone: '0812345678', address: 'Jl. Uji 1' };
    let r = await call(sa, 'POST', '/customers', { ...base, nib: '123', npwp: '0123456789012345' });
    ok(r.s === 400 && /NIB/.test(r.j.message), 'NIB salah ditolak');
    r = await call(sa, 'POST', '/customers', { ...base, nib: '9120001234567', npwp: '12' });
    ok(r.s === 400 && /NPWP/.test(r.j.message), 'NPWP salah ditolak');
    r = await call(sa, 'POST', '/customers', { ...base, nib: '912.000.123.4567', npwp: '01.234.567.8-901.234' });
    ok(r.s === 409 && r.j.code === 'DUPLICATE_COMPANY' && /PT Sinar Contoh Abadi/.test(r.j.message), `NIB sama dengan akun lain: minta konfirmasi (${r.s} ${r.j.message || ''})`);
    r = await call(sa, 'POST', '/customers', { ...base, nib: '912.000.123.4567', npwp: '01.234.567.8-901.234', confirm_duplicate: true });
    ok(r.s === 201 && r.j.temp_password, `buat pelanggan setelah konfirmasi ${r.s} ${r.j.message || ''}`);
    ok(/Kata sandi sementara/.test(t.lastMail(base.email) || ''), 'email akun baru terkirim (simulasi)');
    const outbox = await t.sql('SELECT body, status FROM email_outbox WHERE to_addr=?', [base.email]);
    ok(outbox.length === 1 && outbox[0].body === null && outbox[0].status === 'dilewati', 'email berisi kata sandi: isinya tidak disimpan di log');
    r = await call(sa, 'GET', '/customers');
    const cu = r.j.find((x) => x.email === base.email);
    ok(cu && cu.nib === '9120001234567' && cu.npwp === '012345678901234', 'NIB/NPWP disimpan angka saja');

    // --- profil pelanggan: nama & telepon bisa diubah, alamat tidak
    r = await call(rina, 'PUT', '/auth/profile', { name: 'Rina H.', phone: '0811111111', address: 'diubah' });
    ok(r.s === 200 && r.j.user.name === 'Rina H.' && r.j.user.address.startsWith('Jl. Industri'), `profil pelanggan ${r.s}`);
    r = await call(rina, 'PUT', '/auth/profile', { name: 'Rina Hapsari', phone: '' });
    ok(r.s === 400, 'telepon wajib untuk pelanggan');
    await call(rina, 'PUT', '/auth/profile', { name: 'Rina Hapsari', phone: '0812-0000-0000' });

    // --- pengajuan SP Tipe 1b
    const scope = (await call(rina, 'GET', '/public/services/SP/scope')).j;
    const prod1b = scope.find((p) => /1b/i.test(p.scheme_types || ''));
    const form = (await call(rina, 'GET', '/public/services/SP/form')).j;
    const req1b = form.documents.filter((d) => d.required && !/1b/i.test(d.hide_schemes || ''));
    const mkApp = (data, docs) => { const fd = new FormData(); fd.append('service_code', 'SP'); fd.append('data', JSON.stringify(data)); docs.forEach(() => fd.append('documents', pdf(), 'a.pdf')); fd.append('doc_types', JSON.stringify(docs)); return fd; };
    const fields1b = { nama_pabrik: 'Pabrik X', alamat_pabrik: 'Jl X', kota_provinsi: 'Guangzhou', provinsi_pabrik: 'Guangdong', jumlah: '100 karton', pelabuhan: 'Nansha',
      batch: [{ no: 'BL-1', date: '2026-10-01' }, { no: 'BL-2', date: '2026-10-02' }], shipment: [{ no: 'PL-1', date: '2026-09-30' }], nomor_invoice: [{ no: 'INV-1', date: '2026-09-30' }] };
    const data1b = { product_id: prod1b.id, scheme: 'Tipe 1b', application_type: 'Sertifikasi Awal', origin: 'ln', brands: [{ merek: 'M', jenis: 'J' }], fields: fields1b, confirm_duplicate: true };
    r = await call(rina, 'POST', '/applications', null, mkApp({ ...data1b, fields: { ...fields1b, batch: [{ no: 'BL-1', date: '' }] } }, req1b.map((d) => d.name)));
    ok(r.s === 400 && /Tanggal/.test(r.j.message), `pasangan tanpa tanggal ditolak: ${r.j.message}`);
    r = await call(rina, 'POST', '/applications', null, mkApp(data1b, req1b.map((d) => d.name)));
    ok(r.s === 201, `pengajuan 1b tanpa 3 berkas diterima: ${r.s} ${r.j.message || ''}`);
    const id1b = r.j.id;
    r = await call(rina, 'GET', `/applications/${id1b}`);
    ok(r.j.flow === '1B' && r.j.steps.length === 9 && r.j.steps[4].name === 'Sampling' && r.j.steps[8].name === 'Invoice & Faktur', 'alur 1b dipakai');
    ok(r.j.details.find((d) => d.key === 'batch')?.value === 'BL-1 · 1 Okt 2026\nBL-2 · 2 Okt 2026', 'format nomor + tanggal');
    r = await call(rina, 'GET', `/applications/${id1b}/prefill`);
    ok(Array.isArray(r.j.payload.values.batch) && r.j.payload.values.batch[1].date === '2026-10-02', 'prefill nomor + tanggal');
    // Tipe 5 tetap wajib 3 berkas
    r = await call(rina, 'POST', '/applications', null, mkApp({ ...data1b, scheme: 'Tipe 5' }, req1b.map((d) => d.name)));
    ok(r.s === 400 && /wajib diunggah/.test(r.j.message), `Tipe 5 tetap wajib berkas: ${r.j.message}`);

    // --- alur 1b di sisi admin: majukan sampai ST-06, temuan ditolak, minta tindakan tidak loncat
    const step = (id) => t.adminApp(sa, id);
    let a = await step(id1b);
    const approve = async (id, order) => { const fd = new FormData(); fd.append('action', 'setujui'); fd.append('step', order); return call(sa, 'POST', `/admin/applications/${id}/action`, null, fd); };
    await approve(id1b, 1); await approve(id1b, 2);
    a = await step(id1b);
    ok(a.current_step.code === 'ST-03', 'maju ke ST-03');
    r = await call(sa, 'POST', `/admin/applications/${id1b}/invoice`, { step: 3, items: [{ label: 'x', qty: 1, price: 1 }] });
    ok(r.s === 400 && /skema pembayaran/.test(r.j.message), 'proforma ditolak sebelum skema & kontrak diatur');
    r = await t.offer(sa, id1b, 3, 'full');
    ok(r.s === 200 && r.j.payment_scheme === 'full' && r.j.contract?.doc_type === 'Persetujuan Penawaran / Kontrak', `atur penawaran & kontrak ${r.s} ${r.j.message || ''}`);
    r = await call(sa, 'POST', `/admin/applications/${id1b}/invoice`, { step: 3, items: [{ label: 'Sertifikasi', qty: 1, price: 10000000 }], with_pph23: true });
    ok(/^\d{3}\/PSU\/SP\/[IVX]+\/\d{4}$/.test(r.j.payment?.invoice_no || '') && !r.j.payment.invoice_no.startsWith('001'), `nomor invoice SP per layanan: ${r.j.payment?.invoice_no}`);
    r = await t.raw(sa, `/admin/applications/${id1b}/invoice`);
    ok(/Proforma-Invoice/.test(r.h.get('content-disposition') || '') && r.buf.slice(0, 4).toString() === '%PDF', 'nama file proforma');
    const txt = t.pdfText(r.buf);
    if (txt === null) t.skip(); else ok(/PROFORMA INVOICE/.test(txt) && /0123456789012345/.test(txt), 'PDF berjudul PROFORMA INVOICE dan NPWP pelanggan');
    const fdp = new FormData(); fdp.append('proof', pdf(), 'bukti.pdf');
    await call(rina, 'POST', `/applications/${id1b}/payment`, null, fdp);
    await call(sa, 'POST', `/admin/applications/${id1b}/payment/verify`, { valid: true, step: 3 });
    a = await step(id1b);
    if (a.current_step.code === 'ST-03') await approve(id1b, 3);
    await approve(id1b, 4); await approve(id1b, 5);
    a = await step(id1b);
    ok(a.current_step.code === 'ST-06', `di ST-06 (${a.current_step.code})`);
    r = await call(sa, 'POST', `/admin/applications/${id1b}/findings`, { report_date: '2026-10-10', items: [{ category: 'minor', description: 'x' }] });
    ok(r.s === 400 && /1b/.test(r.j.message), 'temuan ditolak untuk 1b');
    const fdm = new FormData(); fdm.append('action', 'minta_tindakan'); fdm.append('step', 6); fdm.append('note', 'Lengkapi data uji');
    r = await call(sa, 'POST', `/admin/applications/${id1b}/action`, null, fdm);
    a = await step(id1b);
    ok(a.status === 'aksi' && a.current_step.code === 'ST-06', 'minta tindakan di ST-06 tidak pindah tahap (1b)');
    const fdr = new FormData(); fdr.append('note', 'ok');
    await call(rina, 'POST', `/applications/${id1b}/reply`, null, fdr);
    await approve(id1b, 6);
    a = await step(id1b);
    ok(a.current_step.name === 'Review & Keputusan', `setelah ST-06 → ${a.current_step.name}`);
    await approve(id1b, 7);
    a = await step(id1b);
    ok(a.current_step.is_certificate_step && a.current_step.code === 'ST-08', 'ST-08 sertifikat');

    // --- temuan audit (pengajuan contoh di ST-06, alur utama)
    const list = (await call(rina, 'GET', '/applications')).j;
    const spApp = list.find((x) => x.application_no === 'PSU-SP-2609-0001');
    const det = (await call(rina, 'GET', `/applications/${spApp.id}`)).j;
    const fnd = det.findings.find((f) => f.category === 'minor');
    let fd = new FormData(); fd.append('correction', 'Sudah dilengkapi');
    r = await call(rina, 'POST', `/applications/${spApp.id}/findings/${fnd.id}/reply`, null, fd);
    ok(r.s === 400 && /Akar Penyebab/.test(r.j.message), `kolom wajib: ${r.j.message}`);
    fd = new FormData(); fd.append('correction', 'K'); fd.append('root_cause', 'A'); fd.append('corrective_action', 'T');
    r = await call(rina, 'POST', `/applications/${spApp.id}/findings/${fnd.id}/reply`, null, fd);
    ok(r.s === 400 && /file/.test(r.j.message), 'file bukti wajib');
    fd = new FormData(); fd.append('correction', 'K'); fd.append('root_cause', 'A'); fd.append('corrective_action', 'T'); fd.append('note', 'catatan'); fd.append('documents', pdf(), 'bukti.pdf');
    r = await call(rina, 'POST', `/applications/${spApp.id}/findings/${fnd.id}/reply`, null, fd);
    const f2 = r.j.findings?.find((f) => f.id === fnd.id);
    ok(r.s === 200 && f2.correction === 'K' && f2.root_cause === 'A' && f2.corrective_action === 'T' && f2.files.length === 1, 'bukti perbaikan tersimpan');
    fd = new FormData(); fd.append('reason', 'Butuh waktu'); fd.append('documents', pdf(), 'jadwal.pdf');
    r = await call(rina, 'POST', `/applications/${spApp.id}/findings/${fnd.id}/extension`, null, fd);
    const f3 = r.j.findings?.find((f) => f.id === fnd.id);
    ok(r.s === 200 && f3.extension_status === 'diajukan' && f3.extension_files.length === 1 && f3.files.length === 1, `perpanjangan + lampiran ${r.s} ${r.j.message || ''}`);
    r = await call(sa, 'GET', `/admin/applications/${spApp.id}`);
    ok(r.j.findings.find((f) => f.id === fnd.id).extension_files.length === 1, 'admin melihat lampiran perpanjangan');

    // --- edge: temuan ditutup saat perpanjangan masih diajukan tidak boleh tertahan di antrean
    r = await call(sa, 'PATCH', `/admin/applications/${spApp.id}/findings/${fnd.id}`, { op: 'tutup', note: 'cukup' });
    const qrow = (await call(sa, 'GET', '/admin/applications')).j.find((x) => x.id === spApp.id);
    ok(r.s === 200 && qrow.findings_review === (r.j.findings.filter((f) => f.status !== 'ditutup' && (f.status === 'dikirim' || f.extension_status === 'diajukan')).length), `findings_review abaikan temuan ditutup (${qrow.findings_review})`);

    // --- lab: produk di luar lingkup KAN
    const fis = (await call(rina, 'GET', '/public/services/FIS/scope')).j;
    const cp = fis.find((p) => p.custom_name);
    ok(!!cp, 'produk luar lingkup ada di Lab Fisika');
    const mkLab = (data) => { const f = new FormData(); f.append('service_code', 'FIS'); f.append('data', JSON.stringify(data)); f.append('documents', pdf(), 'sp.pdf'); f.append('doc_types', JSON.stringify(['Surat Permohonan Pengujian'])); return f; };
    r = await call(rina, 'POST', '/applications', null, mkLab({ product_id: cp.id, custom_params: ['Kekerasan'], sample: { quantity: 1 }, fields: {} }));
    ok(r.s === 400 && /nama produk/i.test(r.j.message), `nama produk wajib: ${r.j.message}`);
    r = await call(rina, 'POST', '/applications', null, mkLab({ product_id: cp.id, custom_product: 'Panci Enamel', custom_params: ['Kekerasan'], sample: { quantity: 2 }, fields: {}, confirm_duplicate: true }));
    ok(r.s === 201, `pengajuan produk luar lingkup ${r.s} ${r.j.message || ''}`);
    const labDet = (await call(rina, 'GET', `/applications/${r.j.id}`)).j;
    ok(/Panci Enamel/.test(labDet.product_label) && labDet.details.some((d) => d.key === 'nama_produk'), 'nama produk tersimpan');

    // --- invoice lab format PSU: metode, qty, brand/spesifikasi bernomor
    r = await call(rina, 'POST', '/applications', null, mkLab({ product_id: cp.id, custom_product: 'Panci Baja', custom_params: ['Kekerasan'], sample: { quantity: 3 }, specs: [{ brand: 'MEREK A', spec: 'Tipe 1' }, { brand: 'MEREK B', spec: '' }, { brand: '', spec: '' }], fields: {}, confirm_duplicate: true }));
    const labId = r.j.id;
    await approve(labId, 1);
    let la = await step(labId);
    if (la.current_step.order === 2) { const fd = new FormData(); fd.append('action', 'setujui'); fd.append('step', 2); fd.append('sample_code', 'PB-01'); r = await call(sa, 'POST', `/admin/applications/${labId}/action`, null, fd); la = await step(labId); }
    ok(la.current_step.code === 'LAB-03', `lab maju ke LAB-03 (${la.current_step.code} ${r.j?.message || ''})`);
    const dr = (await call(sa, 'GET', `/admin/applications/${labId}/invoice-draft`)).j;
    ok(dr.specs.join('|') === 'MEREK A / Tipe 1|MEREK B' && /Biaya Pengujian\nPanci Baja\nParameter : Kekerasan/.test(dr.lab_lines[0]?.label), `draft lab: ${JSON.stringify(dr.specs)} ${dr.lab_lines[0]?.label}`);
    await t.offer(sa, labId, 3, 'full');
    r = await call(sa, 'POST', `/admin/applications/${labId}/invoice`, { step: 3, custom_prices: { [dr.lab_lines[0].key]: 400000 }, items: [{ label: 'Biaya tambahan Ekspress', method: '', qty: 1, price: 50000 }, { label: 'Uji tambahan', method: 'SNI 1234:2020', qty: 2, price: 25000 }], with_pph23: true });
    ok(r.s === 200 && /^\d{3}\/PSU\/FIS\/[IVX]+\/\d{4}$/.test(r.j.payment?.invoice_no || ''), `terbit invoice lab ${r.s} ${r.j.message || ''} ${r.j.payment?.invoice_no}`);
    const labPrev = (await call(rina, 'GET', `/applications/${labId}/prefill`)).j;
    ok(labPrev.payload.lab.specs.length === 2 && labPrev.payload.lab.specs[0].brand === 'MEREK A' && labPrev.payload.lab.specs[0].spec === 'Tipe 1', 'prefill brand/spesifikasi');
    r = await t.raw(sa, `/admin/applications/${labId}/invoice`);
    const ltxt = t.pdfText(r.buf, true);
    if (ltxt === null) (t.skip(), t.skip()); else ok(/METODE/.test(ltxt) && /QTY/.test(ltxt) && /Brand \/ Spesifikasi Produk/.test(ltxt) && /MEREK B/.test(ltxt) && /1\.200\.000/.test(ltxt) && /Biaya tambahan Ekspress/.test(ltxt) && /SNI 1234:2020/.test(ltxt) && /1\.300\.000/.test(ltxt), 'PDF lab: kolom metode/qty, spesifikasi, jumlah');
    if (ltxt !== null) ok(/GRAND TOTAL/.test(ltxt) && /Sofy Mariana/.test(ltxt) && /Manager Keuangan/.test(ltxt) && /124\.00\.111\.93613/.test(ltxt) && /43\.419\.874\.3-008\.000/.test(ltxt), 'PDF lab: identitas invoice');

    // --- edge: produk luar lingkup dengan nama berbeda bukan duplikat, nama sama = duplikat
    r = await call(rina, 'POST', '/applications', null, mkLab({ product_id: cp.id, custom_product: 'Wajan Teflon', custom_params: ['Kekerasan'], sample: { quantity: 1 }, fields: {} }));
    ok(r.s === 201, `nama produk lain bukan duplikat (${r.s} ${r.j.message || ''})`);
    const wajanId = r.j.id;
    r = await call(rina, 'POST', '/applications', null, mkLab({ product_id: cp.id, custom_product: 'Wajan Teflon', custom_params: ['Kekerasan'], sample: { quantity: 1 }, fields: {} }));
    ok(r.s === 409 && r.j.code === 'DUPLICATE', `nama produk sama = duplikat (${r.s})`);
    const wajan = (await call(sa, 'GET', `/admin/applications/${wajanId}`)).j;
    ok(wajan.samples[0]?.description === 'Wajan Teflon' && !wajan.scheme, `deskripsi sampel = nama produk (${wajan.samples[0]?.description})`);
    // --- edge: batal → tahap tampil ditutup
    const fc = { reason: 'salah pilih' };
    r = await call(rina, 'POST', `/applications/${wajanId}/cancel`, fc);
    ok(r.s === 200 && r.j.steps.find((x) => x.order === r.j.current_step.order).state === 'closed', 'pengajuan batal: tahap berjalan ditutup');
    // --- edge: harga daftar harga bukan angka = belum ada harga
    const prices = (await call(sa, 'GET', '/superadmin/prices')).j;
    const lp = prices.find((x) => x.service_code === 'FIS' && !x.custom_name && x.parameters.length);
    r = await call(sa, 'PUT', `/superadmin/prices/products/${lp.id}`, { ...lp, package_price: 'abc', parameters: lp.parameters.map((x, i) => (i === 0 ? { ...x, price: '1.250.000' } : x)) });
    const lp2 = (await call(sa, 'GET', '/superadmin/prices')).j.find((x) => x.id === lp.id);
    ok(r.s === 200 && lp2.package_price === null && +lp2.parameters[0].price === 1250000 && +lp2.parameters[1].price === +lp.parameters[1].price, `harga: teks→kosong, "1.250.000"→1250000, DECIMAL tetap (${lp2.package_price}, ${lp2.parameters[0].price}, ${lp2.parameters[1]?.price})`);

    // --- edge: harga paket dikunci saat diajukan (perubahan daftar harga sesudahnya tidak memengaruhi invoice)
    const kim = (await call(rina, 'GET', '/public/services/KIM/scope')).j.find((x) => x.package_price);
    const fk = new FormData(); fk.append('service_code', 'KIM'); fk.append('data', JSON.stringify({ product_id: kim.id, full_sni: true, sample: { quantity: 2 }, fields: {}, confirm_duplicate: true }));
    fk.append('documents', pdf(), 'sp.pdf'); fk.append('doc_types', JSON.stringify(['Surat Permohonan Pengujian']));
    r = await call(rina, 'POST', '/applications', null, fk);
    const kimId = r.j.id;
    const allP = (await call(sa, 'GET', '/superadmin/prices')).j.find((x) => x.id === kim.id);
    await call(sa, 'PUT', `/superadmin/prices/products/${kim.id}`, { ...allP, package_price: +kim.package_price + 111000 });
    const kd = (await call(sa, 'GET', `/admin/applications/${kimId}/invoice-draft`)).j;
    ok(kd.lab_lines[0]?.price === +kim.package_price, `harga paket terkunci (${kd.lab_lines[0]?.price} = ${kim.package_price})`);
    await call(sa, 'PUT', `/superadmin/prices/products/${kim.id}`, { ...allP });

    // --- form builder: tipe nomor_tanggal & berkas per tipe skema
    const sf = (await call(sa, 'GET', '/superadmin/forms/SP')).j;
    ok(sf.schemes.includes('Tipe 1b') && sf.schemes.includes('Tipe 5'), `daftar tipe skema ${sf.schemes}`);
    r = await call(sa, 'POST', '/superadmin/forms/SP/fields', { label: 'Nomor Sertifikat Asal', type: 'nomor_tanggal', multiple: true, show_when: '1B' });
    ok(r.s === 201, 'tambah isian nomor_tanggal');
    const doc = sf.documents.find((d) => d.name === 'Spesifikasi Produk');
    r = await call(sa, 'PUT', `/superadmin/documents/${doc.id}`, { ...doc, hide_schemes: ['Tipe 1b', 'Tipe X'] });
    const sf2 = (await call(sa, 'GET', '/superadmin/forms/SP')).j;
    ok(sf2.documents.find((d) => d.id === doc.id).hide_schemes === 'Tipe 1b' && sf2.fields.some((f) => f.type === 'nomor_tanggal' && f.multiple === 1 && f.label === 'Nomor Sertifikat Asal'), 'simpan hide_schemes (tipe tak dikenal dibuang)');
    const pr = (await call(sa, 'GET', '/superadmin/prices')).j;
    ok(pr.filter((p) => p.custom_name).length === 2, 'flag produk luar lingkup di daftar harga');

    // --- daftar & lacak
    r = await call(sa, 'GET', '/admin/applications');
    ok(r.s === 200, 'antrean admin');
    const tr = (await call(null, 'GET', '/public/track/SLP26-B1QK8TNV')).j;
    ok(tr.steps.length === 9 && tr.current_step.name === 'Sampling', 'lacak contoh 1b');
    const svcs = (await call(null, 'GET', '/public/services')).j;
    ok(svcs.find((s) => s.code === 'SP').steps.length === 11 && svcs.find((s) => s.code === 'SP').steps_1b.length === 9, 'layanan publik: alur utama + 1b');
  },
};
