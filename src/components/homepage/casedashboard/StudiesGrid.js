import React from "react";
import { FiMaximize2, FiMoreHorizontal } from "react-icons/fi";

const modalityColors = {
  MR:        "text-[#0694FB] bg-[rgba(6,148,251,0.15)]",
  "X-Ray":    "text-[#22C55E] bg-[rgba(34,197,94,0.15)]",
  CT:         "text-[#F59E0B] bg-[rgba(245,158,11,0.15)]",
  Ultrasound: "text-[#A855F7] bg-[rgba(168,85,247,0.15)]",
};

const statusConfig = {
  "AI Flagged":     { text: "text-[#FF6B35]", bg: "bg-[rgba(255,107,53,0.12)]", dot: "bg-[#FF6B35]" },
  "Pending Review": { text: "text-[#0694FB]",  bg: "bg-[rgba(6,148,251,0.12)]",  dot: "bg-[#0694FB]" },
  "Completed":      { text: "text-[#22C55E]",  bg: "bg-[rgba(34,197,94,0.12)]",  dot: "bg-[#22C55E]" },
  "Draft Report":   { text: "text-[#A855F7]",  bg: "bg-[rgba(168,85,247,0.12)]", dot: "bg-[#A855F7]" },
  "In Review":      { text: "text-[#F59E0B]",  bg: "bg-[rgba(245,158,11,0.12)]", dot: "bg-[#F59E0B]" },
};

function StudyCard({ study, onOpen }) {
  const sc = statusConfig[study.status] || { text: "text-white", bg: "bg-[#1a1a1a]", dot: "bg-white" };

  return (
    <div className="group bg-[#0D0D0D] border border-[#1E1E1E] rounded-2xl p-5 flex flex-col gap-4 hover:border-[#0694FB]/40 hover:bg-[rgba(6,148,251,0.02)] transition-all duration-200 cursor-pointer relative"
      onClick={() => onOpen(study)}
    >
      {/* Ellipsis */}
      <button
        onClick={(e) => e.stopPropagation()}
        className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg border-none cursor-pointer transition-colors"
        style={{ background: "rgba(255,255,255,0.06)" }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
      >
        <FiMoreHorizontal size={14} color="#6B6B6B" />
      </button>

      {/* Top: folder + modality */}
      <div className="flex items-start gap-3">
        <img src="/folder.png" alt="study" className="w-14 h-14 object-contain shrink-0 group-hover:scale-105 transition-transform duration-200" />
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${modalityColors[study.modality] || "text-white bg-[#1a1a1a]"}`}>
              {study.modality}
            </span>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${sc.bg}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
              <span className={`text-[10px] font-medium ${sc.text}`}>{study.status}</span>
            </div>
          </div>
          <p className="text-white text-[14px] font-medium m-0 truncate">{study.name}</p>
          <p className="text-[#6B6B6B] text-[11px] m-0 mt-0.5">{study.region}</p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex gap-4">
          <div>
            <p className="text-[#3a3a3a] m-0">Series</p>
            <p className="text-[#CCCCCC] m-0 mt-0.5 font-medium">{study.seriesCount}</p>
          </div>
          <div>
            <p className="text-[#3a3a3a] m-0">Images</p>
            <p className="text-[#CCCCCC] m-0 mt-0.5 font-medium">{study.imageCount}</p>
          </div>
          <div>
            <p className="text-[#3a3a3a] m-0">Date</p>
            <p className="text-[#CCCCCC] m-0 mt-0.5 font-medium">{study.date}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[#0694FB] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <FiMaximize2 size={12} />
          <span className="text-[11px] font-medium">Open</span>
        </div>
      </div>

      {/* Accession */}
      <div className="pt-3 border-t border-[#1a1a1a]">
        <p className="text-[#2a2a2a] text-[10px] m-0 font-mono">{study.accession}</p>
      </div>
    </div>
  );
}

function StudiesGrid({ studies, onOpenStudy }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Section label */}
      <div className="flex items-center justify-between">
        <div className="bg-[rgba(6,148,251,0.17)] inline-flex rounded-[11px] px-[9px] py-[6px]">
          <p className="m-0 text-[13px] text-[#0694FB] font-medium">{studies.length} Imaging {studies.length === 1 ? "Study" : "Studies"}</p>
        </div>
        <p className="text-[#6B6B6B] text-[12px] m-0">Click a study to open the viewer</p>
      </div>

      {/* Studies grid */}
      <div>
        <div className="grid grid-cols-3 gap-4 2xl:grid-cols-4">
          {studies.map((study) => (
            <StudyCard key={study.id} study={study} onOpen={onOpenStudy} />
          ))}
          {/* Add study placeholder */}
          <div className="bg-[#0D0D0D] border border-dashed border-[#1E1E1E] rounded-2xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#0694FB]/50 hover:bg-[rgba(6,148,251,0.02)] transition-all duration-200 min-h-[200px]">
            <div className="w-10 h-10 rounded-xl bg-[#111] border border-[#1E1E1E] flex items-center justify-center">
              <span className="text-[#3a3a3a] text-xl leading-none">+</span>
            </div>
            <p className="text-[#3a3a3a] text-[12px] m-0 text-center">Add New Study</p>
          </div>
        </div>
      </div>
    </div>
  );
}


export default StudiesGrid;
