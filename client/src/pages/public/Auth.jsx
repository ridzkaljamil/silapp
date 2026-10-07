import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth, homeOf } from '../../AuthContext';
import api, { errMsg } from '../../api';

function Shell({ title, children }) {
  return (
    <div className="mx-auto panel" style={{ maxWidth: 460 }}>
      <div className="panel-b p-4 d-flex flex-column gap-3">
        <span className="d-grid" style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--chip)', color: 'var(--navy)', placeItems: 'center', fontSize: 22 }}><i className="bi bi-shield-lock" /></span>
        <h1 className="mb-0" style={{ fontSize: '1.5rem' }}>{title}</h1>
        {children}
      </div>
    </div>
  );
}

/** Masuk. Tidak ada pendaftaran mandiri: akun pelanggan dibuat oleh Admin PSU. */
export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const u = await login(f.email, f.password);
      nav(u.must_change_password ? '/ganti-sandi' : homeOf(u));
    } catch (ex) { setErr(errMsg(ex)); } finally { setBusy(false); }
  };
  return (
    <div className="auth-split">
      <section className="auth-brand">
        <div className="d-flex align-items-center justify-content-between gap-2">
        <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none">
          <span className="logo" style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', display: 'grid', placeItems: 'center' }}><img src="/logo-psu.png" alt="" style={{ width: 32 }} /></span>
          <span><b style={{ color: '#fff', display: 'block', fontSize: 17, lineHeight: 1.2 }}>SILAPP</b><small className="auth-brand-sub">PT Penilai Standar Uji</small></span>
        </Link>
        <Link to="/" className="auth-back-m"><i className="bi bi-arrow-left" />Beranda</Link>
        </div>
        <div className="mt-auto d-flex flex-column gap-3" style={{ maxWidth: 440 }}>
          <h1>Pantau sertifikasi dan pengujian produk Anda dalam satu tempat.</h1>
          <ul className="list-unstyled d-flex flex-column gap-2 mb-0 hide-sm2">
            {['Status setiap tahap, terkini', 'Invoice, temuan, dan dokumen terkumpul rapi', 'Sertifikat & LHU siap diunduh'].map((t) => (
              <li key={t} className="d-flex gap-2 align-items-center"><i className="bi bi-check2" style={{ color: 'var(--gold-soft)', fontSize: 18 }} />{t}</li>
            ))}
          </ul>
        </div>
        <div className="small hide-sm2" style={{ color: '#8C9AB2' }}>LSPro LSPR-051-IDN · Laboratorium LP-1554-IDN</div>
      </section>
      <section className="auth-form">
        <Link to="/" className="auth-back"><i className="bi bi-arrow-left" />Kembali ke beranda</Link>
        <form onSubmit={submit}>
          <div><h2 className="h1 mb-1">Masuk</h2><p className="text-muted2 mb-0">Gunakan email dan kata sandi dari PSU.</p></div>
          {err && <div className="alert alert-danger py-2 mb-0">{err}</div>}
          <div><label className="form-label" htmlFor="em">Email</label><input id="em" type="email" autoComplete="username" className="form-control" placeholder="nama@perusahaan.co.id" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></div>
          <div>
            <label className="form-label" htmlFor="pw">Kata sandi</label>
            <div className="input-group">
              <input id="pw" type={show ? 'text' : 'password'} autoComplete="current-password" className="form-control" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
              <button type="button" className="btn btn-outline-secondary" onClick={() => setShow(!show)} aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}><i className={`bi bi-eye${show ? '-slash' : ''}`} /></button>
            </div>
          </div>
          <button className="btn btn-primary" style={{ minHeight: 48 }} disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
          <div className="border-top pt-3 small text-muted2 d-flex flex-column gap-1">
            <span>Belum punya akun atau lupa kata sandi? Hubungi Admin PSU — akun dibuat dan direset oleh PSU.</span>
            <Link to="/" className="fw-semibold">Lacak pengajuan tanpa login →</Link>
          </div>
        </form>
      </section>
    </div>
  );
}

/** Ganti kata sandi: wajib saat login pertama (sandi sementara), bisa juga dipakai kapan saja. */
export function GantiSandi() {
  const { user, setSessionUser } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ old_password: '', new_password: '', confirm: '' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  if (!user) return <Navigate to="/masuk" replace />;
  const forced = user.must_change_password;
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (f.new_password !== f.confirm) return setErr('Konfirmasi kata sandi baru tidak sama.');
    try {
      const r = await api.post('/auth/change-password', f);
      setSessionUser(r.data.user);
      if (forced) nav(homeOf(r.data.user)); else { setOk(true); setF({ old_password: '', new_password: '', confirm: '' }); }
    } catch (ex) { setErr(errMsg(ex)); }
  };
  return (
    <Shell title={forced ? 'Buat kata sandi baru' : 'Ganti kata sandi'}>
      <form onSubmit={submit} className="d-flex flex-column gap-3">
        {forced && <p className="text-muted2 mb-0">Selamat datang, <b className="text-body">{user.name}</b>. Demi keamanan, ganti kata sandi sementara dari email dengan kata sandi Anda sendiri.</p>}
        {ok && <div className="alert alert-success py-2 mb-0">Kata sandi berhasil diganti.</div>}
        {err && <div className="alert alert-danger py-2 mb-0">{err}</div>}
        <div><label className="form-label" htmlFor="op">{forced ? 'Kata sandi sementara' : 'Kata sandi lama'}</label><input id="op" type="password" autoComplete="current-password" className="form-control" value={f.old_password} onChange={(e) => setF({ ...f, old_password: e.target.value })} required /></div>
        <div><label className="form-label" htmlFor="np">Kata sandi baru</label><input id="np" type="password" autoComplete="new-password" minLength={8} className="form-control" value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} required />
          <ul className="list-unstyled small mt-2 mb-0 d-flex flex-column gap-1">
            {[[f.new_password.length >= 8, 'Minimal 8 karakter'], [!!f.new_password && f.new_password !== f.old_password, forced ? 'Berbeda dari kata sandi sementara' : 'Berbeda dari kata sandi lama'], [!!f.confirm && f.confirm === f.new_password, 'Kedua kata sandi baru sama']].map(([ok, t]) => (
              <li key={t} style={{ color: ok ? 'var(--ok)' : 'var(--muted)' }}><i className={`bi bi-${ok ? 'check-circle-fill' : 'circle'} me-2 chk`} />{t}</li>
            ))}
          </ul>
        </div>
        <div><label className="form-label" htmlFor="cp">Ulangi kata sandi baru</label><input id="cp" type="password" autoComplete="new-password" minLength={8} className="form-control" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required /></div>
        <button className="btn btn-primary" style={{ minHeight: 48 }}>{forced ? 'Simpan & lanjutkan' : 'Simpan kata sandi'}</button>
      </form>
    </Shell>
  );
}
