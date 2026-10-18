/**
 * Membuat database/silapp-init.sql: struktur tabel + data master (tanpa akun dan tanpa data contoh),
 * untuk di-import lewat phpMyAdmin di server hosting.
 *
 * Dijalankan di komputer pengembang (MySQL XAMPP menyala): npm run db:sql
 * Prosesnya memakai database sementara "<DB_NAME>_init_tmp", jadi database pengembangan tidak tersentuh.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const mysql = require('mysql2/promise');

const OUT = path.join(__dirname, 'silapp-init.sql');
const TMP = `${process.env.DB_NAME || 'silapp'}_init_tmp`;

(async () => {
  const cfg = { host: process.env.DB_HOST, port: +process.env.DB_PORT || 3306, user: process.env.DB_USER, password: process.env.DB_PASS, dateStrings: true };
  const admin = await mysql.createConnection(cfg);
  await admin.query(`DROP DATABASE IF EXISTS \`${TMP}\``);
  await admin.query(`CREATE DATABASE \`${TMP}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  try {
    // isi database sementara dengan data master (seed mode bersih)
    execFileSync(process.execPath, [path.join(__dirname, 'seed.js'), '--bersih'], {
      stdio: 'inherit', env: { ...process.env, DB_NAME: TMP, NODE_ENV: 'development' },
    });

    const conn = await mysql.createConnection({ ...cfg, database: TMP });
    // pembaruan data lama (migrasi sekali jalan) tidak relevan untuk database baru: tandai sudah dijalankan
    const { FRESH_DONE } = require('../src/config/migrate');
    for (const name of FRESH_DONE) await conn.query('INSERT INTO settings (skey, svalue) VALUES (?, NOW())', [`migr:${name}`]);
    // struktur dari schema.sql, tanpa blok DROP TABLE: bila tabel sudah ada, import gagal alih-alih menghapus data
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
      .replace(/SET FOREIGN_KEY_CHECKS = 0;\s*DROP TABLE IF EXISTS[\s\S]*?;\s*SET FOREIGN_KEY_CHECKS = 1;/, '')
      // charset eksplisit: database baru di cPanel bisa memakai charset bawaan server (mis. latin1)
      .replace(/\) ENGINE=InnoDB;/g, ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;');
    const tables = (await conn.query('SHOW TABLES'))[0].map((r) => Object.values(r)[0]);
    let data = '';
    let rowsTotal = 0;
    for (const t of tables) {
      const [rows] = await conn.query(`SELECT * FROM \`${t}\``);
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]).map((c) => `\`${c}\``).join(', ');
      data += `\n-- ${t} (${rows.length} baris)\n`;
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100).map((r) => `(${Object.values(r).map((v) => conn.escape(v)).join(', ')})`);
        data += `INSERT INTO \`${t}\` (${cols}) VALUES\n${chunk.join(',\n')};\n`;
      }
      rowsTotal += rows.length;
    }
    await conn.end();

    const header = `-- =========================================================
-- SILAPP · data awal untuk server hosting
-- Dibuat: ${new Date().toISOString().slice(0, 10)} (npm run db:sql)
-- Isi   : struktur tabel + data master (layanan, tahapan, form, ruang lingkup & harga, survei, pengaturan).
--         Tanpa akun pengguna dan tanpa data contoh.
-- Cara  : phpMyAdmin > pilih database SILAPP yang masih kosong > Import > pilih file ini > Go.
--         Akun Super Admin pertama dibuat dari SUPERADMIN_EMAIL & SUPERADMIN_PASSWORD di server/.env.
-- =========================================================
`;
    const sql = `${header}${schema.trim()}\n\nSET FOREIGN_KEY_CHECKS = 0;\n${data}\nSET FOREIGN_KEY_CHECKS = 1;\n`;
    fs.writeFileSync(OUT, sql);
    console.log(`✓ ${path.relative(process.cwd(), OUT)} dibuat (${tables.length} tabel, ${rowsTotal} baris data master).`);
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS \`${TMP}\``);
    await admin.end();
  }
})().catch((e) => {
  const hint = {
    ECONNREFUSED: 'MySQL belum berjalan. Nyalakan MySQL di XAMPP lalu ulangi.',
    ER_DBACCESS_DENIED_ERROR: `User database "${process.env.DB_USER}" tidak boleh membuat database sementara ${TMP}. Pakai DB_USER=root (bawaan XAMPP) di server/.env.`,
  }[e.code];
  console.error(hint ? `\n✗ ${hint}\n` : e);
  process.exit(1);
});
