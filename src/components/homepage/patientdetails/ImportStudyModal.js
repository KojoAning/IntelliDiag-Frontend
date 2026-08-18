import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiUploadCloud, FiLoader, FiFolder, FiLayers } from "react-icons/fi";
import { ingestDicom } from "../../../lib/api";
import { parseDicomForIngest } from "../../../lib/dicomUtils";

// How many files to send to /dicom/ingest at once. The backend shares the
// study/series by UID and is race-safe, but a small pool keeps things gentle.
const CONCURRENCY = 4;

const modalityColors = {
  MRI:        "text-[#0694FB] bg-[rgba(6,148,251,0.12)]",
  CT:         "text-[#F59E0B] bg-[rgba(245,158,11,0.12)]",
  "X-Ray":    "text-[#22C55E] bg-[rgba(34,197,94,0.12)]",
  Ultrasound: "text-[#A855F7] bg-[rgba(168,85,247,0.12)]",
};

/** "YYYYMMDD" -> "DD Mon YYYY" */
function fmtDicomDate(raw) {
  if (!raw || raw.length < 8) return "";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${raw.slice(6, 8)} ${months[parseInt(raw.slice(4, 6), 10) - 1] ?? ""} ${raw.slice(0, 4)}`;
}

/** Group parsed files into a Study -> Series tree for the preview. */
function buildTree(parsed) {
  const studies = new Map();
  for (const item of parsed) {
    const { meta } = item;
    if (!studies.has(meta.studyUid)) {
      studies.set(meta.studyUid, {
        uid: meta.studyUid,
        name: meta.studyDescription || meta.modality || "Imported Study",
        modality: meta.modality || "OT",
        bodyPart: meta.bodyPart,
        date: meta.studyDate,
        accession: meta.accessionNumber,
        series: new Map(),
        count: 0,
      });
    }
    const study = studies.get(meta.studyUid);
    study.count += 1;
    if (!study.series.has(meta.seriesUid)) {
      study.series.set(meta.seriesUid, {
        uid: meta.seriesUid,
        name: meta.seriesDescription || (meta.seriesNumber != null ? `Series ${meta.seriesNumber}` : "Series"),
        number: meta.seriesNumber,
        count: 0,
      });
    }
    study.series.get(meta.seriesUid).count += 1;
  }
  return [...studies.values()].map(s => ({
    ...s,
    series: [...s.series.values()].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
  }));
}

function ImportStudyModal({ isOpen, onClose, caseId, onCreated }) {
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState([]);   // [{ file, meta }]
  const [skippedNonDicom, setSkippedNonDicom] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, skipped: 0, errors: 0, total: 0 });
  const [error, setError] = useState(null);

  const reset = () => {
    setParsed([]); setSkippedNonDicom(0); setUploading(false);
    setProgress({ done: 0, skipped: 0, errors: 0, total: 0 }); setError(null); setParsing(false);
  };

  useEffect(() => { if (isOpen) reset(); }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const tree = useMemo(() => buildTree(parsed), [parsed]);

  const addFiles = async (fileList) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    setParsing(true);
    setError(null);
    let nonDicom = 0;
    const results = [];
    for (const file of files) {
      const meta = await parseDicomForIngest(file);
      if (meta) results.push({ file, meta });
      else nonDicom += 1;
    }
    // De-dupe by SOP UID in case the same file was added twice
    setParsed(prev => {
      const seen = new Set(prev.map(p => p.meta.sopUid));
      const merged = [...prev];
      for (const r of results) {
        if (!seen.has(r.meta.sopUid)) { seen.add(r.meta.sopUid); merged.push(r); }
      }
      return merged;
    });
    setSkippedNonDicom(n => n + nonDicom);
    setParsing(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleImport = async () => {
    if (!parsed.length || !caseId) return;
    setUploading(true);
    setError(null);
    const counters = { done: 0, skipped: 0, errors: 0, total: parsed.length };
    setProgress({ ...counters });

    const queue = [...parsed];
    const worker = async () => {
      while (queue.length) {
        const { file } = queue.shift();
        try {
          await ingestDicom(caseId, file);
          counters.done += 1;
        } catch (err) {
          // 409 = instance already on the server; treat as a skip, not a failure
          if (/already been uploaded/i.test(err.message)) counters.skipped += 1;
          else counters.errors += 1;
        }
        setProgress({ ...counters });
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, parsed.length) }, worker));
    setUploading(false);

    if (counters.errors > 0) {
      setError(`${counters.errors} file${counters.errors !== 1 ? "s" : ""} failed to import.`);
    }
    onCreated?.();
    if (counters.errors === 0) onClose();
  };

  const totalImages = parsed.length;
  const totalSeries = tree.reduce((n, s) => n + s.series.length, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }} onClick={uploading ? undefined : onClose}
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
            <div className="flex items-start justify-between px-7 pt-7 pb-5 shrink-0">
              <div>
                <h2 className="text-white text-[16px] font-medium m-0">Import DICOM Study</h2>
                <p className="text-[#6B6B6B] text-[14px] m-0 mt-0.5">
                  Drop a study's .dcm files — studies &amp; series are detected automatically
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={uploading}
                className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1 mt-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 px-7 pb-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}>
              {/* Dropzone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 py-7 cursor-pointer transition-all duration-200 ${
                  dragging
                    ? "border-[#0694FB] bg-[rgba(6,148,251,0.06)]"
                    : "border-[#2a2a2a] bg-[#0d0d0d] hover:border-[#0694FB]/50 hover:bg-[rgba(6,148,251,0.03)]"
                }`}
              >
                <FiUploadCloud size={22} color={dragging ? "#0694FB" : "#3a3a3a"} />
                <p className={`text-[12px] m-0 transition-colors ${dragging ? "text-[#0694FB]" : "text-[#4a4a4a]"}`}>
                  Drop .dcm files here or <span className="text-[#0694FB]">browse</span>
                </p>
                <button
                  onClick={e => { e.stopPropagation(); folderInputRef.current?.click(); }}
                  className="flex items-center gap-1.5 text-[#6B6B6B] hover:text-white text-[11px] bg-transparent border-none cursor-pointer transition-colors mt-0.5"
                >
                  <FiFolder size={12} /> Select a folder instead
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".dcm,application/dicom"
                multiple
                className="hidden"
                onChange={e => { addFiles(e.target.files); e.target.value = null; }}
              />
              <input
                ref={folderInputRef}
                type="file"
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={e => { addFiles(e.target.files); e.target.value = null; }}
              />

              {parsing && (
                <p className="text-[#6B6B6B] text-[11px] mt-3 flex items-center gap-2">
                  <FiLoader size={12} className="animate-spin" /> Reading DICOM headers…
                </p>
              )}

              {skippedNonDicom > 0 && (
                <p className="text-[#F59E0B] text-[11px] mt-3 m-0">
                  {skippedNonDicom} file{skippedNonDicom !== 1 ? "s" : ""} skipped (not valid DICOM)
                </p>
              )}

              {/* Detected hierarchy preview */}
              {tree.length > 0 && (
                <div className="mt-4 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#3a3a3a] text-[10px] font-mono uppercase tracking-wide">Detected</span>
                    <span className="text-[#6B6B6B] text-[11px]">
                      {tree.length} stud{tree.length !== 1 ? "ies" : "y"} · {totalSeries} series · {totalImages} images
                    </span>
                  </div>

                  {tree.map(study => (
                    <div key={study.uid} className="bg-[#111] border border-[#1E1E1E] rounded-xl p-4 flex flex-col gap-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${modalityColors[study.modality] || "text-white bg-[#1a1a1a]"}`}>
                              {study.modality}
                            </span>
                            <span className="text-white text-[14px] truncate">{study.name}</span>
                          </div>
                          <p className="text-[#3a3a3a] text-[11px] m-0 mt-1 font-mono">
                            {[study.bodyPart, fmtDicomDate(study.date), study.accession].filter(Boolean).join(" · ") || "no accession"}
                          </p>
                        </div>
                        <span className="text-[#6B6B6B] text-[11px] shrink-0">{study.count} img</span>
                      </div>

                      <div className="flex flex-col gap-1 pl-1">
                        {study.series.map(series => (
                          <div key={series.uid} className="flex items-center justify-between gap-2 text-[12px]">
                            <span className="text-[#9a9a9a] truncate flex items-center gap-1.5">
                              <FiLayers size={11} className="text-[#3a3a3a] shrink-0" />
                              {series.number != null ? `${String(series.number).padStart(2, "0")} · ` : ""}{series.name}
                            </span>
                            <span className="text-[#4a4a4a] font-mono shrink-0">{series.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upload progress */}
            {uploading && (
              <div className="mx-7 mb-3 mt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[#6B6B6B] text-[11px]">Importing…</span>
                  <span className="text-white/60 text-[11px] font-mono">
                    {progress.done + progress.skipped + progress.errors} / {progress.total}
                  </span>
                </div>
                <div className="w-full h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0694FB] rounded-full transition-all duration-200"
                    style={{ width: `${progress.total ? ((progress.done + progress.skipped + progress.errors) / progress.total) * 100 : 0}%` }}
                  />
                </div>
                {(progress.skipped > 0 || progress.errors > 0) && (
                  <p className="text-[#6B6B6B] text-[10px] m-0 mt-1.5">
                    {progress.skipped > 0 && `${progress.skipped} already on server`}
                    {progress.skipped > 0 && progress.errors > 0 && " · "}
                    {progress.errors > 0 && <span className="text-[#FF4A4A]">{progress.errors} failed</span>}
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="mx-7 mb-3 px-4 py-2.5 rounded-xl bg-[rgba(255,74,74,0.08)] border border-[rgba(255,74,74,0.2)]">
                <p className="text-[#FF4A4A] text-xs m-0">{error}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-7 py-5 border-t border-[#1E1E1E] shrink-0">
              <button
                onClick={onClose}
                disabled={uploading}
                className="px-4 py-2 rounded-xl border border-[#1E1E1E] text-[#6B6B6B] text-sm bg-transparent hover:border-[#2a2a2a] hover:text-white cursor-pointer transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {error ? "Close" : "Cancel"}
              </button>
              <button
                onClick={handleImport}
                disabled={uploading || parsing || parsed.length === 0}
                className={`px-5 py-2 rounded-md text-sm font-medium border-none transition-all duration-200 flex items-center gap-2 ${
                  !uploading && !parsing && parsed.length > 0
                    ? "bg-[#0694FB] text-white cursor-pointer hover:bg-[#0578d1]"
                    : "bg-[#1a1a1a] text-[#3a3a3a] cursor-not-allowed"
                }`}
              >
                {uploading && <FiLoader size={13} className="animate-spin" />}
                {uploading ? "Importing…" : `Import ${totalImages || ""} image${totalImages !== 1 ? "s" : ""}`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ImportStudyModal;
