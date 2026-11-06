import React, { useEffect, useMemo, useState } from "react";
import { FiX, FiSearch } from "react-icons/fi";
import { loadDicomDataSet, listDicomTags, formatTag } from "../../../lib/dicomTags";

// DICOM tag browser, docked beside the viewer like the ROI list. Follows the slice on
// screen, so scrolling shows how per-image tags (position, instance number…) change.
// Search matches the tag number, name or value.
export default function DicomTagPanel({ imageId, onClose }) {
  const [rows, setRows] = useState(null); // null while loading
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [hidePrivate, setHidePrivate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    if (!imageId) { setRows([]); return; }
    loadDicomDataSet(imageId)
      .then(dataSet => {
        if (cancelled) return;
        if (!dataSet) { setRows([]); setError("This image isn't a DICOM file, so it has no tags."); return; }
        setRows(listDicomTags(dataSet));
      })
      .catch(() => { if (!cancelled) { setRows([]); setError("Couldn't read this image's header."); } });
    return () => { cancelled = true; };
  }, [imageId]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const compactQ = q.replace(/[^0-9a-f]/g, "");
    return (rows ?? []).filter(row => {
      if (hidePrivate && row.isPrivate) return false;
      if (!q) return true;
      return row.name.toLowerCase().includes(q)
        || String(row.value).toLowerCase().includes(q)
        || (compactQ.length >= 4 && row.tag.slice(1).includes(compactQ));
    });
  }, [rows, query, hidePrivate]);

  return (
    <div className="shrink-0 w-[380px] bg-[#161616] rounded-xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1E1E1E] shrink-0">
        <span className="text-white text-[13px] font-semibold">{`DICOM tags${rows?.length ? ` (${rows.length})` : ""}`}</span>
        <button onClick={onClose} className="text-[#6B6B6B] hover:text-white bg-transparent border-none cursor-pointer p-0" title="Close">
          <FiX size={15} />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-[#1E1E1E] shrink-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 bg-[#111] border border-[#1E1E1E] focus-within:border-[#0694FB] rounded-lg px-2 py-1">
          <FiSearch size={12} className="text-[#6B6B6B] shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name, value or tag (0010,0010)"
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-white text-[12px] placeholder-[#4a4a4a]"
          />
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-[#868686] cursor-pointer select-none">
          <input type="checkbox" checked={hidePrivate} onChange={e => setHidePrivate(e.target.checked)} className="accent-[#0694FB]" />
          Hide private tags
        </label>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-[11px]" style={{ scrollbarWidth: "thin", scrollbarColor: "#1B1B1B #000" }}>
        {rows == null && <p className="text-[#6B6B6B] m-0 px-3 py-4 font-sans text-[12px]">Reading header…</p>}
        {error && <p className="text-[#6B6B6B] m-0 px-3 py-4 font-sans text-[12px]">{error}</p>}
        {rows && !error && shown.length === 0 && <p className="text-[#6B6B6B] m-0 px-3 py-4 font-sans text-[12px]">No matching tags.</p>}
        {shown.map((row, n) => (
          <div
            key={`${n}-${row.tag}`}
            className="flex gap-2 px-3 py-[3px] border-b border-[#1a1a1a] hover:bg-[#1a1a1a]"
            style={{ paddingLeft: 12 + row.depth * 10 }}
          >
            <span className="text-[#6B6B6B] shrink-0 select-all">{formatTag(row.tag)}</span>
            <span className="text-[#4a4a4a] shrink-0 w-[18px]">{row.vr}</span>
            <span className="flex-1 min-w-0 flex flex-col">
              <span className={`truncate font-sans ${row.isPrivate ? "text-[#868686] italic" : "text-[#CCCCCC]"}`} title={row.name}>{row.name || "—"}</span>
              {row.value !== "" && <span className="text-white break-all select-text">{String(row.value)}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
