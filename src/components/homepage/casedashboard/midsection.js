import React, { useState, useEffect, useCallback, useRef } from "react";
import CornerstoneViewport from "./CornerstoneViewport";
import ImageComparisonSlider from "./ImageComparisonSlider";
import { buildImageIds, getDicomMetadata, isDicomImage } from "../../../lib/dicomUtils";
import { annotation as csAnnotation, Enums as csToolsEnums } from "@cornerstonejs/tools";
import {
  FiZoomIn, FiZoomOut, FiMaximize2, FiRotateCw, FiRotateCcw,
  FiChevronLeft, FiChevronRight,
  FiTrash2, FiDelete,
} from "react-icons/fi";
import { MdFlip, MdInvertColors } from "react-icons/md";
import { RiContrastFill } from "react-icons/ri";
import { LiaCircleSolid } from "react-icons/lia";
import { TfiText } from "react-icons/tfi";
import { GoArrowUpRight } from "react-icons/go";
import { IoSquareOutline } from "react-icons/io5";
import { PiPolygonLight } from "react-icons/pi";
import { RiSketching } from "react-icons/ri";
import { TbRulerMeasure, TbAngle, TbCirclePlus } from "react-icons/tb";
import { CiEraser } from "react-icons/ci";

// ── Small top-bar button ───────────────────────────────────────────────────────
function ViewBtn({ icon, label, active, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`w-7 h-7 flex items-center justify-center rounded-lg border-none cursor-pointer transition-all duration-150 shrink-0 ${active ? "bg-[#0694FB] text-white"
        : disabled ? "bg-transparent text-[#222] cursor-not-allowed"
          : "bg-transparent text-[#6B6B6B] hover:bg-[#1a1a1a] hover:text-white"
        }`}
    >
      {icon}
    </button>
  );
}

function VDivider() { return <div className="w-px h-5 bg-[#1E1E1E] shrink-0" />; }

// ── Vertical tool panel button ─────────────────────────────────────────────────
function ToolBtn({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-10 h-10 flex items-center justify-center rounded-xl border-none cursor-pointer transition-all duration-150 ${active
        ? "bg-[#0694FB] text-white"
        : "bg-transparent text-[#555] hover:bg-[#1a1a1a] hover:text-white"
        }`}
    >
      {icon}
    </button>
  );
}

function HDivider() { return <div className="w-6 h-px bg-[#1E1E1E]" />; }

// ── DICOM corner overlays ──────────────────────────────────────────────────────
function MetaLine({ label, value, bright }) {
  if (!value && value !== 0) return null;
  return (
    <p className={`m-0 font-mono leading-tight ${bright ? "text-white/70 text-[10px]" : "text-white/35 text-[9px]"}`}>
      {label ? <span className="text-white/20">{label} </span> : null}{value}
    </p>
  );
}

function DicomOverlay({ meta, currentIndex, total, wl, zoomPct, rotation, inverted }) {
  const wc = wl?.wc != null ? Math.round(wl.wc) : (meta?.windowCenter != null ? Math.round(meta.windowCenter) : null);
  const ww = wl?.ww != null ? Math.round(wl.ww) : (meta?.windowWidth != null ? Math.round(meta.windowWidth) : null);

  return (
    <>
      {/* ── Top-left: Patient ── */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-0.5 pointer-events-none select-none">
        <MetaLine value={meta?.patientName} bright />
        <MetaLine label="ID" value={meta?.patientId} />
        <MetaLine label="DOB" value={meta?.patientDob} />
        <MetaLine label="Sex" value={meta?.patientSex} />
      </div>

      {/* ── Top-right: Study / Series ── */}
      <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-0.5 pointer-events-none select-none">
        <MetaLine value={meta?.modality} bright />
        <MetaLine value={meta?.institution} />
        <MetaLine value={meta?.studyDate} />
        <MetaLine value={meta?.studyDescription} />
        <MetaLine value={meta?.seriesDescription} />
        {meta?.accessionNumber && <MetaLine label="Acc" value={meta.accessionNumber} />}
      </div>

      {/* ── Bottom-left: Image geometry + view state ── */}
      <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-0.5 pointer-events-none select-none">
        {meta?.rows && meta?.columns && (
          <MetaLine value={`${meta.columns} × ${meta.rows} px`} />
        )}
        {meta?.sliceThickness != null && (
          <MetaLine label="Thick" value={`${meta.sliceThickness} mm`} />
        )}
        {meta?.pixelSpacing && (
          <MetaLine label="Px sp" value={`${meta.pixelSpacing[0].toFixed(3)} mm`} />
        )}
        <MetaLine value={`Zoom ${zoomPct}%`} />
        {rotation !== 0 && <MetaLine value={`Rot ${rotation}°`} />}
        {inverted && <MetaLine value="INV" />}
      </div>

      {/* ── Bottom-right: W/L + slice counter ── */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-0.5 pointer-events-none select-none">
        {wc != null && <MetaLine label="WC" value={wc} bright />}
        {ww != null && <MetaLine label="WW" value={ww} />}
        <MetaLine
          value={total > 0 ? `${currentIndex + 1} / ${total}` : "— / —"}
        />
      </div>
    </>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
function Midsection({ selectedImage, onSelectImage, images = [], activeStudy, activeSeries, onRunAnalysis, aiLoading, inferenceResult, onInferenceResult }) {
  const [activeTool, setActiveTool] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Mirror state for display only — Cornerstone owns the actual values
  const [zoomPct, setZoomPct] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [inverted, setInverted] = useState(false);
  const [wlActive, setWlActive] = useState(false);

  // DICOM metadata extracted from the first DICOM file in the series
  const [dicomMeta, setDicomMeta] = useState(null);
  // Live W/L values read from the viewport
  const [wl, setWl] = useState(null);

  // Draggable tool panel
  const viewportWrapRef = useRef(null);
  const [panelPos, setPanelPos] = useState({ x: 8, y: 60 });
  const [panelDragging, setPanelDragging] = useState(false);

  const vpRef = useRef(null); // CornerstoneViewport imperative handle

  // Track whether any annotation is currently selected (drives toolbar button state)
  const [hasSelection, setHasSelection] = useState(false);

  // Listen for Cornerstone annotation selection changes
  useEffect(() => {
    const onSelectionChange = () => {
      const selected = csAnnotation.selection.getAnnotationsSelected?.() ?? [];
      setHasSelection(selected.length > 0);
    };
    const el = document.querySelector("[data-viewport-uid]") ?? window;
    // Cornerstone fires this event on the element; fall back to window
    const eventName = csToolsEnums.Events.ANNOTATION_SELECTION_CHANGE;
    document.addEventListener(eventName, onSelectionChange);
    return () => document.removeEventListener(eventName, onSelectionChange);
  }, []);

  // Build imageIds asynchronously — DICOM files are expanded into per-frame ids
  const [imageIds, setImageIds] = useState([]);
  useEffect(() => {
    let cancelled = false;
    buildImageIds(images).then(ids => {
      if (!cancelled) setImageIds(ids);
    });
    return () => { cancelled = true; };
  }, [images]);

  // Extract DICOM metadata from the first DICOM image in the series
  useEffect(() => {
    const firstDicom = images.find(isDicomImage);
    if (!firstDicom) { setDicomMeta(null); return; }
    let cancelled = false;
    getDicomMetadata(firstDicom.url).then(meta => {
      if (!cancelled) setDicomMeta(meta);
    });
    return () => { cancelled = true; };
  }, [images]);

  // Poll the viewport for live W/L values (updates as user drags W/L tool)
  useEffect(() => {
    if (imageIds.length === 0) return;
    const id = setInterval(() => {
      const props = vpRef.current?.getProperties?.();
      if (!props?.voiRange) return;
      const { lower, upper } = props.voiRange;
      const ww = upper - lower;
      const wc = lower + ww / 2;
      setWl({ wc, ww });
    }, 500);
    return () => clearInterval(id);
  }, [imageIds]);

  // Keep Cornerstone in sync with the selected image
  useEffect(() => {
    const idx = images.findIndex(img => img.url === selectedImage);
    if (idx >= 0) {
      vpRef.current?.setImageIndex(idx);
      setCurrentIndex(idx);
    }
  }, [selectedImage, images]);

  // Slice navigation
  const goTo = useCallback((idx) => {
    if (idx >= 0 && idx < images.length) {
      onSelectImage?.(images[idx].url);
      vpRef.current?.setImageIndex(idx);
      setCurrentIndex(idx);
    }
  }, [images, onSelectImage]);

  useEffect(() => {
    const h = (e) => {
      // Delete / Backspace — remove selected annotation if one is active
      if (e.key === "Delete" || e.key === "Backspace") {
        const removed = vpRef.current?.deleteSelectedAnnotations();
        if (removed) { setHasSelection(false); return; }
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") goTo(currentIndex - 1);
      if (e.key === "ArrowDown" || e.key === "ArrowRight") goTo(currentIndex + 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [currentIndex, goTo]);

  // Tool panel drag
  const handlePanelGripDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setPanelDragging(true);
    const rect = viewportWrapRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left - panelPos.x;
    const startY = e.clientY - rect.top - panelPos.y;
    const onMove = (mv) => {
      const r = viewportWrapRef.current.getBoundingClientRect();
      setPanelPos({
        x: Math.max(0, mv.clientX - r.left - startX),
        y: Math.max(0, mv.clientY - r.top - startY),
      });
    };
    const onUp = () => {
      setPanelDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const toggleTool = (name) => setActiveTool(t => t === name ? null : name);

  const drawTools = [
    { name: "circle", icon: <LiaCircleSolid size={20} />, label: "Draw Circle (Elliptical ROI)" },
    { name: "square", icon: <IoSquareOutline size={20} />, label: "Draw Rectangle ROI" },
    { name: "arrow", icon: <GoArrowUpRight size={19} />, label: "Arrow annotation" },
  ];

  const measureTools = [
    { name: "ruler", icon: <TbRulerMeasure size={19} />, label: "Length measurement" },
    { name: "angle", icon: <TbAngle size={19} />, label: "Angle measurement" },
    { name: "marker", icon: <TbCirclePlus size={19} />, label: "Probe marker" },
  ];

  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0 h-full overflow-hidden">

      {/* ── Top toolbar ── */}
      <div className="bg-[#0C0C0C] rounded-xl px-3 py-2 flex justify-between gap-2 shrink-0">
        <div className="flex items-center">
          <ViewBtn icon={<FiChevronLeft size={16} />} label="Prev slice" disabled={currentIndex <= 0} onClick={() => goTo(currentIndex - 1)} />
          <span className="text-[#3a3a3a] text-[13px] font-mono w-[60px] text-center shrink-0">
            {images.length > 0 ? `${currentIndex + 1} / ${images.length}` : "— / —"}
          </span>
          <ViewBtn icon={<FiChevronRight size={16} />} label="Next slice" disabled={currentIndex >= images.length - 1} onClick={() => goTo(currentIndex + 1)} />

          <VDivider />

          {/* Zoom */}
          <ViewBtn icon={<FiZoomOut size={16} />} label="Zoom out" onClick={() => { vpRef.current?.zoomOut(); setZoomPct(p => Math.max(10, p - 25)); }} />
          <span className="text-[#3a3a3a] text-[10px] font-mono w-[36px] text-center shrink-0">{zoomPct}%</span>
          <ViewBtn icon={<FiZoomIn size={16} />} label="Zoom in" onClick={() => { vpRef.current?.zoomIn(); setZoomPct(p => Math.min(500, p + 25)); }} />
          <ViewBtn icon={<FiMaximize2 size={12} />} label="Fit to window" onClick={() => { vpRef.current?.resetFit(); setZoomPct(100); setRotation(0); setFlipH(false); setFlipV(false); setInverted(false); setWlActive(false); setActiveTool(null); }} />

          <VDivider />

          {/* Rotate */}
          <ViewBtn icon={<FiRotateCcw size={16} />} label="Rotate CCW" onClick={() => { vpRef.current?.rotateCCW(); setRotation(r => ((r - 90) + 360) % 360); }} />
          <ViewBtn icon={<FiRotateCw size={16} />} label="Rotate CW" onClick={() => { vpRef.current?.rotateCW(); setRotation(r => (r + 90) % 360); }} />

          {/* Flip */}
          <ViewBtn icon={<MdFlip size={16} />} label="Flip horizontal" active={flipH} onClick={() => { vpRef.current?.flipH(); setFlipH(f => !f); }} />
          <ViewBtn
            icon={<MdFlip size={16} style={{ transform: "rotate(90deg)" }} />}
            label="Flip vertical"
            active={flipV}
            onClick={() => { vpRef.current?.flipV(); setFlipV(f => !f); }}
          />

          <VDivider />

          {/* W/L toggle — activates Cornerstone WindowLevelTool as primary */}
          <ViewBtn
            icon={<RiContrastFill size={16} />}
            label="Window / Level — drag on image"
            active={wlActive}
            onClick={() => {
              setWlActive(w => !w);
              // When toggling W/L, clear any annotation tool
              if (!wlActive) setActiveTool(null);
            }}
          />
          <ViewBtn icon={<MdInvertColors size={20} />} label="Invert" active={inverted} onClick={() => { vpRef.current?.toggleInvert(); setInverted(i => !i); }} />

          <VDivider />

          <button
            onClick={() => { vpRef.current?.resetFit(); setZoomPct(100); setRotation(0); setFlipH(false); setFlipV(false); setInverted(false); setWlActive(false); setActiveTool(null); }}
            className="text-[#3a3a3a] hover:text-white text-[12px] font-mono px-2 py-1 rounded-lg hover:bg-[#1a1a1a] bg-transparent border-none cursor-pointer transition-all shrink-0"
          >
            RESET
          </button>
        </div>

        {/* Slice navigation */}


        <div className="flex items-center gap-2">
          <button
            onClick={onRunAnalysis}
            disabled={aiLoading}
            className="flex items-center gap-1.5 px-4 py-[8px] rounded-full bg-[#06fb64] hover:bg-[#05d183] text-black text-[13px] border border-[#1E1E1E] hover:border-[#2a2a2a] cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {aiLoading ? (
              <>
                <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin shrink-0" />
                Analyzing…
              </>
            ) : "Run AI Analysis"}
          </button>
          <button className="flex items-center gap-1.5 px-4 py-[8px] rounded-full  bg-[#0694FB] hover:bg-[#0578d1] text-white text-[13px]  hover:text-white hover:border-[#2a2a2a] cursor-pointer transition-all">
            Save Draft
          </button>
          {/* <button className="flex items-center gap-1.5 px-4 py-[8px] rounded-full bg-[#0694FB] hover:bg-[#0578d1] text-white text-[13px] font-medium border-none cursor-pointer transition-colors">
            Sign Report
          </button> */}
        </div>
      </div>

      {/* ── Viewport ── */}
      <div ref={viewportWrapRef} className="flex-1 bg-black rounded-xl relative overflow-hidden">

        {/* Empty state */}
        {imageIds.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-0 pointer-events-none">
            <img src="/dimensions.png" alt="" className="w-10 h-10 object-contain opacity-20" />
            <p className="text-[#2a2a2a] text-sm m-0">Select a slice from the panel</p>
          </div>
        )}

        {/* Cornerstone element */}
        <div className="absolute inset-0 z-10">
          <CornerstoneViewport
            ref={vpRef}
            imageIds={imageIds}
            activeTool={activeTool}
            onIndexChange={setCurrentIndex}
          />
        </div>

        {/* DICOM corner overlays */}
        {imageIds.length > 0 && (
          <DicomOverlay
            meta={dicomMeta}
            currentIndex={currentIndex}
            total={imageIds.length}
            wl={wl}
            zoomPct={zoomPct}
            rotation={rotation}
            inverted={inverted}
          />
        )}

        {/* W/L hint */}
        {wlActive && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-black/60 border border-[#0694FB]/30 rounded-lg px-3 py-1 pointer-events-none">
            <p className="text-[#0694FB] text-[10px] font-mono m-0">Left drag: adjust Window / Level</p>
          </div>
        )}

        {/* ── Draggable annotation toolbar ── */}
        <div
          style={{ left: panelPos.x, top: panelPos.y }}
          className="absolute z-20 flex flex-col items-center gap-1 bg-[#0d0d0d]/90 border border-[#1E1E1E] rounded-xl px-1.5 py-2 backdrop-blur-sm select-none"
        >
          {/* Drag handle */}
          <div
            onMouseDown={handlePanelGripDown}
            className={`w-full flex justify-center py-0.5 mb-0.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-[#1a1a1a] transition-colors ${panelDragging ? "cursor-grabbing" : ""}`}
            title="Drag to move"
          >
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <circle cx="3" cy="2" r="1.2" fill="#3a3a3a" />
              <circle cx="7" cy="2" r="1.2" fill="#3a3a3a" />
              <circle cx="11" cy="2" r="1.2" fill="#3a3a3a" />
              <circle cx="3" cy="8" r="1.2" fill="#3a3a3a" />
              <circle cx="7" cy="8" r="1.2" fill="#3a3a3a" />
              <circle cx="11" cy="8" r="1.2" fill="#3a3a3a" />
            </svg>
          </div>

          {/* Draw tools */}
          {drawTools.map(t => (
            <ToolBtn key={t.name} icon={t.icon} label={t.label} active={activeTool === t.name} onClick={() => toggleTool(t.name)} />
          ))}

          <HDivider />

          {/* Measure tools */}
          {measureTools.map(t => (
            <ToolBtn key={t.name} icon={t.icon} label={t.label} active={activeTool === t.name} onClick={() => toggleTool(t.name)} />
          ))}

          <HDivider />

          {/* Delete selected annotation */}
          <ToolBtn
            icon={<FiDelete size={15} />}
            label={hasSelection ? "Delete selected (Del)" : "Click an annotation to select it"}
            active={hasSelection}
            onClick={() => {
              const removed = vpRef.current?.deleteSelectedAnnotations();
              if (removed) setHasSelection(false);
            }}
          />

          {/* Clear all annotations */}
          <ToolBtn icon={<FiTrash2 size={15} />} label="Clear all annotations" onClick={() => {
            try { csAnnotation.state.removeAllAnnotations(); } catch (_) { }
            setHasSelection(false);
            vpRef.current?.render?.();
          }} />
        </div>

        {/* ── Inference comparison slider ── */}
        {inferenceResult && selectedImage && (() => {
          const overlay = inferenceResult.heatmap ?? inferenceResult.mask;
          if (!overlay) return null;
          const isBase64 = !overlay.startsWith("http") && !overlay.startsWith("data:");
          const overlaySrc = isBase64 ? `data:image/png;base64,${overlay}` : overlay;
          const label = inferenceResult.heatmap ? "Heatmap" : "Tumor Mask";
          return (
            <ImageComparisonSlider
              originalSrc={selectedImage}
              overlaySrc={overlaySrc}
              overlayLabel={label}
              onClose={() => onInferenceResult(null)}
            />
          );
        })()}
      </div>
    </div>
  );
}

export default Midsection;
