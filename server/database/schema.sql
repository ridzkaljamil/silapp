-- =========================================================
-- SILAPP · Sistem Informasi Layanan dan Tracking Pengujian Produk
-- PT Penilai Standar Uji · skema MySQL 8 / MariaDB 10.6+
-- =========================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS certificates, status_logs, payments, documents, samples, equipment,
  application_parameters, application_details, applications, product_parameters, products,
  service_steps, services, users;

SET FOREIGN_KEY_CHECKS = 1;

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
  nib_npwp      VARCHAR(40)  NULL,
  phone         VARCHAR(30)  NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

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
  sla_days            INT NULL,
  UNIQUE KEY uq_step (service_id, step_order),
  CONSTRAINT fk_steps_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB;

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
  CONSTRAINT fk_products_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Parameter uji per produk (add-on, harga boleh kosong)
CREATE TABLE product_parameters (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  name       VARCHAR(160) NOT NULL,
  method     VARCHAR(160) NULL,
  price      DECIMAL(14,2) NULL,
  CONSTRAINT fk_params_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Pengajuan / order layanan
CREATE TABLE applications (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  application_no     VARCHAR(30) NOT NULL UNIQUE,
  tracking_code      CHAR(13)    NOT NULL UNIQUE,
  user_id            INT NOT NULL,
  service_id         INT NOT NULL,
  product_id         INT NULL,
  product_label      VARCHAR(255) NOT NULL,
  current_step_order INT NOT NULL DEFAULT 1,
  status             ENUM('aktif','aksi','ditolak','selesai') NOT NULL DEFAULT 'aktif',
  application_type   VARCHAR(40) NULL,
  scheme             VARCHAR(20) NULL,
  location           ENUM('lab','onsite') NULL,
  nc_flag            TINYINT(1) NOT NULL DEFAULT 0,
  payment_status     ENUM('belum','menunggu','terverifikasi') NOT NULL DEFAULT 'belum',
  action_note        TEXT NULL,
  reject_note        TEXT NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_app_user    FOREIGN KEY (user_id)    REFERENCES users(id),
  CONSTRAINT fk_app_service FOREIGN KEY (service_id) REFERENCES services(id),
  CONSTRAINT fk_app_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

-- Isian form khusus per layanan (merek, model, alamat pabrik, batch Tipe 1B, dll.)
CREATE TABLE application_details (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  field_key      VARCHAR(60) NOT NULL,
  field_label    VARCHAR(120) NOT NULL,
  field_value    VARCHAR(500) NULL,
  CONSTRAINT fk_det_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Parameter yang dipilih + status per parameter (Lab Pengujian)
CREATE TABLE application_parameters (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  application_id  INT NOT NULL,
  parameter_id    INT NULL,
  name            VARCHAR(160) NOT NULL,
  method          VARCHAR(160) NULL,
  price_snapshot  DECIMAL(14,2) NULL,
  status          ENUM('antri','uji','selesai') NOT NULL DEFAULT 'antri',
  analyst_user_id INT NULL,
  updated_at      DATETIME NULL,
  CONSTRAINT fk_ap_app   FOREIGN KEY (application_id)  REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_ap_param FOREIGN KEY (parameter_id)    REFERENCES product_parameters(id),
  CONSTRAINT fk_ap_user  FOREIGN KEY (analyst_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

-- Sampel uji (Lab Pengujian)
CREATE TABLE samples (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  application_id    INT NOT NULL,
  description       VARCHAR(255) NOT NULL,
  quantity          INT NOT NULL DEFAULT 1,
  lab_sample_number VARCHAR(40) NULL,
  condition_note    VARCHAR(255) NULL,
  CONSTRAINT fk_smp_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Dokumen yang diunggah pelanggan / admin
CREATE TABLE documents (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  doc_type       VARCHAR(80) NOT NULL,
  original_name  VARCHAR(255) NOT NULL,
  file_path      VARCHAR(255) NOT NULL,
  uploaded_by    INT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_app  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_user FOREIGN KEY (uploaded_by)    REFERENCES users(id)
) ENGINE=InnoDB;

-- Pembayaran manual (bukti transfer)
CREATE TABLE payments (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  invoice_no     VARCHAR(40) NOT NULL,
  amount         DECIMAL(14,2) NULL,
  proof_path     VARCHAR(255) NULL,
  status         ENUM('menunggu','terverifikasi') NOT NULL DEFAULT 'menunggu',
  verified_by    INT NULL,
  verified_at    DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_app  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_pay_user FOREIGN KEY (verified_by)    REFERENCES users(id)
) ENGINE=InnoDB;

-- Audit trail / riwayat status (customer_visible membedakan info internal)
CREATE TABLE status_logs (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  application_id   INT NOT NULL,
  step_order       INT NOT NULL,
  status_code      VARCHAR(10) NOT NULL,
  step_name        VARCHAR(120) NOT NULL,
  action           ENUM('buat','mulai','setujui','minta_tindakan','tanggapan','abaikan','tolak','bayar','parameter','terbit') NOT NULL,
  note             TEXT NULL,
  customer_visible TINYINT(1) NOT NULL DEFAULT 1,
  pic_user_id      INT NULL,
  pic_label        VARCHAR(160) NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_app  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_log_user FOREIGN KEY (pic_user_id)    REFERENCES users(id)
) ENGINE=InnoDB;

-- Sertifikat / LHU yang terbit (sumber Directory publik)
CREATE TABLE certificates (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  application_id    INT NOT NULL UNIQUE,
  certificate_no    VARCHAR(60) NOT NULL UNIQUE,
  issued_at         DATE NOT NULL,
  expires_at        DATE NULL,
  file_path         VARCHAR(255) NULL,
  status            ENUM('active','suspended','expired','revoked') NOT NULL DEFAULT 'active',
  show_in_directory TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_cert_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB;
