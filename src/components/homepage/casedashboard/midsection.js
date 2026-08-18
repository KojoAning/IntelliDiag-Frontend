import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CornerstoneViewport from "./CornerstoneViewport";
import { buildImageIds, getDicomMetadata, isDicomImage } from "../../../lib/dicomUtils";
import { annotation as csAnnotation, Enums as csToolsEnums } from "@cornerstonejs/tools";
import {
  FiZoomIn, FiZoomOut, FiMaximize2, FiRotateCw, FiRotateCcw,
  FiChevronLeft, FiChevronRight,
  FiTrash2, FiDelete,
  FiPlay, FiPause, FiSkipBack, FiSkipForward,
  FiX, FiInfo,
  FiLoader,
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
    <p className={`m-0 font-mono leading-tight ${bright ? "text-white/70 text-[13px]" : "text-white/35 text-[12px]"}`}>
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
function Midsection({ selectedImage, onSelectImage, images = [], activeStudy, activeSeries, onRunAnalysis, aiLoading, inferenceProgress, inferenceResult, onInferenceResult, onRunTranslation, translationActive, translationMode, onCloseTranslation, jobStatus }) {
  const [activeTool, setActiveTool] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef(null);

  // Mirror state for display only — Cornerstone owns the actual values
  const [zoomPct, setZoomPct] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [inverted, setInverted] = useState(false);
  const [wlActive, setWlActive] = useState(false);

  // Cine playback
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(3);
  const playRef = useRef(null);

  useEffect(() => {
    if (!playing || images.length <= 1) {
      clearInterval(playRef.current);
      playRef.current = null;
      return;
    }
    playRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        const next = prev + 1 >= images.length ? 0 : prev + 1;
        onSelectImage?.(images[next]?.blobUrl ?? images[next]?.url);
        vpRef.current?.setImageIndex(next);
        return next;
      });
    }, 1000 / fps);
    return () => clearInterval(playRef.current);
  }, [playing, fps, images, onSelectImage]);

  // Stop cine when images change
  useEffect(() => { setPlaying(false); }, [images]);

  // Close info dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (infoRef.current && !infoRef.current.contains(e.target)) setInfoOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // DICOM metadata extracted from the first DICOM file in the series
  const [dicomMeta, setDicomMeta] = useState(null);
  // Live W/L values read from the viewport
  const [wl, setWl] = useState(null);

  // Draggable tool panel
  const viewportWrapRef = useRef(null);
  const [panelPos, setPanelPos] = useState({ x: 8, y: 60 });
  const [panelDragging, setPanelDragging] = useState(false);

  const vpRef = useRef(null); // CornerstoneViewport imperative handle
  const vpRef2 = useRef(null); // Right panel (translation result)

  // Mask overlay opacity (0–1) — controlled by the user slider
  const [maskOpacity, setMaskOpacity] = useState(0.5);

  // Camera transform synced from Cornerstone — keeps mask aligned with the DICOM image
  const [maskTransform, setMaskTransform] = useState({ zoom: 1, panX: 0, panY: 0, rotation: 0, flipH: false, flipV: false });
  const handleCameraChanged = useCallback((t) => setMaskTransform(t), []);

  // Track whether any annotation is currently selected (drives toolbar button state)
  const [hasSelection, setHasSelection] = useState(false);

  // Arrow annotation custom dialog
  const [arrowDialog, setArrowDialog] = useState(null); // { resolve: (label) => void }
  const [arrowLabel, setArrowLabel] = useState("");
  const arrowInputRef = useRef(null);

  const handleArrowTextRequest = useCallback((doneCallback) => {
    setArrowLabel("");
    setArrowDialog({ resolve: doneCallback });
  }, []);

  const submitArrowLabel = useCallback(() => {
    if (arrowDialog) {
      arrowDialog.resolve(arrowLabel.trim() || "");
      setArrowDialog(null);
      setArrowLabel("");
    }
  }, [arrowDialog, arrowLabel]);

  const cancelArrowLabel = useCallback(() => {
    if (arrowDialog) {
      arrowDialog.resolve("");
      setArrowDialog(null);
      setArrowLabel("");
    }
  }, [arrowDialog]);

  // Auto-focus the input when dialog opens
  useEffect(() => {
    if (arrowDialog && arrowInputRef.current) {
      arrowInputRef.current.focus();
    }
  }, [arrowDialog]);

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

  // Extract DICOM metadata from the first DICOM image in the series.
  // Only use the local blob URL — never hit the stream endpoint for metadata.
  useEffect(() => {
    const firstDicom = images.find(isDicomImage);
    const metaSrc = firstDicom?.blobUrl;
    if (!metaSrc) { setDicomMeta(null); return; }
    let cancelled = false;
    getDicomMetadata(metaSrc).then(meta => {
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

  // Keep Cornerstone in sync with the selected image.
  // Guard: only call setImageIndex if the viewport isn't already on that index —
  // otherwise the IMAGE_RENDERED → onSelectImage → setImageIndex loop blanks the viewport.
  useEffect(() => {
    const idx = images.findIndex(img => (img.blobUrl ?? img.url) === selectedImage);
    if (idx >= 0) {
      if (vpRef.current?.getCurrentIndex?.() !== idx) {
        vpRef.current?.setImageIndex(idx);
      }
      setCurrentIndex(idx);
    }
  }, [selectedImage, images]);

  // Slice navigation
  const goTo = useCallback((idx) => {
    if (idx >= 0 && idx < images.length) {
      onSelectImage?.(images[idx].blobUrl ?? images[idx].url);
      vpRef.current?.setImageIndex(idx);
      setCurrentIndex(idx);
    }
  }, [images, onSelectImage]);

  useEffect(() => {
    const h = (e) => {
      // Delete / Backspace — remove selected annotation if one is active
      if (e.key === "Delete" || e.key === "Backspace") {
        // Ignore if the user is typing in an input/textarea
        const tag = e.target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
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
    { name: "polygon", icon: <PiPolygonLight size={19} />, label: "Polygon ROI" },
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
          <span className="text-[#6B6B6B] text-[13px] font-mono w-[60px] text-center shrink-0">
            {images.length > 0 ? `${currentIndex + 1} / ${images.length}` : "— / —"}
          </span>
          <ViewBtn icon={<FiChevronRight size={16} />} label="Next slice" disabled={currentIndex >= images.length - 1} onClick={() => goTo(currentIndex + 1)} />

          <VDivider />

          {/* Zoom */}
          <ViewBtn icon={<FiZoomOut size={16} />} label="Zoom out" onClick={() => { vpRef.current?.zoomOut(); setZoomPct(p => Math.max(10, p - 25)); }} />
          <span className="text-[#6B6B6B] text-[10px] font-mono w-[36px] text-center shrink-0">{zoomPct}%</span>
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
            className="text-[#6B6B6B] hover:text-white text-[12px] font-mono px-2 py-1 rounded-lg hover:bg-[#1a1a1a] bg-transparent border-none cursor-pointer transition-all shrink-0"
          >
            RESET
          </button>
        </div>

        {/* Slice navigation */}


        <div className="flex items-center gap-2">
          <button
            onClick={() => onRunAnalysis()}
            disabled={aiLoading}
            className="flex items-center justify-center gap-2 px-4 py-[8px] rounded-full bg-[#0694FB] hover:bg-[#036cb8] text-white text-[13px] border border-[#1E1E1E] hover:border-[#2a2a2a] cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ minWidth: 148 }}
          >
            {aiLoading ? (
              inferenceProgress != null ? (
                <div className="flex items-center gap-2" style={{ width: 116 }}>
                  <FiLoader size={18} className="animate-spin" />
                  <div className="flex-1 h-1.5 bg-black/20 rounded-full overflow-hidden">

                    <div
                      className="h-full bg-black rounded-full transition-all duration-300"
                      style={{ width: `${inferenceProgress}%` }}
                    />
                  </div>
                  <span className="text-[12px] font-mono shrink-0">{inferenceProgress}%</span>
                </div>
              ) : (
                <>
                  <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin shrink-0" />
                  Analyzing…
                </>
              )
            ) : "Run Ai Analysis"}
          </button>
          <button
            onClick={() => translationActive ? onCloseTranslation() : onRunTranslation()}
            className={`flex items-center gap-2.5 px-4 py-[8px] rounded-full text-[13px] cursor-pointer transition-all border-none ${translationActive
                ? "bg-[#A855F7] text-white"
                : "bg-[#1a1a1a] text-[#6B6B6B] hover:text-white hover:bg-[#222]"
              }`}
          >
            Translate Image
            {/* Toggle pill */}
            <span className={`relative inline-flex w-8 h-4 rounded-full transition-colors duration-200 shrink-0 ${translationActive ? "bg-white/30" : "bg-[#333]"}`}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 ${translationActive ? "left-[18px]" : "left-0.5"}`} />
            </span>
          </button>
          {/* <button className="flex items-center gap-1.5 px-4 py-[8px] rounded-full bg-[#0694FB] hover:bg-[#0578d1] text-white text-[13px] font-medium border-none cursor-pointer transition-colors">
            Sign Report
          </button> */}
        </div>
      </div>

      {/* ── Viewport ── */}
      <div className="flex-1 min-h-0 flex flex-row gap-2">
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
              onIndexChange={(idx) => {
                setCurrentIndex(idx);
                // Keep selectedImage in sync so thumbnail highlight and mask overlay follow scroll
                const img = images[idx];
                if (img) onSelectImage?.(img.blobUrl ?? img.url);
              }}
              onArrowTextRequest={handleArrowTextRequest}
              onCameraChanged={handleCameraChanged}
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

          {/* ── Job failed banner ── */}
          {jobStatus === "failed" && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[#1a0a0a] border border-red-500/30 rounded-lg px-4 py-2 pointer-events-none">
              <FiX size={12} className="text-red-400 shrink-0" />
              <p className="text-red-400 text-[12px] font-mono m-0">Inference job failed</p>
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
                <circle cx="3" cy="2" r="1.2" fill="#6B6B6B" />
                <circle cx="7" cy="2" r="1.2" fill="#6B6B6B" />
                <circle cx="11" cy="2" r="1.2" fill="#6B6B6B" />
                <circle cx="3" cy="8" r="1.2" fill="#6B6B6B" />
                <circle cx="7" cy="8" r="1.2" fill="#6B6B6B" />
                <circle cx="11" cy="8" r="1.2" fill="#6B6B6B" />
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

          {/* ── Cine playback panel ── */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-[#0d0d0d]/85 border border-[#1E1E1E] rounded-full px-4 py-2 backdrop-blur-sm select-none">
              {/* Skip to first */}
              <button
                onClick={() => { setPlaying(false); goTo(0); }}
                title="First slice"
                className="w-7 h-7 flex items-center justify-center rounded-full bg-transparent border-none text-[#6B6B6B] hover:text-white cursor-pointer transition-colors"
              >
                <FiSkipBack size={14} />
              </button>

              {/* Play / Pause */}
              <button
                onClick={() => setPlaying(p => !p)}
                title={playing ? "Pause" : "Play through slices"}
                className={`w-9 h-9 flex items-center justify-center rounded-full border-none cursor-pointer transition-all ${playing
                    ? "bg-white text-black hover:bg-white/80"
                    : "bg-[#0694FB] text-white hover:bg-[#0578d1]"
                  }`}
              >
                {playing ? <FiPause size={16} /> : <FiPlay size={16} style={{ marginLeft: 2 }} />}
              </button>

              {/* Skip to last */}
              <button
                onClick={() => { setPlaying(false); goTo(images.length - 1); }}
                title="Last slice"
                className="w-7 h-7 flex items-center justify-center rounded-full bg-transparent border-none text-[#6B6B6B] hover:text-white cursor-pointer transition-colors"
              >
                <FiSkipForward size={14} />
              </button>

              {/* Divider */}
              <div className="w-px h-5 bg-[#2a2a2a]" />

              {/* Scrubber */}
              <input
                type="range"
                min={0}
                max={images.length - 1}
                value={currentIndex}
                onChange={(e) => { setPlaying(false); goTo(Number(e.target.value)); }}
                className="w-[120px] h-1 accent-[#0694FB] cursor-pointer"
                title={`Slice ${currentIndex + 1} / ${images.length}`}
              />

              {/* Frame counter */}
              <span className="text-[#6B6B6B] text-[11px] font-mono w-[50px] text-center shrink-0">
                {currentIndex + 1}/{images.length}
              </span>

              {/* Divider */}
              <div className="w-px h-5 bg-[#2a2a2a]" />

              {/* Speed control */}
              <button
                onClick={() => setFps(f => Math.max(1, f - 2))}
                title="Slower"
                className="text-[#6B6B6B] hover:text-white text-[11px] font-mono bg-transparent border-none cursor-pointer transition-colors px-1"
              >
                −
              </button>
              <span className="text-[#6B6B6B] text-[10px] font-mono w-[32px] text-center shrink-0">{fps} fps</span>
              <button
                onClick={() => setFps(f => Math.min(30, f + 2))}
                title="Faster"
                className="text-[#6B6B6B] hover:text-white text-[11px] font-mono bg-transparent border-none cursor-pointer transition-colors px-1"
              >
                +
              </button>
            </div>
          )}

          {/* ── Segmentation mask overlay ── */}
          {inferenceResult && (() => {
            const sliceData = inferenceResult.slices?.[currentIndex];
            const overlay = sliceData?.mask ?? sliceData?.heatmap ?? sliceData?.cam ?? inferenceResult.heatmap ?? inferenceResult.mask;
            if (!overlay) return null;
            const isBase64 = !overlay.startsWith("http") && !overlay.startsWith("data:");
            const overlaySrc = isBase64 ? `data:image/png;base64,${overlay}` : overlay;

            // Determine badge label based on result type
            const isGradCam = !inferenceResult.slices && inferenceResult.heatmap != null;
            let badgeText, badgeColor, overlayLabel;
            if (isGradCam) {
              const cls = inferenceResult.predicted_class ?? "—";
              const conf = inferenceResult.confidence != null ? ` · ${(inferenceResult.confidence * 100).toFixed(0)}%` : "";
              badgeText = `Class ${cls}${conf}`;
              badgeColor = "text-[#0694FB]";
              overlayLabel = "GradCAM";
            } else {
              const hasTumor = sliceData?.has_tumor;
              const conf = sliceData?.confidence;
              badgeText = hasTumor
                ? `Tumor · ${conf != null ? (conf * 100).toFixed(0) + "%" : ""}`
                : "No tumor";
              badgeColor = hasTumor ? "text-red-400" : "text-[#6B6B6B]";
              overlayLabel = "Mask";
            }

            return (
              <>
                {/* Overlay image — screen blend so white regions light up over the DICOM,
                  coloured orange-red via CSS filter for clinical clarity */}
                <img
                  src={overlaySrc}
                  alt="inference overlay"
                  style={{
                    opacity: maskOpacity,
                    mixBlendMode: "screen",
                    filter: "sepia(1) saturate(8) hue-rotate(320deg)",
                    transformOrigin: "center center",
                    transform: [
                      `translate(${maskTransform.panX}px, ${maskTransform.panY}px)`,
                      `scale(${maskTransform.zoom})`,
                      `rotate(${maskTransform.rotation}deg)`,
                      maskTransform.flipH ? "scaleX(-1)" : "",
                      maskTransform.flipV ? "scaleY(-1)" : "",
                    ].filter(Boolean).join(" "),
                  }}
                  className="absolute inset-0 w-full h-full object-contain z-20 pointer-events-none"
                />

                {/* Overlay controls — opacity slider + dismiss */}
                <div className="absolute top-3 right-3 z-30 flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-2 bg-[#0d0d0d]/90 border border-[#1E1E1E] rounded-xl px-3 py-2 backdrop-blur-sm">
                    <span className={`text-[10px] font-mono ${badgeColor}`}>{badgeText}</span>
                    <div className="w-px h-3 bg-[#2a2a2a]" />
                    <span className="text-[#6B6B6B] text-[10px]">{overlayLabel}</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={maskOpacity}
                      onChange={e => setMaskOpacity(Number(e.target.value))}
                      className="w-[80px] h-1 accent-[#0694FB] cursor-pointer"
                    />
                    <span className="text-[#6B6B6B] text-[10px] w-[28px] text-right">
                      {Math.round(maskOpacity * 100)}%
                    </span>
                    <button
                      onClick={() => onInferenceResult(null)}
                      className="text-[#6B6B6B] hover:text-white text-[12px] bg-transparent border-none cursor-pointer leading-none transition-colors ml-1"
                      title="Close overlay"
                    >✕</button>
                  </div>
                </div>
              </>
            );
          })()}

          {/* placeholder — dialog rendered at root level below */}
        </div>

        {/* ── Right panel: translation result ── */}
        {translationActive && (
          <div className="flex-1 bg-black rounded-xl relative overflow-hidden flex flex-col">
            {/* Label */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1 pointer-events-none">
              <span className="text-[#A855F7] text-[13px] ">
                {translationMode?.from} → {translationMode?.to} · Translation Result
              </span>
            </div>

            {/* Split view controls */}
            <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5">
              {/* Info button + dropdown */}
              <div ref={infoRef} className="relative">
                <button
                  onClick={() => setInfoOpen(v => !v)}
                  className={`w-7 h-7 flex items-center justify-center rounded-full border cursor-pointer transition-all ${infoOpen ? "bg-[#A855F7]/20 border-[#A855F7]/40 text-[#A855F7]" : "bg-[#1a1a1a] border-[#2a2a2a] text-[#6B6B6B] hover:text-white hover:border-[#6B6B6B]"}`}
                  title="Translation info"
                >
                  <FiInfo size={13} />
                </button>
                {infoOpen && (
                  <div
                    className="absolute right-0 top-[calc(100%+8px)] w-[240px] rounded-[18px] overflow-hidden shadow-2xl"
                    style={{
                      background: "rgba(30,30,30,0.85)",
                      backdropFilter: "blur(28px)",
                      WebkitBackdropFilter: "blur(28px)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      animation: "notifFadeIn 0.18s ease forwards",
                    }}
                  >
                    <div className="px-4 pt-4 pb-2">
                      <p className="text-white text-[13px] font-medium m-0">Translation Info</p>
                    </div>
                    <div className="flex flex-col gap-2 px-4 pb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[#6B6B6B] text-[12px]">From</span>
                        <span className="text-white text-[12px] font-medium">{translationMode?.from ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#6B6B6B] text-[12px]">To</span>
                        <span className="text-white text-[12px] font-medium">{translationMode?.to ?? "—"}</span>
                      </div>
                      <div className="h-px bg-white/5 my-1" />
                      <div className="flex items-center justify-between">
                        <span className="text-[#6B6B6B] text-[12px]">Mode</span>
                        <span className="text-[#A855F7] text-[12px] font-medium">Split View</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={onCloseTranslation}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#6B6B6B] hover:text-white hover:border-[#6B6B6B] cursor-pointer transition-all"
                title="Close split view"
              >
                <FiX size={13} />
              </button>
            </div>

            {/* Empty state */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-0 pointer-events-none">
              <img src="/dimensions.png" alt="" className="w-10 h-10 object-contain opacity-10" />
              <p className="text-[#2a2a2a] text-sm m-0">Translated image will appear here</p>
            </div>

            {/* Empty Cornerstone viewport */}
            <div className="absolute inset-0 z-10">
              <CornerstoneViewport ref={vpRef2} imageIds={[]} activeTool={null} />
            </div>
          </div>
        )}
      </div>

      {/* ── Arrow annotation label dialog ── */}
      <AnimatePresence>
        {arrowDialog && (
          <motion.div
            className="fixed inset-0 z-[999] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={cancelArrowLabel}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-[400px] bg-[#161616] border border-[#1E1E1E] rounded-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between px-7 pt-7 pb-5">
                <div>
                  <h2 className="text-white text-[17px] font-medium m-0">Annotation Label</h2>
                  <p className="text-[#6B6B6B] text-[13px] m-0 mt-1">Enter a label for this annotation</p>
                </div>
                <button onClick={cancelArrowLabel} className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1 mt-0.5">
                  <FiX size={18} />
                </button>
              </div>
              {/* Input */}
              <div className="px-7 pb-5">
                <input
                  ref={arrowInputRef}
                  type="text"
                  value={arrowLabel}
                  onChange={e => setArrowLabel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") submitArrowLabel();
                    if (e.key === "Escape") cancelArrowLabel();
                  }}
                  placeholder="e.g. Lesion, Fracture, Mass…"
                  className="w-full bg-[#111111] border border-[#1E1E1E] rounded-xl px-4 py-2.5 text-white text-sm outline-none placeholder-[#3a3a3a] focus:border-[#0694FB] transition-colors"
                />
              </div>
              {/* Footer */}
              <div className="flex items-center gap-2 px-7 pb-6">
                <button
                  onClick={cancelArrowLabel}
                  className="flex-1 py-2.5 rounded-full bg-transparent hover:bg-[#1E1E1E] text-[#6B6B6B] text-[13px] font-medium border border-[#1E1E1E] cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitArrowLabel}
                  className="flex-1 py-2.5 rounded-full bg-[#0694FB] hover:bg-[#0578d1] text-white text-[13px] font-medium border-none cursor-pointer transition-colors"
                >
                  Add Label
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Midsection;
