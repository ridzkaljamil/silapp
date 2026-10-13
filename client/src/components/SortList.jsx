/**
 * Daftar yang urutannya diubah dengan drag & drop (mouse maupun sentuh).
 * Pegangan (ikon titik enam) juga bisa digeser dengan tombol panah atas/bawah dari keyboard.
 */
import { useRef, useState } from 'react';

const moveItem = (list, from, to) => { const a = [...list]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; };

export function SortList({ items, onReorder, render, empty, label = 'Urutan' }) {
  const [drag, setDrag] = useState(null); // { from, to }
  const ref = useRef(null);
  const view = drag ? moveItem(items, drag.from, drag.to) : items;

  const overIndex = (y) => {
    const rows = [...ref.current.querySelectorAll(':scope > li')];
    let idx = rows.length - 1;
    for (let i = 0; i < rows.length; i++) { const r = rows[i].getBoundingClientRect(); if (y < r.top + r.height / 2) { idx = i; break; } }
    return Math.max(0, idx);
  };
  const down = (i) => (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ from: i, to: i });
  };
  const move = (e) => { if (drag) setDrag({ ...drag, to: overIndex(e.clientY) }); };
  const up = () => {
    if (!drag) return;
    const { from, to } = drag;
    setDrag(null);
    if (from !== to) onReorder(moveItem(items, from, to));
  };
  const key = (i) => (e) => {
    const d = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if (!d || !items[i + d]) return;
    e.preventDefault();
    onReorder(moveItem(items, i, i + d));
    setTimeout(() => ref.current?.querySelectorAll('.sort-handle')[i + d]?.focus());
  };

  if (!items.length) return <p className="text-center text-muted2 small py-3 mb-0">{empty}</p>;
  return (
    <ul className={`sort-list ${drag ? 'dragging' : ''}`} ref={ref} aria-label={label} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}>
      {view.map((x, i) => {
        const from = items.indexOf(x);
        return (
          <li key={x.id} className={drag && drag.from === from ? 'is-drag' : ''}>
            <button type="button" className="sort-handle" aria-label={`Geser untuk mengubah urutan (posisi ${i + 1} dari ${items.length})`} title="Geser untuk mengubah urutan"
              onPointerDown={down(from)} onKeyDown={key(from)}><i className="bi bi-grip-vertical" /></button>
            <span className="sort-no num">{i + 1}</span>
            {render(x, i)}
          </li>
        );
      })}
    </ul>
  );
}
