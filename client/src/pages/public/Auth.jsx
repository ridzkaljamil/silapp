import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, homeOf } from '../../AuthContext';
import { errMsg } from '../../api';

function Shell({ title, children }) {
  return (
    <div className="mx-auto panel" style={{ maxWidth: 440 }}>
      <div className="panel-h justify-content-center"><h2 className="mb-0">{title}</h2></div>
      <div className="panel-b">{children}</div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { nav(homeOf(await login(f.email, f.password))); } catch (ex) { setErr(errMsg(ex)); }
  };
  return (
    <Shell title="Masuk ke SILAPP">
      <form onSubmit={submit} className="d-flex flex-column gap-3">
        {err && <div className="alert alert-danger py-2 mb-0">{err}</div>}
        <div><label className="form-label" htmlFor="em">Email</label><input id="em" type="email" className="form-control" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></div>
        <div><label className="form-label" htmlFor="pw">Kata sandi</label><input id="pw" type="password" className="form-control" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></div>
        <button className="btn btn-primary">Masuk</button>
        <p className="small text-center mb-0">Belum punya akun? <Link to="/daftar">Daftar akun perusahaan</Link></p>
      </form>
    </Shell>
  );
}

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', company_name: '', nib_npwp: '', phone: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { nav(homeOf(await register(f))); } catch (ex) { setErr(errMsg(ex)); }
  };
  const fields = [['name', 'Nama penanggung jawab', 'text'], ['company_name', 'Nama perusahaan', 'text'], ['nib_npwp', 'NIB / NPWP', 'text'], ['phone', 'No. HP / WhatsApp', 'tel'], ['email', 'Email', 'email'], ['password', 'Kata sandi (min. 8 karakter)', 'password']];
  return (
    <Shell title="Daftar akun perusahaan">
      <form onSubmit={submit} className="d-flex flex-column gap-3">
        {err && <div className="alert alert-danger py-2 mb-0">{err}</div>}
        {fields.map(([k, l, t]) => (
          <div key={k}><label className="form-label" htmlFor={k}>{l}</label><input id={k} type={t} className="form-control" value={f[k]} onChange={set(k)} required={k !== 'nib_npwp' && k !== 'phone'} minLength={k === 'password' ? 8 : undefined} /></div>
        ))}
        <button className="btn btn-primary">Buat akun</button>
        <p className="small text-center mb-0">Sudah punya akun? <Link to="/masuk">Masuk</Link></p>
      </form>
    </Shell>
  );
}
