import { useEffect, useMemo, useState } from 'react';
import './Pagination.css';

const PAGE_SIZE_OPTIONS = [5, 10, 20];
const VISIBLE_LINKS = 5;

/**
 * Generic pagination wrapper.
 *  items          : array of anything
 *  itemProcessor  : (item, index) => ReactNode, used to render one item
 *  emptyMessage   : shown when items is empty
 * Controls (page size + 5 page links) are rendered both above and below the list.
 */
const Pagination = ({ items = [], itemProcessor, emptyMessage = 'Nothing to show yet', listClassName = '' }) => {
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  // two pages before + current + two pages after
  const links = useMemo(() => {
    let start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + VISIBLE_LINKS - 1);
    start = Math.max(1, end - VISIBLE_LINKS + 1);
    return Array.from({ length: end - start + 1 }, (unused, index) => start + index);
  }, [page, totalPages]);

  const controls = (position) => (
    <div className={`pager pager-${position}`}>
      <div className="pager-size">
        <span>Items per page</span>
        <select
          value={pageSize}
          onChange={(event) => {
            const next = Number(event.target.value);
            console.log('[Pagination] page size changed to', next);
            setPageSize(next);
            setPage(1);
          }}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="pager-links">
        <button type="button" className="pg" disabled={page === 1} onClick={() => setPage(1)} title="First page">
          «
        </button>
        <button
          type="button"
          className="pg"
          disabled={page === 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          title="Previous page"
        >
          ‹
        </button>
        {links.map((link) => (
          <button
            key={link}
            type="button"
            className={`pg ${link === page ? 'active' : ''}`}
            onClick={() => setPage(link)}
          >
            {link}
          </button>
        ))}
        <button
          type="button"
          className="pg"
          disabled={page === totalPages}
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          title="Next page"
        >
          ›
        </button>
        <button
          type="button"
          className="pg"
          disabled={page === totalPages}
          onClick={() => setPage(totalPages)}
          title="Last page"
        >
          »
        </button>
      </div>

      <div className="pager-info">
        {items.length === 0
          ? '0 items'
          : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, items.length)} of ${items.length}`}
      </div>
    </div>
  );

  if (items.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="pagination-wrap">
      {controls('top')}
      <div className={`pagination-items ${listClassName}`}>
        {pageItems.map((item, index) => itemProcessor(item, (page - 1) * pageSize + index))}
      </div>
      {controls('bottom')}
    </div>
  );
};

export default Pagination;
