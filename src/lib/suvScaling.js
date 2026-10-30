// PET values in SUV (body-weight): a "scalingModule" metadata provider. Cornerstone's
// DICOM loader asks for it while decoding a PT image and multiplies the pixel values by
// suvbw, so the 2D view, the volume and the fused overlay all read in SUV — and the pixel
// readout labels them so (viewportReadouts).
//
//   SUVbw = activity concentration (Bq/mL) × weight (g) / injected dose decayed to scan time (Bq)
//
// Handled: Units BQML (decay-corrected to the series start or to administration), GML
// (already SUV), and Philips CNTS with its SUV scale factor (7053,1000). Anything else —
// missing weight, dose, half-life or times — gets no scaling, so values stay as stored and
// aren't labelled SUV.
import { metaData } from "@cornerstonejs/core";
import { wadouri } from "@cornerstonejs/dicom-image-loader";

const cache = new Map(); // imageId -> { suvbw } | null

// "HHMMSS.ffffff" → seconds since midnight
function tmSeconds(tm) {
  if (!tm) return null;
  const s = tm.trim();
  if (s.length < 4) return null;
  const h = +s.slice(0, 2), m = +s.slice(2, 4), sec = s.length >= 6 ? parseFloat(s.slice(4)) : 0;
  return [h, m, sec].every(Number.isFinite) ? h * 3600 + m * 60 + sec : null;
}
// "YYYYMMDD" + time → ms since epoch (UTC; only differences are used)
function dateTimeMs(da, tm) {
  const secs = tmSeconds(tm);
  if (!da || da.length < 8 || secs == null) return null;
  const day = Date.UTC(+da.slice(0, 4), +da.slice(4, 6) - 1, +da.slice(6, 8));
  return Number.isFinite(day) ? day + secs * 1000 : null;
}

// SUVbw factor from a parsed PET header (dicom-parser DataSet), or null
export function suvFactorFromDataSet(ds) {
  if ((ds.string("x00080060") || "").trim() !== "PT") return null;
  const units = (ds.string("x00541001") || "").trim().toUpperCase();
  if (units === "GML") return 1;
  if (units === "CNTS") {
    const philips = parseFloat(ds.string("x70531000"));
    return Number.isFinite(philips) && philips > 0 ? philips : null;
  }
  if (units !== "BQML") return null;

  const weightKg = parseFloat(ds.string("x00101030"));
  const radio = ds.elements.x00540016?.items?.[0]?.dataSet;
  const dose = radio && parseFloat(radio.string("x00181074"));
  const halfLife = radio && parseFloat(radio.string("x00181075"));
  if (!(weightKg > 0) || !(dose > 0) || !(halfLife > 0)) return null;

  let decayed = dose;
  const correction = (ds.string("x00541102") || "START").trim().toUpperCase();
  if (correction === "START") {
    // Injection: the start date-time if given, else the start time on the series date
    const seriesDate = ds.string("x00080021") || ds.string("x00080022") || ds.string("x00080020");
    const scan = dateTimeMs(seriesDate, ds.string("x00080031") || ds.string("x00080032"));
    const startDt = radio.string("x00181078");
    let injection = startDt && startDt.length >= 12 ? dateTimeMs(startDt.slice(0, 8), startDt.slice(8)) : null;
    if (injection == null) injection = dateTimeMs(seriesDate, radio.string("x00181072"));
    if (scan == null || injection == null) return null;
    let seconds = (scan - injection) / 1000;
    if (seconds < 0 && !startDt) seconds += 24 * 3600; // injected before midnight, scanned after
    if (seconds < 0) return null;
    decayed = dose * Math.pow(2, -seconds / halfLife);
  } else if (correction !== "ADMIN") {
    return null; // NONE: images aren't decay-corrected — SUV would need per-frame times
  }
  return (weightKg * 1000) / decayed;
}

function provider(type, imageId) {
  if (type !== "scalingModule" || !imageId?.startsWith("wadouri:")) return undefined;
  if (cache.has(imageId)) return cache.get(imageId) ?? undefined;
  const { url } = wadouri.parseImageId(imageId);
  const ds = wadouri.dataSetCacheManager.isLoaded(url) ? wadouri.dataSetCacheManager.get(url) : null;
  if (!ds) return undefined; // not parsed yet — ask again later, don't cache
  let entry = null;
  try {
    const suvbw = suvFactorFromDataSet(ds);
    entry = suvbw ? { suvbw } : null;
  } catch (_) {
    entry = null;
  }
  cache.set(imageId, entry);
  return entry ?? undefined;
}

let installed = false;
export function installSuvScaling() {
  if (installed) return;
  installed = true;
  metaData.addProvider(provider, 9000);
}
