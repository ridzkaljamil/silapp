/**
 * Daftar rute aplikasi. Halaman publik utama dimuat langsung; halaman lain dimuat saat dibuka
 * (lazy) agar halaman pertama lebih cepat tampil.
 */
import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { PublicLayout, AppLayout, BareLayout, MinimalLayout } from './components/Layouts';
import Lacak from './pages/public/Lacak';
import { Login, GantiSandi, LupaSandi, ResetSandi } from './pages/public/Auth';

const Layanan = lazy(() => import('./pages/public/Layanan'));
const Directory = lazy(() => import('./pages/public/Directory'));
const Akun = lazy(() => import('./pages/common/Akun'));
// pelanggan
const Beranda = lazy(() => import('./pages/client/Beranda'));
const Ajukan = lazy(() => import('./pages/client/Ajukan'));
const PengajuanList = lazy(() => import('./pages/client/PengajuanList'));
const PengajuanDetail = lazy(() => import('./pages/client/PengajuanDetail'));
// admin & super admin
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Antrean = lazy(() => import('./pages/admin/Antrean'));
const AdminDetail = lazy(() => import('./pages/admin/AdminDetail'));
const AkunPelanggan = lazy(() => import('./pages/admin/AkunPelanggan'));
const DataSertifikat = lazy(() => import('./pages/admin/DataSertifikat'));
const Pengguna = lazy(() => import('./pages/admin/Pengguna'));
const Survei = lazy(() => import('./pages/admin/Survei'));
const LogEmail = lazy(() => import('./pages/admin/LogEmail'));
const KelolaLayanan = lazy(() => import('./pages/admin/layanan/KelolaLayanan'));
const TemplateDokumen = lazy(() => import('./pages/common/TemplateDokumen'));

/** Directory di area admin: tombol kembali ke Data Sertifikat untuk Super Admin dan Admin bidang SP. */
function AdminDirectory() {
  const { user } = useAuth();
  return <Directory inApp backTo={user.role === 'superadmin' || user.bidang === 'SP' ? '/admin/sertifikat' : undefined} />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<BareLayout />}>
        <Route path="masuk" element={<Login />} />
      </Route>
      <Route element={<PublicLayout />}>
        <Route index element={<Lacak />} />
        <Route path="layanan" element={<Layanan />} />
      </Route>
      <Route element={<MinimalLayout />}>
        <Route path="ganti-sandi" element={<GantiSandi />} />
        <Route path="lupa-sandi" element={<LupaSandi />} />
        <Route path="reset-sandi" element={<ResetSandi />} />
      </Route>
      <Route path="klien" element={<AppLayout roles={['user']} />}>
        <Route index element={<Beranda />} />
        <Route path="ajukan" element={<Ajukan />} />
        <Route path="pengajuan" element={<PengajuanList />} />
        <Route path="pengajuan/:id" element={<PengajuanDetail />} />
        <Route path="sandi" element={<GantiSandi />} />
        <Route path="akun" element={<Akun />} />
        <Route path="lacak" element={<Lacak inApp />} />
        <Route path="directory" element={<Directory inApp />} />
        <Route path="template" element={<TemplateDokumen />} />
      </Route>
      <Route path="admin" element={<AppLayout roles={['admin', 'superadmin']} />}>
        <Route index element={<Dashboard />} />
        <Route path="antrean" element={<Antrean />} />
        <Route path="pengajuan/:id" element={<AdminDetail />} />
        <Route path="pelanggan" element={<AkunPelanggan />} />
        <Route path="sertifikat" element={<DataSertifikat />} />
        <Route path="sandi" element={<GantiSandi />} />
        <Route path="akun" element={<Akun />} />
        <Route path="directory" element={<AdminDirectory />} />
        <Route path="template" element={<TemplateDokumen />} />
      </Route>
      <Route path="admin" element={<AppLayout roles={['superadmin']} />}>
        <Route path="pengguna" element={<Pengguna />} />
        <Route path="layanan" element={<KelolaLayanan />} />
        <Route path="survei" element={<Survei />} />
        <Route path="email" element={<LogEmail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
