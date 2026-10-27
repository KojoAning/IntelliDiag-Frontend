// Grows a region drawn on one slice through the neighbouring slices, the way Horos/OsiriX
// "grow region" does, so a structure outlined once gets a full 3D volume.
//
// The drawn area sets an intensity window. Outlines are drawn *around* a structure, so
// their rim is usually background: the window comes from the outline's core (the pixels
// furthest from its edge), using median ± tolerance·σ where σ is estimated robustly from the
// median absolute deviation — a loose rim can't drag it toward the background or widen it.
// Then, slice by slice in both directions, the region keeps the in-window voxels that are
// connected to the previous slice's region. Growth stops when the structure ends (the
// region shrinks away), when a slice suddenly balloons, or when it outgrows the outline —
// the usual signs of leaking into neighbouring tissue of similar intensity.

const MIN_REGION_FRACTION = 0.05; // stop once a slice keeps < 5% of the drawn area...
const MIN_REGION_VOXELS = 4;      // ...or fewer than this many voxels
const MAX_GROWTH_RATIO = 1.6;     // a slice more than 1.6× the previous one is treated as a leak
const MAX_AREA_FACTOR = 2;        // ...as is a slice more than 2× the drawn outline (slow, creeping leaks)
const CORE_FRACTION = 0.4;        // intensity stats come from pixels at ≥ 40% of the deepest distance from the outline's edge
const MIN_SD_FRACTION = 0.02;     // floor for σ (as a fraction of the median) on very uniform regions
const MAD_TO_SD = 1.4826;         // σ of a normal distribution = 1.4826 × its median absolute deviation

// The seed's core: pixels far from its edge (distance via BFS from the edge pixels)
function seedCore(seed) {
  const key = (a, b) => `${a},${b}`;
  const inSeed = new Set(seed.map(([a, b]) => key(a, b)));
  const distance = new Map();
  const queue = [];
  seed.forEach(([a, b]) => {
    const onEdge = [[a - 1, b], [a + 1, b], [a, b - 1], [a, b + 1]].some(([x, y]) => !inSeed.has(key(x, y)));
    if (onEdge) { distance.set(key(a, b), 0); queue.push([a, b]); }
  });
  for (let qi = 0; qi < queue.length; qi++) {
    const [a, b] = queue[qi];
    const d = distance.get(key(a, b));
    for (const [x, y] of [[a - 1, b], [a + 1, b], [a, b - 1], [a, b + 1]]) {
      const k = key(x, y);
      if (!inSeed.has(k) || distance.has(k)) continue;
      distance.set(k, d + 1);
      queue.push([x, y]);
    }
  }
  const deepest = Math.max(0, ...distance.values());
  const core = seed.filter(([a, b]) => distance.get(key(a, b)) >= deepest * CORE_FRACTION);
  return core.length ? core : seed;
}

const median = (values) => {
  const sorted = Float64Array.from(values).sort();
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// scalars: the volume's voxel values (index = i + j·w + k·w·h)
// dims: [w, h, d]
// seed: [[a, b], ...] voxel coords on the drawn slice, along varyingAxes
// isFree(voxelIndex): whether growth may claim that voxel (e.g. not another region's)
// Returns { voxels: [voxelIndex, ...] including the seed, sliceMin, sliceMax, window: [lo, hi] }
export function growRegionThroughSlices({ scalars, dims, seed, fixedAxis, fixedValue, varyingAxes, tolerance, isFree }) {
  const [w, h] = dims;
  const sizeA = dims[varyingAxes[0]];
  const sizeB = dims[varyingAxes[1]];
  const sliceCount = dims[fixedAxis];
  const coord = [0, 0, 0];
  const voxelIndex = (a, b, f) => {
    coord[varyingAxes[0]] = a;
    coord[varyingAxes[1]] = b;
    coord[fixedAxis] = f;
    return coord[0] + coord[1] * w + coord[2] * w * h;
  };

  const coreValues = seedCore(seed).map(([a, b]) => scalars[voxelIndex(a, b, fixedValue)]);
  const center = median(coreValues);
  const sd = Math.max(MAD_TO_SD * median(coreValues.map(v => Math.abs(v - center))), Math.abs(center) * MIN_SD_FRACTION, 1e-6);
  const lo = center - tolerance * sd;
  const hi = center + tolerance * sd;
  const inWindow = (idx) => scalars[idx] >= lo && scalars[idx] <= hi;

  const voxels = seed.map(([a, b]) => voxelIndex(a, b, fixedValue));
  let sliceMin = fixedValue;
  let sliceMax = fixedValue;
  const minVoxels = Math.max(MIN_REGION_VOXELS, Math.round(seed.length * MIN_REGION_FRACTION));

  for (const dir of [-1, 1]) {
    let prev = seed;
    for (let f = fixedValue + dir; f >= 0 && f < sliceCount; f += dir) {
      // Keep growth near the previous slice's region — a structure doesn't jump sideways
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      prev.forEach(([a, b]) => {
        if (a < minA) minA = a;
        if (a > maxA) maxA = a;
        if (b < minB) minB = b;
        if (b > maxB) maxB = b;
      });
      const margin = Math.max(3, Math.round(0.25 * Math.max(maxA - minA, maxB - minB)));
      minA = Math.max(0, minA - margin);
      maxA = Math.min(sizeA - 1, maxA + margin);
      minB = Math.max(0, minB - margin);
      maxB = Math.min(sizeB - 1, maxB + margin);

      // Flood fill this slice from the previous region's footprint, through in-window voxels
      const visited = new Uint8Array(sizeA * sizeB);
      const queue = [];
      prev.forEach(([a, b]) => {
        const idx = voxelIndex(a, b, f);
        if (!visited[a + b * sizeA] && inWindow(idx) && isFree(idx)) {
          visited[a + b * sizeA] = 1;
          queue.push([a, b]);
        }
      });
      for (let qi = 0; qi < queue.length; qi++) {
        const [a, b] = queue[qi];
        for (const [na, nb] of [[a - 1, b], [a + 1, b], [a, b - 1], [a, b + 1]]) {
          if (na < minA || na > maxA || nb < minB || nb > maxB || visited[na + nb * sizeA]) continue;
          const idx = voxelIndex(na, nb, f);
          if (!inWindow(idx) || !isFree(idx)) continue;
          visited[na + nb * sizeA] = 1;
          queue.push([na, nb]);
        }
      }

      if (queue.length < minVoxels) break;                          // structure ended
      if (queue.length > MAX_GROWTH_RATIO * prev.length + 10) break; // leaking (sudden)
      if (queue.length > MAX_AREA_FACTOR * seed.length) break;      // leaking (creeping)
      queue.forEach(([a, b]) => voxels.push(voxelIndex(a, b, f)));
      if (f < sliceMin) sliceMin = f;
      if (f > sliceMax) sliceMax = f;
      prev = queue;
    }
  }

  return { voxels, sliceMin, sliceMax, window: [lo, hi] };
}
