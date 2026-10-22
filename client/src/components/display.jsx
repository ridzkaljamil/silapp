/** Komponen tampilan data: status, progres, riwayat, judul halaman, avatar, angka berjalan. */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { fmtDate, fmtDateTime, initials } from '../lib/format';

const PILL = {
  'On Progress': 'pill-progress', Scheduling: 'pill-progress', 'Waiting for Sample': 'pill-action',
  'Action Required': 'pill-action', 'Waiting for Payment': 'pill-action', Closed: 'pill-closed',
  Completed: 'pill-done', Certified: 'pill-cert', Cancelled: 'pill-neutral', 'Ready for Collection': 'pill-done', 'On-Site Calibration': 'pill-purple',
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

/** Label pendek per kode tahap untuk bar progres (nama lengkap tetap di tooltip & "Lihat Semua Tahap"). */
const SHORT = {
  'ST-01': 'Permohonan', 'ST-02': 'Verifikasi', 'ST-03': 'Penawaran & Kontrak', 'ST-04': 'Penjadwalan', 'ST-05': 'Audit',
  'ST-06': 'Uji Lab', 'ST-07': 'Perbaikan', 'ST-08': 'Review', 'ST-09': 'Keputusan', 'ST-10': 'Sertifikat',
  'LAB-01': 'Permohonan', 'LAB-02': 'Registrasi Sampel', 'LAB-03': 'Penawaran & Kontrak', 'LAB-04': 'Pengujian',
  'LAB-05': 'Review', 'LAB-06': 'Penyusunan LHU', 'LAB-07': 'LHU Terbit',
  'LSM-01': 'Permohonan', 'LSM-02': 'Verifikasi', 'LSM-03': 'Penawaran & Kontrak', 'LSM-04': 'Penjadwalan', 'LSM-05': 'Audit',
  'LSM-06': 'Perbaikan', 'LSM-07': 'Review', 'LSM-08': 'Keputusan', 'LSM-09': 'Sertifikat',
  'KAL-01': 'Permohonan', 'KAL-02': 'Penawaran & Kontrak', 'KAL-03': 'Registrasi', 'KAL-04': 'Persiapan', 'KAL-05': 'Kalibrasi',
  'KAL-06': 'Review', 'KAL-07': 'Penerbitan', 'KAL-08': 'Sertifikat', 'KAL-09': 'Pengembalian',
};
/** Alur Tipe 1b memakai kode ST-xx dengan nama tahap berbeda, jadi beberapa label pendek dicocokkan lewat nama. */
const SHORT_NAME = { 'Invoice & Faktur': 'Invoice & Faktur', 'Penawaran & Kontrak': 'Penawaran & Kontrak', Sampling: 'Sampling', 'Review & Keputusan': 'Review & Keputusan', 'Sertifikat Terbit': 'Sertifikat', 'Pengujian Laboratorium': 'Uji Lab' };
const shortStep = (s) => SHORT_NAME[s.name] || SHORT[s.code] || s.name;

const NOW = ['current', 'action', 'closed'];
const passed = (s) => !!s && ['done', 'skipped'].includes(s.state);

/** Bar tahapan bernomor: lingkaran per tahap (selesai = centang navy, berjalan = hijau). Di layar sempit bisa digeser. */
export function StepTrack({ steps, onSelect }) {
  const ref = useRef(null);
  // geser agar tahap saat ini terlihat di tengah
  useEffect(() => {
    const box = ref.current; const on = box?.querySelector('[aria-current="step"]');
    if (box && on && box.scrollWidth > box.clientWidth) box.scrollLeft = on.offsetLeft - box.clientWidth / 2 + on.clientWidth / 2;
  }, [steps]);
  return (
    <div className="tr-steps-wrap" ref={ref}>
      <ol className="tr-steps" style={{ minWidth: steps.length * 84 }}>
        {steps.map((st, i) => {
          const now = NOW.includes(st.state);
          const optTodo = st.optional && st.state === 'todo';
          // tahap yang sudah/sedang berjalan bisa diklik untuk melihat riwayatnya
          const can = onSelect && st.state !== 'todo';
          return (
            <li key={st.order} className={`tr-step ${st.state} ${optTodo ? 'opt' : ''} ${can ? 'clickable' : ''}`} aria-current={now ? 'step' : undefined}
              title={can ? `${st.code} · ${st.name} — klik untuk melihat riwayat tahap` : `${st.code} · ${st.name}`}
              {...(can ? { role: 'button', tabIndex: 0, onClick: () => onSelect(st), onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(st)) } : {})}>
              {i > 0 && <span className={`ln l ${passed(steps[i - 1]) && st.state !== 'todo' ? 'on' : ''}`} aria-hidden="true" />}
              {i < steps.length - 1 && <span className={`ln r ${passed(st) && steps[i + 1].state !== 'todo' ? 'on' : ''}`} aria-hidden="true" />}
              <span className="tr-num">{st.state === 'done' ? <i className="bi bi-check-lg" aria-label="selesai" /> : st.state === 'skipped' ? '–' : i + 1}</span>
              <span className="tr-lbl">{shortStep(st)}{st.state === 'skipped' && <span className="d-block small">(dilewati)</span>}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Keterangan warna bar tahapan. */
export const StepLegend = () => (
  <span className="tr-legend">
    <span><i className="lg-done" />Selesai</span><span><i className="lg-now" />Berjalan</span>
    <span><i className="lg-act" />Menunggu Pemohon</span><span><i className="lg-opt" />Kondisional</span>
  </span>
);

/** Daftar semua tahap (dipakai di "Lihat Semua Tahap"): garis waktu vertikal. */
export function StepsList({ steps }) {
  return (
    <ol className="steps-v">
      {steps.map((s, i) => {
        const now = NOW.includes(s.state);
        const sub = [s.code, s.started_at && s.state !== 'todo' ? fmtDate(s.started_at) : null, s.state === 'skipped' ? 'dilewati' : s.optional && s.state === 'todo' ? 'jika diperlukan' : null, s.state === 'action' ? 'menunggu pemohon' : null].filter(Boolean).join(' · ');
        return (
          <li key={s.order} className={`tr-step ${s.state} ${s.optional && s.state === 'todo' ? 'opt' : ''}`} aria-current={now ? 'step' : undefined}>
            {i < steps.length - 1 && <span className={`vl ${passed(s) && steps[i + 1].state !== 'todo' ? 'on' : ''}`} aria-hidden="true" />}
            <span className="tr-num">{s.state === 'done' ? <i className="bi bi-check-lg" aria-label="selesai" /> : s.state === 'skipped' ? '–' : i + 1}</span>
            <span className="sv-tx"><b>{s.name}</b><span>{sub}</span></span>
          </li>
        );
      })}
    </ol>
  );
}

/** Halaman gabungan (mis. Kelola Layanan) mengisi konteks ini: judul & tab tampil seragam di semua tab. */
export const PageTabsContext = createContext(null);

export function PageHead({ eyebrow, title, sub, children }) {
  const tabs = useContext(PageTabsContext);
  const head = (
    <div>
      {(tabs?.eyebrow || eyebrow) && <div className="eyebrow">{tabs?.eyebrow || eyebrow}</div>}
      <h1>{tabs?.title || title}</h1>
      {sub && <p className="text-muted2 mb-0">{sub}</p>}
    </div>
  );
  const actions = children && <div className="ph-actions d-flex flex-wrap gap-2 align-items-center">{children}</div>;
  if (!tabs) return <div className="page-head">{head}{actions}</div>;
  // halaman bertab: di HP tombol/aksi pindah ke bawah tab agar susunannya konsisten
  return (
    <div className="ph-tabbed">
      <div className="page-head">{head}</div>
      {actions}
      <div className="tabs page-tabs" role="tablist" aria-label={tabs.title}>
        {tabs.items.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tabs.value === k} onClick={() => tabs.onChange(k)}>{l}</button>)}
      </div>
    </div>
  );
}

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
