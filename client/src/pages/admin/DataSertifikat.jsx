/** Data sertifikat: hasil SILAPP + proyek sebelum SILAPP (tampil di Directory). */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { Paged, PageHead, Loading, useToast, useConfirm, fmtDate, MobileList, Select, FormSheet, DataToolbar, matchText } from '../../components/ui';

const LEG = { id: null, factory_name: '', factory_address: '', product: '', sni_no: '', certificate_no: '', issued_at: '', status: 'aktif' };
const StatusCert = ({ v }) => <span className={`pill ${v === 'aktif' ? 'pill-done' : 'pill-closed'}`}>{v === 'aktif' ? 'Aktif' : 'Tidak Aktif'}</span>;

export default function DataSertifikat() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null);
  const [q, setQ] = useState('');
  const [flt, setFlt] = useState({ status: '', source: '' });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get('/certificates').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Loading />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try { if (form.id) await api.put(`/certificates/legacy/${form.id}`, form); else await api.post('/certificates/legacy', form); toast('Data sertifikat disimpan.'); setForm(null); load(); } catch (ex) { toast(errMsg(ex), 'danger'); } finally { setBusy(false); }
  };
  const toggle = async (r) => {
    const status = r.status === 'aktif' ? 'tidak_aktif' : 'aktif';
    const off = status === 'tidak_aktif';
    if (!(await confirm({
      title: off ? 'Nonaktifkan Sertifikat?' : 'Aktifkan Sertifikat?', icon: off ? 'toggle-off' : 'toggle-on', danger: off, ok: off ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan',
      body: <>Sertifikat <b>{r.certificate_no}</b> ({r.factory_name}) akan tampil sebagai <b>{off ? 'Tidak Aktif' : 'Aktif'}</b> di Directory.</>,
    }))) return;
    try {
      if (r.source === 'silapp') await api.patch(`/certificates/silapp/${r.id}`, { status });
      else await api.put(`/certificates/legacy/${r.id}`, { ...r, status });
      toast(off ? 'Sertifikat dinonaktifkan.' : 'Sertifikat diaktifkan.'); load();
    } catch (ex) { toast(errMsg(ex), 'danger'); }
  };
  const del = async (r) => {
    if (!(await confirm({ title: 'Hapus Data?', body: <>Hapus sertifikat <b>{r.certificate_no}</b> dari data proyek lama?</>, ok: 'Hapus', danger: true }))) return;
    await api.delete(`/certificates/legacy/${r.id}`); load();
  };
  const list = rows.filter((r) => matchText(q, r.certificate_no, r.factory_name, r.factory_address, r.product, r.sni_no, r.application_no)
    && (!flt.status || r.status === flt.status) && (!flt.source || r.source === flt.source));
  const empty = rows.length ? 'Tidak ada sertifikat yang cocok dengan pencarian atau filter.' : 'Belum ada data sertifikat.';
  const filters = [
    { key: 'status', label: 'Status', options: [['aktif', 'Aktif'], ['tidak_aktif', 'Tidak Aktif']] },
    { key: 'source', label: 'Sumber', options: [['silapp', 'SILAPP'], ['lama', 'Sebelum SILAPP']] },
  ];
  const F = [['factory_name', 'Nama Pabrik', 'text'], ['factory_address', 'Alamat Pabrik (Kota/Provinsi)', 'text'], ['product', 'Produk', 'text'], ['sni_no', 'Nomor SNI', 'text'], ['certificate_no', 'Nomor Sertifikat', 'text'], ['issued_at', 'Tanggal Terbit', 'date']];
  return (
    <>
      <PageHead eyebrow="Operasional" title="Data Sertifikat"
        sub="Daftar SPPT SNI yang sudah terbit, baik lewat SILAPP maupun dari proyek sebelum SILAPP. Data yang ditandai tampil di Directory pelanggan beserta status berlakunya.">
        <Link to="/admin/directory" className="btn btn-outline-secondary"><i className="bi bi-journal-text" />Lihat Tampilan Directory</Link>
        <button className="btn btn-primary" onClick={() => setForm({ ...LEG })}><i className="bi bi-plus-lg" />Tambah Proyek Lama</button>
      </PageHead>
      <FormSheet open={!!form} onClose={() => setForm(null)} onSubmit={save} busy={busy} wide icon="patch-plus"
        confirm={() => ({ title: 'Simpan Data Sertifikat?', body: <>Sertifikat <b>{form?.certificate_no || 'ini'}</b> akan disimpan dan tampil di Directory.</> })}
        title={form?.id ? 'Ubah Proyek Lama' : 'Tambah Proyek Sebelum SILAPP'} sub="Sertifikat yang terbit sebelum SILAPP dipakai, agar tetap tampil di Directory.">
        {form && (
          <div className="row g-3">
            {F.map(([k, l, t]) => <div className="col-md-6" key={k}><label className="form-label" htmlFor={`l-${k}`}>{l}</label><input id={`l-${k}`} type={t} className="form-control" value={form[k] || ''} onChange={set(k)} required /></div>)}
            <div className="col-md-6"><label className="form-label" htmlFor="l-st">Status</label><Select id="l-st" className="form-select" value={form.status} onChange={set('status')}><option value="aktif">Aktif</option><option value="tidak_aktif">Tidak Aktif</option></Select></div>
          </div>
        )}
      </FormSheet>
      <section className="panel">
        <DataToolbar q={q} onQ={setQ} placeholder="Cari pabrik atau nomor" filters={filters} values={flt} onFilter={setFlt} shown={list.length} total={rows.length} unit="sertifikat" />
        <Paged list={list} unit="sertifikat">{(page) => (<>
<MobileList items={page} empty={empty} row={(r) => ({
          key: `${r.source}-${r.id}`, title: r.factory_name, sub: `${r.product} · ${r.sni_no}`,
          pills: [r.status === 'aktif' ? ['pill-done', 'Aktif'] : ['pill-closed', 'Tidak Aktif'], r.source === 'silapp' ? ['pill-progress', 'SILAPP'] : ['pill-neutral', 'Sebelum SILAPP']],
          detail: {
            rows: [['Alamat', r.factory_address], ['Produk', r.product], ['Nomor SNI', <span className="mono">{r.sni_no}</span>], ['No. Sertifikat', <span className="mono">{r.certificate_no}</span>], ['Terbit', fmtDate(r.issued_at)], ['Pengajuan', r.application_no && <span className="mono">{r.application_no}</span>]],
            actions: [
              { label: r.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan', icon: `toggle-${r.status === 'aktif' ? 'off' : 'on'}`, onClick: () => toggle(r) },
              { label: 'Ubah', icon: 'pencil', hidden: r.source !== 'lama', onClick: () => setForm({ ...r }) },
              { label: 'Hapus', icon: 'trash', danger: true, hidden: r.source !== 'lama', onClick: () => del(r) },
            ],
          },
        })} />
        <div className="table-responsive d-only">
          <table className="table mb-0 align-middle small">
            <thead><tr><th>Nama Pabrik</th><th>Alamat</th><th>Produk</th><th>No. SNI</th><th>No. Sertifikat</th><th>Terbit</th><th>Status</th><th>Sumber</th><th></th></tr></thead>
            <tbody>{page.map((r) => (
              <tr key={`${r.source}-${r.id}`}>
                <td>{r.factory_name}</td><td>{r.factory_address}</td><td>{r.product}</td><td className="mono">{r.sni_no}</td><td className="mono">{r.certificate_no}</td>
                <td className="num text-nowrap">{fmtDate(r.issued_at)}</td><td><StatusCert v={r.status} /></td>
                <td>{r.source === 'silapp' ? <span className="text-nowrap">SILAPP<div className="text-muted2">{r.application_no}</div></span> : 'Sebelum SILAPP'}</td>
                <td className="text-nowrap text-end">
                  <button className="btn btn-sm btn-outline-secondary me-1" title={r.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'} aria-label={`${r.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'} ${r.certificate_no}`} onClick={() => toggle(r)}><i className={`bi bi-toggle-${r.status === 'aktif' ? 'on' : 'off'}`} /></button>
                  {r.source === 'lama' && <><button className="btn btn-sm btn-outline-secondary me-1" title="Ubah" aria-label={`Ubah ${r.certificate_no}`} onClick={() => setForm({ ...r })}><i className="bi bi-pencil" /></button><button className="btn btn-sm btn-outline-danger" title="Hapus" aria-label={`Hapus ${r.certificate_no}`} onClick={() => del(r)}><i className="bi bi-trash" /></button></>}
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={9} className="text-center text-muted2 py-4">{empty}</td></tr>}</tbody>
          </table>
        </div>
</>)}</Paged>
      </section>
    </>
  );
}
