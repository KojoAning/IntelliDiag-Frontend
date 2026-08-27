import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiChevronRight, FiChevronLeft, FiAlertTriangle, FiLoader, FiCheck,
  FiClock, FiSearch, FiRefreshCw,
} from "react-icons/fi";
import { getRecentJobs } from "../../../lib/api";
import { CiStopwatch } from "react-icons/ci";
import useDynamicPageSize from "../../../hooks/useDynamicPageSize";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function calcTAT(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const ms = new Date(endStr).getTime() - new Date(startStr).getTime();
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

function calcTimeLeft(endStr) {
  if (!endStr) return null;
  const ms = new Date(endStr).getTime() - Date.now();
  if (ms <= 0) return "overdue";
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  if (hours > 0) return `${hours}h ${mins % 60}m left`;
  return `${mins}m left`;
}

// ── Style maps ────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  running:   "bg-[#0694FB]/10 text-[#0694FB] border border-[#0694FB]/20",
  pending:   "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  queued:    "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  completed: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  failed:    "bg-red-500/10 text-red-400 border border-red-500/20",
  cancelled: "bg-[#1E1E1E] text-[#3a3a3a] border border-[#2a2a2a]",
};

const SEVERITY_STYLES = {
  high:   "bg-[#32161E] text-red-400 border border-red-500/20",
  medium: "bg-[#312A17] text-amber-400 border border-amber-500/20",
  low:    "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
};

const STATUS_ICONS = {
  running:   <FiLoader size={11} className="animate-spin" />,
  pending:   <FiClock size={11} />,
  queued:    <FiClock size={11} />,
  completed: <FiCheck size={11} />,
  failed:    <FiAlertTriangle size={11} />,
};

function Badge({ label, styleMap }) {
  if (!label) return <span className="text-[#2a2a2a] text-[11px] font-mono">—</span>;
  const key = label.toLowerCase();
  const cls = styleMap?.[key] ?? "bg-[#1E1E1E] text-[#3a3a3a] border border-[#2a2a2a]";
  const icon = STATUS_ICONS[key];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full capitalize ${cls}`}>
      {icon}
      {label}
    </span>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

const COLS = ["Patient Name", "Details", "Model", "Modality", "Severity", "Status", "TAT"];

function JobRow({ j, onClick }) {
  const status = (j.status || "").toLowerCase();
  const tat = status === "completed"
    ? calcTAT(j.created_at, j.completed_at)
    : calcTimeLeft(j.estimated_completion);

  return (
    <tr
      onClick={onClick}
      className="group border-b border-[#111] last:border-0 hover:bg-white/[0.02] cursor-pointer transition-colors"
    >
      {/* Patient */}
      <td className="py-5 px-4 max-w-0 w-[20%]">
        <span className="text-white text-[14px] block truncate">
          {j.patient_name || "Unknown"}
          {(j.patient_age || j.patient_gender) && (
            <span className="ml-2 text-white/40">
              [{[j.patient_age, j.patient_gender].filter(Boolean).join("/")}]
            </span>
          )}
        </span>
        {j.case_title && (
          <span className="text-[#3a3a3a] text-[11px] block truncate mt-0.5">{j.case_title}</span>
        )}
      </td>
      {/* Details */}
      <td className="py-5 px-4 max-w-0 w-[22%]">
        <span className="text-white/80 text-[14px] block truncate">{j.case_title || "—"}</span>
        {j.model_type && (
          <span className="text-[#3a3a3a] text-[11px] font-mono block truncate mt-0.5">{j.model_type}</span>
        )}
      </td>
      {/* Model */}
      <td className="py-5 px-4 max-w-0 w-[18%]">
        {j.model_name
          ? <span className="text-white/80 text-[14px] block truncate">{j.model_name}</span>
          : <span className="text-[#2a2a2a] text-[14px]">—</span>
        }
      </td>
      {/* Modality */}
      <td className="py-5 px-4 whitespace-nowrap">
        {j.modality
          ? <span className="text-white/80 text-[14px] uppercase">{j.modality}</span>
          : <span className="text-[#2a2a2a] text-[14px]">—</span>
        }
      </td>
      {/* Severity */}
      <td className="py-5 px-4 whitespace-nowrap">
        <Badge label={j.severity || j.case_urgency} styleMap={SEVERITY_STYLES} />
      </td>
      {/* Status */}
      <td className="py-5 px-4 whitespace-nowrap">
        <Badge label={j.status} styleMap={STATUS_STYLES} />
      </td>
      {/* TAT */}
      <td className="py-5 pr-6 text-right whitespace-nowrap px-3">
        <span className={`text-[14px] ${tat === "overdue" ? "text-red-400" : "text-white"}`}>
          <div className="flex flex-row gap-2 items-center justify-end">
            <CiStopwatch size={20} />
            {tat ? (status === "completed" ? `Done (${tat})` : `${tat} remaining`) : "—"}
          </div>
        </span>
      </td>
    </tr>
  );
}

// ── Loading spinner row ───────────────────────────────────────────────────────

function LoadingRow() {
  return (
    <tr>
      <td colSpan={COLS.length}>
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#3a3a3a] text-[13px] m-0">Loading jobs…</p>
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const MODALITIES = ["All", "CT", "MRI", "PET", "XRAY", "US"];
const STATUSES   = ["All", "running", "pending", "queued", "completed", "failed", "cancelled"];
const SEVERITIES = ["All", "high", "medium", "low"];

export default function JobsPage() {
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [modality, setModality] = useState("All");
  const [status, setStatus] = useState("All");
  const [severity, setSeverity] = useState("All");
  const [page, setPage] = useState(1);
  const { pageSize, tableRef } = useDynamicPageSize();

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await getRecentJobs();
      setJobs(Array.isArray(data) ? data : []);
    } catch { /* silently ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = jobs.filter(j => {
    if (modality !== "All" && (j.modality || "").toUpperCase() !== modality) return false;
    if (status !== "All" && (j.status || "").toLowerCase() !== status) return false;
    if (severity !== "All") {
      const sev = (j.severity || j.case_urgency || "").toLowerCase();
      if (sev !== severity) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const hay = [j.patient_name, j.case_title, j.model_name, j.modality].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => { setPage(1); }, [search, modality, status, severity, pageSize]);

  const counts = {
    running:   jobs.filter(j => (j.status || "").toLowerCase() === "running").length,
    pending:   jobs.filter(j => ["pending", "queued"].includes((j.status || "").toLowerCase())).length,
    completed: jobs.filter(j => (j.status || "").toLowerCase() === "completed").length,
    failed:    jobs.filter(j => (j.status || "").toLowerCase() === "failed").length,
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-y-auto pb-8 pr-1"
      style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
    >
      {/* Header */}
      <motion.div
        className="shrink-0 mb-6"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="m-0 text-white font-medium text-[40px] md:text-[32px] leading-[1.2] mt-0 mb-0">Inference Jobs</h1>
            <p className="m-0 text-[#999898] text-[13px] mt-0.5">All AI inference jobs across every series</p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-transparent  text-[#f3f3f3] hover:text-white hover:border-[#2a2a2a] text-[13px] cursor-pointer transition-all disabled:opacity-50"
          >
            <FiRefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Summary chips */}
      <motion.div
        className="flex items-center gap-3 shrink-0 mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease: [0.32, 0.72, 0, 1] }}
      >
        {[
          { label: "Running",   count: counts.running,   cls: "bg-[#0694FB]/10 text-[#0694FB] border-[#0694FB]/20" },
          { label: "Pending",   count: counts.pending,   cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
          { label: "Completed", count: counts.completed, cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
          { label: "Failed",    count: counts.failed,    cls: "bg-red-500/10 text-red-400 border-red-500/20" },
        ].map(({ label, count, cls }) => (
          <div key={label} className={`flex items-center gap-2 px-3 py-1.5  text-[12px] font-medium ${cls}`}>
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
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patient, case, model…"
            className="w-full bg-[#0C0C0C] border border-[#1E1E1E] text-white text-[13px] rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-[#0694FB]/40 placeholder:text-[#6B6B6B]"
          />
        </div>

        {[
          { label: "Modality", value: modality, set: setModality, opts: MODALITIES },
          { label: "Status",   value: status,   set: setStatus,   opts: STATUSES },
          { label: "Severity", value: severity, set: setSeverity, opts: SEVERITIES },
        ].map(({ label, value, set, opts }) => (
          <div key={label} className="relative">
            <select
              value={value}
              onChange={e => set(e.target.value)}
              className="appearance-none bg-[#0C0C0C] border border-[#1E1E1E] text-[13px] text-white rounded-xl pl-3 pr-7 py-2 cursor-pointer focus:outline-none focus:border-[#0694FB]/40 capitalize"
            >
              {opts.map(o => (
                <option key={o} value={o} style={{ background: "#111", color: "#fff" }}>
                  {o === "All" ? `All ${label}` : o.charAt(0).toUpperCase() + o.slice(1)}
                </option>
              ))}
            </select>
            <FiChevronRight size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3a3a3a] pointer-events-none rotate-90" />
          </div>
        ))}

        {(search || modality !== "All" || status !== "All" || severity !== "All") && (
          <button
            onClick={() => { setSearch(""); setModality("All"); setStatus("All"); setSeverity("All"); }}
            className="text-[12px] text-[#6B6B6B] hover:text-white bg-transparent border-none cursor-pointer transition-colors px-1"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-[12px] text-[#3a3a3a] font-mono shrink-0">
          {loading ? "" : `${filtered.length} job${filtered.length !== 1 ? "s" : ""}`}
        </span>
      </motion.div>

      {/* Table */}
      <motion.div
        ref={tableRef}
        className="bg-[#0C0C0C] border border-[#1E1E1E] rounded-2xl overflow-hidden shrink-0"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.12 }}
      >
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {COLS.map((h, i) => (
                <th key={h} className={`text-[#ffffff] text-[13px] font-bold uppercase border-b bg-[#161616] p-4 border-[#111] ${i === COLS.length - 1 ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRow />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="py-16 text-center text-[#6B6B6B] text-sm ">
                  {jobs.length === 0 ? "No jobs found" : "No jobs match the current filters"}
                </td>
              </tr>
            ) : (
              paginated.map(j => (
                <JobRow
                  key={j.job_id ?? j.id}
                  j={j}
                  onClick={() => {
                    if (j.series_id) {
                      navigate("/case-workspace/viewer", {
                        state: {
                          study: { id: j.series_id, name: j.case_title || "Study", case_id: j.case_id },
                          series: { id: j.series_id, name: "Series 1" },
                          from_jobs: true,
                          job_id: j.job_id ?? j.id,
                          initial_status: j.status,
                          model_id: j.model_id,
                        },
                      });
                    }
                  }}
                />
              ))
            )}
          </tbody>
        </table>
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 py-3 shrink-0">
          <p className="text-[#6B6B6B] text-[12px] m-0">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#1E1E1E] bg-transparent text-[#6B6B6B] hover:text-white hover:border-[#2a2a2a] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
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
                  <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-[#6B6B6B] text-[12px]">…</span>
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
  );
}
