/** Kontak umum PSU (WhatsApp & email), diambil sekali dari server lalu disimpan di memori. */
import { useEffect, useState } from 'react';
import api from '../api';

let cache = null;
let pending = null;
const FALLBACK = { phone: '+62 819-0834-4114', email: 'psuindonesia.info@gmail.com' };
const listeners = new Set();

export function useContact() {
  const [c, setC] = useState(cache || FALLBACK);
  useEffect(() => {
    let alive = true;
    listeners.add(setC);
    if (!cache) {
      pending = pending || api.get('/public/contact').then((r) => { cache = r.data; return cache; }).catch(() => FALLBACK);
      pending.then((d) => alive && setC(d));
    }
    return () => { alive = false; listeners.delete(setC); };
  }, []);
  return c;
}

/** Perbarui kontak di semua tampilan (footer, tombol WhatsApp) setelah Super Admin mengubahnya. */
export const setContactCache = (c) => { cache = c; pending = Promise.resolve(c); listeners.forEach((fn) => fn(c)); };

/** Tautan WhatsApp dari nomor apa pun (0812…, +62 812…). */
export const waLink = (phone, text) => `https://wa.me/${String(phone || '').replace(/\D/g, '').replace(/^0/, '62')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
