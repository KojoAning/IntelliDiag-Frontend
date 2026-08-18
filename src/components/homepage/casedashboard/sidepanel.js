import React, { useState, useEffect, useRef } from "react";
import { FiUploadCloud } from "react-icons/fi";
import { authFetch } from "../../../lib/api";

const API_BASE = (process.env.REACT_APP_API_BASE || "").trim().replace(/\/$/, "");

// Module-level cache so thumbnails survive re-renders and component remounts.
// Exported so WorkspaceViewer can pre-populate it from the bulk endpoint.
export const thumbCache = new Map();

async function fetchAuthenticatedThumb(url) {
  try {
    const resp = await authFetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

function SliceThumb({ img, index, selected, onSelect, hasTumor }) {
  const [thumbSrc, setThumbSrc] = useState(() => thumbCache.get(img.id) ?? null);
  const [thumbLoading, setThumbLoading] = useState(!thumbSrc);

  useEffect(() => {
    // Already cached — skip fetch
    if (thumbCache.has(img.id)) {
      setThumbSrc(thumbCache.get(img.id));
      setThumbLoading(false);
      return;
    }

    let cancelled = false;
    setThumbLoading(true);

    (async () => {
      // Use the pre-rendered JPEG thumbnail from the backend — fast, no DICOM
      // parsing in the browser. Falls back to the stream URL for non-DICOM images.
      const src = await fetchAuthenticatedThumb(img.thumbnailUrl ?? img.url);
      if (!cancelled && src) {
        thumbCache.set(img.id, src);
        setThumbSrc(src);
      }
      if (!cancelled) setThumbLoading(false);
    })();

    return () => { cancelled = true; };
  }, [img.id, img.thumbnailUrl]);

  return (
    <div
      onClick={() => onSelect(img.blobUrl ?? img.url)}
      className={`relative rounded-lg overflow-hidden border cursor-pointer transition-all duration-150 shrink-0 aspect-square ${
        selected
          ? "border-[#0694FB] ring-1 ring-[#0694FB]"
          : "border-[#1E1E1E] hover:border-[#0694FB]/50"
      }`}
    >
      {thumbLoading && (
        <div className="w-full h-full bg-[#111] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {!thumbLoading && thumbSrc && (
        <img
          src={thumbSrc}
          alt={img.name}
          className="w-full h-full object-cover"
          onError={e => { e.target.style.display = "none"; }}
        />
      )}
      {!thumbLoading && !thumbSrc && (
        <div className="w-full h-full bg-[#111] flex items-center justify-center">
          <span className="text-[#2a2a2a] text-[9px] font-mono">DCM</span>
        </div>
      )}
      {hasTumor && (
        <div className="absolute top-1 left-1 z-10 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shadow-md">
          <span className="text-white text-[8px] font-bold leading-none">!</span>
        </div>
      )}
      <span className="absolute bottom-1 right-1.5 text-[9px] text-white/50 font-mono leading-none">
        {String(index + 1).padStart(3, "0")}
      </span>
    </div>
  );
}

function Sidepanel({ images = [], onUploadClick, onSelectImage, selectedImage, loading, inferenceResult }) {
  return (
    <div className="w-[160px] min-w-[160px] h-full flex flex-col gap-2 overflow-hidden">

      <div className="inline-flex self-start bg-[rgba(6,148,251,0.17)] rounded-[10px] px-3 py-1.5">
        <p className="text-[#0694FB] text-[12px] font-medium m-0">
          {loading ? "Loading…" : `${images.length} Slice${images.length !== 1 ? "s" : ""}`}
        </p>
      </div>
      <div className="w-full h-px bg-[#1E1E1E] shrink-0" />

      <div
        className="flex flex-col gap-1.5 overflow-y-auto flex-1"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#1a1a1a transparent" }}
      >
        {/* Spinner placeholders while fetching from API */}
        {loading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-full aspect-square rounded-lg bg-[#111] shrink-0 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
          </div>
        ))}

        {!loading && images.length === 0 && (
          <div className="flex items-center justify-center py-4">
            <p className="text-[#2a2a2a] text-[10px] text-center m-0">No images yet</p>
          </div>
        )}

        {!loading && images.map((img, i) => (
          <SliceThumb
            key={img.id}
            img={img}
            index={i}
            selected={selectedImage === (img.blobUrl ?? img.url)}
            onSelect={onSelectImage}
            hasTumor={inferenceResult?.slices?.[i]?.has_tumor ?? false}
          />
        ))}

        <button
          onClick={() => onUploadClick()}
          className="shrink-0 w-full py-2 rounded-xl border border-dashed border-[#1E1E1E] hover:border-[#0694FB]/60 hover:bg-[rgba(6,148,251,0.04)] bg-transparent flex items-center justify-center gap-1.5 cursor-pointer transition-all group"
        >
          <FiUploadCloud size={13} className="text-[#3a3a3a] group-hover:text-[#0694FB] transition-colors" />
          <span className="text-[#3a3a3a] group-hover:text-[#0694FB] text-[11px] transition-colors">Add images</span>
        </button>
      </div>

    </div>
  );
}

export default Sidepanel;
