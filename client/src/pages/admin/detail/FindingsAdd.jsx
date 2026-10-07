import { useState } from 'react';
import api, { errMsg } from '../../../api';
import { useToast, Sheet, Select } from '../../../components/ui';

/** Input laporan audit + temuan (SP, ST-05 s.d. ST-07) — dibuka sebagai pop-up. */
export default function FindingsAdd({ app, onSaved }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(app.audit_report_date || new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([{ category: 'minor', description: '', due_date: '' }]);
  const [busy, setBusy] = useState(false);
  const add = (m) => { const d = new Date(`${date}T00:00:00`); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10); };
  const auto = (c) => (c === 'mayor' ? add(1) : c === 'minor' ? add(2) : '');
  const set = (i, k, v) => setItems(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = async () => {
    if (items.some((x) => !x.description.trim())) return toast('Isi uraian setiap temuan.', 'danger');
    setBusy(true);
    try {
      const r = await api.post(`/admin/applications/${app.id}/findings`, { report_date: date, items: items.map((x) => ({ ...x, due_date: x.due_date || undefined })) });
      onSaved(r.data); setOpen(false); setItems([{ category: 'minor', description: '', due_date: '' }]); toast('Temuan dicatat dan dikirim ke pelanggan.');
    } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
  };
  return (
    <>
      <button className="btn btn-outline-secondary btn-sm" onClick={() => setOpen(true)}><i className="bi bi-plus-lg" />Input temuan audit</button>
      <Sheet open={open} onClose={() => setOpen(false)} wide icon="clipboard-plus" title="Input temuan audit" sub="Tenggat otomatis: mayor 1 bulan, minor 2 bulan sejak tanggal laporan. Bisa diubah."
        footer={<><button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Batal</button><button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan & kirim ke pelanggan'}</button></>}>
        <div className="d-flex flex-column gap-3">
          <div><label className="form-label" htmlFor="ard">Tanggal laporan audit</label><input id="ard" type="date" className="form-control" style={{ maxWidth: 200 }} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          {items.map((it, i) => (
            <div key={i} className="f-row">
              <div className="d-flex gap-2 flex-wrap">
                <Select className="form-select" style={{ maxWidth: 150 }} aria-label="Kategori" value={it.category} onChange={(e) => set(i, 'category', e.target.value)}><option value="mayor">Mayor</option><option value="minor">Minor</option><option value="observasi">Observasi</option></Select>
                {it.category !== 'observasi'
                  ? <input type="date" className="form-control" style={{ maxWidth: 180 }} aria-label="Tenggat" title="Tenggat (otomatis, bisa diubah)" value={it.due_date || auto(it.category)} onChange={(e) => set(i, 'due_date', e.target.value)} />
                  : <span className="small text-muted2 align-self-center">tanpa tenggat</span>}
                {items.length > 1 && <button type="button" className="btn btn-link text-danger ms-auto" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Hapus baris"><i className="bi bi-trash" /></button>}
              </div>
              <textarea rows={2} className="form-control mt-2" placeholder="Uraian temuan" aria-label="Uraian temuan" value={it.description} onChange={(e) => set(i, 'description', e.target.value)} />
            </div>
          ))}
          <button type="button" className="btn btn-outline-secondary btn-sm align-self-start" onClick={() => setItems([...items, { category: 'minor', description: '', due_date: '' }])}><i className="bi bi-plus-lg" />Tambah baris</button>
        </div>
      </Sheet>
    </>
  );
}
