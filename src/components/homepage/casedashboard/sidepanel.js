import React, { useState, useEffect } from "react";
import { FiUploadCloud } from "react-icons/fi";
import { isDicomImage, renderDicomThumbnailFromUrl } from "../../../lib/dicomUtils";

// Renders a single thumbnail — canvas-decoded for DICOM, native <img> for others
function SliceThumb({ img, index, selected, onSelect }) {
  const [thumbSrc, setThumbSrc] = useState(null);
  const [thumbLoading, setThumbLoading] = useState(false);

  useEffect(() => {
    if (!isDicomImage(img)) { setThumbSrc(img.url); return; }
    let cancelled = false;
    setThumbLoading(true);
    renderDicomThumbnailFromUrl(img.url).then(dataUrl => {
      if (!cancelled) { setThumbSrc(dataUrl); setThumbLoading(false); }
    });
    return () => { cancelled = true; };
  }, [img.url]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      onClick={() => onSelect(img.url)}
      className={`relative rounded-lg overflow-hidden border cursor-pointer transition-all duration-150 shrink-0 aspect-square ${
        selected
          ? "border-[#0694FB] ring-1 ring-[#0694FB]"
          : "border-[#1E1E1E] hover:border-[#0694FB]/50"
      }`}
    >
      {thumbLoading && (
        <div className="w-full h-full bg-[#111] animate-pulse" />
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
      <span className="absolute bottom-1 right-1.5 text-[9px] text-white/50 font-mono leading-none">
        {String(index + 1).padStart(3, "0")}
      </span>
    </div>
  );
}

function Sidepanel({ images = [], onUploadClick, onSelectImage, selectedImage, loading }) {
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
        {/* Skeleton placeholders while fetching from API */}
        {loading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-full aspect-square rounded-lg bg-[#111] animate-pulse shrink-0" />
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
            selected={selectedImage === img.url}
            onSelect={onSelectImage}
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
