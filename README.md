# SILAPP · Prototype Iterasi 1

**Sistem Informasi Layanan dan Tracking Pengujian Produk** untuk PT Penilai Standar Uji.
Stack: **React (Vite) + Bootstrap 5 + Axios** · **Node.js + Express** · **MySQL** · JWT + RBAC · bcrypt · Multer · Nodemailer.

Alur status mengikuti tiga dokumen *Rancangan Sistem Tracking* perusahaan:

| Layanan | Status tracking | Catatan |
|---|---|---|
| Sertifikasi Produk (LSPro) | ST-01 s.d. ST-10 | ST-07 Tindakan perbaikan hanya jika ada ketidaksesuaian; Tipe 5 & Tipe 1B |
| Lab Kimia / Fisika / Mikrobiologi | LAB-01 s.d. LAB-08 | LAB-05 terkunci sampai semua parameter selesai |
| Lab Kalibrasi | KAL-01 s.d. KAL-09 | KAL-09 Pengembalian alat dilewati untuk kalibrasi on-site |

---

## 1. Kebutuhan

- Node.js 18 atau lebih baru (disarankan 20/22)
- MySQL 8 atau MariaDB 10.6+

## 2. Menjalankan di komputer lokal (Windows + XAMPP)

> Jalankan semua perintah dari folder induk proyek, mis. `C:\xampp\htdocs\silapp`.
> Folder ini **tidak** dijalankan oleh Apache; aplikasi berjalan lewat Node.js. XAMPP hanya dipakai untuk MySQL.

1. **Nyalakan MySQL** di XAMPP Control Panel (klik *Start* pada MySQL).
2. **Buat database** lewat phpMyAdmin (`http://localhost/phpmyadmin`) → tab SQL:
   ```sql
   CREATE DATABASE silapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. **Siapkan `.env`**: salin `server\.env.example` menjadi `server\.env`, lalu untuk XAMPP isi:
   ```
   DB_USER=root
   DB_PASS=
   JWT_SECRET=isi-dengan-teks-acak-panjang
   ```
4. **Install, isi database, jalankan** (dari folder induk):
   ```bash
   npm install          # otomatis meng-install server/ dan client/
   npm run db:reset     # membuat tabel + data awal (menghapus data lama!)
   npm run dev          # API :5000 dan web :5173 berjalan bersamaan
   ```
5. Buka **http://localhost:5173**.

Alternatif tanpa skrip induk: jalankan `npm install` dan `npm run dev` di folder `server`, lalu di terminal lain di folder `client`.

## 3. Akun demo
Semua kata sandi: **password123**

| Role | Email | Jabatan · Bidang |
|---|---|---|
| Super Admin | superadmin@penilaistandaruji.com | semua bidang |
| Admin | budi@penilaistandaruji.com | Admin Sertifikasi · Sertifikasi Produk |
| Admin | dewi@penilaistandaruji.com | Auditor · Sertifikasi Produk |
| Admin | sari@penilaistandaruji.com | Admin Lab · Lab Pengujian |
| Admin | tono@penilaistandaruji.com | Analis · Lab Pengujian |
| Admin | andi@penilaistandaruji.com | Admin Kalibrasi · Lab Kalibrasi |
| User | rina@sinarcontoh.co.id | PT Sinar Contoh Abadi |
| User | dimas@tanisubur.co.id | CV Tani Subur Persada |

Kode lacak contoh (tanpa login): `SLP-X2KD-4M7A`, `SLP-C7WD-2KPM`, `SLP-9RTE-3LQW`.

## 4. Email notifikasi
Isi `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` di `.env` dengan akun email cPanel (mis. `no-reply@penilaistandaruji.com`, port 465, SSL).
Jika `SMTP_HOST` kosong, isi email dicetak di console server (mode simulasi).

## 5. Deploy (VPS / cPanel)
```bash
npm install
npm run build        # menghasilkan client/dist
npm start            # Express menyajikan API + client/dist di satu port
```
- cPanel: buat **Setup Node.js App** dengan *Application root* = `server`, *startup file* = `src/index.js`, lalu atur variabel `.env` di panel.
- VPS: jalankan dengan `pm2 start src/index.js --name silapp` dan arahkan subdomain `silapp.penilaistandaruji.com` lewat reverse proxy ke `PORT`.
- Folder `server/uploads/` menyimpan dokumen; pastikan dapat ditulis dan ikut dibackup.

## 6. Struktur folder
```
silapp/
├─ server/
│  ├─ database/  schema.sql · seed.js · scope-data.js (ruang lingkup akreditasi)
│  └─ src/
│     ├─ config/db.js          koneksi pool MySQL (prepared statement)
│     ├─ middleware/auth.js    JWT + RBAC
│     ├─ services/workflow.js  logika alur status (setujui, minta tindakan, abaikan, tolak)
│     ├─ services/present.js   data untuk publik / pelanggan / admin (customer_visible)
│     └─ routes/               auth · public · applications · admin · superadmin
└─ client/
   └─ src/
      ├─ pages/public   Lacak, Layanan, Directory, Masuk, Daftar
      ├─ pages/client   Beranda, Ajukan (wizard), Pengajuan, Detail
      ├─ pages/admin    Dashboard, Antrean, Detail + aksi, Kelola pengguna, Master layanan
      └─ components     Stepper, Progress, StatusPill, ApplicationView, Layouts
```

## 7. Endpoint utama
| Method | Endpoint | Akses |
|---|---|---|
| POST | /api/auth/register · /api/auth/login | publik |
| GET | /api/public/services · /services/:code/scope · /track/:code · /directory | publik |
| GET/POST | /api/applications · /:id · /:id/reply · /:id/payment · /:id/certificate | user |
| GET | /api/admin/dashboard · /applications?status=&q= · /applications/:id | admin, superadmin |
| POST | /api/admin/applications/:id/action  (setujui \| minta_tindakan \| abaikan \| tolak) | admin, superadmin |
| PATCH | /api/admin/applications/:id/parameters/:pid | admin, superadmin |
| CRUD | /api/superadmin/users · /services · /steps | superadmin |

## 8. Batasan prototype iterasi 1
- 3 role login; jabatan dan bidang Admin dipakai untuk PIC & filter antrean, **belum** membatasi aksi per jabatan (independensi reviewer/decision maker hanya tercatat di audit trail).
- Harga parameter belum diisi; penawaran/invoice belum dihitung otomatis.
- Sub-status internal rinci, QR verifikasi sertifikat, notifikasi WhatsApp, surveilans, dan SLA otomatis (warning/overdue) belum diterapkan; kolom `sla_days` sudah tersedia.
- Ruang lingkup Lab Mikrobiologi dan Lab Kalibrasi masih contoh.
