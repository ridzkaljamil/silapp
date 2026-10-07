/** Akun pelanggan: dibuat Admin, sandi sementara dikirim via email. */
import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../../api';
import { PageHead, Loading, useToast, useConfirm, MobileList, initials } from '../../components/ui';

const CUST = { id: null, name: '', email: '', company_name: '', nib_npwp: '', phone: '', address: '', is_active: true };

export default function AkunPelanggan() {
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
