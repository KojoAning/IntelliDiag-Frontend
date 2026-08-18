import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX } from "react-icons/fi";
import { authFetch } from "../../../lib/api";

const inputCls = "w-full bg-[#111111] border border-[#1E1E1E] rounded-xl px-4 py-2.5 text-white text-sm outline-none placeholder-[#3a3a3a] focus:border-[#0694FB] transition-colors";
const labelCls = "text-[#6B6B6B] text-xs mb-1.5 block";

const modalityOptions = [
  { value: "MRI",        color: "text-[#0694FB] bg-[rgba(6,148,251,0.1)] border-[rgba(6,148,251,0.3)]" },
  { value: "CT",         color: "text-[#F59E0B] bg-[rgba(245,158,11,0.1)] border-[rgba(245,158,11,0.3)]" },
  { value: "X-Ray",      color: "text-[#22C55E] bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.3)]" },
  { value: "Ultrasound", color: "text-[#A855F7] bg-[rgba(168,85,247,0.1)] border-[rgba(168,85,247,0.3)]" },
];

function AddStudyModal({ isOpen, onClose, caseId, onCreated }) {
  const [studyInfo, setStudyInfo] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) { setStudyInfo({}); setError(""); }
  }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const set = (key, val) => setStudyInfo(p => ({ ...p, [key]: val }));
  const canSubmit = !!studyInfo.name && !!studyInfo.modality;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const baseURL = process.env.REACT_APP_API_URL || "";
      const body = {
        study_name: studyInfo.name,
        modality: studyInfo.modality,
        body_region: studyInfo.region || "",
        acc_number: studyInfo.accession || "",
        clinical_indication: studyInfo.indication || "",
        flagged: false,
        study_date: studyInfo.date ? new Date(studyInfo.date).toISOString() : new Date().toISOString(),
        case_id: caseId,
      };
      console.log(body)
      const res = await authFetch(`${baseURL}/imaging-studies/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || "Failed to create study");
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
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-[520px] max-h-[90vh] bg-[#161616] border border-[#1E1E1E] rounded-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-7 pt-7 pb-5">
              <div>
                <h2 className="text-white text-lg font-medium m-0">Add Imaging Study</h2>
                <p className="text-[#6B6B6B] text-xs m-0 mt-0.5">Enter the study details and modality</p>
              </div>
              <button onClick={onClose} className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1 mt-0.5">
                <FiX size={18} />
              </button>
            </div>

            <div className="h-px bg-[#1E1E1E] mx-7" />

            {/* Content */}
            <div className="overflow-y-auto flex-1 px-7 py-5 flex flex-col gap-3" style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}>
              <div>
                <label className={labelCls}>Study Name</label>
                <input
                  type="text"
                  placeholder="e.g. MRI Right Knee"
                  value={studyInfo.name || ""}
                  onChange={e => set("name", e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Modality</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {modalityOptions.map(m => (
                    <button
                      key={m.value}
                      onClick={() => set("modality", m.value)}
                      className={`py-2 px-3 rounded-xl border text-sm font-medium cursor-pointer transition-all duration-200 ${
                        studyInfo.modality === m.value ? m.color : "text-[#4a4a4a] bg-transparent border-[#1E1E1E] hover:border-[#2a2a2a]"
                      }`}
                    >
                      {m.value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Body Region</label>
                  <input
                    type="text"
                    placeholder="e.g. Right Knee"
                    value={studyInfo.region || ""}
                    onChange={e => set("region", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Study Date</label>
                  <input
                    type="date"
                    value={studyInfo.date || ""}
                    onChange={e => set("date", e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Accession Number</label>
                <input
                  type="text"
                  placeholder="e.g. ACC-2024-00150"
                  value={studyInfo.accession || ""}
                  onChange={e => set("accession", e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Clinical Indication</label>
                <textarea
                  placeholder="Reason for imaging study..."
                  value={studyInfo.indication || ""}
                  onChange={e => set("indication", e.target.value)}
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-2 px-7 py-5 border-t border-[#1E1E1E] shrink-0">
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
                    canSubmit && !submitting ? "bg-[#0694FB] text-white cursor-pointer hover:bg-[#0578d1]" : "bg-[#1a1a1a] text-[#3a3a3a] cursor-not-allowed"
                  }`}
                >
                  {submitting ? "Adding…" : "Add Study"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AddStudyModal;
