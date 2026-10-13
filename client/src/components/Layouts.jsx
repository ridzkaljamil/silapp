import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Link, Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, homeOf } from '../AuthContext';
import { Avatar, Loading, useConfirm, useReveal } from './ui';
import api from '../api';
import { roleLabel } from '../lib/constants';
import { useContact, waLink } from '../lib/contact';
import { useDismiss } from '../hooks/useDismiss';
import { announce } from '../hooks/useLiveRefresh';

export const Brand = ({ to = '/', sub = 'PT PENILAI STANDAR UJI' }) => (
  <Link to={to} className="brand">
    <span className="logo"><span className="logo-in"><img src="/logo-psu.png" alt="" /></span></span>
    <span className="brand-text"><b>SILAPP</b><small>{sub}</small></span>
  </Link>
);

/** Logo PSU + sapaan di sidebar (design.md, opsi rata tengah). */
const SideBrand = ({ to }) => (
  <Link to={to} className="side-brand" aria-label="SILAPP, ke beranda">
    <span className="logo"><img src="/logo-psu.png" alt="" /></span>
    <span><span className="hi">SELAMAT DATANG DI</span><span className="nm">SILAPP</span></span>
  </Link>
);

/** Ornamen lengkung emas di bawah sidebar (mockup dashboard.svg, versi halus tanpa garis putus-putus). */
export const SideDeco = ({ className = 'side-deco' }) => (
  <svg className={className} aria-hidden="true" viewBox="43 300 256 756" fill="none">
    <defs>
      <linearGradient id="sd2" x1="299.4" y1="743.3" x2="116.4" y2="576.2" gradientUnits="userSpaceOnUse"><stop stopColor="#F3B43A" stopOpacity=".12" /><stop offset=".6" stopColor="#C5A059" stopOpacity=".04" /><stop offset="1" stopColor="#0B1F42" stopOpacity="0" /></linearGradient>
      <linearGradient id="sd4" x1="299.4" y1="1056.2" x2="163.4" y2="608.8" gradientUnits="userSpaceOnUse"><stop stopColor="#D4AF37" stopOpacity=".16" /><stop offset=".5" stopColor="#E8D39E" stopOpacity=".06" /><stop offset="1" stopColor="#0B1F42" stopOpacity="0" /></linearGradient>
      <linearGradient id="sd5" x1="299.4" y1="1056.2" x2="177" y2="653.6" gradientUnits="userSpaceOnUse"><stop stopColor="#F3B43A" stopOpacity=".22" /><stop offset=".5" stopColor="#E8D39E" stopOpacity=".1" /><stop offset="1" stopColor="#D4AF37" stopOpacity="0" /></linearGradient>
      <linearGradient id="sd6" x1="179.6" y1="1056.2" x2="266.9" y2="795" gradientUnits="userSpaceOnUse"><stop stopColor="#E8D39E" stopOpacity=".1" /><stop offset="1" stopColor="#0B1F42" stopOpacity="0" /></linearGradient>
      <linearGradient id="sd7" x1="179.6" y1="1056.2" x2="265.6" y2="734.3" gradientUnits="userSpaceOnUse"><stop stopColor="#F3B43A" stopOpacity=".16" /><stop offset=".5" stopColor="#E8D39E" stopOpacity=".08" /><stop offset="1" stopColor="#D4AF37" stopOpacity="0" /></linearGradient>
    </defs>
    <path d="M299.4 430.4C233.4 508.6 193.4 573.8 203.4 691.1C213.4 795.4 263.4 886.7 299.4 951.9V430.4" fill="url(#sd2)" />
    <path d="M299.4 612.9C243.4 678.1 183.4 743.3 163.4 834.5C138.4 938.8 153.4 1004 168.4 1056.2H299.4V612.9" fill="url(#sd4)" />
    <path d="M299.4 612.9C243.4 678.1 183.4 743.3 163.4 834.5C138.4 938.8 153.4 1004 168.4 1056.2" stroke="url(#sd5)" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M299.4 743.3C223.4 808.5 193.4 886.7 183.4 964.9C175.4 1017.1 181.4 1043.1 188.4 1056.2H299.4V743.3" fill="url(#sd6)" />
    <path d="M299.4 743.3C223.4 808.5 193.4 886.7 183.4 964.9C175.4 1017.1 181.4 1043.1 188.4 1056.2" stroke="url(#sd7)" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

/** Ornamen gelombang emas di kanan atas area konten. */
const PageDeco = ({ className = 'page-deco' }) => (
  <svg className={className} aria-hidden="true" viewBox="294 77 1024 404" preserveAspectRatio="xMaxYMin slice" fill="none">
    <defs>
      <linearGradient id="pd0" x1="1318" y1="77" x2="564.6" y2="481.1" gradientUnits="userSpaceOnUse"><stop stopColor="#FDE68A" stopOpacity=".4" /><stop offset=".35" stopColor="#FEF08A" stopOpacity=".25" /><stop offset=".7" stopColor="#FEF9C3" stopOpacity=".08" /><stop offset="1" stopColor="#FFFFFF" stopOpacity="0" /></linearGradient>
      <linearGradient id="pd1" x1="1318" y1="128" x2="924.3" y2="458.7" gradientUnits="userSpaceOnUse"><stop stopColor="#D97706" stopOpacity=".25" /><stop offset=".5" stopColor="#F59E0B" stopOpacity=".35" /><stop offset="1" stopColor="#FCD34D" stopOpacity="0" /></linearGradient>
    </defs>
    <path d="M1318 77C1188 117 1088 187 948 197C808 207 708 157 568 207C518 227 468 257 438 287V77H1318" fill="url(#pd0)" />
    <path d="M1318 117C1198 157 1068 227 928 222C798 217 688 167 548 227" stroke="url(#pd1)" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

/** Area publik: header putih, latar polos. */
export function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const mainRef = useRef(null);
  useReveal(mainRef);
  useEffect(() => setOpen(false), [loc.pathname]);
  const cta = user ? <Link to={homeOf(user)} className="btn btn-primary">Ke Dashboard</Link> : <Link to="/masuk" className="btn btn-primary">Masuk</Link>;
  return (
    <div className="pub-shell">
      <PageDeco className="pub-deco" />
      <header className="pub-header">
        <div className="inner">
          <Brand />
          <button className="menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}><i className={`bi bi-${open ? 'x-lg' : 'list'}`} /></button>
          <nav className={`pub-nav ${open ? 'open' : ''}`} aria-label="Menu Utama">
            <NavLink end to="/">Lacak Pengajuan</NavLink>
            <NavLink to="/layanan">Layanan</NavLink>
            <span className="pub-cta-m pt-3">{cta}</span>
          </nav>
          <span className="pub-cta">{cta}</span>
        </div>
      </header>
      <main className="pub-main" ref={mainRef}><div key={loc.pathname} className="page-anim"><Page /></div></main>
      <PubFooter />
    </div>
  );
}

/** Footer publik: kontak umum PSU. */
function PubFooter() {
  const c = useContact();
  return (
    <footer className="pub-footer">
      <div className="inner">
        <span><b>PT PENILAI STANDAR UJI</b><span className="d-block">Sertifikasi Produk &amp; Laboratorium Pengujian</span></span>
        <nav className="pub-contact" aria-label="Kontak PSU">
          <a href={waLink(c.phone)} target="_blank" rel="noreferrer"><i className="bi bi-whatsapp" />{c.phone}</a>
          <a href={`mailto:${c.email}`}><i className="bi bi-envelope" />{c.email}</a>
        </nav>
      </div>
    </footer>
  );
}

/** Halaman dimuat saat dibuka (lazy): tampilkan "Memuat…" selama berkasnya diunduh. */
const Page = () => <Suspense fallback={<Loading />}><Outlet /></Suspense>;

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
      <main className="pub-main"><div className="page-anim"><Page /></div></main>
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
    { items: [I('/klien', 'Beranda', 'house'), I('/klien/ajukan', 'Ajukan Layanan', 'plus-circle'), I('/klien/pengajuan', 'Pengajuan Saya', 'list-check'), I('/klien/template', 'Template Dokumen', 'file-earmark-word')] },
    { label: 'Publik', items: [I('/klien/directory', 'Directory', 'journal-text')] },
  ],
  admin: [
    { label: 'Operasional', items: [I('/admin', 'Dashboard', 'grid-1x2'), I('/admin/antrean', 'Antrean Pengajuan', 'inbox', { badge: true }), I('/admin/pelanggan', 'Akun Pelanggan', 'person-plus'), I('/admin/sertifikat', 'Data Sertifikat', 'patch-check', { bidang: 'SP' }), I('/admin/template', 'Template Dokumen', 'file-earmark-word')] },
  ],
  superadmin: [
    { label: 'Operasional', items: [I('/admin', 'Dashboard', 'grid-1x2'), I('/admin/antrean', 'Antrean Pengajuan', 'inbox', { badge: true }), I('/admin/pelanggan', 'Akun Pelanggan', 'person-plus'), I('/admin/sertifikat', 'Data Sertifikat', 'patch-check')] },
    { label: 'Pengaturan', items: [I('/admin/pengguna', 'Pengguna Internal', 'people'), I('/admin/layanan', 'Kelola Layanan', 'layers'), I('/admin/template', 'Template Dokumen', 'file-earmark-word'), I('/admin/survei', 'Survei Kepuasan', 'star')] },
  ],
};
const readCollapsed = () => { try { return localStorage.getItem('silapp_side') === 'min'; } catch { return false; } };

/** true selama media query cocok (mis. lebar layar desktop). */
function useMedia(query) {
  const [ok, setOk] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setOk(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return ok;
}

/** Konfirmasi lalu keluar. Dipakai di sidebar dan menu profil. */
export function useSignOut() {
  const { logout } = useAuth();
  const confirm = useConfirm();
  const nav = useNavigate();
  return async () => {
    const ok = await confirm({ title: 'Keluar dari SILAPP?', body: 'Anda perlu masuk kembali dengan email dan kata sandi untuk membuka akun ini.', ok: 'Ya, Keluar', danger: true, icon: 'box-arrow-right' });
    if (ok) { logout(); nav('/masuk'); }
  };
}

/** Waktu relatif singkat: "baru saja", "5 mnt", "3 jam", "2 hr", lalu tanggal. */
const ago = (s) => {
  const d = new Date(String(s).replace(' ', 'T'));
  const m = Math.round((Date.now() - d) / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} mnt lalu`;
  if (m < 1440) return `${Math.round(m / 60)} jam lalu`;
  if (m < 10080) return `${Math.round(m / 1440)} hari lalu`;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
};

/** Lonceng notifikasi: daftar kabar terbaru, diperbarui berkala. */
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ unread: 0, items: [] });
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  const loc = useLocation();
  const nav = useNavigate();
  const seen = useRef(null);
  const load = useCallback(() => api.get('/notifications').then((r) => {
    // notifikasi baru sejak pengecekan terakhir → halaman yang sedang terbuka ikut diperbarui
    const ids = new Set(r.data.items.map((n) => n.id));
    if (seen.current) {
      const fresh = r.data.items.filter((n) => !seen.current.has(n.id));
      if (fresh.length) announce(fresh.map((n) => n.link));
    }
    seen.current = ids;
    setData(r.data);
  }).catch(() => {}), []);
  // perbarui tiap 15 detik, hanya saat tab sedang dibuka; langsung perbarui saat tab kembali aktif
  useEffect(() => {
    const tick = () => { if (!document.hidden) load(); };
    const t = setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [load]);
  useEffect(() => { setOpen(false); load(); }, [loc.pathname, load]);
  useDismiss(ref, open, close);
  const go = async (n) => {
    setOpen(false);
    if (!n.is_read) { setData((d) => ({ unread: Math.max(0, d.unread - 1), items: d.items.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) })); api.post(`/notifications/${n.id}/read`).catch(() => {}); }
    if (!n.link) return;
    // notifikasi untuk halaman yang sedang dibuka: muat ulang datanya, bukan sekadar pindah halaman
    if (n.link === loc.pathname + loc.search || n.link === loc.pathname) announce([n.link]);
    else nav(n.link);
  };
  const readAll = async () => {
    setData((d) => ({ unread: 0, items: d.items.map((x) => ({ ...x, is_read: true })) }));
    await api.post('/notifications/read-all').catch(() => {});
  };
  return (
    <div className="pm" ref={ref}>
      <button className={`nb-btn ${open ? 'on' : ''}`} onClick={() => setOpen(!open)} aria-haspopup="dialog" aria-expanded={open}
        aria-label={data.unread ? `Notifikasi, ${data.unread} belum dibaca` : 'Notifikasi'} title="Notifikasi">
        <i className="bi bi-bell" />
        {data.unread > 0 && <span className="nb-count" aria-hidden="true" />}
      </button>
      <div className={`pm-menu nb-menu ${open ? 'open' : ''}`} role="dialog" aria-label="Notifikasi" aria-hidden={!open}>
        <div className="nb-head">
          <b>Notifikasi{data.unread > 0 && <span className="nb-sub">{data.unread} belum dibaca</span>}</b>
          {data.unread > 0 && <button type="button" className="btn btn-link btn-sm p-0" style={{ minHeight: 0 }} onClick={readAll} tabIndex={open ? 0 : -1}>Tandai Semua Dibaca</button>}
        </div>
        <div className="nb-list">
          {data.items.length ? data.items.map((n) => (
            <button key={n.id} type="button" className={`nb-item ${n.is_read ? '' : 'unread'}`} onClick={() => go(n)} tabIndex={open ? 0 : -1}>
              <span className="nb-dot" aria-hidden="true" />
              <span className="min-w-0">
                <b>{n.title}</b>
                {n.body && <span className="nb-body">{n.body}</span>}
                <span className="nb-time">{ago(n.created_at)}</span>
              </span>
            </button>
          )) : <p className="text-center text-muted2 small mb-0 py-4">Belum ada notifikasi.</p>}
        </div>
      </div>
    </div>
  );
}

/** Cari global di topbar: pengajuan, layanan, dan pelanggan. */
function GlobalSearch({ staff, onFocusChange }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState(-1);
  const ref = useRef(null);
  const nav = useNavigate();
  const loc = useLocation();
  const close = useCallback(() => { setOpen(false); onFocusChange?.(false); }, [onFocusChange]);
  useDismiss(ref, open, close);
  useEffect(() => { setQ(''); setRes(null); setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRes(null); return undefined; }
    const t = setTimeout(() => api.get('/search', { params: { q: term } }).then((r) => { setRes(r.data.groups); setCur(-1); }).catch(() => setRes([])), 250);
    return () => clearTimeout(t);
  }, [q]);
  const flat = (res || []).flatMap((g) => g.items);
  const go = (it) => { setOpen(false); onFocusChange?.(false); nav(it.link); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCur((c) => Math.min(flat.length - 1, c + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCur((c) => Math.max(-1, c - 1)); }
    else if (e.key === 'Enter' && flat[cur]) { e.preventDefault(); go(flat[cur]); }
  };
  let idx = -1;
  return (
    <div className="gs" ref={ref} role="search">
      <i className="bi bi-search" aria-hidden="true" />
      <input id="gsearch" type="search" value={q} autoComplete="off" onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        placeholder={staff ? 'Cari pengajuan, layanan, atau pelanggan…' : 'Cari pengajuan atau layanan…'} aria-label="Cari" aria-expanded={open && !!res} aria-controls="gs-list" role="combobox" />
      {q && <button type="button" className="gs-clear" aria-label="Hapus Pencarian" onClick={() => { setQ(''); setRes(null); }}><i className="bi bi-x-lg" /></button>}
      {open && res && (
        <div className="gs-menu" id="gs-list" role="listbox" aria-label="Hasil Pencarian">
          {res.map((g) => (
            <div key={g.label}>
              <span className="gs-g">{g.label}</span>
              {g.items.map((it) => { idx += 1; const i = idx; return (
                <button key={it.link + it.title} type="button" role="option" aria-selected={cur === i} className={`gs-item ${cur === i ? 'on' : ''}`} onClick={() => go(it)} onMouseEnter={() => setCur(i)}>
                  <b>{it.title}</b><span>{it.sub}</span>
                </button>
              ); })}
            </div>
          ))}
          {!res.length && <p className="gs-empty">Tidak ada hasil untuk “{q.trim()}”.</p>}
        </div>
      )}
    </div>
  );
}

/** Menu profil di pojok kanan atas. */
function ProfileMenu({ user, roleLabel, base }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  const loc = useLocation();
  const signOut = useSignOut();
  useEffect(() => setOpen(false), [loc.pathname]);
  useDismiss(ref, open, close);
  return (
    <div className="pm" ref={ref}>
      <button className={`pm-btn ${open ? 'on' : ''}`} onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label="Menu Akun">
        <Avatar user={user} />
        <span className="pm-who hide-sm"><b>{user.name}</b><span>{roleLabel}</span></span>
        <i className="bi bi-chevron-down pm-chev hide-sm" aria-hidden="true" />
      </button>
      <div className={`pm-menu ${open ? 'open' : ''}`} role="menu" aria-hidden={!open}>
        <div className="pm-head">
          <Avatar user={user} size={42} />
          <div className="min-w-0"><b>{user.name}</b><span>{user.email}</span><span>{roleLabel}</span></div>
        </div>
        <Link role="menuitem" tabIndex={open ? 0 : -1} to={`${base}/akun`} className="pm-item"><i className="bi bi-person-gear" />Pengaturan Akun</Link>
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
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);
  const [searchOn, setSearchOn] = useState(false);
  const isDesk = useMedia('(min-width: 992px)');
  const mainRef = useRef(null);
  useReveal(mainRef);
  useEffect(() => { setDrawer(false); setSearchOn(false); }, [loc.pathname]);
  const onSearchFocus = useCallback((v) => { if (!v) setSearchOn(false); }, []);
  useEffect(() => { try { localStorage.setItem('silapp_side', collapsed ? 'min' : 'full'); } catch { /* abaikan */ } }, [collapsed]);
  const [needCount, setNeedCount] = useState(0);
  const staff = user && user.role !== 'user' && !user.must_change_password;
  useEffect(() => { if (staff) api.get('/admin/counts').then((r) => setNeedCount(r.data.need_action)).catch(() => {}); }, [staff, loc.pathname]);
  if (!user) return <Navigate to="/masuk" replace />;
  if (user.must_change_password) return <Navigate to="/ganti-sandi" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeOf(user)} replace />;

  const isUser = user.role === 'user';
  const groups = MENUS[user.role].map((g) => ({ ...g, items: g.items.filter((m) => !m.bidang || m.bidang === user.bidang || user.role === 'superadmin') }));
  const roleText = roleLabel(user);
  const base = isUser ? '/klien' : '/admin';
  const link = (m) => (
    <NavLink key={m.to + m.label} end={m.to === base} to={m.to} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`} title={collapsed ? m.label : undefined} aria-label={collapsed ? m.label : undefined}>
      <i className={`bi bi-${m.icon}`} aria-hidden="true" /><span className="txt">{m.label}</span>
      {m.badge && needCount > 0 && <span className="side-badge" title={`${needCount} perlu tindakan PSU`}>{needCount}</span>}
    </NavLink>
  );
  const title = groups.flatMap((g) => g.items).find((m) => (m.to === base ? loc.pathname === base : loc.pathname.startsWith(m.to)))?.label
    || (loc.pathname.includes('/pengajuan/') ? 'Detail Pengajuan' : loc.pathname.endsWith('/sandi') ? 'Ganti Kata Sandi' : loc.pathname.endsWith('/akun') ? 'Pengaturan Akun' : loc.pathname.endsWith('/directory') ? 'Directory' : loc.pathname.endsWith('/lacak') ? 'Lacak Kode' : '');

  // tombol di topbar: desktop menyembunyikan/menampilkan sidebar, HP membuka menu geser
  const toggleSide = () => (isDesk ? setCollapsed((c) => !c) : setDrawer(true));
  const sideLabel = !isDesk ? 'Buka Menu' : collapsed ? 'Tampilkan Sidebar' : 'Sembunyikan Sidebar';

  return (
    <div className={`shell ${collapsed ? 'collapsed' : ''} ${drawer ? 'drawer-open' : ''} ${isUser ? 'has-bottom' : ''}`}>
      <aside className="side" aria-label="Navigasi">
        <SideDeco />
        <button className="drawer-close" onClick={() => setDrawer(false)} aria-label="Tutup Menu"><i className="bi bi-x-lg" /></button>
        <SideBrand to={base} />
        <nav className="side-nav">
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.label && <><div className="side-label">{g.label}</div><div className="side-label-sep" /></>}
              {g.items.map(link)}
            </div>
          ))}
        </nav>
      </aside>
      <div className="scrim" onClick={() => setDrawer(false)} aria-hidden="true" />

      <div className="main-col">
        <header className={`topbar ${searchOn ? 'search-on' : ''}`}>
          <button className="tb-btn" onClick={toggleSide} aria-label={sideLabel} title={sideLabel}>
            <i className={`bi bi-${!isDesk ? 'list' : collapsed ? 'layout-sidebar' : 'layout-sidebar-inset'}`} />
          </button>
          <span className="ttl">{title}</span>
          <GlobalSearch staff={staff} onFocusChange={onSearchFocus} />
          <span className="tb-right">
            <button className="tb-btn gs-open" onClick={() => { setSearchOn(true); setTimeout(() => document.getElementById('gsearch')?.focus(), 30); }} aria-label="Cari"><i className="bi bi-search" /></button>
            <NotificationBell />
            <span className="tb-sep" aria-hidden="true" />
            <ProfileMenu user={user} roleLabel={roleText} base={base} />
          </span>
        </header>
        <main className="app-content" ref={mainRef}>
          <PageDeco />
          <div className="container-x"><div key={loc.pathname} className="page-anim"><Page /></div></div>
        </main>
      </div>

      {isUser && (
        <nav className="bottom-nav" aria-label="Menu Bawah">
          <NavLink end to="/klien" className={({ isActive }) => (isActive ? 'active' : '')}><i className="bi bi-house" />Beranda</NavLink>
          <NavLink to="/klien/ajukan" className={({ isActive }) => (isActive ? 'active' : '')}><i className="bi bi-plus-circle" />Ajukan</NavLink>
          <NavLink to="/klien/pengajuan" className={({ isActive }) => (isActive ? 'active' : '')}><i className="bi bi-list-check" />Pengajuan</NavLink>
          <NavLink to="/klien/akun" className={({ isActive }) => (isActive ? 'active' : '')}><i className="bi bi-person-circle" />Akun</NavLink>
        </nav>
      )}
    </div>
  );
}
