import dicomParser from "dicom-parser";

// ── Auth ────────────────────────────────────────────────────────────────────
const API_BASE = (process.env.REACT_APP_API_URL || "").trim().replace(/\/$/, "");

/**
 * Fetch a URL, attaching the JWT only for our authenticated backend (e.g. the
 * /dicom/{id}/stream endpoint). Blob URLs and signed GCS URLs are left untouched.
 */
function authedFetch(url) {
  const token = localStorage.getItem("token");
  const headers = {};
  if (token && API_BASE && (url || "").includes(API_BASE)) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(url, { headers });
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function str(dataSet, tag) {
  try { return (dataSet.string(tag) || "").trim(); } catch { return ""; }
}

function num(dataSet, tag) {
  try { const v = parseFloat(dataSet.string(tag)); return isFinite(v) ? v : null; } catch { return null; }
}

/** "YYYYMMDD" → "DD MMM YYYY" */
function formatDate(raw) {
  if (!raw || raw.length < 8) return raw || "";
  const y = raw.slice(0, 4), m = raw.slice(4, 6), d = raw.slice(6, 8);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const label = months[parseInt(m, 10) - 1] ?? m;
  return `${d} ${label} ${y}`;
}

/** "Last^First^Middle" → "First Last" */
function formatPatientName(raw) {
  if (!raw) return "";
  const parts = raw.split("^");
  const last  = parts[0] ?? "";
  const first = parts[1] ?? "";
  return [first, last].filter(Boolean).join(" ") || raw;
}

/** "HHMMSS.fraction" → "HH:MM" */
function formatTime(raw) {
  if (!raw || raw.length < 4) return raw || "";
  return `${raw.slice(0, 2)}:${raw.slice(2, 4)}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch a blob/http URL, parse the full DICOM header, and return structured
 * metadata. Returns null if the file cannot be parsed as DICOM.
 */
export async function getDicomMetadata(url) {
  try {
    const resp      = await authedFetch(url);
    const buffer    = await resp.arrayBuffer();
    const byteArray = new Uint8Array(buffer);
    const ds        = dicomParser.parseDicom(byteArray);

    // Multi-value tags (e.g. pixel spacing) are stored as backslash-separated strings
    const multiNum = (tag) => {
      const s = str(ds, tag);
      if (!s) return null;
      const vals = s.split("\\").map(Number).filter(isFinite);
      return vals.length ? vals : null;
    };

    const frameCount = parseInt(str(ds, "x00280008"), 10);

    return {
      // Patient
      patientName:    formatPatientName(str(ds, "x00100010")),
      patientId:      str(ds, "x00100020"),
      patientDob:     formatDate(str(ds, "x00100030")),
      patientSex:     str(ds, "x00100040"),

      // Study
      studyDate:        formatDate(str(ds, "x00080020")),
      studyTime:        formatTime(str(ds, "x00080030")),
      studyDescription: str(ds, "x00081030"),
      accessionNumber:  str(ds, "x00080050"),
      institution:      str(ds, "x00080080"),

      // Series / Image
      modality:           str(ds, "x00080060"),
      seriesDescription:  str(ds, "x0008103e"),
      seriesNumber:       str(ds, "x00200011"),
      instanceNumber:     str(ds, "x00200013"),
      manufacturer:       str(ds, "x00080070"),

      // Image geometry
      rows:            num(ds, "x00280010"),
      columns:         num(ds, "x00280011"),
      frameCount:      isFinite(frameCount) && frameCount > 0 ? frameCount : 1,
      sliceThickness:  num(ds, "x00180050"),
      pixelSpacing:    multiNum("x00280030"),  // [rowSpacing, colSpacing] in mm

      // Initial window
      windowCenter: num(ds, "x00281050"),
      windowWidth:  num(ds, "x00281051"),
    };
  } catch {
    return null;
  }
}

/**
 * Render the first frame of a DICOM File to a JPEG data-URL thumbnail.
 * Returns null if the file cannot be parsed or has no pixel data.
 */
export async function renderDicomThumbnail(file, thumbSize = 128) {
  try {
    const buffer    = await file.arrayBuffer();
    const byteArray = new Uint8Array(buffer);
    const ds        = dicomParser.parseDicom(byteArray);

    const rows   = ds.uint16("x00280010");
    const cols   = ds.uint16("x00280011");
    const bits   = ds.uint16("x00280100") || 16;
    const signed = (ds.uint16("x00280103") || 0) === 1;

    if (!rows || !cols) return null;

    const el = ds.elements.x7fe00010;
    if (!el) return null;

    // Copy exactly one frame of pixel bytes into an aligned buffer
    const frameBytes = rows * cols * (bits / 8);
    const raw = new Uint8Array(frameBytes);
    raw.set(byteArray.subarray(el.dataOffset, el.dataOffset + frameBytes));

    const pixelData = bits === 8
      ? raw
      : signed
        ? new Int16Array(raw.buffer, 0, rows * cols)
        : new Uint16Array(raw.buffer, 0, rows * cols);

    // Window / level — prefer embedded tags, fall back to min/max
    let lo, hi;
    try {
      const wc = parseFloat(ds.string("x00281050"));
      const ww = parseFloat(ds.string("x00281051"));
      if (isFinite(wc) && isFinite(ww)) { lo = wc - ww / 2; hi = wc + ww / 2; }
    } catch {}
    if (lo == null) {
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < pixelData.length; i++) {
        if (pixelData[i] < mn) mn = pixelData[i];
        if (pixelData[i] > mx) mx = pixelData[i];
      }
      lo = mn; hi = mx;
    }
    const range = (hi - lo) || 1;

    // Draw at native resolution
    const canvas = document.createElement("canvas");
    canvas.width = cols; canvas.height = rows;
    const ctx     = canvas.getContext("2d");
    const imgData = ctx.createImageData(cols, rows);
    for (let i = 0; i < rows * cols; i++) {
      const g = Math.max(0, Math.min(255, Math.round(((pixelData[i] - lo) / range) * 255)));
      imgData.data[i * 4]     = g;
      imgData.data[i * 4 + 1] = g;
      imgData.data[i * 4 + 2] = g;
      imgData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    // Scale down to thumbnail
    const thumb = document.createElement("canvas");
    thumb.width = thumbSize; thumb.height = thumbSize;
    thumb.getContext("2d").drawImage(canvas, 0, 0, thumbSize, thumbSize);
    return thumb.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

/**
 * Parse a File object directly as DICOM and return the metadata fields
 * required by the confirm-upload endpoint. Returns an empty object if
 * the file is not a valid DICOM file.
 */
export async function parseDicomFile(file) {
  try {
    const buffer    = await file.arrayBuffer();
    const byteArray = new Uint8Array(buffer);
    const ds        = dicomParser.parseDicom(byteArray);

    const s = (tag) => { try { return (ds.string(tag) || "").trim(); } catch { return ""; } };
    const n = (tag) => { try { const v = parseFloat(ds.string(tag)); return isFinite(v) ? v : null; } catch { return null; } };

    return {
      slice_thickness: n("x00180050"),
      window_center:   n("x00281050"),
      window_width:    n("x00281051"),
      rows:            n("x00280010"),
      columns:         n("x00280011"),
    };
  } catch {
    return {};
  }
}

/**
 * Parse a File as DICOM and return the identity + display fields needed to
 * reconstruct the Study -> Series hierarchy on ingest. Returns null if the
 * file isn't valid DICOM or is missing the UIDs that define the hierarchy.
 */
export async function parseDicomForIngest(file) {
  try {
    const buffer    = await file.arrayBuffer();
    const byteArray = new Uint8Array(buffer);
    const ds        = dicomParser.parseDicom(byteArray);

    const studyUid  = str(ds, "x0020000d");
    const seriesUid = str(ds, "x0020000e");
    const sopUid    = str(ds, "x00080018");
    if (!studyUid || !seriesUid || !sopUid) return null;  // not a filable instance

    const seriesNumberRaw = str(ds, "x00200011");
    const seriesNumber = seriesNumberRaw !== "" ? parseInt(seriesNumberRaw, 10) : null;

    return {
      studyUid,
      seriesUid,
      sopUid,
      modality:           str(ds, "x00080060"),
      studyDescription:   str(ds, "x00081030"),
      seriesDescription:  str(ds, "x0008103e"),
      seriesNumber:       Number.isFinite(seriesNumber) ? seriesNumber : null,
      bodyPart:           str(ds, "x00180015"),
      studyDate:          str(ds, "x00080020"),
      accessionNumber:    str(ds, "x00080050"),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch a presigned/http URL, parse the DICOM pixel data, and return a JPEG
 * thumbnail data-URL. Returns null if the file can't be decoded.
 */
export async function renderDicomThumbnailFromUrl(url, thumbSize = 128) {
  try {
    const resp = await authedFetch(url);
    const blob = await resp.blob();
    return renderDicomThumbnail(blob, thumbSize);
  } catch {
    return null;
  }
}

/**
 * Fetch a blob/http URL and parse the DICOM header to find the number of frames.
 * Returns 1 for non-multi-frame files or if parsing fails.
 */
export async function getDicomFrameCount(url) {
  try {
    const resp      = await authedFetch(url);
    const buffer    = await resp.arrayBuffer();
    const byteArray = new Uint8Array(buffer);
    const dataSet   = dicomParser.parseDicom(byteArray, { untilTag: "x00280008" });
    const count     = parseInt(dataSet.string("x00280008"), 10);
    return Number.isFinite(count) && count > 0 ? count : 1;
  } catch {
    return 1;
  }
}

/**
 * Given an image object { url, name, type, ... } determine if it's a DICOM file.
 */
export function isDicomImage(img) {
  return (
    /\.dcm$/i.test(img.name || "") ||
    /\.dcm(\?|$)/i.test(img.url  || "") ||   // presigned URLs have ?X-Amz-... after .dcm
    img.type === "application/dicom" ||
    (img.name || "").toLowerCase().includes("dicom")
  );
}

/**
 * Convert an array of image objects into Cornerstone imageIds.
 * DICOM files are expanded into per-frame imageIds (wadouri:url?frame=N).
 * PNG/JPG files produce a single web:url imageId.
 */
export async function buildImageIds(images) {
  const results = await Promise.all(
    images.map(async (img) => {
      if (!img.url) return [];
      if (isDicomImage(img)) {
        const frameCount = await getDicomFrameCount(img.url);
        if (frameCount <= 1) return [`wadouri:${img.url}`];
        // Use & if the URL already has query params (e.g. presigned S3 URLs)
        const sep = img.url.includes("?") ? "&" : "?";
        return Array.from({ length: frameCount }, (_, i) =>
          `wadouri:${img.url}${sep}frame=${i}`
        );
      }
      return [`web:${img.url}`];
    })
  );
  return results.flat();
}
