/**
 * Perbarui data halaman tanpa refresh manual:
 * - saat notifikasi baru masuk (atau notifikasi diklik) untuk halaman ini,
 * - saat tab browser kembali dibuka,
 * - berkala tiap 20 detik selama tab terbuka.
 * path: tautan halaman ini (mis. /admin/pengajuan/12); null = perbarui untuk notifikasi apa pun.
 * enabled: false selama pengguna sedang mengisi pop-up, agar isian tidak tertimpa.
 */
import { useEffect, useRef } from 'react';

const NOTIF_EVENT = 'silapp:notif';
/** Dipanggil lonceng notifikasi: beri tahu halaman yang terbuka bahwa ada pembaruan. */
export const announce = (links) => window.dispatchEvent(new CustomEvent(NOTIF_EVENT, { detail: { links } }));

export function useLiveRefresh(load, path = null, enabled = true, every = 20000) {
  const fn = useRef(load);
  fn.current = load;
  const on = useRef(enabled);
  on.current = enabled;
  useEffect(() => {
    const run = () => { if (on.current && !document.hidden) Promise.resolve(fn.current()).catch(() => {}); };
    const onNotif = (e) => { const links = e.detail?.links || []; if (!path || links.some((l) => l && (l === path || l.startsWith(`${path}?`)))) run(); };
    const onVis = () => { if (!document.hidden) run(); };
    window.addEventListener(NOTIF_EVENT, onNotif);
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(run, every);
    return () => { window.removeEventListener(NOTIF_EVENT, onNotif); document.removeEventListener('visibilitychange', onVis); clearInterval(t); };
  }, [path, every]);
}
