// RECIST 1.1 from the viewer's bidirectional measurements: each one is a lesion with a
// long and short axis. Tumours are tracked by their long axis, lymph nodes by their short
// axis; up to 5 target lesions (2 per organ) are summed, and the sum is compared with the
// baseline and the smallest sum so far (nadir) to give the response category.
//
// The lesion's RECIST details (tumour or node, organ, target or not) live on the
// annotation itself (data.recist), so they're saved and restored with the measurement.
import { metaData } from "@cornerstonejs/core";
import { annotation as csAnnotation, BidirectionalTool } from "@cornerstonejs/tools";

const MIN_TUMOUR_MM = 10;          // measurable tumour: long axis ≥ 10 mm (or 2× slice thickness if thicker)
const MIN_NODE_TARGET_MM = 15;     // node short axis ≥ 15 mm: measurable (target)
const MIN_NODE_PATHOLOGICAL_MM = 10; // 10–15 mm: pathological but non-measurable; < 10 mm: normal
const MAX_TARGETS = 5;
const MAX_TARGETS_PER_ORGAN = 2;
const PR_DECREASE = 0.3;           // ≥ 30% smaller than baseline
const PD_INCREASE = 0.2;           // ≥ 20% larger than nadir…
const PD_MIN_ABSOLUTE_MM = 5;      // …and at least 5 mm larger

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const lesionAnnotations = (imageIds) => {
  const onSeries = new Set(imageIds);
  return (csAnnotation.state.getAllAnnotations() ?? [])
    .filter(a => a.metadata?.toolName === BidirectionalTool.toolName && onSeries.has(a.metadata.referencedImageId));
};

// "Lesion N" with the next free number on this series
export function suggestLesionName(imageIds) {
  const used = new Set(lesionAnnotations(imageIds).map(a => a.data?.label));
  let n = 1;
  while (used.has(`Lesion ${n}`)) n++;
  return `Lesion ${n}`;
}

// The series' lesions, in slice order: { uid, name, sliceIndex, long, short, unit, type, organ, target }
// Axes come from the handles (world coordinates are mm), so they're right even before
// a restored measurement has rendered and computed its own stats.
export function listRecistLesions(imageIds) {
  const indexById = new Map(imageIds.map((id, i) => [id, i]));
  return lesionAnnotations(imageIds)
    .map(a => {
      const points = a.data?.handles?.points ?? [];
      if (points.length < 4) return null;
      const axes = [dist(points[0], points[1]), dist(points[2], points[3])];
      const plane = metaData.get("imagePlaneModule", a.metadata.referencedImageId);
      const hasSpacing = plane?.rowPixelSpacing > 0 && !plane.usingDefaultValues;
      const recist = a.data.recist ?? {};
      return {
        uid: a.annotationUID,
        name: a.data.label || "Lesion",
        sliceIndex: indexById.get(a.metadata.referencedImageId),
        long: Math.max(...axes),
        short: Math.min(...axes),
        unit: hasSpacing ? "mm" : "px",
        sliceThickness: plane?.sliceThickness ?? null,
        type: recist.type ?? "tumour",   // "tumour" | "node"
        organ: recist.organ ?? "",
        target: recist.target ?? true,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sliceIndex - b.sliceIndex || a.name.localeCompare(b.name));
}

// patch: any of { type, organ, target }, or { name } to rename
export function updateRecistLesion(uid, patch) {
  const a = csAnnotation.state.getAnnotation(uid);
  if (!a) return;
  const { name, ...recist } = patch;
  if (name != null) a.data.label = name;
  if (Object.keys(recist).length) a.data.recist = { ...(a.data.recist ?? {}), ...recist };
}

// The axis RECIST tracks for this lesion, and whether it's measurable
export function lesionMeasure(lesion) {
  if (lesion.type === "node") {
    const size = lesion.short;
    return {
      size,
      measurable: size >= MIN_NODE_TARGET_MM,
      note: size >= MIN_NODE_TARGET_MM ? null
        : size >= MIN_NODE_PATHOLOGICAL_MM ? "Pathological node under 15 mm short axis: non-target"
          : "Normal-sized node (under 10 mm short axis)",
    };
  }
  const minimum = Math.max(MIN_TUMOUR_MM, 2 * (lesion.sliceThickness ?? 0));
  return {
    size: lesion.long,
    measurable: lesion.long >= minimum,
    note: lesion.long >= minimum ? null : `Under ${minimum} mm long axis: not measurable`,
  };
}

// lesions: from listRecistLesions. baseline / nadir: earlier sums in mm (null if not known).
// newLesion: a new lesion has appeared (always progression).
export function assessRecist(lesions, { baseline = null, nadir = null, newLesion = false } = {}) {
  const warnings = [];
  if (lesions.some(l => l.unit !== "mm")) warnings.push("Some images have no pixel spacing, so their sizes are in pixels and can't be used.");

  const targets = lesions.filter(l => l.target && l.unit === "mm");
  // Size limits only decide what can be a target at baseline; at follow-up a target is
  // measured whatever its size (a shrunken node still counts its short axis)
  const isBaseline = baseline == null && nadir == null;
  if (isBaseline) {
    targets.forEach(l => {
      const { note, measurable } = lesionMeasure(l);
      if (!measurable && note) warnings.push(`${l.name}: ${note}.`);
    });
  }
  if (targets.length > MAX_TARGETS) warnings.push(`${targets.length} target lesions — RECIST allows at most ${MAX_TARGETS}.`);
  const byOrgan = new Map();
  targets.forEach(l => {
    const organ = l.organ.trim().toLowerCase();
    if (organ) byOrgan.set(organ, (byOrgan.get(organ) ?? 0) + 1);
  });
  byOrgan.forEach((count, organ) => {
    if (count > MAX_TARGETS_PER_ORGAN) warnings.push(`${count} targets in ${organ} — at most ${MAX_TARGETS_PER_ORGAN} per organ.`);
  });

  const sum = targets.reduce((total, l) => total + lesionMeasure(l).size, 0);
  const reference = nadir ?? baseline;
  const changeFromBaseline = baseline > 0 ? (sum - baseline) / baseline : null;
  const changeFromNadir = reference > 0 ? (sum - reference) / reference : null;

  let category = null;
  if (newLesion) category = "PD";
  else if (baseline != null || nadir != null) {
    const tumoursGone = !targets.some(l => l.type === "tumour");
    const nodesNormal = targets.filter(l => l.type === "node").every(l => l.short < MIN_NODE_PATHOLOGICAL_MM);
    if (reference != null && sum - reference >= PD_MIN_ABSOLUTE_MM && sum >= reference * (1 + PD_INCREASE)) category = "PD";
    else if (baseline > 0 && tumoursGone && nodesNormal) category = "CR";
    else if (baseline > 0 && sum <= baseline * (1 - PR_DECREASE)) category = "PR";
    else category = "SD";
  }

  return { targets, sum, changeFromBaseline, changeFromNadir, category, warnings };
}

export const RECIST_CATEGORIES = {
  CR: { name: "Complete response", color: "#22C55E" },
  PR: { name: "Partial response", color: "#7DD3FC" },
  SD: { name: "Stable disease", color: "#FACC15" },
  PD: { name: "Progressive disease", color: "#F87171" },
};
