import React, { useState } from "react";
import Appbar from "../appbar/appbar";
import Sidebar from "../sidebar/Sidebar";
import { FiChevronLeft, FiChevronRight, FiMaximize2, FiChevronDown } from "react-icons/fi";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DAYS_SHORT  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG   = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS      = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const HOUR_HEIGHT = 64;
const START_HOUR  = 7;
const END_HOUR    = 19;

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function formatTime(h, m) {
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

// ─── Mock appointments (absolute dates) ───────────────────────────────────────

const today = new Date();
function mockDate(dayOffset, h, m) {
  const d = new Date(today);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
}

const appointments = [
  { id: 1, title: "Jane Doe: Lab results",    start: mockDate(0,  8,  0), end: mockDate(0,  8, 45), color: "#22C55E" },
  { id: 2, title: "Emily Johanson Surgery",   start: mockDate(1,  7, 30), end: mockDate(1,  8, 30), color: "#0694FB" },
  { id: 3, title: "Carlos Rodriguez",         start: mockDate(1,  8, 30), end: mockDate(1,  9,  0), color: "#0694FB" },
  { id: 4, title: "Sarah Patel",              start: mockDate(1,  9, 15), end: mockDate(1, 10, 15), color: "#0694FB" },
  { id: 5, title: "Benjamin Wong",            start: mockDate(2,  7,  0), end: mockDate(2,  8,  0), color: "#A855F7" },
  { id: 6, title: "Research",                 start: mockDate(3,  7,  0), end: mockDate(3,  7, 30), color: "#F59E0B" },
  { id: 7, title: "Surgery",                  start: mockDate(3,  7, 45), end: mockDate(3, 11,  0), color: "#EF4444" },
  { id: 8, title: "Health Research",          start: mockDate(4, 10,  0), end: mockDate(4, 10, 30), color: "#6B7280" },
  { id: 9, title: "Laura Smith",              start: mockDate(5,  9, 30), end: mockDate(5, 10,  0), color: "#22C55E" },
];

// ─── Appointment card (time-grid) ──────────────────────────────────────────────
function AppointmentCard({ appt }) {
  const startMins = appt.start.getHours() * 60 + appt.start.getMinutes();
  const endMins   = appt.end.getHours()   * 60 + appt.end.getMinutes();
  const topPx     = (startMins - START_HOUR * 60) / 60 * HOUR_HEIGHT;
  const heightPx  = Math.max((endMins - startMins) / 60 * HOUR_HEIGHT, 24);

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
          {formatTime(appt.start.getHours(), appt.start.getMinutes())} – {formatTime(appt.end.getHours(), appt.end.getMinutes())}
        </p>
      )}
    </div>
  );
}

// ─── Time grid (shared by Day + Week) ─────────────────────────────────────────
function TimeGrid({ columns }) {
  const hours       = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  return (
    <div className="flex flex-1 overflow-y-auto min-h-0">
      {/* Hour labels */}
      <div className="w-16 shrink-0 relative" style={{ height: totalHeight }}>
        {hours.map(h => (
          <div
            key={h}
            className="absolute w-full flex items-start justify-center"
            style={{ top: (h - START_HOUR) * HOUR_HEIGHT - 7 }}
          >
            <span className="text-[#3a3a3a] text-[10px]">{String(h).padStart(2,"0")}:00</span>
          </div>
        ))}
      </div>

      {/* Day columns */}
      {columns.map(({ date, appts }, colIdx) => (
        <div
          key={colIdx}
          className="flex-1 border-l border-[#1E1E1E] relative"
          style={{ height: totalHeight }}
        >
          {hours.map(h => (
            <div key={h} className="absolute w-full border-t border-[#1a1a1a]" style={{ top: (h - START_HOUR) * HOUR_HEIGHT }} />
          ))}
          {appts.map(appt => <AppointmentCard key={appt.id} appt={appt} />)}
        </div>
      ))}
    </div>
  );
}

// ─── Week view ─────────────────────────────────────────────────────────────────
function WeekView({ monday }) {
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const columns   = weekDates.map(date => ({
    date,
    appts: appointments.filter(a => sameDay(a.start, date)),
  }));

  return (
    <>
      {/* Day headers */}
      <div className="flex border-b border-[#1E1E1E] shrink-0">
        <div className="w-16 shrink-0 flex items-end justify-center pb-2">
          <span className="text-[#3a3a3a] text-[10px]">GMT</span>
        </div>
        {weekDates.map((date, i) => {
          const isToday = sameDay(date, new Date());
          return (
            <div key={i} className="flex-1 text-center py-2.5 border-l border-[#1E1E1E]">
              <p className="text-[#6B6B6B] text-[10px] m-0 uppercase tracking-wide">{date.getDate()}</p>
              <p className={`text-sm font-medium m-0 mt-0.5 ${isToday ? "text-[#0694FB]" : "text-white"}`}>
                {DAYS_SHORT[date.getDay()]}
              </p>
            </div>
          );
        })}
      </div>
      <TimeGrid columns={columns} />
    </>
  );
}

// ─── Day view ──────────────────────────────────────────────────────────────────
function DayView({ date }) {
  const appts = appointments.filter(a => sameDay(a.start, date));
  return (
    <>
      <div className="flex border-b border-[#1E1E1E] shrink-0">
        <div className="w-16 shrink-0 flex items-end justify-center pb-2">
          <span className="text-[#3a3a3a] text-[10px]">GMT</span>
        </div>
        <div className="flex-1 text-center py-2.5 border-l border-[#1E1E1E]">
          <p className="text-[#6B6B6B] text-[10px] m-0 uppercase tracking-wide">{date.getDate()}</p>
          <p className={`text-sm font-medium m-0 mt-0.5 ${sameDay(date, new Date()) ? "text-[#0694FB]" : "text-white"}`}>
            {DAYS_LONG[date.getDay()]}
          </p>
        </div>
      </div>
      <TimeGrid columns={[{ date, appts }]} />
    </>
  );
}

// ─── Month view ────────────────────────────────────────────────────────────────
function MonthView({ date }) {
  const year  = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  // Grid starts on Monday before the 1st
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const gridStart   = addDays(firstDay, -startOffset);

  const totalCells = 42;
  const cells = Array.from({ length: totalCells }, (_, i) => addDays(gridStart, i));

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-2">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
          <p key={d} className="text-[#3a3a3a] text-[10px] text-center uppercase tracking-wide m-0 py-1">{d}</p>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cellDate, i) => {
          const inMonth  = cellDate.getMonth() === month;
          const isToday  = sameDay(cellDate, new Date());
          const dayAppts = appointments.filter(a => sameDay(a.start, cellDate));

          return (
            <div
              key={i}
              className={`rounded-xl p-2 min-h-[80px] flex flex-col gap-1 border transition-colors cursor-pointer ${
                isToday
                  ? "border-[#0694FB] bg-[rgba(6,148,251,0.06)]"
                  : "border-transparent hover:border-[#1E1E1E] hover:bg-[#0D0D0D]"
              }`}
            >
              <p className={`text-[12px] font-medium m-0 w-6 h-6 flex items-center justify-center rounded-full ${
                isToday       ? "bg-[#0694FB] text-white"
                : inMonth     ? "text-white"
                :               "text-[#2a2a2a]"
              }`}>
                {cellDate.getDate()}
              </p>
              <div className="flex flex-col gap-0.5">
                {dayAppts.slice(0, 2).map(a => (
                  <div key={a.id} className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                    <p className="text-[9px] text-white/60 m-0 truncate">{a.title}</p>
                  </div>
                ))}
                {dayAppts.length > 2 && (
                  <p className="text-[9px] text-[#3a3a3a] m-0">+{dayAppts.length - 2} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
function CalendarPage() {
  const [view, setView]     = useState("Week");
  const [offset, setOffset] = useState(0);  // weeks or days or months depending on view

  const baseToday = new Date();

  // Derive the reference date from offset + view
  let refDate;
  if (view === "Week") {
    refDate = addDays(getMondayOf(baseToday), offset * 7);
  } else if (view === "Day") {
    refDate = addDays(baseToday, offset);
  } else {
    // Month: offset in months
    refDate = new Date(baseToday.getFullYear(), baseToday.getMonth() + offset, 1);
  }

  // Header label
  let headerLabel;
  if (view === "Week") {
    const monday = refDate;
    const sunday = addDays(monday, 6);
    headerLabel = monday.getMonth() === sunday.getMonth()
      ? `${MONTHS[monday.getMonth()]} ${monday.getFullYear()}`
      : `${MONTHS[monday.getMonth()]} – ${MONTHS[sunday.getMonth()]} ${sunday.getFullYear()}`;
  } else if (view === "Day") {
    headerLabel = `${DAYS_LONG[refDate.getDay()]}, ${refDate.getDate()} ${MONTHS[refDate.getMonth()]} ${refDate.getFullYear()}`;
  } else {
    headerLabel = `${MONTHS[refDate.getMonth()]} ${refDate.getFullYear()}`;
  }

  return (
    <div className="m-0 p-0 h-screen bg-black w-screen">
      <div className="flex flex-col px-[33px] py-[28px] w-full h-screen box-border overflow-hidden">
        <Appbar />

        <div className="w-full flex flex-row gap-[30px] box-border mt-[30px] flex-1 min-h-0">
          <Sidebar activePage="Calendar" />

          <div className="flex flex-col flex-1 bg-[#0A0A0A] border border-[#1E1E1E] rounded-2xl overflow-hidden min-w-0">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1E1E1E] shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[#6B6B6B] text-sm">Availability:</span>
                <button className="flex items-center gap-1.5 bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-1.5 cursor-pointer hover:border-[#2a2a2a] transition-colors">
                  <div className="w-4 h-4 rounded-full bg-[#0694FB] flex items-center justify-center text-[8px] text-white font-bold">D</div>
                  <span className="text-white text-sm">Dr. Floyd Miles</span>
                  <FiChevronDown size={13} color="#6B6B6B" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Today button */}
                <button
                  onClick={() => setOffset(0)}
                  className="px-3 py-1.5 rounded-lg border border-[#1E1E1E] text-[#6B6B6B] text-xs bg-transparent hover:text-white hover:border-[#2a2a2a] cursor-pointer transition-colors"
                >
                  Today
                </button>

                <div className="flex items-center gap-1">
                  <button onClick={() => setOffset(o => o - 1)} className="text-[#6B6B6B] hover:text-white cursor-pointer bg-transparent border-none p-1 transition-colors">
                    <FiChevronLeft size={16} />
                  </button>
                  <span className="text-white text-sm font-medium min-w-[220px] text-center">{headerLabel}</span>
                  <button onClick={() => setOffset(o => o + 1)} className="text-[#6B6B6B] hover:text-white cursor-pointer bg-transparent border-none p-1 transition-colors">
                    <FiChevronRight size={16} />
                  </button>
                </div>

                <div className="flex bg-[#111] border border-[#1E1E1E] rounded-lg p-0.5">
                  {["Day","Week","Month"].map(v => (
                    <button
                      key={v}
                      onClick={() => { setView(v); setOffset(0); }}
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

            {/* View content */}
            {view === "Week"  && <WeekView  monday={refDate} />}
            {view === "Day"   && <DayView   date={refDate} />}
            {view === "Month" && <MonthView date={refDate} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalendarPage;
