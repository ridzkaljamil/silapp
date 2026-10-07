/** Daftar ringkas untuk HP + lembar detail dari bawah (dipakai halaman kelola data). */
import { useState, Fragment } from 'react';
import { Sheet } from './overlays';

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
