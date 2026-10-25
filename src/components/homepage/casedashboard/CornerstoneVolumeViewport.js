import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { RenderingEngine, Enums, volumeLoader, setVolumesForViewports, cache as csCache, eventTarget as csEventTarget } from "@cornerstonejs/core";
import {
  ToolGroupManager,
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
  Enums as csToolsEnums,
} from "@cornerstonejs/tools";
import { initCornerstone } from "../../../lib/cornerstoneSetup";

const TOOL_MAP = {
  circle:   CircleROITool.toolName,
  square:   RectangleROITool.toolName,
  arrow:    ArrowAnnotateTool.toolName,
  ruler:    LengthTool.toolName,
  angle:    AngleTool.toolName,
  marker:   ProbeTool.toolName,
  polygon:  PlanarFreehandROITool.toolName,
};

const ALL_ANNOTATION_TOOLS = Object.values(TOOL_MAP);

const { MouseBindings, KeyboardBindings } = csToolsEnums;

// Three synced panes — order drives layout (axial, sagittal, coronal)
const PLANES = [
  { key: "axial",    orientation: Enums.OrientationAxis.AXIAL,    color: "#0694FB", label: "AXIAL" },
  { key: "sagittal", orientation: Enums.OrientationAxis.SAGITTAL, color: "#22C55E", label: "SAGITTAL" },
  { key: "coronal",  orientation: Enums.OrientationAxis.CORONAL,  color: "#F59E0B", label: "CORONAL" },
];

// Decode a single slice's mask PNG (base64, data URL, or http URL — same three
// shapes the 2D overlay accepts) into a flat 0/1 label array sized to the volume's
// in-plane dimensions (resampled if the mask's native size differs).
function decodeMaskToLabels(src, width, height) {
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
        ctx.drawImage(img, 0, 0, width, height);
        const { data } = ctx.getImageData(0, 0, width, height);
        const labels = new Uint8Array(width * height);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          const alpha = data[i + 3];
          const luminance = data[i] + data[i + 1] + data[i + 2];
          labels[p] = alpha > 10 && luminance > 10 ? 1 : 0;
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
    if (binary[seed] !== 1 || labels[seed] !== 0) continue;
    if (nextLabel >= 254) break;

    const queue = [seed];
    labels[seed] = PENDING;
    let qi = 0;
    while (qi < queue.length) {
      const cur = queue[qi++];
      const k = Math.floor(cur / sliceSize);
      const rem = cur - k * sliceSize;
      const j = Math.floor(rem / w);
      const i = rem - j * w;
      const tryPush = (n) => {
        if (binary[n] === 1 && labels[n] === 0) {
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
    stats.set(label, { voxelCount, volumeCm3: voxelCount * voxelVolumeCm3 });
  }

  if (droppedAsNoise > 0) {
    console.log(`[MPR mask] dropped ${droppedAsNoise} speckle blob(s) under ${minVoxels} voxels; kept ${stats.size} finding(s).`);
  }

  return { labels, stats };
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
  { imageIds = [], activeTool = null, windowLevel = false, onArrowTextRequest, onActivePlaneChange, maskSlices = null, maskOpacity = 0.5 },
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
  const manualLabelNumberRef = useRef(new Map()); // internal label -> user-facing "Polygon N" number
  const manualLabelCounterRef = useRef(0); // next "Polygon N" number to hand out
  const rebuildingSegmentationRef = useRef(false); // true while Step 2b is (re)building the AI segmentation — manual draws during this window would land on a volume about to be discarded
  const [selectedLesion, setSelectedLesion] = useState(null); // { label, voxelCount, volumeCm3 }
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
      ].forEach((T) => {
        toolGroup.addTool(T.toolName);
        toolGroup.setToolEnabled(T.toolName);
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

      // Primary = Crosshairs (click/drag to reslice + move the locator point)
      // Shift+Primary = Pan, Auxiliary = Window/Level, Secondary = Zoom, Wheel = scroll slices
      toolGroup.setToolActive(CrosshairsTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Primary }],
      });
      toolGroup.setToolActive(PanTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Primary, modifierKey: KeyboardBindings.Shift }],
      });
      toolGroup.setToolActive(WindowLevelTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Auxiliary }],
      });
      toolGroup.setToolActive(ZoomTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Secondary }],
      });
      toolGroup.setToolActive(StackScrollTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Wheel }],
      });

      // Override ArrowAnnotateTool's prompt with the custom React dialog
      const arrowTool = toolGroup.getToolInstance(ArrowAnnotateTool.toolName);
      if (arrowTool) {
        arrowTool.configuration.getTextCallback = (doneChangingTextCallback) => {
          if (arrowTextCbRef.current) {
            arrowTextCbRef.current(doneChangingTextCallback);
          } else {
            doneChangingTextCallback(prompt("Enter your annotation:"));
          }
        };
      }

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
        const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds });
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
        try { csSegmentation.removeSegmentation(segmentationIdRef.current); } catch (_) {}
        segmentationIdRef.current = null;
        labelmapVolumeRef.current = null;
        labelArrayRef.current = null;
        labelDimsRef.current = null;
        lesionStatsRef.current = null;
        nextLesionLabelRef.current = 0;
        manualLabelsRef.current = new Set();
        manualLabelNumberRef.current = new Map();
        manualLabelCounterRef.current = 0;
        setSelectedLesion(null);
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

        const scalarData = new Uint8Array(w * h * d);
        let decodedAny = false;
        const sliceCount = Math.min(maskSlices.length, d);
        for (let i = 0; i < sliceCount; i++) {
          if (cancelled) return;
          const src = maskSlices[i];
          if (!src) continue;
          const labels = await decodeMaskToLabels(src, w, h);
          if (cancelled) return;
          if (labels) {
            scalarData.set(labels, i * w * h);
            decodedAny = true;
          }
        }
        if (cancelled) return;

        if (!decodedAny) {
          console.warn("[MPR mask] none of the mask slices decoded successfully — no segmentation volume built.");
          return;
        }

        // Give each connected blob its own id/color so individual findings can be
        // clicked and measured separately, instead of one flat binary mask.
        const { labels: componentLabels, stats: lesionStats } = labelConnectedComponents(
          scalarData, w, h, d, labelmapVolume.spacing
        );

        // Carry forward any manually-drawn ROIs from before this rebuild — otherwise a
        // model switch silently wipes everything the user drew. AI voxels win where the
        // footprints overlap (it's the fresh/authoritative result for this model).
        const carriedManualLabels = new Set();
        const carriedManualLabelNumbers = new Map();
        if (priorLabelArray && priorManualLabels?.size && priorLabelArray.length === componentLabels.length) {
          const remap = new Map(); // old label -> new label
          let nextLabel = lesionStats.size;
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
            }
            componentLabels[voxelIdx] = newLabel;
          }
        }

        labelmapVolumeRef.current = labelmapVolume;
        labelArrayRef.current = componentLabels;
        labelDimsRef.current = { w, h, d };
        lesionStatsRef.current = lesionStats;
        manualLabelNumberRef.current = carriedManualLabelNumbers; // manualLabelCounterRef is left as-is so future polygons keep counting up
        nextLesionLabelRef.current = Math.max(lesionStats.size, ...carriedManualLabels, 0);
        manualLabelsRef.current = carriedManualLabels;
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

      const mainVolumeId = volumeIdRef.current;
      const mainVolume = csCache.getVolume(mainVolumeId);
      if (!mainVolume?.imageData) return;

      try {
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
        if (fixedValue < 0 || fixedValue >= volDims[fixedAxis]) return;

        const poly2d = idxPoints.map(p => [p[varyingAxes[0]], p[varyingAxes[1]]]);
        const minA = Math.max(0, Math.floor(Math.min(...poly2d.map(p => p[0]))));
        const maxA = Math.min(volDims[varyingAxes[0]] - 1, Math.ceil(Math.max(...poly2d.map(p => p[0]))));
        const minB = Math.max(0, Math.floor(Math.min(...poly2d.map(p => p[1]))));
        const maxB = Math.min(volDims[varyingAxes[1]] - 1, Math.ceil(Math.max(...poly2d.map(p => p[1]))));

        if (nextLesionLabelRef.current >= 254) {
          console.warn("[Manual ROI] segment limit reached — cannot add another region.");
          return;
        }
        nextLesionLabelRef.current += 1;
        const label = nextLesionLabelRef.current;

        const labelArray = labelArrayRef.current;
        const coord = [0, 0, 0];
        let voxelCount = 0; // counted on the drawn slice only — this is what gets reported as the volume
        let sumA = 0, sumB = 0;

        // Render-only padding: a true 1-voxel-thick slab's exact world position, round-tripped
        // through world<->index transforms, can land the GPU's slice sample half a voxel off
        // the slice we wrote — making a genuinely-drawn region invisible from other planes purely
        // from floating-point rounding. Writing it onto the neighboring slice too makes it robust
        // to that, without inflating the reported voxel count/volume (computed from the drawn slice alone).
        const renderFixedValues = [fixedValue - 1, fixedValue, fixedValue + 1].filter(
          v => v >= 0 && v < volDims[fixedAxis]
        );

        for (let a = minA; a <= maxA; a++) {
          for (let b = minB; b <= maxB; b++) {
            if (!pointInPolygon2D(a + 0.5, b + 0.5, poly2d)) continue;
            coord[varyingAxes[0]] = a;
            coord[varyingAxes[1]] = b;
            renderFixedValues.forEach(v => {
              coord[fixedAxis] = v;
              labelArray[coord[2] * w * h + coord[1] * w + coord[0]] = label;
            });
            voxelCount++;
            sumA += a;
            sumB += b;
          }
        }
        coord[fixedAxis] = fixedValue; // back to the drawn slice for the centroid below
        if (!voxelCount) {
          nextLesionLabelRef.current -= 1; // nothing landed inside the volume — give the label back
          return;
        }

        const spacing = labelmapVolume.spacing;
        const volumeCm3 = voxelCount * ((spacing[0] * spacing[1] * spacing[2]) / 1000);
        lesionStatsRef.current.set(label, { voxelCount, volumeCm3 });
        manualLabelsRef.current.add(label);
        manualLabelCounterRef.current += 1;
        manualLabelNumberRef.current.set(label, manualLabelCounterRef.current);

        // A region drawn on one plane is only 1 voxel thick along its normal — from the
        // other 2 panes you're slicing it edge-on, so it's genuinely a thin line, not a
        // blob. Rather than fake extra thickness, give it a heavier outline (fill alpha
        // stays on the shared opacity slider — see the merge:false note in Step 2d) so
        // that thin line still reads clearly instead of disappearing into antialiasing.
        csSegmentation.segmentationStyle.setStyle(
          { segmentationId, type: csToolsEnums.SegmentationRepresentations.Labelmap, segmentIndex: label },
          { outlineWidth: 3, outlineOpacity: 1 }, false
        );

        labelmapVolume.voxelManager.setCompleteScalarDataArray(labelArray);
        csSegmentation.triggerSegmentationEvents.triggerSegmentationDataModified(segmentationId);
        console.log(`[Manual ROI] baked ${voxelCount} voxels as label ${label} (${volumeCm3.toFixed(2)} cm³) into segmentation ${segmentationId}`);

        // This annotation is now redundant — its shape lives in the segmentation volume
        // and renders (correctly) in all 3 panes, so the flat 2D outline would just be a
        // second, out-of-sync copy visible only in the pane it was drawn in. Isolated in
        // its own try — a failure here must not block the recenter/popover below.
        try {
          csAnnotation.state.removeAnnotation(annotation.annotationUID);
        } catch (err) {
          console.warn("[Manual ROI] couldn't remove the source annotation:", err);
        }

        // Centroid of the filled voxels (not just the last one visited), used both to
        // position the popover and to recenter the crosshairs on the new region.
        let centroidWorld = null;
        try {
          const centroidCoord = [...coord];
          centroidCoord[varyingAxes[0]] = Math.round(sumA / voxelCount);
          centroidCoord[varyingAxes[1]] = Math.round(sumB / voxelCount);
          centroidWorld = mainVolume.imageData.indexToWorld(centroidCoord);
        } catch (err) {
          console.warn("[Manual ROI] couldn't compute centroid world position:", err);
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
            }
          } catch (err) {
            console.warn("[Manual ROI] setToolCenter failed:", err);
          }
        }

        // Surface the new region's volume right away, same popover as a clicked finding.
        try {
          const vp = getVp();
          const containerRect = containerRef.current?.getBoundingClientRect();
          const paneRect = divRefs.current[activePlaneRef.current]?.getBoundingClientRect();
          const stat = { voxelCount, volumeCm3 };
          if (centroidWorld && vp && containerRect && paneRect) {
            const [cx, cy] = vp.worldToCanvas(centroidWorld);
            const halfCardW = 110;
            setSelectedLesion(buildSelectedLesion(label, stat, {
              x: Math.min(Math.max(paneRect.left - containerRect.left + cx, halfCardW), containerRect.width - halfCardW),
              y: Math.max(paneRect.top - containerRect.top + cy, 44),
            }));
          } else {
            setSelectedLesion(buildSelectedLesion(label, stat, { x: 110, y: 44 }));
          }
        } catch (err) {
          console.warn("[Manual ROI] couldn't position the popover:", err);
          setSelectedLesion(buildSelectedLesion(label, { voxelCount, volumeCm3 }, { x: 110, y: 44 }));
        }

        getAllVps().forEach(vp2 => vp2.render());
      } catch (err) {
        console.error("[Manual ROI] failed to bake polygon into segmentation:", err);
      }
    };

    csEventTarget.addEventListener(csToolsEnums.Events.ANNOTATION_COMPLETED, handleAnnotationCompleted);
    return () => csEventTarget.removeEventListener(csToolsEnums.Events.ANNOTATION_COMPLETED, handleAnnotationCompleted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manually-drawn ROIs are "Polygon N" (yours, deletable); AI findings stay "Finding N" (read-only).
  const buildSelectedLesion = (label, stat, pos) => {
    const isManual = manualLabelsRef.current.has(label);
    return {
      label,
      ...stat,
      ...pos,
      isManual,
      polygonNumber: isManual ? manualLabelNumberRef.current.get(label) : null,
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

    const label = labelArray[k * w * h + j * w + i];
    if (!label) {
      setSelectedLesion(null);
      return;
    }
    const stat = lesionStatsRef.current?.get(label);
    if (!stat) {
      setSelectedLesion(null);
      return;
    }

    // Position the popover at the click point, relative to the whole 3-pane grid
    // (clamped so it doesn't render off the edge of the grid).
    const containerRect = containerRef.current?.getBoundingClientRect();
    let pos = { x: e.clientX, y: e.clientY };
    if (containerRect) {
      const halfCardW = 110;
      pos = {
        x: Math.min(Math.max(e.clientX - containerRect.left, halfCardW), containerRect.width - halfCardW),
        y: Math.max(e.clientY - containerRect.top, 44),
      };
    }

    setSelectedLesion(buildSelectedLesion(label, stat, pos));
  };

  // Erases a manually-drawn region from the segmentation entirely. AI findings aren't
  // deletable this way — they're not yours to remove, only to inspect.
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

    labelmapVolume.voxelManager.setCompleteScalarDataArray(labelArray);
    csSegmentation.triggerSegmentationEvents.triggerSegmentationDataModified(segmentationId);

    setSelectedLesion(prev => (prev?.label === label ? null : prev));
    reinitializeCrosshairs();
    getAllVps().forEach(vp => vp.render());
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

  // Step 3: Switch active annotation tool (applies to all 3 panes via the shared tool group)
  useEffect(() => {
    const toolGroup = toolGroupRef.current;
    if (!toolGroup) return;

    if (!activeTool || !TOOL_MAP[activeTool]) {
      // No annotation tool — restore Crosshairs on left-click
      ALL_ANNOTATION_TOOLS.forEach(name => {
        try { toolGroup.setToolEnabled(name); } catch (_) {}
      });
      if (!windowLevel) {
        toolGroup.setToolActive(CrosshairsTool.toolName, {
          bindings: [{ mouseButton: MouseBindings.Primary }],
        });
      }
      return;
    }

    // Deactivate Crosshairs and other annotation tools, take over left-click
    ALL_ANNOTATION_TOOLS.forEach(name => {
      try { toolGroup.setToolEnabled(name); } catch (_) {}
    });
    try { toolGroup.setToolEnabled(CrosshairsTool.toolName); } catch (_) {}

    toolGroup.setToolActive(TOOL_MAP[activeTool], {
      bindings: [{ mouseButton: MouseBindings.Primary }],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

  // Step 4: Window/Level toggle
  useEffect(() => {
    const toolGroup = toolGroupRef.current;
    if (!toolGroup) return;
    if (windowLevel) {
      try { toolGroup.setToolEnabled(CrosshairsTool.toolName); } catch (_) {}
      toolGroup.setToolActive(WindowLevelTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Primary }],
      });
    } else if (!activeTool || !TOOL_MAP[activeTool]) {
      try { toolGroup.setToolEnabled(WindowLevelTool.toolName); } catch (_) {}
      toolGroup.setToolActive(CrosshairsTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Primary }],
      });
      toolGroup.setToolActive(WindowLevelTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Auxiliary }],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowLevel]);

  return (
    <div ref={containerRef} className="relative w-full h-full grid grid-cols-3 gap-1.5">
      {PLANES.map(({ key, color, label }) => (
        <div
          key={key}
          className="relative w-full h-full bg-black overflow-hidden"
          onPointerDown={handlePaneClick(key)}
        >
          <div ref={(el) => { divRefs.current[key] = el; }} className="w-full h-full" />

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

      {/* Selected lesion popover — anchored to the point you clicked */}
      {selectedLesion && (
        <div
          className="absolute z-30 flex flex-col items-center pointer-events-none"
          style={{ left: selectedLesion.x, top: selectedLesion.y, transform: "translate(-50%, calc(-100% - 10px))" }}
        >
          <div className="overflow-hidden rounded-xl bg-[#161616] border border-[#1E1E1E] shadow-lg pointer-events-auto">
            <div className="px-3 py-2 flex items-center gap-3 whitespace-nowrap">
              <span className="text-[12px] font-semibold text-white">
                {selectedLesion.isManual ? `Polygon ${selectedLesion.polygonNumber}` : `Finding ${selectedLesion.label}`}
              </span>
              <span className="text-[12px] text-[#0694FB] font-mono">
                {selectedLesion.volumeCm3.toFixed(2)} cm³
              </span>
              <span className="text-[11px] text-[#6B6B6B]">
                {selectedLesion.voxelCount.toLocaleString()} voxels
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
          </div>
          {/* Pointer tail toward the clicked point */}
          <div
            className="w-0 h-0"
            style={{
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "6px solid #1E1E1E",
            }}
          />
        </div>
      )}

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
