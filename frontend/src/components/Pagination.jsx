import "./Pagination.css";
export default function Pagination({
  items = [],
  page,
  setPage,
  perPage,
  setPerPage,
  itemProcessor,
}) {
  const total = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(page, total);
  const first = Math.max(1, Math.min(current - 2, total - 4));
  const nums = Array.from(
    { length: Math.min(5, total - first + 1) },
    (_, i) => first + i,
  );
  return (
    <div className="pagination">
      <div>
        {[5, 10, 20].map((n) => (
          <button
            key={n}
            className={n === perPage ? "active" : ""}
            onClick={() => {
              setPerPage(n);
              setPage(1);
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <div>
        {nums.map((n) => (
          <button
            key={n}
            className={n === current ? "active" : ""}
            onClick={() => setPage(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <span>
        {items.length
          ? `${(current - 1) * perPage + 1}-${Math.min(current * perPage, items.length)} of ${items.length}`
          : "0 items"}
      </span>
      {typeof itemProcessor === "function" &&
        items
          .slice((current - 1) * perPage, current * perPage)
          .map(itemProcessor)}
    </div>
  );
}
