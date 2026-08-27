import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiPlus, FiTrash2, FiSave, FiChevronUp, FiChevronDown,
  FiEye, FiEyeOff, FiEdit3, FiCheck, FiLayout,
  FiRotateCcw, FiRotateCw, FiAlignLeft, FiAlignCenter,
  FiAlignRight, FiAlignJustify, FiMoreVertical,
} from "react-icons/fi";
import {
  MdFormatBold, MdFormatItalic, MdFormatUnderlined, MdStrikethroughS,
  MdFormatListBulleted, MdFormatListNumbered, MdFormatClear,
} from "react-icons/md";
import { HiDocumentDuplicate } from "react-icons/hi2";
import { authFetch } from "../../../lib/api";

// ── Local storage key ─────────────────────────────────────────────────────────
const LS_KEY = "intellidiag_report_template";

// ── Default template ──────────────────────────────────────────────────────────
const DEFAULT_TEMPLATE = {
  centerInfo: {
    name: "SMART IMAGING CENTER",
    tagline: "X-Ray | CT-Scan | MRI | USG",
    address: "105-108, Smart Vision Complex, Healthcare Road, Opposite Healthcare Complex, Mumbai - 689578",
    phone: "9123456789 / 8912345678",
    email: "smartpatholab@gmail.com",
  },
  sections: [
    {
      id: "findings",
      title: "Findings",
      description: "Key imaging findings observed during the study.",
      enabled: true,
      content: "<p>The study demonstrates the following findings:</p><ul><li>Organ size and morphology appear within normal limits.</li><li>No acute abnormality identified.</li><li>Surrounding structures are unremarkable.</li></ul>",
    },
    {
      id: "impression",
      title: "Impression",
      description: "Overall radiological impression and diagnosis.",
      enabled: true,
      content: "<p><strong>Normal study.</strong> No significant pathological findings identified on the current examination.</p>",
    },
    {
      id: "recommendation",
      title: "Recommendation",
      description: "Suggested follow-up or further imaging.",
      enabled: false,
      content: "<p>Clinical correlation is recommended. Follow-up imaging may be considered if symptoms persist.</p>",
    },
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

function saveTemplate(tpl) {
  localStorage.setItem(LS_KEY, JSON.stringify(tpl));
}

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

function base64ToBlob(dataUrl) {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ── Formatting toolbar ────────────────────────────────────────────────────────

const FONTS = ["Helvetica", "Arial", "Times New Roman", "Georgia", "Courier New", "Verdana"];

// execCommand font sizes 1-7 mapped to display labels
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

function ToolbarBtn({ onClick, active, title, children, disabled }) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      disabled={disabled}
      className={`flex items-center justify-center w-10 h-10  border-none cursor-pointer transition-colors text-[14px] shrink-0 ${active
        ? "bg-white/20 text-white"
        : "bg-transparent text-[#b0b0b0] hover:bg-white/10 hover:text-white"
        } disabled:opacity-30 disabled:cursor-not-allowed`}
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
    <div className="flex items-center gap-0.5 px-3 py-2 bg-[#1E1E1E] border-b border-[#2a2a2a] flex-wrap">
      {/* Undo / Redo */}
      <ToolbarBtn onClick={() => onExec("undo")} title="Undo (Ctrl+Z)">
        <FiRotateCcw size={13} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => onExec("redo")} title="Redo (Ctrl+Y)">
        <FiRotateCw size={13} />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Font family */}
      <select
        value={currentFont}
        onChange={e => onFontChange(e.target.value)}
        onMouseDown={e => e.stopPropagation()}
        className="bg-[#2a2a2a] border border-[#3a3a3a] text-[#d0d0d0] text-[12px] rounded-md px-2 py-1 outline-none cursor-pointer h-7"
        style={{ minWidth: 100 }}
      >
        {FONTS.map(f => (
          <option key={f} value={f} style={{ background: "#222" }}>{f}</option>
        ))}
      </select>

      {/* Font size */}
      <select
        value={currentSize}
        onChange={e => onFontSizeChange(e.target.value)}
        onMouseDown={e => e.stopPropagation()}
        className="bg-[#2a2a2a] border border-[#3a3a3a] text-[#d0d0d0] text-[12px] rounded-md px-2 py-1 outline-none cursor-pointer h-7 ml-1"
        style={{ minWidth: 60 }}
      >
        {FONT_SIZES.map(s => (
          <option key={s.value} value={s.value} style={{ background: "#222" }}>{s.label}</option>
        ))}
      </select>

      <ToolbarDivider />

      {/* Bold / Italic / Underline / Strikethrough */}
      <ToolbarBtn onClick={() => onExec("bold")} active={activeFmt.bold} title="Bold (Ctrl+B)">
        <MdFormatBold size={16} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => onExec("italic")} active={activeFmt.italic} title="Italic (Ctrl+I)">
        <MdFormatItalic size={16} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => onExec("underline")} active={activeFmt.underline} title="Underline (Ctrl+U)">
        <MdFormatUnderlined size={16} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => onExec("strikeThrough")} active={activeFmt.strikeThrough} title="Strikethrough">
        <MdStrikethroughS size={16} />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarBtn onClick={() => onExec("insertUnorderedList")} active={activeFmt.insertUnorderedList} title="Bullet List">
        <MdFormatListBulleted size={16} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => onExec("insertOrderedList")} active={activeFmt.insertOrderedList} title="Numbered List">
        <MdFormatListNumbered size={16} />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Clear formatting */}
      <ToolbarBtn onClick={() => onExec("removeFormat")} title="Clear Formatting">
        <MdFormatClear size={16} />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Alignment */}
      <ToolbarBtn onClick={() => onExec("justifyLeft")} active={activeFmt.justifyLeft} title="Align Left">
        <FiAlignLeft size={13} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => onExec("justifyCenter")} active={activeFmt.justifyCenter} title="Align Center">
        <FiAlignCenter size={13} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => onExec("justifyRight")} active={activeFmt.justifyRight} title="Align Right">
        <FiAlignRight size={13} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => onExec("justifyFull")} active={activeFmt.justifyFull} title="Justify">
        <FiAlignJustify size={13} />
      </ToolbarBtn>
    </div>
  );
}

// ── Editable section content ──────────────────────────────────────────────────

function EditableSection({ section, selected, onSelect, onContentChange }) {
  const ref = useRef(null);
  const skipNextInput = useRef(false);

  // Sync incoming content into the DOM only when not focused
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.innerHTML = section.content || "";
    }
  }, [section.content]);

  const handleInput = () => {
    if (skipNextInput.current) { skipNextInput.current = false; return; }
    onContentChange(section.id, ref.current.innerHTML);
  };

  return (
    <div
      onClick={() => onSelect(section.id)}
      style={{
        marginBottom: 14,

        border: selected ? "1.5px solid #0694FB" : "1.5px solid #ffffff",
        padding: "8px 10px",
        background: selected ? "rgba(6,148,251,0.04)" : "transparent",
        transition: "border 0.2s, background 0.2s",
        cursor: "text",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15, color: "#000000", marginBottom: 6, }}>
        {section.title}:
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={() => onSelect(section.id)}
        data-placeholder={`Type your ${section.title.toLowerCase()} here…`}
        style={{
          fontSize: 12,
          color: "#333",
          minHeight: 40,
          outline: "none",
          lineHeight: 1.6,
        }}
        className="editable-section"
      />
    </div>
  );
}

// ── Report Preview ────────────────────────────────────────────────────────────

function ReportPreview({ template, selectedSectionId, onSectionSelect, onContentChange }) {
  const { centerInfo, sections, showSignatureArea, showPatientInfo, signatures = [] } = template;
  const enabled = sections.filter(s => s.enabled);

  return (
    <div
      className="bg-white rounded-b-2xl shadow-2xl overflow-hidden"
      style={{ fontFamily: "'Inter', Arial, sans-serif", minWidth: 900, maxWidth: 900, minHeight: 1273, margin: "0 auto", display: "flex", flexDirection: "column" }}
    >
      {/* ── Center header ── */}
      <div style={{ background: "#1a2d5a", padding: "25px 20px", fontFamily: "'Google Sans', Arial, sans-serif" }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div style={{ width: 48, height: 48, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#1a2d5a" }}>
            S
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

      {/* ── Address bar ── */}
      <div style={{ background: "#f5f5f5", padding: "15px 20px", fontSize: 12, color: "#666", borderBottom: "1px solid #ddd" }}>
        {centerInfo.address}
      </div>

      {/* ── Patient info block ── */}
      {showPatientInfo && (
        <div style={{ padding: "30px 50px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>Patient Name</div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>Age: — &nbsp;|&nbsp; Sex: —</div>
          </div>
          <div style={{ fontSize: 11, color: "#555", textAlign: "right" }}>
            <div><b>PID:</b> —</div>
            <div><b>Apt ID:</b> —</div>
            <div><b>Ref. By:</b> —</div>
          </div>
          <div style={{ fontSize: 11, color: "#555", textAlign: "right" }}>
            <div><b>Registered on:</b> —</div>
            <div><b>Reported on:</b> —</div>
          </div>
        </div>
      )}

      {/* ── Report type title ── */}
      <div style={{ textAlign: "left", padding: "10px 40px 6px", fontWeight: 600, fontSize: 17, color: "#000000", }}>
        Radiology Report
      </div>

      {/* ── Editable sections ── */}
      <div style={{ padding: "8px 50px 16px", flex: 1 }}>
        {enabled.length === 0 ? (
          <p style={{ color: "#aaa", textAlign: "center", fontSize: 15, margin: "24px 0" }}>
            No sections enabled — toggle sections on the left.
          </p>
        ) : (
          enabled.map(section => (
            <EditableSection
              key={section.id}
              section={section}
              selected={selectedSectionId === section.id}
              onSelect={onSectionSelect}
              onContentChange={onContentChange}
            />
          ))
        )}
      </div>

      {/* ── Signature area ── */}
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

      {/* ── Footer bar ── */}
      <div style={{ background: "#1a2d5a", padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "#90caf9", fontSize: 10 }}>Sample Collection</div>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{centerInfo.phone.split("/")[0].trim()}</div>
      </div>
    </div>
  );
}

// ── Properties panel ──────────────────────────────────────────────────────────

function PropertiesPanel({ template, selectedSectionId, onChange }) {
  const section = template.sections.find(s => s.id === selectedSectionId);

  if (section) {
    return (
      <div className="flex flex-col gap-4 mt-2">

        <p className="text-[#FFFFFF] text-[14px] font-medium m-0">Section Properties</p>


        <div className="flex flex-col gap-1.5">
          <div className="flex bg-[rgba(6,148,251,0.17)] rounded-full px-3 py-1 items-center gap-1.5 mb-1 w-fit">
            <p className="text-[#0694FB] text-[12px] font-medium m-0">Section title</p>
          </div>
          <input
            value={section.title}
            onChange={e => onChange("section_title", section.id, e.target.value)}
            className="w-full bg-[#111] border border-[#1E1E1E] text-white text-[14px] rounded-xl px-3 py-2 outline-none focus:border-[#0694FB]/40"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex bg-[rgba(6,148,251,0.17)] rounded-full px-3 py-1 items-center gap-1.5 mb-1 w-fit">
            <p className="text-[#0694FB] text-[12px] font-medium m-0">Description</p>
          </div>
          <textarea
            value={section.description || ""}
            onChange={e => onChange("section_description", section.id, e.target.value)}
            rows={3}
            placeholder="Brief description of what this section covers…"
            className="w-full bg-[#111] border border-[#1E1E1E] text-white text-[14px] rounded-xl px-3 py-2 outline-none focus:border-[#0694FB]/40 resize-none placeholder-[#3a3a3a]"
          />
          <p className="text-[#3a3a3a] text-[11px] m-0">Shown below the section title in the sidebar.</p>
        </div>

        <div className="flex items-center justify-between py-2 border-t border-[#1E1E1E]">
          <span className="text-[#ffffff] text-[14px]">Enable section</span>
          <button
            onClick={() => onChange("section_toggle", section.id)}
            className={`relative w-10 h-5 rounded-full border-none cursor-pointer transition-colors ${section.enabled ? "bg-[#0694FB]" : "bg-[#2a2a2a]"}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${section.enabled ? "left-5" : "left-0.5"}`} />
          </button>
        </div>

        <p className="text-[#3a3a3a] text-[11px] m-0 leading-relaxed">
          Click directly inside the section in the preview to type content. Use the toolbar above to format it.
        </p>
      </div>
    );
  }

  const { centerInfo, showSignatureArea, showPatientInfo } = template;

  return (
    <div className="flex flex-col gap-4 pt-2">
      <p className="text-[#FFFFFF] text-[14px] font-medium m-0">Center Information</p>

      {[
        { key: "name", label: "Center Name" },
        { key: "tagline", label: "Tagline" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
      ].map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-1.5">
          <div className="flex bg-[rgba(6,148,251,0.17)] rounded-full px-3 py-1 items-center gap-1.5 mb-1 w-fit">
            <p className="text-[#0694FB] text-[12px] font-medium m-0">{label}</p>
          </div>
          <input
            value={centerInfo[key]}
            onChange={e => onChange("center", key, e.target.value)}
            className="w-full bg-[#111] border border-[#1E1E1E] text-white text-[14px] rounded-xl px-3 py-2 outline-none focus:border-[#0694FB]/40"
          />
        </div>
      ))}

      <div className="flex flex-col gap-1.5">
        <label className="text-[#A0A0A0] text-[14px]">Address</label>
        <textarea
          value={centerInfo.address}
          onChange={e => {
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
            onChange("center", "address", e.target.value);
          }}
          rows={2}
          className="w-full bg-[#111] border border-[#1E1E1E] text-white text-[14px] rounded-xl px-3 py-2 outline-none focus:border-[#0694FB]/40 resize-none overflow-hidden"
          style={{ height: "auto", minHeight: "3rem" }}
          ref={el => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
        />
      </div>

      <div className="border-t border-[#1E1E1E] pt-4 flex flex-col gap-3">
        <div className="flex bg-[rgba(6,148,251,0.17)] rounded-full px-3 py-1 items-center gap-1.5 mb-1 w-fit">
          <p className="text-[#0694FB] text-[12px] font-medium m-0">Layout Options</p>
        </div>

        {[
          { key: "showPatientInfo", label: "Show Patient Info Block" },
          { key: "showSignatureArea", label: "Show Signature Area" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-[#e2e2e2] text-[14px]">{label}</span>
            <button
              onClick={() => onChange("layout", key)}
              className={`relative w-10 h-5 rounded-full border-none cursor-pointer transition-colors ${template[key] ? "bg-[#0694FB]" : "bg-[#2a2a2a]"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${template[key] ? "left-5" : "left-0.5"}`} />
            </button>
          </div>
        ))}
      </div>

      {/* ── Signatures ── */}
      {template.showSignatureArea && (
        <div className="border-t border-[#1E1E1E] pt-4 flex flex-col gap-3">
          <div className="flex bg-[rgba(6,148,251,0.17)] rounded-full px-3 py-1 items-center gap-1.5 w-fit">
            <p className="text-[#0694FB] text-[12px] font-medium m-0">Signatures</p>
          </div>

          {(template.signatures || []).map(sig => (
            <SignatureSlot key={sig.id} sig={sig} onChange={onChange} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Signature upload slot ─────────────────────────────────────────────────────

function SignatureSlot({ sig, onChange }) {
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange("sig_image", sig.id, ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl bg-[#111] border border-[#1E1E1E]">
      <input
        value={sig.role}
        onChange={e => onChange("sig_role", sig.id, e.target.value)}
        placeholder="Role"
        className="bg-transparent border-b border-[#2a2a2a] text-white text-[12px] font-medium outline-none pb-1 focus:border-[#0694FB] transition-colors"
      />
      <input
        value={sig.name}
        onChange={e => onChange("sig_name", sig.id, e.target.value)}
        placeholder="Full name (optional)"
        className="bg-transparent text-[#A0A0A0] text-[11px] outline-none focus:text-white transition-colors"
      />

      {sig.image ? (
        <div className="flex flex-col gap-1.5">
          <img src={sig.image} alt={sig.role} className="w-full max-h-16 object-contain rounded-lg border border-[#2a2a2a] bg-white p-1" />
          <button
            onClick={() => onChange("sig_clear", sig.id)}
            className="text-[11px] text-red-400 hover:text-red-300 bg-transparent border-none cursor-pointer text-left transition-colors"
          >
            Remove signature
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current.click()}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed border-[#2a2a2a] text-[#6B6B6B] hover:text-white hover:border-[#0694FB]/40 text-[11px] cursor-pointer bg-transparent transition-colors"
        >
          Upload signature image
        </button>
      )}

      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
}

// ── Section list row ──────────────────────────────────────────────────────────

// ── Section list row ──────────────────────────────────────────────────────────

function SectionRow({ section, index, total, onToggle, onDelete, onMove, onRename, selected, onSelect }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== section.title) onRename(section.id, trimmed);
    setEditing(false);
  };

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const menuItem = (label, icon, onClick, danger = false, disabled = false) => (
    <button
      onMouseDown={e => { e.stopPropagation(); if (disabled) return; setMenuOpen(false); onClick(); }}
      disabled={disabled}
      className={`flex items-center gap-2 w-full px-3 py-2 text-[12px] border-none bg-transparent text-left transition-colors ${disabled
        ? "text-[#3a3a3a] cursor-not-allowed"
        : danger
          ? "text-red-400 hover:bg-red-500/10 cursor-pointer"
          : "text-[#C0C0C0] hover:bg-white/5 hover:text-white cursor-pointer"
        }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div
      onClick={() => onSelect(section.id)}
      className={`group flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-all ${selected
        ? "bg-[rgba(6,148,251,0.17)] text-[#0694FB] rounded-[10px]"
        : "bg-transparent text-[#A0A0A0] hover:bg-[rgba(6,148,251,0.17)] rounded-[10px] hover:text-[#0694FB]"
        } ${!section.enabled ? "opacity-40" : ""}`}
    >
      <span className={`text-[14px] w-4 shrink-0 ${selected ? "text-[#0694FB]" : "text-[#a0a0a0]"}`}>{index + 1}</span>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditing(false); }}
            onClick={e => e.stopPropagation()}
            className="w-full bg-transparent border-b border-[#0694FB] text-white text-[15.5px] outline-none"
          />
        ) : (
          <>
            <span className="text-[15px] truncate block leading-tight">{section.title}</span>
            {/* {section.description && (
              <span className="text-[12px] text-[#ffffff9a] truncate block">{section.description}</span>
            )} */}
          </>
        )}
      </div>

      {/* ⋮ menu trigger */}
      <div className="relative shrink-0" ref={menuRef} onClick={e => e.stopPropagation()}>
        <button
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setMenuOpen(v => !v); }}
          className="flex items-center justify-center w-6 h-6 rounded-md border-none bg-transparent text-[#6B6B6B] hover:text-white hover:bg-white/10 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <FiMoreVertical size={14} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-7 z-50 w-44 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden py-1">
            {menuItem("Rename", <FiEdit3 size={12} />, () => { setDraft(section.title); setEditing(true); })}
            {menuItem("Move Up", <FiChevronUp size={12} />, () => onMove(index, -1), false, index === 0)}
            {menuItem("Move Down", <FiChevronDown size={12} />, () => onMove(index, 1), false, index === total - 1)}
            {menuItem(
              section.enabled ? "Hide Section" : "Show Section",
              section.enabled ? <FiEyeOff size={12} /> : <FiEye size={12} />,
              () => onToggle(section.id)
            )}
            <div className="my-1 border-t border-[#2a2a2a]" />
            {menuItem("Delete", <FiTrash2 size={12} />, () => onDelete(section.id), true)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Active formatting state ───────────────────────────────────────────────────

const FMT_CMDS = ["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList", "justifyLeft", "justifyCenter", "justifyRight", "justifyFull"];

function getActiveFmt() {
  const state = {};
  FMT_CMDS.forEach(cmd => {
    try { state[cmd] = document.queryCommandState(cmd); } catch { state[cmd] = false; }
  });
  return state;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportTemplateEditor() {
  const [template, setTemplate] = useState(loadTemplate);
  const [templateId, setTemplateId] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeFmt, setActiveFmt] = useState({});
  const [currentFont, setCurrentFont] = useState("Helvetica");
  const [currentSize, setCurrentSize] = useState("4"); // 14px

  // Load from API on mount; fall back to localStorage if unavailable
  useEffect(() => {
    const baseURL = process.env.REACT_APP_API_URL || "";
    authFetch(`${baseURL}/report-templates/`)
      .then(async res => {
        if (!res.ok) return;
        const data = await res.json();
        const record = Array.isArray(data) ? data[0] : data;
        if (record?.template) {
          setTemplateId(record.id);
          setTemplate(record.template);
        }
      })
      .catch(() => { /* keep localStorage fallback */ });
  }, []);

  // Update toolbar state on any selection change
  useEffect(() => {
    const update = () => setActiveFmt(getActiveFmt());
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  const mutate = useCallback(fn => setTemplate(prev => fn(JSON.parse(JSON.stringify(prev)))), []);

  const handleChange = useCallback((type, keyOrId, value) => {
    mutate(tpl => {
      if (type === "center") {
        tpl.centerInfo[keyOrId] = value;
      } else if (type === "layout") {
        tpl[keyOrId] = !tpl[keyOrId];
      } else if (type === "section_title") {
        const s = tpl.sections.find(s => s.id === keyOrId);
        if (s) s.title = value;
      } else if (type === "section_description") {
        const s = tpl.sections.find(s => s.id === keyOrId);
        if (s) s.description = value;
      } else if (type === "section_toggle") {
        const s = tpl.sections.find(s => s.id === keyOrId);
        if (s) s.enabled = !s.enabled;
      } else if (type === "sig_name") {
        const s = tpl.signatures.find(s => s.id === keyOrId);
        if (s) s.name = value;
      } else if (type === "sig_role") {
        const s = tpl.signatures.find(s => s.id === keyOrId);
        if (s) s.role = value;
      } else if (type === "sig_image") {
        const s = tpl.signatures.find(s => s.id === keyOrId);
        if (s) s.image = value;
      } else if (type === "sig_clear") {
        const s = tpl.signatures.find(s => s.id === keyOrId);
        if (s) s.image = null;
      }
      return tpl;
    });
  }, [mutate]);

  const handleContentChange = useCallback((id, html) => {
    mutate(tpl => {
      const s = tpl.sections.find(s => s.id === id);
      if (s) s.content = html;
      return tpl;
    });
  }, [mutate]);

  const handleToggle = id => handleChange("section_toggle", id);

  const handleDelete = id => {
    mutate(tpl => { tpl.sections = tpl.sections.filter(s => s.id !== id); return tpl; });
    if (selectedSectionId === id) setSelectedSectionId(null);
  };

  const handleMove = (index, dir) => {
    mutate(tpl => {
      const arr = tpl.sections;
      const next = index + dir;
      if (next < 0 || next >= arr.length) return tpl;
      [arr[index], arr[next]] = [arr[next], arr[index]];
      return tpl;
    });
  };

  const handleRename = (id, newTitle) => {
    mutate(tpl => {
      const s = tpl.sections.find(s => s.id === id);
      if (s) s.title = newTitle;
      return tpl;
    });
  };

  const handleAddSection = () => {
    const newSection = { id: genId(), title: "New Section", description: "", enabled: true, content: "" };
    mutate(tpl => { tpl.sections.push(newSection); return tpl; });
    setSelectedSectionId(newSection.id);
  };

  const handleExec = cmd => {
    exec(cmd);
    setActiveFmt(getActiveFmt());
  };

  const handleFontChange = font => {
    setCurrentFont(font);
    exec("fontName", font);
  };

  const handleFontSizeChange = size => {
    setCurrentSize(size);
    exec("fontSize", size);
  };

  const handleSave = async () => {
    setSaving(true);
    const baseURL = process.env.REACT_APP_API_URL || "";
    try {
      let id = templateId;

      // Step 1: Create the template record if it doesn't exist yet (images stripped)
      if (!id) {
        const payload = {
          name: template.centerInfo.name || "Default Template",
          template: {
            ...template,
            signatures: template.signatures.map(s => ({ ...s, image: null })),
          },
        };
        const res = await authFetch(`${baseURL}/report-templates/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("POST /report-templates/ failed");
        const data = await res.json();
        id = data.id;
        setTemplateId(id);
      }

      // Step 2: Upload any base64 signature images and collect returned URLs
      const updatedSignatures = template.signatures.map(s => ({ ...s }));
      for (const sig of updatedSignatures) {
        if (sig.image && sig.image.startsWith("data:")) {
          const blob = base64ToBlob(sig.image);
          const ext = blob.type.split("/")[1] || "png";
          const fd = new FormData();
          fd.append("image", blob, `signature_${sig.id}.${ext}`);
          const res = await authFetch(
            `${baseURL}/report-templates/${id}/signatures/${sig.id}/image`,
            { method: "POST", body: fd },
          );
          if (res.ok) {
            const data = await res.json();
            sig.image = data.image_url;
          }
        }
      }

      // Step 3: PATCH the full template with resolved image URLs
      await authFetch(`${baseURL}/report-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.centerInfo.name || "Default Template",
          template: { ...template, signatures: updatedSignatures },
        }),
      });

      // Reflect signed URLs in local state so base64 blobs are replaced
      setTemplate(prev => ({ ...prev, signatures: updatedSignatures }));

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Save failed:", err);
      // Fallback: persist to localStorage so work isn't lost
      saveTemplate(template);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setTemplate(DEFAULT_TEMPLATE);
    setSelectedSectionId(null);
  };

  return (
    <>
      {/* Placeholder styling for empty editable sections */}
      <style>{`
        .editable-section:empty:before {
          content: attr(data-placeholder);
          color: #aaa;
          font-style: italic;
          pointer-events: none;
        }
        .editable-section:focus { outline: none; }
      `}</style>

      <div className="flex-1 min-w-0 h-full flex flex-col min-h-0">
        {/* ── Page header ── */}
        <motion.div
          className="shrink-0 mb-6 flex items-start justify-between"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        >
          <div>
            <h1 className="m-0 text-white text-[35px] font-medium">Report Templates</h1>
            <p className="m-0 text-[#999898] text-[13px] mt-0.5">Design the layout that generated reports will follow</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-transparent border border-[#1E1E1E] text-[#6B6B6B] hover:text-white hover:border-[#2a2a2a] text-[13px] cursor-pointer transition-all"
            >
              Reset to default
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-[13px] font-medium cursor-pointer border-none transition-all disabled:opacity-60 disabled:cursor-not-allowed ${saved ? "bg-emerald-500 text-white" : "bg-[#0694FB] hover:bg-[#0578d1] text-white"
                }`}
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : saved ? (
                <FiCheck size={14} />
              ) : (
                <div></div>
              )}
              {saving ? "Saving…" : saved ? "Saved!" : "Save Template"}
            </button>
          </div>
        </motion.div>

        {/* ── 3-column layout ── */}
        <div className="flex flex-row gap-4 min-h-0 overflow-hidden">

          {/* LEFT: Sections list */}
          <motion.div
            className="w-[300px] shrink-0 flex flex-col gap-3 bg-[#161616] border border-[#1E1E1E] rounded-2xl p-4 overflow-y-auto"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <p className="text-[#FFFFFF] text-[14px] font-medium m-0">Sections</p>

            <div
              onClick={() => setSelectedSectionId(null)}
              className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer border transition-all text-[14px] ${selectedSectionId === null
                ? "bg-[rgba(6,149,251,0.3)] border-[#0694FB]/30 text-white"
                : "bg-[#111] border-[#1E1E1E] text-[#6e6e6e] hover:text-white hover:border-[#2a2a2a] font-medium"
                }`}
            >
              <HiDocumentDuplicate size={13} />
              Center & Layout
            </div>

            <div className="w-full h-px bg-[#1E1E1E] shrink-0" />

            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <AnimatePresence initial={false}>
                {template.sections.map((section, i) => (
                  <motion.div
                    key={section.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <SectionRow
                      section={section}
                      index={i}
                      total={template.sections.length}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onMove={handleMove}
                      onRename={handleRename}
                      selected={selectedSectionId === section.id}
                      onSelect={setSelectedSectionId}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <button
              onClick={handleAddSection}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-dashed border-[#1E1E1E] text-[#a0a0a0] hover:text-white hover:border-[#0694FB]/40 text-[12px] cursor-pointer bg-transparent transition-colors shrink-0"
            >
              <FiPlus size={13} />
              Add Section
            </button>
          </motion.div>

          {/* CENTER: Toolbar + Live preview */}
          <motion.div
            className="flex-1 min-w-0 overflow-hidden flex flex-col bg-[#0C0C0C] border border-[#1E1E1E]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08 }}
          >
            {/* Toolbar */}
            <Toolbar
              activeFmt={activeFmt}
              onExec={handleExec}
              onFontChange={handleFontChange}
              onFontSizeChange={handleFontSizeChange}
              currentFont={currentFont}
              currentSize={currentSize}
            />

            {/* Scrollable preview area — the paper has minWidth:900 so it never squishes */}
            <div
              className="flex-1 min-h-0 overflow-auto p-6 max-w-[900px]"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
            >
              <ReportPreview
                template={template}
                selectedSectionId={selectedSectionId}
                onSectionSelect={setSelectedSectionId}
                onContentChange={handleContentChange}
              />
            </div>
          </motion.div>

          {/* RIGHT: Properties */}
          <motion.div
            className="w-[350px] shrink-0 overflow-y-auto bg-[#161616] border border-[#1E1E1E] rounded-2xl p-4"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <PropertiesPanel
              template={template}
              selectedSectionId={selectedSectionId}
              onChange={handleChange}
            />
          </motion.div>
        </div>
      </div>
    </>
  );
}
