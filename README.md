# SILAPP

**Sistem Informasi Layanan dan Tracking Pengujian Produk** untuk PT Penilai Standar Uji.

SILAPP digunakan pelanggan untuk mengajukan layanan dan memantau status pengajuan secara daring, sedangkan Admin dan Super Admin memakainya untuk memproses pengajuan, mengelola data, dan mencatat setiap perubahan status.

## Fitur

- **Publik:** lacak status pengajuan dengan kode lacak (tanpa login) dan informasi layanan beserta ruang lingkupnya.
- **Pelanggan:** mengajukan layanan, mengunduh template dokumen, membatalkan pengajuan yang belum diproses lalu mengajukan ulang, mengunggah dokumen dan bukti bayar, mengunduh invoice PDF, membalas permintaan tindakan atau temuan, mengunduh sertifikat/LHU, mengisi survei kepuasan, dan melihat Directory sertifikat.
- **Admin:** antrean pengajuan per bidang, persetujuan tiap tahap, invoice, verifikasi pembayaran, riwayat per tahap, temuan audit, parameter uji lab, akun pelanggan, dan dashboard.
- **Super Admin:** semua fitur Admin, ditambah pengguna internal, Kelola Layanan (detail & tahapan, form pengajuan, ruang lingkup & harga, identitas invoice dan kontak), template dokumen, survei, serta data sertifikat. Rekap survei kepuasan per layanan bisa diberi catatan tindak lanjut dan diekspor ke Excel/CSV.
- Notifikasi di aplikasi dan lewat email, pengaturan akun dengan foto profil, dan tampilan responsif untuk HP.

## Teknologi

- **Frontend:** React (Vite), Bootstrap 5, Axios
- **Backend:** Node.js, Express, JWT, bcrypt, Multer, Nodemailer, PDFKit (invoice), ExcelJS (ekspor survei)
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

Contoh kode lacak: `SLP26-X2KD4M7A`, `SLP26-C7WD2KPM`, `SLP26-9RTE3LQW`.

## Konfigurasi email

Isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, dan `SMTP_PASS` di `server/.env`. Jika `SMTP_HOST` dikosongkan, email tidak dikirim dan isinya hanya ditampilkan di console server.

Contoh memakai Gmail: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=alamat@gmail.com`, dan `SMTP_PASS` diisi **App Password** (Akun Google → Keamanan → Verifikasi 2 Langkah → Sandi Aplikasi), bukan kata sandi Gmail biasa.

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
│     ├─ pages/       halaman public, client, admin (layanan/ = Kelola Layanan), common
│     ├─ hooks/  lib/
│     └─ styles/
└─ server/            backend Express
   ├─ database/       schema.sql, seed, data ruang lingkup & harga, template Word
   ├─ uploads/        berkas unggahan (tidak ikut git)
   └─ src/            config, middleware, routes, services
```

## Pengembang

Ridzkal Jamil · Universitas Pelita Bangsa
