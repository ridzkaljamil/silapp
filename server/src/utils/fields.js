/**
 * Isian form builder bertipe "nomor_tanggal" (mis. Nomor Bill of Lading + tanggalnya).
 * Dikirim dari form sebagai daftar [{ no, date }], disimpan sebagai teks per baris: "BL-001 · 2 Okt 2026".
 */
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const tgl = (d) => { const [y, m, dd] = d.split('-'); return `${+dd} ${BLN[+m - 1]} ${y}`; };
const isYmd = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

/** Normalisasi isian Nomor + Tanggal. Mengembalikan { rows, error }. */
function readPairs(value, { label, required, multiple }) {
  const list = (Array.isArray(value) ? value : [])
    .map((x) => ({ no: String(x?.no ?? '').trim().slice(0, 80), date: String(x?.date ?? '').trim() }))
    .filter((x) => x.no || x.date)
    .slice(0, multiple ? 10 : 1);
  if (list.some((x) => !x.no)) return { error: `Nomor pada isian ${label} wajib diisi.` };
  if (list.some((x) => !isYmd(x.date))) return { error: `Tanggal pada isian ${label} wajib diisi.` };
  if (required && !list.length) return { error: `${label} wajib diisi.` };
  return { rows: list };
}
const formatPairs = (rows) => rows.map((x) => `${x.no} · ${tgl(x.date)}`).join('\n');

/** Kebalikan formatPairs (untuk "Ajukan Ulang"): "BL-001 · 2 Okt 2026" -> { no, date: '2026-10-02' }. */
function parsePairs(text) {
  return String(text || '').split('\n').map((line) => {
    const m = line.match(/^(.*) · (\d{1,2}) ([A-Za-z]{3}) (\d{4})$/);
    const mi = m ? BLN.indexOf(m[3]) : -1;
    if (!m || mi < 0) return line.trim() ? { no: line.trim(), date: '' } : null;
    return { no: m[1].trim(), date: `${m[4]}-${String(mi + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}` };
  }).filter(Boolean);
}

/** Skema pengajuan termasuk daftar "tidak memerlukan berkas ini"? (mis. hide_schemes = "Tipe 1b") */
const norm = (x) => String(x || '').toLowerCase().replace(/\s+/g, '');
const hiddenFor = (hideSchemes, scheme) => !!scheme && String(hideSchemes || '').split(',').map(norm).filter(Boolean).includes(norm(scheme));

module.exports = { readPairs, formatPairs, parsePairs, hiddenFor };
