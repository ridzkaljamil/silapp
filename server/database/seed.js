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
    ST('LAB-05', 'Pengujian laboratorium', 65), ST('LAB-06', 'Review & verifikasi hasil', 80),
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
    const [r] = await conn.query('INSERT INTO products (service_id, category, name) VALUES (?,?,?)', [svcId[code], lp.b, lp.n]);
    for (const [name, method] of lp.p) {
      await conn.query('INSERT INTO product_parameters (product_id, name, method) VALUES (?,?,?)', [r.insertId, name, method]);
    }
  }
  const [mik] = await conn.query('INSERT INTO products (service_id, category, name) VALUES (?,?,?)', [svcId.MIK, 'Mikrobiologi', 'Sampel pangan / minuman (contoh)']);
  for (const n of MIK_PARAMS) await conn.query('INSERT INTO product_parameters (product_id, name) VALUES (?,?)', [mik.insertId, n]);

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
  const [[npk]] = await conn.query("SELECT id FROM products WHERE name='Pupuk NPK padat' AND service_id=?", [svcId.KIM]);
  const [npkParams] = await conn.query('SELECT id, name, method FROM product_parameters WHERE product_id=? LIMIT 3', [npk.id]);
  const [[beras]] = await conn.query("SELECT id FROM products WHERE name='Beras' AND service_id=?", [svcId.SP]);
  const samples = [
    // [no, code, user, svc, product_id, label, step, status, pay, extra]
    ['PSU-SP-2609-0001', 'SLP-X2KD-4M7A', 'rina', 'SP', beras.id, 'Beras · SNI 6128:2020', 6, 'aktif', 'terverifikasi', { scheme: 'Sesuai acuan', type: 'Sertifikasi baru' }],
    ['PSU-KIM-2609-0001', 'SLP-C7WD-2KPM', 'rina', 'KIM', npk.id, 'Pupuk NPK padat (2 sampel)', 5, 'aktif', 'terverifikasi', { params: true }],
    ['PSU-KAL-2610-0001', 'SLP-9RTE-3LQW', 'dimas', 'KAL', null, 'Timbangan digital AND FX-3000i', 1, 'aktif', 'belum', { location: 'lab' }],
  ];
  for (const [no, code, u, svc, pid, label, step, status, pay, ex] of samples) {
    const [r] = await conn.query(
      'INSERT INTO applications (application_no, tracking_code, user_id, service_id, product_id, product_label, current_step_order, status, payment_status, scheme, application_type, location) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [no, code, uid[u], svcId[svc], pid, label, step, status, pay, ex.scheme || null, ex.type || null, ex.location || null]);
    const [steps] = await conn.query('SELECT * FROM service_steps WHERE service_id=? ORDER BY step_order', [svcId[svc]]);
    for (let i = 1; i <= step; i++) {
      const st = steps[i - 1];
      if (st.is_optional) continue;
      const d = new Date(Date.now() - (step - i + 1) * 2 * 86400000);
      await conn.query(
        'INSERT INTO status_logs (application_id, step_order, status_code, step_name, action, note, pic_label, created_at) VALUES (?,?,?,?,?,?,?,?)',
        [r.insertId, i, st.status_code, st.name, i === 1 ? 'buat' : 'mulai', i === 1 ? 'Pengajuan dibuat oleh pelanggan.' : 'Tahap dimulai.', i === 1 ? 'Pelanggan' : 'Admin', d]);
    }
    if (ex.params) {
      for (const [k, p] of npkParams.entries()) {
        await conn.query('INSERT INTO application_parameters (application_id, parameter_id, name, method, status) VALUES (?,?,?,?,?)',
          [r.insertId, p.id, p.name, p.method, k === 0 ? 'selesai' : k === 1 ? 'uji' : 'antri']);
      }
      await conn.query('INSERT INTO samples (application_id, description, quantity) VALUES (?,?,?)', [r.insertId, 'Pupuk NPK padat', 2]);
    }
    if (svc === 'KAL') {
      await conn.query('INSERT INTO equipment (application_id, name, brand_model, serial_number, range_capacity, resolution, calibration_points) VALUES (?,?,?,?,?,?,?)',
        [r.insertId, 'Timbangan digital', 'AND FX-3000i', '12345678', '0–3100 g', '0,01 g', '500, 1000, 2000, 3000 g']);
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
