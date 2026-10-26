// In-memory cache of whole DICOM series, shared across viewer mounts.
//
// The open series loads first; the rest of the study then downloads in the background,
// one series at a time, so a radiologist can keep switching series and scrolling slices
// after the network drops. Each series is held as raw DICOM blobs only — decoding into
// a volume still happens on open, and Cornerstone's own cache bounds that part.
import { authFetch, getImagesForStudy } from "./api";
import { renderDicomThumbnail, parseMultipartBody, parseDicomInstanceInfo, getDicomMetadata } from "./dicomUtils";

// Rendered thumbnails, keyed by image id, or `series:<id>` for a series card.
export const thumbCache = new Map();

// Projection modalities (X-ray, mammo, angio) are browsed image by image, so they get
// per-image thumbnails. Cross-sectional series (CT/MR) are scrolled in the viewer instead.
export const PROJECTION_MODALITIES = new Set(["CR", "DX", "MG", "XA", "RF", "IO", "PX"]);

// Stop background downloads once this much DICOM is held. A brain MR sequence is ~20 MB,
// a thin-slice CT can be ~250 MB — so this covers typical studies without risking the tab.
// Series past the budget still load normally when opened.
export const MEMORY_BUDGET_BYTES = 1024 * 1024 * 1024;

// seriesId -> { status: "loading" | "ready" | "error" | "skipped", promise, images, metadata, bytes }
const entries = new Map();
const listeners = new Set();
let bytesHeld = 0;

function setEntry(id, patch) {
  entries.set(id, { ...entries.get(id), ...patch });
  listeners.forEach(fn => fn());
}

export function getSeriesStatus(seriesId) {
  return entries.get(String(seriesId))?.status ?? "idle";
}

export function subscribeSeriesCache(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Image records for a series. Builds stream URLs directly (1 API call instead of N).
export async function fetchSeriesImages(seriesId) {
  const records = await getImagesForStudy(seriesId);
  const uploaded = (records ?? []).filter(r => r.status === "uploaded");
  return uploaded.map((record) => {
    const fname = record.filename ?? "";
    const isStandardImage = /\.(jpe?g|png|gif|bmp|webp|tiff?)$/i.test(fname);
    const isDicom = isStandardImage
      ? false
      : (record.image_type ?? "dicom") === "dicom";
    const fallbackName = isDicom ? `${record.id}.dcm` : `${record.id}.img`;
    return {
      id: record.id,
      url: `${process.env.REACT_APP_API_BASE}/dicom/${record.id}/stream`,
      thumbnailUrl: `${process.env.REACT_APP_API_BASE}/dicom/${record.id}/rendered?quality=jpeg`,
      name: fname || fallbackName,
      type: isDicom ? "application/dicom" : "image",
      file: null,
    };
  });
}

// Short-lived series-scoped token from the main backend, required by the bulk endpoint.
async function getSeriesToken(seriesId) {
  const res = await authFetch(`${process.env.REACT_APP_API_BASE}/series/${seriesId}/inference-token`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to get inference token");
  const data = await res.json();
  return data.token;
}

// Single bulk DICOM fetch for the whole series. Returns the imgs array with blobUrl
// attached to each entry, so Cornerstone never touches /stream.
async function fetchSeriesBulk(seriesId, imgs, { renderThumbs }) {
  const token = await getSeriesToken(seriesId);
  const res = await fetch(
    `${process.env.REACT_APP_API_BASE}/dicom/series/${seriesId}/bulk`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Bulk fetch failed: ${res.status} — ${body.slice(0, 200)}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  // Boundary may be quoted: boundary="abc" or unquoted: boundary=abc
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary) throw new Error(`No multipart boundary in bulk response. content-type: ${contentType}`);

  const buffer = await res.arrayBuffer();
  const parts = parseMultipartBody(buffer, boundary);

  // Parse instance numbers and sort clinically. Wrapped in try/catch so a
  // parse failure degrades to original order rather than aborting the bulk fetch.
  let orderedParts = parts;
  try {
    const annotated = parts.map(part => {
      const { instanceNumber } = parseDicomInstanceInfo(part);
      return { part, instanceNumber };
    });
    if (annotated.some(a => a.instanceNumber != null)) {
      annotated.sort((a, b) => {
        if (a.instanceNumber != null && b.instanceNumber != null) return a.instanceNumber - b.instanceNumber;
        if (a.instanceNumber != null) return -1;
        if (b.instanceNumber != null) return 1;
        return 0;
      });
      orderedParts = annotated.map(a => a.part);
    }
  } catch (sortErr) {
    // instance sort failed, using original order
  }

  const middle = Math.floor(orderedParts.length / 2);
  const blobUrls = new Array(imgs.length).fill(null);
  await Promise.all(orderedParts.map(async (part, i) => {
    if (!imgs[i]) return;
    const blob = new Blob([part], { type: "application/dicom" });
    blobUrls[i] = URL.createObjectURL(blob);

    // Per-image thumbnails only where the side panel shows them; the middle slice
    // always becomes the series card's thumbnail so it renders offline too.
    if (renderThumbs && !thumbCache.has(imgs[i].id)) {
      const src = await renderDicomThumbnail(blob);
      if (src) thumbCache.set(imgs[i].id, src);
    }
    if (i === middle && !thumbCache.has(`series:${seriesId}`)) {
      const src = thumbCache.get(imgs[i].id) ?? await renderDicomThumbnail(blob);
      if (src) thumbCache.set(`series:${seriesId}`, src);
    }
  }));

  const images = imgs.map((img, i) => blobUrls[i] ? { ...img, blobUrl: blobUrls[i] } : img);

  // Extract DICOM metadata from the first available slice
  const firstBlobUrl = blobUrls.find(Boolean);
  const metadata = firstBlobUrl ? await getDicomMetadata(firstBlobUrl).catch(() => null) : null;

  return { images, metadata, bytes: buffer.byteLength };
}

// Load a series, or return the in-flight / finished load. Resolves to { images, metadata };
// if the bulk download fails, images come back without blobUrl (viewer streams them instead).
export function loadSeries(seriesId, { renderThumbs = false } = {}) {
  const id = String(seriesId);
  const existing = entries.get(id);
  if (existing?.promise && existing.status !== "error") return existing.promise;

  const promise = (async () => {
    let imgs = [];
    try {
      imgs = await fetchSeriesImages(id);
      const { images, metadata, bytes } = await fetchSeriesBulk(id, imgs, { renderThumbs });
      bytesHeld += bytes;
      setEntry(id, { status: "ready", images, metadata, bytes });
      return { images, metadata };
    } catch (err) {
      setEntry(id, { status: "error" });
      if (!imgs.length) throw err;
      return { images: imgs, metadata: null };
    }
  })();
  setEntry(id, { status: "loading", promise });
  return promise;
}

// Drop a series (e.g. after new images were uploaded to it) so the next load refetches.
export function invalidateSeries(seriesId) {
  const id = String(seriesId);
  const entry = entries.get(id);
  if (!entry) return;
  entry.images?.forEach(img => img.blobUrl && URL.revokeObjectURL(img.blobUrl));
  bytesHeld -= entry.bytes ?? 0;
  thumbCache.delete(`series:${id}`);
  entries.delete(id);
  listeners.forEach(fn => fn());
}

// Background queue — one series at a time so it never competes much with the open one.
const queue = [];
let draining = false;

export function prefetchSeriesInBackground(seriesList) {
  for (const s of seriesList) {
    const id = String(s.id);
    if (entries.has(id) || queue.some(q => q.id === id)) continue;
    queue.push({ id, renderThumbs: PROJECTION_MODALITIES.has((s.modality || "").toUpperCase()) });
  }
  if (draining) return;
  draining = true;
  (async () => {
    while (queue.length) {
      const { id, renderThumbs } = queue.shift();
      if (entries.has(id)) continue; // opened by the user meanwhile
      if (bytesHeld >= MEMORY_BUDGET_BYTES) {
        setEntry(id, { status: "skipped" });
        continue;
      }
      try {
        await loadSeries(id, { renderThumbs });
      } catch {
        // status is already "error"; the card shows it and opening the series retries
      }
    }
    draining = false;
  })();
}
