import React, { useState } from "react";
import { FiArrowRight } from "react-icons/fi";

const MODALITIES = ["CT", "MRI",];

const PAIRS = [
  { from: "CT",  to: "MRI" },
  { from: "MRI", to: "CT"  },
  // { from: "CT",  to: "PET" },
  // { from: "PET", to: "CT"  },
];

function TranslationPanel({ onTranslate }) {
  const [selected, setSelected] = useState(null); // { from, to }
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    if (!selected || running) return;
    setRunning(true);
    await onTranslate?.(selected);
    setRunning(false);
  };

  return (
    <div className="bg-[#161616] rounded-[15px] p-[18px] box-border flex flex-col gap-4 shrink-0">
      {/* Header */}
      <div className="bg-[rgba(168,85,247,0.15)] rounded-full px-3 py-1.5 self-start">
        <p className="text-[#A855F7] text-[12px] font-medium m-0">Image Translation</p>
      </div>

      {/* Pair selector */}
      <div className="flex flex-col gap-2">
        {PAIRS.map(pair => {
          const isSelected = selected?.from === pair.from && selected?.to === pair.to;
          return (
            <button
              key={`${pair.from}-${pair.to}`}
              onClick={() => {
                const next = isSelected ? null : pair;
                setSelected(next);
                onTranslate?.(next);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-150 bg-transparent ${
                isSelected
                  ? "border-[#1E1E1E] bg-[rgba(59,130,246,0.08)]"
                  : "border-[#1E1E1E] hover:border-[#2a2a2a]"
              }`}
            >
              {/* Checkbox */}
              <span className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150 ${
                isSelected
                  ? "border-[#1E1E1E] bg-[#3B82F6]"
                  : "border-[#3a3a3a] bg-transparent"
              }`}>
                {isSelected && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className={`text-[13px] font-semibold font-mono ${isSelected ? "text-[#3B82F6]" : "text-white/70"}`}>
                {pair.from}
              </span>
              <FiArrowRight size={13} className={isSelected ? "text-[#3B82F6]" : "text-[#3a3a3a]"} />
              <span className={`text-[13px] font-semibold font-mono ${isSelected ? "text-[#3B82F6]" : "text-white/70"}`}>
                {pair.to}
              </span>
            </button>
          );
        })}
      </div>

      
    </div>
  );
}

export default TranslationPanel;
