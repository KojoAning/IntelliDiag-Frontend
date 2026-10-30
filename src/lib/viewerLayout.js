// Multi-viewer layouts (Horos's 1×2, 2×2 … viewer tiling). A layout is
//   { cols, rows, panes: (series | null)[cols × rows], activeSlot, linked }
// panes[activeSlot] is always the open series — the full viewer with tools, measurements
// and AI; the other panes are lighter viewers (see SeriesPane). linked: panes showing the
// same patient position scroll together. A pane can also show a series of an earlier study
// (series.prior: { studyId, studyName, date }) to compare with; it never becomes the active one.
//
// The layout lives above the workspace (which remounts per open series), so making
// another pane active keeps the rest of the layout where it was.

export const LAYOUTS = [
  { cols: 1, rows: 1, label: "Single viewer" },
  { cols: 2, rows: 1, label: "Two, side by side" },
  { cols: 1, rows: 2, label: "Two, stacked" },
  { cols: 2, rows: 2, label: "Four (2 × 2)" },
];

// Kept for this tab (sessionStorage) so a page reload comes back to the same viewers;
// cleared on sign-out (clearLocalSession)
export const LAYOUT_STORAGE_KEY = "viewer.layout";

// The layout saved in this tab, if it belongs with the series being opened
export function readSavedLayout(seriesId) {
  try {
    const layout = JSON.parse(sessionStorage.getItem(LAYOUT_STORAGE_KEY));
    const fits = layout && layout.cols * layout.rows === layout.panes?.length;
    return fits && layout.panes.some(s => s && String(s.id) === String(seriesId)) ? layout : null;
  } catch { return null; }
}

export function saveLayout(layout) {
  try {
    if (layout) sessionStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    else sessionStorage.removeItem(LAYOUT_STORAGE_KEY);
  } catch { /* storage blocked: the layout just won't survive a reload */ }
}

// Drag-and-drop type for a series card (the side panel) dropped onto a viewer
export const SERIES_DRAG_TYPE = "application/x-intellidiag-series";

const sameSeries = (a, b) => !!a && !!b && String(a.id) === String(b.id);

// The layout made consistent with the open series: it fills the active pane (or, if
// another pane already shows it, that pane becomes the active one), every series shows
// in one pane only, and series no longer in the study are dropped.
export function normalizeLayout(layout, activeSeries, seriesList = []) {
  const base = layout ?? { cols: 1, rows: 1, panes: [], activeSlot: 0, linked: true };
  const count = base.cols * base.rows;
  const known = seriesList.length ? new Set(seriesList.map(s => String(s.id))) : null;
  let panes = Array.from({ length: count }, (_, i) => {
    const s = base.panes?.[i] ?? null;
    // Series of an earlier study (s.prior) are shown for comparison, not part of this one
    return s && known && !known.has(String(s.id)) && !s.prior && !sameSeries(s, activeSeries) ? null : s;
  });
  let activeSlot = Math.min(Math.max(base.activeSlot ?? 0, 0), count - 1);
  if (activeSeries) {
    const at = panes.findIndex(s => sameSeries(s, activeSeries));
    if (at >= 0) activeSlot = at;
    else panes[activeSlot] = activeSeries;
  }
  const seen = new Set([String(panes[activeSlot]?.id)]);
  panes = panes.map((s, i) => {
    if (!s || i === activeSlot) return s;
    if (seen.has(String(s.id))) return null;
    seen.add(String(s.id));
    return s;
  });
  return { cols: base.cols, rows: base.rows, panes, activeSlot, linked: base.linked ?? true };
}

// Change the grid. Panes keep their places where they still fit; the rest move into free
// places, and any still empty get the study's next series not already showing.
export function resizeLayout(layout, cols, rows, seriesList = []) {
  const count = cols * rows;
  const active = layout.panes[layout.activeSlot];
  const activeSlot = layout.activeSlot < count ? layout.activeSlot : 0;
  const panes = new Array(count).fill(null);
  panes[activeSlot] = active;
  const leftovers = [];
  layout.panes.forEach((s, i) => {
    if (!s || i === layout.activeSlot) return;
    if (i < count && !panes[i]) panes[i] = s;
    else leftovers.push(s);
  });
  const at = seriesList.findIndex(s => sameSeries(s, active));
  const unshown = (at >= 0 ? [...seriesList.slice(at + 1), ...seriesList.slice(0, at)] : seriesList)
    .filter(s => !panes.some(p => sameSeries(p, s)) && !leftovers.some(p => sameSeries(p, s)));
  const queue = [...leftovers, ...unshown];
  for (let i = 0; i < count && queue.length; i++) if (!panes[i]) panes[i] = queue.shift();
  return { ...layout, cols, rows, panes, activeSlot };
}

// Put a series in a pane (dropped or picked there). A series already showing elsewhere
// swaps places with what was in the pane. Returns { layout, open }: open is the series
// to make the open one, when it landed in the active pane.
export function placeSeries(layout, slot, series) {
  const panes = [...layout.panes];
  const from = panes.findIndex(s => sameSeries(s, series));
  if (from === slot) return { layout, open: null };
  if (from >= 0) panes[from] = panes[slot];
  panes[slot] = series;
  if (from === layout.activeSlot) return { layout: { ...layout, panes, activeSlot: slot }, open: null }; // the open series moved
  return { layout: { ...layout, panes }, open: slot === layout.activeSlot ? series : null };
}

export function clearPane(layout, slot) {
  if (slot === layout.activeSlot) return layout;
  return { ...layout, panes: layout.panes.map((s, i) => (i === slot ? null : s)) };
}

// Make another pane the active one; open its series
export function activatePane(layout, slot) {
  if (layout.panes[slot]?.prior) return { layout, open: null };
  return { layout: { ...layout, activeSlot: slot }, open: layout.panes[slot] ?? null };
}
