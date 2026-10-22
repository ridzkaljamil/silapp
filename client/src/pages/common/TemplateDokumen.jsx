/**
 * Template dokumen untuk diunduh pelanggan (Word, PDF, atau Excel).
 * Super Admin dan Admin dapat menambah, mengganti (nama, keterangan, file), dan menghapus template.
 */
import { useCallback, useEffect, useState } from 'react';
import api, { errMsg, download } from '../../api';
import { useAuth } from '../../AuthContext';
import { PageHead, Loading, useToast, useConfirm, fmtDate, FormSheet, FileDrop } from '../../components/ui';

const ACCEPT = '.doc,.docx,.pdf,.xls,.xlsx';
const iconOf = (name) => (/\.pdf$/i.test(name) ? 'file-earmark-pdf' : /\.xlsx?$/i.test(name) ? 'file-earmark-excel' : 'file-earmark-word');

export default function TemplateDokumen() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null); // { id?, name, description, file[] }
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get('/templates').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Loading />;
  const staff = ['admin', 'superadmin'].includes(user.role);
  const isNew = form && !form.id;

  const save = async () => {
    if (isNew && !form.file.length) return toast('Pilih file template.', 'danger');
    const fd = new FormData();
    fd.append('name', form.name);
    fd.append('description', form.description || '');
    if (form.file[0]) fd.append('file', form.file[0]);
    setBusy(true);
    try {
      if (isNew) await api.post('/templates', fd); else await api.put(`/templates/${form.id}`, fd);
      toast(isNew ? `Template ${form.name} ditambahkan.` : `Template ${form.name} disimpan.`);
      setForm(null); load();
    } catch (e) { toast(errMsg(e), 'danger'); } finally { setBusy(false); }
    return null;
  };
  const del = async (t) => {
    if (!(await confirm({ title: 'Hapus Template?', body: <>Template <b>{t.name}</b> dihapus dan tidak bisa diunduh pelanggan lagi. Jika namanya sama dengan berkas di Form Pengajuan, tombol "Unduh Template" di form itu ikut hilang.</>, ok: 'Ya, Hapus', danger: true, icon: 'trash' }))) return;
    try { await api.delete(`/templates/${t.id}`); toast('Template dihapus.'); load(); } catch (e) { toast(errMsg(e), 'danger'); }
  };

  return (
    <>
      <PageHead eyebrow="Dokumen" title="Template Dokumen"
        sub={staff ? 'Template yang diunduh pelanggan saat mengajukan layanan (Word, PDF, atau Excel). Template yang namanya sama dengan berkas di Form Pengajuan muncul sebagai tombol "Unduh Template" di form itu.' : 'Unduh, isi, lalu tanda tangani template berikut. Unggah hasilnya saat mengajukan layanan.'}>
        {staff && <button className="btn btn-primary" onClick={() => setForm({ name: '', description: '', file: [] })}><i className="bi bi-plus-lg" />Tambah Template</button>}
      </PageHead>
      <FormSheet open={!!form} onClose={() => setForm(null)} onSubmit={save} busy={busy} icon={isNew ? 'file-earmark-plus' : 'arrow-repeat'}
        title={isNew ? 'Tambah Template' : 'Ubah Template'} sub={isNew ? 'Template langsung bisa diunduh pelanggan setelah disimpan.' : form?.original_name}
        confirm={() => ({ title: isNew ? 'Tambah Template?' : 'Simpan Template?', body: <>Template <b>{form?.name}</b> {isNew ? 'ditambahkan' : 'diperbarui'} dan langsung bisa diunduh pelanggan.</>, icon: 'file-earmark-check' })}>
        {form && (
          <div className="d-flex flex-column gap-3">
            <div><label className="form-label" htmlFor="tn">Nama Template</label>
              <input id="tn" className="form-control" minLength={3} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. Surat Kuasa" required /></div>
            <div><label className="form-label" htmlFor="td">Keterangan</label>
              <input id="td" className="form-control" maxLength={255} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Kapan template ini dipakai" /></div>
            <div><label className="form-label" htmlFor="tf">{isNew ? 'File Template' : 'Ganti File (opsional)'}</label>
              <FileDrop id="tf" accept={ACCEPT} files={form.file} onChange={(f) => setForm({ ...form, file: f })} label={isNew ? 'Pilih file template' : 'Pilih file pengganti'} hint="Word, PDF, atau Excel" /></div>
          </div>
        )}
      </FormSheet>
      <section className="panel">
        <ul className="tpl-list">
          {rows.map((t) => (
            <li key={t.id}>
              <span className="tpl-ic" aria-hidden="true"><i className={`bi bi-${iconOf(t.original_name)}`} /></span>
              <span className="tpl-tx">
                <b>{t.name}</b>
                {t.description && <span>{t.description}</span>}
                <span className="small text-muted2">{t.original_name} · diperbarui {fmtDate(t.updated_at)}</span>
              </span>
              <span className="tpl-acts">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => download(`/templates/${t.id}/download`, t.original_name)}><i className="bi bi-download" />Unduh</button>
                {staff && (
                  <>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setForm({ ...t, description: t.description || '', file: [] })}><i className="bi bi-arrow-repeat" />Ganti</button>
                    <button type="button" className="btn btn-outline-danger btn-sm" title="Hapus" aria-label={`Hapus ${t.name}`} onClick={() => del(t)}><i className="bi bi-trash" /></button>
                  </>
                )}
              </span>
            </li>
          ))}
          {!rows.length && <li className="text-muted2 justify-content-center">Belum ada template.</li>}
        </ul>
      </section>
    </>
  );
}
