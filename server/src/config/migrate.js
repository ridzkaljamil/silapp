const { q } = require('./db');

/** Kolom yang ditambahkan setelah rilis awal. Ditambahkan otomatis jika belum ada. */
const COLUMNS = [
  ['users', 'avatar', 'VARCHAR(255) NULL AFTER address'],
];

module.exports = async function migrate() {
  for (const [table, column, def] of COLUMNS) {
    const rows = await q(
      'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [table, column]);
    if (!rows.length) {
      await q(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${def}`);
      console.log(`> kolom ${table}.${column} ditambahkan`);
    }
  }
};
