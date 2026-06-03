import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Appbar from "../appbar/appbar";
import Sidebar from "../sidebar/Sidebar";
import AddStudyModal from "./AddStudyModal";
import ImportStudyModal from "./ImportStudyModal";
import NewReportModal from "./NewReportModal";
import ReportViewModal from "./ReportViewModal";
import {
  FiArrowLeft, FiDownload, FiMaximize2,
  FiUser, FiFileText, FiChevronDown, FiChevronUp, FiFolder, FiX, FiUploadCloud, FiTrash2,
} from "react-icons/fi";
import { requestDocumentUpload, uploadToSignedUrl, confirmDocumentUpload, getDocumentsForPatient, getDocumentDownloadUrl, getPatientById, deleteStudy } from "../../../lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.32, 0.72, 0, 1], delay: i * 0.08 },
  }),
};

const categoryColors = {
  Consent: "text-[#0694FB] bg-[rgba(6,148,251,0.12)]",
  Referral: "text-[#A855F7] bg-[rgba(168,85,247,0.12)]",
  Insurance: "text-[#F59E0B] bg-[rgba(245,158,11,0.12)]",
  History: "text-[#22C55E] bg-[rgba(34,197,94,0.12)]",
  Lab: "text-[#FF6B35] bg-[rgba(255,107,53,0.12)]",
};

const fileIconColor = { PDF: "#FF6B35", DOCX: "#0694FB", PNG: "#22C55E", JPG: "#22C55E" };

const urgencyStyles = {
  Immediate: "bg-[rgba(255,107,53,0.2)] text-[#FF6B35]",
  Emergency: "bg-[rgba(255,59,59,0.2)]  text-[#FF3B3B]",
  "Less Urgent": "bg-[rgba(147,51,234,0.2)] text-[#A855F7]",
  Routine: "bg-[rgba(6,148,251,0.2)]  text-[#0694FB]",
};

const modalityColors = {
  MRI: "text-[#0694FB] bg-[rgba(6,148,251,0.15)]",
  "X-Ray": "text-[#22C55E] bg-[rgba(34,197,94,0.15)]",
  CT: "text-[#F59E0B] bg-[rgba(245,158,11,0.15)]",
  Ultrasound: "text-[#A855F7] bg-[rgba(168,85,247,0.15)]",
  PET: "text-[#EC4899] bg-[rgba(236,72,153,0.15)]",
};

const severityColors = {
  Normal: "text-[#22C55E] bg-[rgba(34,197,94,0.12)]",
  Mild: "text-[#F59E0B] bg-[rgba(245,158,11,0.12)]",
  Moderate: "text-[#FF6B35] bg-[rgba(255,107,53,0.12)]",
  Severe: "text-[#FF3B3B] bg-[rgba(255,59,59,0.12)]",
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div className="inline-flex bg-[rgba(6,148,251,0.17)] rounded-[11px] px-[9px] py-[6px] mb-3 shrink-0">
      <p className="m-0 text-[13px] text-[#0694FB] font-medium">{children}</p>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[#6B6B6B] text-[10px] m-0 uppercase tracking-wide">{label}</p>
      <p className="text-white text-[13px] m-0">{value}</p>
    </div>
  );
}

function FindingCard({ finding }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#0A0A0A] border border-[#1E1E1E] rounded-2xl overflow-hidden">
      {/* Model header */}
      <div className="flex items-center justify-between p-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#111] border border-[#1a1a1a] flex items-center justify-center shrink-0">
            <div className="w-5 h-5 rounded bg-[#1a1a1a]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-white text-[13px] font-medium m-0">{finding.model}</p>
              <span className="text-[#3a3a3a] text-[10px]">{finding.modelId}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${finding.tagColor}`}>{finding.tag}</span>
              <span className={`text-[11px] font-medium ${finding.statusColor}`}>{finding.status}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Confidence */}
          <div className="text-right">
            <p className="text-[#6B6B6B] text-[10px] m-0">Confidence</p>
            <p className="text-white text-sm font-medium m-0">{finding.confidence}%</p>
          </div>
          <div className="w-16 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#0694FB]" style={{ width: `${finding.confidence}%` }} />
          </div>
          <button onClick={() => setOpen((o) => !o)} className="text-[#6B6B6B] hover:text-white cursor-pointer bg-transparent border-none transition-colors">
            {open ? <FiChevronUp size={15} /> : <FiChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Expanded findings */}
      {open && (
        <div className="border-t border-[#1E1E1E] px-4 py-3 flex flex-col gap-2">
          {finding.findings.map((f, i) => (
            <div key={i} className="bg-[#111] rounded-xl p-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[#0694FB] text-[11px] font-medium m-0">{f.region}</p>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${severityColors[f.severity]}`}>{f.severity}</span>
              </div>
              <p className="text-[#CCCCCC] text-[12px] m-0 leading-relaxed">{f.observation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DOCUMENT_TYPES = ["Consent", "Referral", "Insurance", "History", "Lab", "Other"];

function DocumentsSection({ patientId }) {
  const [docs, setDocs]         = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [search, setSearch]     = useState("");

  useEffect(() => {
    if (!patientId) return;
    setDocsLoading(true);
    getDocumentsForPatient(patientId)
      .then(data => {
        setDocs((data ?? [])
          .filter(d => d.status === "uploaded")
          .map(d => ({
            id:         d.id,
            name:       d.file_name,
            type:       d.file_name.split(".").pop().toUpperCase(),
            size:       "",
            uploadedBy: d.uploaded_by_id ?? "—",
            date:       d.created_at ? new Date(d.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
            category:   d.document_type ?? "Other",
          }))
        );
      })
      .catch(() => setDocs([]))
      .finally(() => setDocsLoading(false));
  }, [patientId]);

  // Upload flow state
  const fileInputRef              = useRef(null);
  const [pendingFile, setPending] = useState(null);   // File awaiting type selection
  const [docType, setDocType]     = useState("Consent");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadErr, setUploadErr] = useState(null);

  const filtered = docs.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPending(file);
    setDocType("Consent");
    setUploadErr(null);
    e.target.value = null;
  };

  const handleUpload = async () => {
    if (!pendingFile || !patientId) return;
    setUploading(true);
    setUploadPct(0);
    setUploadErr(null);
    try {
      // Step 1 — request a signed GCS upload URL
      const { document_id, upload_url } = await requestDocumentUpload({
        patient_id:    patientId,
        file_name:     pendingFile.name,
        document_type: docType,
      });

      // Step 2 — PUT directly to GCS
      try {
        await uploadToSignedUrl(upload_url, pendingFile, setUploadPct);
      } catch (uploadErr) {
        await confirmDocumentUpload(document_id, "failed");
        throw uploadErr;
      }

      // Step 3 — confirm upload with backend
      await confirmDocumentUpload(document_id, "uploaded");

      // Add to local list
      const ext = pendingFile.name.split(".").pop().toUpperCase();
      setDocs(prev => [{
        id:         document_id,
        name:       pendingFile.name,
        type:       ext,
        size:       `${Math.round(pendingFile.size / 1024)} KB`,
        uploadedBy: "You",
        date:       new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        category:   docType,
      }, ...prev]);

      setPending(null);
    } catch (err) {
      setUploadErr(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-[#161616] border border-[#1E1E1E] rounded-2xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-white text-[17px]">Patient Documents</span>
          <p className="text-[#6B6B6B] text-[12px] m-0 mt-0.5">Consent forms, referrals, insurance, and clinical records for this patient.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-1.5 text-white text-[12px] outline-none placeholder-[#3a3a3a] focus:border-[#0694FB] transition-colors w-44"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0694FB] hover:bg-[#0578d1] text-white text-[12px] font-medium border-none cursor-pointer transition-colors whitespace-nowrap"
          >
            <FiUploadCloud size={13} /> Upload
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* Inline upload panel — shown after file is selected */}
      {pendingFile && (
        <div className="bg-[#111] border border-[#1E1E1E] rounded-xl px-4 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <FiFileText size={14} className="text-[#0694FB] shrink-0" />
              <p className="text-white text-[13px] m-0 truncate">{pendingFile.name}</p>
              <span className="text-[#6B6B6B] text-[11px] shrink-0">{Math.round(pendingFile.size / 1024)} KB</span>
            </div>
            <button onClick={() => { setPending(null); setUploadErr(null); }} className="text-[#3a3a3a] hover:text-white bg-transparent border-none cursor-pointer transition-colors">
              <FiX size={14} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={docType}
              onChange={e => setDocType(e.target.value)}
              className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-lg px-3 py-1.5 text-white text-[12px] outline-none focus:border-[#0694FB] transition-colors cursor-pointer flex-1"
            >
              {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-4 py-1.5 rounded-lg bg-[#0694FB] hover:bg-[#0578d1] disabled:opacity-50 text-white text-[12px] font-medium border-none cursor-pointer transition-colors shrink-0"
            >
              {uploading ? `${uploadPct}%` : "Confirm Upload"}
            </button>
          </div>

          {uploading && (
            <div className="w-full h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className="h-full bg-[#0694FB] rounded-full transition-all" style={{ width: `${uploadPct}%` }} />
            </div>
          )}
          {uploadErr && <p className="text-[#FF4A4A] text-[11px] m-0">{uploadErr}</p>}
        </div>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_60px_130px_100px_32px] gap-3 px-3 pb-2 border-b border-[#1E1E1E]">
        {["Document", "Type", "Uploaded by", "Date", ""].map((h) => (
          <p key={h} className="text-[#6B6B6B] text-[10px] uppercase tracking-wide m-0">{h}</p>
        ))}
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-0.5">
        {docsLoading ? (
          <div className="flex items-center justify-center py-10 gap-3">
            <div className="w-5 h-5 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#3a3a3a] text-[12px] m-0">Loading documents…</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-[#3a3a3a] text-[12px] text-center py-6 m-0">No documents found</p>
        ) : filtered.map((doc) => (
          <div
            key={doc.id}
            className="group grid grid-cols-[1fr_60px_130px_100px_32px] gap-3 items-center px-3 py-2.5 rounded-xl hover:bg-[rgba(255,255,255,0.03)] transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 text-[9px] font-bold"
                style={{ background: "rgba(255,255,255,0.05)", color: fileIconColor[doc.type] || "#6B6B6B" }}
              >
                {doc.type}
              </div>
              <div className="min-w-0">
                <p className="text-white text-[14px] m-0 truncate">{doc.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${categoryColors[doc.category] || "text-white bg-[#1a1a1a]"}`}>
                    {doc.category}
                  </span>
                  <span className="text-[#6B6B6B] text-[10px]">{doc.size}</span>
                </div>
              </div>
            </div>
            <p className="text-[#6B6B6B] text-[12px] m-0">{doc.type}</p>
            <p className="text-[#6B6B6B] text-[12px] m-0 truncate">{doc.uploadedBy}</p>
            <p className="text-[#6B6B6B] text-[12px] m-0">{doc.date}</p>
            <button
              onClick={async () => {
                try {
                  const url = await getDocumentDownloadUrl(doc.id);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = doc.name;
                  a.target = "_blank";
                  a.rel = "noopener noreferrer";
                  a.click();
                } catch (_) {}
              }}
              className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg border border-[#1E1E1E] bg-transparent hover:bg-[#1a1a1a] cursor-pointer transition-all"
            >
              <FiDownload size={12} color="#6B6B6B" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function NoteSection({ patient }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");

  const addNote = () => {
    if (!text.trim()) return;
    setNotes((prev) => [
      {
        id: Date.now(),
        author: patient.referringPhysician,
        role: "Referring Physician",
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        content: text.trim(),
      },
      ...prev,
    ]);
    setText("");
  };

  return (
    <div className="bg-[#1B1F24] border border-[#1E1E1E] rounded-2xl p-5 flex flex-col gap-4">
      <SectionLabel>Notes</SectionLabel>

      {/* Compose */}
      <div className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          className="w-full bg-[#111] border border-[#1E1E1E] rounded-xl px-4 py-3 text-white text-[13px] outline-none placeholder-[#3a3a3a] focus:border-[#0694FB] transition-colors resize-none"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
        />
        <div className="flex justify-end">
          <button
            onClick={addNote}
            className="px-4 py-1.5 rounded-lg bg-[#0694FB] hover:bg-[#0578d1] text-white text-[12px] font-medium border-none cursor-pointer transition-colors"
          >
            Add Note
          </button>
        </div>
      </div>

      {/* Note list */}
      <div className="flex flex-col gap-3">
        {notes.map((note) => (
          <div key={note.id} className="flex gap-3">
            <img
              src={`https://api.dicebear.com/9.x/initials/jpg?seed=${encodeURIComponent(note.author)}&scale=70&backgroundColor=5876dd`}
              alt="avatar"
              className="w-8 h-8 rounded-full shrink-0 mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-white text-[12px] font-medium m-0">{note.author}</p>
                <span className="text-[#3a3a3a] text-[10px]">{note.role}</span>
                <span className="text-[#3a3a3a] text-[10px] ml-auto">{note.date} · {note.time}</span>
              </div>
              <div className="bg-[#111] border border-[#1E1E1E] rounded-xl px-4 py-3">
                <p className="text-[#CCCCCC] text-[12px] m-0 leading-relaxed">{note.content}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Studies expanded modal ───────────────────────────────────────────────────
function StudiesModal({ isOpen, onClose, scans, onOpen }) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <motion.div
            initial={{ y: 28, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[820px] max-h-[85vh] bg-[#161616] border border-[#1E1E1E] rounded-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-7 py-5 border-b border-[#1E1E1E] shrink-0">
              <div>
                <h2 className="text-white text-[17px] font-medium m-0">Imaging Studies</h2>
                <p className="text-[#6B6B6B] text-xs m-0 mt-0.5">{scans.length} {scans.length === 1 ? "study" : "studies"} associated with this patient</p>
              </div>
              <button onClick={onClose} className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1">
                <FiX size={18} />
              </button>
            </div>

            {/* Grid */}
            <div
              className="overflow-y-auto p-7"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
            >
              <div className="grid grid-cols-3 gap-4">
                {scans.map((scan) => (
                  <div
                    key={scan.id}
                    onClick={() => onOpen(scan)}
                    className="group relative flex flex-col items-start gap-3 bg-[#111] border border-[#1E1E1E] rounded-2xl p-5 cursor-pointer hover:border-[#0694FB] hover:bg-[rgba(6,148,251,0.04)] transition-all duration-200"
                  >
                    <img src="/folder.png" alt="folder" className="w-20 h-20 object-contain self-start group-hover:scale-105 transition-transform duration-200" />
                    <div className="w-full">
                      <div className="flex gap-1.5 flex-wrap mb-1.5">
                        <span className={`text-[11px] font-normal px-1.5 py-0.5 rounded ${modalityColors[scan.modality]}`}>{scan.modality}</span>
                        {scan.flagged && <span className="text-[11px] font-normal px-1.5 py-0.5 rounded text-[#FF6B35] bg-[rgba(255,107,53,0.15)]">AI Flagged</span>}
                      </div>
                      <p className="text-white text-[15px] font-normal m-0 truncate">{scan.label}</p>
                      {scan.region && <p className="text-[#6B6B6B] text-[12px] m-0 mt-0.5 truncate">{scan.region}</p>}
                      <p className="text-[#3a3a3a] text-[11px] m-0 mt-0.5 font-mono">{scan.date}{scan.accNumber ? ` · ${scan.accNumber}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function PatientDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [patient, setPatient] = useState(state?.patient ?? null);
  const [patientLoading, setPatientLoading] = useState(!state?.patient);
  const caseId = state?.caseId || patient?.case_id;

  useEffect(() => {
    if (state?.patient) {
      console.log("patient (from state):", state.patient);
      return;
    }
    if (!id) return;
    setPatientLoading(true);
    getPatientById(id)
      .then(data => { console.log("patient (from API):", data); setPatient(data); })
      .catch((err) => { console.error("patient fetch error:", err); setPatient(null); })
      .finally(() => setPatientLoading(false));
  }, [id, state?.patient]);

  const [activeStudy, setActiveStudy] = useState(null);
  const [addStudyOpen, setAddStudyOpen] = useState(false);
  const [importStudyOpen, setImportStudyOpen] = useState(false);
  const [newReportOpen, setNewReportOpen] = useState(false);
  const [studiesOpen, setStudiesOpen] = useState(false);
  const [activeSeries, setActiveSeries] = useState(null);
  const [studies, setStudies] = useState([]);
  const [studiesLoading, setStudiesLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const openStudy = (study) => { setActiveStudy(study); setActiveSeries(null); };

  const fetchStudies = useCallback(async () => {
    setStudiesLoading(true);
    try {
      const baseURL = process.env.REACT_APP_API_URL || "";
      const token = localStorage.getItem("token");
      const res = await fetch(`${baseURL}/imaging-studies/?limit=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json();
      console.log(data)
      setStudies(
        data
          .filter((s) => s.case_id === caseId)
          .map((s) => ({
            id:         s.id,
            modality:   s.modality,
            label:      s.study_name,
            region:     s.body_region ?? "",
            accNumber:  s.acc_number ?? "",
            date:       s.study_date ? new Date(s.study_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
            studyId:    s.id,
            flagged:    s.flagged,
          }))
      );
    } catch (_) {}
    finally { setStudiesLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchStudies(); }, [fetchStudies]);

  const fetchReports = useCallback(async () => {
    if (!caseId) return;
    setReportsLoading(true);
    try {
      const baseURL = process.env.REACT_APP_API_URL || "";
      const token = localStorage.getItem("token");
      const res = await fetch(`${baseURL}/reports/case/${caseId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      setReports(await res.json());
    } catch (_) {}
    finally { setReportsLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const deleteReport = async (reportId) => {
    try {
      const baseURL = process.env.REACT_APP_API_URL || "";
      const token = localStorage.getItem("token");
      await fetch(`${baseURL}/reports/${reportId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (_) {}
  };
  if (patientLoading) {
    return (
      <div className="m-0 p-0 h-screen bg-black w-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="m-0 p-0 h-screen bg-black w-screen flex flex-col items-center justify-center gap-3">
        <p className="text-[#6B6B6B] text-[14px] m-0">Patient not found</p>
        <button onClick={() => navigate("/cases")} className="text-[#0694FB] text-[13px] bg-transparent border-none cursor-pointer hover:underline">Back to Cases</button>
      </div>
    );
  }

  return (
    <div className="m-0 p-0 h-screen bg-black w-screen">
      <div className="flex flex-col px-[33px] py-[28px] w-full h-screen box-border overflow-hidden">
        <Appbar />

        <div className="w-full flex flex-row gap-[30px] box-border mt-[30px] flex-1 min-h-0">
          <Sidebar activePage="Cases" />

          <div className="flex flex-col flex-1 min-w-0 overflow-y-auto gap-5 pr-1 pb-4 mt-0 pt-0">

           
            {/* ── Body ── */}
            <div className="flex gap-5 flex-1 min-h-0">

              <div className="flex flex-col  mt-0 flex-1 min-w-0 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}>

                <motion.div className="flex flex-col justify-between" variants={fadeUp} initial="hidden" animate="show" custom={0}>
                  <h1 className="m-0 text-white font-medium text-[40px] md:text-[32px] leading-[1.2] mt-0 mb-0">Patient <span className="text-[#0694FB]">Case Details</span></h1>
                  <p className="text-[#868686] text-[13px]">View the case details for this patient</p>
                </motion.div>
                {/* Profile card */}
                <motion.div className=" rounded-2xl p-5 flex gap-5 shrink-0 relative mb-5 mt-1" variants={fadeUp} initial="hidden" animate="show" custom={1}>
                  {/* Edit Profile — top right corner */}
                  <div>
                    <button className="absolute right-4 bg-[#0694FB] hover:bg-[#0578d1] text-white text-[13px] px-4 py-[8px] rounded-full border-none cursor-pointer transition-colors duration-200 whitespace-nowrap">
                      Edit Profile
                    </button>
                    {/* Avatar + identity */}
                    <div className="flex flex-col items-start gap-3 shrink-0 mr-[90px]">
                      <img
                        src={`https://api.dicebear.com/9.x/initials/jpg?seed=${encodeURIComponent(patient.name)}&scale=70&backgroundColor=5876dd`}
                        alt="avatar"
                        className="w-[55px] h-[55px] rounded-full flex-shrink-0"
                      />
                      <div className="text-left">
                        <p className="text-white text-[17px] font-normal m-0 leading-tight">{patient.name}</p>
                        <p className="text-[#696969] text-[15px] m-0 mt-0.5 font-mono">MRN {patient.mrn}</p>
                      </div>
                    </div>
                  </div>


                  {/* Divider */}
                  <div className="w-px bg-[#1E1E1E] shrink-0 self-stretch" />

                  {/* Stats grid */}
                  <div className="flex flex-wrap gap-x-32 gap-y-5 flex-1 content-center">
                    {[
                      { label: "Sex", value: patient.gender },
                      { label: "Blood", value: "A+" },
                      { label: "Urgency", value: patient.urgency },
                      { label: "Study Date", value: patient.studyDate },

                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[#818181] text-[12px] uppercase tracking-wide m-0 pb-0">{label}</p>
                        <p className="text-white text-[16px] font-normal m-0 mt-0 truncate">{value}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Big folder grid */}
                <motion.div className="bg-[#161616] border border-[#1E1E1E] rounded-2xl p-5 mb-7" variants={fadeUp} initial="hidden" animate="show" custom={2}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="text-white text-[17px]">Imaging Studies</span>
                      <p className="text-[#6B6B6B] text-[12px] m-0 mt-">All imaging studies associated with this patient. Click a study to open the series viewer.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setStudiesOpen(true)}
                        className="w-8 h-8 flex items-center justify-center rounded-full border border-[#1E1E1E] bg-transparent text-[#6B6B6B] hover:text-white hover:border-[#2a2a2a] cursor-pointer transition-all"
                        title="Expand all studies"
                      >
                        <FiMaximize2 size={13} />
                      </button>
                      <button
                        onClick={() => setImportStudyOpen(true)}
                        className="flex items-center gap-1.5 border border-[#0694FB] text-[#0694FB] hover:bg-[rgba(6,148,251,0.08)] text-[13px] px-4 py-[8px] rounded-full bg-transparent cursor-pointer transition-colors duration-200 whitespace-nowrap"
                        title="Import a study from DICOM files — studies and series are detected automatically"
                      >
                        <FiUploadCloud size={14} /> Import DICOM
                      </button>
                      <button
                        onClick={() => setAddStudyOpen(true)}
                        className="bg-[#0694FB] hover:bg-[#0578d1] text-white text-[13px] px-4 py-[8px] rounded-full border-none cursor-pointer transition-colors duration-200 whitespace-nowrap"
                      >
                        Add New Study
                      </button>
                    </div>

                  </div>
                  {studiesLoading ? (
                    <div className="grid grid-cols-4 gap-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-[160px] rounded-2xl bg-[#111] border border-[#1E1E1E] animate-pulse" />
                      ))}
                    </div>
                  ) : studies.length === 0 ? (
                    <p className="text-[#3a3a3a] text-sm text-center py-8 m-0">No imaging studies found</p>
                  ) : null}
                  <div className="grid grid-cols-4 gap-3">
                    {studies.map((scan) => (
                      <div
                        key={scan.id}
                        onClick={() => navigate("/case-workspace", { state: { studyId: scan.studyId, study: scan } })}
                        className="group relative flex flex-col items-start gap-3 bg-[#111] border border-[#1E1E1E] rounded-2xl p-5 cursor-pointer hover:border-[#0694FB] hover:bg-[rgba(6,148,251,0.04)] transition-all duration-200"
                      >
                        {/* Delete */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!window.confirm(`Delete study "${scan.label}"? This cannot be undone.`)) return;
                            deleteStudy(scan.id)
                              .then(() => setStudies(prev => prev.filter(s => s.id !== scan.id)))
                              .catch(err => alert(`Failed to delete: ${err.message}`));
                          }}
                          title="Delete study"
                          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg border-none cursor-pointer text-[#555] hover:text-[#FF4A4A] hover:bg-[rgba(255,74,74,0.1)] transition-all duration-200"
                          style={{ background: "rgba(255,255,255,0.07)" }}
                        >
                          <FiTrash2 size={13} />
                        </button>
                        <img src="/folder.png" alt="folder" className="w-20 h-20 object-contain self-start group-hover:scale-105 transition-transform duration-200" />
                        <div className="w-full">
                          <div className="flex gap-1.5 flex-wrap">
                            <span className={`text-[12px] font-normal px-1.5 py-0.5 rounded ${modalityColors[scan.modality]}`}>{scan.modality}</span>
                            {scan.flagged && <span className="text-[12px] font-normal px-1.5 py-0.5 rounded text-[#FF6B35] bg-[rgba(255,107,53,0.15)]">AI Flagged</span>}
                          </div>
                          <p className="text-white text-[15px] font-normal m-0 mt-1.5 truncate">{scan.label}</p>
                          {scan.region && <p className="text-[#6B6B6B] text-[12px] m-0 mt-0.5 truncate">{scan.region}</p>}
                          <p className="text-[#3a3a3a] text-[11px] m-0 mt-0.5 font-mono">{scan.date}{scan.accNumber ? ` · ${scan.accNumber}` : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Reports */}
                <motion.div className="bg-[#161616] border border-[#1E1E1E] rounded-2xl p-5 mb-6" variants={fadeUp} initial="hidden" animate="show" custom={3}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-white text-[17px]">Patient Reports</span>
                      <p className="text-[#6B6B6B] text-[12px] m-0">Radiology reports generated for this patient. Click a report to view or download.</p>
                    </div>
                    {/* <SectionLabel>Reports</SectionLabel> */}
                    <button
                      onClick={() => setNewReportOpen(true)}
                      className="flex items-center gap-1.5 px-4 py-[8px] rounded-full bg-[#0694FB] hover:bg-[#0578d1] text-white text-[13px] font-medium border-none cursor-pointer transition-colors">
                      New Report
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {reportsLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-[56px] rounded-xl bg-[#111] border border-[#1E1E1E] animate-pulse" />
                      ))
                    ) : reports.length === 0 ? (
                      <p className="text-[#3a3a3a] text-sm text-center py-6 m-0">No reports found</p>
                    ) : reports.map((report) => (
                      <div key={report.id} onClick={() => setSelectedReport(report)} className="flex items-center gap-4 px-4 py-3 bg-[#111] border border-[#1E1E1E] rounded-xl hover:border-[#0694FB] transition-all group cursor-pointer">
                        <div className="w-8 h-8 rounded-lg bg-[#0A0A0A] border border-[#1E1E1E] flex items-center justify-center shrink-0">
                          <FiFileText size={13} color="#0694FB" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-[15px] font-medium m-0 truncate">{report.title}</p>
                          <p className="text-[#6B6B6B] text-[12px] m-0 mt-0.5">
                            {report.radiologist}{report.radiologist && report.created_at ? " · " : ""}
                            {report.created_at ? new Date(report.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                          </p>
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                          report.status === "Signed"
                            ? "text-[#22C55E] bg-[rgba(34,197,94,0.12)]"
                            : "text-[#F59E0B] bg-[rgba(245,158,11,0.12)]"
                        }`}>{report.status || "Draft"}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteReport(report.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg border border-[#1E1E1E] bg-transparent hover:bg-[rgba(255,59,59,0.1)] hover:border-[rgba(255,59,59,0.3)] cursor-pointer shrink-0"
                        >
                          <FiX size={12} color="#FF3B3B" />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Documents */}
                <motion.div variants={fadeUp} initial="hidden" animate="show" custom={4}>
                  <DocumentsSection patientId={patient.id} />
                </motion.div>

                {/* Notes */}
                {/* <motion.div variants={fadeUp} initial="hidden" animate="show" custom={5}>
                  <NoteSection patient={patient} />
                </motion.div> */}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddStudyModal isOpen={addStudyOpen} onClose={() => setAddStudyOpen(false)} caseId={caseId} onCreated={fetchStudies} />
      <ImportStudyModal isOpen={importStudyOpen} onClose={() => setImportStudyOpen(false)} caseId={caseId} onCreated={fetchStudies} />
      <NewReportModal isOpen={newReportOpen} onClose={() => setNewReportOpen(false)} caseId={caseId} onCreated={fetchReports} />
      <ReportViewModal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        report={selectedReport}
        onUpdated={() => { fetchReports(); setSelectedReport(null); }}
      />
      <StudiesModal
        isOpen={studiesOpen}
        onClose={() => setStudiesOpen(false)}
        scans={studies}
        onOpen={(scan) => { setStudiesOpen(false); navigate("/case-workspace", { state: { studyId: scan.studyId, study: scan } }); }}
      />
    </div>
  );
}

export default PatientDetailsPage;
