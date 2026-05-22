import React, { useState } from "react";
import Appbar from "../appbar/appbar";
import Sidebar from "../sidebar/Sidebar";
import { FiChevronLeft, FiChevronRight, FiMaximize2, FiChevronDown } from "react-icons/fi";

// ─── Mock data ─────────────────────────────────────────────────────────────────
const appointments = [
  { id: 1, title: "Jane Doe: Lab results", day: 1, startHour: 8, startMin: 0, endHour: 8, endMin: 45, color: "#22C55E" },
  { id: 2, title: "Emily Johanson Surgery", day: 3, startHour: 7, startMin: 30, endHour: 8, endMin: 30, color: "#0694FB" },
  { id: 3, title: "Carlos Rodriguez", day: 3, startHour: 8, startMin: 30, endHour: 9, endMin: 0, color: "#0694FB" },
  { id: 4, title: "Sarah Patel", day: 3, startHour: 9, startMin: 15, endHour: 10, endMin: 15, color: "#0694FB" },
  { id: 5, title: "Benjamin Wong", day: 4, startHour: 7, startMin: 0, endHour: 8, endMin: 0, color: "#A855F7" },
  { id: 6, title: "Research", day: 5, startHour: 7, startMin: 0, endHour: 7, endMin: 30, color: "#F59E0B" },
  { id: 7, title: "Surgery", day: 5, startHour: 7, startMin: 45, endHour: 11, endMin: 0, color: "#EF4444" },
  { id: 8, title: "Health Research", day: 5, startHour: 10, startMin: 0, endHour: 10, endMin: 30, color: "#6B7280" },
  { id: 9, title: "Laura Smith", day: 6, startHour: 9, startMin: 30, endHour: 10, endMin: 0, color: "#22C55E" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const HOUR_HEIGHT = 64; // px per hour
const START_HOUR = 7;
const END_HOUR = 18;

function formatTime(h, m) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Appointment card ──────────────────────────────────────────────────────────
function AppointmentCard({ appt }) {
  const topPx = (appt.startHour - START_HOUR) * HOUR_HEIGHT + (appt.startMin / 60) * HOUR_HEIGHT;
  const durationH = (appt.endHour - appt.startHour) + (appt.endMin - appt.startMin) / 60;
  const heightPx = Math.max(durationH * HOUR_HEIGHT, 24);

  return (
    <div
      className="absolute left-1 right-1 rounded-lg px-2 py-1 overflow-hidden cursor-pointer hover:brightness-110 transition-all duration-150"
      style={{
        top: topPx,
        height: heightPx,
        backgroundColor: `${appt.color}22`,
        borderLeft: `3px solid ${appt.color}`,
      }}
    >
      <p className="text-white text-[11px] font-medium m-0 truncate leading-tight">{appt.title}</p>
      {heightPx > 32 && (
        <p className="text-white/50 text-[10px] m-0 mt-0.5">
          {formatTime(appt.startHour, appt.startMin)} – {formatTime(appt.endHour, appt.endMin)}
        </p>
      )}
    </div>
  );
}

// ─── Main Calendar ─────────────────────────────────────────────────────────────
function CalendarPage() {
  const [view, setView] = useState("Week");
  const [weekOffset, setWeekOffset] = useState(0);

  // Base week: Jan 13 2024
  const baseDate = new Date(2024, 0, 13);
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);

  const weekDates = DAYS.map((_, i) => {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    return d;
  });

  const monthLabel = MONTHS[weekDates[0].getMonth()];
  const yearLabel = weekDates[0].getFullYear();

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  return (
    <div className="m-0 p-0 h-screen bg-black w-screen">
      <div className="flex flex-col px-[33px] py-[28px] w-full h-screen box-border overflow-hidden">
        <Appbar />

        <div className="w-full flex flex-row gap-[30px] box-border mt-[30px] flex-1 min-h-0">
          <Sidebar activePage="Calendar" />

          {/* Calendar panel */}
          <div className="flex flex-col flex-1 bg-[#0A0A0A] border border-[#1E1E1E] rounded-2xl overflow-hidden min-w-0">

            {/* Calendar header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1E1E1E] shrink-0">
              {/* Left: availability + doctor */}
              <div className="flex items-center gap-2">
                <span className="text-[#6B6B6B] text-sm">Availability:</span>
                <button className="flex items-center gap-1.5 bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-1.5 cursor-pointer hover:border-[#2a2a2a] transition-colors">
                  <div className="w-4 h-4 rounded-full bg-[#0694FB] flex items-center justify-center text-[8px] text-white font-bold">D</div>
                  <span className="text-white text-sm">Dr. Floyd Miles</span>
                  <FiChevronDown size={13} color="#6B6B6B" />
                </button>
              </div>

              {/* Right: month nav + view toggle + expand */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => setWeekOffset((w) => w - 1)} className="text-[#6B6B6B] hover:text-white cursor-pointer bg-transparent border-none p-1 transition-colors">
                    <FiChevronLeft size={16} />
                  </button>
                  <span className="text-white text-sm font-medium w-36 text-center">{monthLabel}, {yearLabel}</span>
                  <button onClick={() => setWeekOffset((w) => w + 1)} className="text-[#6B6B6B] hover:text-white cursor-pointer bg-transparent border-none p-1 transition-colors">
                    <FiChevronRight size={16} />
                  </button>
                </div>

                {/* View toggle */}
                <div className="flex bg-[#111] border border-[#1E1E1E] rounded-lg p-0.5">
                  {["Day", "Week", "Month"].map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer border-none transition-all duration-150 ${
                        view === v ? "bg-[#0694FB] text-white" : "bg-transparent text-[#6B6B6B] hover:text-white"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>

                <button className="text-[#6B6B6B] hover:text-white cursor-pointer bg-transparent border-none p-1">
                  <FiMaximize2 size={14} />
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="flex border-b border-[#1E1E1E] shrink-0">
              {/* GMT label column */}
              <div className="w-16 shrink-0 flex items-end justify-center pb-2">
                <span className="text-[#3a3a3a] text-[10px]">GMT +2</span>
              </div>
              {weekDates.map((date, i) => {
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <div key={i} className="flex-1 text-center py-2.5 border-l border-[#1E1E1E]">
                    <p className="text-[#6B6B6B] text-[10px] m-0 uppercase tracking-wide">{date.getDate()}</p>
                    <p className={`text-sm font-medium m-0 mt-0.5 ${isToday ? "text-[#0694FB]" : "text-white"}`}>
                      {SHORT_DAYS[i]}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div className="flex flex-1 overflow-y-auto min-h-0">
              {/* Hour labels */}
              <div className="w-16 shrink-0 relative" style={{ height: totalHeight }}>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute w-full flex items-start justify-center"
                    style={{ top: (h - START_HOUR) * HOUR_HEIGHT - 7 }}
                  >
                    <span className="text-[#3a3a3a] text-[10px]">{String(h).padStart(2, "0")}:00</span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {DAYS.map((_, colIdx) => {
                const dayAppts = appointments.filter((a) => a.day === colIdx + 1);
                return (
                  <div
                    key={colIdx}
                    className="flex-1 border-l border-[#1E1E1E] relative"
                    style={{ height: totalHeight }}
                  >
                    {/* Hour grid lines */}
                    {hours.map((h) => (
                      <div
                        key={h}
                        className="absolute w-full border-t border-[#1a1a1a]"
                        style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
                      />
                    ))}
                    {/* Appointments */}
                    {dayAppts.map((appt) => (
                      <AppointmentCard key={appt.id} appt={appt} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalendarPage;
