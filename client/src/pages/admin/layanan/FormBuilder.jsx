/** Form pengajuan per layanan: isian tambahan & berkas (Super Admin). */
import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../../../api';
import { PageHead, Loading, useToast, useConfirm, Select, FormSheet } from '../../../components/ui';
import { SortList } from '../../../components/SortList';

const TYPES = { text: 'Teks Singkat', textarea: 'Teks Panjang', number: 'Angka', select: 'Pilihan', date: 'Tanggal' };
const SVC = [['SP', 'Sertifikasi Produk'], ['KIM', 'Lab Kimia'], ['FIS', 'Lab Fisika'], ['MIK', 'Lab Mikrobiologi'], ['KAL', 'Lab Kalibrasi']];
const NEWF = { label: '', type: 'text', options: '', required: false, show_when: '', is_active: true };

export default function FormBuilder() {
  const toast = useToast();
  const confirm = useConfirm();
  const [code, setCode] = useState('SP');
  const [d, setD] = useState(null);
  const [fe, setFe] = useState(null);
  const [de, setDe] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get(`/superadmin/forms/${code}`).then((r) => setD(r.data)), [code]);
  useEffect(() => { setD(null); setFe(null); setDe(null); load(); }, [load]);
  const saveF = async () => {
    setBusy(true);
    try { if (fe.id) await api.put(`/superadmin/fields/${fe.id}`, fe); else await api.post(`/superadmin/forms/${code}/fields`, fe); toast('Isian disimpan.'); setFe(null); load(); } catch (ex) { toast(errMsg(ex), 'danger'); } finally { setBusy(false); }
  };
  const saveD = async () => {
    setBusy(true);
    try { if (de.id) await api.put(`/superadmin/documents/${de.id}`, de); else await api.post(`/superadmin/forms/${code}/documents`, de); toast('Berkas disimpan.'); setDe(null); load(); } catch (ex) { toast(errMsg(ex), 'danger'); } finally { setBusy(false); }
  };
  const del = async (kind, x) => {
    if (!(await confirm({ title: 'Hapus?', body: <>Hapus <b>{x.label || x.name}</b> dari form? Data pengajuan lama tidak terpengaruh.</>, ok: 'Hapus', danger: true }))) return;
    await api.delete(`/superadmin/${kind}/${x.id}`); load();
  };
  // urutan baru hasil drag & drop: tampil langsung, lalu disimpan ke server
  const reorder = async (kind, list) => {
    setD({ ...d, [kind]: list });
    try { await api.put(`/superadmin/forms/${code}/order`, { [kind]: list.map((x) => x.id) }); } catch (ex) { toast(errMsg(ex), 'danger'); load(); }
  };
  const acts = (onEdit, onDel, name) => (
    <span className="s-act">
      <button className="btn btn-sm btn-outline-secondary" onClick={onEdit} aria-label={`Ubah ${name}`}><i className="bi bi-pencil d-sm-none" /><span className="d-none d-sm-inline">Ubah</span></button>
      <button className="btn btn-sm btn-outline-danger" onClick={onDel} aria-label={`Hapus ${name}`}><i className="bi bi-trash d-sm-none" /><span className="d-none d-sm-inline">Hapus</span></button>
    </span>
  );
  return (
    <>
      <PageHead eyebrow="Pengaturan" title="Form Pengajuan" sub="Atur isian tambahan dan berkas yang diminta saat pelanggan mengajukan layanan. Geser ikon titik di kiri untuk mengubah urutan. Perubahan hanya berlaku untuk pengajuan baru.">
        <Select className="form-select" style={{ maxWidth: 240 }} aria-label="Pilih Layanan" value={code} onChange={(e) => setCode(e.target.value)}>{SVC.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      </PageHead>
      {!d ? <Loading /> : (
        <div className="row g-3">
          <div className="col-lg-7">
            <section className="panel">
              <div className="panel-h"><h2 className="mb-0">Isian Tambahan</h2><button className="btn btn-sm btn-primary" onClick={() => setFe({ ...NEWF })}><i className="bi bi-plus-lg me-1" />Tambah Isian</button></div>
              <SortList items={d.fields} label="Urutan Isian" empty="Belum ada isian tambahan." onReorder={(l) => reorder('fields', l)} render={(x) => (
                <>
                  <span className={`s-tx ${x.is_active ? '' : 'text-muted2'}`}><b>{x.label}</b>
                    <span className="meta">{[TYPES[x.type], x.type === 'select' && x.options, x.required ? 'Wajib' : 'Opsional', x.show_when === '1B' && 'Tipe 1B', !x.is_active && 'Nonaktif'].filter(Boolean).join(' · ')}</span></span>
                  {acts(() => setFe({ ...x, required: !!x.required, is_active: !!x.is_active }), () => del('fields', x), x.label)}
                </>
              )} />
            </section>
          </div>
          <div className="col-lg-5">
            <section className="panel">
              <div className="panel-h"><h2 className="mb-0">Berkas</h2><button className="btn btn-sm btn-primary" onClick={() => setDe({ name: '', required: false, admin_if_package: false, show_when: null, is_active: true })}><i className="bi bi-plus-lg me-1" />Tambah Berkas</button></div>
              <SortList items={d.documents} label="Urutan Berkas" empty="Belum ada berkas." onReorder={(l) => reorder('documents', l)} render={(x) => (
                <>
                  <span className={`s-tx ${x.is_active ? '' : 'text-muted2'}`}><b>{x.name}</b>
                    <span className="meta">{[x.required ? 'Wajib' : 'Opsional', x.show_when === 'SURV' && 'Jika Surveillance', x.admin_if_package && 'Paket: oleh Admin', !x.is_active && 'Nonaktif'].filter(Boolean).join(' · ')}</span></span>
                  {acts(() => setDe({ ...x, required: !!x.required, admin_if_package: !!x.admin_if_package, is_active: !!x.is_active }), () => del('documents', x), x.name)}
                </>
              )} />
            </section>
          </div>
        </div>
      )}
      <FormSheet open={!!fe} onClose={() => setFe(null)} onSubmit={saveF} busy={busy} icon="input-cursor-text"
        title={fe?.id ? 'Ubah Isian' : 'Tambah Isian'} sub={<>Form pengajuan {SVC.find((x) => x[0] === code)?.[1]}</>}>
        {fe && (
          <div className="row g-3">
            <div className="col-12"><label className="form-label" htmlFor="fl">Label</label><input id="fl" className="form-control" value={fe.label} onChange={(e) => setFe({ ...fe, label: e.target.value })} required /></div>
            <div className={code === 'SP' ? 'col-md-6' : 'col-12'}><label className="form-label" htmlFor="ft">Tipe Isian</label><Select id="ft" className="form-select" value={fe.type} onChange={(e) => setFe({ ...fe, type: e.target.value })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
            {code === 'SP' && <div className="col-md-6"><label className="form-label" htmlFor="fw">Tampil untuk</label><Select id="fw" className="form-select" value={fe.show_when || ''} onChange={(e) => setFe({ ...fe, show_when: e.target.value })}><option value="">Semua Skema</option><option value="1B">Tipe 1B Saja</option></Select></div>}
            {fe.type === 'select' && <div className="col-12"><label className="form-label" htmlFor="fo">Pilihan</label><input id="fo" className="form-control" placeholder="Contoh: Baru, Perpanjangan, Perubahan" value={fe.options || ''} onChange={(e) => setFe({ ...fe, options: e.target.value })} /><div className="form-text">Pisahkan dengan koma.</div></div>}
            <div className="col-12 d-flex gap-4 flex-wrap">
              <div className="form-check"><input id="frq" type="checkbox" className="form-check-input" checked={!!fe.required} onChange={(e) => setFe({ ...fe, required: e.target.checked })} /><label htmlFor="frq" className="form-check-label">Wajib Diisi</label></div>
              <div className="form-check"><input id="fac" type="checkbox" className="form-check-input" checked={fe.is_active !== false && fe.is_active !== 0} onChange={(e) => setFe({ ...fe, is_active: e.target.checked })} /><label htmlFor="fac" className="form-check-label">Aktif</label></div>
            </div>
          </div>
        )}
      </FormSheet>
      <FormSheet open={!!de} onClose={() => setDe(null)} onSubmit={saveD} busy={busy} icon="file-earmark-plus"
        title={de?.id ? 'Ubah Berkas' : 'Tambah Berkas'} sub={<>Berkas yang diunggah pelanggan untuk {SVC.find((x) => x[0] === code)?.[1]}</>}>
        {de && (
          <div className="d-flex flex-column gap-3">
            <div><label className="form-label" htmlFor="dn">Nama Berkas</label><input id="dn" className="form-control" placeholder="Contoh: Sertifikat merek" value={de.name} onChange={(e) => setDe({ ...de, name: e.target.value })} required /></div>
            <div className="form-check"><input id="drq" type="checkbox" className="form-check-input" checked={!!de.required} onChange={(e) => setDe({ ...de, required: e.target.checked })} /><label htmlFor="drq" className="form-check-label">Wajib Diunggah</label></div>
 {code === 'SP' && <div className="form-check"><input id="dsv" type="checkbox" className="form-check-input" checked={de.show_when === 'SURV'} onChange={(e) => setDe({ ...de, show_when: e.target.checked ? 'SURV' : null })} /><label htmlFor="dsv" className="form-check-label">Hanya diminta jika pelanggan mencentang Surveillance</label></div>}
            {code === 'SP' && <div className="form-check"><input id="dpk" type="checkbox" className="form-check-input" checked={!!de.admin_if_package} onChange={(e) => setDe({ ...de, admin_if_package: e.target.checked })} /><label htmlFor="dpk" className="form-check-label">Untuk paket LSPro + Lab, berkas ini disiapkan Admin</label></div>}
            {de.id && <div className="form-check"><input id="dac" type="checkbox" className="form-check-input" checked={!!de.is_active} onChange={(e) => setDe({ ...de, is_active: e.target.checked })} /><label htmlFor="dac" className="form-check-label">Aktif</label></div>}
          </div>
        )}
      </FormSheet>
    </>
  );
}
