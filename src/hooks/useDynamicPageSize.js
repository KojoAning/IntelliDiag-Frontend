import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const MIN_ROWS = 5;
const FALLBACK_ROW_HEIGHT = 73;
const MIN_ROW_HEIGHT = 40;

/**
 * Dynamically calculates how many table rows can fit without causing a scrollbar.
 *
 * Place `tableRef` on the table container div (the one wrapping the <table>).
 *
 * @param {number} [fallback=7] - Page size before first measurement.
 */
const useDynamicPageSize = (fallback = 7) => {
  const [pageSize, setPageSize] = useState(fallback);
  const tableRef = useRef(null);
  const hasRealMeasurement = useRef(false);

  const calc = useCallback(() => {
    const el = tableRef.current;
    if (!el) return;

    // Measure real row height
    const row = el.querySelector("tbody tr");
    const measuredH = row ? row.getBoundingClientRect().height : 0;
    const rowH = measuredH >= MIN_ROW_HEIGHT ? measuredH : FALLBACK_ROW_HEIGHT;
    const isReal = measuredH >= MIN_ROW_HEIGHT;

    // Measure thead
    const thead = el.querySelector("thead");
    const theadH = thead ? thead.getBoundingClientRect().height : 45;

    // Only measure the next sibling (pagination bar) — not all siblings
    const nextSibling = el.nextElementSibling;
    let paginationH = 0;
    if (nextSibling) {
      const style = window.getComputedStyle(nextSibling);
      paginationH = nextSibling.getBoundingClientRect().height
        + parseFloat(style.marginTop || 0)
        + parseFloat(style.marginBottom || 0);
    }

    const topOffset = el.getBoundingClientRect().top;
    // If pagination isn't in the DOM yet (e.g. during loading), reserve its
    // typical height so we don't over-count rows on the first measurement.
    const paginationReserve = nextSibling ? 0 : 52;
    const available = window.innerHeight - topOffset - theadH - paginationH - paginationReserve - 24;
    const rows = Math.max(MIN_ROWS, Math.floor(available / rowH));

    if (isReal) hasRealMeasurement.current = true;
    setPageSize(rows);
  }, []);

  useLayoutEffect(() => { calc(); }, [calc]);

  useEffect(() => {
    if (hasRealMeasurement.current) return;
    const interval = setInterval(() => {
      calc();
      if (hasRealMeasurement.current) clearInterval(interval);
    }, 300);
    const timeout = setTimeout(() => clearInterval(interval), 3000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [calc]);

  useEffect(() => {
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [calc]);

  return { pageSize, tableRef };
};

export default useDynamicPageSize;
