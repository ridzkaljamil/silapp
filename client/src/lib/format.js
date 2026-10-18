/** Format tampilan: tanggal, rupiah, inisial, tipe file unggahan. */
// tanggal saja (YYYY-MM-DD) dibaca sebagai tengah malam waktu lokal, bukan UTC, agar tidak mundur sehari di zona waktu lain
const toDate = (s) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(s)) ? `${s}T00:00:00` : String(s).replace(' ', 'T'));
export const fmtDate = (s) => (s ? toDate(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
/** Isian nominal: hanya digit (titik pemisah ribuan hanya tampilan). Maks. 12 digit. */
export const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '').slice(0, 12);
/** Nilai rupiah dari server (angka atau DECIMAL "500000.00") menjadi isian digit; kosong tetap kosong. */
export const moneyIn = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(+v) ? '' : String(Math.round(+v)));
/**
 * Pajak invoice (sama dengan server utils/pricing.taxes): DPP nilai lain = 11/12 × H, PPN 12% × DPP (= 11% × H),
 * PPh 23 = 2% × H bila dipotong, Grand Total = H + PPN − PPh 23.
 */
export const taxes = (h, withPph23 = false) => {
  const price = Math.max(0, Math.round(+h || 0));
  const ppn = Math.round((price * 11) / 100);
  const pph23 = withPph23 ? Math.round((price * 2) / 100) : 0;
  return { price, dppLain: Math.round((price * 11) / 12), ppn, total: price + ppn, pph23, grand: price + ppn - pph23 };
};
export const rupiah = (n) => (n === null || n === undefined || n === '' ? '—' : `Rp${Number(n).toLocaleString('id-ID')}`);
export const fmtDateTime = (s) => (s ? toDate(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

/** Tanggal hari ini (zona waktu perangkat) dalam format YYYY-MM-DD. */
const pad = (n) => String(n).padStart(2, '0');
const ymdOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayYmd = () => ymdOf(new Date());
/** Tambah bulan seperti MySQL DATE_ADD: 31 Jan + 1 bulan = 28/29 Feb (bukan 3 Mar). */
export const addMonths = (ymd, m) => {
  const [y, mo, d] = String(ymd).slice(0, 10).split('-').map(Number);
  const last = new Date(y, mo - 1 + m + 1, 0).getDate();
  return ymdOf(new Date(y, mo - 1 + m, Math.min(d, last)));
};
/**
 * Penyimpanan file: 'local' (server/uploads) atau 'blob' (hosting Vercel). Diisi saat build oleh vite.config.js.
 * Di Vercel batas per file 4 MB karena unduhan lewat fungsi Vercel dibatasi 4,5 MB.
 */
// eslint-disable-next-line no-undef
export const UPLOAD_MODE = typeof __UPLOAD_MODE__ !== 'undefined' ? __UPLOAD_MODE__ : 'local';
/** Batas ukuran satu file unggahan (sama dengan server). */
export const MAX_FILE_MB = UPLOAD_MODE === 'blob' ? 4 : 10;
export const FILE_HINT = `PDF, Word, ZIP, JPG, atau PNG · maks. ${MAX_FILE_MB} MB`;
/** Ukuran file ringkas: 820 KB / 2,4 MB. */
export const fileSize = (b) => (b >= 1048576 ? `${(b / 1048576).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export const FILE_ACCEPT = '.pdf,.doc,.docx,.zip,.jpg,.jpeg,.png';
export const initials = (n = '') => n.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
