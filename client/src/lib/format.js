/** Format tampilan: tanggal, rupiah, inisial, tipe file unggahan. */
export const fmtDate = (s) => (s ? new Date(String(s).replace(' ', 'T')).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const rupiah = (n) => (n === null || n === undefined || n === '' ? '—' : `Rp${Number(n).toLocaleString('id-ID')}`);
export const fmtDateTime = (s) => (s ? new Date(String(s).replace(' ', 'T')).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

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
/** Batas ukuran satu file unggahan (sama dengan server). */
export const MAX_FILE_MB = 10;

export const FILE_ACCEPT = '.pdf,.doc,.docx,.zip,.jpg,.jpeg,.png';
export const initials = (n = '') => n.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
