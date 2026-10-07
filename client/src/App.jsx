/**
 * Daftar rute aplikasi. Halaman publik utama dimuat langsung; halaman lain dimuat saat dibuka
 * (lazy) agar halaman pertama lebih cepat tampil.
 */
import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { PublicLayout, AppLayout, BareLayout, MinimalLayout } from './components/Layouts';
import Lacak from './pages/public/Lacak';
import { Login, GantiSandi } from './pages/public/Auth';

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
const Master = lazy(() => import('./pages/admin/Master'));
const FormBuilder = lazy(() => import('./pages/admin/FormBuilder'));
const HargaLab = lazy(() => import('./pages/admin/HargaLab'));
const Survei = lazy(() => import('./pages/admin/Survei'));

/** Directory di area admin: tombol Kelola untuk Super Admin dan Admin bidang SP. */
function AdminDirectory() {
  const { user } = useAuth();
  return <Directory inApp manageTo={user.role === 'superadmin' || user.bidang === 'SP' ? '/admin/sertifikat' : undefined} />;
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
        <Route path="directory" element={<Directory />} />
      </Route>
      <Route element={<MinimalLayout />}>
        <Route path="ganti-sandi" element={<GantiSandi />} />
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
      </Route>
      <Route path="admin" element={<AppLayout roles={['superadmin']} />}>
        <Route path="pengguna" element={<Pengguna />} />
        <Route path="master" element={<Master />} />
        <Route path="form" element={<FormBuilder />} />
        <Route path="harga" element={<HargaLab />} />
        <Route path="survei" element={<Survei />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
