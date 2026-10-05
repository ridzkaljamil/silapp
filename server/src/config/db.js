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

module.exports = { pool, q, one };
