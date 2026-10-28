import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { RenderingEngine, Enums, volumeLoader, setVolumesForViewports, cache as csCache, eventTarget as csEventTarget } from "@cornerstonejs/core";
import {
  ToolGroupManager,
  utilities as csToolsUtilities,
  annotation as csAnnotation,
  segmentation as csSegmentation,
  PanTool,
  ZoomTool,
  StackScrollTool,
  WindowLevelTool,
  LengthTool,
  AngleTool,
  EllipticalROITool,
  CircleROITool,
  RectangleROITool,
  ArrowAnnotateTool,
  ProbeTool,
  PlanarFreehandROITool,
  CrosshairsTool,
  BidirectionalTool,
  CobbAngleTool,
  LabelTool,
  Enums as csToolsEnums,
} from "@cornerstonejs/tools";
import { initCornerstone } from "../../../lib/cornerstoneSetup";
import { applyHorosMouseBindings } from "../../../lib/mouseBindings";
import { PENCIL_TOOL_NAME } from "../../../lib/annotationPersistence";
import { probePixel, mmPerCanvasPixel, formatPixelValue } from "../../../lib/viewportReadouts";
import OrientationMarkers, { getOrientationMarkers } from "./OrientationMarkers";
import ScaleBar from "./ScaleBar";
import {
  roiContoursInWorld, contourCrossSection, roiColor,
  listRois, suggestRoiName, roiFirstContour, AREA_ROI_TOOL_NAMES,
} from "../../../lib/roiVolume";
import { growRegionThroughSlices } from "../../../lib/regionGrow";
import { uid } from "../../../lib/uid";

// Starting intensity window for growing a drawn region (mean ± this many SDs); the popup's
// −/+ buttons tighten or loosen it within these bounds.
const DEFAULT_GROW_TOLERANCE = 2;
const MIN_GROW_TOLERANCE = 0.5;
const MAX_GROW_TOLERANCE = 5;

const TOOL_MAP = {
  circle:   CircleROITool.toolName,
  square:   RectangleROITool.toolName,
  arrow:    ArrowAnnotateTool.toolName,
  ruler:    LengthTool.toolName,
  angle:    AngleTool.toolName,
  marker:   ProbeTool.toolName,
  polygon:  PlanarFreehandROITool.toolName,
  bidirectional: BidirectionalTool.toolName,
  cobb:     CobbAngleTool.toolName,
  text:     LabelTool.toolName,
  pencil:   PENCIL_TOOL_NAME,
};

const ALL_ANNOTATION_TOOLS = Object.values(TOOL_MAP);

const { MouseBindings, KeyboardBindings } = csToolsEnums;

// Three synced panes — order drives layout (axial, sagittal, coronal)
const PLANES = [
  { key: "axial",    orientation: Enums.OrientationAxis.AXIAL,    color: "#0694FB", label: "AXIAL" },
  { key: "sagittal", orientation: Enums.OrientationAxis.SAGITTAL, color: "#22C55E", label: "SAGITTAL" },
  { key: "coronal",  orientation: Enums.OrientationAxis.CORONAL,  color: "#F59E0B", label: "CORONAL" },
];

// Same orange-red the 2D overlay tints its mask with, so a finding reads the same in both views.
const AI_FINDING_COLOR = [255, 77, 64, 255];
// Manually-drawn polygons stay blue so they're never mistaken for a model prediction.
const MANUAL_ROI_COLOR = [6, 148, 251, 255];

// Map a mask pixel to a class id: 0 = background, otherwise 1 + its index in the result's
// label_legend. Single-class legends (and results with no legend) mark every hit as 1;
// multi-class ones (BraTS) pick the nearest legend colour.
function classifyMaskPixel(r, g, b, legend) {
  if (!legend || legend.length < 2) return 1;
  let best = 0;
  let bestDist = Infinity;
  legend.forEach((entry, idx) => {
    const [lr, lg, lb] = entry.rgb ?? [255, 255, 255];
    const dist = (r - lr) ** 2 + (g - lg) ** 2 + (b - lb) ** 2;
    if (dist < bestDist) { bestDist = dist; best = idx; }
  });
  return best + 1;
}

// Decode a single slice's mask PNG (base64, data URL, or http URL — same three
// shapes the 2D overlay accepts) into a flat class-id array (see classifyMaskPixel) sized
// to the volume's in-plane dimensions (resampled if the mask's native size differs).
function decodeMaskToLabels(src, width, height, legend) {
  return new Promise((resolve) => {
    const isRemoteUrl = src.startsWith("http");
    const img = new Image();
    if (isRemoteUrl) img.crossOrigin = "anonymous"; // needed for canvas pixel readback cross-origin
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.imageSmoothingEnabled = false; // resampling must not blend class colours at edges
        ctx.drawImage(img, 0, 0, width, height);
        const { data } = ctx.getImageData(0, 0, width, height);
        const labels = new Uint8Array(width * height);
        // Class per distinct colour, filled lazily — legends can hold 100+ colours (whole-body
        // CT), so a nearest-colour search for every pixel would be far too slow.
        const classByColor = new Map();
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          const alpha = data[i + 3];
          const luminance = data[i] + data[i + 1] + data[i + 2];
          if (alpha <= 10 || luminance <= 10) {
            labels[p] = 0;
            continue;
          }
          const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
          let cls = classByColor.get(key);
          if (cls === undefined) {
            cls = classifyMaskPixel(data[i], data[i + 1], data[i + 2], legend);
            classByColor.set(key, cls);
          }
          labels[p] = cls;
        }
        resolve(labels);
      } catch (err) {
        console.warn("[MPR mask] canvas read failed (likely a CORS-tainted image) — slice skipped:", err);
        resolve(null);
      }
    };
    img.onerror = () => {
      console.warn("[MPR mask] mask image failed to load — slice skipped:", src.slice(0, 80));
      resolve(null);
    };
    img.src = isRemoteUrl || src.startsWith("data:") ? src : `data:image/png;base64,${src}`;
  });
}

// Label each connected blob in the binary mask with its own index (6-connectivity flood
// fill) so distinct findings get distinct colors and can be individually clicked/measured.
// Capped at 254 components (fits the Uint8Array labelmap buffer; background stays 0).
// Blobs smaller than minVoxels are dropped as noise (a real mask commonly has dozens/
// hundreds of tiny speckle false-positives, which would otherwise burn through the entire
// 254-label budget before a single real finding — or a manually-drawn ROI — gets one).
function labelConnectedComponents(binary, w, h, d, spacingMm, minVoxels = 8) {
  const total = w * h * d;
  const sliceSize = w * h;
  const labels = new Uint8Array(total);
  const stats = new Map();
  const voxelVolumeCm3 = (spacingMm[0] * spacingMm[1] * spacingMm[2]) / 1000;
  const PENDING = 255; // tentative marker for an unconfirmed blob, distinct from 0=background and 1-254=real labels
  let nextLabel = 0;
  let droppedAsNoise = 0;

  for (let seed = 0; seed < total; seed++) {
    if (!binary[seed] || labels[seed] !== 0) continue;
    if (nextLabel >= 254) break;

    const queue = [seed];
    labels[seed] = PENDING;
    let qi = 0;
    let kMin = Infinity;
    let kMax = -Infinity;
    while (qi < queue.length) {
      const cur = queue[qi++];
      const k = Math.floor(cur / sliceSize);
      if (k < kMin) kMin = k;
      if (k > kMax) kMax = k;
      const rem = cur - k * sliceSize;
      const j = Math.floor(rem / w);
      const i = rem - j * w;
      const tryPush = (n) => {
        if (binary[n] && labels[n] === 0) {
          labels[n] = PENDING;
          queue.push(n);
        }
      };
      if (i > 0) tryPush(cur - 1);
      if (i < w - 1) tryPush(cur + 1);
      if (j > 0) tryPush(cur - w);
      if (j < h - 1) tryPush(cur + w);
      if (k > 0) tryPush(cur - sliceSize);
      if (k < d - 1) tryPush(cur + sliceSize);
    }

    const voxelCount = queue.length;
    if (voxelCount < minVoxels) {
      queue.forEach(idx => { labels[idx] = 0; }); // discard — leave as background
      droppedAsNoise++;
      continue;
    }
    nextLabel++;
    const label = nextLabel;
    queue.forEach(idx => { labels[idx] = label; });
    stats.set(label, { voxelCount, volumeCm3: voxelCount * voxelVolumeCm3, kMin, kMax });
  }

  if (droppedAsNoise > 0) {
    console.log(`[MPR mask] dropped ${droppedAsNoise} speckle blob(s) under ${minVoxels} voxels; kept ${stats.size} finding(s).`);
  }

  return { labels, stats };
}

// Anatomy results: one segment per structure (segment index = class id) rather than per
// connected blob, so touching organs stay separate and each keeps its legend colour.
function labelByClass(classes, w, h, d, spacingMm) {
  const sliceSize = w * h;
  const voxelVolumeCm3 = (spacingMm[0] * spacingMm[1] * spacingMm[2]) / 1000;
  const stats = new Map();
  for (let idx = 0; idx < classes.length; idx++) {
    const c = classes[idx];
    if (!c) continue;
    const k = Math.floor(idx / sliceSize);
    let stat = stats.get(c);
    if (!stat) {
      stat = { voxelCount: 0, volumeCm3: 0, kMin: k, kMax: k }; // idx only grows, so the first hit is kMin
      stats.set(c, stat);
    }
    stat.voxelCount++;
    stat.kMax = k;
  }
  stats.forEach(stat => { stat.volumeCm3 = stat.voxelCount * voxelVolumeCm3; });
  // A copy — manual ROIs get written into the label array, the class array stays as decoded
  return { labels: classes.slice(), stats };
}

// Even-odd point-in-polygon test (ray casting), used to rasterize a manually-drawn
// polygon ROI into voxels on whichever 2D plane it was drawn on.
function pointInPolygon2D(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

let instanceCounter = 0;

const CornerstoneVolumeViewport = forwardRef(function CornerstoneVolumeViewport(
  { imageIds = [], activeTool = null, leftTool = "wl", onArrowTextRequest, onActivePlaneChange, maskSlices = null, maskConfidences = null, maskLegend = null, colorByClass = false, maskOpacity = 0.5, onRoisChange, savedRegions = null, onRegionsChange },
  ref
) {
  const containerRef = useRef(null); // outer grid — click position is measured relative to this
  const divRefs = useRef({}); // plane key -> element
  const engineRef = useRef(null);
  const volumeIdRef = useRef(null);
  const toolGroupRef = useRef(null);
  const segmentationIdRef = useRef(null);
  const labelmapVolumeRef = useRef(null); // the actual Cornerstone labelmap volume object
  const labelArrayRef = useRef(null); // Uint8Array, one connected-component id per voxel
  const labelDimsRef = useRef(null); // { w, h, d }
  const lesionStatsRef = useRef(null); // Map<label, { voxelCount, volumeCm3 }>
  const nextLesionLabelRef = useRef(0); // highest label index used so far (AI + manual ROIs share the id space)
  const manualLabelsRef = useRef(new Set()); // labels that came from a drawn ROI, not AI — these get a heavier base outline since they're often only 1 voxel thick edge-on
  const growSeedsRef = useRef(new Map());     // manual label -> { seed, fixedAxis, fixedValue, varyingAxes, tolerance } it was grown from
  const volumeScalarsRef = useRef({ volumeId: null, data: null }); // cached voxel values for region growing
  const defaultVoiRef = useRef({});   // viewportId -> voiRange it loaded with (for resetWindow)
  const [orientationByPlane, setOrientationByPlane] = useState({}); // plane key -> edge letters
  const [scaleByPlane, setScaleByPlane] = useState({});             // plane key -> { mmPerPixel, height } for the scale bar
  const [pixelReadout, setPixelReadout] = useState(null);           // { key, value, unit } under the mouse
  const pointerRef = useRef(null);                                  // { key, point } last mouse position on a pane
  const [roiCrossSections, setRoiCrossSections] = useState({});     // plane key -> { bands, labels }
  const manualLabelNumberRef = useRef(new Map()); // internal label -> user-facing "Polygon N" number
  const manualLabelCounterRef = useRef(0); // next "Polygon N" number to hand out
  const rebuildingSegmentationRef = useRef(false); // true while Step 2b is (re)building the AI segmentation — manual draws during this window would land on a volume about to be discarded
  const [selectedLesion, setSelectedLesion] = useState(null); // { label, voxelCount, volumeCm3 }
  const classArrayRef = useRef(null);  // per-voxel class id from the mask colours (see classifyMaskPixel)
  const kToMaskIdxRef = useRef(null);  // volume slice k -> index into maskSlices / maskConfidences
  const maskConfidencesRef = useRef(maskConfidences);
  maskConfidencesRef.current = maskConfidences;
  const maskLegendRef = useRef(maskLegend);
  maskLegendRef.current = maskLegend;
  const colorByClassRef = useRef(colorByClass);
  colorByClassRef.current = colorByClass;
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  const imageIdsPropRef = useRef(imageIds);
  imageIdsPropRef.current = imageIds;
  const onRoisChangeCbRef = useRef(onRoisChange);
  onRoisChangeCbRef.current = onRoisChange;
  const bakeDrawnRegionRef = useRef(null); // the polygon-completed handler — "Grow to 3D" reuses it
  const onRegionsChangeCbRef = useRef(onRegionsChange);
  onRegionsChangeCbRef.current = onRegionsChange;
  const leftToolRef = useRef(leftTool);
  leftToolRef.current = leftTool;

  // pointer: left button does nothing to the image — only grabs crosshair lines / measurements
  const LEFT_TOOLS = { wl: WindowLevelTool.toolName, pan: PanTool.toolName, crosshairs: CrosshairsTool.toolName, pointer: null };
  const applyBindings = (toolGroup = toolGroupRef.current) => {
    if (!toolGroup) return;
    applyHorosMouseBindings(toolGroup, {
      primary: TOOL_MAP[activeToolRef.current]
        ?? (leftToolRef.current in LEFT_TOOLS ? LEFT_TOOLS[leftToolRef.current] : WindowLevelTool.toolName),
      // Crosshair lines stay draggable (Passive) whatever is on the left button
      interactiveTools: [...ALL_ANNOTATION_TOOLS, CrosshairsTool.toolName],
      extraBindings: { [PanTool.toolName]: [{ mouseButton: MouseBindings.Primary, modifierKey: KeyboardBindings.Shift }] },
    });
  };
  const instanceId = useRef(++instanceCounter);
  const arrowTextCbRef = useRef(onArrowTextRequest);
  arrowTextCbRef.current = onArrowTextRequest;
  const maskOpacityRef = useRef(maskOpacity);
  maskOpacityRef.current = maskOpacity;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [engineReady, setEngineReady] = useState(false);
  const [volumeLoaded, setVolumeLoaded] = useState(false);
  const [activePlane, setActivePlaneState] = useState("axial");

  const engineId = `volume-engine-${instanceId.current}`;
  const toolGroupId = `volume-tools-${instanceId.current}`;
  const viewportIdFor = (planeKey) => `volume-viewport-${instanceId.current}-${planeKey}`;
  const viewportIds = PLANES.map(p => viewportIdFor(p.key));

  // Store initial parallelScale (per plane) so we can compute zoom %
  const baseScaleRef = useRef({});

  const activePlaneRef = useRef(activePlane);
  activePlaneRef.current = activePlane;

  const setActivePlane = (planeKey) => {
    if (activePlaneRef.current === planeKey) return;
    activePlaneRef.current = planeKey;
    setActivePlaneState(planeKey);
    onActivePlaneChange?.(planeKey);
  };

  const getVp = (planeKey) => engineRef.current?.getViewport(viewportIdFor(planeKey ?? activePlaneRef.current));
  const getAllVps = () => viewportIds.map(id => engineRef.current?.getViewport(id)).filter(Boolean);

  // Defensive — Crosshairs can end up with stale/partial internal annotation data after
  // annotations are removed or a click/selection interrupts its own interaction lifecycle,
  // which later crashes mouseMoveCallback on the next mouse move. Force it to rebuild its
  // listeners/annotations from scratch rather than chase the exact internal field that broke.
  const reinitializeCrosshairs = () => {
    try {
      const crosshairs = toolGroupRef.current?.getToolInstance(CrosshairsTool.toolName);
      crosshairs?._reinitializeListenersAndCenter?.();
    } catch (err) {
      console.warn("[Crosshairs] reinitialize failed:", err);
    }
  };

  // segmentationStyle.setStyle() only updates the style registry — it does not itself
  // repaint anything. The labelmap actor's opacity/outline only gets recomputed when
  // Cornerstone's segmentation rendering pipeline is told to via this event.
  const refreshSegmentationStyle = (segmentationId) => {
    viewportIds.forEach(viewportId => {
      csSegmentation.triggerSegmentationEvents.triggerSegmentationRepresentationModified(
        viewportId, segmentationId, csToolsEnums.SegmentationRepresentations.Labelmap
      );
    });
  };

  const adjustZoom = (factor) => {
    const vp = getVp();
    if (!vp) return;
    const cam = vp.getCamera();
    if (!cam.parallelScale) return;
    const key = activePlaneRef.current;
    if (!baseScaleRef.current[key]) baseScaleRef.current[key] = cam.parallelScale;
    vp.setCamera({ parallelScale: cam.parallelScale / factor });
    vp.render();
  };

  useImperativeHandle(ref, () => ({
    zoomIn()  { adjustZoom(1.25); },
    zoomOut() { adjustZoom(0.8); },
    resetFit() {
      const vp = getVp();
      if (!vp) return;
      vp.resetCamera();
      vp.render();
      const cam = vp.getCamera();
      baseScaleRef.current[activePlaneRef.current] = cam.parallelScale;
    },
    rotateCW() {
      const vp = getVp();
      if (!vp) return;
      const cam = vp.getCamera();
      const angle = Math.PI / 2;
      const vUp = cam.viewUp;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const vpn = cam.viewPlaneNormal;
      vp.setCamera({
        viewUp: [
          vUp[0] * cos + (vpn[1] * vUp[2] - vpn[2] * vUp[1]) * sin,
          vUp[1] * cos + (vpn[2] * vUp[0] - vpn[0] * vUp[2]) * sin,
          vUp[2] * cos + (vpn[0] * vUp[1] - vpn[1] * vUp[0]) * sin,
        ],
      });
      vp.render();
    },
    rotateCCW() {
      const vp = getVp();
      if (!vp) return;
      const cam = vp.getCamera();
      const angle = -Math.PI / 2;
      const vUp = cam.viewUp;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const vpn = cam.viewPlaneNormal;
      vp.setCamera({
        viewUp: [
          vUp[0] * cos + (vpn[1] * vUp[2] - vpn[2] * vUp[1]) * sin,
          vUp[1] * cos + (vpn[2] * vUp[0] - vpn[0] * vUp[2]) * sin,
          vUp[2] * cos + (vpn[0] * vUp[1] - vpn[1] * vUp[0]) * sin,
        ],
      });
      vp.render();
    },
    flipH() {
      const vp = getVp();
      if (!vp) return;
      const cam = vp.getCamera();
      vp.setCamera({ flipHorizontal: !cam.flipHorizontal });
      vp.render();
    },
    flipV() {
      const vp = getVp();
      if (!vp) return;
      const cam = vp.getCamera();
      vp.setCamera({ flipVertical: !cam.flipVertical });
      vp.render();
    },
    // Window presets apply to all 3 panes together, like Horos's synced MPR. The window
    // each pane loaded with is remembered on first change so "0" can restore it.
    setWindow(center, width) {
      getAllVps().forEach(vp => {
        if (!defaultVoiRef.current[vp.id]) defaultVoiRef.current[vp.id] = vp.getProperties().voiRange;
        vp.setProperties({ voiRange: { lower: center - width / 2, upper: center + width / 2 } });
        vp.render();
      });
    },
    resetWindow() {
      getAllVps().forEach(vp => {
        const voiRange = defaultVoiRef.current[vp.id];
        if (!voiRange) return;
        vp.setProperties({ voiRange });
        vp.render();
      });
    },
    toggleInvert() {
      const vp = getVp();
      if (!vp) return;
      const { invert = false } = vp.getProperties();
      vp.setProperties({ invert: !invert });
      vp.render();
    },
    resetView() {
      const vp = getVp();
      if (vp) { vp.resetCamera(); vp.render(); }
    },
    getProperties() {
      return getVp()?.getProperties() ?? {};
    },
    getZoom() {
      const vp = getVp();
      if (!vp) return 1;
      const cam = vp.getCamera();
      const base = baseScaleRef.current[activePlaneRef.current];
      return base ? (base / cam.parallelScale) : 1;
    },
    deleteSelectedAnnotations() {
      const selected = csAnnotation.selection.getAnnotationsSelected?.() ?? [];
      if (!selected.length) return false;
      let removedAny = false;
      selected.forEach(uid => {
        try {
          // Allowlist, not a blocklist: only delete annotations belonging to our own
          // user-drawable tools. Crosshairs (and anything else internal to Cornerstone,
          // under whatever name/shape it uses) is never touched — deleting one of its
          // annotations previously corrupted its internal state and crashed mouse-move.
          const toolName = csAnnotation.state.getAnnotation(uid)?.metadata?.toolName;
          if (!ALL_ANNOTATION_TOOLS.includes(toolName)) return;
          csAnnotation.state.removeAnnotation(uid);
          removedAny = true;
        } catch (_) {}
      });
      if (removedAny) reinitializeCrosshairs();
      getAllVps().forEach(vp => vp.render());
      return removedAny;
    },
    // ROI list: centre the crosshairs on an ROI's first contour
    focusRoi(name) {
      const roi = roiFirstContour(imageIdsPropRef.current, name);
      const crosshairs = toolGroupRef.current?.getToolInstance(CrosshairsTool.toolName);
      if (!roi || !crosshairs) return;
      try { crosshairs.setToolCenter(roi.centroid); } catch (err) { console.warn("[ROI] couldn't centre on", name, err); }
    },
    // ROI list "Grow to 3D": turn a single-slice contour into a seed and grow it through the
    // slices, exactly like a drawn polygon (the contour itself is replaced by the region)
    growRoi(name) {
      const roi = roiFirstContour(imageIdsPropRef.current, name);
      if (!roi || roi.outline.length < 3) return;
      bakeDrawnRegionRef.current?.({
        detail: {
          annotation: {
            annotationUID: roi.annotation.annotationUID,
            metadata: { toolName: PlanarFreehandROITool.toolName },
            data: { contour: { polyline: roi.outline, closed: true } },
          },
        },
      });
    },
    render() {
      getAllVps().forEach(vp => vp.render());
    },
  }));

  // Step 1: Create engine + 3 synced viewports + tool group on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      await initCornerstone();
      if (cancelled) return;

      const engine = new RenderingEngine(engineId);
      engineRef.current = engine;

      PLANES.forEach(({ key, orientation }) => {
        const element = divRefs.current[key];
        if (!element) return;
        engine.enableElement({
          viewportId: viewportIdFor(key),
          type: Enums.ViewportType.ORTHOGRAPHIC,
          element,
          defaultOptions: { orientation, background: [0, 0, 0] },
        });
      });

      // Create a tool group and bind interaction tools (shared across all 3 panes)
      let toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      if (!toolGroup) {
        toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
      }
      toolGroupRef.current = toolGroup;

      toolGroup.addTool(PanTool.toolName);
      toolGroup.addTool(ZoomTool.toolName);
      toolGroup.addTool(StackScrollTool.toolName);
      toolGroup.addTool(WindowLevelTool.toolName);

      // Annotation / measurement tools — set to Enabled so existing annotations render
      [LengthTool, AngleTool, EllipticalROITool, CircleROITool,
       RectangleROITool, ArrowAnnotateTool, ProbeTool, PlanarFreehandROITool,
       BidirectionalTool, CobbAngleTool, LabelTool,
      ].forEach((T) => {
        toolGroup.addTool(T.toolName);
        toolGroup.setToolEnabled(T.toolName);
      });
      // Pencil: freehand strokes without area stats, kept apart from the named ROIs
      toolGroup.addToolInstance(PENCIL_TOOL_NAME, PlanarFreehandROITool.toolName, { calculateStats: false });
      toolGroup.setToolEnabled(PENCIL_TOOL_NAME);

      // ROI name as the first line of each area contour's label, as in the 2D viewer
      AREA_ROI_TOOL_NAMES.forEach(name => {
        const tool = toolGroup.getToolInstance(name);
        const baseTextLines = tool?.configuration?.getTextLines;
        if (!baseTextLines) return;
        tool.configuration.getTextLines = (data, targetId) => [
          ...(data.label ? [data.label] : []),
          ...(baseTextLines(data, targetId) ?? []),
        ];
      });

      viewportIds.forEach(id => toolGroup.addViewport(id, engineId));

      // Crosshairs — links the 3 panes: dragging in one pane reslices the other two.
      const colorByViewportId = PLANES.reduce((acc, p) => {
        acc[viewportIdFor(p.key)] = p.color;
        return acc;
      }, {});
      toolGroup.addTool(CrosshairsTool.toolName, {
        getReferenceLineColor: (viewportId) => colorByViewportId[viewportId] ?? "#0694FB",
        getReferenceLineControllable: () => true,
        getReferenceLineDraggableRotatable: () => true,
        getReferenceLineSlabThicknessControlsOn: () => false,
      });

      // Horos mouse layout: left = W/L (or the chosen tool), Shift+left / middle = pan,
      // right = zoom, wheel = scroll slices. Crosshair lines stay draggable throughout.
      applyBindings(toolGroup);
      toolGroup.setToolActive(StackScrollTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Wheel }],
      });

      // Arrow and text labels ask for their text in the app's own dialog, not prompt() —
      // when drawn, and when double-clicked to edit (pre-filled with the current text)
      [ArrowAnnotateTool, LabelTool].map(T => toolGroup.getToolInstance(T.toolName)).filter(Boolean).forEach(textTool => {
        textTool.configuration.getTextCallback = (doneChangingTextCallback) => {
          if (arrowTextCbRef.current) {
            arrowTextCbRef.current(doneChangingTextCallback);
          } else {
            doneChangingTextCallback(prompt("Enter your annotation:"));
          }
        };
        textTool.configuration.changeTextCallback = (annotation, _evt, doneChangingTextCallback) => {
          const current = annotation?.data?.label ?? "";
          if (arrowTextCbRef.current) {
            arrowTextCbRef.current(doneChangingTextCallback, current);
          } else {
            doneChangingTextCallback(prompt("Edit your annotation:", current) ?? current);
          }
        };
      });

      if (!cancelled) setEngineReady(true);
    })();

    return () => {
      cancelled = true;
      if (segmentationIdRef.current) {
        try { csSegmentation.removeSegmentation(segmentationIdRef.current); } catch (_) {}
        segmentationIdRef.current = null;
      }
      ToolGroupManager.destroyToolGroup(toolGroupId);
      toolGroupRef.current = null;
      engineRef.current?.destroy();
      engineRef.current = null;
      setEngineReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 2: Load volume once engine is ready and imageIds are available — shared by all 3 panes
  useEffect(() => {
    if (!engineReady) return;
    if (!imageIds || imageIds.length < 2) return;
    const engine = engineRef.current;
    if (!engine) return;

    let cancelled = false;
    const volumeId = `cornerstoneStreamingImageVolume:vol-${instanceId.current}-${Date.now()}`;

    (async () => {
      setLoading(true);
      setError(null);
      setProgress(0);
      setVolumeLoaded(false);

      try {
        // Pass a copy — for wadouri ids Cornerstone reverses the array it's given in place,
        // which would silently flip our imageIds prop (and the mask-to-slice mapping with it).
        const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds: [...imageIds] });
        volumeIdRef.current = volumeId;

        if (cancelled) return;

        await volume.load((evt) => {
          if (cancelled) return;
          if (evt?.loaded != null && evt?.total) {
            setProgress(Math.round((evt.loaded / evt.total) * 100));
          }
        });

        if (cancelled) return;

        await setVolumesForViewports(engine, [{ volumeId }], viewportIds);
        defaultVoiRef.current = {}; // new volume — forget the previous one's windows

        if (cancelled) return;

        getAllVps().forEach(vp => vp.resetCamera());
        engine.renderViewports(viewportIds);
        if (!cancelled) setVolumeLoaded(true);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load volume");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineReady, imageIds]);

  // Step 2b: Build a 3D labelmap volume from the per-slice segmentation masks so the
  // mask gets resliced along with the DICOM volume on all 3 panes (not just drawn flat on one).
  useEffect(() => {
    if (!volumeLoaded) return;
    const engine = engineRef.current;
    const mainVolumeId = volumeIdRef.current;
    if (!engine || !mainVolumeId) return;

    // Inference results can come back with slightly fewer slices than the volume
    // (e.g. a model that skips an edge slice) — same as the 2D overlay, just leave
    // whichever slice(s) fall outside the mask array blank rather than bailing out.
    if (Array.isArray(maskSlices) && maskSlices.length !== imageIds.length) {
      console.warn(`[MPR mask] slice count mismatch — ${maskSlices.length} masks vs ${imageIds.length} volume slices; mapping by index, extra slices left blank.`);
    }

    const hasMasks = Array.isArray(maskSlices) && maskSlices.length > 0 && maskSlices.some(Boolean);

    if (!hasMasks) {
      if (segmentationIdRef.current) {
        // The drawn regions share the AI layer — rebuild them from their outlines after it goes
        const drawn = listDrawnRegions();
        try { csSegmentation.removeSegmentation(segmentationIdRef.current); } catch (_) {}
        segmentationIdRef.current = null;
        labelmapVolumeRef.current = null;
        labelArrayRef.current = null;
        labelDimsRef.current = null;
        lesionStatsRef.current = null;
        nextLesionLabelRef.current = 0;
        manualLabelsRef.current = new Set();
        growSeedsRef.current = new Map();
        manualLabelNumberRef.current = new Map();
        manualLabelCounterRef.current = 0;
        setSelectedLesion(null);
        drawn.forEach(region => bakeOutlineRegion(region.outline, region));
        getAllVps().forEach(vp => vp.render());
      }
      return;
    }

    let cancelled = false;

    (async () => {
      rebuildingSegmentationRef.current = true;
      // Snapshot whatever manual ROIs exist before this rebuild starts, so they can be
      // carried forward into the new labelmap instead of silently disappearing.
      const priorLabelArray = labelArrayRef.current;
      const priorManualLabels = manualLabelsRef.current;
      const priorGrowSeeds = growSeedsRef.current;
      const priorLesionStats = lesionStatsRef.current;
      const priorManualLabelNumbers = manualLabelNumberRef.current;
      try {
        if (segmentationIdRef.current) {
          try { csSegmentation.removeSegmentation(segmentationIdRef.current); } catch (_) {}
          segmentationIdRef.current = null;
        }

        const labelmapVolumeId = `labelmap-${instanceId.current}-${Date.now()}`;
        const labelmapVolume = volumeLoader.createAndCacheDerivedLabelmapVolume(mainVolumeId, { volumeId: labelmapVolumeId });
        const [w, h, d] = labelmapVolume.dimensions;

        // maskSlices follows the imageIds prop (InstanceNumber order), but Cornerstone
        // re-sorts the volume's slices by ImagePositionPatient — so map each mask to
        // the volume slice that holds its imageId, not to the same array index.
        const volumeImageIds = csCache.getVolume(mainVolumeId)?.imageIds || imageIds;
        const maskIndexByImageId = new Map(imageIds.map((id, i) => [id, i]));

        const scalarData = new Uint8Array(w * h * d);
        const kToMaskIdx = new Array(d);
        let decodedAny = false;
        for (let k = 0; k < d; k++) {
          if (cancelled) return;
          const maskIdx = maskIndexByImageId.get(volumeImageIds[k]) ?? k;
          kToMaskIdx[k] = maskIdx;
          const src = maskSlices[maskIdx];
          if (!src) continue;
          const labels = await decodeMaskToLabels(src, w, h, maskLegendRef.current);
          if (cancelled) return;
          if (labels) {
            scalarData.set(labels, k * w * h);
            decodedAny = true;
          }
        }
        if (cancelled) return;

        if (!decodedAny) {
          console.warn("[MPR mask] none of the mask slices decoded successfully — no segmentation volume built.");
          return;
        }

        // Give each connected blob its own id/color so individual findings can be
        // clicked and measured separately, instead of one flat binary mask. Anatomy
        // results are split by structure instead (see labelByClass).
        const { labels: componentLabels, stats: lesionStats } = colorByClassRef.current
          ? labelByClass(scalarData, w, h, d, labelmapVolume.spacing)
          : labelConnectedComponents(scalarData, w, h, d, labelmapVolume.spacing);

        // Carry forward any manually-drawn ROIs from before this rebuild — otherwise a
        // model switch silently wipes everything the user drew. AI voxels win where the
        // footprints overlap (it's the fresh/authoritative result for this model).
        const carriedManualLabels = new Set();
        const carriedManualLabelNumbers = new Map();
        const carriedGrowSeeds = new Map();
        if (priorLabelArray && priorManualLabels?.size && priorLabelArray.length === componentLabels.length) {
          const remap = new Map(); // old label -> new label
          let nextLabel = Math.max(0, ...lesionStats.keys());
          for (let voxelIdx = 0; voxelIdx < priorLabelArray.length; voxelIdx++) {
            const oldLabel = priorLabelArray[voxelIdx];
            if (!oldLabel || !priorManualLabels.has(oldLabel) || componentLabels[voxelIdx] !== 0) continue;
            let newLabel = remap.get(oldLabel);
            if (newLabel === undefined) {
              if (nextLabel >= 254) continue;
              nextLabel += 1;
              newLabel = nextLabel;
              remap.set(oldLabel, newLabel);
              const stat = priorLesionStats?.get(oldLabel);
              if (stat) lesionStats.set(newLabel, stat);
              carriedManualLabels.add(newLabel);
              const polygonNumber = priorManualLabelNumbers?.get(oldLabel);
              if (polygonNumber != null) carriedManualLabelNumbers.set(newLabel, polygonNumber);
              const growSeed = priorGrowSeeds?.get(oldLabel);
              if (growSeed) carriedGrowSeeds.set(newLabel, growSeed);
            }
            componentLabels[voxelIdx] = newLabel;
          }
        }

        labelmapVolumeRef.current = labelmapVolume;
        labelArrayRef.current = componentLabels;
        classArrayRef.current = scalarData;
        kToMaskIdxRef.current = kToMaskIdx;
        labelDimsRef.current = { w, h, d };
        lesionStatsRef.current = lesionStats;
        manualLabelNumberRef.current = carriedManualLabelNumbers; // manualLabelCounterRef is left as-is so future polygons keep counting up
        nextLesionLabelRef.current = Math.max(0, ...lesionStats.keys(), ...carriedManualLabels);
        manualLabelsRef.current = carriedManualLabels;
        growSeedsRef.current = carriedGrowSeeds;
        setSelectedLesion(null);

        labelmapVolume.voxelManager.setCompleteScalarDataArray(componentLabels);

        const segmentationId = `segmentation-${instanceId.current}-${Date.now()}`;

        // Set the style BEFORE adding representations, so the very first render already
        // reflects the current opacity instead of Cornerstone's built-in default.
        csSegmentation.segmentationStyle.setStyle(
          { segmentationId, type: csToolsEnums.SegmentationRepresentations.Labelmap },
          { renderFill: true, fillAlpha: maskOpacity, renderOutline: true, outlineWidth: 1, outlineOpacity: 1 }
        );

        csSegmentation.addSegmentations([{
          segmentationId,
          representation: {
            type: csToolsEnums.SegmentationRepresentations.Labelmap,
            data: { volumeId: labelmapVolumeId },
          },
        }]);

        viewportIds.forEach(viewportId => {
          csSegmentation.addSegmentationRepresentations(viewportId, [{
            segmentationId,
            type: csToolsEnums.SegmentationRepresentations.Labelmap,
          }]);
        });

        // AI findings take the 2D overlay's colour — per structure for anatomy results,
        // one orange-red otherwise; manual ROIs keep their own.
        const legend = maskLegendRef.current;
        const colorFor = (label) => {
          if (carriedManualLabels.has(label)) return MANUAL_ROI_COLOR;
          const rgb = colorByClassRef.current && legend?.[label - 1]?.rgb;
          return rgb ? [...rgb, 255] : AI_FINDING_COLOR;
        };
        viewportIds.forEach(viewportId => {
          lesionStats.forEach((_, label) => {
            csSegmentation.config.color.setSegmentIndexColor(viewportId, segmentationId, label, colorFor(label));
          });
        });

        // Carried-forward manual ROIs lost their per-segment style when the old
        // segmentationId was removed — give them back their heavier outline.
        carriedManualLabels.forEach(label => {
          csSegmentation.segmentationStyle.setStyle(
            { segmentationId, type: csToolsEnums.SegmentationRepresentations.Labelmap, segmentIndex: label },
            { outlineWidth: 3, outlineOpacity: 1 }, false
          );
        });
        if (carriedManualLabels.size) {
          console.log(`[Manual ROI] carried ${carriedManualLabels.size} manual region(s) forward into the new segmentation.`);
        }

        if (!cancelled) {
          segmentationIdRef.current = segmentationId;
        }
      } catch (err) {
        console.error("[MPR mask] failed to build segmentation volume:", err);
      } finally {
        rebuildingSegmentationRef.current = false;
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volumeLoaded, maskSlices]);

  // Step 2c: Live opacity updates without rebuilding the labelmap volume
  useEffect(() => {
    const segmentationId = segmentationIdRef.current;
    if (!segmentationId) return;
    csSegmentation.segmentationStyle.setStyle(
      { segmentationId, type: csToolsEnums.SegmentationRepresentations.Labelmap },
      { fillAlpha: maskOpacity }
    );
    refreshSegmentationStyle(segmentationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maskOpacity]);

  // Step 2d: Outline the selected lesion a bit heavier than the rest so it reads as "picked"
  const prevSelectedLabelRef = useRef(null);
  useEffect(() => {
    const segmentationId = segmentationIdRef.current;
    if (!segmentationId) return;
    // merge: false — a per-segment override must stay sparse (just outlineWidth).
    // The default merge:true snapshots the FULL current style (incl. fillAlpha) into
    // the per-segment bucket, which then permanently shadows the opacity slider for
    // any lesion that's ever been selected.
    const prevLabel = prevSelectedLabelRef.current;
    if (prevLabel != null && prevLabel !== selectedLesion?.label) {
      // Revert to each segment's own baseline, not a flat 1 — manual ROIs keep their
      // heavier default outline (they're often only 1 voxel thick edge-on) when deselected.
      const baseOutlineWidth = manualLabelsRef.current.has(prevLabel) ? 3 : 1;
      csSegmentation.segmentationStyle.setStyle(
        { segmentationId, type: csToolsEnums.SegmentationRepresentations.Labelmap, segmentIndex: prevLabel },
        { outlineWidth: baseOutlineWidth, outlineOpacity: 1 }, false
      );
    }
    if (selectedLesion) {
      // Deliberately heavy — this needs to read as "selected" at a glance in all 3 panes.
      csSegmentation.segmentationStyle.setStyle(
        { segmentationId, type: csToolsEnums.SegmentationRepresentations.Labelmap, segmentIndex: selectedLesion.label },
        { outlineWidth: 6, outlineOpacity: 1 }, false
      );
    }
    prevSelectedLabelRef.current = selectedLesion?.label ?? null;
    refreshSegmentationStyle(segmentationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLesion]);

  // Bakes a drawn outline (world points) into the segmentation volume as its own region,
  // grown from it through the neighbouring slices. Used for a freshly drawn polygon, for
  // restoring saved regions, and for rebuilding them after the AI layer is cleared.
  // Returns { label, voxelCount, volumeCm3, centroidWorld }, or null if nothing was baked.
  // savedVoxelCount: the region's size when it was saved — regrown on different images (a
  // re-uploaded or changed series) it can come out another size, and the popup says so.
  const bakeOutlineRegion = (polyline, { uid: regionUid = uid(), tolerance = DEFAULT_GROW_TOLERANCE, number = null, voxelCount: savedVoxelCount = null } = {}) => {
    const mainVolumeId = volumeIdRef.current;
    const mainVolume = csCache.getVolume(mainVolumeId);
    if (!mainVolume?.imageData) return null;

    // Reuse the existing segmentation volume if one exists (from AI masks or an
    // earlier manual ROI); otherwise create an empty one just for manual ROIs.
    let labelmapVolume = labelmapVolumeRef.current;
    let segmentationId = segmentationIdRef.current;
    let dims = labelDimsRef.current;

    if (!labelmapVolume || !dims) {
      const [w, h, d] = mainVolume.dimensions;
      dims = { w, h, d };
      const labelmapVolumeId = `labelmap-${instanceId.current}-${Date.now()}`;
      labelmapVolume = volumeLoader.createAndCacheDerivedLabelmapVolume(mainVolumeId, { volumeId: labelmapVolumeId });
      labelArrayRef.current = new Uint8Array(w * h * d);
      labelDimsRef.current = dims;
      lesionStatsRef.current = new Map();
      nextLesionLabelRef.current = 0;
      manualLabelsRef.current = new Set();
      growSeedsRef.current = new Map();
      manualLabelNumberRef.current = new Map();
      manualLabelCounterRef.current = 0;
      labelmapVolumeRef.current = labelmapVolume;

      segmentationId = `segmentation-${instanceId.current}-${Date.now()}`;
      csSegmentation.segmentationStyle.setStyle(
        { segmentationId, type: csToolsEnums.SegmentationRepresentations.Labelmap },
        { renderFill: true, fillAlpha: maskOpacityRef.current, renderOutline: true, outlineWidth: 1, outlineOpacity: 1 }
      );
      csSegmentation.addSegmentations([{
        segmentationId,
        representation: { type: csToolsEnums.SegmentationRepresentations.Labelmap, data: { volumeId: labelmapVolumeId } },
      }]);
      viewportIds.forEach(viewportId => {
        csSegmentation.addSegmentationRepresentations(viewportId, [{ segmentationId, type: csToolsEnums.SegmentationRepresentations.Labelmap }]);
      });
      segmentationIdRef.current = segmentationId;
    }

    const { w, h, d } = dims;
    const volDims = [w, h, d];

    // Convert the drawn polygon's world points to continuous voxel indices, then
    // find which axis barely varies across them — that's the slice it was drawn on.
    const idxPoints = polyline.map(pt => mainVolume.imageData.worldToIndex(pt));
    const axisVariance = [0, 1, 2].map(axis => {
      const vals = idxPoints.map(p => p[axis]);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      return vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    });
    const fixedAxis = axisVariance.indexOf(Math.min(...axisVariance));
    const varyingAxes = [0, 1, 2].filter(a => a !== fixedAxis);
    const fixedValue = Math.round(idxPoints.reduce((a, p) => a + p[fixedAxis], 0) / idxPoints.length);
    if (fixedValue < 0 || fixedValue >= volDims[fixedAxis]) return null;

    const poly2d = idxPoints.map(p => [p[varyingAxes[0]], p[varyingAxes[1]]]);
    const minA = Math.max(0, Math.floor(Math.min(...poly2d.map(p => p[0]))));
    const maxA = Math.min(volDims[varyingAxes[0]] - 1, Math.ceil(Math.max(...poly2d.map(p => p[0]))));
    const minB = Math.max(0, Math.floor(Math.min(...poly2d.map(p => p[1]))));
    const maxB = Math.min(volDims[varyingAxes[1]] - 1, Math.ceil(Math.max(...poly2d.map(p => p[1]))));

    if (nextLesionLabelRef.current >= 254) {
      console.warn("[Manual ROI] segment limit reached — cannot add another region.");
      return null;
    }
    nextLesionLabelRef.current += 1;
    const label = nextLesionLabelRef.current;

    // The drawn outline is the seed; the region then grows from it through the
    // neighbouring slices (growManualRegion) so the volume is the whole structure.
    const coord = [0, 0, 0];
    const seed = [];
    let sumA = 0, sumB = 0;
    for (let a = minA; a <= maxA; a++) {
      for (let b = minB; b <= maxB; b++) {
        if (!pointInPolygon2D(a + 0.5, b + 0.5, poly2d)) continue;
        seed.push([a, b]);
        sumA += a;
        sumB += b;
      }
    }
    coord[fixedAxis] = fixedValue; // the drawn slice, for the centroid below
    if (!seed.length) {
      nextLesionLabelRef.current -= 1; // nothing landed inside the volume — give the label back
      return null;
    }

    // outline + uid are what's saved (see onRegionsChange); the seed is rebuilt from the outline
    const outline = polyline.map(pt => [pt[0], pt[1], pt[2]]);
    const growInfo = { seed, fixedAxis, fixedValue, varyingAxes, tolerance, outline, uid: regionUid };
    growSeedsRef.current.set(label, growInfo);
    const { voxelCount, volumeCm3 } = growManualRegion(label, growInfo);
    if (savedVoxelCount > 0 && Math.abs(voxelCount - savedVoxelCount) > Math.max(5, savedVoxelCount * 0.01)) {
      growInfo.savedVoxelCount = savedVoxelCount;
    }
    manualLabelsRef.current.add(label);
    const polygonNumber = number ?? manualLabelCounterRef.current + 1;
    manualLabelCounterRef.current = Math.max(manualLabelCounterRef.current, polygonNumber);
    manualLabelNumberRef.current.set(label, polygonNumber);

    // A region drawn on one plane is only 1 voxel thick along its normal — from the
    // other 2 panes you're slicing it edge-on, so it's genuinely a thin line, not a
    // blob. Rather than fake extra thickness, give it a heavier outline (fill alpha
    // stays on the shared opacity slider — see the merge:false note in Step 2d) so
    // that thin line still reads clearly instead of disappearing into antialiasing.
    csSegmentation.segmentationStyle.setStyle(
      { segmentationId, type: csToolsEnums.SegmentationRepresentations.Labelmap, segmentIndex: label },
      { outlineWidth: 3, outlineOpacity: 1 }, false
    );
    viewportIds.forEach(viewportId => {
      csSegmentation.config.color.setSegmentIndexColor(viewportId, segmentationId, label, MANUAL_ROI_COLOR);
    });

    console.log(`[Manual ROI] baked ${voxelCount} voxels as label ${label} (${volumeCm3.toFixed(2)} cm³) into segmentation ${segmentationId}`);

    // Centroid of the filled voxels (not just the last one visited), used both to
    // position the popover and to recenter the crosshairs on the new region.
    let centroidWorld = null;
    try {
      const centroidCoord = [...coord];
      centroidCoord[varyingAxes[0]] = Math.round(sumA / seed.length);
      centroidCoord[varyingAxes[1]] = Math.round(sumB / seed.length);
      centroidWorld = mainVolume.imageData.indexToWorld(centroidCoord);
    } catch (err) {
      console.warn("[Manual ROI] couldn't compute centroid world position:", err);
    }
    return { label, voxelCount, volumeCm3, centroidWorld };
  };

  // The drawn regions as saved with the series' measurements: { uid, outline, tolerance, number, voxelCount }.
  // A region that regrew to a different size keeps its saved size (and the popup's note)
  // until it's adjusted.
  const listDrawnRegions = () => [...growSeedsRef.current]
    .filter(([label, info]) => manualLabelsRef.current.has(label) && info.outline)
    .map(([label, info]) => ({
      uid: info.uid, outline: info.outline, tolerance: info.tolerance, number: manualLabelNumberRef.current.get(label) ?? null,
      voxelCount: info.savedVoxelCount ?? lesionStatsRef.current?.get(label)?.voxelCount ?? null,
    }));
  const reportRegions = () => onRegionsChangeCbRef.current?.(listDrawnRegions());

  // Step 2f: Put saved regions back once the volume is in (after any AI layer has been
  // built, since that rebuild would discard them). Regions already here are skipped by
  // uid, so this is safe to re-run whenever the saved list changes.
  useEffect(() => {
    if (!volumeLoaded || !savedRegions?.length) return;
    let timer = null;
    const restore = () => {
      if (rebuildingSegmentationRef.current) { timer = setTimeout(restore, 200); return; }
      const present = new Set([...growSeedsRef.current.values()].map(info => info.uid));
      let restored = 0;
      savedRegions.forEach(region => {
        if (present.has(region.uid) || !(region.outline?.length >= 3)) return;
        if (bakeOutlineRegion(region.outline, region)) restored++;
      });
      if (restored) getAllVps().forEach(vp => vp.render());
    };
    restore();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volumeLoaded, savedRegions]);

  // Step 2e: Completing a polygon ROI bakes it into the segmentation volume (as its own
  // region) instead of staying a flat 2D annotation — so it reslices across all 3 panes
  // too, and gets a volume via the exact same connected-component/popover machinery as
  // an AI finding. Works whether or not an AI segmentation already exists.
  useEffect(() => {
    const handleAnnotationCompleted = (evt) => {
      const annotation = evt.detail?.annotation;
      if (!annotation || annotation.metadata?.toolName !== PlanarFreehandROITool.toolName) return;
      if (!annotation.data?.contour?.closed) return;
      const polyline = annotation.data.contour.polyline;
      if (!polyline || polyline.length < 3) return;

      if (rebuildingSegmentationRef.current) {
        // An AI segmentation rebuild is in flight (e.g. switching models) — the volume
        // this would bake into is about to be discarded and replaced. Drop it rather
        // than silently losing it into a labelmap that's seconds from being thrown away.
        console.warn("[Manual ROI] a segmentation is still loading — try drawing again in a moment.");
        return;
      }

      try {
        const region = bakeOutlineRegion(polyline);
        if (!region) return;
        const { label, voxelCount, volumeCm3, centroidWorld } = region;

        // This annotation is now redundant — its shape lives in the segmentation volume
        // and renders (correctly) in all 3 panes, so the flat 2D outline would just be a
        // second, out-of-sync copy visible only in the pane it was drawn in. Isolated in
        // its own try — a failure here must not block the recenter/popover below.
        try {
          csAnnotation.state.removeAnnotation(annotation.annotationUID);
        } catch (err) {
          console.warn("[Manual ROI] couldn't remove the source annotation:", err);
        }

        // Drawing a polygon hands Primary to the ROI tool, so Crosshairs never got to jump
        // here — the other 2 panes are likely still parked on an unrelated slice. Move them.
        if (centroidWorld) {
          try {
            const crosshairs = toolGroupRef.current?.getToolInstance(CrosshairsTool.toolName);
            if (!crosshairs) {
              console.warn("[Manual ROI] no CrosshairsTool instance on the tool group — can't recenter.");
            } else {
              crosshairs.setToolCenter(centroidWorld);
              console.log("[Manual ROI] recentred crosshairs to", centroidWorld);

              // The first drawn region creates the segmentation layer, which adds a labelmap
              // actor to each pane asynchronously — and Viewport.addActors resets each camera
              // and restores a view saved before this recentre, so the move is lost. Re-apply
              // it once those actors are in (later regions reuse the layer; nothing fires).
              const panes = PLANES.map(({ key }) => divRefs.current[key]).filter(Boolean);
              const reapply = () => {
                try { crosshairs.setToolCenter(centroidWorld); } catch (_) {}
              };
              panes.forEach(el => el.addEventListener(Enums.Events.ACTORS_CHANGED, reapply));
              setTimeout(() => panes.forEach(el => el.removeEventListener(Enums.Events.ACTORS_CHANGED, reapply)), 3000);
            }
          } catch (err) {
            console.warn("[Manual ROI] setToolCenter failed:", err);
          }
        }

        // Surface the new region's volume right away, same popover as a clicked finding.
        try {
          const stat = lesionStatsRef.current.get(label) ?? { voxelCount, volumeCm3 };
          const anchor = centroidWorld && { plane: activePlaneRef.current, world: centroidWorld };
          const pos = anchor && popoverPosition(anchor);
          if (pos) {
            setSelectedLesion(buildSelectedLesion(label, stat, { ...pos, anchor }));
          } else {
            setSelectedLesion(buildSelectedLesion(label, stat, { x: 110, y: 44 }));
          }
        } catch (err) {
          console.warn("[Manual ROI] couldn't position the popover:", err);
          setSelectedLesion(buildSelectedLesion(label, lesionStatsRef.current.get(label) ?? { voxelCount, volumeCm3 }, { x: 110, y: 44 }));
        }

        getAllVps().forEach(vp2 => vp2.render());
        reportRegions();
      } catch (err) {
        console.error("[Manual ROI] failed to bake polygon into segmentation:", err);
      }
    };

    bakeDrawnRegionRef.current = handleAnnotationCompleted;
    csEventTarget.addEventListener(csToolsEnums.Events.ANNOTATION_COMPLETED, handleAnnotationCompleted);
    return () => csEventTarget.removeEventListener(csToolsEnums.Events.ANNOTATION_COMPLETED, handleAnnotationCompleted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manually-drawn ROIs are "Polygon N" (yours, deletable); AI findings stay "Finding N" (read-only).
  // AI findings also carry the model's confidence (mean over the slices the finding spans,
  // same per-slice numbers the 2D card shows) and the predicted region type at the click.
  const buildSelectedLesion = (label, stat, pos, regionName = null) => {
    const isManual = manualLabelsRef.current.has(label);
    let confidence = null;
    const confidences = maskConfidencesRef.current;
    const kToMaskIdx = kToMaskIdxRef.current;
    if (!isManual && confidences && kToMaskIdx && stat.kMin != null) {
      let sum = 0;
      let n = 0;
      for (let k = stat.kMin; k <= stat.kMax; k++) {
        const c = confidences[kToMaskIdx[k]];
        if (c != null) { sum += c; n++; }
      }
      if (n) confidence = sum / n;
    }
    return {
      label,
      ...stat,
      ...pos,
      isManual,
      polygonNumber: isManual ? manualLabelNumberRef.current.get(label) : null,
      savedVoxelCount: isManual ? growSeedsRef.current.get(label)?.savedVoxelCount ?? null : null,
      confidence,
      regionName: isManual ? null : regionName,
      // Anatomy segment = one whole structure, so its name is the title, not a detail
      isStructure: !isManual && colorByClassRef.current,
    };
  };

  // Click (mousedown) hit-test — identifies which connected lesion, if any, sits under the
  // click and reports its volume. Doesn't interfere with Crosshairs' own jump-on-click behavior.
  const handlePaneClick = (planeKey) => (e) => {
    setActivePlane(planeKey);
    const labelArray = labelArrayRef.current;
    const dims = labelDimsRef.current;
    if (!labelArray || !dims) return;

    const vp = getVp(planeKey);
    const mainVolume = csCache.getVolume(volumeIdRef.current);
    if (!vp || !mainVolume?.imageData) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const canvasPos = [e.clientX - rect.left, e.clientY - rect.top];
    let worldPos;
    try {
      worldPos = vp.canvasToWorld(canvasPos);
    } catch (_) {
      return;
    }
    const [i, j, k] = mainVolume.imageData.worldToIndex(worldPos).map(Math.round);
    const { w, h, d } = dims;
    if (i < 0 || i >= w || j < 0 || j >= h || k < 0 || k >= d) {
      setSelectedLesion(null);
      return;
    }

    const voxelIdx = k * w * h + j * w + i;
    const label = labelArray[voxelIdx];
    if (!label) {
      setSelectedLesion(null);
      return;
    }
    const classId = classArrayRef.current?.[voxelIdx];
    const regionName = classId ? maskLegendRef.current?.[classId - 1]?.name ?? null : null;
    const stat = lesionStatsRef.current?.get(label);
    if (!stat) {
      setSelectedLesion(null);
      return;
    }

    // Popover at the click point; anchored there, so it follows when the panes resize
    const anchor = { plane: planeKey, world: worldPos };
    const pos = popoverPosition(anchor) ?? { x: e.clientX, y: e.clientY };
    setSelectedLesion(buildSelectedLesion(label, stat, { ...pos, anchor }, regionName));
  };

  // Where the region popover goes for a point on a pane, relative to the whole 3-pane grid
  // (clamped so it doesn't render off the edge of the grid), or null if it can't be placed
  function popoverPosition({ plane, world }) {
    const vp = getVp(plane);
    const containerRect = containerRef.current?.getBoundingClientRect();
    const paneRect = divRefs.current[plane]?.getBoundingClientRect();
    if (!vp || !containerRect || !paneRect) return null;
    const [cx, cy] = vp.worldToCanvas(world);
    const halfCardW = 110;
    return {
      x: Math.min(Math.max(paneRect.left - containerRect.left + cx, halfCardW), containerRect.width - halfCardW),
      y: Math.max(paneRect.top - containerRect.top + cy, 44),
    };
  }

  // Erases a manually-drawn region from the segmentation entirely. AI findings aren't
  // deletable this way — they're not yours to remove, only to inspect.
  // The volume's voxel values, fetched once per volume (copying them is expensive).
  const getVolumeScalars = (volume) => {
    if (volumeScalarsRef.current.volumeId !== volume.volumeId) {
      volumeScalarsRef.current = { volumeId: volume.volumeId, data: volume.voxelManager.getCompleteScalarDataArray() };
    }
    return volumeScalarsRef.current.data;
  };

  // (Re)grows a drawn region from its seed outline through neighbouring slices (see
  // lib/regionGrow) and writes it into the labelmap. Returns its updated stats.
  const growManualRegion = (label, info) => {
    const mainVolume = csCache.getVolume(volumeIdRef.current);
    const labelArray = labelArrayRef.current;
    const labelmapVolume = labelmapVolumeRef.current;
    const dims = labelDimsRef.current;
    if (!mainVolume || !labelArray || !labelmapVolume || !dims) return null;
    const { w, h, d } = dims;
    const volDims = [w, h, d];

    for (let idx = 0; idx < labelArray.length; idx++) {
      if (labelArray[idx] === label) labelArray[idx] = 0; // drop the previous growth
    }
    const { voxels, sliceMin, sliceMax } = growRegionThroughSlices({
      scalars: getVolumeScalars(mainVolume),
      dims: volDims,
      seed: info.seed,
      fixedAxis: info.fixedAxis,
      fixedValue: info.fixedValue,
      varyingAxes: info.varyingAxes,
      tolerance: info.tolerance,
      isFree: (idx) => labelArray[idx] === 0 || labelArray[idx] === label,
    });
    voxels.forEach(idx => { labelArray[idx] = label; });

    // Render-only padding for a region that didn't grow: a 1-voxel-thick slab's world
    // position, round-tripped through world<->index transforms, can land the GPU's slice
    // sample half a voxel off and make it invisible from the other planes. Writing it onto
    // the neighbouring slices too avoids that without changing the counted volume.
    const sliceCount = sliceMax - sliceMin + 1;
    if (sliceCount === 1) {
      const coord = [0, 0, 0];
      info.seed.forEach(([a, b]) => {
        [info.fixedValue - 1, info.fixedValue + 1].forEach(f => {
          if (f < 0 || f >= volDims[info.fixedAxis]) return;
          coord[info.varyingAxes[0]] = a;
          coord[info.varyingAxes[1]] = b;
          coord[info.fixedAxis] = f;
          const idx = coord[2] * w * h + coord[1] * w + coord[0];
          if (labelArray[idx] === 0) labelArray[idx] = label;
        });
      });
    }

    const spacing = labelmapVolume.spacing;
    const stat = {
      voxelCount: voxels.length,
      volumeCm3: voxels.length * ((spacing[0] * spacing[1] * spacing[2]) / 1000),
      sliceCount,
    };
    lesionStatsRef.current.set(label, stat);
    labelmapVolume.voxelManager.setCompleteScalarDataArray(labelArray);
    csSegmentation.triggerSegmentationEvents.triggerSegmentationDataModified(segmentationIdRef.current);
    return stat;
  };

  // Popup −/+ : regrow the selected drawn region with a tighter/looser intensity window
  const adjustGrowTolerance = (label, delta) => {
    const info = growSeedsRef.current.get(label);
    if (!info) return;
    const tolerance = Math.min(MAX_GROW_TOLERANCE, Math.max(MIN_GROW_TOLERANCE, info.tolerance + delta));
    if (tolerance === info.tolerance) return;
    info.tolerance = tolerance;
    delete info.savedVoxelCount; // adjusted on these images: this is its size now
    const stat = growManualRegion(label, info);
    if (!stat) return;
    setSelectedLesion(prev => (prev?.label === label ? { ...prev, ...stat, savedVoxelCount: null } : prev));
    getAllVps().forEach(vp => vp.render());
    reportRegions();
  };

  const deleteManualLesion = (label) => {
    if (!manualLabelsRef.current.has(label)) return;
    const labelArray = labelArrayRef.current;
    const segmentationId = segmentationIdRef.current;
    const labelmapVolume = labelmapVolumeRef.current;
    if (!labelArray || !segmentationId || !labelmapVolume) return;

    for (let idx = 0; idx < labelArray.length; idx++) {
      if (labelArray[idx] === label) labelArray[idx] = 0;
    }
    lesionStatsRef.current?.delete(label);
    manualLabelsRef.current.delete(label);
    manualLabelNumberRef.current.delete(label);
    growSeedsRef.current.delete(label);

    labelmapVolume.voxelManager.setCompleteScalarDataArray(labelArray);
    csSegmentation.triggerSegmentationEvents.triggerSegmentationDataModified(segmentationId);

    setSelectedLesion(prev => (prev?.label === label ? null : prev));
    reinitializeCrosshairs();
    getAllVps().forEach(vp => vp.render());
    reportRegions();
  };

  // Delete/Backspace deletes the selected polygon too, not just a click on the popover's trash icon.
  const selectedLesionRef = useRef(selectedLesion);
  selectedLesionRef.current = selectedLesion;
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const lesion = selectedLesionRef.current;
      if (!lesion?.isManual) return;
      e.preventDefault();
      deleteManualLesion(lesion.label);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Orientation letters per pane, kept in step with each pane's camera (rotate, flip,
  // oblique crosshair rotation all move the camera)
  useEffect(() => {
    if (!volumeLoaded) return;
    const updates = PLANES.map(({ key }) => {
      const el = divRefs.current[key];
      const update = () => {
        const vp = getVp(key);
        const markers = getOrientationMarkers(vp?.getCamera());
        setOrientationByPlane(prev => (JSON.stringify(prev[key]) === JSON.stringify(markers) ? prev : { ...prev, [key]: markers }));
        // Scale bar follows zoom; the pixel readout follows the slice under a still mouse
        const scale = { mmPerPixel: vp ? mmPerCanvasPixel(vp) : null, height: el?.clientHeight ?? 0 };
        setScaleByPlane(prev => (prev[key]?.mmPerPixel === scale.mmPerPixel && prev[key]?.height === scale.height ? prev : { ...prev, [key]: scale }));
        if (pointerRef.current?.key === key && vp) {
          const probe = probePixel(vp, pointerRef.current.point);
          setPixelReadout(probe ? { key, ...probe } : null);
        }
      };
      update();
      el?.addEventListener(Enums.Events.CAMERA_MODIFIED, update);
      el?.addEventListener(Enums.Events.IMAGE_RENDERED, update);
      return () => {
        el?.removeEventListener(Enums.Events.CAMERA_MODIFIED, update);
        el?.removeEventListener(Enums.Events.IMAGE_RENDERED, update);
      };
    });
    return () => updates.forEach(off => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volumeLoaded]);

  // Named ROI contours (drawn in the 2D view or here) shown as cross-sections on the panes
  // they cross, like RT-planning viewers and 3D Slicer: each crossing is a band one slice
  // thick in the ROI's colour, so contours on neighbouring slices merge into the
  // structure's outline. Recomputed when a pane's camera moves and when contours change.
  useEffect(() => {
    if (!volumeLoaded) return;
    const volume = csCache.getVolume(volumeIdRef.current);
    if (!volume) return;

    // Depth of one slice along a contour's normal: spacing of the closest volume axis
    const sliceDepth = (normal) => {
      let best = 0;
      let bestDot = -1;
      for (let axis = 0; axis < 3; axis++) {
        const d = volume.direction;
        const dt = Math.abs(d[axis * 3] * normal[0] + d[axis * 3 + 1] * normal[1] + d[axis * 3 + 2] * normal[2]);
        if (dt > bestDot) { bestDot = dt; best = axis; }
      }
      return volume.spacing[best];
    };

    const computePane = (key) => {
      const vp = getVp(key);
      if (!vp) return { bands: [], labels: [] };
      const { focalPoint, viewPlaneNormal } = vp.getCamera();
      const bands = [];
      const labelAt = new Map(); // ROI name -> top-most canvas point
      roiContoursInWorld().forEach(contour => {
        const half = sliceDepth(contour.normal) / 2;
        const offset = contour.normal.map(x => x * half);
        contourCrossSection(contour, focalPoint, viewPlaneNormal).forEach(([a, b]) => {
          const corners = [
            a.map((x, i) => x + offset[i]), b.map((x, i) => x + offset[i]),
            b.map((x, i) => x - offset[i]), a.map((x, i) => x - offset[i]),
          ].map(p => vp.worldToCanvas(p));
          bands.push({
            color: roiColor(contour.name),
            points: corners.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "),
          });
          const top = corners.reduce((m, p) => (p[1] < m[1] ? p : m));
          const prev = labelAt.get(contour.name);
          if (!prev || top[1] < prev[1]) labelAt.set(contour.name, top);
        });
      });
      return {
        bands,
        labels: [...labelAt].map(([name, [x, y]]) => ({ name, x, y, color: roiColor(name) })),
      };
    };

    let frame = null;
    const updateAll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setRoiCrossSections(Object.fromEntries(PLANES.map(({ key }) => [key, computePane(key)])));
      });
    };
    updateAll();

    const annotationEvents = [
      csToolsEnums.Events.ANNOTATION_ADDED,
      csToolsEnums.Events.ANNOTATION_MODIFIED,
      csToolsEnums.Events.ANNOTATION_COMPLETED,
      csToolsEnums.Events.ANNOTATION_REMOVED,
    ];
    annotationEvents.forEach(name => csEventTarget.addEventListener(name, updateAll));
    const paneEls = PLANES.map(({ key }) => divRefs.current[key]).filter(Boolean);
    paneEls.forEach(el => el.addEventListener(Enums.Events.CAMERA_MODIFIED, updateAll));
    // Bands are in canvas pixels, so a pane resize moves them too (updateAll waits a
    // frame, by which time the engine has resized the canvases)
    const ro = new ResizeObserver(updateAll);
    paneEls.forEach(el => ro.observe(el));
    return () => {
      cancelAnimationFrame(frame);
      annotationEvents.forEach(name => csEventTarget.removeEventListener(name, updateAll));
      paneEls.forEach(el => el.removeEventListener(Enums.Events.CAMERA_MODIFIED, updateAll));
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volumeLoaded]);

  // Keep the panes' canvases matched to their size. The grid narrows when a side panel
  // (e.g. the ROI list) opens; without a resize Cornerstone keeps rendering at the old
  // size, so images stretch and annotations drift off their anatomy. keepCamera preserves
  // each pane's slice, zoom and pan.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let frame = null;
    const ro = new ResizeObserver(() => {
      try { engineRef.current?.resize(true, true); } catch (_) {}
      // The open region popover follows its point (after the canvases have resized)
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setSelectedLesion(prev => {
          if (!prev?.anchor) return prev;
          try {
            const pos = popoverPosition(prev.anchor);
            return pos ? { ...prev, ...pos } : prev;
          } catch (_) { return prev; }
        });
      });
    });
    ro.observe(el);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Named ROIs here too (see lib/roiVolume): ellipse/circle/rectangle contours get a name
  // when finished — polygons don't, they become grown regions — and the ROI list is
  // reported to the panel whenever contours change.
  useEffect(() => {
    if (!volumeLoaded) return;
    let timer = null;
    let last = "";
    const report = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const rois = listRois(imageIdsPropRef.current, AREA_ROI_TOOL_NAMES);
        const key = JSON.stringify(rois);
        if (key === last) return;
        last = key;
        onRoisChangeCbRef.current?.(rois);
      }, 150);
    };
    const nameNewContour = (evt) => {
      const annotation = evt.detail?.annotation;
      const toolName = annotation?.metadata?.toolName;
      if (!AREA_ROI_TOOL_NAMES.has(toolName) || toolName === PlanarFreehandROITool.toolName || annotation.data?.label) return;
      csToolsUtilities.setAnnotationLabel(annotation, undefined, suggestRoiName(annotation, imageIdsPropRef.current, AREA_ROI_TOOL_NAMES));
      report();
    };
    report();
    const events = [
      csToolsEnums.Events.ANNOTATION_ADDED,
      csToolsEnums.Events.ANNOTATION_MODIFIED,
      csToolsEnums.Events.ANNOTATION_REMOVED,
    ];
    events.forEach(name => csEventTarget.addEventListener(name, report));
    csEventTarget.addEventListener(csToolsEnums.Events.ANNOTATION_COMPLETED, nameNewContour);
    return () => {
      clearTimeout(timer);
      events.forEach(name => csEventTarget.removeEventListener(name, report));
      csEventTarget.removeEventListener(csToolsEnums.Events.ANNOTATION_COMPLETED, nameNewContour);
    };
  }, [volumeLoaded]);

  // Step 3: Mouse buttons (Horos layout, see lib/mouseBindings) — applies to all 3 panes
  // via the shared tool group. An annotation tool, when chosen, takes the left button;
  // otherwise it's the selected left-button tool (W/L by default, pan, or crosshairs).
  useEffect(() => {
    applyBindings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, leftTool]);

  // Pixel value under the cursor (HU on CT), shown in the pane's corner
  const reportPixel = (key) => (e) => {
    const vp = getVp(key);
    const rect = divRefs.current[key]?.getBoundingClientRect();
    if (!vp || !rect || !volumeLoaded) return;
    pointerRef.current = { key, point: [e.clientX - rect.left, e.clientY - rect.top] };
    const probe = probePixel(vp, pointerRef.current.point);
    setPixelReadout(probe ? { key, ...probe } : null);
  };
  const clearPixel = () => {
    pointerRef.current = null;
    setPixelReadout(null);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full grid grid-cols-3 gap-1.5">
      {PLANES.map(({ key, color, label }) => (
        <div
          key={key}
          className="relative w-full h-full bg-black overflow-hidden"
          onPointerDown={handlePaneClick(key)}
        >
          <div
            ref={(el) => { divRefs.current[key] = el; }}
            className="w-full h-full"
            onMouseMove={reportPixel(key)}
            onMouseLeave={clearPixel}
          />
          <OrientationMarkers markers={orientationByPlane[key]} />
          <ScaleBar mmPerPixel={scaleByPlane[key]?.mmPerPixel} paneHeight={scaleByPlane[key]?.height} />
          {pixelReadout?.key === key && (
            <div className="absolute bottom-2 left-2 z-20 pointer-events-none select-none text-[11px] font-mono text-white/70" style={{ textShadow: "0 0 3px #000" }}>
              {formatPixelValue(pixelReadout)}
            </div>
          )}
          {roiCrossSections[key]?.bands.length > 0 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
              {roiCrossSections[key].bands.map((band, i) => (
                <polygon key={i} points={band.points} fill={band.color} fillOpacity={0.35} stroke={band.color} strokeWidth={1} />
              ))}
              {roiCrossSections[key].labels.map(label => (
                <text key={label.name} x={label.x} y={label.y - 4} fill={label.color} fontSize={11} fontWeight={600}
                  style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 3 }}>
                  {label.name}
                </text>
              ))}
            </svg>
          )}

          {/* Active-pane frame — a separate overlay painted on top of Cornerstone's
            canvas (an outline/box-shadow on this div gets painted underneath the
            canvas child and is fully hidden, so the border has to live up here). */}
          <div
            className="absolute inset-0 z-20 pointer-events-none"
            style={{
              border: activePlane === key ? `3px solid ${color}` : "1px solid #1E1E1E",
              boxSizing: "border-box",
            }}
          />

          {/* Plane label */}
          <div className="absolute top-2 left-2 z-20 pointer-events-none">
            <span
              className="text-[10px] font-mono uppercase font-semibold"
              style={{ color: activePlane === key ? color : "rgba(255,255,255,0.4)" }}
            >
              {label}
            </span>
          </div>
        </div>
      ))}

      {/* Selected lesion popover — a vertical card anchored to the point you clicked. It opens
        above the point, or below it when there isn't room above (clicks near the top). */}
      {selectedLesion && (() => {
        const below = selectedLesion.y < 190;
        const growInfo = selectedLesion.isManual ? growSeedsRef.current.get(selectedLesion.label) : null;
        const conf = selectedLesion.confidence;
        const signal = conf == null ? 0 : conf >= 0.75 ? 3 : conf >= 0.4 ? 2 : conf > 0 ? 1 : 0;
        const signalLabel = conf == null ? null : conf >= 0.75 ? "High confidence" : conf >= 0.4 ? "Moderate" : "Low confidence";
        const showAi = !selectedLesion.isManual && ((selectedLesion.regionName && !selectedLesion.isStructure) || conf != null);
        const tail = (
          <div
            className="w-0 h-0"
            style={{
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              [below ? "borderBottom" : "borderTop"]: "6px solid #1E1E1E",
            }}
          />
        );
        const row = (label, value) => (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-[#6B6B6B]">{label}</span>
            {value}
          </div>
        );
        return (
          <div
            className="absolute z-30 flex flex-col items-center pointer-events-none"
            style={{
              left: selectedLesion.x,
              top: selectedLesion.y,
              transform: below ? "translate(-50%, 10px)" : "translate(-50%, calc(-100% - 10px))",
            }}
          >
            {below && tail}
            <div className="w-[220px] overflow-hidden rounded-xl bg-[#161616] border border-[#1E1E1E] shadow-lg pointer-events-auto">
              {/* Header */}
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
                <span className="flex-1 min-w-0 truncate text-[12px] font-semibold text-white">
                  {selectedLesion.isManual
                    ? `Polygon ${selectedLesion.polygonNumber}`
                    : selectedLesion.isStructure && selectedLesion.regionName
                      ? selectedLesion.regionName
                      : `Finding ${selectedLesion.label}`}
                </span>
                {selectedLesion.isManual && (
                  <button
                    onClick={() => deleteManualLesion(selectedLesion.label)}
                    className="text-[#6B6B6B] hover:text-red-400 text-[12px] bg-transparent border-none cursor-pointer leading-none transition-colors p-0"
                    title="Delete this polygon"
                  >🗑</button>
                )}
                <button
                  onClick={() => setSelectedLesion(null)}
                  className="text-[#6B6B6B] hover:text-white text-[12px] bg-transparent border-none cursor-pointer leading-none transition-colors p-0"
                  title="Deselect"
                >✕</button>
              </div>

              {/* Measurements */}
              <div className="flex flex-col gap-1.5 px-3 pb-2.5">
                {row("Volume", <span className="text-[13px] text-[#0694FB] font-mono">{`${selectedLesion.volumeCm3.toFixed(2)} cm³`}</span>)}
                {row("Voxels", <span className="text-[11px] text-[#949494] font-mono">{selectedLesion.voxelCount.toLocaleString()}</span>)}
                {selectedLesion.savedVoxelCount != null && (
                  <span className="text-[11px] text-[#F59E0B]" title="Saved regions are grown again from their outline when the 3D view opens. These images aren't the ones it was saved on (re-uploaded or changed), so it came out a different size. Adjust the tolerance to accept it.">
                    {`Regrown on changed images — was ${selectedLesion.savedVoxelCount.toLocaleString()} voxels`}
                  </span>
                )}
                {selectedLesion.isManual && selectedLesion.sliceCount != null && (
                  selectedLesion.sliceCount === 1 && growInfo
                    ? (
                      <span className="text-[11px] text-[#F59E0B]" title="The structure didn't continue onto neighbouring slices at this tolerance">
                        Didn't grow beyond this slice — try − / +
                      </span>
                    )
                    : row("Slices", <span className="text-[11px] text-[#949494] font-mono">{selectedLesion.sliceCount}</span>)
                )}
                {growInfo && row(
                  <span title="Region growing tolerance — tighten if it leaks into neighbouring tissue, loosen if it stops short">Tolerance</span>,
                  <span className="flex items-center gap-1">
                    <button
                      onClick={() => adjustGrowTolerance(selectedLesion.label, -0.5)}
                      title="Tighter"
                      className="w-5 h-5 rounded bg-[#1E1E1E] hover:bg-[#2a2a2a] text-white text-[12px] border-none cursor-pointer leading-none p-0"
                    >−</button>
                    <span className="text-[11px] text-[#949494] w-[34px] text-center font-mono">{`±${growInfo.tolerance}σ`}</span>
                    <button
                      onClick={() => adjustGrowTolerance(selectedLesion.label, 0.5)}
                      title="Looser"
                      className="w-5 h-5 rounded bg-[#1E1E1E] hover:bg-[#2a2a2a] text-white text-[12px] border-none cursor-pointer leading-none p-0"
                    >+</button>
                  </span>
                )}
              </div>

              {/* AI finding: region type + model confidence */}
              {showAi && (
                <div className="border-t border-[#1E1E1E] bg-[#111]/60 px-3 py-2 flex flex-col gap-1.5">
                  {selectedLesion.regionName && !selectedLesion.isStructure && (
                    <span className="text-[12px] font-medium text-red-400">{selectedLesion.regionName}</span>
                  )}
                  {conf != null && (
                    <span className="flex items-center gap-2">
                      <span className="flex items-end gap-0.5">
                        {[0, 1, 2, 3].map(bar => (
                          <span
                            key={bar}
                            style={{ display: "inline-block", width: 3, height: 12, borderRadius: 2, background: bar < signal ? "#f87171" : "#2a2a2a" }}
                          />
                        ))}
                      </span>
                      <span className="text-[11px] text-[#949494]">{`${(conf * 100).toFixed(0)}% · ${signalLabel}`}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
            {!below && tail}
          </div>
        );
      })()}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 pointer-events-none">
          <div className="w-8 h-8 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#6B6B6B] text-[12px] m-0 mt-2">Loading volume… {progress}%</p>
          <div className="w-32 h-1.5 bg-[#1E1E1E] rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-[#0694FB] rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && !loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 pointer-events-none">
          <p className="text-red-400 text-[12px] m-0">{error}</p>
        </div>
      )}

      {/* Not enough slices */}
      {imageIds.length < 2 && !loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <p className="text-[#3a3a3a] text-[13px] m-0">Need at least 2 slices for MPR view</p>
        </div>
      )}
    </div>
  );
});

export default CornerstoneVolumeViewport;
