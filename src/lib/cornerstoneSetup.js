import { init as csInit, imageLoader } from "@cornerstonejs/core";
import {
  init as csToolsInit,
  addTool,
  PanTool,
  ZoomTool,
  WindowLevelTool,
  LengthTool,
  AngleTool,
  EllipticalROITool,
  CircleROITool,
  RectangleROITool,
  ArrowAnnotateTool,
  ProbeTool,
  PlanarFreehandROITool,
  StackScrollTool,
} from "@cornerstonejs/tools";
import * as dicomImageLoader from "@cornerstonejs/dicom-image-loader";
import loadWebImage from "./webImageLoader";

let initialized = false;
let initPromise = null;

export async function initCornerstone() {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await csInit();
    csToolsInit();

    // Initialize the DICOM image loader (wado-uri scheme handles blob:/http: DICOM)
    dicomImageLoader.init({ maxWebWorkers: 1 });

    // Register loader for plain web/blob image URLs (PNG/JPG)
    imageLoader.registerImageLoader("web", loadWebImage);

    // Register all tools once globally
    [
      PanTool,
      ZoomTool,
      WindowLevelTool,
      LengthTool,
      AngleTool,
      EllipticalROITool,
      CircleROITool,
      RectangleROITool,
      ArrowAnnotateTool,
      ProbeTool,
      PlanarFreehandROITool,
      StackScrollTool,
    ].forEach((T) => {
      try { addTool(T); } catch (_) { /* already added */ }
    });

    initialized = true;
  })();

  return initPromise;
}

/**
 * Convert a blob URL or http URL to a Cornerstone imageId.
 * DICOM files (.dcm or detected by the caller) use wadouri: scheme.
 * PNG/JPG/other web images use the custom web: loader.
 */
export function toImageId(url, isDicom = false) {
  if (!url) return null;
  // Already a prefixed imageId
  if (/^(web|wadors|wadouri|dicomweb):/.test(url)) return url;
  if (isDicom) return `wadouri:${url}`;
  return `web:${url}`;
}
