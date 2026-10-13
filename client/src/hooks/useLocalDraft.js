import { useEffect, useState } from 'react';

/**
 * Simpan isian form otomatis di browser (localStorage) agar tidak hilang saat halaman tertutup.
 * Mengembalikan [nilai, setNilai, hapus]. Jika penyimpanan browser tidak tersedia, form tetap berjalan normal.
 */
const read = (key, init) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : init; } catch { return init; }
};

export function useLocalDraft(key, init) {
  const [v, setV] = useState(() => read(key, init));
  useEffect(() => { setV(read(key, init)); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* penyimpanan browser tidak tersedia */ }
    }, 400);
    return () => clearTimeout(t);
  }, [key, v]);
  const clear = () => { try { localStorage.removeItem(key); } catch { /* abaikan */ } };
  return [v, setV, clear];
}

export const peekLocalDraft = read;
export const dropLocalDraft = (key) => { try { localStorage.removeItem(key); } catch { /* abaikan */ } };
