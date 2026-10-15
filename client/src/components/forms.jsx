/** Input kustom: dropdown (Select), area unggah file (FileDrop), dan isian Rupiah (MoneyInput). */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useDismiss } from '../hooks/useDismiss';
import { FILE_ACCEPT, FILE_HINT, MAX_FILE_MB, fileSize, onlyDigits } from '../lib/format';
import { useToast } from './feedback';

/**
 * Isian nominal Rupiah: hanya menerima angka (huruf yang diketik langsung dibuang) dan tampil dengan titik ribuan.
 * value/onChange berupa teks digit ("250000"); kosong = belum diisi.
 */
export function MoneyInput({ value, onChange, size, className = '', prefix = true, ...rest }) {
  const shown = onlyDigits(value) ? (+onlyDigits(value)).toLocaleString('id-ID') : '';
  const input = <input type="text" inputMode="numeric" autoComplete="off" className={`form-control text-end ${size ? `form-control-${size}` : ''} ${prefix ? '' : className}`} value={shown} onChange={(e) => onChange(onlyDigits(e.target.value))} {...rest} />;
  if (!prefix) return input;
  return <div className={`input-group ${size ? `input-group-${size}` : ''} ${className}`}><span className="input-group-text">Rp</span>{input}</div>;
}

/**
 * Buang file yang melebihi batas ukuran sebelum dikirim (server juga menolak di atas batas yang sama),
 * supaya pengguna langsung tahu tanpa menunggu unggahan gagal.
 */
export function useFileGuard() {
  const toast = useToast();
  return useCallback((list) => {
    const all = [...(list || [])];
    const big = all.filter((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    if (big.length) toast(`${big.map((f) => f.name).join(', ')} melebihi ${MAX_FILE_MB} MB, jadi tidak dipilih.`, 'danger');
    return all.filter((f) => !big.includes(f));
  }, [toast]);
}

/**
 * Area unggah file bergaya dropzone (tetap memakai input file biasa). File terpilih tampil sebagai daftar,
 * masing-masing dengan tombol × untuk membatalkan. multiple: pilihan berikutnya ditambahkan ke daftar.
 */
export function FileDrop({ id, multiple, accept = FILE_ACCEPT, files, onChange, label = 'Pilih file', hint = FILE_HINT, max = 5 }) {
  const guard = useFileGuard();
  const toast = useToast();
  const list = [...(files || [])];
  const n = list.length;
  const add = (picked) => {
    const ok = guard(picked);
    if (!ok.length) return;
    if (!multiple) { onChange(ok.slice(0, 1)); return; }
    const key = (f) => `${f.name}|${f.size}`;
    const merged = [...list, ...ok.filter((f) => !list.some((x) => key(x) === key(f)))];
    if (merged.length > max) toast(`Maksimal ${max} file. File selebihnya tidak ditambahkan.`, 'danger');
    onChange(merged.slice(0, max));
  };
  const remove = (i) => onChange(list.filter((_, k) => k !== i));
  return (
    <div className="file-drop-wrap">
      <label className={`file-drop ${n ? 'has' : ''}`} htmlFor={id}>
        <i className={`bi bi-${n ? 'check2-circle' : 'cloud-arrow-up'}`} aria-hidden="true" />
        <span className="min-w-0">
          <b>{n ? (multiple ? `${n} file dipilih` : list[0].name) : label}</b>
          <small>{n ? (multiple ? (n < max ? 'Klik untuk menambah file' : `Maksimal ${max} file`) : 'Klik untuk mengganti') : hint}</small>
        </span>
        <input id={id} type="file" multiple={multiple} accept={accept} className="visually-hidden" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      </label>
      {n > 0 && (
        <ul className="file-list" aria-label="File terpilih">
          {list.map((f, i) => (
            <li key={`${f.name}-${f.size}-${i}`}>
              <i className="bi bi-file-earmark-text" aria-hidden="true" />
              <span className="min-w-0 flex-grow-1"><span className="file-name">{f.name}</span><small>{fileSize(f.size)}</small></span>
              <button type="button" className="file-x" onClick={() => remove(i)} aria-label={`Batalkan lampiran ${f.name}`} title="Batalkan lampiran"><i className="bi bi-x-lg" /></button>
            </li>
          ))}
        </ul>
      )}
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
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close, { esc: false });
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
