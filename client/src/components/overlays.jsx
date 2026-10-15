/** Lapisan di atas halaman: pop-up/lembar bawah (Sheet) dan menu titik tiga. */
import { useState, useRef, useEffect, useId, useCallback } from 'react';
import { useDismiss } from '../hooks/useDismiss';
import { createPortal } from 'react-dom';
import { useConfirm } from './feedback';

/**
 * Pop-up form: modal di desktop, lembar dari bawah (bottom sheet) di HP. Animasi masuk & keluar.
 * footer: tombol aksi. Tutup dengan Esc, klik latar, atau tombol ×.
 */
const STACK = [];

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
  const sid = useId();
  useEffect(() => {
    if (!open) return undefined;
    // pop-up bertumpuk (mis. "Tambah Kategori" di atas form): Esc hanya menutup yang paling atas
    STACK.push(sid);
    // Esc saat dialog konfirmasi terbuka hanya menutup konfirmasinya
    const onKey = (e) => e.key === 'Escape' && STACK[STACK.length - 1] === sid && !document.querySelector('.ui-confirm') && onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('sheet-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      STACK.splice(STACK.indexOf(sid), 1);
      if (!STACK.length) document.body.classList.remove('sheet-open');
    };
  }, [open, onClose, sid]);
  // saat menutup, tampilkan isi terakhir agar animasi keluar tidak kosong
  const last = useRef({});
  if (open) last.current = { title, sub, children, footer };
  if (!render) return null;
  if (!open) ({ title, sub, children, footer } = last.current);
  return createPortal(
    <div className={`ui-modal ${leaving ? 'leaving' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`ui-modal-card sheet ${wide ? 'wide' : ''} ${wide === 'xl' ? 'xl' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
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

/**
 * Pop-up berisi form (tambah/ubah data). Tombol Simpan & Batal di bagian bawah pop-up.
 * onSubmit dipanggil saat form dikirim (Enter atau tombol Simpan); validasi bawaan browser tetap jalan.
 */
export function FormSheet({ open, onClose, onSubmit, title, sub, icon = 'pencil-square', wide, busy, submitLabel = 'Simpan', danger, confirm: ask, children }) {
  const id = useId();
  const confirm = useConfirm();
  // ask: { title, body, ok } atau fungsi yang mengembalikannya — ditanyakan dulu sebelum onSubmit dijalankan
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const q = typeof ask === 'function' ? ask() : ask;
    if (q && !(await confirm({ icon: danger ? 'exclamation-triangle' : 'question-circle', danger, ok: submitLabel, ...q }))) return;
    onSubmit(e);
  };
  return (
    <Sheet open={open} onClose={() => !busy && onClose()} title={title} sub={sub} icon={icon} wide={wide} danger={danger}
      footer={<><button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Batal</button><button type="submit" form={id} className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy}>{busy ? <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Memproses…</> : submitLabel}</button></>}>
      <form id={id} onSubmit={submit} noValidate={false}>{children}</form>
    </Sheet>
  );
}

/** Menu titik tiga / tombol "Lainnya". items: [{ label, icon, onClick, danger, disabled, hidden }] */
export function Menu({ items, label = 'Lainnya', icon = 'three-dots', className = 'btn btn-outline-secondary', align = 'end' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
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
