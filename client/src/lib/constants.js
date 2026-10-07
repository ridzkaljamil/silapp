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
