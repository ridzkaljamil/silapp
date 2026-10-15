const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  enableKeepAlive: true,
});

// sql_mode seperti bawaan MariaDB/XAMPP: sebagian hosting MySQL (mis. mode ANSI) membaca teks berkutip ganda
// ("selesai") sebagai nama kolom. Dengan ini query berjalan sama di XAMPP, Hostinger, maupun MySQL terkelola.
pool.pool.on('connection', (conn) => { conn.query("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'"); });

/** Jalankan query dengan prepared statement (aman dari SQL injection). */
async function q(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}
async function one(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0] || null;
}

/** Tutup semua koneksi (dipakai saat server dimatikan/di-restart). */
const end = () => pool.end().catch(() => {});

module.exports = { q, one, end };
