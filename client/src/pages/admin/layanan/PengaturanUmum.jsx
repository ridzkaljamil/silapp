/** Pengaturan umum PSU: kontak (dipakai di seluruh aplikasi & email), identitas invoice, tanda tangan & stempel. */
import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../../../api';
import { PageHead, Loading, useToast, useConfirm } from '../../../components/ui';
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

const IMG = [
  ['ttd', 'Tanda Tangan', 'PNG berlatar transparan, maks. 1 MB. Jika tanda tangan dan stempel ada dalam satu gambar, cukup unggah di sini.'],
  ['stempel', 'Stempel', 'Opsional, PNG berlatar transparan. Dicetak menumpuk di belakang tanda tangan.'],
];

/** Gambar dari API (butuh token login), ditampilkan lewat URL sementara. */
function useApiImage(path, v) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!v) { setUrl(null); return undefined; }
    let u = null;
    api.get(`${path}?v=${v}`, { responseType: 'blob', silent: true }).then((r) => { u = URL.createObjectURL(r.data); setUrl(u); }).catch(() => setUrl(null));
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [path, v]);
  return url;
}

function ImageSlot({ kind, label, hint, v, onChange }) {
  const toast = useToast();
  const confirm = useConfirm();
  const url = useApiImage(`/superadmin/invoice-images/${kind}`, v);
  const upload = async (file) => {
    if (!file) return;
    if (!/\.(png|jpe?g)$/i.test(file.name)) return toast('Gambar harus PNG atau JPG.', 'danger');
    if (file.size > 1024 * 1024) return toast('Ukuran gambar maksimal 1 MB.', 'danger');
    const fd = new FormData(); fd.append('image', file);
    try { await api.post(`/superadmin/invoice-images/${kind}`, fd); toast(`${label} disimpan.`); onChange(); } catch (e) { toast(errMsg(e), 'danger'); }
    return null;
  };
  const del = async () => {
    if (!(await confirm({ title: `Hapus ${label}?`, body: 'Proforma invoice berikutnya dicetak tanpa gambar ini.', ok: 'Ya, Hapus', danger: true, icon: 'trash' }))) return;
    try { await api.delete(`/superadmin/invoice-images/${kind}`); toast(`${label} dihapus.`); onChange(); } catch (e) { toast(errMsg(e), 'danger'); }
  };
  return (
    <div className="sig-slot">
      <div className="small fw-semibold mb-2">{label}</div>
      <div className="sig-box">{url ? <img src={url} alt={label} /> : <span className="text-muted2 small">{v ? 'Memuat…' : 'Belum diunggah'}</span>}</div>
      <div className="small text-muted2 mt-2">{hint}</div>
      <div className="d-flex gap-2 mt-2">
        <input type="file" id={`img-${kind}`} accept=".png,.jpg,.jpeg" className="visually-hidden" onChange={(e) => { upload(e.target.files[0]); e.target.value = ''; }} />
        <label htmlFor={`img-${kind}`} className="btn btn-outline-secondary btn-sm"><i className="bi bi-upload" />{v ? 'Ganti' : 'Unggah'}</label>
        {v && <button type="button" className="btn btn-outline-danger btn-sm" onClick={del}><i className="bi bi-trash" />Hapus</button>}
      </div>
    </div>
  );
}

/** Tanda tangan & stempel digital yang dicetak di kolom tanda tangan proforma invoice. */
function SignaturePanel({ inv }) {
  const [v, setV] = useState(null);
  const load = useCallback(() => api.get('/superadmin/invoice-images').then((r) => setV(r.data)), []);
  useEffect(() => { load(); }, [load]);
  const ttd = useApiImage('/superadmin/invoice-images/ttd', v?.ttd);
  const stempel = useApiImage('/superadmin/invoice-images/stempel', v?.stempel);
  if (!v) return null;
  return (
    <section className="panel mb-4">
      <div className="panel-h"><div><h2 className="mb-0">Tanda Tangan &amp; Stempel</h2><div className="small text-muted2">Dicetak di kolom tanda tangan setiap proforma invoice. Kosongkan bila ingin ditandatangani basah.</div></div></div>
      <div className="panel-b">
        <div className="sig-grid">
          {IMG.map(([kind, label, hint]) => <ImageSlot key={kind} kind={kind} label={label} hint={hint} v={v[kind]} onChange={load} />)}
          <div className="sig-slot">
            <div className="small fw-semibold mb-2">Pratinjau di Proforma Invoice</div>
            <div className="sig-paper">
              <div>Hormat Kami,</div><div>{inv.company_name}</div>
              <div className="sig-img">{stempel && <img className="st" src={stempel} alt="" />}{ttd && <img src={ttd} alt="" />}</div>
              <div className="sig-name">{inv.signer_name || '(.................................)'}</div><div>{inv.signer_title}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

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
          <SignaturePanel inv={inv} />
        </>
      )}
    </>
  );
}
