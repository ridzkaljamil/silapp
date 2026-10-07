/**
 * Membuat ulang tabel (schema.sql) lalu mengisi data awal:
 * layanan + status tracking, ruang lingkup, akun demo, dan beberapa pengajuan contoh.
 * Jalankan: npm run db:reset
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { SPC, SP_PRODUCTS, LAB_PRODUCTS } = require('./scope-data');

const ST = (c, n, p, o = {}) => ({ c, n, p, ...o });
const STEPS = {
  SP: [ST('ST-01', 'Permohonan diterima', 10), ST('ST-02', 'Verifikasi & tinjauan permohonan', 20),
    ST('ST-03', 'Penawaran, kontrak & pembayaran', 30, { pay: 1 }), ST('ST-04', 'Penjadwalan & penugasan', 40),
    ST('ST-05', 'Evaluasi/audit & sampling', 50), ST('ST-06', 'Pengujian laboratorium', 60),
    ST('ST-07', 'Tindakan perbaikan', 70, { opt: 1 }), ST('ST-08', 'Review hasil evaluasi', 80),
    ST('ST-09', 'Keputusan sertifikasi', 90), ST('ST-10', 'Sertifikat terbit', 100, { cert: 1 })],
  LAB: [ST('LAB-01', 'Permohonan diterima', 10), ST('LAB-02', 'Verifikasi, kontrak & pembayaran', 20, { pay: 1 }),
    ST('LAB-03', 'Sampel diterima & diregistrasi', 30), ST('LAB-04', 'Preparasi sampel', 40),
    ST('LAB-05', 'Proses pengujian laboratorium', 65), ST('LAB-06', 'Review & verifikasi hasil', 80),
    ST('LAB-07', 'Penerbitan LHU', 95, { cert: 1 }), ST('LAB-08', 'LHU terbit', 100)],
  KAL: [ST('KAL-01', 'Permohonan diterima', 10), ST('KAL-02', 'Verifikasi, kontrak & pembayaran', 20, { pay: 1 }),
    ST('KAL-03', 'Alat diterima & diregistrasi', 30), ST('KAL-04', 'Persiapan kalibrasi', 40),
    ST('KAL-05', 'Pelaksanaan kalibrasi', 65), ST('KAL-06', 'Review & verifikasi hasil', 80),
    ST('KAL-07', 'Penerbitan sertifikat', 95, { cert: 1 }), ST('KAL-08', 'Sertifikat terbit', 100),
    ST('KAL-09', 'Pengembalian alat', 100, { opt: 1 })],
};

const SERVICES = [
  { code: 'SP', parent: null, bidang: 'SP', name: 'Sertifikasi Produk', steps: 'SP', est: '15–45 hari kerja', state: 'ok',
    desc: 'Sertifikasi SPPT SNI skema Tipe 5 dan Tipe 1B untuk pangan, minuman, pupuk, dan pasar rakyat.' },
  { code: 'LAB', parent: null, bidang: null, name: 'Laboratorium', steps: null, est: null, state: 'ok',
    desc: 'Laboratorium pengujian dan kalibrasi PT Penilai Standar Uji.' },
  { code: 'KIM', parent: 'LAB', bidang: 'LAB', name: 'Laboratorium Kimia', steps: 'LAB', est: '7–14 hari kerja', state: 'ok',
    desc: 'Uji kimia pupuk: unsur hara, kadar air, asam bebas, dan cemaran logam.' },
  { code: 'FIS', parent: 'LAB', bidang: 'LAB', name: 'Laboratorium Fisika', steps: 'LAB', est: '7–14 hari kerja', state: 'ok',
    desc: 'Uji fisik peralatan masak dan peralatan makan dari logam.' },
  { code: 'MIK', parent: 'LAB', bidang: 'LAB', name: 'Laboratorium Mikrobiologi', steps: 'LAB', est: 'menunggu data', state: 'dev',
    desc: 'Uji cemaran mikroba pada sampel produk. Tahap pengembangan.' },
  { code: 'KAL', parent: 'LAB', bidang: 'KAL', name: 'Laboratorium Kalibrasi', steps: 'KAL', est: '3–10 hari kerja per alat', state: 'prep',
    desc: 'Kalibrasi alat ukur di laboratorium atau on-site. Tahap persiapan.' },
];
const FIS_PRODUCTS = ['Peralatan masak (cookware) dari logam', 'Peralatan makan & masak baja tahan karat (flatware)'];
const MIK_PARAMS = ['Angka lempeng total (ALT)', 'Coliform', 'E. coli', 'Salmonella', 'Kapang & khamir'];

/* ---------- form builder bawaan (bisa diubah Super Admin) ---------- */
const FLD = (key, label, type = 'text', o = {}) => ({ key, label, type, ...o });
const LAB_FIELDS = [FLD('kode_sampel', 'Kode / identitas sampel dari pelanggan'), FLD('keterangan', 'Keterangan tambahan', 'textarea')];
const FIELDS = {
  SP: [FLD('nama_pabrik', 'Nama pabrik', 'text', { req: 1 }), FLD('alamat_pabrik', 'Alamat pabrik', 'textarea', { req: 1 }),
    FLD('kota_provinsi', 'Kota / provinsi pabrik', 'text', { req: 1 }), FLD('merek', 'Merek', 'text', { req: 1 }),
    FLD('model', 'Jenis; spesifikasi; model'),
    FLD('batch', 'Nomor batch / lot', 'text', { when: '1B' }), FLD('jumlah', 'Jumlah produk', 'text', { when: '1B' }),
    FLD('shipment', 'Nomor shipment & invoice', 'text', { when: '1B' }), FLD('asal', 'Negara asal & pelabuhan', 'text', { when: '1B' })],
  KIM: LAB_FIELDS, FIS: LAB_FIELDS, MIK: LAB_FIELDS,
  KAL: [FLD('tanggal_diinginkan', 'Tanggal kalibrasi yang diinginkan', 'date')],
};
const DOC = (name, req = 0, pkg = 0) => ({ name, req, pkg });
const LAB_DOCS = [DOC('Surat permohonan pengujian', 1), DOC('Data sampel / spesifikasi')];
const DOCS = {
  SP: [DOC('Surat permohonan', 1, 1), DOC('Akta perusahaan & NIB', 1), DOC('Spesifikasi produk'), DOC('Sertifikat merek'), DOC('Dokumen sistem mutu')],
  KIM: LAB_DOCS, FIS: LAB_DOCS, MIK: LAB_DOCS,
  KAL: [DOC('Surat permohonan kalibrasi', 1), DOC('Foto / data teknis alat')],
};
const SURVEY = [
  'Kemudahan proses pengajuan melalui SILAPP',
  'Kejelasan informasi persyaratan dan biaya',
  'Ketepatan waktu penyelesaian layanan',
  'Kompetensi dan profesionalisme personel PSU',
  'Kemudahan memantau progres (tracking) pengajuan',
  'Kesesuaian biaya dengan layanan yang diterima',
  'Kepuasan secara keseluruhan terhadap layanan PSU',
];
const THANKS = 'Terima kasih telah meluangkan waktu mengisi Survei Kepuasan Pelanggan. Masukan Anda sangat berarti bagi kami untuk terus meningkatkan mutu layanan PT Penilai Standar Uji. Dokumen Anda kini dapat diunduh dan juga telah kami kirimkan ke email Anda.';
// Proyek sertifikasi sebelum SILAPP (contoh/dummy)
const LEGACY = [
  ['PT Contoh Pangan Lestari', 'Kab. Bekasi, Jawa Barat', 'Biskuit', 'SNI 2973:2011', 'PSU-SPPT-2023-0012', '2023-03-14', 'aktif'],
  ['CV Kopi Nusantara Contoh', 'Kab. Temanggung, Jawa Tengah', 'Kopi instan', 'SNI 2983:2014', 'PSU-SPPT-2022-0031', '2022-08-02', 'aktif'],
  ['PT Gula Manis Contoh', 'Kab. Lampung Tengah, Lampung', 'Gula kristal putih', 'SNI 3140.3:2020', 'PSU-SPPT-2021-0007', '2021-05-19', 'tidak_aktif'],
];
/** Harga dummy per parameter (sudah termasuk PPN) — diganti daftar harga resmi PSU lewat menu Daftar harga lab. */
const dummyPrice = (i) => 150000 + (i % 6) * 25000;

/** PDF minimal untuk contoh sertifikat. */
const samplePdf = (title) => {
  const body = `BT /F1 18 Tf 72 720 Td (${title}) Tj ET\nBT /F1 11 Tf 72 690 Td (Contoh dokumen - SILAPP prototype) Tj ET`;
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const off = [];
  objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${off.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return out;
};

const USERS = [
  ['superadmin', 'Super Admin PSU', 'superadmin@penilaistandaruji.com', null, null, 'PT Penilai Standar Uji'],
  ['admin', 'Budi Santoso', 'budi@penilaistandaruji.com', 'Admin Sertifikasi', 'SP', 'PT Penilai Standar Uji'],
  ['admin', 'Dewi Lestari', 'dewi@penilaistandaruji.com', 'Auditor', 'SP', 'PT Penilai Standar Uji'],
  ['admin', 'Sari Wulandari', 'sari@penilaistandaruji.com', 'Admin Lab', 'LAB', 'PT Penilai Standar Uji'],
  ['admin', 'Tono Saputra', 'tono@penilaistandaruji.com', 'Analis', 'LAB', 'PT Penilai Standar Uji'],
  ['admin', 'Andi Pratama', 'andi@penilaistandaruji.com', 'Admin Kalibrasi', 'KAL', 'PT Penilai Standar Uji'],
  ['user', 'Rina Hapsari', 'rina@sinarcontoh.co.id', null, null, 'PT Sinar Contoh Abadi'],
  ['user', 'Dimas Prakoso', 'dimas@tanisubur.co.id', null, null, 'CV Tani Subur Persada'],
];

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: +process.env.DB_PORT || 3306, user: process.env.DB_USER,
    password: process.env.DB_PASS, database: process.env.DB_NAME, multipleStatements: true,
  });
  console.log('> membuat tabel ...');
  await conn.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  console.log('> layanan & status tracking ...');
  const svcId = {};
  let order = 0;
  for (const s of SERVICES) {
    const [r] = await conn.query(
      'INSERT INTO services (parent_id, code, name, description, bidang, est_text, state, sort_order) VALUES (?,?,?,?,?,?,?,?)',
      [s.parent ? svcId[s.parent] : null, s.code, s.name, s.desc, s.bidang, s.est, s.state, order++]);
    svcId[s.code] = r.insertId;
    if (!s.steps) continue;
    let i = 1;
    for (const st of STEPS[s.steps]) {
      await conn.query(
        'INSERT INTO service_steps (service_id, step_order, status_code, name, progress_pct, is_optional, is_payment_step, is_certificate_step) VALUES (?,?,?,?,?,?,?,?)',
        [r.insertId, i++, st.c, st.n, st.p, st.opt || 0, st.pay || 0, st.cert || 0]);
    }
  }

  console.log('> ruang lingkup ...');
  for (const p of SP_PRODUCTS) {
    await conn.query(
      'INSERT INTO products (service_id, category, sub_category, name, standard_no, scheme_reference, scheme_types) VALUES (?,?,?,?,?,?,?)',
      [svcId.SP, `${SPC[p[0]]} (${p[0]})`, p[1], p[2], p[3], p[4] || null, p[5] || null]);
  }
  for (const lp of LAB_PRODUCTS) {
    const code = FIS_PRODUCTS.includes(lp.n) ? 'FIS' : 'KIM';
    let sum = 0;
    const prices = lp.p.map((_, i) => { const v = dummyPrice(i); sum += v; return v; });
    const [r] = await conn.query('INSERT INTO products (service_id, category, name, package_price) VALUES (?,?,?,?)', [svcId[code], lp.b, lp.n, Math.round((sum * 0.85) / 10000) * 10000]);
    for (const [i, [name, method]] of lp.p.entries()) {
      await conn.query('INSERT INTO product_parameters (product_id, name, method, price) VALUES (?,?,?,?)', [r.insertId, name, method, prices[i]]);
    }
  }
  const [mik] = await conn.query('INSERT INTO products (service_id, category, name, package_price) VALUES (?,?,?,?)', [svcId.MIK, 'Mikrobiologi', 'Sampel pangan / minuman (contoh)', 800000]);
  for (const [i, n] of MIK_PARAMS.entries()) await conn.query('INSERT INTO product_parameters (product_id, name, price) VALUES (?,?,?)', [mik.insertId, n, dummyPrice(i)]);

  console.log('> form isian, berkas, survei, pengaturan ...');
  for (const [code, list] of Object.entries(FIELDS)) {
    for (const [i, f] of list.entries()) {
      await conn.query('INSERT INTO service_fields (service_id, field_key, label, type, required, show_when, sort_order) VALUES (?,?,?,?,?,?,?)',
        [svcId[code], f.key, f.label, f.type, f.req || 0, f.when || null, i]);
    }
  }
  for (const [code, list] of Object.entries(DOCS)) {
    for (const [i, d] of list.entries()) {
      await conn.query('INSERT INTO service_documents (service_id, name, required, admin_if_package, sort_order) VALUES (?,?,?,?,?)', [svcId[code], d.name, d.req, d.pkg, i]);
    }
  }
  for (const [i, t] of SURVEY.entries()) await conn.query('INSERT INTO survey_questions (question, sort_order) VALUES (?,?)', [t, i]);
  await conn.query('INSERT INTO settings (skey, svalue) VALUES (?,?)', ['thank_you_text', THANKS]);
  for (const l of LEGACY) {
    await conn.query('INSERT INTO legacy_certificates (factory_name, factory_address, product, sni_no, certificate_no, issued_at, status) VALUES (?,?,?,?,?,?,?)', l);
  }

  console.log('> akun demo (sandi: password123) ...');
  const hash = await bcrypt.hash('password123', 10);
  const uid = {};
  for (const [role, name, email, jabatan, bidang, company] of USERS) {
    const [r] = await conn.query(
      'INSERT INTO users (role, name, email, password_hash, jabatan, bidang, company_name, phone) VALUES (?,?,?,?,?,?,?,?)',
      [role, name, email, hash, jabatan, bidang, company, '0812-0000-0000']);
    uid[email.split('@')[0]] = r.insertId;
  }

  console.log('> pengajuan contoh ...');
  const UP = path.join(__dirname, '..', 'uploads');
  fs.mkdirSync(UP, { recursive: true });
  // data lama dihapus, jadi file unggahan lama ikut dibersihkan
  for (const f of fs.readdirSync(UP)) if (f !== '.gitkeep') fs.rmSync(path.join(UP, f), { force: true });
  const putPdf = (name, title) => { fs.writeFileSync(path.join(UP, name), samplePdf(title)); return name; };
  const [[npk]] = await conn.query("SELECT id FROM products WHERE name='Pupuk NPK padat' AND service_id=?", [svcId.KIM]);
  const [npkParams] = await conn.query('SELECT id, name, method, price FROM product_parameters WHERE product_id=? LIMIT 3', [npk.id]);
  const prod = async (name) => (await conn.query('SELECT id, name, standard_no FROM products WHERE name=? AND service_id=?', [name, svcId.SP]))[0][0];
  const beras = await prod('Beras'), kopi = await prod('Kopi instan'), minyak = await prod('Minyak goreng sawit');
  const ago = (d) => new Date(Date.now() - d * 86400000);
  const ymd = (d) => d.toISOString().slice(0, 10);
  const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
  const spDetails = (pabrik, alamat, kota, merek) => [['nama_pabrik', 'Nama pabrik', pabrik], ['alamat_pabrik', 'Alamat pabrik', alamat], ['kota_provinsi', 'Kota / provinsi pabrik', kota], ['merek', 'Merek', merek]];

  const samples = [
    // SP di ST-06, sudah audit dengan temuan
    { no: 'PSU-SP-2609-0001', code: 'SLP-X2KD-4M7A', u: 'rina', svc: 'SP', pid: beras.id, label: `Beras · ${beras.standard_no}`, step: 6, pay: 'terverifikasi', amount: 27750000,
      scheme: null, type: 'Sertifikasi baru', details: spDetails('PT Sinar Contoh Abadi – Pabrik Karawang', 'Jl. Industri Contoh No. 8, Kawasan KIIC', 'Kab. Karawang, Jawa Barat', 'Beras Sinar'),
      audit: 3, findings: [['minor', 'Catatan pemantauan suhu gudang tidak lengkap untuk 2 minggu terakhir.'], ['observasi', 'Label palet sebaiknya mencantumkan tanggal penerimaan.']] },
    // Lab kimia di LAB-05
    { no: 'PSU-KIM-2609-0001', code: 'SLP-C7WD-2KPM', u: 'rina', svc: 'KIM', pid: npk.id, label: 'Pupuk NPK padat (2 sampel)', step: 5, pay: 'terverifikasi', params: true, details: [['kode_sampel', 'Kode / identitas sampel dari pelanggan', 'NPK-B12']] },
    // Kalibrasi baru masuk
    { no: 'PSU-KAL-2610-0001', code: 'SLP-9RTE-3LQW', u: 'dimas', svc: 'KAL', pid: null, label: 'Timbangan digital AND FX-3000i', step: 1, pay: 'belum', location: 'lab' },
    // SP paket LSPro + Lab di ST-03, invoice belum terbit
    { no: 'PSU-SP-2610-0002', code: 'SLP-M4PQ-7HZT', u: 'dimas', svc: 'SP', pid: kopi.id, label: `Kopi instan · ${kopi.standard_no} · Tipe 5`, step: 3, pay: 'belum', scheme: 'Tipe 5', type: 'Sertifikasi baru', pkg: 1,
      details: spDetails('CV Tani Subur Persada', 'Jl. Raya Contoh Km 4', 'Kab. Malang, Jawa Timur', 'Kopi Subur'), docs: ['Akta perusahaan & NIB', 'Spesifikasi produk'] },
    // SP selesai, sertifikat terbit, survei belum diisi
    { no: 'PSU-SP-2608-0003', code: 'SLP-R8NB-5JVC', u: 'rina', svc: 'SP', pid: minyak.id, label: `Minyak goreng sawit · ${minyak.standard_no} · Tipe 5`, step: 10, pay: 'terverifikasi', amount: 31080000, scheme: 'Tipe 5', type: 'Sertifikasi baru', done: 'PSU-SPPT-2026-0001',
      details: spDetails('PT Sinar Contoh Abadi – Pabrik Cikarang', 'Jl. Contoh Raya Blok C-5, Cikarang', 'Kab. Bekasi, Jawa Barat', 'Sinar Gold') },
  ];
  for (const x of samples) {
    const [r] = await conn.query(
      `INSERT INTO applications (application_no, tracking_code, user_id, service_id, product_id, product_label, current_step_order, status, payment_status,
         scheme, application_type, location, is_package, nc_flag, audit_report_date, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [x.no, x.code, uid[x.u], svcId[x.svc], x.pid, x.label, x.step, x.done ? 'selesai' : 'aktif', x.pay, x.scheme || null, x.type || null, x.location || null,
        x.pkg || 0, x.findings ? 1 : 0, x.audit ? ymd(ago(x.audit)) : null, ago(x.step * 2 + 1)]);
    const id = r.insertId;
    const [steps] = await conn.query('SELECT * FROM service_steps WHERE service_id=? ORDER BY step_order', [svcId[x.svc]]);
    for (let i = 1; i <= x.step; i++) {
      const st = steps[i - 1];
      if (st.is_optional && !x.findings) continue;
      if (st.is_optional && i > x.step) continue;
      await conn.query(
        'INSERT INTO status_logs (application_id, step_order, status_code, step_name, action, note, pic_label, created_at) VALUES (?,?,?,?,?,?,?,?)',
        [id, i, st.status_code, st.name, i === 1 ? 'buat' : 'mulai', i === 1 ? 'Pengajuan dibuat oleh pelanggan.' : 'Tahap dimulai.', i === 1 ? 'Pelanggan' : 'Admin', ago((x.step - i + 1) * 2)]);
    }
    for (const [key, label, value] of x.details || []) {
      await conn.query('INSERT INTO application_details (application_id, field_key, field_label, field_value) VALUES (?,?,?,?)', [id, key, label, value]);
    }
    if (x.params) {
      for (const [k, p] of npkParams.entries()) {
        await conn.query('INSERT INTO application_parameters (application_id, parameter_id, name, method, price_snapshot, status) VALUES (?,?,?,?,?,?)',
          [id, p.id, p.name, p.method, p.price, k === 0 ? 'selesai' : k === 1 ? 'uji' : 'antri']);
      }
      await conn.query('INSERT INTO samples (application_id, description, quantity) VALUES (?,?,?)', [id, 'Pupuk NPK padat', 2]);
      x.amount = npkParams.reduce((t, p) => t + +p.price, 0) * 2;
    }
    if (x.pay === 'terverifikasi') {
      const dpp = Math.round(x.amount / 1.11);
      await conn.query(`INSERT INTO payments (application_id, invoice_no, amount, dpp, ppn, items, status, proof_path, paid_at, verified_at, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [id, `INV/PSU/2026/${String(id).padStart(5, '0')}`, x.amount, dpp, x.amount - dpp,
        JSON.stringify([{ label: 'Biaya layanan', amount: x.amount }]), 'terverifikasi', putPdf(`seed-bukti-${id}.pdf`, 'Bukti transfer (contoh)'), ago(x.step), ago(x.step), ago(x.step + 1)]);
    }
    for (const d of x.docs || []) {
      await conn.query('INSERT INTO documents (application_id, doc_type, original_name, file_path, step_order, uploaded_by) VALUES (?,?,?,?,?,?)',
        [id, d, `${d.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`, putPdf(`seed-${id}-${d.length}.pdf`, d), 1, uid[x.u]]);
    }
    if (x.findings) {
      const rep = ago(x.audit);
      for (const [cat, desc] of x.findings) {
        const due = cat === 'mayor' ? addMonths(rep, 1) : cat === 'minor' ? addMonths(rep, 2) : null;
        await conn.query('INSERT INTO findings (application_id, category, description, report_date, due_date) VALUES (?,?,?,?,?)', [id, cat, desc, ymd(rep), due ? ymd(due) : null]);
      }
      await conn.query(`INSERT INTO status_logs (application_id, step_order, status_code, step_name, action, note, pic_label, created_at)
        VALUES (?,?,?,?,?,?,?,?)`, [id, 5, 'ST-05', steps[4].name, 'temuan', 'Laporan audit terbit dengan 1 temuan minor dan 1 observasi. Mohon perbaiki sebelum tenggat.', 'Admin', ago(x.audit)]);
    }
    if (x.done) {
      await conn.query('INSERT INTO certificates (application_id, certificate_no, issued_at, file_path) VALUES (?,?,?,?)',
        [id, x.done, ymd(ago(1)), putPdf(`seed-sertifikat-${id}.pdf`, `Sertifikat SPPT SNI ${x.done}`)]);
    }
    if (x.svc === 'KAL') {
      await conn.query('INSERT INTO equipment (application_id, name, brand_model, serial_number, range_capacity, resolution, calibration_points) VALUES (?,?,?,?,?,?,?)',
        [id, 'Timbangan digital', 'AND FX-3000i', '12345678', '0–3100 g', '0,01 g', '500, 1000, 2000, 3000 g']);
    }
  }
  await conn.end();
  console.log('✓ selesai. Login demo: superadmin@penilaistandaruji.com / password123');
})().catch((e) => {
  const hint = {
    ECONNREFUSED: 'MySQL belum berjalan. Buka XAMPP Control Panel lalu klik Start pada MySQL, kemudian ulangi.',
    ER_ACCESS_DENIED_ERROR: 'User/sandi database salah. Periksa DB_USER dan DB_PASS di server/.env (XAMPP default: DB_USER=root, DB_PASS kosong).',
    ER_BAD_DB_ERROR: `Database "${process.env.DB_NAME}" belum ada. Buat dulu lewat phpMyAdmin: CREATE DATABASE ${process.env.DB_NAME};`,
  }[e.code === 'ER_DBACCESS_DENIED_ERROR' ? 'ER_BAD_DB_ERROR' : e.code];
  console.error(hint ? `\n✗ ${hint}\n` : e);
  process.exit(1);
});
