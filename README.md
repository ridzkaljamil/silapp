# SILAPP

**Sistem Informasi Layanan dan Tracking Pengujian Produk** untuk PT Penilai Standar Uji.

SILAPP digunakan pelanggan untuk mengajukan layanan dan memantau status pengajuan secara daring, sedangkan Admin dan Super Admin memakainya untuk memproses pengajuan, mengelola data, dan mencatat setiap perubahan status.

Layanan yang didukung: Sertifikasi Produk (LSPro, termasuk alur khusus skema Tipe 1b), Laboratorium Pengujian (Kimia, Fisika, Mikrobiologi), dan Laboratorium Kalibrasi. Riwayat perubahan ada di [CHANGELOG.md](CHANGELOG.md).

## Fitur

- **Publik:** lacak status pengajuan dengan kode lacak (tanpa login) dan informasi layanan beserta ruang lingkupnya.
- **Pelanggan:** mengajukan layanan, mengunduh template dokumen berkop PSU, membatalkan pengajuan yang belum diproses lalu mengajukan ulang (juga untuk pengajuan yang ditutup PSU), mengunggah dokumen dan bukti bayar, mengunduh proforma invoice PDF, membalas permintaan tindakan, mengirim bukti perbaikan temuan (koreksi, akar penyebab, tindakan korektif) dan mengajukan perpanjangan, mengunduh sertifikat/LHU, mengisi survei kepuasan, dan melihat Directory sertifikat.
- **Admin:** antrean pengajuan per bidang, persetujuan tiap tahap, proforma invoice, verifikasi pembayaran, riwayat per tahap, temuan audit, parameter uji lab, akun pelanggan, dan dashboard.
- **Super Admin:** semua fitur Admin, ditambah pengguna internal, Kelola Layanan (detail & tahapan beserta target SLA, form pengajuan, ruang lingkup & harga, identitas invoice dan kontak), template dokumen, survei, data sertifikat, dan Log Email. Rekap survei kepuasan per layanan bisa diberi catatan tindak lanjut dan diekspor ke Excel/CSV.
- **Data sertifikat:** status Aktif/Ditangguhkan/Dicabut (Berakhir otomatis setelah lewat tanggal), alasan wajib saat ditangguhkan atau dicabut, riwayat perubahan, dan pilihan tampil di Directory. Sertifikat yang dicabut tidak bisa diunduh pelanggan.
- **Pengingat otomatis:** sertifikat akan berakhir (90 & 30 hari), proforma invoice jatuh tempo, dan batas waktu temuan. Pengajuan yang melewati target SLA tahap ditandai di Antrean dan Dashboard.
- **Akun:** lupa kata sandi lewat email, sesi di perangkat lain otomatis keluar setelah kata sandi diganti, peringatan bila NIB/NPWP pelanggan sudah dipakai akun lain.
- Notifikasi di aplikasi dan lewat email (dengan antrean & kirim ulang otomatis), konfirmasi sebelum setiap aksi penting, indikator "Sedang memproses…", pengaturan akun dengan foto profil, dan tampilan responsif untuk HP.

## Teknologi

- **Frontend:** React (Vite), Bootstrap 5, Axios
- **Backend:** Node.js, Express, JWT, bcrypt, Multer, Nodemailer, PDFKit (invoice), ExcelJS (ekspor survei)
- **Database:** MySQL 8 / MariaDB 10.6+

## Instalasi

Yang perlu disiapkan: Node.js 20 atau lebih baru dan MySQL/MariaDB (misalnya lewat XAMPP).

1. Nyalakan MySQL, lalu buat database:
   ```sql
   CREATE DATABASE silapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Salin `server/env.example` menjadi `server/.env`, lalu sesuaikan isinya (penjelasan setiap isian ada di file itu):
   ```
   DB_USER=root
   DB_PASS=
   JWT_SECRET=isi-dengan-teks-acak-panjang
   ```
3. Dari folder utama proyek, jalankan:
   ```bash
   npm install        # meng-install server dan client
   npm run db:reset   # membuat tabel dan data contoh (menghapus semua data lama)
   npm run dev        # API di :5000, web di :5173
   ```
4. Buka http://localhost:5173.

Database yang sudah berjalan tidak perlu di-reset saat memperbarui aplikasi: kolom dan data baru ditambahkan otomatis ketika server dinyalakan.

## Akun demo

Akun ini dibuat oleh `npm run db:reset` dan hanya untuk pengembangan atau demo. Kata sandi semua akun: `password123`

| Role | Email |
|---|---|
| Super Admin | superadmin@penilaistandaruji.com |
| Admin Sertifikasi Produk | budi@penilaistandaruji.com |
| Admin Lab Pengujian | sari@penilaistandaruji.com |
| Admin Lab Kalibrasi | andi@penilaistandaruji.com |
| Pelanggan | rina@sinarcontoh.co.id |

Contoh kode lacak: `SLP26-X2KD4M7A`, `SLP26-C7WD2KPM`, `SLP26-9RTE3LQW`.

## Konfigurasi email

Isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, dan `SMTP_PASS` di `server/.env`. Jika `SMTP_HOST` dikosongkan, email tidak dikirim dan isinya hanya ditampilkan di console server.

Setiap email dicatat di menu **Log Email** (Super Admin). Email yang gagal karena server email sibuk dicoba ulang otomatis hingga 5 kali dalam 3 hari, dan bisa dikirim ulang manual dari menu itu.

Contoh memakai Gmail: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=alamat@gmail.com`, dan `SMTP_PASS` diisi **App Password** (Akun Google → Keamanan → Verifikasi 2 Langkah → Sandi Aplikasi), bukan kata sandi Gmail biasa.

## Tugas terjadwal

Pengingat (sertifikat akan berakhir, proforma invoice jatuh tempo, batas waktu temuan) dan kirim ulang email gagal dijalankan oleh satu perintah:

```bash
npm run jobs
```

- Selama server menyala, tugas ini berjalan sendiri setiap 30 menit (atur dengan `JOBS_INTERVAL_MIN`, `0` untuk mematikan). Bagian harian hanya jalan sekali per hari dan pengingat yang sama tidak terkirim dua kali.
- cPanel: pasang juga di **Cron Jobs** sekali sehari, karena aplikasi Node di cPanel bisa "tidur" saat sepi (lihat [DEPLOY-CPANEL.md](DEPLOY-CPANEL.md)).
- Vercel: sudah diatur di `vercel.json` (setiap hari pukul 07.00 WIB) lewat alamat `/api/cron` yang dilindungi `CRON_SECRET`.

## Pengujian

```bash
npm test                 # semua pengujian API
npm test -- sertifikat   # hanya file uji yang namanya mengandung "sertifikat"
```

Pengujian memakai database terpisah `<DB_NAME>_test` (dibuat otomatis bila user MySQL boleh membuat database) dan folder sementara untuk file, sehingga data dan berkas asli tidak tersentuh. Email dan Vercel Blob dimatikan selama pengujian. File uji ada di `server/tests/`.

## Build dan deploy

```bash
npm install
npm run build   # membangun client ke client/dist
npm start       # Express menyajikan API dan client di satu port
```

Folder `server/uploads/` menyimpan dokumen unggahan, jadi pastikan folder itu dapat ditulis dan ikut dibackup.

Panduan lengkap: [DEPLOY-CPANEL.md](DEPLOY-CPANEL.md) untuk hosting cPanel (Jagoan Hosting) dan [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md) untuk Vercel. Keduanya memakai kode yang sama dari repo ini.

Sebelum dipakai di server resmi:

- **Jangan jalankan `npm run db:reset`** di server resmi. Perintah itu membuat data contoh dan akun dengan kata sandi `password123`.
- Isi `JWT_SECRET` dengan teks acak panjang yang baru, `CLIENT_URL` dengan alamat domain (https), dan `TRUST_PROXY=1` bila aplikasi berjalan di belakang cPanel atau Nginx.
- Gunakan email SMTP dari domain sendiri agar email notifikasi tidak masuk spam.

## Struktur folder

```
silapp/
├─ api/               pintu masuk fungsi Vercel
├─ client/            frontend React
│  └─ src/
│     ├─ components/  komponen bersama
│     ├─ pages/       halaman public, client (ajukan/ = langkah Ajukan Layanan), admin (layanan/ = Kelola Layanan), common
│     ├─ hooks/  lib/
│     └─ styles/
├─ scripts/           pack-cpanel.js (paket ZIP untuk cPanel)
├─ server/            backend Express
│  ├─ database/       schema.sql, seed, silapp-init.sql, data ruang lingkup & harga, template Word
│  ├─ src/
│  │  ├─ config/      koneksi & migrasi database, Super Admin pertama
│  │  ├─ jobs/        tugas terjadwal (pengingat, kirim ulang email)
│  │  ├─ routes/      endpoint API (superadmin/ per menu)
│  │  ├─ services/    logika bisnis (workflow/ per bagian alur)
│  │  └─ utils/       penyimpanan file, email, sertifikat, harga
│  ├─ tests/          pengujian otomatis (npm test)
│  ├─ uploads/        berkas unggahan (tidak ikut git)
│  └─ env.example     contoh pengaturan .env
└─ vercel.json        pengaturan hosting Vercel
```

## Pengembang

Team Tracking SILAPP · BBPVP Bekasi Batch 4 2026
