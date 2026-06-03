import React, { useState, useMemo } from "react";
import Appbar from "../appbar/appbar";
import Sidebar from "../sidebar/Sidebar";
import { FiChevronLeft, FiChevronRight, FiCheck } from "react-icons/fi";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DAYS_MINI   = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS      = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const HOUR_HEIGHT = 72;
const START_HOUR  = 8;
const END_HOUR    = 17;
const WORK_DAYS   = 5;   // Mon–Fri, matching the 5-column reference layout

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

/** 14 → "2:00PM", 8 → "8:00AM" */
function formatHour(h) {
  const hour12 = h % 12 || 12;
  return `${hour12}:00${h < 12 ? "AM" : "PM"}`;
}

/** Date → "5:30PM" */
function formatClock(d) {
  const h = d.getHours();
  const m = d.getMinutes();
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")}${h < 12 ? "AM" : "PM"}`;
}

/** Date → "17/10/2021" */
function formatDMY(d) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// ─── Mock appointments (relative to the current work week) ─────────────────────

const weekMonday = getMondayOf(new Date());
function mockDate(dayOffset, h, m) {
  const d = addDays(weekMonday, dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
}

const COUGH  = "#0694FB";  // blue
const FEVER  = "#EF4444";  // red
const FOLLOW = "#22C55E";  // green
const REVIEW = "#A855F7";  // purple
const LAB    = "#F59E0B";  // amber

const appointments = [
  { id: 1, name: "Bill Stracke",    reason: "Cough",  start: mockDate(0,  8,  0), end: mockDate(0,  9, 30), color: FOLLOW },
  { id: 2, name: "Twila Kassulke",  reason: "Cough",  start: mockDate(0, 11,  0), end: mockDate(0, 12, 30), color: COUGH  },
  { id: 3, name: "Will Oliver",     reason: "Fever",  start: mockDate(0, 14,  0), end: mockDate(0, 16,  0), color: COUGH  },
  { id: 4, name: "Sandy Cremin",    reason: "Fever",  start: mockDate(1,  9, 30), end: mockDate(1, 11,  0), color: FEVER  },
  { id: 5, name: "Adeline Marvin",  reason: "Fever",  start: mockDate(1, 14, 30), end: mockDate(1, 16, 30), color: FEVER  },
  { id: 6, name: "Gladys Krajcik",  reason: "Cough",  start: mockDate(2,  8,  0), end: mockDate(2,  9, 30), color: REVIEW },
  { id: 7, name: "Kayleigh Hahn",   reason: "Fever",  start: mockDate(2, 12,  0), end: mockDate(2, 14, 30), color: COUGH  },
  { id: 8, name: "Abdul Stroman",   reason: "Fever",  start: mockDate(3,  9, 15), end: mockDate(3, 10, 45), color: FOLLOW },
  { id: 9, name: "Arjun Legros",    reason: "Cough",  start: mockDate(4, 11,  0), end: mockDate(4, 14,  0), color: COUGH  },
  { id: 10, name: "Dolores Hudson", reason: "Fever",  start: mockDate(4, 14, 30), end: mockDate(4, 16, 30), color: LAB    },
];

// ─── Mini month calendar (left rail) ───────────────────────────────────────────
function MiniCalendar({ selectedDate, onSelect }) {
  const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  const year  = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const firstDay    = new Date(year, month, 1);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;  // Mon-based
  const gridStart   = addDays(firstDay, -startOffset);
  const cells       = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const selectedWeekMonday = getMondayOf(selectedDate);
  const inSelectedWeek = (d) => {
    const diff = (d - selectedWeekMonday) / 86400000;
    return diff >= 0 && diff < WORK_DAYS;
  };

  const stepMonth = (n) => setViewMonth(new Date(year, month + n, 1));
  const stepYear  = (n) => setViewMonth(new Date(year + n, month, 1));

  const Stepper = ({ label, onPrev, onNext }) => (
    <div className="flex items-center gap-1.5">
      <button onClick={onPrev} className="text-[#6B6B6B] hover:text-white bg-transparent border-none cursor-pointer p-0.5 transition-colors">
        <FiChevronLeft size={14} />
      </button>
      <span className="text-white text-[13px] min-w-[34px] text-center">{label}</span>
      <button onClick={onNext} className="text-[#6B6B6B] hover:text-white bg-transparent border-none cursor-pointer p-0.5 transition-colors">
        <FiChevronRight size={14} />
      </button>
    </div>
  );

  return (
    <div className="bg-[#161616] border border-[#1E1E1E] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white text-[15px] font-medium">Date</span>
        <div className="flex items-center gap-2">
          <Stepper label={year}              onPrev={() => stepYear(-1)}  onNext={() => stepYear(1)} />
          <Stepper label={MONTHS_SHORT[month]} onPrev={() => stepMonth(-1)} onNext={() => stepMonth(1)} />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 mb-1">
        {DAYS_MINI.map(d => (
          <span key={d} className="text-[#6B6B6B] text-[11px] text-center font-medium">{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          const isCurrentMonth = d.getMonth() === month;
          const isSelected     = sameDay(d, selectedDate);
          const isToday        = sameDay(d, new Date());
          const inWeek         = inSelectedWeek(d);

          return (
            <button
              key={i}
              onClick={() => onSelect(d)}
              className={`mx-auto w-7 h-7 flex items-center justify-center text-[12px] rounded-full border-none cursor-pointer transition-colors ${
                isSelected
                  ? "bg-[#0694FB] text-white font-medium"
                  : inWeek
                    ? "bg-[rgba(6,148,251,0.14)] text-white"
                    : "bg-transparent hover:bg-[#1E1E1E]"
              } ${!isSelected && !inWeek && (isCurrentMonth ? "text-[#cfcfcf]" : "text-[#3a3a3a]")} ${
                isToday && !isSelected ? "ring-1 ring-[#0694FB]/50" : ""
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Filter panel (left rail) ───────────────────────────────────────────────────
function FilterPanel({ names, selected, onToggle, onToggleAll }) {
  const allChecked = names.length > 0 && selected.size === names.length;

  const Row = ({ checked, label, onClick, header }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-1.5 py-2.5 border-none bg-transparent cursor-pointer text-left transition-colors hover:bg-[#1a1a1a] rounded-lg"
    >
      <span className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${
        checked ? "bg-[#0694FB] border-[#0694FB]" : "border-[#2a2a2a]"
      }`}>
        {checked && <FiCheck size={11} color="white" />}
      </span>
      <span className={`truncate ${header ? "text-[#6B6B6B] text-[11px] uppercase tracking-wide" : "text-[#cfcfcf] text-[13px]"}`}>
        {label}
      </span>
    </button>
  );

  return (
    <div className="bg-[#161616] border border-[#1E1E1E] rounded-2xl p-4 flex flex-col min-h-0 flex-1">
      <span className="text-white text-[15px] font-medium mb-2">Filter</span>
      <Row header checked={allChecked} label="Name" onClick={onToggleAll} />
      <div className="h-px bg-[#1E1E1E] my-1" />
      <div className="flex flex-col overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}>
        {names.map(name => (
          <Row key={name} checked={selected.has(name)} label={name} onClick={() => onToggle(name)} />
        ))}
      </div>
    </div>
  );
}

// ─── Appointment card (time grid) ──────────────────────────────────────────────
function AppointmentCard({ appt }) {
  const startMins = appt.start.getHours() * 60 + appt.start.getMinutes();
  const endMins   = appt.end.getHours()   * 60 + appt.end.getMinutes();
  const topPx     = (startMins - START_HOUR * 60) / 60 * HOUR_HEIGHT;
  const heightPx  = Math.max((endMins - startMins) / 60 * HOUR_HEIGHT, 30);

  return (
    <div
      className="absolute left-1 right-1 rounded-lg overflow-hidden cursor-pointer hover:brightness-125 transition-all duration-150"
      style={{
        top: topPx,
        height: heightPx,
        backgroundColor: `${appt.color}1A`,
        borderTop: `3px solid ${appt.color}`,
      }}
    >
      <div className="px-2.5 py-1.5">
        <p className="text-white text-[12px] font-medium m-0 truncate leading-tight">{appt.name}</p>
        <p className="text-[#8a8a8a] text-[11px] m-0 mt-0.5 truncate">{appt.reason}</p>
        {heightPx > 64 && (
          <p className="text-[#5a5a5a] text-[10px] m-0 mt-1">{formatClock(appt.start)} – {formatClock(appt.end)}</p>
        )}
      </div>
    </div>
  );
}

// ─── Week calendar grid ─────────────────────────────────────────────────────────
function CalendarGrid({ weekDates, apptsFor }) {
  const hours       = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  const now       = new Date();
  const nowMins   = now.getHours() * 60 + now.getMinutes();
  const showNow   = weekDates.some(d => sameDay(d, now)) && nowMins >= START_HOUR * 60 && nowMins <= END_HOUR * 60;
  const nowTopPx  = (nowMins - START_HOUR * 60) / 60 * HOUR_HEIGHT;

  return (
    <div className="flex-1 overflow-auto min-h-0" style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}>
      <div className="min-w-[640px]">
        {/* Column headers */}
        <div className="flex sticky top-0 z-20 bg-[#0A0A0A] border-b border-[#1E1E1E]">
          <div className="w-[68px] shrink-0 flex items-center justify-center py-3 border-r border-[#1E1E1E]">
            <span className="text-[#6B6B6B] text-[12px] font-medium">Time</span>
          </div>
          {weekDates.map((date, i) => {
            const isToday = sameDay(date, now);
            return (
              <div key={i} className="flex-1 text-center py-3 border-r border-[#1E1E1E] last:border-r-0">
                <span className={`text-[12px] font-medium ${isToday ? "text-[#0694FB]" : "text-[#9a9a9a]"}`}>
                  {formatDMY(date)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex relative">
          {/* Hour labels */}
          <div className="w-[68px] shrink-0 relative border-r border-[#1E1E1E]" style={{ height: totalHeight }}>
            {hours.slice(0, -1).map(h => (
              <div key={h} className="absolute w-full px-2" style={{ top: (h - START_HOUR) * HOUR_HEIGHT - 7 }}>
                <span className="text-[#5a5a5a] text-[11px]">{formatHour(h)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((date, colIdx) => (
            <div
              key={colIdx}
              className="flex-1 border-r border-[#1E1E1E] last:border-r-0 relative"
              style={{ height: totalHeight }}
            >
              {hours.map(h => (
                <div key={h} className="absolute w-full border-t border-[#161616]" style={{ top: (h - START_HOUR) * HOUR_HEIGHT }} />
              ))}
              {apptsFor(date).map(appt => <AppointmentCard key={appt.id} appt={appt} />)}
            </div>
          ))}

          {/* Current-time indicator */}
          {showNow && (
            <div className="absolute left-[68px] right-0 z-10 pointer-events-none" style={{ top: nowTopPx }}>
              <div className="relative">
                <div className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-[#0694FB]" />
                <div className="h-px bg-[#0694FB] w-full" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Appointment list view ──────────────────────────────────────────────────────
function ListView({ items }) {
  const sorted = [...items].sort((a, b) => a.start - b.start);

  if (sorted.length === 0) {
    return <p className="text-[#3a3a3a] text-sm text-center py-10 m-0">No appointments match the current filters</p>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}>
      {sorted.map(a => (
        <div key={a.id} className="flex items-center gap-4 px-4 py-3 bg-[#111] border border-[#1E1E1E] rounded-xl hover:border-[#2a2a2a] transition-colors cursor-pointer">
          <div className="w-1 h-9 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
          <div className="flex-1 min-w-0">
            <p className="text-white text-[14px] font-medium m-0 truncate">{a.name}</p>
            <p className="text-[#6B6B6B] text-[12px] m-0 mt-0.5">{a.reason}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[#cfcfcf] text-[12px] m-0">{formatDMY(a.start)}</p>
            <p className="text-[#5a5a5a] text-[11px] m-0 mt-0.5">{formatClock(a.start)} – {formatClock(a.end)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tab, setTab] = useState("calendar");   // "list" | "calendar"

  const allNames = useMemo(
    () => [...new Set(appointments.map(a => a.name))].sort((a, b) => a.localeCompare(b)),
    []
  );
  const [selectedNames, setSelectedNames] = useState(() => new Set(allNames));

  const toggleName = (name) =>
    setSelectedNames(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  const toggleAll = () =>
    setSelectedNames(prev => (prev.size === allNames.length ? new Set() : new Set(allNames)));

  const weekMondaySel = getMondayOf(selectedDate);
  const weekDates     = Array.from({ length: WORK_DAYS }, (_, i) => addDays(weekMondaySel, i));

  const visibleAppts = useMemo(
    () => appointments.filter(a => selectedNames.has(a.name)),
    [selectedNames]
  );
  const apptsFor = (date) => visibleAppts.filter(a => sameDay(a.start, date));

  const weekAppts = useMemo(
    () => visibleAppts.filter(a => weekDates.some(d => sameDay(a.start, d))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleAppts, selectedDate]
  );

  return (
    <div className="m-0 p-0 h-screen bg-black w-screen">
      <div className="flex flex-col px-[33px] py-[28px] w-full h-screen box-border overflow-hidden">
        <Appbar />

        <div className="w-full flex flex-row gap-[30px] box-border mt-[30px] flex-1 min-h-0">
          <Sidebar activePage="Calendar" />

          {/* Left rail: date picker + filter */}
          <div className="w-[290px] shrink-0 flex flex-col gap-5 min-h-0">
            <MiniCalendar selectedDate={selectedDate} onSelect={setSelectedDate} />
            <FilterPanel
              names={allNames}
              selected={selectedNames}
              onToggle={toggleName}
              onToggleAll={toggleAll}
            />
          </div>

          {/* Main calendar area */}
          <div className="flex flex-col flex-1 bg-[#0A0A0A] border border-[#1E1E1E] rounded-2xl overflow-hidden min-w-0">
            {/* Tabs */}
            <div className="flex items-center gap-7 px-6 pt-4 border-b border-[#1E1E1E] shrink-0">
              {[
                { key: "list",     label: "Appointment List" },
                { key: "calendar", label: "Appointment Calendar" },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`pb-3 text-[15px] bg-transparent border-none cursor-pointer transition-colors relative ${
                    tab === t.key ? "text-[#0694FB] font-medium" : "text-[#6B6B6B] hover:text-white"
                  }`}
                >
                  {t.label}
                  {tab === t.key && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#0694FB] rounded-full" />}
                </button>
              ))}
            </div>

            {tab === "calendar"
              ? <CalendarGrid weekDates={weekDates} apptsFor={apptsFor} />
              : <ListView items={weekAppts} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalendarPage;
