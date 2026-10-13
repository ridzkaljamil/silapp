import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { useAuth, homeOf } from "../../AuthContext";
import api, { errMsg } from "../../api";
import { useContact, waLink } from "../../lib/contact";
import { SideDeco } from "../../components/Layouts";

function Shell({ title, children }) {
  return (
    <div className="mx-auto panel" style={{ maxWidth: 460 }}>
      <div className="panel-b p-4 d-flex flex-column gap-3">
        <span className="d-grid" style={{ width: 48, height: 48, borderRadius: 12, background: "var(--chip)", color: "var(--navy)", placeItems: "center", fontSize: 22 }}>
          <i className="bi bi-shield-lock" />
        </span>
        <h1 className="mb-0" style={{ fontSize: "1.5rem" }}>
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}

/** Masuk. Tidak ada pendaftaran mandiri: akun pelanggan dibuat oleh Admin PSU. */
export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", password: "" });
  const contact = useContact();
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const u = await login(f.email, f.password);
      nav(u.must_change_password ? "/ganti-sandi" : homeOf(u));
    } catch (ex) {
      setErr(errMsg(ex));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-split">
      <section className="auth-brand">
        <SideDeco className="auth-deco" />
        <div className="d-flex align-items-center justify-content-between gap-2">
          <Link to="/" className="auth-logo" aria-label="SILAPP, ke beranda">
            <span className="lg">
              <img src="/logo-psu.png" alt="" />
            </span>
            <span>
              <span className="hi">SELAMAT DATANG DI</span>
              <span className="nm">SILAPP</span>
            </span>
          </Link>
          <Link to="/" className="auth-back-m">
            <i className="bi bi-arrow-left" />
            Beranda
          </Link>
        </div>
        <div className="mt-auto d-flex flex-column gap-3" style={{ maxWidth: 440 }}>
          <div className="small hide-sm2" style={{ color: "var(--gold)" }}>
            LSPro LSPR-051-IDN · Laboratorium LP-1554-IDN
          </div>
          <h1>Pantau sertifikasi dan pengujian produk Anda dalam satu tempat.</h1>
          <ul className="list-unstyled d-flex flex-column gap-3 mb-0 hide-sm2 auth-checks">
            {["Status setiap tahap, terkini", "Invoice, temuan, dan dokumen terkumpul rapi", "Sertifikat & LHU siap diunduh"].map((t) => (
              <li key={t} className="d-flex gap-3 align-items-center">
                <span className="ck">
                  <i className="bi bi-check-lg" aria-hidden="true" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="auth-form">
        <Link to="/" className="auth-back">
          <i className="bi bi-arrow-left" />
          Kembali ke Beranda
        </Link>
        <form onSubmit={submit}>
          <div>
            <h2 className="h1 mb-1">Masuk</h2>
            <p className="text-muted2 mb-0">Gunakan email dan kata sandi dari PSU.</p>
          </div>
          {err && <div className="alert alert-danger py-2 mb-0">{err}</div>}
          <div>
            <label className="form-label" htmlFor="em">
              Email
            </label>
            <input id="em" type="email" autoComplete="username" className="form-control" placeholder="nama@perusahaan.co.id" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
          </div>
          <div>
            <label className="form-label" htmlFor="pw">
              Kata Sandi
            </label>
            <div className="pw-wrap">
              <input id="pw" type={show ? "text" : "password"} autoComplete="current-password" className="form-control" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
              <button type="button" className="pw-eye" onClick={() => setShow(!show)} aria-label={show ? "Sembunyikan Kata Sandi" : "Tampilkan Kata Sandi"}>
                <i className={`bi bi-eye${show ? "-slash" : ""}`} />
              </button>
            </div>
          </div>
          <button className="btn btn-primary" style={{ minHeight: 52, fontSize: 16 }} disabled={busy}>
            {busy ? "Memproses…" : "Masuk"}
          </button>
          <div className="border-top pt-3 small text-muted2 d-flex flex-column gap-1">
            <span>
              Belum punya akun atau lupa kata sandi? Hubungi PSU lewat{" "}
              <a href={waLink(contact.phone, "Halo PSU, saya butuh bantuan akun SILAPP.")} target="_blank" rel="noreferrer" className="fw-semibold">
                WhatsApp
              </a>{" "}
              atau{" "}
              <a href={`mailto:${contact.email}`} className="fw-semibold">
                Email
              </a>
              .
            </span>
            <Link to="/" className="fw-semibold">
              Lacak Pengajuan Tanpa Login →
            </Link>
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
  const [f, setF] = useState({ old_password: "", new_password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  if (!user) return <Navigate to="/masuk" replace />;
  const forced = user.must_change_password;
  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (f.new_password !== f.confirm) return setErr("Konfirmasi kata sandi baru tidak sama.");
    try {
      const r = await api.post("/auth/change-password", f);
      setSessionUser(r.data.user);
      if (forced) nav(homeOf(r.data.user));
      else {
        setOk(true);
        setF({ old_password: "", new_password: "", confirm: "" });
      }
    } catch (ex) {
      setErr(errMsg(ex));
    }
  };
  return (
    <Shell title={forced ? "Buat Kata Sandi Baru" : "Ganti Kata Sandi"}>
      <form onSubmit={submit} className="d-flex flex-column gap-3">
        {forced && (
          <p className="text-muted2 mb-0">
            Selamat datang, <b className="text-body">{user.name}</b>. Demi keamanan, ganti kata sandi sementara dari email dengan kata sandi Anda sendiri.
          </p>
        )}
        {ok && <div className="alert alert-success py-2 mb-0">Kata sandi berhasil diganti.</div>}
        {err && <div className="alert alert-danger py-2 mb-0">{err}</div>}
        <div>
          <label className="form-label" htmlFor="op">
            {forced ? "Kata Sandi Sementara" : "Kata Sandi Lama"}
          </label>
          <input id="op" type="password" autoComplete="current-password" className="form-control" value={f.old_password} onChange={(e) => setF({ ...f, old_password: e.target.value })} required />
        </div>
        <div>
          <label className="form-label" htmlFor="np">
            Kata Sandi Baru
          </label>
          <input id="np" type="password" autoComplete="new-password" minLength={8} className="form-control" value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} required />
          <ul className="list-unstyled small mt-2 mb-0 d-flex flex-column gap-1">
            {[
              [f.new_password.length >= 8, "Minimal 8 karakter"],
              [!!f.new_password && f.new_password !== f.old_password, forced ? "Berbeda dari kata sandi sementara" : "Berbeda dari kata sandi lama"],
              [!!f.confirm && f.confirm === f.new_password, "Kedua kata sandi baru sama"],
            ].map(([ok, t]) => (
              <li key={t} style={{ color: ok ? "var(--ok)" : "var(--muted)" }}>
                <i className={`bi bi-${ok ? "check-circle-fill" : "circle"} me-2 chk`} />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <label className="form-label" htmlFor="cp">
            Ulangi Kata Sandi Baru
          </label>
          <input id="cp" type="password" autoComplete="new-password" minLength={8} className="form-control" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required />
        </div>
        <button className="btn btn-primary" style={{ minHeight: 48 }}>
          {forced ? "Simpan & Lanjutkan" : "Simpan Kata Sandi"}
        </button>
      </form>
    </Shell>
  );
}
