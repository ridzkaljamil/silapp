import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('silapp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.data?.code === 'MUST_CHANGE_PASSWORD' && !location.pathname.startsWith('/ganti-sandi')) {
      location.href = '/ganti-sandi';
    }
    if (err.response?.status === 401 && localStorage.getItem('silapp_token')) {
      localStorage.removeItem('silapp_token');
      localStorage.removeItem('silapp_user');
      if (!location.pathname.startsWith('/masuk')) location.href = '/masuk';
    }
    return Promise.reject(err);
  },
);

/** Ambil pesan error dari respons API. */
export const errMsg = (e) => e?.response?.data?.message || 'Terjadi kesalahan. Coba lagi.';

/** Unduh file terproteksi token (sertifikat, dokumen). */
export async function download(url, filename) {
  const r = await api.get(url, { responseType: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(r.data);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default api;
