/**
 * Status sertifikat Sertifikasi Produk.
 * Status yang diatur Admin: aktif, ditangguhkan, dicabut.
 * "berakhir" tidak disimpan: tampil otomatis bila tanggal berakhir sudah lewat (kecuali sertifikat yang dicabut).
 */
const CERT_STATUS = ['aktif', 'ditangguhkan', 'dicabut'];
/** Tanggal YYYY-MM-DD yang benar-benar ada (2025-02-30 ditolak). */
const isDate = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

/** Tanggal hari ini (YYYY-MM-DD) zona Asia/Jakarta, tidak bergantung zona waktu server/database. */
const todayJkt = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

/** Status yang ditampilkan: dicabut > berakhir (masa berlaku lewat) > status tersimpan. */
function certState(r, today = todayJkt()) {
  if (r.status === 'dicabut') return 'dicabut';
  if (r.expires_at && String(r.expires_at).slice(0, 10) < today) return 'berakhir';
  return r.status;
}

/** Validasi tanggal terbit & berakhir. Mengembalikan pesan kesalahan atau null. */
function checkDates(issued, expires, { expiresRequired = true } = {}) {
  if (!isDate(issued)) return 'Tanggal terbit tidak valid.';
  if (issued > todayJkt()) return 'Tanggal terbit tidak boleh melewati hari ini.';
  if (!expires) return expiresRequired ? 'Tanggal berakhir wajib diisi.' : null;
  if (!isDate(expires)) return 'Tanggal berakhir tidak valid.';
  if (expires <= issued) return 'Tanggal berakhir harus setelah tanggal terbit.';
  return null;
}

module.exports = { CERT_STATUS, todayJkt, certState, checkDates };
