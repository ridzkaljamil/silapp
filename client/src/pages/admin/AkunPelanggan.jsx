/** Akun pelanggan: dibuat Admin, sandi sementara dikirim via email. */
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { Paged, PageHead, Loading, useToast, useConfirm, MobileList, initials, FormSheet, Sheet, DataToolbar, matchText } from '../../components/ui';

const CUST = { id: null, name: '', email: '', company_name: '', nib: '', npwp: '', phone: '', address: '', is_active: true };

export default function AkunPelanggan() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null);
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  useEffect(() => { if (params.get('q')) setQ(params.get('q')); }, [params]);
  const [flt, setFlt] = useState({ status: '' });
  const load = useCallback(() => api.get('/customers').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Loading />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async (extra = {}) => {
    setBusy(true);
    const body = { ...form, ...extra };
    try {
      if (form.id) { await api.put(`/customers/${form.id}`, body); toast('Data pelanggan disimpan.'); setCreated(null); } else {
        const r = await api.post('/customers', body);
        setCreated({ email: form.email, company: form.company_name, pass: r.data.temp_password });
        toast('Akun dibuat. Info login dikirim ke email pelanggan.');
      }
      setForm(null); load();
    } catch (ex) {
      // NIB/NPWP sudah dipakai akun lain (mis. cabang dengan PIC berbeda): minta konfirmasi, bukan langsung ditolak
      if (ex.response?.data?.code === 'DUPLICATE_COMPANY') {
        setBusy(false);
        if (await confirm({ title: 'Perusahaan Sudah Terdaftar?', body: errMsg(ex), ok: 'Ya, Simpan Terpisah', icon: 'exclamation-triangle' })) return save({ confirm_duplicate: true });
        return null;
      }
      toast(errMsg(ex), 'danger');
    } finally { setBusy(false); }
    return null;
  };
  const reset = async (u) => {
    if (!(await confirm({ title: 'Reset Kata Sandi?', body: <>Kata sandi sementara baru akan dikirim ke <b>{u.email}</b>. Pelanggan wajib menggantinya saat login, dan sesi yang sedang masuk di perangkat lain akan keluar.</>, ok: 'Ya, Reset' }))) return;
    try { const r = await api.post(`/customers/${u.id}/reset-password`); setCreated({ email: u.email, company: u.company_name, pass: r.data.temp_password, reset: true }); } catch (ex) { toast(errMsg(ex), 'danger'); }
  };
  const stateOf = (u) => (!u.is_active ? 'nonaktif' : u.must_change_password ? 'baru' : 'aktif');
  const list = rows.filter((r) => matchText(q, r.name, r.email, r.company_name, r.phone, r.nib, r.npwp) && (!flt.status || stateOf(r) === flt.status));
  const empty = rows.length ? 'Tidak ada pelanggan yang cocok dengan pencarian atau filter.' : 'Belum ada akun pelanggan.';
  const filters = [{ key: 'status', label: 'Status Akun', options: [['aktif', 'Aktif'], ['baru', 'Belum Login'], ['nonaktif', 'Nonaktif']] }];
  // semua data akun pelanggan wajib diisi; hanya Admin & Super Admin yang dapat mengubahnya
  // [kunci, label, tipe, wajib, petunjuk, angka]
  const fields = [['company_name', 'Nama Perusahaan', 'text', true], ['nib', 'NIB', 'text', true, '13 digit angka', true],
    ['npwp', 'NPWP', 'text', true, '15 atau 16 digit angka', true], ['address', 'Alamat Perusahaan (Sesuai NPWP)', 'textarea', true],
    ['name', 'Nama Penanggung Jawab', 'text', true], ['email', 'Email (untuk Login)', 'email', true], ['phone', 'No. HP / WhatsApp', 'tel', true]];
  return (
    <>
      <PageHead eyebrow="Operasional" title="Akun Pelanggan"
        sub="Daftar perusahaan yang bisa masuk ke SILAPP untuk mengajukan dan memantau layanan. Buat akun setelah harga disepakati; kata sandi sementara langsung dikirim ke email pelanggan.">
        <button className="btn btn-primary" onClick={() => { setForm({ ...CUST }); setCreated(null); }}><i className="bi bi-person-plus" />Buat Akun Pelanggan</button>
      </PageHead>
      <Sheet open={!!created} onClose={() => setCreated(null)} icon="check2-circle" title={created?.reset ? 'Kata Sandi Direset' : 'Akun Berhasil Dibuat'}
        sub={created && `${created.company} · ${created.email}`}
        footer={<button className="btn btn-primary" onClick={() => setCreated(null)}>Selesai</button>}>
        {created && (
          <div className="d-flex flex-column gap-2 small">
            <p className="mb-0">Info login sudah dikirim ke email pelanggan. Simpan kata sandi sementara ini kalau-kalau email tidak sampai; kata sandi hanya ditampilkan sekali.</p>
            <div className="d-flex align-items-center gap-2 border rounded-3 p-2 bg-light">
              <span className="mono fw-bold flex-grow-1" style={{ fontSize: 15 }}>{created.pass}</span>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => navigator.clipboard?.writeText(created.pass).then(() => toast('Kata sandi disalin.'))}><i className="bi bi-clipboard" />Salin</button>
            </div>
            <p className="mb-0 text-muted2">Pelanggan wajib mengganti kata sandi ini saat pertama kali masuk.</p>
          </div>
        )}
      </Sheet>
      <FormSheet open={!!form} onClose={() => setForm(null)} onSubmit={() => save()} busy={busy} wide icon={form?.id ? 'building-gear' : 'person-plus'}
        confirm={() => (form?.id ? { title: 'Simpan Data Pelanggan?', body: <>Perubahan data <b>{form.company_name}</b> akan disimpan.</> } : { title: 'Buat Akun Pelanggan?', body: <>Akun untuk <b>{form?.company_name}</b> dibuat dan kata sandi sementara dikirim ke <b>{form?.email}</b>.</> })}
        title={form?.id ? 'Ubah Data Pelanggan' : 'Buat Akun Pelanggan'} submitLabel={form?.id ? 'Simpan' : 'Buat Akun & Kirim Email'}
        sub={form?.id ? form.company_name : 'Info login dan kata sandi sementara akan dikirim ke email di bawah.'}>
        {form && (
          <div className="row g-3">
            {fields.map(([k, l, t, req, hint, digits]) => (
              <div className={t === 'textarea' ? 'col-12' : 'col-md-6'} key={k}><label className="form-label" htmlFor={`c-${k}`}>{l}{req && <span className="text-danger"> *</span>}</label>
                {t === 'textarea'
                  ? <textarea id={`c-${k}`} rows={2} className="form-control" value={form[k] || ''} onChange={set(k)} required={req} maxLength={255} />
                  : <input id={`c-${k}`} type={t} className="form-control" value={form[k] || ''} onChange={set(k)} required={req} inputMode={digits ? 'numeric' : undefined} maxLength={digits ? 25 : undefined} placeholder={hint} />}
              </div>
            ))}
            {form.id && <div className="col-12"><div className="form-check"><input id="c-act" type="checkbox" className="form-check-input" checked={!!form.is_active} onChange={set('is_active')} /><label htmlFor="c-act" className="form-check-label">Akun Aktif</label></div></div>}
          </div>
        )}
      </FormSheet>
      <section className="panel">
        <DataToolbar q={q} onQ={setQ} placeholder="Cari perusahaan" filters={filters} values={flt} onFilter={setFlt} shown={list.length} total={rows.length} unit="akun" />
        <Paged list={list} unit="akun">{(page) => (<>
<MobileList items={page} empty={empty} row={(u) => ({
          key: u.id, avatar: initials(u.company_name || u.name), title: u.company_name, sub: `${u.name} · ${u.applications} pengajuan`, muted: !u.is_active,
          pills: [['pill-action', 'User'], !u.is_active ? ['pill-neutral', 'Nonaktif'] : u.must_change_password ? ['pill-progress', 'Belum Login'] : ['pill-done', 'Aktif']],
          detail: {
            rows: [['Penanggung Jawab', u.name], ['Email', u.email], ['Telepon', u.phone || '—'], ['NIB', u.nib || '—'], ['NPWP', u.npwp || '—'], ['Alamat (Sesuai NPWP)', u.address], ['Pengajuan', u.applications]],
            actions: [
              { label: 'Ubah', icon: 'pencil', onClick: () => { setForm({ ...CUST, ...u, is_active: !!u.is_active }); setCreated(null); } },
              { label: 'Reset Sandi', icon: 'key', onClick: () => reset(u) },
            ],
          },
        })} />
        <div className="table-responsive d-only">
          <table className="table mb-0 align-middle">
            <thead><tr><th>Perusahaan</th><th>Penanggung Jawab</th><th>Kontak</th><th>Pengajuan</th><th>Status</th><th></th></tr></thead>
            <tbody>{page.map((u) => (
              <tr key={u.id}>
                <td>{u.company_name}<div className="small text-muted2">{[u.nib && `NIB ${u.nib}`, u.npwp && `NPWP ${u.npwp}`].filter(Boolean).join(' · ')}</div></td>
                <td>{u.name}<div className="small text-muted2">{u.email}</div></td>
                <td className="small">{u.phone || '—'}</td>
                <td className="num">{u.applications}</td>
                <td className="small">{!u.is_active ? <span className="pill pill-neutral">Nonaktif</span> : u.must_change_password ? <span className="pill pill-progress">Belum Login</span> : <span className="pill pill-done">Aktif</span>}</td>
                <td className="text-nowrap text-end">
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => { setForm({ ...CUST, ...u, is_active: !!u.is_active }); setCreated(null); }}>Ubah</button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => reset(u)}>Reset Sandi</button>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={6} className="text-center text-muted2 py-4">{empty}</td></tr>}</tbody>
          </table>
        </div>
</>)}</Paged>
      </section>
    </>
  );
}
