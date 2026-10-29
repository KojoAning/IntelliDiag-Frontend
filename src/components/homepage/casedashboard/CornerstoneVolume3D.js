import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { RenderingEngine, Enums, volumeLoader, setVolumesForViewports, cache as csCache, getEnabledElement } from "@cornerstonejs/core";
import { ToolGroupManager, TrackballRotateTool, PanTool, ZoomTool, addTool, Enums as csToolsEnums } from "@cornerstonejs/tools";
import { initCornerstone } from "../../../lib/cornerstoneSetup";
import { snapshotMetadata } from "../../../lib/metadataSnapshot";
import { loadVolume, failedSlicesNote } from "../../../lib/volumeLoad";

// 3D volume rendering of the open series: left-drag rotates, middle or Shift + left-drag
// pans, right / wheel zooms. What shows is set by a preset — Cornerstone's transfer functions (which
// intensities show, in what colour and opacity) — e.g. bone or contrast-filled vessels.

// Presets offered per modality: [Cornerstone preset name, label]
export const RENDER_PRESETS = {
  CT: [
    ["CT-Bone", "Bone"],
    ["CT-AAA", "Vessels (contrast)"],
    ["CT-Chest-Vessels", "Chest vessels"],
    ["CT-Lung", "Lung"],
    ["CT-Soft-Tissue", "Soft tissue"],
    ["CT-Cardiac", "Cardiac"],
    ["CT-MIP", "MIP"],
  ],
  MR: [
    ["MR-Default", "Default"],
    ["MR-Angio", "Angio"],
    ["MR-T2-Brain", "T2 brain"],
    ["MR-MIP", "MIP"],
  ],
};
export const presetsFor = modality => RENDER_PRESETS[(modality || "").toUpperCase()] ?? RENDER_PRESETS.MR;

const { MouseBindings, KeyboardBindings } = csToolsEnums;

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Pan for the 3D view. Cornerstone's PanTool moves the camera by the drag converted to
// world coordinates, which in a perspective 3D view has a part along the line of sight —
// so dragging mostly zooms. This moves the camera across the screen only: the drag in
// pixels times the size of a pixel at the focal point.
function screenPan(viewport, dx, dy) {
  if (!dx && !dy) return;
  const { focalPoint, position, viewUp, viewPlaneNormal, parallelProjection, parallelScale, viewAngle } = viewport.getCamera();
  const height = viewport.canvas.clientHeight || viewport.canvas.height;
  const distance = Math.hypot(position[0] - focalPoint[0], position[1] - focalPoint[1], position[2] - focalPoint[2]);
  const halfHeight = parallelProjection ? parallelScale : distance * Math.tan(((viewAngle ?? 30) * Math.PI) / 360);
  const mmPerPixel = (2 * halfHeight) / height;
  const right = cross(viewUp, viewPlaneNormal); // viewPlaneNormal points at the viewer
  // The scene follows the pointer, so the camera moves the other way (screen y runs down)
  const shift = [0, 1, 2].map(i => (-dx * right[i] + dy * viewUp[i]) * mmPerPixel);
  viewport.setCamera({
    focalPoint: focalPoint.map((v, i) => v + shift[i]),
    position: position.map((v, i) => v + shift[i]),
  });
  viewport.render();
}

class ScreenPanTool extends PanTool {
  static toolName = "ScreenPan";

  _dragCallback(evt) {
    const { element, deltaPoints } = evt.detail;
    screenPan(getEnabledElement(element).viewport, deltaPoints.canvas[0], deltaPoints.canvas[1]);
  }
}

let instanceCounter = 0;

const CornerstoneVolume3D = forwardRef(function CornerstoneVolume3D({ imageIds = [], preset = "CT-Bone" }, ref) {
  const elRef = useRef(null);
  const engineRef = useRef(null);
  const middlePanRef = useRef(null); // last pointer position while middle-dragging
  const volumeIdRef = useRef(null);
  const instanceId = useRef(`3d-${++instanceCounter}`);
  const [engineReady, setEngineReady] = useState(false);
  const [volumeLoaded, setVolumeLoaded] = useState(false);
  const [fullyLoaded, setFullyLoaded] = useState(false);
  const [failedSlices, setFailedSlices] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const viewportId = `volume3d-${instanceId.current}`;
  const getVp = () => engineRef.current?.getViewport(viewportId);

  const zoom = factor => {
    const vp = getVp();
    if (!vp) return;
    const cam = vp.getCamera();
    vp.setCamera({ parallelScale: cam.parallelScale / factor });
    vp.render();
  };
  const reset = () => {
    const vp = getVp();
    if (!vp) return;
    vp.resetCamera();
    vp.render();
  };
  const noop = () => null;

  // The toolbar drives every viewer through the same calls; the ones that mean nothing
  // for a rendering (window presets, flips, measurements) do nothing here
  useImperativeHandle(ref, () => ({
    zoomIn() { zoom(1.25); },
    zoomOut() { zoom(0.8); },
    resetFit: reset,
    resetView: reset,
    render() { getVp()?.render(); },
    rotateCW: noop, rotateCCW: noop, flipH: noop, flipV: noop,
    setWindow: noop, resetWindow: noop, toggleInvert: noop,
    deleteSelectedAnnotations: () => false,
    getProperties: noop, getZoom: noop, getDisplay: noop, applyDisplay: noop, setImageIndex: noop,
  }));

  // Engine, one 3D viewport and its tools
  useEffect(() => {
    let cancelled = false;
    const toolGroupId = `tg-${instanceId.current}`;
    (async () => {
      await initCornerstone();
      try { addTool(ScreenPanTool); } catch (_) { /* already added */ }
      if (cancelled || !elRef.current) return;
      const engine = new RenderingEngine(`engine-${instanceId.current}`);
      engineRef.current = engine;
      engine.enableElement({
        viewportId,
        element: elRef.current,
        type: Enums.ViewportType.VOLUME_3D,
        defaultOptions: { background: [0, 0, 0] },
      });
      const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
      [TrackballRotateTool, ScreenPanTool, ZoomTool].forEach(T => toolGroup.addTool(T.toolName));
      toolGroup.setToolActive(TrackballRotateTool.toolName, { bindings: [{ mouseButton: MouseBindings.Primary }] });
      // Middle-drag, or Shift + left-drag for mice and trackpads without a middle button
      // (as in the 3-plane view)
      toolGroup.setToolActive(ScreenPanTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Primary, modifierKey: KeyboardBindings.Shift }],
      });
      toolGroup.setToolActive(ZoomTool.toolName, { bindings: [{ mouseButton: MouseBindings.Secondary }, { mouseButton: MouseBindings.Wheel }] });
      toolGroup.addViewport(viewportId, engine.id);
      setEngineReady(true);
    })().catch(err => !cancelled && setError(err.message || "Couldn't start 3D rendering"));

    const ro = new ResizeObserver(() => { try { engineRef.current?.resize(true, true); } catch (_) {} });
    if (elRef.current) ro.observe(elRef.current);
    return () => {
      cancelled = true;
      ro.disconnect();
      try { ToolGroupManager.destroyToolGroup(toolGroupId); } catch (_) {}
      engineRef.current?.destroy();
      engineRef.current = null;
      if (volumeIdRef.current) {
        try { csCache.removeVolumeLoadObject(volumeIdRef.current); } catch (_) {}
        volumeIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The volume
  useEffect(() => {
    if (!engineReady || imageIds.length < 2) return;
    let cancelled = false;
    const volumeId = `cornerstoneStreamingImageVolume:${instanceId.current}-${Date.now()}`;
    setVolumeLoaded(false);
    setFullyLoaded(false);
    setFailedSlices(0);
    setError(null);
    setProgress(0);
    (async () => {
      // A copy — Cornerstone reorders the array it's given
      const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds: [...imageIds] });
      snapshotMetadata(volume.imageIds);
      const previous = volumeIdRef.current;
      volumeIdRef.current = volumeId;
      // Rendered as it streams in; the progress bar runs until the last slice
      const loaded = loadVolume(volume, pct => { if (!cancelled) setProgress(pct); });
      if (cancelled) return;
      await setVolumesForViewports(engineRef.current, [{ volumeId }], [viewportId]);
      if (previous) { try { csCache.removeVolumeLoadObject(previous); } catch (_) {} }
      const vp = getVp();
      vp.setProperties({ preset });
      vp.resetCamera();
      vp.render();
      setVolumeLoaded(true);
      const { failed } = await loaded;
      if (!cancelled) { setFullyLoaded(true); setFailedSlices(failed); }
    })().catch(err => !cancelled && setError(err.message || "Couldn't load the volume"));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineReady, imageIds]);

  useEffect(() => {
    if (!volumeLoaded) return;
    const vp = getVp();
    try {
      vp?.setProperties({ preset });
      vp?.render();
    } catch (err) {
      console.warn("[3D] preset failed:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, volumeLoaded]);

  return (
    <div className="relative w-full h-full bg-black">
      <div
        ref={elRef}
        className="w-full h-full"
        onContextMenu={e => e.preventDefault()}
        // Middle-drag pans, handled here rather than by a Cornerstone binding: Cornerstone picks
        // the tool from MouseEvent.buttons, and on some browser / mouse setups the middle
        // button arrives there as the right one (which zooms). MouseEvent.button is reliable.
        // Cancelling pointerdown also keeps the mouse events away from Cornerstone's tools.
        onPointerDownCapture={e => {
          if (e.button !== 1) return;
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          middlePanRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMoveCapture={e => {
          const last = middlePanRef.current;
          if (!last) return;
          e.stopPropagation();
          const vp = getVp();
          if (vp) screenPan(vp, e.clientX - last.x, e.clientY - last.y);
          middlePanRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUpCapture={e => {
          if (!middlePanRef.current) return;
          middlePanRef.current = null;
          e.currentTarget.releasePointerCapture?.(e.pointerId);
        }}
        onAuxClick={e => e.preventDefault()}
      />
      <div className="absolute top-2 left-2 z-20 pointer-events-none text-[10px] font-mono uppercase font-semibold text-white/50">
        3D · drag to rotate · Shift-drag or middle to pan · right / wheel to zoom
      </div>
      {!fullyLoaded && !error && imageIds.length >= 2 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 pointer-events-none">
          <span className="text-[11px] text-[#868686]">{`Loading slices… ${progress}%`}</span>
          <div className="w-40 h-1 bg-[#1E1E1E] rounded-full overflow-hidden">
            <div className="h-full bg-[#0694FB] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {failedSlicesNote(failedSlices) && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none text-[11px] text-[#F59E0B]">
          {failedSlicesNote(failedSlices)}
        </div>
      )}
      {imageIds.length < 2 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <p className="text-[#6B6B6B] text-[12px] m-0">3D rendering needs a series with more than one slice</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <p className="text-red-400 text-[12px] m-0">{error}</p>
        </div>
      )}
    </div>
  );
});

export default CornerstoneVolume3D;
