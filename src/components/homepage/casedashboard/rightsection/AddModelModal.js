import React, { useState, useEffect, useMemo } from "react";
import { FiX, FiSearch, FiCheck, FiCpu } from "react-icons/fi";
import { getModels } from "../../../../lib/api";

const TYPE_COLORS = {
  Detection:      "text-[#FF6B35] bg-[rgba(255,107,53,0.12)]",
  Segmentation:   "text-[#A855F7] bg-[rgba(168,85,247,0.12)]",
  Classification: "text-[#0694FB] bg-[rgba(6,148,251,0.12)]",
  Quantification: "text-[#22C55E] bg-[rgba(34,197,94,0.12)]",
};

function parseModalities(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch {}
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

function mapModel(m) {
  const type = m.model_type ?? "";
  // Backend may store 0.0.0.0 which isn't reachable from a browser on Windows;
  // swap to 127.0.0.1 so fetch() works.
  const rawUrl = m.endpoint_url ?? m.url ?? m.endpoint ?? m.inference_url ?? "";
  const url = rawUrl.replace("://0.0.0.0", "://127.0.0.1");
  return {
    ...m,
    id:        m.id,
    name:      m.name,
    version:   m.version ?? "",
    description: m.description ?? "",
    modalities: parseModalities(m.modalities),
    url,
    type,
    typeColor: TYPE_COLORS[type] ?? "text-white bg-[#1a1a1a]",
  };
}

const MODALITY_FILTERS = ["All", "MRI", "CT", "X-Ray", "Ultrasound", "OCT", "Mammography"];

// ── Sub-components ────────────────────────────────────────────────────────────

function ModalityPill({ label }) {
  return (
    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-[#5e5e5e] text-[#ffffff] border border-[#2a2a2a]">
      {label}
    </span>
  );
}

function CatalogueCard({ model, added, onAdd, onRemove }) {
  return (
    <div className="bg-[#161616] border border-[#161616] rounded-[20px] px-6 py-4 flex flex-col gap-2 hover:border-[#2a2a2a] transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          
          <div className="flex-1 min-w-0">
            <p className="text-white text-[16px] font-medium m-0 truncate">{model.name}</p>
            <p className="text-[#8a8a8a] text-[12px] m-0 font-mono">{model.id}</p>
          </div>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${model.typeColor}`}>
          {model.type}
        </span>
      </div>

      {/* Description */}
      <p className="text-[#6B6B6B] text-[12px] m-0 leading-relaxed line-clamp-2">
        {model.description}
      </p>

      {/* Footer: modalities + button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {model.modalities.map(m => <ModalityPill key={m} label={m} />)}
        </div>
        {added ? (
          <button
            onClick={() => onRemove(model.id)}
            className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-full bg-[rgba(34,197,94,0.1)] text-[#22C55E] border border-[rgba(34,197,94,0.2)] hover:bg-[rgba(255,74,74,0.1)] hover:text-[#FF4A4A] hover:border-[rgba(255,74,74,0.2)] cursor-pointer transition-all shrink-0"
          >
            <FiCheck size={11} />
            <span>Added</span>
          </button>
        ) : (
          <button
            onClick={() => onAdd(model)}
            className="text-[11px] px-3 py-1.5 rounded-full bg-[#0694FB] hover:bg-[#0578d1] text-white border-none cursor-pointer transition-colors shrink-0"
          >
            + Add
          </button>
        )}
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function AddModelModal({ isOpen, onClose, addedIds, onAdd, onRemove }) {
  const [query, setQuery]         = useState("");
  const [activeFilter, setFilter] = useState("All");
  const [catalogue, setCatalogue] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getModels()
      .then(data => { if (!cancelled) setCatalogue((data ?? []).map(mapModel)); })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen]);

  const filtered = useMemo(() => {
    return catalogue.filter(m => {
      const matchesModality = activeFilter === "All" || m.modalities.includes(activeFilter);
      const q = query.trim().toLowerCase();
      const matchesQuery   = !q || m.name.toLowerCase().includes(q) || m.type.toLowerCase().includes(q) || String(m.id).toLowerCase().includes(q);
      return matchesModality && matchesQuery;
    });
  }, [catalogue, query, activeFilter]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-2xl w-full max-w-[620px] mx-4 flex flex-col overflow-hidden"
           style={{ maxHeight: "80vh" }}>

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E1E] shrink-0">
          <div>
            <h2 className="text-white text-[16px] font-medium m-0">Add AI Model</h2>
            <p className="text-[#6B6B6B] text-[12px] m-0 mt-0.5">Select models to use for inference on this series</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#1E1E1E] text-[#6B6B6B] hover:text-white hover:border-[#2a2a2a] bg-transparent cursor-pointer transition-all"
          >
            <FiX size={14} />
          </button>
        </div>

        {/* Search + filters */}
        <div className="px-6 pt-4 pb-3 flex flex-col gap-3 shrink-0 border-b border-[#1E1E1E]">
          <div className="flex items-center gap-2 bg-[#111] border border-[#1E1E1E] rounded-xl px-3 py-2">
            <FiSearch size={13} className="text-[#3a3a3a] shrink-0" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search models…"
              className="bg-transparent border-none outline-none text-white text-[13px] flex-1 placeholder:text-[#3a3a3a]"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {MODALITY_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[11px] px-3 py-1 rounded-full border cursor-pointer transition-all ${
                  activeFilter === f
                    ? "bg-[#0694FB] border-[#0694FB] text-white"
                    : "bg-transparent border-[#1E1E1E] text-[#6B6B6B] hover:border-[#2a2a2a] hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Catalogue list */}
        <div
          className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#1a1a1a transparent" }}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-7 h-7 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
              <p className="text-[#3a3a3a] text-[13px] m-0">Loading models…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FiCpu size={28} className="text-[#2a2a2a]" />
              <p className="text-[#FF4A4A] text-[12px] m-0">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FiCpu size={28} className="text-[#2a2a2a]" />
              <p className="text-[#3a3a3a] text-[13px] m-0">No models match your search</p>
            </div>
          ) : (
            filtered.map(m => (
              <CatalogueCard
                key={m.id}
                model={m}
                added={addedIds.has(m.id)}
                onAdd={onAdd}
                onRemove={onRemove}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#1E1E1E] shrink-0 flex items-center justify-between">
          <p className="text-[#3a3a3a] text-[11px] m-0">
            {addedIds.size} model{addedIds.size !== 1 ? "s" : ""} added to workspace
          </p>
          <button
            onClick={onClose}
            className="px-4 py-[7px] rounded-full bg-[#0694FB] hover:bg-[#0578d1] text-white text-[12px] font-medium border-none cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddModelModal;
