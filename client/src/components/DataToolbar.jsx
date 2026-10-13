/** Kolom cari + tombol Filter untuk halaman berisi daftar data. */
import { useRef, useState, useCallback } from 'react';
import { useDismiss } from '../hooks/useDismiss';

/** Cocokkan kata kunci dengan beberapa kolom (tidak peka huruf besar/kecil, semua kata harus ada). */
export const matchText = (q, ...fields) => {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fields.filter((x) => x !== null && x !== undefined).join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
};

/**
 * filters: [{ key, label, options: [[nilai, teks]] }]  (opsi "Semua" ditambahkan otomatis)
 * values:  { [key]: nilai }  ('' = semua)
 */
export function DataToolbar({ q, onQ, placeholder = 'Cari', filters = [], values = {}, onFilter, shown, total, unit = 'data', children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const groups = filters.filter((f) => !f.hidden && (f.options.length > 1 || (f.single && f.options.length)));
  const active = groups.filter((f) => values[f.key]).length;
  const filtered = active > 0 || q.trim() !== '';
  const reset = () => { onQ(''); onFilter?.(Object.fromEntries(groups.map((f) => [f.key, '']))); };

  return (
    <div className="dt-bar">
      <div className="dt-search">
        <i className="bi bi-search" aria-hidden="true" />
        <input type="search" className="form-control" placeholder={placeholder} aria-label={placeholder} value={q} onChange={(e) => onQ(e.target.value)} />
        {q && <button type="button" className="dt-clear" aria-label="Hapus Pencarian" onClick={() => onQ('')}><i className="bi bi-x-lg" /></button>}
      </div>
      {groups.length > 0 && (
        <div className="pm" ref={ref}>
          <button type="button" className={`btn btn-outline-secondary dt-fbtn ${active ? 'on' : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
            <i className="bi bi-funnel" />Filter{active > 0 && <span className="dt-badge">{active}</span>}
          </button>
          <div className={`pm-menu dt-menu ${open ? 'open' : ''}`} role="dialog" aria-label="Filter Data">
            {groups.map((f) => (
              <div key={f.key} className="dt-group" role="radiogroup" aria-label={f.label}>
                <span className="dt-gl">{f.label}</span>
                <div className="dt-opts">
                  {[['', 'Semua'], ...f.options].map(([v, t]) => (
                    <button key={v} type="button" role="radio" aria-checked={(values[f.key] || '') === v} tabIndex={open ? 0 : -1}
                      className={`dt-opt ${(values[f.key] || '') === v ? 'on' : ''}`} onClick={() => onFilter({ ...values, [f.key]: v })}>{t}</button>
                  ))}
                </div>
              </div>
            ))}
            <div className="dt-foot">
              <button type="button" className="btn btn-sm btn-link text-decoration-none px-0" disabled={!active} tabIndex={open ? 0 : -1} onClick={() => onFilter(Object.fromEntries(groups.map((f) => [f.key, ''])))}>Hapus Filter</button>
              <button type="button" className="btn btn-sm btn-primary" tabIndex={open ? 0 : -1} onClick={close}>Selesai</button>
            </div>
          </div>
        </div>
      )}
      {children}
      {total !== undefined && (
        <span className="dt-count small text-muted2">
          {filtered ? <>{shown} dari {total} {unit} · <button type="button" className="btn btn-link btn-sm p-0 align-baseline text-decoration-none" onClick={reset}>Tampilkan Semua</button></> : `${total} ${unit}`}
        </span>
      )}
    </div>
  );
}
