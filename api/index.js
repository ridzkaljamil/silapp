/**
 * Fungsi serverless Vercel: seluruh API SILAPP (/api/*) dilayani aplikasi Express yang sama dengan server biasa.
 * Halaman React (client/dist) disajikan langsung oleh CDN Vercel; lihat vercel.json.
 */
module.exports = require('../server/src/app');
