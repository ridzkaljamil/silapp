/** Komponen UI kecil yang dipakai di banyak halaman. */
import { createContext, useContext, useState, useCallback, useRef, useEffect, Fragment } from 'react';
import { createPortal } from 'react-dom';

export const fmtDate = (s) => (s ? new Date(String(s).replace(' ', 'T')).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const rupiah = (n) => (n === null || n === undefined || n === '' ? '—' : `Rp${Number(n).toLocaleString('id-ID')}`);
export const fmtDateTime = (s) => (s ? new Date(String(s).replace(' ', 'T')).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export const FILE_ACCEPT = '.pdf,.zip,.jpg,.jpeg,.png';
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
        <div className={`ui-modal ${leaving ? 'leaving' : ''}`} role="dialog" aria-modal="true" aria-labelledby="cf-title" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
          <div className="ui-modal-card">
            {st.icon && <span className={`ui-modal-ic ${st.danger ? 'danger' : ''}`}><i className={`bi bi-${st.icon}`} /></span>}
            <h2 className="h5 mb-1" id="cf-title">{st.title || 'Konfirmasi'}</h2>
            <div className="text-muted2">{st.body}</div>
            <div className="ui-modal-actions">
              <button className="btn btn-outline-secondary" onClick={() => close(false)}>{st.cancel || 'Batal'}</button>
              <button className={`btn ${st.danger ? 'btn-danger' : 'btn-primary'}`} autoFocus onClick={() => close(true)}>{st.ok || 'Ya, lanjutkan'}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);

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

export const Loading = () => <div className="text-center text-muted2 py-5 loading-fade"><div className="spinner-border spinner-border-sm me-2" />Memuat…</div>;

/* toast sederhana dengan animasi naik/turun */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const [out, setOut] = useState(false);
  const timers = useRef([]);
  const show = useCallback((m, variant = 'dark') => {
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

/** Foto profil atau inisial. */
export const initials = (n = '') => n.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export function Avatar({ user, size = 34 }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [user?.avatar_url]);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  if (user?.avatar_url && !broken) return <img className="avatar avatar-img" style={style} src={user.avatar_url} alt="" onError={() => setBroken(true)} />;
  return <span className="avatar" style={style} aria-hidden="true">{initials(user?.name)}</span>;
}

/**
 * Pop-up form: modal di desktop, lembar dari bawah (bottom sheet) di HP. Animasi masuk & keluar.
 * footer: tombol aksi. Tutup dengan Esc, klik latar, atau tombol ×.
 */
export function Sheet({ open, onClose, title, sub, icon, danger, children, footer, wide }) {
  const [render, setRender] = useState(open);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (open) { setRender(true); setLeaving(false); return undefined; }
    if (!render) return undefined;
    setLeaving(true);
    const t = setTimeout(() => { setRender(false); setLeaving(false); }, 180);
    return () => clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('sheet-open');
    return () => { window.removeEventListener('keydown', onKey); document.body.classList.remove('sheet-open'); };
  }, [open, onClose]);
  if (!render) return null;
  return createPortal(
    <div className={`ui-modal ${leaving ? 'leaving' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`ui-modal-card sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="sheet-h">
          {icon && <span className={`ui-modal-ic ${danger ? 'danger' : ''}`}><i className={`bi bi-${icon}`} /></span>}
          <div className="min-w-0 flex-grow-1"><h2 className="h5 mb-1">{title}</h2>{sub && <div className="text-muted2 small">{sub}</div>}</div>
          <button type="button" className="sheet-x" onClick={onClose} aria-label="Tutup"><i className="bi bi-x-lg" /></button>
        </div>
        <div className="sheet-b">{children}</div>
        {footer && <div className="ui-modal-actions">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Menu titik tiga / tombol "Lainnya". items: [{ label, icon, onClick, danger, disabled, hidden }] */
export function Menu({ items, label = 'Lainnya', icon = 'three-dots', className = 'btn btn-outline-secondary', align = 'end' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const list = items.filter((i) => !i.hidden);
  if (!list.length) return null;
  return (
    <div className="pm" ref={ref}>
      <button type="button" className={className} onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label}><i className={`bi bi-${icon}`} /></button>
      <div className={`pm-menu menu-sm ${align === 'start' ? 'start' : ''} ${open ? 'open' : ''}`} role="menu">
        {list.map((i) => (
          <button key={i.label} type="button" role="menuitem" tabIndex={open ? 0 : -1} className={`pm-item ${i.danger ? 'danger' : ''}`} disabled={i.disabled} onClick={() => { setOpen(false); i.onClick(); }}>
            {i.icon && <i className={`bi bi-${i.icon}`} />}{i.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Area unggah file bergaya dropzone (tetap memakai input file biasa). */
export function FileDrop({ id, multiple, accept = FILE_ACCEPT, files, onChange, label = 'Pilih file', hint = 'PDF, ZIP, JPG atau PNG · maks. 10 MB' }) {
  const n = files?.length || 0;
  return (
    <label className={`file-drop ${n ? 'has' : ''}`} htmlFor={id}>
      <i className={`bi bi-${n ? 'check2-circle' : 'cloud-arrow-up'}`} aria-hidden="true" />
      <span className="min-w-0">
        <b>{n ? (n === 1 ? files[0].name : `${n} file dipilih`) : label}</b>
        <small>{n ? 'Klik untuk mengganti' : hint}</small>
      </span>
      <input id={id} type="file" multiple={multiple} accept={accept} className="visually-hidden" onChange={(e) => onChange(e.target.files)} />
    </label>
  );
}

/* ---------- animasi muncul saat terlihat (scroll reveal) ---------- */
const REVEAL_SEL = [
  '.page-head', '.hero > *', '.track-form', '.pub-intro', '.panel', '.stat', '.todo-card', '.help-card', '.todo-item',
  '.app-card', '.app-table tbody tr', '.pick-card', '.svc-card', '.cta-navy', '.steps-list li', '.f-row', '.decision-item', '.task-box', '.home-head',
].join(',');

/**
 * Memberi animasi muncul (fade + naik) pada kartu, baris tabel, dll. di dalam ref saat masuk layar.
 * Aman untuk React StrictMode (efek dijalankan 2x saat dev): elemen yang belum sempat tampil dipulihkan saat cleanup.
 */
export function useReveal(ref) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !('IntersectionObserver' in window)) return undefined;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const pending = new Set();
    const timers = [];
    let batch = 0; let reset;
    const finish = (el) => { el.classList.remove('rv', 'in'); el.style.transitionDelay = ''; pending.delete(el); };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        io.unobserve(el);
        el.style.transitionDelay = `${Math.min(batch, 8) * 45}ms`;
        batch += 1;
        clearTimeout(reset); reset = setTimeout(() => { batch = 0; }, 150);
        requestAnimationFrame(() => el.classList.add('in'));
        timers.push(setTimeout(() => finish(el), 950));
      });
    }, { rootMargin: '0px 0px -4% 0px', threshold: 0.01 });
    const scan = () => root.querySelectorAll(REVEAL_SEL).forEach((el) => {
      if (el.dataset.rv) return;
      el.dataset.rv = '1';
      if (el.closest('.ui-modal') || !el.getClientRects().length) return; // tersembunyi (mis. tabel di HP): tanpa animasi
      el.classList.add('rv');
      pending.add(el);
      io.observe(el);
    });
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(root, { childList: true, subtree: true });
    // pengaman: apa pun yang belum tampil setelah 2,5 detik langsung ditampilkan
    const failsafe = setInterval(() => pending.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0 && !el.classList.contains('in')) { el.classList.add('in'); timers.push(setTimeout(() => finish(el), 700)); }
    }), 2500);
    return () => {
      io.disconnect(); mo.disconnect(); clearTimeout(reset); clearInterval(failsafe); timers.forEach(clearTimeout);
      pending.forEach((el) => { el.classList.remove('rv', 'in'); el.style.transitionDelay = ''; delete el.dataset.rv; });
      pending.clear();
    };
  }, [ref]);
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

/**
 * Daftar ringkas untuk HP (Opsi B): baris berisi judul, sub, label; ketuk baris → lembar detail dari bawah.
 * row(x) → { key, avatar, title, sub, pills: [[kelas, teks]], right, muted,
 *            detail: { rows: [[label, nilai]], actions: [{ label, icon, onClick, danger, primary, hidden, scrollTo }] } }
 * Di desktop komponen ini tersembunyi; tabel biasa tetap dipakai.
 */
export function MobileList({ items, row, empty = 'Belum ada data.' }) {
  const [open, setOpen] = useState(null);
  const cur = open ? items.map(row).find((r) => r.key === open) : null;
  const run = (a) => {
    setOpen(null);
    setTimeout(() => {
      a.onClick();
      if (a.scrollTo) setTimeout(() => document.getElementById(a.scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    }, 190);
  };
  const Pills = ({ list }) => (list?.length ? <span className="m-pills">{list.map(([c, t]) => <span key={t} className={`pill ${c}`}>{t}</span>)}</span> : null);
  return (
    <div className="m-list">
      {items.map(row).map((r) => (
        <button key={r.key} type="button" className={`m-row ${r.muted ? 'muted' : ''}`} onClick={() => setOpen(r.key)}>
          {r.avatar && <span className="avatar m-av">{r.avatar}</span>}
          <span className="m-main">
            <b>{r.title}</b>
            {r.sub && <span className="m-sub">{r.sub}</span>}
            <Pills list={r.pills} />
          </span>
          {r.right && <span className="m-right">{r.right}</span>}
          <i className="bi bi-chevron-right m-chev" aria-hidden="true" />
        </button>
      ))}
      {!items.length && <p className="text-center text-muted2 py-4 mb-0">{empty}</p>}
      <Sheet open={!!cur} onClose={() => setOpen(null)}
        title={cur && <span className="d-flex align-items-center gap-2">{cur.avatar && <span className="avatar" style={{ width: 42, height: 42 }}>{cur.avatar}</span>}<span className="min-w-0"><span className="d-block">{cur.title}</span><Pills list={cur.pills} /></span></span>}
        footer={cur?.detail?.actions?.filter((a) => !a.hidden).length ? (
          <div className="m-actions">
            {cur.detail.actions.filter((a) => !a.hidden).map((a) => (
              <button key={a.label} type="button" className={`btn ${a.danger ? 'btn-outline-danger' : a.primary ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => run(a)}>{a.icon && <i className={`bi bi-${a.icon}`} />}{a.label}</button>
            ))}
          </div>
        ) : null}>
        {cur && (
          <dl className="dl-grid m-dl">
            {cur.detail.rows.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
          </dl>
        )}
      </Sheet>
    </div>
  );
}

/* ---------- Dropdown kustom (menggantikan <select> bawaan browser) ---------- */
const optList = (children, out = []) => {
  [].concat(children).flat(Infinity).forEach((c) => {
    if (!c || typeof c !== 'object') return;
    if (c.type === 'option') {
      const label = [].concat(c.props.children).flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false).join('');
      out.push({ value: c.props.value !== undefined ? String(c.props.value) : label, label, disabled: !!c.props.disabled });
    } else if (c.props?.children) optList(c.props.children, out);
  });
  return out;
};

/**
 * Pengganti <select>: API sama (value, onChange(e) dengan e.target.value, <option> sebagai children),
 * tampilan dan animasi mengikuti Opsi A. Mendukung keyboard (↑ ↓ Enter Esc, ketik huruf awal) dan required.
 */
export function Select({ value, onChange, children, className = '', style, id, required, disabled, name, ...rest }) {
  const opts = optList(children);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const [up, setUp] = useState(false);
  const [alignR, setAlignR] = useState(false);
  const ref = useRef(null);
  const listRef = useRef(null);
  const val = value === undefined || value === null ? '' : String(value);
  const cur = opts.find((o) => o.value === val) || null;
  const sm = className.includes('form-select-sm');
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  useEffect(() => { if (open && listRef.current && hi >= 0) listRef.current.children[hi]?.scrollIntoView({ block: 'nearest' }); }, [open, hi]);
  const pick = (o) => {
    if (!o || o.disabled) return;
    setOpen(false);
    if (o.value !== val) onChange?.({ target: { value: o.value, name, id, type: 'select-one' }, currentTarget: { value: o.value } });
  };
  const toggle = () => {
    if (disabled) return;
    if (!open && ref.current) { const r = ref.current.getBoundingClientRect(); setUp(window.innerHeight - r.bottom < 260 && r.top > 260); setAlignR(r.left + 220 > window.innerWidth); }
    setHi(Math.max(0, opts.findIndex((o) => o.value === val)));
    setOpen(!open);
  };
  const onKey = (e) => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      if (!open) { toggle(); return; }
      const d = e.key === 'ArrowDown' ? 1 : -1; let i = hi;
      do { i = (i + d + opts.length) % opts.length; } while (opts[i].disabled && i !== hi);
      setHi(i);
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (open) pick(opts[hi]); else toggle(); }
    else if (e.key === 'Escape' || e.key === 'Tab') setOpen(false);
    else if (e.key.length === 1) {
      const i = opts.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) { if (open) setHi(i); else pick(opts[i]); }
    }
  };
  return (
    <div className={`sel ${sm ? 'sel-sm' : ''} ${open ? 'open' : ''} ${disabled ? 'disabled' : ''}`} ref={ref} style={style}>
      <button type="button" id={id} className="sel-btn" onClick={toggle} onKeyDown={onKey} disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-label={rest['aria-label']} title={cur?.label}>
        <span className={`sel-val ${cur ? '' : 'ph'}`}>{cur ? cur.label : '— pilih —'}</span>
        <i className="bi bi-chevron-down sel-chev" aria-hidden="true" />
      </button>
      {required && <input className="sel-req" tabIndex={-1} value={val} required onChange={() => {}} aria-hidden="true" onFocus={() => ref.current?.querySelector('button')?.focus()} />}
      <ul className={`sel-menu ${up ? 'up' : ''} ${alignR ? 'right' : ''} ${open ? 'open' : ''}`} role="listbox" ref={listRef}>
        {opts.map((o, i) => (
          <li key={`${o.value}-${i}`} role="option" aria-selected={o.value === val} aria-disabled={o.disabled}
            className={`${o.value === val ? 'sel-on' : ''} ${i === hi ? 'hi' : ''} ${o.disabled ? 'dis' : ''}`}
            onMouseEnter={() => setHi(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)}>
            <span>{o.label}</span>{o.value === val && <i className="bi bi-check2" aria-hidden="true" />}
          </li>
        ))}
      </ul>
    </div>
  );
}
