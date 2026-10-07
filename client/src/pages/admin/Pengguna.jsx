/** Kelola pengguna internal & role (Super Admin). */
import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../../api';
import { useAuth } from '../../AuthContext';
import { PageHead, Loading, useToast, useConfirm, MobileList, initials, fmtDate, Select } from '../../components/ui';
import { BIDANG, ROLE } from '../../lib/constants';

const EMPTY = { id: null, role: 'admin', name: '', email: '', password: '', bidang: 'SP', jabatan: '', company_name: '', phone: '', is_active: true };

export default function Pengguna() {
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
