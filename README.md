# SILAPP

**Sistem Informasi Layanan dan Tracking Pengujian Produk** untuk PT Penilai Standar Uji.

SILAPP digunakan pelanggan untuk mengajukan layanan dan memantau status pengajuan secara daring, sedangkan Admin dan Super Admin memakainya untuk memproses pengajuan, mengelola data, dan mencatat setiap perubahan status.

## Fitur

- **Publik:** lacak status pengajuan dengan kode lacak (tanpa login), informasi layanan, dan direktori.
- **Pelanggan:** mengajukan layanan, mengunggah dokumen dan bukti bayar, membalas permintaan tindakan atau temuan, mengunduh sertifikat/laporan, dan mengisi survei kepuasan.
- **Admin:** antrean pengajuan per bidang, persetujuan tiap tahap, invoice dan verifikasi pembayaran, temuan audit, parameter uji lab, akun pelanggan, dan dashboard.
- **Super Admin:** semua fitur Admin, ditambah pengguna internal, master layanan dan tahapan, form pengajuan, harga lab, survei, serta data sertifikat.
- Notifikasi email, pengaturan akun dengan foto profil, dan tampilan responsif untuk HP.

Status tracking per layanan:

| Layanan | Kode status |
|---|---|
| Sertifikasi Produk | ST-01 s.d. ST-10 |
| Lab Kimia / Fisika / Mikrobiologi | LAB-01 s.d. LAB-08 |
| Lab Kalibrasi | KAL-01 s.d. KAL-09 |

## Teknologi

- **Frontend:** React (Vite), Bootstrap 5, Axios
- **Backend:** Node.js, Express, JWT, bcrypt, Multer, Nodemailer
- **Database:** MySQL 8 / MariaDB 10.6+

## Instalasi

Yang perlu disiapkan: Node.js 18 atau lebih baru dan MySQL (misalnya lewat XAMPP).

1. Nyalakan MySQL, lalu buat database:
   ```sql
   CREATE DATABASE silapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Salin `server/.env.example` menjadi `server/.env`, lalu sesuaikan isinya:
   ```
   DB_USER=root
   DB_PASS=
   JWT_SECRET=isi-dengan-teks-acak-panjang
   ```
3. Dari folder utama proyek, jalankan:
   ```bash
   npm install        # meng-install server dan client
   npm run db:reset   # membuat tabel dan data awal (menghapus data lama)
   npm run dev        # API di :5000, web di :5173
   ```
4. Buka http://localhost:5173.

## Akun demo

Kata sandi semua akun: `password123`

| Role | Email |
|---|---|
| Super Admin | superadmin@penilaistandaruji.com |
| Admin Sertifikasi Produk | budi@penilaistandaruji.com |
| Admin Lab Pengujian | sari@penilaistandaruji.com |
| Admin Lab Kalibrasi | andi@penilaistandaruji.com |
| Pelanggan | rina@sinarcontoh.co.id |

Contoh kode lacak: `SLP-X2KD-4M7A`, `SLP-C7WD-2KPM`, `SLP-9RTE-3LQW`.

Pelanggan tidak bisa mendaftar sendiri. Akunnya dibuat oleh Admin lewat menu **Akun pelanggan**, dan kata sandi sementara wajib diganti saat login pertama.

## Konfigurasi email

Isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, dan `SMTP_PASS` di `server/.env`. Jika `SMTP_HOST` dikosongkan, email tidak dikirim dan isinya hanya ditampilkan di console server.

## Build dan deploy

```bash
npm install
npm run build   # membangun client ke client/dist
npm start       # Express menyajikan API dan client di satu port
```

Folder `server/uploads/` menyimpan dokumen unggahan, jadi pastikan folder itu dapat ditulis dan ikut dibackup.

## Struktur folder

```
silapp/
├─ client/            frontend React
│  └─ src/
│     ├─ components/  komponen bersama
│     ├─ pages/       halaman public, client, admin, common
│     ├─ hooks/  lib/
│     └─ styles/
└─ server/            backend Express
   ├─ database/       schema.sql dan seed
   ├─ uploads/        berkas unggahan (tidak ikut git)
   └─ src/            config, middleware, routes, services
```

## Pengembang

Ridzkal Jamil · Universitas Pelita Bangsa
