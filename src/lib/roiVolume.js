// Named ROIs and their volumes, the way Horos/OsiriX do it: every area contour (polygon,
// ellipse, circle, rectangle) carries a name, contours sharing a name on different slices
// are one ROI, and its volume is computed from all of them — areas stacked through the
// slice positions, gaps between outlined slices filled by linear interpolation (trapezoid
// rule), plus half a slice at each end so contiguous contours give exactly Σ area × spacing.
//
// Areas come from each contour's own geometry (world coordinates are mm), not from
// Cornerstone's cached stats — those only exist once a contour's slice has been displayed,
// which isn't true of measurements restored from a save. Mean intensity does need the
// pixels, so it comes from the contours whose stats exist.
import { metaData } from "@cornerstonejs/core";
import {
  annotation as csAnnotation,
  utilities as csToolsUtilities,
  PlanarFreehandROITool, EllipticalROITool, CircleROITool, RectangleROITool,
} from "@cornerstonejs/tools";
import { createExtent, addPoint, extentSize } from "./regionSize";

// Closed-contour tools whose contours are named ROIs
export const AREA_ROI_TOOL_NAMES = new Set([
  PlanarFreehandROITool.toolName, EllipticalROITool.toolName, CircleROITool.toolName, RectangleROITool.toolName,
]);

// Contours further apart than this many slices don't get a suggested shared name
const MAX_SLICE_GAP = 10;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Slice positions along the scan normal (mm), slab thickness for the end caps, and the
// in-plane axes. calibrated is false for plain images with no patient geometry.
//
// Cornerstone only parses a slice's DICOM header once that slice is loaded for display,
// so most slices usually have no metadata yet. Known slices keep their real positions;
// the rest are placed on the line through the known ones (CT/MR slices are evenly spaced),
// or, with a single known slice, stepped out by its slice spacing.
function stackGeometry(imageIds) {
  const planes = imageIds.map(id => metaData.get("imagePlaneModule", id));
  const known = [];
  planes.forEach((p, i) => { if (p?.imagePositionPatient && p?.rowCosines && p?.columnCosines) known.push(i); });
  if (!known.length) return { calibrated: false, positions: [], spacing: NaN, rowCos: null, colCos: null };

  const ref = planes[known[0]];
  const rowCos = ref.rowCosines;
  const colCos = ref.columnCosines;
  const normal = cross(rowCos, colCos);
  const knownPos = new Map(known.map(i => [i, dot(planes[i].imagePositionPatient, normal)]));

  const first = known[0];
  const last = known[known.length - 1];
  let step; // mm per slice index
  if (last > first) {
    step = (knownPos.get(last) - knownPos.get(first)) / (last - first);
  } else {
    step = Number(ref.spacingBetweenSlices) || Number(ref.sliceThickness) || NaN;
  }
  const positions = imageIds.map((_, i) => knownPos.get(i) ?? knownPos.get(first) + (i - first) * step);
  const spacing = Math.abs(step);
  return { calibrated: spacing > 0, positions, spacing, rowCos, colCos, normal };
}

// Contour outline in mm along the image's row/column directions
function projectedPoints(annotation, rowCos, colCos) {
  const { data } = annotation;
  const points = data.contour?.polyline ?? data.handles?.points ?? [];
  return points.map(p => [dot(p, rowCos), dot(p, colCos)]);
}

// Area (mm²) from the contour's own geometry
function contourArea(toolName, pts) {
  if (toolName === "CircleROI" && pts.length >= 2) {
    const r = dist(pts[0], pts[1]); // handles: [centre, point on the edge]
    return Math.PI * r * r;
  }
  if (toolName === "EllipticalROI" && pts.length >= 4) {
    return Math.PI * (dist(pts[0], pts[1]) / 2) * (dist(pts[2], pts[3]) / 2); // [bottom, top, left, right]
  }
  if (toolName === "RectangleROI" && pts.length >= 4) {
    return dist(pts[0], pts[1]) * dist(pts[0], pts[2]); // [top-left, top-right, bottom-left, bottom-right]
  }
  if (pts.length < 3) return 0;
  let twice = 0; // shoelace formula for polygons
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    twice += x1 * y2 - x2 * y1;
  }
  return Math.abs(twice) / 2;
}

// Points along the contour's outline (in-plane mm), for its size: circles and ellipses
// are stored as handles, not outlines, so they're traced
const TRACE_POINTS = 32;
function outlinePoints(toolName, pts) {
  const trace = (centre, a, b) => Array.from({ length: TRACE_POINTS }, (_, n) => {
    const t = (2 * Math.PI * n) / TRACE_POINTS;
    return [centre[0] + a[0] * Math.cos(t) + b[0] * Math.sin(t), centre[1] + a[1] * Math.cos(t) + b[1] * Math.sin(t)];
  });
  if (toolName === "CircleROI" && pts.length >= 2) {
    const r = dist(pts[0], pts[1]);
    return trace(pts[0], [r, 0], [0, r]);
  }
  if (toolName === "EllipticalROI" && pts.length >= 4) {
    const [bottom, top, left, right] = pts;
    const centre = [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2];
    return trace(centre, [(right[0] - left[0]) / 2, (right[1] - left[1]) / 2], [(top[0] - bottom[0]) / 2, (top[1] - bottom[1]) / 2]);
  }
  return pts;
}

function contourBounds(toolName, pts) {
  let box = pts;
  if (toolName === "CircleROI" && pts.length >= 2) {
    const r = dist(pts[0], pts[1]);
    box = [[pts[0][0] - r, pts[0][1] - r], [pts[0][0] + r, pts[0][1] + r]];
  }
  const xs = box.map(p => p[0]);
  const ys = box.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

const overlaps = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

// This stack's area contours, with slice index, area and (if displayed) mean intensity
function stackContours(imageIds, toolNames) {
  const geometry = stackGeometry(imageIds);
  const sliceByImageId = new Map(imageIds.map((id, i) => [id, i]));
  const contours = [];
  for (const annotation of csAnnotation.state.getAllAnnotations() ?? []) {
    const { metadata, data } = annotation;
    if (!toolNames.has(metadata?.toolName)) continue;
    const slice = sliceByImageId.get(metadata.referencedImageId);
    if (slice === undefined) continue;
    const stats = data.cachedStats?.[`imageId:${metadata.referencedImageId}`];
    const pts = geometry.calibrated ? projectedPoints(annotation, geometry.rowCos, geometry.colCos) : [];
    contours.push({
      annotation,
      // Contours saved before naming existed stay separate per slice rather than all
      // merging into one "Unnamed" ROI with a meaningless volume
      name: data.label || `Unnamed · slice ${slice + 1}`,
      slice,
      area: geometry.calibrated ? contourArea(metadata.toolName, pts) : null,
      bounds: pts.length ? contourBounds(metadata.toolName, pts) : null,
      outline: pts.length ? outlinePoints(metadata.toolName, pts) : [],
      mean: typeof stats?.mean === "number" ? stats.mean : null,
      unit: stats?.modalityUnit ?? "",
    });
  }
  return { contours, geometry };
}

// Every named ROI on this stack. volume is null until the ROI spans 2+ slices (a single
// slice has no volume) or when the images carry no geometry to measure in mm.
export function listRois(imageIds, toolNames) {
  if (!imageIds?.length) return [];
  const { contours, geometry } = stackContours(imageIds, toolNames);
  const byName = new Map();
  contours.forEach(c => {
    if (!byName.has(c.name)) byName.set(c.name, []);
    byName.get(c.name).push(c);
  });

  return [...byName.entries()].map(([name, members]) => {
    // Contours on the same slice add up (e.g. a structure split in two on that slice)
    const areaBySlice = new Map();
    members.forEach(c => areaBySlice.set(c.slice, (areaBySlice.get(c.slice) ?? 0) + (c.area ?? 0)));
    const slices = [...areaBySlice.keys()].sort((a, b) => a - b);

    let volumeCm3 = null;
    if (slices.length >= 2 && geometry.calibrated && geometry.spacing > 0) {
      const first = slices[0];
      const last = slices[slices.length - 1];
      let mm3 = ((areaBySlice.get(first) + areaBySlice.get(last)) / 2) * geometry.spacing;
      for (let k = 0; k < slices.length - 1; k++) {
        const gapMm = Math.abs(geometry.positions[slices[k + 1]] - geometry.positions[slices[k]]);
        mm3 += ((areaBySlice.get(slices[k]) + areaBySlice.get(slices[k + 1])) / 2) * gapMm;
      }
      volumeCm3 = mm3 / 1000;
    }

    // AP × TR × CC size, alongside the volume: the outlines placed back in patient
    // coordinates, plus half a slice at each end (as the volume counts it)
    let sizeMm = null;
    if (volumeCm3 != null) {
      const { rowCos, colCos, normal } = geometry;
      const extent = createExtent();
      members.forEach(c => {
        const n = geometry.positions[c.slice];
        c.outline.forEach(([u, v]) => addPoint(extent,
          u * rowCos[0] + v * colCos[0] + n * normal[0],
          u * rowCos[1] + v * colCos[1] + n * normal[1],
          u * rowCos[2] + v * colCos[2] + n * normal[2]));
      });
      sizeMm = extentSize(extent, normal.map(x => Math.abs(x) * geometry.spacing));
    }

    // Area-weighted mean over the contours that have been displayed (and so have stats)
    const measured = members.filter(c => c.mean != null && c.area);
    const weight = measured.reduce((sum, c) => sum + c.area, 0);
    const mean = weight > 0 ? measured.reduce((sum, c) => sum + c.mean * c.area, 0) / weight : null;

    return {
      name,
      contourCount: members.length,
      slices: slices.map(s => s + 1),
      firstSlice: slices[0] + 1,
      lastSlice: slices[slices.length - 1] + 1,
      skippedSlices: slices[slices.length - 1] - slices[0] + 1 - slices.length,
      volumeCm3,
      sizeMm,
      mean,
      meanUnit: measured[0]?.unit ?? "",
      meanFromContours: measured.length,
    };
  }).sort((a, b) => a.firstSlice - b.firstSlice);
}

// Default name for a just-drawn contour: the name of an overlapping contour within a few
// slices (most likely the same structure, continued), otherwise the next free "ROI N".
export function suggestRoiName(annotation, imageIds, toolNames) {
  const { contours } = stackContours(imageIds, toolNames);
  const self = contours.find(c => c.annotation === annotation);
  const others = contours.filter(c => c.annotation !== annotation && c.annotation.data.label);
  if (self?.bounds) {
    const match = others
      .filter(c => c.bounds && c.slice !== self.slice && Math.abs(c.slice - self.slice) <= MAX_SLICE_GAP && overlaps(c.bounds, self.bounds))
      .sort((a, b) => Math.abs(a.slice - self.slice) - Math.abs(b.slice - self.slice))[0];
    if (match) return match.annotation.data.label;
  }
  const used = others.map(c => /^ROI (\d+)$/.exec(c.annotation.data.label)?.[1]).filter(Boolean).map(Number);
  return `ROI ${Math.max(0, ...used) + 1}`;
}

// Rename every contour of an ROI (renaming onto an existing name merges the two ROIs)
export function renameRoi(imageIds, toolNames, oldName, newName) {
  stackContours(imageIds, toolNames).contours
    .filter(c => c.name === oldName)
    .forEach(c => csToolsUtilities.setAnnotationLabel(c.annotation, undefined, newName));
}

export function deleteRoi(imageIds, toolNames, name) {
  stackContours(imageIds, toolNames).contours
    .filter(c => c.name === name)
    .forEach(c => csAnnotation.state.removeAnnotation(c.annotation.annotationUID));
}

// ── Cross-sections of ROI contours on other planes (MPR sagittal/coronal panes) ──

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return scale(a, 1 / l); };

// A contour's outline as a closed world-space polygon (ellipses/circles sampled)
function contourOutlineWorld(annotation) {
  const { metadata, data } = annotation;
  const pts = data.contour?.polyline ?? data.handles?.points ?? [];
  const ring = (center, axisA, axisB) => Array.from({ length: 48 }, (_, i) => {
    const t = (i / 48) * 2 * Math.PI;
    return add(center, add(scale(axisA, Math.cos(t)), scale(axisB, Math.sin(t))));
  });
  if (metadata.toolName === "CircleROI" && pts.length >= 2) {
    const radius = sub(pts[1], pts[0]); // [centre, point on the edge]
    const normal = norm(metadata.viewPlaneNormal ?? [0, 0, 1]);
    return ring(pts[0], radius, scale(norm(cross(normal, radius)), Math.hypot(...radius)));
  }
  if (metadata.toolName === "EllipticalROI" && pts.length >= 4) {
    const [bottom, top, left, right] = pts;
    return ring(scale(add(top, bottom), 0.5), scale(sub(top, bottom), 0.5), scale(sub(right, left), 0.5));
  }
  if (metadata.toolName === "RectangleROI" && pts.length >= 4) {
    return [pts[0], pts[1], pts[3], pts[2]]; // corners in drawing order around the edge
  }
  return pts;
}

// Every named area contour as a world polygon with its plane normal. colour is stable per name.
export function roiContoursInWorld() {
  return (csAnnotation.state.getAllAnnotations() ?? [])
    .filter(a => AREA_ROI_TOOL_NAMES.has(a.metadata?.toolName))
    .map(a => ({
      name: a.data?.label || "Unnamed",
      normal: norm(a.metadata.viewPlaneNormal ?? [0, 0, 1]),
      outline: contourOutlineWorld(a),
    }))
    .filter(c => c.outline.length >= 3);
}

export function roiColor(name) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360}, 85%, 60%)`;
}

// Where a planar contour crosses another plane (point + normal): world-space segments.
// Returns [] when the planes are (nearly) parallel — that pane shows the contour itself.
export function contourCrossSection(contour, planePoint, planeNormal) {
  if (Math.abs(dot(contour.normal, planeNormal)) > 0.99) return [];
  const side = (p) => dot(sub(p, planePoint), planeNormal);
  const hits = [];
  const { outline } = contour;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const sa = side(a);
    const sb = side(b);
    if ((sa < 0) === (sb < 0) || sa === sb) continue;
    hits.push(add(a, scale(sub(b, a), sa / (sa - sb))));
  }
  // Order along the intersection line and pair them up (inside/outside alternate)
  const along = cross(contour.normal, planeNormal);
  hits.sort((p, q) => dot(p, along) - dot(q, along));
  const segments = [];
  for (let i = 0; i + 1 < hits.length; i += 2) segments.push([hits[i], hits[i + 1]]);
  return segments;
}

// The first contour of a named ROI and its world outline — "Grow to 3D" seeds from it and
// the MPR ROI list centres the crosshairs on it. Matches names exactly as listRois does.
export function roiFirstContour(imageIds, name) {
  const fromStack = stackContours(imageIds ?? [], AREA_ROI_TOOL_NAMES).contours
    .filter(c => c.name === name)
    .sort((a, b) => a.slice - b.slice)[0]?.annotation;
  // Contours drawn on MPR sagittal/coronal panes aren't on the stack's images
  const annotation = fromStack ?? (csAnnotation.state.getAllAnnotations() ?? [])
    .find(a => AREA_ROI_TOOL_NAMES.has(a.metadata?.toolName) && a.data?.label === name);
  if (!annotation) return null;
  const outline = contourOutlineWorld(annotation);
  const centroid = outline.reduce((sum, p) => add(sum, p), [0, 0, 0]).map(v => v / (outline.length || 1));
  return { annotation, outline, centroid };
}
