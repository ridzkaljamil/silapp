// Ruang lingkup dari lampiran akreditasi LSPR-051-IDN (LSPro) dan LP-1554-IDN (Lab Pengujian)

/* ---------- ruang lingkup (dari lampiran akreditasi) ---------- */
const PB='PBSN No. 4 Tahun 2021', PM26='Permenperin No. 26/M-IND/PER/4/2013';
const SPC={12:'Pertanian dan Perkebunan',15:'Produk Tanaman dan Turunannya',17:'Produk Pangan Lainnya',18:'Bahan dan Produk Kimia',27:'Sertifikasi Jasa'};
// [kategori, sub kategori, produk, SNI, acuan skema, tipe]
const SP_PRODUCTS=[
 [12,'Hasil pertanian & perkebunan','Beras','SNI 6128:2020',PB+' Lamp. XVII',''],
 [12,'Hasil pertanian & perkebunan','Biji kakao','SNI 2323:2008 / Amd1:2010',PB+' Lamp. XIII',''],
 [12,'Hasil pertanian & perkebunan','Biji kopi','SNI 2907:2008',PB+' Lamp. XIV',''],
 [15,'Serealia, umbi-umbian & turunannya','Biskuit','SNI 2973:2011','Permenperin No. 60/M-IND/PER/7/2015','Tipe 5'],
 [15,'Gula, produk gula, pati','Gula kristal putih','SNI 3140.3:2020','','Tipe 5'],
 [15,'Gula, produk gula, pati','Gula kristal rafinasi','SNI 3140.2:2018','','Tipe 5'],
 [15,'Gula, produk gula, pati','Gula kristal mentah','SNI 3140.1:2008','Kepmentan No. 03/Kpts/KB.410/1/2003','Tipe 5'],
 [15,'Kopi, teh, kakao, cokelat','Kopi instan','SNI 2983:2014','Permenperin No. 87/M-IND/PER/10/2014','Tipe 5/Tipe 1b'],
 [15,'Kopi, teh, kakao, cokelat','Kopi sangrai dan kopi bubuk','SNI 8964:2021','PBSN No. 4 Tahun 2024',''],
 [15,'Kopi, teh, kakao, cokelat','Kopi gula krimer dalam kemasan','SNI 7708:2011','PBSN No. 6 Tahun 2019 Lamp. XXXV',''],
 [15,'Kopi, teh, kakao, cokelat','Kakao bubuk','SNI 3747:2009','Permenperin No. 45/M-IND/PER/5/2009','Tipe 5/Tipe 1b'],
 [15,'Minyak nabati & lemak','Minyak goreng sawit','SNI 7709:2019','Permenperin No. 46 Tahun 2019','Tipe 5'],
 [15,'Minyak nabati & lemak','Minyak goreng','SNI 3741:2013','','Tipe 5'],
 [17,'Minuman','Air mineral','SNI 3553:2015','Permenperin No. 78/M-IND/PER/11/2016','Tipe 5/Tipe 4'],
 [17,'Minuman','Air demineral','SNI 6241:2015','Permenperin No. 78/M-IND/PER/11/2016','Tipe 5/Tipe 4'],
 [17,'Minuman','Air mineral alami','SNI 6242:2015','Permenperin No. 78/M-IND/PER/11/2016','Tipe 5'],
 [17,'Minuman','Air minum embun','SNI 7812:2013','Permenperin No. 78/M-IND/PER/11/2016','Tipe 5'],
 [18,'Pupuk','Pupuk super fosfat SP-36','SNI 02-3769-2005',PM26,'Tipe 5/Tipe 1b'],
 [18,'Pupuk','Pupuk fosfat alam untuk pertanian','SNI 02-3776-2005',PM26,'Tipe 5/Tipe 1b'],
 [18,'Pupuk','Pupuk kalium klorida','SNI 02-2805-2005',PM26,'Tipe 5/Tipe 1b'],
 [18,'Pupuk','Pupuk tripel super fosfat (TSP)','SNI 02-0086-2005',PM26,'Tipe 5/Tipe 1b'],
 [18,'Pupuk','Pupuk NPK padat','SNI 2803:2024','Permenperin No. 11 Tahun 2025','Tipe 5/Tipe 1b'],
 [18,'Pupuk','Pupuk amonium sulfat (ZA)','SNI 02-1760-2005',PM26,'Tipe 5/Tipe 1b'],
 [18,'Pupuk','Pupuk urea','SNI 2801:2010','Permenperin No. 73 Tahun 2024','Tipe 5'],
 [18,'Pupuk','Pupuk mono amonium fosfat (MAP)','SNI 02-2810-2005',PB+' Lamp. XXV',''],
 [18,'Pupuk','Pupuk diamonium fosfat','SNI 02-2858-2005',PB+' Lamp. XXVII',''],
 [18,'Pupuk','Pupuk urea amonium fosfat','SNI 02-2811-2005',PB+' Lamp. XXIII',''],
 [18,'Pupuk','Pupuk tripel super fosfat plus-Zn','SNI 02-2800-2005',PB+' Lamp. XXVI',''],
 [18,'Pupuk','Pupuk super fosfat plus-Zn','SNI 02-4873-1998',PB+' Lamp. I',''],
 [18,'Pupuk','Pupuk super fosfat tunggal (SP-18)','SNI 6246:2010',PB+' Lamp. XXIX',''],
 [18,'Pupuk','Pupuk dolomit','SNI 02-2804-2005',PB+' Lamp. III',''],
 [18,'Pupuk','Pupuk borat','SNI 02-4959-1999',PB+' Lamp. XXII',''],
 [18,'Pupuk','Pupuk amonium klorida','SNI 02-2581-2005',PB+' Lamp. XXIV',''],
 [18,'Pupuk','Pupuk kiseret','SNI 02-2807-1992',PB+' Lamp. XXI',''],
 [18,'Pupuk','Pupuk kalium sulfat','SNI 2809:2014',PB+' Lamp. II',''],
 [18,'Pupuk','Pupuk cair hasil samping proses asam amino (Haspramin)','SNI 4958:2015',PB+' Lamp. XXVIII',''],
 [27,'Jasa','Pasar rakyat','SNI 8152:2021','Peraturan BSN No. 7 Tahun 2024',''],
];
const AO='AOAC Ed. 20 (2016)';
const LAB_PRODUCTS=[
 {n:'Peralatan masak (cookware) dari logam', b:'Fisika/Kimia', p:[['Sifat tampak','SNI 8752:2020 butir 6.1.1'],['Ketajaman permukaan','SNI 8752:2020 butir 6.1.2'],['Bentuk (ukuran)','SNI 8752:2020 butir 6.2'],['Ketebalan bahan dasar','SNI 8752:2020 butir 6.3'],['Kekuatan penyambungan (tes fatigue)','SNI 8752:2020 butir 6.4'],['Kapasitas volume air','SNI 8752:2020 butir 6.5'],['Kelekatan lapisan anti lengket','SNI 8752:2020 butir 6.6'],['Ketahanan lapisan terhadap kejut panas','SNI 8752:2020 butir 6.7'],['Ketebalan lapisan','SNI 8752:2020 butir 6.8'],['Ketahanan terhadap asam','SNI 8752:2020 butir 6.9'],['Kestabilan produk','SNI 8752:2020 butir 6.10']]},
 {n:'Peralatan makan & masak baja tahan karat (flatware)', b:'Fisika/Kimia', p:[['Sifat tampak & ketajaman permukaan','SNI 8753:2020 butir 8.1'],['Ketebalan','SNI 8753:2020 butir 8.2'],['Ukuran panjang','SNI 8753:2020 butir 8.3'],['Kapasitas volume','SNI 8753:2020 butir 8.4'],['Ketahanan terhadap pembebanan','SNI 8753:2020 butir 8.6']]},
 {n:'Pupuk SP-36', b:'Kimia/Fisika', p:[['P₂O₅ total',AO+' butir 2.3.01 & 2.3.02'],['P₂O₅ larut dalam asam sitrat 2%','SNI 02-3769-2005 butir 6.1.2'],['P₂O₅ larut dalam air',AO+' butir 2.3.06 & 2.3.09'],['Kadar belerang (S)','IKM-Lab-PSN-01 (spektrofotometri)'],['Kadar asam bebas (H₃PO₄)','SNI 02-3769-2005 butir 6.3'],['Kadar air',AO+' butir 2.2.01']]},
 {n:'Pupuk fosfat alam untuk pertanian', b:'Kimia/Fisika', p:[['P₂O₅ total',AO+' butir 2.3.01 & 2.3.02'],['P₂O₅ larut dalam asam sitrat 2%','SNI 02-3776-2005 butir 6.1.2'],['Kadar air',AO+' butir 2.2.01'],['Kehalusan lolos 80 mesh Tyler','SNI 02-3776-2005 butir 6.3'],['Kehalusan lolos 25 mesh Tyler','SNI 02-3776-2005 butir 6.3'],['Cemaran kadmium (Cd)','SNI 02-3776-2005 butir 6.4.1'],['Cemaran timbal (Pb)','SNI 02-3776-2005 butir 6.4.2']]},
 {n:'Pupuk kalium klorida', b:'Kimia/Fisika', p:[['Kadar kalium (K₂O)',AO+' butir 2.5.07'],['Kadar air',AO+' butir 2.2.01']]},
 {n:'Pupuk tripel super fosfat (TSP)', b:'Kimia/Fisika', p:[['P₂O₅ total',AO+' butir 2.3.01 & 2.3.02'],['P₂O₅ larut dalam asam sitrat 2%','SNI 02-0086-2005 butir 6.1.2'],['P₂O₅ larut dalam air',AO+' butir 2.3.06 & 2.3.09'],['Kadar asam bebas (H₃PO₄)','SNI 02-0086-2005 butir 6.2'],['Kadar air',AO+' butir 2.2.01'],['Cemaran kadmium (Cd)','SNI 02-0086-2005 butir 6.4.1'],['Cemaran timbal (Pb)','SNI 02-0086-2005 butir 6.4.2']]},
 {n:'Pupuk NPK padat', b:'Kimia', p:[['Nitrogen total','SNI 2803:2024 butir 6.2.1'],['Fosfor total (P₂O₅)','SNI 2803:2024 butir 6.3.1'],['Kadar kalium (K₂O)','SNI 2803:2024 butir 6.4.1'],['Jumlah kadar N, P₂O₅, K₂O','SNI 2803:2024'],['Cemaran kadmium (Cd)','SNI 2803:2024 butir 6.6.2'],['Cemaran timbal (Pb)','SNI 2803:2024 butir 6.6.3'],['Kadar air','SNI 2803:2024']]},
 {n:'Pupuk amonium sulfat (ZA)', b:'Kimia', p:[['Kadar nitrogen','ISO 3332:1975'],['Kadar belerang (S)','SNI 02-1760-2005 butir 6.2.2'],['Asam bebas (H₂SO₄)','ISO 2993:1974'],['Kadar air',AO+' butir 2.2.01']]},
 {n:'Pupuk urea', b:'Kimia', p:[['Kadar nitrogen','SNI 2801:2010 butir 6.1.1'],['Ukuran 1,00–3,35 mm','SNI 2801:2010 butir 6.4'],['Ukuran 2,00–4,75 mm','SNI 2801:2010 butir 6.4'],['Kadar air','SNI 2801:2010'],['Kadar biuret','SNI 2801:2010']]},
];


module.exports = { SPC, SP_PRODUCTS, LAB_PRODUCTS };
