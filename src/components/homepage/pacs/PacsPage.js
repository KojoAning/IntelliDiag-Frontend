import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FiChevronRight, FiSearch, FiX, FiPlus, FiEdit2, FiCheckCircle, FiAlertCircle, FiDownloadCloud } from "react-icons/fi";
import { HiServerStack } from "react-icons/hi2";
import {
  getPacsConnections, createPacsConnection, updatePacsConnection, deletePacsConnection, testPacsConnection,
  searchPacsStudies, getPacsStudySeries, retrievePacsStudy, getPacsRetrievals, resumePacsRetrieval, getCases,
} from "../../../lib/api";

// Search a PACS (over DICOMweb — backend routers/pacs) and copy studies from it into a
// case. Retrieved images go through the same ingest as uploads, so they show up in the
// case like any other study.

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1], delay: i * 0.07 } }),
};

const MODALITIES = ["", "CT", "MR", "CR", "DX", "MG", "US", "PT", "NM", "XA"];
const ACTIVE = new Set(["queued", "running"]);
const inputCls = "bg-[#0C0C0C] border border-[#1E1E1E] focus:border-[#0694FB]/50 rounded-xl px-3 py-2 text-white text-[13px] placeholder-[#6b6b6b] outline-none transition-colors";
const buttonCls = "flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] border cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

// 20260115 → 15 Jan 2026
function formatDicomDate(value) {
  if (!value || value.length < 8) return value || "—";
  const d = new Date(Date.UTC(+value.slice(0, 4), +value.slice(4, 6) - 1, +value.slice(6, 8)));
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function Select({ value, onChange, children, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <select value={value} onChange={e => onChange(e.target.value)} className={`${inputCls} appearance-none pr-7 w-full cursor-pointer`}>
        {children}
      </select>
      <FiChevronRight size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3a3a3a] pointer-events-none rotate-90" />
    </div>
  );
}

// ── Add / edit a connection ──────────────────────────────────────────────────

function ConnectionDialog({ connection, onClose, onSaved, onDeleted }) {
  const editing = !!connection;
  const [form, setForm] = useState({
    name: connection?.name ?? "",
    base_url: connection?.base_url ?? "",
    auth_type: connection?.auth_type ?? "none",
    username: connection?.username ?? "",
    secret: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (value) => setForm(f => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = { name: form.name, base_url: form.base_url, auth_type: form.auth_type, username: form.auth_type === "basic" ? form.username : "" };
      if (form.auth_type === "none") body.secret = editing ? "" : null;
      else if (form.secret || !editing) body.secret = form.secret || null; // editing + blank = keep the saved one
      const saved = editing ? await updatePacsConnection(connection.id, body) : await createPacsConnection(body);
      onSaved(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Remove the connection "${connection.name}"? Studies already imported stay in their cases.`)) return;
    try { await deletePacsConnection(connection.id); onDeleted(connection.id); } catch (e) { setError(e.message); }
  };

  const label = (text, hint) => (
    <span className="text-[#9a9a9a] text-[12px]">{text}{hint && <span className="text-[#5a5a5a]">{` — ${hint}`}</span>}</span>
  );
  return (
    <motion.div className="fixed inset-0 z-[1000] flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 16, opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-[460px] bg-[#161616] border border-[#1E1E1E] rounded-2xl flex flex-col gap-4 p-7"
      >
        <div className="flex items-start justify-between">
          <h2 className="text-white text-[17px] font-medium m-0">{editing ? "Edit PACS connection" : "Add a PACS connection"}</h2>
          <button onClick={onClose} className="text-[#4a4a4a] hover:text-white bg-transparent border-none cursor-pointer p-1"><FiX size={18} /></button>
        </div>
        <label className="flex flex-col gap-1.5">
          {label("Name")}
          <input className={inputCls} value={form.name} onChange={e => set("name")(e.target.value)} placeholder="e.g. Hospital PACS, Test Orthanc" autoFocus />
        </label>
        <label className="flex flex-col gap-1.5">
          {label("DICOMweb address", "the PACS's DICOMweb root")}
          <input className={inputCls} value={form.base_url} onChange={e => set("base_url")(e.target.value)} placeholder="http://localhost:8042/dicom-web" />
        </label>
        <label className="flex flex-col gap-1.5">
          {label("Sign-in")}
          <Select value={form.auth_type} onChange={set("auth_type")}>
            <option value="none">None</option>
            <option value="basic">Username and password</option>
            <option value="bearer">Access token</option>
          </Select>
        </label>
        {form.auth_type === "basic" && (
          <label className="flex flex-col gap-1.5">
            {label("Username")}
            <input className={inputCls} value={form.username} onChange={e => set("username")(e.target.value)} autoComplete="off" />
          </label>
        )}
        {form.auth_type !== "none" && (
          <label className="flex flex-col gap-1.5">
            {label(form.auth_type === "basic" ? "Password" : "Token", editing && connection.has_secret ? "leave blank to keep the saved one" : "stored encrypted")}
            <input className={inputCls} type="password" value={form.secret} onChange={e => set("secret")(e.target.value)} autoComplete="new-password" />
          </label>
        )}
        {error && <p className="m-0 text-[12px] text-[#F87171]">{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          {editing && (
            <button onClick={remove} className={`${buttonCls} bg-transparent border-[#3a1d1d] text-[#F87171] hover:bg-[#2a1515]`}>Remove</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className={`${buttonCls} bg-transparent border-[#1E1E1E] text-[#cccccc] hover:text-white`}>Cancel</button>
          <button
            onClick={save}
            disabled={saving || !form.name.trim() || !form.base_url.trim()}
            className={`${buttonCls} bg-[#0694FB] border-[#0694FB] text-white hover:bg-[#0578d1]`}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── One study in the results: expands to its series and the import form ──────

function StudyRow({ connectionId, study, cases, onImported }) {
  const [open, setOpen] = useState(false);
  const [series, setSeries] = useState(null); // null = not loaded
  const [seriesError, setSeriesError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [caseId, setCaseId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  // The matching patient's cases first (newest first), then the rest
  const caseOptions = useMemo(() => {
    const mine = cases.filter(c => study.local_patient && String(c.patient_id) === String(study.local_patient.id));
    const others = cases.filter(c => !mine.includes(c));
    const newest = (a, b) => new Date(b.created_at) - new Date(a.created_at);
    return [...mine.sort(newest), ...others.sort(newest)];
  }, [cases, study.local_patient]);
  useEffect(() => {
    if (!caseId && study.local_patient && caseOptions[0] && String(caseOptions[0].patient_id) === String(study.local_patient.id)) {
      setCaseId(String(caseOptions[0].id));
    }
  }, [caseOptions, caseId, study.local_patient]);

  const toggle = async () => {
    setOpen(o => !o);
    if (series || open) return;
    try {
      const list = await getPacsStudySeries(connectionId, study.study_instance_uid);
      setSeries(list);
      setSelected(new Set(list.map(s => s.series_instance_uid)));
    } catch (e) {
      setSeriesError(e.message);
    }
  };
  const flip = (uid) => setSelected(prev => {
    const next = new Set(prev);
    next.has(uid) ? next.delete(uid) : next.add(uid);
    return next;
  });
  const startImport = async () => {
    setImporting(true);
    setImportError(null);
    try {
      const all = series && selected.size === series.length;
      await retrievePacsStudy(connectionId, {
        case_id: caseId,
        study_instance_uid: study.study_instance_uid,
        series_instance_uids: all ? null : [...selected],
        description: [study.patient_name, study.study_description || formatDicomDate(study.study_date)].filter(Boolean).join(" — ").slice(0, 255),
      });
      onImported();
    } catch (e) {
      setImportError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const imported = study.imported_case_ids?.length > 0;
  return (
    <div className="border-b border-[#161616] last:border-b-0">
      <button onClick={toggle} className="w-full grid grid-cols-[minmax(0,2fr)_110px_minmax(0,2fr)_90px_90px_16px] gap-3 items-center px-4 py-3 bg-transparent border-none text-left cursor-pointer hover:bg-[#111]">
        <div className="min-w-0">
          <p className="m-0 text-white text-[13px] truncate">{study.patient_name || "Unnamed patient"}</p>
          <p className="m-0 text-[#6B6B6B] text-[11px] truncate">
            {[study.patient_id && `ID ${study.patient_id}`, study.patient_sex, study.patient_birth_date && `born ${formatDicomDate(study.patient_birth_date)}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="text-[#cccccc] text-[12px]">{formatDicomDate(study.study_date)}</span>
        <div className="min-w-0 flex items-center gap-2">
          <span className="text-[#cccccc] text-[12px] truncate">{study.study_description || "—"}</span>
          {study.local_patient && <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[#0694FB]/10 text-[#0694FB]" title={`MRN matches ${study.local_patient.full_name}`}>Patient on file</span>}
          {imported && <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[#22C55E]/10 text-[#22C55E]">Imported</span>}
        </div>
        <span className="text-[#cccccc] text-[12px]">{study.modalities?.join(", ") || "—"}</span>
        <span className="text-[#6B6B6B] text-[12px]">{[study.series_count != null && `${study.series_count} ser.`, study.instance_count != null && `${study.instance_count} img`].filter(Boolean).join(" · ") || "—"}</span>
        <FiChevronRight size={13} className={`text-[#4a4a4a] transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 flex flex-col gap-3 bg-[#0A0A0A]">
          {seriesError ? <p className="m-0 text-[12px] text-[#F87171]">{seriesError}</p>
            : !series ? <div className="w-5 h-5 border-2 border-[#0694FB]/30 border-t-[#0694FB] rounded-full animate-spin" />
            : series.length === 0 ? <p className="m-0 text-[12px] text-[#6B6B6B]">The PACS lists no series for this study.</p>
            : (
              <div className="flex flex-col gap-1">
                {series.map(s => (
                  <label key={s.series_instance_uid} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-[#111] cursor-pointer">
                    <input type="checkbox" checked={selected.has(s.series_instance_uid)} onChange={() => flip(s.series_instance_uid)} className="accent-[#0694FB]" />
                    <span className="text-[#6B6B6B] text-[12px] w-8 shrink-0">{s.series_number ?? "—"}</span>
                    <span className="text-white text-[12px] flex-1 truncate">{s.series_description || "Untitled series"}</span>
                    <span className="text-[#6B6B6B] text-[12px] w-16 shrink-0">{s.modality || ""}</span>
                    <span className="text-[#6B6B6B] text-[12px] w-20 shrink-0 text-right">{s.instance_count != null ? `${s.instance_count} img` : ""}</span>
                  </label>
                ))}
              </div>
            )}

          {series?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={caseId} onChange={setCaseId} className="min-w-[260px] flex-1 max-w-[420px]">
                <option value="">Import into which case?</option>
                {caseOptions.map(c => (
                  <option key={c.id} value={c.id}>{`${c.patient?.full_name ?? "Patient"} — ${c.title}`}</option>
                ))}
              </Select>
              <button
                onClick={startImport}
                disabled={importing || !caseId || selected.size === 0}
                className={`${buttonCls} bg-[#0694FB] border-[#0694FB] text-white hover:bg-[#0578d1]`}
              >
                <FiDownloadCloud size={14} />
                {importing ? "Starting…" : `Import ${selected.size === series.length ? "study" : `${selected.size} series`}`}
              </button>
              {cases.length === 0 && <span className="text-[12px] text-[#6B6B6B]">Create a case for the patient first — studies are imported into a case.</span>}
              {imported && <span className="text-[12px] text-[#6B6B6B]">Already in a case — importing again only adds images that aren't there yet.</span>}
            </div>
          )}
          {importError && <p className="m-0 text-[12px] text-[#F87171]">{importError}</p>}
        </div>
      )}
    </div>
  );
}

// ── Imports in progress / done ───────────────────────────────────────────────

function RetrievalList({ retrievals, onChanged }) {
  const navigate = useNavigate();
  const [resuming, setResuming] = useState(null);
  const [resumeError, setResumeError] = useState(null);
  if (!retrievals.length) return null;
  const resume = async (id) => {
    setResuming(id);
    setResumeError(null);
    try { await resumePacsRetrieval(id); await onChanged(); }
    catch (e) { setResumeError(e.message); }
    finally { setResuming(null); }
  };
  return (
    <div className="bg-[#0C0C0C] border border-[#1E1E1E] rounded-2xl p-4 flex flex-col gap-3">
      <p className="m-0 text-white text-[14px] font-medium">Imports</p>
      {retrievals.map(r => {
        const pct = r.total ? Math.round(((r.done + r.failed) / r.total) * 100) : 0;
        const colour = r.status === "completed" ? "#22C55E" : r.status === "failed" ? "#F87171" : r.status === "partial" ? "#F59E0B" : "#0694FB";
        const label = {
          queued: "Waiting to start", running: `${r.done} of ${r.total || "?"} images`,
          completed: `Done — ${r.done} images`, partial: `${r.done} of ${r.total} images — ${r.failed} failed`, failed: "Failed",
        }[r.status] ?? r.status;
        return (
          <div key={r.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              {r.status === "completed" ? <FiCheckCircle size={13} style={{ color: colour }} />
                : r.status === "failed" || r.status === "partial" ? <FiAlertCircle size={13} style={{ color: colour }} />
                : <div className="w-3 h-3 border-2 border-[#0694FB]/30 border-t-[#0694FB] rounded-full animate-spin shrink-0" />}
              <span className="text-[#dddddd] text-[12px] flex-1 truncate">{r.description || r.study_instance_uid}</span>
              <span className="text-[#6B6B6B] text-[11px] shrink-0">{label}</span>
              {r.can_resume && (
                <button onClick={() => resume(r.id)} disabled={resuming === r.id} className="text-[#0694FB] hover:underline text-[11px] bg-transparent border-none cursor-pointer p-0 shrink-0 disabled:opacity-40">
                  {resuming === r.id ? "Resuming…" : "Resume"}
                </button>
              )}
              {r.patient_id && r.done > 0 && !ACTIVE.has(r.status) && (
                <button onClick={() => navigate(`/cases/${r.patient_id}`, { state: { case_id: r.case_id } })} className="text-[#0694FB] hover:underline text-[11px] bg-transparent border-none cursor-pointer p-0 shrink-0">
                  Open case
                </button>
              )}
            </div>
            {ACTIVE.has(r.status) && (
              <div className="h-1 rounded-full bg-[#1E1E1E] overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colour }} />
              </div>
            )}
            {r.error && r.status !== "completed" && <p className="m-0 text-[11px] text-[#8a8a8a] truncate" title={r.error}>{r.error}</p>}
          </div>
        );
      })}
      {resumeError && <p className="m-0 text-[11px] text-[#F87171]">{resumeError}</p>}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const EMPTY_FILTERS = { patient_name: "", patient_id: "", accession_number: "", date_from: "", date_to: "", modality: "" };

export default function PacsPage() {
  const [connections, setConnections] = useState(null); // null = loading
  const [connectionId, setConnectionId] = useState("");
  const [dialog, setDialog] = useState(null); // { connection } — null connection = add
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [studies, setStudies] = useState(null); // null = no search yet
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [cases, setCases] = useState([]);
  const [retrievals, setRetrievals] = useState([]);

  const connection = connections?.find(c => String(c.id) === String(connectionId)) ?? null;

  useEffect(() => {
    getPacsConnections()
      .then(list => { setConnections(list); if (list[0]) setConnectionId(String(list[0].id)); })
      .catch(() => setConnections([]));
    getCases().then(list => setCases(Array.isArray(list) ? list : [])).catch(() => {});
  }, []);

  // Imports: loaded once, then polled while any is still going
  const loadRetrievals = useCallback(() => getPacsRetrievals().then(setRetrievals).catch(() => {}), []);
  useEffect(() => { loadRetrievals(); }, [loadRetrievals]);
  const anyActive = retrievals.some(r => ACTIVE.has(r.status));
  const pollRef = useRef(null);
  useEffect(() => {
    if (!anyActive) return;
    pollRef.current = setInterval(loadRetrievals, 2000);
    return () => clearInterval(pollRef.current);
  }, [anyActive, loadRetrievals]);

  const search = async (e) => {
    e?.preventDefault();
    if (!connection) return;
    setSearching(true);
    setSearchError(null);
    try {
      setStudies(await searchPacsStudies(connection.id, { ...filters, limit: 100 }));
    } catch (err) {
      setSearchError(err.message);
      setStudies(null);
    } finally {
      setSearching(false);
    }
  };
  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try { setTestResult(await testPacsConnection(connection.id)); }
    catch (e) { setTestResult({ ok: false, message: e.message }); }
    finally { setTesting(false); }
  };
  const pickConnection = (id) => { setConnectionId(id); setStudies(null); setTestResult(null); setSearchError(null); };
  const setFilter = (key) => (e) => setFilters(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-y-auto pb-8 pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}>
      <motion.div className="shrink-0 mb-6" variants={fadeUp} initial="hidden" animate="show" custom={0}>
        <h1 className="m-0 text-white font-medium text-[40px] md:text-[32px] leading-[1.2]">PACS</h1>
        <p className="m-0 text-[#999898] text-[13px]">Search a PACS and bring studies into a case.</p>
      </motion.div>

      {connections === null ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-[#0694FB]/30 border-t-[#0694FB] rounded-full animate-spin" />
        </div>
      ) : connections.length === 0 ? (
        <motion.div className="flex flex-col items-center justify-center py-20 gap-3" variants={fadeUp} initial="hidden" animate="show" custom={1}>
          <HiServerStack size={34} className="text-[#2a2a2a]" />
          <p className="text-[#8a8a8a] text-[13px] m-0">No PACS connected yet.</p>
          <p className="text-[#5a5a5a] text-[12px] m-0 max-w-[420px] text-center">
            You'll need the PACS's DICOMweb address — for Orthanc it's usually http://its-host:8042/dicom-web.
          </p>
          <button onClick={() => setDialog({ connection: null })} className={`${buttonCls} bg-[#0694FB] border-[#0694FB] text-white hover:bg-[#0578d1] mt-2`}>
            <FiPlus size={14} /> Add a PACS connection
          </button>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Connection */}
          <motion.div className="flex items-center gap-2 flex-wrap" variants={fadeUp} initial="hidden" animate="show" custom={1}>
            <Select value={connectionId} onChange={pickConnection} className="min-w-[220px]">
              {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <button onClick={test} disabled={testing} className={`${buttonCls} bg-[#0C0C0C] border-[#1E1E1E] text-[#cccccc] hover:text-white`}>
              {testing ? "Testing…" : "Test connection"}
            </button>
            <button onClick={() => setDialog({ connection })} className={`${buttonCls} bg-[#0C0C0C] border-[#1E1E1E] text-[#cccccc] hover:text-white`} title="Edit this connection">
              <FiEdit2 size={13} /> Edit
            </button>
            <button onClick={() => setDialog({ connection: null })} className={`${buttonCls} bg-[#0C0C0C] border-[#1E1E1E] text-[#cccccc] hover:text-white`}>
              <FiPlus size={14} /> Add
            </button>
            <span className="text-[#5a5a5a] text-[12px] truncate">{connection?.base_url}</span>
            {testResult && (
              <span className={`flex items-center gap-1.5 text-[12px] ${testResult.ok ? "text-[#22C55E]" : "text-[#F87171]"}`}>
                {testResult.ok ? <FiCheckCircle size={13} /> : <FiAlertCircle size={13} />} {testResult.message}
              </span>
            )}
          </motion.div>

          {/* Search */}
          <motion.form onSubmit={search} className="bg-[#0C0C0C] border border-[#1E1E1E] rounded-2xl p-4 flex flex-col gap-3" variants={fadeUp} initial="hidden" animate="show" custom={2}>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
              <input className={inputCls} value={filters.patient_name} onChange={setFilter("patient_name")} placeholder="Patient name (family name first)" />
              <input className={inputCls} value={filters.patient_id} onChange={setFilter("patient_id")} placeholder="Patient ID / MRN" />
              <input className={inputCls} value={filters.accession_number} onChange={setFilter("accession_number")} placeholder="Accession number" />
              <input className={inputCls} type="date" value={filters.date_from} onChange={setFilter("date_from")} title="Study date from" />
              <input className={inputCls} type="date" value={filters.date_to} onChange={setFilter("date_to")} title="Study date to" />
              <Select value={filters.modality} onChange={v => setFilters(f => ({ ...f, modality: v }))}>
                {MODALITIES.map(m => <option key={m} value={m}>{m || "Any modality"}</option>)}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={searching} className={`${buttonCls} bg-[#0694FB] border-[#0694FB] text-white hover:bg-[#0578d1]`}>
                <FiSearch size={13} /> {searching ? "Searching…" : "Search"}
              </button>
              <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className={`${buttonCls} bg-transparent border-transparent text-[#8a8a8a] hover:text-white`}>Clear</button>
              <span className="text-[#5a5a5a] text-[12px]">Leave everything empty to list the most recent studies.</span>
            </div>
          </motion.form>

          <RetrievalList retrievals={retrievals} onChanged={loadRetrievals} />

          {/* Results */}
          {searchError && <p className="m-0 text-[13px] text-[#F87171]">{searchError}</p>}
          {studies && (
            <div className="bg-[#0C0C0C] border border-[#1E1E1E] rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[minmax(0,2fr)_110px_minmax(0,2fr)_90px_90px_16px] gap-3 px-4 py-2.5 border-b border-[#1E1E1E] text-[#6B6B6B] text-[11px] uppercase">
                <span>Patient</span><span>Date</span><span>Study</span><span>Modality</span><span>Size</span><span />
              </div>
              {studies.length === 0
                ? <p className="m-0 px-4 py-6 text-[13px] text-[#6B6B6B]">No studies match.</p>
                : studies.map(s => (
                  <StudyRow key={s.study_instance_uid} connectionId={connection.id} study={s} cases={cases} onImported={loadRetrievals} />
                ))}
              {studies.length >= 100 && <p className="m-0 px-4 py-2.5 text-[12px] text-[#6B6B6B]">Showing the first 100 — narrow the search to see others.</p>}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {dialog && (
          <ConnectionDialog
            connection={dialog.connection}
            onClose={() => setDialog(null)}
            onSaved={(saved) => {
              setConnections(list => {
                const rest = (list ?? []).filter(c => c.id !== saved.id);
                return dialog.connection ? (list ?? []).map(c => (c.id === saved.id ? saved : c)) : [...rest, saved];
              });
              pickConnection(String(saved.id));
              setDialog(null);
            }}
            onDeleted={(id) => {
              const rest = connections.filter(c => c.id !== id);
              setConnections(rest);
              pickConnection(rest[0] ? String(rest[0].id) : "");
              setDialog(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
