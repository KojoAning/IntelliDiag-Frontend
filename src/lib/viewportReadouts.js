// Live readouts shared by the 2D and MPR viewers: the pixel value under the cursor (HU on
// CT, as Horos shows it in the corner) and the physical size of a screen pixel, for the
// scale bar. Both work from the viewport's image data, so stack and volume viewports
// behave the same.
import { metaData, utilities as csUtils } from "@cornerstonejs/core";

// viewport: a Cornerstone stack or volume viewport; canvasPoint: [x, y] in CSS pixels
// Returns { value, unit, i, j } — i/j the column/row on the image — or null off the image
export function probePixel(viewport, canvasPoint) {
  try {
    const data = viewport.getImageData?.();
    if (!data?.imageData || !data.voxelManager) return null;
    const world = viewport.canvasToWorld(canvasPoint);
    const [i, j, k] = csUtils.transformWorldToIndex(data.imageData, world);
    const [w, h, d = 1] = data.dimensions;
    if (i < 0 || j < 0 || k < 0 || i >= w || j >= h || k >= d) return null;
    let value = data.voxelManager.getAtIJK(i, j, k);
    if (typeof value !== "number") return null; // colour (RGB) images have no single value

    // Stack images are usually pre-scaled to modality units by the loader; when one isn't,
    // apply its rescale slope/intercept here (volumes are always scaled)
    const imageId = viewport.getCurrentImageId?.();
    if (data.preScale && !data.preScale.scaled && imageId) {
      const { rescaleSlope = 1, rescaleIntercept = 0 } = metaData.get("modalityLutModule", imageId) ?? {};
      value = value * rescaleSlope + rescaleIntercept;
    }
    const modality = (data.metadata?.Modality ?? "").toUpperCase();
    const unit = modality === "CT" ? "HU" : modality === "PT" && data.scaling?.PT ? "SUV" : "";
    return { value, unit, i, j };
  } catch (_) {
    return null;
  }
}

// Millimetres per screen pixel at the current zoom, or null when the image has no real
// pixel spacing (plain PNG/JPG, uncalibrated projection images)
export function mmPerCanvasPixel(viewport) {
  try {
    const data = viewport.getImageData?.();
    if (!data || data.hasPixelSpacing === false) return null;
    const a = viewport.canvasToWorld([0, 0]);
    const b = viewport.canvasToWorld([100, 0]);
    const mm = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 100;
    return mm > 0 && Number.isFinite(mm) ? mm : null;
  } catch (_) {
    return null;
  }
}

// "−1024 HU", "0.83 SUV", "1234"
export function formatPixelValue({ value, unit }) {
  const rounded = unit === "SUV" || !Number.isInteger(value) ? value.toFixed(unit === "SUV" ? 2 : 1) : String(value);
  return unit ? `${rounded} ${unit}` : rounded;
}
