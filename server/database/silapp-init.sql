-- =========================================================
-- SILAPP · data awal untuk server hosting
-- Dibuat: 2026-10-22 (npm run db:sql)
-- Isi   : struktur tabel + data master (layanan, tahapan, form, ruang lingkup & harga, survei, pengaturan).
--         Tanpa akun pengguna dan tanpa data contoh.
-- Cara  : phpMyAdmin > pilih database SILAPP yang masih kosong > Import > pilih file ini > Go.
--         Akun Super Admin pertama dibuat dari SUPERADMIN_EMAIL & SUPERADMIN_PASSWORD di server/.env.
-- =========================================================
-- =========================================================
-- SILAPP · Sistem Informasi Layanan dan Tracking Pengujian Produk
-- PT Penilai Standar Uji · skema MySQL 8 / MariaDB 10.6+
-- =========================================================
SET NAMES utf8mb4;


-- Pengguna: 3 role login. Jabatan & bidang khusus admin (untuk PIC & filter antrean)
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  role          ENUM('superadmin','admin','user') NOT NULL DEFAULT 'user',
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  jabatan       VARCHAR(80)  NULL,
  bidang        ENUM('SP','LAB','KAL') NULL,
  company_name  VARCHAR(160) NULL,
  nib           VARCHAR(20)  NULL,                    -- Nomor Induk Berusaha (13 digit)
  npwp          VARCHAR(25)  NULL,                    -- NPWP perusahaan (15/16 digit)
  phone         VARCHAR(30)  NULL,
  address       VARCHAR(255) NULL,                    -- alamat perusahaan sesuai NPWP
  avatar        VARCHAR(255) NULL,                    -- nama file foto profil di uploads/
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,   -- akun dibuat Admin: wajib ganti sandi saat login pertama
  token_version INT NOT NULL DEFAULT 0,                -- naik saat sandi diganti/di-reset: sesi lama otomatis keluar
  created_by    INT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Layanan bertingkat: Sertifikasi Produk, Laboratorium > Kimia/Fisika/Mikro/Kalibrasi
CREATE TABLE services (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  parent_id   INT NULL,
  code        VARCHAR(10) NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  bidang      ENUM('SP','LAB','KAL') NULL,
  cp_name     VARCHAR(120) NULL,
  cp_phone    VARCHAR(30)  NULL,
  est_text    VARCHAR(60)  NULL,
  state       ENUM('ok','dev','prep') NOT NULL DEFAULT 'ok',
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_services_parent FOREIGN KEY (parent_id) REFERENCES services(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Status utama tracking per layanan (ST-xx, LAB-xx, KAL-xx)
CREATE TABLE service_steps (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  service_id          INT NOT NULL,
  step_order          INT NOT NULL,
  status_code         VARCHAR(10) NOT NULL,
  name                VARCHAR(120) NOT NULL,
  progress_pct        TINYINT NOT NULL,
  is_optional         TINYINT(1) NOT NULL DEFAULT 0,
  is_payment_step     TINYINT(1) NOT NULL DEFAULT 0,
  is_certificate_step TINYINT(1) NOT NULL DEFAULT 0,
  is_billing_step     TINYINT(1) NOT NULL DEFAULT 0,  -- tahap akhir Invoice & Faktur (setelah sertifikat/LHU terbit)
  sla_days            INT NULL,
  flow                VARCHAR(10) NOT NULL DEFAULT '',  -- '' = alur utama; '1B' = alur khusus skema Tipe 1b (SP)
  UNIQUE KEY uq_step (service_id, flow, step_order),
  CONSTRAINT fk_steps_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ruang lingkup: produk per layanan (LSPro: SNI + skema, Lab: produk uji)
CREATE TABLE products (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  service_id       INT NOT NULL,
  category         VARCHAR(120) NULL,
  sub_category     VARCHAR(120) NULL,
  name             VARCHAR(160) NOT NULL,
  standard_no      VARCHAR(80)  NULL,
  scheme_reference VARCHAR(160) NULL,
  scheme_types     VARCHAR(40)  NULL,
  package_price    DECIMAL(14,2) NULL,   -- harga paket "parameter lengkap sesuai SNI" (Lab): Reguler / Dalam Negeri
  package_price_alt DECIMAL(14,2) NULL,  -- harga paket opsi kedua: Ekspress (Kimia) / Luar Negeri (Fisika)
  alt_available    TINYINT(1) NOT NULL DEFAULT 1,  -- 0 = opsi kedua belum tersedia (mis. Ekspress, ada parameter subkon)
  note             VARCHAR(255) NULL,
  custom_name      TINYINT(1) NOT NULL DEFAULT 0,  -- 1 = pelanggan menulis nama produk & parameter sendiri (di luar lingkup KAN)
  CONSTRAINT fk_products_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Parameter uji per produk (add-on). Harga sudah termasuk PPN 11%
CREATE TABLE product_parameters (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  name       VARCHAR(160) NOT NULL,
  method     VARCHAR(160) NULL,
  price      DECIMAL(14,2) NULL,          -- Reguler / Dalam Negeri
  price_alt  DECIMAL(14,2) NULL,          -- Ekspress / Luar Negeri
  CONSTRAINT fk_params_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pengajuan / order layanan
CREATE TABLE applications (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  application_no     VARCHAR(30) NOT NULL UNIQUE,
  tracking_code      VARCHAR(16) NOT NULL UNIQUE,      -- SLP26-X2KD4M7A (26 = tahun pengajuan)
  user_id            INT NOT NULL,
  service_id         INT NOT NULL,
  product_id         INT NULL,
  product_label      VARCHAR(255) NOT NULL,
  current_step_order INT NOT NULL DEFAULT 1,
  flow               VARCHAR(10) NOT NULL DEFAULT '',   -- alur tahapan yang dipakai ('1B' = Tipe 1b)
  status             ENUM('aktif','aksi','ditolak','selesai','batal') NOT NULL DEFAULT 'aktif',  -- batal = dibatalkan pelanggan
  application_type   VARCHAR(120) NULL,                 -- bisa lebih dari satu, dipisah koma (mis. Sertifikasi Awal, Surveillance)
  scheme             VARCHAR(20) NULL,
  origin             ENUM('dn','ln') NULL,              -- SP: produk Dalam Negeri / Luar Negeri
  location           ENUM('lab','onsite') NULL,
  nc_flag            TINYINT(1) NOT NULL DEFAULT 0,
  is_package         TINYINT(1) NOT NULL DEFAULT 0,      -- paket Sertifikasi Produk + Pengujian Lab
  full_sni           TINYINT(1) NOT NULL DEFAULT 0,      -- Lab: parameter lengkap sesuai SNI (harga paket)
  package_snapshot   DECIMAL(14,2) NULL,                 -- harga paket per sampel saat diajukan (perubahan daftar harga tidak memengaruhi)
  price_option       ENUM('std','alt') NOT NULL DEFAULT 'std', -- Lab: Reguler/Dalam Negeri (std) atau Ekspress/Luar Negeri (alt)
  payment_status     ENUM('belum','invoice','menunggu','terverifikasi','tunda') NOT NULL DEFAULT 'belum',  -- tunda = skema Full di Akhir
  payment_scheme     ENUM('full','5050','akhir') NULL,   -- skema pembayaran sesuai kontrak (tahap Penawaran & Kontrak)
  docs_downloaded_at DATETIME(3) NULL,                      -- Super Admin mengunduh semua berkas (ZIP)
  audit_report_date  DATE NULL,                          -- tanggal laporan audit (dasar tenggat temuan)
  lab_name           VARCHAR(160) NULL,                  -- ST-06: lab tempat pengujian (PSU / lab lain)
  lab_estimate       VARCHAR(120) NULL,
  lab_link           VARCHAR(255) NULL,
  action_note        TEXT NULL,
  reject_note        TEXT NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_app_status (status, updated_at),
  CONSTRAINT fk_app_user    FOREIGN KEY (user_id)    REFERENCES users(id),
  CONSTRAINT fk_app_service FOREIGN KEY (service_id) REFERENCES services(id),
  CONSTRAINT fk_app_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Isian form khusus per layanan (merek, model, alamat pabrik, batch Tipe 1B, dll.)
CREATE TABLE application_details (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  field_key      VARCHAR(60) NOT NULL,
  field_label    VARCHAR(120) NOT NULL,
  field_value    TEXT NULL,
  CONSTRAINT fk_det_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Parameter yang dipilih + status per parameter (Lab Pengujian)
CREATE TABLE application_parameters (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  application_id  INT NOT NULL,
  parameter_id    INT NULL,
  name            VARCHAR(160) NOT NULL,
  method          VARCHAR(160) NULL,
  price_snapshot  DECIMAL(14,2) NULL,
  is_custom       TINYINT(1) NOT NULL DEFAULT 0,   -- parameter "Lainnya" yang diisi pelanggan (harga diisi Admin)
  status          ENUM('antri','uji','selesai') NOT NULL DEFAULT 'antri',
  analyst_user_id INT NULL,
  updated_at      DATETIME NULL,
  CONSTRAINT fk_ap_app   FOREIGN KEY (application_id)  REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_ap_param FOREIGN KEY (parameter_id)    REFERENCES product_parameters(id),
  CONSTRAINT fk_ap_user  FOREIGN KEY (analyst_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Alat yang dikalibrasi (satu order bisa berisi beberapa alat)
CREATE TABLE equipment (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  application_id     INT NOT NULL,
  name               VARCHAR(160) NOT NULL,
  brand_model        VARCHAR(160) NULL,
  serial_number      VARCHAR(80)  NULL,
  range_capacity     VARCHAR(80)  NULL,
  resolution         VARCHAR(40)  NULL,
  calibration_points VARCHAR(255) NULL,
  accessories        VARCHAR(255) NULL,
  quantity           INT NOT NULL DEFAULT 1,
  condition_note     VARCHAR(255) NULL,
  CONSTRAINT fk_eq_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sampel uji (Lab Pengujian)
CREATE TABLE samples (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  application_id    INT NOT NULL,
  description       VARCHAR(255) NOT NULL,
  quantity          INT NOT NULL DEFAULT 1,
  lab_sample_number VARCHAR(40) NULL,
  condition_note    VARCHAR(255) NULL,
  CONSTRAINT fk_smp_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dokumen yang diunggah pelanggan / admin (lampiran per tahap)
CREATE TABLE documents (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  doc_type       VARCHAR(80) NOT NULL,
  original_name  VARCHAR(255) NOT NULL,
  file_path      VARCHAR(255) NOT NULL,
  source         ENUM('pelanggan','admin') NOT NULL DEFAULT 'pelanggan',
  step_order     INT NULL,
  log_id         INT NULL,
  finding_id     INT NULL,
  customer_visible TINYINT(1) NOT NULL DEFAULT 1,
  uploaded_by    INT NULL,
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_doc_app  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_user FOREIGN KEY (uploaded_by)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoice (diterbitkan Admin) + pembayaran manual (bukti transfer dari pelanggan)
CREATE TABLE payments (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  invoice_no     VARCHAR(40) NOT NULL UNIQUE,
  invoice_seq    INT NULL,                    -- nomor urut per layanan per tahun (001/PSU/KIM/X/2026)
  invoice_year   INT NULL,
  amount         DECIMAL(14,2) NULL,          -- grand total yang dibayar (harga + PPN − PPh 23)
  dpp            DECIMAL(14,2) NULL,          -- harga pekerjaan (belum PPN)
  dpp_lain       DECIMAL(14,2) NULL,          -- DPP nilai lain = 11/12 × harga
  ppn            DECIMAL(14,2) NULL,          -- PPN 12% × DPP nilai lain
  total          DECIMAL(14,2) NULL,          -- harga + PPN
  pph23          DECIMAL(14,2) NOT NULL DEFAULT 0, -- PPh 23 2% × harga (jika dipotong)
  due_now        DECIMAL(14,2) NULL,          -- dibayar di tahap Penawaran & Kontrak (Full: semua, 50:50: separuh, Full di Akhir: 0)
  with_pph23     TINYINT(1) NOT NULL DEFAULT 0,
  items          TEXT NULL,                   -- rincian (JSON)
  invoice_file   VARCHAR(255) NULL,
  due_date       DATE NULL,
  note           VARCHAR(500) NULL,
  issued_by      INT NULL,
  proof_path     VARCHAR(255) NULL,
  paid_at        DATETIME(3) NULL,
  status         ENUM('invoice','menunggu','terverifikasi','ditolak') NOT NULL DEFAULT 'invoice',
  verified_by    INT NULL,
  verified_at    DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_app  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_pay_user FOREIGN KEY (verified_by)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit trail / riwayat status (customer_visible membedakan info internal)
CREATE TABLE status_logs (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  application_id   INT NOT NULL,
  step_order       INT NOT NULL,
  status_code      VARCHAR(10) NOT NULL,
  step_name        VARCHAR(120) NOT NULL,
  action           ENUM('buat','mulai','setujui','minta_tindakan','tanggapan','abaikan','tolak','bayar','parameter','terbit',
                        'invoice','lampiran','temuan','perpanjangan','unduh','survei','info','batal','kontrak','tagihan') NOT NULL,
  note             TEXT NULL,
  customer_visible TINYINT(1) NOT NULL DEFAULT 1,
  pic_user_id      INT NULL,
  pic_label        VARCHAR(160) NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_app  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_log_user FOREIGN KEY (pic_user_id)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sertifikat / LHU yang terbit (sumber Directory publik)
CREATE TABLE certificates (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  application_id    INT NOT NULL UNIQUE,
  certificate_no    VARCHAR(60) NOT NULL UNIQUE,
  issued_at         DATE NOT NULL,
  expires_at        DATE NULL,                        -- masa berlaku (wajib untuk Sertifikasi Produk; LHU/kalibrasi kosong)
  file_path         VARCHAR(255) NULL,
  status            ENUM('aktif','ditangguhkan','dicabut') NOT NULL DEFAULT 'aktif',  -- "Berakhir" ditampilkan otomatis bila expires_at lewat
  show_in_directory TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_cert_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Temuan audit / ketidaksesuaian (ST-05 s.d. ST-07 Sertifikasi Produk)
-- Tenggat: mayor 1 bulan, minor 2 bulan sejak laporan audit; observasi tanpa tenggat. Perpanjangan 1 bulan, 1 kali.
CREATE TABLE findings (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  application_id   INT NOT NULL,
  category         ENUM('mayor','minor','observasi') NOT NULL,
  description      TEXT NOT NULL,
  report_date      DATE NULL,
  due_date         DATE NULL,
  status           ENUM('terbuka','dikirim','ditutup') NOT NULL DEFAULT 'terbuka',
  extension_status ENUM('tidak','diajukan','disetujui','ditolak') NOT NULL DEFAULT 'tidak',
  extension_reason VARCHAR(500) NULL,
  customer_note    TEXT NULL,                          -- keterangan tambahan dari pelanggan
  correction       TEXT NULL,                          -- bukti perbaikan: koreksi
  root_cause       TEXT NULL,                          -- akar penyebab masalah
  corrective_action TEXT NULL,                         -- tindakan korektif untuk mencegah pengulangan
  admin_note       TEXT NULL,
  created_by       INT NULL,
  closed_at        DATETIME NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_find_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Form builder: isian tambahan per layanan (diatur Super Admin)
CREATE TABLE service_fields (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  service_id  INT NOT NULL,
  field_key   VARCHAR(60) NOT NULL,
  label       VARCHAR(120) NOT NULL,
  type        ENUM('text','number','textarea','select','date','nomor_tanggal') NOT NULL DEFAULT 'text',  -- nomor_tanggal = pasangan Nomor + Tanggal
  options     VARCHAR(500) NULL,      -- untuk tipe select, dipisah koma
  required    TINYINT(1) NOT NULL DEFAULT 0,
  show_when   VARCHAR(20) NULL,       -- '1B' = hanya untuk skema Tipe 1B
  multiple    TINYINT(1) NOT NULL DEFAULT 0,  -- nomor_tanggal: pelanggan boleh menambah lebih dari satu baris
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_field (service_id, field_key),
  CONSTRAINT fk_sf_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Form builder: daftar berkas per layanan
CREATE TABLE service_documents (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  service_id      INT NOT NULL,
  name            VARCHAR(120) NOT NULL,
  required        TINYINT(1) NOT NULL DEFAULT 0,
  admin_if_package TINYINT(1) NOT NULL DEFAULT 0,  -- paket LSPro + Lab: diunggah Admin, pelanggan opsional
  show_when       VARCHAR(10) NULL,                 -- SURV: hanya diminta jika pelanggan mencentang Surveillance
  hide_schemes    VARCHAR(160) NULL,                -- tipe skema yang tidak memerlukan berkas ini, dipisah koma (mis. Tipe 1b)
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_sd_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Survei kepuasan pelanggan (wajib sebelum unduh sertifikat/LHU, setiap penerbitan)
CREATE TABLE survey_questions (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  bidang     ENUM('SP','LAB','KAL') NOT NULL DEFAULT 'SP',  -- kuesioner per layanan: LSPro, Lab Pengujian, Lab Kalibrasi
  question   VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE survey_responses (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL UNIQUE,
  user_id        INT NOT NULL,
  bidang         ENUM('SP','LAB','KAL') NOT NULL DEFAULT 'SP',
  company_name   VARCHAR(160) NULL,       -- A. identitas pelanggan
  respondent_name VARCHAR(120) NULL,
  reference_no   VARCHAR(80) NULL,        -- nomor layanan/order/sertifikat (opsional)
  avg_score      DECIMAL(3,2) NULL,
  suggestion     TEXT NULL,               -- C. saran dan masukan
  contact_ok     TINYINT(1) NULL,         -- D. bersedia dihubungi kembali (NULL = tidak menjawab)
  contact_info   VARCHAR(160) NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sr_app  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_sr_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE survey_answers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  response_id INT NOT NULL,
  question_id INT NULL,
  question    VARCHAR(255) NOT NULL,   -- salinan teks pertanyaan saat diisi
  score       TINYINT NOT NULL,
  CONSTRAINT fk_sa_resp FOREIGN KEY (response_id) REFERENCES survey_responses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Riwayat tindak lanjut atas masukan survei (dicatat Super Admin)
CREATE TABLE survey_followups (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  response_id INT NOT NULL,
  user_id     INT NULL,
  note        TEXT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sf_resp FOREIGN KEY (response_id) REFERENCES survey_responses(id) ON DELETE CASCADE,
  CONSTRAINT fk_sf_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifikasi di dalam aplikasi (ikon lonceng)
CREATE TABLE notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  title      VARCHAR(160) NOT NULL,
  body       VARCHAR(300) NULL,
  link       VARCHAR(160) NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notif_user (user_id, is_read),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pengaturan umum (teks ucapan terima kasih, dll.)
CREATE TABLE settings (
  skey   VARCHAR(60) PRIMARY KEY,
  svalue TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Proyek sertifikasi sebelum SILAPP (diinput manual oleh Admin, tampil di Directory)
CREATE TABLE legacy_certificates (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  factory_name    VARCHAR(160) NOT NULL,
  factory_address VARCHAR(160) NOT NULL,   -- kota / provinsi
  product         VARCHAR(200) NOT NULL,
  sni_no          VARCHAR(80)  NOT NULL,
  certificate_no  VARCHAR(80)  NOT NULL UNIQUE,
  issued_at       DATE NOT NULL,
  expires_at      DATE NULL,
  status          ENUM('aktif','ditangguhkan','dicabut') NOT NULL DEFAULT 'aktif',
  show_in_directory TINYINT(1) NOT NULL DEFAULT 1,
  created_by      INT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Draft Ajukan Layanan (satu draft per pelanggan, berkas tidak ikut disimpan)
CREATE TABLE drafts (
  user_id     INT PRIMARY KEY,
  service_code VARCHAR(10) NOT NULL,
  stage       TINYINT NOT NULL DEFAULT 1,
  payload     MEDIUMTEXT NOT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_draft_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Template dokumen yang diunduh pelanggan (file Word, bisa diganti Super Admin)
CREATE TABLE doc_templates (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL UNIQUE,
  description   VARCHAR(255) NULL,
  file_path     VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Riwayat sertifikat: terbit, perubahan status (dengan alasan), tanggal, dan tampil di Directory
CREATE TABLE certificate_logs (
  id INT AUTO_INCREMENT PRIMARY KEY, source ENUM('silapp','lama') NOT NULL, cert_id INT NOT NULL, certificate_no VARCHAR(80) NOT NULL,
  action ENUM('terbit','status','ubah','tampil') NOT NULL, status VARCHAR(20) NULL, note TEXT NULL,
  user_id INT NULL, pic_label VARCHAR(160) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_certlog (source, cert_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tautan reset kata sandi (token disimpan dalam bentuk hash, berlaku 30 menit, sekali pakai)
CREATE TABLE password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE, expires_at DATETIME NOT NULL,
  used_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Antrean email: semua email dicatat, yang gagal dicoba ulang otomatis; isi email dihapus setelah terkirim
CREATE TABLE email_outbox (
  id INT AUTO_INCREMENT PRIMARY KEY, to_addr VARCHAR(255) NOT NULL, subject VARCHAR(255) NOT NULL, body MEDIUMTEXT NULL,
  attachments TEXT NULL, status ENUM('antri','terkirim','gagal','dilewati') NOT NULL DEFAULT 'antri', attempts INT NOT NULL DEFAULT 0,
  last_error VARCHAR(500) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, sent_at DATETIME NULL,
  KEY idx_outbox_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pengingat yang sudah dikirim (agar tidak terkirim dua kali)
CREATE TABLE reminder_log (
  id INT AUTO_INCREMENT PRIMARY KEY, kind VARCHAR(30) NOT NULL, ref_id INT NOT NULL, mark VARCHAR(30) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_reminder (kind, ref_id, mark)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tahap akhir Invoice & Faktur: file dari PSU, bukti bayar (pelunasan) dan bukti potong PPh 23 dari pelanggan, disetujui masing-masing
CREATE TABLE billings (
  application_id INT PRIMARY KEY, amount_due DECIMAL(14,2) NOT NULL DEFAULT 0, with_pph23 TINYINT(1) NOT NULL DEFAULT 0,
  invoice_path VARCHAR(255) NULL, invoice_name VARCHAR(255) NULL, faktur_path VARCHAR(255) NULL, faktur_name VARCHAR(255) NULL,
  note TEXT NULL, sent_at DATETIME NULL,
  pay_status ENUM('tidak_perlu','belum','menunggu','disetujui','ditolak') NOT NULL DEFAULT 'belum', pay_path VARCHAR(255) NULL, pay_at DATETIME NULL, pay_note VARCHAR(500) NULL,
  cut_status ENUM('tidak_perlu','belum','menunggu','disetujui','ditolak') NOT NULL DEFAULT 'belum', cut_path VARCHAR(255) NULL, cut_at DATETIME NULL, cut_note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME NULL,
  CONSTRAINT fk_bill_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 0;

-- product_parameters (84 baris)
INSERT INTO `product_parameters` (`id`, `product_id`, `name`, `method`, `price`, `price_alt`) VALUES
(1, 40, 'P₂O₅ Total', 'AOAC Ed. 20 (2016) butir 2.3.01 & 2.3.02', '500000.00', NULL),
(2, 40, 'P₂O₅ Larut dalam Asam Sitrat 2%', 'SNI 02-3769-2005 butir 6.1.2', '350000.00', NULL),
(3, 40, 'P₂O₅ Larut dalam Air', 'AOAC Ed. 20 (2016) butir 2.3.06 & 2.3.09', '350000.00', NULL),
(4, 40, 'Kadar Belerang (S)', 'IKM-Lab-PSN-01 (spektrofotometri)', '350000.00', NULL),
(5, 40, 'Kadar Asam Bebas (H₃PO₄)', 'SNI 02-3769-2005 butir 6.3', '350000.00', NULL),
(6, 40, 'Kadar Air', 'AOAC Ed. 20 (2016) butir 2.2.01', '300000.00', NULL),
(7, 41, 'P₂O₅ Total', 'AOAC Ed. 20 (2016) butir 2.3.01 & 2.3.02', '500000.00', NULL),
(8, 41, 'P₂O₅ Larut dalam Asam Sitrat 2%', 'SNI 02-3776-2005 butir 6.1.2', '350000.00', NULL),
(9, 41, 'Kadar Air', 'AOAC Ed. 20 (2016) butir 2.2.01', '300000.00', NULL),
(10, 41, 'Kehalusan Lolos 80 Mesh', 'SNI 02-3776-2005 butir 6.3', '100000.00', NULL),
(11, 41, 'Kehalusan Lolos 25 Mesh', 'SNI 02-3776-2005 butir 6.3', '100000.00', NULL),
(12, 41, 'Cemaran Kadmium (Cd)', 'SNI 02-3776-2005 butir 6.4.1', '300000.00', NULL),
(13, 41, 'Cemaran Timbal (Pb)', 'SNI 02-3776-2005 butir 6.4.2', '300000.00', NULL),
(14, 41, 'Cemaran Merkuri (Hg)', 'Subkon (lab luar)', '400000.00', NULL),
(15, 41, 'Cemaran Arsen (As)', 'Subkon (lab luar)', '400000.00', NULL),
(16, 42, 'Kadar Kalium (K₂O)', 'AOAC Ed. 20 (2016) butir 2.5.07', '1600000.00', NULL),
(17, 42, 'Kadar Air', 'AOAC Ed. 20 (2016) butir 2.2.01', '400000.00', NULL),
(18, 43, 'P₂O₅ Total', 'AOAC Ed. 20 (2016) butir 2.3.01 & 2.3.02', '500000.00', NULL),
(19, 43, 'P₂O₅ Larut dalam Asam Sitrat 2%', 'SNI 02-0086-2005 butir 6.1.2', '350000.00', NULL),
(20, 43, 'P₂O₅ Larut dalam Air', 'AOAC Ed. 20 (2016) butir 2.3.06 & 2.3.09', '350000.00', NULL),
(21, 43, 'Kadar Asam Bebas (H₃PO₄)', 'SNI 02-0086-2005 butir 6.2', '350000.00', NULL),
(22, 43, 'Kadar Air', 'AOAC Ed. 20 (2016) butir 2.2.01', '300000.00', NULL),
(23, 43, 'Cemaran Kadmium (Cd)', 'SNI 02-0086-2005 butir 6.4.1', '300000.00', NULL),
(24, 43, 'Cemaran Timbal (Pb)', 'SNI 02-0086-2005 butir 6.4.2', '300000.00', NULL),
(25, 43, 'Cemaran Merkuri (Hg)', 'Subkon (lab luar)', '400000.00', NULL),
(26, 43, 'Cemaran Arsen (As)', 'Subkon (lab luar)', '400000.00', NULL),
(27, 44, 'Nitrogen Total', 'SNI 2803:2024 butir 6.2.1', '500000.00', NULL),
(28, 44, 'Fosfor Total (P₂O₅)', 'SNI 2803:2024 butir 6.3.1', '500000.00', NULL),
(29, 44, 'Kalium (K₂O)', 'SNI 2803:2024 butir 6.4.1', '500000.00', NULL),
(30, 44, 'Jumlah Kadar N, P₂O₅, K₂O', 'SNI 2803:2024', '0.00', NULL),
(31, 44, 'Kadar Air', 'AOAC Ed. 20 (2016) butir 2.2.01', '300000.00', NULL),
(32, 44, 'Cemaran Kadmium (Cd)', 'SNI 2803:2024 butir 6.6.2', '300000.00', NULL),
(33, 44, 'Cemaran Timbal (Pb)', 'SNI 2803:2024 butir 6.6.3', '300000.00', NULL),
(34, 44, 'Cemaran Merkuri (Hg)', 'Subkon (lab luar)', '400000.00', NULL),
(35, 44, 'Cemaran Arsen (As)', 'Subkon (lab luar)', '400000.00', NULL),
(36, 45, 'Kadar Nitrogen', 'ISO 3332:1975', '800000.00', NULL),
(37, 45, 'Kadar Belerang (S)', 'SNI 02-1760-2005 butir 6.2.2', '550000.00', NULL),
(38, 45, 'Kadar Asam Bebas (H₂SO₄)', 'ISO 2993:1974', '550000.00', NULL),
(39, 45, 'Kadar Air', 'AOAC Ed. 20 (2016) butir 2.2.01', '300000.00', NULL),
(40, 46, 'Kadar Nitrogen', 'SNI 2801:2010 butir 6.1.1', '800000.00', NULL),
(41, 46, 'Kadar Air', 'AOAC Ed. 20 (2016) butir 2.2.01', '300000.00', NULL),
(42, 46, 'Kadar Biuret', 'SNI 2801:2010', '700000.00', NULL),
(43, 46, 'Ukuran Butir', 'SNI 2801:2010 butir 6.4', '400000.00', NULL),
(44, 47, 'Kadar Air', 'SNI 6128:2020', NULL, NULL),
(45, 48, 'Kadar Air dan Bahan Menguap', 'SNI 7709:2019', NULL, NULL),
(46, 48, 'Bilangan Asam', 'SNI 7709:2019', NULL, NULL),
(47, 48, 'Bilangan Peroksida', 'SNI 7709:2019', NULL, NULL),
(48, 48, 'Vitamin A', 'SNI 7709:2019', NULL, NULL),
(49, 48, 'Minyak Pelikan', 'SNI 7709:2019', NULL, NULL),
(50, 48, 'Cemaran Kadmium (Cd)', 'SNI 7709:2019', NULL, NULL),
(51, 48, 'Cemaran Timbal (Pb)', 'SNI 7709:2019', NULL, NULL),
(52, 48, 'Cemaran Timah (Sn)', 'SNI 7709:2019', NULL, NULL),
(53, 48, 'Cemaran Merkuri (Hg)', 'SNI 7709:2019', NULL, NULL),
(54, 48, 'Cemaran Arsen (As)', 'SNI 7709:2019', NULL, NULL),
(55, 50, 'Sifat Tampak', 'SNI 8752:2020 butir 6.1.1', '150000.00', '200000.00'),
(56, 50, 'Ketajaman Permukaan', 'SNI 8752:2020 butir 6.1.2', '150000.00', '200000.00'),
(57, 50, 'Bentuk (Ukuran)', 'SNI 8752:2020 butir 6.2', '200000.00', '250000.00'),
(58, 50, 'Ketebalan Bahan Dasar', 'SNI 8752:2020 butir 6.3', '200000.00', '300000.00'),
(59, 50, 'Kekuatan Pegangan (Handle)', 'SNI 8752:2020 butir 6.4', '200000.00', '300000.00'),
(60, 50, 'Kapasitas Volume Air', 'SNI 8752:2020 butir 6.5', '200000.00', '250000.00'),
(61, 50, 'Kelekatan Lapisan Anti Lengket', 'SNI 8752:2020 butir 6.6', '200000.00', '300000.00'),
(62, 50, 'Ketahanan Kejut Panas (Thermal Shock)', 'SNI 8752:2020 butir 6.7', '200000.00', '300000.00'),
(63, 50, 'Ketebalan Lapisan', 'SNI 8752:2020 butir 6.8', '200000.00', '300000.00'),
(64, 50, 'Ketahanan terhadap Asam', 'SNI 8752:2020 butir 6.9', '200000.00', '300000.00'),
(65, 50, 'Kestabilan Produk', 'SNI 8752:2020 butir 6.10', '100000.00', '200000.00'),
(66, 51, 'Sifat Tampak', 'SNI 8753:2020 butir 8.1.1', '150000.00', '200000.00'),
(67, 51, 'Ketajaman Permukaan', 'SNI 8753:2020 butir 8.1.2', '150000.00', '200000.00'),
(68, 51, 'Ketebalan', 'SNI 8753:2020 butir 8.2', '200000.00', '300000.00'),
(69, 51, 'Ukuran Panjang', 'SNI 8753:2020 butir 8.3', '200000.00', '300000.00'),
(70, 51, 'Kapasitas Volume', 'SNI 8753:2020 butir 8.4', '200000.00', '300000.00'),
(71, 51, 'Ketahanan terhadap Pembebanan', 'SNI 8753:2020 butir 8.6', '300000.00', '400000.00'),
(72, 51, 'Uji Kimia', 'SNI 8753:2020 butir 8.5', '500000.00', '700000.00'),
(73, 52, 'Derajat Sosoh', 'SNI 6128:2020', NULL, NULL),
(74, 52, 'Butir Kepala', 'SNI 6128:2020', NULL, NULL),
(75, 52, 'Butir Patah', 'SNI 6128:2020', NULL, NULL),
(76, 52, 'Butir Menir', 'SNI 6128:2020', NULL, NULL),
(77, 52, 'Butir Merah/Putih/Hitam', 'SNI 6128:2020', NULL, NULL),
(78, 52, 'Butir Rusak', 'SNI 6128:2020', NULL, NULL),
(79, 52, 'Butir Kapur', 'SNI 6128:2020', NULL, NULL),
(80, 52, 'Benda Asing', 'SNI 6128:2020', NULL, NULL),
(81, 52, 'Butir Gabah', 'SNI 6128:2020', NULL, NULL),
(82, 53, 'Keadaan: Bau', 'SNI 7709:2019', NULL, NULL),
(83, 53, 'Keadaan: Rasa', 'SNI 7709:2019', NULL, NULL),
(84, 53, 'Warna', 'SNI 7709:2019', NULL, NULL);

-- products (54 baris)
INSERT INTO `products` (`id`, `service_id`, `category`, `sub_category`, `name`, `standard_no`, `scheme_reference`, `scheme_types`, `package_price`, `package_price_alt`, `alt_available`, `note`, `custom_name`) VALUES
(1, 1, 'Pertanian dan Perkebunan', 'Hasil Pertanian & Perkebunan', 'Beras', 'SNI 6128:2020', 'PBSN No. 4 Tahun 2021 Lamp. XVII', NULL, NULL, NULL, 1, NULL, 0),
(2, 1, 'Pertanian dan Perkebunan', 'Hasil Pertanian & Perkebunan', 'Biji Kakao', 'SNI 2323:2008 / Amd1:2010', 'PBSN No. 4 Tahun 2021 Lamp. XIII', NULL, NULL, NULL, 1, NULL, 0),
(3, 1, 'Pertanian dan Perkebunan', 'Hasil Pertanian & Perkebunan', 'Biji Kopi', 'SNI 2907:2008', 'PBSN No. 4 Tahun 2021 Lamp. XIV', NULL, NULL, NULL, 1, NULL, 0),
(4, 1, 'Produk Tanaman dan Turunannya', 'Serealia, Umbi-umbian & Turunannya', 'Biskuit', 'SNI 2973:2011', 'Permenperin No. 60/M-IND/PER/7/2015', 'Tipe 5', NULL, NULL, 1, NULL, 0),
(5, 1, 'Produk Tanaman dan Turunannya', 'Gula, Produk Gula, Pati', 'Gula Kristal Putih', 'SNI 3140.3:2020', NULL, 'Tipe 5', NULL, NULL, 1, NULL, 0),
(6, 1, 'Produk Tanaman dan Turunannya', 'Gula, Produk Gula, Pati', 'Gula Kristal Rafinasi', 'SNI 3140.2:2018', NULL, 'Tipe 5', NULL, NULL, 1, NULL, 0),
(7, 1, 'Produk Tanaman dan Turunannya', 'Gula, Produk Gula, Pati', 'Gula Kristal Mentah', 'SNI 3140.1:2008', 'Kepmentan No. 03/Kpts/KB.410/1/2003', 'Tipe 5', NULL, NULL, 1, NULL, 0),
(8, 1, 'Produk Tanaman dan Turunannya', 'Kopi, Teh, Kakao, Cokelat', 'Kopi Instan', 'SNI 2983:2014', 'Permenperin No. 87/M-IND/PER/10/2014', 'Tipe 5/Tipe 1b', NULL, NULL, 1, NULL, 0),
(9, 1, 'Produk Tanaman dan Turunannya', 'Kopi, Teh, Kakao, Cokelat', 'Kopi Sangrai dan Kopi Bubuk', 'SNI 8964:2021', 'PBSN No. 4 Tahun 2024', NULL, NULL, NULL, 1, NULL, 0),
(10, 1, 'Produk Tanaman dan Turunannya', 'Kopi, Teh, Kakao, Cokelat', 'Kopi Gula Krimer dalam Kemasan', 'SNI 7708:2011', 'PBSN No. 6 Tahun 2019 Lamp. XXXV', NULL, NULL, NULL, 1, NULL, 0),
(11, 1, 'Produk Tanaman dan Turunannya', 'Kopi, Teh, Kakao, Cokelat', 'Kakao Bubuk', 'SNI 3747:2009', 'Permenperin No. 45/M-IND/PER/5/2009', 'Tipe 5/Tipe 1b', NULL, NULL, 1, NULL, 0),
(12, 1, 'Produk Tanaman dan Turunannya', 'Minyak Nabati & Lemak', 'Minyak Goreng Sawit', 'SNI 7709:2019', 'Permenperin No. 46 Tahun 2019', 'Tipe 5', NULL, NULL, 1, NULL, 0),
(13, 1, 'Produk Tanaman dan Turunannya', 'Minyak Nabati & Lemak', 'Minyak Goreng', 'SNI 3741:2013', NULL, 'Tipe 5', NULL, NULL, 1, NULL, 0),
(14, 1, 'Produk Pangan Lainnya', 'Minuman', 'Air Mineral', 'SNI 3553:2015', 'Permenperin No. 78/M-IND/PER/11/2016', 'Tipe 5/Tipe 4', NULL, NULL, 1, NULL, 0),
(15, 1, 'Produk Pangan Lainnya', 'Minuman', 'Air Demineral', 'SNI 6241:2015', 'Permenperin No. 78/M-IND/PER/11/2016', 'Tipe 5/Tipe 4', NULL, NULL, 1, NULL, 0),
(16, 1, 'Produk Pangan Lainnya', 'Minuman', 'Air Mineral Alami', 'SNI 6242:2015', 'Permenperin No. 78/M-IND/PER/11/2016', 'Tipe 5', NULL, NULL, 1, NULL, 0),
(17, 1, 'Produk Pangan Lainnya', 'Minuman', 'Air Minum Embun', 'SNI 7812:2013', 'Permenperin No. 78/M-IND/PER/11/2016', 'Tipe 5', NULL, NULL, 1, NULL, 0),
(18, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Super Fosfat SP-36', 'SNI 02-3769-2005', 'Permenperin No. 26/M-IND/PER/4/2013', 'Tipe 5/Tipe 1b', NULL, NULL, 1, NULL, 0),
(19, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Fosfat Alam untuk Pertanian', 'SNI 02-3776-2005', 'Permenperin No. 26/M-IND/PER/4/2013', 'Tipe 5/Tipe 1b', NULL, NULL, 1, NULL, 0),
(20, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Kalium Klorida', 'SNI 02-2805-2005', 'Permenperin No. 26/M-IND/PER/4/2013', 'Tipe 5/Tipe 1b', NULL, NULL, 1, NULL, 0),
(21, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Tripel Super Fosfat (TSP)', 'SNI 02-0086-2005', 'Permenperin No. 26/M-IND/PER/4/2013', 'Tipe 5/Tipe 1b', NULL, NULL, 1, NULL, 0),
(22, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk NPK Padat', 'SNI 2803:2024', 'Permenperin No. 11 Tahun 2025', 'Tipe 5/Tipe 1b', NULL, NULL, 1, NULL, 0),
(23, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Amonium Sulfat (ZA)', 'SNI 02-1760-2005', 'Permenperin No. 26/M-IND/PER/4/2013', 'Tipe 5/Tipe 1b', NULL, NULL, 1, NULL, 0),
(24, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Urea', 'SNI 2801:2010', 'Permenperin No. 73 Tahun 2024', 'Tipe 5', NULL, NULL, 1, NULL, 0),
(25, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Mono Amonium Fosfat (MAP)', 'SNI 02-2810-2005', 'PBSN No. 4 Tahun 2021 Lamp. XXV', NULL, NULL, NULL, 1, NULL, 0),
(26, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Diamonium Fosfat', 'SNI 02-2858-2005', 'PBSN No. 4 Tahun 2021 Lamp. XXVII', NULL, NULL, NULL, 1, NULL, 0),
(27, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Urea Amonium Fosfat', 'SNI 02-2811-2005', 'PBSN No. 4 Tahun 2021 Lamp. XXIII', NULL, NULL, NULL, 1, NULL, 0),
(28, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Tripel Super Fosfat plus-Zn', 'SNI 02-2800-2005', 'PBSN No. 4 Tahun 2021 Lamp. XXVI', NULL, NULL, NULL, 1, NULL, 0),
(29, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Super Fosfat plus-Zn', 'SNI 02-4873-1998', 'PBSN No. 4 Tahun 2021 Lamp. I', NULL, NULL, NULL, 1, NULL, 0),
(30, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Super Fosfat Tunggal (SP-18)', 'SNI 6246:2010', 'PBSN No. 4 Tahun 2021 Lamp. XXIX', NULL, NULL, NULL, 1, NULL, 0),
(31, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Dolomit', 'SNI 02-2804-2005', 'PBSN No. 4 Tahun 2021 Lamp. III', NULL, NULL, NULL, 1, NULL, 0),
(32, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Borat', 'SNI 02-4959-1999', 'PBSN No. 4 Tahun 2021 Lamp. XXII', NULL, NULL, NULL, 1, NULL, 0),
(33, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Amonium Klorida', 'SNI 02-2581-2005', 'PBSN No. 4 Tahun 2021 Lamp. XXIV', NULL, NULL, NULL, 1, NULL, 0),
(34, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Kiseret', 'SNI 02-2807-1992', 'PBSN No. 4 Tahun 2021 Lamp. XXI', NULL, NULL, NULL, 1, NULL, 0),
(35, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Kalium Sulfat', 'SNI 2809:2014', 'PBSN No. 4 Tahun 2021 Lamp. II', NULL, NULL, NULL, 1, NULL, 0),
(36, 1, 'Bahan dan Produk Kimia', 'Pupuk', 'Pupuk Cair Hasil Samping Proses Asam Amino (Haspramin)', 'SNI 4958:2015', 'PBSN No. 4 Tahun 2021 Lamp. XXVIII', NULL, NULL, NULL, 1, NULL, 0),
(37, 1, 'Sertifikasi Jasa', 'Jasa', 'Pasar Rakyat', 'SNI 8152:2021', 'Peraturan BSN No. 7 Tahun 2024', NULL, NULL, NULL, 1, NULL, 0),
(38, 7, 'Sistem Manajemen', NULL, 'Sistem Manajemen Mutu', 'ISO 9001', NULL, NULL, NULL, NULL, 1, NULL, 0),
(39, 7, 'Sistem Manajemen', NULL, 'Sistem Manajemen Keamanan Pangan', 'ISO 22000', NULL, NULL, NULL, NULL, 1, NULL, 0),
(40, 3, 'Uji SNI', NULL, 'Pupuk SP-36', 'SNI 02-3769-2005', NULL, NULL, '2000000.00', NULL, 1, NULL, 0),
(41, 3, 'Uji SNI', NULL, 'Pupuk Fosfat Alam untuk Pertanian', 'SNI 02-3776-2005', NULL, NULL, '2500000.00', NULL, 0, NULL, 0),
(42, 3, 'Uji SNI', NULL, 'Pupuk Kalium Klorida', 'SNI 02-2805-2005', NULL, NULL, '2000000.00', NULL, 1, NULL, 0),
(43, 3, 'Uji SNI', NULL, 'Pupuk Tripel Super Fosfat (TSP)', 'SNI 02-0086-2005', NULL, NULL, '3000000.00', NULL, 0, NULL, 0),
(44, 3, 'Uji SNI', NULL, 'Pupuk NPK Padat', 'SNI 2803:2024', NULL, NULL, '3000000.00', NULL, 0, NULL, 0),
(45, 3, 'Uji SNI', NULL, 'Pupuk Amonium Sulfat (ZA)', 'SNI 02-1760-2005', NULL, NULL, '2000000.00', NULL, 1, NULL, 0),
(46, 3, 'Uji SNI', NULL, 'Pupuk Urea', 'SNI 2801:2010', NULL, NULL, '2000000.00', NULL, 1, NULL, 0),
(47, 3, 'Uji SNI', NULL, 'Beras', 'SNI 6128:2020', NULL, NULL, NULL, NULL, 1, NULL, 0),
(48, 3, 'Uji SNI', NULL, 'Minyak Goreng Sawit', 'SNI 7709:2019', NULL, NULL, NULL, NULL, 1, NULL, 0),
(49, 3, 'Uji SNI', NULL, 'Parameter Tambahan di Luar Lingkup Akreditasi KAN', NULL, NULL, NULL, NULL, NULL, 1, 'Dapat langsung menghubungi pihak PSU.', 1),
(50, 4, 'Uji SNI', NULL, 'Peralatan Masak (Cookware) dari Logam', 'SNI 8752:2020', NULL, NULL, '1500000.00', '2500000.00', 1, NULL, 0),
(51, 4, 'Uji SNI', NULL, 'Peralatan Makan & Masak Baja Tahan Karat (Flatware)', 'SNI 8753:2020', NULL, NULL, '1500000.00', '2000000.00', 1, 'Uji kimia dikirim ke laboratorium GSI: Rp380.000 per bahan baku (di luar PPN).', 0),
(52, 4, 'Uji SNI', NULL, 'Beras', 'SNI 6128:2020', NULL, NULL, NULL, NULL, 1, NULL, 0),
(53, 4, 'Uji SNI', NULL, 'Minyak Goreng Sawit', 'SNI 7709:2019', NULL, NULL, NULL, NULL, 1, NULL, 0),
(54, 4, 'Uji SNI', NULL, 'Parameter Tambahan di Luar Lingkup Akreditasi KAN', NULL, NULL, NULL, NULL, NULL, 1, 'Dapat langsung menghubungi pihak PSU.', 1);

-- service_documents (15 baris)
INSERT INTO `service_documents` (`id`, `service_id`, `name`, `required`, `admin_if_package`, `show_when`, `hide_schemes`, `sort_order`, `is_active`) VALUES
(1, 1, 'Surat Permohonan', 1, 1, NULL, NULL, 0, 1),
(2, 1, 'Surat Kesediaan Surveillance', 1, 0, NULL, 'Tipe 1b', 1, 1),
(3, 1, 'Surat Pernyataan Keaslian Dokumen', 1, 0, NULL, 'Tipe 1b', 2, 1),
(4, 1, 'Akta Perusahaan & NIB', 1, 0, NULL, NULL, 3, 1),
(5, 1, 'Spesifikasi Produk', 0, 0, NULL, NULL, 4, 1),
(6, 1, 'Sertifikat Merek', 0, 0, NULL, NULL, 5, 1),
(7, 1, 'Dokumen Sistem Mutu', 0, 0, NULL, 'Tipe 1b', 6, 1),
(8, 3, 'Surat Permohonan Pengujian', 1, 0, NULL, NULL, 0, 1),
(9, 3, 'Data Sampel / Spesifikasi', 0, 0, NULL, NULL, 1, 1),
(10, 4, 'Surat Permohonan Pengujian', 1, 0, NULL, NULL, 0, 1),
(11, 4, 'Data Sampel / Spesifikasi', 0, 0, NULL, NULL, 1, 1),
(12, 5, 'Surat Permohonan Pengujian', 1, 0, NULL, NULL, 0, 1),
(13, 5, 'Data Sampel / Spesifikasi', 0, 0, NULL, NULL, 1, 1),
(14, 6, 'Surat Permohonan Kalibrasi', 1, 0, NULL, NULL, 0, 1),
(15, 6, 'Foto / Data Teknis Alat', 0, 0, NULL, NULL, 1, 1);

-- service_fields (14 baris)
INSERT INTO `service_fields` (`id`, `service_id`, `field_key`, `label`, `type`, `options`, `required`, `show_when`, `multiple`, `sort_order`, `is_active`) VALUES
(1, 1, 'nama_pabrik', 'Nama Pabrik', 'text', NULL, 1, NULL, 0, 0, 1),
(2, 1, 'alamat_pabrik', 'Alamat Pabrik', 'textarea', NULL, 1, NULL, 0, 1, 1),
(3, 1, 'kota_provinsi', 'Kota Pabrik', 'text', NULL, 1, NULL, 0, 2, 1),
(4, 1, 'provinsi_pabrik', 'Provinsi Pabrik', 'text', NULL, 1, NULL, 0, 3, 1),
(5, 1, 'batch', 'Nomor Bill Of Lading', 'nomor_tanggal', NULL, 1, '1B', 1, 4, 1),
(6, 1, 'jumlah', 'Jumlah Produk', 'text', NULL, 1, '1B', 0, 5, 1),
(7, 1, 'shipment', 'Nomor Packing List', 'nomor_tanggal', NULL, 1, '1B', 1, 6, 1),
(8, 1, 'nomor_invoice', 'Nomor Invoice', 'nomor_tanggal', NULL, 1, '1B', 1, 7, 1),
(9, 1, 'asal', 'Negara Asal', 'text', NULL, 0, '1B', 0, 8, 1),
(10, 1, 'pelabuhan', 'Pelabuhan Asal', 'text', NULL, 1, '1B', 0, 9, 1),
(11, 3, 'keterangan', 'Keterangan Tambahan', 'textarea', NULL, 0, NULL, 0, 0, 1),
(12, 4, 'keterangan', 'Keterangan Tambahan', 'textarea', NULL, 0, NULL, 0, 0, 1),
(13, 5, 'keterangan', 'Keterangan Tambahan', 'textarea', NULL, 0, NULL, 0, 0, 1),
(14, 6, 'tanggal_diinginkan', 'Tanggal Kalibrasi yang Diinginkan', 'date', NULL, 0, NULL, 0, 0, 1);

-- service_steps (64 baris)
INSERT INTO `service_steps` (`id`, `service_id`, `step_order`, `status_code`, `name`, `progress_pct`, `is_optional`, `is_payment_step`, `is_certificate_step`, `is_billing_step`, `sla_days`, `flow`) VALUES
(1, 1, 1, 'ST-01', 'Permohonan Diterima', 10, 0, 0, 0, 0, NULL, ''),
(2, 1, 2, 'ST-02', 'Verifikasi & Tinjauan Permohonan', 20, 0, 0, 0, 0, NULL, ''),
(3, 1, 3, 'ST-03', 'Penawaran & Kontrak', 30, 0, 1, 0, 0, NULL, ''),
(4, 1, 4, 'ST-04', 'Penjadwalan & Penugasan', 40, 0, 0, 0, 0, NULL, ''),
(5, 1, 5, 'ST-05', 'Evaluasi/Audit & Sampling', 50, 0, 0, 0, 0, NULL, ''),
(6, 1, 6, 'ST-06', 'Pengujian Laboratorium', 60, 0, 0, 0, 0, NULL, ''),
(7, 1, 7, 'ST-07', 'Tindakan Perbaikan', 70, 1, 0, 0, 0, NULL, ''),
(8, 1, 8, 'ST-08', 'Review Hasil Evaluasi', 80, 0, 0, 0, 0, NULL, ''),
(9, 1, 9, 'ST-09', 'Keputusan Sertifikasi', 90, 0, 0, 0, 0, NULL, ''),
(10, 1, 10, 'ST-10', 'Sertifikat Terbit', 95, 0, 0, 1, 0, NULL, ''),
(11, 1, 11, 'ST-11', 'Invoice & Faktur', 98, 0, 0, 0, 1, NULL, ''),
(12, 1, 1, 'ST-01', 'Permohonan Diterima', 10, 0, 0, 0, 0, NULL, '1B'),
(13, 1, 2, 'ST-02', 'Verifikasi & Tinjauan Permohonan', 20, 0, 0, 0, 0, NULL, '1B'),
(14, 1, 3, 'ST-03', 'Penawaran & Kontrak', 30, 0, 1, 0, 0, NULL, '1B'),
(15, 1, 4, 'ST-04', 'Penjadwalan & Penugasan', 40, 0, 0, 0, 0, NULL, '1B'),
(16, 1, 5, 'ST-05', 'Sampling', 50, 0, 0, 0, 0, NULL, '1B'),
(17, 1, 6, 'ST-06', 'Pengujian Laboratorium', 65, 0, 0, 0, 0, NULL, '1B'),
(18, 1, 7, 'ST-07', 'Review & Keputusan', 85, 0, 0, 0, 0, NULL, '1B'),
(19, 1, 8, 'ST-08', 'Sertifikat Terbit', 95, 0, 0, 1, 0, NULL, '1B'),
(20, 1, 9, 'ST-09', 'Invoice & Faktur', 98, 0, 0, 0, 1, NULL, '1B'),
(21, 3, 1, 'LAB-01', 'Permohonan Diterima', 10, 0, 0, 0, 0, NULL, ''),
(22, 3, 2, 'LAB-02', 'Sampel Diterima & Diregistrasi', 20, 0, 0, 0, 0, NULL, ''),
(23, 3, 3, 'LAB-03', 'Penawaran & Kontrak', 35, 0, 1, 0, 0, NULL, ''),
(24, 3, 4, 'LAB-04', 'Proses Pengujian', 60, 0, 0, 0, 0, NULL, ''),
(25, 3, 5, 'LAB-05', 'Review & Verifikasi Hasil', 80, 0, 0, 0, 0, NULL, ''),
(26, 3, 6, 'LAB-06', 'Penyusunan LHU', 90, 0, 0, 1, 0, NULL, ''),
(27, 3, 7, 'LAB-07', 'LHU Terbit', 95, 0, 0, 0, 0, NULL, ''),
(28, 3, 8, 'LAB-08', 'Invoice & Faktur', 98, 0, 0, 0, 1, NULL, ''),
(29, 4, 1, 'LAB-01', 'Permohonan Diterima', 10, 0, 0, 0, 0, NULL, ''),
(30, 4, 2, 'LAB-02', 'Sampel Diterima & Diregistrasi', 20, 0, 0, 0, 0, NULL, ''),
(31, 4, 3, 'LAB-03', 'Penawaran & Kontrak', 35, 0, 1, 0, 0, NULL, ''),
(32, 4, 4, 'LAB-04', 'Proses Pengujian', 60, 0, 0, 0, 0, NULL, ''),
(33, 4, 5, 'LAB-05', 'Review & Verifikasi Hasil', 80, 0, 0, 0, 0, NULL, ''),
(34, 4, 6, 'LAB-06', 'Penyusunan LHU', 90, 0, 0, 1, 0, NULL, ''),
(35, 4, 7, 'LAB-07', 'LHU Terbit', 95, 0, 0, 0, 0, NULL, ''),
(36, 4, 8, 'LAB-08', 'Invoice & Faktur', 98, 0, 0, 0, 1, NULL, ''),
(37, 5, 1, 'LAB-01', 'Permohonan Diterima', 10, 0, 0, 0, 0, NULL, ''),
(38, 5, 2, 'LAB-02', 'Sampel Diterima & Diregistrasi', 20, 0, 0, 0, 0, NULL, ''),
(39, 5, 3, 'LAB-03', 'Penawaran & Kontrak', 35, 0, 1, 0, 0, NULL, ''),
(40, 5, 4, 'LAB-04', 'Proses Pengujian', 60, 0, 0, 0, 0, NULL, ''),
(41, 5, 5, 'LAB-05', 'Review & Verifikasi Hasil', 80, 0, 0, 0, 0, NULL, ''),
(42, 5, 6, 'LAB-06', 'Penyusunan LHU', 90, 0, 0, 1, 0, NULL, ''),
(43, 5, 7, 'LAB-07', 'LHU Terbit', 95, 0, 0, 0, 0, NULL, ''),
(44, 5, 8, 'LAB-08', 'Invoice & Faktur', 98, 0, 0, 0, 1, NULL, ''),
(45, 6, 1, 'KAL-01', 'Permohonan Diterima', 10, 0, 0, 0, 0, NULL, ''),
(46, 6, 2, 'KAL-02', 'Penawaran & Kontrak', 20, 0, 1, 0, 0, NULL, ''),
(47, 6, 3, 'KAL-03', 'Alat Diterima & Diregistrasi', 30, 0, 0, 0, 0, NULL, ''),
(48, 6, 4, 'KAL-04', 'Persiapan Kalibrasi', 40, 0, 0, 0, 0, NULL, ''),
(49, 6, 5, 'KAL-05', 'Pelaksanaan Kalibrasi', 65, 0, 0, 0, 0, NULL, ''),
(50, 6, 6, 'KAL-06', 'Review & Verifikasi Hasil', 80, 0, 0, 0, 0, NULL, ''),
(51, 6, 7, 'KAL-07', 'Penerbitan Sertifikat', 90, 0, 0, 1, 0, NULL, ''),
(52, 6, 8, 'KAL-08', 'Sertifikat Terbit', 95, 0, 0, 0, 0, NULL, ''),
(53, 6, 9, 'KAL-09', 'Pengembalian Alat', 95, 1, 0, 0, 0, NULL, ''),
(54, 6, 10, 'KAL-10', 'Invoice & Faktur', 98, 0, 0, 0, 1, NULL, ''),
(55, 7, 1, 'LSM-01', 'Permohonan Diterima', 10, 0, 0, 0, 0, NULL, ''),
(56, 7, 2, 'LSM-02', 'Verifikasi & Tinjauan Permohonan', 20, 0, 0, 0, 0, NULL, ''),
(57, 7, 3, 'LSM-03', 'Penawaran & Kontrak', 30, 0, 1, 0, 0, NULL, ''),
(58, 7, 4, 'LSM-04', 'Penjadwalan & Penugasan', 40, 0, 0, 0, 0, NULL, ''),
(59, 7, 5, 'LSM-05', 'Evaluasi/Audit', 55, 0, 0, 0, 0, NULL, ''),
(60, 7, 6, 'LSM-06', 'Tindakan Perbaikan', 70, 1, 0, 0, 0, NULL, ''),
(61, 7, 7, 'LSM-07', 'Review Hasil Evaluasi', 80, 0, 0, 0, 0, NULL, ''),
(62, 7, 8, 'LSM-08', 'Keputusan Sertifikasi', 90, 0, 0, 0, 0, NULL, ''),
(63, 7, 9, 'LSM-09', 'Sertifikat Terbit', 95, 0, 0, 1, 0, NULL, ''),
(64, 7, 10, 'LSM-10', 'Invoice & Faktur', 98, 0, 0, 0, 1, NULL, '');

-- services (7 baris)
INSERT INTO `services` (`id`, `parent_id`, `code`, `name`, `description`, `bidang`, `cp_name`, `cp_phone`, `est_text`, `state`, `sort_order`, `is_active`) VALUES
(1, NULL, 'SP', 'Sertifikasi Produk', 'Sertifikasi SPPT SNI skema Tipe 5 dan Tipe 1B untuk pangan, minuman, pupuk, dan pasar rakyat.', 'SP', 'Layanan Pelanggan PSU', '+62 819-0834-4114', '15–45 hari kerja', 'ok', 0, 1),
(2, NULL, 'LAB', 'Laboratorium', 'Laboratorium pengujian dan kalibrasi PT Penilai Standar Uji.', NULL, NULL, NULL, NULL, 'ok', 1, 1),
(3, 2, 'KIM', 'Laboratorium Kimia', 'Uji kimia pupuk, beras, dan minyak goreng sawit: unsur hara, kadar air, asam bebas, dan cemaran logam.', 'LAB', 'Layanan Pelanggan PSU', '+62 819-0834-4114', 'Reguler 5–7 hari, Ekspress 2–3 hari per sampel', 'ok', 2, 1),
(4, 2, 'FIS', 'Laboratorium Fisika', 'Uji fisik peralatan masak dan makan dari logam, serta mutu fisik beras dan minyak goreng sawit.', 'LAB', 'Layanan Pelanggan PSU', '+62 819-0834-4114', '7–14 hari kerja', 'ok', 3, 1),
(5, 2, 'MIK', 'Laboratorium Mikrobiologi', 'Uji cemaran mikroba pada sampel produk.', 'LAB', 'Layanan Pelanggan PSU', '+62 819-0834-4114', NULL, 'dev', 4, 1),
(6, 2, 'KAL', 'Laboratorium Kalibrasi', 'Kalibrasi alat ukur di laboratorium atau on-site.', 'KAL', 'Layanan Pelanggan PSU', '+62 819-0834-4114', '3–10 hari kerja per alat', 'prep', 5, 1),
(7, NULL, 'LSM', 'Lembaga Sistem Manajemen Mutu', 'Sertifikasi sistem manajemen mutu dan keamanan pangan untuk organisasi Anda.', NULL, NULL, NULL, NULL, 'prep', 6, 1);

-- settings (29 baris)
INSERT INTO `settings` (`skey`, `svalue`) VALUES
('contact_email', 'psuindonesia.info@gmail.com'),
('contact_phone', '+62 819-0834-4114'),
('migr:alur_1b', '2026-10-22 22:01:44'),
('migr:alur_tahapan', '2026-10-22 22:01:44'),
('migr:deskripsi_lab', '2026-10-22 22:01:44'),
('migr:detail_text', '2026-10-22 22:01:44'),
('migr:dokumen_1b', '2026-10-22 22:01:44'),
('migr:dokumen_sp_2', '2026-10-22 22:01:44'),
('migr:form_sp', '2026-10-22 22:01:44'),
('migr:hapus_isian_spesifikasi_lab', '2026-10-22 22:01:44'),
('migr:isian_nomor_tanggal', '2026-10-22 22:01:44'),
('migr:jenis_permohonan', '2026-10-22 22:01:44'),
('migr:kategori_sp', '2026-10-22 22:01:44'),
('migr:kode_lacak', '2026-10-22 22:01:44'),
('migr:kolom_2610', '2026-10-22 22:01:44'),
('migr:layanan_lsm', '2026-10-22 22:01:44'),
('migr:nib_npwp', '2026-10-22 22:01:44'),
('migr:penawaran_tagihan', '2026-10-22 22:01:44'),
('migr:produk_luar_lingkup', '2026-10-22 22:01:44'),
('migr:ruang_lingkup_lab', '2026-10-22 22:01:44'),
('migr:status_batal', '2026-10-22 22:01:44'),
('migr:status_sertifikat', '2026-10-22 22:01:44'),
('migr:template_kop_nib_npwp', '2026-10-22 22:01:44'),
('migr:unik_nomor_invoice', '2026-10-22 22:01:44'),
('migr:urutan_lab', '2026-10-22 22:01:44'),
('survey_intro_KAL', 'Survei ini ditujukan kepada pelanggan yang telah menggunakan layanan Laboratorium Kalibrasi PSU. Penilaian Anda digunakan untuk mengevaluasi mutu pelayanan, penanganan alat, ketepatan waktu, dan kualitas sertifikat kalibrasi.'),
('survey_intro_LAB', 'Survei ini ditujukan kepada pelanggan yang telah menggunakan layanan Laboratorium Pengujian PSU. Penilaian Anda digunakan untuk mengevaluasi mutu pelayanan, komunikasi, ketepatan waktu, dan kualitas penyampaian hasil pengujian.'),
('survey_intro_SP', 'Survei ini ditujukan kepada pelanggan yang telah menggunakan layanan sertifikasi produk PSU. Penilaian Anda tidak memengaruhi keputusan sertifikasi dan digunakan semata-mata untuk evaluasi serta peningkatan mutu layanan.'),
('thank_you_text', 'Terima kasih atas penilaian dan masukan Anda. Tanggapan Anda sangat berarti bagi PT Penilai Standar Uji (PSU) dan akan kami gunakan untuk meningkatkan mutu layanan secara berkelanjutan.');

-- survey_questions (44 baris)
INSERT INTO `survey_questions` (`id`, `bidang`, `question`, `sort_order`, `is_active`) VALUES
(1, 'SP', 'Informasi mengenai persyaratan, tahapan, biaya, dan estimasi waktu proses sertifikasi disampaikan dengan jelas.', 0, 1),
(2, 'SP', 'Proses pendaftaran/permohonan sertifikasi mudah dilakukan dan persyaratan dokumen mudah dipahami.', 1, 1),
(3, 'SP', 'Petugas PSU memberikan respons terhadap pertanyaan atau permintaan informasi secara cepat dan membantu.', 2, 1),
(4, 'SP', 'Penjadwalan audit/evaluasi dikomunikasikan dengan baik dan disepakati bersama pelanggan.', 3, 1),
(5, 'SP', 'Auditor/evaluator melaksanakan kegiatan secara profesional, sopan, kompeten, dan tepat waktu.', 4, 1),
(6, 'SP', 'Proses audit/evaluasi dilaksanakan secara objektif, konsisten, dan tidak memihak.', 5, 1),
(7, 'SP', 'Ruang lingkup audit/evaluasi serta tahapan yang dilakukan dijelaskan dengan baik kepada pelanggan.', 6, 1),
(8, 'SP', 'Temuan atau hasil evaluasi disampaikan secara jelas, mudah dipahami, dan disertai penjelasan tindak lanjut yang diperlukan.', 7, 1),
(9, 'SP', 'Informasi mengenai status proses sertifikasi dan tindak lanjut perbaikan disampaikan secara memadai.', 8, 1),
(10, 'SP', 'Proses pengambilan keputusan dan penerbitan sertifikat dilakukan dalam waktu yang wajar sesuai ketentuan yang berlaku.', 9, 1),
(11, 'SP', 'Sertifikat/dokumen hasil sertifikasi yang diterbitkan memiliki informasi yang jelas dan sesuai dengan ruang lingkup yang disetujui.', 10, 1),
(12, 'SP', 'Penanganan keluhan, keberatan, atau permintaan klarifikasi dilayani dengan baik apabila diperlukan.', 11, 1),
(13, 'SP', 'Kerahasiaan informasi dan data perusahaan kami dijaga dengan baik selama proses sertifikasi.', 12, 1),
(14, 'SP', 'Secara keseluruhan, saya puas terhadap layanan sertifikasi produk yang diberikan PSU.', 13, 1),
(15, 'LAB', 'Informasi mengenai jenis pengujian, metode, persyaratan sampel, biaya, dan estimasi waktu penyelesaian disampaikan dengan jelas.', 0, 1),
(16, 'LAB', 'Proses permintaan layanan dan administrasi pengujian mudah dilakukan.', 1, 1),
(17, 'LAB', 'Petugas memberikan arahan yang jelas mengenai jumlah, kondisi, pengemasan, dan penyerahan sampel.', 2, 1),
(18, 'LAB', 'Proses penerimaan, identifikasi, dan pencatatan sampel dilakukan dengan tertib dan jelas.', 3, 1),
(19, 'LAB', 'Petugas laboratorium memberikan respons terhadap pertanyaan atau permintaan informasi secara cepat dan membantu.', 4, 1),
(20, 'LAB', 'Petugas memberikan pelayanan secara profesional, sopan, dan kompeten.', 5, 1),
(21, 'LAB', 'Sampel pelanggan ditangani dan disimpan dengan baik selama proses pengujian sesuai ketentuan yang berlaku.', 6, 1),
(22, 'LAB', 'Pelaksanaan pengujian dan penyampaian status pekerjaan dilakukan sesuai estimasi waktu yang diinformasikan.', 7, 1),
(23, 'LAB', 'Apabila terjadi perubahan jadwal atau kendala, informasi disampaikan kepada pelanggan dengan jelas dan tepat waktu.', 8, 1),
(24, 'LAB', 'Laporan Hasil Uji (LHU) disajikan dengan jelas, lengkap, dan mudah dipahami.', 9, 1),
(25, 'LAB', 'Informasi hasil pengujian pada LHU sesuai dengan sampel dan parameter yang diminta.', 10, 1),
(26, 'LAB', 'LHU diterbitkan dan disampaikan dalam waktu yang sesuai dengan kesepakatan layanan.', 11, 1),
(27, 'LAB', 'Kerahasiaan informasi, data pelanggan, dan hasil pengujian dijaga dengan baik.', 12, 1),
(28, 'LAB', 'Penanganan keluhan atau permintaan klarifikasi atas layanan/hasil pengujian dilayani dengan baik apabila diperlukan.', 13, 1),
(29, 'LAB', 'Secara keseluruhan, saya puas terhadap layanan Laboratorium Pengujian PSU.', 14, 1),
(30, 'KAL', 'Informasi mengenai ruang lingkup kalibrasi, kemampuan layanan, persyaratan alat, biaya, dan estimasi waktu penyelesaian disampaikan dengan jelas.', 0, 1),
(31, 'KAL', 'Proses permintaan layanan dan administrasi kalibrasi mudah dilakukan.', 1, 1),
(32, 'KAL', 'Petugas memberikan informasi yang jelas mengenai persiapan, pengiriman, dan penerimaan alat yang akan dikalibrasi.', 2, 1),
(33, 'KAL', 'Proses penerimaan, identifikasi, dan pencatatan alat dilakukan dengan tertib dan jelas.', 3, 1),
(34, 'KAL', 'Petugas laboratorium memberikan respons terhadap pertanyaan atau permintaan informasi secara cepat dan membantu.', 4, 1),
(35, 'KAL', 'Petugas memberikan pelayanan secara profesional, sopan, dan kompeten.', 5, 1),
(36, 'KAL', 'Alat pelanggan ditangani, disimpan, dan dikembalikan dalam kondisi yang baik sesuai ketentuan layanan.', 6, 1),
(37, 'KAL', 'Pelaksanaan kalibrasi dilakukan sesuai jadwal/estimasi waktu yang telah diinformasikan.', 7, 1),
(38, 'KAL', 'Apabila terjadi perubahan jadwal atau kendala, informasi disampaikan kepada pelanggan dengan jelas dan tepat waktu.', 8, 1),
(39, 'KAL', 'Sertifikat Kalibrasi disajikan dengan jelas, lengkap, dan mudah dipahami.', 9, 1),
(40, 'KAL', 'Identitas alat, hasil kalibrasi, satuan, dan informasi ketidakpastian pengukuran pada sertifikat sesuai dan mudah ditelusuri.', 10, 1),
(41, 'KAL', 'Sertifikat Kalibrasi diterbitkan dan disampaikan dalam waktu yang sesuai dengan kesepakatan layanan.', 11, 1),
(42, 'KAL', 'Kerahasiaan informasi, data pelanggan, dan hasil kalibrasi dijaga dengan baik.', 12, 1),
(43, 'KAL', 'Penanganan keluhan atau permintaan klarifikasi atas layanan/hasil kalibrasi dilayani dengan baik apabila diperlukan.', 13, 1),
(44, 'KAL', 'Secara keseluruhan, saya puas terhadap layanan Laboratorium Kalibrasi PSU.', 14, 1);

SET FOREIGN_KEY_CHECKS = 1;
