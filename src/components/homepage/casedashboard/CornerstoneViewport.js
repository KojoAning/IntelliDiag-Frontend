import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { RenderingEngine, Enums, metaData, eventTarget as csEventTarget } from "@cornerstonejs/core";
import { annotation as csAnnotation, utilities as csToolsUtilities } from "@cornerstonejs/tools";
import {
  ToolGroupManager,
  Enums as csToolsEnums,
  PanTool,
  ZoomTool,
  WindowLevelTool,
  LengthTool,
  AngleTool,
  EllipticalROITool,
  CircleROITool,
  RectangleROITool,
  ArrowAnnotateTool,
  ProbeTool,
  PlanarFreehandROITool,
  StackScrollTool,
  BidirectionalTool,
  CobbAngleTool,
  LabelTool,
  MagnifyTool,
} from "@cornerstonejs/tools";
import { initCornerstone } from "../../../lib/cornerstoneSetup";
import { applyHorosMouseBindings } from "../../../lib/mouseBindings";
import { PENCIL_TOOL_NAME } from "../../../lib/annotationPersistence";
import { probePixel, mmPerCanvasPixel } from "../../../lib/viewportReadouts";
import OrientationMarkers, { getOrientationMarkers } from "./OrientationMarkers";
import ScaleBar from "./ScaleBar";
import { listRois, suggestRoiName, AREA_ROI_TOOL_NAMES } from "../../../lib/roiVolume";

const { MouseBindings } = csToolsEnums;

// Map toolbar tool names → Cornerstone tool names
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
  magnify:  MagnifyTool.toolName, // stack viewports only — not offered in MPR
};

// Everything but the magnifier draws an annotation that stays grabbable
const ALL_ANNOTATION_TOOLS = Object.values(TOOL_MAP).filter(name => name !== MagnifyTool.toolName);

let instanceCounter = 0;

/**
 * Apply window/level from the DICOM metadata of the given imageId.
 *
 * Priority:
 *  1. DICOM's embedded WindowCenter / WindowWidth tags (voiLutModule)
 *  2. CT modality fallback — soft-tissue window (WC 40, WW 400 HU)
 *  3. Do nothing — let Cornerstone auto-compute from the pixel range
 *     (better than resetProperties() which uses an internal default that
 *      ignores the image's actual HU range)
 */
function applyVoi(viewport, imageId) {
  try {
    const voiLut = metaData.get('voiLutModule', imageId);
    const wc = Array.isArray(voiLut?.windowCenter) ? voiLut.windowCenter[0] : voiLut?.windowCenter;
    const ww = Array.isArray(voiLut?.windowWidth)  ? voiLut.windowWidth[0]  : voiLut?.windowWidth;

    if (wc != null && ww != null && ww > 0) {
      // Use the DICOM's embedded clinical window
      viewport.setProperties({ voiRange: { lower: wc - ww / 2, upper: wc + ww / 2 } });
      return;
    }

    // No VOI tags — apply a modality-appropriate fallback
    const series = metaData.get('generalSeriesModule', imageId);
    const modality = (series?.modality ?? '').toUpperCase();
    if (modality === 'CT') {
      // Soft-tissue window: WC=40 HU, WW=400 HU
      // Better than the raw HU range (~4096) which renders everything grey
      viewport.setProperties({ voiRange: { lower: -160, upper: 240 } });
    }
    // For MR and others, Cornerstone's auto-compute from pixel range is fine
  } catch (_) {}
}

/**
 * CornerstoneViewport
 *
 * Props:
 *   imageIds    – string[]  Cornerstone imageIds  (use toImageId() helper for blob/http URLs)
 *   activeTool  – string | null  one of the keys in TOOL_MAP, or null for default W/L
 *   onIndexChange – (index: number) => void
 *
 * Ref methods (use a React ref):
 *   zoomIn(), zoomOut(), resetFit()
 *   rotateCW(), rotateCCW(), setRotation(deg)
 *   flipH(), flipV()
 *   toggleInvert()
 *   setImageIndex(n)
 *   getCurrentIndex() → number
 *   getZoom() → number
 *   getProperties() → object
 */
const CornerstoneViewport = forwardRef(function CornerstoneViewport(
  { imageIds = [], activeTool = null, leftTool = "wl", readOnly = false, onIndexChange, onArrowTextRequest, onCameraChanged, onRoisChange, onPixelValue },
  ref
) {
  const divRef = useRef(null);
  const arrowTextCbRef = useRef(onArrowTextRequest);
  arrowTextCbRef.current = onArrowTextRequest;
  const onIndexChangeCbRef = useRef(onIndexChange);
  onIndexChangeCbRef.current = onIndexChange;
  const onCameraChangedCbRef = useRef(onCameraChanged);
  onCameraChangedCbRef.current = onCameraChanged;
  const onRoisChangeCbRef = useRef(onRoisChange);
  onRoisChangeCbRef.current = onRoisChange;
  const imageIdsRef = useRef(imageIds);
  imageIdsRef.current = imageIds;
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  const onPixelValueCbRef = useRef(onPixelValue);
  onPixelValueCbRef.current = onPixelValue;
  const [orientation, setOrientation] = useState(null);
  const orientationKeyRef = useRef("");
  const [scale, setScale] = useState({ mmPerPixel: null, height: 0 }); // for the scale bar
  const pointerRef = useRef(null); // last canvas point under the mouse, for the pixel readout
  const leftToolRef = useRef(leftTool);
  leftToolRef.current = leftTool;

  // readOnly (the layout's other panes): measurements are drawn but can't be grabbed or
  // edited, since only the active viewer saves them
  // pointer: left button does nothing to the image — only grabs measurements
  const LEFT_TOOLS = { wl: WindowLevelTool.toolName, pan: PanTool.toolName, pointer: null };
  const applyBindings = (toolGroup = ctx.current?.toolGroup) => {
    if (!toolGroup) return;
    applyHorosMouseBindings(toolGroup, {
      primary: (readOnly ? null : TOOL_MAP[activeToolRef.current])
        ?? (leftToolRef.current in LEFT_TOOLS ? LEFT_TOOLS[leftToolRef.current] : WindowLevelTool.toolName),
      interactiveTools: readOnly ? [] : ALL_ANNOTATION_TOOLS,
    });
    if (readOnly) ALL_ANNOTATION_TOOLS.forEach(name => { try { toolGroup.setToolEnabled(name); } catch (_) {} });
  };

  // Named ROIs, Horos-style (see lib/roiVolume): a contour gets a name when it's finished,
  // and the ROI list is reported whenever contours are drawn, edited, renamed or removed
  // (debounced, and only when it actually changes). Mean intensity needs a contour's stats,
  // which appear once it renders — hence also recomputing after renders.
  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    let timer = null;
    let last = "";
    const recompute = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const rois = listRois(imageIdsRef.current, AREA_ROI_TOOL_NAMES);
        const key = JSON.stringify(rois);
        if (key === last) return;
        last = key;
        onRoisChangeCbRef.current?.(rois);
      }, 150);
    };
    const nameNewContour = (evt) => {
      const annotation = evt.detail?.annotation;
      if (!AREA_ROI_TOOL_NAMES.has(annotation?.metadata?.toolName) || annotation.data?.label) return;
      // The event is shared with the MPR/translation viewers — only name contours on this stack
      if (!imageIdsRef.current.includes(annotation.metadata.referencedImageId)) return;
      csToolsUtilities.setAnnotationLabel(annotation, el, suggestRoiName(annotation, imageIdsRef.current, AREA_ROI_TOOL_NAMES));
      recompute();
    };
    const events = [
      csToolsEnums.Events.ANNOTATION_ADDED,
      csToolsEnums.Events.ANNOTATION_MODIFIED,
      csToolsEnums.Events.ANNOTATION_REMOVED,
    ];
    el.addEventListener(csToolsEnums.Events.ANNOTATION_RENDERED, recompute);
    events.forEach(name => csEventTarget.addEventListener(name, recompute));
    csEventTarget.addEventListener(csToolsEnums.Events.ANNOTATION_COMPLETED, nameNewContour);
    return () => {
      clearTimeout(timer);
      el.removeEventListener(csToolsEnums.Events.ANNOTATION_RENDERED, recompute);
      events.forEach(name => csEventTarget.removeEventListener(name, recompute));
      csEventTarget.removeEventListener(csToolsEnums.Events.ANNOTATION_COMPLETED, nameNewContour);
    };
  }, []);

  // Everything stateful about this viewport lives here so we can access it
  // from imperative handles and effects without stale closures.
  const ctx = useRef({
    id: ++instanceCounter,
    engineId:   null,
    viewportId: null,
    toolGroupId: null,
    engine:     null,
    viewport:   null,
    toolGroup:  null,
    ready:      false,
  });

  // ── Imperative API ────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    zoomIn()  { adjustZoom(1.25); },
    zoomOut() { adjustZoom(0.8); },
    resetFit() {
      const vp = ctx.current.viewport;
      if (!vp) return;
      vp.resetCamera();
      // Re-apply the DICOM window rather than resetting to Cornerstone's internal default
      applyVoi(vp, vp.getCurrentImageId?.() ?? "");
      vp.render();
    },
    rotateCW()  { rotate(90); },
    rotateCCW() { rotate(-90); },
    setRotation(deg) {
      const vp = ctx.current.viewport;
      if (!vp) return;
      vp.setViewPresentation({ rotation: ((deg % 360) + 360) % 360 });
      vp.render();
    },
    flipH() {
      const vp = ctx.current.viewport;
      if (!vp) return;
      const cam = vp.getCamera();
      vp.setCamera({ flipHorizontal: !cam.flipHorizontal });
      vp.render();
    },
    flipV() {
      const vp = ctx.current.viewport;
      if (!vp) return;
      const cam = vp.getCamera();
      vp.setCamera({ flipVertical: !cam.flipVertical });
      vp.render();
    },
    // Window presets (lib/windowPresets) and "0 = the image's own window"
    setWindow(center, width) {
      const vp = ctx.current.viewport;
      if (!vp) return;
      vp.setProperties({ voiRange: { lower: center - width / 2, upper: center + width / 2 } });
      vp.render();
    },
    resetWindow() {
      const vp = ctx.current.viewport;
      if (!vp) return;
      applyVoi(vp, vp.getCurrentImageId?.() ?? "");
      vp.render();
    },
    toggleInvert() {
      const vp = ctx.current.viewport;
      if (!vp) return;
      const { invert = false } = vp.getProperties();
      vp.setProperties({ invert: !invert });
      vp.render();
    },
    setImageIndex(n) {
      const vp = ctx.current.viewport;
      if (!vp || n < 0) return;
      const numImages = vp.getImageIds?.()?.length ?? 0;
      if (n < numImages) {
        vp.setImageIdIndex(n);
        vp.render();
      }
    },
    getCurrentIndex() {
      return ctx.current.viewport?.getCurrentImageIdIndex() ?? 0;
    },
    getZoom() {
      const vp = ctx.current.viewport;
      if (!vp) return 1;
      // parallelScale is inversely proportional to zoom
      // We normalise against the initial value stored on first render
      const cam = vp.getCamera();
      return cam.parallelScale ? (ctx.current.baseScale / cam.parallelScale) : 1;
    },
    getProperties() {
      return ctx.current.viewport?.getProperties() ?? {};
    },
    /** Delete whichever annotations are currently selected. Returns true if any were removed. */
    deleteSelectedAnnotations() {
      const selected = csAnnotation.selection.getAnnotationsSelected?.() ?? [];
      if (!selected.length) return false;
      selected.forEach(uid => {
        try { csAnnotation.state.removeAnnotation(uid); } catch (_) {}
      });
      ctx.current.viewport?.render();
      return true;
    },
    render() {
      ctx.current.viewport?.render();
    },
    /** Capture the current rendered frame as a JPEG data-URL. */
    captureFrame() {
      const canvas = divRef.current?.querySelector("canvas");
      return canvas?.toDataURL("image/jpeg", 0.92) ?? null;
    },
  }));

  // ── Helpers ───────────────────────────────────────────────────────────────
  function adjustZoom(factor) {
    const vp = ctx.current.viewport;
    if (!vp) return;
    const cam = vp.getCamera();
    if (cam.parallelScale != null) {
      vp.setCamera({ ...cam, parallelScale: cam.parallelScale / factor });
      vp.render();
    }
  }

  // Cornerstone 4 moved rotation out of setProperties/getProperties (it's silently ignored
  // there) into the view presentation.
  function rotate(delta) {
    const vp = ctx.current.viewport;
    if (!vp) return;
    const rotation = vp.getRotation?.() ?? 0;
    vp.setViewPresentation({ rotation: ((rotation + delta) % 360 + 360) % 360 });
    vp.render();
  }

  // ── Initialise once on mount ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      await initCornerstone();
      if (cancelled || !divRef.current) return;

      const id         = ctx.current.id;
      const engineId   = `intellidiag-engine-${id}`;
      const viewportId = `intellidiag-vp-${id}`;
      const toolGroupId = `intellidiag-tg-${id}`;

      Object.assign(ctx.current, { engineId, viewportId, toolGroupId });

      const engine = new RenderingEngine(engineId);
      ctx.current.engine = engine;

      engine.enableElement({
        viewportId,
        type: Enums.ViewportType.STACK,
        element: divRef.current,
        defaultOptions: { background: [0, 0, 0] },
      });

      const viewport = engine.getViewport(viewportId);
      ctx.current.viewport = viewport;

      // ── Tool group ─────────────────────────────────────────────────────
      const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
      ctx.current.toolGroup = toolGroup;

      const tools = [
        PanTool, ZoomTool, WindowLevelTool,
        LengthTool, AngleTool,
        EllipticalROITool, CircleROITool, RectangleROITool,
        ArrowAnnotateTool, ProbeTool,
        PlanarFreehandROITool, StackScrollTool,
        BidirectionalTool, CobbAngleTool, LabelTool, MagnifyTool,
      ];
      tools.forEach(T => toolGroup.addTool(T.toolName));
      // Pencil: freehand strokes without area stats, kept apart from the named ROIs
      toolGroup.addToolInstance(PENCIL_TOOL_NAME, PlanarFreehandROITool.toolName, { calculateStats: false });

      // ROI name as the first line of each area contour's label, above its usual stats
      AREA_ROI_TOOL_NAMES.forEach(name => {
        const tool = toolGroup.getToolInstance(name);
        const baseTextLines = tool?.configuration?.getTextLines;
        if (!baseTextLines) return;
        tool.configuration.getTextLines = (data, targetId) => [
          ...(data.label ? [data.label] : []),
          ...(baseTextLines(data, targetId) ?? []),
        ];
      });
      toolGroup.addViewport(viewportId, engineId);

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

      // Horos mouse layout: left = W/L (or the chosen tool), middle = pan, right = zoom
      applyBindings(toolGroup);
      // StackScrollTool stays disabled until the stack has images — activating
      // it on an empty stack causes "Stack Viewport has no images" errors.

      ctx.current.ready = true;

      // Fire onIndexChange + onCameraChanged whenever Cornerstone finishes rendering a frame
      let lastIndex = -1;
      const onRendered = () => {
        const vp = ctx.current.viewport;
        if (!vp) return;

        // Orientation letters — only for DICOM carrying patient orientation, not plain PNG/JPG
        const plane = metaData.get("imagePlaneModule", vp.getCurrentImageId?.() ?? "");
        const markers = plane?.rowCosines ? getOrientationMarkers(vp.getCamera()) : null;
        const markersKey = JSON.stringify(markers);
        if (markersKey !== orientationKeyRef.current) {
          orientationKeyRef.current = markersKey;
          setOrientation(markers);
        }

        // Scale bar follows zoom; the pixel readout follows the slice under a still mouse
        const mmPerPixel = mmPerCanvasPixel(vp);
        const height = divRef.current?.clientHeight ?? 0;
        setScale(prev => (prev.mmPerPixel === mmPerPixel && prev.height === height ? prev : { mmPerPixel, height }));
        if (pointerRef.current) onPixelValueCbRef.current?.(probePixel(vp, pointerRef.current));

        const idx = vp.getCurrentImageIdIndex?.() ?? -1;
        if (idx !== lastIndex && idx >= 0) {
          lastIndex = idx;
          onIndexChangeCbRef.current?.(idx);
        }

        // Compute the mask transform so the overlay stays aligned with the DICOM image
        if (onCameraChangedCbRef.current) {
          try {
            const cam = vp.getCamera();
            const zoom = ctx.current.baseScale / (cam.parallelScale ?? ctx.current.baseScale);
            const rotation = vp.getRotation?.() ?? 0;
            const el = divRef.current;
            const cw = el?.clientWidth ?? 1;
            const ch = el?.clientHeight ?? 1;

            let panX = 0, panY = 0;
            const imgCenter = ctx.current.imageCenterWorld;
            if (imgCenter) {
              const ic = vp.worldToCanvas(imgCenter);
              panX = ic[0] - cw / 2;
              panY = ic[1] - ch / 2;
            }

            onCameraChangedCbRef.current({
              zoom,
              panX,
              panY,
              rotation,
              flipH: cam.flipHorizontal ?? false,
              flipV: cam.flipVertical   ?? false,
            });
          } catch (_) {}
        }
      };
      divRef.current?.addEventListener(Enums.Events.IMAGE_RENDERED, onRendered);

      // Load initial images
      if (imageIds.length) {
        await viewport.setStack(imageIds);
        // Apply the DICOM's embedded WindowCenter/Width so CT looks correct immediately.
        applyVoi(viewport, imageIds[0]);
        viewport.render();
        // Store base parallelScale for zoom calculation and image center for mask alignment
        const initCam = viewport.getCamera();
        ctx.current.baseScale = initCam.parallelScale ?? 1;
        ctx.current.imageCenterWorld = initCam.focalPoint ? [...initCam.focalPoint] : null;
        // Now safe to enable scroll
        toolGroup.setToolActive(StackScrollTool.toolName, {
          bindings: [{ mouseButton: MouseBindings.Wheel }],
        });
      }
    })().catch(() => {});

    return () => {
      cancelled = true;
      const { toolGroup, engine } = ctx.current;
      try { toolGroup?.destroy(); } catch (_) {}
      try { engine?.destroy(); }    catch (_) {}
      ctx.current.ready     = false;
      ctx.current.engine    = null;
      ctx.current.viewport  = null;
      ctx.current.toolGroup = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resize observer — keep canvas in sync with container ─────────────────
  useEffect(() => {
    const el = divRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const engine = ctx.current.engine;
      const vp = ctx.current.viewport;
      if (!engine || !vp) return;
      try {
        engine.resize(true, false);
        // Re-fit the image to the new container size so the mask stays aligned.
        // This resets user pan/zoom on resize, which is acceptable for split-screen transitions.
        vp.resetCamera();
        vp.render();
        const cam = vp.getCamera();
        ctx.current.baseScale = cam.parallelScale ?? 1;
        ctx.current.imageCenterWorld = cam.focalPoint ? [...cam.focalPoint] : null;
      } catch (_) {}
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Update image stack when imageIds prop changes ─────────────────────────
  useEffect(() => {
    const vp = ctx.current.viewport;
    if (!vp || !imageIds.length) return;
    vp.setStack(imageIds)
      .then(() => {
        applyVoi(vp, imageIds[0]);
        vp.render();
        const updatedCam = vp.getCamera();
        ctx.current.baseScale = updatedCam.parallelScale ?? 1;
        ctx.current.imageCenterWorld = updatedCam.focalPoint ? [...updatedCam.focalPoint] : null;
        // Enable stack scroll now that the stack is populated
        const tg = ctx.current.toolGroup;
        if (tg) {
          try {
            tg.setToolActive(StackScrollTool.toolName, {
              bindings: [{ mouseButton: MouseBindings.Wheel }],
            });
          } catch (_) {}
        }
      })
      .catch(() => {});
  }, [imageIds]);

  // ── Mouse buttons (Horos layout, see lib/mouseBindings) ──────────────────
  // An annotation tool, when chosen, takes the left button; otherwise it's the
  // selected left-button tool (window/level by default, or pan).
  useEffect(() => {
    applyBindings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, leftTool]);

  // ── Pixel value under the cursor (HU on CT) ──────────────────────────────
  const reportPixel = (e) => {
    const vp = ctx.current.viewport;
    const rect = divRef.current?.getBoundingClientRect();
    if (!vp || !rect) return;
    pointerRef.current = [e.clientX - rect.left, e.clientY - rect.top];
    onPixelValueCbRef.current?.(probePixel(vp, pointerRef.current));
  };
  const clearPixel = () => {
    pointerRef.current = null;
    onPixelValueCbRef.current?.(null);
  };

  return (
    <div className="relative" style={{ width: "100%", height: "100%" }}>
      <div
        ref={divRef}
        style={{ width: "100%", height: "100%" }}
        onContextMenu={e => e.preventDefault()}
        onMouseMove={reportPixel}
        onMouseLeave={clearPixel}
      />
      <OrientationMarkers markers={orientation} />
      <ScaleBar mmPerPixel={scale.mmPerPixel} paneHeight={scale.height} />
    </div>
  );
});

export default CornerstoneViewport;
