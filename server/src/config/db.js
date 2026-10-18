const mysql = require('mysql2/promise');

/**
 * Pool koneksi MySQL.
 * DB_POOL_LIMIT : jumlah koneksi (default 10; di Vercel cukup 3 karena tiap fungsi punya pool sendiri)
 * DB_SSL=true   : koneksi terenkripsi (untuk database di server lain bila mendukung SSL)
 * DB_TIMEZONE   : zona waktu sesi MySQL agar NOW() selalu WIB walau server database memakai zona lain
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: +process.env.DB_POOL_LIMIT || 10,
  maxIdle: +process.env.DB_POOL_LIMIT || 10,
  idleTimeout: 60000,
  connectTimeout: 15000,
  dateStrings: true,
  enableKeepAlive: true,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_STRICT !== 'false' } : undefined,
});

const TZ = process.env.DB_TIMEZONE || '+07:00';
// sql_mode disamakan dengan bawaan MariaDB/XAMPP: penyedia MySQL terkelola (mis. Aiven) memakai mode ANSI,
// yang membuat teks berkutip ganda ("selesai") dibaca sebagai nama kolom.
const SQL_MODE = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
pool.pool.on('connection', (conn) => {
  conn.query(`SET time_zone = ${pool.escape(TZ)}`);
  conn.query(`SET SESSION sql_mode = ${pool.escape(SQL_MODE)}`);
});

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
