# Changelog

Semua perubahan penting pada SILAPP dicatat di file ini, dari commit pertama hingga versi terbaru.
Pengembangan dimulai 29 September 2026 sebagai bagian dari OJT di PT Penilai Standar Uji; commit pertama ke repository dilakukan 5 Oktober 2026.

Penomoran versi: angka pertama naik untuk rilis yang siap dipakai, angka kedua untuk penambahan fitur, angka ketiga untuk perbaikan dan dokumentasi.

## [2.0.0] – 2026-10-17

Rilis siap dipakai (live). Satu kode untuk komputer (XAMPP), cPanel, dan Vercel; perbedaannya hanya di pengaturan `.env`.

### Ditambahkan

- **Lupa kata sandi mandiri**: tautan "Lupa kata sandi?" di halaman Masuk mengirim tautan pembuatan kata sandi baru ke email (berlaku 30 menit, sekali pakai, disimpan dalam bentuk hash). Permintaan dibatasi agar tidak disalahgunakan, dan jawabannya sama untuk email terdaftar maupun tidak.
- **Sesi lama otomatis keluar** setelah kata sandi diganti pengguna, direset Admin, diganti Super Admin, atau dibuat ulang lewat email. Perangkat yang mengganti kata sandi tetap masuk; perangkat lain diarahkan ke halaman Masuk dengan keterangan.
- **Riwayat sertifikat** di Data Sertifikat: terbit, perubahan status, perubahan tanggal, dan tampil/tidak di Directory, lengkap dengan waktu dan petugas.
- Mengubah status sertifikat menjadi **Ditangguhkan atau Dicabut wajib disertai alasan**. Untuk sertifikat SILAPP, pelanggan menerima notifikasi dan email berisi alasannya; alasan juga tampil di detail pengajuan pelanggan.
- Pilihan **"Tampilkan di Directory publik"** per sertifikat (SILAPP maupun proyek sebelum SILAPP).
- **Pengingat otomatis** (tugas terjadwal):
  - sertifikat akan berakhir 90 dan 30 hari lagi, serta yang baru berakhir — ke pelanggan (email + notifikasi) dan Admin Sertifikasi Produk;
  - proforma invoice H-1 jatuh tempo dan yang sudah lewat;
  - batas waktu tindakan perbaikan temuan H-7 dan yang sudah lewat.
  Pengingat yang sama tidak pernah terkirim dua kali; bila tanggal diperpanjang, pengingat menyesuaikan.
- **Target SLA per tahap** kini dipakai: pengajuan yang melewati target ditandai "Lewat SLA n hari" di Antrean, detail pengajuan, dan panel baru di Dashboard. Hitungan berjalan hanya saat pengajuan ditangani PSU (berhenti saat menunggu pelanggan) dan tidak terlihat oleh pelanggan.
- Dashboard: panel **Sertifikat Akan Berakhir** (90 hari ke depan) untuk Super Admin dan Admin Sertifikasi Produk.
- **Antrean email & Log Email** (menu Super Admin): semua email dicatat, yang gagal dicoba ulang otomatis (maks. 5 kali dalam 3 hari) dan bisa dikirim ulang manual. Isi email dihapus setelah terkirim; email berisi kata sandi atau tautan reset tidak pernah disimpan isinya.
- Peringatan **data pelanggan ganda**: membuat atau mengubah akun pelanggan dengan NIB/NPWP yang sudah dipakai akun lain meminta konfirmasi dulu (mis. cabang dengan PIC berbeda tetap bisa disimpan terpisah).
- Pesan jelas saat file terlalu besar ditolak server/hosting (HTTP 413) dan saat koneksi ke server terputus; template dokumen dicek ukurannya sebelum diunggah.
- **Pengujian otomatis** `npm test`: 195 pemeriksaan API (alur end-to-end, sertifikat, kondisi bersamaan, akun & kata sandi, tugas terjadwal & email, instalasi baru). Memakai database `<DB_NAME>_test` dan folder sementara, sehingga data asli tidak tersentuh.
- Hosting cPanel (Jagoan Hosting): `npm run pack:cpanel` membuat ZIP siap upload, `server/database/silapp-init.sql` untuk import phpMyAdmin (dibuat ulang dengan `npm run db:sql`), `npm run db:init` untuk data master saja, akun Super Admin pertama dari `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD`, dan panduan `DEPLOY-CPANEL.md`.
- Hosting Vercel di repo yang sama: `api/index.js`, `vercel.json` (termasuk Vercel Cron harian), penyimpanan file di Vercel Blob bila `BLOB_READ_WRITE_TOKEN` terisi, dan panduan `DEPLOY-VERCEL.md`.
- Tugas terjadwal bisa dipicu tiga cara: otomatis tiap 30 menit selama server menyala, `npm run jobs` (Cron Jobs cPanel), atau `/api/cron` dengan `CRON_SECRET`.
- `server/env.example`: satu contoh pengaturan untuk komputer, cPanel, dan Vercel.

### Diubah

- Sertifikat yang **Dicabut tidak bisa diunduh pelanggan** (Admin tetap bisa membuka arsipnya) dan tidak dilampirkan di email. Sertifikat Ditangguhkan dan Berakhir tetap bisa diunduh dengan keterangan statusnya.
- Ganti kata sandi minimal 8 dan maksimal 72 karakter di semua tempat.
- Pembersihan rutin: log email lebih dari 90 hari, tautan reset kedaluwarsa, dan notifikasi terbaca lebih dari 180 hari.
- Data contoh (`npm run db:reset`) kini berisi riwayat awal sertifikat.
- Kode dirapikan tanpa mengubah tampilan: logika alur pengajuan dipecah per bagian (`services/workflow/`), rute Super Admin per menu (`routes/superadmin/`), dan halaman Ajukan Layanan per langkah (`pages/client/ajukan/`).
- File `.env` selalu dibaca dari folder `server`; `CLIENT_URL` dengan garis miring di akhir dirapikan otomatis; peringatan di log produksi bila SMTP belum diatur atau `CLIENT_URL` belum https.
- `npm run db:reset` dan `npm run db:init` ditolak saat `NODE_ENV=production`.

### Diperbaiki

- Dialog konfirmasi kedua yang muncul tepat setelah dialog pertama ditutup (mis. konfirmasi data ganda setelah "Buat Akun") ikut hilang sehingga proses tertahan.
- Saat sesi berakhir, pesan error tidak lagi sempat muncul sebelum halaman pindah ke Masuk.

### Dihapus

- `server/.env.example` dan `server/env.cpanel.example`, digantikan `server/env.example`.

## [1.2.0] – 2026-10-16

### Ditambahkan

- Masa berlaku sertifikat Sertifikasi Produk: saat "Setujui & terbitkan", Admin mengisi tanggal terbit (bawaan hari ini) dan tanggal berakhir (wajib). LHU lab dan sertifikat kalibrasi hanya memakai tanggal terbit.
- Kolom "Berlaku s.d." di Directory dan Data Sertifikat; tanggal berakhir juga tampil di detail pengajuan.
- Data Sertifikat: sertifikat yang terbit lewat SILAPP bisa diubah tanggal terbit, tanggal berakhir, dan statusnya.
- Tombol "Kembali ke Data Sertifikat" di halaman Directory (area admin).

### Diubah

- Status sertifikat menjadi Aktif, Ditangguhkan, dan Dicabut. Data lama berstatus "Tidak Aktif" otomatis menjadi Dicabut.
- Sertifikat yang melewati tanggal berakhir otomatis tampil sebagai "Berakhir", kecuali yang sudah Dicabut. Filter Directory dan Data Sertifikat mengikuti keempat status ini.
- Tanggal terbit tidak boleh melewati hari ini dan tanggal berakhir harus setelah tanggal terbit (berlaku juga untuk data proyek lama).
- Kelola Layanan → Form Pengajuan: pilihan layanan berupa sub-tab, sama seperti tab Ruang Lingkup & Harga.
- Data Sertifikat: alamat pabrik ditampilkan di bawah nama pabrik agar tabel tidak terlalu lebar.
- Detail pengajuan pelanggan menampilkan status sertifikat bila Ditangguhkan, Dicabut, atau Berakhir.

### Diperbaiki

- Tanggal dan jam selalu memakai WIB (aplikasi dan sesi database), sehingga waktu pengajuan, riwayat, nomor invoice, dan nomor pengajuan tidak bergeser 7 jam di server hosting yang memakai zona UTC.
- Nomor invoice tidak bisa kembar walau dua invoice diterbitkan pada saat bersamaan; klik ganda pada pengajuan yang sama tidak membuat dua invoice.
- Menghapus pengguna internal yang masih dirujuk data lain (mis. lampiran atau verifikasi pembayaran) kini menonaktifkan akun, bukan menampilkan error server.

## [1.1.1] – 2026-10-16

### Diubah

- README diperbarui: daftar layanan yang didukung, fitur terbaru, ketentuan invoice (rumus pajak, format nomor invoice, invoice lab), serta catatan penting sebelum dipasang di server resmi.

### Ditambahkan

- File CHANGELOG ini.

## [1.1.0] – 2026-10-16

Pembaruan berdasarkan masukan PT Penilai Standar Uji setelah demo, ditambah audit dan perbaikan menyeluruh.

### Ditambahkan

- Konfirmasi sebelum setiap aksi penting, dan indikator "Sedang memproses…" saat data dikirim atau file diunggah.
- Alur tahapan khusus skema **Tipe 1b** (8 tahap: tanpa audit dan tindakan perbaikan, tahap 5 Sampling, Review & Keputusan digabung).
- Isian **Nomor + Tanggal** (mis. B/L, Packing List, Invoice) yang bisa diisi lebih dari satu baris, dan pengaturan berkas yang disembunyikan untuk tipe skema tertentu.
- Nama produk yang ditulis pelanggan untuk produk di luar lingkup akreditasi KAN (Lab Kimia dan Lab Fisika).
- Bukti perbaikan temuan berisi Koreksi, Akar Penyebab Masalah, dan Tindakan Korektif; lampiran pada pengajuan perpanjangan.
- **Format invoice lab** (NO · PEKERJAAN · METODE · HARGA · QTY · JUMLAH HARGA), daftar Brand / Spesifikasi Produk yang diisi pelanggan saat pengajuan, serta baris pekerjaan / biaya tambahan pada invoice lab.
- Identitas invoice resmi PSU (NPWP, alamat, telepon, penanda tangan, rekening).
- **Kop surat PSU** pada tiga template dokumen (Surat Permohonan, Surat Kesediaan Surveillance, Surat Pernyataan Keaslian Dokumen).
- Isian nominal Rupiah yang hanya menerima angka dan tampil dengan titik ribuan.

### Diubah

- Judul invoice menjadi **PROFORMA INVOICE**.
- Format nomor invoice menjadi `001/PSU/KIM/X/2026`, dengan urutan dipisah per layanan.
- NIB dan NPWP pelanggan dipisah (juga di template dokumen); label alamat menjadi "Alamat Perusahaan (Sesuai NPWP)".
- Data perusahaan pelanggan hanya dapat diubah Admin; pelanggan mengubah nama penanggung jawab dan telepon.
- Warna status "Berjalan" menjadi hijau; header tabel invoice lab abu-abu seperti invoice Sertifikasi Produk.
- Harga paket lengkap SNI dikunci saat pengajuan dibuat, sama seperti harga per parameter.
- Email notifikasi dikirim di latar belakang sehingga aksi Admin dan pelanggan selesai lebih cepat.
- Lampiran bisa dibatalkan satu per satu (tombol ×); foto profil diperkecil sebelum diunggah.
- Pengajuan yang ditutup PSU dapat diajukan ulang dengan data sebelumnya.

### Diperbaiki

- Lingkaran nomor tahapan yang terpotong di bagian atas.
- Nama file unduhan tanpa ekstensi (bukti bayar) dan nama file berisi garis miring (nomor sertifikat).
- Pesan error unduhan yang hanya tampil "Terjadi kesalahan".
- Harga daftar lab yang terisi teks tersimpan sebagai Rp0.
- Antrean Admin tertahan oleh temuan yang sudah ditutup saat perpanjangannya masih diajukan.
- Produk di luar lingkup KAN dengan nama berbeda selalu dianggap pengajuan ganda.
- Tahap berjalan pada pengajuan yang dibatalkan masih tampil sebagai "Berjalan".
- Nama file berhuruf khusus (mis. "–", "é") rusak saat diunduh ulang.
- Nomor sertifikat dapat sama dengan sertifikat lama di Directory; file sertifikat kini wajib PDF.
- Login gagal karena spasi atau huruf besar pada email.
- Isian form pengajuan publik yang tidak mengikuti aturan tampil (show_when).

### Dihapus

- Rute pengalihan lama yang tidak dipakai lagi dan dokumen `DESIGN.md` yang sudah usang.

## [1.0.0] – 2026-10-14

Perbaikan hasil pengujian internal, invoice format PSU, paket LSPro + Lab, dan audit menyeluruh. Versi ini yang didemokan kepada PT Penilai Standar Uji (dipasang sebagai salinan demo terpisah di Vercel).

### Ditambahkan

- **Invoice PDF format PSU**: identitas perusahaan, data pelanggan, tabel pekerjaan, DPP nilai lain, PPN 12%, PPh 23 opsional, Grand Total, terbilang, detail pembayaran, dan tanda tangan. Admin mengisi baris pekerjaan (jumlah × harga satuan); nomor invoice berurutan per tahun.
- **Paket Sertifikasi Produk + Pengujian Laboratorium PSU** dalam satu invoice (jumlah sampel = jumlah merek).
- **Daftar harga lab** per produk dan parameter: opsi Reguler/Ekspress (Lab Kimia) dan Dalam/Luar Negeri (Lab Fisika), harga paket "parameter lengkap sesuai SNI", parameter lainnya yang harganya dikonfirmasi PSU, dan perkiraan biaya di form pengajuan.
- Menu **Kelola Layanan** (Super Admin) dengan tab Detail Layanan & tahapan (termasuk target SLA), Form Pengajuan (urutan isian dan berkas bisa digeser), Ruang Lingkup & Harga, dan Pengaturan Umum (kontak PSU dan identitas invoice).
- Layanan **Lembaga Sistem Manajemen Mutu** (status persiapan) dengan tahapan LSM-01 s.d. LSM-09.
- **Template dokumen Word** (Surat Permohonan, Surat Kesediaan Surveillance, Surat Pernyataan Keaslian Dokumen) yang dapat diunduh dan diganti Super Admin.
- **Draft pengajuan** tersimpan di server sehingga bisa dilanjutkan dari perangkat lain.
- Pelanggan dapat **membatalkan** pengajuan yang belum diproses lalu **mengajukan ulang** dengan data sebelumnya; peringatan bila produk/alat yang sama masih berjalan.
- **Notifikasi di aplikasi** (ikon lonceng) untuk pelanggan dan tim PSU, dengan pembaruan halaman otomatis.
- **Pencarian cepat** di bilah atas (pengajuan, layanan, pelanggan).
- Survei kepuasan **per layanan** dengan teks pembuka, catatan tindak lanjut, dan ekspor rekap ke Excel/CSV.
- Kode sampel lab diisi Admin saat sampel diregistrasi; riwayat per tahap dan lampiran PSU per tahap.
- Daftar data dengan kolom cari, filter, dan halaman (pagination); dashboard dengan grafik pengajuan 3/6/12 bulan.
- Kontak WhatsApp dan email PSU di halaman publik, halaman masuk, dan email.

### Diubah

- Format kode lacak menjadi `SLP26-XXXXXXXX`; kode format lama tetap bisa dipakai.
- Tahapan laboratorium pengujian disusun ulang menjadi LAB-01 s.d. LAB-07; LHU terbit = pengajuan selesai.
- Ruang lingkup Sertifikasi Produk dikelompokkan per kategori, ruang lingkup lab mengikuti data akreditasi terbaru.
- Dokumen persyaratan Sertifikasi Produk diperbarui; ketiga surat template wajib untuk semua jenis permohonan.
- Logo PSU diperkecil ukuran filenya.

### Teknis

- Pembatasan percobaan login (8 kali gagal per 15 menit), header keamanan dasar, dan dukungan reverse proxy.
- Server berhenti dengan rapi saat di-restart; file unggahan yang gagal diproses dihapus otomatis.
- Build produksi lebih ringan: CSS Bootstrap yang tidak dipakai dibuang dan pustaka utama dipisah ke berkas tersendiri.
- Pembaruan database otomatis saat server dinyalakan, sehingga database lama tidak perlu di-reset.

## [0.3.0] – 2026-10-08

Perapian struktur kode tanpa mengubah tampilan.

### Diubah

- Halaman Admin dan pelanggan dipecah per halaman (Dashboard, Antrean, Detail Pengajuan, Akun Pelanggan, Data Sertifikat, Form Builder, Harga Lab, Master, Pengguna, Survei, Beranda, Daftar & Detail Pengajuan, Survei pelanggan).
- Form di detail pengajuan Admin (invoice, temuan, info lab) dipisah ke komponen sendiri.
- Komponen UI dipecah menjadi tampilan, umpan balik, overlay, dan form; gaya CSS dipecah menjadi base, layout, components, pages, dan motion.
- Animasi dilengkapi (muncul saat di-scroll dan transisi halaman); README diperbarui.

## [0.2.0] – 2026-10-08

Prototype iterasi 2 dengan desain **Opsi A · Clean Workspace**.

### Ditambahkan

- Tampilan baru: navy dan emas, font Plus Jakarta Sans, responsif untuk HP (sidebar bisa disembunyikan, menu bawah untuk pelanggan, daftar ringkas dan lembar detail dari bawah), dropdown kustom, dan animasi halus.
- **Akun pelanggan dibuat Admin** (tanpa pendaftaran mandiri); kata sandi sementara dikirim lewat email dan wajib diganti saat login pertama.
- **Invoice dan pembayaran**: Admin menerbitkan invoice, pelanggan mengunggah bukti transfer, Admin memverifikasi.
- Tahap ST-03 Sertifikasi Produk selesai otomatis setelah pembayaran terverifikasi dan semua berkas diunduh Super Admin (unduh semua berkas sebagai ZIP).
- **Temuan audit** (mayor, minor, observasi) dengan tenggat otomatis 1/2 bulan, bukti perbaikan dari pelanggan, dan pengajuan perpanjangan 1 bulan; tahap ST-07 hanya dilalui bila ada ketidaksesuaian.
- Info pengujian laboratorium (lab, estimasi, tautan/file LHU) pada tahap ST-06.
- **Survei kepuasan pelanggan** yang wajib diisi sebelum sertifikat/LHU dapat diunduh; dokumen juga dikirim lewat email.
- **Data sertifikat**, termasuk sertifikat dari proyek sebelum SILAPP, untuk Directory publik; status Aktif/Tidak Aktif.
- Form pengajuan yang dapat diatur Super Admin (isian tambahan dan berkas per layanan), daftar harga lab, dan pengelolaan pertanyaan survei.
- Pengaturan akun dengan foto profil; lampiran file pada setiap aksi Admin.
- Pembaruan kolom database otomatis saat server dinyalakan.

### Dihapus

- Pendaftaran akun mandiri oleh pelanggan.

## [0.1.0] – 2026-10-05

Prototype iterasi 1 (commit pertama): React (Vite) + Bootstrap 5 + Axios, Node.js + Express, MySQL, JWT + RBAC, bcrypt, Multer, Nodemailer.

### Ditambahkan

- Tiga role login: Super Admin, Admin (dengan jabatan dan bidang sebagai PIC), dan pelanggan.
- Alur status sesuai tiga dokumen Rancangan Sistem Tracking PSU: Sertifikasi Produk (ST-01 s.d. ST-10, termasuk skema Tipe 5 dan Tipe 1B), Laboratorium Pengujian Kimia/Fisika/Mikrobiologi (LAB-01 s.d. LAB-08), dan Laboratorium Kalibrasi (KAL-01 s.d. KAL-09, pengembalian alat dilewati untuk kalibrasi on-site).
- Halaman publik: lacak status dengan kode lacak tanpa login, informasi layanan beserta ruang lingkup akreditasi, dan Directory.
- Pelanggan: pengajuan layanan lewat wizard, unggah dokumen, tanggapan atas permintaan tindakan, unggah bukti bayar, dan unduh sertifikat.
- Admin: dashboard, antrean per bidang, aksi setujui / minta tindakan / abaikan / tolak di setiap tahap, dan status parameter uji lab (tahap pengujian terkunci sampai semua parameter selesai).
- Super Admin: kelola pengguna, layanan, dan tahapan.
- Notifikasi email (mode simulasi di console bila SMTP belum diatur), riwayat perubahan status (audit trail), dan pemisahan informasi yang tampil ke pelanggan.
