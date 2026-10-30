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

// Paint runs into a label array at an offset (a slice's start), only over pixels
// canPaint allows (by default unlabelled ones — a region never overwrites an AI finding or
// another region). Returns the count.
export function applyRuns(target, runs, label, offset = 0, sliceSize = Infinity, canPaint = v => v === 0) {
  let painted = 0;
  for (let r = 0; r + 1 < runs.length; r += 2) {
    const from = Math.max(0, runs[r]);
    const to = Math.min(sliceSize, runs[r] + runs[r + 1]);
    for (let i = from; i < to; i++) {
      const idx = offset + i;
      if (idx >= target.length) break;
      if (canPaint(target[idx])) { target[idx] = label; painted++; }
    }
  }
  return painted;
}

// Compact form for saving: each run as (gap since the previous run's end, length), as
// unsigned LEB128 varints, base64 — a few times smaller than the JSON number list, which
// keeps a save under the 64 KB limit of a request sent while the tab closes. unpackRuns
// also takes the plain number list (older saves).
export function packRuns(runs) {
  const bytes = [];
  const varint = (v) => {
    let n = Math.max(0, Math.floor(v));
    do {
      let b = n & 0x7f;
      n = Math.floor(n / 128);
      if (n > 0) b |= 0x80;
      bytes.push(b);
    } while (n > 0);
  };
  let end = 0;
  for (let i = 0; i + 1 < runs.length; i += 2) {
    varint(runs[i] - end);
    varint(runs[i + 1]);
    end = runs[i] + runs[i + 1];
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function unpackRuns(packed) {
  if (Array.isArray(packed)) return packed;
  if (typeof packed !== "string") return [];
  const binary = atob(packed);
  const runs = [];
  let i = 0;
  const varint = () => {
    let n = 0, mult = 1, b;
    do {
      b = binary.charCodeAt(i++);
      n += (b & 0x7f) * mult;
      mult *= 128;
    } while (b & 0x80 && i < binary.length);
    return n;
  };
  let end = 0;
  while (i < binary.length) {
    const start = end + varint();
    const length = varint();
    runs.push(start, length);
    end = start + length;
  }
  return runs;
}
