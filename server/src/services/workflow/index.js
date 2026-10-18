/**
 * Logika alur status SILAPP, sesuai Rancangan Sistem Tracking
 * LSPro (ST-01..ST-10), Laboratorium Pengujian (LAB-01..LAB-07), dan Laboratorium Kalibrasi (KAL-01..KAL-09).
 * Dipecah per bagian: core (data & aturan dasar), steps (aksi Admin per tahap), payment (invoice & pembayaran),
 * findings (temuan audit), customer (aksi pelanggan & survei).
 */
module.exports = {
  ...require('./core'),
  ...require('./steps'),
  ...require('./payment'),
  ...require('./findings'),
  ...require('./customer'),
};
