import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './styles/theme.css';

import { AuthProvider } from './AuthContext';
import { ToastProvider } from './components/ui';
import { PublicLayout, AppLayout } from './components/Layouts';
import Lacak from './pages/public/Lacak';
import Layanan from './pages/public/Layanan';
import Directory from './pages/public/Directory';
import { Login, Register } from './pages/public/Auth';
import { Beranda, PengajuanList, PengajuanDetail } from './pages/client/ClientPages';
import Ajukan from './pages/client/Ajukan';
import { Dashboard, Antrean, AdminDetail } from './pages/admin/AdminPages';
import { Pengguna, Master } from './pages/admin/SuperAdminPages';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<Lacak />} />
              <Route path="layanan" element={<Layanan />} />
              <Route path="directory" element={<Directory />} />
              <Route path="masuk" element={<Login />} />
              <Route path="daftar" element={<Register />} />
            </Route>
            <Route path="klien" element={<AppLayout roles={['user']} />}>
              <Route index element={<Beranda />} />
              <Route path="ajukan" element={<Ajukan />} />
              <Route path="pengajuan" element={<PengajuanList />} />
              <Route path="pengajuan/:id" element={<PengajuanDetail />} />
            </Route>
            <Route path="admin" element={<AppLayout roles={['admin', 'superadmin']} />}>
              <Route index element={<Dashboard />} />
              <Route path="antrean" element={<Antrean />} />
              <Route path="pengajuan/:id" element={<AdminDetail />} />
            </Route>
            <Route path="admin" element={<AppLayout roles={['superadmin']} />}>
              <Route path="pengguna" element={<Pengguna />} />
              <Route path="master" element={<Master />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>,
);
