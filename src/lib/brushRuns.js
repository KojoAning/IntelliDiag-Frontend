// Brush-painted regions are stored per slice, as runs of painted pixels: { [imageId]:
// [start, length, …] } with start = row × columns + column on that image. The 2D view
// paints one image at a time and the 3-plane view holds the slices as a volume (in
// position order, not the 2D view's) — keying by image lets either read what the other
// painted. annotationPersistence swaps the imageIds for image record keys when saving.

// Runs of the wanted labels in a label array of whole slices:
// Map<label, Map<sliceIndex, [start, length, …]>> — runs never cross a slice boundary
export function encodeSliceRuns(labels, wanted, sliceSize) {
  const out = new Map();
  const push = (label, slice, start, length) => {
    if (!out.has(label)) out.set(label, new Map());
    const bySlice = out.get(label);
    if (!bySlice.has(slice)) bySlice.set(slice, []);
    bySlice.get(slice).push(start, length);
  };
  for (let base = 0, slice = 0; base < labels.length; base += sliceSize, slice++) {
    const end = Math.min(labels.length, base + sliceSize);
    let current = 0;
    let start = 0;
    for (let i = base; i <= end; i++) {
      const v = i < end ? labels[i] : -1;
      if (v === current) continue;
      if (wanted.has(current)) push(current, slice, start - base, i - start);
      current = v;
      start = i;
    }
  }
  return out;
}

// Paint runs into a label array at an offset (a slice's start), only over unlabelled
// pixels — a region never overwrites an AI finding or another region. Returns the count.
export function applyRuns(target, runs, label, offset = 0, sliceSize = Infinity) {
  let painted = 0;
  for (let r = 0; r + 1 < runs.length; r += 2) {
    const from = Math.max(0, runs[r]);
    const to = Math.min(sliceSize, runs[r] + runs[r + 1]);
    for (let i = from; i < to; i++) {
      const idx = offset + i;
      if (idx >= target.length) break;
      if (target[idx] === 0) { target[idx] = label; painted++; }
    }
  }
  return painted;
}
