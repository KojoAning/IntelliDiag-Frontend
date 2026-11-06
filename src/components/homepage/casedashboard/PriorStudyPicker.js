import { useEffect, useState } from "react";
import { FiX, FiChevronRight, FiChevronDown } from "react-icons/fi";
import { listPatientStudies, priorSeriesOf, formatStudyDate } from "../../../lib/priorStudies";

// Pick a series of one of the patient's other studies to show beside the open one
// (newest study first; studies dated after the open one are marked "later")
export default function PriorStudyPicker({ caseId, studyId, openStudyDate, onPick, onClose }) {
  const [studies, setStudies] = useState(null); // null: loading
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null); // study id
  const [seriesByStudy, setSeriesByStudy] = useState({}); // study id -> series[] | "loading" | "error"

  useEffect(() => {
    if (!caseId) { setError("This study isn't linked to a patient case yet."); return; }
    let cancelled = false;
    listPatientStudies(caseId, studyId)
      .then(list => { if (!cancelled) setStudies(list); })
      .catch(() => { if (!cancelled) setError("Couldn't load the patient's studies."); });
    return () => { cancelled = true; };
  }, [caseId, studyId]);

  const open = (study) => {
    setExpanded(e => (e === study.id ? null : study.id));
    if (seriesByStudy[study.id]) return;
    setSeriesByStudy(m => ({ ...m, [study.id]: "loading" }));
    priorSeriesOf(study)
      .then(series => setSeriesByStudy(m => ({ ...m, [study.id]: series })))
      .catch(() => setSeriesByStudy(m => ({ ...m, [study.id]: "error" })));
  };

  const later = (study) => openStudyDate && new Date(study.date) > new Date(openStudyDate);

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div
        className="w-[420px] max-w-full max-h-[70vh] bg-[#161616] border border-[#2a2a2a] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E1E1E] shrink-0">
          <div className="flex flex-col">
            <span className="text-white text-[14px] font-semibold">Compare with another study</span>
            <span className="text-[#6B6B6B] text-[11px]">The patient's other studies, newest first</span>
          </div>
          <button onClick={onClose} className="text-[#6B6B6B] hover:text-white bg-transparent border-none cursor-pointer p-0" title="Close">
            <FiX size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#1B1B1B #000" }}>
          {error && <p className="m-0 px-4 py-4 text-[12px] text-[#F59E0B]">{error}</p>}
          {!error && studies === null && (
            <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" /></div>
          )}
          {studies?.length === 0 && (
            <p className="m-0 px-4 py-4 text-[12px] text-[#6B6B6B] leading-relaxed">
              This patient has no other studies. Import or upload an earlier study to the patient (any of their cases) to compare with it.
            </p>
          )}
          {studies?.map(study => {
            const series = seriesByStudy[study.id];
            return (
              <div key={study.id} className="border-b border-[#1E1E1E] last:border-b-0">
                <button
                  onClick={() => open(study)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left bg-transparent hover:bg-[#1a1a1a] border-none cursor-pointer"
                >
                  {expanded === study.id ? <FiChevronDown size={14} className="text-[#6B6B6B] shrink-0" /> : <FiChevronRight size={14} className="text-[#6B6B6B] shrink-0" />}
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="text-[13px] text-white truncate">{study.name || "Untitled study"}</span>
                    <span className="text-[11px] text-[#868686] truncate">
                      {[formatStudyDate(study.date), study.modality, study.bodyRegion].filter(Boolean).join(" · ")}
                      {later(study) && <span className="text-[#0694FB]"> · later than this one</span>}
                    </span>
                  </span>
                </button>
                {expanded === study.id && (
                  <div className="pl-10 pr-4 pb-2.5 flex flex-col gap-1">
                    {series === "loading" && <span className="text-[12px] text-[#6B6B6B]">Loading series…</span>}
                    {series === "error" && <span className="text-[12px] text-[#F59E0B]">Couldn't load its series.</span>}
                    {Array.isArray(series) && series.length === 0 && <span className="text-[12px] text-[#6B6B6B]">No series in this study.</span>}
                    {Array.isArray(series) && series.map(s => (
                      <button
                        key={s.id}
                        onClick={() => onPick(s)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg bg-[#111] hover:bg-[#1a1a1a] border border-[#1E1E1E] hover:border-[#0694FB]/50 text-[12px] text-[#CCCCCC] hover:text-white cursor-pointer truncate"
                      >
                        {s.name || "Untitled series"}
                        <span className="text-[#6B6B6B]">{[s.modality, s.image_count ? `${s.image_count} images` : null].filter(Boolean).map(t => ` · ${t}`).join("")}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
