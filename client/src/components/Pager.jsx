/** Pembagian halaman daftar (20 baris per halaman) untuk tabel yang datanya terus bertambah. */
import { useEffect, useState } from 'react';

const PAGE_SIZE = 20;

export function usePaged(list, size = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(list.length / size));
  // kembali ke halaman 1 saat hasil pencarian/filter berubah
  useEffect(() => { setPage(1); }, [list.length]);
  const cur = Math.min(page, pages);
  return { items: list.slice((cur - 1) * size, cur * size), page: cur, pages, setPage, from: list.length ? (cur - 1) * size + 1 : 0, to: Math.min(cur * size, list.length), total: list.length };
}

export function Pager({ p, unit = 'data' }) {
  if (p.pages <= 1) return null;
  const go = (n) => { p.setPage(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return (
    <nav className="pager" aria-label="Halaman">
      <span className="small text-muted2">{p.from}–{p.to} dari {p.total} {unit}</span>
      <span className="d-flex gap-1">
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={p.page === 1} onClick={() => go(p.page - 1)} aria-label="Halaman Sebelumnya"><i className="bi bi-chevron-left" /></button>
        <span className="pager-no small">Hal. {p.page} / {p.pages}</span>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={p.page === p.pages} onClick={() => go(p.page + 1)} aria-label="Halaman Berikutnya"><i className="bi bi-chevron-right" /></button>
      </span>
    </nav>
  );
}

/** Pembungkus untuk halaman yang punya early return: children(itemsHalamanIni). */
export function Paged({ list, unit, children }) {
  const p = usePaged(list);
  return <>{children(p.items)}<Pager p={p} unit={unit} /></>;
}
