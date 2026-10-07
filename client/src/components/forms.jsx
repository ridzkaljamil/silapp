/** Input kustom: dropdown (Select) dan area unggah file (FileDrop). */
import { useState, useRef, useEffect } from 'react';
import { FILE_ACCEPT } from '../lib/format';

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
