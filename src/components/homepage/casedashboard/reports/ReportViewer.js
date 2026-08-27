import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiPrinter, FiCheck, FiExternalLink, FiMonitor, FiMaximize2, FiX, FiFileText,
  FiRotateCcw, FiRotateCw, FiAlignLeft, FiAlignCenter, FiAlignRight, FiAlignJustify,
} from "react-icons/fi";
import {
  MdFormatBold, MdFormatItalic, MdFormatUnderlined, MdStrikethroughS,
  MdFormatListBulleted, MdFormatListNumbered, MdFormatClear,
} from "react-icons/md";
import { authFetch, getDocumentDownloadUrl } from "../../../../lib/api";

// ── Template loader ──────────────────────────────────────────────────────────

const LS_KEY = "intellidiag_report_template";

const DEFAULT_TEMPLATE = {
  centerInfo: {
    name: "SMART IMAGING CENTER",
    tagline: "X-Ray | CT-Scan | MRI | USG",
    address: "105-108, Smart Vision Complex, Healthcare Road, Opposite Healthcare Complex, Mumbai - 689578",
    phone: "9123456789 / 8912345678",
    email: "smartpatholab@gmail.com",
  },
  sections: [
    { id: "findings", title: "Findings", enabled: true, content: "" },
    { id: "impression", title: "Impression", enabled: true, content: "" },
    { id: "recommendation", title: "Recommendation", enabled: false, content: "" },
  ],
  showSignatureArea: true,
  showPatientInfo: true,
  signatures: [
    { id: "sig1", role: "Radiologic Technologist", name: "", image: null },
    { id: "sig2", role: "Radiologist (MD)", name: "", image: null },
    { id: "sig3", role: "Senior Radiologist (MD)", name: "", image: null },
  ],
};

function loadTemplate() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) return { ...DEFAULT_TEMPLATE, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return DEFAULT_TEMPLATE;
}

// ── Parse AI report into sections ────────────────────────────────────────────

function parseAiReport(text) {
  if (!text) return {};
  const sections = {};
  let currentKey = null;
  const lines = text.split("\n");

  for (const line of lines) {
    const headerMatch = line.match(/^\*\*([^*]+?):\*\*/);
    if (headerMatch) {
      currentKey = headerMatch[1].trim().toLowerCase();
      const rest = line.replace(/^\*\*[^*]+?:\*\*\s*/, "").trim();
      sections[currentKey] = rest ? rest + "\n" : "";
      continue;
    }
    if (currentKey) {
      sections[currentKey] += line + "\n";
    }
  }

  Object.keys(sections).forEach(k => { sections[k] = sections[k].trimEnd(); });
  return sections;
}

// ── Render markdown to React ─────────────────────────────────────────────────

function renderMarkdown(text) {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      return (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "2px 0" }}>
          <span style={{ color: "#ffffff", fontSize: 10, marginTop: 4, flexShrink: 0 }}>&#9679;</span>
          <span style={{ fontSize: 12, color: "#333", lineHeight: 1.6 }}>{renderInline(bulletMatch[1])}</span>
        </div>
      );
    }
    if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
    return (
      <p key={i} style={{ fontSize: 12, color: "#333", margin: 0, lineHeight: 1.6 }}>
        {renderInline(line)}
      </p>
    );
  });
}

function renderInline(text) {
  return text.split(/(\*\*[^*]+?\*\*|\*[^*]+?\*)/g).map((part, i) => {
    if (/^\*\*(.+)\*\*$/.test(part)) return <span key={i} style={{ fontWeight: 600, color: "#111" }}>{part.slice(2, -2)}</span>;
    if (/^\*(.+)\*$/.test(part)) return <span key={i} style={{ fontStyle: "italic", color: "#666" }}>{part.slice(1, -1)}</span>;
    return part;
  });
}

function renderInlineDark(text) {
  return text.split(/(\*\*[^*]+?\*\*|\*[^*]+?\*)/g).map((part, i) => {
    if (/^\*\*(.+)\*\*$/.test(part)) return <span key={i} style={{ fontWeight: 600, color: "#fff" }}>{part.slice(2, -2)}</span>;
    if (/^\*(.+)\*$/.test(part)) return <span key={i} style={{ fontStyle: "italic", color: "#999" }}>{part.slice(1, -1)}</span>;
    return part;
  });
}

function renderMarkdownDark(text) {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      return (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "2px 0" }}>
          <span style={{ color: "#0694FB", fontSize: 10, marginTop: 4, flexShrink: 0 }}>&#9679;</span>
          <span style={{ fontSize: 12, color: "#C0C0C0", lineHeight: 1.6 }}>{renderInlineDark(bulletMatch[1])}</span>
        </div>
      );
    }
    const headerMatch = line.match(/^\*\*([^*]+?):\*\*/);
    if (headerMatch) {
      const rest = line.replace(/^\*\*[^*]+?:\*\*\s*/, "").trim();
      return (
        <div key={i} style={{ marginTop: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: "#fff" }}>{headerMatch[1]}</span>
          {rest && <p style={{ fontSize: 14, color: "#C0C0C0", margin: "2px 0 0", lineHeight: 1.6 }}>{renderInlineDark(rest)}</p>}
        </div>
      );
    }
    if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
    return (
      <p key={i} style={{ fontSize: 12, color: "#C0C0C0", margin: 0, lineHeight: 1.6 }}>
        {renderInlineDark(line)}
      </p>
    );
  });
}

function markdownToHtml(text) {
  if (!text) return "";
  return text.split("\n").map(line => {
    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    if (bulletMatch) return `<li style="font-size:12px;color:#333;line-height:1.6;margin:2px 0">${inlineToHtml(bulletMatch[1])}</li>`;
    if (!line.trim()) return `<br/>`;
    return `<p style="font-size:12px;color:#333;margin:0;line-height:1.6">${inlineToHtml(line)}</p>`;
  }).join("");
}

function inlineToHtml(text) {
  return text
    .replace(/\*\*([^*]+?)\*\*/g, '<strong style="font-weight:600;color:#111">$1</strong>')
    .replace(/\*([^*]+?)\*/g, '<em style="font-style:italic;color:#666">$1</em>');
}

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Formatting toolbar ────────────────────────────────────────────────────────

const FONTS = ["Helvetica", "Arial", "Times New Roman", "Georgia", "Courier New", "Verdana"];
const FONT_SIZES = [
  { label: "8px", value: "1" },
  { label: "10px", value: "2" },
  { label: "12px", value: "3" },
  { label: "14px", value: "4" },
  { label: "18px", value: "5" },
  { label: "24px", value: "6" },
  { label: "36px", value: "7" },
];

function exec(cmd, value) {
  document.execCommand("styleWithCSS", false, true);
  document.execCommand(cmd, false, value ?? null);
}

function ToolbarBtn({ onClick, active, title, children }) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`flex items-center justify-center w-10 h-10 border-none cursor-pointer transition-colors text-[14px] shrink-0 ${active
        ? "bg-white/20 text-white"
        : "bg-transparent text-[#b0b0b0] hover:bg-white/10 hover:text-white"
        }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-white/10 shrink-0 mx-0.5" />;
}

function Toolbar({ activeFmt, onExec, onFontChange, onFontSizeChange, currentFont, currentSize }) {
  return (
    <div className="flex items-center gap-0.5 px-3 py-2 bg-[#161616] flex-wrap shrink-0 rounded-xl">
      <ToolbarBtn onClick={() => onExec("undo")} title="Undo (Ctrl+Z)"><FiRotateCcw size={13} /></ToolbarBtn>
      <ToolbarBtn onClick={() => onExec("redo")} title="Redo (Ctrl+Y)"><FiRotateCw size={13} /></ToolbarBtn>
      <ToolbarDivider />
      <select value={currentFont} onChange={e => onFontChange(e.target.value)} onMouseDown={e => e.stopPropagation()} className="bg-[#2a2a2a] border border-[#3a3a3a] text-[#d0d0d0] text-[12px] rounded-md px-2 py-1 outline-none cursor-pointer h-7" style={{ minWidth: 100 }}>
        {FONTS.map(f => <option key={f} value={f} style={{ background: "#222" }}>{f}</option>)}
      </select>
      <select value={currentSize} onChange={e => onFontSizeChange(e.target.value)} onMouseDown={e => e.stopPropagation()} className="bg-[#2a2a2a] border border-[#3a3a3a] text-[#d0d0d0] text-[12px] rounded-md px-2 py-1 outline-none cursor-pointer h-7 ml-1" style={{ minWidth: 60 }}>
        {FONT_SIZES.map(s => <option key={s.value} value={s.value} style={{ background: "#222" }}>{s.label}</option>)}
      </select>
      <ToolbarDivider />
      <ToolbarBtn onClick={() => onExec("bold")} active={activeFmt.bold} title="Bold (Ctrl+B)"><MdFormatBold size={16} /></ToolbarBtn>
      <ToolbarBtn onClick={() => onExec("italic")} active={activeFmt.italic} title="Italic (Ctrl+I)"><MdFormatItalic size={16} /></ToolbarBtn>
      <ToolbarBtn onClick={() => onExec("underline")} active={activeFmt.underline} title="Underline (Ctrl+U)"><MdFormatUnderlined size={16} /></ToolbarBtn>
      <ToolbarBtn onClick={() => onExec("strikeThrough")} active={activeFmt.strikeThrough} title="Strikethrough"><MdStrikethroughS size={16} /></ToolbarBtn>
      <ToolbarDivider />
      <ToolbarBtn onClick={() => onExec("insertUnorderedList")} active={activeFmt.insertUnorderedList} title="Bullet List"><MdFormatListBulleted size={16} /></ToolbarBtn>
      <ToolbarBtn onClick={() => onExec("insertOrderedList")} active={activeFmt.insertOrderedList} title="Numbered List"><MdFormatListNumbered size={16} /></ToolbarBtn>
      <ToolbarDivider />
      <ToolbarBtn onClick={() => onExec("removeFormat")} title="Clear Formatting"><MdFormatClear size={16} /></ToolbarBtn>
      <ToolbarDivider />
      <ToolbarBtn onClick={() => onExec("justifyLeft")} active={activeFmt.justifyLeft} title="Align Left"><FiAlignLeft size={13} /></ToolbarBtn>
      <ToolbarBtn onClick={() => onExec("justifyCenter")} active={activeFmt.justifyCenter} title="Align Center"><FiAlignCenter size={13} /></ToolbarBtn>
      <ToolbarBtn onClick={() => onExec("justifyRight")} active={activeFmt.justifyRight} title="Align Right"><FiAlignRight size={13} /></ToolbarBtn>
      <ToolbarBtn onClick={() => onExec("justifyFull")} active={activeFmt.justifyFull} title="Justify"><FiAlignJustify size={13} /></ToolbarBtn>
    </div>
  );
}

const FMT_CMDS = ["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList", "justifyLeft", "justifyCenter", "justifyRight", "justifyFull"];

function getActiveFmt() {
  const state = {};
  FMT_CMDS.forEach(cmd => { try { state[cmd] = document.queryCommandState(cmd); } catch { state[cmd] = false; } });
  return state;
}

// ── Collapsible section ──────────────────────────────────────────────────────

// ── Priority badge ───────────────────────────────────────────────────────────

const PRIORITY_STYLES = {
  stat: " text-red-400 ",
  urgent: " text-amber-400 ",
  routine: "text-emerald-400 ",
};

function PriorityBadge({ priority }) {
  const key = (priority || "routine").toLowerCase();
  const cls = PRIORITY_STYLES[key] ?? PRIORITY_STYLES.routine;
  return (
    <span className={`inline-flex w-fit text-[12px] font-medium uppercase  py-0.5 ${cls}`}>
      {priority || "Routine"}
    </span>
  );
}

// ── Editable div (ref-based, won't reset on re-render) ─────────────────────

function EditableDiv({ initialHtml, style, className }) {
  const ref = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (ref.current && !initialized.current) {
      ref.current.innerHTML = initialHtml || "";
      initialized.current = true;
    }
  }, [initialHtml]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      style={style}
      className={className}
    />
  );
}

// ── PDF icon ─────────────────────────────────────────────────────────────────

function PdfIcon() {
  return (
    <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
      <span className="text-red-400 text-[10px] font-bold">PDF</span>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ReportViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFmt, setActiveFmt] = useState({});
  const [currentFont, setCurrentFont] = useState("Helvetica");
  const [currentSize, setCurrentSize] = useState("4");
  const reportPaperRef = useRef(null);
  const [caseReports, setCaseReports] = useState([]);
  const [activeReportTab, setActiveReportTab] = useState(id);
  const [expandedAiReport, setExpandedAiReport] = useState(false);

  // Top-level browser tabs: "report" is always the first tab; documents open as additional tabs
  const [activePageTab, setActivePageTab] = useState("report");
  const [openDocTabs, setOpenDocTabs] = useState([]); // [{id, name, type, url}]

  const openDocumentTab = (doc) => {
    if (openDocTabs.find(t => t.id === doc.id)) {
      setActivePageTab(doc.id);
      return;
    }
    // Open tab immediately with loading state, fetch URL in background
    setOpenDocTabs(prev => [...prev, { ...doc, url: null, loading: true }]);
    setActivePageTab(doc.id);
    getDocumentDownloadUrl(doc.id)
      .then(data => {
        const url = data?.download_url || data?.url || "";
        setOpenDocTabs(prev => prev.map(t => t.id === doc.id ? { ...t, url, loading: false } : t));
      })
      .catch(err => {
        console.error("Failed to get document URL:", err);
        setOpenDocTabs(prev => prev.map(t => t.id === doc.id ? { ...t, loading: false, error: true } : t));
      });
  };

  const closeDocTab = (docId, e) => {
    e.stopPropagation();
    setOpenDocTabs(prev => prev.filter(t => t.id !== docId));
    if (activePageTab === docId) setActivePageTab("report");
  };

  useEffect(() => {
    const update = () => setActiveFmt(getActiveFmt());
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  const handleExec = cmd => { exec(cmd); setActiveFmt(getActiveFmt()); };
  const handleFontChange = font => { setCurrentFont(font); exec("fontName", font); };
  const handleFontSizeChange = size => { setCurrentSize(size); exec("fontSize", size); };

  useEffect(() => {
    const baseURL = process.env.REACT_APP_API_URL || "";
    Promise.all([
      authFetch(`${baseURL}/reports/case/${id}`).then(r => r.ok ? r.json() : null),
      authFetch(`${baseURL}/report-templates/`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { const rec = Array.isArray(data) ? data[0] : data; return rec?.template ?? null; })
        .catch(() => null),
    ]).then(([reportData, tplData]) => {
      const list = Array.isArray(reportData) ? reportData : [];
      // TODO: remove dummy tabs
      const dummyTabs = [
        { id: "dummy-1", study_name: "CRANE+POLYGONE", series_name: "Crane Osseux", ai_report: list[0]?.ai_report },
        { id: "dummy-2", study_name: "CRANE+POLYGONE", series_name: "Axial T1", ai_report: list[0]?.ai_report },
        { id: "dummy-3", study_name: "CHEST CT", series_name: "Lung Window", ai_report: list[0]?.ai_report },
        { id: "dummy-4", study_name: "CHEST CT", series_name: "Mediastinal", ai_report: list[0]?.ai_report },
        { id: "dummy-5", study_name: "ABDOMEN MRI", series_name: "Coronal T2", ai_report: list[0]?.ai_report },
        { id: "dummy-6", study_name: "ABDOMEN MRI", series_name: "Axial DWI", ai_report: list[0]?.ai_report },
      ];
      const combined = [...list, ...dummyTabs];
      setReport(list[0] || null);
      setCaseReports(combined);
      if (combined.length > 0) setActiveReportTab(combined[0].id);
      setTemplate(tplData ?? loadTemplate());
    }).catch(() => {
      setTemplate(loadTemplate());
    }).finally(() => setLoading(false));
  }, [id]);


  if (loading) {
    return (
      <div className="flex-1 min-w-0 h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#3a3a3a] text-[13px] m-0">Loading report…</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex-1 min-w-0 h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-[#6B6B6B] text-[15px] m-0">Report not found</p>
          <button onClick={() => navigate("/patient-reports")} className="text-[#0694FB] text-[13px] bg-transparent border-none cursor-pointer hover:underline">
            Back to reports
          </button>
        </div>
      </div>
    );
  }

  const { centerInfo, showSignatureArea, showPatientInfo, signatures = [] } = template;
  const parsedSections = parseAiReport(report.ai_report);

  const sectionContent = template.sections
    .filter(s => s.enabled)
    .map(s => {
      const key = s.title.toLowerCase();
      const content = parsedSections[key] ?? parsedSections[key + "s"] ?? parsedSections[key.replace(/s$/, "")] ?? "";
      return { ...s, content };
    });

  const patient = {
    name: report.patient_name || "—",
    age: report.patient_age || "—",
    sex: report.patient_gender || "—",
    dob: report.patient_dob ? fmtDate(report.patient_dob) : "—",
    pid: report.patient_id || "—",
    registeredOn: report.study_date ? fmtDate(report.study_date) : "—",
    reportedOn: fmtDate(report.created_at),
  };

  const study = {
    description: report.study_name || "—",
    chiefComplaint: report.chief_complaint || "—",
    clinicalHistory: report.clinical_indication || "—",
    priority: report.urgency || "Routine",
    modality: report.modality?.toUpperCase() || "—",
    bodyRegion: report.body_region || "",
  };

  const documents = Array.isArray(report.documents) ? report.documents.map(doc => ({
    name: doc.file_name || "Untitled",
    type: doc.document_type || "",
    id: doc.id,
  })) : [];

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col min-h-0">
      {/* 3-column layout */}
      <div className="flex flex-row gap-4 flex-1 min-h-0 overflow-hidden mt-6">

        {/* ──── LEFT: Study Info + Documents ──── */}
        <motion.div
          className="w-[280px] shrink-0 flex flex-col py-3 bg-[#161616] border border-[#1E1E1E] rounded-[15px] overflow-y-auto mb-4"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <div className="mx-4 bg-[rgba(6,148,251,0.17)] rounded-full px-3 py-1 flex items-center gap-1.5 mb-1 w-fit">
            <p className="text-[#0694FB] text-[12px] font-medium m-0">Report Info</p>
          </div>
          {/* Study Info */}
          <div className="px-4 py-3 flex flex-col gap-y-[13px]">
            <div className="flex flex-col gap-0.5">
              <span className="text-[#6B6B6B] text-[11px] uppercase tracking-wide">Patient</span>
              <span className="text-white text-[14px] font-medium">{patient.name}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[#6B6B6B] text-[11px] uppercase tracking-wide">Age / Gender</span>
              <span className="text-white text-[14px]">{patient.age} / {patient.sex}</span>
            </div>

            {/* <div className="flex flex-col gap-0.5">
              <span className="text-[#6B6B6B] text-[11px] uppercase tracking-wide">Modality</span>
              <span className="text-white text-[14px] font-medium">{study.modality}</span>
            </div> */}
            <div className="flex flex-col gap-1">
              <span className="text-[#6B6B6B] text-[11px] uppercase tracking-wide">Priority</span>
              <PriorityBadge priority={study.priority} />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[#6B6B6B] text-[11px] uppercase tracking-wide">Chief Complaint</span>
              <span className="text-[#FFFFFF] text-[14px]">{study.chiefComplaint}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[#6B6B6B] text-[11px] uppercase tracking-wide">Clinical History</span>
              <span className="text-[#C0C0C0] text-[14px]">{study.clinicalHistory}</span>
            </div>
          </div>

          {/* Documents */}
          <div className="px-4 py-3 border-t border-[#1E1E1E]">
            <div className="bg-[rgba(6,148,251,0.17)] rounded-full px-3 py-1 flex items-center gap-1.5 mb-4 w-fit">
              <p className="text-[#0694FB] text-[12px] font-medium m-0">Case Documents</p>
            </div>
            {/* <span className="text-white text-[13px] font-medium block mb-3"></span> */}
            <div className="flex flex-col gap-2 mb-3">
              {documents.length === 0 ? (
                <span className="text-[#6B6B6B] text-[12px]">No documents attached</span>
              ) : (
                documents.map((doc, i) => (
                  <div
                    key={doc.id || i}
                    onClick={() => openDocumentTab(doc)}
                    className="flex items-center gap-3 px-4 py-4 rounded-xl bg-[#2c2c2c] border border-[#1E1E1E] hover:border-[#3a3a3a] transition-colors cursor-pointer"
                  >
                    <PdfIcon />
                    <div className="flex flex-col min-w-0">
                      <span className="text-white text-[12px] font-medium truncate">{doc.name}</span>
                      {doc.type && <span className="text-[#8a8989] text-[11px]">{doc.type}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>

            
          </div>
        </motion.div>

        {/* ──── CENTER: Tabs + Report paper ──── */}
        <motion.div
          className="flex-1 min-w-0 overflow-hidden flex flex-col"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
        >
          {/* Toolbar */}
          <div className="shrink-0">
            <Toolbar
              activeFmt={activeFmt}
              onExec={handleExec}
              onFontChange={handleFontChange}
              onFontSizeChange={handleFontSizeChange}
              currentFont={currentFont}
              currentSize={currentSize}
            />
          </div>

          {/* Browser-style tabs */}
          <div className="shrink-0 flex items-end mt-4" style={{ borderBottom: "1px solid #2a2a2a" }}>
            <button
              onClick={() => setActivePageTab("report")}
              className="px-5 py-2 text-[12px] font-medium cursor-pointer transition-all whitespace-nowrap shrink-0 bg-transparent flex items-center gap-2"
              style={{
                border: "1px solid #2a2a2a",
                borderBottom: "none",
                borderRadius: "10px 10px 0 0",
                color: activePageTab === "report" ? "#fff" : "#757575",
                backgroundColor: activePageTab === "report" ? "#161616" : "transparent",
                marginBottom: -1,
              }}
            >
              <FiFileText size={13} />
              Patient Report
            </button>
            {openDocTabs.map(doc => {
              const isActive = activePageTab === doc.id;
              return (
                <button
                  key={doc.id}
                  onClick={() => setActivePageTab(doc.id)}
                  className="px-4 py-2 text-[12px] font-medium cursor-pointer transition-all whitespace-nowrap shrink-0 bg-transparent flex items-center gap-2"
                  style={{
                    border: "1px solid #2a2a2a",
                    borderBottom: "none",
                    borderRadius: "10px 10px 0 0",
                    color: isActive ? "#fff" : "#757575",
                    backgroundColor: isActive ? "#161616" : "transparent",
                    marginBottom: -1,
                    marginLeft: -1,
                  }}
                >
                  <span className="text-red-400 text-[9px] font-bold bg-red-500/15 rounded px-1.5 py-0.5 shrink-0">PDF</span>
                  <span className="max-w-[120px] truncate">{doc.name}</span>
                  <span
                    onClick={(e) => closeDocTab(doc.id, e)}
                    className="ml-1 rounded-full hover:bg-white/10 p-0.5 transition-colors text-[#6B6B6B] hover:text-white"
                  >
                    <FiX size={12} />
                  </span>
                </button>
              );
            })}
          </div>

          {activePageTab !== "report" ? (
            (() => {
              const doc = openDocTabs.find(t => t.id === activePageTab);
              if (!doc) return null;
              if (doc.loading) {
                return (
                  <div className="flex-1 min-h-0 flex items-center justify-center bg-[#0a0a0a]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
                      <p className="text-[#6B6B6B] text-[13px] m-0">Loading document…</p>
                    </div>
                  </div>
                );
              }
              if (doc.error || !doc.url) {
                return (
                  <div className="flex-1 min-h-0 flex items-center justify-center bg-[#0a0a0a]">
                    <p className="text-[#6B6B6B] text-[13px] m-0">Failed to load document</p>
                  </div>
                );
              }
              return (
                <div className="flex-1 min-h-0 flex flex-col bg-[#0a0a0a] overflow-hidden">
                  <iframe
                    src={doc.url}
                    title={doc.name}
                    className="flex-1 w-full border-none"
                    style={{ minHeight: 0 }}
                  />
                </div>
              );
            })()
          ) : (
          <div
            className="flex-1 min-h-0 overflow-auto px-6 pb-6 pt-2 bg-[#080808] border border-t-0 border-[#1E1E1E] rounded-b-[15px]"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
          >
            <div
              ref={reportPaperRef}
              className="bg-white  shadow-2xl overflow-hidden"
              style={{ fontFamily: "'Inter', Arial, sans-serif", maxWidth: 900, minHeight: 1273, margin: "0 auto", display: "flex", flexDirection: "column" }}
            >
              {/* Center header */}
              <div style={{ background: "#1a2d5a", padding: "25px 20px", fontFamily: "'Google Sans', Arial, sans-serif" }} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#1a2d5a" }}>
                    {centerInfo.name?.[0] || "S"}
                  </div>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 500, fontSize: 18, letterSpacing: 1 }}>{centerInfo.name}</div>
                    <div style={{ color: "#90caf9", fontSize: 12 }}>{centerInfo.tagline}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right", color: "#90caf9", fontSize: 12, letterSpacing: 1 }}>
                  <div>{centerInfo.phone}</div>
                  <div>{centerInfo.email}</div>
                </div>
              </div>

              {/* Address bar */}
              <div style={{ background: "#f5f5f5", padding: "15px 20px", fontSize: 12, color: "#666", borderBottom: "1px solid #ddd" }}>
                {centerInfo.address}
              </div>

              {/* Patient info block */}
              {showPatientInfo && (
                <div style={{ padding: "30px 50px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>{patient.name}</div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>Age: {patient.age} &nbsp;|&nbsp; Sex: {patient.sex}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#555", textAlign: "right" }}>
                    <div><b>PID:</b> {patient.pid}</div>
                    <div><b>DOB:</b> {patient.dob}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#555", textAlign: "right" }}>
                    <div><b>Study Date:</b> {patient.registeredOn}</div>
                    <div><b>Reported on:</b> {patient.reportedOn}</div>
                  </div>
                </div>
              )}

              {/* Report type title */}
              <div style={{ textAlign: "left", padding: "10px 40px 6px", fontWeight: 600, fontSize: 17, color: "#000" }}>
                {report.title || "Radiology Report"}
              </div>

              {/* Sections */}
              <div style={{ padding: "8px 50px 16px", flex: 1 }}>
                {sectionContent.length === 0 && report.ai_report ? (
                  <EditableDiv
                    initialHtml={markdownToHtml(report.ai_report)}
                    style={{ marginBottom: 14, padding: "8px 10px", outline: "none", minHeight: 40 }}
                  />
                ) : (
                  sectionContent.map(section => (
                    <div key={section.id} style={{ marginBottom: 14, padding: "8px 10px" }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#000", marginBottom: 6 }}>
                        {section.title}:
                      </div>
                      <EditableDiv
                        initialHtml={section.content ? markdownToHtml(section.content) : ""}
                        style={{ fontSize: 12, color: "#333", lineHeight: 1.6, outline: "none", minHeight: 30 }}
                      />
                    </div>
                  ))
                )}
              </div>

              {/* Signature area */}
              {showSignatureArea && (
                <div style={{ padding: "10px 20px 16px", borderTop: "1px solid #ddd", display: "flex", justifyContent: "space-between", gap: 12 }}>
                  {signatures.map(sig => (
                    <div key={sig.id} style={{ textAlign: "center", flex: 1 }}>
                      <div style={{ height: 52, borderBottom: "1px solid #aaa", marginBottom: 4, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                        {sig.image && (
                          <img src={sig.image} alt={sig.role} style={{ maxHeight: 48, maxWidth: "100%", objectFit: "contain", marginBottom: 2 }} />
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#111", fontWeight: 600 }}>{sig.name || "\u00a0"}</div>
                      <div style={{ fontSize: 10, color: "#555" }}>{sig.role}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer bar */}
              <div style={{ background: "#1a2d5a", padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: "#90caf9", fontSize: 10 }}>{centerInfo.name}</div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{centerInfo.phone?.split("/")[0]?.trim()}</div>
              </div>
            </div>
          </div>
          )}
        </motion.div>

        {/* ──── RIGHT: Buttons + Actions ──── */}
        <div className="w-[370px] shrink-0 flex flex-col gap-2">
          <div className="flex items-center justify-end gap-2  mb-4 shrink-0">
            <button
              onClick={() => {
                if (!reportPaperRef.current) return;
                reportPaperRef.current.classList.add("print-target");
                window.print();
                reportPaperRef.current.classList.remove("print-target");
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-transparent text-[#A0A0A0] hover:text-white hover:border-[#2a2a2a] text-[13px] cursor-pointer transition-all"
            >
              <FiPrinter size={14} />
              Print & Export
            </button>
            <button className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#0694FB] hover:bg-[#0578d1] text-white text-[13px] font-medium border-none cursor-pointer transition-colors">
              Finalize & Sign
            </button>
          </div>
        <motion.div
          className="flex-1 min-h-0 flex flex-col gap-3 bg-[#161616] rounded-[15px] p-[18px]"
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="bg-[rgba(6,148,251,0.17)] rounded-full px-3 py-1 flex items-center gap-1.5 w-fit">
              <p className="text-[#0694FB] text-[12px] font-medium m-0">AI Generated Reports</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const activeReport = caseReports.find(r => r.id === activeReportTab) || report;
                  if (!activeReport) return;
                  navigate("/case-workspace/viewer", {
                    state: {
                      study: { id: activeReport.study_id, name: activeReport.study_name, case_id: activeReport.case_id },
                      series: { id: activeReport.series_id, name: activeReport.series_name },
                      case_id: activeReport.case_id,
                      from_jobs: true,
                      job_id: activeReport.job_id,
                      initial_status: "completed",
                    },
                  });
                }}
                className="flex items-center gap-1.5 px-[12px] py-1.5 rounded-full text-[#1a1a1a] bg-[#E4F77D] hover:bg-[#d4ec6a] transition-colors cursor-pointer border-none text-[12px] font-medium"
                title="DICOM Viewer"
              >
                <FiMonitor size={13} />
               View DICOM
              </button>
              <button
                onClick={() => setExpandedAiReport(true)}
                className="text-[#6B6B6B] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1"
                title="Expand"
              >
                <FiMaximize2 size={14} />
              </button>
            </div>
          </div>

          {/* Series tabs */}
          {caseReports.length > 0 && (
            <div
              className="flex flex-wrap shrink-0"
              style={{ borderBottom: "1px solid #2a2a2a" }}
            >
              {caseReports.map((r) => {
                const label = [r.study_name, r.series_name].filter(Boolean).join(" - ") || r.title || "Report";
                const isActive = r.id === activeReportTab;
                return (
                  <button
                    key={r.id}
                    onClick={() => setActiveReportTab(r.id)}
                    className="px-4 py-2 text-[11px] font-medium cursor-pointer transition-all whitespace-nowrap shrink-0 bg-transparent"
                    style={{
                      border: "1px solid #2a2a2a",
                      borderBottom: "none",
                      borderRadius: "9px 9px 0 0",
                      color: isActive ? "#fff" : "#757575",
                      backgroundColor: isActive ? "#0694FB" : "#161616",
                      marginBottom: -1,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {(() => {
            const activeAiReport = caseReports.find(r => r.id === activeReportTab) || report;
            console.log("activeAiReport keys:", activeAiReport ? Object.keys(activeAiReport) : "null", activeAiReport);
            return activeAiReport?.ai_report ? (
              <div
                className="text-[#fdfbfb] bg-[#111111] p-4 rounded-[5px] text-[12px] leading-relaxed overflow-y-auto flex-1 min-h-0 pr-1"
                style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
              >
                {/* Meta: model, severity, TAT */}
                {(activeAiReport.model_name || activeAiReport.severity || activeAiReport.tat) && (
                  <div className="flex items-center gap-2 flex-wrap mb-3 pb-3 border-b border-[#2a2a2a]">
                    {activeAiReport.model_name && (
                      <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full text-[#0694FB] bg-[rgba(6,148,251,0.12)]">
                        {activeAiReport.model_name}
                      </span>
                    )}
                    {activeAiReport.severity && (
                      <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                        activeAiReport.severity.toLowerCase() === "critical" ? "text-red-400 bg-red-500/12" :
                        activeAiReport.severity.toLowerCase() === "urgent" ? "text-amber-400 bg-amber-500/12" :
                        "text-emerald-400 bg-emerald-500/12"
                      }`}>
                        {activeAiReport.severity}
                      </span>
                    )}
                    {activeAiReport.tat && (
                      <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full text-[#A78BFA] bg-[rgba(167,139,250,0.12)]">
                        TAT: {activeAiReport.tat}
                      </span>
                    )}
                  </div>
                )}
                {renderMarkdownDark(activeAiReport.ai_report)}
              </div>
            ) : (
              <p className="text-[#6B6B6B] text-[12px] m-0 italic">No AI report available</p>
            );
          })()}

        </motion.div>
        </div>
      </div>

      {/* Expanded AI Report Modal */}
      <AnimatePresence>
        {expandedAiReport && (
          <motion.div
            className="fixed inset-0 z-[999] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setExpandedAiReport(false)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-[700px] bg-[#161616] border border-[#1E1E1E] rounded-2xl flex flex-col overflow-hidden max-h-[80vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-7 pt-6 pb-4">
                <div className="bg-[rgba(6,148,251,0.17)] rounded-full px-3 py-1.5 flex items-center gap-1.5">
                  <p className="text-[#0694FB] text-[12px] font-medium m-0">AI Generated Reports</p>
                </div>
                <button onClick={() => setExpandedAiReport(false)} className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1">
                  <FiX size={18} />
                </button>
              </div>

              {/* Tabs */}
              {caseReports.length > 0 && (
                <div className="flex flex-wrap px-7 shrink-0" style={{ borderBottom: "1px solid #2a2a2a" }}>
                  {caseReports.map((r) => {
                    const label = [r.study_name, r.series_name].filter(Boolean).join(" - ") || r.title || "Report";
                    const isActive = r.id === activeReportTab;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setActiveReportTab(r.id)}
                        className="px-4 py-2 text-[11px] font-medium cursor-pointer transition-all whitespace-nowrap shrink-0 bg-transparent"
                        style={{
                          border: "1px solid #2a2a2a",
                          borderBottom: "none",
                          borderRadius: "6px 6px 0 0",
                          color: isActive ? "#fff" : "#757575",
                          backgroundColor: isActive ? "#0694FB" : "#161616",
                          marginBottom: -1,
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Report content */}
              <div className="flex-1 bg-[#1a1a1a] overflow-y-auto px-7 py-5" style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}>
                {(() => {
                  const activeAiReport = caseReports.find(r => r.id === activeReportTab) || report;
                  return activeAiReport?.ai_report
                    ? renderMarkdownDark(activeAiReport.ai_report)
                    : <p className="text-[#6B6B6B] text-[12px] m-0 italic">No AI report available</p>;
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media print {
          /* Hide everything */
          body > * { display: none !important; }
          /* Show the root React mount */
          #root { display: block !important; }
          #root > * { display: none !important; }

          /* Walk up from .print-target and show each ancestor */
          .print-target,
          .print-target * {
            visibility: visible !important;
          }

          /* Override the entire page to just show the report */
          .print-target {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: none !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            z-index: 99999 !important;
            display: flex !important;
            flex-direction: column !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          .print-target div,
          .print-target span,
          .print-target p,
          .print-target b,
          .print-target img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          @page {
            size: A4;
            margin: 0;
          }

          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
        }
      `}</style>
    </div>
  );
}
