import React, { useEffect, useMemo, useState } from "react";
import { eventTarget as csEventTarget } from "@cornerstonejs/core";
import { Enums as csToolsEnums } from "@cornerstonejs/tools";
import { FiX, FiEdit2 } from "react-icons/fi";
import { listRecistLesions, updateRecistLesion, lesionMeasure, assessRecist, RECIST_CATEGORIES } from "../../../lib/recist";

// RECIST 1.1 panel, docked beside the viewer like the ROI list. Every bidirectional
// measurement on the series is a lesion; mark each as a tumour or lymph node, give it an
// organ, and choose the targets. The panel sums the targets and, given the baseline and
// smallest earlier sum (typed in until prior studies can be compared), gives the response.
//
// reference: { baseline, nadir, newLesion }; onReferenceChange(next)
// onEdited(): a lesion's details changed — re-render and save
// onGoToSlice(index): jump the 2D view to a lesion (omitted in MPR)
const fmt = (mm) => `${mm.toFixed(1)} mm`;
const pct = (fraction) => `${fraction > 0 ? "+" : ""}${(fraction * 100).toFixed(0)}%`;

function NumberField({ label, value, onChange, title }) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => { setText(value ?? ""); }, [value]);
  return (
    <label className="flex items-center justify-between gap-2" title={title}>
      <span className="text-[11px] text-[#868686]">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          step={0.1}
          value={text}
          onChange={e => {
            setText(e.target.value);
            const n = parseFloat(e.target.value);
            onChange(e.target.value === "" ? null : Number.isFinite(n) && n >= 0 ? n : value);
          }}
          className="w-[70px] bg-[#111] border border-[#1E1E1E] focus:border-[#0694FB] rounded-md px-1.5 py-0.5 text-white text-[12px] font-mono outline-none text-right"
        />
        <span className="text-[11px] text-[#6B6B6B]">mm</span>
      </span>
    </label>
  );
}

export default function RecistPanel({ imageIds, reference, onReferenceChange, onEdited, onGoToSlice, onClose }) {
  const [version, setVersion] = useState(0); // bumped when measurements change
  const [editingName, setEditingName] = useState(null); // { uid, value }

  useEffect(() => {
    let timer = null;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setVersion(v => v + 1), 100);
    };
    const events = [
      csToolsEnums.Events.ANNOTATION_ADDED,
      csToolsEnums.Events.ANNOTATION_MODIFIED,
      csToolsEnums.Events.ANNOTATION_COMPLETED,
      csToolsEnums.Events.ANNOTATION_REMOVED,
    ];
    events.forEach(name => csEventTarget.addEventListener(name, refresh));
    return () => {
      clearTimeout(timer);
      events.forEach(name => csEventTarget.removeEventListener(name, refresh));
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lesions = useMemo(() => listRecistLesions(imageIds), [imageIds, version]);
  const result = useMemo(() => assessRecist(lesions, reference ?? {}), [lesions, reference]);
  const category = result.category ? RECIST_CATEGORIES[result.category] : null;

  const edit = (uid, patch) => {
    updateRecistLesion(uid, patch);
    setVersion(v => v + 1);
    onEdited?.();
  };
  const commitName = () => {
    const name = editingName?.value.trim();
    if (name) edit(editingName.uid, { name });
    setEditingName(null);
  };
  const setReference = (patch) => onReferenceChange({ baseline: null, nadir: null, newLesion: false, ...reference, ...patch });

  return (
    <div className="shrink-0 w-[290px] bg-[#161616] rounded-xl flex flex-col overflow-hidden select-none">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1E1E1E] shrink-0">
        <span className="text-white text-[13px] font-semibold">RECIST 1.1</span>
        <button onClick={onClose} className="text-[#6B6B6B] hover:text-white bg-transparent border-none cursor-pointer p-0" title="Close">
          <FiX size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#1B1B1B #000" }}>
        {lesions.length === 0 && (
          <p className="text-[#6B6B6B] text-[12px] leading-relaxed m-0 px-3 py-4">
            No lesions yet. Measure one with the bidirectional tool (E): drag along the longest
            diameter, then adjust the short axis. Each measurement is listed here as a lesion.
          </p>
        )}

        {/* ── Lesions ── */}
        {lesions.map(lesion => {
          const { size, measurable, note } = lesionMeasure(lesion);
          const isNode = lesion.type === "node";
          const editing = editingName?.uid === lesion.uid;
          return (
            <div key={lesion.uid} className={`px-3 py-2.5 flex flex-col gap-1.5 border-b border-[#1E1E1E] ${lesion.target ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-2">
                {editing ? (
                  <input
                    autoFocus
                    value={editingName.value}
                    onChange={e => setEditingName(n => ({ ...n, value: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === "Enter") commitName();
                      if (e.key === "Escape") setEditingName(null);
                    }}
                    onBlur={commitName}
                    className="flex-1 min-w-0 bg-[#111] border border-[#0694FB] rounded-md px-1.5 py-0.5 text-white text-[12px] outline-none"
                  />
                ) : (
                  <button
                    onClick={() => lesion.sliceIndex != null && onGoToSlice?.(lesion.sliceIndex)}
                    disabled={!onGoToSlice}
                    title={onGoToSlice ? "Go to its slice" : undefined}
                    className="flex-1 min-w-0 text-left text-white text-[12px] font-medium truncate bg-transparent border-none p-0 enabled:cursor-pointer enabled:hover:text-[#0694FB]"
                  >
                    {lesion.name}
                    <span className="text-[#6B6B6B] font-normal">{` · slice ${lesion.sliceIndex + 1}`}</span>
                  </button>
                )}
                <button
                  onClick={() => setEditingName({ uid: lesion.uid, value: lesion.name })}
                  title="Rename"
                  className="text-[#6B6B6B] hover:text-white bg-transparent border-none cursor-pointer p-0"
                >
                  <FiEdit2 size={12} />
                </button>
                <label className="flex items-center gap-1 text-[11px] text-[#868686] cursor-pointer" title="Count it in the sum of diameters">
                  <input type="checkbox" checked={lesion.target} onChange={e => edit(lesion.uid, { target: e.target.checked })} className="accent-[#0694FB]" />
                  Target
                </label>
              </div>

              <div className="flex items-center gap-2">
                {/* Tumour / node */}
                <div className="flex rounded-md overflow-hidden border border-[#2a2a2a] shrink-0">
                  {[["tumour", "Tumour"], ["node", "Node"]].map(([type, label]) => (
                    <button
                      key={type}
                      onClick={() => edit(lesion.uid, { type })}
                      className={`px-2 py-0.5 text-[11px] border-none cursor-pointer ${lesion.type === type ? "bg-[#0694FB] text-white" : "bg-transparent text-[#868686] hover:text-white"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  value={lesion.organ}
                  onChange={e => edit(lesion.uid, { organ: e.target.value })}
                  placeholder="Organ"
                  className="flex-1 min-w-0 bg-[#111] border border-[#1E1E1E] focus:border-[#0694FB] rounded-md px-1.5 py-0.5 text-white text-[11px] outline-none placeholder-[#4a4a4a]"
                />
              </div>

              {/* Axes — the one RECIST uses (long for tumours, short for nodes) in bold */}
              <div className="flex items-baseline gap-3 font-mono text-[11px]">
                <span className={isNode ? "text-[#6B6B6B]" : "text-white font-semibold"}>{`L ${lesion.long.toFixed(1)} ${lesion.unit}`}</span>
                <span className={isNode ? "text-white font-semibold" : "text-[#6B6B6B]"}>{`S ${lesion.short.toFixed(1)} ${lesion.unit}`}</span>
                {lesion.unit === "mm" && lesion.target && <span className="ml-auto text-[#0694FB]">{fmt(size)}</span>}
              </div>
              {!measurable && note && lesion.unit === "mm" && <span className="text-[10px] text-[#F59E0B]">{note}</span>}
            </div>
          );
        })}

        {/* ── Sum and response ── */}
        <div className="px-3 py-3 flex flex-col gap-2">
          <div className="rounded-lg bg-[#111] px-2.5 py-2 flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-[#868686]">{`Sum of diameters · ${result.targets.length} target${result.targets.length === 1 ? "" : "s"}`}</span>
              <span className="text-[13px] text-[#0694FB] font-mono">{fmt(result.sum)}</span>
            </div>
            {result.changeFromBaseline != null && (
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-[#868686]">vs baseline</span>
                <span className="text-[12px] text-white font-mono">{pct(result.changeFromBaseline)}</span>
              </div>
            )}
            {result.changeFromNadir != null && reference?.nadir != null && (
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-[#868686]">vs nadir</span>
                <span className="text-[12px] text-white font-mono">{pct(result.changeFromNadir)}</span>
              </div>
            )}
            {category && (
              <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-[#1E1E1E]">
                <span className="text-[11px] text-[#868686]">Response</span>
                <span className="text-[12px] font-semibold" style={{ color: category.color }}>{`${result.category} · ${category.name}`}</span>
              </div>
            )}
          </div>

          <span className="text-[11px] text-[#6B6B6B] uppercase tracking-wide mt-1">Earlier studies</span>
          <NumberField
            label="Baseline sum"
            value={reference?.baseline ?? null}
            onChange={baseline => setReference({ baseline })}
            title="Sum of diameters at the baseline study — leave empty if this is the baseline"
          />
          <NumberField
            label="Nadir (smallest sum)"
            value={reference?.nadir ?? null}
            onChange={nadir => setReference({ nadir })}
            title="Smallest sum on any earlier study, including baseline — progression is judged against it"
          />
          <label className="flex items-center gap-1.5 text-[11px] text-[#868686] cursor-pointer">
            <input type="checkbox" checked={!!reference?.newLesion} onChange={e => setReference({ newLesion: e.target.checked })} className="accent-[#F87171]" />
            New lesion present (progression)
          </label>

          {result.warnings.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              {result.warnings.map(w => <span key={w} className="text-[10px] text-[#F59E0B] leading-snug">{w}</span>)}
            </div>
          )}
          <span className="text-[10px] text-[#6B6B6B] leading-snug mt-1">
            Non-target lesions and the final overall response are for the reader to judge. Baseline and nadir
            are typed in for now; they'll come from prior studies once comparison is available.
          </span>
        </div>
      </div>
    </div>
  );
}
