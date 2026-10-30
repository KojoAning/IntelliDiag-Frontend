import React, { useEffect, useRef, useState } from "react";
import { Enums, metaData } from "@cornerstonejs/core";
import { uid } from "../../../lib/uid";
import { encodeSliceRuns, applyRuns } from "../../../lib/brushRuns";
import { createExtent, addPoint, extentSize, formatSize, SIZE_AXES_LABEL } from "../../../lib/regionSize";

// Brush for the 2D view: paints a disc on the slice on screen. Regions can run over several
// slices (paint on each) and are the same regions the 3-plane view paints — stored per
// slice keyed by image (lib/brushRuns). Erase (toggle, or Alt held) removes brush paint
// only. The paint is drawn on a canvas over the image, placed with the viewport's own
// image-to-screen mapping, so it follows zoom, pan, rotation and flips exactly.

const MIN_MM = 1;
const MAX_MM = 50;
const DEFAULT_MM = 8;
const FILL = [34, 211, 238]; // the 3-plane view's brush colour
const FILL_ALPHA = 110;
const SELECTED_ALPHA = 170;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function planeOf(imageId) {
  const p = metaData.get("imagePlaneModule", imageId);
  if (!p?.imagePositionPatient || !p.rowCosines || !p.columnCosines || !p.rows || !p.columns) return null;
  return {
    rows: p.rows, columns: p.columns,
    colSp: p.columnPixelSpacing || 1, rowSp: p.rowPixelSpacing || 1,
    origin: p.imagePositionPatient, rowCos: p.rowCosines, colCos: p.columnCosines,
    thickness: p.sliceThickness || null,
  };
}
// World point ↔ pixel (column along a row, row down a column)
const toPixel = (world, pl) => {
  const d = [world[0] - pl.origin[0], world[1] - pl.origin[1], world[2] - pl.origin[2]];
  return [dot(d, pl.rowCos) / pl.colSp, dot(d, pl.colCos) / pl.rowSp];
};
const toWorld = (col, row, pl) => [0, 1, 2].map(i => pl.origin[i] + col * pl.colSp * pl.rowCos[i] + row * pl.rowSp * pl.colCos[i]);

export default function StackBrushLayer({ getViewport, element, imageIds, active, regions, onRegionsChange }) {
  const canvasRef = useRef(null);
  const masksRef = useRef(new Map());     // imageId -> Uint8Array(rows × columns) of labels
  const pendingRef = useRef(new Map());   // imageId -> [[label, runs]] waiting for that image's geometry
  const regionsRef = useRef(new Map());   // label -> { uid, number }
  const versionRef = useRef(new Map());   // imageId -> edit count, to rebuild its drawn bitmap
  const bitmapRef = useRef(new Map());    // imageId -> { version, canvas }
  const strokeRef = useRef(null);
  const [size, setSize] = useState(DEFAULT_MM);
  const [erase, setErase] = useState(false);
  const [cursor, setCursor] = useState(null);   // { x, y, r, erase }
  const [card, setCard] = useState(null);       // { label, x, y, ...stats }
  const sizeRef = useRef(size); sizeRef.current = size;
  const eraseRef = useRef(erase); eraseRef.current = erase;
  const activeRef = useRef(active); activeRef.current = active;
  const cardRef = useRef(card); cardRef.current = card;
  const onChangeRef = useRef(onRegionsChange); onChangeRef.current = onRegionsChange;
  const imageIdsRef = useRef(imageIds); imageIdsRef.current = imageIds;

  const bump = (imageId) => versionRef.current.set(imageId, (versionRef.current.get(imageId) ?? 0) + 1);

  // The label mask of an image, made when its geometry is known (saved paint waits until then)
  const maskOf = (imageId) => {
    let mask = masksRef.current.get(imageId);
    if (mask) return mask;
    const pl = planeOf(imageId);
    if (!pl) return null;
    mask = new Uint8Array(pl.rows * pl.columns);
    masksRef.current.set(imageId, mask);
    (pendingRef.current.get(imageId) ?? []).forEach(([label, runs]) => applyRuns(mask, runs, label, 0, mask.length));
    pendingRef.current.delete(imageId);
    bump(imageId);
    return mask;
  };

  const nextLabel = () => {
    const used = [...regionsRef.current.keys()];
    const label = used.length ? Math.max(...used) + 1 : 1;
    return label <= 254 ? label : null;
  };
  // After every brush region's number — including ones this view can't show
  const regionsPropRef = useRef(regions); regionsPropRef.current = regions;
  const nextNumber = () => Math.max(0,
    ...[...regionsRef.current.values()].map(r => r.number ?? 0),
    ...(regionsPropRef.current ?? []).filter(r => r.kind === "brush").map(r => r.number ?? 0)) + 1;

  // ── Drawing ──
  const draw = () => {
    const canvas = canvasRef.current;
    const vp = getViewport();
    if (!canvas || !element) return;
    const dpr = window.devicePixelRatio || 1;
    const w = element.clientWidth, h = element.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const imageId = vp?.getCurrentImageId?.();
    if (!imageId) return;
    const mask = maskOf(imageId);
    const pl = planeOf(imageId);
    if (!mask || !pl) return;
    const version = versionRef.current.get(imageId) ?? 0;
    const selected = cardRef.current?.label;
    let cached = bitmapRef.current.get(imageId);
    if (!cached || cached.version !== version || cached.selected !== selected) {
      const off = cached?.canvas ?? document.createElement("canvas");
      off.width = pl.columns; off.height = pl.rows;
      const octx = off.getContext("2d");
      const img = octx.createImageData(pl.columns, pl.rows);
      let any = false;
      for (let i = 0; i < mask.length; i++) {
        const label = mask[i];
        if (!label) continue;
        any = true;
        img.data[i * 4] = FILL[0]; img.data[i * 4 + 1] = FILL[1]; img.data[i * 4 + 2] = FILL[2];
        img.data[i * 4 + 3] = label === selected ? SELECTED_ALPHA : FILL_ALPHA;
      }
      octx.putImageData(img, 0, 0);
      cached = { version, selected, canvas: off, any };
      bitmapRef.current.set(imageId, cached);
    }
    if (!cached.any) return;
    // Pixel (column, row) → screen: an affine map from three pixel centres
    const p0 = vp.worldToCanvas(toWorld(0, 0, pl));
    const px = vp.worldToCanvas(toWorld(1, 0, pl));
    const py = vp.worldToCanvas(toWorld(0, 1, pl));
    const a = [px[0] - p0[0], px[1] - p0[1]];
    const b = [py[0] - p0[0], py[1] - p0[1]];
    ctx.setTransform(dpr * a[0], dpr * a[1], dpr * b[0], dpr * b[1],
      dpr * (p0[0] - 0.5 * (a[0] + b[0])), dpr * (p0[1] - 0.5 * (a[1] + b[1])));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cached.canvas, 0, 0);
  };
  const drawRef = useRef(draw); drawRef.current = draw;

  useEffect(() => {
    if (!element) return undefined;
    const redraw = () => drawRef.current();
    element.addEventListener(Enums.Events.IMAGE_RENDERED, redraw);
    element.addEventListener(Enums.Events.CAMERA_MODIFIED, redraw);
    const ro = new ResizeObserver(redraw);
    ro.observe(element);
    redraw();
    return () => {
      element.removeEventListener(Enums.Events.IMAGE_RENDERED, redraw);
      element.removeEventListener(Enums.Events.CAMERA_MODIFIED, redraw);
      ro.disconnect();
    };
  }, [element]);

  // ── Saved regions in (from this view or the 3-plane view) ──
  useEffect(() => {
    const present = new Set([...regionsRef.current.values()].map(r => r.uid));
    let changed = false;
    (regions ?? []).forEach(region => {
      if (region.kind !== "brush" || !region.slices || present.has(region.uid)) return;
      const label = nextLabel();
      if (label == null) return;
      regionsRef.current.set(label, { uid: region.uid, number: region.number ?? nextNumber() });
      Object.entries(region.slices).forEach(([imageId, runs]) => {
        const mask = masksRef.current.get(imageId);
        if (mask) { applyRuns(mask, runs, label, 0, mask.length); bump(imageId); }
        else pendingRef.current.set(imageId, [...(pendingRef.current.get(imageId) ?? []), [label, runs]]);
      });
      changed = true;
    });
    if (changed) draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions]);

  // ── Measuring and reporting ──
  const sliceSpacing = () => {
    const ids = imageIdsRef.current;
    for (let i = 0; i + 1 < ids.length; i++) {
      const a = planeOf(ids[i]), b = planeOf(ids[i + 1]);
      if (!a || !b) continue;
      const n = cross(a.rowCos, a.colCos);
      const gap = Math.abs(dot([0, 1, 2].map(c => b.origin[c] - a.origin[c]), n));
      if (gap > 1e-3) return gap;
    }
    return planeOf(ids[0])?.thickness ?? 1;
  };

  const statsOf = (label) => {
    const spacing = sliceSpacing();
    const extent = createExtent();
    let voxels = 0, mm3 = 0, slices = 0;
    let footprint = [0, 0, 0];
    masksRef.current.forEach((mask, imageId) => {
      const pl = planeOf(imageId);
      if (!pl) return;
      let here = 0;
      for (let i = 0; i < mask.length; i++) {
        if (mask[i] !== label) continue;
        here++;
        const w = toWorld(i % pl.columns, Math.floor(i / pl.columns), pl);
        addPoint(extent, w[0], w[1], w[2]);
      }
      if (!here) return;
      voxels += here; slices++;
      mm3 += here * pl.colSp * pl.rowSp * spacing;
      const n = cross(pl.rowCos, pl.colCos);
      footprint = [0, 1, 2].map(c => Math.abs(pl.rowCos[c]) * pl.colSp + Math.abs(pl.colCos[c]) * pl.rowSp + Math.abs(n[c]) * spacing);
    });
    return voxels ? { voxels, slices, volumeCm3: mm3 / 1000, sizeMm: extentSize(extent, footprint) } : null;
  };

  const report = () => {
    const wanted = new Set(regionsRef.current.keys());
    const slicesByLabel = new Map();
    masksRef.current.forEach((mask, imageId) => {
      encodeSliceRuns(mask, wanted, mask.length).forEach((bySlice, label) => {
        const runs = bySlice.get(0);
        if (!runs) return;
        if (!slicesByLabel.has(label)) slicesByLabel.set(label, {});
        slicesByLabel.get(label)[imageId] = runs;
      });
    });
    // Saved paint on images not opened this session stays as it was
    pendingRef.current.forEach((entries, imageId) => entries.forEach(([label, runs]) => {
      if (!slicesByLabel.has(label)) slicesByLabel.set(label, {});
      slicesByLabel.get(label)[imageId] = runs;
    }));
    const list = [...regionsRef.current].filter(([label]) => slicesByLabel.has(label)).map(([label, r]) => {
      const slices = slicesByLabel.get(label);
      const voxelCount = Object.values(slices).reduce((n, runs) => n + runs.reduce((s, v, i) => s + (i % 2 ? v : 0), 0), 0);
      return { uid: r.uid, kind: "brush", number: r.number, voxelCount, slices };
    });
    onChangeRef.current?.(list);
  };

  const removeRegion = (label) => {
    masksRef.current.forEach((mask, imageId) => {
      let hit = false;
      for (let i = 0; i < mask.length; i++) if (mask[i] === label) { mask[i] = 0; hit = true; }
      if (hit) bump(imageId);
    });
    pendingRef.current.forEach((entries, imageId) => pendingRef.current.set(imageId, entries.filter(([l]) => l !== label)));
    regionsRef.current.delete(label);
    setCard(c => (c?.label === label ? null : c));
    draw();
    report();
  };

  // ── Painting ──
  const pointIn = (e) => {
    const rect = element.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };
  const radiusPx = (vp, pl) => {
    const a = vp.worldToCanvas(toWorld(0, 0, pl));
    const b = vp.worldToCanvas(toWorld(1, 0, pl));
    const pxPerCol = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return (sizeRef.current / 2 / pl.colSp) * pxPerCol;
  };

  const dab = (vp, point, stroke) => {
    const pl = planeOf(stroke.imageId);
    const mask = maskOf(stroke.imageId);
    if (!pl || !mask) return;
    const [c0, r0] = toPixel(vp.canvasToWorld(point), pl);
    const r = sizeRef.current / 2;
    const cMin = Math.max(0, Math.floor(c0 - r / pl.colSp - 1)), cMax = Math.min(pl.columns - 1, Math.ceil(c0 + r / pl.colSp + 1));
    const rMin = Math.max(0, Math.floor(r0 - r / pl.rowSp - 1)), rMax = Math.min(pl.rows - 1, Math.ceil(r0 + r / pl.rowSp + 1));
    for (let row = rMin; row <= rMax; row++) {
      for (let col = cMin; col <= cMax; col++) {
        const dc = (col - c0) * pl.colSp, dr = (row - r0) * pl.rowSp;
        if (dc * dc + dr * dr > r * r) continue;
        const idx = row * pl.columns + col;
        if (stroke.erase) {
          if (!regionsRef.current.has(mask[idx])) continue;
          stroke.touched.add(mask[idx]);
          mask[idx] = 0;
        } else if (mask[idx] === 0) {
          mask[idx] = stroke.label;
        }
      }
    }
    bump(stroke.imageId);
  };

  useEffect(() => {
    if (!element) return undefined;
    const down = (e) => {
      if (!activeRef.current || e.button !== 0 || e.shiftKey) return;
      const vp = getViewport();
      const imageId = vp?.getCurrentImageId?.();
      const mask = imageId && maskOf(imageId);
      if (!mask) return;
      // Cancelling pointerdown keeps the mouse events (and so Cornerstone's tools) out of it
      e.preventDefault();
      e.stopPropagation();
      element.setPointerCapture?.(e.pointerId);
      const point = pointIn(e);
      const strokeErase = eraseRef.current || e.altKey;
      let label = null;
      if (!strokeErase) {
        const pl = planeOf(imageId);
        const [c, r] = toPixel(vp.canvasToWorld(point), pl).map(Math.round);
        const under = c >= 0 && r >= 0 && c < pl.columns && r < pl.rows ? mask[r * pl.columns + c] : 0;
        const selected = cardRef.current?.label;
        label = regionsRef.current.has(under) ? under
          : regionsRef.current.has(selected) ? selected
            : nextLabel();
        if (label == null) return;
        if (!regionsRef.current.has(label)) regionsRef.current.set(label, { uid: uid(), number: nextNumber() });
      }
      strokeRef.current = { imageId, label, erase: strokeErase, last: point, touched: new Set(label ? [label] : []) };
      dab(vp, point, strokeRef.current);
      draw();
    };
    const move = (e) => {
      if (!activeRef.current) return;
      const vp = getViewport();
      const imageId = vp?.getCurrentImageId?.();
      const pl = imageId && planeOf(imageId);
      if (!pl) return;
      const point = pointIn(e);
      setCursor({ x: point[0], y: point[1], r: radiusPx(vp, pl), erase: eraseRef.current || e.altKey });
      const stroke = strokeRef.current;
      if (!stroke || stroke.imageId !== imageId) return;
      e.stopPropagation();
      const [x0, y0] = stroke.last;
      const step = Math.max(1, radiusPx(vp, pl) / 2);
      const steps = Math.max(1, Math.ceil(Math.hypot(point[0] - x0, point[1] - y0) / step));
      for (let s = 1; s <= steps; s++) dab(vp, [x0 + ((point[0] - x0) * s) / steps, y0 + ((point[1] - y0) * s) / steps], stroke);
      stroke.last = point;
      draw();
    };
    const up = () => {
      const stroke = strokeRef.current;
      if (!stroke) return;
      strokeRef.current = null;
      let shown = null;
      stroke.touched.forEach(label => {
        const st = statsOf(label);
        if (!st) {
          regionsRef.current.delete(label);
          setCard(c => (c?.label === label ? null : c));
        } else if (label === stroke.label) {
          shown = { label, number: regionsRef.current.get(label)?.number, ...st };
        }
      });
      if (shown) setCard({ ...shown, x: stroke.last[0], y: stroke.last[1] });
      draw();
      report();
    };
    const leave = () => setCursor(null);
    const key = (e) => {
      if (!activeRef.current) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "[") setSize(v => Math.max(MIN_MM, v - (v > 10 ? 2 : 1)));
      if (e.key === "]") setSize(v => Math.min(MAX_MM, v + (v >= 10 ? 2 : 1)));
    };
    element.addEventListener("pointerdown", down, true);
    element.addEventListener("pointermove", move, true);
    element.addEventListener("pointerleave", leave);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", key);
    return () => {
      element.removeEventListener("pointerdown", down, true);
      element.removeEventListener("pointermove", move, true);
      element.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element]);

  useEffect(() => { if (!active) setCursor(null); }, [active]);
  useEffect(() => { draw(); }, [card?.label]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-[5]" />
      {active && cursor && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
          <circle cx={cursor.x} cy={cursor.y} r={cursor.r} fill="none" stroke={cursor.erase ? "#F87171" : "#22D3EE"}
            strokeWidth={1.5} strokeDasharray={cursor.erase ? "4 3" : undefined} />
          <circle cx={cursor.x} cy={cursor.y} r={1.5} fill={cursor.erase ? "#F87171" : "#22D3EE"} />
        </svg>
      )}
      {active && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 whitespace-nowrap [&>*]:shrink-0 bg-[#161616]/95 border border-[#2a2a2a] rounded-xl px-3 py-1.5 shadow-lg select-none">
          <span className="text-[11px] font-semibold text-white">Brush</span>
          <div className="flex rounded-md overflow-hidden border border-[#2a2a2a]">
            {[[false, "Paint"], [true, "Erase"]].map(([value, label]) => (
              <button
                key={label}
                onClick={() => setErase(value)}
                className={`px-2 py-0.5 text-[11px] border-none cursor-pointer ${erase === value ? (value ? "bg-[#F87171] text-black" : "bg-[#22D3EE] text-black") : "bg-[#111] text-[#999] hover:text-white"}`}
              >{label}</button>
            ))}
          </div>
          <input
            type="range" min={MIN_MM} max={MAX_MM} step={1} value={size}
            onChange={e => setSize(Number(e.target.value))}
            className="w-[110px] accent-[#22D3EE]"
            title="Brush diameter ( [ and ] )"
          />
          <span className="text-[11px] font-mono text-white w-[38px]">{`${size} mm`}</span>
          <span className="text-[10px] text-[#6B6B6B]">Paint each slice · Alt erases · [ ] size</span>
        </div>
      )}
      {card && (
        <div
          className="absolute z-30 w-[220px] rounded-xl bg-[#161616] border border-[#2a2a2a] shadow-xl select-none"
          style={{ left: Math.min(card.x + 14, (element?.clientWidth ?? 400) - 230), top: Math.max(8, card.y - 110) }}
        >
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
            <span className="flex-1 text-[12px] font-semibold text-white">{`Brush ${card.number}`}</span>
            <button onClick={() => removeRegion(card.label)} title="Delete this region"
              className="text-[#6B6B6B] hover:text-red-400 text-[12px] bg-transparent border-none cursor-pointer p-0">🗑</button>
            <button onClick={() => setCard(null)} title="Close"
              className="text-[#6B6B6B] hover:text-white text-[12px] bg-transparent border-none cursor-pointer p-0">✕</button>
          </div>
          <div className="flex flex-col gap-1.5 px-3 pb-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#6B6B6B]">Volume</span>
              <span className="text-[13px] text-[#0694FB] font-mono">{`${card.volumeCm3.toFixed(2)} cm³`}</span>
            </div>
            {card.sizeMm && (
              <div className="flex items-baseline justify-between gap-3" title={`Maximum extent ${SIZE_AXES_LABEL}`}>
                <span className="text-[11px] text-[#6B6B6B]">Size</span>
                <span className="flex flex-col items-end">
                  <span className="text-[12px] text-white font-mono whitespace-nowrap">{formatSize(card.sizeMm)}</span>
                  <span className="text-[10px] text-[#6B6B6B]">{SIZE_AXES_LABEL}</span>
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#6B6B6B]">Slices painted</span>
              <span className="text-[11px] text-[#949494] font-mono">{card.slices}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
