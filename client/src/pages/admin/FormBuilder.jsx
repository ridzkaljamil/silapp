/** Form pengajuan per layanan: isian tambahan & berkas (Super Admin). */
import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../../api';
import { PageHead, Loading, useToast, useConfirm, MobileList, Select } from '../../components/ui';

const TYPES = { text: 'Teks singkat', textarea: 'Teks panjang', number: 'Angka', select: 'Pilihan', date: 'Tanggal' };
const SVC = [['SP', 'Sertifikasi Produk'], ['KIM', 'Lab Kimia'], ['FIS', 'Lab Fisika'], ['MIK', 'Lab Mikrobiologi'], ['KAL', 'Lab Kalibrasi']];
const NEWF = { label: '', type: 'text', options: '', required: false, show_when: '', is_active: true };

export default function FormBuilder() {
  const toast = useToast();
  const confirm = useConfirm();
  const [code, setCode] = useState('SP');
  const [d, setD] = useState(null);
  const [fe, setFe] = useState(null);
  const [de, setDe] = useState(null);
  const load = useCallback(() => api.get(`/superadmin/forms/${code}`).then((r) => setD(r.data)), [code]);
  useEffect(() => { setD(null); setFe(null); setDe(null); load(); }, [load]);
  const saveF = async (e) => {
    e.preventDefault();
    try { if (fe.id) await api.put(`/superadmin/fields/${fe.id}`, fe); else await api.post(`/superadmin/forms/${code}/fields`, fe); toast('Isian disimpan.'); setFe(null); load(); } catch (ex) { toast(errMsg(ex), 'danger'); }
  };
  const saveD = async (e) => {
    e.preventDefault();
    try { if (de.id) await api.put(`/superadmin/documents/${de.id}`, de); else await api.post(`/superadmin/forms/${code}/documents`, de); toast('Berkas disimpan.'); setDe(null); load(); } catch (ex) { toast(errMsg(ex), 'danger'); }
  };
  const del = async (kind, x) => {
    if (!(await confirm({ title: 'Hapus?', body: <>Hapus <b>{x.label || x.name}</b> dari form? Data pengajuan lama tidak terpengaruh.</>, ok: 'Hapus', danger: true }))) return;
    await api.delete(`/superadmin/${kind}/${x.id}`); load();
  };
  const move = async (kind, list, i, dir) => {
    const a = list[i], b = list[i + dir];
    if (!b) return;
    await api.put(`/superadmin/${kind}/${a.id}`, { ...a, sort_order: b.sort_order === a.sort_order ? a.sort_order + dir : b.sort_order, is_active: !!a.is_active, required: !!a.required, admin_if_package: !!a.admin_if_package });
    await api.put(`/superadmin/${kind}/${b.id}`, { ...b, sort_order: a.sort_order, is_active: !!b.is_active, required: !!b.required, admin_if_package: !!b.admin_if_package });
    load();
  };
  return (
    <>
      <PageHead eyebrow="Super Admin" title="Form pengajuan" sub="Atur isian dan daftar berkas pada form pengajuan setiap layanan. Perubahan berlaku untuk pengajuan baru; pengajuan lama tetap menyimpan data aslinya.">
        <Select className="form-select" style={{ maxWidth: 240 }} aria-label="Pilih layanan" value={code} onChange={(e) => setCode(e.target.value)}>{SVC.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      </PageHead>
      <div className="alert alert-light border small">Isian bawaan seperti pilihan produk, skema, parameter uji, dan data alat kalibrasi tetap ada. Isian di bawah ini ditambahkan setelahnya.</div>
      {!d ? <Loading /> : (
        <div className="row g-3">
          <div className="col-lg-7">
            <section className="panel">
              <div className="panel-h"><h2 className="mb-0">Isian tambahan</h2>{!fe && <button className="btn btn-sm btn-primary" onClick={() => setFe({ ...NEWF })}><i className="bi bi-plus-lg me-1" />Tambah isian</button>}</div>
              {fe && (
                <form className="panel-b row g-2 border-bottom swap" id="form-isian" onSubmit={saveF}>
                  <div className="col-md-6"><label className="form-label small" htmlFor="fl">Label</label><input id="fl" className="form-control form-control-sm" value={fe.label} onChange={(e) => setFe({ ...fe, label: e.target.value })} required /></div>
                  <div className="col-md-3"><label className="form-label small" htmlFor="ft">Tipe</label><Select id="ft" className="form-select form-select-sm" value={fe.type} onChange={(e) => setFe({ ...fe, type: e.target.value })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
                  {code === 'SP' && <div className="col-md-3"><label className="form-label small" htmlFor="fw">Tampil untuk</label><Select id="fw" className="form-select form-select-sm" value={fe.show_when || ''} onChange={(e) => setFe({ ...fe, show_when: e.target.value })}><option value="">Semua skema</option><option value="1B">Tipe 1B saja</option></Select></div>}
                  {fe.type === 'select' && <div className="col-12"><label className="form-label small" htmlFor="fo">Pilihan (pisahkan dengan koma)</label><input id="fo" className="form-control form-control-sm" value={fe.options || ''} onChange={(e) => setFe({ ...fe, options: e.target.value })} /></div>}
                  <div className="col-12 d-flex gap-3 flex-wrap">
                    <div className="form-check"><input id="frq" type="checkbox" className="form-check-input" checked={!!fe.required} onChange={(e) => setFe({ ...fe, required: e.target.checked })} /><label htmlFor="frq" className="form-check-label small">Wajib diisi</label></div>
                    <div className="form-check"><input id="fac" type="checkbox" className="form-check-input" checked={fe.is_active !== false && fe.is_active !== 0} onChange={(e) => setFe({ ...fe, is_active: e.target.checked })} /><label htmlFor="fac" className="form-check-label small">Aktif</label></div>
                  </div>
                  <div className="col-12 d-flex gap-2"><button className="btn btn-sm btn-primary">Simpan</button><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setFe(null)}>Batal</button></div>
                </form>
              )}
              <MobileList items={d.fields} empty="Belum ada isian tambahan." row={(x) => {
                const i = d.fields.indexOf(x);
                return {
                  key: x.id, avatar: i + 1, title: x.label, sub: `${TYPES[x.type]}${x.type === 'select' && x.options ? ` · ${x.options}` : ''}`, muted: !x.is_active,
                  pills: [x.required ? ['pill-action', 'Wajib'] : ['pill-neutral', 'Opsional'], ...(x.show_when === '1B' ? [['pill-progress', 'Tipe 1B']] : []), ...(!x.is_active ? [['pill-closed', 'Nonaktif']] : [])],
                  detail: {
                    rows: [['Urutan', `${i + 1} dari ${d.fields.length}`], ['Tipe', TYPES[x.type]], ['Pilihan', x.type === 'select' ? x.options : ''], ['Tampil untuk', x.show_when === '1B' ? 'Tipe 1B saja' : 'Semua']],
                    actions: [
                      { label: 'Naik', icon: 'arrow-up', hidden: i === 0, onClick: () => move('fields', d.fields, i, -1) },
                      { label: 'Turun', icon: 'arrow-down', hidden: i === d.fields.length - 1, onClick: () => move('fields', d.fields, i, 1) },
                      { label: 'Ubah', icon: 'pencil', scrollTo: 'form-isian', onClick: () => setFe({ ...x, required: !!x.required, is_active: !!x.is_active }) },
                      { label: 'Hapus', icon: 'trash', danger: true, onClick: () => del('fields', x) },
                    ],
                  },
                };
              }} />
              <div className="table-responsive d-only">
                <table className="table table-sm mb-0 align-middle small">
                  <thead><tr><th style={{ width: 60 }}>Urut</th><th>Label</th><th>Tipe</th><th>Keterangan</th><th></th></tr></thead>
                  <tbody>{d.fields.map((x, i) => (
                    <tr key={x.id} className={x.is_active ? '' : 'text-muted2'}>
                      <td className="text-nowrap"><button className="btn btn-sm btn-link p-0 me-1" aria-label="Naik" onClick={() => move('fields', d.fields, i, -1)}><i className="bi bi-arrow-up" /></button><button className="btn btn-sm btn-link p-0" aria-label="Turun" onClick={() => move('fields', d.fields, i, 1)}><i className="bi bi-arrow-down" /></button></td>
                      <td>{x.label}{x.type === 'select' && <div className="text-muted2">{x.options}</div>}</td><td>{TYPES[x.type]}</td>
                      <td>{[x.required && 'wajib', x.show_when === '1B' && 'Tipe 1B', !x.is_active && 'nonaktif'].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="text-end text-nowrap"><button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setFe({ ...x, required: !!x.required, is_active: !!x.is_active })}>Ubah</button><button className="btn btn-sm btn-outline-danger" onClick={() => del('fields', x)}>Hapus</button></td>
                    </tr>
                  ))}
                  {!d.fields.length && <tr><td colSpan={5} className="text-center text-muted2 py-3">Belum ada isian tambahan.</td></tr>}</tbody>
                </table>
              </div>
            </section>
          </div>
          <div className="col-lg-5">
            <section className="panel">
              <div className="panel-h"><h2 className="mb-0">Berkas</h2>{!de && <button className="btn btn-sm btn-primary" onClick={() => setDe({ name: '', required: false, admin_if_package: false, is_active: true })}><i className="bi bi-plus-lg me-1" />Tambah berkas</button>}</div>
              {de && (
                <form className="panel-b d-flex flex-column gap-2 border-bottom swap" id="form-berkas" onSubmit={saveD}>
                  <label className="form-label small mb-0" htmlFor="dn">Nama berkas</label><input id="dn" className="form-control form-control-sm" value={de.name} onChange={(e) => setDe({ ...de, name: e.target.value })} required />
                  <div className="form-check"><input id="drq" type="checkbox" className="form-check-input" checked={!!de.required} onChange={(e) => setDe({ ...de, required: e.target.checked })} /><label htmlFor="drq" className="form-check-label small">Wajib diunggah</label></div>
                  {code === 'SP' && <div className="form-check"><input id="dpk" type="checkbox" className="form-check-input" checked={!!de.admin_if_package} onChange={(e) => setDe({ ...de, admin_if_package: e.target.checked })} /><label htmlFor="dpk" className="form-check-label small">Paket LSPro + Lab: diunggah Admin (pelanggan opsional)</label></div>}
                  {de.id && <div className="form-check"><input id="dac" type="checkbox" className="form-check-input" checked={!!de.is_active} onChange={(e) => setDe({ ...de, is_active: e.target.checked })} /><label htmlFor="dac" className="form-check-label small">Aktif</label></div>}
                  <div className="d-flex gap-2"><button className="btn btn-sm btn-primary">Simpan</button><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setDe(null)}>Batal</button></div>
                </form>
              )}
              <MobileList items={d.documents} empty="Belum ada berkas." row={(x) => {
                const i = d.documents.indexOf(x);
                return {
                  key: x.id, title: x.name, muted: !x.is_active,
                  pills: [x.required ? ['pill-action', 'Wajib'] : ['pill-neutral', 'Opsional'], ...(x.admin_if_package ? [['pill-progress', 'Paket: oleh Admin']] : []), ...(!x.is_active ? [['pill-closed', 'Nonaktif']] : [])],
                  detail: {
                    rows: [['Urutan', `${i + 1} dari ${d.documents.length}`], ['Keterangan', x.required ? 'Wajib diunggah' : 'Opsional'], ['Paket LSPro + Lab', x.admin_if_package ? 'Diunggah Admin' : '']],
                    actions: [
                      { label: 'Naik', icon: 'arrow-up', hidden: i === 0, onClick: () => move('documents', d.documents, i, -1) },
                      { label: 'Ubah', icon: 'pencil', scrollTo: 'form-berkas', onClick: () => setDe({ ...x, required: !!x.required, admin_if_package: !!x.admin_if_package, is_active: !!x.is_active }) },
                      { label: 'Hapus', icon: 'trash', danger: true, onClick: () => del('documents', x) },
                    ],
                  },
                };
              }} />
              <ul className="list-group list-group-flush d-only">
                {d.documents.map((x, i) => (
                  <li key={x.id} className={`list-group-item d-flex justify-content-between align-items-center gap-2 small ${x.is_active ? '' : 'text-muted2'}`}>
                    <span><button className="btn btn-sm btn-link p-0 me-1" aria-label="Naik" onClick={() => move('documents', d.documents, i, -1)}><i className="bi bi-arrow-up" /></button>{x.name}
                      <span className="d-block text-muted2">{[x.required ? 'wajib' : 'opsional', x.admin_if_package && 'paket: oleh Admin', !x.is_active && 'nonaktif'].filter(Boolean).join(' · ')}</span></span>
                    <span className="text-nowrap"><button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setDe({ ...x, required: !!x.required, admin_if_package: !!x.admin_if_package, is_active: !!x.is_active })}>Ubah</button><button className="btn btn-sm btn-outline-danger" onClick={() => del('documents', x)}>Hapus</button></span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
