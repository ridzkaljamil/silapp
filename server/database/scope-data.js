// Ruang lingkup dari lampiran akreditasi LSPR-051-IDN (LSPro) dan LP-1554-IDN (Lab Pengujian)

/* ---------- ruang lingkup (dari lampiran akreditasi) ---------- */
const PB='PBSN No. 4 Tahun 2021', PM26='Permenperin No. 26/M-IND/PER/4/2013';
const SPC={12:'Pertanian dan Perkebunan',15:'Produk Tanaman dan Turunannya',17:'Produk Pangan Lainnya',18:'Bahan dan Produk Kimia',27:'Sertifikasi Jasa'};
// [kategori, sub kategori, produk, SNI, acuan skema, tipe]
const SP_PRODUCTS=[
 [12,'Hasil Pertanian & Perkebunan','Beras','SNI 6128:2020',PB+' Lamp. XVII',''],
 [12,'Hasil Pertanian & Perkebunan','Biji Kakao','SNI 2323:2008 / Amd1:2010',PB+' Lamp. XIII',''],
 [12,'Hasil Pertanian & Perkebunan','Biji Kopi','SNI 2907:2008',PB+' Lamp. XIV',''],
 [15,'Serealia, Umbi-umbian & Turunannya','Biskuit','SNI 2973:2011','Permenperin No. 60/M-IND/PER/7/2015','Tipe 5'],
 [15,'Gula, Produk Gula, Pati','Gula Kristal Putih','SNI 3140.3:2020','','Tipe 5'],
 [15,'Gula, Produk Gula, Pati','Gula Kristal Rafinasi','SNI 3140.2:2018','','Tipe 5'],
 [15,'Gula, Produk Gula, Pati','Gula Kristal Mentah','SNI 3140.1:2008','Kepmentan No. 03/Kpts/KB.410/1/2003','Tipe 5'],
 [15,'Kopi, Teh, Kakao, Cokelat','Kopi Instan','SNI 2983:2014','Permenperin No. 87/M-IND/PER/10/2014','Tipe 5/Tipe 1b'],
 [15,'Kopi, Teh, Kakao, Cokelat','Kopi Sangrai dan Kopi Bubuk','SNI 8964:2021','PBSN No. 4 Tahun 2024',''],
 [15,'Kopi, Teh, Kakao, Cokelat','Kopi Gula Krimer dalam Kemasan','SNI 7708:2011','PBSN No. 6 Tahun 2019 Lamp. XXXV',''],
 [15,'Kopi, Teh, Kakao, Cokelat','Kakao Bubuk','SNI 3747:2009','Permenperin No. 45/M-IND/PER/5/2009','Tipe 5/Tipe 1b'],
 [15,'Minyak Nabati & Lemak','Minyak Goreng Sawit','SNI 7709:2019','Permenperin No. 46 Tahun 2019','Tipe 5'],
 [15,'Minyak Nabati & Lemak','Minyak Goreng','SNI 3741:2013','','Tipe 5'],
 [17,'Minuman','Air Mineral','SNI 3553:2015','Permenperin No. 78/M-IND/PER/11/2016','Tipe 5/Tipe 4'],
 [17,'Minuman','Air Demineral','SNI 6241:2015','Permenperin No. 78/M-IND/PER/11/2016','Tipe 5/Tipe 4'],
 [17,'Minuman','Air Mineral Alami','SNI 6242:2015','Permenperin No. 78/M-IND/PER/11/2016','Tipe 5'],
 [17,'Minuman','Air Minum Embun','SNI 7812:2013','Permenperin No. 78/M-IND/PER/11/2016','Tipe 5'],
 [18,'Pupuk','Pupuk Super Fosfat SP-36','SNI 02-3769-2005',PM26,'Tipe 5/Tipe 1b'],
 [18,'Pupuk','Pupuk Fosfat Alam untuk Pertanian','SNI 02-3776-2005',PM26,'Tipe 5/Tipe 1b'],
 [18,'Pupuk','Pupuk Kalium Klorida','SNI 02-2805-2005',PM26,'Tipe 5/Tipe 1b'],
 [18,'Pupuk','Pupuk Tripel Super Fosfat (TSP)','SNI 02-0086-2005',PM26,'Tipe 5/Tipe 1b'],
 [18,'Pupuk','Pupuk NPK Padat','SNI 2803:2024','Permenperin No. 11 Tahun 2025','Tipe 5/Tipe 1b'],
 [18,'Pupuk','Pupuk Amonium Sulfat (ZA)','SNI 02-1760-2005',PM26,'Tipe 5/Tipe 1b'],
 [18,'Pupuk','Pupuk Urea','SNI 2801:2010','Permenperin No. 73 Tahun 2024','Tipe 5'],
 [18,'Pupuk','Pupuk Mono Amonium Fosfat (MAP)','SNI 02-2810-2005',PB+' Lamp. XXV',''],
 [18,'Pupuk','Pupuk Diamonium Fosfat','SNI 02-2858-2005',PB+' Lamp. XXVII',''],
 [18,'Pupuk','Pupuk Urea Amonium Fosfat','SNI 02-2811-2005',PB+' Lamp. XXIII',''],
 [18,'Pupuk','Pupuk Tripel Super Fosfat plus-Zn','SNI 02-2800-2005',PB+' Lamp. XXVI',''],
 [18,'Pupuk','Pupuk Super Fosfat plus-Zn','SNI 02-4873-1998',PB+' Lamp. I',''],
 [18,'Pupuk','Pupuk Super Fosfat Tunggal (SP-18)','SNI 6246:2010',PB+' Lamp. XXIX',''],
 [18,'Pupuk','Pupuk Dolomit','SNI 02-2804-2005',PB+' Lamp. III',''],
 [18,'Pupuk','Pupuk Borat','SNI 02-4959-1999',PB+' Lamp. XXII',''],
 [18,'Pupuk','Pupuk Amonium Klorida','SNI 02-2581-2005',PB+' Lamp. XXIV',''],
 [18,'Pupuk','Pupuk Kiseret','SNI 02-2807-1992',PB+' Lamp. XXI',''],
 [18,'Pupuk','Pupuk Kalium Sulfat','SNI 2809:2014',PB+' Lamp. II',''],
 [18,'Pupuk','Pupuk Cair Hasil Samping Proses Asam Amino (Haspramin)','SNI 4958:2015',PB+' Lamp. XXVIII',''],
 [27,'Jasa','Pasar Rakyat','SNI 8152:2021','Peraturan BSN No. 7 Tahun 2024',''],
];
module.exports = { SPC, SP_PRODUCTS };
