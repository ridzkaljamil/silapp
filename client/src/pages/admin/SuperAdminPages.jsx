import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../../api';
import { useAuth } from '../../AuthContext';
import { PageHead, Loading, useToast, useConfirm, MobileList, initials, fmtDate, Select } from '../../components/ui';

const BIDANG = { SP: 'Sertifikasi Produk', LAB: 'Lab Pengujian', KAL: 'Lab Kalibrasi' };
const ROLE = { superadmin: ['pill-done', 'Super Admin'], admin: ['pill-progress', 'Admin'], user: ['pill-action', 'User'] };
const EMPTY = { id: null, role: 'admin', name: '', email: '', password: '', bidang: 'SP', jabatan: '', company_name: '', phone: '', is_active: true };

export function Pengguna() {
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [jab, setJab] = useState({});
  const [form, setForm] = useState(null);
  const load = useCallback(() => api.get('/superadmin/users').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); api.get('/superadmin/jabatan').then((r) => setJab(r.data)); }, [load]);
  if (!rows) return <Loading />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try {
      if (form.id) await api.put(`/superadmin/users/${form.id}`, form); else await api.post('/superadmin/users', form);
      toast('Pengguna disimpan.'); setForm(null); load();
    } catch (ex) { toast(errMsg(ex), 'danger'); }
  };
  const del = async (u) => {
    if (!(await confirm({ title: 'Hapus akun?', body: <>Hapus akun <b>{u.email}</b>? Tindakan ini tidak dapat dibatalkan.</>, ok: 'Hapus', danger: true, icon: 'trash' }))) return;
    try { const r = await api.delete(`/superadmin/users/${u.id}`); toast(r.data.message || 'Akun dihapus.'); load(); } catch (ex) { toast(errMsg(ex), 'danger'); }
  };
  const jabList = jab[form?.bidang] || [];

  return (
    <>
      <PageHead eyebrow="Super Admin" title="Kelola pengguna" sub="3 role login. Admin diberi bidang dan jabatan sesuai rancangan sistem tracking; keduanya dipakai sebagai PIC dan filter antrean, tidak mengubah hak akses.">
        {!form && <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY, jabatan: (jab.SP || [])[0] || '' })}><i className="bi bi-plus-lg me-1" />Tambah pengguna</button>}
      </PageHead>
      {form && (
        <section className="panel mb-3" id="form-pengguna">
          <div className="panel-h"><h2 className="mb-0">{form.id ? 'Ubah pengguna' : 'Tambah pengguna'}</h2></div>
          <form className="panel-b row g-3" onSubmit={save}>
            <div className="col-md-4"><label className="form-label" htmlFor="ur">Role login</label><Select id="ur" className="form-select" value={form.role} onChange={set('role')}><option value="admin">Admin</option><option value="user">User</option><option value="superadmin">Super Admin</option></Select></div>
            <div className="col-md-4"><label className="form-label" htmlFor="un">Nama</label><input id="un" className="form-control" value={form.name} onChange={set('name')} required /></div>
            <div className="col-md-4"><label className="form-label" htmlFor="ue">Email (username)</label><input id="ue" type="email" className="form-control" value={form.email} onChange={set('email')} required /></div>
            {form.role === 'admin' && (<>
              <div className="col-md-4"><label className="form-label" htmlFor="ub">Bidang</label><Select id="ub" className="form-select" value={form.bidang || 'SP'} onChange={(e) => setForm({ ...form, bidang: e.target.value, jabatan: (jab[e.target.value] || [])[0] })}>{Object.entries(BIDANG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
              <div className="col-md-4"><label className="form-label" htmlFor="uj">Jabatan</label><Select id="uj" className="form-select" value={form.jabatan || ''} onChange={set('jabatan')}>{jabList.map((j) => <option key={j}>{j}</option>)}</Select></div>
            </>)}
            {form.role === 'user' && <div className="col-md-4"><label className="form-label" htmlFor="uc">Perusahaan</label><input id="uc" className="form-control" value={form.company_name || ''} onChange={set('company_name')} /></div>}
            <div className="col-md-4"><label className="form-label" htmlFor="up">{form.id ? 'Kata sandi baru (opsional)' : 'Kata sandi awal'}</label><input id="up" type="password" className="form-control" value={form.password} onChange={set('password')} minLength={8} required={!form.id} /></div>
            {form.id && <div className="col-md-4 d-flex align-items-end"><div className="form-check"><input id="ua" type="checkbox" className="form-check-input" checked={form.is_active} onChange={set('is_active')} /><label htmlFor="ua" className="form-check-label">Akun aktif</label></div></div>}
            <div className="col-12 d-flex gap-2"><button className="btn btn-primary">Simpan</button><button type="button" className="btn btn-outline-secondary" onClick={() => setForm(null)}>Batal</button></div>
          </form>
        </section>
      )}
      <section className="panel">
        <MobileList items={rows} row={(u) => ({
          key: u.id, avatar: initials(u.name), title: u.name, muted: !u.is_active,
          sub: u.role === 'admin' ? `${u.jabatan || 'Admin'} · ${BIDANG[u.bidang] || ''}` : u.role === 'user' ? u.company_name : u.email,
          pills: [ROLE[u.role], u.is_active ? ['pill-done', 'Aktif'] : ['pill-neutral', 'Nonaktif']],
          detail: {
            rows: [['Email', u.email], ['Jabatan', u.jabatan], ['Bidang', BIDANG[u.bidang]], ['Perusahaan', u.company_name], ['Dibuat', u.created_at && fmtDate(u.created_at)]],
            actions: [
              { label: 'Ubah', icon: 'pencil', scrollTo: 'form-pengguna', onClick: () => setForm({ ...EMPTY, ...u, password: '', is_active: !!u.is_active, bidang: u.bidang || 'SP' }) },
              { label: 'Hapus', icon: 'trash', danger: true, hidden: u.id === me.id, onClick: () => del(u) },
            ],
          },
        })} />
        <div className="table-responsive d-only">
        <table className="table mb-0 align-middle">
          <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Jabatan</th><th>Bidang</th><th>Status</th><th></th></tr></thead>
          <tbody>{rows.map((u) => (
            <tr key={u.id}>
              <td>{u.name}<div className="small text-muted2">{u.company_name}</div></td><td>{u.email}</td>
              <td><span className={`pill ${ROLE[u.role][0]}`}>{ROLE[u.role][1]}</span></td><td>{u.jabatan || '—'}</td><td>{BIDANG[u.bidang] || '—'}</td>
              <td>{u.is_active ? <span className="pill pill-done">Aktif</span> : <span className="pill pill-neutral">Nonaktif</span>}</td>
              <td className="text-nowrap">
                <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setForm({ ...EMPTY, ...u, password: '', is_active: !!u.is_active, bidang: u.bidang || 'SP' })}>Ubah</button>
                {u.id !== me.id && <button className="btn btn-sm btn-outline-danger" onClick={() => del(u)}>Hapus</button>}
              </td>
            </tr>
          ))}</tbody>
        </table>
        </div>
      </section>
    </>
  );
}

const OPS = { ok: ['pill-done', 'Beroperasi'], dev: ['pill-action', 'Pengembangan'], prep: ['pill-progress', 'Persiapan'] };
export function Master() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => api.get('/superadmin/services').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Loading />;
  const save = async () => {
    try {
      await api.put(`/superadmin/services/${edit.id}`, edit);
      for (const st of edit.steps) await api.put(`/superadmin/steps/${st.id}`, st);
      toast('Master layanan disimpan.'); setEdit(null); load();
    } catch (ex) { toast(errMsg(ex), 'danger'); }
  };
  const leaves = rows.filter((s) => s.bidang);
  return (
    <>
      <PageHead eyebrow="Master layanan" title="Status tracking, contact person, dan SLA" sub="Status utama per layanan sesuai rancangan sistem tracking. Super Admin dapat mengubah contact person, estimasi, status operasional, nama tahap, dan target SLA." />
      <section className="panel mb-3">
        <MobileList items={leaves} row={(s) => ({
          key: s.id, avatar: s.code, title: s.name,
          sub: `${s.steps[0]?.status_code} s.d. ${s.steps.at(-1)?.status_code} · ${s.steps.length} status`,
          pills: [OPS[s.state]],
          detail: {
            rows: [['Kode', <span className="mono">{s.code}</span>], ['Status tracking', `${s.steps[0]?.status_code} s.d. ${s.steps.at(-1)?.status_code}`], ['Kondisional', s.steps.filter((x) => x.is_optional).map((x) => x.status_code).join(', ') || '—'], ['Contact person', s.cp_name ? `${s.cp_name}${s.cp_phone ? ` · ${s.cp_phone}` : ''}` : 'Belum diisi'], ['Estimasi', s.est_text]],
            actions: [{ label: 'Ubah', icon: 'pencil', primary: true, scrollTo: 'master-edit', onClick: () => setEdit(JSON.parse(JSON.stringify(s))) }],
          },
        })} />
        <div className="table-responsive d-only">
        <table className="table mb-0 align-middle">
          <thead><tr><th>Kode</th><th>Layanan</th><th>Status tracking</th><th>Contact person</th><th>Estimasi</th><th>Operasional</th><th></th></tr></thead>
          <tbody>{leaves.map((s) => (
            <tr key={s.id}>
              <td className="mono">{s.code}</td><td>{s.name}</td>
              <td className="small">{s.steps[0]?.status_code} s.d. {s.steps.at(-1)?.status_code}<div className="text-muted2">{s.steps.length} status{s.steps.some((x) => x.is_optional) ? ' · ' + s.steps.filter((x) => x.is_optional).map((x) => x.status_code).join(', ') + ' kondisional' : ''}</div></td>
              <td className="small">{s.cp_name || <span className="text-muted2">Belum diisi</span>}<div className="num">{s.cp_phone}</div></td>
              <td className="small">{s.est_text}</td>
              <td><span className={`pill ${OPS[s.state][0]}`}>{OPS[s.state][1]}</span></td>
              <td><button className="btn btn-sm btn-outline-secondary" onClick={() => setEdit(JSON.parse(JSON.stringify(s)))}>Ubah</button></td>
            </tr>
          ))}</tbody>
        </table>
        </div>
      </section>
      {edit && (
        <section className="panel" id="master-edit">
          <div className="panel-h"><h2 className="mb-0">Ubah {edit.name}</h2></div>
          <div className="panel-b row g-3">
            {[['cp_name', 'Nama contact person'], ['cp_phone', 'No. WhatsApp CP'], ['est_text', 'Estimasi waktu']].map(([k, l]) => (
              <div className="col-md-4" key={k}><label className="form-label" htmlFor={k}>{l}</label><input id={k} className="form-control" value={edit[k] || ''} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></div>
            ))}
            <div className="col-md-4"><label className="form-label" htmlFor="stt">Status operasional</label><Select id="stt" className="form-select" value={edit.state} onChange={(e) => setEdit({ ...edit, state: e.target.value })}><option value="ok">Beroperasi</option><option value="prep">Persiapan</option><option value="dev">Pengembangan</option></Select></div>
            <div className="col-md-8"><label className="form-label" htmlFor="dsc">Deskripsi</label><input id="dsc" className="form-control" value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            <div className="col-12 table-responsive">
              <table className="table table-sm small align-middle mb-0 stack-table">
                <thead><tr><th>Kode</th><th>Nama tahap</th><th>Progres</th><th>Penanda</th><th style={{ width: 130 }}>Target SLA (hari)</th></tr></thead>
                <tbody>{edit.steps.map((st, i) => (
                  <tr key={st.id}>
                    <td className="mono st-full"><b>{st.status_code}</b></td>
                    <td className="st-full" data-label="Nama tahap"><input className="form-control form-control-sm" value={st.name} aria-label={`Nama ${st.status_code}`} onChange={(e) => { const s = [...edit.steps]; s[i] = { ...st, name: e.target.value }; setEdit({ ...edit, steps: s }); }} /></td>
                    <td className="num" data-label="Progres">{st.progress_pct}%</td>
                    <td data-label="Penanda">{[st.is_payment_step && 'bayar', st.is_certificate_step && 'sertifikat', st.is_optional && 'kondisional'].filter(Boolean).join(', ') || '—'}</td>
                    <td className="st-full" data-label="Target SLA (hari)"><input type="number" min={0} className="form-control form-control-sm" value={st.sla_days ?? ''} aria-label={`SLA ${st.status_code}`} onChange={(e) => { const s = [...edit.steps]; s[i] = { ...st, sla_days: e.target.value }; setEdit({ ...edit, steps: s }); }} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="col-12 d-flex gap-2"><button className="btn btn-primary" onClick={save}>Simpan</button><button className="btn btn-outline-secondary" onClick={() => setEdit(null)}>Batal</button></div>
          </div>
        </section>
      )}
    </>
  );
}
