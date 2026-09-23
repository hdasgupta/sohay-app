import { useEffect, useMemo, useState } from 'react';
import Dropdown from '../Dropdown/Dropdown.jsx';
import './Pagination.css';

export const PAGE_SIZES = [5, 10, 20];
const WINDOW = 2; // current page +/- 2 => 5 links

/** Returns the page numbers to show (max 5, current in the middle when possible) */
export function pageWindow(current, total) {
  if (total <= 0) return [];
  let start = Math.max(1, current - WINDOW);
  let end = Math.min(total, current + WINDOW);
  const missing = WINDOW * 2 + 1 - (end - start + 1);
  if (missing > 0) {
    start = Math.max(1, start - missing);
    end = Math.min(total, start + WINDOW * 2);
  }
  const pages = [];
  for (let p = start; p <= end; p += 1) pages.push(p);
  return pages;
}

const defaultSearchText = (item) => {
  try { return JSON.stringify(item).toLowerCase(); } catch { return String(item).toLowerCase(); }
};

/**
 * Generic pagination.
 * @param items          full list
 * @param itemProcessor  (item, indexInFullList) => JSX
 * @param searchText     (item) => searchable string (default: every field)
 */
export default function Pagination({
  items = [],
  itemProcessor,
  searchText = defaultSearchText,
  keyProcessor = (item, i) => item?.id ?? i,
  emptyMessage = 'Nothing to show yet',
  searchPlaceholder = 'Search...',
  listClassName = '',
  defaultPageSize = 5,
}) {
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [jump, setJump] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => searchText(it).toLowerCase().includes(q));
  }, [items, query, searchText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [query, pageSize]);

  const current = Math.min(page, totalPages);
  const from = (current - 1) * pageSize;
  const visible = filtered.slice(from, from + pageSize);

  const go = (p) => setPage(Math.min(totalPages, Math.max(1, p)));
  const onJump = (e) => {
    e.preventDefault();
    const n = Number.parseInt(jump, 10);
    if (Number.isFinite(n)) go(n);
    setJump('');
  };

  const controls = (position) => (
    <div className={`pg-controls pg-${position}`} data-testid={`pagination-${position}`}>
      <div className="pg-info">
        {filtered.length === 0 ? 'No items' : `Showing ${from + 1}-${Math.min(from + pageSize, filtered.length)} of ${filtered.length}`}
      </div>
      <nav className="pg-pages" aria-label={`Pagination ${position}`}>
        <button type="button" className="pg-btn" onClick={() => go(1)} disabled={current === 1} aria-label="First page">«</button>
        <button type="button" className="pg-btn" onClick={() => go(current - 1)} disabled={current === 1} aria-label="Previous page">‹</button>
        {pageWindow(current, totalPages).map((p) => (
          <button type="button" key={p} className={`pg-btn pg-num ${p === current ? 'pg-active' : ''}`} onClick={() => go(p)} aria-current={p === current ? 'page' : undefined} aria-label={`Page ${p}`}>{p}</button>
        ))}
        <button type="button" className="pg-btn" onClick={() => go(current + 1)} disabled={current === totalPages} aria-label="Next page">›</button>
        <button type="button" className="pg-btn" onClick={() => go(totalPages)} disabled={current === totalPages} aria-label="Last page">»</button>
      </nav>
      <div className="pg-tools">
        <form className="pg-jump" onSubmit={onJump}>
          <input className="input pg-jump-input" type="number" min="1" max={totalPages} value={jump} onChange={(e) => setJump(e.target.value)} placeholder="Page" aria-label={`Jump to page (${position})`} />
          <button type="submit" className="btn btn-ghost btn-sm">Go</button>
        </form>
        <Dropdown
          compact
          options={PAGE_SIZES}
          labelProcessor={(n) => `${n} / page`}
          keyProcessor={(n) => n}
          selected={pageSize}
          onOptionSelected={setPageSize}
          placeholder="Per page"
          id={`pg-size-${position}`}
        />
      </div>
    </div>
  );

  return (
    <div className="pagination">
      <div className="pg-search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} aria-label="Search list" />
      </div>
      {controls('top')}
      {visible.length === 0 ? (
        <div className="empty-state"><strong>{query ? 'No matching results' : emptyMessage}</strong>{query && 'Try a different search text'}</div>
      ) : (
        <div className={`pg-list ${listClassName}`}>
          {visible.map((item, i) => (
            <div className="pg-item" key={keyProcessor(item, from + i)} style={{ animationDelay: `${i * 40}ms` }}>
              {itemProcessor(item, from + i)}
            </div>
          ))}
        </div>
      )}
      {controls('bottom')}
    </div>
  );
}
