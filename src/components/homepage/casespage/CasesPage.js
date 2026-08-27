import React, { useState, useMemo, useEffect, useCallback } from "react";
import { FiChevronLeft, FiChevronRight, FiSearch, FiAlertTriangle } from "react-icons/fi";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import NewCaseModal from "../newcase/NewCaseFlow";
import { authFetch } from "../../../lib/api";
import useDynamicPageSize from "../../../hooks/useDynamicPageSize";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1], delay: i * 0.07 },
  }),
};




const URGENCY_MAP = {
  emergency: "Emergency",
  immediate: "Immediate",
  less_urgent: "Less Urgent",
  "less urgent": "Less Urgent",
  less_urgency: "Less Urgent",
  routine: "Routine",
};

function normalizeUrgency(raw) {
  if (!raw) return "Routine";
  return URGENCY_MAP[raw.toLowerCase().replace(/-/g, "_").trim()] ?? raw;
}

const urgencyStyles = {
  Immediate: "bg-[rgba(255,107,53,0.15)] text-[#FF6B35] ",
  Emergency: " text-red-400 ",
  "Less Urgent": "text-[#A855F7]",
  Routine: "text-[#0694FB] ",
};

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const COLS = ["Patient", "Urgency", "Reason", "MRN", "Created", "Last Updated"];

function CasesPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { pageSize, tableRef } = useDynamicPageSize();

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const baseURL = process.env.REACT_APP_API_URL || "";
      const res = await authFetch(`${baseURL}/cases/?limit=100`);
      if (!res.ok) return;
      const data = await res.json();
      console.log(data)
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
    } catch (_) { }
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
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [search, filter, patients]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Reset to page 1 when filter/search/pageSize changes
  React.useEffect(() => { setPage(1); }, [search, filter, pageSize]);

  return (
    <>
    <div className="w-full h-full flex flex-col gap-5 min-h-0 overflow-y-auto pb-8 pr-1"
      style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
    >
            {/* Header */}
            <motion.div
              className="shrink-0 mb-1"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="m-0 text-white font-medium text-[40px] md:text-[32px] leading-[1.2] mt-0 mb-0">Patient Cases</h1>
                  <p className="m-0 text-[#999898] text-[13px] mt-0.5">All patient cases across your practice</p>
                </div>
                <button
                  onClick={() => setModalOpen(true)}
                  className="bg-[#0694FB] hover:bg-[#0578d1] text-white text-[13px] px-4 py-[8px] rounded-full border-none cursor-pointer transition-colors duration-200 whitespace-nowrap font-medium"
                >
                  Open New Case
                </button>
              </div>
            </motion.div>

            {/* Summary chips */}
            <motion.div
              className="flex items-center gap-3 shrink-0 mb-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05, ease: [0.32, 0.72, 0, 1] }}
            >
              {[
                { label: "Total", count: patients.length, cls: "bg-white/5 text-white/60 border-white/10" },
                { label: "Emergency", count: patients.filter(p => p.urgency === "Emergency").length, cls: "bg-red-500/10 text-red-400 border-red-500/20" },
                { label: "Immediate", count: patients.filter(p => p.urgency === "Immediate").length, cls: "bg-[rgba(255,107,53,0.1)] text-[#FF6B35] border-[rgba(255,107,53,0.2)]" },
                { label: "Less Urgent", count: patients.filter(p => p.urgency === "Less Urgent").length, cls: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
                { label: "Routine", count: patients.filter(p => p.urgency === "Routine").length, cls: "bg-[#0694FB]/10 text-[#0694FB] border-[#0694FB]/20" },
              ].map(({ label, count, cls }) => (
                <div key={label} className={`flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium ${cls}`}>
                  <span>{label}</span>
                  <span className="opacity-70">{loading ? "—" : count}</span>
                </div>
              ))}
            </motion.div>

            {/* Filters */}
            <motion.div
              className="flex items-center gap-3 shrink-0 mb-4 flex-wrap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, delay: 0.1 }}
            >
              <div className="relative flex-1 min-w-[200px] max-w-[320px]">
                <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, MRN or reason…"
                  className="w-full bg-[#0C0C0C] border border-[#1E1E1E] text-white text-[13px] rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-[#0694FB]/40 placeholder:text-[#6B6B6B]"
                />
              </div>

              <div className="relative">
                <select
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  className="appearance-none bg-[#0C0C0C] border border-[#1E1E1E] text-[13px] text-white rounded-xl pl-3 pr-7 py-2 cursor-pointer focus:outline-none focus:border-[#0694FB]/40 capitalize"
                >
                  {filters.map(o => (
                    <option key={o} value={o} style={{ background: "#111", color: "#fff" }}>
                      {o === "All" ? "All Urgency" : o}
                    </option>
                  ))}
                </select>
                <FiChevronRight size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3a3a3a] pointer-events-none rotate-90" />
              </div>

              {(search || filter !== "All") && (
                <button
                  onClick={() => { setSearch(""); setFilter("All"); }}
                  className="text-[12px] text-[#6B6B6B] hover:text-white bg-transparent border-none cursor-pointer transition-colors px-1"
                >
                  Clear filters
                </button>
              )}

              <span className="ml-auto text-[12px] text-[#3a3a3a] font-mono shrink-0">
                {loading ? "" : `${filtered.length} case${filtered.length !== 1 ? "s" : ""}`}
              </span>
            </motion.div>

            {/* Table */}
            <motion.div
              ref={tableRef}
              className="bg-[#0C0C0C] border border-[#1E1E1E] rounded-2xl overflow-hidden shrink-0"
              variants={fadeUp} initial="hidden" animate="show" custom={2}
            >
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    {COLS.map((h, i) => (
                      <th
                        key={h}
                        className={`text-[#ffffff] text-[13px] font-bold uppercase border-b bg-[#161616] p-4 border-[#111] sticky top-0 z-10 ${i === COLS.length - 1 ? "text-right" : ""
                          }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={COLS.length}>
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                          <div className="w-8 h-8 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
                          <p className="text-[#3a3a3a] text-[13px] m-0">Loading cases…</p>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={COLS.length} className="py-16 text-center text-[#6B6B6B] text-sm">
                        {patients.length === 0 ? "No cases found" : "No cases match the current filters"}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => navigate(`/cases/${p.id}`, { state: { patient: p, case_id: p.case_id } })}
                        className="group border-b border-[#111] last:border-0 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      >
                        {/* Patient */}
                        <td className="py-5 px-4 max-w-0 w-[22%]">
                          <div className="flex items-center gap-3">
                            <img
                              src={`https://api.dicebear.com/9.x/initials/jpg?seed=${encodeURIComponent(p.name)}&scale=70&backgroundColor=5876dd`}
                              alt=""
                              className="w-10 h-10 rounded-full shrink-0"
                            />
                            <span className="text-white text-[14px] block truncate">
                              {p.name || "—"}
                              {(p.age || p.gender) && (
                                <span className="ml-2 text-white/40">
                                  [{[p.age, p.gender].filter(Boolean).join("/")}]
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        {/* Urgency */}
                        <td className="py-5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 text-[14px] font-normal px-2.5 py-1 rounded-full capitalize ${urgencyStyles[p.urgency] || urgencyStyles["Routine"]}`}>
                            {p.urgency === "Emergency" && <FiAlertTriangle size={11} />}
                            {p.urgency}
                          </span>
                        </td>
                        {/* Reason */}
                        <td className="py-5 px-4 max-w-0 w-[25%]">
                          <span className="text-white text-[14px] block truncate">{p.reason || "—"}</span>
                        </td>
                        {/* MRN */}
                        <td className="py-5 px-4 whitespace-nowrap">
                          <span className="text-white text-[14px] ">{p.mrn || "—"}</span>
                        </td>
                        {/* Created */}
                        <td className="py-5 px-4 whitespace-nowrap">
                          <div className="flex flex-row gap-2 items-center">
                          
                            <span className="text-[14px] text-white">{timeAgo(p.created_at)}</span>
                          </div>
                          <span className="text-[11px] text-[#c9c8c8] block mt-0.5">{fmtDate(p.created_at)}</span>
                        </td>
                        {/* Last Updated */}
                        <td className="py-5 pr-6 text-right whitespace-nowrap px-3">
                          <div className="flex flex-row gap-2 items-center justify-end">
                       
                            <span className="text-[14px] text-white">{timeAgo(p.updated_at)}</span>
                          </div>
                          <span className="text-[11px] text-[#c9c8c8] block text-right mt-0.5">{fmtDate(p.updated_at)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

            </motion.div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-1 py-3 shrink-0">
                <p className="text-[#bdbdbd] text-[13px] m-0">
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#1E1E1E] bg-transparent text-[#bdbdbd] hover:text-white hover:border-[#2a2a2a] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                  >
                    <FiChevronLeft size={14} />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce((acc, p, i, arr) => {
                      if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((n, i) =>
                      n === "..." ? (
                        <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-[#bdbdbd] text-[12px]">…</span>
                      ) : (
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
                      )
                    )}

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

      <NewCaseModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onCreated={fetchPatients} />
    </>
  );
}

export default CasesPage;
