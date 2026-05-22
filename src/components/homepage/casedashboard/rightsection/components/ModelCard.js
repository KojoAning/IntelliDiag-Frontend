import React from "react";
import { FiX } from "react-icons/fi";

function ModelCard({ model, selected, onSelect, onRemove }) {
  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-[20px] p-2.5 border cursor-pointer transition-all duration-150 group ${
        selected
          ? "bg-[rgba(6,148,251,0.08)] border-[#0694FB] ring-1 ring-[#0694FB]/40"
          : "bg-[#242424] border-[#1a1a1a] hover:border-[#2a2a2a]"
      }`}
    >
      <div className="w-[52px] h-[44px] rounded-lg bg-black border border-[#1a1a1a] shrink-0 flex items-center justify-center">
        <div className="w-6 h-5 rounded bg-[#1a1a1a]" />
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <p className={`text-[12px] font-medium m-0 truncate transition-colors ${selected ? "text-[#0694FB]" : "text-white"}`}>
          {model.name}
        </p>
        <p className="text-[#6B6B6B] text-[10px] m-0">{model.id}</p>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full w-fit ${model.tagColor}`}>
          {model.tag}
        </span>
      </div>
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
