/**
 * Size of a region along the patient's own axes — front-to-back (AP), side-to-side (TR),
 * head-to-foot (CC) — the "3.2 × 2.1 × 4.0 cm" a radiologist writes. Measured in patient
 * (world) coordinates, so tilted acquisitions are right; for irregular shapes it's the box
 * around the region. Same convention as the inference service (services/measurements.py).
 *
 * DICOM patient space is LPS: x runs side to side, y front to back, z head to foot.
 */

// Running extent of world points; footprint = one voxel's reach along x, y, z (mm)
export function createExtent() {
  return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
}

export function addPoint(extent, x, y, z) {
  const { min, max } = extent;
  if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
  if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
  if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
}

// → { ap, tr, cc } in mm, or null when nothing was added
export function extentSize(extent, footprint = [0, 0, 0]) {
  if (!(extent.max[0] >= extent.min[0])) return null;
  const span = i => Math.round((extent.max[i] - extent.min[i] + footprint[i]) * 10) / 10;
  return { tr: span(0), ap: span(1), cc: span(2) };
}

// One voxel's reach along each world axis, from the volume's direction (Cornerstone's
// 9 numbers: index axis i's unit vector at [3i, 3i+2]) and spacing
export function voxelFootprint(direction, spacing) {
  return [0, 1, 2].map(w => [0, 1, 2].reduce((sum, i) => sum + Math.abs(direction[i * 3 + w]) * spacing[i], 0));
}

// { ap, tr, cc } mm → "3.2 × 2.1 × 4.0 cm" (mm when all are under 1 cm)
export function formatSize(size) {
  if (!size) return null;
  const values = [size.ap, size.tr, size.cc];
  if (Math.max(...values) < 10) return `${values.map(v => v.toFixed(0)).join(" × ")} mm`;
  return `${values.map(v => (v / 10).toFixed(1)).join(" × ")} cm`;
}

export const SIZE_AXES_LABEL = "AP × TR × CC";
