const { q } = require('../config/db');

/** Nilai bawaan pengaturan umum (dipakai jika belum ada di tabel settings). */
const DEFAULTS = {
  contact_phone: '+62 819-0834-4114',
  contact_email: 'psuindonesia.info@gmail.com',
  // identitas di invoice (diisi Super Admin di Kelola Layanan > Pengaturan Umum)
  company_name: 'PT PENILAI STANDAR UJI',
  company_address: '',
  company_phone: '',
  company_npwp: '',
  bank_name: '',
  bank_city: '',
  bank_account: '',
  bank_holder: 'PT PENILAI STANDAR UJI',
  signer_name: '',
  signer_title: 'Direktur Utama',
  invoice_code: 'PSU',
  invoice_due_days: '14',
};
/** Kunci pengaturan identitas invoice yang boleh diubah Super Admin. */
const INVOICE_KEYS = ['company_name', 'company_address', 'company_phone', 'company_npwp', 'bank_name', 'bank_city', 'bank_account', 'bank_holder',
  'signer_name', 'signer_title', 'invoice_code', 'invoice_due_days'];

/** Ambil beberapa pengaturan sekaligus: getSettings(['contact_phone', ...]) → { contact_phone: '...' } */
async function getSettings(keys) {
  const rows = await q('SELECT skey, svalue FROM settings WHERE skey IN (?)', [keys]);
  const out = Object.fromEntries(keys.map((k) => [k, DEFAULTS[k] ?? null]));
  for (const r of rows) out[r.skey] = r.svalue;
  return out;
}

const setSetting = (key, value) => q('INSERT INTO settings (skey, svalue) VALUES (?, ?) ON DUPLICATE KEY UPDATE svalue=VALUES(svalue)', [key, value]);

/** Kontak umum PSU (WhatsApp & email). */
const getContact = async () => {
  const s = await getSettings(['contact_phone', 'contact_email']);
  return { phone: s.contact_phone, email: s.contact_email };
};

module.exports = { getSettings, setSetting, getContact, INVOICE_KEYS };
