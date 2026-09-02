import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiEdit2, FiCheck } from "react-icons/fi";
import { authFetch } from "../../../lib/api";

const inputCls = "w-full bg-[#111111] border border-[#1E1E1E] rounded-xl px-4 py-2.5 text-white text-sm outline-none placeholder-[#3a3a3a] focus:border-[#0694FB] transition-colors";
const labelCls = "text-[#6B6B6B] text-xs mb-1.5 block";

const modalityColors = {
  MR:         "text-[#0694FB] bg-[rgba(6,148,251,0.15)]",
  CT:         "text-[#F59E0B] bg-[rgba(245,158,11,0.15)]",
  "X-Ray":    "text-[#22C55E] bg-[rgba(34,197,94,0.15)]",
  Ultrasound: "text-[#A855F7] bg-[rgba(168,85,247,0.15)]",
  PET:        "text-[#EC4899] bg-[rgba(236,72,153,0.15)]",
};

const statusOptions = [
  { value: "Draft",  color: "text-[#F59E0B] bg-[rgba(245,158,11,0.1)] border-[rgba(245,158,11,0.3)]" },
  { value: "Signed", color: "text-[#22C55E] bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.3)]" },
];

function ReportViewModal({ isOpen, onClose, report, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (report) setForm({
      title:       report.title       || "",
      radiologist: report.radiologist || "",
      modality:    report.modality    || "",
      status:      report.status      || "Draft",
      notes:       report.notes       || "",
    });
    setEditing(false);
    setError("");
  }, [report]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const baseURL = process.env.REACT_APP_API_URL || "";
      const res = await authFetch(`${baseURL}/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || "Failed to update report");
      }
      setEditing(false);
      onUpdated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!report) return null;

  const currentStatus = editing ? form.status : report.status;
  const statusColor = currentStatus === "Signed"
    ? "text-[#22C55E] bg-[rgba(34,197,94,0.12)]"
    : "text-[#F59E0B] bg-[rgba(245,158,11,0.12)]";

  const date = report.created_at
    ? new Date(report.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";

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
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-[560px] max-h-[90vh] bg-[#161616] border border-[#1E1E1E] rounded-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-7 pt-6 pb-5">
              <div className="flex-1 min-w-0 pr-4">
                {editing ? (
                  <input
                    value={form.title}
                    onChange={e => set("title", e.target.value)}
                    className={inputCls}
                    placeholder="Report title"
                  />
                ) : (
                  <h2 className="text-white text-[17px] font-medium m-0 leading-snug truncate">{report.title}</h2>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
                    {currentStatus || "Draft"}
                  </span>
                  {date && <span className="text-[#3a3a3a] text-[11px]">{date}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#1E1E1E] bg-transparent text-[#6B6B6B] hover:text-white hover:border-[#2a2a2a] cursor-pointer transition-all"
                  >
                    <FiEdit2 size={13} />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none"
                >
                  <FiX size={18} />
                </button>
              </div>
            </div>

            <div className="h-px bg-[#1E1E1E] mx-7" />

            {/* Body */}
            <div
              className="overflow-y-auto flex-1 px-7 py-5 flex flex-col gap-4"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={labelCls}>Radiologist</p>
                  {editing ? (
                    <input value={form.radiologist} onChange={e => set("radiologist", e.target.value)} className={inputCls} placeholder="e.g. Dr. James Osei" />
                  ) : (
                    <p className="text-white text-sm m-0">{report.radiologist || "—"}</p>
                  )}
                </div>
                <div>
                  <p className={labelCls}>Modality</p>
                  {report.modality ? (
                    <span className={`text-[12px] font-medium px-2.5 py-1 rounded-full ${modalityColors[report.modality] || "text-white bg-[#1a1a1a]"}`}>
                      {report.modality}
                    </span>
                  ) : (
                    <p className="text-white text-sm m-0">—</p>
                  )}
                </div>
              </div>

              <div>
                <p className={labelCls}>Status</p>
                <div className="flex gap-2">
                  {statusOptions.map(s => (
                    <button
                      key={s.value}
                      onClick={() => editing && set("status", s.value)}
                      className={`px-4 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 ${
                        (editing ? form.status : report.status) === s.value
                          ? s.color
                          : "bg-transparent text-[#4a4a4a] border-[#1E1E1E]"
                      } ${editing ? "cursor-pointer hover:border-[#2a2a2a]" : "cursor-default"}`}
                    >
                      {s.value}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className={labelCls}>Findings & Notes</p>
                {editing ? (
                  <textarea
                    value={form.notes}
                    onChange={e => set("notes", e.target.value)}
                    rows={6}
                    className={`${inputCls} resize-none`}
                    placeholder="Enter findings and notes..."
                    style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
                  />
                ) : (
                  <div className="bg-[#111] border border-[#1E1E1E] rounded-xl px-4 py-3">
                    <p className="text-[#CCCCCC] text-sm m-0 leading-relaxed whitespace-pre-wrap">
                      {report.notes || <span className="text-[#3a3a3a]">No notes recorded.</span>}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer — only shown when editing */}
            {editing && (
              <div className="flex flex-col gap-2 px-7 py-5 border-t border-[#1E1E1E] shrink-0">
                {error && <p className="text-[#FF6B6B] text-xs text-center m-0">{error}</p>}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { setEditing(false); setError(""); }}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl border border-[#1E1E1E] text-[#6B6B6B] text-sm bg-transparent hover:border-[#2a2a2a] hover:text-white cursor-pointer transition-all duration-200 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium border-none bg-[#0694FB] text-white cursor-pointer hover:bg-[#0578d1] transition-colors disabled:opacity-40"
                  >
                    {saving ? "Saving…" : <><FiCheck size={13} /> Save Changes</>}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ReportViewModal;
