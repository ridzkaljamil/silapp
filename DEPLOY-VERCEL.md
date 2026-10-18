# Deploy SILAPP ke Vercel (demo)

Vercel dipakai untuk demo online. Kodenya sama dengan yang dipasang di cPanel dan di komputer, dari repo yang sama (`silapp`). Perbedaannya hanya pada pengaturan di Vercel.

Cara kerjanya:
- API berjalan sebagai fungsi Vercel (`api/index.js`), halaman React disajikan dari `client/dist`.
- Database memakai MySQL di server lain (mis. VPS/cPanel), karena Vercel tidak menyediakan MySQL.
- File unggahan disimpan di Vercel Blob privat bila `BLOB_READ_WRITE_TOKEN` terisi. File hanya bisa diunduh lewat aplikasi setelah login.
- Batas ukuran per file di Vercel 4 MB (di komputer dan cPanel 10 MB).
- Tugas terjadwal (pengingat & kirim ulang email) dijalankan Vercel Cron setiap hari pukul 07.00 WIB lewat `/api/cron`.

## Repo: cukup satu

Hubungkan Vercel langsung ke repo `silapp`. Tidak perlu repo terpisah, karena:
- setiap perbaikan cukup di-push sekali, lalu demo di Vercel ikut diperbarui otomatis;
- pengaturan rahasia (database, token) ada di Vercel, bukan di repo.

Jika ingin demo tidak langsung berubah setiap push, buat branch `demo` lalu atur **Settings → Git → Production Branch** ke `demo`. Demo baru diperbarui saat `main` digabung ke `demo`.

Repo `silapp-demo` yang lama tidak dipakai lagi; boleh di-archive atau dihapus setelah project Vercel dipindah ke repo `silapp`.

## 1. Database

1. Siapkan database MySQL yang bisa diakses dari internet (mis. cPanel → MySQL Databases): buat database dan user dengan kata sandi kuat, beri ALL PRIVILEGES.
2. cPanel → **Remote MySQL**: tambahkan host `%` (Vercel tidak punya IP tetap).
3. Pastikan port 3306 terbuka di firewall server database.

Gunakan database terpisah dari database produksi cPanel, karena data demo akan di-reset.

## 2. Project Vercel

1. Vercel → **Add New → Project** → impor repo `silapp`. Framework Preset biarkan **Other**; pengaturan build sudah ada di `vercel.json`.
   Jika sebelumnya sudah ada project yang terhubung ke `silapp-demo`: buka project itu → **Settings → Git** → **Disconnect**, lalu **Connect Git Repository** ke `silapp`.
2. Tab **Storage → Create → Blob**, pilih akses **Private**, lalu hubungkan ke project ini. Cek **Settings → Environment Variables**: harus ada `BLOB_READ_WRITE_TOKEN`.
3. **Settings → Environment Variables**, tambahkan:

   | Nama | Isi |
   |---|---|
   | `JWT_SECRET` | teks acak panjang |
   | `CLIENT_URL` | alamat demo, mis. `https://silapp-demo.vercel.app` (dipakai di tautan email) |
   | `DB_HOST`, `DB_PORT` | alamat server database dan `3306` |
   | `DB_USER`, `DB_PASS`, `DB_NAME` | user, sandi, dan nama database |
   | `DB_SSL` | `true` (kosongkan jika MySQL tidak mendukung SSL) |
   | `DB_SSL_STRICT` | `false` |
   | `DB_POOL_LIMIT` | `3` |
   | `CRON_SECRET` | teks acak panjang (Vercel memakainya otomatis untuk memanggil `/api/cron`) |
   | `SMTP_*`, `MAIL_FROM` | opsional; tanpa ini email tidak dikirim, notifikasi lonceng tetap jalan |

   Lupa kata sandi lewat email hanya berfungsi bila `SMTP_*` diisi.

## 3. Isi data demo (dari komputer)

1. Salin `server/env.example` menjadi `server/.env.demo`. Isi `DB_*`, `DB_SSL`, `DB_SSL_STRICT` sama dengan di Vercel, dan `BLOB_READ_WRITE_TOKEN` dengan token Blob store tadi.
2. Dari folder utama project:
   ```
   npm run db:reset:demo
   ```
   Perintah ini membuat tabel, akun demo (kata sandi `password123`), pengajuan contoh, dan mengunggah file contoh ke Blob. File `.env.demo` tidak ikut ke GitHub.

## 4. Deploy

**Deployments → … → Redeploy** agar halaman dibangun ulang dengan Blob aktif. Fungsi API berjalan di region Singapura (`sin1`).

Cek:
- `https://<domain-vercel>/api/health` harus menampilkan `"ok":true` dan `"storage":"blob"`.
- **Settings → Cron Jobs** menampilkan `/api/cron` terjadwal harian.
- Jika aplikasi menampilkan "Database sedang tidak dapat dihubungi", periksa langkah 1 dan isian `DB_*`.

## Setelah demo selesai

Hapus project di Vercel dan Blob store, lalu hapus database demo dan host `%` di Remote MySQL.
