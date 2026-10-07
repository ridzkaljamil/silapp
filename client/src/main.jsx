import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/theme.css';

import { AuthProvider, useAuth } from './AuthContext';
import { ToastProvider, ConfirmProvider } from './components/ui';
import { PublicLayout, AppLayout, BareLayout, MinimalLayout } from './components/Layouts';
import Lacak from './pages/public/Lacak';
import Layanan from './pages/public/Layanan';
import Directory from './pages/public/Directory';
import { Login, GantiSandi } from './pages/public/Auth';
import { Beranda, PengajuanList, PengajuanDetail } from './pages/client/ClientPages';
import Ajukan from './pages/client/Ajukan';
import { Dashboard, Antrean, AdminDetail } from './pages/admin/AdminPages';
import { Pengguna, Master } from './pages/admin/SuperAdminPages';
import Akun from './pages/common/Akun';
import { AkunPelanggan, DataSertifikat, HargaLab, FormBuilder, Survei } from './pages/admin/ManagePages';

/** Directory di area admin: tombol Kelola untuk Super Admin dan Admin bidang SP. */
function AdminDirectory() {
  const { user } = useAuth();
  return <Directory inApp manageTo={user.role === 'superadmin' || user.bidang === 'SP' ? '/admin/sertifikat' : undefined} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
        <BrowserRouter>
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
        </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>,
);
