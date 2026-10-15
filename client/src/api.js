import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

/**
 * Indikator "Sedang memproses…" global. Setiap permintaan yang mengirim data (POST/PUT/PATCH/DELETE) dan unduhan file
 * dicatat di sini; komponen BusyOverlay menampilkan lapisan pemrosesan bila prosesnya lebih dari sesaat.
 * Permintaan latar (simpan draft otomatis, tandai notifikasi dibaca) memakai opsi { silent: true }.
 */
const busy = { jobs: new Map(), subs: new Set(), seq: 0 };
const emitBusy = () => { const list = [...busy.jobs.values()]; busy.subs.forEach((f) => f(list)); };
export const subscribeBusy = (f) => { busy.subs.add(f); return () => busy.subs.delete(f); };
const startJob = (config) => {
  const id = ++busy.seq;
  const upload = typeof FormData !== 'undefined' && config.data instanceof FormData;
  busy.jobs.set(id, { text: config.busyText || (config.responseType === 'blob' ? 'Menyiapkan file…' : upload ? 'Mengunggah file…' : 'Sedang memproses…'), progress: null, upload });
  if (upload) {
    config.onUploadProgress = (e) => {
      const j = busy.jobs.get(id);
      if (j && e.total) { j.progress = Math.min(100, Math.round((e.loaded / e.total) * 100)); emitBusy(); }
    };
  }
  config.__job = id;
  emitBusy();
};
const endJob = (config) => { if (config?.__job && busy.jobs.delete(config.__job)) emitBusy(); };

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('silapp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const writes = config.method && config.method !== 'get';
  if (!config.silent && !config.__job && (writes || config.responseType === 'blob')) startJob(config);
  return config;
});

const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const RETRY = [502, 503, 504];

api.interceptors.response.use(
  (r) => { endJob(r.config); return r; },
  async (err) => {
    endJob(err.config);
    // unduhan (responseType blob) yang ditolak server: ubah isi JSON-nya agar pesan error bisa ditampilkan
    const d = err.response?.data;
    if (typeof Blob !== 'undefined' && d instanceof Blob && /json/.test(d.type)) {
      try { err.response.data = JSON.parse(await d.text()); } catch { /* biarkan apa adanya */ }
    }
    // GET yang gagal karena server sedang restart / jaringan putus sesaat diulang otomatis (maks. 2 kali)
    const cfg = err.config;
    const transient = !err.response ? err.code !== 'ERR_CANCELED' : RETRY.includes(err.response.status);
    if (cfg && cfg.method === 'get' && transient && (cfg.__retry || 0) < 2) {
      cfg.__retry = (cfg.__retry || 0) + 1;
      await wait(700 * cfg.__retry);
      return api(cfg);
    }
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

/** Nama file dari header Content-Disposition (sudah berekstensi & aman), mis. filename*=UTF-8''LHU-PSU-2026.pdf */
function headerName(h) {
  const v = String(h || '');
  const star = /filename\*=UTF-8''([^;]+)/i.exec(v);
  if (star) { try { return decodeURIComponent(star[1]); } catch { /* pakai nama biasa */ } }
  return /filename="?([^";]+)"?/i.exec(v)?.[1] || '';
}

/**
 * Unduh file dari API (dengan token). Nama file mengikuti server bila ada (lengkap dengan ekstensi);
 * nama cadangan dibersihkan dari karakter yang tidak boleh ada di nama file.
 */
export async function download(url, filename) {
  const r = await api.get(url, { responseType: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(r.data);
  a.download = headerName(r.headers['content-disposition']) || String(filename || 'unduhan').replace(/[\\/:*?"<>|]/g, '-');
  document.body.appendChild(a);
  a.click();
  a.remove();
  // beri waktu browser memulai unduhan sebelum URL sementara dilepas (Firefox membatalkan bila langsung dilepas)
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export default api;
