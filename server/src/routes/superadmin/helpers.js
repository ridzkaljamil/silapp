/** Fungsi bantu bersama untuk route Super Admin. */
const { parseMoney } = require('../../utils/pricing');

/** Nominal rupiah dari isian (angka atau teks angka); kosong/tidak valid = null. */
const money = parseMoney;
/** Teks dirapikan dan dipotong sesuai panjang kolom. */
const text = (v, n) => String(v ?? '').trim().slice(0, n);
/** Error MySQL karena data masih dirujuk tabel lain (foreign key). */
const inUse = (e) => e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED';

module.exports = { money, text, inUse };
