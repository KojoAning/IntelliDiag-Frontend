import React, { useState, useRef, useEffect } from "react";
import { FiMoreHorizontal, FiMaximize2, FiTrash2 } from "react-icons/fi";

const modalityColors = {
  MR:        "text-[#0694FB] bg-[rgba(6,148,251,0.15)]",
  "X-Ray":    "text-[#22C55E] bg-[rgba(34,197,94,0.15)]",
  CT:         "text-[#F59E0B] bg-[rgba(245,158,11,0.15)]",
  Ultrasound: "text-[#A855F7] bg-[rgba(168,85,247,0.15)]",
};

function SeriesCard({ series, modality, index, onOpen, onDelete }) {
  const [menuOpen, setMenuOpen]       = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [confirmDelete, setConfirm]   = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirmDelete) { setConfirm(true); return; }
    setDeleting(true);
    try {
      await onDelete(series.id);
    } finally {
      setDeleting(false);
      setMenuOpen(false);
      setConfirm(false);
    }
  };

  return (
    <div
      onClick={() => onOpen(series)}
      className="group bg-[#0D0D0D] border border-[#1E1E1E] rounded-2xl p-5 flex flex-col gap-4 hover:border-[#0694FB]/20 transition-colors duration-200 cursor-pointer relative"
    >
      {/* Ellipsis + dropdown */}
      <div ref={menuRef} className="absolute top-4 right-4" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => { setMenuOpen(o => !o); setConfirm(false); }}
          className="w-7 h-7 flex items-center justify-center rounded-lg border-none cursor-pointer transition-colors"
          style={{ background: "rgba(255,255,255,0.06)" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
        >
          <FiMoreHorizontal size={14} color="#6B6B6B" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-8 z-30 bg-[#161616] border border-[#2a2a2a] rounded-xl py-1 min-w-[130px] shadow-lg">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] bg-transparent border-none cursor-pointer transition-colors ${
                confirmDelete
                  ? "text-[#FF4A4A] hover:bg-[rgba(255,74,74,0.1)]"
                  : "text-[#6B6B6B] hover:bg-[#1a1a1a] hover:text-[#FF4A4A]"
              }`}
            >
              <FiTrash2 size={12} />
              {deleting ? "Deleting…" : confirmDelete ? "Confirm delete" : "Delete series"}
            </button>
          </div>
        )}
      </div>

      {/* Folder + info */}
      <div className="flex items-center gap-3">
        <img
          src="/dimensions.png"
          alt="series"
          className="w-14 h-14 object-contain shrink-0 group-hover:scale-105 transition-transform duration-200"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${modalityColors[modality] || "text-white bg-[#1a1a1a]"}`}>
              {modality}
            </span>
            <span className="text-[#3a3a3a] text-[10px]">#{index + 1}</span>
          </div>
          <p className="text-white text-[16px] font-medium m-0 truncate">{series.name}</p>
          <p className="text-[#a3a3a3] text-[12px] m-0 mt-0.5 ">{series.description}</p>
        </div>
      </div>

      {/* Image count + open */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex flex-row items-center gap-2">
          <p className="text-[#ffffff] m-0 text-[13px] ">Slice Count: </p>
          <p className="text-[#CCCCCC] m-0 text-[13px]">     {series.image_count}</p>
        </div>
        <div className="flex items-center gap-1.5 text-[#0694FB] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <FiMaximize2 size={12} />
          <span className="text-[11px] font-medium">Open</span>
        </div>
      </div>
    </div>
  );
}

function SeriesGrid({ study, onOpenSeries, onDeleteSeries, loading }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-[rgba(6,148,251,0.17)] inline-flex rounded-[11px] px-[9px] py-[6px]">
            <p className="m-0 text-[13px] text-[#0694FB] font-medium">
              {loading ? "—" : (study.series?.length ?? 0)} Series
            </p>
          </div>
        </div>
        <p className="text-[#6B6B6B] text-[12px] m-0">
          {loading ? "Loading…" : "Click a series to open the viewer"}
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#3a3a3a] text-[13px] m-0">Loading series…</p>
        </div>
      ) : (
      <div className="grid grid-cols-3 gap-4 2xl:grid-cols-4 xl:grid-cols-3">
        {(study.series ?? []).map((series, i) => (
              <SeriesCard
                key={series.id}
                series={series}
                modality={study.modality}
                index={i}
                onOpen={onOpenSeries}
                onDelete={onDeleteSeries}
              />
            ))
        }

        {/* Add series placeholder */}
        {/* <div className="bg-[#0D0D0D] border border-dashed border-[#1E1E1E] rounded-2xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#0694FB]/50 hover:bg-[rgba(6,148,251,0.02)] transition-all duration-200 min-h-[200px]">
          <div className="w-10 h-10 rounded-xl bg-[#111] border border-[#1E1E1E] flex items-center justify-center">
            <span className="text-[#3a3a3a] text-xl leading-none">+</span>
          </div>
          <p className="text-[#6B6B6B] text-[14px] m-0 text-center">Add New Series</p>
        </div> */}
      </div>
      )}
    </div>
  );
}

export default SeriesGrid;
