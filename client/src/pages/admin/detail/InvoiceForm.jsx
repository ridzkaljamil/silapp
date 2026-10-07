import { useState } from 'react';
import api, { errMsg } from '../../../api';
import { useToast, rupiah } from '../../../components/ui';

/** Form invoice: SP & Kalibrasi nominal kesepakatan; Lab dihitung dari daftar harga. */
export default function InvoiceForm({ app, onSaved }) {
  const toast = useToast();
  const isLab = !['SP', 'KAL'].includes(app.service_code);
  const prev = app.payment?.status === 'invoice' ? app.payment : null;
  const [f, setF] = useState({ amount: prev && !isLab ? String(prev.amount) : '', due_date: prev?.due_date || '', note: prev?.note || '' });
  const custom = app.parameters.filter((p) => p.is_custom);
  const [cp, setCp] = useState(Object.fromEntries(custom.map((p) => [p.id, p.price ?? ''])));
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const qty = app.samples.reduce((t, s) => t + (+s.quantity || 0), 0) || 1;
  const listed = app.parameters.filter((p) => !p.is_custom);
  const preview = isLab ? (app.full_sni ? null : listed.reduce((t, p) => t + (+p.price || 0), 0) * qty) + custom.reduce((t, p) => t + (+cp[p.id] || 0), 0) * qty + (+f.amount || 0) : +f.amount || 0;
  const save = async () => {
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, v));
    fd.append('custom_prices', JSON.stringify(cp));
    if (file) fd.append('invoice_file', file);
    setBusy(true);
    try { onSaved((await api.post(`/admin/applications/${app.id}/invoice`, fd)).data); toast(prev ? 'Invoice diperbarui.' : 'Invoice terbit dan dikirim ke pelanggan.'); } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
  };
  return (
    <div className="d-flex flex-column gap-2">
      <span className="small text-muted2">Harga sudah termasuk PPN 11%.</span>
      {isLab ? (
        <>
          <div className="small">{app.full_sni ? 'Paket parameter lengkap sesuai SNI (harga paket dari daftar harga)' : `${listed.length} parameter dari daftar harga`} × {qty} sampel{!app.full_sni && <> = <b className="num">{rupiah(listed.reduce((t, p) => t + (+p.price || 0), 0) * qty)}</b></>}</div>
          {custom.map((p) => (
            <div key={p.id} className="input-group input-group-sm">
              <span className="input-group-text text-truncate" style={{ maxWidth: '60%' }} title={p.name}>Lainnya: {p.name}</span>
              <input type="number" min={0} className="form-control" aria-label={`Harga ${p.name}`} placeholder="Harga per sampel" value={cp[p.id]} onChange={(e) => setCp({ ...cp, [p.id]: e.target.value })} />
            </div>
          ))}
          <label className="form-label mb-0 small" htmlFor="ia">Biaya tambahan (opsional)</label>
        </>
      ) : <label className="form-label mb-0 small" htmlFor="ia">Nominal invoice (hasil kesepakatan, termasuk PPN)</label>}
      <input id="ia" type="number" min={0} className="form-control form-control-sm" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
      {!(isLab && app.full_sni) && <div className="small">Total: <b className="num">{rupiah(preview)}</b></div>}
      <div className="row g-2">
        <div className="col-6"><label className="form-label mb-0 small" htmlFor="idd">Batas bayar</label><input id="idd" type="date" className="form-control form-control-sm" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></div>
        <div className="col-6"><label className="form-label mb-0 small" htmlFor="iff">File invoice (PDF)</label><input id="iff" type="file" accept=".pdf" className="form-control form-control-sm" onChange={(e) => setFile(e.target.files[0])} /></div>
      </div>
      <input className="form-control form-control-sm" placeholder="Catatan (mis. nomor rekening, termin)" aria-label="Catatan invoice" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <button className="btn btn-primary mt-1" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : prev ? 'Simpan perubahan invoice' : 'Terbitkan & kirim ke pelanggan'}</button>
    </div>
  );
}
