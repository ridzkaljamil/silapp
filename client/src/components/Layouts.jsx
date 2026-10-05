import { NavLink, Link, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAuth, homeOf } from '../AuthContext';

const Brand = () => (
  <Link to="/" className="brand d-flex align-items-center gap-2 text-decoration-none">
    <img src="/logo-psu.png" alt="Logo PSU" />
    <span><b>SILAPP</b><small>PT PENILAI STANDAR UJI</small></span>
  </Link>
);

export function PublicLayout() {
  const { user } = useAuth();
  return (
    <>
      <nav className="appbar navbar navbar-expand-md px-3 py-2 sticky-top">
        <Brand />
        <button className="navbar-toggler border-0 text-white" data-bs-toggle="collapse" data-bs-target="#pubnav" aria-label="Menu"><i className="bi bi-list fs-3" /></button>
        <div className="collapse navbar-collapse" id="pubnav">
          <ul className="navbar-nav ms-auto align-items-md-center gap-md-1">
            <li className="nav-item"><NavLink end to="/" className="nav-link">Lacak pengajuan</NavLink></li>
            <li className="nav-item"><NavLink to="/layanan" className="nav-link">Layanan</NavLink></li>
            <li className="nav-item"><NavLink to="/directory" className="nav-link">Directory</NavLink></li>
            <li className="nav-item ms-md-2">
              {user ? <Link to={homeOf(user)} className="btn btn-gold btn-sm">Ke dashboard</Link>
                : <Link to="/masuk" className="btn btn-gold btn-sm">Masuk / Daftar</Link>}
            </li>
          </ul>
        </div>
      </nav>
      <main className="container py-4" style={{ maxWidth: 1120 }}><Outlet /></main>
    </>
  );
}

const MENUS = {
  user: [['/klien', 'Beranda', 'house'], ['/klien/ajukan', 'Ajukan layanan', 'plus-lg'], ['/klien/pengajuan', 'Pengajuan saya', 'list-ul'], ['/', 'Lacak kode', 'search']],
  admin: [['/admin', 'Dashboard', 'grid'], ['/admin/antrean', 'Antrean pengajuan', 'inbox'], ['/directory', 'Directory', 'journal-text']],
  superadmin: [['/admin', 'Dashboard', 'grid'], ['/admin/antrean', 'Antrean pengajuan', 'inbox'], ['/admin/pengguna', 'Kelola pengguna', 'people'], ['/admin/master', 'Master layanan', 'layers'], ['/directory', 'Directory', 'journal-text']],
};
const BIDANG = { SP: 'Sertifikasi Produk', LAB: 'Lab Pengujian', KAL: 'Lab Kalibrasi' };

/** Layout area login. roles: role yang boleh masuk. */
export function AppLayout({ roles }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  if (!user) return <Navigate to="/masuk" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeOf(user)} replace />;
  const label = user.role === 'superadmin' ? 'Super Admin' : user.role === 'admin' ? `Admin · ${BIDANG[user.bidang] || ''}` : 'Area pelanggan';
  return (
    <>
      <nav className="appbar navbar px-3 py-2 sticky-top">
        <Brand />
        <div className="d-flex align-items-center gap-2 small" style={{ color: '#B7C4D9' }}>
          <span className="d-none d-sm-inline">{user.role === 'user' ? user.company_name : `${user.name}${user.jabatan ? ' · ' + user.jabatan : ''}`}</span>
          <span className="rounded-circle d-grid fw-semibold text-white" style={{ width: 30, height: 30, placeItems: 'center', background: 'var(--psu-steel)' }}>{user.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
        </div>
      </nav>
      <div className="d-flex app-shell">
        <aside className="sidebar p-2">
          <div className="side-label eyebrow px-2 pt-2 pb-1">{label}</div>
          <nav className="nav flex-column gap-1">
            {MENUS[user.role].map(([to, t, ic]) => (
              <NavLink key={to + t} end={to === '/klien' || to === '/admin'} to={to} className="nav-link"><i className={`bi bi-${ic}`} />{t}</NavLink>
            ))}
            <div className="side-label eyebrow px-2 pt-3 pb-1">Akun</div>
            <button className="nav-link btn btn-link text-start" onClick={() => { logout(); nav('/'); }}><i className="bi bi-box-arrow-left" />Keluar</button>
          </nav>
        </aside>
        <main className="flex-grow-1 p-3 p-md-4" style={{ minWidth: 0 }}>
          <div className="mx-auto" style={{ maxWidth: 1120 }}><Outlet /></div>
        </main>
      </div>
    </>
  );
}
