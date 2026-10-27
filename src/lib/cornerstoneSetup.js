import { init as csInit, imageLoader, eventTarget, Enums as csEnums, getRenderingEngines } from "@cornerstonejs/core";
import {
  init as csToolsInit,
  annotation as csAnnotation,
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
  CrosshairsTool,
  BidirectionalTool,
  CobbAngleTool,
  LabelTool,
  MagnifyTool,
} from "@cornerstonejs/tools";
import * as dicomImageLoader from "@cornerstonejs/dicom-image-loader";
import { volumeLoader, cornerstoneStreamingImageVolumeLoader } from "@cornerstonejs/core";
import loadWebImage from "./webImageLoader";

let initialized = false;
let initPromise = null;

// Measurement labels: by default they only show for the annotation being hovered,
// drawn/edited or selected, so a slice with several measurements doesn't fill up with text
// boxes; the reader can choose to keep them all on (remembered in this browser). Arrows
// always keep theirs — the label is the arrow's whole point.
const LABELS_KEY = "viewer.labelsAlwaysOn";
export function getLabelsAlwaysOn() {
  try { return localStorage.getItem(LABELS_KEY) === "1"; } catch { return false; }
}
function applyLabelVisibility() {
  const styles = csAnnotation.config.style.getDefaultToolStyles();
  csAnnotation.config.style.setDefaultToolStyles({
    ...styles,
    global: {
      ...styles.global,
      textBoxVisibility: getLabelsAlwaysOn(),
      textBoxVisibilityHighlighted: true,
      textBoxVisibilitySelected: true,
    },
    [ArrowAnnotateTool.toolName]: { ...styles[ArrowAnnotateTool.toolName], textBoxVisibility: true },
  });
}
export function setLabelsAlwaysOn(on) {
  try { localStorage.setItem(LABELS_KEY, on ? "1" : "0"); } catch { }
  applyLabelVisibility();
  getRenderingEngines()?.forEach(engine => { try { engine.render(); } catch (_) { } });
}

export async function initCornerstone() {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await csInit();
    csToolsInit();

    applyLabelVisibility();

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

    // Register volume loader for 3D/MPR rendering
    volumeLoader.registerVolumeLoader("cornerstoneStreamingImageVolume", cornerstoneStreamingImageVolumeLoader);

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
      CrosshairsTool,
      BidirectionalTool,
      CobbAngleTool,
      LabelTool,
      MagnifyTool,
    ].forEach((T) => {
      try { addTool(T); } catch (_) { /* already added */ }
    });

    // Suppress noisy unhandled image-load errors from Cornerstone —
    // log them once with useful info instead of flooding the console.
    eventTarget.addEventListener(csEnums.Events.IMAGE_LOAD_ERROR, (_evt) => {
      // image load errors are suppressed
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
