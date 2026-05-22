import React from "react";
import { FiRotateCcw, FiRotateCw, FiTrash2 } from "react-icons/fi";
import { CiEraser } from "react-icons/ci";

const ActionBtn = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    title={label}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#242424] border border-[#2a2a2a] text-[#AAAAAA] hover:text-white text-[11px] cursor-pointer transition-all duration-150 border-none"
  >
    {icon}
    <span>{label}</span>
  </button>
);

function SketchActions({ handleUndo, handleRedo, handleClear, handleEraser }) {
  return (
    <div className="flex items-center gap-2">
      <ActionBtn icon={<FiRotateCcw size={13} />} label="Undo"   onClick={handleUndo} />
      <ActionBtn icon={<FiRotateCw size={13} />}  label="Redo"   onClick={handleRedo} />
      <ActionBtn icon={<CiEraser size={15} />}    label="Eraser" onClick={handleEraser} />
      <ActionBtn icon={<FiTrash2 size={13} />}    label="Clear"  onClick={handleClear} />
    </div>
  );
}

export default SketchActions;
