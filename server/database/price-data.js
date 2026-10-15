/**
 * Daftar harga lab resmi PSU (file DAFTAR HARGA LAB, tahun 2024): sheet LAB KIMIA dan LAB FISIKA, hanya kolom yang
 * ditampilkan di file (kolom harga Ekspress Lab Kimia disembunyikan PSU sehingga tidak dipakai).
 * Lab Kimia: satu harga (Reguler); Ekspress dapat dipilih pelanggan dengan biaya tambahan yang dikonfirmasi PSU di invoice.
 * Lab Fisika: harga Dalam Negeri & Luar Negeri.
 * Format produk: { svc, cat, n (nama), sni, pkg: [harga paket, harga paket opsi kedua], alt (opsi kedua tersedia), note, p: [[parameter, metode, harga, harga opsi kedua]] }
 * Harga dapat diubah Super Admin di menu Daftar harga lab.
 */
const AO = 'AOAC Ed. 20 (2016)';
const KIMIA_EXTRA_NOTE = 'Dapat langsung menghubungi pihak PSU.';

const CEMARAN = (reg, alt, m = {}) => [
  ['Cemaran Kadmium (Cd)', m.cd || null, reg, alt], ['Cemaran Timbal (Pb)', m.pb || null, reg, alt],
  ['Cemaran Merkuri (Hg)', m.hg || null, m.hgReg || reg, m.hgAlt || alt], ['Cemaran Arsen (As)', m.hg || null, m.hgReg || reg, m.hgAlt || alt],
];

const KIMIA_SNI = [
  { n: 'Pupuk SP-36', sni: 'SNI 02-3769-2005', pkg: [2000000], p: [
    ['P₂O₅ Total', `${AO} butir 2.3.01 & 2.3.02`, 500000],
    ['P₂O₅ Larut dalam Asam Sitrat 2%', 'SNI 02-3769-2005 butir 6.1.2', 350000],
    ['P₂O₅ Larut dalam Air', `${AO} butir 2.3.06 & 2.3.09`, 350000],
    ['Kadar Belerang (S)', 'IKM-Lab-PSN-01 (spektrofotometri)', 350000],
    ['Kadar Asam Bebas (H₃PO₄)', 'SNI 02-3769-2005 butir 6.3', 350000],
    ['Kadar Air', `${AO} butir 2.2.01`, 300000]] },
  { n: 'Pupuk Fosfat Alam untuk Pertanian', sni: 'SNI 02-3776-2005', pkg: [2500000], alt: 0, p: [
    ['P₂O₅ Total', `${AO} butir 2.3.01 & 2.3.02`, 500000],
    ['P₂O₅ Larut dalam Asam Sitrat 2%', 'SNI 02-3776-2005 butir 6.1.2', 350000],
    ['Kadar Air', `${AO} butir 2.2.01`, 300000],
    ['Kehalusan Lolos 80 Mesh', 'SNI 02-3776-2005 butir 6.3', 100000],
    ['Kehalusan Lolos 25 Mesh', 'SNI 02-3776-2005 butir 6.3', 100000],
    ...CEMARAN(300000, null, { cd: 'SNI 02-3776-2005 butir 6.4.1', pb: 'SNI 02-3776-2005 butir 6.4.2', hg: 'Subkon (lab luar)', hgReg: 400000, hgAlt: null })] },
  { n: 'Pupuk Kalium Klorida', sni: 'SNI 02-2805-2005', pkg: [2000000], p: [
    ['Kadar Kalium (K₂O)', `${AO} butir 2.5.07`, 1600000],
    ['Kadar Air', `${AO} butir 2.2.01`, 400000]] },
  { n: 'Pupuk Tripel Super Fosfat (TSP)', sni: 'SNI 02-0086-2005', pkg: [3000000], alt: 0, p: [
    ['P₂O₅ Total', `${AO} butir 2.3.01 & 2.3.02`, 500000],
    ['P₂O₅ Larut dalam Asam Sitrat 2%', 'SNI 02-0086-2005 butir 6.1.2', 350000],
    ['P₂O₅ Larut dalam Air', `${AO} butir 2.3.06 & 2.3.09`, 350000],
    ['Kadar Asam Bebas (H₃PO₄)', 'SNI 02-0086-2005 butir 6.2', 350000],
    ['Kadar Air', `${AO} butir 2.2.01`, 300000],
    ...CEMARAN(300000, null, { cd: 'SNI 02-0086-2005 butir 6.4.1', pb: 'SNI 02-0086-2005 butir 6.4.2', hg: 'Subkon (lab luar)', hgReg: 400000, hgAlt: null })] },
  { n: 'Pupuk NPK Padat', sni: 'SNI 2803:2024', pkg: [3000000], alt: 0, p: [
    ['Nitrogen Total', 'SNI 2803:2024 butir 6.2.1', 500000],
    ['Fosfor Total (P₂O₅)', 'SNI 2803:2024 butir 6.3.1', 500000],
    ['Kalium (K₂O)', 'SNI 2803:2024 butir 6.4.1', 500000],
    ['Jumlah Kadar N, P₂O₅, K₂O', 'SNI 2803:2024', 0],
    ['Kadar Air', `${AO} butir 2.2.01`, 300000],
    ...CEMARAN(300000, null, { cd: 'SNI 2803:2024 butir 6.6.2', pb: 'SNI 2803:2024 butir 6.6.3', hg: 'Subkon (lab luar)', hgReg: 400000, hgAlt: null })] },
  { n: 'Pupuk Amonium Sulfat (ZA)', sni: 'SNI 02-1760-2005', pkg: [2000000], p: [
    ['Kadar Nitrogen', 'ISO 3332:1975', 800000],
    ['Kadar Belerang (S)', 'SNI 02-1760-2005 butir 6.2.2', 550000],
    ['Kadar Asam Bebas (H₂SO₄)', 'ISO 2993:1974', 550000],
    ['Kadar Air', `${AO} butir 2.2.01`, 300000]] },
  { n: 'Pupuk Urea', sni: 'SNI 2801:2010', pkg: [2000000], p: [
    ['Kadar Nitrogen', 'SNI 2801:2010 butir 6.1.1', 800000],
    ['Kadar Air', `${AO} butir 2.2.01`, 300000],
    ['Kadar Biuret', 'SNI 2801:2010', 700000],
    ['Ukuran Butir', 'SNI 2801:2010 butir 6.4', 400000]] },
  // harga belum ditetapkan PSU (null = "Belum Ada Harga"), parameter mengikuti SNI
  { n: 'Beras', sni: 'SNI 6128:2020', pkg: [null, null], p: [
    ['Kadar Air', 'SNI 6128:2020', null]] },
  { n: 'Minyak Goreng Sawit', sni: 'SNI 7709:2019', pkg: [null, null], p: [
    ['Kadar Air dan Bahan Menguap', 'SNI 7709:2019', null], ['Bilangan Asam', 'SNI 7709:2019', null],
    ['Bilangan Peroksida', 'SNI 7709:2019', null], ['Vitamin A', 'SNI 7709:2019', null], ['Minyak Pelikan', 'SNI 7709:2019', null],
    ['Cemaran Kadmium (Cd)', 'SNI 7709:2019', null], ['Cemaran Timbal (Pb)', 'SNI 7709:2019', null],
    ['Cemaran Timah (Sn)', 'SNI 7709:2019', null], ['Cemaran Merkuri (Hg)', 'SNI 7709:2019', null], ['Cemaran Arsen (As)', 'SNI 7709:2019', null]] },
  { n: 'Parameter Tambahan di Luar Lingkup Akreditasi KAN', sni: null, pkg: [null, null], note: KIMIA_EXTRA_NOTE, custom: 1, p: [] },
].map((x) => ({ ...x, svc: 'KIM', cat: 'Uji SNI' }));

const C = 'SNI 8752:2020 butir ';
const FW = 'SNI 8753:2020 butir ';
const FISIKA = [
  { n: 'Peralatan Masak (Cookware) dari Logam', sni: 'SNI 8752:2020', pkg: [1500000, 2500000], p: [
    ['Sifat Tampak', C + '6.1.1', 150000, 200000], ['Ketajaman Permukaan', C + '6.1.2', 150000, 200000], ['Bentuk (Ukuran)', C + '6.2', 200000, 250000],
    ['Ketebalan Bahan Dasar', C + '6.3', 200000, 300000], ['Kekuatan Pegangan (Handle)', C + '6.4', 200000, 300000], ['Kapasitas Volume Air', C + '6.5', 200000, 250000],
    ['Kelekatan Lapisan Anti Lengket', C + '6.6', 200000, 300000], ['Ketahanan Kejut Panas (Thermal Shock)', C + '6.7', 200000, 300000],
    ['Ketebalan Lapisan', C + '6.8', 200000, 300000], ['Ketahanan terhadap Asam', C + '6.9', 200000, 300000], ['Kestabilan Produk', C + '6.10', 100000, 200000]] },
  { n: 'Peralatan Makan & Masak Baja Tahan Karat (Flatware)', sni: 'SNI 8753:2020', pkg: [1500000, 2000000],
    note: 'Uji kimia dikirim ke laboratorium GSI: Rp380.000 per bahan baku (di luar PPN).', p: [
    ['Sifat Tampak', FW + '8.1.1', 150000, 200000], ['Ketajaman Permukaan', FW + '8.1.2', 150000, 200000], ['Ketebalan', FW + '8.2', 200000, 300000],
    ['Ukuran Panjang', FW + '8.3', 200000, 300000], ['Kapasitas Volume', FW + '8.4', 200000, 300000], ['Ketahanan terhadap Pembebanan', FW + '8.6', 300000, 400000],
    ['Uji Kimia', FW + '8.5', 500000, 700000]] },
  { n: 'Beras', sni: 'SNI 6128:2020', pkg: [null, null], p: [
    ['Derajat Sosoh', 'SNI 6128:2020', null, null], ['Butir Kepala', 'SNI 6128:2020', null, null], ['Butir Patah', 'SNI 6128:2020', null, null],
    ['Butir Menir', 'SNI 6128:2020', null, null], ['Butir Merah/Putih/Hitam', 'SNI 6128:2020', null, null], ['Butir Rusak', 'SNI 6128:2020', null, null],
    ['Butir Kapur', 'SNI 6128:2020', null, null], ['Benda Asing', 'SNI 6128:2020', null, null], ['Butir Gabah', 'SNI 6128:2020', null, null]] },
  { n: 'Minyak Goreng Sawit', sni: 'SNI 7709:2019', pkg: [null, null], p: [
    ['Keadaan: Bau', 'SNI 7709:2019', null, null], ['Keadaan: Rasa', 'SNI 7709:2019', null, null], ['Warna', 'SNI 7709:2019', null, null]] },
  { n: 'Parameter Tambahan di Luar Lingkup Akreditasi KAN', sni: null, pkg: [null, null], note: KIMIA_EXTRA_NOTE, custom: 1, p: [] },
].map((x) => ({ ...x, svc: 'FIS', cat: 'Uji SNI' }));

module.exports = { LAB_PRICES: [...KIMIA_SNI, ...FISIKA], KIMIA_EXTRA_NOTE };
