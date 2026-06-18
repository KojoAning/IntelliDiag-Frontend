import React from "react";
import { FiArrowLeft, FiBell, FiShare2, FiFileText, FiPlusCircle } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const statusColors = {
  "In Review":      "text-[#F59E0B] bg-[rgba(245,158,11,0.12)] border-[rgba(245,158,11,0.2)]",
  "AI Flagged":     "text-[#FF6B35] bg-[rgba(255,107,53,0.12)] border-[rgba(255,107,53,0.2)]",
  "Pending Review": "text-[#0694FB] bg-[rgba(6,148,251,0.12)] border-[rgba(6,148,251,0.2)]",
  "Completed":      "text-[#22C55E] bg-[rgba(34,197,94,0.12)]  border-[rgba(34,197,94,0.2)]",
  "Draft Report":   "text-[#A855F7] bg-[rgba(168,85,247,0.12)] border-[rgba(168,85,247,0.2)]",
};

const studyModalityColors = {
  MRI:       "text-[#0694FB]",
  CT:        "text-[#F59E0B]",
  "X-Ray":   "text-[#22C55E]",
  Ultrasound:"text-[#A855F7]",
};

function Topbar({ caseInfo, activeStudy, onCloseStudy, onAddScanClick }) {
  const navigate = useNavigate();

  return (
    <div className="bg-[#0A0A0A] border-b border-[#1E1E1E] px-6 py-3 flex items-center justify-between box-border w-full shrink-0">

      {/* Left — breadcrumb + patient info */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/cases")}
          className="flex items-center gap-1.5 text-[#6B6B6B] hover:text-white text-sm cursor-pointer bg-transparent border-none transition-colors"
        >
          <FiArrowLeft size={14} />
          Cases
        </button>

        <div className="w-px h-5 bg-[#1E1E1E]" />

        {/* Patient name + meta */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#0694FB]/15 border border-[#0694FB]/20 flex items-center justify-center text-[#0694FB] text-[11px] font-semibold shrink-0">
            {caseInfo.patientName.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-white text-[14px] font-medium m-0">{caseInfo.patientName}</p>
              <span className="text-[#3a3a3a] text-[12px]">·</span>
              <p className="text-[#6B6B6B] text-[12px] m-0">{caseInfo.age} yrs, {caseInfo.gender}</p>
              <span className="text-[#3a3a3a] text-[12px]">·</span>
              <p className="text-[#3a3a3a] text-[11px] m-0">{caseInfo.caseId}</p>
            </div>
          </div>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColors[caseInfo.status] || "text-white bg-[#1a1a1a] border-[#2a2a2a]"}`}>
            {caseInfo.status}
          </span>
        </div>

        {/* Study breadcrumb */}
        {activeStudy && (
          <>
            <div className="w-px h-5 bg-[#1E1E1E]" />
            <div className="flex items-center gap-2">
              <span className={`text-[12px] font-medium ${studyModalityColors[activeStudy.modality] || "text-white"}`}>
                {activeStudy.modality}
              </span>
              <p className="text-white text-[13px] font-medium m-0">{activeStudy.name}</p>
              {/* <button
                onClick={onCloseStudy}
                className="text-[#6B6B6B] hover:text-white text-[11px] bg-[#1a1a1a] border border-[#2a2a2a] px-2 py-0.5 rounded-lg cursor-pointer transition-colors border-none"
              >
                ← Back to Case
              </button> */}
            </div>
          </>
        )}
      </div>

      {/* Right — actions + user */}
      <div className="flex items-center gap-2">
        {!activeStudy ? (
          <>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E1E1E] text-[#6B6B6B] text-[12px] bg-transparent hover:text-white hover:border-[#2a2a2a] cursor-pointer transition-all">
              <FiShare2 size={13} /> Share
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E1E1E] text-[#6B6B6B] text-[12px] bg-transparent hover:text-white hover:border-[#2a2a2a] cursor-pointer transition-all">
              <FiFileText size={13} /> Generate Summary
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0694FB] hover:bg-[#0578d1] text-white text-[12px] font-medium border-none cursor-pointer transition-colors">
              <FiPlusCircle size={13} /> Add Study
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onAddScanClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E1E1E] text-[#6B6B6B] text-[12px] bg-transparent hover:text-white hover:border-[#2a2a2a] cursor-pointer transition-all"
            >
              Run AI Analysis
            </button>
            {/* <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E1E1E] text-[#6B6B6B] text-[12px] bg-transparent hover:text-white hover:border-[#2a2a2a] cursor-pointer transition-all">
              Save Draft
            </button> */}
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0694FB] hover:bg-[#0578d1] text-white text-[12px] font-medium border-none cursor-pointer transition-colors">
              <FiFileText size={13} /> Sign Report
            </button>
          </>
        )}

        <div className="w-px h-5 bg-[#1E1E1E] mx-1" />
        <FiBell size={16} color="#6B6B6B" className="cursor-pointer hover:text-white transition-colors" />

        <div className="flex items-center gap-2 ml-1">
          <div className="w-7 h-7 rounded-full bg-[#0694FB]/20 border border-[#0694FB]/30 flex items-center justify-center text-[#0694FB] text-[10px] font-semibold">
            AS
          </div>
        </div>
      </div>
    </div>
  );
}

export default Topbar;
