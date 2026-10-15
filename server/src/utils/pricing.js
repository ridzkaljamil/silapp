/** Opsi harga lab: Kimia Reguler/Ekspress, Fisika Dalam Negeri/Luar Negeri. Layanan lain satu harga. */
const PRICE_OPTIONS = { KIM: ['Reguler', 'Ekspress'], FIS: ['Dalam Negeri', 'Luar Negeri'] };

const optionLabel = (serviceCode, opt) => PRICE_OPTIONS[serviceCode]?.[opt === 'alt' ? 1 : 0] || null;

/**
 * Perhitungan pajak invoice (mengikuti invoice PSU):
 *   Harga (belum PPN)           = H
 *   DPP Nilai Lain              = 11/12 × H
 *   PPN 12%                     = 12% × DPP Nilai Lain   (= 11% × H)
 *   Total                       = H + PPN
 *   PPh 23 (jika dipotong)      = 2% × H                 (dipotong pelanggan berbentuk badan usaha)
 *   Grand Total (yang dibayar)  = Total − PPh 23
 * Semua dibulatkan ke rupiah. PPN dihitung dari H langsung agar tidak ada selisih pembulatan.
 */
const PPN_LABEL = 'PPN 12%';
function taxes(price, withPph23 = false) {
  const h = Math.max(0, Math.round(+price || 0));
  const dppLain = Math.round((h * 11) / 12);
  const ppn = Math.round((h * 11) / 100);
  const total = h + ppn;
  const pph23 = withPph23 ? Math.round((h * 2) / 100) : 0;
  return { price: h, dppLain, ppn, total, pph23, grandTotal: total - pph23 };
}

/**
 * Nominal rupiah dari isian/JSON: angka atau teks angka standar ("500000", "500000.00" dari kolom DECIMAL)
 * dibaca sebagai angka; teks lain diambil digitnya saja. Kosong / tanpa angka = null. Hasil dibulatkan, minimal 0.
 */
function parseMoney(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' || /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? Number(v) : Number(String(v).replace(/\D/g, '') || NaN);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

module.exports = { PRICE_OPTIONS, optionLabel, taxes, PPN_LABEL, parseMoney };
