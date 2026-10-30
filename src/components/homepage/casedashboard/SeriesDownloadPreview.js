import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { getSeriesPartial, subscribeSeriesCache } from "../../../lib/seriesCache";
import { renderDicomPreview } from "../../../lib/dicomUtils";

// While a series downloads: the slices that have arrived, in order, to scroll through (wheel,
// arrow keys or the slider) before the full viewer opens. A plain picture with the series'
// own window — no tools; those come with the viewer once every slice is in.
const rendered = new WeakMap(); // slice buffer -> data URL (or null: compressed, can't preview)

export default function SeriesDownloadPreview({ seriesId }) {
  const partial = useSyncExternalStore(subscribeSeriesCache, () => getSeriesPartial(seriesId));
  const slices = useMemo(
    () => (partial?.slices ?? []).slice().sort((a, b) => (a.instanceNumber ?? Infinity) - (b.instanceNumber ?? Infinity)),
    [partial]
  );
  const [index, setIndex] = useState(0);
  const [src, setSrc] = useState(null);
  const followRef = useRef(true); // until the user scrolls, stay on the middle of what's in
  const current = slices[Math.min(index, slices.length - 1)];

  useEffect(() => {
    if (followRef.current && slices.length) setIndex(Math.floor((slices.length - 1) / 2));
  }, [slices.length]);

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    if (rendered.has(current.buffer)) { setSrc(rendered.get(current.buffer)); return; }
    renderDicomPreview(new Blob([current.buffer])).then(url => {
      rendered.set(current.buffer, url);
      if (!cancelled) setSrc(url);
    });
    return () => { cancelled = true; };
  }, [current]);

  const step = (delta) => {
    followRef.current = false;
    setIndex(i => Math.max(0, Math.min(slices.length - 1, Math.min(i, slices.length - 1) + delta)));
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); step(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const received = partial?.slices.length ?? 0;
  const total = partial?.total ?? 0;
  const pct = total ? Math.min(100, Math.round((received / total) * 100)) : 0;
  const shown = Math.min(index, slices.length - 1) + 1;

  return (
    <div className="flex flex-col items-center gap-3 w-full h-full p-6 box-border" onWheel={e => step(e.deltaY > 0 ? 1 : -1)}>
      <div className="flex-1 min-h-0 w-full flex items-center justify-center">
        {current && src ? (
          <img src={src} alt="" className="w-full h-full object-contain select-none" draggable={false} />
        ) : current && rendered.get(current.buffer) === null ? (
          <p className="m-0 text-[12px] text-[#6B6B6B]">These images are compressed, so they show once the viewer opens.</p>
        ) : (
          <div className="w-8 h-8 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      {received > 1 && (
        <input
          type="range"
          min={1}
          max={received}
          value={shown}
          onChange={e => { followRef.current = false; setIndex(Number(e.target.value) - 1); }}
          className="w-[min(420px,80%)] h-1 accent-[#0694FB] cursor-pointer"
          aria-label="Slice"
        />
      )}
      <div className="w-[min(420px,80%)] flex flex-col gap-1.5">
        <div className="h-1 rounded-full bg-[#1E1E1E] overflow-hidden">
          <div className="h-full bg-[#0694FB] transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <p className="m-0 text-[12px] text-[#868686] text-center">
          {received
            ? `Downloading — ${received} of ${total} slices in${current ? ` · showing ${shown}` : ""}. Scroll to look through them; the full viewer opens when the download finishes.`
            : "Loading images…"}
        </p>
      </div>
    </div>
  );
}
