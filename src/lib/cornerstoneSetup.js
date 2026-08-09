import { init as csInit, imageLoader, eventTarget, Enums as csEnums } from "@cornerstonejs/core";
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

    // Initialize the DICOM image loader (wado-uri scheme handles blob:/http: DICOM).
    // beforeSend returns headers that are merged onto the XHR — inject the JWT so
    // requests to the authenticated backend /dicom/{id}/stream endpoint succeed.
    const apiBase = (process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_URL || "").trim().replace(/\/$/, "");
    dicomImageLoader.init({
      maxWebWorkers: 1,
      beforeSend: (xhr, imageId) => {
        const token = localStorage.getItem("token");
        // Only attach the token for our backend (not blob: URLs or 3rd-party CDNs)
        if (token && (!apiBase || (imageId || "").includes(apiBase))) {
          return { Authorization: `Bearer ${token}` };
        }
        return {};
      },
    });

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

    // Suppress noisy unhandled image-load errors from Cornerstone —
    // log them once with useful info instead of flooding the console.
    eventTarget.addEventListener(csEnums.Events.IMAGE_LOAD_ERROR, (evt) => {
      const { imageId, error } = evt.detail || {};
      console.warn("[Cornerstone] image load failed:", imageId, error?.message || error);
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
