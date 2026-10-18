const fs = require('fs');
const path = require('path');
const { q, one } = require('./db');
const storage = require('../utils/storage');

/** Kolom yang ditambahkan setelah rilis awal. Ditambahkan otomatis jika belum ada. */
const COLUMNS = [
  ['users', 'avatar', 'VARCHAR(255) NULL AFTER address'],
  // harga lab: opsi kedua (Ekspress / Luar Negeri)
  ['products', 'package_price_alt', 'DECIMAL(14,2) NULL AFTER package_price'],
  ['products', 'alt_available', 'TINYINT(1) NOT NULL DEFAULT 1 AFTER package_price_alt'],
  ['products', 'note', 'VARCHAR(255) NULL AFTER alt_available'],
  ['product_parameters', 'price_alt', 'DECIMAL(14,2) NULL AFTER price'],
  ['applications', 'price_option', "ENUM('std','alt') NOT NULL DEFAULT 'std' AFTER full_sni"],
  ['applications', 'package_snapshot', 'DECIMAL(14,2) NULL AFTER full_sni'],
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
  // masukan demo PSU (Oktober 2026)
  ['users', 'nib', 'VARCHAR(20) NULL AFTER company_name'],
  ['users', 'npwp', 'VARCHAR(25) NULL AFTER nib'],
  ['service_steps', 'flow', "VARCHAR(10) NOT NULL DEFAULT '' AFTER sla_days"],
  ['applications', 'flow', "VARCHAR(10) NOT NULL DEFAULT '' AFTER current_step_order"],
  ['products', 'custom_name', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER note'],
  ['findings', 'correction', 'TEXT NULL AFTER customer_note'],
  ['findings', 'root_cause', 'TEXT NULL AFTER correction'],
  ['findings', 'corrective_action', 'TEXT NULL AFTER root_cause'],
  ['service_fields', 'multiple', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER show_when'],
  ['service_documents', 'hide_schemes', 'VARCHAR(160) NULL AFTER show_when'],
  // masa berlaku sertifikat proyek sebelum SILAPP
  ['legacy_certificates', 'expires_at', 'DATE NULL AFTER issued_at'],
  ['legacy_certificates', 'show_in_directory', 'TINYINT(1) NOT NULL DEFAULT 1 AFTER status'],
  // sesi login dicabut saat kata sandi diganti/di-reset (dibandingkan dengan isi token)
  ['users', 'token_version', 'INT NOT NULL DEFAULT 0 AFTER must_change_password'],
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
  // riwayat sertifikat, reset kata sandi, antrean email, dan pengingat yang sudah dikirim (persiapan rilis)
  `CREATE TABLE IF NOT EXISTS certificate_logs (
    id INT AUTO_INCREMENT PRIMARY KEY, source ENUM('silapp','lama') NOT NULL, cert_id INT NOT NULL, certificate_no VARCHAR(80) NOT NULL,
    action ENUM('terbit','status','ubah','tampil') NOT NULL, status VARCHAR(20) NULL, note TEXT NULL,
    user_id INT NULL, pic_label VARCHAR(160) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_certlog (source, cert_id)
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE, expires_at DATETIME NOT NULL,
    used_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS email_outbox (
    id INT AUTO_INCREMENT PRIMARY KEY, to_addr VARCHAR(255) NOT NULL, subject VARCHAR(255) NOT NULL, body MEDIUMTEXT NULL,
    attachments TEXT NULL, status ENUM('antri','terkirim','gagal','dilewati') NOT NULL DEFAULT 'antri', attempts INT NOT NULL DEFAULT 0,
    last_error VARCHAR(500) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, sent_at DATETIME NULL,
    KEY idx_outbox_status (status, created_at)
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS reminder_log (
    id INT AUTO_INCREMENT PRIMARY KEY, kind VARCHAR(30) NOT NULL, ref_id INT NOT NULL, mark VARCHAR(30) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_reminder (kind, ref_id, mark)
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
/** Alur khusus skema Tipe 1b (SP): tanpa audit & tindakan perbaikan; tahap 5 Sampling, review + keputusan digabung. */
const SP_1B = [['ST-01', 'Permohonan Diterima', 10, 0, 0], ['ST-02', 'Verifikasi & Tinjauan Permohonan', 20, 0, 0],
  ['ST-03', 'Penawaran, Kontrak & Pembayaran', 30, 1, 0], ['ST-04', 'Penjadwalan & Penugasan', 40, 0, 0],
  ['ST-05', 'Sampling', 50, 0, 0], ['ST-06', 'Pengujian Laboratorium', 65, 0, 0],
  ['ST-07', 'Review & Keputusan', 85, 0, 0], ['ST-08', 'Sertifikat Terbit', 100, 0, 1]];
/** Urutan alur utama (ST-01..ST-10) -> urutan alur Tipe 1b, untuk pengajuan 1b yang sudah berjalan. */
const MAP_1B = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 6, 8: 7, 9: 7, 10: 8 };
/** Berkas SP yang tidak diperlukan untuk Tipe 1b (masukan demo PSU). */
const NOT_1B = ['Surat Kesediaan Surveillance', 'Surat Pernyataan Keaslian Dokumen', 'Dokumen Sistem Mutu'];
/** NIB 13 digit, NPWP 15/16 digit: pisahkan isian lama "NIB / NPWP". */
function splitNibNpwp(raw) {
  const groups = String(raw || '').match(/\d[\d.\-\s]*\d/g) || [];
  let nib = null; let npwp = null;
  for (const g of groups) {
    const d = g.replace(/\D/g, '');
    if (d.length === 13 && !nib) nib = d;
    else if ((d.length === 15 || d.length === 16) && !npwp) npwp = d;
  }
  if (!nib && !npwp && String(raw || '').trim()) npwp = String(raw).trim().slice(0, 25);
  return { nib, npwp };
}
const hasColumn = async (table, column) => !!(await one('SELECT 1 x FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?', [table, column]));

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
  // akun pelanggan: kolom NIB dan NPWP dipisah
  async nib_npwp() {
    if (!(await hasColumn('users', 'nib_npwp'))) return;
    const rows = await q("SELECT id, nib_npwp FROM users WHERE nib_npwp IS NOT NULL AND nib_npwp<>'' AND nib IS NULL AND npwp IS NULL");
    for (const r of rows) {
      const { nib, npwp } = splitNibNpwp(r.nib_npwp);
      await q('UPDATE users SET nib=?, npwp=? WHERE id=?', [nib, npwp, r.id]);
    }
  },
  // tahapan bisa punya lebih dari satu alur per layanan (alur utama + alur Tipe 1b)
  async alur_tahapan() {
    const idx = await q("SELECT COLUMN_NAME c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='service_steps' AND INDEX_NAME='uq_step' ORDER BY SEQ_IN_INDEX");
    if (!idx.some((x) => x.c === 'flow')) {
      await q('ALTER TABLE service_steps DROP INDEX uq_step, ADD UNIQUE KEY uq_step (service_id, flow, step_order)');
    }
  },
  async alur_1b() {
    const sp = await svcId('SP');
    if (!sp) return;
    if (!(await one("SELECT id FROM service_steps WHERE service_id=? AND flow='1B' LIMIT 1", [sp]))) {
      for (const [i, [code, name, pct, pay, cert]] of SP_1B.entries()) {
        await q("INSERT INTO service_steps (service_id, step_order, status_code, name, progress_pct, is_optional, is_payment_step, is_certificate_step, flow) VALUES (?,?,?,?,?,0,?,?,'1B')",
          [sp, i + 1, code, name, pct, pay, cert]);
      }
    }
    // pengajuan Tipe 1b yang sudah ada dipindah ke alur barunya
    const apps = (await q("SELECT id FROM applications WHERE service_id=? AND flow='' AND scheme LIKE '%1b%'", [sp])).map((r) => r.id);
    if (!apps.length) return;
    const caseOf = (col) => `CASE ${col} ${Object.entries(MAP_1B).map(([a, b]) => `WHEN ${a} THEN ${b}`).join(' ')} ELSE ${col} END`;
    await q(`UPDATE applications SET current_step_order=${caseOf('current_step_order')}, flow='1B' WHERE id IN (?)`, [apps]);
    await q(`UPDATE status_logs SET step_order=${caseOf('step_order')} WHERE application_id IN (?)`, [apps]);
    await q(`UPDATE documents SET step_order=${caseOf('step_order')} WHERE application_id IN (?)`, [apps]);
  },
  async dokumen_1b() {
    const sp = await svcId('SP');
    if (sp) await q("UPDATE service_documents SET hide_schemes='Tipe 1b' WHERE service_id=? AND name IN (?) AND (hide_schemes IS NULL OR hide_schemes='')", [sp, NOT_1B]);
  },
  // isian Nomor + Tanggal (B/L, Packing List, Invoice) dan produk di luar lingkup KAN
  async isian_nomor_tanggal() {
    await q("ALTER TABLE service_fields MODIFY type ENUM('text','number','textarea','select','date','nomor_tanggal') NOT NULL DEFAULT 'text'");
    await q(`UPDATE service_fields SET type='nomor_tanggal', multiple=1 WHERE type='text' AND service_id=?
      AND (label LIKE '%Bill of Lading%' OR label LIKE '%Packing List%' OR label LIKE 'Nomor Invoice%')`, [await svcId('SP')]);
  },
  async produk_luar_lingkup() {
    const { KIMIA_EXTRA_NOTE } = require('../../database/price-data');
    await q("UPDATE products SET custom_name=1 WHERE name LIKE 'Parameter Tambahan di Luar Lingkup%'");
    const fis = await svcId('FIS');
    if (fis && !(await one("SELECT id FROM products WHERE service_id=? AND custom_name=1", [fis]))) {
      await q("INSERT INTO products (service_id, category, name, note, custom_name) VALUES (?, 'Uji SNI', 'Parameter Tambahan di Luar Lingkup Akreditasi KAN', ?, 1)", [fis, KIMIA_EXTRA_NOTE]);
    }
  },
  // identitas invoice resmi PSU: diisi bila masih kosong (yang sudah diisi Super Admin tidak ditimpa)
  async identitas_invoice() {
    const { INVOICE_IDENTITY } = require('../utils/settings');
    for (const [k, v] of Object.entries(INVOICE_IDENTITY)) {
      const cur = await one('SELECT svalue FROM settings WHERE skey=?', [k]);
      if (!cur) await q('INSERT INTO settings (skey, svalue) VALUES (?,?)', [k, v]);
      else if (!String(cur.svalue || '').trim() || (k === 'signer_title' && cur.svalue === 'Direktur Utama')) await q('UPDATE settings SET svalue=? WHERE skey=?', [v, k]);
    }
  },
  // daftar brand/spesifikasi lab (hingga 50 baris) tidak muat di VARCHAR(500)
  async detail_text() {
    await q('ALTER TABLE application_details MODIFY field_value TEXT NULL');
  },
  // brand/spesifikasi lab kini isian khusus berbaris di form Ajukan (bukan isian form builder)
  async hapus_isian_spesifikasi_lab() {
    await q("DELETE FROM service_fields WHERE field_key='merek_spesifikasi'");
  },
  async template_dokumen() {
    for (const [i, [name, desc, file]] of TEMPLATES.entries()) {
      if (await one('SELECT id FROM doc_templates WHERE name=?', [name])) continue;
      const stored = await storage.save(fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'templates', file)), file, 'template-');
      await q('INSERT INTO doc_templates (name, description, file_path, original_name, sort_order) VALUES (?,?,?,?,?)', [name, desc, stored, file, i]);
    }
  },
  // status sertifikat: Aktif, Ditangguhkan, Dicabut ("Tidak Aktif" lama menjadi Dicabut)
  async status_sertifikat() {
    for (const t of ['certificates', 'legacy_certificates']) {
      await q(`ALTER TABLE ${t} MODIFY status ENUM('aktif','tidak_aktif','ditangguhkan','dicabut') NOT NULL DEFAULT 'aktif'`);
      await q(`UPDATE ${t} SET status='dicabut' WHERE status='tidak_aktif'`);
      await q(`ALTER TABLE ${t} MODIFY status ENUM('aktif','ditangguhkan','dicabut') NOT NULL DEFAULT 'aktif'`);
    }
  },
  // nomor invoice tidak boleh kembar (dua invoice diterbitkan bersamaan); dilewati bila data lama sudah ada yang kembar
  async unik_nomor_invoice() {
    const idx = await one("SELECT 1 x FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payments' AND COLUMN_NAME='invoice_no' AND NON_UNIQUE=0 LIMIT 1");
    if (idx) return;
    const dup = await one('SELECT invoice_no FROM payments GROUP BY invoice_no HAVING COUNT(*) > 1 LIMIT 1');
    if (dup) { console.warn(`! Nomor invoice ${dup.invoice_no} kembar, indeks unik nomor invoice tidak dipasang.`); return; }
    await q('ALTER TABLE payments ADD UNIQUE KEY uq_invoice_no (invoice_no)');
  },
  // template bawaan diganti versi berkop surat PSU dengan isian NIB dan NPWP terpisah
  // (template yang sudah diganti Super Admin tidak disentuh)
  async template_kop_nib_npwp() {
    // template bawaan dikenali dari nama file aslinya (file pengganti dari Super Admin bernama lain)
    for (const [name, , file] of TEMPLATES) {
      const t = await one('SELECT id, file_path FROM doc_templates WHERE name=? AND original_name=?', [name, file]);
      if (!t) continue;
      const stored = await storage.save(fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'templates', file)), file, 'template-');
      await q('UPDATE doc_templates SET file_path=?, updated_at=NOW() WHERE id=?', [stored, t.id]);
      if (t.file_path !== stored) await storage.remove(t.file_path);
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

/** Pembaruan data sekali jalan yang tidak perlu dijalankan pada database baru dari silapp-init.sql
 *  (datanya sudah dalam bentuk terbaru). Template dokumen (versi terbaru berkop PSU) dan identitas invoice
 *  tetap dijalankan saat server pertama menyala karena menyalin file ke penyimpanan / mengisi pengaturan. */
module.exports.FRESH_DONE = Object.keys(ONCE).filter((n) => !['template_dokumen', 'identitas_invoice'].includes(n));

