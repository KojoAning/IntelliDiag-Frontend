// Saves and restores viewer measurements per series (backend /series/{id}/annotations),
// so they survive reloads and series switches the way Horos keeps ROIs with the study.
//
// Cornerstone annotations point at images by imageId, which embeds a blob: URL that
// changes every session. Saving rewrites each reference to "<image record id>#<frame>",
// and restoring maps it back to the current session's imageId.
import {
  annotation as csAnnotation,
  LengthTool, AngleTool, EllipticalROITool, CircleROITool, RectangleROITool,
  ArrowAnnotateTool, ProbeTool, PlanarFreehandROITool, BidirectionalTool, CobbAngleTool, LabelTool,
} from "@cornerstonejs/tools";
import { packRuns, unpackRuns } from "./brushRuns";

// Freehand open-line drawing: a second PlanarFreehandROI instance under its own name, so
// pencil strokes are never treated as named ROIs (see the viewers' tool groups)
export const PENCIL_TOOL_NAME = "Pencil";

export const SAVED_TOOL_NAMES = new Set([
  ...[
    LengthTool, AngleTool, EllipticalROITool, CircleROITool, RectangleROITool,
    ArrowAnnotateTool, ProbeTool, PlanarFreehandROITool, BidirectionalTool, CobbAngleTool, LabelTool,
  ].map(T => T.toolName),
  PENCIL_TOOL_NAME,
]);

// Key images, the RECIST reference sums and the 3D view's drawn regions are saved alongside
// the measurements as entries of these types, but they aren't Cornerstone annotations — the
// viewer keeps them itself. A drawn region is saved as its outline in patient (world)
// coordinates and its growing tolerance; reopening grows it again from the outline.
const KEY_IMAGE_TYPE = "KeyImage";
const RECIST_REFERENCE_TYPE = "RecistReference";
const MPR_REGION_TYPE = "MprRegion";
const VIEWER_ENTRY_TYPES = new Set([KEY_IMAGE_TYPE, RECIST_REFERENCE_TYPE, MPR_REGION_TYPE]);

// Same imageId shapes buildImageIds (lib/dicomUtils) produces:
// wadouri:<src>, wadouri:<src>?frame=N (or &frame=N), web:<src>
function parseImageId(imageId) {
  const rest = imageId.replace(/^(wadouri|web):/, "");
  const match = rest.match(/[?&]frame=(\d+)$/);
  return { src: match ? rest.slice(0, match.index) : rest, frame: match ? Number(match[1]) : null };
}

function buildKeyMaps(imageIds, images) {
  const recordIdBySrc = new Map(images.map(img => [img.blobUrl ?? img.url, img.id]));
  const keyByImageId = new Map();
  const imageIdByKey = new Map();
  imageIds.forEach(imageId => {
    const { src, frame } = parseImageId(imageId);
    const recordId = recordIdBySrc.get(src);
    if (recordId == null) return;
    const key = `${recordId}#${frame ?? ""}`;
    keyByImageId.set(imageId, key);
    imageIdByKey.set(key, imageId);
  });
  return { keyByImageId, imageIdByKey };
}

// Plain-JSON copy: gl-matrix points can be Float32Arrays, which JSON would turn into objects
const toPlainJson = (value) => JSON.parse(JSON.stringify(value, (_k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v)));

// The measurements on this series' images, ready to save, plus
//   keyImageIds: iterable of imageIds flagged as key images
//   recistReference: { baseline, nadir, newLesion } entered in the RECIST panel
//   mprRegions: regions in the 3D view, either drawn and grown
//     { uid, outline, tolerance, number, voxelCount } (voxelCount: its size when saved, to
//     spot a regrowth that came out different) or painted with the brush
//     { uid, kind: "brush", number, voxelCount, slices: { [imageId]: [start, length, …] } }
//     (lib/brushRuns; saved keyed by image record, like measurements)
export function serializeAnnotations(imageIds, images, { keyImageIds = [], recistReference = null, mprRegions = [] } = {}) {
  const { keyByImageId } = buildKeyMaps(imageIds, images);
  const keyImages = [...keyImageIds]
    .filter(id => keyByImageId.has(id))
    .map(id => ({
      annotationUID: `key-image-${keyByImageId.get(id)}`,
      metadata: { toolName: KEY_IMAGE_TYPE, referencedImageId: keyByImageId.get(id) },
      data: {},
    }));
  const measurements = (csAnnotation.state.getAllAnnotations() ?? [])
    .filter(a => SAVED_TOOL_NAMES.has(a.metadata?.toolName) && keyByImageId.has(a.metadata?.referencedImageId))
    .map(a => {
      const { cachedStats: _stats, ...data } = a.data ?? {};               // recomputed on render
      const { referencedImageURI: _uri, ...metadata } = a.metadata;        // session-specific, recomputed lazily
      return toPlainJson({
        annotationUID: a.annotationUID,
        metadata: { ...metadata, referencedImageId: keyByImageId.get(a.metadata.referencedImageId) },
        data,
      });
    });
  const reference = recistReference
    ? [{ annotationUID: "recist-reference", metadata: { toolName: RECIST_REFERENCE_TYPE }, data: { ...recistReference } }]
    : [];
  const brushSlices = (slices) => Object.fromEntries(Object.entries(slices ?? {})
    .filter(([imageId, runs]) => keyByImageId.has(imageId) && runs?.length)
    .map(([imageId, runs]) => [keyByImageId.get(imageId), packRuns(runs)]));
  const regions = mprRegions.map(({ uid, kind, outline, tolerance, number, voxelCount = null, slices, dims, runs, summary = null }) => toPlainJson({
    annotationUID: `mpr-region-${uid}`,
    metadata: { toolName: MPR_REGION_TYPE },
    data: kind === "brush"
      // dims/runs: the earlier whole-volume form, passed through until it's repainted
      ? (slices ? { uid, kind, number, voxelCount, summary, slices: brushSlices(slices) } : { uid, kind, number, voxelCount, summary, dims, runs })
      : { uid, outline, tolerance, number, voxelCount, summary },
  }));
  return [...measurements, ...keyImages, ...reference, ...regions];
}

// Puts saved measurements back on this session's images. Returns how many were restored.
export function restoreAnnotations(saved, imageIds, images) {
  const { imageIdByKey } = buildKeyMaps(imageIds, images);
  let restored = 0;
  (saved ?? []).forEach(a => {
    if (VIEWER_ENTRY_TYPES.has(a.metadata?.toolName)) return; // restored separately
    const imageId = imageIdByKey.get(a.metadata?.referencedImageId);
    if (!imageId || csAnnotation.state.getAnnotation(a.annotationUID)) return;
    csAnnotation.state.addAnnotation({
      ...a,
      metadata: { ...a.metadata, referencedImageId: imageId },
      data: { ...a.data, cachedStats: {} },
      invalidated: true, // stats are recomputed on the next render
      highlighted: false,
    });
    restored++;
  });
  return restored;
}

// The saved key images, as this session's imageIds
export function restoreKeyImages(saved, imageIds, images) {
  const { imageIdByKey } = buildKeyMaps(imageIds, images);
  return (saved ?? [])
    .filter(a => a.metadata?.toolName === KEY_IMAGE_TYPE)
    .map(a => imageIdByKey.get(a.metadata.referencedImageId))
    .filter(Boolean);
}

// The saved RECIST reference sums, or null
export function restoreRecistReference(saved) {
  return (saved ?? []).find(a => a.metadata?.toolName === RECIST_REFERENCE_TYPE)?.data ?? null;
}

// The saved regions (3D view and brush), in the shapes serializeAnnotations takes them,
// with brush slices keyed by this session's imageIds
export function restoreMprRegions(saved, imageIds = [], images = []) {
  const { imageIdByKey } = buildKeyMaps(imageIds, images);
  const brush = (data) => {
    const base = { uid: data.uid, kind: "brush", number: data.number ?? null, voxelCount: data.voxelCount ?? null, summary: data.summary ?? null };
    if (data.slices && typeof data.slices === "object") {
      const slices = Object.fromEntries(Object.entries(data.slices)
        .filter(([key]) => imageIdByKey.has(key))
        .map(([key, packed]) => [imageIdByKey.get(key), unpackRuns(packed)])
        .filter(([, runs]) => runs.length >= 2));
      return Object.keys(slices).length ? { ...base, slices } : null;
    }
    return Array.isArray(data.runs) && data.runs.length >= 2 ? { ...base, dims: data.dims ?? null, runs: data.runs } : null;
  };
  return (saved ?? [])
    .filter(a => a.metadata?.toolName === MPR_REGION_TYPE && a.data?.uid)
    .map(({ data }) => (data.kind === "brush"
      ? brush(data)
      : (data.outline?.length >= 3
        ? { uid: data.uid, outline: data.outline, tolerance: data.tolerance, number: data.number ?? null, voxelCount: data.voxelCount ?? null, summary: data.summary ?? null }
        : null)))
    .filter(Boolean);
}
