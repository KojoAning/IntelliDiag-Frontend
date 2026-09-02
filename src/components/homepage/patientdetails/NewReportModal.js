import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiFileText, FiLoader } from "react-icons/fi";
import { authFetch } from "../../../lib/api";

const inputCls =
  "w-full bg-[#111111] border border-[#1E1E1E] rounded-xl px-4 py-2.5 text-white text-sm outline-none placeholder-[#3a3a3a] focus:border-[#0694FB] transition-colors";
const labelCls = "text-[#6B6B6B] text-xs mb-1.5 block";

const modalityOptions = ["MRI", "CT", "X-Ray", "Ultrasound", "PET"];
const statusOptions = [
  { value: "Draft",  color: "text-[#F59E0B] bg-[rgba(245,158,11,0.1)] border-[rgba(245,158,11,0.3)]" },
  { value: "Signed", color: "text-[#22C55E] bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.3)]" },
];

function NewReportModal({ isOpen, onClose, caseId, studyId, seriesId, jobId, onCreated }) {
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) { setForm({}); setError(""); }
  }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const canSubmit =
    !!form.title && !!form.radiologist && !!form.modality && !!form.status;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const baseURL = process.env.REACT_APP_API_URL || "";
      const res = await authFetch(`${baseURL}/reports/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(Object.entries({
          title: form.title,
          radiologist: form.radiologist,
          modality: form.modality,
          notes: form.notes || undefined,
          case_id: caseId || undefined,
          study_id: studyId || undefined,
          series_id: seriesId || undefined,
          job_id: jobId || undefined,
        }).filter(([, v]) => v !== undefined))),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || "Failed to create report");
      }
      onClose();
      onCreated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

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
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[520px] bg-[#161616] border border-[#1E1E1E] rounded-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-7 pt-7 pb-5">
              <div className="flex items-center gap-3">
               
                <div>
                  <h2 className="text-white text-[17px] font-medium m-0">New Report</h2>
                  <p className="text-[#6B6B6B] text-xs m-0 mt-0.5">Create a new radiology report for this patient</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1 mt-0.5"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Divider */}
            <div className="h-px bg-[#1E1E1E] mx-7" />

            {/* Body */}
            <div className="px-7 py-5 flex flex-col gap-4">
              {/* Title */}
              <div>
                <label className={labelCls}>Report Title</label>
                <input
                  type="text"
                  placeholder="e.g. MR Knee — Radiology Report"
                  value={form.title || ""}
                  onChange={(e) => set("title", e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Radiologist */}
              <div>
                <label className={labelCls}>Radiologist</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. James Osei"
                  value={form.radiologist || ""}
                  onChange={(e) => set("radiologist", e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Modality */}
              <div>
                <label className={labelCls}>Modality</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {modalityOptions.map((m) => (
                    <button
                      key={m}
                      onClick={() => set("modality", m)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-all duration-200 ${
                        form.modality === m
                          ? "bg-[rgba(6,148,251,0.12)] text-[#0694FB] border-[rgba(6,148,251,0.4)]"
                          : "bg-transparent text-[#4a4a4a] border-[#1E1E1E] hover:border-[#2a2a2a]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className={labelCls}>Status</label>
                <div className="flex gap-2 mt-1">
                  {statusOptions.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => set("status", s.value)}
                      className={`px-4 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-all duration-200 ${
                        form.status === s.value
                          ? s.color
                          : "bg-transparent text-[#4a4a4a] border-[#1E1E1E] hover:border-[#2a2a2a]"
                      }`}
                    >
                      {s.value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Findings / Notes */}
              <div>
                <label className={labelCls}>Findings & Notes</label>
                <textarea
                  placeholder="Enter radiologist findings, impressions, and recommendations..."
                  value={form.notes || ""}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={4}
                  className={`${inputCls} resize-none`}
                  style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-2 px-7 py-5 border-t border-[#1E1E1E]">
              {error && <p className="text-[#FF6B6B] text-xs text-center m-0">{error}</p>}
              <div className="flex items-center justify-between">
                <button
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl border border-[#1E1E1E] text-[#6B6B6B] text-sm bg-transparent hover:border-[#2a2a2a] hover:text-white cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  className={`px-5 py-2 rounded-md text-sm font-medium border-none transition-all duration-200 ${
                    canSubmit && !submitting
                      ? "bg-[#0694FB] text-white cursor-pointer hover:bg-[#0578d1]"
                      : "bg-[#1a1a1a] text-[#3a3a3a] cursor-not-allowed"
                  }`}
                >
                  {submitting ? <><FiLoader size={14} className="animate-spin" /> Creating…</> : "Create Report"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default NewReportModal;
