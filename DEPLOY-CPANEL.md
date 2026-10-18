# Deploy SILAPP ke cPanel (Jagoan Hosting)

Panduan ini memasang SILAPP di subdomain, misalnya `silapp.penilaistandaruji.com`, memakai menu **Setup Node.js App** di cPanel. Satu aplikasi Node.js melayani API sekaligus tampilan React, jadi tidak perlu memasang frontend terpisah.

Contoh di bawah memakai nama akun cPanel `akuncpanel`. Ganti dengan nama akun kamu (terlihat di pojok kanan atas cPanel dan di depan nama database).

## Gambaran susunan folder di server

```
/home/akuncpanel/
└─ silapp/                    hasil ekstrak silapp-cpanel.zip (di luar public_html)
   ├─ server/                 Application root di Setup Node.js App
   │  ├─ src/index.js         Application startup file
   │  ├─ database/silapp-init.sql
   │  ├─ uploads/             berkas unggahan pelanggan (wajib ikut dibackup)
   │  └─ .env                 pengaturan server (dibuat sendiri dari env.example)
   └─ client/dist/            hasil build React
```

Folder `silapp` sengaja diletakkan di luar `public_html` agar file `.env` dan berkas unggahan tidak bisa dibuka langsung dari browser.

## A. Siapkan paket di komputer

Lakukan di folder project `C:\xampp\htdocs\silapp` lewat PowerShell atau terminal VS Code.

1. Pastikan dependensi sudah terpasang (cukup sekali): `npm install`
2. Jalankan pengujian dulu agar yang di-upload sudah teruji: `npm test`
3. Buat paket: `npm run pack:cpanel -- https://silapp.penilaistandaruji.com`
   (alamat di belakang `--` dipakai untuk gambar pratinjau saat tautan SILAPP dibagikan; boleh dikosongkan)
4. Hasilnya ada di `deploy\silapp-cpanel.zip`.

File `server/database/silapp-init.sql` sudah tersedia di paket. Buat ulang dengan `npm run db:sql` hanya jika data master (layanan, harga, ruang lingkup, form, survei) di `seed.js` diubah. Perintah itu butuh MySQL XAMPP menyala dan `DB_USER=root` di `server/.env` komputer.

## B. Pemasangan pertama di cPanel

### 1. Subdomain dan SSL

1. cPanel → **Domains** → **Create A New Domain**, isi `silapp.penilaistandaruji.com`. Hilangkan centang "Share document root" bila ada; folder document root biarkan sesuai bawaan (bukan folder `silapp`).
2. Jika DNS domain dikelola di luar Jagoan Hosting, tambahkan A record `silapp` yang mengarah ke IP server hosting.
3. cPanel → **SSL/TLS Status** → centang subdomain tadi → **Run AutoSSL**. Tunggu sampai bergembok hijau.
4. Kembali ke **Domains**, aktifkan **Force HTTPS Redirect** untuk subdomain tersebut.

### 2. Database

1. cPanel → **MySQL® Databases**.
2. Buat database baru, misalnya `silapp` (nama lengkapnya menjadi `akuncpanel_silapp`).
3. Buat user database baru dengan kata sandi kuat (pakai Password Generator), misalnya `silapp` (menjadi `akuncpanel_silapp`). Simpan kata sandinya.
4. Di bagian **Add User To Database**, pasangkan user dan database tadi, centang **ALL PRIVILEGES**.
5. cPanel → **phpMyAdmin** → klik database `akuncpanel_silapp` di kiri → tab **Import** → pilih `silapp-init.sql` (ambil dari `server\database\` di komputer) → **Import**.
6. Pastikan muncul 30 tabel. Database ini berisi data master saja, tanpa akun dan tanpa data contoh.

### 3. Upload file aplikasi

1. cPanel → **File Manager** → buka folder home (`/home/akuncpanel`, bukan `public_html`).
2. **Upload** `silapp-cpanel.zip`, lalu klik kanan → **Extract** ke `/home/akuncpanel`. Akan muncul folder `silapp`.
3. Hapus file zip setelah diekstrak.
4. Klik **Settings** (kanan atas File Manager) → centang **Show Hidden Files (dotfiles)**.
5. Buka `silapp/server`, salin `env.example` menjadi `.env` (klik kanan → Copy, beri nama `.env`), lalu **Edit** dan isi:

| Isian | Nilai |
|---|---|
| `CLIENT_URL` | `https://silapp.penilaistandaruji.com` (tanpa `/` di akhir) |
| `TRUST_PROXY` | `1` |
| `JWT_SECRET` | teks acak panjang yang baru, minimal 32 karakter |
| `DB_NAME`, `DB_USER`, `DB_PASS` | dari langkah database di atas |
| `SMTP_*`, `MAIL_FROM` | akun email dari langkah 5 di bawah |
| `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` | email dan kata sandi (minimal 8 karakter) untuk akun Super Admin pertama |

Nilai yang mengandung tanda `#` atau spasi wajib diapit tanda kutip ganda, misalnya `DB_PASS="Ab#12cd!"`. Kata sandi dari Password Generator cPanel sering memuat `#`; tanpa kutip, teks setelah `#` dianggap komentar dan kata sandi terbaca terpotong.

### 4. Setup Node.js App

1. cPanel → **Setup Node.js App** → **Create Application**.
2. Isi:
   - **Node.js version**: 20.x (atau versi tertinggi yang tersedia, minimal 18)
   - **Application mode**: Production
   - **Application root**: `silapp/server`
   - **Application URL**: pilih `silapp.penilaistandaruji.com`, kolom path dikosongkan
   - **Application startup file**: `src/index.js`
3. Klik **Create**.
4. Setelah aplikasi terbuat, klik **Run NPM Install** dan tunggu sampai selesai.
5. Klik **Restart**.
6. Buka `https://silapp.penilaistandaruji.com`. Halaman beranda SILAPP harus tampil.

Saat pertama menyala, server otomatis menyalin tiga template surat berkop PSU ke folder `uploads`, mengisi identitas invoice, dan membuat akun Super Admin dari `.env`.

### 5. Email notifikasi

1. cPanel → **Email Accounts** → **Create**, misalnya `no-reply@penilaistandaruji.com`.
2. Klik **Connect Devices** pada akun itu untuk melihat pengaturan SMTP (biasanya server `mail.penilaistandaruji.com`, port 465, SSL).
3. Isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, dan `MAIL_FROM` di `.env`, lalu **Restart** aplikasi.

Selama `SMTP_HOST` kosong, email tidak terkirim dan isinya hanya dicatat di log server. Fitur **Lupa kata sandi** juga membutuhkan email ini.

Semua email tercatat di menu **Log Email** (Super Admin). Email yang gagal dicoba ulang otomatis oleh tugas terjadwal (langkah 6).

### 6. Tugas terjadwal (Cron Jobs)

Pengingat sertifikat akan berakhir, proforma invoice jatuh tempo, batas waktu temuan, dan kirim ulang email gagal dijalankan oleh `npm run jobs`. Selama aplikasi menyala, tugas ini juga berjalan sendiri setiap 30 menit, tetapi aplikasi Node di cPanel bisa "tidur" saat tidak ada pengunjung. Karena itu pasang juga Cron Job harian:

1. Buka **Setup Node.js App** → aplikasi SILAPP. Di bagian atas ada perintah "Enter to the virtual environment", kurang lebih:
   `source /home/akuncpanel/nodevenv/silapp/server/20/bin/activate && cd /home/akuncpanel/silapp/server`
   Salin perintah itu persis seperti yang tampil.
2. cPanel → **Cron Jobs** → **Add New Cron Job**:
   - **Common Settings**: Once Per Day, lalu ubah **Hour** ke `6` (pagi, jam server).
   - **Command**: perintah dari langkah 1, lalu tambahkan ` && npm run jobs >> /home/akuncpanel/silapp/server/jobs.log 2>&1`
     Contoh lengkap:
     ```
     source /home/akuncpanel/nodevenv/silapp/server/20/bin/activate && cd /home/akuncpanel/silapp/server && npm run jobs >> /home/akuncpanel/silapp/server/jobs.log 2>&1
     ```
3. Simpan. Keesokan harinya buka `silapp/server/jobs.log`: harus ada baris `[tugas] ...` berisi ringkasan.

Tugas harian hanya jalan sekali per hari dan pengingat yang sama tidak pernah terkirim dua kali, jadi aman walau dipicu dari dua tempat.

### 7. Masuk pertama kali

1. Masuk dengan `SUPERADMIN_EMAIL` dan `SUPERADMIN_PASSWORD`.
2. Setelah berhasil, edit `.env`: kosongkan nilai `SUPERADMIN_PASSWORD` (menjadi `SUPERADMIN_PASSWORD=`), lalu **Restart** aplikasi.
3. Lewat menu SILAPP, periksa dan sesuaikan:
   - **Kelola Layanan** → Pengaturan Umum: identitas invoice (NPWP, alamat, rekening, penanda tangan) dan kontak layanan.
   - **Pengguna Internal**: buat akun Admin per bidang (Sertifikasi Produk, Lab Pengujian, Lab Kalibrasi).
   - **Kelola Layanan** → Master Layanan: isi **Target SLA (hari)** untuk tahap yang punya target. Pengajuan yang melewatinya ditandai di Antrean dan Dashboard.
   - **Data Sertifikat**: masukkan sertifikat lama yang perlu tampil di Directory, beserta tanggal berakhirnya (dipakai untuk pengingat).
4. Coba alur singkat: buat akun pelanggan percobaan lewat **Akun Pelanggan** (kata sandi sementara terkirim ke emailnya), masuk sebagai pelanggan dan ajukan layanan, lalu proses dari akun Admin. Setelah selesai, nonaktifkan akun percobaan.

## C. Memperbarui aplikasi

1. Di komputer: `npm test`, lalu `npm run pack:cpanel -- https://silapp.penilaistandaruji.com`.
2. Di cPanel: **Setup Node.js App** → **Stop App** (opsional, agar tidak ada yang sedang mengunggah saat file diganti).
3. **File Manager** → hapus folder `silapp/client/dist` yang lama, upload zip baru ke `/home/akuncpanel`, lalu **Extract** dan timpa file yang ada.
   ZIP tidak berisi `.env` maupun isi `uploads`, jadi pengaturan dan berkas pelanggan tidak tertimpa.
4. Jika `server/package.json` berubah (ada pustaka baru), klik **Run NPM Install**.
5. Klik **Restart** (atau **Start App**).

Jangan import `silapp-init.sql` lagi ke database yang sudah berjalan. Perubahan struktur database dijalankan otomatis saat aplikasi menyala.

## D. Backup

- **Database**: phpMyAdmin → database SILAPP → **Export** → Quick → SQL, atau lewat menu **Backup** cPanel.
- **Berkas**: folder `silapp/server/uploads` (dokumen pelanggan, bukti bayar, sertifikat/LHU, foto profil, template). Kompres lewat File Manager lalu unduh.
- Simpan juga salinan `silapp/server/.env` di tempat aman.

Lakukan backup rutin, minimal seminggu sekali, dan sebelum setiap pembaruan.

## E. Jika ada masalah

| Gejala | Yang diperiksa |
|---|---|
| Situs menampilkan error / "Incomplete response" | Log di `silapp/server/stderr.log`. Penyebab umum: `.env` belum ada, `JWT_SECRET` kosong, atau **Run NPM Install** belum dijalankan. |
| Pesan "Database sedang tidak dapat dihubungi" | `DB_NAME`, `DB_USER`, `DB_PASS` di `.env` (kutip ganda bila ada `#`), dan user sudah ditambahkan ke database dengan ALL PRIVILEGES. |
| Tidak bisa masuk sebagai Super Admin | Log saat start: cari baris yang diawali `!` tentang `SUPERADMIN_*`. Isi `.env` lalu restart. |
| Email tidak terkirim | Menu **Log Email** menampilkan status dan penyebab gagalnya. Periksa pengaturan `SMTP_*`; coba port 587 dengan `SMTP_SECURE=false` jika 465 diblokir. Setelah diperbaiki dan di-restart, kirim ulang dari Log Email. |
| Pengingat tidak terkirim | Isi `silapp/server/jobs.log` dan pengaturan Cron Job (langkah 6). Sertifikat lama perlu tanggal berakhir yang benar. |
| Pesan "File terlalu besar untuk diterima server" | Batas ukuran unggahan di web server hosting lebih kecil dari 10 MB per file. Minta support Jagoan Hosting menaikkan batas request body, atau kecilkan file. |
| Pengguna tiba-tiba keluar dengan pesan "Kata sandi akun ini sudah diganti" | Normal: kata sandi akun itu diganti/di-reset di tempat lain, sehingga sesi lama ditutup. |
| Template surat tidak bisa diunduh | Folder `silapp/server/uploads` harus ada dan bisa ditulis (permission 755). |
| Perubahan `.env` tidak berpengaruh | Setiap mengubah `.env`, klik **Restart** di Setup Node.js App. |

Perintah `npm run db:reset` dan `npm run db:init` sengaja ditolak di server produksi karena menghapus seluruh data.
