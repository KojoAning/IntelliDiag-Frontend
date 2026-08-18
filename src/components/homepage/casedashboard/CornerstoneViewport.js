import React, {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { RenderingEngine, Enums } from "@cornerstonejs/core";
import { annotation as csAnnotation } from "@cornerstonejs/tools";
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
} from "@cornerstonejs/tools";
import { initCornerstone } from "../../../lib/cornerstoneSetup";

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
};

const ALL_ANNOTATION_TOOLS = Object.values(TOOL_MAP);

let instanceCounter = 0;

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
  { imageIds = [], activeTool = null, onIndexChange, onArrowTextRequest, onCameraChanged },
  ref
) {
  const divRef = useRef(null);
  const arrowTextCbRef = useRef(onArrowTextRequest);
  arrowTextCbRef.current = onArrowTextRequest;
  const onIndexChangeCbRef = useRef(onIndexChange);
  onIndexChangeCbRef.current = onIndexChange;
  const onCameraChangedCbRef = useRef(onCameraChanged);
  onCameraChangedCbRef.current = onCameraChanged;

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
      vp.resetProperties();
      vp.render();
    },
    rotateCW()  { rotate(90); },
    rotateCCW() { rotate(-90); },
    setRotation(deg) {
      const vp = ctx.current.viewport;
      if (!vp) return;
      vp.setProperties({ rotation: ((deg % 360) + 360) % 360 });
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

  function rotate(delta) {
    const vp = ctx.current.viewport;
    if (!vp) return;
    const { rotation = 0 } = vp.getProperties();
    vp.setProperties({ rotation: ((rotation + delta) % 360 + 360) % 360 });
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
      ];
      tools.forEach(T => toolGroup.addTool(T.toolName));
      toolGroup.addViewport(viewportId, engineId);

      // Override ArrowAnnotateTool's prompt with a custom React dialog callback
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

      // Bring annotation tools to Enabled state (addTool leaves them Disabled)
      // so setToolActive() can transition them cleanly later
      ALL_ANNOTATION_TOOLS.forEach(name => {
        try { toolGroup.setToolEnabled(name); } catch (_) {}
      });

      // Defaults: W/L on left, Pan on middle, Zoom on right
      toolGroup.setToolActive(WindowLevelTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Primary }],
      });
      toolGroup.setToolActive(PanTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Auxiliary }],
      });
      toolGroup.setToolActive(ZoomTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Secondary }],
      });
      // StackScrollTool stays disabled until the stack has images — activating
      // it on an empty stack causes "Stack Viewport has no images" errors.

      ctx.current.ready = true;

      // Fire onIndexChange + onCameraChanged whenever Cornerstone finishes rendering a frame
      let lastIndex = -1;
      const onRendered = () => {
        const vp = ctx.current.viewport;
        if (!vp) return;

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
            const { rotation = 0, invert: _i } = vp.getProperties();
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
        // Apply the image's native modality/VOI LUT (WindowCenter/Width) — without
        // this, 16-bit signed pixels map to black until the user drags W/L.
        try { viewport.resetProperties(); } catch (_) {}
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
    })().catch(console.error);

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
        try { vp.resetProperties(); } catch (_) {}
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
      .catch(console.error);
  }, [imageIds]);

  // ── Switch active annotation tool ─────────────────────────────────────────
  useEffect(() => {
    const { toolGroup } = ctx.current;
    if (!toolGroup) return;

    if (!activeTool || !TOOL_MAP[activeTool]) {
      // No annotation tool active — restore default W/L on left button
      ALL_ANNOTATION_TOOLS.forEach(name => {
        try { toolGroup.setToolEnabled(name); } catch (_) {}
      });
      toolGroup.setToolActive(WindowLevelTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Primary }],
      });
      return;
    }

    // Release W/L from primary button, bring all annotation tools to Enabled,
    // then activate the chosen one
    try { toolGroup.setToolEnabled(WindowLevelTool.toolName); } catch (_) {}
    ALL_ANNOTATION_TOOLS.forEach(name => {
      try { toolGroup.setToolEnabled(name); } catch (_) {}
    });

    toolGroup.setToolActive(TOOL_MAP[activeTool], {
      bindings: [{ mouseButton: MouseBindings.Primary }],
    });
  }, [activeTool]);

  return (
    <div
      ref={divRef}
      style={{ width: "100%", height: "100%" }}
      onContextMenu={e => e.preventDefault()}
    />
  );
});

export default CornerstoneViewport;
