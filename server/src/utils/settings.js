const { q } = require('../config/db');

/** Identitas invoice resmi PSU (data dari PSU, Oktober 2026). */
const INVOICE_IDENTITY = {
  company_npwp: '43.419.874.3-008.000',
  company_address: 'Jalan Cipinang Muara 1 No. 21 RT. 006 RW.003 Kel. Pondok Bambu, Kec. Duren Sawit, DKI Jakarta',
  company_phone: '021-8602367',
  signer_name: 'Sofy Mariana',
  signer_title: 'Manager Keuangan',
  bank_name: 'BANK MANDIRI',
  bank_city: 'JAKARTA',
  bank_account: '124.00.111.93613',
};

/** Nilai bawaan pengaturan umum (dipakai jika belum ada di tabel settings). */
const DEFAULTS = {
  contact_phone: '+62 819-0834-4114',
  contact_email: 'psuindonesia.info@gmail.com',
  // identitas di invoice (diisi Super Admin di Kelola Layanan > Pengaturan Umum)
  company_name: 'PT PENILAI STANDAR UJI',
  company_address: INVOICE_IDENTITY.company_address,
  company_phone: INVOICE_IDENTITY.company_phone,
  company_npwp: INVOICE_IDENTITY.company_npwp,
  bank_name: INVOICE_IDENTITY.bank_name,
  bank_city: INVOICE_IDENTITY.bank_city,
  bank_account: INVOICE_IDENTITY.bank_account,
  bank_holder: 'PT PENILAI STANDAR UJI',
  signer_name: INVOICE_IDENTITY.signer_name,
  signer_title: INVOICE_IDENTITY.signer_title,
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

module.exports = { getSettings, setSetting, getContact, INVOICE_KEYS, INVOICE_IDENTITY };
