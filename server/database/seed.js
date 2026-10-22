/**
 * Membuat ulang tabel (schema.sql) lalu mengisi data awal.
 *   npm run db:reset       data master + akun demo (sandi password123) + pengajuan contoh, memakai server/.env
 *   npm run db:reset:demo  sama, memakai server/.env.demo (database & Vercel Blob untuk hosting demo)
 *   npm run db:init        data master saja (layanan, tahapan, form, harga, ruang lingkup, survei, pengaturan), tanpa akun
 * Semua perintah ini MENGHAPUS seluruh data lama, jadi ditolak saat NODE_ENV=production kecuali ditambah --paksa.
 */
// argumen: file env lain (opsional, relatif terhadap folder server) dan penanda --bersih / --paksa
const ARGS = process.argv.slice(2);
const BERSIH = ARGS.includes('--bersih');
const envArg = ARGS.find((a) => !a.startsWith('--'));
const ENV_FILE = envArg ? require('path').resolve(__dirname, '..', envArg) : require('path').join(__dirname, '..', '.env');
if (!require('fs').existsSync(ENV_FILE)) { console.error(`File ${ENV_FILE} tidak ditemukan.`); process.exit(1); }
require('dotenv').config({ path: ENV_FILE });
if (process.env.NODE_ENV === 'production' && !ARGS.includes('--paksa')) {
  console.error('\n✗ Dibatalkan: perintah ini menghapus SELURUH data di database dan tidak boleh dijalankan di server produksi.' +
    '\n  Untuk server baru, import file database/silapp-init.sql lewat phpMyAdmin (lihat DEPLOY-CPANEL.md).\n');
  process.exit(1);
}
process.env.TZ = process.env.APP_TZ || 'Asia/Jakarta';
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { SPC, SP_PRODUCTS } = require('./scope-data');
const { LAB_PRICES } = require('./price-data');
const { taxes } = require('../src/utils/pricing');
const storage = require('../src/utils/storage');

const ST = (c, n, p, o = {}) => ({ c, n, p, ...o });
const BILL = 'Invoice & Faktur'; // tahap akhir setelah sertifikat/LHU terbit: invoice, faktur pajak, bukti bayar, bukti potong
const OFFER = 'Penawaran & Kontrak'; // tahap 3: skema pembayaran, kontrak, proforma invoice
const STEPS = {
  SP: [ST('ST-01', 'Permohonan Diterima', 10), ST('ST-02', 'Verifikasi & Tinjauan Permohonan', 20),
    ST('ST-03', OFFER, 30, { pay: 1 }), ST('ST-04', 'Penjadwalan & Penugasan', 40),
    ST('ST-05', 'Evaluasi/Audit & Sampling', 50), ST('ST-06', 'Pengujian Laboratorium', 60),
    ST('ST-07', 'Tindakan Perbaikan', 70, { opt: 1 }), ST('ST-08', 'Review Hasil Evaluasi', 80),
    ST('ST-09', 'Keputusan Sertifikasi', 90), ST('ST-10', 'Sertifikat Terbit', 95, { cert: 1 }), ST('ST-11', BILL, 98, { bill: 1 })],
  LAB: [ST('LAB-01', 'Permohonan Diterima', 10), ST('LAB-02', 'Sampel Diterima & Diregistrasi', 20),
    ST('LAB-03', OFFER, 35, { pay: 1 }), ST('LAB-04', 'Proses Pengujian', 60),
    ST('LAB-05', 'Review & Verifikasi Hasil', 80), ST('LAB-06', 'Penyusunan LHU', 90, { cert: 1 }), ST('LAB-07', 'LHU Terbit', 95),
    ST('LAB-08', BILL, 98, { bill: 1 })],
  KAL: [ST('KAL-01', 'Permohonan Diterima', 10), ST('KAL-02', OFFER, 20, { pay: 1 }),
    ST('KAL-03', 'Alat Diterima & Diregistrasi', 30), ST('KAL-04', 'Persiapan Kalibrasi', 40),
    ST('KAL-05', 'Pelaksanaan Kalibrasi', 65), ST('KAL-06', 'Review & Verifikasi Hasil', 80),
    ST('KAL-07', 'Penerbitan Sertifikat', 90, { cert: 1 }), ST('KAL-08', 'Sertifikat Terbit', 95),
    ST('KAL-09', 'Pengembalian Alat', 95, { opt: 1 }), ST('KAL-10', BILL, 98, { bill: 1 })],
  // Sertifikasi Produk skema Tipe 1b: tanpa audit & tindakan perbaikan, review + keputusan digabung
  SP_1B: [ST('ST-01', 'Permohonan Diterima', 10), ST('ST-02', 'Verifikasi & Tinjauan Permohonan', 20),
    ST('ST-03', OFFER, 30, { pay: 1 }), ST('ST-04', 'Penjadwalan & Penugasan', 40),
    ST('ST-05', 'Sampling', 50), ST('ST-06', 'Pengujian Laboratorium', 65),
    ST('ST-07', 'Review & Keputusan', 85), ST('ST-08', 'Sertifikat Terbit', 95, { cert: 1 }), ST('ST-09', BILL, 98, { bill: 1 })],
  // Lembaga Sistem Manajemen: seperti SP, tahap 5 tanpa sampling dan tanpa pengujian laboratorium
  LSM: [ST('LSM-01', 'Permohonan Diterima', 10), ST('LSM-02', 'Verifikasi & Tinjauan Permohonan', 20),
    ST('LSM-03', OFFER, 30, { pay: 1 }), ST('LSM-04', 'Penjadwalan & Penugasan', 40),
    ST('LSM-05', 'Evaluasi/Audit', 55), ST('LSM-06', 'Tindakan Perbaikan', 70, { opt: 1 }), ST('LSM-07', 'Review Hasil Evaluasi', 80),
    ST('LSM-08', 'Keputusan Sertifikasi', 90), ST('LSM-09', 'Sertifikat Terbit', 95, { cert: 1 }), ST('LSM-10', BILL, 98, { bill: 1 })],
};

const SERVICES = [
  { code: 'SP', parent: null, bidang: 'SP', name: 'Sertifikasi Produk', steps: 'SP', est: '15–45 hari kerja', state: 'ok',
    desc: 'Sertifikasi SPPT SNI skema Tipe 5 dan Tipe 1B untuk pangan, minuman, pupuk, dan pasar rakyat.' },
  { code: 'LAB', parent: null, bidang: null, name: 'Laboratorium', steps: null, est: null, state: 'ok',
    desc: 'Laboratorium pengujian dan kalibrasi PT Penilai Standar Uji.' },
  { code: 'KIM', parent: 'LAB', bidang: 'LAB', name: 'Laboratorium Kimia', steps: 'LAB', est: 'Reguler 5–7 hari, Ekspress 2–3 hari per sampel', state: 'ok',
    desc: 'Uji kimia pupuk, beras, dan minyak goreng sawit: unsur hara, kadar air, asam bebas, dan cemaran logam.' },
  { code: 'FIS', parent: 'LAB', bidang: 'LAB', name: 'Laboratorium Fisika', steps: 'LAB', est: '7–14 hari kerja', state: 'ok',
    desc: 'Uji fisik peralatan masak dan makan dari logam, serta mutu fisik beras dan minyak goreng sawit.' },
  { code: 'MIK', parent: 'LAB', bidang: 'LAB', name: 'Laboratorium Mikrobiologi', steps: 'LAB', est: null, state: 'dev',
    desc: 'Uji cemaran mikroba pada sampel produk.' },
  { code: 'KAL', parent: 'LAB', bidang: 'KAL', name: 'Laboratorium Kalibrasi', steps: 'KAL', est: '3–10 hari kerja per alat', state: 'prep',
    desc: 'Kalibrasi alat ukur di laboratorium atau on-site.' },
  { code: 'LSM', parent: null, bidang: null, name: 'Lembaga Sistem Manajemen Mutu', steps: 'LSM', est: null, state: 'prep',
    desc: 'Sertifikasi sistem manajemen mutu dan keamanan pangan untuk organisasi Anda.' },
];
/** Ruang lingkup Lembaga Sistem Manajemen: [kategori, standar, nama]. */
const LSM_SCOPE = [['Sistem Manajemen', 'ISO 9001', 'Sistem Manajemen Mutu'], ['Sistem Manajemen', 'ISO 22000', 'Sistem Manajemen Keamanan Pangan']];
/** Template dokumen bawaan (file Word di database/templates). */
const TEMPLATES = [
  ['Surat Permohonan', 'Diisi dan ditandatangani pimpinan perusahaan, lalu diunggah di Langkah 3.', 'surat-permohonan.docx'],
  ['Surat Kesediaan Surveillance', 'Diperlukan jika Anda mencentang Surveillance pada jenis permohonan.', 'surat-kesediaan-surveillance.docx'],
  ['Surat Pernyataan Keaslian Dokumen', 'Pernyataan bahwa seluruh dokumen yang diunggah benar dan sah.', 'surat-pernyataan-keaslian-dokumen.docx'],
];

/* ---------- form builder bawaan (bisa diubah Super Admin) ---------- */
/** Kontak umum PSU: jadi contact person bawaan setiap layanan (bisa diubah di Master layanan). */
const CONTACT = { name: 'Layanan Pelanggan PSU', phone: '+62 819-0834-4114', email: 'psuindonesia.info@gmail.com' };

const FLD = (key, label, type = 'text', o = {}) => ({ key, label, type, ...o });
const LAB_FIELDS = [FLD('keterangan', 'Keterangan Tambahan', 'textarea')];
const FIELDS = {
  // isian Tipe 1b mengikuti form yang disusun PSU saat demo; B/L, Packing List, dan Invoice berupa Nomor + Tanggal
  SP: [FLD('nama_pabrik', 'Nama Pabrik', 'text', { req: 1 }), FLD('alamat_pabrik', 'Alamat Pabrik', 'textarea', { req: 1 }),
    FLD('kota_provinsi', 'Kota Pabrik', 'text', { req: 1 }), FLD('provinsi_pabrik', 'Provinsi Pabrik', 'text', { req: 1 }),
    FLD('batch', 'Nomor Bill Of Lading', 'nomor_tanggal', { when: '1B', req: 1, multi: 1 }), FLD('jumlah', 'Jumlah Produk', 'text', { when: '1B', req: 1 }),
    FLD('shipment', 'Nomor Packing List', 'nomor_tanggal', { when: '1B', req: 1, multi: 1 }), FLD('nomor_invoice', 'Nomor Invoice', 'nomor_tanggal', { when: '1B', req: 1, multi: 1 }),
    FLD('asal', 'Negara Asal', 'text', { when: '1B' }), FLD('pelabuhan', 'Pelabuhan Asal', 'text', { when: '1B', req: 1 })],
  KIM: LAB_FIELDS, FIS: LAB_FIELDS, MIK: LAB_FIELDS,
  KAL: [FLD('tanggal_diinginkan', 'Tanggal Kalibrasi yang Diinginkan', 'date')],
};
const DOC = (name, req = 0, pkg = 0, when = null, hide = null) => ({ name, req, pkg, when, hide });
const LAB_DOCS = [DOC('Surat Permohonan Pengujian', 1), DOC('Data Sampel / Spesifikasi')];
const DOCS = {
  // hide 'Tipe 1b': berkas tidak diminta untuk skema Tipe 1b (masukan PSU)
  SP: [DOC('Surat Permohonan', 1, 1), DOC('Surat Kesediaan Surveillance', 1, 0, null, 'Tipe 1b'), DOC('Surat Pernyataan Keaslian Dokumen', 1, 0, null, 'Tipe 1b'),
    DOC('Akta Perusahaan & NIB', 1), DOC('Spesifikasi Produk'), DOC('Sertifikat Merek'), DOC('Dokumen Sistem Mutu', 0, 0, null, 'Tipe 1b')],
  KIM: LAB_DOCS, FIS: LAB_DOCS, MIK: LAB_DOCS,
  KAL: [DOC('Surat Permohonan Kalibrasi', 1), DOC('Foto / Data Teknis Alat')],
};
/* ---------- survei kepuasan per layanan (dokumen Survei Kepuasan Pelanggan PSU) ---------- */
const SURVEY = {
  SP: [
    'Informasi mengenai persyaratan, tahapan, biaya, dan estimasi waktu proses sertifikasi disampaikan dengan jelas.',
    'Proses pendaftaran/permohonan sertifikasi mudah dilakukan dan persyaratan dokumen mudah dipahami.',
    'Petugas PSU memberikan respons terhadap pertanyaan atau permintaan informasi secara cepat dan membantu.',
    'Penjadwalan audit/evaluasi dikomunikasikan dengan baik dan disepakati bersama pelanggan.',
    'Auditor/evaluator melaksanakan kegiatan secara profesional, sopan, kompeten, dan tepat waktu.',
    'Proses audit/evaluasi dilaksanakan secara objektif, konsisten, dan tidak memihak.',
    'Ruang lingkup audit/evaluasi serta tahapan yang dilakukan dijelaskan dengan baik kepada pelanggan.',
    'Temuan atau hasil evaluasi disampaikan secara jelas, mudah dipahami, dan disertai penjelasan tindak lanjut yang diperlukan.',
    'Informasi mengenai status proses sertifikasi dan tindak lanjut perbaikan disampaikan secara memadai.',
    'Proses pengambilan keputusan dan penerbitan sertifikat dilakukan dalam waktu yang wajar sesuai ketentuan yang berlaku.',
    'Sertifikat/dokumen hasil sertifikasi yang diterbitkan memiliki informasi yang jelas dan sesuai dengan ruang lingkup yang disetujui.',
    'Penanganan keluhan, keberatan, atau permintaan klarifikasi dilayani dengan baik apabila diperlukan.',
    'Kerahasiaan informasi dan data perusahaan kami dijaga dengan baik selama proses sertifikasi.',
    'Secara keseluruhan, saya puas terhadap layanan sertifikasi produk yang diberikan PSU.',
  ],
  LAB: [
    'Informasi mengenai jenis pengujian, metode, persyaratan sampel, biaya, dan estimasi waktu penyelesaian disampaikan dengan jelas.',
    'Proses permintaan layanan dan administrasi pengujian mudah dilakukan.',
    'Petugas memberikan arahan yang jelas mengenai jumlah, kondisi, pengemasan, dan penyerahan sampel.',
    'Proses penerimaan, identifikasi, dan pencatatan sampel dilakukan dengan tertib dan jelas.',
    'Petugas laboratorium memberikan respons terhadap pertanyaan atau permintaan informasi secara cepat dan membantu.',
    'Petugas memberikan pelayanan secara profesional, sopan, dan kompeten.',
    'Sampel pelanggan ditangani dan disimpan dengan baik selama proses pengujian sesuai ketentuan yang berlaku.',
    'Pelaksanaan pengujian dan penyampaian status pekerjaan dilakukan sesuai estimasi waktu yang diinformasikan.',
    'Apabila terjadi perubahan jadwal atau kendala, informasi disampaikan kepada pelanggan dengan jelas dan tepat waktu.',
    'Laporan Hasil Uji (LHU) disajikan dengan jelas, lengkap, dan mudah dipahami.',
    'Informasi hasil pengujian pada LHU sesuai dengan sampel dan parameter yang diminta.',
    'LHU diterbitkan dan disampaikan dalam waktu yang sesuai dengan kesepakatan layanan.',
    'Kerahasiaan informasi, data pelanggan, dan hasil pengujian dijaga dengan baik.',
    'Penanganan keluhan atau permintaan klarifikasi atas layanan/hasil pengujian dilayani dengan baik apabila diperlukan.',
    'Secara keseluruhan, saya puas terhadap layanan Laboratorium Pengujian PSU.',
  ],
  KAL: [
    'Informasi mengenai ruang lingkup kalibrasi, kemampuan layanan, persyaratan alat, biaya, dan estimasi waktu penyelesaian disampaikan dengan jelas.',
    'Proses permintaan layanan dan administrasi kalibrasi mudah dilakukan.',
    'Petugas memberikan informasi yang jelas mengenai persiapan, pengiriman, dan penerimaan alat yang akan dikalibrasi.',
    'Proses penerimaan, identifikasi, dan pencatatan alat dilakukan dengan tertib dan jelas.',
    'Petugas laboratorium memberikan respons terhadap pertanyaan atau permintaan informasi secara cepat dan membantu.',
    'Petugas memberikan pelayanan secara profesional, sopan, dan kompeten.',
    'Alat pelanggan ditangani, disimpan, dan dikembalikan dalam kondisi yang baik sesuai ketentuan layanan.',
    'Pelaksanaan kalibrasi dilakukan sesuai jadwal/estimasi waktu yang telah diinformasikan.',
    'Apabila terjadi perubahan jadwal atau kendala, informasi disampaikan kepada pelanggan dengan jelas dan tepat waktu.',
    'Sertifikat Kalibrasi disajikan dengan jelas, lengkap, dan mudah dipahami.',
    'Identitas alat, hasil kalibrasi, satuan, dan informasi ketidakpastian pengukuran pada sertifikat sesuai dan mudah ditelusuri.',
    'Sertifikat Kalibrasi diterbitkan dan disampaikan dalam waktu yang sesuai dengan kesepakatan layanan.',
    'Kerahasiaan informasi, data pelanggan, dan hasil kalibrasi dijaga dengan baik.',
    'Penanganan keluhan atau permintaan klarifikasi atas layanan/hasil kalibrasi dilayani dengan baik apabila diperlukan.',
    'Secara keseluruhan, saya puas terhadap layanan Laboratorium Kalibrasi PSU.',
  ],
};
const SURVEY_INTRO = {
  SP: 'Survei ini ditujukan kepada pelanggan yang telah menggunakan layanan sertifikasi produk PSU. Penilaian Anda tidak memengaruhi keputusan sertifikasi dan digunakan semata-mata untuk evaluasi serta peningkatan mutu layanan.',
  LAB: 'Survei ini ditujukan kepada pelanggan yang telah menggunakan layanan Laboratorium Pengujian PSU. Penilaian Anda digunakan untuk mengevaluasi mutu pelayanan, komunikasi, ketepatan waktu, dan kualitas penyampaian hasil pengujian.',
  KAL: 'Survei ini ditujukan kepada pelanggan yang telah menggunakan layanan Laboratorium Kalibrasi PSU. Penilaian Anda digunakan untuk mengevaluasi mutu pelayanan, penanganan alat, ketepatan waktu, dan kualitas sertifikat kalibrasi.',
};
const THANKS = 'Terima kasih atas penilaian dan masukan Anda. Tanggapan Anda sangat berarti bagi PT Penilai Standar Uji (PSU) dan akan kami gunakan untuk meningkatkan mutu layanan secara berkelanjutan.';
// Proyek sertifikasi sebelum SILAPP (contoh/dummy)
const LEGACY = [
  ['PT Contoh Pangan Lestari', 'Kab. Bekasi, Jawa Barat', 'Biskuit', 'SNI 2973:2011', 'PSU-SPPT-2023-0012', '2023-03-14', '2027-03-13', 'aktif'],
  ['PT Saus Sedap Contoh', 'Kota Tangerang, Banten', 'Saus Sambal', 'SNI 2976:2006', 'PSU-SPPT-2024-0045', '2024-11-05', '2028-11-04', 'ditangguhkan'],
  ['CV Kopi Nusantara Contoh', 'Kab. Temanggung, Jawa Tengah', 'Kopi Instan', 'SNI 2983:2014', 'PSU-SPPT-2022-0031', '2022-08-02', '2026-08-01', 'aktif'],
  ['PT Gula Manis Contoh', 'Kab. Lampung Tengah, Lampung', 'Gula Kristal Putih', 'SNI 3140.3:2020', 'PSU-SPPT-2021-0007', '2021-05-19', '2025-05-18', 'dicabut'],
];

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
  ['user', 'Rina Hapsari', 'rina@sinarcontoh.co.id', null, null, 'PT Sinar Contoh Abadi', 'Jl. Industri Contoh No. 8, Kawasan KIIC, Kab. Karawang, Jawa Barat', '9120001234567', '0123456789012345'],
  ['user', 'Dimas Prakoso', 'dimas@tanisubur.co.id', null, null, 'CV Tani Subur Persada', 'Jl. Raya Contoh Km 4, Kab. Malang, Jawa Timur', '9120007654321', '0987654321098765'],
];

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: +process.env.DB_PORT || 3306, user: process.env.DB_USER,
    password: process.env.DB_PASS, database: process.env.DB_NAME, multipleStatements: true,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_STRICT !== 'false' } : undefined,
  });
  await conn.query(`SET time_zone = ${conn.escape(process.env.DB_TIMEZONE || '+07:00')}`);
  console.log(`> database ${process.env.DB_NAME} di ${process.env.DB_HOST}, file di ${storage.IS_BLOB ? 'Vercel Blob' : 'server/uploads'}`);
  console.log('> membuat tabel ...');
  await conn.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  console.log('> layanan & status tracking ...');
  const svcId = {};
  let order = 0;
  for (const s of SERVICES) {
    const [r] = await conn.query(
      'INSERT INTO services (parent_id, code, name, description, bidang, cp_name, cp_phone, est_text, state, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [s.parent ? svcId[s.parent] : null, s.code, s.name, s.desc, s.bidang, s.bidang ? CONTACT.name : null, s.bidang ? CONTACT.phone : null, s.est, s.state, order++]);
    svcId[s.code] = r.insertId;
    if (!s.steps) continue;
    // alur utama + alur khusus (SP: Tipe 1b)
    for (const [flow, list] of [['', STEPS[s.steps]], ['1B', STEPS[`${s.steps}_1B`]]]) {
      for (const [i, st] of (list || []).entries()) {
        await conn.query(
          'INSERT INTO service_steps (service_id, step_order, status_code, name, progress_pct, is_optional, is_payment_step, is_certificate_step, is_billing_step, flow) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [r.insertId, i + 1, st.c, st.n, st.p, st.opt || 0, st.pay || 0, st.cert || 0, st.bill || 0, flow]);
      }
    }
  }

  console.log('> ruang lingkup ...');
  for (const p of SP_PRODUCTS) {
    await conn.query(
      'INSERT INTO products (service_id, category, sub_category, name, standard_no, scheme_reference, scheme_types) VALUES (?,?,?,?,?,?,?)',
      [svcId.SP, SPC[p[0]], p[1], p[2], p[3], p[4] || null, p[5] || null]);
  }
  for (const [cat, std, name] of LSM_SCOPE) {
    await conn.query('INSERT INTO products (service_id, category, name, standard_no) VALUES (?,?,?,?)', [svcId.LSM, cat, name, std]);
  }
  for (const lp of LAB_PRICES) {
    const [r] = await conn.query('INSERT INTO products (service_id, category, name, standard_no, package_price, package_price_alt, alt_available, note, custom_name) VALUES (?,?,?,?,?,?,?,?,?)',
      [svcId[lp.svc], lp.cat, lp.n, lp.sni || null, lp.pkg[0] ?? null, lp.pkg[1] ?? null, lp.alt === 0 ? 0 : 1, lp.note || null, lp.custom || 0]);
    for (const [name, method, price, alt] of lp.p) {
      await conn.query('INSERT INTO product_parameters (product_id, name, method, price, price_alt) VALUES (?,?,?,?,?)', [r.insertId, name, method, price, alt ?? null]);
    }
  }

  console.log('> form isian, berkas, survei, pengaturan ...');
  for (const [code, list] of Object.entries(FIELDS)) {
    for (const [i, f] of list.entries()) {
      await conn.query('INSERT INTO service_fields (service_id, field_key, label, type, required, show_when, multiple, sort_order) VALUES (?,?,?,?,?,?,?,?)',
        [svcId[code], f.key, f.label, f.type, f.req || 0, f.when || null, f.multi || 0, i]);
    }
  }
  for (const [code, list] of Object.entries(DOCS)) {
    for (const [i, d] of list.entries()) {
      await conn.query('INSERT INTO service_documents (service_id, name, required, admin_if_package, show_when, hide_schemes, sort_order) VALUES (?,?,?,?,?,?,?)', [svcId[code], d.name, d.req, d.pkg, d.when, d.hide || null, i]);
    }
  }
  for (const [bidang, list] of Object.entries(SURVEY)) {
    for (const [i, t] of list.entries()) await conn.query('INSERT INTO survey_questions (bidang, question, sort_order) VALUES (?,?,?)', [bidang, t, i]);
    await conn.query('INSERT INTO settings (skey, svalue) VALUES (?,?)', [`survey_intro_${bidang}`, SURVEY_INTRO[bidang]]);
  }
  await conn.query('INSERT INTO settings (skey, svalue) VALUES (?,?),(?,?),(?,?)',
    ['thank_you_text', THANKS, 'contact_phone', CONTACT.phone, 'contact_email', CONTACT.email]);
  if (BERSIH) {
    // data master saja: akun Super Admin pertama dibuat dari SUPERADMIN_* di .env saat server dinyalakan,
    // template dokumen disalin otomatis ke penyimpanan file saat server pertama kali berjalan
    await conn.end();
    console.log('✓ selesai. Data master siap, belum ada akun pengguna.');
    return;
  }
  // riwayat awal sertifikat contoh (alasan contoh untuk yang ditangguhkan/dicabut)
  const REASON = { ditangguhkan: 'Hasil surveilan belum memenuhi persyaratan, menunggu tindakan perbaikan.', dicabut: 'Tidak menindaklanjuti hasil surveilan dalam batas waktu.' };
  const certLog = (source, id, no, action, status, note, at) => conn.query(
    'INSERT INTO certificate_logs (source, cert_id, certificate_no, action, status, note, pic_label, created_at) VALUES (?,?,?,?,?,?,?,?)',
    [source, id, no, action, status, note, 'Admin', at]);
  for (const l of LEGACY) {
    const [r] = await conn.query('INSERT INTO legacy_certificates (factory_name, factory_address, product, sni_no, certificate_no, issued_at, expires_at, status) VALUES (?,?,?,?,?,?,?,?)', l);
    await certLog('lama', r.insertId, l[4], 'terbit', 'aktif', `Data proyek sebelum SILAPP ditambahkan (terbit ${l[5]}, berlaku sampai ${l[6]}).`, `${l[5]} 09:00:00`);
    if (REASON[l[7]]) await certLog('lama', r.insertId, l[4], 'status', l[7], REASON[l[7]], `${l[5].slice(0, 4) * 1 + 1}${l[5].slice(4)} 10:00:00`);
  }

  console.log('> akun demo (sandi: password123) ...');
  const hash = await bcrypt.hash('password123', 10);
  const uid = {};
  for (const [role, name, email, jabatan, bidang, company, address = null, nib = null, npwp = null] of USERS) {
    const [r] = await conn.query(
      'INSERT INTO users (role, name, email, password_hash, jabatan, bidang, company_name, nib, npwp, phone, address) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [role, name, email, hash, jabatan, bidang, company, nib, npwp, '0812-0000-0000', address]);
    uid[email.split('@')[0]] = r.insertId;
  }

  console.log('> pengajuan contoh ...');
  // data lama dihapus, jadi file unggahan lama ikut dibersihkan
  await storage.clearAll();
  for (const [i, [name, desc, file]] of TEMPLATES.entries()) {
    const stored = await storage.save(fs.readFileSync(path.join(__dirname, 'templates', file)), file, 'template-');
    await conn.query('INSERT INTO doc_templates (name, description, file_path, original_name, sort_order) VALUES (?,?,?,?,?)', [name, desc, stored, file, i]);
  }
  const putPdf = (name, title) => storage.save(samplePdf(title), name);
  const [[npk]] = await conn.query("SELECT id FROM products WHERE name='Pupuk NPK Padat' AND category='Uji SNI' AND service_id=?", [svcId.KIM]);
  const [npkParams] = await conn.query('SELECT id, name, method, price FROM product_parameters WHERE product_id=? LIMIT 3', [npk.id]);
  const prod = async (name) => (await conn.query('SELECT id, name, standard_no FROM products WHERE name=? AND service_id=?', [name, svcId.SP]))[0][0];
  const beras = await prod('Beras'), kopi = await prod('Kopi Instan'), minyak = await prod('Minyak Goreng Sawit');
  const [[impor]] = await conn.query("SELECT id, name, standard_no FROM products WHERE service_id=? AND scheme_types LIKE '%1b%' ORDER BY id LIMIT 1", [svcId.SP]);
  const ago = (d) => new Date(Date.now() - d * 86400000);
  const ymd = (d) => d.toISOString().slice(0, 10);
  const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
  const spDetails = (pabrik, alamat, kota, merek) => [['nama_pabrik', 'Nama Pabrik', pabrik], ['alamat_pabrik', 'Alamat Pabrik', alamat], ['kota_provinsi', 'Kota Pabrik', kota.split(', ')[0]], ['provinsi_pabrik', 'Provinsi Pabrik', kota.split(', ')[1] || ''], ['merek_jenis', 'Merek & Jenis', merek]];

  // berkas persyaratan SP yang diunggah pelanggan saat mengajukan (berkas contoh)
  const SP_DOCS = ['Surat Permohonan', 'Surat Kesediaan Surveillance', 'Surat Pernyataan Keaslian Dokumen', 'Akta Perusahaan & NIB'];
  const samples = [
    // SP di ST-06, sudah audit dengan temuan
    { no: 'PSU-SP-2609-0001', code: 'SLP26-X2KD4M7A', u: 'rina', svc: 'SP', docs: SP_DOCS, pid: beras.id, label: `Beras · ${beras.standard_no}`, step: 6, pay: 'terverifikasi', amount: 25000000,
      scheme: null, origin: 'dn', type: 'Sertifikasi Awal', details: spDetails('PT Sinar Contoh Abadi – Pabrik Karawang', 'Jl. Industri Contoh No. 8, Kawasan KIIC', 'Kab. Karawang, Jawa Barat', 'Beras Sinar · Premium'),
      audit: 3, findings: [['minor', 'Catatan pemantauan suhu gudang tidak lengkap untuk 2 minggu terakhir.'], ['observasi', 'Label palet sebaiknya mencantumkan tanggal penerimaan.']] },
    // Lab kimia di LAB-05
    { no: 'PSU-KIM-2609-0001', code: 'SLP26-C7WD2KPM', u: 'rina', svc: 'KIM', pid: npk.id, label: 'Pupuk NPK Padat (2 sampel)', step: 4, pay: 'terverifikasi', params: true, details: [['kode_sampel', 'Kode Sampel', 'NPK-B12'], ['merek_spesifikasi', 'Brand / Spesifikasi Produk', '1. TANIJAYA / NPK 16-16-16\n2. TANIJAYA / NPK 15-15-15']] },
    // Kalibrasi baru masuk
    { no: 'PSU-KAL-2610-0001', code: 'SLP26-9RTE3LQW', u: 'dimas', svc: 'KAL', pid: null, label: 'Timbangan digital AND FX-3000i', step: 1, pay: 'belum', location: 'lab' },
    // SP paket LSPro + Lab di ST-03, invoice belum terbit
    { no: 'PSU-SP-2610-0002', code: 'SLP26-M4PQ7HZT', u: 'dimas', svc: 'SP', pid: kopi.id, label: `Kopi Instan · ${kopi.standard_no} · Tipe 5`, step: 3, pay: 'belum', scheme: 'Tipe 5', origin: 'dn', type: 'Sertifikasi Awal, Surveillance', pkg: 1,
      details: spDetails('CV Tani Subur Persada', 'Jl. Raya Contoh Km 4', 'Kab. Malang, Jawa Timur', '1. Kopi Subur · Original\n2. Kopi Subur · Mocca'), docs: ['Surat Kesediaan Surveillance', 'Surat Pernyataan Keaslian Dokumen', 'Akta Perusahaan & NIB'] },
    // SP selesai, sertifikat terbit, survei belum diisi
    { no: 'PSU-SP-2608-0003', code: 'SLP26-R8NB5JVC', u: 'rina', svc: 'SP', docs: SP_DOCS, pid: minyak.id, label: `Minyak Goreng Sawit · ${minyak.standard_no} · Tipe 5`, step: 10, pay: 'terverifikasi', amount: 28000000, scheme: 'Tipe 5', origin: 'dn', type: 'Sertifikasi Awal', done: 'PSU-SPPT-2026-0001',
      details: spDetails('PT Sinar Contoh Abadi – Pabrik Cikarang', 'Jl. Contoh Raya Blok C-5, Cikarang', 'Kab. Bekasi, Jawa Barat', 'Sinar Gold · Kemasan 2 L') },
    // SP Tipe 1b (produk impor per batch) di tahap Sampling — alur khusus 1b tanpa audit
    { no: 'PSU-SP-2610-0004', code: 'SLP26-B1QK8TNV', u: 'rina', svc: 'SP', pid: impor.id, label: `${impor.name} · ${impor.standard_no} · Tipe 1b`, step: 5, pay: 'terverifikasi', amount: 18000000, scheme: 'Tipe 1b', flow: '1B', origin: 'ln', type: 'Sertifikasi Awal',
      details: [...spDetails('Sinar Trading Co., Ltd.', 'No. 18 Contoh Industrial Road', 'Guangzhou, Guangdong', 'Sinar Import · 500 g'),
        ['batch', 'Nomor Bill Of Lading', 'BL-GZ2610-0187 · 2 Okt 2026'], ['jumlah', 'Jumlah Produk', '1 kontainer 20 ft (1.200 karton)'],
        ['shipment', 'Nomor Packing List', 'PL-2610-044 · 30 Sep 2026'], ['nomor_invoice', 'Nomor Invoice', 'INV-ST-88231 · 30 Sep 2026'],
        ['asal', 'Negara Asal', 'Tiongkok'], ['pelabuhan', 'Pelabuhan Asal', 'Nansha, Guangzhou']] },
  ];
  const invSeq = {}; // nomor invoice urut per layanan
  for (const x of samples) {
    const [r] = await conn.query(
      `INSERT INTO applications (application_no, tracking_code, user_id, service_id, product_id, product_label, current_step_order, status, payment_status,
         scheme, origin, application_type, location, is_package, nc_flag, audit_report_date, created_at, flow) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [x.no, x.code, uid[x.u], svcId[x.svc], x.pid, x.label, x.step, x.done ? 'selesai' : 'aktif', x.pay, x.scheme || null, x.origin || null, x.type || null, x.location || null,
        x.pkg || 0, x.findings ? 1 : 0, x.audit ? ymd(ago(x.audit)) : null, ago(x.step * 2 + 1), x.flow || '']);
    const id = r.insertId;
    const [steps] = await conn.query('SELECT * FROM service_steps WHERE service_id=? AND flow=? ORDER BY step_order', [svcId[x.svc], x.flow || '']);
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
      await conn.query('INSERT INTO samples (application_id, description, quantity) VALUES (?,?,?)', [id, 'Pupuk NPK Padat', 2]);
      x.amount = npkParams.reduce((t, p) => t + +p.price, 0) * 2;
      // rincian invoice lab format PSU: satu baris per parameter (metode, harga per sampel, jumlah sampel)
      x.items = npkParams.map((p, k) => ({ label: `Biaya Pengujian\nPupuk NPK Padat\nParameter : ${p.name}`, method: p.method || '-', qty: 2, price: +p.price, amount: +p.price * 2,
        ...(k === 0 && { specs: ['TANIJAYA / NPK 16-16-16', 'TANIJAYA / NPK 15-15-15'] }) }));
    }
    if (x.pay === 'terverifikasi') {
      // harga belum termasuk PPN; pajak mengikuti format invoice PSU (DPP nilai lain, PPN 12%, PPh 23)
      const t = taxes(x.amount, x.svc === 'SP');
      invSeq[x.svc] = (invSeq[x.svc] || 0) + 1;
      const no = `${String(invSeq[x.svc]).padStart(3, '0')}/PSU/${x.svc}/${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][ago(x.step + 1).getMonth()]}/${ago(x.step + 1).getFullYear()}`;
      await conn.query(`INSERT INTO payments (application_id, invoice_no, invoice_seq, invoice_year, amount, dpp, dpp_lain, ppn, total, pph23, with_pph23, items, status, proof_path, paid_at, verified_at, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id, no, invSeq[x.svc], ago(x.step + 1).getFullYear(), t.grandTotal, t.price, t.dppLain, t.ppn, t.total, t.pph23, t.pph23 ? 1 : 0,
        JSON.stringify(x.items || [{ label: `Biaya ${x.label}`, amount: x.amount }]), 'terverifikasi', await putPdf(`seed-bukti-${id}.pdf`, 'Bukti transfer (contoh)'), ago(x.step), ago(x.step), ago(x.step + 1)]);
    }
    for (const d of x.docs || []) {
      await conn.query('INSERT INTO documents (application_id, doc_type, original_name, file_path, step_order, uploaded_by) VALUES (?,?,?,?,?,?)',
        [id, d, `${d.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`, await putPdf(`seed-${id}-${d.length}.pdf`, d), 1, uid[x.u]]);
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
      const [c] = await conn.query('INSERT INTO certificates (application_id, certificate_no, issued_at, expires_at, file_path) VALUES (?,?,?,?,?)',
        [id, x.done, ymd(ago(1)), ymd(addMonths(ago(1), 48)), await putPdf(`seed-sertifikat-${id}.pdf`, `Sertifikat SPPT SNI ${x.done}`)]);
      await certLog('silapp', c.insertId, x.done, 'terbit', 'aktif', `Terbit lewat pengajuan ${x.no} (terbit ${ymd(ago(1))}, berlaku sampai ${ymd(addMonths(ago(1), 48))}).`, ago(1));
    }
    if (x.svc === 'KAL') {
      await conn.query('INSERT INTO equipment (application_id, name, brand_model, serial_number, range_capacity, resolution, calibration_points) VALUES (?,?,?,?,?,?,?)',
        [id, 'Timbangan digital', 'AND FX-3000i', '12345678', '0–3100 g', '0,01 g', '500, 1000, 2000, 3000 g']);
    }
  }
  console.log('> notifikasi contoh ...');
  const [apps] = await conn.query('SELECT a.id, a.application_no, a.user_id, a.status, s.bidang, u.company_name FROM applications a JOIN services s ON s.id=a.service_id JOIN users u ON u.id=a.user_id ORDER BY a.id');
  const [staff] = await conn.query("SELECT id, role, bidang FROM users WHERE role IN ('admin','superadmin')");
  const N = (uid, title, body, link, read, daysAgo) => conn.query('INSERT INTO notifications (user_id, title, body, link, is_read, created_at) VALUES (?,?,?,?,?,?)', [uid, title, body, link, read, ago(daysAgo)]);
  for (const a of apps) {
    await N(a.user_id, 'Pengajuan diterima', `${a.application_no} · Gunakan kode lacak untuk memantau progres.`, `/klien/pengajuan/${a.id}`, 1, 9);
    for (const u of staff.filter((x) => x.role === 'superadmin' || x.bidang === a.bidang)) {
      await N(u.id, 'Pengajuan baru masuk', `${a.application_no} · ${a.company_name}`, `/admin/pengajuan/${a.id}`, a.status === 'selesai' ? 1 : 0, 6);
    }
  }
  await N(uid.rina, 'Hasil audit: temuan', 'PSU-SP-2609-0001 · 1 temuan minor dan 1 observasi perlu ditindaklanjuti.', `/klien/pengajuan/${apps[0].id}`, 0, 3);
  await N(uid.rina, 'Sertifikat Terbit', 'PSU-SP-2608-0003 · Isi survei kepuasan untuk mengunduh sertifikat.', `/klien/pengajuan/${apps[4].id}`, 0, 1);

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
