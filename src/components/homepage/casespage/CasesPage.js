import React, { useState, useMemo, useEffect, useCallback } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { motion } from "framer-motion";
import Appbar from "../appbar/appbar";
import Sidebar from "../sidebar/Sidebar";
import CaseCard from "./CaseCard";
import NewCaseModal from "../newcase/NewCaseFlow";
import { authFetch } from "../../../lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1], delay: i * 0.07 },
  }),
};


const urgencyOrder = { Emergency: 0, Immediate: 1, "Less Urgent": 2, Routine: 3 };

const URGENCY_MAP = {
  emergency:    "Emergency",
  immediate:    "Immediate",
  less_urgent:  "Less Urgent",
  "less urgent":"Less Urgent",
  less_urgency: "Less Urgent",
  routine:      "Routine",
};

function normalizeUrgency(raw) {
  if (!raw) return "Routine";
  return URGENCY_MAP[raw.toLowerCase().replace(/-/g, "_").trim()] ?? raw;
}

function CasesPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const PER_PAGE = 6;

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const baseURL = process.env.REACT_APP_API_URL || "";
      const res = await authFetch(`${baseURL}/cases/?limit=100`);
      if (!res.ok) return;
      const data = await res.json();
      setPatients(
        data.map((c) => {
          const dob = c.patient?.date_of_birth;
          let age = null;
          if (dob) {
            const birth = new Date(dob);
            const today = new Date();
            age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
          }
          return {
            id: c.patient?.id || c.patient_id,
            case_id: c.id,
            name: c.patient?.full_name || "",
            age,
            gender: c.patient?.gender || "",
            mrn: c.patient?.mrn || "",
            urgency: normalizeUrgency(c.urgency),
            created_at: c.patient?.created_at,
            updated_at: c.patient?.updated_at,
            reason: c.reason || "",
            appointmentTime: c.appointment_datetime
              ? new Date(c.appointment_datetime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
              : "",
          };
        })
      );
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  const date = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
  });

  const filters = ["All", "Emergency", "Immediate", "Less Urgent", "Routine"];

  const filtered = useMemo(() => patients
    .filter((p) => {
      const matchesSearch =
        (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.mrn || "").includes(search) ||
        (p.reason || "").toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "All" || p.urgency === filter;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3)),
    [search, filter, patients]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Reset to page 1 when filter/search changes
  React.useEffect(() => { setPage(1); }, [search, filter]);

  return (
    <div className="m-0 p-0 h-screen bg-black w-screen">
      <div className="flex flex-col px-[33px] py-[28px] w-full h-screen box-border overflow-y-auto">
        <Appbar />
        <div className="w-full h-screen flex flex-row gap-[30px] box-border mt-[30px]">
          <Sidebar activePage="Cases" />

          {/* Main content */}
          <div className="flex flex-col flex-1 gap-5 overflow-hidden">
            {/* Page header */}
            <motion.div
              className="flex items-center justify-between flex-wrap gap-3"
              variants={fadeUp} initial="hidden" animate="show" custom={0}
            >
              <div>

                <h1 className="m-0 text-white font-medium text-[40px] md:text-[32px] leading-[1.2] mt-1">Your Cases</h1>
                <div className="bg-[rgba(6,148,251,0.17)] inline-flex rounded-[11px] px-[9px] py-[4px] mt-1">
                  <p className="m-0 text-[13px] text-[#0694FB]"> {filtered.length} patient{filtered.length !== 1 ? "s" : ""}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Search by name, MRN or reason..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoComplete="off"
                  className="bg-[#2e2e2e] border border-[#1E1E1E] rounded-xl px-4 py-2.5 text-white text-sm outline-none w-72 placeholder-[#7c7c7c] focus:border-[#0694FB] transition-colors"
                />
                <button
                  onClick={() => setModalOpen(true)}
                  className="bg-[#0694FB] hover:bg-[#0578d1] text-white text-sm px-4 py-[8px] rounded-full border-none cursor-pointer transition-colors duration-200 whitespace-nowrap"
                >
                  Open New Case
                </button>
              </div>
            </motion.div>

            {/* Urgency filters */}
            <motion.div className="flex gap-2 flex-wrap" variants={fadeUp} initial="hidden" animate="show" custom={1}>
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-5 py-1 rounded-full text-[12px] font-medium border transition-all duration-200 cursor-pointer ${filter === f
                    ? "bg-[rgb(6,149,251)] text-white border-[#0694FB]"
                    : "bg-transparent text-[#6B6B6B] border-[#1E1E1E] hover:border-[#0694FB] hover:text-[#0694FB]"
                    }`}
                >
                  {f}
                </button>
              ))}
            </motion.div>

            {/* List */}
            <div
              className="cases-scroll overflow-y-auto pr-1 flex flex-col gap-4"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
            >
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <div className="w-8 h-8 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
                  <p className="text-[#3a3a3a] text-[13px] m-0">Loading cases…</p>
                </div>
              ) : filtered.length > 0 ? (
                <div
                  key={`${filter}-${page}`}
                  className="flex flex-col gap-2"
                  style={{ animation: "tabFadeIn 0.25s ease forwards" }}
                >
                  {paginated.map((patient) => (
                    <CaseCard key={patient.id} patient={patient} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-[#4a4a4a] text-sm">
                  No cases found
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 pb-6">
                  <p className="text-[#6B6B6B] text-[12px] m-0">
                    Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#1E1E1E] bg-transparent text-[#6B6B6B] hover:text-white hover:border-[#2a2a2a] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                    >
                      <FiChevronLeft size={14} />
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[12px] font-medium border cursor-pointer transition-all duration-150"
                        style={{
                          background: n === page ? "#0694FB" : "transparent",
                          borderColor: n === page ? "#0694FB" : "#1E1E1E",
                          color: n === page ? "white" : "#6B6B6B",
                        }}
                      >
                        {n}
                      </button>
                    ))}

                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#1E1E1E] bg-transparent text-[#6B6B6B] hover:text-white hover:border-[#2a2a2a] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                    >
                      <FiChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <style>{`
              @keyframes tabFadeIn {
                from { opacity: 0; transform: translateY(8px); }
                to   { opacity: 1; transform: translateY(0); }
              }
              .cases-scroll::-webkit-scrollbar {
                width: 4px;
              }
              .cases-scroll::-webkit-scrollbar-track {
                background: transparent;
              }
              .cases-scroll::-webkit-scrollbar-thumb {
                background: #2a2a2a;
                border-radius: 999px;
              }
              .cases-scroll::-webkit-scrollbar-thumb:hover {
                background: #3a3a3a;
              }
            `}</style>
          </div>
        </div>
      </div>

      <NewCaseModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onCreated={fetchPatients} />
    </div>
  );
}

export default CasesPage;
