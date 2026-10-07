/** Format tampilan: tanggal, rupiah, inisial, tipe file unggahan. */
export const fmtDate = (s) => (s ? new Date(String(s).replace(' ', 'T')).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const rupiah = (n) => (n === null || n === undefined || n === '' ? '—' : `Rp${Number(n).toLocaleString('id-ID')}`);
export const fmtDateTime = (s) => (s ? new Date(String(s).replace(' ', 'T')).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export const FILE_ACCEPT = '.pdf,.zip,.jpg,.jpeg,.png';
export const initials = (n = '') => n.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
