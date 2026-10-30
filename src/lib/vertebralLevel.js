// The vertebral level of a region on a whole-body CT result ("L3"): the vertebra whose
// head-to-foot extent holds the region's centre, else the nearest one within MAX_GAP_MM.

const MAX_GAP_MM = 20;

// Legend entry → level ("L3") for the whole-body model's vertebra labels (vertebrae_L3), else null
export const levelOfLegend = (legend) =>
  (legend ?? []).map(entry => String(entry?.name ?? "").match(/^vertebrae_([CTLS]\d+)$/i)?.[1]?.toUpperCase() ?? null);

// class (1-based) -> [zMin, zMax] for every vertebra in the result. zAt(index) → world z (mm).
export function vertebraExtents(classes, levels, zAt) {
  const extents = new Map();
  for (let i = 0; i < classes.length; i++) {
    const c = classes[i];
    if (!c || !levels[c - 1]) continue;
    const z = zAt(i);
    const e = extents.get(c);
    if (!e) extents.set(c, [z, z]);
    else { if (z < e[0]) e[0] = z; if (z > e[1]) e[1] = z; }
  }
  return extents;
}

// The level at world height z, or null
export function levelAt(z, extents, levels) {
  let best = null, bestGap = Infinity;
  extents.forEach(([lo, hi], c) => {
    const gap = z < lo ? lo - z : z > hi ? z - hi : 0;
    if (gap < bestGap) { bestGap = gap; best = c; }
  });
  return best != null && bestGap <= MAX_GAP_MM ? levels[best - 1] : null;
}
