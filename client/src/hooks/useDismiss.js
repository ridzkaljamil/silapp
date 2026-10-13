import { useEffect } from 'react';

/** Tutup menu/dropdown saat klik di luar elemen `ref` atau menekan Esc (selama `open`). */
export function useDismiss(ref, open, close, { esc = true } = {}) {
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    const onKey = (e) => { if (esc && e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [ref, open, close, esc]);
}
