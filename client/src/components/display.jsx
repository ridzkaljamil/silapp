/** Komponen tampilan data: status, progres, riwayat, judul halaman, avatar, angka berjalan. */
import { useEffect, useState } from 'react';
import { fmtDate, fmtDateTime, initials } from '../lib/format';

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
        <b className="brand-font num fs-4" style={{ color: 'var(--navy)' }}>{value}%</b>
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

export function LogList({ logs, onDownloadDoc, limit }) {
  if (!logs?.length) return <p className="text-muted2 mb-0">Belum ada riwayat.</p>;
  const list = limit ? logs.slice(0, limit) : logs;
  return (
    <ul className="log">
      {list.map((l) => (
        <li key={l.id} className={l.pic_label === 'Pelanggan' ? 'from-customer' : ''}>
          <div style={{ minWidth: 0 }}>
            <div><b>{l.note}</b>{!l.customer_visible && <span className="badge-internal">internal</span>}</div>
            {l.files?.map((f) => (
              <button key={f.id} type="button" className="file-chip" onClick={() => onDownloadDoc?.(f)}><i className="bi bi-paperclip" />{f.doc_type}: {f.original_name}</button>
            ))}
            <div className="meta">{l.status_code} · {l.step_name} · {fmtDateTime(l.created_at)} · {l.pic_label}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Label pendek per kode tahap untuk bar progres (nama lengkap tetap di tooltip & "Lihat semua tahap"). */
const SHORT = {
  'ST-01': 'Permohonan', 'ST-02': 'Verifikasi', 'ST-03': 'Kontrak & bayar', 'ST-04': 'Penjadwalan', 'ST-05': 'Audit',
  'ST-06': 'Uji lab', 'ST-07': 'Perbaikan', 'ST-08': 'Review', 'ST-09': 'Keputusan', 'ST-10': 'Sertifikat',
  'LAB-01': 'Permohonan', 'LAB-02': 'Kontrak & bayar', 'LAB-03': 'Registrasi', 'LAB-04': 'Preparasi', 'LAB-05': 'Pengujian',
  'LAB-06': 'Review', 'LAB-07': 'Penerbitan', 'LAB-08': 'LHU terbit',
  'KAL-01': 'Permohonan', 'KAL-02': 'Kontrak & bayar', 'KAL-03': 'Registrasi', 'KAL-04': 'Persiapan', 'KAL-05': 'Kalibrasi',
  'KAL-06': 'Review', 'KAL-07': 'Penerbitan', 'KAL-08': 'Sertifikat', 'KAL-09': 'Pengembalian',
};
export const shortStep = (s) => SHORT[s.code] || s.name;

/** Progres bersegmen: satu segmen per tahap (Opsi A). */
export function SegProgress({ steps, labels = true }) {
  return (
    <div>
      <div className="seg" style={{ '--n': steps.length }} aria-hidden="true">
        {steps.map((s) => <i key={s.order} className={s.state} title={`${s.code} · ${s.name}`} />)}
      </div>
      {labels && (
        <div className="seg-labels" style={{ '--n': steps.length }}>
          {steps.map((s) => <span key={s.order} className={['current', 'action', 'closed'].includes(s.state) ? 'on' : ''} title={`${s.code} · ${s.name}`}>{shortStep(s)}</span>)}
        </div>
      )}
    </div>
  );
}

/** Daftar semua tahap (dipakai di "Lihat semua tahap"). */
export function StepsList({ steps }) {
  return (
    <ol className="steps-list">
      {steps.map((s, i) => (
        <li key={s.order} className={s.state}>
          <span className="dot">{s.state === 'done' ? <i className="bi bi-check-lg" /> : i + 1}</span>
          <span>{s.name}{s.state === 'skipped' ? ' · dilewati' : s.optional && s.state === 'todo' ? ' · jika diperlukan' : ''}{s.started_at && s.state !== 'todo' ? <span className="text-muted2 fw-normal"> · {fmtDate(s.started_at)}</span> : null}</span>
        </li>
      ))}
    </ol>
  );
}

export const PageHead = ({ eyebrow, title, sub, children }) => (
  <div className="page-head">
    <div>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
      {sub && <p className="text-muted2 mb-0">{sub}</p>}
    </div>
    {children && <div className="d-flex flex-wrap gap-2 align-items-center">{children}</div>}
  </div>
);

/** Foto profil atau inisial. */
export function Avatar({ user, size = 34 }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [user?.avatar_url]);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  if (user?.avatar_url && !broken) return <img className="avatar avatar-img" style={style} src={user.avatar_url} alt="" onError={() => setBroken(true)} />;
  return <span className="avatar" style={style} aria-hidden="true">{initials(user?.name)}</span>;
}

/** Angka yang menghitung naik saat pertama tampil. */
export function CountUp({ value, duration = 700 }) {
  const n = Number(value);
  const [v, setV] = useState(Number.isFinite(n) ? 0 : value);
  useEffect(() => {
    if (!Number.isFinite(n)) { setV(value); return undefined; }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(n); return undefined; }
    let raf; const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / duration); setV(Math.round(n * (1 - (1 - k) ** 3))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n, value, duration]);
  return <>{v}</>;
}
