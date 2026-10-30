import React, { useRef, useState } from "react";

// Slice scrubber for the docked cine bar: click or drag anywhere on the track to seek,
// hover to preview the slice number, and see where the AI found something — runs of
// detected slices are drawn as red segments on the track, so you can jump straight there.
// Slices with your own measurements get a small light-blue mark above the track, and key
// images a yellow one below it.
//
// count: number of slices; index: current slice (0-based); onSeek(index)
// detected / measured / keyed: optional arrays of booleans, one per slice
function SliceScrubber({ count, index, onSeek, detected, measured, keyed }) {
  const trackRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [dragging, setDragging] = useState(false);

  const last = Math.max(count - 1, 1);
  const pct = (i) => `${(i / last) * 100}%`;

  const indexAt = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const t = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    return Math.round(t * last);
  };

  // Consecutive detected slices merged into [start, end] runs
  const detectionRuns = [];
  detected?.forEach((hit, i) => {
    if (!hit) return;
    const run = detectionRuns[detectionRuns.length - 1];
    if (run && run[1] === i - 1) run[1] = i;
    else detectionRuns.push([i, i]);
  });

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    onSeek(indexAt(e.clientX));
  };
  const onPointerMove = (e) => {
    const i = indexAt(e.clientX);
    setHoverIndex(i);
    if (dragging && i !== index) onSeek(i);
  };
  const onPointerUp = (e) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  const active = dragging || hoverIndex != null;
  const previewIndex = dragging ? index : hoverIndex;

  return (
    <div
      className="group relative flex-1 min-w-[80px] h-6 flex items-center cursor-pointer touch-none"
      role="slider"
      aria-label="Slice"
      aria-valuemin={1}
      aria-valuemax={count}
      aria-valuenow={index + 1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setHoverIndex(null)}
    >
      <div
        ref={trackRef}
        className={`relative w-full rounded-full bg-[#2a2a2a] transition-[height] duration-150 ${active ? "h-1.5" : "h-1"}`}
      >
        {/* Played portion */}
        <div className="absolute inset-y-0 left-0 rounded-full bg-[#0694FB]" style={{ width: pct(index) }} />

        {/* AI detections */}
        {detectionRuns.map(([start, end]) => (
          <div
            key={start}
            className="absolute -inset-y-[2px] rounded-sm bg-red-400/80"
            style={{ left: pct(start), width: `max(3px, calc(${pct(end)} - ${pct(start)}))` }}
          />
        ))}

        {/* Your measurements */}
        {measured?.map((hit, i) => hit && (
          <div
            key={i}
            className="absolute -top-[7px] w-[5px] h-[5px] -translate-x-1/2 rounded-full bg-[#7DD3FC]"
            style={{ left: pct(i) }}
          />
        ))}

        {/* Key images */}
        {keyed?.map((hit, i) => hit && (
          <div
            key={i}
            className="absolute -bottom-[7px] w-[5px] h-[5px] -translate-x-1/2 rotate-45 bg-[#FACC15]"
            style={{ left: pct(i) }}
          />
        ))}

        {/* Hover marker */}
        {hoverIndex != null && !dragging && (
          <div className="absolute -inset-y-1 w-px bg-white/40" style={{ left: pct(hoverIndex) }} />
        )}

        {/* Thumb */}
        <div
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow ring-2 ring-[#0694FB] transition-[width,height] duration-150 ${active ? "w-3.5 h-3.5" : "w-3 h-3"}`}
          style={{ left: pct(index) }}
        />
      </div>

      {/* Slice preview */}
      {previewIndex != null && (
        <div
          className="absolute bottom-full mb-1.5 -translate-x-1/2 px-2 py-0.5 rounded-md bg-[#0d0d0d] border border-[#2a2a2a] text-[11px] font-mono text-white whitespace-nowrap pointer-events-none"
          style={{ left: pct(previewIndex) }}
        >
          {`${previewIndex + 1} / ${count}`}
          {detected?.[previewIndex] && <span className="text-red-400"> · finding</span>}
          {measured?.[previewIndex] && <span className="text-[#7DD3FC]"> · measured</span>}
          {keyed?.[previewIndex] && <span className="text-[#FACC15]"> · key image</span>}
        </div>
      )}
    </div>
  );
}

export default SliceScrubber;
