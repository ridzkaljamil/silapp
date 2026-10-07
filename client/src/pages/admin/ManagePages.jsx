/** Halaman pengelolaan iterasi 2: akun pelanggan, data sertifikat, daftar harga lab, form pengajuan, survei. */
import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../../api';
import { PageHead, Loading, useToast, useConfirm, fmtDate, rupiah, MobileList, initials, Select } from '../../components/ui';

/* ===================== Akun pelanggan (Admin & Super Admin) ===================== */
const CUST = { id: null, name: '', email: '', company_name: '', nib_npwp: '', phone: '', address: '', is_active: true };

export function AkunPelanggan() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null);
  const [created, setCreated] = useState(null);
  const [q, setQ] = useState('');
  const load = useCallback(() => api.get('/customers').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Loading />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try {
      if (form.id) { await api.put(`/customers/${form.id}`, form); toast('Data pelanggan disimpan.'); setCreated(null); } else {
        const r = await api.post('/customers', form);
        setCreated({ email: form.email, company: form.company_name, pass: r.data.temp_password });
        toast('Akun dibuat. Info login dikirim ke email pelanggan.');
      }
      setForm(null); load();
    } catch (ex) { toast(errMsg(ex), 'danger'); }
  };
  const reset = async (u) => {
    if (!(await confirm({ title: 'Reset kata sandi?', body: <>Kata sandi sementara baru akan dikirim ke <b>{u.email}</b>. Pelanggan wajib menggantinya saat login.</>, ok: 'Ya, reset' }))) return;
    try { const r = await api.post(`/customers/${u.id}/reset-password`); setCreated({ email: u.email, company: u.company_name, pass: r.data.temp_password, reset: true }); } catch (ex) { toast(errMsg(ex), 'danger'); }
  };
  const list = rows.filter((r) => `${r.name} ${r.email} ${r.company_name}`.toLowerCase().includes(q.toLowerCase()));
  const fields = [['company_name', 'Nama perusahaan', 'text', true], ['name', 'Nama penanggung jawab', 'text', true], ['email', 'Email (untuk login)', 'email', true], ['phone', 'No. HP / WhatsApp', 'tel'], ['nib_npwp', 'NIB / NPWP', 'text'], ['address', 'Alamat perusahaan', 'text']];
  return (
    <>
      <PageHead eyebrow="Akun pelanggan" title="Akun pelanggan" sub="Akun dibuat Admin setelah harga disepakati. Sistem mengirim kata sandi sementara ke email pelanggan, dan pelanggan wajib menggantinya saat login pertama.">
        {!form && <button className="btn btn-primary" onClick={() => { setForm({ ...CUST }); setCreated(null); }}><i className="bi bi-person-plus me-1" />Buat akun pelanggan</button>}
      </PageHead>
      {created && (
        <div className="alert alert-success d-flex justify-content-between align-items-start gap-2 flex-wrap">
          <div><b>{created.reset ? 'Kata sandi direset' : 'Akun berhasil dibuat'}</b> untuk {created.company} ({created.email}). Email berisi info login sudah dikirim.
            <div className="small mt-1">Kata sandi sementara (tampil sekali, untuk berjaga jika email tidak diterima): <span className="mono fw-bold">{created.pass}</span></div></div>
          <button className="btn-close" aria-label="Tutup" onClick={() => setCreated(null)} />
        </div>
      )}
      {form && (
        <section className="panel mb-3" id="form-pelanggan">
          <div className="panel-h"><h2 className="mb-0">{form.id ? 'Ubah data pelanggan' : 'Buat akun pelanggan'}</h2></div>
          <form className="panel-b row g-3" onSubmit={save}>
            {fields.map(([k, l, t, req]) => (
              <div className="col-md-4" key={k}><label className="form-label" htmlFor={`c-${k}`}>{l}{req && <span className="text-danger"> *</span>}</label><input id={`c-${k}`} type={t} className="form-control" value={form[k] || ''} onChange={set(k)} required={req} /></div>
            ))}
            {form.id && <div className="col-12"><div className="form-check"><input id="c-act" type="checkbox" className="form-check-input" checked={!!form.is_active} onChange={set('is_active')} /><label htmlFor="c-act" className="form-check-label">Akun aktif</label></div></div>}
            <div className="col-12 d-flex gap-2"><button className="btn btn-primary">{form.id ? 'Simpan' : 'Buat akun & kirim email'}</button><button type="button" className="btn btn-outline-secondary" onClick={() => setForm(null)}>Batal</button></div>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="panel-h"><input className="form-control search-input" placeholder="Cari perusahaan / nama / email" aria-label="Cari pelanggan" value={q} onChange={(e) => setQ(e.target.value)} /><span className="small text-muted2">{rows.length} akun</span></div>
        <MobileList items={list} empty="Belum ada akun pelanggan." row={(u) => ({
          key: u.id, avatar: initials(u.company_name || u.name), title: u.company_name, sub: `${u.name} · ${u.applications} pengajuan`, muted: !u.is_active,
          pills: [['pill-action', 'User'], !u.is_active ? ['pill-neutral', 'Nonaktif'] : u.must_change_password ? ['pill-progress', 'Belum login'] : ['pill-done', 'Aktif']],
          detail: {
            rows: [['Penanggung jawab', u.name], ['Email', u.email], ['Telepon', u.phone || '—'], ['NIB / NPWP', u.nib_npwp], ['Alamat', u.address], ['Pengajuan', u.applications]],
            actions: [
              { label: 'Ubah', icon: 'pencil', scrollTo: 'form-pelanggan', onClick: () => { setForm({ ...CUST, ...u, is_active: !!u.is_active }); setCreated(null); } },
              { label: 'Reset sandi', icon: 'key', onClick: () => reset(u) },
            ],
          },
        })} />
        <div className="table-responsive d-only">
          <table className="table mb-0 align-middle">
            <thead><tr><th>Perusahaan</th><th>Penanggung jawab</th><th>Kontak</th><th>Pengajuan</th><th>Status</th><th></th></tr></thead>
            <tbody>{list.map((u) => (
              <tr key={u.id}>
                <td>{u.company_name}<div className="small text-muted2">{u.nib_npwp || ''}</div></td>
                <td>{u.name}<div className="small text-muted2">{u.email}</div></td>
                <td className="small">{u.phone || '—'}</td>
                <td className="num">{u.applications}</td>
                <td className="small">{!u.is_active ? <span className="pill pill-neutral">Nonaktif</span> : u.must_change_password ? <span className="pill pill-progress">Belum login</span> : <span className="pill pill-done">Aktif</span>}</td>
                <td className="text-nowrap text-end">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => { setForm({ ...CUST, ...u, is_active: !!u.is_active }); setCreated(null); }}>Ubah</button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => reset(u)}>Reset sandi</button>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={6} className="text-center text-muted2 py-4">Belum ada akun pelanggan.</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ===================== Data sertifikat (SILAPP + proyek lama) ===================== */
const LEG = { id: null, factory_name: '', factory_address: '', product: '', sni_no: '', certificate_no: '', issued_at: '', status: 'aktif' };
export const StatusCert = ({ v }) => <span className={`pill ${v === 'aktif' ? 'pill-done' : 'pill-closed'}`}>{v === 'aktif' ? 'Aktif' : 'Tidak Aktif'}</span>;

export function DataSertifikat() {
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

/* ===================== Daftar harga lab (Super Admin) ===================== */
export function HargaLab() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => api.get('/superadmin/prices').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Loading />;
  const save = async () => {
    try { await api.put(`/superadmin/prices/products/${edit.id}`, edit); toast('Daftar harga disimpan.'); setEdit(null); load(); } catch (ex) { toast(errMsg(ex), 'danger'); }
  };
  const groups = [...new Set(rows.map((r) => r.service_name))];
  return (
    <>
      <PageHead eyebrow="Super Admin" title="Daftar harga pengujian laboratorium" sub="Harga per parameter per sampel dan harga paket parameter lengkap sesuai SNI, sudah termasuk PPN 11%. Dipakai untuk menghitung invoice lab secara otomatis. Harga parameter 'lainnya' diisi Admin saat membuat invoice." />
      <div className="alert alert-warning small">Harga yang terisi saat ini adalah <b>data contoh</b>. Ganti dengan daftar harga resmi PSU.</div>
      {groups.map((g) => (
        <section className="panel mb-3" key={g}>
          <div className="panel-h"><h2 className="mb-0">{g}</h2></div>
          <MobileList items={rows.filter((r) => r.service_name === g)} row={(p) => {
            const pr = p.parameters.map((x) => +x.price).filter((x) => x > 0);
            const range = pr.length ? `${rupiah(Math.min(...pr))} – ${rupiah(Math.max(...pr))}` : 'belum ada harga';
            return {
              key: p.id, title: p.name, sub: `${p.parameters.length} parameter · ${range}`, right: rupiah(p.package_price),
              pills: pr.length < p.parameters.length ? [['pill-closed', `${p.parameters.length - pr.length} belum ada harga`]] : [],
              detail: {
                rows: [['Layanan', g], ['Paket lengkap SNI', <b>{rupiah(p.package_price)}</b>], ['Jumlah parameter', p.parameters.length], ['Rentang harga', range], ...p.parameters.map((x) => [x.name, x.price ? rupiah(x.price) : '—'])],
                actions: [{ label: 'Ubah harga', icon: 'pencil', primary: true, scrollTo: `harga-edit-${p.id}`, onClick: () => setEdit(JSON.parse(JSON.stringify(p))) }],
              },
            };
          }} />
          <div className="table-responsive d-only">
            <table className="table mb-0 align-middle small">
              <thead><tr><th>Produk</th><th className="text-end">Paket lengkap SNI</th><th className="text-end">Jumlah parameter</th><th className="text-end">Rentang harga parameter</th><th></th></tr></thead>
              <tbody>{rows.filter((r) => r.service_name === g).map((p) => {
                const pr = p.parameters.map((x) => +x.price).filter((x) => x > 0);
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td><td className="text-end num">{rupiah(p.package_price)}</td><td className="text-end num">{p.parameters.length}</td>
                    <td className="text-end num">{pr.length ? `${rupiah(Math.min(...pr))} – ${rupiah(Math.max(...pr))}` : '—'}{pr.length < p.parameters.length && <div className="text-danger">{p.parameters.length - pr.length} belum ada harga</div>}</td>
                    <td className="text-end"><button className="btn btn-sm btn-outline-secondary" onClick={() => setEdit(JSON.parse(JSON.stringify(p)))}>Ubah harga</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          {edit && rows.find((r) => r.id === edit.id)?.service_name === g && (
            <div className="panel-b border-top" id={`harga-edit-${edit.id}`}>
              <h3 className="h6">Ubah harga · {edit.name}</h3>
              <div className="row g-2 mb-2"><div className="col-md-4"><label className="form-label small" htmlFor="pk">Harga paket parameter lengkap SNI (Rp)</label><input id="pk" type="number" min={0} className="form-control form-control-sm" value={edit.package_price ?? ''} onChange={(e) => setEdit({ ...edit, package_price: e.target.value })} /></div></div>
              <div className="table-responsive border rounded px-md-0 px-2" style={{ maxHeight: 360 }}>
                <table className="table table-sm mb-0 small align-middle stack-table">
                  <thead><tr><th>Parameter</th><th>Metode</th><th style={{ width: 170 }}>Harga per sampel (Rp)</th></tr></thead>
                  <tbody>{edit.parameters.map((x, i) => (
                    <tr key={x.id}><td className="st-full"><b>{x.name}</b></td><td className="text-muted2 st-full">{x.method || '—'}</td>
                      <td className="st-full" data-label="Harga per sampel (Rp)"><input type="number" min={0} className="form-control form-control-sm" aria-label={`Harga ${x.name}`} value={x.price ?? ''} onChange={(e) => { const ps = [...edit.parameters]; ps[i] = { ...x, price: e.target.value }; setEdit({ ...edit, parameters: ps }); }} /></td></tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="d-flex gap-2 mt-2"><button className="btn btn-primary btn-sm" onClick={save}>Simpan harga</button><button className="btn btn-outline-secondary btn-sm" onClick={() => setEdit(null)}>Batal</button></div>
            </div>
          )}
        </section>
      ))}
    </>
  );
}

/* ===================== Form pengajuan / form builder (Super Admin) ===================== */
const TYPES = { text: 'Teks singkat', textarea: 'Teks panjang', number: 'Angka', select: 'Pilihan', date: 'Tanggal' };
const SVC = [['SP', 'Sertifikasi Produk'], ['KIM', 'Lab Kimia'], ['FIS', 'Lab Fisika'], ['MIK', 'Lab Mikrobiologi'], ['KAL', 'Lab Kalibrasi']];
const NEWF = { label: '', type: 'text', options: '', required: false, show_when: '', is_active: true };

export function FormBuilder() {
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
                <form className="panel-b row g-2 border-bottom" id="form-isian" onSubmit={saveF}>
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
                <form className="panel-b d-flex flex-column gap-2 border-bottom" id="form-berkas" onSubmit={saveD}>
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

/* ===================== Survei kepuasan (Super Admin) ===================== */
export function Survei() {
  const toast = useToast();
  const [d, setD] = useState(null);
  const [qs, setQs] = useState([]);
  const [thanks, setThanks] = useState('');
  const load = useCallback(() => api.get('/superadmin/survey').then((r) => { setD(r.data); setQs(r.data.questions.filter((x) => x.is_active)); setThanks(r.data.thank_you_text); }), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return <Loading />;
  const save = async () => {
    const removed = d.questions.filter((x) => x.is_active && !qs.some((y) => y.id === x.id)).map((x) => ({ ...x, deleted: true }));
    try { await api.put('/superadmin/survey', { questions: [...qs, ...removed], thank_you_text: thanks }); toast('Pengaturan survei disimpan.'); load(); } catch (ex) { toast(errMsg(ex), 'danger'); }
  };
  const avgAll = d.summary.length ? (d.summary.reduce((t, x) => t + +x.avg, 0) / d.summary.length).toFixed(2) : '—';
  return (
    <>
      <PageHead eyebrow="Super Admin" title="Survei kepuasan pelanggan" sub="Survei wajib diisi pelanggan sebelum mengunduh sertifikat atau LHU, untuk setiap penerbitan dokumen." />
      <div className="row g-3 mb-3">
        {[['Responden', d.total], ['Rata-rata keseluruhan', avgAll], ['Pertanyaan aktif', qs.length]].map(([k, v]) => <div className="col-6 col-md-4" key={k}><div className="stat"><div className="v num">{v}</div><div className="k">{k}</div></div></div>)}
      </div>
      <div className="row g-3">
        <div className="col-lg-6">
          <section className="panel h-100">
            <div className="panel-h"><h2 className="mb-0">Hasil per pertanyaan</h2><span className="small text-muted2">skala 1–5</span></div>
            <div className="panel-b small">
              {d.summary.length ? d.summary.map((x) => (
                <div key={x.question} className="mb-2">
                  <div className="d-flex justify-content-between gap-2"><span>{x.question}</span><b className="num">{x.avg}</b></div>
                  <div className="pbar"><i style={{ width: `${(x.avg / 5) * 100}%` }} /></div>
                </div>
              )) : <p className="text-muted2 mb-0">Belum ada survei yang diisi.</p>}
              {d.per_service.length > 0 && <><div className="eyebrow mt-3 mb-1">Per layanan</div>{d.per_service.map((x) => <div key={x.service} className="d-flex justify-content-between"><span>{x.service} ({x.n} responden)</span><b className="num">{x.avg}</b></div>)}</>}
            </div>
          </section>
        </div>
        <div className="col-lg-6">
          <section className="panel h-100">
            <div className="panel-h"><h2 className="mb-0">Saran terbaru</h2></div>
            <ul className="list-group list-group-flush small">
              {d.recent.filter((x) => x.suggestion).map((x, i) => <li key={i} className="list-group-item"><div className="text-muted2">{x.company_name} · {x.application_no} · {fmtDate(x.created_at)} · rata-rata {x.avg}</div>{x.suggestion}</li>)}
              {!d.recent.some((x) => x.suggestion) && <li className="list-group-item text-muted2">Belum ada saran.</li>}
            </ul>
          </section>
        </div>
        <div className="col-12">
          <section className="panel">
            <div className="panel-h"><h2 className="mb-0">Pengaturan survei</h2></div>
            <div className="panel-b d-flex flex-column gap-2">
              <span className="form-label mb-0">Pertanyaan (skala 1–5)</span>
              {qs.map((x, i) => (
                <div key={x.id || `n${i}`} className="input-group input-group-sm">
                  <span className="input-group-text num">{i + 1}</span>
                  <input className="form-control" aria-label={`Pertanyaan ${i + 1}`} value={x.question} onChange={(e) => setQs(qs.map((y, j) => (j === i ? { ...y, question: e.target.value } : y)))} />
                  <button className="btn btn-outline-danger" aria-label="Hapus pertanyaan" onClick={() => setQs(qs.filter((_, j) => j !== i))}><i className="bi bi-x-lg" /></button>
                </div>
              ))}
              <button className="btn btn-sm btn-outline-secondary align-self-start" onClick={() => setQs([...qs, { question: '' }])}>+ Tambah pertanyaan</button>
              <label className="form-label mb-0 mt-2" htmlFor="ty">Ucapan terima kasih setelah survei</label>
              <textarea id="ty" className="form-control" rows={3} value={thanks} onChange={(e) => setThanks(e.target.value)} />
              <div><button className="btn btn-primary" onClick={save}>Simpan pengaturan</button></div>
              <span className="small text-muted2">Pertanyaan yang dihapus tidak memengaruhi jawaban yang sudah masuk (teks pertanyaan disimpan bersama jawaban).</span>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

