import { useState } from 'react';
import api, { errMsg } from '../../../api';
import { useToast, FileDrop } from '../../../components/ui';

/** Info pengujian lab untuk Sertifikasi Produk (ST-06): panel di kolom utama. */
export default function LabInfoForm({ app, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ lab_name: app.lab_info?.name || 'Laboratorium Pengujian PSU', lab_estimate: app.lab_info?.estimate || '', lab_link: app.lab_info?.link || '' });
  const [files, setFiles] = useState([]);
  const [k, setK] = useState(0);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const fd = new FormData(); Object.entries(f).forEach(([key, v]) => fd.append(key, v)); [...files].forEach((x) => fd.append('lhu', x));
    setBusy(true);
    try { onSaved((await api.post(`/admin/applications/${app.id}/lab-info`, fd)).data); setFiles([]); setK(k + 1); toast('Info pengujian lab diperbarui dan tampil ke pelanggan.'); } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
  };
  const lhu = app.documents.filter((d) => d.doc_type === 'Laporan Hasil Uji (LHU)');
  return (
    <section className="panel">
      <div className="panel-h"><h2 className="mb-0">Info pengujian laboratorium</h2><span className="small text-muted2">tampil ke pelanggan</span></div>
      <div className="panel-b d-flex flex-column gap-3">
        <div className="row g-3">
          <div className="col-md-6"><label className="form-label" htmlFor="li-n">Laboratorium</label><input id="li-n" className="form-control" value={f.lab_name} onChange={(e) => setF({ ...f, lab_name: e.target.value })} placeholder="PSU / lab lain" /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="li-e">Estimasi selesai</label><input id="li-e" className="form-control" value={f.lab_estimate} onChange={(e) => setF({ ...f, lab_estimate: e.target.value })} placeholder="mis. 10 hari kerja" /></div>
          <div className="col-12"><label className="form-label" htmlFor="li-l">Tautan LHU <span className="fw-normal text-muted2">(opsional)</span></label><input id="li-l" className="form-control" value={f.lab_link} onChange={(e) => setF({ ...f, lab_link: e.target.value })} placeholder="https://…" /></div>
        </div>
        <FileDrop key={k} id="lhu" multiple files={files} onChange={setFiles} label="Unggah LHU" hint="atau tempel tautan hasil lab di atas · PDF, maks. 10 MB" />
        {lhu.length > 0 && <div>{lhu.map((d) => <span key={d.id} className="file-chip"><i className="bi bi-paperclip" />{d.original_name}</span>)}</div>}
        <button className="btn btn-outline-primary align-self-start" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan info lab'}</button>
      </div>
    </section>
  );
}
