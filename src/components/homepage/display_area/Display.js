import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiUsers, FiBriefcase, FiLayers, FiAlertTriangle,
  FiClock, FiUploadCloud, FiFileText, FiCalendar,
  FiUserPlus, FiPlusCircle, FiChevronRight,
} from "react-icons/fi";
import { getPatients, getCases, getStudies, getDicomImages, getReports } from "../../../lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
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
    <div className="flex-1 bg-[#0C0C0C] border border-[#1E1E1E] rounded-2xl p-5 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-[#3a3a3a] text-xs font-medium uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center`} style={{ background: `${color}18` }}>
          {React.cloneElement(icon, { size: 15, color })}
        </div>
      </div>
      <p className="m-0 text-white text-[28px] font-semibold leading-none">
        {loading ? <span className="text-[#2a2a2a]">—</span> : value}
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

function ActivityRow({ primary, secondary, time, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-2.5 px-0 bg-transparent border-none cursor-pointer group border-b border-[#111] last:border-0"
    >
      <div className="flex flex-col items-start gap-0.5 min-w-0">
        <span className="text-white/80 text-[13px] truncate max-w-[260px] group-hover:text-white transition-colors">{primary}</span>
        {secondary && <span className="text-[#3a3a3a] text-[11px] font-mono">{secondary}</span>}
      </div>
      <span className="text-[#3a3a3a] text-[11px] font-mono shrink-0 ml-3">{time}</span>
    </button>
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
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border cursor-pointer transition-all duration-200 ${
        primary
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
  const [stats, setStats] = useState({ patients: 0, openCases: 0, studies: 0, flagged: 0 });
  const [recentCases, setRecentCases]   = useState([]);
  const [recentStudies, setRecentStudies] = useState([]);
  const [upcomingAppts, setUpcomingAppts] = useState([]);
  const [pendingDicoms, setPendingDicoms] = useState([]);
  const [draftReports, setDraftReports]   = useState([]);

  useEffect(() => {
    Promise.allSettled([
      getPatients("?limit=500"),
      getCases("?limit=100"),
      getStudies("?limit=100"),
      getDicomImages("?status=pending&limit=10"),
      getReports("?status=draft&limit=10"),
    ]).then(([pRes, cRes, sRes, dRes, rRes]) => {
      const patients = pRes.status === "fulfilled" ? (pRes.value ?? []) : [];
      const cases    = cRes.status === "fulfilled" ? (cRes.value ?? []) : [];
      const studies  = sRes.status === "fulfilled" ? (sRes.value ?? []) : [];
      const dicoms   = dRes.status === "fulfilled" ? (dRes.value ?? []) : [];
      const reports  = rRes.status === "fulfilled" ? (rRes.value ?? []) : [];

      const openCases = cases.filter(c =>
        !["closed","completed","archived"].includes((c.status || "").toLowerCase())
      );

      setStats({
        patients:  patients.length,
        openCases: openCases.length,
        studies:   studies.length,
        flagged:   studies.filter(s => s.flagged).length,
      });

      const now = new Date();
      const sorted = [...cases].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      setRecentCases(sorted.slice(0, 8));

      const sortedStudies = [...studies].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      setRecentStudies(sortedStudies.slice(0, 4));

      setUpcomingAppts(
        cases
          .filter(c => c.appointment_datetime && new Date(c.appointment_datetime) > now)
          .sort((a, b) => new Date(a.appointment_datetime) - new Date(b.appointment_datetime))
          .slice(0, 4)
      );
      setPendingDicoms(dicoms.slice(0, 4));
      setDraftReports(reports.slice(0, 3));
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
          <p className="m-0 text-[#3a3a3a] text-sm">{todayDate}</p>
          <h1 className="m-0 text-white text-[32px] font-medium leading-tight mt-1">
            Hello, <span className="text-[#0694FB]">{name}</span>
          </h1>
          <p className="m-0 text-[#3a3a3a] text-sm mt-1">Here's what's happening today.</p>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <QuickAction
            icon={<FiUserPlus size={13} />}
            label="New Patient"
            onClick={() => navigate("/patients/new")}
          />
          <QuickAction
            icon={<FiPlusCircle size={13} />}
            label="Create Case"
            onClick={() => navigate("/new-case")}
            primary
          />
          <QuickAction
            icon={<FiUploadCloud size={13} />}
            label="Upload Study"
            onClick={() => navigate("/cases")}
          />
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="flex gap-4 shrink-0">
        <StatCard icon={<FiUsers />}         label="Total Patients"   value={stats.patients}  color="#0694FB" loading={loading} />
        <StatCard icon={<FiBriefcase />}     label="Open Cases"       value={stats.openCases} color="#F59E0B" loading={loading} />
        <StatCard icon={<FiLayers />}        label="Imaging Studies"  value={stats.studies}   color="#A855F7" loading={loading} />
        <StatCard icon={<FiAlertTriangle />} label="Flagged Studies"  value={stats.flagged}   color="#FF6B35" loading={loading} />
      </div>

      {/* ── Bottom: Activity + Pending ── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Recent Activity */}
        <div className="flex-[3] bg-[#0C0C0C] border border-[#1E1E1E] rounded-2xl p-5 flex flex-col min-h-0 overflow-hidden">
          <SectionLabel>Recent Cases</SectionLabel>
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-[#111] rounded-lg mb-2 animate-pulse" />
                ))
              : recentCases.length === 0
                ? <EmptyRow text="No cases yet" />
                : recentCases.map(c => (
                    <ActivityRow
                      key={c.id}
                      primary={c.patient?.full_name || "Unknown Patient"}
                      secondary={[c.urgency, c.reason].filter(Boolean).join(" · ")}
                      time={timeAgo(c.created_at)}
                      onClick={() => navigate("/cases")}
                    />
                  ))
            }

            {!loading && recentStudies.length > 0 && (
              <>
                <SectionLabel>Recent Studies</SectionLabel>
                {recentStudies.map(s => (
                  <ActivityRow
                    key={s.id}
                    primary={s.name || s.description || "Unnamed Study"}
                    secondary={s.modality || ""}
                    time={timeAgo(s.created_at)}
                    onClick={() => navigate("/cases")}
                  />
                ))}
              </>
            )}
          </div>

          <button
            onClick={() => navigate("/cases")}
            className="mt-3 flex items-center gap-1 text-[#0694FB] text-[12px] bg-transparent border-none cursor-pointer hover:underline p-0 self-start"
          >
            View all cases <FiChevronRight size={12} />
          </button>
        </div>

        {/* Pending Items */}
        <div className="flex-[2] bg-[#0C0C0C] border border-[#1E1E1E] rounded-2xl p-5 flex flex-col gap-4 min-h-0 overflow-y-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {/* Upcoming Appointments */}
          <div>
            <SectionLabel>Upcoming Appointments</SectionLabel>
            {loading
              ? <div className="h-8 bg-[#111] rounded-lg animate-pulse" />
              : upcomingAppts.length === 0
                ? <EmptyRow text="No upcoming appointments" />
                : upcomingAppts.map(c => (
                    <PendingRow
                      key={c.id}
                      icon={<FiCalendar size={12} color="#0694FB" />}
                      primary={c.patient?.full_name || "Unknown"}
                      secondary={fmtAppt(c.appointment_datetime)}
                      tag={c.urgency}
                      tagColor={
                        c.urgency === "Emergency" ? "text-[#FF4A4A] bg-[rgba(255,74,74,0.1)]" :
                        c.urgency === "Immediate" ? "text-[#FF6B35] bg-[rgba(255,107,53,0.1)]" :
                        "text-[#3a3a3a] bg-[#111]"
                      }
                    />
                  ))
            }
          </div>

          {/* Pending DICOM uploads */}
          <div>
            <SectionLabel>Pending Uploads</SectionLabel>
            {loading
              ? <div className="h-8 bg-[#111] rounded-lg animate-pulse" />
              : pendingDicoms.length === 0
                ? <EmptyRow text="No pending uploads" />
                : pendingDicoms.map(d => (
                    <PendingRow
                      key={d.id}
                      icon={<FiUploadCloud size={12} color="#F59E0B" />}
                      primary={d.filename || d.name || "Unknown file"}
                      secondary={d.series?.name || ""}
                      tag="pending"
                      tagColor="text-[#F59E0B] bg-[rgba(245,158,11,0.1)]"
                    />
                  ))
            }
          </div>

          {/* Draft Reports */}
          <div>
            <SectionLabel>Draft Reports</SectionLabel>
            {loading
              ? <div className="h-8 bg-[#111] rounded-lg animate-pulse" />
              : draftReports.length === 0
                ? <EmptyRow text="No draft reports" />
                : draftReports.map(r => (
                    <PendingRow
                      key={r.id}
                      icon={<FiFileText size={12} color="#A855F7" />}
                      primary={r.title || r.case?.id || "Untitled report"}
                      secondary={timeAgo(r.created_at)}
                      tag="draft"
                      tagColor="text-[#A855F7] bg-[rgba(168,85,247,0.1)]"
                    />
                  ))
            }
          </div>
        </div>

      </div>
    </div>
  );
}

export default Display;
