import React from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowRight } from "react-icons/fi";
import { motion } from "framer-motion";

const urgencyStyles = {
  Immediate:    "bg-[rgba(255,107,53,0.2)] text-[#FF6B35]",
  Emergency:    "bg-[rgba(255,59,59,0.2)] text-[#FF3B3B]",
  "Less Urgent":"bg-[rgba(147,51,234,0.2)] text-[#A855F7]",
  Routine:      "bg-[rgba(6,148,251,0.2)] text-[#0694FB]",
};

function CaseCard({ patient }) {
  const navigate = useNavigate();
  const { name, age, gender, urgency, reason, mrn, appointmentTime } = patient;

  return (
    <motion.div
      onClick={() => navigate(`/cases/${patient.id}`, { state: { patient } })}
      className="group bg-[#161616] rounded-2xl px-5 py-4 flex items-center gap-4 border border-[#1E1E1E] hover:border-[#0694FB] cursor-pointer outline-none"
      style={{ WebkitTapHighlightColor: "transparent" }}
      whileHover={{ x: 4 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
    >
      {/* Avatar — always visible */}
       <img
              src={`https://api.dicebear.com/9.x/initials/jpg?seed=${encodeURIComponent(name)}&scale=70&backgroundColor=5876dd`}
              alt="avatar"
              className="w-[45px] h-[45px] rounded-full shrink-0 mt-0.5"
            />
      {/* <div className="w-9 h-9 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center shrink-0 text-[#555] text-[12px] font-semibold">
        {name.split(" ").map(n => n[0]).join("").slice(0, 2)}
      </div>a */}

      {/* Name + demographics — always visible */}
      <div className="w-[160px] shrink-0">
        <p className="text-white font-normal text-[15px] m-0 leading-tight">{name}</p>
        <p className="text-[#6B6B6B] text-[12px] m-0 mt-0.5">{age} yrs · {gender}</p>
      </div>

      {/* Urgency — always visible */}
      <div className="w-[110px] shrink-0">
        <span className={`text-[12px] font-light px-2.5 py-1 rounded-full ${urgencyStyles[urgency] || urgencyStyles["Routine"]}`}>
          {urgency}
        </span>
      </div>

      {/* Reason — hidden on small, visible md+ */}
      <div className="hidden md:block flex-1 min-w-0">
        <p className="text-[#6B6B6B] text-[12px] m-0">Reason</p>
        <p className="text-[#CCCCCC] text-[14px] m-0 mt-0.5 truncate">{reason}</p>
      </div>

      {/* MRN — hidden on small+md, visible lg+ */}
      <div className="hidden lg:block w-[100px] shrink-0">
        <p className="text-[#6B6B6B] text-[12px] m-0">MRN #</p>
        <p className="text-[#CCCCCC] text-[14px] m-0 mt-0.5">{mrn}</p>
      </div>

      {/* Appointment — hidden on small+md+lg, visible xl+ */}
      <div className="hidden xl:block w-[100px] shrink-0">
        <p className="text-[#6B6B6B] text-[12px] m-0">Appointment</p>
        <p className="text-[#CCCCCC] text-[14px] m-0 mt-0.5">{appointmentTime}</p>
      </div>

      {/* Arrow — always visible */}
      <FiArrowRight size={15} className="shrink-0 ml-auto text-[#2a2a2a] group-hover:text-[#0694FB] transition-colors duration-200" />
    </motion.div>
  );
}

export default CaseCard;
