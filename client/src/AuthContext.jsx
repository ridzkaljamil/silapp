import { createContext, useContext, useEffect, useState } from 'react';
import api from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('silapp_user')); } catch { return null; }
  });

  const setSessionUser = (u) => {
    localStorage.setItem('silapp_user', JSON.stringify(u));
    setUser(u);
    return u;
  };
  // Segarkan data akun (mis. foto profil) dari server saat aplikasi dibuka.
  useEffect(() => {
    if (!localStorage.getItem('silapp_token')) return;
    api.get('/auth/me').then((r) => setSessionUser(r.data)).catch(() => {});
  }, []);
  const login = async (email, password) => {
    const { token, user: u } = (await api.post('/auth/login', { email, password })).data;
    localStorage.setItem('silapp_token', token);
    return setSessionUser(u);
  };
  const logout = () => {
    localStorage.removeItem('silapp_token');
    localStorage.removeItem('silapp_user');
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, login, logout, setSessionUser }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

/** Halaman awal sesuai role setelah login. */
export const homeOf = (u) => (!u ? '/' : u.must_change_password ? '/ganti-sandi' : u.role === 'user' ? '/klien' : '/admin');
