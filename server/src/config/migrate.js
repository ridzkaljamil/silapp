const fs = require('fs');
const path = require('path');
const { q, one } = require('./db');
const { UPLOAD_DIR } = require('../utils/upload');

/** Kolom yang ditambahkan setelah rilis awal. Ditambahkan otomatis jika belum ada. */
const COLUMNS = [
  ['users', 'avatar', 'VARCHAR(255) NULL AFTER address'],
  // harga lab: opsi kedua (Ekspress / Luar Negeri)
  ['products', 'package_price_alt', 'DECIMAL(14,2) NULL AFTER package_price'],
  ['products', 'alt_available', 'TINYINT(1) NOT NULL DEFAULT 1 AFTER package_price_alt'],
  ['products', 'note', 'VARCHAR(255) NULL AFTER alt_available'],
  ['product_parameters', 'price_alt', 'DECIMAL(14,2) NULL AFTER price'],
  ['applications', 'price_option', "ENUM('std','alt') NOT NULL DEFAULT 'std' AFTER full_sni"],
  // survei per layanan + identitas responden
  ['survey_questions', 'bidang', "ENUM('SP','LAB','KAL') NOT NULL DEFAULT 'SP' AFTER id"],
  ['survey_responses', 'bidang', "ENUM('SP','LAB','KAL') NOT NULL DEFAULT 'SP' AFTER user_id"],
  ['survey_responses', 'company_name', 'VARCHAR(160) NULL AFTER bidang'],
  ['survey_responses', 'respondent_name', 'VARCHAR(120) NULL AFTER company_name'],
  ['survey_responses', 'reference_no', 'VARCHAR(80) NULL AFTER respondent_name'],
  ['survey_responses', 'avg_score', 'DECIMAL(3,2) NULL AFTER reference_no'],
  ['survey_responses', 'contact_ok', 'TINYINT(1) NULL AFTER suggestion'],
  ['survey_responses', 'contact_info', 'VARCHAR(160) NULL AFTER contact_ok'],
  // revisi Oktober 2026
  ['applications', 'origin', "ENUM('dn','ln') NULL AFTER scheme"],
  ['service_documents', 'show_when', 'VARCHAR(10) NULL AFTER admin_if_package'],
  // invoice format PSU: DPP nilai lain, PPN 12%, PPh 23, nomor urut per tahun
  ['payments', 'invoice_seq', 'INT NULL AFTER invoice_no'],
  ['payments', 'invoice_year', 'INT NULL AFTER invoice_seq'],
  ['payments', 'dpp_lain', 'DECIMAL(14,2) NULL AFTER dpp'],
  ['payments', 'total', 'DECIMAL(14,2) NULL AFTER ppn'],
  ['payments', 'pph23', 'DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER total'],
  ['payments', 'with_pph23', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER pph23'],
];

/** Tabel yang ditambahkan setelah rilis awal. */
const TABLES = [
  `CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, title VARCHAR(160) NOT NULL, body VARCHAR(300) NULL, link VARCHAR(160) NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_notif_user (user_id, is_read),
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS survey_followups (
    id INT AUTO_INCREMENT PRIMARY KEY, response_id INT NOT NULL, user_id INT NULL, note TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sf_resp FOREIGN KEY (response_id) REFERENCES survey_responses(id) ON DELETE CASCADE,
    CONSTRAINT fk_sf_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS drafts (
    user_id INT PRIMARY KEY, service_code VARCHAR(10) NOT NULL, stage TINYINT NOT NULL DEFAULT 1, payload MEDIUMTEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_draft_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS doc_templates (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL UNIQUE, description VARCHAR(255) NULL, file_path VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL, sort_order INT NOT NULL DEFAULT 0, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`,
];

/* ---------- perubahan data satu kali (dicatat di tabel settings: migr:<nama>) ---------- */
const NEW_LAB = [['LAB-01', 'Permohonan Diterima', 10, 0, 0], ['LAB-02', 'Sampel Diterima & Diregistrasi', 20, 0, 0],
  ['LAB-03', 'Verifikasi, Kontrak & Pembayaran', 35, 1, 0], ['LAB-04', 'Proses Pengujian', 60, 0, 0],
  ['LAB-05', 'Review & Verifikasi Hasil', 80, 0, 0], ['LAB-06', 'Penyusunan LHU', 95, 0, 1], ['LAB-07', 'LHU Terbit', 100, 0, 0]];
/** Urutan lama (LAB-01..08) -> urutan baru. Preparasi digabung ke Proses Pengujian. */
const LAB_MAP = { 1: 1, 2: 3, 3: 2, 4: 4, 5: 4, 6: 5, 7: 6, 8: 7 };
const LSM_STEPS = [['LSM-01', 'Permohonan Diterima', 10, 0, 0, 0], ['LSM-02', 'Verifikasi & Tinjauan Permohonan', 20, 0, 0, 0],
  ['LSM-03', 'Penawaran, Kontrak & Pembayaran', 30, 0, 1, 0], ['LSM-04', 'Penjadwalan & Penugasan', 40, 0, 0, 0],
  ['LSM-05', 'Evaluasi/Audit', 55, 0, 0, 0], ['LSM-06', 'Tindakan Perbaikan', 70, 1, 0, 0], ['LSM-07', 'Review Hasil Evaluasi', 80, 0, 0, 0],
  ['LSM-08', 'Keputusan Sertifikasi', 90, 0, 0, 0], ['LSM-09', 'Sertifikat Terbit', 100, 0, 0, 1]];
const TEMPLATES = [
  ['Surat Permohonan', 'Diisi dan ditandatangani pimpinan perusahaan, lalu diunggah di Langkah 3.', 'surat-permohonan.docx'],
  ['Surat Kesediaan Surveillance', 'Diperlukan jika Anda mencentang Surveillance pada jenis permohonan.', 'surat-kesediaan-surveillance.docx'],
  ['Surat Pernyataan Keaslian Dokumen', 'Pernyataan bahwa seluruh dokumen yang diunggah benar dan sah.', 'surat-pernyataan-keaslian-dokumen.docx'],
];
const svcId = async (code) => (await one('SELECT id FROM services WHERE code=?', [code]))?.id;

const ONCE = {
  async kolom_2610() {
    await q('ALTER TABLE applications MODIFY tracking_code VARCHAR(16) NOT NULL');
    await q('ALTER TABLE applications MODIFY application_type VARCHAR(120) NULL');
  },
  // SLP-X2KD-4M7A -> SLP26-X2KD4M7A (26 = tahun pengajuan)
  async kode_lacak() {
    await q(`UPDATE applications SET tracking_code = CONCAT('SLP', DATE_FORMAT(created_at, '%y'), '-', REPLACE(SUBSTRING(tracking_code, 5), '-', ''))
      WHERE tracking_code LIKE 'SLP-%'`);
  },
  async jenis_permohonan() {
    await q("UPDATE applications SET application_type='Sertifikasi Awal' WHERE application_type='Sertifikasi Baru'");
    await q("UPDATE applications SET application_type='Transfer Sertifikasi' WHERE application_type='Transfer'");
  },
  async urutan_lab() {
    const svcs = await q("SELECT DISTINCT service_id id FROM service_steps WHERE status_code='LAB-08'");
    for (const { id } of svcs) {
      const caseOf = (col) => `CASE ${col} ${Object.entries(LAB_MAP).map(([a, b]) => `WHEN ${a} THEN ${b}`).join(' ')} ELSE ${col} END`;
      const apps = `SELECT id FROM applications WHERE service_id=${+id}`;
      await q(`UPDATE applications SET current_step_order=${caseOf('current_step_order')} WHERE service_id=?`, [id]);
      await q(`UPDATE status_logs SET step_order=${caseOf('step_order')} WHERE application_id IN (${apps})`);
      await q(`UPDATE documents SET step_order=${caseOf('step_order')} WHERE application_id IN (${apps})`);
      for (const [i, [code, name]] of NEW_LAB.entries()) {
        await q(`UPDATE status_logs SET status_code=?, step_name=? WHERE step_order=? AND application_id IN (${apps})`, [code, name, i + 1]);
      }
      await q('DELETE FROM service_steps WHERE service_id=?', [id]);
      for (const [i, [code, name, pct, pay, cert]] of NEW_LAB.entries()) {
        await q('INSERT INTO service_steps (service_id, step_order, status_code, name, progress_pct, is_optional, is_payment_step, is_certificate_step) VALUES (?,?,?,?,?,0,?,?)',
          [id, i + 1, code, name, pct, pay, cert]);
      }
    }
  },
  // "Pertanian dan Perkebunan (12)" -> "Pertanian dan Perkebunan" (angka = kode kategori akreditasi)
  async kategori_sp() {
    const id = await svcId('SP');
    if (id) await q("UPDATE products SET category=TRIM(REGEXP_REPLACE(category, ' *[(][0-9]+[)]$', '')) WHERE service_id=?", [id]);
  },
  async layanan_lsm() {
    if (await svcId('LSM')) return;
    const max = (await one('SELECT COALESCE(MAX(sort_order),0)+1 n FROM services')).n;
    const r = await q("INSERT INTO services (parent_id, code, name, description, bidang, state, sort_order) VALUES (NULL,'LSM','Lembaga Sistem Manajemen Mutu',?,NULL,'prep',?)",
      ['Sertifikasi sistem manajemen mutu dan keamanan pangan untuk organisasi Anda.', max]);
    for (const [i, [code, name, pct, opt, pay, cert]] of LSM_STEPS.entries()) {
      await q('INSERT INTO service_steps (service_id, step_order, status_code, name, progress_pct, is_optional, is_payment_step, is_certificate_step) VALUES (?,?,?,?,?,?,?,?)',
        [r.insertId, i + 1, code, name, pct, opt, pay, cert]);
    }
    await q("INSERT INTO products (service_id, category, name, standard_no) VALUES (?,'Sistem Manajemen','Sistem Manajemen Mutu','ISO 9001'),(?,'Sistem Manajemen','Sistem Manajemen Keamanan Pangan','ISO 22000')", [r.insertId, r.insertId]);
  },
  async form_sp() {
    const sp = await svcId('SP');
    if (sp) {
      await q("UPDATE service_fields SET is_active=0 WHERE service_id=? AND field_key IN ('merek','model')", [sp]);
      await q("UPDATE service_documents SET is_active=0 WHERE service_id=? AND name NOT IN ('Surat Permohonan','Surat Kesediaan Surveillance','Surat Pernyataan Keaslian Dokumen')", [sp]);
      const docs = [['Surat Permohonan', 1, null], ['Surat Kesediaan Surveillance', 0, 'SURV'], ['Surat Pernyataan Keaslian Dokumen', 0, null]];
      for (const [i, [name, pkg, when]] of docs.entries()) {
        const ex = await one('SELECT id FROM service_documents WHERE service_id=? AND name=?', [sp, name]);
        if (ex) await q('UPDATE service_documents SET required=1, admin_if_package=?, show_when=?, sort_order=?, is_active=1 WHERE id=?', [pkg, when, i, ex.id]);
        else await q('INSERT INTO service_documents (service_id, name, required, admin_if_package, show_when, sort_order) VALUES (?,?,1,?,?,?)', [sp, name, pkg, when, i]);
      }
    }
    // kode sampel diisi Admin, bukan pelanggan
    await q("UPDATE service_fields SET is_active=0 WHERE field_key='kode_sampel'");
  },
  async ruang_lingkup_lab() {
    const { LAB_PRICES, KIMIA_EXTRA_NOTE } = require('../../database/price-data');
    const extra = await one("SELECT p.id FROM products p JOIN services s ON s.id=p.service_id WHERE s.code='KIM' AND p.name LIKE 'Parameter Tambahan%'");
    if (extra) {
      await q('DELETE FROM product_parameters WHERE product_id=? AND id NOT IN (SELECT parameter_id FROM application_parameters WHERE parameter_id IS NOT NULL)', [extra.id]);
      await q('UPDATE products SET note=? WHERE id=?', [KIMIA_EXTRA_NOTE, extra.id]);
    }
    for (const lp of LAB_PRICES.filter((x) => ['Beras', 'Minyak Goreng Sawit'].includes(x.n))) {
      const sid = await svcId(lp.svc);
      if (!sid || await one('SELECT id FROM products WHERE service_id=? AND name=?', [sid, lp.n])) continue;
      const r = await q('INSERT INTO products (service_id, category, name, standard_no, alt_available) VALUES (?,?,?,?,?)', [sid, lp.cat, lp.n, lp.sni, lp.alt === 0 ? 0 : 1]);
      for (const [name, method] of lp.p) await q('INSERT INTO product_parameters (product_id, name, method) VALUES (?,?,?)', [r.insertId, name, method]);
    }
  },
  // deskripsi kartu lab mengikuti ruang lingkup baru (hanya jika belum diubah Super Admin)
  async deskripsi_lab() {
    await q("UPDATE services SET description=? WHERE code='KIM' AND description=?", ['Uji kimia pupuk, beras, dan minyak goreng sawit: unsur hara, kadar air, asam bebas, dan cemaran logam.', 'Uji kimia pupuk: unsur hara, kadar air, asam bebas, dan cemaran logam.']);
    await q("UPDATE services SET description=? WHERE code='FIS' AND description=?", ['Uji fisik peralatan masak dan makan dari logam, serta mutu fisik beras dan minyak goreng sawit.', 'Uji fisik peralatan masak dan peralatan makan dari logam.']);
  },
  // pelanggan dapat membatalkan pengajuan yang belum diproses
  async status_batal() {
    await q("ALTER TABLE applications MODIFY status ENUM('aktif','aksi','ditolak','selesai','batal') NOT NULL DEFAULT 'aktif'");
    await q(`ALTER TABLE status_logs MODIFY action ENUM('buat','mulai','setujui','minta_tindakan','tanggapan','abaikan','tolak','bayar','parameter','terbit',
      'invoice','lampiran','temuan','perpanjangan','unduh','survei','info','batal') NOT NULL`);
  },
  // dokumen persyaratan SP lama dikembalikan; ketiga surat template wajib untuk semua jenis permohonan
  async dokumen_sp_2() {
    const sp = await svcId('SP');
    if (!sp) return;
    const docs = [['Surat Permohonan', 1, 1], ['Surat Kesediaan Surveillance', 1, 0], ['Surat Pernyataan Keaslian Dokumen', 1, 0],
      ['Akta Perusahaan & NIB', 1, 0], ['Spesifikasi Produk', 0, 0], ['Sertifikat Merek', 0, 0], ['Dokumen Sistem Mutu', 0, 0]];
    for (const [i, [name, req, pkg]] of docs.entries()) {
      const ex = await one('SELECT id FROM service_documents WHERE service_id=? AND name=?', [sp, name]);
      if (ex) await q('UPDATE service_documents SET required=?, admin_if_package=?, show_when=NULL, sort_order=?, is_active=1 WHERE id=?', [req, pkg, i + 1, ex.id]);
      else await q('INSERT INTO service_documents (service_id, name, required, admin_if_package, sort_order) VALUES (?,?,?,?,?)', [sp, name, req, pkg, i + 1]);
    }
  },
  async template_dokumen() {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    for (const [i, [name, desc, file]] of TEMPLATES.entries()) {
      if (await one('SELECT id FROM doc_templates WHERE name=?', [name])) continue;
      const stored = `template-${file}`;
      fs.copyFileSync(path.join(__dirname, '..', '..', 'database', 'templates', file), path.join(UPLOAD_DIR, stored));
      await q('INSERT INTO doc_templates (name, description, file_path, original_name, sort_order) VALUES (?,?,?,?,?)', [name, desc, stored, file, i]);
    }
  },
};

module.exports = async function migrate() {
  for (const sql of TABLES) await q(sql);
  // satu query untuk semua kolom yang sudah ada
  const have = new Set((await q('SELECT CONCAT(TABLE_NAME, ".", COLUMN_NAME) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)',
    [[...new Set(COLUMNS.map((c) => c[0]))]])).map((r) => r.c));
  for (const [table, column, def] of COLUMNS) {
    if (!have.has(`${table}.${column}`)) {
      await q(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${def}`);
      console.log(`> kolom ${table}.${column} ditambahkan`);
    }
  }
  const done = new Set((await q("SELECT skey FROM settings WHERE skey LIKE 'migr:%'")).map((r) => r.skey.slice(5)));
  for (const [name, fn] of Object.entries(ONCE)) {
    if (done.has(name)) continue;
    await fn();
    await q('INSERT INTO settings (skey, svalue) VALUES (?, NOW())', [`migr:${name}`]);
    console.log(`> pembaruan data: ${name}`);
  }
  // bersihkan notifikasi lama yang sudah dibaca (lebih dari 90 hari)
  await q('DELETE FROM notifications WHERE is_read=1 AND created_at < NOW() - INTERVAL 90 DAY');
};
