/**
 * Revisi PSU: tahap Penawaran & Kontrak (skema Full / 50:50 / Full di Akhir), tahap akhir Invoice & Faktur
 * (bukti bayar + bukti potong, sertifikat terkunci sampai lunas), template dokumen, tanda tangan & stempel,
 * perpanjangan sesi otomatis, dan migrasi database lama.
 */
const jwt = require('jsonwebtoken');

// PNG 1×1 piksel (contoh gambar tanda tangan)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

module.exports = {
  name: 'Penawaran & Kontrak, Invoice & Faktur',
  async run(t) {
    const { ok, call, pdf, today, plus } = t;
    const td = today();
    const sa = await t.tok('superadmin@penilaistandaruji.com');
    const budi = await t.tok('budi@penilaistandaruji.com');
    const andi = await t.tok('andi@penilaistandaruji.com');
    const dimas = await t.tok('dimas@tanisubur.co.id');
    const apps = (await call(sa, 'GET', '/admin/applications')).j;
    const byNo = (no) => apps.find((a) => a.application_no === no);
    const mine = async (id) => (await call(dimas, 'GET', `/applications/${id}`)).j;
    const fd = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) { if (v instanceof Blob) f.append(k, v, v.name || `${k}.pdf`); else f.append(k, String(v)); } return f; };
    const upload = (tok, id, kind) => call(tok, 'POST', `/applications/${id}/billing/${kind}`, null, fd({ file: pdf() }));
    const verify = (tok, id, step, kind, valid, note = '') => call(tok, 'POST', `/admin/applications/${id}/billing/${kind}/verify`, { step, valid, note });

    /* ===== A. Sertifikasi Produk, skema 50:50, dipotong PPh 23 ===== */
    const sp = byNo('PSU-SP-2610-0002');
    let a = await t.adminApp(sa, sp.id);
    ok(a.current_step.name === 'Penawaran & Kontrak' && a.steps.length === 11 && a.steps[10].name === 'Invoice & Faktur', `nama tahap 3 & tahap akhir (${a.current_step.name}, ${a.steps.length})`);
    let r = await call(sa, 'POST', `/admin/applications/${sp.id}/offer`, null, fd({ step: 3, scheme: '5050' }));
    ok(r.s === 400 && /kontrak/.test(r.j.message), 'kontrak wajib diunggah');
    r = await call(sa, 'POST', `/admin/applications/${sp.id}/offer`, null, fd({ step: 3, scheme: 'cicil', contract: pdf() }));
    ok(r.s === 400 && /skema/.test(r.j.message), 'skema tidak dikenal ditolak');
    ok((await t.approve(sa, sp.id, 3)).j.message?.includes('skema'), 'ST-03 tidak bisa disetujui sebelum skema diatur');
    r = await t.offer(sa, sp.id, 3, '5050', 'Kontrak No. 12/PSU/X/2026');
    ok(r.s === 200 && r.j.payment_scheme === '5050' && r.j.contract, 'skema 50:50 + kontrak tersimpan');
    ok(r.j.logs.some((l) => /Skema pembayaran: 50 : 50/.test(l.note)), 'riwayat mencatat skema');
    r = await call(sa, 'POST', `/admin/applications/${sp.id}/invoice`, { step: 3, items: [{ label: 'Sertifikasi', qty: 1, price: 10000000 }], with_pph23: true });
    // grand total = 10.000.000 + PPN 1.100.000 − PPh 23 200.000 = 10.900.000 → DP 5.450.000
    ok(r.s === 200 && r.j.payment.amount === 10900000 && r.j.payment.due_now === 5450000 && r.j.payment_status === 'invoice', `proforma DP 50% (${r.j.payment?.due_now})`);
    ok(/Rp5\.450\.000 \(DP 50%/.test(t.lastMail('dimas@tanisubur.co.id') || ''), 'email proforma menyebut DP 50%');
    // ganti skema setelah proforma terbit: ikut menyesuaikan
    r = await t.offer(sa, sp.id, 3, 'akhir');
    ok(r.j.payment_status === 'tunda' && r.j.payment.due_now === 0, 'ganti ke Full di Akhir: tidak ada pembayaran sekarang');
    r = await t.offer(sa, sp.id, 3, '5050');
    ok(r.j.payment_status === 'invoice' && r.j.payment.due_now === 5450000, 'kembali ke 50:50');
    const inv = await t.raw(dimas, `/applications/${sp.id}/invoice`);
    const txt = t.pdfText(inv.buf);
    if (txt === null) t.skip(); else ok(/Skema Pembayaran/.test(txt) && /DP 50%/.test(txt) && /5\.450\.000/.test(txt), 'PDF proforma mencantumkan skema 50:50');
    r = await call(dimas, 'POST', `/applications/${sp.id}/payment`, null, fd({ proof: pdf() }));
    ok(r.s === 200, `pelanggan bayar DP ${r.s}`);
    await call(sa, 'POST', `/admin/applications/${sp.id}/payment/verify`, { step: 3, valid: true });
    a = await t.adminApp(sa, sp.id);
    if (a.current_step.order === 3) await t.approve(sa, sp.id, 3);
    for (let guard = 0; guard < 12; guard++) {
      a = await t.adminApp(sa, sp.id);
      if (a.current_step.is_certificate_step || a.status !== 'aktif') break;
      r = await t.approve(sa, sp.id, a.current_step.order);
      if (r.s !== 200) { ok(false, `maju ${a.current_step.code}: ${r.j.message}`); break; }
    }
    r = await t.approve(sa, sp.id, a.current_step.order, { certificate_no: 'PSU-SPPT-UJI-5050', certificate: pdf(), issued_at: td, expires_at: plus(td, 1460) });
    ok(r.s === 200 && r.j.status === 'aktif' && r.j.current_step.code === 'ST-11' && r.j.work_done, `sertifikat terbit → ST-11 Invoice & Faktur (${r.j.current_step?.code} ${r.j.message || ''})`);
    ok(r.j.billing && r.j.billing.amount_due === 5450000 && r.j.billing.pay.status === 'belum' && r.j.billing.cut.status === 'belum' && !r.j.billing.sent, 'tagihan akhir: sisa 50% + bukti potong');
    ok((await call(null, 'GET', '/public/directory')).j.some((x) => x.certificate_no === 'PSU-SPPT-UJI-5050'), 'sertifikat langsung tampil di Directory');
    ok((await call(sa, 'GET', '/admin/applications')).j.find((x) => x.id === sp.id).billing?.sent === false, 'antrean: invoice & faktur belum dikirim');
    ok((await t.approve(sa, sp.id, 11)).s === 400, 'tahap akhir tidak bisa disetujui manual');
    ok((await call(sa, 'POST', `/admin/applications/${sp.id}/action`, null, fd({ action: 'tolak', step: 11, note: 'x' }))).s === 400, 'pengajuan bersertifikat tidak bisa ditutup');

    // pelanggan: sertifikat terkunci sampai pelunasan disetujui
    let c = await mine(sp.id);
    ok(c.certificate.locked === 'pelunasan' && c.certificate.can_download === false && c.work_done, 'detail pelanggan: sertifikat terkunci');
    ok((await call(dimas, 'GET', `/applications/${sp.id}/certificate`)).j.code === 'CERT_UNPAID', 'unduh sertifikat ditolak sebelum lunas');
    ok((await upload(dimas, sp.id, 'bayar')).s === 400, 'bukti bayar ditolak sebelum invoice dikirim');
    const sv = (await call(dimas, 'GET', `/applications/${sp.id}/survey`)).j;
    r = await call(dimas, 'POST', `/applications/${sp.id}/survey`, { scores: Object.fromEntries(sv.questions.map((q) => [q.id, 5])), respondent_name: 'Dimas', company_name: 'CV Tani Subur', contact_ok: false });
    ok(r.s === 200 && /setelah pelunasan disetujui/.test(t.lastMail('dimas@tanisubur.co.id') || ''), 'survei di tahap akhir: dokumen dikirim setelah lunas');

    // PSU mengirim invoice & faktur
    r = await call(sa, 'POST', `/admin/applications/${sp.id}/billing`, null, fd({ step: 11, invoice: pdf() }));
    ok(r.s === 400 && /faktur/.test(r.j.message), 'invoice & faktur wajib diunggah');
    r = await call(sa, 'POST', `/admin/applications/${sp.id}/billing`, null, fd({ step: 11, invoice: new File(['x'], 'catatan.txt'), faktur: pdf() }));
    ok(r.s === 400, 'invoice harus PDF');
    r = await t.billing(sa, sp.id, 11, { note: 'Pelunasan paling lambat 14 hari.' });
    ok(r.s === 200 && r.j.billing.sent && r.j.billing.note === 'Pelunasan paling lambat 14 hari.' && r.j.condition === 'Waiting for Payment', `invoice & faktur terkirim (${r.s} ${r.j.message || ''})`);
    const mail = t.lastMail('dimas@tanisubur.co.id') || '';
    ok(/Invoice & faktur pajak/.test(mail) && /psuindonesia\.info@gmail\.com sebagai kelengkapan administrasi perpajakan/.test(mail) && /Rp5\.450\.000/.test(mail), 'email: sisa tagihan + pesan bukti potong PPh');
    c = await mine(sp.id);
    ok(c.billing.pph_message && c.customer_action_needed && c.billing.invoice_name === 'invoice-akhir.pdf', 'pelanggan melihat pesan PPh & dokumen');
    ok((await t.raw(dimas, `/applications/${sp.id}/billing/invoice`)).s === 200 && (await t.raw(dimas, `/applications/${sp.id}/billing/faktur`)).s === 200, 'pelanggan mengunduh invoice & faktur');
    ok((await t.raw(dimas, `/applications/${sp.id}/billing/lainnya`)).s === 404, 'berkas tak dikenal 404');

    // bukti bayar: tolak lalu setujui
    ok((await upload(dimas, sp.id, 'bayar')).s === 200, 'unggah bukti bayar');
    ok((await upload(dimas, sp.id, 'bayar')).s === 400, 'bukti yang sedang diverifikasi tidak bisa diunggah ulang');
    ok((await verify(sa, sp.id, 11, 'bayar', false)).s === 400, 'tolak wajib beralasan');
    r = await verify(sa, sp.id, 11, 'bayar', false, 'Nominal kurang');
    ok(r.j.billing.pay.status === 'ditolak' && /Nominal kurang/.test(t.lastMail('dimas@tanisubur.co.id') || ''), 'bukti bayar ditolak + email alasan');
    await upload(dimas, sp.id, 'bayar');
    r = await verify(sa, sp.id, 11, 'bayar', true);
    ok(r.j.billing.pay.status === 'disetujui' && r.j.status === 'aktif', 'bukti bayar disetujui, bukti potong belum: belum selesai');
    ok(/Pembayaran diterima/.test(t.lastMail('dimas@tanisubur.co.id') || ''), 'email pembayaran diterima');
    const att = await t.sql("SELECT attachments FROM email_outbox WHERE to_addr='dimas@tanisubur.co.id' AND subject LIKE '%Pembayaran diterima%'");
    ok(att.length === 1 && /PSU-SPPT-UJI-5050/.test(att[0].attachments || ''), 'sertifikat dilampirkan (survei sudah diisi)');
    c = await mine(sp.id);
    ok(c.certificate.can_download && (await t.raw(dimas, `/applications/${sp.id}/certificate`)).s === 200, 'sertifikat bisa diunduh setelah lunas');
    // bukti potong menyusul
    ok((await upload(dimas, sp.id, 'potong')).s === 200, 'unggah bukti potong');
    r = await verify(budi, sp.id, 11, 'potong', true);
    ok(r.j.status === 'selesai' && r.j.condition === 'Certified' && r.j.progress === 100 && r.j.billing.completed_at, `semua lengkap → selesai (${r.j.status})`);
    ok(r.j.steps[10].state === 'done', 'tahap Invoice & Faktur selesai di timeline');

    /* ===== B. Kalibrasi, skema Full di Akhir, tanpa PPh 23 ===== */
    const kal = byNo('PSU-KAL-2610-0001');
    await t.approve(andi, kal.id, 1);
    a = await t.adminApp(andi, kal.id);
    ok(a.current_step.code === 'KAL-02' && a.current_step.name === 'Penawaran & Kontrak', `kalibrasi: KAL-02 Penawaran & Kontrak (${a.current_step.code})`);
    await t.offer(andi, kal.id, 2, 'akhir');
    r = await call(andi, 'POST', `/admin/applications/${kal.id}/invoice`, { step: 2, items: [{ label: 'Kalibrasi timbangan', qty: 1, price: 2000000 }], with_pph23: false });
    ok(r.j.payment_status === 'tunda' && r.j.payment.due_now === 0 && r.j.condition !== 'Waiting for Payment', 'Full di Akhir: tidak menunggu pembayaran');
    ok(/tidak ada pembayaran di tahap ini/.test(t.lastMail('dimas@tanisubur.co.id') || ''), 'email proforma: bayar setelah sertifikat terbit');
    r = await call(dimas, 'POST', `/applications/${kal.id}/payment`, null, fd({ proof: pdf() }));
    ok(r.s === 400 && /Full di Akhir/.test(r.j.message), 'pelanggan tidak perlu bayar di tahap 2');
    for (let guard = 0; guard < 12; guard++) {
      a = await t.adminApp(andi, kal.id);
      if (a.current_step.is_billing_step || a.status !== 'aktif') break;
      const extra = a.current_step.is_certificate_step ? { certificate_no: 'KAL/UJI/0001', certificate: pdf() } : {};
      r = await t.approve(andi, kal.id, a.current_step.order, extra);
      if (r.s !== 200) { ok(false, `maju ${a.current_step.code}: ${r.j.message}`); break; }
    }
    ok(a.current_step.code === 'KAL-10' && a.billing.amount_due === 2220000 && a.billing.cut.status === 'tidak_perlu', `KAL-10: tagih penuh Rp2.220.000, tanpa bukti potong (${a.current_step.code} ${a.billing?.amount_due})`);
    await t.billing(andi, kal.id, a.current_step.order);
    ok(!/bukti potong PPh/.test(t.lastMail('dimas@tanisubur.co.id') || ''), 'tanpa PPh 23: tidak ada pesan bukti potong');
    ok((await upload(dimas, kal.id, 'potong')).s === 400, 'bukti potong tidak diperlukan');
    await upload(dimas, kal.id, 'bayar');
    r = await verify(andi, kal.id, a.current_step.order, 'bayar', true);
    ok(r.j.status === 'selesai' && r.j.condition === 'Completed', 'lunas → selesai');

    /* ===== C. Pengajuan yang sudah selesai sebelum revisi ===== */
    const old = (await call(await t.tok('rina@sinarcontoh.co.id'), 'GET', `/applications/${byNo('PSU-SP-2608-0003').id}`)).j;
    ok(old.status === 'selesai' && old.steps[10].state === 'skipped' && !old.billing && old.certificate.can_download, 'pengajuan lama selesai: tahap akhir dilewati, sertifikat tetap bisa diunduh');

    /* ===== D. Template dokumen: tambah, ubah, hapus ===== */
    const tf = (o) => fd({ ...o, ...(o.file ? { file: o.file } : {}) });
    r = await call(dimas, 'POST', '/templates', null, tf({ name: 'Surat Kuasa', file: pdf() }));
    ok(r.s === 403, 'pelanggan tidak bisa menambah template');
    r = await call(budi, 'POST', '/templates', null, tf({ name: 'Surat Kuasa', description: 'Bila diwakilkan', file: pdf() }));
    ok(r.s === 201, `admin menambah template PDF (${r.s} ${r.j.message || ''})`);
    const tid = r.j.id;
    ok((await call(budi, 'POST', '/templates', null, tf({ name: 'surat kuasa', file: pdf() }))).s === 409, 'nama template kembar ditolak');
    ok((await call(budi, 'POST', '/templates', null, tf({ name: 'Tanpa File' }))).s === 400, 'file wajib');
    ok((await call(budi, 'POST', '/templates', null, tf({ name: 'Format Salah', file: new File(['x'], 'gambar.gif') }))).s === 400, 'format selain Word/PDF/Excel ditolak');
    r = await call(budi, 'PUT', `/templates/${tid}`, null, tf({ name: 'Surat Kuasa Perusahaan', description: 'Ditandatangani direktur' }));
    let list = (await call(dimas, 'GET', '/templates')).j;
    ok(r.s === 200 && list.some((x) => x.name === 'Surat Kuasa Perusahaan' && x.description === 'Ditandatangani direktur'), 'ubah nama & keterangan tanpa ganti file');
    ok((await t.raw(dimas, `/templates/${tid}/download`)).s === 200, 'pelanggan mengunduh template baru');
    r = await call(sa, 'DELETE', `/templates/${tid}`);
    list = (await call(dimas, 'GET', '/templates')).j;
    ok(r.s === 200 && !list.some((x) => x.id === tid), 'template dihapus');
    ok((await call(budi, 'DELETE', `/templates/${tid}`)).s === 404, 'hapus ulang 404');

    /* ===== E. Tanda tangan & stempel di proforma ===== */
    const img = (file) => fd({ image: file });
    ok((await call(budi, 'POST', '/superadmin/invoice-images/ttd', null, img(new File([PNG], 'ttd.png')))).s === 403, 'khusus Super Admin');
    r = await call(sa, 'POST', '/superadmin/invoice-images/ttd', null, img(new File([PNG], 'ttd.png')));
    ok(r.s === 200 && r.j.v, 'unggah tanda tangan');
    ok((await call(sa, 'POST', '/superadmin/invoice-images/stempel', null, img(pdf()))).s === 400, 'stempel harus PNG/JPG');
    ok((await call(sa, 'POST', '/superadmin/invoice-images/lainnya', null, img(new File([PNG], 'ttd.png')))).s === 404, 'jenis gambar tak dikenal');
    r = await call(sa, 'GET', '/superadmin/invoice-images');
    ok(r.j.ttd && r.j.stempel === null, 'status gambar: ttd ada, stempel kosong');
    ok((await t.raw(sa, '/superadmin/invoice-images/ttd')).buf.equals(PNG), 'pratinjau gambar tanda tangan');
    const withSig = await t.raw(sa, `/admin/applications/${sp.id}/invoice`);
    ok(withSig.s === 200 && /\/Subtype\s*\/Image/.test(withSig.buf.toString('latin1')), 'PDF proforma memuat gambar tanda tangan');
    await call(sa, 'DELETE', '/superadmin/invoice-images/ttd');
    ok((await call(sa, 'GET', '/superadmin/invoice-images')).j.ttd === null, 'tanda tangan dihapus');

    /* ===== F. Sesi diperpanjang otomatis selama aktif ===== */
    const u = (await t.sql("SELECT id, role, token_version FROM users WHERE email='dimas@tanisubur.co.id'"))[0];
    const oldTok = jwt.sign({ id: u.id, role: u.role, tv: u.token_version, iat: Math.floor(Date.now() / 1000) - 3600 }, process.env.JWT_SECRET, { expiresIn: '1d' });
    r = await call(oldTok, 'GET', '/auth/me');
    const nt = r.h.get('x-new-token');
    ok(r.s === 200 && nt && (await call(nt, 'GET', '/auth/me')).s === 200, 'token lama (>30 menit) mendapat token baru');
    ok(!(await call(dimas, 'GET', '/auth/me')).h.get('x-new-token'), 'token baru tidak diperbarui lagi');

    /* ===== G. Migrasi database lama (tanpa tahap akhir) ===== */
    await t.sql('DELETE FROM service_steps WHERE is_billing_step=1');
    await t.sql("UPDATE service_steps SET name='Penawaran, Kontrak & Pembayaran', progress_pct=100 WHERE is_certificate_step=1 OR is_payment_step=1");
    // migrasi lain dianggap sudah jalan (seperti database yang sudah dipakai), hanya revisi ini yang belum
    const { FRESH_DONE } = require('../src/config/migrate');
    for (const n of [...FRESH_DONE, 'template_dokumen', 'identitas_invoice']) await t.sql('INSERT IGNORE INTO settings (skey, svalue) VALUES (?, NOW())', [`migr:${n}`]);
    await t.sql("DELETE FROM settings WHERE skey='migr:penawaran_tagihan'");
    await require('../src/config/migrate')();
    const flows = await t.sql(`SELECT s.code, st.flow, MAX(st.step_order) last, SUM(st.is_billing_step) bill,
      MAX(CASE WHEN st.is_billing_step THEN st.status_code END) code_bill, MAX(st.progress_pct * (1 - st.is_billing_step)) maxpct,
      SUM(st.is_payment_step AND st.name='Penawaran & Kontrak') offer
      FROM service_steps st JOIN services s ON s.id=st.service_id GROUP BY st.service_id, st.flow`);
    ok(flows.length >= 6 && flows.every((f) => +f.bill === 1 && +f.offer === 1 && +f.maxpct <= 95), `migrasi: setiap alur punya tahap akhir & Penawaran & Kontrak (${flows.map((f) => `${f.code}${f.flow}:${f.code_bill}`).join(' ')})`);
    ok(flows.find((f) => f.code === 'SP' && f.flow === '').code_bill === 'ST-11' && flows.find((f) => f.code === 'SP' && f.flow === '1B').code_bill === 'ST-09'
      && flows.find((f) => f.code === 'KAL').code_bill === 'KAL-10' && flows.find((f) => f.code === 'KIM').code_bill === 'LAB-08', 'kode tahap akhir berurutan');
  },
};
