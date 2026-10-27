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

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function numbers(dataSet, tag, count) {
  const values = (dataSet.string(tag) ?? "").split("\\").map(Number);
  return values.length === count && values.every(Number.isFinite) ? values : null;
}

// { position, normal, frameOfReferenceUID } from a parsed header, or null
export function sliceFromDataSet(dataSet) {
  const position = numbers(dataSet, "x00200032", 3);
  const orientation = numbers(dataSet, "x00200037", 6);
  const frameOfReferenceUID = (dataSet.string("x00200052") ?? "").trim();
  if (!position || !orientation || !frameOfReferenceUID) return null;
  const normal = cross(orientation.slice(0, 3), orientation.slice(3));
  const length = Math.hypot(...normal);
  if (!(length > 0.5)) return null;
  return { position, normal: normal.map(v => v / length), frameOfReferenceUID };
}

async function readSlice(imageId) {
  // Single-frame DICOM only: multi-frame files keep per-frame positions elsewhere
  const match = imageId.match(/^wadouri:(.*)$/);
  if (!match || /[?&]frame=\d+$/.test(match[1])) return null;
  const blob = await (await fetch(match[1])).blob();
  const parse = async (part) => dicomParser.parseDicom(new Uint8Array(await part.arrayBuffer()), { untilTag: "x7fe00010" });
  let dataSet;
  try { dataSet = await parse(blob.slice(0, HEADER_BYTES)); }
  catch { dataSet = await parse(blob); }
  return sliceFromDataSet(dataSet);
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
