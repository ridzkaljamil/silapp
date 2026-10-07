import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, homeOf } from '../AuthContext';
import { Avatar, useConfirm, useReveal } from './ui';
import api from '../api';

export const Brand = ({ to = '/', sub = 'PT Penilai Standar Uji' }) => (
  <Link to={to} className="brand">
    <span className="logo"><img src="/logo-psu.png" alt="" /></span>
    <span className="brand-text"><b>SILAPP</b><small>{sub}</small></span>
  </Link>
);

/** Area publik: header putih, latar polos. */
export function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const mainRef = useRef(null);
  useReveal(mainRef);
  useEffect(() => setOpen(false), [loc.pathname]);
  const cta = user ? <Link to={homeOf(user)} className="btn btn-primary">Ke dashboard</Link> : <Link to="/masuk" className="btn btn-primary">Masuk</Link>;
  return (
    <>
      <header className="pub-header">
        <div className="inner">
          <Brand />
          <button className="menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}><i className={`bi bi-${open ? 'x-lg' : 'list'}`} /></button>
          <nav className={`pub-nav ${open ? 'open' : ''}`} aria-label="Menu utama">
            <NavLink end to="/">Lacak pengajuan</NavLink>
            <NavLink to="/layanan">Layanan</NavLink>
            <NavLink to="/directory">Directory</NavLink>
            <span className="pub-cta-m pt-3">{cta}</span>
          </nav>
          <span className="pub-cta">{cta}</span>
        </div>
      </header>
      <main className="pub-main" ref={mainRef}><div key={loc.pathname} className="page-anim"><Outlet /></div></main>
    </>
  );
}

/** Ganti sandi wajib (login pertama): header minimal + tombol Keluar. */
export function MinimalLayout() {
  const signOut = useSignOut();
  const { user } = useAuth();
  return (
    <>
      <header className="pub-header">
        <div className="inner">
          <Brand />
          {user && <button className="btn btn-outline-secondary ms-auto" onClick={signOut}><i className="bi bi-box-arrow-right" />Keluar</button>}
        </div>
      </header>
      <main className="pub-main"><div className="page-anim"><Outlet /></div></main>
    </>
  );
}

/** Halaman tanpa header (login): latar ditangani halaman itu sendiri. */
export function BareLayout() {
  return <Outlet />;
}

const I = (to, label, icon, opt = {}) => ({ to, label, icon, ...opt });
const MENUS = {
  user: [
    { items: [I('/klien', 'Beranda', 'house'), I('/klien/ajukan', 'Ajukan layanan', 'plus-circle'), I('/klien/pengajuan', 'Pengajuan saya', 'list-check'), I('/klien/lacak', 'Lacak kode', 'search')] },
    { label: 'Publik', items: [I('/klien/directory', 'Directory', 'journal-text')] },
  ],
  admin: [
    { label: 'Operasional', items: [I('/admin', 'Dashboard', 'grid-1x2'), I('/admin/antrean', 'Antrean pengajuan', 'inbox', { badge: true }), I('/admin/pelanggan', 'Akun pelanggan', 'person-plus'), I('/admin/sertifikat', 'Data sertifikat', 'patch-check', { bidang: 'SP' })] },
    { label: 'Publik', items: [I('/admin/directory', 'Directory', 'journal-text')] },
  ],
  superadmin: [
    { label: 'Operasional', items: [I('/admin', 'Dashboard', 'grid-1x2'), I('/admin/antrean', 'Antrean pengajuan', 'inbox', { badge: true }), I('/admin/pelanggan', 'Akun pelanggan', 'person-plus'), I('/admin/sertifikat', 'Data sertifikat', 'patch-check')] },
    { label: 'Pengaturan', items: [I('/admin/pengguna', 'Pengguna internal', 'people'), I('/admin/master', 'Master layanan', 'layers'), I('/admin/form', 'Form pengajuan', 'ui-checks'), I('/admin/harga', 'Daftar harga lab', 'tags'), I('/admin/survei', 'Survei kepuasan', 'star')] },
    { label: 'Publik', items: [I('/admin/directory', 'Directory', 'journal-text')] },
  ],
};
const BIDANG = { SP: 'Sertifikasi Produk', LAB: 'Lab Pengujian', KAL: 'Lab Kalibrasi' };
const readCollapsed = () => { try { return localStorage.getItem('silapp_side') === 'min'; } catch { return false; } };

/** Konfirmasi lalu keluar. Dipakai di sidebar dan menu profil. */
export function useSignOut() {
  const { logout } = useAuth();
  const confirm = useConfirm();
  const nav = useNavigate();
  return async () => {
    const ok = await confirm({ title: 'Keluar dari SILAPP?', body: 'Anda perlu masuk kembali dengan email dan kata sandi untuk membuka akun ini.', ok: 'Ya, keluar', danger: true, icon: 'box-arrow-right' });
    if (ok) { logout(); nav('/masuk'); }
  };
}

/** Menu profil di pojok kanan atas. */
function ProfileMenu({ user, roleLabel, base }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const loc = useLocation();
  const signOut = useSignOut();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="pm" ref={ref}>
      <button className={`pm-btn ${open ? 'on' : ''}`} onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label="Menu akun">
        <span className="hide-sm pm-name">{user.name}</span>
        <Avatar user={user} />
        <i className="bi bi-chevron-down pm-chev hide-sm" aria-hidden="true" />
      </button>
      <div className={`pm-menu ${open ? 'open' : ''}`} role="menu" aria-hidden={!open}>
        <div className="pm-head">
          <Avatar user={user} size={42} />
          <div className="min-w-0"><b>{user.name}</b><span>{user.email}</span><span>{roleLabel}</span></div>
        </div>
        <Link role="menuitem" tabIndex={open ? 0 : -1} to={`${base}/akun`} className="pm-item"><i className="bi bi-person-gear" />Pengaturan akun</Link>
        <Link role="menuitem" tabIndex={open ? 0 : -1} to={`${base}/sandi`} className="pm-item"><i className="bi bi-key" />Ganti kata sandi</Link>
        <div className="pm-sep" />
        <button role="menuitem" tabIndex={open ? 0 : -1} className="pm-item danger" onClick={() => { setOpen(false); signOut(); }}><i className="bi bi-box-arrow-right" />Keluar</button>
      </div>
    </div>
  );
}

/** Layout area login. roles: role yang boleh masuk. Sidebar bisa disembunyikan (ikon saja). */
export function AppLayout({ roles }) {
  const { user } = useAuth();
  const loc = useLocation();
  const signOut = useSignOut();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);
  const mainRef = useRef(null);
  useReveal(mainRef);
  useEffect(() => setDrawer(false), [loc.pathname]);
  useEffect(() => { try { localStorage.setItem('silapp_side', collapsed ? 'min' : 'full'); } catch { /* abaikan */ } }, [collapsed]);
  const [needCount, setNeedCount] = useState(0);
  const staff = user && user.role !== 'user' && !user.must_change_password;
  useEffect(() => { if (staff) api.get('/admin/counts').then((r) => setNeedCount(r.data.need_action)).catch(() => {}); }, [staff, loc.pathname]);
  if (!user) return <Navigate to="/masuk" replace />;
  if (user.must_change_password) return <Navigate to="/ganti-sandi" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeOf(user)} replace />;

  const isUser = user.role === 'user';
  const groups = MENUS[user.role].map((g) => ({ ...g, items: g.items.filter((m) => !m.bidang || m.bidang === user.bidang || user.role === 'superadmin') }));
  const roleLabel = user.role === 'superadmin' ? 'Super Admin' : user.role === 'admin' ? `${user.jabatan || 'Admin'} · ${BIDANG[user.bidang] || ''}` : user.company_name;
  const base = isUser ? '/klien' : '/admin';
  const link = (m) => (
    <NavLink key={m.to + m.label} end={m.to === base} to={m.to} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`} title={collapsed ? m.label : undefined} aria-label={collapsed ? m.label : undefined}>
      <i className={`bi bi-${m.icon}`} aria-hidden="true" /><span className="txt">{m.label}</span>
      {m.badge && needCount > 0 && <span className="side-badge" title={`${needCount} perlu tindakan PSU`}>{needCount}</span>}
    </NavLink>
  );
  const title = groups.flatMap((g) => g.items).find((m) => (m.to === base ? loc.pathname === base : loc.pathname.startsWith(m.to)))?.label
    || (loc.pathname.includes('/pengajuan/') ? 'Detail pengajuan' : loc.pathname.endsWith('/sandi') ? 'Ganti kata sandi' : loc.pathname.endsWith('/akun') ? 'Pengaturan akun' : '');

  return (
    <div className={`shell ${collapsed ? 'collapsed' : ''} ${drawer ? 'drawer-open' : ''} ${isUser ? 'has-bottom' : ''}`}>
      <aside className="side" aria-label="Navigasi">
        <div className="side-top">
          <Brand to={base} sub={user.role === 'superadmin' ? 'Super Admin' : 'Penilai Standar Uji'} />
          <button className="side-toggle collapse-btn" onClick={() => setCollapsed(true)} aria-label="Sembunyikan sidebar" title="Sembunyikan sidebar">
            <i className="bi bi-layout-sidebar-inset" />
          </button>
          <button className="side-toggle drawer-close" onClick={() => setDrawer(false)} aria-label="Tutup menu"><i className="bi bi-x-lg" /></button>
        </div>
        <nav className="side-nav">
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.label && <><div className="side-label">{g.label}</div><div className="side-label-sep" /></>}
              {g.items.map(link)}
            </div>
          ))}
          <div className="side-label">Akun</div><div className="side-label-sep" />
          {link(I(`${base}/akun`, 'Pengaturan akun', 'person-gear'))}
          {link(I(`${base}/sandi`, 'Ganti kata sandi', 'key'))}
          <button className="side-link" onClick={signOut} title={collapsed ? 'Keluar' : undefined} aria-label={collapsed ? 'Keluar' : undefined}><i className="bi bi-box-arrow-left" aria-hidden="true" /><span className="txt">Keluar</span></button>
        </nav>
        <Link to={`${base}/akun`} className="side-user" title={collapsed ? `${user.name} · ${roleLabel}` : 'Pengaturan akun'}>
          <Avatar user={user} />
          <span className="who"><b>{user.name}</b><span>{roleLabel}</span></span>
        </Link>
      </aside>
      {/* tombol ">" di tengah tepi sidebar saat disembunyikan */}
      <button className="side-edge" onClick={() => setCollapsed(false)} aria-label="Tampilkan sidebar" title="Tampilkan sidebar" tabIndex={collapsed ? 0 : -1}>
        <i className="bi bi-chevron-right" />
      </button>
      <div className="scrim" onClick={() => setDrawer(false)} aria-hidden="true" />

      <div className="main-col">
        <header className="topbar">
          <button className="side-toggle menu-open" onClick={() => setDrawer(true)} aria-label="Buka menu"><i className="bi bi-list" /></button>
          <span className="ttl">{title}</span>
          <span className="ms-auto d-flex align-items-center gap-2">
            {isUser && <span className="hide-sm small text-muted2 pe-1 border-end me-1" style={{ paddingRight: 12 }}>{user.company_name}</span>}
            <ProfileMenu user={user} roleLabel={roleLabel} base={base} />
          </span>
        </header>
        <main className="app-content" ref={mainRef}>
          <div className="container-x"><div key={loc.pathname} className="page-anim"><Outlet /></div></div>
        </main>
      </div>

      {isUser && (
        <nav className="bottom-nav" aria-label="Menu bawah">
          <NavLink end to="/klien" className={({ isActive }) => (isActive ? 'active' : '')}><i className="bi bi-house" />Beranda</NavLink>
          <NavLink to="/klien/ajukan" className={({ isActive }) => (isActive ? 'active' : '')}><i className="bi bi-plus-circle" />Ajukan</NavLink>
          <NavLink to="/klien/pengajuan" className={({ isActive }) => (isActive ? 'active' : '')}><i className="bi bi-list-check" />Pengajuan</NavLink>
          <NavLink to="/klien/akun" className={({ isActive }) => (isActive ? 'active' : '')}><i className="bi bi-person-circle" />Akun</NavLink>
        </nav>
      )}
    </div>
  );
}
