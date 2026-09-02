import React from "react";
import { FiX } from "react-icons/fi";

const TYPE_COLORS = {
  Detection:      "text-[#FF6B35] ",
  Segmentation:   "text-[#A3F755E1] ",
  Classification: "text-[#06FBBE] ",
  Quantification: "text-[#22C55E]",
};

function ModelCard({ model, selected, onSelect, onRemove }) {
  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-[20px] p-2.5  cursor-pointer transition-all duration-150 group ${
        selected
          ? "bg-[rgba(6,148,251,0.08)] "
          : "bg-[#242424] border-[#1a1a1a] hover:border-[#2a2a2a]"
      }`}
    >
      <div className="w-[52px] h-[44px] rounded-lg bg-black border border-[#1a1a1a] shrink-0 flex items-center justify-center">
        <div className="w-6 h-5 rounded bg-[#1a1a1a]" />
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <p className={`text-[13px] font-medium m-0 truncate transition-colors ${selected ? "text-[#0694FB]" : "text-white"}`}>
          {model.name}
        </p>

        <span className={`text-[11px] font-medium  ${TYPE_COLORS[model.tag] ?? "text-white/70 bg-transparent"}`}>
          {model.tag}
        </span>
      </div>
      {/* Radio selector */}
      <span className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${
        selected ? "border-[#0694FB] bg-[#0694FB]" : "border-[#3a3a3a] bg-transparent"
      }`}>
        {selected && (
          <svg width="8" height="6" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onRemove(); }}
        title="Remove model"
        className="w-6 h-6 flex items-center justify-center rounded-lg text-[#636363] hover:text-[#FF4A4A] hover:bg-[rgba(255,74,74,0.1)] cursor-pointer bg-transparent border-none transition-all shrink-0"
      >
        <FiX size={13} />
      </button>
    </div>
  );
}

export default ModelCard;
