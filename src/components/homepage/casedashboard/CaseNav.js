import React from "react";
import { FiUser, FiFolder, FiFileText, FiClock, FiUsers, FiSettings, FiArrowLeft } from "react-icons/fi";

const navItems = [
  { id: "overview",      label: "Overview",      icon: FiUser },
  { id: "studies",       label: "Studies",       icon: FiFolder },
  { id: "reports",       label: "Reports",       icon: FiFileText },
  { id: "timeline",      label: "Timeline",      icon: FiClock },
  { id: "collaborators", label: "Collaborators", icon: FiUsers },
  { id: "settings",      label: "Settings",      icon: FiSettings },
];

function CaseNav({ active, onChange, studyCount, activeStudy, onCloseStudy }) {
  return (
    <div className="w-[56px] h-full bg-[#0A0A0A] border-r border-[#1E1E1E] flex flex-col items-center py-4 gap-1 shrink-0">
      {navItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => { if (activeStudy) onCloseStudy(); onChange(id); }}
          title={label}
          className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer border-none transition-all duration-150 ${
            active === id && !activeStudy
              ? "bg-[rgba(6,148,251,0.17)] text-[#0694FB]"
              : "bg-transparent text-[#3a3a3a] hover:text-[#6B6B6B] hover:bg-[#111]"
          }`}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}

export default CaseNav;
