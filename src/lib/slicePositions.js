// Where each slice sits in the patient, read from the DICOM headers, so viewers showing
// different series of one study can scroll together (Horos's "sync by position"): the
// other viewers jump to their slice nearest the same point along the scan direction.
//
// Only series sharing a frame of reference (same patient position, usually the same
// study session) and cut in roughly the same plane are linked.
import dicomParser from "dicom-parser";

// Position tags (0020,xxxx) come long before large private blocks and pixel data, so
// the start of the file is enough; the whole file is read only if that isn't
const HEADER_BYTES = 256 * 1024;
const PARALLEL_COS = 0.9; // planes within ~25° of each other count as the same orientation
const MIN_TOLERANCE_MM = 3;

const cache = new Map(); // imageId -> slice or null
const fileCache = new Map(); // multi-frame file URL -> Promise<(slice | null)[]> (one per frame)

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function numbers(dataSet, tag, count) {
  const values = (dataSet.string(tag) ?? "").split("\\").map(Number);
  return values.length === count && values.every(Number.isFinite) ? values : null;
}

function makeSlice(position, orientation, frameOfReferenceUID) {
  if (!position || !orientation || !frameOfReferenceUID) return null;
  const normal = cross(orientation.slice(0, 3), orientation.slice(3));
  const length = Math.hypot(...normal);
  if (!(length > 0.5)) return null;
  return { position, normal: normal.map(v => v / length), frameOfReferenceUID };
}

// { position, normal, frameOfReferenceUID } from a parsed header, or null
export function sliceFromDataSet(dataSet) {
  return makeSlice(numbers(dataSet, "x00200032", 3), numbers(dataSet, "x00200037", 6), (dataSet.string("x00200052") ?? "").trim());
}

const firstItem = (dataSet, tag) => dataSet?.elements[tag]?.items?.[0]?.dataSet ?? null;

// One slice (or null) per frame of an enhanced multi-frame file (enhanced CT/MR, some
// XA): each frame's position is in its Per-frame Functional Groups item (Plane Position),
// the orientation there or in the Shared Functional Groups. [] when the file has none.
export function framesFromDataSet(dataSet) {
  const frameOfReferenceUID = (dataSet.string("x00200052") ?? "").trim();
  const shared = firstItem(dataSet, "x52009229");
  const perFrame = dataSet.elements.x52009230?.items ?? [];
  const sharedPosition = numbers(firstItem(shared, "x00209113") ?? dataSet, "x00200032", 3);
  const sharedOrientation = numbers(firstItem(shared, "x00209116") ?? dataSet, "x00200037", 6);
  return perFrame.map(({ dataSet: frame }) => {
    const position = numbers(firstItem(frame, "x00209113") ?? dataSet, "x00200032", 3) ?? sharedPosition;
    const orientation = numbers(firstItem(frame, "x00209116") ?? dataSet, "x00200037", 6) ?? sharedOrientation;
    return makeSlice(position, orientation, frameOfReferenceUID);
  });
}

// whole: parse up to the pixel data however far that is (multi-frame functional groups
// can run past HEADER_BYTES, and a cut that happens to fall between elements wouldn't fail)
async function readHeader(url, { whole = false } = {}) {
  const blob = await (await fetch(url)).blob();
  const parse = async (part) => dicomParser.parseDicom(new Uint8Array(await part.arrayBuffer()), { untilTag: "x7fe00010" });
  if (whole) return parse(blob);
  try { return await parse(blob.slice(0, HEADER_BYTES)); }
  catch { return parse(blob); }
}

async function readSlice(imageId) {
  const match = imageId.match(/^wadouri:(.*)$/);
  if (!match) return null;
  // Multi-frame: wadouri:<file>?frame=N (lib/dicomUtils) — the file's header is read once
  const frame = match[1].match(/^(.*)[?&]frame=(\d+)$/);
  if (!frame) return sliceFromDataSet(await readHeader(match[1]));
  const [, url, n] = frame;
  if (!fileCache.has(url)) {
    fileCache.set(url, readHeader(url, { whole: true }).then(framesFromDataSet).catch(() => []));
  }
  return (await fileCache.get(url))[Number(n)] ?? null;
}

// Typical gap between neighbouring slices along the scan direction (median), in mm
export function sliceSpacing(slices) {
  const first = slices.find(Boolean);
  if (!first) return null;
  const depths = slices.filter(Boolean).map(s => dot(s.position, first.normal)).sort((a, b) => a - b);
  const gaps = depths.slice(1).map((d, i) => d - depths[i]).filter(g => g > 1e-3).sort((a, b) => a - b);
  return gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;
}

// { slices: (slice | null)[] in imageIds order, spacing } — slices that can't be read are null
export async function readSlicePositions(imageIds) {
  const slices = await Promise.all(imageIds.map(async (imageId) => {
    if (!cache.has(imageId)) cache.set(imageId, await readSlice(imageId).catch(() => null));
    return cache.get(imageId);
  }));
  return { slices, spacing: sliceSpacing(slices) };
}

const sameFrame = (a, b) => a.frameOfReferenceUID === b.frameOfReferenceUID && Math.abs(dot(a.normal, b.normal)) >= PARALLEL_COS;

// Whether two series (from readSlicePositions) can scroll together
export function canLink(a, b) {
  const sa = a?.slices.find(Boolean);
  const sb = b?.slices.find(Boolean);
  return !!sa && !!sb && sameFrame(sa, sb);
}

// The index of target's slice nearest to `source` (one slice), or null when the series
// isn't linkable or has no slice near that point (it covers a shorter range)
export function matchSlice(source, target) {
  if (!source || !target) return null;
  let best = null;
  let bestDistance = Infinity;
  target.slices.forEach((slice, i) => {
    if (!slice || !sameFrame(slice, source)) return;
    const offset = [0, 1, 2].map(k => slice.position[k] - source.position[k]);
    const distance = Math.abs(dot(offset, source.normal));
    if (distance < bestDistance) { bestDistance = distance; best = i; }
  });
  if (best == null) return null;
  const tolerance = Math.max((target.spacing ?? 0) * 0.75, MIN_TOLERANCE_MM);
  return bestDistance <= tolerance ? best : null;
}

// ── Locked to a prior study ──
// A study from another day has its own frame of reference, so positions can't be matched
// directly. Instead the radiologist lines the two up by eye and locks them: from then on
// they scroll together keeping that offset along the scan direction (depth, in mm).

// The slice's depth along a direction (a unit normal)
export const depthAlong = (slice, normal) => dot(slice.position, normal);

// Whether a series is cut in the same plane as a direction (so depths compare)
export const parallelTo = (geometry, normal) => {
  const s = geometry?.slices.find(Boolean);
  return !!s && !!normal && Math.abs(dot(s.normal, normal)) >= PARALLEL_COS;
};

// The index of target's slice nearest a depth along normal, or null when it has none
// within its slice spacing (the depth is beyond the range it covers)
export function sliceAtDepth(target, normal, depth) {
  if (!parallelTo(target, normal)) return null;
  let best = null;
  let bestDistance = Infinity;
  target.slices.forEach((slice, i) => {
    if (!slice) return;
    const distance = Math.abs(dot(slice.position, normal) - depth);
    if (distance < bestDistance) { bestDistance = distance; best = i; }
  });
  const tolerance = Math.max((target.spacing ?? 0) * 0.75, MIN_TOLERANCE_MM);
  return best != null && bestDistance <= tolerance ? best : null;
}
