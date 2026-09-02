import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { RenderingEngine, Enums, volumeLoader, setVolumesForViewports } from "@cornerstonejs/core";
import {
  ToolGroupManager,
  annotation as csAnnotation,
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

const { MouseBindings } = csToolsEnums;

const VIEW_CONFIGS = {
  axial:    { orientation: Enums.OrientationAxis.AXIAL },
  sagittal: { orientation: Enums.OrientationAxis.SAGITTAL },
  coronal:  { orientation: Enums.OrientationAxis.CORONAL },
};

let instanceCounter = 0;

const CornerstoneVolumeViewport = forwardRef(function CornerstoneVolumeViewport(
  { imageIds = [], viewMode = "axial", activeTool = null, windowLevel = false, onArrowTextRequest },
  ref
) {
  const divRef = useRef(null);
  const engineRef = useRef(null);
  const volumeIdRef = useRef(null);
  const toolGroupRef = useRef(null);
  const instanceId = useRef(++instanceCounter);
  const arrowTextCbRef = useRef(onArrowTextRequest);
  arrowTextCbRef.current = onArrowTextRequest;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [engineReady, setEngineReady] = useState(false);

  const engineId = `volume-engine-${instanceId.current}`;
  const viewportId = `volume-viewport-${instanceId.current}`;
  const toolGroupId = `volume-tools-${instanceId.current}`;

  // Store initial parallelScale so we can compute zoom %
  const baseScaleRef = useRef(null);

  const getVp = () => engineRef.current?.getViewport(viewportId);

  const adjustZoom = (factor) => {
    const vp = getVp();
    if (!vp) return;
    const cam = vp.getCamera();
    if (!cam.parallelScale) return;
    if (!baseScaleRef.current) baseScaleRef.current = cam.parallelScale;
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
      baseScaleRef.current = cam.parallelScale;
    },
    rotateCW() {
      const vp = getVp();
      if (!vp) return;
      const cam = vp.getCamera();
      const angle = Math.PI / 2;
      const vUp = cam.viewUp;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const vpn = cam.viewPlaneNormal;
      // Rodrigues' rotation of viewUp around viewPlaneNormal
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
      return baseScaleRef.current ? (baseScaleRef.current / cam.parallelScale) : 1;
    },
    deleteSelectedAnnotations() {
      const selected = csAnnotation.selection.getAnnotationsSelected?.() ?? [];
      if (!selected.length) return false;
      selected.forEach(uid => {
        try { csAnnotation.state.removeAnnotation(uid); } catch (_) {}
      });
      getVp()?.render();
      return true;
    },
    render() {
      getVp()?.render();
    },
  }));

  // Step 1: Create engine + viewport + tool group on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      await initCornerstone();
      if (cancelled || !divRef.current) return;

      const engine = new RenderingEngine(engineId);
      engineRef.current = engine;

      const config = VIEW_CONFIGS[viewMode] || VIEW_CONFIGS.axial;

      engine.enableElement({
        viewportId,
        type: Enums.ViewportType.ORTHOGRAPHIC,
        element: divRef.current,
        defaultOptions: {
          orientation: config.orientation,
          background: [0, 0, 0],
        },
      });

      // Create a tool group and bind interaction tools
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

      // Pan on left-click, W/L on middle, Zoom on right-click, Scroll on wheel
      toolGroup.setToolActive(PanTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Primary }],
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

      toolGroup.addViewport(viewportId, engineId);

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
      ToolGroupManager.destroyToolGroup(toolGroupId);
      toolGroupRef.current = null;
      engineRef.current?.destroy();
      engineRef.current = null;
      setEngineReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 2: Load volume once engine is ready and imageIds are available
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

        await setVolumesForViewports(engine, [{ volumeId }], [viewportId]);

        if (cancelled) return;

        const vp = engine.getViewport(viewportId);
        if (vp) {
          vp.resetCamera();
          vp.render();
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Volume load error:", err);
          setError(err.message || "Failed to load volume");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineReady, imageIds]);

  // Step 3: Switch orientation when viewMode changes (volume must be loaded)
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !volumeIdRef.current) return;

    const vp = engine.getViewport(viewportId);
    if (!vp) return;

    const config = VIEW_CONFIGS[viewMode] || VIEW_CONFIGS.axial;
    vp.setOrientation(config.orientation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // Step 4: Switch active annotation tool
  useEffect(() => {
    const toolGroup = toolGroupRef.current;
    if (!toolGroup) return;

    if (!activeTool || !TOOL_MAP[activeTool]) {
      // No annotation tool — restore Pan on left button
      ALL_ANNOTATION_TOOLS.forEach(name => {
        try { toolGroup.setToolEnabled(name); } catch (_) {}
      });
      if (!windowLevel) {
        toolGroup.setToolActive(PanTool.toolName, {
          bindings: [{ mouseButton: MouseBindings.Primary }],
        });
      }
      return;
    }

    // Deactivate all annotation tools and remove Pan from left-click
    ALL_ANNOTATION_TOOLS.forEach(name => {
      try { toolGroup.setToolEnabled(name); } catch (_) {}
    });
    try { toolGroup.setToolEnabled(PanTool.toolName); } catch (_) {}

    toolGroup.setToolActive(TOOL_MAP[activeTool], {
      bindings: [{ mouseButton: MouseBindings.Primary }],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

  // Step 5: Window/Level toggle
  useEffect(() => {
    const toolGroup = toolGroupRef.current;
    if (!toolGroup) return;
    if (windowLevel) {
      try { toolGroup.setToolEnabled(PanTool.toolName); } catch (_) {}
      toolGroup.setToolActive(WindowLevelTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Primary }],
      });
    } else if (!activeTool || !TOOL_MAP[activeTool]) {
      try { toolGroup.setToolEnabled(WindowLevelTool.toolName); } catch (_) {}
      toolGroup.setToolActive(PanTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Primary }],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowLevel]);

  return (
    <div className="relative w-full h-full">
      <div ref={divRef} className="w-full h-full" />

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

      {/* View label */}
      <div className="absolute top-2 left-2 z-20 pointer-events-none">
        <span className="text-white/50 text-[10px] font-mono uppercase">{viewMode}</span>
      </div>
    </div>
  );
});

export default CornerstoneVolumeViewport;
