import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CornerstoneViewport from "./CornerstoneViewport";
import CornerstoneVolumeViewport, { SLAB_MODES, slabLabel, FUSION_COLORMAPS } from "./CornerstoneVolumeViewport";
import { loadSeries } from "../../../lib/seriesCache";
import CornerstoneVolume3D, { presetsFor } from "./CornerstoneVolume3D";
import SliceScrubber from "./SliceScrubber";
import DicomTagPanel from "./DicomTagPanel";
import RecistPanel from "./RecistPanel";
import SeriesPane, { EmptyPane } from "./SeriesPane";
import { translationPairsFor } from "./rightsection/TranslationPanel";
import { getLabelsAlwaysOn, setLabelsAlwaysOn } from "../../../lib/cornerstoneSetup";
import { LAYOUTS, SERIES_DRAG_TYPE, normalizeLayout, resizeLayout, placeSeries, clearPane, activatePane } from "../../../lib/viewerLayout";
import { readSlicePositions, matchSlice, canLink } from "../../../lib/slicePositions";
import { buildImageIds, getDicomMetadata, isDicomImage } from "../../../lib/dicomUtils";
import { CT_WINDOW_PRESETS } from "../../../lib/windowPresets";
import { serializeAnnotations, restoreAnnotations, restoreKeyImages, restoreRecistReference, restoreMprRegions, SAVED_TOOL_NAMES } from "../../../lib/annotationPersistence";
import { suggestLesionName } from "../../../lib/recist";
import { formatPixelValue } from "../../../lib/viewportReadouts";
import { renameRoi, deleteRoi, AREA_ROI_TOOL_NAMES } from "../../../lib/roiVolume";
import { getSeriesAnnotations, saveSeriesAnnotations } from "../../../lib/api";
import { eventTarget as csEventTarget } from "@cornerstonejs/core";
import { annotation as csAnnotation, Enums as csToolsEnums, CrosshairsTool, BidirectionalTool } from "@cornerstonejs/tools";
import {
  FiZoomIn, FiZoomOut, FiMaximize2, FiRotateCw, FiRotateCcw,
  FiChevronLeft, FiChevronRight,
  FiTrash2, FiDelete,
  FiPlay, FiPause, FiSkipBack, FiSkipForward,
  FiX, FiInfo, FiMove, FiCrosshair, FiMousePointer, FiChevronDown, FiHelpCircle, FiList, FiEdit2,
  FiLoader, FiCheck,
} from "react-icons/fi";
import { BsDiamondFill } from "react-icons/bs";
import { MdFlip, MdInvertColors } from "react-icons/md";
import { RiContrastFill } from "react-icons/ri";
import { LiaCircleSolid } from "react-icons/lia";
import { TfiText } from "react-icons/tfi";
import { GoArrowUpRight } from "react-icons/go";
import { IoSquareOutline } from "react-icons/io5";
import { PiPolygonLight, PiSparkleFill } from "react-icons/pi";
import { RiSketching } from "react-icons/ri";
import { TbRulerMeasure, TbAngle, TbCirclePlus, TbView360, TbArrowsCross, TbLetterT, TbPencil, TbZoomIn, TbStar, TbStarFilled, TbTags, TbVectorBezier, TbTargetArrow, TbLayoutGrid, TbLink, TbLinkOff, TbTextCaption, TbBrush } from "react-icons/tb";
import { CiEraser } from "react-icons/ci";
import { Sparkle } from "lucide-react";
import { formatSize, SIZE_AXES_LABEL } from "../../../lib/regionSize";

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

// Caveats the model reported about its input (e.g. a brain MR that isn't skull-stripped)
function ResultWarnings({ warnings }) {
  if (!warnings?.length) return null;
  return (
    <div className="border-t border-[#1E1E1E] px-3 py-2 flex flex-col gap-1.5">
      {warnings.map(text => (
        <p key={text} className="m-0 text-[11px] leading-snug text-[#F59E0B]">{text}</p>
      ))}
    </div>
  );
}

// Colour key for anatomy segmentations (one colour per structure): only the structures the
// model found, largest first, with their volumes. Whole-body results can list 100+, so it
// scrolls and can be filtered.
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

// Results from before the worker named structures fall back to the raw name, and
// without "structures" there are no sizes.
function SegmentationLegend({ legend, volumes, structures }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const entryByName = new Map((legend ?? []).map(entry => [entry.name, entry]));
    const sizeByName = new Map((structures ?? []).map(s => [s.name, s]));
    return Object.entries(volumes ?? {})
      .filter(([name]) => entryByName.has(name))
      .map(([name, volume]) => {
        const entry = entryByName.get(name);
        const measured = sizeByName.get(name);
        return {
          name,
          label: capitalize(entry.clinical_name ?? measured?.clinical_name ?? name.replace(/_/g, " ")),
          volume,
          rgb: entry.rgb,
          size: measured?.size_mm ? formatSize(measured.size_mm) : null,
        };
      })
      .sort((a, b) => b.volume - a.volume);
  }, [legend, volumes, structures]);
  if (!rows.length) return null;
  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter(r => r.label.toLowerCase().includes(q) || r.name.toLowerCase().replace(/_/g, " ").includes(q)) : rows;
  return (
    <div className="border-t border-[#1E1E1E] px-3 py-2 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#868686]">{`${rows.length} structure${rows.length === 1 ? "" : "s"}`}</span>
        {rows.length > 8 && (
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter"
            className="w-[100px] bg-[#111] border border-[#1E1E1E] focus:border-[#0694FB] rounded-md px-1.5 py-0.5 text-white text-[11px] outline-none placeholder-[#4a4a4a]"
          />
        )}
      </div>
      <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#1B1B1B #000" }}>
        {shown.map(r => (
          <div key={r.name} className="flex items-center gap-2 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: `rgb(${r.rgb.join(",")})` }} />
            <span className="flex-1 min-w-0 truncate text-[#CCCCCC]" title={r.size ? `${r.label} — ${r.volume} cm³, ${r.size} (${SIZE_AXES_LABEL})` : r.label}>{r.label}</span>
            <span className="text-[#6B6B6B] font-mono shrink-0" title={r.size ? `Maximum extent ${SIZE_AXES_LABEL}` : undefined}>
              {r.size ? `${r.volume} cm³ · ${r.size}` : `${r.volume} cm³`}
            </span>
          </div>
        ))}
        {!shown.length && <span className="text-[11px] text-[#6B6B6B]">No match</span>}
      </div>
    </div>
  );
}

// Tiny picture of a viewer grid, for the layout menu
function LayoutGlyph({ cols, rows }) {
  return (
    <span className="grid gap-[2px] w-4 h-4 shrink-0" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
      {Array.from({ length: cols * rows }, (_, i) => <span key={i} className="rounded-[2px] border border-current" />)}
    </span>
  );
}

// ── DICOM corner overlays ──────────────────────────────────────────────────────
function MetaLine({ label, value, bright }) {
  if (!value && value !== 0) return null;
  return (
    <p className={`m-0 leading-tight ${bright ? "text-white/70 text-[11px]" : "text-white/35 text-[11px]"}`}>
      {label ? <span className="text-white/20">{label} </span> : null}{value}
    </p>
  );
}

// Pixel value under the cursor (HU on CT) and its column/row. Its own component, fed
// through a ref rather than Midsection state, so moving the mouse re-renders one line
// instead of the whole viewer.
function PixelValueLine({ feed }) {
  const [probe, setProbe] = useState(null);
  useEffect(() => {
    feed.current = setProbe;
    return () => { feed.current = null; };
  }, [feed]);
  if (!probe) return null;
  return <MetaLine label={probe.unit ? null : "Val"} value={`${formatPixelValue(probe)}  (${probe.i}, ${probe.j})`} bright />;
}

// viewMode: in the 3-plane view the patient block starts lower, clear of the axial pane's
// own labels (plane, slab, fusion); a 3D rendering has no slice, zoom or window to show.
function DicomOverlay({ meta, currentIndex, total, wl, zoomPct, rotation, inverted, pixelFeed, isKeyImage, viewMode = "stack" }) {
  const wc = wl?.wc != null ? Math.round(wl.wc) : (meta?.windowCenter != null ? Math.round(meta.windowCenter) : null);
  const ww = wl?.ww != null ? Math.round(wl.ww) : (meta?.windowWidth != null ? Math.round(meta.windowWidth) : null);

  return (
    <>
      {/* ── Top-left: Patient ── */}
      <div className={`absolute ${viewMode === "mpr" ? "top-14" : "top-3"} left-3 z-20 flex flex-col gap-0.5 pointer-events-none select-none`}>
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

      {viewMode !== "3d" && <>
      {/* ── Bottom-left: Image geometry + view state ── */}
      <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-0.5 pointer-events-none select-none">
        {pixelFeed && <PixelValueLine feed={pixelFeed} />}
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
        {isKeyImage && <span className="text-[11px] leading-tight text-[#FACC15]">★ Key image</span>}
        {wc != null && <MetaLine label="WC" value={wc} bright />}
        {ww != null && <MetaLine label="WW" value={ww} />}
        <MetaLine
          value={total > 0 ? `${currentIndex + 1} / ${total}` : "— / —"}
        />
      </div>
      </>}
    </>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
// The Enhance button's collapsed width (it widens on hover)
const ENHANCE_BTN_REST_PX = 28;

function Midsection({ selectedImage, onSelectImage, images = [], activeStudy, activeSeries, onRunEnhancement, enhancementLoading, enhancementProgress, enhancementResult, onRunAnalysis, aiLoading, inferenceProgress, inferenceResult, onInferenceResult, onRunTranslation, translationActive, translationLoading, translationProgress, translationResult, translationMode, onCloseTranslation, jobStatus, onViewModeChange, layout, onLayoutChange, seriesList = [], onSelectSeries }) {
  const [activeTool, setActiveTool] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);

  // View mode: "stack" (2D) or "mpr" (3-pane axial/sagittal/coronal, crosshair-linked)
  const [viewMode, setViewMode] = useState("stack");
  const [activePlane, setActivePlane] = useState("axial");

  const switchViewMode = (mode) => {
    if (mode !== "mpr") setActiveTool(t => (t === "brush" ? null : t));
    setViewMode(mode);
    onViewModeChange?.(mode);
  };

  // Translation splits the screen into a side-by-side 2D comparison, so drop out of MPR first
  useEffect(() => {
    if (translationActive && viewMode !== "stack") switchViewMode("stack");
  }, [translationActive]); // eslint-disable-line react-hooks/exhaustive-deps
  const [mprMenuOpen, setMprMenuOpen] = useState(false);
  // Thick-slab MIP / MinIP / average in the 3D view (mode "off" = single plane)
  const [slab, setSlab] = useState({ mode: "off", mm: 10 });
  const [slabMenuOpen, setSlabMenuOpen] = useState(false);
  const slabMenuRef = useRef(null);
  // Fusion in the 3-plane view: a PET / NM series of this study drawn over the open one.
  // { seriesId, label, colormap, opacity, imageIds (once loaded) }
  const [fusion, setFusion] = useState(null);
  const [fusionMenuOpen, setFusionMenuOpen] = useState(false);
  const fusionMenuRef = useRef(null);
  const fusionCandidates = seriesList.filter(s =>
    String(s.id) !== String(activeSeries?.id) && ["PT", "NM"].includes((s.modality || "").toUpperCase()));
  useEffect(() => { setFusion(null); }, [activeSeries?.id]);
  const fuseWith = async (series) => {
    const label = `${(series.modality || "").toUpperCase()} ${series.description || series.name || ""}`.trim();
    setFusion(prev => ({ colormap: FUSION_COLORMAPS[0][0], opacity: 0.6, ...prev, seriesId: series.id, label, imageIds: null }));
    try {
      const { images } = await loadSeries(series.id);
      const ids = await buildImageIds(images);
      setFusion(prev => (prev?.seriesId === series.id ? { ...prev, imageIds: ids, key: `${series.id}:${ids.length}` } : prev));
    } catch (err) {
      console.warn("[Fusion] couldn't load the series:", err);
      setFusion(prev => (prev?.seriesId === series.id ? null : prev));
    }
  };

  // 3D rendering preset (viewMode "3d")
  const render3dRef = useRef(null);
  const [renderPreset, setRenderPreset] = useState(null);
  // A CT preset means nothing on an MR — each series starts on its modality's first one
  useEffect(() => { setRenderPreset(null); }, [activeSeries?.id]);
  const [enhancementActive, setEnhancementActive] = useState(false);
  const [enhancementDone, setEnhancementDone] = useState(false);
  const [enhancementHovered, setEnhancementHovered] = useState(false);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  // Toolbar tiers, stepped down only while it doesn't fit: 0 everything inline · 1 view
  // tools in the ··· menu · 2 buttons shrink to icons / short labels · 3 wraps onto a
  // second row rather than cutting anything off
  const [toolbarTier, setToolbarTier] = useState(0);
  const [toolbarWidth, setToolbarWidth] = useState(0);
  const toolbarLeftRef = useRef(null);
  const toolbarRightRef = useRef(null);
  const enhanceBtnRef = useRef(null);
  const toolbarNarrow = toolbarTier >= 1;
  const toolbarCompact = toolbarTier >= 2;
  const overflowMenuRef = useRef(null);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const presetMenuRef = useRef(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const toolbarRef = useRef(null);
  const mprMenuRef = useRef(null);
  const volumeVpRef = useRef(null);
  const infoRef = useRef(null);

  // Mirror state for display only — Cornerstone owns the actual values
  const [zoomPct, setZoomPct] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [inverted, setInverted] = useState(false);
  // Left-button tool when no annotation tool is chosen (Horos default: window/level)
  const [leftTool, setLeftTool] = useState("wl");

  // Cine playback
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(3);
  const playRef = useRef(null);

  useEffect(() => {
    if (!playing || frameCount <= 1) {
      clearInterval(playRef.current);
      playRef.current = null;
      return;
    }
    syncDriverRef.current = "active"; // linked viewers follow the cine
    playRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        const next = prev + 1 >= frameCountRef.current ? 0 : prev + 1;
        const src = fileSrcOfFrameRef.current(next);
        if (src) onSelectImage?.(src);
        vpRef.current?.setImageIndex(next);
        return next;
      });
    }, 1000 / fps);
    return () => clearInterval(playRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, fps, images, onSelectImage]);

  // Stop cine when images change
  useEffect(() => { setPlaying(false); }, [images]);

  // Close info dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (infoRef.current && !infoRef.current.contains(e.target)) setInfoOpen(false);
      if (mprMenuRef.current && !mprMenuRef.current.contains(e.target)) setMprMenuOpen(false);
      if (slabMenuRef.current && !slabMenuRef.current.contains(e.target)) setSlabMenuOpen(false);
      if (fusionMenuRef.current && !fusionMenuRef.current.contains(e.target)) setFusionMenuOpen(false);
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target)) setLayoutMenuOpen(false);
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target)) setOverflowMenuOpen(false);
      if (presetMenuRef.current && !presetMenuRef.current.contains(e.target)) setPresetMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Toolbar width → start again from the full toolbar; the layout effect below steps down
  useEffect(() => {
    if (!toolbarRef.current) return;
    const ro = new ResizeObserver(([entry]) => setToolbarWidth(Math.round(entry.contentRect.width)));
    ro.observe(toolbarRef.current);
    return () => ro.disconnect();
  }, []);

  // DICOM metadata extracted from the first DICOM file in the series
  const [dicomMeta, setDicomMeta] = useState(null);
  // Live W/L values read from the viewport
  const [wl, setWl] = useState(null);

  const viewportWrapRef = useRef(null);

  const vpRef = useRef(null); // CornerstoneViewport imperative handle
  const vpRef2 = useRef(null); // Right panel (translation result)

  // ── Multi-viewer layout (lib/viewerLayout) — kept above the workspace, so it survives
  // switching the open series. Linked viewers scroll together by patient position: only
  // the viewer being scrolled (the "driver") moves the others, so they never feed back.
  const lay = useMemo(() => normalizeLayout(layout, activeSeries, seriesList), [layout, activeSeries, seriesList]);
  const multi = lay.panes.length > 1 && !translationActive; // translation has its own split view
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const layoutMenuRef = useRef(null);
  const [dropSlot, setDropSlot] = useState(null); // pane a series card is dragged over
  const paneHandlesRef = useRef({});  // slot -> SeriesPane handle
  const geometryRef = useRef({});     // "active" | slot -> slice positions (lib/slicePositions)
  const [, setGeometryVersion] = useState(0); // re-render when positions arrive (link badges)
  const syncDriverRef = useRef("active");
  const currentIndexRef = useRef(0);
  const frameCountRef = useRef(0);       // for the cine interval
  const fileSrcOfFrameRef = useRef(() => null);

  // Mask overlay opacity (0–1) — controlled by the user slider
  const [maskOpacity, setMaskOpacity] = useState(0.5);
  // Named ROIs in the 2D viewer, Horos-style (see lib/roiVolume) and the ROI list panel
  const [rois, setRois] = useState([]);
  const [roiPanelOpen, setRoiPanelOpen] = useState(false);
  const [roiVolumesShown, setRoiVolumesShown] = useState(() => new Set()); // ROI names whose volume was computed
  const [editingRoi, setEditingRoi] = useState(null); // { name, value } while renaming
  // Key images (Horos's "key image" flag), saved with the series' measurements
  const [keyImages, setKeyImages] = useState(() => new Set()); // imageIds
  const keyImagesRef = useRef(keyImages);
  keyImagesRef.current = keyImages;
  const [tagPanelOpen, setTagPanelOpen] = useState(false); // DICOM tag browser
  const [labelsAlwaysOn, setLabelsAlwaysOnState] = useState(getLabelsAlwaysOn); // measurement text on every annotation, not just hovered/selected
  const toggleLabels = () => { setLabelsAlwaysOn(!labelsAlwaysOn); setLabelsAlwaysOnState(!labelsAlwaysOn); };
  // RECIST panel, and the earlier studies' sums typed into it ({ baseline, nadir, newLesion }), saved with the series
  const [recistPanelOpen, setRecistPanelOpen] = useState(false);
  const [recistReference, setRecistReference] = useState(null);
  const recistReferenceRef = useRef(recistReference);
  recistReferenceRef.current = recistReference;
  // Regions drawn in the 3D view ({ uid, outline, tolerance, number }), saved with the series.
  // Held here, since the 3D view unmounts in 2D mode; it grows them again when it opens.
  const [mprRegions, setMprRegions] = useState([]);
  const mprRegionsRef = useRef(mprRegions);
  mprRegionsRef.current = mprRegions;
  const pixelFeedRef = useRef(null); // PixelValueLine's setter (see above)

  // Overlay card position — null means default (top-right corner)
  const [overlayPos, setOverlayPos] = useState(null);
  const overlayDragOffset = useRef({ x: 0, y: 0 });
  const handleOverlayDragStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = viewportWrapRef.current.getBoundingClientRect();
    const card = e.currentTarget.parentElement;
    const cardRect = card.getBoundingClientRect();
    overlayDragOffset.current = {
      x: e.clientX - (cardRect.left - rect.left),
      y: e.clientY - (cardRect.top - rect.top),
    };
    const onMove = (mv) => {
      const r = viewportWrapRef.current.getBoundingClientRect();
      setOverlayPos({
        x: Math.max(0, mv.clientX - r.left - overlayDragOffset.current.x),
        y: Math.max(0, mv.clientY - r.top - overlayDragOffset.current.y),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);


  // Camera transform synced from Cornerstone — keeps mask aligned with the DICOM image
  const [maskTransform, setMaskTransform] = useState({ zoom: 1, panX: 0, panY: 0, rotation: 0, flipH: false, flipV: false });
  const handleCameraChanged = useCallback((t) => {
    setMaskTransform(prev => (
      prev.zoom === t.zoom &&
      prev.panX === t.panX &&
      prev.panY === t.panY &&
      prev.rotation === t.rotation &&
      prev.flipH === t.flipH &&
      prev.flipV === t.flipV
        ? prev : t
    ));
  }, []);

  // Track whether any annotation is currently selected (drives toolbar button state)
  const [hasSelection, setHasSelection] = useState(false);

  // Arrow annotation custom dialog
  const [arrowDialog, setArrowDialog] = useState(null); // { resolve: (label) => void, initial } — initial is the text being edited, "" for a new label
  const [arrowLabel, setArrowLabel] = useState("");
  const arrowInputRef = useRef(null);

  const handleArrowTextRequest = useCallback((doneCallback, initial = "") => {
    setArrowLabel(initial);
    setArrowDialog({ resolve: doneCallback, initial });
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
      arrowDialog.resolve(arrowDialog.initial); // cancelling an edit keeps the old text
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
      // Crosshairs' own reference-line annotation shouldn't count as a user selection
      const real = selected.filter(uid => {
        try { return csAnnotation.state.getAnnotation(uid)?.metadata?.toolName !== CrosshairsTool.toolName; }
        catch (_) { return true; }
      });
      setHasSelection(real.length > 0);
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

  // Slice positions are frames (imageIds), but images, the side panel's selection and the
  // AI / enhancement / translation results have one entry per file. A multi-frame file
  // makes the two differ, so everything navigates by frame and maps to the file here.
  const frameMap = useMemo(() => {
    const fileBySrc = new Map(images.map((img, j) => [img.blobUrl ?? img.url, j]));
    const fileOfFrame = imageIds.map(id => fileBySrc.get(id.replace(/^(wadouri|web):/, "").replace(/[?&]frame=\d+$/, "")) ?? -1);
    const firstFrameOfFile = new Array(images.length).fill(-1);
    fileOfFrame.forEach((j, i) => { if (j >= 0 && firstFrameOfFile[j] < 0) firstFrameOfFile[j] = i; });
    return { fileOfFrame, firstFrameOfFile };
  }, [images, imageIds]);
  const frameCount = imageIds.length;
  const fileOfFrame = (i) => (frameMap.fileOfFrame[i] >= 0 ? frameMap.fileOfFrame[i] : i);
  const fileSrcOfFrame = (i) => { const img = images[fileOfFrame(i)]; return img ? img.blobUrl ?? img.url : null; };
  // A result list's entry for a frame: per-file lists are mapped, per-frame ones pass through
  const resultForFrame = (list, i) => list?.[list.length === frameCount ? i : fileOfFrame(i)];
  frameCountRef.current = frameCount;
  fileSrcOfFrameRef.current = fileSrcOfFrame;

  // ── Which slices carry measurements, for the scrubber's marks ──
  const [measuredSlices, setMeasuredSlices] = useState(null);
  useEffect(() => {
    const indexByImageId = new Map(imageIds.map((id, i) => [id, i]));
    const update = () => {
      const marks = new Array(imageIds.length).fill(false);
      let any = false;
      (csAnnotation.state.getAllAnnotations() ?? []).forEach(a => {
        if (!SAVED_TOOL_NAMES.has(a.metadata?.toolName)) return;
        const i = indexByImageId.get(a.metadata?.referencedImageId);
        if (i !== undefined) { marks[i] = true; any = true; }
      });
      setMeasuredSlices(any ? marks : null);
    };
    update();
    const events = [
      csToolsEnums.Events.ANNOTATION_ADDED,     // also fires when saved measurements are restored
      csToolsEnums.Events.ANNOTATION_COMPLETED,
      csToolsEnums.Events.ANNOTATION_REMOVED,
    ];
    events.forEach(name => csEventTarget.addEventListener(name, update));
    return () => events.forEach(name => csEventTarget.removeEventListener(name, update));
  }, [imageIds]);

  // ── Bidirectional measurements are RECIST lesions: name each one when it's drawn ──
  useEffect(() => {
    const nameLesion = (evt) => {
      const annotation = evt.detail?.annotation;
      if (annotation?.metadata?.toolName !== BidirectionalTool.toolName || annotation.data?.label) return;
      if (!imageIds.includes(annotation.metadata.referencedImageId)) return;
      annotation.data.label = suggestLesionName(imageIds);
      activeVpRef.current?.current?.render?.();
    };
    csEventTarget.addEventListener(csToolsEnums.Events.ANNOTATION_COMPLETED, nameLesion);
    return () => csEventTarget.removeEventListener(csToolsEnums.Events.ANNOTATION_COMPLETED, nameLesion);
  }, [imageIds]);

  // ── Saved measurements (lib/annotationPersistence) ──
  // Restore once per series, then save (debounced) whenever a measurement is drawn,
  // edited or deleted. Nothing is saved until the restore has succeeded, so a slow or
  // failed load can never overwrite the saved set with an empty one.
  const annotationsRestoredForRef = useRef(null); // series id whose saved set is loaded
  const changedWhileLoadingRef = useRef(false);    // an edit came in before it had loaded
  const scheduleSaveRef = useRef(null);
  const imageIdsRef = useRef(imageIds);
  imageIdsRef.current = imageIds;
  const imagesRef = useRef(images);
  imagesRef.current = images;

  useEffect(() => {
    const seriesId = activeSeries?.id;
    if (!seriesId || !imageIds.length || annotationsRestoredForRef.current === seriesId) return;
    let cancelled = false;
    setKeyImages(new Set());
    setRecistReference(null);
    setMprRegions([]);
    getSeriesAnnotations(seriesId)
      .then(({ annotations }) => {
        if (cancelled) return;
        if (restoreAnnotations(annotations, imageIds, images)) vpRef.current?.render?.();
        setKeyImages(new Set(restoreKeyImages(annotations, imageIds, images)));
        setRecistReference(restoreRecistReference(annotations));
        // Keep any region drawn in the 3D view while this was loading
        const savedRegions = restoreMprRegions(annotations);
        setMprRegions(prev => [...savedRegions, ...prev.filter(r => !savedRegions.some(s => s.uid === r.uid))]);
        annotationsRestoredForRef.current = seriesId;
        // Save what was drawn while this loaded (merged with the saved set) now, not at the next edit
        if (changedWhileLoadingRef.current) {
          changedWhileLoadingRef.current = false;
          scheduleSaveRef.current?.();
        }
      })
      .catch(err => console.warn("[Annotations] couldn't load saved measurements:", err));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSeries?.id, imageIds]);

  useEffect(() => {
    const seriesId = activeSeries?.id;
    if (!seriesId) return;
    let timer = null;
    changedWhileLoadingRef.current = false;
    const save = (options) => {
      timer = null;
      saveSeriesAnnotations(seriesId, serializeAnnotations(imageIdsRef.current, imagesRef.current, {
        keyImageIds: keyImagesRef.current,
        recistReference: recistReferenceRef.current,
        mprRegions: mprRegionsRef.current,
      }), options)
        .catch(err => console.warn("[Annotations] couldn't save measurements:", err));
    };
    const schedule = (evt) => {
      if (evt?.detail?.changeType === csToolsEnums.ChangeTypes.StatsUpdated) return; // recalculated stats, not an edit
      if (annotationsRestoredForRef.current !== seriesId) { changedWhileLoadingRef.current = true; return; }
      clearTimeout(timer);
      timer = setTimeout(save, 1000);
    };
    // Tab closed, reloaded or hidden: send a pending save now (keepalive outlives the page)
    const flush = () => { if (timer) { clearTimeout(timer); save({ keepalive: true }); } };
    const flushOnHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", flushOnHide);
    window.addEventListener("pagehide", flush);
    scheduleSaveRef.current = schedule; // key-image changes save the same way
    const events = [
      csToolsEnums.Events.ANNOTATION_COMPLETED,
      csToolsEnums.Events.ANNOTATION_MODIFIED,
      csToolsEnums.Events.ANNOTATION_REMOVED,
    ];
    events.forEach(name => csEventTarget.addEventListener(name, schedule));
    return () => {
      scheduleSaveRef.current = null;
      document.removeEventListener("visibilitychange", flushOnHide);
      window.removeEventListener("pagehide", flush);
      events.forEach(name => csEventTarget.removeEventListener(name, schedule));
      if (timer) { clearTimeout(timer); save(); } // flush on series switch / unmount
    };
  }, [activeSeries?.id]);

  // Per-slice segmentation masks, in the same order as imageIds — fed to the MPR
  // viewport as a 3D labelmap so the mask reslices correctly on all 3 planes.
  // GradCAM heatmaps are per-class saliency, not a coherent 3D object, so they're excluded
  // (they stay on the flat 2D overlay in stack mode — see the overlay below).
  const segmentationMaskSlices = useMemo(() => {
    if (!inferenceResult?.slices?.length) return null;
    const isGradCam = inferenceResult.slices.some(s => s.predicted_class != null);
    if (isGradCam) return null;
    return Array.from({ length: frameCount }, (_, i) => resultForFrame(inferenceResult.slices, i)?.mask || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inferenceResult, frameMap]);

  // Per-slice confidence (only where the model found something) and the colour legend,
  // so clicking a finding in MPR can report the same confidence + label as the 2D card.
  const segmentationConfidences = useMemo(() => {
    if (!segmentationMaskSlices) return null;
    return Array.from({ length: frameCount }, (_, i) => {
      const s = resultForFrame(inferenceResult.slices, i);
      return s?.detected && s.confidence != null ? s.confidence : null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inferenceResult, segmentationMaskSlices]);
  const segmentationLegend = inferenceResult?.label_legend ?? null;
  // Anatomy bundles (structure volumes, no lesion stats) show each structure in its own legend colour
  const segmentationIsAnatomy = inferenceResult?.class_volumes_cm3 != null;

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
    const file = images.findIndex(img => (img.blobUrl ?? img.url) === selectedImage);
    if (file < 0) return;
    const onFrame = vpRef.current?.getCurrentIndex?.() ?? currentIndexRef.current;
    if (fileOfFrame(onFrame) === file) { setCurrentIndex(onFrame); return; }
    const frame = frameMap.firstFrameOfFile[file] >= 0 ? frameMap.firstFrameOfFile[file] : file;
    vpRef.current?.setImageIndex(frame);
    setCurrentIndex(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImage, images, frameMap]);

  // Slice navigation
  const goTo = useCallback((idx) => {
    if (idx >= 0 && idx < frameCount) {
      syncDriverRef.current = "active"; // keys, scrubber and panels drive the active viewer
      const src = fileSrcOfFrame(idx);
      if (src) onSelectImage?.(src);
      vpRef.current?.setImageIndex(idx);
      setCurrentIndex(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, frameMap, frameCount, onSelectImage]);

  // Stable imageIds for the translation viewport — only recomputed when translationResult changes
  const translationImageIds = useMemo(() => {
    const slices = translationResult?.slices ?? [];
    return slices.map(s => {
      const url = s.image_url ?? s.url;
      if (url) return `web:${url}`;
      if (s.image) return `web:data:image/jpeg;base64,${s.image}`;
      return null;
    }).filter(Boolean);
  }, [translationResult]);

  // Keep translation viewport in sync with the main slice index
  useEffect(() => {
    if (translationResult && vpRef2.current?.setImageIndex) {
      vpRef2.current.setImageIndex((translationResult.slices?.length ?? 0) === frameCount ? currentIndex : fileOfFrame(currentIndex));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, translationResult]);


  const toggleTool = (name) => setActiveTool(t => t === name ? null : name);

  // ── Key images (2D view: they flag a slice) ──
  const isKeyImage = keyImages.has(imageIds[currentIndex]);
  const toggleKeyImage = () => {
    const id = imageIds[currentIndex];
    if (!id || viewMode !== "stack") return;
    setKeyImages(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    scheduleSaveRef.current?.();
  };
  const goToNextKeyImage = () => {
    const keyed = imageIds.map((id, i) => (keyImages.has(id) ? i : -1)).filter(i => i >= 0);
    if (keyed.length) goTo(keyed.find(i => i > currentIndex) ?? keyed[0]);
  };

  // ── ROI list actions ──
  const commitRoiRename = () => {
    if (!editingRoi) return;
    const newName = editingRoi.value.trim();
    if (newName && newName !== editingRoi.name) {
      renameRoi(imageIds, AREA_ROI_TOOL_NAMES, editingRoi.name, newName); // same name as another ROI merges them
      setRoiVolumesShown(prev => {
        if (!prev.has(editingRoi.name)) return prev;
        const next = new Set(prev);
        next.delete(editingRoi.name);
        next.add(newName);
        return next;
      });
      activeVp.current?.render?.();
    }
    setEditingRoi(null);
  };
  const removeRoi = (name) => {
    deleteRoi(imageIds, AREA_ROI_TOOL_NAMES, name);
    activeVp.current?.render?.();
  };

  // ── Window presets (CT only — MR has no standard windows) ──
  const isCT = (dicomMeta?.modality || activeSeries?.modality || "").toUpperCase() === "CT";
  const applyWindowPreset = (preset) => { activeVp.current?.setWindow(preset.center, preset.width); setPresetMenuOpen(false); };
  const resetWindow = () => { activeVp.current?.resetWindow(); setPresetMenuOpen(false); };
  const resetViewAll = () => {
    activeVp.current?.resetFit(); setZoomPct(100); setRotation(0); setFlipH(false); setFlipV(false);
    setInverted(false); setLeftTool("wl"); setActiveTool(null);
  };

  // ── Keyboard shortcuts, Horos/OsiriX-style (press ? for the list) ──
  const SHORTCUT_TOOLS = { l: "ruler", a: "angle", o: "circle", b: "square", d: "polygon", t: "arrow", x: "marker", e: "bidirectional", n: "cobb", z: "magnify" };
  useEffect(() => {
    const h = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return; // leave browser/OS shortcuts alone
      syncDriverRef.current = "active"; // shortcuts act on the active viewer

      // Delete / Backspace — remove the selected annotation
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (activeVp.current?.deleteSelectedAnnotations()) setHasSelection(false);
        return;
      }

      const last = frameCount - 1;
      switch (e.key) {
        case "ArrowUp": case "ArrowLeft": goTo(currentIndex - 1); return;
        case "ArrowDown": case "ArrowRight": goTo(currentIndex + 1); return;
        case "PageUp": e.preventDefault(); goTo(Math.max(0, currentIndex - 10)); return;
        case "PageDown": e.preventDefault(); goTo(Math.min(last, currentIndex + 10)); return;
        case "Home": e.preventDefault(); goTo(0); return;
        case "End": e.preventDefault(); goTo(last); return;
        case " ": if (frameCount > 1) { e.preventDefault(); setPlaying(p => !p); } return;
        case "Escape": setActiveTool(null); setPresetMenuOpen(false); setShortcutsOpen(false); setLayoutMenuOpen(false); return;
        case "?": setShortcutsOpen(o => !o); return;
        default: break;
      }

      if (/^[0-9]$/.test(e.key)) {
        if (!isCT) return;
        if (e.key === "0") resetWindow();
        else {
          const preset = CT_WINDOW_PRESETS.find(p => p.key === e.key);
          if (preset) applyWindowPreset(preset);
        }
        return;
      }

      if (e.shiftKey && e.key.toLowerCase() === "k") { goToNextKeyImage(); return; }
      if (e.shiftKey && e.key.toLowerCase() === "i") { setTagPanelOpen(o => !o); return; }

      const key = e.key.toLowerCase();
      switch (key) {
        case "k": toggleKeyImage(); return;
        case "s": setLeftTool("pointer"); setActiveTool(null); return;
        case "w": setLeftTool("wl"); setActiveTool(null); return;
        case "p": case "m": setLeftTool("pan"); setActiveTool(null); return; // M = Horos's "Move"
        case "c": if (viewMode === "mpr") { setLeftTool("crosshairs"); setActiveTool(null); } return;
        case "i": activeVp.current?.toggleInvert(); setInverted(i => !i); return;
        case "r":
          if (e.shiftKey) { activeVp.current?.rotateCCW(); setRotation(r => (r + 270) % 360); }
          else { activeVp.current?.rotateCW(); setRotation(r => (r + 90) % 360); }
          return;
        case "h": activeVp.current?.flipH(); setFlipH(f => !f); return;
        case "v": activeVp.current?.flipV(); setFlipV(f => !f); return;
        case "f": resetViewAll(); return;
        default:
          if (SHORTCUT_TOOLS[key] === "magnify" && viewMode !== "stack") return; // the magnifier is 2D-only
          if (SHORTCUT_TOOLS[key]) toggleTool(SHORTCUT_TOOLS[key]);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, goTo, frameCount, isCT, viewMode, imageIds, keyImages]);

  const imageEnhancement = () => {
    if (enhancementLoading) return;
    if (enhancementActive) {
      setEnhancementActive(false);
      return;
    }
    setEnhancementHovered(false);
    onRunEnhancement?.();
  }

  // Watch for enhancement completing so we can show the done checkmark
  useEffect(() => {
    if (!enhancementLoading && enhancementResult) {
      setEnhancementDone(true);
      const t = setTimeout(() => {
        setEnhancementDone(false);
        setEnhancementActive(true);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [enhancementLoading, enhancementResult]);

  // Pick the active viewport ref based on current view mode
  const activeVp = viewMode === "stack" ? vpRef : viewMode === "3d" ? render3dRef : volumeVpRef;

  // What's in the toolbar changes how much room it needs: start again from the full one
  const toolbarContentKey = [viewMode, multi, slabLabel(slab), !!fusion, aiLoading, translationActive, isCT].join("|");
  useLayoutEffect(() => { setToolbarTier(0); }, [toolbarWidth, toolbarContentKey]);
  // After each render: still overflowing → one tier down (before paint, so no flicker).
  // Runs after every render on purpose — it only ever steps down, and stops at the last tier.
  // Not while a menu is open: the toolbar mustn't rearrange under the pointer.
  const toolbarMenuOpen = mprMenuOpen || slabMenuOpen || fusionMenuOpen || layoutMenuOpen || overflowMenuOpen || presetMenuOpen;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const bar = toolbarRef.current;
    const left = toolbarLeftRef.current;
    const right = toolbarRightRef.current;
    if (!bar || !left || !right || toolbarTier >= 3 || toolbarMenuOpen) return;
    const style = getComputedStyle(bar);
    const room = bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    // Width of the buttons themselves: the span of each group's own children. (scrollWidth
    // would also count an open dropdown hanging off a button.)
    const span = group => {
      const boxes = [...group.children].map(el => el.getBoundingClientRect()).filter(r => r.width > 0);
      return boxes.length ? Math.max(...boxes.map(r => r.right)) - Math.min(...boxes.map(r => r.left)) : 0;
    };
    // The Enhance button widens while hovered; measure it at rest so a hover doesn't shrink the toolbar
    const enhanceExtra = Math.max(0, (enhanceBtnRef.current?.offsetWidth ?? 0) - ENHANCE_BTN_REST_PX);
    const needed = span(left) - enhanceExtra + span(right) + parseFloat(style.columnGap || 0);
    if (needed > room + 1) setToolbarTier(t => Math.min(3, t + 1));
  });
  const activeVpRef = useRef(activeVp);
  activeVpRef.current = activeVp;

  // ── Multi-viewer layout actions and linked scrolling ──
  currentIndexRef.current = currentIndex;
  const applyLayout = ({ layout: next, open }) => {
    onLayoutChange?.(next);
    if (open) onSelectSeries?.(open);
  };
  const linkActive = lay.linked && multi && viewMode === "stack"; // the MPR volume isn't a slice stack

  // Keep the stored layout in step with the open series (e.g. after a series card was
  // clicked, which replaces the active pane's series), so the side panel's "In a viewer" is right
  useEffect(() => {
    if (!layout) return;
    const key = (l) => JSON.stringify([l.cols, l.rows, l.activeSlot, l.linked, l.panes.map(s => s?.id ?? null)]);
    if (key(layout) !== key(lay)) onLayoutChange?.(lay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lay]);

  // The active series' slice positions, read once the layout has other viewers
  useEffect(() => {
    if (!multi || !imageIds.length) return;
    let cancelled = false;
    const geometries = geometryRef.current;
    readSlicePositions(imageIds).then(geometry => {
      if (cancelled) return;
      geometries.active = geometry;
      setGeometryVersion(v => v + 1);
      Object.keys(paneHandlesRef.current).forEach(key => alignPaneRef.current(key));
    });
    return () => { cancelled = true; delete geometries.active; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multi, imageIds]);

  // A viewer's slice changed: if it's the one being scrolled, move the others to match
  const syncFrom = (source, index) => {
    if (!linkActive || syncDriverRef.current !== source) return;
    const from = geometryRef.current[source]?.slices[index];
    if (!from) return;
    Object.entries(geometryRef.current).forEach(([key, geometry]) => {
      if (key === source) return;
      const target = matchSlice(from, geometry);
      if (target == null) return;
      if (key === "active") vpRef.current?.setImageIndex(target);
      else paneHandlesRef.current[key]?.setImageIndex(target);
    });
  };
  // Window/level, invert, zoom and pan follow too. Window only between CT series (HU
  // mean the same in each; MR intensities don't), pan only within one frame of reference.
  const modalityOf = (key) => String(lay.panes[key === "active" ? lay.activeSlot : Number(key)]?.modality ?? "").toUpperCase();
  const displayFor = (display, source, key) => ({
    voiRange: modalityOf(source) === "CT" && modalityOf(key) === "CT" ? display.voiRange : null,
    invert: display.invert,
    zoom: display.zoom,
    pan: canLink(geometryRef.current[source], geometryRef.current[key]) ? display.pan : null,
  });
  const syncDisplayFrom = (source, display) => {
    if (!linkActive || syncDriverRef.current !== source) return;
    ["active", ...Object.keys(paneHandlesRef.current)].forEach(key => {
      if (key === source) return;
      const shown = displayFor(display, source, key);
      if (key === "active") {
        vpRef.current?.applyDisplay(shown);
        setInverted(shown.invert);
      } else paneHandlesRef.current[key]?.applyDisplay(shown);
    });
  };
  // Bring one pane to the active viewer's position and display (when it loads, or linking is turned on)
  function alignPane(key) {
    if (!linkActive) return;
    const from = geometryRef.current.active?.slices[currentIndexRef.current];
    const target = matchSlice(from, geometryRef.current[key]);
    if (target != null) paneHandlesRef.current[key]?.setImageIndex(target);
    const display = vpRef.current?.getDisplay();
    if (display) paneHandlesRef.current[key]?.applyDisplay(displayFor(display, "active", key));
  }
  const alignPaneRef = useRef(alignPane); // the latest one, for async callers
  alignPaneRef.current = alignPane;
  const onPaneGeometry = (key, geometry) => {
    if (geometry) geometryRef.current[key] = geometry;
    else delete geometryRef.current[key];
    setGeometryVersion(v => v + 1);
    if (geometry) alignPane(key);
  };
  const toggleLinked = () => {
    const next = { ...lay, linked: !lay.linked };
    onLayoutChange?.(next);
    if (next.linked) setTimeout(() => Object.keys(paneHandlesRef.current).forEach(key => alignPaneRef.current(key))); // after the re-render
  };

  // Mouse-over picks the driver; series cards can be dropped on any viewer
  const paneHandlers = (key, slot) => ({
    onMouseEnter: () => { syncDriverRef.current = key; },
    onDragOver: (e) => {
      if (!e.dataTransfer.types.includes(SERIES_DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (dropSlot !== slot) setDropSlot(slot);
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setDropSlot(s => (s === slot ? null : s));
    },
    onDrop: (e) => {
      setDropSlot(null);
      let series = null;
      try { series = JSON.parse(e.dataTransfer.getData(SERIES_DRAG_TYPE)); } catch (_) { }
      if (!series?.id) return;
      e.preventDefault();
      applyLayout(placeSeries(lay, slot, series));
    },
  });
  const slotPlacement = (slot) => (multi ? { gridColumn: (slot % lay.cols) + 1, gridRow: Math.floor(slot / lay.cols) + 1 } : undefined);
  const dropHighlight = (slot) => dropSlot === slot && (
    <div className="absolute inset-0 z-[60] rounded-xl border-2 border-dashed border-[#0694FB] bg-[#0694FB]/10 pointer-events-none" />
  );
  const unshownSeries = seriesList.filter(s => !lay.panes.some(p => p && String(p.id) === String(s.id)));

  const drawTools = [
    { name: "circle", icon: <LiaCircleSolid size={20} />, label: "Draw Circle (Elliptical ROI) (O)" },
    { name: "square", icon: <IoSquareOutline size={20} />, label: "Draw Rectangle ROI (B)" },
    { name: "arrow", icon: <GoArrowUpRight size={19} />, label: "Arrow annotation (T)" },
    { name: "polygon", icon: <PiPolygonLight size={19} />, label: "Polygon ROI (D)" },
    { name: "pencil", icon: <TbPencil size={19} />, label: "Pencil — freehand line" },
    { name: "text", icon: <TbLetterT size={19} />, label: "Text label" },
    // Painting needs the volume (and its segmentation layer) — 3-plane view only for now
    ...(viewMode === "mpr" ? [{ name: "brush", icon: <TbBrush size={19} />, label: "Brush — paint a region; Alt erases, [ ] size" }] : []),
  ];

  const measureTools = [
    { name: "ruler", icon: <TbRulerMeasure size={19} />, label: "Length measurement (L)" },
    { name: "angle", icon: <TbAngle size={19} />, label: "Angle measurement (A)" },
    { name: "bidirectional", icon: <TbArrowsCross size={19} />, label: "Bidirectional — long and short axis, RECIST (E)" },
    { name: "cobb", icon: <TbVectorBezier size={19} />, label: "Cobb angle — two lines (N)" },
    { name: "marker", icon: <TbCirclePlus size={19} />, label: "Probe marker (X)" },
  ];

  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0 h-full overflow-hidden">

      {/* ── Top toolbar ── */}
      <div ref={toolbarRef} onMouseEnter={() => { syncDriverRef.current = "active"; }} className={`relative z-40 bg-[#161616] rounded-xl px-3 py-2 flex justify-between gap-2 shrink-0 ${toolbarTier >= 3 ? "flex-wrap gap-y-1.5" : ""}`}>
        {/* Nothing in here shrinks or wraps its text: short of room it overflows, which is
          what tells the toolbar to step down a tier. The dropdowns (absolutely positioned)
          go back to normal wrapping — their items are inline buttons that must stack. */}
        <div ref={toolbarLeftRef} className={`flex items-center gap-0 whitespace-nowrap [&>*]:shrink-0 [&_.absolute]:whitespace-normal ${toolbarTier >= 3 ? "flex-wrap gap-y-1" : "min-w-0"}`}>
          {/* ── Always visible: slice nav ── */}
          <ViewBtn icon={<FiChevronLeft size={16} />} label="Prev slice" disabled={currentIndex <= 0} onClick={() => goTo(currentIndex - 1)} />
          <span className="text-[#6B6B6B] text-[13px] font-mono w-[60px] text-center shrink-0">
            {frameCount > 0 ? `${currentIndex + 1} / ${frameCount}` : "— / —"}
          </span>
          <ViewBtn icon={<FiChevronRight size={16} />} label="Next slice" disabled={currentIndex >= frameCount - 1} onClick={() => goTo(currentIndex + 1)} />

          <VDivider />

          {/* ── Always visible: zoom in/out ── */}
          <ViewBtn icon={<FiZoomOut size={16} />} label="Zoom out" onClick={() => { activeVp.current?.zoomOut(); setZoomPct(p => Math.max(10, p - 25)); }} />
          {!toolbarNarrow && <span className="text-[#6B6B6B] text-[10px] font-mono w-[36px] text-center shrink-0">{zoomPct}%</span>}
          <ViewBtn icon={<FiZoomIn size={16} />} label="Zoom in" onClick={() => { activeVp.current?.zoomIn(); setZoomPct(p => Math.min(500, p + 25)); }} />

          <VDivider />

          {/* ── Secondary tools: hidden when toolbar is narrow ── */}
          {!toolbarNarrow && (
            <div className="flex items-center [&>*]:shrink-0">
              <ViewBtn icon={<FiMaximize2 size={12} />} label="Fit to window" onClick={() => { activeVp.current?.resetFit(); setZoomPct(100); setRotation(0); setFlipH(false); setFlipV(false); setInverted(false); setLeftTool("wl"); setActiveTool(null); }} />
              <ViewBtn icon={<FiRotateCcw size={16} />} label="Rotate CCW" onClick={() => { activeVp.current?.rotateCCW(); setRotation(r => ((r - 90) + 360) % 360); }} />
              <ViewBtn icon={<FiRotateCw size={16} />} label="Rotate CW" onClick={() => { activeVp.current?.rotateCW(); setRotation(r => (r + 90) % 360); }} />
              <ViewBtn icon={<MdFlip size={16} />} label="Flip horizontal" active={flipH} onClick={() => { activeVp.current?.flipH(); setFlipH(f => !f); }} />
              <ViewBtn icon={<MdFlip size={16} style={{ transform: "rotate(90deg)" }} />} label="Flip vertical" active={flipV} onClick={() => { activeVp.current?.flipV(); setFlipV(f => !f); }} />
              <VDivider />
              <ViewBtn icon={<FiMousePointer size={15} />} label="Pointer — left-click does nothing; drag crosshair lines or measurements (S)" active={!activeTool && leftTool === "pointer"} onClick={() => { setLeftTool("pointer"); setActiveTool(null); }} />
              <ViewBtn icon={<RiContrastFill size={16} />} label="Window / Level — left-drag (W)" active={!activeTool && leftTool === "wl"} onClick={() => { setLeftTool("wl"); setActiveTool(null); }} />
              <ViewBtn icon={<FiMove size={15} />} label="Pan — left-drag (P)" active={!activeTool && leftTool === "pan"} onClick={() => { setLeftTool("pan"); setActiveTool(null); }} />
              {viewMode === "mpr" && (
                <ViewBtn icon={<FiCrosshair size={15} />} label="Crosshairs — click to jump (C)" active={!activeTool && leftTool === "crosshairs"} onClick={() => { setLeftTool("crosshairs"); setActiveTool(null); }} />
              )}
              {isCT && (
                <div ref={presetMenuRef} className="relative">
                  <button
                    onClick={() => setPresetMenuOpen(o => !o)}
                    title="Window presets (1–9, 0 = original)"
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border-none cursor-pointer transition-all shrink-0 ${presetMenuOpen ? "bg-[#1a1a1a] text-white" : "bg-transparent text-[#6B6B6B] hover:bg-[#1a1a1a] hover:text-white"}`}
                  >
                    Presets <FiChevronDown size={11} />
                  </button>
                  {presetMenuOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-[#161616] border border-[#2a2a2a] rounded-xl z-50 shadow-xl overflow-hidden min-w-[200px] py-1">
                      {CT_WINDOW_PRESETS.map(p => (
                        <button
                          key={p.key}
                          onClick={() => applyWindowPreset(p)}
                          className="w-full flex items-center gap-3 px-3 py-1.5 text-left text-[12px] text-[#CCCCCC] hover:bg-[#1a1a1a] hover:text-white bg-transparent border-none cursor-pointer"
                        >
                          <span className="text-[#0694FB] font-mono w-3">{p.key}</span>
                          <span className="flex-1">{p.name}</span>
                          <span className="text-[#6B6B6B] font-mono text-[10px]">{`${p.width}/${p.center}`}</span>
                        </button>
                      ))}
                      <button
                        onClick={resetWindow}
                        className="w-full flex items-center gap-3 px-3 py-1.5 text-left text-[12px] text-[#CCCCCC] hover:bg-[#1a1a1a] hover:text-white bg-transparent border-none cursor-pointer border-t border-[#2a2a2a]"
                      >
                        <span className="text-[#0694FB] font-mono w-3">0</span>
                        <span className="flex-1">Original (from image)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
              <ViewBtn icon={<FiHelpCircle size={15} />} label="Keyboard shortcuts (?)" active={shortcutsOpen} onClick={() => setShortcutsOpen(o => !o)} />
              <ViewBtn icon={<MdInvertColors size={20} />} label="Invert" active={inverted} onClick={() => { activeVp.current?.toggleInvert(); setInverted(i => !i); }} />
              <VDivider />
              <button
                onClick={() => { activeVp.current?.resetFit(); setZoomPct(100); setRotation(0); setFlipH(false); setFlipV(false); setInverted(false); setLeftTool("wl"); setActiveTool(null); switchViewMode("stack"); }}
                className="text-[#6B6B6B] hover:text-white text-[12px] font-mono px-2 py-1 rounded-lg hover:bg-[#1a1a1a] bg-transparent border-none cursor-pointer transition-all shrink-0"
              >
                RESET
              </button>
              <VDivider />
            </div>
          )}

          {/* ── Overflow ⋯ button: visible when toolbar is narrow ── */}
          {toolbarNarrow && <div ref={overflowMenuRef} className="relative flex items-center">
            <button
              onClick={() => setOverflowMenuOpen(v => !v)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg border-none cursor-pointer transition-all duration-150 shrink-0 text-[16px] leading-none ${overflowMenuOpen ? 'bg-[#1a1a1a] text-white' : 'bg-transparent text-[#6B6B6B] hover:bg-[#1a1a1a] hover:text-white'}`}
            >
              ···
            </button>
            {overflowMenuOpen && (
              <div className="absolute top-full left-0 mt-1 bg-[#161616] border border-[#2a2a2a] rounded-xl z-50 shadow-xl overflow-hidden min-w-[220px]">
                {/* Fit / Rotate / Flip */}
                <div className="flex items-center gap-1 px-3 py-2 border-b border-[#2a2a2a]">
                  <ViewBtn icon={<FiMaximize2 size={12} />} label="Fit" onClick={() => { activeVp.current?.resetFit(); setZoomPct(100); setRotation(0); setFlipH(false); setFlipV(false); setInverted(false); setLeftTool("wl"); setActiveTool(null); setOverflowMenuOpen(false); }} />
                  <ViewBtn icon={<FiRotateCcw size={16} />} label="Rotate CCW" onClick={() => { activeVp.current?.rotateCCW(); setRotation(r => ((r - 90) + 360) % 360); }} />
                  <ViewBtn icon={<FiRotateCw size={16} />} label="Rotate CW" onClick={() => { activeVp.current?.rotateCW(); setRotation(r => (r + 90) % 360); }} />
                  <ViewBtn icon={<MdFlip size={16} />} label="Flip H" active={flipH} onClick={() => { activeVp.current?.flipH(); setFlipH(f => !f); }} />
                  <ViewBtn icon={<MdFlip size={16} style={{ transform: "rotate(90deg)" }} />} label="Flip V" active={flipV} onClick={() => { activeVp.current?.flipV(); setFlipV(f => !f); }} />
                </div>
                {/* W/L + Invert */}
                <div className="flex items-center gap-1 px-3 py-2 border-b border-[#2a2a2a]">
                  <ViewBtn icon={<FiMousePointer size={15} />} label="Pointer" active={!activeTool && leftTool === "pointer"} onClick={() => { setLeftTool("pointer"); setActiveTool(null); }} />
                  <ViewBtn icon={<RiContrastFill size={16} />} label="Window / Level" active={!activeTool && leftTool === "wl"} onClick={() => { setLeftTool("wl"); setActiveTool(null); }} />
                  <ViewBtn icon={<FiMove size={15} />} label="Pan" active={!activeTool && leftTool === "pan"} onClick={() => { setLeftTool("pan"); setActiveTool(null); }} />
                  {viewMode === "mpr" && (
                    <ViewBtn icon={<FiCrosshair size={15} />} label="Crosshairs (C)" active={!activeTool && leftTool === "crosshairs"} onClick={() => { setLeftTool("crosshairs"); setActiveTool(null); }} />
                  )}
                  <ViewBtn icon={<MdInvertColors size={20} />} label="Invert" active={inverted} onClick={() => { activeVp.current?.toggleInvert(); setInverted(i => !i); }} />
                  <ViewBtn icon={<FiHelpCircle size={15} />} label="Keyboard shortcuts (?)" active={shortcutsOpen} onClick={() => { setShortcutsOpen(o => !o); setOverflowMenuOpen(false); }} />
                </div>
                {/* CT window presets */}
                {isCT && (
                  <div className="px-3 py-2 border-b border-[#2a2a2a] flex flex-col gap-1">
                    <span className="text-[#555] text-[11px]">Window presets</span>
                    <div className="grid grid-cols-2 gap-1">
                      {CT_WINDOW_PRESETS.map(p => (
                        <button
                          key={p.key}
                          onClick={() => { applyWindowPreset(p); setOverflowMenuOpen(false); }}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-left text-[11px] text-[#CCCCCC] hover:bg-[#1a1a1a] hover:text-white bg-transparent border-none cursor-pointer"
                        >
                          <span className="text-[#0694FB] font-mono">{p.key}</span>
                          <span className="truncate">{p.name}</span>
                        </button>
                      ))}
                      <button
                        onClick={() => { resetWindow(); setOverflowMenuOpen(false); }}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-left text-[11px] text-[#CCCCCC] hover:bg-[#1a1a1a] hover:text-white bg-transparent border-none cursor-pointer"
                      >
                        <span className="text-[#0694FB] font-mono">0</span>
                        <span className="truncate">Original</span>
                      </button>
                    </div>
                  </div>
                )}
                {/* Reset */}
                <div className="px-3 py-2">
                  <button
                    onClick={() => { activeVp.current?.resetFit(); setZoomPct(100); setRotation(0); setFlipH(false); setFlipV(false); setInverted(false); setLeftTool("wl"); setActiveTool(null); switchViewMode("stack"); setOverflowMenuOpen(false); }}
                    className="w-full text-left text-[#6B6B6B] hover:text-white text-[12px] font-mono px-2 py-1 rounded-lg hover:bg-[#1a1a1a] bg-transparent border-none cursor-pointer transition-all"
                  >
                    RESET ALL
                  </button>
                </div>
              </div>
            )}
            <VDivider />
          </div>}

          {/* ── Always visible: MPR menu ── */}
          <div ref={mprMenuRef} className="relative">
            <button
              onClick={() => setMprMenuOpen(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium border-none cursor-pointer transition-all shrink-0 ${viewMode !== "stack"
                ? "bg-[#0694FB] text-white"
                : "bg-transparent text-[#6B6B6B] hover:bg-[#1a1a1a] hover:text-white"
                }`}
            >
              <TbView360 size={15} />
              {viewMode === "stack" ? "MPR" : viewMode === "3d" ? "3D" : toolbarCompact ? "MPR" : `MPR · ${activePlane.toUpperCase()}`}
            </button>
            {mprMenuOpen && (
              <div className="absolute top-full left-0 mt-1 bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden z-50 shadow-xl min-w-[150px]">
                <button
                  onClick={() => { switchViewMode("stack"); setMprMenuOpen(false); setActiveTool(null); setLeftTool("wl"); }}
                  className={`w-full text-left px-4 py-2.5 text-[12px] border-none cursor-pointer transition-colors ${viewMode === "stack" ? "bg-[#0694FB] text-white" : "bg-transparent text-[#999] hover:bg-[#1a1a1a] hover:text-white"}`}
                >
                  2D Stack
                </button>
                <button
                  onClick={() => { switchViewMode("mpr"); setMprMenuOpen(false); setActiveTool(null); setLeftTool("wl"); }}
                  className={`w-full text-left px-4 py-2.5 text-[12px] border-none cursor-pointer transition-colors ${viewMode === "mpr" ? "bg-[#0694FB] text-white" : "bg-transparent text-[#999] hover:bg-[#1a1a1a] hover:text-white"}`}
                >
                  MPR (3-pane + crosshairs)
                </button>
                <button
                  onClick={() => { switchViewMode("3d"); setMprMenuOpen(false); setActiveTool(null); }}
                  className={`w-full text-left px-4 py-2.5 text-[12px] border-none cursor-pointer transition-colors ${viewMode === "3d" ? "bg-[#0694FB] text-white" : "bg-transparent text-[#999] hover:bg-[#1a1a1a] hover:text-white"}`}
                >
                  3D rendering
                </button>
              </div>
            )}
          </div>

          {/* ── 3D rendering only: preset ── */}
          {viewMode === "3d" && (
            <select
              value={renderPreset ?? presetsFor(activeSeries?.modality)[0][0]}
              onChange={e => setRenderPreset(e.target.value)}
              title="What the 3D rendering shows"
              className={`ml-1 bg-[#111] border border-[#2a2a2a] rounded-lg px-2 py-1 text-white text-[12px] outline-none cursor-pointer shrink-0 ${toolbarCompact ? "max-w-[96px]" : ""}`}
            >
              {presetsFor(activeSeries?.modality).map(([name, label]) => <option key={name} value={name}>{label}</option>)}
            </select>
          )}

          {/* ── 3D view only: thick slab ── */}
          {viewMode === "mpr" && (
            <div ref={slabMenuRef} className="relative ml-1">
              <button
                onClick={() => setSlabMenuOpen(v => !v)}
                title="Thick slab — MIP / MinIP / average through a slab instead of one plane"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium border-none cursor-pointer transition-all shrink-0 ${slabLabel(slab)
                  ? "bg-[#F59E0B] text-black"
                  : "bg-transparent text-[#6B6B6B] hover:bg-[#1a1a1a] hover:text-white"
                  }`}
              >
                {slabLabel(slab) ? (toolbarCompact ? SLAB_MODES[slab.mode].label : slabLabel(slab)) : "Slab"}
              </button>
              {slabMenuOpen && (
                <div className="absolute top-full left-0 mt-1 bg-[#161616] border border-[#2a2a2a] rounded-xl z-50 shadow-xl w-[230px] p-3 flex flex-col gap-2.5">
                  <div className="grid grid-cols-4 gap-1">
                    {[["off", "Off"], ...Object.entries(SLAB_MODES).map(([k, m]) => [k, m.label])].map(([mode, label]) => (
                      <button
                        key={mode}
                        onClick={() => setSlab(prev => ({ ...prev, mode }))}
                        className={`px-1 py-1 rounded-md text-[11px] border-none cursor-pointer ${slab.mode === mode ? "bg-[#0694FB] text-white" : "bg-[#111] text-[#999] hover:text-white"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className={`flex flex-col gap-1.5 ${slab.mode === "off" ? "opacity-40 pointer-events-none" : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#868686]">Thickness</span>
                      <span className="text-[12px] text-white font-mono">{`${slab.mm} mm`}</span>
                    </div>
                    <input
                      type="range" min={1} max={100} step={1} value={slab.mm}
                      onChange={e => setSlab(prev => ({ ...prev, mm: Number(e.target.value) }))}
                      className="w-full accent-[#0694FB]"
                    />
                    <div className="flex gap-1">
                      {[3, 5, 10, 20, 40].map(mm => (
                        <button
                          key={mm}
                          onClick={() => setSlab(prev => ({ ...prev, mm }))}
                          className={`flex-1 py-0.5 rounded-md text-[10px] font-mono border-none cursor-pointer ${slab.mm === mm ? "bg-[#0694FB] text-white" : "bg-[#111] text-[#999] hover:text-white"}`}
                        >
                          {mm}
                        </button>
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] text-[#6B6B6B] leading-snug">MIP for vessels and nodules, MinIP for airways. The pixel readout is off while a slab is shown.</span>
                </div>
              )}
            </div>
          )}

          {/* ── 3D view only: fusion ── */}
          {viewMode === "mpr" && (
            <div ref={fusionMenuRef} className="relative ml-1">
              <button
                onClick={() => setFusionMenuOpen(v => !v)}
                title="Fusion — show a PET / NM series of this study over this one, in colour"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium border-none cursor-pointer transition-all shrink-0 ${fusion
                  ? "bg-[#F472B6] text-black"
                  : "bg-transparent text-[#6B6B6B] hover:bg-[#1a1a1a] hover:text-white"
                  }`}
              >
                {fusion ? "Fused" : "Fuse"}
              </button>
              {fusionMenuOpen && (
                <div className="absolute top-full left-0 mt-1 bg-[#161616] border border-[#2a2a2a] rounded-xl z-50 shadow-xl w-[250px] p-3 flex flex-col gap-2.5">
                  {fusionCandidates.length === 0 ? (
                    <span className="text-[11px] text-[#6B6B6B] leading-snug">No PET or nuclear medicine series in this study to fuse.</span>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-[#868686]">Overlay</span>
                      <button
                        onClick={() => setFusion(null)}
                        className={`text-left px-2 py-1 rounded-md text-[11px] border-none cursor-pointer ${!fusion ? "bg-[#0694FB] text-white" : "bg-[#111] text-[#999] hover:text-white"}`}
                      >None</button>
                      {fusionCandidates.map(s => (
                        <button
                          key={s.id}
                          onClick={() => fuseWith(s)}
                          className={`text-left px-2 py-1 rounded-md text-[11px] border-none cursor-pointer truncate ${fusion?.seriesId === s.id ? "bg-[#0694FB] text-white" : "bg-[#111] text-[#999] hover:text-white"}`}
                          title={s.description || s.name}
                        >{`${(s.modality || "").toUpperCase()} · ${s.description || s.name || "series"}`}</button>
                      ))}
                    </div>
                  )}
                  {fusion && (
                    <>
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-[#868686]">Colour scale</span>
                        <div className="flex flex-wrap gap-1">
                          {FUSION_COLORMAPS.map(([name, label]) => (
                            <button
                              key={name}
                              onClick={() => setFusion(prev => ({ ...prev, colormap: name }))}
                              className={`px-2 py-0.5 rounded-md text-[10px] border-none cursor-pointer ${fusion.colormap === name ? "bg-[#0694FB] text-white" : "bg-[#111] text-[#999] hover:text-white"}`}
                            >{label}</button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#868686]">Opacity</span>
                          <span className="text-[11px] text-white font-mono">{`${Math.round(fusion.opacity * 100)}%`}</span>
                        </div>
                        <input
                          type="range" min={0.1} max={1} step={0.05} value={fusion.opacity}
                          onChange={e => setFusion(prev => ({ ...prev, opacity: Number(e.target.value) }))}
                          className="w-full accent-[#0694FB]"
                        />
                      </div>
                      <span className="text-[10px] text-[#6B6B6B] leading-snug">Placed by scanner coordinates — lines up for PET and CT from the same scan.</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Always visible: viewer layout ── */}
          <div ref={layoutMenuRef} className="relative ml-1">
            <button
              onClick={() => setLayoutMenuOpen(v => !v)}
              disabled={translationActive}
              title={translationActive ? "Close the translation split view to use layouts" : "Viewer layout — show several series side by side"}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium border-none cursor-pointer transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${multi
                ? "bg-[#0694FB] text-white"
                : "bg-transparent text-[#6B6B6B] hover:bg-[#1a1a1a] hover:text-white"
                }`}
            >
              <TbLayoutGrid size={15} />
              {multi ? `${lay.cols}×${lay.rows}` : toolbarCompact ? null : "Layout"}
            </button>
            {layoutMenuOpen && (
              <div className="absolute top-full left-0 mt-1 bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden z-50 shadow-xl min-w-[210px] py-1">
                {LAYOUTS.map(l => {
                  const current = l.cols === lay.cols && l.rows === lay.rows;
                  return (
                    <button
                      key={`${l.cols}x${l.rows}`}
                      onClick={() => { applyLayout({ layout: resizeLayout(lay, l.cols, l.rows, seriesList), open: null }); setLayoutMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left text-[12px] border-none cursor-pointer transition-colors ${current ? "bg-[#0694FB] text-white" : "bg-transparent text-[#999] hover:bg-[#1a1a1a] hover:text-white"}`}
                    >
                      <LayoutGlyph cols={l.cols} rows={l.rows} />
                      {l.label}
                    </button>
                  );
                })}
                <div className="h-px bg-[#2a2a2a] my-1" />
                <button
                  onClick={toggleLinked}
                  title="Viewers showing the same patient position (same frame of reference) scroll together"
                  className="w-full flex items-center gap-3 px-3 py-2 text-left text-[12px] bg-transparent text-[#999] hover:bg-[#1a1a1a] hover:text-white border-none cursor-pointer"
                >
                  {lay.linked ? <TbLink size={16} className="text-[#0694FB]" /> : <TbLinkOff size={16} />}
                  <span className="flex-1">Scroll viewers together</span>
                  {lay.linked && <FiCheck size={13} className="text-[#0694FB]" />}
                </button>
              </div>
            )}
          </div>

          <VDivider />

          {/* ── Always visible: Enhance button ── */}
          <div className="relative flex items-center shrink-0">
            <motion.button
              ref={enhanceBtnRef}
              onClick={imageEnhancement}
              onMouseEnter={() => setEnhancementHovered(true)}
              onMouseLeave={() => setEnhancementHovered(false)}
              animate={{
                width: enhancementLoading ? 76
                  : enhancementDone ? 28
                    : enhancementHovered ? (enhancementActive ? 130 : 100)
                      : 28
              }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`relative h-7 flex items-center justify-center rounded-full overflow-hidden border-none cursor-pointer z-10 ${enhancementDone || enhancementActive ? 'bg-[#0694FB]' : 'bg-[#1c1c1c] hover:bg-[#242424]'
                }`}
              style={{ minWidth: 28 }}
            >
              {enhancementLoading ? (
                <span className="flex items-center gap-1.5 px-2 whitespace-nowrap">
                  <span className="relative w-[18px] h-[18px] shrink-0 flex items-center justify-center">
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 18 18">
                      <circle cx="9" cy="9" r="6.5" fill="none" stroke="#2a2a2a" strokeWidth="2" />
                      <circle
                        cx="9" cy="9" r="6.5"
                        fill="none" stroke="#0694FB" strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 6.5}`}
                        strokeDashoffset={`${2 * Math.PI * 6.5 * (1 - enhancementProgress / 100)}`}
                        style={{ transition: 'stroke-dashoffset 0.15s ease' }}
                      />
                    </svg>

                  </span>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[11px] text-[#888] tabular-nums"
                  >
                    {enhancementProgress}%
                  </motion.span>
                </span>
              ) : enhancementDone ? (
                <FiCheck size={13} className="text-white" />
              ) : (
                <span className="flex items-center gap-1.5 px-2 whitespace-nowrap">
                  <PiSparkleFill size={18} className={enhancementActive ? 'text-white' : 'text-[#6B6B6B]'} />
                  <AnimatePresence>
                    {enhancementHovered && (
                      <motion.span
                        key="enhance-label"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.1 }}
                        className={`text-[12px]  ${enhancementActive ? 'text-white' : 'text-[#6B6B6B]'}`}
                      >
                        {enhancementActive ? 'Enhance Active' : 'Enhance'}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              )}
            </motion.button>
          </div>

        </div>

        {/* Slice navigation */}


        <div ref={toolbarRightRef} className="flex items-center gap-2 shrink-0 whitespace-nowrap">
          <button
            onClick={() => onRunAnalysis()}
            disabled={aiLoading}
            className="flex items-center justify-center gap-2 px-4 py-[8px] rounded-full bg-[#0694FB] hover:bg-[#036cb8] text-white text-[13px] border border-[#1E1E1E] hover:border-[#2a2a2a] cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ minWidth: toolbarCompact && !aiLoading ? 0 : 148 }}
            title="Run the selected AI model on this series"
          >
            {aiLoading ? (
              inferenceProgress != null ? (
                <div className="flex items-center gap-2" style={{ width: 116 }}>
                  <FiLoader size={18} className="animate-spin" />
                  <div className="flex-1 h-1.5 bg-black/20 rounded-full overflow-hidden">

                    <div
                      className="h-full bg-white rounded-full transition-all duration-300"
                      style={{ width: `${inferenceProgress}%` }}
                    />
                  </div>
                  <span className="text-[12px] shrink-0">{inferenceProgress}%</span>
                </div>
              ) : (
                <>
                  <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin shrink-0" />
                  Analyzing…
                </>
              )
            ) : <>{toolbarCompact ? "Run AI" : "Run Analysis"}</>}
          </button>
          {(translationActive || translationPairsFor(dicomMeta?.modality || activeSeries?.modality).length > 0) && <button
            onClick={() => translationActive ? onCloseTranslation() : onRunTranslation()}
            className={`flex items-center gap-2.5 px-4 py-[8px] rounded-full text-[13px] cursor-pointer transition-all border-none ${translationActive
              ? "bg-[#A855F7] text-white"
              : "bg-[#303030] text-[#a1a1a1] hover:text-white hover:bg-[#222]"
              }`}
          >
            {toolbarCompact ? "Translate" : "Translate Image"}
            {/* Toggle pill */}
            <span className={`relative inline-flex w-8 h-4 rounded-full transition-colors duration-200 shrink-0 ${translationActive ? "bg-white/80" : "bg-[#6e6e6e]"}`}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 ${translationActive ? "left-[18px]" : "left-0.5"}`} />
            </span>
          </button>}
          {/* <button className="flex items-center gap-1.5 px-4 py-[8px] rounded-full bg-[#0694FB] hover:bg-[#0578d1] text-white text-[13px] font-medium border-none cursor-pointer transition-colors">
            Sign Report
          </button> */}
        </div>
      </div>

      {/* ── Viewport ── */}
      <div className="flex-1 min-h-0 flex flex-row gap-2">
        {/* ── Annotation tools — docked beside the viewer so they never cover the image ── */}
        <div className={`shrink-0 ${viewMode === "3d" ? "hidden" : "flex"} flex-col items-center gap-1 bg-[#161616] rounded-xl px-1.5 py-2 overflow-y-auto select-none`} style={{ scrollbarWidth: "none" }}>
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

          {/* Magnifier — hold the left button over the image (2D only) */}
          {viewMode === "stack" && (
            <ToolBtn icon={<TbZoomIn size={18} />} label="Magnifier — hold left button (Z)" active={activeTool === "magnify"} onClick={() => toggleTool("magnify")} />
          )}

          <HDivider />

          {/* ROI list (named ROIs + volumes) */}
          <ToolBtn icon={<FiList size={15} />} label="ROI list — names and volumes" active={roiPanelOpen} onClick={() => setRoiPanelOpen(o => !o)} />

          {/* Key image flag for this slice */}
          {viewMode === "stack" && (
            <ToolBtn
              icon={isKeyImage ? <TbStarFilled size={17} className="text-[#FACC15]" /> : <TbStar size={17} />}
              label={`${isKeyImage ? "Unmark" : "Mark"} key image (K) · Shift+K next${keyImages.size ? ` · ${keyImages.size} marked` : ""}`}
              onClick={toggleKeyImage}
            />
          )}

          {/* RECIST 1.1 — lesions from the bidirectional tool */}
          <ToolBtn icon={<TbTargetArrow size={17} />} label="RECIST — lesions, sum of diameters, response" active={recistPanelOpen} onClick={() => setRecistPanelOpen(o => !o)} />

          {/* DICOM tag browser */}
          <ToolBtn icon={<TbTags size={17} />} label="DICOM tags (Shift+I)" active={tagPanelOpen} onClick={() => setTagPanelOpen(o => !o)} />

          {/* Measurement labels: always on, or only on the hovered/selected annotation */}
          <ToolBtn icon={<TbTextCaption size={17} />} label={labelsAlwaysOn ? "Labels always on — click to show only on hover/select" : "Labels on hover/select — click to always show them"} active={labelsAlwaysOn} onClick={toggleLabels} />

          <HDivider />

          {/* Delete selected annotation */}
          <ToolBtn
            icon={<FiDelete size={15} />}
            label={hasSelection ? "Delete selected (Del)" : "Click an annotation to select it"}
            active={hasSelection}
            onClick={() => {
              const removed = activeVp.current?.deleteSelectedAnnotations();
              if (removed) setHasSelection(false);
            }}
          />

          {/* Clear all annotations */}
          <ToolBtn icon={<FiTrash2 size={15} />} label="Clear all annotations" onClick={() => {
            // This series' measurements only: not the layout's other viewers, and never
            // Crosshairs' own annotations (removing those breaks the MPR crosshairs). In MPR a
            // measurement off the acquisition plane has no image reference, so it counts too.
            const onSeries = new Set(imageIds);
            (csAnnotation.state.getAllAnnotations() ?? [])
              .filter(a => SAVED_TOOL_NAMES.has(a.metadata?.toolName) && (!a.metadata.referencedImageId || onSeries.has(a.metadata.referencedImageId)))
              .forEach(a => { try { csAnnotation.state.removeAnnotation(a.annotationUID); } catch (_) { } });
            setHasSelection(false);
            activeVp.current?.render?.();
          }} />
        </div>

        {/* ── Viewer grid: the active viewer (full tools) in its cell, the layout's other panes around it ── */}
        <div
          className="flex-1 min-w-0 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${multi ? lay.cols : 1}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${multi ? lay.rows : 1}, minmax(0, 1fr))` }}
        >
        <div
          ref={viewportWrapRef}
          {...paneHandlers("active", lay.activeSlot)}
          className={`bg-black rounded-xl relative overflow-hidden min-w-0 min-h-0 ${multi ? "ring-1 ring-[#0694FB]/70" : ""}`}
          style={slotPlacement(lay.activeSlot)}
        >
          {dropHighlight(lay.activeSlot)}

          {/* Empty state */}
          {imageIds.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-0 pointer-events-none">
              <img src="/dimensions.png" alt="" className="w-10 h-10 object-contain opacity-20" />
              <p className="text-[#2a2a2a] text-sm m-0">Select a slice from the panel</p>
            </div>
          )}

          {/* Cornerstone element — 2D stack or MPR volume */}
          <div className="absolute inset-0 z-10">
            {viewMode === "stack" ? (
              <CornerstoneViewport
                ref={vpRef}
                imageIds={imageIds}
                activeTool={activeTool}
                leftTool={leftTool}
                onIndexChange={(idx) => {
                  setCurrentIndex(idx);
                  const src = fileSrcOfFrame(idx);
                  if (src) onSelectImage?.(src);
                  syncFrom("active", idx);
                }}
                onDisplayChange={(display) => { setInverted(display.invert); syncDisplayFrom("active", display); }}
                onArrowTextRequest={handleArrowTextRequest}
                onCameraChanged={handleCameraChanged}
                onRoisChange={setRois}
                onPixelValue={(probe) => pixelFeedRef.current?.(probe)}
              />
            ) : viewMode === "3d" ? (
              <CornerstoneVolume3D
                ref={render3dRef}
                imageIds={imageIds}
                preset={renderPreset ?? presetsFor(activeSeries?.modality)[0][0]}
              />
            ) : (
              <CornerstoneVolumeViewport
                ref={volumeVpRef}
                imageIds={imageIds}
                activeTool={activeTool}
                leftTool={leftTool}
                onArrowTextRequest={handleArrowTextRequest}
                onActivePlaneChange={setActivePlane}
                maskSlices={segmentationMaskSlices}
                maskConfidences={segmentationConfidences}
                maskLegend={segmentationLegend}
                colorByClass={segmentationIsAnatomy}
                onRoisChange={setRois}
                maskOpacity={maskOpacity}
                savedRegions={mprRegions}
                slab={slab}
                fusion={fusion?.imageIds ? fusion : null}
                onRegionsChange={(regions) => { setMprRegions(regions); mprRegionsRef.current = regions; scheduleSaveRef.current?.(); }}
              />
            )}
          </div>

          {/* ── MPR segmentation opacity control — the 2D overlay's slider card only
            renders in stack mode, but the mask is a real labelmap volume here too,
            so give it an equivalent (lighter) control. ── */}
          {viewMode === "mpr" && segmentationMaskSlices && (
            <div className="absolute top-3 right-3 z-30 w-[220px] overflow-hidden rounded-xl bg-[#161616] border border-[#1E1E1E] backdrop-blur-sm shadow-lg">
              <div className="px-3 py-2 flex items-center gap-2">
                <span className="text-[12px] font-semibold text-white flex-1">Segmentation</span>
                <button
                  onClick={() => onInferenceResult(null)}
                  className="text-[#6B6B6B] hover:text-white text-[12px] bg-transparent border-none cursor-pointer leading-none transition-colors p-0"
                  title="Hide segmentation"
                >✕</button>
              </div>
              <div className="border-t border-[#1E1E1E] bg-[#111]/60 px-3 py-2 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={maskOpacity}
                  onChange={e => setMaskOpacity(Number(e.target.value))}
                  className="flex-1 min-w-0 h-1 accent-[#0694FB] cursor-pointer"
                />
                <span className="text-[#FFFFFF] text-[12px] w-[26px] text-right shrink-0">
                  {Math.round(maskOpacity * 100)}%
                </span>
              </div>
              {segmentationIsAnatomy && <SegmentationLegend legend={segmentationLegend} volumes={inferenceResult?.class_volumes_cm3} structures={inferenceResult?.structures} />}
              <ResultWarnings warnings={inferenceResult?.warnings} />
            </div>
          )}

          {/* ── Keyboard shortcuts (? to toggle) — same dialog design as the app's other dialogs ── */}
          <AnimatePresence>
            {shortcutsOpen && (() => {
              const groups = [
                ["Mouse", [["Left drag", "Window / level (or chosen tool)"], ["Middle drag / Shift+left", "Pan"], ["Right drag", "Zoom"], ["Wheel", "Scroll slices"]]],
                ["Slices", [["↑ ↓ ← →", "Previous / next"], ["Page Up / Down", "Jump 10"], ["Home / End", "First / last"], ["Space", "Play / pause cine"]]],
                ["Window", [["1 – 9", "CT presets"], ["0", "Original window"], ["I", "Invert"]]],
                ["Left-button tool", [["S", "Pointer (does nothing; grab lines)"], ["W", "Window / level"], ["P or M", "Pan"], ["C", "Crosshairs (MPR)"], ["Esc", "Drop measurement tool"]]],
                ["Measure", [["L", "Length"], ["A", "Angle"], ["E", "Bidirectional (RECIST)"], ["N", "Cobb angle"], ["O", "Ellipse"], ["B", "Rectangle"], ["D", "Polygon"], ["T", "Arrow"], ["X", "Probe"], ["Delete", "Delete selected"]]],
                ["View", [["R / Shift+R", "Rotate CW / CCW"], ["H / V", "Flip horizontal / vertical"], ["F", "Fit & reset"], ["Z", "Magnifier (2D, hold left)"]]],
                ["Images", [["K", "Mark / unmark key image"], ["Shift+K", "Next key image"], ["Shift+I", "DICOM tags"]]],
                ["Layout", [["Double-click", "Make a viewer the active one"], ["Drag series card", "Show it in a viewer"]]],
              ];
              return (
                <motion.div
                  className="fixed inset-0 z-[999] flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setShortcutsOpen(false)}
                >
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                  <motion.div
                    initial={{ y: 24, opacity: 0, scale: 0.97 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 16, opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                    onClick={e => e.stopPropagation()}
                    className="relative w-full max-w-[600px] max-h-[85vh] bg-[#161616] border border-[#1E1E1E] rounded-2xl flex flex-col overflow-hidden"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between px-7 pt-7 pb-5 shrink-0">
                      <div>
                        <div className="flex flex-row gap-2"><FiHelpCircle size={20} className="text-[#ffffff]" /><h2 className="text-white text-[17px] font-medium m-0">Keyboard shortcuts</h2></div>
                        <p className="text-[#6B6B6B] text-[13px] m-0 mt-1">
                          Mouse and keyboard controls for the viewer. Press ? to show or hide this list.
                        </p>
                      </div>
                      <button onClick={() => setShortcutsOpen(false)} className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1 mt-0.5">
                        <FiX size={18} />
                      </button>
                    </div>
                    {/* Body */}
                    <div className="px-7 pb-7 overflow-y-auto grid grid-cols-2 gap-x-8 gap-y-5">
                      {groups.map(([title, rows]) => (
                        <div key={title} className="flex flex-col gap-1.5">
                          <span className="text-[#0694FB] text-[11px] uppercase tracking-wide">{title}</span>
                          {rows.map(([keys, action]) => (
                            <div key={keys} className="flex items-center justify-between gap-3 text-[12px]">
                              <span className="font-mono text-white bg-[#1E1E1E] rounded px-1.5 py-0.5 whitespace-nowrap">{keys}</span>
                              <span className="text-[#949494] text-right">{action}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              );
            })()}
          </AnimatePresence>

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
              pixelFeed={viewMode === "stack" ? pixelFeedRef : null}
              isKeyImage={viewMode === "stack" && isKeyImage}
              viewMode={viewMode}
            />
          )}

          {/* ── Job failed banner ── */}
          <AnimatePresence>
            {jobStatus === "failed" && (
              <motion.div
                className="absolute top-3 left-1/2 z-30 flex items-center gap-2 bg-red-600 border border-red-500/30 rounded-full px-4 py-2 pointer-events-none"
                style={{ x: "-50%" }}
                initial={{ y: -60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -60, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 22, mass: 0.8 }}
              >
                <FiX size={22} className="text-white shrink-0 bg-red-700 p-[4px] rounded-full" />
                <p className="text-white text-[13px] m-0">Inference job failed</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Enhancement overlay (sits between DICOM and segmentation) ── */}
          {enhancementResult && enhancementActive && viewMode === "stack" && (() => {
            const eSlice = resultForFrame(enhancementResult.slices, currentIndex);
            const eOverlay = eSlice?.enhanced_image;
            if (!eOverlay) return null;
            const eSrc = eOverlay.startsWith("data:") ? eOverlay : `data:image/png;base64,${eOverlay}`;
            return (
              <img
                src={eSrc}
                alt="enhancement overlay"
                style={{
                  opacity: 1,
                  mixBlendMode: "normal",
                  transformOrigin: "center center",
                  transform: [
                    `translate(${maskTransform.panX}px, ${maskTransform.panY}px)`,
                    `scale(${maskTransform.zoom})`,
                    `rotate(${maskTransform.rotation}deg)`,
                    maskTransform.flipH ? "scaleX(-1)" : "",
                    maskTransform.flipV ? "scaleY(-1)" : "",
                  ].filter(Boolean).join(" "),
                }}
                className="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none"
              />
            );
          })()}

          {/* ── Segmentation mask overlay ── */}
          {inferenceResult && viewMode === "stack" && (() => {
            const sliceData = resultForFrame(inferenceResult.slices, currentIndex);
            const overlay = sliceData?.mask;
            // Classification results (e.g. breast density) have no mask but still get the card
            if (!overlay && sliceData?.predicted_class == null) return null;
            const isBase64 = overlay && !overlay.startsWith("http") && !overlay.startsWith("data:");
            const overlaySrc = !overlay ? null : isBase64 ? `data:image/png;base64,${overlay}` : overlay;

            // GradCAM: predicted_class / scores are non-null; segmentation: both null
            const isGradCam = sliceData?.predicted_class != null;
            const conf = sliceData?.confidence ?? 0;
            const coverage = sliceData?.coverage_pct;
            const detected = sliceData?.detected;

            let badgeSentence, badgeColor, overlayLabel;
            if (isGradCam) {
              const confStr = `${(conf * 100).toFixed(0)}%`;
              const topScore = sliceData.scores ? ` with a top score of ${(Math.max(...sliceData.scores) * 100).toFixed(0)}%` : "";
              const className = inferenceResult.class_labels?.[sliceData.predicted_class];
              badgeSentence = className
                ? `Predicted ${className} at ${confStr} confidence.`
                : `Predicted class ${sliceData.predicted_class} at ${confStr} confidence${topScore}.`;
              badgeColor = "text-[#0694FB]";
              overlayLabel = "GradCAM";
            } else {
              const confStr = `${(conf * 100).toFixed(0)}%`;
              const covStr = coverage != null ? `, covering ${coverage.toFixed(1)}% of the slice` : "";
              badgeSentence = detected
                ? `A finding was detected at ${confStr} confidence${covStr}.`
                : `No finding detected in this slice at ${confStr} confidence.`;
              badgeColor = detected ? "text-red-400" : "text-[#949494]";
              overlayLabel = "Segmentation";
            }

            return (
              <>
                {/* Overlay image — screen blend so white regions light up over the DICOM,
                  coloured orange-red via CSS filter for clinical clarity */}
                {overlaySrc && <img
                  src={overlaySrc}
                  alt="inference overlay"
                  style={{
                    opacity: maskOpacity,
                    // Anatomy masks already carry one colour per structure — show them as-is
                    mixBlendMode: segmentationIsAnatomy ? "normal" : "screen",
                    filter: segmentationIsAnatomy ? "none" : "sepia(1) saturate(8) hue-rotate(320deg)",
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
                />}

                {/* Overlay controls — recommendation-card style */}
                {(() => {
                  // Signal bars driven by confidence from unified slice shape
                  const signal = conf >= 0.75 ? 3 : conf >= 0.4 ? 2 : conf > 0 ? 1 : 0;
                  const signalTone = isGradCam ? "#0694FB" : detected ? "#f87171" : "#6B6B6B";
                  const signalLabel = conf >= 0.75 ? "High confidence" : conf >= 0.4 ? "Moderate" : "Low confidence";

                  return (
                    <div
                      className="absolute z-30 w-[300px] overflow-hidden rounded-xl bg-[#161616] border border-[#1E1E1E] backdrop-blur-sm shadow-lg"
                      style={overlayPos ? { left: overlayPos.x, top: overlayPos.y } : { top: 12, right: 12 }}
                    >
                      {/* Drag handle */}
                      <div
                        onMouseDown={handleOverlayDragStart}
                        className="flex items-center justify-center gap-1 py-1.5 cursor-grab active:cursor-grabbing select-none hover:bg-[#1E1E1E] transition-colors"
                      >
                        {[0, 1, 2, 3, 4].map(i => (
                          <span key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "#3a3a3a", display: "inline-block" }} />
                        ))}
                      </div>

                      {/* Body */}
                      <div className="px-3 pb-2.5">
                        <span className="text-[13px] font-semibold text-white">
                          {`Slice ${currentIndex + 1} of ${frameCount || "—"}`}
                        </span>
                        <p className={`mt-1.5 text-[12px] leading-relaxed m-0 ${badgeColor}`}>
                          {badgeSentence}
                        </p>
                        <span className="mt-2 flex items-center gap-2 shrink-0">
                          <span className="flex items-end gap-0.5">
                            {[0, 1, 2, 3].map(bar => (
                              <span
                                key={bar}
                                style={{
                                  display: "inline-block",
                                  width: 4,
                                  height: 16,
                                  borderRadius: 2,
                                  background: bar < signal ? signalTone : "#2a2a2a",
                                  transition: "background 0.3s",
                                }}
                              />
                            ))}
                          </span>
                          <span className="text-[13px] font-medium text-[#949494]">{signalLabel}</span>
                        </span>
                      </div>


                      {/* Footer — signal meter left, slider + close right */}
                      <div className="border-t border-[#1E1E1E] bg-[#111]/60 px-3 py-2 flex items-center ">


                        {/* Opacity slider + close */}
                        <span className="flex items-center gap-2 flex-1 min-w-0">
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={maskOpacity}
                            onChange={e => setMaskOpacity(Number(e.target.value))}
                            className="flex-1 min-w-0 h-1 accent-[#0694FB] cursor-pointer"
                          />
                          <span className="text-[#FFFFFF] text-[12px]  w-[26px] text-right shrink-0">
                            {Math.round(maskOpacity * 100)}%
                          </span>
                          <button
                            onClick={() => { onInferenceResult(null); setOverlayPos(null); }}
                            className="text-[#6B6B6B] hover:text-white text-[12px] bg-transparent border-none cursor-pointer leading-none transition-colors p-0 ml-0.5"
                            title="Close overlay"
                          >✕</button>
                        </span>
                      </div>
                      {segmentationIsAnatomy && <SegmentationLegend legend={segmentationLegend} volumes={inferenceResult.class_volumes_cm3} structures={inferenceResult.structures} />}
                      <ResultWarnings warnings={inferenceResult.warnings} />
                    </div>
                  );
                })()}
              </>
            );
          })()}

          {/* placeholder — dialog rendered at root level below */}
        </div>

        {multi && lay.panes.map((series, slot) => slot === lay.activeSlot ? null : (
          <div
            key={`pane-${slot}`}
            {...paneHandlers(String(slot), slot)}
            className="bg-black rounded-xl relative overflow-hidden min-w-0 min-h-0"
            style={slotPlacement(slot)}
          >
            {series ? (
              <SeriesPane
                key={series.id}
                ref={handle => { if (handle) paneHandlesRef.current[slot] = handle; else delete paneHandlesRef.current[slot]; }}
                series={series}
                leftTool={leftTool}
                linked={linkActive && canLink(geometryRef.current.active, geometryRef.current[slot])}
                onIndexChange={(index) => syncFrom(String(slot), index)}
                onDisplayChange={(display) => syncDisplayFrom(String(slot), display)}
                onGeometry={(geometry) => onPaneGeometry(String(slot), geometry)}
                onActivate={() => applyLayout(activatePane(lay, slot))}
                onRemove={() => applyLayout({ layout: clearPane(lay, slot), open: null })}
              />
            ) : (
              <EmptyPane series={unshownSeries} onPick={(s) => applyLayout(placeSeries(lay, slot, s))} />
            )}
            {dropHighlight(slot)}
          </div>
        ))}
        </div>

        {/* ── ROI list — named ROIs; contours sharing a name on different slices are one ROI ── */}
        {roiPanelOpen && (
          <div className="shrink-0 w-[250px] bg-[#161616] rounded-xl flex flex-col overflow-hidden select-none">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1E1E1E] shrink-0">
              <span className="text-white text-[13px] font-semibold">{`ROIs${rois.length ? ` (${rois.length})` : ""}`}</span>
              <button onClick={() => setRoiPanelOpen(false)} className="text-[#6B6B6B] hover:text-white bg-transparent border-none cursor-pointer p-0" title="Close">
                <FiX size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#1B1B1B #000" }}>
              {rois.length === 0 && (
                <p className="text-[#6B6B6B] text-[12px] leading-relaxed m-0 px-3 py-4">
                  No ROIs yet. Draw an ellipse, circle, rectangle or polygon. Contours with the same name on
                  different slices form one ROI, and its volume is computed from all of them.
                </p>
              )}

              {rois.map(roi => {
                const editing = editingRoi?.name === roi.name;
                const shown = roiVolumesShown.has(roi.name);
                const ct = roi.meanUnit === "HU";
                return (
                  <div key={roi.name} className="px-3 py-2.5 flex flex-col gap-1 border-b border-[#1E1E1E]">
                    <div className="flex items-center gap-2">
                      {editing ? (
                        <input
                          autoFocus
                          value={editingRoi.value}
                          onChange={e => setEditingRoi(r => ({ ...r, value: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === "Enter") commitRoiRename();
                            if (e.key === "Escape") setEditingRoi(null);
                          }}
                          onBlur={commitRoiRename}
                          className="flex-1 min-w-0 bg-[#111] border border-[#0694FB] rounded-md px-1.5 py-0.5 text-white text-[12px] outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => (viewMode === "stack" ? goTo(roi.firstSlice - 1) : volumeVpRef.current?.focusRoi(roi.name))}
                          title={viewMode === "stack" ? "Go to its first slice" : "Centre the crosshairs on it"}
                          className="flex-1 min-w-0 text-left text-white text-[12px] font-medium truncate bg-transparent border-none cursor-pointer p-0 hover:text-[#0694FB]"
                        >
                          {roi.name}
                        </button>
                      )}
                      <button
                        onClick={() => setEditingRoi({ name: roi.name, value: roi.name })}
                        title="Rename (use another ROI's name to merge them)"
                        className="text-[#6B6B6B] hover:text-white bg-transparent border-none cursor-pointer p-0"
                      >
                        <FiEdit2 size={12} />
                      </button>
                      <button
                        onClick={() => removeRoi(roi.name)}
                        title="Delete this ROI (all its contours)"
                        className="text-[#6B6B6B] hover:text-red-400 bg-transparent border-none cursor-pointer p-0"
                      >
                        <FiTrash2 size={12} />
                      </button>
                    </div>

                    <span className="text-[11px] text-[#868686]">
                      {roi.slices.length === 1
                        ? `Slice ${roi.firstSlice} · ${roi.contourCount} contour${roi.contourCount === 1 ? "" : "s"}`
                        : `Slices ${roi.firstSlice}–${roi.lastSlice} · outlined on ${roi.slices.length}`}
                    </span>

                    {roi.slices.length < 2 ? (
                      viewMode === "stack" ? (
                        <span className="text-[11px] text-[#6B6B6B]">Outline it on 2+ slices for a volume, or grow it in the 3D view</span>
                      ) : (
                        <div className="flex flex-col gap-1 mt-0.5">
                          <span className="text-[11px] text-[#6B6B6B]">Outline it on 2+ slices for a volume, or:</span>
                          <button
                            onClick={() => volumeVpRef.current?.growRoi(roi.name)}
                            title="Use this contour as a seed and grow it through the neighbouring slices"
                            className="self-start px-2.5 py-1 rounded-full bg-[rgba(6,148,251,0.17)] hover:bg-[rgba(6,148,251,0.25)] text-[#0694FB] text-[11px] font-medium border-none cursor-pointer"
                          >
                            Grow to 3D
                          </button>
                        </div>
                      )
                    ) : !shown ? (
                      <button
                        onClick={() => setRoiVolumesShown(prev => new Set(prev).add(roi.name))}
                        className="self-start mt-0.5 px-2.5 py-1 rounded-full bg-[rgba(6,148,251,0.17)] hover:bg-[rgba(6,148,251,0.25)] text-[#0694FB] text-[11px] font-medium border-none cursor-pointer"
                      >
                        Compute volume
                      </button>
                    ) : roi.volumeCm3 == null ? (
                      <span className="text-[11px] text-[#6B6B6B]">These images carry no position data (e.g. plain PNG/JPG), so volume can't be measured</span>
                    ) : (
                      <div className="mt-1 rounded-lg bg-[#111] px-2.5 py-2 flex flex-col gap-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] text-[#868686]">Volume</span>
                          <span className="text-[13px] text-[#0694FB] font-mono">{`${roi.volumeCm3.toFixed(2)} cm³`}</span>
                        </div>
                        {roi.sizeMm && (
                          <div className="flex items-baseline justify-between" title={`Maximum extent ${SIZE_AXES_LABEL}: front–back × side–side × head–foot`}>
                            <span className="text-[11px] text-[#868686]">Size</span>
                            <span className="text-[12px] text-white font-mono">
                              {formatSize(roi.sizeMm)} <span className="text-[10px] text-[#6B6B6B]">{SIZE_AXES_LABEL}</span>
                            </span>
                          </div>
                        )}
                        {roi.skippedSlices > 0 && (
                          <span className="text-[10px] text-[#6B6B6B]">
                            {`${roi.skippedSlices} slice${roi.skippedSlices === 1 ? "" : "s"} between outlines filled in by interpolation`}
                          </span>
                        )}
                        {roi.mean != null && (
                          <div className="flex items-baseline justify-between">
                            <span className="text-[11px] text-[#868686]">{ct ? "Mean" : "Mean intensity"}</span>
                            <span className="text-[12px] text-white font-mono">{`${roi.mean.toFixed(1)}${ct ? " HU" : ""}`}</span>
                          </div>
                        )}
                        {roi.mean != null && roi.meanFromContours < roi.contourCount && (
                          <span className="text-[10px] text-[#6B6B6B]">
                            {`Mean from ${roi.meanFromContours} of ${roi.contourCount} contours. Scroll through the others to include them.`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── RECIST 1.1 ── */}
        {recistPanelOpen && (
          <RecistPanel
            imageIds={imageIds}
            reference={recistReference}
            onReferenceChange={(next) => { setRecistReference(next); recistReferenceRef.current = next; scheduleSaveRef.current?.(); }}
            onEdited={() => { activeVp.current?.render?.(); scheduleSaveRef.current?.(); }}
            onGoToSlice={viewMode === "stack" ? goTo : undefined}
            onClose={() => setRecistPanelOpen(false)}
          />
        )}

        {/* ── DICOM tag browser — follows the slice on screen ── */}
        {tagPanelOpen && <DicomTagPanel imageId={imageIds[currentIndex]} onClose={() => setTagPanelOpen(false)} />}

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

            {/* Loading state */}
            {translationLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20 pointer-events-none">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-[#A855F7] border-t-transparent rounded-full animate-spin" />
                  <p className="text-[#A855F7] text-[12px] m-0">
                    {translationProgress != null ? `Translating… ${translationProgress}%` : "Translating…"}
                  </p>
                </div>
                {translationProgress != null && (
                  <div className="w-40 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div className="h-full bg-[#A855F7] rounded-full transition-all duration-300" style={{ width: `${translationProgress}%` }} />
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!translationLoading && !translationResult && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-0 pointer-events-none">
                <img src="/dimensions.png" alt="" className="w-10 h-10 object-contain opacity-10" />
                <p className="text-[#2a2a2a] text-sm m-0">Translated image will appear here</p>
              </div>
            )}

            {/* Cornerstone viewport — fed with translated slices once ready */}
            <div className="absolute inset-0 z-10">
              <CornerstoneViewport
                ref={vpRef2}
                imageIds={translationImageIds}
                activeTool={null}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Cine / slice bar — docked under the viewer (as in Horos) so it never covers the image ── */}
      {frameCount > 1 && viewMode !== "3d" && (
        <div className="shrink-0 bg-[#161616] rounded-xl px-4 py-2 flex items-center gap-3 select-none">
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
            onClick={() => { setPlaying(false); goTo(frameCount - 1); }}
            title="Last slice"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-transparent border-none text-[#6B6B6B] hover:text-white cursor-pointer transition-colors"
          >
            <FiSkipForward size={14} />
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-[#2a2a2a]" />

          {/* Scrubber */}
          <SliceScrubber
            count={frameCount}
            index={currentIndex}
            onSeek={(i) => { setPlaying(false); goTo(i); }}
            detected={inferenceResult?.slices ? Array.from({ length: frameCount }, (_, i) => !!resultForFrame(inferenceResult.slices, i)?.detected) : null}
            measured={measuredSlices}
            keyed={keyImages.size ? imageIds.map(id => keyImages.has(id)) : null}
          />

          {/* Frame counter */}
          <span className="text-[#6B6B6B] text-[11px] font-mono w-[50px] text-center shrink-0">
            {currentIndex + 1}/{frameCount}
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
          <span className="text-[#6B6B6B] text-[13px] w-[32px] text-center shrink-0">{fps} fps</span>
          <button
            onClick={() => setFps(f => Math.min(30, f + 2))}
            title="Faster"
            className="text-[#6B6B6B] hover:text-white text-[11px] font-mono bg-transparent border-none cursor-pointer transition-colors px-1"
          >
            +
          </button>
        </div>
      )}

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
                  <h2 className="text-white text-[17px] font-medium m-0">{arrowDialog.initial ? "Edit Label" : "Annotation Label"}</h2>
                  <p className="text-[#6B6B6B] text-[13px] m-0 mt-1">{arrowDialog.initial ? "Change this annotation's label" : "Enter a label for this annotation"}</p>
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
                  {arrowDialog.initial ? "Save" : "Add Label"}
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
