/** Pengaturan umum PSU: kontak (dipakai di seluruh aplikasi & email) dan identitas invoice. */
import { useEffect, useState } from 'react';
import api from '../../../api';
import { PageHead, Loading } from '../../../components/ui';
import { EditPanel } from '../../../components/EditPanel';
import { useContact, setContactCache } from '../../../lib/contact';

const INVOICE_FIELDS = [
  { key: 'company_name', label: 'Nama Perusahaan', required: true },
  { key: 'company_npwp', label: 'NPWP Perusahaan' },
  { key: 'company_address', label: 'Alamat Perusahaan', type: 'textarea', wide: true },
  { key: 'company_phone', label: 'Telepon Kantor', hint: 'Kosongkan untuk memakai nomor WhatsApp di atas.' },
  { key: 'invoice_code', label: 'Kode di Nomor Invoice', required: true, hint: 'Contoh PSU → 001/PSU/KIM/X/2026 (urut/kode perusahaan/kode layanan/bulan/tahun, urutan per layanan)', show: (v) => `001/${v}/KIM/…` },
  { key: 'invoice_due_days', label: 'Jatuh Tempo Default (Hari)', type: 'number', show: (v) => `${v} hari setelah invoice terbit` },
  { key: 'bank_name', label: 'Nama Bank' },
  { key: 'bank_city', label: 'Kota Bank' },
  { key: 'bank_account', label: 'Nomor Rekening' },
  { key: 'bank_holder', label: 'Nama Pemilik Rekening' },
  { key: 'signer_name', label: 'Nama Penanda Tangan' },
  { key: 'signer_title', label: 'Jabatan Penanda Tangan' },
];

export default function PengaturanUmum() {
  const contact = useContact();
  const [inv, setInv] = useState(null);
  useEffect(() => { api.get('/superadmin/invoice-settings').then((r) => setInv(r.data)); }, []);
  const missing = inv && ['company_address', 'company_npwp', 'bank_name', 'bank_account', 'signer_name'].filter((k) => !inv[k]).length;
  return (
    <>
      <PageHead sub="Kontak PSU dipakai di footer halaman publik, tombol WhatsApp/Email, dan email notifikasi. Identitas invoice dicetak di setiap invoice PDF." />
      <EditPanel title="Kontak Umum PSU" sub="Tampil di halaman publik, halaman Masuk, dan email notifikasi." okText="Kontak PSU disimpan."
        fields={[{ key: 'phone', label: 'No. WhatsApp / CP', required: true }, { key: 'email', label: 'Email', type: 'email', required: true }]}
        value={contact} onSave={async (v) => setContactCache((await api.put('/superadmin/contact', v)).data)} />
      {!inv ? <Loading /> : (
        <>
          {missing > 0 && <div className="alert alert-warning small">Lengkapi alamat, NPWP, rekening bank, dan penanda tangan agar invoice yang dicetak lengkap.</div>}
          <EditPanel title="Identitas Proforma Invoice" sub="Kop, detail pembayaran, dan tanda tangan di proforma invoice PDF." okText="Identitas proforma invoice disimpan."
            fields={INVOICE_FIELDS} value={inv} onSave={async (v) => setInv((await api.put('/superadmin/invoice-settings', v)).data)} />
        </>
      )}
    </>
  );
}
