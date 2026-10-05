import { createContext, useContext, useState } from 'react';
import api from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('silapp_user')); } catch { return null; }
  });

  const save = ({ token, user: u }) => {
    localStorage.setItem('silapp_token', token);
    localStorage.setItem('silapp_user', JSON.stringify(u));
    setUser(u);
    return u;
  };
  const login = async (email, password) => save((await api.post('/auth/login', { email, password })).data);
  const register = async (data) => save((await api.post('/auth/register', data)).data);
  const logout = () => {
    localStorage.removeItem('silapp_token');
    localStorage.removeItem('silapp_user');
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, login, register, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

/** Halaman awal sesuai role setelah login. */
export const homeOf = (u) => (!u ? '/' : u.role === 'user' ? '/klien' : '/admin');
