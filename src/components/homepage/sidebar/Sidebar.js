import React from "react";
import { HiHome, HiUsers, HiCpuChip, HiCog6Tooth, HiDocumentText, HiBeaker } from "react-icons/hi2";
import { useNavigate } from "react-router-dom";

const menuItems = [
  { name: "Home",             icon: <HiHome size={20} />,         path: "/dashboard" },
  { name: "Cases",            icon: <HiUsers size={20} />,        path: "/cases" },
  { name: "Jobs",             icon: <HiCpuChip size={20} />,      path: "/jobs" },
  { name: "Models",           icon: <HiBeaker size={20} />,       path: "/models" },
  { name: "Patient Reports",  icon: <HiDocumentText size={20} />, path: "/patient-reports" },
  { name: "Settings",         icon: <HiCog6Tooth size={20} />,    path: "/settings" },
];

function Sidebar({ activePage = "Home" }) {
  const navigate = useNavigate();

  return (
    <div className="w-[200px] h-full bg-[#0C0C0C] rounded-xl px-3 py-6 box-border flex flex-col gap-1 border-r border-[#1E1E1E] shrink-0">
      <div className="px-3 pb-4 border-b border-[#1E1E1E] mb-4">
      
      </div>

      {menuItems.map((item) => (
        <div
          key={item.name}
          onClick={() => navigate(item.path)}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-300 hover:translate-x-1 ${
            activePage === item.name
              ? "bg-[rgba(6,148,251,0.17)] text-[#0694FB]"
              : "bg-transparent text-[#A0A0A0] hover:bg-[rgba(6,148,251,0.17)] hover:text-[#0694FB]"
          }`}
        >
          <div className="flex items-center justify-center w-6 h-6">
            {item.icon}
          </div>
          <span className="text-[15px] font-normal">{item.name}</span>
        </div>
      ))}

      <div className="mt-auto pt-4 px-3 border-t border-[#1E1E1E] text-[#A0A0A0] text-[13px]">
        © 2026 intelliDiag
      </div>
    </div>
  );
}

export default Sidebar;
