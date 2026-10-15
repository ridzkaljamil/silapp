/** Kelola pengguna internal & role (Super Admin). */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { useAuth } from '../../AuthContext';
import { PageHead, Loading, useToast, useConfirm, MobileList, initials, fmtDate, Select, FormSheet, DataToolbar, matchText } from '../../components/ui';
import { BIDANG, ROLE } from '../../lib/constants';

const EMPTY = { id: null, role: 'admin', name: '', email: '', password: '', bidang: 'SP', jabatan: '', phone: '', is_active: true };
const INTERNAL = { superadmin: ROLE.superadmin, admin: ROLE.admin };

export default function Pengguna() {
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [jab, setJab] = useState({});
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [flt, setFlt] = useState({ role: '', bidang: '', status: '' });
  const load = useCallback(() => api.get('/superadmin/users').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); api.get('/superadmin/jabatan').then((r) => setJab(r.data)); }, [load]);
  if (!rows) return <Loading />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      if (form.id) await api.put(`/superadmin/users/${form.id}`, form); else await api.post('/superadmin/users', form);
      toast(form.id ? 'Perubahan pengguna disimpan.' : 'Pengguna baru ditambahkan.'); setForm(null); load();
    } catch (ex) { toast(errMsg(ex), 'danger'); } finally { setBusy(false); }
  };
  const del = async (u) => {
    if (!(await confirm({ title: 'Hapus Akun?', body: <>Hapus akun <b>{u.email}</b>? Tindakan ini tidak dapat dibatalkan.</>, ok: 'Hapus', danger: true, icon: 'trash' }))) return;
    try { const r = await api.delete(`/superadmin/users/${u.id}`); toast(r.data.message || 'Akun dihapus.'); load(); } catch (ex) { toast(errMsg(ex), 'danger'); }
  };
  const jabList = jab[form?.bidang] || [];
  const list = rows.filter((u) => matchText(q, u.name, u.email, u.jabatan, BIDANG[u.bidang], ROLE[u.role]?.[1])
    && (!flt.role || u.role === flt.role) && (!flt.bidang || u.bidang === flt.bidang)
    && (!flt.status || (flt.status === 'aktif') === !!u.is_active));
  const filters = [
    { key: 'role', label: 'Role', options: Object.entries(INTERNAL).map(([k, [, t]]) => [k, t]) },
    { key: 'bidang', label: 'Bidang (Admin)', options: Object.entries(BIDANG) },
    { key: 'status', label: 'Status Akun', options: [['aktif', 'Aktif'], ['nonaktif', 'Nonaktif']] },
  ];
  const empty = rows.length ? 'Tidak ada pengguna yang cocok dengan pencarian atau filter.' : 'Belum ada pengguna.';

  return (
    <>
      <PageHead eyebrow="Pengaturan" title="Pengguna Internal"
        sub={<>Akun tim internal PSU (Admin dan Super Admin). Bidang dan jabatan Admin menentukan antrean pengajuan yang ia tangani. Akun pelanggan dikelola di menu <Link to="/admin/pelanggan">Akun Pelanggan</Link>.</>}>
        <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY, jabatan: (jab.SP || [])[0] || '' })}><i className="bi bi-plus-lg" />Tambah Pengguna</button>
      </PageHead>
      <FormSheet open={!!form} onClose={() => setForm(null)} onSubmit={save} busy={busy} wide icon={form?.id ? 'person-gear' : 'person-plus'}
        confirm={() => ({ title: form?.id ? 'Simpan Perubahan Pengguna?' : 'Tambah Pengguna?', body: <>Akun <b>{form?.email}</b> akan {form?.id ? 'diperbarui' : 'dibuat dan langsung bisa dipakai masuk'}.</> })}
        title={form?.id ? 'Ubah Pengguna' : 'Tambah Pengguna'} sub={form?.id ? form.email : 'Akun baru langsung bisa dipakai untuk masuk.'}>
        {form && (
          <div className="row g-3">
            <div className="col-md-6"><label className="form-label" htmlFor="ur">Role</label><Select id="ur" className="form-select" value={form.role} onChange={set('role')} disabled={form.id === me.id}><option value="admin">Admin</option><option value="superadmin">Super Admin</option></Select>{form.id === me.id && <div className="form-text">Role akun Anda sendiri tidak dapat diubah.</div>}</div>
            <div className="col-md-6"><label className="form-label" htmlFor="un">Nama Lengkap</label><input id="un" className="form-control" value={form.name} onChange={set('name')} required /></div>
            <div className="col-md-6"><label className="form-label" htmlFor="ue">Email</label><input id="ue" type="email" className="form-control" value={form.email} onChange={set('email')} required /><div className="form-text">Dipakai untuk masuk.</div></div>
            <div className="col-md-6"><label className="form-label" htmlFor="up">{form.id ? 'Kata Sandi Baru' : 'Kata Sandi Awal'}</label><input id="up" type="password" className="form-control" value={form.password} onChange={set('password')} minLength={8} required={!form.id} autoComplete="new-password" /><div className="form-text">{form.id ? 'Kosongkan jika tidak diganti.' : 'Minimal 8 karakter.'}</div></div>
            {form.role === 'admin' && (<>
              <div className="col-md-6"><label className="form-label" htmlFor="ub">Bidang</label><Select id="ub" className="form-select" value={form.bidang || 'SP'} onChange={(e) => setForm({ ...form, bidang: e.target.value, jabatan: (jab[e.target.value] || [])[0] })}>{Object.entries(BIDANG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
              <div className="col-md-6"><label className="form-label" htmlFor="uj">Jabatan</label><Select id="uj" className="form-select" value={form.jabatan || ''} onChange={set('jabatan')}>{jabList.map((j) => <option key={j}>{j}</option>)}</Select></div>
            </>)}
            {form.id && form.id !== me.id && <div className="col-12"><div className="form-check"><input id="ua" type="checkbox" className="form-check-input" checked={form.is_active} onChange={set('is_active')} /><label htmlFor="ua" className="form-check-label">Akun Aktif</label></div></div>}
          </div>
        )}
      </FormSheet>
      <section className="panel">
        <DataToolbar q={q} onQ={setQ} placeholder="Cari nama atau email" filters={filters} values={flt} onFilter={setFlt} shown={list.length} total={rows.length} unit="pengguna" />
        <MobileList items={list} empty={empty} row={(u) => ({
          key: u.id, avatar: initials(u.name), title: u.name, muted: !u.is_active,
          sub: u.role === 'admin' ? `${u.jabatan || 'Admin'} · ${BIDANG[u.bidang] || ''}` : u.email,
          pills: [ROLE[u.role], u.is_active ? ['pill-done', 'Aktif'] : ['pill-neutral', 'Nonaktif']],
          detail: {
            rows: [['Email', u.email], ['Jabatan', u.jabatan], ['Bidang', BIDANG[u.bidang]], ['Dibuat', u.created_at && fmtDate(u.created_at)]],
            actions: [
              { label: 'Ubah', icon: 'pencil', onClick: () => setForm({ ...EMPTY, ...u, password: '', is_active: !!u.is_active, bidang: u.bidang || 'SP' }) },
              { label: 'Hapus', icon: 'trash', danger: true, hidden: u.id === me.id, onClick: () => del(u) },
            ],
          },
        })} />
        <div className="table-responsive d-only">
        <table className="table mb-0 align-middle">
          <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Jabatan</th><th>Bidang</th><th>Status</th><th></th></tr></thead>
          <tbody>{list.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td><td>{u.email}</td>
              <td><span className={`pill ${ROLE[u.role][0]}`}>{ROLE[u.role][1]}</span></td><td>{u.jabatan || '—'}</td><td>{BIDANG[u.bidang] || '—'}</td>
              <td>{u.is_active ? <span className="pill pill-done">Aktif</span> : <span className="pill pill-neutral">Nonaktif</span>}</td>
              <td className="text-nowrap">
                <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setForm({ ...EMPTY, ...u, password: '', is_active: !!u.is_active, bidang: u.bidang || 'SP' })}>Ubah</button>
                {u.id !== me.id && <button className="btn btn-sm btn-outline-danger" onClick={() => del(u)}>Hapus</button>}
              </td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan={7} className="text-center text-muted2 py-4">{empty}</td></tr>}</tbody>
        </table>
        </div>
      </section>
    </>
  );
}
