import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiClock, FiChevronRight, FiCheck, FiLoader, FiAlertTriangle,
} from "react-icons/fi";
import { HiUsers, HiBriefcase, HiClock, HiExclamationTriangle } from "react-icons/hi2";
import { getPatients, getCases, getStudies, getDicomImages, getReports, getRecentJobs, getModels, getUsageAnalytics } from "../../../lib/api";
import { CiStopwatch } from "react-icons/ci";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(ms) {
  if (ms <= 0) return "—";
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

function calcTAT(startStr, endStr) {
  if (!startStr || !endStr) return "—";
  const diffMs = new Date(endStr).getTime() - new Date(startStr).getTime();
  return fmtDuration(diffMs);
}

function calcTimeLeft(endStr) {
  if (!endStr) return "—";
  const diffMs = new Date(endStr).getTime() - Date.now();
  if (diffMs <= 0) return "overdue";
  return `${fmtDuration(diffMs)} left`;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function fmtAppt(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const todayDate = new Date().toLocaleDateString("en-US", {
  weekday: "long", month: "long", day: "numeric",
});


// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color, loading }) {
  return (
    <div className="flex-1 bg-[#161616] border border-[#1E1E1E] rounded-2xl p-5 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between">
        <span className="py-1  rounded-full text-[15px] font-semibold  tracking-wide" style={{ color: "#FFFFFF" }}>{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center`} >
          {React.cloneElement(icon, { size: 20, color })}
        </div>
      </div>
      <p className="m-0 text-white text-[40px] font-normal leading-none">
        {loading ? <span className="text-[#ffffff]">—</span> : value}
      </p>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-white/70 text-[13px] font-medium">{children}</span>
      <div className="flex-1 h-px bg-[#1a1a1a]" />
    </div>
  );
}

function EmptyRow({ text }) {
  return <p className="text-[#2a2a2a] text-xs font-mono py-2 m-0">{text}</p>;
}

function ActivityTable({ headers, children }) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} className={`text-[#ffffff] text-[13px] font-bold uppercase   border-b bg-[#161616] p-4 border-[#111] ${i === headers.length - 1 ? "text-right" : ""}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

const SEVERITY_STYLES = {
  high: "bg-[#32161E] text-red-400 border border-red-500/20",
  medium: "bg-[#312A17] text-amber-400 border border-amber-500/20",
  low: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
};

const STATUS_STYLES = {
  running: "bg-[#0694FB]/10 text-[#0694FB] border border-[#0694FB]/20",
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  queued: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  completed: "bg-[#192E21] text-emerald-400 border border-emerald-500/20",
  failed: "bg-[#32161E] text-red-400 border border-red-500/20",
  closed: "bg-[#1E1E1E] text-[#3a3a3a] border border-[#2a2a2a]",
  archived: "bg-[#1E1E1E] text-[#3a3a3a] border border-[#2a2a2a]",
  cancelled: "bg-[#1E1E1E] text-[#3a3a3a] border border-[#2a2a2a]",
};

const STATUS_ICONS = {
  running: <FiLoader size={11} className="animate-spin" />,
  pending: <FiClock size={11} />,
  queued: <FiClock size={11} />,
  completed: <FiCheck size={11} />,
  failed: <FiAlertTriangle size={11} />,
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

function ActivityRow({ primary, age, gender, details, modelName, modelType, modality, severity, status, tat, onClick }) {
  return (
    <tr
      onClick={onClick}
      className="group px-0 cursor-pointer border-b border-[#111] last:border-0 hover:bg-white/[0.02] transition-colors"
    >
      {/* Patient */}
      <td className="py-5 px-4 max-w-0 w-[20%]">
        <span className="text-white text-[14px] group-hover:text-white transition-colors block truncate">
          {primary}
          {(age || gender) && (
            <span className="ml-2 text-white/40">[{[age, gender].filter(Boolean).join("/")}]</span>
          )}
        </span>
        {details && <span className="text-[#3a3a3a] text-[11px] block truncate mt-0.5">{details}</span>}
      </td>

      {/* Details */}
      <td className="py-5 px-4 max-w-0 w-[22%]">
        <span className="text-white/80 text-[14px] block truncate">{details || "—"}</span>
        {modelType && <span className="text-[#3a3a3a] text-[11px] font-mono block truncate mt-0.5">{modelType}</span>}
      </td>

      {/* Model */}
      <td className="py-5 px-4 max-w-0 w-[18%]">
        {modelName
          ? <span className="text-white/80 text-[13px] block truncate">{modelName}</span>
          : <span className="text-[#2a2a2a] text-[13px]">—</span>
        }
      </td>

      {/* Modality */}
      <td className="py-5 px-4 whitespace-nowrap">
        {modality
          ? <span className="text-white/80 text-[14px] uppercase">{modality}</span>
          : <span className="text-[#2a2a2a] text-[14px]">—</span>
        }
      </td>

      {/* Severity */}
      <td className="py-5 px-4 whitespace-nowrap">
        <Badge label={severity} styleMap={SEVERITY_STYLES} />
      </td>

      {/* Status */}
      <td className="py-5 px-4 whitespace-nowrap">
        <Badge label={status} styleMap={STATUS_STYLES} />
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

function PendingRow({ icon, primary, secondary, tag, tagColor }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[#111] last:border-0">
      <div className="w-7 h-7 rounded-lg bg-[#111] border border-[#1E1E1E] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white/80 text-[12px] m-0 truncate">{primary}</p>
        {secondary && <p className="text-[#3a3a3a] text-[10px] font-mono m-0">{secondary}</p>}
      </div>
      {tag && (
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${tagColor}`}>
          {tag}
        </span>
      )}
    </div>
  );
}

function QuickAction({ icon, label, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border cursor-pointer transition-all duration-200 ${primary
        ? "bg-[#0694FB] border-[#0694FB] text-white hover:bg-[#0578d1]"
        : "bg-transparent border-[#1E1E1E] text-[#6B6B6B] hover:border-[#2a2a2a] hover:text-white"
        }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

function Display() {
  const navigate = useNavigate();
  const name = localStorage.getItem("name") || "Doctor";

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ patients: 0, openCases: 0, tat: 0, flagged: 0 });
  const [recentJobs, setRecentJobs] = useState([]);
  const [modalityFilter, setModalityFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [recentStudies, setRecentStudies] = useState([]);
  const [upcomingAppts, setUpcomingAppts] = useState([]);
  const [pendingDicoms, setPendingDicoms] = useState([]);
  const [draftReports, setDraftReports] = useState([]);
  const [models, setModels] = useState([]);
  const [modelPerf, setModelPerf] = useState([]);
  const [usageData, setUsageData] = useState([]);

  useEffect(() => {
    Promise.allSettled([
      getPatients("?limit=500"),
      getCases("?limit=100"),
      getStudies("?limit=100"),
      getDicomImages("?status=pending&limit=10"),
      getReports("?status=draft&limit=10"),
      getRecentJobs(),
      getModels(),
      getUsageAnalytics(),
    ]).then(([pRes, cRes, sRes, dRes, rRes, jRes, mRes, uRes]) => {
      const patients = pRes.status === "fulfilled" ? (pRes.value ?? []) : [];
      const cases = cRes.status === "fulfilled" ? (cRes.value ?? []) : [];
      const studies = sRes.status === "fulfilled" ? (sRes.value ?? []) : [];
      const dicoms = dRes.status === "fulfilled" ? (dRes.value ?? []) : [];
      const reports = rRes.status === "fulfilled" ? (rRes.value ?? []) : [];
      const jobs = jRes.status === "fulfilled" ? (jRes.value ?? []) : [];

      const openCases = cases.filter(c =>
        !["closed", "completed", "archived"].includes((c.status || "").toLowerCase())
      );

      const completedWithTAT = jobs.filter(j =>
        (j.status || "").toLowerCase() === "completed" && j.created_at && j.estimated_completion
      );
      const avgTatMs = completedWithTAT.length
        ? completedWithTAT.reduce((sum, j) =>
          sum + (new Date(j.estimated_completion).getTime() - new Date(j.created_at).getTime()), 0
        ) / completedWithTAT.length
        : 0;

      setStats({
        patients: patients.length,
        openCases: openCases.length,
        tat: avgTatMs > 0 ? fmtDuration(avgTatMs) : "—",
        flagged: studies.filter(s => s.flagged).length,
      });

      setRecentJobs(jobs);

      const sortedStudies = [...studies].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      setRecentStudies(sortedStudies.slice(0, 4));

      setPendingDicoms(dicoms.slice(0, 4));
      setDraftReports(reports.slice(0, 3));

      // Model performance from models + jobs
      const allModels = mRes.status === "fulfilled" ? (mRes.value ?? []) : [];
      setModels(allModels);

      const perfData = allModels.map(m => {
        const modelJobs = jobs.filter(j => j.model_id === m.id || j.model_name === (m.name || m.model_name));
        const completed = modelJobs.filter(j => (j.status || "").toLowerCase() === "completed");
        const failed = modelJobs.filter(j => (j.status || "").toLowerCase() === "failed");
        const total = modelJobs.length;
        const successRate = total > 0 ? ((completed.length / total) * 100) : null;
        const failureRate = total > 0 ? ((failed.length / total) * 100) : null;

        return {
          id: m.id,
          name: m.name || m.model_name || "Unknown",
          modality: m.modality || "",
          status: m.status || "active",
          accuracy: m.accuracy != null ? (m.accuracy * 100) : null,
          diceScore: m.dice_score != null ? (m.dice_score * 100) : null,
          auc: m.auc ?? null,
          avgInferenceTime: m.avg_inference_time ?? null,
          totalJobs: total,
          completedJobs: completed.length,
          failedJobs: failed.length,
          successRate,
          failureRate,
        };
      });
      setModelPerf(perfData);
      setUsageData(uRes.status === "fulfilled" ? (uRes.value ?? []) : []);

      setLoading(false);
    });
  }, []);

  return (
    <div className="w-full h-full flex flex-col gap-6 overflow-y-auto pb-6 pr-1"
      style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
    >

      {/* ── Top: Greeting + Quick Actions ── */}
      <div className="flex items-start justify-between shrink-0">
        <div>

          <h1 className="m-0 text-white text-[39px] font-medium leading-tight mt-1">
            Hello, <span className="text-[#0694FB]">{name}</span>
          </h1>
          <p className="m-0 text-[#a1a0a0] text-[17px] mt-1">Here's what's happening today.</p>
          <p className="m-0 text-white text-[17px">{todayDate}</p>
        </div>


      </div>

      {/* ── Stat Cards ── */}
      <div className="flex gap-4 shrink-0 mb-4">
        <StatCard icon={<HiUsers />} label="Total Patients" value={stats.patients} color="#0694FB" loading={loading} />
        <StatCard icon={<HiBriefcase />} label="Open Cases" value={stats.openCases} color="#F59E0B" loading={loading} />
        <StatCard icon={<HiClock />} label="Average TAT" value={stats.tat} color="#A855F7" loading={loading} />
        <StatCard icon={<HiExclamationTriangle />} label="Flagged Studies" value={stats.flagged} color="#FF6B35" loading={loading} />
      </div>

      {/* ── Recent Jobs ── */}
      <div className="flex flex-col gap-2 shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="m-0 text-[#FFFFFF] font-medium text-[18px]">Recent Jobs</h2>
            <p className="m-0 text-[#999999] text-[14px] mt-0">Latest AI inference jobs across all series</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Modality filter */}
            <div className="relative">
              <select
                value={modalityFilter}
                onChange={e => setModalityFilter(e.target.value)}
                className="appearance-none bg-[#0C0C0C] border border-[#1E1E1E] text-[#FFFFFF] text-[14px] rounded-lg pl-3 pr-7 py-1.5 cursor-pointer focus:outline-none"
              >
                <option style={{ background: "#111", color: "#fff" }} value="All">All Modality</option>
                <option style={{ background: "#111", color: "#fff" }} value="CT">CT</option>
                <option style={{ background: "#111", color: "#fff" }} value="MR">MR</option>
                <option style={{ background: "#111", color: "#fff" }} value="PET">PET</option>
                <option style={{ background: "#111", color: "#fff" }} value="XRAY">X-Ray</option>
                <option style={{ background: "#111", color: "#fff" }} value="US">Ultrasound</option>
              </select>
              <FiChevronRight size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#FFFFFF] pointer-events-none rotate-90" />
            </div>

            {/* Severity filter */}
            <div className="relative">
              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                className="appearance-none  bg-[#0C0C0C] border border-[#1E1E1E] text-[#FFFFFF] text-[14px] rounded-lg pl-3 pr-7 py-1.5 cursor-pointer focus:outline-none"
              >
                <option style={{ background: "#111", color: "#fff" }} value="All">All Severity</option>
                <option style={{ background: "#111", color: "#fff" }} value="high">High</option>
                <option style={{ background: "#111", color: "#fff" }} value="medium">Medium</option>
                <option style={{ background: "#111", color: "#fff" }} value="low">Low</option>
              </select>
              <FiChevronRight size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#FFFFFF] pointer-events-none rotate-90" />
            </div>

            <button
              onClick={() => navigate("/jobs")}
              className="flex items-center gap-1 text-[#0694FB] text-[12px] bg-transparent border-none cursor-pointer hover:underline p-0 ml-2"
            >
              View all <FiChevronRight size={12} />
            </button>
          </div>
        </div>
        <div className="bg-[#0C0C0C] border border-[#1E1E1E] rounded-2xl overflow-hidden">
          {loading
            ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <div className="w-8 h-8 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
                <p className="text-[#3a3a3a] text-[13px] m-0">Loading jobs…</p>
              </div>
            )
            : recentJobs.length === 0
              ? <div className="p-5"><EmptyRow text="No jobs yet" /></div>
              : (() => {
                const filtered = recentJobs.slice(0, 2).filter(j => {
                  const mod = (j.modality || "").toUpperCase();
                  const sev = (j.severity || "").toLowerCase();
                  if (modalityFilter !== "All" && mod !== modalityFilter) return false;
                  if (severityFilter !== "All" && sev !== severityFilter) return false;
                  return true;
                });
                return (
                  <ActivityTable headers={["Patient Name", "Details", "Model", "Modality", "Severity", "Status", "TAT"]}>
                    {filtered.length === 0
                      ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-[#5e5e5e] text-[14px]">
                            No jobs found for this search
                          </td>
                        </tr>
                      )
                      : filtered.map(j => (
                        <ActivityRow
                          key={j.job_id}
                          primary={j.patient_name || "Unknown"}
                          age={j.patient_age}
                          gender={j.patient_gender}
                          details={j.case_title || ""}
                          modelName={j.model_name || ""}
                          modelType={j.model_type || ""}
                          modality={j.modality || ""}
                          severity={j.severity || j.case_urgency || ""}
                          status={j.status || ""}
                          tat={(j.status || "").toLowerCase() === "completed" ? calcTAT(j.created_at, j.completed_at) : calcTimeLeft(j.estimated_completion)}
                          onClick={() => navigate("/case-workspace/viewer", { state: { study: { id: j.series_id, name: j.case_title || "Study", case_id: j.case_id }, series: { id: j.series_id, name: "Series 1" }, from_jobs: true, job_id: j.job_id ?? j.id, initial_status: j.status, model_id: j.model_id } })}
                        />
                      ))
                    }
                  </ActivityTable>
                );
              })()
          }
        </div>
      </div>

      {/* ── AI Usage Analytics Chart ── */}
      <div className="flex flex-col gap-2 shrink-0 mb-4">
        <div className="bg-[#0C0C0C] border border-[#1E1E1E] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="m-0 text-[#FFFFFF] font-medium text-[18px]">AI Usage Analytics</h2>
              <p className="m-0 text-[#999999] text-[14px] mt-0">Monthly inference volume and model activity</p>
            </div>
            <div className="flex items-center gap-5">
              <span className="flex items-center gap-1.5 text-[11px] text-[#6B6B6B]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#0694FB" }} /> Jobs
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-[#6B6B6B]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#C4F441" }} /> Studies
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-[#6B6B6B]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#A78BFA" }} /> Cases
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={usageData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradInferences" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0694FB" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#0694FB" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradStudies" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C4F441" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#C4F441" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradFlagged" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#A78BFA" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1E1E1E" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#6B6B6B", fontSize: 11 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B6B6B", fontSize: 11 }} dx={-5} />
              <Tooltip
                contentStyle={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 12, fontSize: 12 }}
                itemStyle={{ color: "#fff" }}
                labelStyle={{ color: "#6B6B6B", marginBottom: 4 }}
                cursor={{ stroke: "#2a2a2a" }}
              />
              <Area type="monotone" dataKey="jobs" stroke="#0694FB" strokeWidth={2.5} fill="url(#gradInferences)" dot={false} />
              <Area type="monotone" dataKey="studies" stroke="#C4F441" strokeWidth={2.5} fill="url(#gradStudies)" dot={false} />
              <Area type="monotone" dataKey="cases" stroke="#A78BFA" strokeWidth={2.5} fill="url(#gradFlagged)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Model Performance Overview ── */}
      

      {/* ── Recent Studies ── */}
      {/* {!loading && recentStudies.length > 0 && (
        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="m-0 text-white font-medium text-[16px]">Recent Studies</h2>
              <p className="m-0 text-[#3a3a3a] text-[11px] mt-0.5">Imaging studies uploaded across all cases</p>
            </div>
            <button
              onClick={() => navigate("/cases")}
              className="flex items-center gap-1 text-[#0694FB] text-[12px] bg-transparent border-none cursor-pointer hover:underline p-0"
            >
              View all <FiChevronRight size={12} />
            </button>
          </div>
          <div className="bg-[#0C0C0C] border border-[#1E1E1E] rounded-2xl overflow-hidden">
            <ActivityTable headers={["Study", "Modality", "Time"]}>
              {recentStudies.map(s => (
                <ActivityRow
                  key={s.id}
                  primary={s.name || s.description || "Unnamed Study"}
                  secondary={s.modality || ""}
                  time={timeAgo(s.created_at)}
                  onClick={() => navigate("/cases")}
                />
              ))}
            </ActivityTable>
          </div>
        </div>
      )} */}
    </div>
  );
}

export default Display;
