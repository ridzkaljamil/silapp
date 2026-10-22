import axios from 'axios';
import { UPLOAD_MODE, MAX_FILE_MB } from './lib/format';

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

/** Nama file aman untuk penyimpanan (huruf, angka, titik, strip). */
const safeName = (n) => (String(n || 'file').normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-80) || 'file');

/**
 * Hosting Vercel: file di FormData diunggah langsung ke Vercel Blob lebih dulu (tidak lewat fungsi Vercel yang dibatasi
 * ±4,5 MB per request), lalu diganti penanda "blob:{...}" di field yang sama. Server membaca penanda itu sebagai file biasa.
 */
async function moveFilesToBlob(fd, token) {
  const { upload } = await import('@vercel/blob/client');
  const out = new FormData();
  for (const [key, value] of fd.entries()) {
    if (value instanceof Blob) {
      const name = value.name || 'file';
      const b = await upload(`silapp/${safeName(name)}`, value, {
        access: 'private', handleUploadUrl: '/api/uploads/blob', headers: { Authorization: `Bearer ${token}` },
      });
      out.append(key, `blob:${JSON.stringify({ pathname: b.pathname, name, size: value.size })}`);
    } else out.append(key, value);
  }
  return out;
}

api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('silapp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const writes = config.method && config.method !== 'get';
  if (!config.silent && !config.__job && (writes || config.responseType === 'blob')) startJob(config);
  if (UPLOAD_MODE === 'blob' && config.data instanceof FormData) {
    try { config.data = await moveFilesToBlob(config.data, token); } catch (e) {
      endJob(config);
      throw Object.assign(new Error('upload'), { response: { data: { message: e?.message?.includes('size') ? 'File terlalu besar.' : 'Gagal mengunggah file. Periksa koneksi lalu coba lagi.' } } });
    }
  }
  return config;
});

const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const RETRY = [502, 503, 504];

api.interceptors.response.use(
  (r) => {
    endJob(r.config);
    // sesi diperpanjang otomatis selama aktif: server mengirim token baru lewat header
    const fresh = r.headers?.['x-new-token'];
    if (fresh && localStorage.getItem('silapp_token')) localStorage.setItem('silapp_token', fresh);
    return r;
  },
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
    // 413 dari server/hosting (Nginx, LiteSpeed, Vercel) biasanya berupa halaman HTML: ganti dengan pesan yang jelas
    if (err.response?.status === 413) {
      err.response.data = { message: `File terlalu besar untuk diterima server. Pastikan setiap file maks. ${MAX_FILE_MB} MB, atau unggah sebagian file lebih dulu.` };
    }
    if (err.response?.data?.code === 'MUST_CHANGE_PASSWORD' && !location.pathname.startsWith('/ganti-sandi')) {
      location.href = '/ganti-sandi';
    }
    if (err.response?.status === 401 && localStorage.getItem('silapp_token')) {
      try { sessionStorage.setItem('silapp_notice', err.response.data?.message || 'Sesi berakhir, silakan masuk kembali.'); } catch { /* abaikan */ }
      localStorage.removeItem('silapp_token');
      localStorage.removeItem('silapp_user');
      if (!location.pathname.startsWith('/masuk')) {
        location.href = '/masuk';
        // halaman sedang pindah ke Masuk: biarkan permintaan ini menggantung agar tidak muncul pesan error sesaat
        return new Promise(() => {});
      }
    }
    return Promise.reject(err);
  },
);

/** Ambil pesan error dari respons API. */
export const errMsg = (e) => {
  const m = e?.response?.data?.message;
  if (m) return m;
  if (!e?.response && e?.code !== 'ERR_CANCELED') return 'Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.';
  return 'Terjadi kesalahan. Coba lagi.';
};

/** Simpan token baru (mis. setelah ganti kata sandi, sesi lama di perangkat lain otomatis keluar). */
export const setToken = (token) => { if (token) localStorage.setItem('silapp_token', token); };

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
  if (r.data.type === 'application/json') {
    // file besar di hosting Vercel (mis. ZIP semua berkas): server membalas tautan unduh sementara
    const j = JSON.parse(await r.data.text());
    if (j.download_url) { location.href = j.download_url; return; }
  }
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
