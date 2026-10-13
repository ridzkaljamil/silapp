import { useState } from 'react';
import api, { errMsg } from '../../../api';
import { useToast } from '../../../components/ui';

/** Lab pengujian: kode / identitas sampel diisi Admin saat sampel diterima & diregistrasi. */
export default function SampleCodeForm({ app, onSaved }) {
  const toast = useToast();
  const cur = app.details.find((d) => d.key === 'kode_sampel')?.value || '';
  const [v, setV] = useState(cur);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { onSaved((await api.post(`/admin/applications/${app.id}/sample-code`, { code: v })).data); toast('Kode sampel disimpan.'); } catch (ex) { toast(errMsg(ex), 'danger'); } finally { setBusy(false); }
  };
  return (
    <section className="panel panel-b">
      <h2 className="mb-1">Kode Sampel</h2>
      <p className="small text-muted2 mb-2">Diisi Admin saat sampel diterima dan diregistrasi. Tampil juga di detail pengajuan pelanggan.</p>
      <form className="d-flex gap-2" onSubmit={save}>
        <input className="form-control" aria-label="Kode Sampel" placeholder="Contoh: KIM-2610-001" value={v} onChange={(e) => setV(e.target.value)} />
        <button className="btn btn-primary text-nowrap" disabled={busy || v === cur}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
      </form>
    </section>
  );
}
