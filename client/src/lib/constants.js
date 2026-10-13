/** Konstanta & label yang dipakai di banyak halaman (satu sumber, agar konsisten). */
export const BIDANG = { SP: 'Sertifikasi Produk', LAB: 'Lab Pengujian', KAL: 'Lab Kalibrasi' };
export const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
/** Status operasional layanan selain "Beroperasi". */
export const SERVICE_STATE = { dev: 'Pengembangan', prep: 'Persiapan' };
/** Label role login: [kelas pill, teks]. */
export const ROLE = { superadmin: ['pill-done', 'Super Admin'], admin: ['pill-progress', 'Admin'], user: ['pill-action', 'User'] };

/** Dokumen hasil layanan: sertifikat (SP & Kalibrasi) atau LHU (lab pengujian). */
export const docWord = (serviceCode, capital = false) => {
  const w = ['SP', 'KAL'].includes(serviceCode) ? 'sertifikat' : 'LHU';
  return capital ? w[0].toUpperCase() + w.slice(1) : w;
};

/** Keterangan singkat pengguna: jabatan · bidang (Admin), "Super Admin", atau nama perusahaan (pelanggan). */
export const roleLabel = (u) => (u.role === 'superadmin' ? 'Super Admin' : u.role === 'admin' ? `${u.jabatan || 'Admin'} · ${BIDANG[u.bidang] || ''}` : u.company_name);

/** Opsi harga lab (indeks 0 = harga utama, 1 = opsi kedua). Layanan lain satu harga. */
export const PRICE_OPTIONS = { KIM: ['Reguler', 'Ekspress'], FIS: ['Dalam Negeri', 'Luar Negeri'] };

/** Layanan per bidang (untuk filter daftar pengajuan). */
export const SERVICES = { SP: 'Sertifikasi Produk', KIM: 'Lab Kimia', FIS: 'Lab Fisika', MIK: 'Lab Mikrobiologi', KAL: 'Lab Kalibrasi' };
export const SERVICE_BIDANG = { SP: ['SP'], LAB: ['KIM', 'FIS', 'MIK'], KAL: ['KAL'] };
/** Kondisi pengajuan (nilai kolom status) untuk filter. */
/** Filter kondisi pengajuan (nilai = kondisi yang tampil di status pill). */
export const CONDITIONS = [['berjalan', 'Semua yang Berjalan'], ['On Progress', 'On Progress'], ['Action Required', 'Action Required'],
  ['Waiting for Payment', 'Waiting for Payment'], ['Waiting for Sample', 'Waiting for Sample'], ['Scheduling', 'Scheduling'],
  ['On-Site Calibration', 'On-Site Calibration'], ['Ready for Collection', 'Ready for Collection'],
  ['Certified', 'Certified'], ['Completed', 'Completed'], ['Closed', 'Closed'], ['Cancelled', 'Cancelled']];
/** Kondisi cocok dengan filter (dipakai filter di sisi browser). */
export const matchCondition = (a, c) => !c || (c === 'berjalan' ? ['aktif', 'aksi'].includes(a.status) : a.condition === c);
