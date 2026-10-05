/** Komponen UI kecil yang dipakai di banyak halaman. */
import { createContext, useContext, useState, useCallback } from 'react';

export const fmtDate = (s) => (s ? new Date(String(s).replace(' ', 'T')).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (s) => (s ? new Date(String(s).replace(' ', 'T')).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

const PILL = {
  'On Progress': 'pill-progress', Scheduling: 'pill-progress', 'Waiting for Sample': 'pill-action',
  'Action Required': 'pill-action', 'Waiting for Payment': 'pill-action', Closed: 'pill-closed',
  Completed: 'pill-done', Certified: 'pill-cert', 'Ready for Collection': 'pill-done', 'On-Site Calibration': 'pill-purple',
};
export const StatusPill = ({ value }) => <span className={`pill ${PILL[value] || 'pill-progress'}`}>{value}</span>;

export function Progress({ value, big }) {
  if (big) {
    return (
      <div className="d-flex align-items-center gap-3">
        <b className="brand-font num fs-4" style={{ color: 'var(--psu-navy)' }}>{value}%</b>
        <div className={`pbar flex-grow-1 ${value === 100 ? 'ok' : ''}`}><i style={{ width: `${value}%` }} /></div>
      </div>
    );
  }
  return (
    <span className="d-inline-flex align-items-center gap-2">
      <span className={`pbar ${value === 100 ? 'ok' : ''}`} style={{ width: 80 }}><i style={{ width: `${value}%` }} /></span>
      <span className="num small">{value}%</span>
    </span>
  );
}

export function Stepper({ steps }) {
  return (
    <div className="overflow-auto">
      <ol className="stepper" style={{ '--n': steps.length }}>
        {steps.map((s, i) => (
          <li key={s.order} data-i={i + 1} className={s.state}>
            <span className="code">{s.code} · {s.pct}%</span>
            {s.name}
            <span className="d">{s.state === 'skipped' ? 'dilewati' : s.started_at ? fmtDate(s.started_at) : s.optional ? 'jika diperlukan' : ''}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function LogList({ logs }) {
  if (!logs?.length) return <p className="text-muted2 mb-0">Belum ada riwayat.</p>;
  return (
    <ul className="log">
      {logs.map((l) => (
        <li key={l.id}>
          <time className="num">{fmtDateTime(l.created_at)}</time>
          <div>
            <b>{l.status_code} · {l.step_name}</b>
            {!l.customer_visible && <span className="badge-internal">internal</span>}
            <div>{l.note}</div>
            <span className="by">PIC: {l.pic_label}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export const PageHead = ({ eyebrow, title, sub, children }) => (
  <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
    <div>
      {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
      <h1 className="mb-1">{title}</h1>
      {sub && <p className="text-muted2 mb-0" style={{ maxWidth: '68ch' }}>{sub}</p>}
    </div>
    {children}
  </div>
);

export const Loading = () => <div className="text-center text-muted2 py-5"><div className="spinner-border spinner-border-sm me-2" />Memuat…</div>;

/* toast sederhana */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const show = useCallback((m, variant = 'dark') => {
    setMsg({ m, variant });
    clearTimeout(window.__silappToast);
    window.__silappToast = setTimeout(() => setMsg(null), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className={`toast-fixed alert alert-${msg.variant === 'danger' ? 'danger' : 'dark'} shadow`} role="status">{msg.m}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
