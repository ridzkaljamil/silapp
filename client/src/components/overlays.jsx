/** Lapisan di atas halaman: pop-up/lembar bawah (Sheet) dan menu titik tiga. */
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
