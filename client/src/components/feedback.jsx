/** Umpan balik: dialog konfirmasi, toast, indikator memuat. */
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { subscribeBusy } from '../api';

/* dialog konfirmasi (dipakai sebelum Setujui, hapus, keluar, dll.) — dengan animasi masuk/keluar */
const ConfirmCtx = createContext(async () => true);
export function ConfirmProvider({ children }) {
  const [st, setSt] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const ask = useCallback((opts) => new Promise((resolve) => { setLeaving(false); setSt({ ...opts, resolve }); }), []);
  const close = (v) => {
    if (!st || leaving) return;
    st.resolve(v);
    setLeaving(true);
    setTimeout(() => { setSt(null); setLeaving(false); }, 180);
  };
  useEffect(() => {
    if (!st) return undefined;
    const onKey = (e) => e.key === 'Escape' && close(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {st && (
        <div className={`ui-modal ui-confirm ${leaving ? 'leaving' : ''}`} role="dialog" aria-modal="true" aria-labelledby="cf-title" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
          <div className="ui-modal-card">
            {st.icon && <span className={`ui-modal-ic ${st.danger ? 'danger' : ''}`}><i className={`bi bi-${st.icon}`} /></span>}
            <h2 className="h5 mb-1" id="cf-title">{st.title || 'Konfirmasi'}</h2>
            <div className="text-muted2">{st.body}</div>
            <div className="ui-modal-actions">
              <button className="btn btn-outline-secondary" onClick={() => close(false)}>{st.cancel || 'Batal'}</button>
              <button className={`btn ${st.danger ? 'btn-danger' : 'btn-primary'}`} autoFocus onClick={() => close(true)}>{st.ok || 'Ya, Lanjutkan'}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);

/**
 * Lapisan "Sedang memproses…" saat data dikirim ke server. Muncul bila proses lebih dari ±0,35 detik (aksi cepat
 * tidak berkedip), menampilkan persentase saat mengunggah file, dan mencegah klik ganda selama proses berjalan.
 */
export function BusyOverlay() {
  const [jobs, setJobs] = useState([]);
  const [show, setShow] = useState(false);
  const since = useRef(0);
  useEffect(() => subscribeBusy(setJobs), []);
  const active = jobs.length > 0;
  useEffect(() => {
    if (active) {
      const t = setTimeout(() => { since.current = Date.now(); setShow(true); }, 350);
      return () => clearTimeout(t);
    }
    // tetap tampil minimal 0,4 detik agar tidak sekadar berkedip
    const t = setTimeout(() => setShow(false), Math.max(0, 400 - (Date.now() - since.current)));
    return () => clearTimeout(t);
  }, [active]);
  useEffect(() => {
    if (!active) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
  const last = useRef(null);
  if (jobs.length) last.current = jobs[jobs.length - 1];
  const j = last.current;
  if (!show || !j) return null;
  const pct = j.upload && j.progress != null ? j.progress : null;
  const text = pct === 100 ? 'Menyimpan data…' : j.text;
  return (
    <div className={`busy-overlay ${active ? '' : 'leaving'}`} role="alertdialog" aria-busy="true" aria-live="polite" aria-label={text}>
      <div className="busy-card">
        <span className="busy-spin" aria-hidden="true" />
        <div className="fw-semibold">{text}</div>
        {pct != null && pct < 100 && (
          <div className="busy-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
        )}
        <div className="small text-muted2">{pct != null && pct < 100 ? `${pct}% · ` : ''}Mohon tunggu, jangan tutup halaman ini.</div>
      </div>
    </div>
  );
}

export const Loading = () => <div className="text-center text-muted2 py-5 loading-fade"><div className="spinner-border spinner-border-sm me-2" />Memuat…</div>;

/* toast sederhana dengan animasi naik/turun */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const [out, setOut] = useState(false);
  const timers = useRef([]);
  const show = useCallback((m, variant = 'dark') => {
    if (!m) return;
    timers.current.forEach(clearTimeout);
    setOut(false);
    setMsg({ m, variant, k: Date.now() });
    timers.current = [setTimeout(() => setOut(true), 3700), setTimeout(() => setMsg(null), 4000)];
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div key={msg.k} className={`toast-fixed ${msg.variant === 'danger' ? 'danger' : ''} ${out ? 'out' : ''}`} role="status">
          <i className={`bi bi-${msg.variant === 'danger' ? 'exclamation-circle' : 'check-circle'}`} />{msg.m}
        </div>
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
