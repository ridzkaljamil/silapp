/** Data sertifikat: hasil SILAPP + proyek sebelum SILAPP (tampil di Directory). */
import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../../api';
import { PageHead, Loading, useToast, useConfirm, fmtDate, MobileList, Select } from '../../components/ui';

const LEG = { id: null, factory_name: '', factory_address: '', product: '', sni_no: '', certificate_no: '', issued_at: '', status: 'aktif' };
const StatusCert = ({ v }) => <span className={`pill ${v === 'aktif' ? 'pill-done' : 'pill-closed'}`}>{v === 'aktif' ? 'Aktif' : 'Tidak Aktif'}</span>;

export default function DataSertifikat() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null);
  const [q, setQ] = useState('');
  const load = useCallback(() => api.get('/certificates').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Loading />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try { if (form.id) await api.put(`/certificates/legacy/${form.id}`, form); else await api.post('/certificates/legacy', form); toast('Data sertifikat disimpan.'); setForm(null); load(); } catch (ex) { toast(errMsg(ex), 'danger'); }
  };
  const toggle = async (r) => {
    const status = r.status === 'aktif' ? 'tidak_aktif' : 'aktif';
    try {
      if (r.source === 'silapp') await api.patch(`/certificates/silapp/${r.id}`, { status });
      else await api.put(`/certificates/legacy/${r.id}`, { ...r, status });
      load();
    } catch (ex) { toast(errMsg(ex), 'danger'); }
  };
  const del = async (r) => {
    if (!(await confirm({ title: 'Hapus data?', body: <>Hapus sertifikat <b>{r.certificate_no}</b> dari data proyek lama?</>, ok: 'Hapus', danger: true }))) return;
    await api.delete(`/certificates/legacy/${r.id}`); load();
  };
  const list = rows.filter((r) => `${r.certificate_no} ${r.factory_name} ${r.product}`.toLowerCase().includes(q.toLowerCase()));
  const F = [['factory_name', 'Nama pabrik', 'text'], ['factory_address', 'Alamat pabrik (kota/provinsi)', 'text'], ['product', 'Produk', 'text'], ['sni_no', 'Nomor SNI', 'text'], ['certificate_no', 'Nomor sertifikat', 'text'], ['issued_at', 'Tanggal terbit', 'date']];
  return (
    <>
      <PageHead eyebrow="Sertifikasi Produk" title="Data sertifikat" sub="Sertifikat yang terbit lewat SILAPP dan proyek sertifikasi sebelum SILAPP. Semua data ini tampil di Directory publik dengan status Aktif / Tidak Aktif.">
        {!form && <button className="btn btn-primary" onClick={() => setForm({ ...LEG })}><i className="bi bi-plus-lg me-1" />Tambah proyek lama</button>}
      </PageHead>
      {form && (
        <section className="panel mb-3" id="form-sertifikat">
          <div className="panel-h"><h2 className="mb-0">{form.id ? 'Ubah proyek lama' : 'Tambah proyek sebelum SILAPP'}</h2></div>
          <form className="panel-b row g-3" onSubmit={save}>
            {F.map(([k, l, t]) => <div className="col-md-4" key={k}><label className="form-label" htmlFor={`l-${k}`}>{l}</label><input id={`l-${k}`} type={t} className="form-control" value={form[k] || ''} onChange={set(k)} required /></div>)}
            <div className="col-md-4"><label className="form-label" htmlFor="l-st">Status</label><Select id="l-st" className="form-select" value={form.status} onChange={set('status')}><option value="aktif">Aktif</option><option value="tidak_aktif">Tidak Aktif</option></Select></div>
            <div className="col-12 d-flex gap-2"><button className="btn btn-primary">Simpan</button><button type="button" className="btn btn-outline-secondary" onClick={() => setForm(null)}>Batal</button></div>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="panel-h"><input className="form-control search-input" placeholder="Cari pabrik / nomor / produk" aria-label="Cari sertifikat" value={q} onChange={(e) => setQ(e.target.value)} /><span className="small text-muted2">{rows.length} sertifikat</span></div>
        <MobileList items={list} empty="Belum ada data sertifikat." row={(r) => ({
          key: `${r.source}-${r.id}`, title: r.factory_name, sub: `${r.product} · ${r.sni_no}`,
          pills: [r.status === 'aktif' ? ['pill-done', 'Aktif'] : ['pill-closed', 'Tidak aktif'], r.source === 'silapp' ? ['pill-progress', 'SILAPP'] : ['pill-neutral', 'Sebelum SILAPP']],
          detail: {
            rows: [['Alamat', r.factory_address], ['Produk', r.product], ['Nomor SNI', <span className="mono">{r.sni_no}</span>], ['No. sertifikat', <span className="mono">{r.certificate_no}</span>], ['Terbit', fmtDate(r.issued_at)], ['Pengajuan', r.application_no && <span className="mono">{r.application_no}</span>]],
            actions: [
              { label: r.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan', icon: `toggle-${r.status === 'aktif' ? 'off' : 'on'}`, onClick: () => toggle(r) },
              { label: 'Ubah', icon: 'pencil', hidden: r.source !== 'lama', scrollTo: 'form-sertifikat', onClick: () => setForm({ ...r }) },
              { label: 'Hapus', icon: 'trash', danger: true, hidden: r.source !== 'lama', onClick: () => del(r) },
            ],
          },
        })} />
        <div className="table-responsive d-only">
          <table className="table mb-0 align-middle small">
            <thead><tr><th>Nama pabrik</th><th>Alamat</th><th>Produk</th><th>No. SNI</th><th>No. sertifikat</th><th>Terbit</th><th>Status</th><th>Sumber</th><th></th></tr></thead>
            <tbody>{list.map((r) => (
              <tr key={`${r.source}-${r.id}`}>
                <td>{r.factory_name}</td><td>{r.factory_address}</td><td>{r.product}</td><td className="mono">{r.sni_no}</td><td className="mono">{r.certificate_no}</td>
                <td className="num text-nowrap">{fmtDate(r.issued_at)}</td><td><StatusCert v={r.status} /></td>
                <td>{r.source === 'silapp' ? <span className="text-nowrap">SILAPP<div className="text-muted2">{r.application_no}</div></span> : 'Sebelum SILAPP'}</td>
                <td className="text-nowrap text-end">
                  <button className="btn btn-sm btn-outline-secondary me-1" title={r.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'} aria-label={`${r.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'} ${r.certificate_no}`} onClick={() => toggle(r)}><i className={`bi bi-toggle-${r.status === 'aktif' ? 'on' : 'off'}`} /></button>
                  {r.source === 'lama' && <><button className="btn btn-sm btn-outline-secondary me-1" title="Ubah" aria-label={`Ubah ${r.certificate_no}`} onClick={() => setForm({ ...r })}><i className="bi bi-pencil" /></button><button className="btn btn-sm btn-outline-danger" title="Hapus" aria-label={`Hapus ${r.certificate_no}`} onClick={() => del(r)}><i className="bi bi-trash" /></button></>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
