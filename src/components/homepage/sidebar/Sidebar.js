import { useState } from "react";
import { HiHome, HiUsers, HiCpuChip, HiCog6Tooth, HiDocumentText, HiBeaker } from "react-icons/hi2";
import { HiLogout } from "react-icons/hi";
import { FiX } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
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
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const handleLogout = () => {
    ["token", "refresh_token", "name", "role", "sub", "email"].forEach(k => localStorage.removeItem(k));
    navigate("/");
  };

  return (
    <>
      <div className="w-[230px] h-full bg-[#000000] rounded-[15px] px-3 py-6 flex flex-col gap-1 shrink-0">
        {menuItems.map((item) => (
          <div
            key={item.name}
            onClick={() => navigate(item.path)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-300 hover:translate-x-1 ${
              activePage === item.name
                ? "bg-[rgba(6,148,251,0.17)] text-[#0694FB]"
                : "bg-transparent text-[#6b6b6b] hover:bg-[rgba(6,148,251,0.17)] hover:text-[#0694FB]"
            }`}
          >
            <div className="flex items-center justify-center w-6 h-6">
              {item.icon}
            </div>
            <span className="text-[15px] font-normal">{item.name}</span>
          </div>
        ))}

        <div className="mt-auto pt-4 border-t border-[#1E1E1E]">
          <button
            onClick={() => setLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-300 hover:translate-x-1 bg-transparent text-[#6b6b6b] hover:bg-[rgba(255,59,59,0.1)] hover:text-[#FF3B3B] border-none"
          >
            <div className="flex items-center justify-center w-6 h-6">
              <HiLogout size={20} />
            </div>
            <span className="text-[15px] font-normal">Logout</span>
          </button>
        </div>
      </div>

      {/* ── Logout confirmation dialog ── */}
      <AnimatePresence>
        {logoutConfirm && (
          <motion.div
            className="fixed inset-0 z-[1000] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setLogoutConfirm(false)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[400px] bg-[#161616] border gap-5 border-[#1E1E1E] rounded-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-start justify-between px-7 pt-7">
                <div className="flex flex-row gap-2">
                
                  <h2 className="text-white text-[17px] font-medium m-0">Are you sure you want to sign out?</h2>
                </div>
                <button onClick={() => setLogoutConfirm(false)} className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1 mt-0.5">
                  <FiX size={18} />
                </button>
              </div>
              <p className="px-7 text-[#6B6B6B] text-[14px] m-0">
                You will be signed out of your account. Any unsaved changes will be lost.
              </p>
              <div className="px-7 pb-6 flex flex-row gap-2">
                <button
                  onClick={() => setLogoutConfirm(false)}
                  className="flex-1 py-2.5 rounded-full bg-transparent hover:bg-[#1E1E1E] text-[#6B6B6B] text-[13px] font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-2.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[13px] font-medium cursor-pointer transition-colors"
                >
                  Sign out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default Sidebar;
