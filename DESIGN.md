# SILAPP · Design System

Panduan tampilan SILAPP berdasarkan mockup dashboard dari tim UI/UX (`dashboard.svg`). Dokumen ini jadi acuan saat mengubah atau menambah halaman agar semua tampilan tetap konsisten.

Status: **draf, sedang diuji di prototype**. Belum diterapkan ke kode aplikasi.

---

## 1. Arah Desain

- **Sidebar navy pekat, konten terang.** Navigasi tegas di kiri, area kerja lega di kanan.
- **Emas sebagai aksen utama**, dipakai hemat: menu aktif, badge jumlah, ikon judul panel, dan ornamen garis lengkung.
- **Kartu ringkasan berwarna lembut**: tiap metrik punya warna sendiri agar cepat dibedakan tanpa membaca judulnya.
- **Sudut membulat besar dan bayangan tipis**: kesan ramah, tetap rapi untuk aplikasi kerja.

## 2. Warna

### Brand

| Token | Hex | Pemakaian |
|---|---|---|
| `--navy-900` | `#0B1F42` | Latar sidebar, avatar, batang grafik bulan berjalan |
| `--navy-800` | `#0B2351` | Gradasi sidebar (bawah) |
| `--blue-700` | `#18519B` | Batang progres sekunder |
| `--gold-400` | `#F3B43A` | Menu aktif, badge, titik notifikasi |
| `--gold-500` | `#D4AF37` | Ornamen garis lengkung |
| `--gold-text` | `#AC7A0C` | Teks kecil emas ("Selamat Datang di") |
| `--bronze-700` | `#82541F` | Tombol aksi utama di daftar tugas (mis. "Terbitkan Invoice") |

### Netral (skala slate)

| Token | Hex | Pemakaian |
|---|---|---|
| `--ink` | `#0F172A` | Judul, angka besar, teks utama |
| `--slate-700` | `#334155` | Teks isi |
| `--slate-500` | `#64748B` | Teks pendukung, sub-judul, label sumbu |
| `--slate-400` | `#94A3B8` | Placeholder, ikon nonaktif, label grup sidebar |
| `--slate-300` | `#CBD5E1` | Teks menu sidebar (di atas navy) |
| `--slate-200` | `#E2E8F0` | Garis tepi |
| `--slate-100` | `#F1F5F9` | Garis pemisah, track progres |
| `--slate-50` | `#F8FAFC` | Latar halaman |

> `#94A3B8` di atas putih kontrasnya hanya 2,6:1. Pakai untuk placeholder dan dekorasi saja. Teks yang harus dibaca minimal `#64748B` (4,8:1).

### Warna status & kartu ringkasan

| Nada | Latar kartu | Tepi | Latar ikon | Ikon / teks |
|---|---|---|---|---|
| Amber (berjalan, invoice) | `#FFF9EA` | `#FBEAC4` | `#FDEEC6` | `#B45309` |
| Biru (perlu tindakan, baru) | `#F0F7FF` | `#D5E8FD` | `#E0EFFF` | `#2563EB` |
| Hijau (temuan, selesai) | `#F0FDF8` | `#CCEFE0` | `#DCF8EC` | `#059669` (ikon), `#047857` (teks) |
| Merah (kepuasan, ditolak) | `#FFF5F5` | `#FCDADA` | `#FFE4E4` | `#E11D48` |

Pill status mengikuti nada yang sama: latar muda, tepi tipis, titik bulat berwarna di depan teks.

## 3. Tipografi

Satu keluarga huruf: **Plus Jakarta Sans** (sudah dipakai SILAPP). Nomor pengajuan dan kode memakai **JetBrains Mono**.

| Peran | Ukuran / tebal | Contoh |
|---|---|---|
| Judul halaman | 32px / 800, letter-spacing -0.02em | Ringkasan Layanan |
| Eyebrow | 12px / 600, huruf kapital, spasi 0.06em, `--slate-500` | SEMUA BIDANG |
| Judul panel | 18px / 700 | Perlu Tindakan Sekarang |
| Angka ringkasan | 36px / 800 | 4 |
| Teks isi | 14px / 400–500 | — |
| Teks kecil | 12–13px / 500 | Tenggat terdekat 06 Des 2026 |
| Kode | 12px mono, `--slate-500` | PSU-SP-2610-0002 · ST-03 |

**Penulisan huruf:** mockup memakai huruf kecil setelah kata pertama ("Antrean pengajuan"). SILAPP tetap memakai **Title Case** untuk judul, menu, tombol, dan label (keputusan sebelumnya), kecuali kata sambung kecil (dan, di, ke, dari, untuk, yang, atau, dengan, per, pada).

## 4. Ukuran, Jarak, Sudut, Bayangan

- Skala jarak 4px: 4, 8, 12, 16, 20, 24, 32, 40.
- Sudut: tombol & input 12px · pill 999px · kartu ringkasan 16px · panel 24px · kartu logo sidebar 24px · ikon kotak 12px.
- Bayangan kartu: `0 1px 2px rgba(15,23,42,.05)`. Panel besar: `0 4px 6px rgba(15,23,42,.04), 0 1px 2px rgba(15,23,42,.05)`.
- Lebar sidebar 256px, tinggi topbar 76px, jarak tepi konten 32px (16px di HP).

## 5. Tata Letak

```
┌────────────┬──────────────────────────────────────────────────────┐
│  Sidebar   │ Topbar: Judul · [ Cari global ] · Lonceng │ Akun ▾   │
│  navy      ├──────────────────────────────────────────────────────┤
│            │ Eyebrow / Judul / Deskripsi            [Periode ▾]   │
│ [Logo card]│ [Kartu] [Kartu] [Kartu] [Kartu]                      │
│            │ [ Panel: Perlu Tindakan Sekarang                  ]  │
│ Menu grup  │ [ Panel: Per Layanan ]  [ Panel: Masuk per Bulan ]   │
└────────────┴──────────────────────────────────────────────────────┘
```

- Ornamen garis lengkung emas di kanan atas area judul dan di bawah sidebar. Dekorasi saja, `pointer-events: none`, tidak tampil di HP.
- HP: sidebar jadi laci (drawer), kartu ringkasan 2 kolom, panel menumpuk satu kolom, kolom cari global pindah ke ikon kaca pembesar.

## 6. Komponen

### Sidebar
- Kartu logo putih bersudut 24px: logo PSU + teks kecil emas "SELAMAT DATANG DI" + "SILAPP" tebal navy.
- Label grup: 12px kapital, `--slate-400`.
- Menu: ikon garis 20px + teks 15px `--slate-300`; hover latar `rgba(255,255,255,.06)`.
- Menu aktif: latar `--gold-400`, teks dan ikon `--navy-900` tebal, sudut 12px.
- Badge jumlah: lingkaran `--gold-400` dengan angka navy.

### Topbar
- Judul halaman 20px/700 di kiri.
- **Cari global** (baru): kolom pill lebar ±560px, latar `--slate-50`, tepi `--slate-200`, placeholder "Cari pengajuan, layanan, atau pelanggan…". Hasil muncul di dropdown, dikelompokkan per jenis.
- Lonceng dengan titik emas jika ada notifikasi belum dibaca (angka tampil di dalam dropdown).
- Pemisah vertikal tipis, lalu avatar navy bulat + nama (tebal) + role (kecil) + chevron.

### Kepala halaman
- Eyebrow → Judul → Deskripsi satu kalimat.
- Kontrol di kanan (mis. Periode): pill putih, ikon kalender, label abu "Periode" lalu nilai tebal.

### Kartu ringkasan (stat card)
- Latar dan tepi bernada (lihat tabel warna), sudut 16px, padding 24px.
- Baris atas: ikon dalam kotak 44px bernada + judul 15px/600.
- Angka besar 36px/800, tombol bulat putih "›" di kanan (membuka halaman terkait yang sudah difilter).
- Keterangan kecil di bawah, `--slate-500`.

### Panel
- Latar putih, sudut 24px, tepi `--slate-100`, padding 32px.
- Judul panel diawali ikon berwarna (petir amber, grafik amber, tren amber).
- Tautan di kanan atas: biru `#2563EB` + panah "→".

### Baris tugas (Perlu Tindakan)
- Pill status → nama perusahaan tebal · produk abu → baris kode mono di bawahnya.
- Tombol aksi utama: `--bronze-700`, teks putih, pill. Tombol sekunder: putih bertepi.
- Menu titik tiga (kebab) untuk aksi tambahan.
- Pemisah antar baris garis tipis `--slate-100`.

### Grafik
- **Batang horizontal per layanan**: nilai tertinggi navy, lainnya `--blue-700`, track `--slate-100`, tinggi 16px, ujung membulat, angka di kanan.
- **Kolom per bulan**: bulan berjalan navy, bulan lain biru muda `#8CB5E4`, angka di atas kolom, garis bantu horizontal tipis, sumbu Y kecil, legenda di bawah.

### Tombol

| Jenis | Gaya |
|---|---|
| Utama | Navy `#0B1F42`, teks putih, sudut 12px |
| Aksi tugas | Bronze `#82541F`, teks putih, pill |
| Sekunder | Putih, tepi `--slate-200`, teks `--ink` |
| Tautan | Biru `#2563EB`, tanpa garis bawah, panah opsional |
| Bahaya | Putih, tepi & teks merah `#E11D48` |

### Pill status

| Kondisi | Nada |
|---|---|
| On Progress / Pengajuan Baru | Biru |
| Action Required / Invoice Belum Terbit | Amber |
| Selesai / Aktif | Hijau |
| Closed / Nonaktif | Merah atau abu |

## 7. Ikon

Tetap Bootstrap Icons gaya garis (outline), 20px di sidebar, 18px di dalam kartu. Ikon dalam kartu ringkasan diberi kotak bernada.

## 8. Aksesibilitas

- Fokus keyboard: cincin `0 0 0 4px rgba(37,99,235,.18)`.
- Kontras teks minimal 4,5:1 (lihat catatan warna slate dan hijau).
- Warna bukan satu-satunya penanda: pill selalu berisi teks, grafik punya angka.
- Target sentuh minimal 44px di HP.
- Ornamen dan animasi dimatikan saat `prefers-reduced-motion`.

## 9. Perbedaan dengan Tampilan Sekarang

| Bagian | Sekarang | Usulan |
|---|---|---|
| Sidebar | Putih, menu aktif abu | Navy, menu aktif emas, kartu logo |
| Latar | `#F6F7F9` | `#F8FAFC` + ornamen lengkung emas |
| Kartu ringkasan | Putih seragam | Berwarna per metrik, ikon, tombol › |
| Topbar | Judul + lonceng + akun | Ditambah cari global, akun dua baris |
| Sudut panel | 12px | 24px |
| Tombol aksi tugas | Outline | Bronze untuk aksi utama |
| Grafik bulanan | Kolom tanpa sumbu | Sumbu Y, angka di atas kolom, legenda |

## 10. Rencana Penerapan

1. Prototype HTML (dashboard, antrean, kelola pengguna, tampilan HP) untuk ditinjau.
2. Setelah disetujui: token di `base.css`, sidebar & topbar di `Layouts.jsx` + `layout.css`.
3. Kartu ringkasan, panel, dan grafik di `Dashboard.jsx`.
4. Pill, tombol, dan panel di `components.css` (otomatis berlaku di semua halaman).
5. Cari global: endpoint baru `/api/admin/search` dan dropdown di topbar.
