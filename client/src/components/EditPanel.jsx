/**
 * Panel pengaturan dengan mode lihat & ubah: data tampil sebagai teks, tombol "Ubah" membuka form,
 * "Simpan" mengirim ke server lalu menampilkan data dari jawaban server (bukan data lama).
 */
import { Fragment, useState } from 'react';
import { errMsg } from '../api';
import { useToast, useConfirm } from './feedback';

export function EditPanel({ title, sub, fields, value, onSave, okText = 'Perubahan disimpan.' }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (busy || !(await confirm({ title: `Simpan ${title}?`, body: 'Perubahan langsung dipakai di aplikasi.', ok: 'Ya, Simpan', icon: 'floppy' }))) return;
    setBusy(true);
    try { await onSave(form); setForm(null); toast(okText); } catch (ex) { toast(errMsg(ex), 'danger'); } finally { setBusy(false); }
  };
  return (
    <section className="panel mb-3">
      <div className="panel-h">
        <div><h2 className="mb-0">{title}</h2>{sub && <span className="small text-muted2">{sub}</span>}</div>
        {!form && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setForm({ ...value })}><i className="bi bi-pencil" />Ubah</button>}
      </div>
      {!form ? (
        <dl className="panel-b dl-grid dl-wide mb-0">
          {fields.map((f) => (
            <Fragment key={f.key}>
              <dt>{f.label}</dt>
              <dd style={{ whiteSpace: 'pre-line' }}>{value[f.key] ? (f.show ? f.show(value[f.key]) : value[f.key]) : <span className="text-muted2">Belum diisi</span>}</dd>
            </Fragment>
          ))}
        </dl>
      ) : (
        <form className="panel-b" onSubmit={save}>
          <div className="row g-3">
            {fields.map((f) => (
              <div key={f.key} className={f.wide ? 'col-12' : 'col-md-6'}>
                <label className="form-label" htmlFor={`ep-${f.key}`}>{f.label}{f.required && <span className="text-danger"> *</span>}</label>
                {f.type === 'textarea'
                  ? <textarea id={`ep-${f.key}`} className="form-control" rows={2} value={form[f.key] ?? ''} required={f.required} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  : <input id={`ep-${f.key}`} className="form-control" type={f.type || 'text'} value={form[f.key] ?? ''} required={f.required} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />}
                {f.hint && <div className="form-text">{f.hint}</div>}
              </div>
            ))}
          </div>
          <div className="d-flex gap-2 justify-content-end mt-3">
            <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setForm(null)}>Batal</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </form>
      )}
    </section>
  );
}
