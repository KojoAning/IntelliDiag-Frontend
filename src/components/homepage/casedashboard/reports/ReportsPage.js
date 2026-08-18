import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FiChevronRight, FiSearch, FiRefreshCw, FiCheck, FiEdit3,
} from "react-icons/fi";
import { HiClock } from "react-icons/hi2";
import { authFetch } from "../../../../lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
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

// ── Style maps ────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  draft:  "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  signed: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
};

const STATUS_ICONS = {
  draft:  <FiEdit3 size={11} />,
  signed: <FiCheck size={11} />,
};

const MODALITY_COLORS = {
  mri:        "text-[#0694FB]",
  ct:         "text-amber-400",
  "x-ray":    "text-emerald-400",
  ultrasound: "text-purple-400",
  pet:        "text-pink-400",
};

function StatusBadge({ status }) {
  if (!status) return <span className="text-[#2a2a2a] text-[11px] font-mono">—</span>;
  const key = status.toLowerCase();
  const cls = STATUS_STYLES[key] ?? "bg-[#1E1E1E] text-[#3a3a3a] border border-[#2a2a2a]";
  const icon = STATUS_ICONS[key];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full capitalize ${cls}`}>
      {icon}
      {status}
    </span>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

const COLS = ["Patient / Case", "Report Title", "Radiologist", "Modality", "Status", "Created"];

function ReportRow({ r }) {
  return (
    <tr className="group border-b border-[#111] last:border-0 hover:bg-white/[0.02] transition-colors">
      {/* Patient / Case */}
      <td className="py-5 px-4 max-w-0 w-[22%]">
        <span className="text-white text-[14px] block truncate">
          {r.patient_name || r.case_title || "—"}
        </span>
        {r.case_title && r.patient_name && (
          <span className="text-[#3a3a3a] text-[11px] font-mono block truncate mt-0.5">{r.case_title}</span>
        )}
      </td>
      {/* Report Title */}
      <td className="py-5 px-4 max-w-0 w-[28%]">
        <span className="text-white/80 text-[14px] block truncate">{r.title || "Untitled Report"}</span>
        {r.notes && (
          <span className="text-[#3a3a3a] text-[11px] block truncate mt-0.5">
            {r.notes.slice(0, 60)}{r.notes.length > 60 ? "…" : ""}
          </span>
        )}
      </td>
      {/* Radiologist */}
      <td className="py-5 px-4 whitespace-nowrap">
        <span className="text-white/80 text-[14px]">{r.radiologist || "—"}</span>
      </td>
      {/* Modality */}
      <td className="py-5 px-4 whitespace-nowrap">
        {r.modality ? (
          <span className={`text-[14px] font-medium uppercase ${MODALITY_COLORS[r.modality.toLowerCase()] ?? "text-white/80"}`}>
            {r.modality}
          </span>
        ) : (
          <span className="text-[#2a2a2a] text-[14px]">—</span>
        )}
      </td>
      {/* Status */}
      <td className="py-5 px-4 whitespace-nowrap">
        <StatusBadge status={r.status} />
      </td>
      {/* Created */}
      <td className="py-5 pr-6 text-right whitespace-nowrap px-3">
        <div className="flex flex-row gap-2 items-center justify-end">
          <HiClock size={14} className="text-white/30" />
          <span className="text-[12px] text-white/50">{timeAgo(r.created_at)}</span>
        </div>
        <span className="text-[11px] text-[#3a3a3a] block text-right mt-0.5">{fmtDate(r.created_at)}</span>
      </td>
    </tr>
  );
}

function LoadingRow() {
  return (
    <tr>
      <td colSpan={COLS.length}>
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#3a3a3a] text-[13px] m-0">Loading reports…</p>
        </div>
      </td>
    </tr>
  );
}

// ── Filters ───────────────────────────────────────────────────────────────────

const MODALITIES = ["All", "MRI", "CT", "X-Ray", "Ultrasound", "PET"];
const STATUSES   = ["All", "Draft", "Signed"];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [modality, setModality] = useState("All");
  const [status, setStatus] = useState("All");

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const baseURL = process.env.REACT_APP_API_URL || "";
      const res = await authFetch(`${baseURL}/reports/`);
      if (res.ok) {
        const data = await res.json();
        setReports(Array.isArray(data) ? data : []);
      }
    } catch { /* silently ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = reports.filter(r => {
    if (modality !== "All" && (r.modality || "").toLowerCase() !== modality.toLowerCase()) return false;
    if (status !== "All" && (r.status || "").toLowerCase() !== status.toLowerCase()) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [r.title, r.radiologist, r.modality, r.patient_name, r.case_title, r.notes].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    total:  reports.length,
    draft:  reports.filter(r => (r.status || "").toLowerCase() === "draft").length,
    signed: reports.filter(r => (r.status || "").toLowerCase() === "signed").length,
  };

  const hasFilters = search || modality !== "All" || status !== "All";

  return (
    <div
      className="w-full h-full flex flex-col min-h-0 overflow-y-auto pb-8 pr-1"
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
            <h1 className="m-0 text-white text-[35px] font-medium">Patient Reports</h1>
            <p className="m-0 text-[#999898] text-[13px] mt-0.5">All radiology reports across every case</p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-transparent border border-[#1E1E1E] text-[#6B6B6B] hover:text-white hover:border-[#2a2a2a] text-[13px] cursor-pointer transition-all disabled:opacity-50"
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
          { label: "Total",  count: counts.total,  cls: "bg-white/5 text-white/60 border-white/10" },
          { label: "Draft",  count: counts.draft,  cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
          { label: "Signed", count: counts.signed, cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
        ].map(({ label, count, cls }) => (
          <div key={label} className={`flex items-center gap-2 px-3 py-1.5 border text-[12px] font-medium rounded-full ${cls}`}>
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
            placeholder="Search title, radiologist, notes…"
            className="w-full bg-[#0C0C0C] border border-[#1E1E1E] text-white text-[13px] rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-[#0694FB]/40 placeholder:text-[#6B6B6B]"
          />
        </div>

        {[
          { label: "Modality", value: modality, set: setModality, opts: MODALITIES },
          { label: "Status",   value: status,   set: setStatus,   opts: STATUSES },
        ].map(({ label, value, set, opts }) => (
          <div key={label} className="relative">
            <select
              value={value}
              onChange={e => set(e.target.value)}
              className="appearance-none bg-[#0C0C0C] border border-[#1E1E1E] text-[13px] text-white rounded-xl pl-3 pr-7 py-2 cursor-pointer focus:outline-none focus:border-[#0694FB]/40"
            >
              {opts.map(o => (
                <option key={o} value={o} style={{ background: "#111", color: "#fff" }}>
                  {o === "All" ? `All ${label}` : o}
                </option>
              ))}
            </select>
            <FiChevronRight size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3a3a3a] pointer-events-none rotate-90" />
          </div>
        ))}

        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setModality("All"); setStatus("All"); }}
            className="text-[12px] text-[#6B6B6B] hover:text-white bg-transparent border-none cursor-pointer transition-colors px-1"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-[12px] text-[#3a3a3a] font-mono shrink-0">
          {loading ? "" : `${filtered.length} report${filtered.length !== 1 ? "s" : ""}`}
        </span>
      </motion.div>

      {/* Table */}
      <motion.div
        className="bg-[#0C0C0C] border border-[#1E1E1E] rounded-2xl overflow-hidden shrink-0"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.12 }}
      >
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {COLS.map((h, i) => (
                <th
                  key={h}
                  className={`text-[#ffffff] text-[13px] font-bold uppercase border-b bg-[#161616] p-4 border-[#111] ${
                    i === COLS.length - 1 ? "text-right" : ""
                  }`}
                >
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
                <td colSpan={COLS.length} className="py-16 text-center text-[#6B6B6B] text-sm">
                  {reports.length === 0 ? "No reports found" : "No reports match the current filters"}
                </td>
              </tr>
            ) : (
              filtered.map(r => <ReportRow key={r.id} r={r} />)
            )}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
