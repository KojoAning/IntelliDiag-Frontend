import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Appbar from "../appbar/appbar";
import Sidebar from "../sidebar/Sidebar";
import AddStudyModal from "./AddStudyModal";
import NewReportModal from "./NewReportModal";
import ReportViewModal from "./ReportViewModal";
import {
  FiArrowLeft, FiDownload, FiMaximize2,
  FiUser, FiFileText, FiChevronDown, FiChevronUp, FiFolder, FiX,
} from "react-icons/fi";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.32, 0.72, 0, 1], delay: i * 0.08 },
  }),
};

// ─── Mock data ────────────────────────────────────────────────────────────────
const mockPatients = [
  { id: 1, name: "Darrell Steward", age: 32, gender: "Male", urgency: "Immediate", mrn: "6864558", dob: "1992-03-14", referringPhysician: "Dr. James Osei", studyDate: "Jan 15, 2024", accession: "ACC-2024-00112", modality: "MRI", region: "Right Forearm", clinicalIndication: "Evaluate suspected radial shaft injury following sports trauma. Rule out fracture or ligament damage." },
  { id: 2, name: "Bessie Cooper", age: 28, gender: "Female", urgency: "Immediate", mrn: "6809137", dob: "1996-07-22", referringPhysician: "Dr. Ama Sarpong", studyDate: "Jan 15, 2024", accession: "ACC-2024-00113", modality: "X-Ray", region: "Left Shoulder", clinicalIndication: "Recurrent shoulder pain with limited range of motion. Assess for tendon calcification or bone spurs." },
  { id: 3, name: "Jennifer Richardson", age: 39, gender: "Female", urgency: "Less Urgent", mrn: "1453029", dob: "1985-11-05", referringPhysician: "Dr. Kwame Boateng", studyDate: "Jan 14, 2024", accession: "ACC-2024-00098", modality: "MRI", region: "Cervical Spine", clinicalIndication: "Chronic neck stiffness with radiating pain to the upper extremities. Rule out disc herniation at C5-C7." },
  { id: 4, name: "Jane Cooper", age: 54, gender: "Female", urgency: "Less Urgent", mrn: "3407430", dob: "1970-01-30", referringPhysician: "Dr. Efua Mensah", studyDate: "Jan 14, 2024", accession: "ACC-2024-00099", modality: "CT", region: "Lumbar Spine", clinicalIndication: "Follow-up imaging for known L4-L5 disc herniation. Evaluate progression and nerve root impingement." },
  { id: 5, name: "Jenny Wilson", age: 23, gender: "Female", urgency: "Emergency", mrn: "2186613", dob: "2001-08-18", referringPhysician: "Dr. James Osei", studyDate: "Jan 15, 2024", accession: "ACC-2024-00120", modality: "MRI", region: "Bilateral Knees", clinicalIndication: "Acute bilateral knee pain, joint swelling. Rule out autoimmune arthropathy or ligament tear." },
  { id: 6, name: "Cameron Williamson", age: 34, gender: "Male", urgency: "Emergency", mrn: "6088224", dob: "1990-05-09", referringPhysician: "Dr. Ama Sarpong", studyDate: "Jan 15, 2024", accession: "ACC-2024-00121", modality: "MRI", region: "Right Knee — ACL", clinicalIndication: "Suspected Grade II ACL tear following contact sports injury. Assess ligament integrity and meniscal involvement." },
  { id: 7, name: "Dianne Russell", age: 46, gender: "Female", urgency: "Immediate", mrn: "6565607", dob: "1978-12-03", referringPhysician: "Dr. Kwame Boateng", studyDate: "Jan 13, 2024", accession: "ACC-2024-00089", modality: "CT", region: "Lumbar Spine", clinicalIndication: "Lumbar spinal stenosis with bilateral leg pain. Evaluate canal diameter and foraminal narrowing prior to surgical planning." },
  { id: 8, name: "Brooklyn Simmons", age: 37, gender: "Female", urgency: "Immediate", mrn: "5385925", dob: "1987-04-27", referringPhysician: "Dr. Efua Mensah", studyDate: "Jan 13, 2024", accession: "ACC-2024-00090", modality: "Ultrasound", region: "Right Shoulder", clinicalIndication: "Right shoulder pain with weakness on abduction. Rule out rotator cuff tear, assess supraspinatus tendon integrity." },
];

const mockScans = [
  { id: 1, modality: "MRI", label: "MRI Knee", series: "Series 1 — 24 images", date: "Jan 15, 2024", studyId: "study-1" },
  { id: 2, modality: "MRI", label: "CT-Chest", series: "Series 2 — 18 images", date: "Jan 15, 2024", studyId: "study-1" },
  { id: 3, modality: "X-Ray", label: "X-Ray Right Wrist", series: "Series 3 — 2 images", date: "Jan 10, 2024", studyId: "study-3" },
  { id: 4, modality: "CT", label: "Sagittal Recon", series: "Series 4 — 32 images", date: "Dec 28, 2023", studyId: "study-2" },
];

const mockAIFindings = [
  {
    model: "Fracture Detection",
    modelId: "FD-v2.1",
    tag: "Fracture",
    tagColor: "text-[#FF6B35] bg-[rgba(255,107,53,0.17)]",
    confidence: 91,
    status: "Positive",
    statusColor: "text-[#FF6B35]",
    findings: [
      { region: "Radial shaft — mid-diaphysis", observation: "Hairline cortical discontinuity identified. Consistent with non-displaced stress fracture.", severity: "Moderate" },
      { region: "Distal ulna", observation: "No acute fracture identified. Cortical margins intact.", severity: "Normal" },
    ],
  },
  {
    model: "Soft Tissue Analyser",
    modelId: "STA-v1.4",
    tag: "Ligament Injury",
    tagColor: "text-[#A855F7] bg-[rgba(168,85,247,0.17)]",
    confidence: 78,
    status: "Inconclusive",
    statusColor: "text-[#F59E0B]",
    findings: [
      { region: "Interosseous membrane", observation: "Mild thickening noted. May indicate early inflammatory response. Clinical correlation advised.", severity: "Mild" },
    ],
  },
];

const mockReports = [
  { id: 1, title: "MRI Knee — Radiology Report", radiologist: "Dr. James Osei", date: "Jan 16, 2024", status: "Signed", modality: "MRI" },
  { id: 2, title: "CT Chest — Preliminary Report", radiologist: "Dr. Ama Sarpong", date: "Jan 11, 2024", status: "Draft", modality: "CT" },
  { id: 3, title: "X-Ray Right Wrist — Final Report", radiologist: "Dr. Kwame Boateng", date: "Dec 29, 2023", status: "Signed", modality: "X-Ray" },
];

const mockDocuments = [
  { id: 1, name: "Consent Form — MRI Procedure", type: "PDF", size: "124 KB", uploadedBy: "Dr. James Osei", date: "Jan 15, 2024", category: "Consent" },
  { id: 2, name: "Referral Letter — Orthopaedics", type: "PDF", size: "88 KB", uploadedBy: "Dr. Ama Sarpong", date: "Jan 14, 2024", category: "Referral" },
  { id: 3, name: "Insurance Pre-Auth — MRI Knee", type: "PDF", size: "201 KB", uploadedBy: "Admin", date: "Jan 13, 2024", category: "Insurance" },
  { id: 4, name: "Previous Surgical History", type: "DOCX", size: "56 KB", uploadedBy: "Dr. Kwame Boateng", date: "Dec 10, 2023", category: "History" },
  { id: 5, name: "Lab Results — CBC Panel", type: "PDF", size: "310 KB", uploadedBy: "Lab Team", date: "Nov 28, 2023", category: "Lab" },
];

const categoryColors = {
  Consent: "text-[#0694FB] bg-[rgba(6,148,251,0.12)]",
  Referral: "text-[#A855F7] bg-[rgba(168,85,247,0.12)]",
  Insurance: "text-[#F59E0B] bg-[rgba(245,158,11,0.12)]",
  History: "text-[#22C55E] bg-[rgba(34,197,94,0.12)]",
  Lab: "text-[#FF6B35] bg-[rgba(255,107,53,0.12)]",
};

const fileIconColor = { PDF: "#FF6B35", DOCX: "#0694FB", PNG: "#22C55E", JPG: "#22C55E" };

const mockNotes = [
  { id: 1, author: "Dr. James Osei", role: "Radiologist", date: "Jan 16, 2024", time: "09:41 AM", content: "Patient presents with persistent knee pain post-sports injury. MRI confirms Grade II ACL involvement. Recommend orthopaedic referral." },
  { id: 2, author: "Dr. Ama Sarpong", role: "Referring Physician", date: "Jan 15, 2024", time: "03:15 PM", content: "Urgent imaging requested. Patient reported acute onset pain. Please prioritise CT chest review for pulmonary involvement." },
];

const mockPriorStudies = [
  { date: "Aug 22, 2023", modality: "X-Ray", region: "Right Wrist", indication: "Post-fall wrist pain", accession: "ACC-2023-00451" },
  { date: "Mar 10, 2023", modality: "MRI", region: "Right Forearm", indication: "Sports injury follow-up", accession: "ACC-2023-00201" },
  { date: "Nov 04, 2022", modality: "CT", region: "Chest", indication: "Annual screening", accession: "ACC-2022-00893" },
];

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

function DocumentsSection() {
  const [docs] = useState(mockDocuments);
  const [search, setSearch] = useState("");
  const filtered = docs.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-[#161616] border border-[#1E1E1E] rounded-2xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-white text-[19px]">Patient Documents</span>
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
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E1E1E] text-[#6B6B6B] text-[12px] bg-transparent hover:text-white hover:border-[#2a2a2a] cursor-pointer transition-all whitespace-nowrap">
            <FiFolder size={12} /> Upload
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_60px_130px_100px_32px] gap-3 px-3 pb-2 border-b border-[#1E1E1E]">
        {["Document", "Type", "Uploaded by", "Date", ""].map((h) => (
          <p key={h} className="text-[#6B6B6B] text-[10px] uppercase tracking-wide m-0">{h}</p>
        ))}
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-0.5">
        {filtered.length === 0 ? (
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
            <button className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg border border-[#1E1E1E] bg-transparent hover:bg-[#1a1a1a] cursor-pointer transition-all">
              <FiDownload size={12} color="#6B6B6B" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function NoteSection({ patient }) {
  const [notes, setNotes] = useState(mockNotes);
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
                        {scan.flagged && <span className={`text-[11px] font-normal px-1.5 py-0.5 rounded ${modalityColors[scan.modality]}`}>AI Flagged</span>}
                      </div>
                      <p className="text-white text-[15px] font-normal m-0 truncate">{scan.label}</p>
                      <p className="text-[#636363] text-[12px] m-0">{scan.date}</p>
                     
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
  const patient = state?.patient || mockPatients.find((p) => p.id === Number(id)) || mockPatients[0];
  const caseId = state?.caseId || patient?.case_id;
  const [activeStudy, setActiveStudy] = useState(null);
  const [addStudyOpen, setAddStudyOpen] = useState(false);
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
            id: s.id,
            modality: s.modality,
            label: s.study_name,
            date: s.study_date ? new Date(s.study_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
            studyId: s.id,
            flagged: s.flagged,
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
  return (
    <div className="m-0 p-0 h-screen bg-black w-screen">
      <div className="flex flex-col px-[33px] py-[28px] w-full h-screen box-border overflow-hidden">
        <Appbar />

        <div className="w-full flex flex-row gap-[30px] box-border mt-[30px] flex-1 min-h-0">
          <Sidebar activePage="Cases" />

          <div className="flex flex-col flex-1 min-w-0 overflow-y-auto gap-5 pr-1 pb-4 mt-0 pt-0">

            {/* ── Top bar ── */}
            <div className="flex items-center justify-between shrink-0">
              {/* <button onClick={() => navigate("/cases")} className="flex items-center gap-2 text-[#6B6B6B] hover:text-white text-sm cursor-pointer bg-transparent border-none transition-colors">
                <FiArrowLeft size={15} /> Back to Cases
              </button> */}
              {/* <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#1E1E1E] text-[#6B6B6B] text-sm bg-transparent hover:text-white hover:border-[#2a2a2a] cursor-pointer transition-all">
                  <FiFileText size={13} /> Export Report
                </button>
                <button onClick={() => navigate("/case-workspace")} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0694FB] hover:bg-[#0578d1] text-white text-sm font-medium border-none cursor-pointer transition-colors">
                  <FiMaximize2 size={13} /> Open in Workspace
                </button>
              </div> */}
            </div>

            {/* ── Body ── */}
            <div className="flex gap-5 flex-1 min-h-0">

              <div className="flex flex-col  flex-1 min-w-0 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}>

                <motion.div className="flex flex-row justify-between" variants={fadeUp} initial="hidden" animate="show" custom={0}>
                  <h1 className="m-0 text-white font-medium text-[40px] md:text-[32px] leading-[1.2] mt-0 mb-3">Patient <span className="text-[#0694FB]">Case</span></h1>
                </motion.div>
                {/* Profile card */}
                <motion.div className=" rounded-2xl p-5 flex gap-5 shrink-0 relative mb-5" variants={fadeUp} initial="hidden" animate="show" custom={1}>
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
                        className="w-[62px] h-[62px] rounded-full flex-shrink-0"
                      />
                      <div className="text-left">
                        <p className="text-white text-[18px] font-normal m-0 leading-tight">{patient.name}</p>
                        <p className="text-[#696969] text-[15px] m-0 mt-0.5 font-mono">MRN {patient.mrn}</p>
                      </div>
                    </div>
                  </div>


                  {/* Divider */}
                  <div className="w-px bg-[#1E1E1E] shrink-0 self-stretch" />

                  {/* Stats grid */}
                  <div className="grid grid-cols-4 gap-x-6 gap-y-[25px] flex-1 content-center">
                    {[
                      { label: "Sex", value: patient.gender },
                      { label: "Age", value: `${patient.age} yrs` },
                      { label: "Blood", value: "A+" },
                      { label: "Urgency", value: patient.urgency },
                      { label: "Modality", value: patient.modality },
                      { label: "Region", value: patient.region },
                      { label: "Study Date", value: patient.studyDate },
                      { label: "Accession", value: patient.accession },
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
                      <span className="text-white text-[19px]">Imaging Studies</span>
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
                        onClick={() => navigate("/case-workspace", { state: { studyId: scan.studyId } })}
                        className="group relative flex flex-col items-start gap-3 bg-[#111] border border-[#1E1E1E] rounded-2xl p-5 cursor-pointer hover:border-[#0694FB] hover:bg-[rgba(6,148,251,0.04)] transition-all duration-200"
                      >
                        {/* Ellipsis */}
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg border-none cursor-pointer transition-colors duration-200"
                          style={{ background: "rgba(255,255,255,0.07)" }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.13)"}
                          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                        >
                          <span className="text-[#aaaaaa] text-[14px] leading-none tracking-widest">···</span>
                        </button>
                        <img src="/folder.png" alt="folder" className="w-20 h-20 object-contain self-start group-hover:scale-105 transition-transform duration-200" />
                        <div className=" w-full">
                          <div className="flex gap-1.5 flex-wrap"> <span className={`text-[12px] font-normal px-1.5 py-0.5 rounded ${modalityColors[scan.modality]}`}>{scan.modality}</span> {scan.flagged && <span className={`text-[12px] font-normal px-1.5 py-0.5 rounded ${modalityColors[scan.modality]}`}>AI Flagged</span>}</div>

                          <p className="text-white text-[15px] font-normal m-0 mt-1.5 truncate">{scan.label}</p>
                          {/* <p className="text-[#6B6B6B] text-[12px] m-0 mt-0.5">{scan.series}</p> */}
                          <p className="text-[#636363] text-[12px] m-0">{scan.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Reports */}
                <motion.div className="bg-[#161616] border border-[#1E1E1E] rounded-2xl p-5 mb-6" variants={fadeUp} initial="hidden" animate="show" custom={3}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-white text-[19px]">Patient Reports</span>
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
                  <DocumentsSection />
                </motion.div>

                {/* Notes */}
                <motion.div variants={fadeUp} initial="hidden" animate="show" custom={5}>
                  <NoteSection patient={patient} />
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddStudyModal isOpen={addStudyOpen} onClose={() => setAddStudyOpen(false)} caseId={caseId} onCreated={fetchStudies} />
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
        onOpen={(scan) => { setStudiesOpen(false); navigate("/case-workspace", { state: { studyId: scan.studyId } }); }}
      />
    </div>
  );
}

export default PatientDetailsPage;
