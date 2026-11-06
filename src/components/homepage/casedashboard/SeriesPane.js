import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { FiX } from "react-icons/fi";
import { TbLink, TbLock, TbLockOpen } from "react-icons/tb";
import CornerstoneViewport from "./CornerstoneViewport";
import { loadSeries } from "../../../lib/seriesCache";
import { buildImageIds } from "../../../lib/dicomUtils";
import { readSlicePositions } from "../../../lib/slicePositions";
import { restoreAnnotations } from "../../../lib/annotationPersistence";
import { getSeriesAnnotations } from "../../../lib/api";
import { formatStudyDate } from "../../../lib/priorStudies";

// One of the layout's other viewers (Horos's extra viewer windows): a series you can
// scroll, window, pan and zoom beside the active one, with its saved measurements shown
// read-only. Tools, measurements and AI work on the active viewer; double-click this
// one (or use Make active) to switch.
//
// linked: scrolls with the others by position (null when there's nothing to link to)
// onIndexChange(index): the slice on screen changed
// onDisplayChange(display): the user changed its window, invert, zoom or pan (CornerstoneViewport)
// onGeometry(geometry | null): slice positions (lib/slicePositions) once read, null on unmount
// A series of another study (series.prior; .later when it's after the open one) is labelled with its date, can't become the
// active viewer, and scrolls with the active one only once locked (lockState: "locked" |
// "unlocked" | null when it can't be — onToggleLock switches)
const SeriesPane = forwardRef(function SeriesPane({ series, leftTool, linked, lockState, onToggleLock, onIndexChange, onDisplayChange, onGeometry, onActivate, onRemove }, ref) {
  const vpRef = useRef(null);
  const [imageIds, setImageIds] = useState([]);
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "empty" | "error"
  const [index, setIndex] = useState(0);
  const onGeometryRef = useRef(onGeometry);
  onGeometryRef.current = onGeometry;

  useImperativeHandle(ref, () => ({
    setImageIndex(n) { vpRef.current?.setImageIndex(n); },
    getImageIndex() { return vpRef.current?.getCurrentIndex?.() ?? index; },
    applyDisplay(display) { vpRef.current?.applyDisplay(display); },
  }));

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setImageIds([]);
    (async () => {
      const { images } = await loadSeries(series.id);
      const ids = await buildImageIds(images);
      if (cancelled) return;
      setImageIds(ids);
      setStatus(ids.length ? "ready" : "empty");
      getSeriesAnnotations(series.id)
        .then(({ annotations }) => { if (!cancelled && restoreAnnotations(annotations, ids, images)) vpRef.current?.render(); })
        .catch(() => {});
      const geometry = await readSlicePositions(ids);
      if (!cancelled) onGeometryRef.current?.(geometry);
    })().catch(() => { if (!cancelled) setStatus("error"); });
    return () => {
      cancelled = true;
      onGeometryRef.current?.(null);
    };
  }, [series.id]);

  return (
    <div className="group absolute inset-0" onDoubleClick={series.prior ? undefined : onActivate}>
      <div className="absolute inset-0 z-10">
        <CornerstoneViewport
          ref={vpRef}
          imageIds={imageIds}
          leftTool={leftTool === "crosshairs" ? "wl" : leftTool}
          readOnly
          onIndexChange={(i) => { setIndex(i); onIndexChange?.(i); }}
          onDisplayChange={onDisplayChange}
        />
      </div>

      {status !== "ready" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          {status === "loading"
            ? <div className="w-6 h-6 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
            : <p className="text-[#4a4a4a] text-[12px] m-0">{status === "empty" ? "This series has no images" : "Couldn't load this series"}</p>}
        </div>
      )}

      {/* Series name, top-left (an earlier study's date above it) */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-0.5 pointer-events-none select-none max-w-[60%]">
        {series.prior && (
          <p className="m-0 mb-0.5 leading-tight text-[#F59E0B] text-[11px] font-semibold truncate">
            {`${series.prior.later ? "LATER" : "PRIOR"} · ${formatStudyDate(series.prior.date)}${series.prior.studyName ? ` · ${series.prior.studyName}` : ""}`}
          </p>
        )}
        <p className="m-0 leading-tight text-white/70 text-[11px] truncate">{series.name || "Untitled series"}</p>
        {series.description && <p className="m-0 leading-tight text-white/35 text-[11px] truncate">{series.description}</p>}
        {series.modality && <p className="m-0 leading-tight text-white/35 text-[11px]">{series.modality}</p>}
      </div>

      {/* Make active / remove, top-right on hover */}
      <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {series.prior ? (lockState && (
          <button
            onClick={onToggleLock}
            title={lockState === "locked"
              ? "Unlock — scroll this study on its own (to line it up again)"
              : "Lock — scroll this study with the active viewer from here on. First scroll it to the slice matching the active viewer's"}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-white text-[11px] font-medium border-none cursor-pointer ${lockState === "locked" ? "bg-[#F59E0B] hover:bg-[#d98a07]" : "bg-[#0694FB] hover:bg-[#0578d1]"}`}
          >
            {lockState === "locked" ? <><TbLockOpen size={12} /> Unlock</> : <><TbLock size={12} /> Lock to active</>}
          </button>
        )) : (
        <button
          onClick={onActivate}
          title="Make this the active viewer — tools, measurements and AI work there (or double-click the image)"
          className="px-2.5 py-1 rounded-full bg-[#0694FB] hover:bg-[#0578d1] text-white text-[11px] font-medium border-none cursor-pointer"
        >
          Make active
        </button>
        )}
        <button
          onClick={onRemove}
          title="Empty this viewer"
          className="w-6 h-6 flex items-center justify-center rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#6B6B6B] hover:text-white cursor-pointer"
        >
          <FiX size={12} />
        </button>
      </div>

      {/* Link state, bottom-left; slice counter, bottom-right */}
      {linked && (
        <span className="absolute bottom-3 left-3 z-20 flex items-center gap-1 text-[11px] text-[#0694FB]/80 pointer-events-none select-none" title="Scrolls with the active viewer by position, and follows its zoom and pan (and window, between CT series)">
          <TbLink size={12} /> Linked
        </span>
      )}
      {series.prior && lockState && (
        <span className={`absolute bottom-3 left-3 z-20 flex items-center gap-1 text-[11px] pointer-events-none select-none ${lockState === "locked" ? "text-[#F59E0B]" : "text-[#6B6B6B]"}`}>
          {lockState === "locked" ? <><TbLock size={12} /> Locked to active</> : "Scroll to the matching slice, then Lock"}
        </span>
      )}
      {imageIds.length > 0 && (
        <span className="absolute bottom-3 right-3 z-20 text-white/35 text-[11px] leading-tight pointer-events-none select-none">
          {`${index + 1} / ${imageIds.length}`}
        </span>
      )}
    </div>
  );
});

export default SeriesPane;

// An empty viewer: drop a series card here, or pick one
export function EmptyPane({ series, onPick, onPickPrior }) {
  return (
    <div className="group absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
      <p className="text-[#4a4a4a] text-[12px] m-0 text-center">Drag a series here from the panel, or pick one</p>
      {onPickPrior && (
        <button
          onClick={onPickPrior}
          className="px-3 py-1.5 rounded-lg bg-[#111] hover:bg-[#1a1a1a] border border-[#1E1E1E] hover:border-[#F59E0B]/60 text-[12px] text-[#F59E0B] cursor-pointer"
        >
          Compare with another study…
        </button>
      )}
      {series.length > 0 && (
        <div className="flex flex-col gap-1 w-full max-w-[220px] max-h-[50%] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#1B1B1B #000" }}>
          {series.map(s => (
            <button
              key={s.id}
              onClick={() => onPick(s)}
              className="w-full text-left px-2.5 py-1.5 rounded-lg bg-[#111] hover:bg-[#1a1a1a] border border-[#1E1E1E] hover:border-[#0694FB]/50 text-[12px] text-[#CCCCCC] hover:text-white cursor-pointer truncate"
            >
              {s.name || "Untitled series"}
              {s.modality && <span className="text-[#6B6B6B]">{` · ${s.modality}`}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
