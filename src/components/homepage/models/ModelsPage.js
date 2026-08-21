import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getModels } from "../../../lib/api";
import { HiCpuChip } from "react-icons/hi2";
import { FiChevronRight, FiSearch } from "react-icons/fi";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1], delay: i * 0.07 },
  }),
};

// ── Chip ──────────────────────────────────────────────────────────────────────

// ── Model card ────────────────────────────────────────────────────────────────

function ModelCard({ model }) {
  const name = model.name || model.model_name || `Model ${model.id}`;
  const subtitle = [
    model.modality?.toUpperCase(),
    model.specialty || model.speciality || null,
    model.version ? `v${model.version}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="bg-[#0C0C0C] border border-[#1E1E1E] rounded-2xl p-5 flex flex-col gap-3 hover:border-[#0694FB]/20 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-[5px] bg-[#0694FB]/10 flex items-center justify-center shrink-0">
            <HiCpuChip size={18} className="text-[#0694FB]" />
          </div>
          <div className="min-w-0">
            <p className="text-white text-[14px] font-semibold m-0 truncate">{name}</p>
            {subtitle && (
              <p className="text-[#6B6B6B] text-[11px] m-0 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {/* Three-dot menu */}
        <button className="text-[#3a3a3a] hover:text-white bg-transparent border-none cursor-pointer p-1 shrink-0 leading-none text-[16px] transition-colors">
          ···
        </button>
      </div>

      {/* Description */}
      {model.description && (
        <p className="text-[#6b6a6a] text-[12px] leading-relaxed m-0 line-clamp-3">{model.description}</p>
      )}

      {/* Stats — always shown, placeholder if missing */}
      <div className="flex gap-5 border-[#1a1a1a] pt-1 mt-auto">
        <div className="bg-[#1e1e1e] px-[15px] py-[10px]">
          <p className="text-[#6B6B6B] text-[11px] uppercase  m-0">Accuracy (%)</p>
          <p className="text-white text-[14px] font-semibold m-0 mt-0.5">
            {model.accuracy != null ? `${(model.accuracy * 100).toFixed(1)}%` : "—"}
          </p>
        </div>
        {model.dice_score != null && (
          <div className="bg-[#1e1e1e] px-[15px] py-[10px]">
            <p className="text-[#6B6B6B] text-[11px] uppercase  m-0">Dice</p>
            <p className="text-white text-[14px] font-semibold m-0 mt-0.5">{(model.dice_score * 100).toFixed(1)}%</p>
          </div>
        )}
        {model.auc != null && (
          <div className="bg-[#1e1e1e] px-[15px] py-[10px]">
            <p className="text-[#6B6B6B] text-[11px] uppercase  m-0">AUC</p>
            <p className="text-white text-[14px] font-semibold m-0 mt-0.5">{model.auc.toFixed(3)}</p>
          </div>
        )}
        <div className="bg-[#1e1e1e] px-[15px] py-[10px]">
          <p className="text-[#6B6B6B] text-[11px] uppercase  m-0">Inference</p>
          <p className="text-white text-[14px] font-semibold m-0 mt-0.5">
            {model.inference_time != null ? `${model.inference_time}s` : "—"}
          </p>
        </div>
      </div>


    </div>
  );
}

// ── Tab content ───────────────────────────────────────────────────────────────

function ModelsTab({ models, search }) {
  const filtered = models.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.name || m.model_name || "").toLowerCase().includes(q)
      || (m.description || "").toLowerCase().includes(q)
      || (m.architecture || "").toLowerCase().includes(q)
      || (m.modality || "").toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <HiCpuChip size={32} className="text-[#2a2a2a]" />
        <p className="text-[#3a3a3a] text-[13px] m-0">No models found</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
      {filtered.map(m => <ModelCard key={m.id} model={m} />)}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ModelsPage() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [modalityFilter, setModalityFilter] = useState("All");
  const [specialityFilter, setSpecialityFilter] = useState("All");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getModels();
      setModels(Array.isArray(data) ? data : []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const modalities = ["All", ...Array.from(new Set(models.map(m => (m.modality || "").toUpperCase()).filter(Boolean)))];
  const specialities = ["All", ...Array.from(new Set(models.map(m => m.specialty || m.speciality || "").filter(Boolean)))];

  const tabModels = models.filter(m => {
    if (statusFilter !== "All" && (m.status || "").toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (modalityFilter !== "All" && (m.modality || "").toUpperCase() !== modalityFilter) return false;
    if (specialityFilter !== "All" && (m.specialty || m.speciality || "") !== specialityFilter) return false;
    return true;
  });

  return (
    <div
      className="w-full h-full flex flex-col min-h-0 overflow-y-auto pb-8 pr-1"
      style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
    >
      {/* Header */}
      <motion.div className="shrink-0 mb-6" variants={fadeUp} initial="hidden" animate="show" custom={0}>
        <h1 className="m-0 text-white text-[35px] font-medium">AI Models</h1>
        <p className="m-0 text-[#999898] text-[13px] mt-0">
          {models.length} model{models.length !== 1 ? "s" : ""} available on intelliDiag.
        </p>
      </motion.div>

      {/* Filter bar */}
      <motion.div className="flex items-center gap-2 mb-6 shrink-0" variants={fadeUp} initial="hidden" animate="show" custom={1}>
        {/* Search */}
        <div className="flex items-center gap-2 bg-[#0C0C0C] border border-[#1E1E1E] rounded-xl px-3 py-2 flex-1 max-w-[280px]">
          <FiSearch size={13} className="text-[#3a3a3a] shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search AI models, specialties…"
            className="bg-transparent border-none outline-none text-white text-[13px] placeholder-[#6b6b6b] w-full"
          />
        </div>

        {/* Status */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none bg-[#0C0C0C] border border-[#1E1E1E] rounded-xl pl-3 pr-7 py-2 text-[#ffffff] text-[13px] outline-none cursor-pointer hover:text-white transition-colors"
          >
            {["All", "active", "inactive", "deprecated"].map(s => (
              <option key={s} value={s}>{s === "All" ? "Status" : s}</option>
            ))}
          </select>
          <FiChevronRight size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3a3a3a] pointer-events-none rotate-90" />
        </div>

        {/* Modality */}
        <div className="relative">
          <select
            value={modalityFilter}
            onChange={e => setModalityFilter(e.target.value)}
            className="appearance-none bg-[#0C0C0C] border border-[#1E1E1E] rounded-xl pl-3 pr-7 py-2 text-[#ffffff] text-[13px] outline-none cursor-pointer hover:text-white transition-colors"
          >
            {modalities.map(m => (
              <option key={m} value={m}>{m === "All" ? "Modality" : m}</option>
            ))}
          </select>
          <FiChevronRight size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3a3a3a] pointer-events-none rotate-90" />
        </div>

        {/* Speciality */}
        <div className="relative">
          <select
            value={specialityFilter}
            onChange={e => setSpecialityFilter(e.target.value)}
            className="appearance-none bg-[#0C0C0C] border border-[#1E1E1E] rounded-xl pl-3 pr-7 py-2 text-[#ffffff] text-[13px] outline-none cursor-pointer hover:text-white transition-colors"
          >
            {specialities.map(s => (
              <option key={s} value={s}>{s === "All" ? "Speciality" : s}</option>
            ))}
          </select>
          <FiChevronRight size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3a3a3a] pointer-events-none rotate-90" />

        </div>


      </motion.div>

      {/* Content */}
      <motion.div className="flex-1" variants={fadeUp} initial="hidden" animate="show" custom={2}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-[#0694FB]/30 border-t-[#0694FB] rounded-full animate-spin" />
          </div>
        ) : (
          <ModelsTab models={tabModels} search={search} />
        )}
      </motion.div>
    </div>
  );
}
