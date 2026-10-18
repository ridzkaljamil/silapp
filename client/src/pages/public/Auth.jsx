import { useEffect, useState } from "react";
import { useNavigate, Navigate, Link, useSearchParams, useLocation } from "react-router-dom";
import { useAuth, homeOf } from "../../AuthContext";
import api, { errMsg, setToken } from "../../api";
import { useContact, waLink } from "../../lib/contact";
import { SideDeco } from "../../components/Layouts";
import { useConfirm } from "../../components/feedback";

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
  // pesan dari halaman lain: sandi baru tersimpan, atau sesi berakhir karena sandi diganti di perangkat lain
  const routeNotice = useLocation().state?.notice;
  const [notice] = useState(() => {
    try {
      const v = sessionStorage.getItem("silapp_notice");
      sessionStorage.removeItem("silapp_notice");
      return v;
    } catch {
      return null;
    }
  });
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
            {["Status setiap tahap, terkini", "Proforma invoice, temuan, dan dokumen terkumpul rapi", "Sertifikat & LHU siap diunduh"].map((t) => (
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
          {(routeNotice || notice) && !err && <div className={`alert py-2 mb-0 ${routeNotice ? "alert-success" : "alert-warning"}`}>{routeNotice || notice}</div>}
          {err && <div className="alert alert-danger py-2 mb-0">{err}</div>}
          <div>
            <label className="form-label" htmlFor="em">
              Email
            </label>
            <input id="em" type="email" autoComplete="username" className="form-control" placeholder="nama@perusahaan.co.id" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
          </div>
          <div>
            <div className="d-flex justify-content-between align-items-baseline gap-2">
              <label className="form-label" htmlFor="pw">
                Kata Sandi
              </label>
              <Link to="/lupa-sandi" className="small fw-semibold">
                Lupa kata sandi?
              </Link>
            </div>
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
              Belum punya akun? Hubungi PSU lewat{" "}
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
  const ask = useConfirm();
  const [f, setF] = useState({ old_password: "", new_password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  if (!user) return <Navigate to="/masuk" replace />;
  const forced = user.must_change_password;
  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (f.new_password !== f.confirm) return setErr("Konfirmasi kata sandi baru tidak sama.");
    if (!(await ask({ title: "Ganti Kata Sandi?", body: "Gunakan kata sandi baru ini saat masuk berikutnya.", ok: "Ya, Ganti", icon: "key" }))) return null;
    try {
      const r = await api.post("/auth/change-password", f);
      setToken(r.data.token); // sesi di perangkat lain otomatis keluar, perangkat ini tetap masuk
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

/** Daftar syarat kata sandi baru (dipakai di halaman ganti & buat ulang kata sandi). */
function PwChecks({ pw, confirm }) {
  return (
    <ul className="list-unstyled small mt-2 mb-0 d-flex flex-column gap-1">
      {[
        [pw.length >= 8, "Minimal 8 karakter"],
        [!!confirm && confirm === pw, "Kedua kata sandi baru sama"],
      ].map(([ok, t]) => (
        <li key={t} style={{ color: ok ? "var(--ok)" : "var(--muted)" }}>
          <i className={`bi bi-${ok ? "check-circle-fill" : "circle"} me-2 chk`} />
          {t}
        </li>
      ))}
    </ul>
  );
}

/** Lupa kata sandi: kirim tautan untuk membuat kata sandi baru ke email akun. */
export function LupaSandi() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      setDone((await api.post("/auth/forgot-password", { email })).data.message);
    } catch (ex) {
      setErr(errMsg(ex));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title="Lupa Kata Sandi">
      {done ? (
        <>
          <div className="alert alert-success py-2 mb-0">{done}</div>
          <p className="text-muted2 small mb-0">Tautan berlaku 30 menit. Tidak menerima email? Tunggu 2 menit lalu minta lagi, atau hubungi PSU.</p>
          <Link to="/masuk" className="btn btn-primary" style={{ minHeight: 48 }}>
            Kembali ke Halaman Masuk
          </Link>
        </>
      ) : (
        <form onSubmit={submit} className="d-flex flex-column gap-3">
          <p className="text-muted2 mb-0">Masukkan email akun SILAPP Anda. Kami kirimkan tautan untuk membuat kata sandi baru.</p>
          {err && <div className="alert alert-danger py-2 mb-0">{err}</div>}
          <div>
            <label className="form-label" htmlFor="fe">
              Email
            </label>
            <input id="fe" type="email" autoComplete="username" className="form-control" placeholder="nama@perusahaan.co.id" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button className="btn btn-primary" style={{ minHeight: 48 }} disabled={busy}>
            {busy ? "Mengirim…" : "Kirim Tautan"}
          </button>
          <Link to="/masuk" className="small fw-semibold">
            ← Kembali ke halaman masuk
          </Link>
        </form>
      )}
    </Shell>
  );
}

/** Buat kata sandi baru dari tautan email (token sekali pakai, 30 menit). */
export function ResetSandi() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const nav = useNavigate();
  const [state, setState] = useState({ loading: true, email: "", invalid: "" });
  const [f, setF] = useState({ new_password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!/^[a-f0-9]{64}$/.test(token)) {
      setState({ loading: false, email: "", invalid: "Tautan tidak lengkap. Buka tautan langsung dari email, atau minta tautan baru." });
      return;
    }
    api
      .get(`/auth/reset-password/${token}`)
      .then((r) => setState({ loading: false, email: r.data.email, invalid: "" }))
      .catch((ex) => setState({ loading: false, email: "", invalid: errMsg(ex) }));
  }, [token]);
  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (f.new_password !== f.confirm) return setErr("Konfirmasi kata sandi baru tidak sama.");
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: f.new_password });
      localStorage.removeItem("silapp_token");
      localStorage.removeItem("silapp_user");
      nav("/masuk", { replace: true, state: { notice: "Kata sandi baru tersimpan. Silakan masuk." } });
    } catch (ex) {
      setErr(errMsg(ex));
    } finally {
      setBusy(false);
    }
    return null;
  };
  if (state.loading) return <Shell title="Buat Kata Sandi Baru"><p className="text-muted2 mb-0">Memeriksa tautan…</p></Shell>;
  if (state.invalid) {
    return (
      <Shell title="Tautan Tidak Berlaku">
        <div className="alert alert-warning py-2 mb-0">{state.invalid}</div>
        <Link to="/lupa-sandi" className="btn btn-primary" style={{ minHeight: 48 }}>
          Minta Tautan Baru
        </Link>
      </Shell>
    );
  }
  return (
    <Shell title="Buat Kata Sandi Baru">
      <form onSubmit={submit} className="d-flex flex-column gap-3">
        <p className="text-muted2 mb-0">
          Untuk akun <b className="text-body">{state.email}</b>. Setelah disimpan, semua perangkat yang sedang masuk akan keluar.
        </p>
        {err && <div className="alert alert-danger py-2 mb-0">{err}</div>}
        <input type="email" autoComplete="username" value={state.email} readOnly hidden />
        <div>
          <label className="form-label" htmlFor="rn">
            Kata Sandi Baru
          </label>
          <input id="rn" type="password" autoComplete="new-password" minLength={8} maxLength={72} className="form-control" value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} required />
          <PwChecks pw={f.new_password} confirm={f.confirm} />
        </div>
        <div>
          <label className="form-label" htmlFor="rc">
            Ulangi Kata Sandi Baru
          </label>
          <input id="rc" type="password" autoComplete="new-password" minLength={8} maxLength={72} className="form-control" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required />
        </div>
        <button className="btn btn-primary" style={{ minHeight: 48 }} disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan Kata Sandi"}
        </button>
      </form>
    </Shell>
  );
}
