/**
 * Ruang lingkup & harga semua layanan (Super Admin): produk/standar yang tampil di halaman Layanan publik
 * dan bisa dipilih pelanggan saat mengajukan. Sub-tab laboratorium pengujian juga berisi parameter & harga.
 */
import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../../../api';
import { Paged, PageHead, Loading, useToast, useConfirm, MobileList, FormSheet, DataToolbar, matchText, Select } from '../../../components/ui';
import LabScope from './LabScope';

const TABS = [
  ['SP', 'Sertifikasi Produk', 'produk'],
  ['KIM', 'Lab Kimia', 'produk', true],
  ['FIS', 'Lab Fisika', 'produk', true],
  ['MIK', 'Lab Mikrobiologi', 'produk', true],
  ['KAL', 'Lab Kalibrasi', 'alat'],
  ['LSM', 'Sistem Manajemen', 'standar'],
];
const NAMES = { KIM: 'Laboratorium Kimia', FIS: 'Laboratorium Fisika', MIK: 'Laboratorium Mikrobiologi' };
const NEW_CAT = '__baru';
const blank = () => ({ category: '', sub_category: '', name: '', standard_no: '', scheme_reference: '', scheme_types: '' });

export default function RuangLingkup() {
  const [tab, setTab] = useState('SP');
  const isLab = TABS.find((t) => t[0] === tab)[3];
  return (
    <>
      <PageHead sub="Produk dan standar yang tampil di halaman Layanan publik dan bisa dipilih pelanggan saat mengajukan. Untuk laboratorium pengujian, atur juga parameter uji dan harganya (belum termasuk PPN)." />
      <div className="tabs page-tabs sub-tabs" role="tablist" aria-label="Layanan">
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {isLab ? <LabScope key={tab} code={tab} name={NAMES[tab]} /> : <ScopeList key={tab} tab={tab} />}
    </>
  );
}

/** Ruang lingkup layanan tanpa harga per parameter: Sertifikasi Produk, Kalibrasi, Sistem Manajemen. */
function ScopeList({ tab }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [flt, setFlt] = useState({ cat: '' });
  const load = useCallback(() => api.get(`/superadmin/scope/${tab}`).then((r) => setData(r.data)), [tab]);
  const [newCat, setNewCat] = useState(null);
  const [extraCats, setExtraCats] = useState([]);
  useEffect(() => { load(); }, [load]);

  const [, label, unit] = TABS.find((t) => t[0] === tab);
  const isSP = tab === 'SP';
  const save = async () => {
    setBusy(true);
    try {
      if (edit.id) await api.put(`/superadmin/scope/item/${edit.id}`, edit); else await api.post(`/superadmin/scope/${tab}`, edit);
      toast(edit.id ? `${edit.name} disimpan.` : `${edit.name} ditambahkan ke ruang lingkup.`); setEdit(null); load();
    } catch (ex) { toast(errMsg(ex), 'danger'); } finally { setBusy(false); }
  };
  const del = async (p) => {
    if (!(await confirm({ title: 'Hapus dari Ruang Lingkup?', body: <>Hapus <b>{p.name}</b> dari ruang lingkup {label}? Data ini tidak lagi tampil di halaman Layanan dan tidak bisa dipilih pelanggan.</>, ok: 'Hapus', danger: true, icon: 'trash' }))) return;
    try { await api.delete(`/superadmin/scope/item/${p.id}`); toast(`${p.name} dihapus.`); load(); } catch (ex) { toast(errMsg(ex), 'danger'); }
  };

  const rows = data?.rows || [];
  const cats = [...new Set([...rows.map((r) => r.category).filter(Boolean), ...extraCats])].sort((a, b) => a.localeCompare(b, 'id'));
  const pickCat = (e) => (e.target.value === NEW_CAT ? setNewCat('') : setEdit({ ...edit, category: e.target.value }));
  const addCat = () => {
    const c = newCat.trim().replace(/\s+/g, ' ');
    if (!c) return;
    setExtraCats((x) => [...new Set([...x, c])]);
    setEdit({ ...edit, category: c }); setNewCat(null);
  };
  const shown = rows.filter((r) => (!flt.cat || r.category === flt.cat) && matchText(q, r.name, r.standard_no, r.category, r.sub_category, r.scheme_reference));
  const none = q || flt.cat ? 'Tidak ada data yang cocok.' : `Belum ada ${unit} di ruang lingkup ini.`;
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });

  return (
    <>
      <section className="panel mb-3">
        <DataToolbar q={q} onQ={setQ} placeholder={`Cari ${unit} atau standar`} filters={[{ key: 'cat', label: 'Kategori', options: cats.map((c) => [c, c]) }]}
          values={flt} onFilter={setFlt} shown={shown.length} total={rows.length} unit={unit} />
      </section>
      {!data ? <Loading /> : (
        <section className="panel mb-3">
          <div className="panel-h"><h2 className="mb-0">{label}</h2><button className="btn btn-sm btn-primary" onClick={() => setEdit(blank())}><i className="bi bi-plus-lg" />Tambah</button></div>
          <Paged list={shown} unit="data">{(page) => (<>
<MobileList items={page} empty={none} row={(p) => ({
            key: p.id, title: p.name, sub: [p.standard_no, p.category].filter(Boolean).join(' · '),
            pills: p.used ? [['pill-neutral', `${p.used} pengajuan`]] : [],
            detail: {
              rows: [['Kategori', p.category || '—'], ...(isSP ? [['Sub Kategori', p.sub_category || '—'], ['Acuan Skema', p.scheme_reference || '—'], ['Tipe Skema', p.scheme_types || '—']] : [])],
              actions: [{ label: 'Ubah', icon: 'pencil', primary: true, onClick: () => setEdit({ ...p }) }, { label: 'Hapus', icon: 'trash', danger: true, onClick: () => del(p) }],
            },
          })} />
          <div className="table-responsive d-only">
            <table className="table mb-0 align-middle small">
              <thead><tr><th>{isSP ? 'Produk' : tab === 'LSM' ? 'Ruang Lingkup' : 'Alat'}</th><th>{tab === 'LSM' ? 'Standar' : 'SNI / Standar'}</th><th>Kategori</th>{isSP && <th>Acuan Skema</th>}{isSP && <th>Tipe Skema</th>}<th></th></tr></thead>
              <tbody>{page.map((p) => (
                <tr key={p.id}>
                  <td><span className="fw-semibold">{p.name}</span>{p.used > 0 && <span className="d-block text-muted2">Dipakai di {p.used} pengajuan</span>}</td>
                  <td className="mono text-nowrap">{p.standard_no || '—'}</td>
                  <td>{p.category || '—'}{p.sub_category && <span className="d-block text-muted2">{p.sub_category}</span>}</td>
                  {isSP && <td className="text-muted2">{p.scheme_reference || '—'}</td>}
                  {isSP && <td>{p.scheme_types || '—'}</td>}
                  <td className="text-end text-nowrap">
                    <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setEdit({ ...p })}>Ubah</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => del(p)} aria-label={`Hapus ${p.name}`} title="Hapus"><i className="bi bi-trash" /></button>
                  </td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={isSP ? 6 : 4} className="text-center text-muted2 py-4">{none}</td></tr>}</tbody>
            </table>
          </div>
</>)}</Paged>
        </section>
      )}
      <FormSheet open={!!edit} onClose={() => setEdit(null)} onSubmit={save} busy={busy} icon={edit?.id ? 'pencil-square' : 'plus-square'}
        confirm={() => ({ title: edit?.id ? 'Simpan Perubahan?' : 'Tambah Ruang Lingkup?', body: <><b>{edit?.name || 'Data ini'}</b> akan disimpan ke ruang lingkup {label}.</> })}
        title={edit?.id ? `Ubah · ${edit.name}` : `Tambah Ruang Lingkup · ${label}`} submitLabel={edit?.id ? 'Simpan' : 'Tambah'}
        sub={edit && !edit.id ? 'Langsung tampil di halaman Layanan dan bisa dipilih pelanggan.' : null}>
        {edit && (
          <div className="row g-3">
            <div className="col-md-6"><label className="form-label" htmlFor="rl-cat">Kategori <span className="text-danger">*</span></label>
              <Select id="rl-cat" className="form-select" value={edit.category || ''} onChange={pickCat} required>
                <option value="">— Pilih Kategori —</option>
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value={NEW_CAT}>+ Tambah Kategori Baru</option>
              </Select></div>
            {isSP && <div className="col-md-6"><label className="form-label" htmlFor="rl-sub">Sub Kategori</label><input id="rl-sub" className="form-control" value={edit.sub_category || ''} onChange={set('sub_category')} /></div>}
            <div className="col-md-6"><label className="form-label" htmlFor="rl-nm">{isSP ? 'Nama Produk' : tab === 'LSM' ? 'Nama Ruang Lingkup' : 'Nama Alat'} <span className="text-danger">*</span></label><input id="rl-nm" className="form-control" value={edit.name} onChange={set('name')} required /></div>
            <div className="col-md-6"><label className="form-label" htmlFor="rl-sni">{tab === 'LSM' ? 'Standar' : 'Nomor SNI / Standar'}</label><input id="rl-sni" className="form-control" value={edit.standard_no || ''} onChange={set('standard_no')} placeholder={tab === 'LSM' ? 'ISO 9001' : 'SNI 6128:2020'} /></div>
            {isSP && <div className="col-md-8"><label className="form-label" htmlFor="rl-ref">Acuan Skema</label><input id="rl-ref" className="form-control" value={edit.scheme_reference || ''} onChange={set('scheme_reference')} /></div>}
            {isSP && <div className="col-md-4"><label className="form-label" htmlFor="rl-tp">Tipe Skema</label><input id="rl-tp" className="form-control" value={edit.scheme_types || ''} onChange={set('scheme_types')} placeholder="Tipe 5/Tipe 1b" /><div className="form-text">Pisahkan dengan garis miring.</div></div>}
          </div>
        )}
      </FormSheet>
      <FormSheet open={newCat !== null} onClose={() => setNewCat(null)} onSubmit={addCat} icon="folder-plus" title="Tambah Kategori" submitLabel="Tambah"
        sub="Kategori baru tersimpan setelah data ruang lingkup ini disimpan.">
        <label className="form-label" htmlFor="rl-newcat">Nama Kategori</label>
        <input id="rl-newcat" className="form-control" autoFocus value={newCat || ''} onChange={(e) => setNewCat(e.target.value)} required maxLength={120} placeholder="Contoh: Produk Perikanan" />
      </FormSheet>
    </>
  );
}
