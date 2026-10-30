// In-memory cache of whole DICOM series, shared across viewer mounts.
//
// The open series loads first; the rest of the study then downloads in the background,
// one series at a time, so a radiologist can keep switching series and scrolling slices
// after the network drops. Each series is held as raw DICOM blobs only — decoding into
// a volume still happens on open, and Cornerstone's own cache bounds that part.
// Downloads are also kept on disk (lib/seriesStore), so a reload reuses them instead of
// downloading again, as long as the series' image list hasn't changed.
import { authFetch, getImagesForStudy } from "./api";
import { readStoredSeries, writeStoredSeries, writeStoredThumbnail, deleteStoredSeries, storedSeriesIds, sameRecords } from "./seriesStore";
import { renderDicomThumbnail, createMultipartReader, parseDicomInstanceInfo, getDicomMetadata } from "./dicomUtils";

// Rendered thumbnails, keyed by image id, or `series:<id>` for a series card.
export const thumbCache = new Map();

// Projection modalities (X-ray, mammo, angio) are browsed image by image, so they get
// per-image thumbnails. Cross-sectional series (CT/MR) are scrolled in the viewer instead.
export const PROJECTION_MODALITIES = new Set(["CR", "DX", "MG", "XA", "RF", "IO", "PX"]);

// Stop background downloads once this much DICOM is held. A brain MR sequence is ~20 MB,
// a thin-slice CT can be ~250 MB — so this covers typical studies without risking the tab.
// Series past the budget still load normally when opened.
export const MEMORY_BUDGET_BYTES = 1024 * 1024 * 1024;

// seriesId -> { status: "loading" | "ready" | "error" | "skipped", promise, images, metadata, bytes,
//   partial: { slices: [{ instanceNumber, buffer }], total } while it downloads }
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

// The slices of a series downloaded so far (null when it isn't downloading), so the viewer
// can show them before the whole series is in
export function getSeriesPartial(seriesId) {
  return entries.get(String(seriesId))?.partial ?? null;
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
      sopInstanceUid: record.sop_instance_uid ?? null, // pairs the record with its file in the bulk download
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

// Which downloaded file belongs to which image record: matched on SOP Instance UID, so a
// series with repeated or missing instance numbers, plain JPEG/PNG records (no file in the
// download) or files of since-deleted images still pairs correctly. Records without a UID
// fall back to the leftover files in instance-number order. Returns one part (or null) per record.
export function pairPartsWithImages(parts, imgs) {
  const infos = parts.map(part => {
    try { return { part, ...parseDicomInstanceInfo(part) }; }
    catch { return { part, instanceNumber: null, sopUid: null }; }
  });
  const byUid = new Map(infos.filter(info => info.sopUid).map(info => [info.sopUid, info]));
  const used = new Set();
  const paired = imgs.map(img => {
    const info = img.sopInstanceUid && byUid.get(img.sopInstanceUid);
    if (!info || used.has(info)) return null;
    used.add(info);
    return info.part;
  });
  const leftover = infos
    .filter(info => !used.has(info))
    .sort((a, b) => (a.instanceNumber ?? Infinity) - (b.instanceNumber ?? Infinity));
  imgs.forEach((img, i) => {
    if (paired[i] || img.sopInstanceUid || img.type !== "application/dicom" || !leftover.length) return;
    paired[i] = leftover.shift().part;
  });
  return paired;
}

// Single bulk DICOM fetch for the whole series: one Blob (or null) per image record. The
// response is read as it arrives, and the slices in so far are published as the entry's
// `partial` (at most every PARTIAL_EVERY_MS).
const PARTIAL_EVERY_MS = 300;

async function fetchSeriesBulk(seriesId, imgs) {
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

  const reader = createMultipartReader(boundary);
  const parts = [];
  const slices = [];
  const total = imgs.filter(img => img.type === "application/dicom").length;
  let bytes = 0;
  let published = 0;
  const publish = () => {
    published = Date.now();
    setEntry(String(seriesId), { partial: { slices: slices.slice(), total } });
  };
  const take = (newParts) => {
    for (const part of newParts) {
      parts.push(part);
      slices.push({ instanceNumber: parseDicomInstanceInfo(part).instanceNumber, buffer: part });
    }
    if (newParts.length && Date.now() - published > PARTIAL_EVERY_MS) publish();
  };
  if (res.body?.getReader) {
    const stream = res.body.getReader();
    for (;;) {
      const { done, value } = await stream.read();
      if (done) break;
      bytes += value.byteLength;
      take(reader.push(value));
    }
  } else {
    const buffer = new Uint8Array(await res.arrayBuffer());
    bytes = buffer.byteLength;
    take(reader.push(buffer));
  }
  const blobs = pairPartsWithImages(parts, imgs).map(part => part && new Blob([part], { type: "application/dicom" }));
  return { blobs, bytes };
}

// The viewer's image list from the records and their blobs (downloaded or from disk): a
// blobUrl on each image that has one, so Cornerstone never touches /stream; thumbnails;
// and the series' DICOM metadata from its first slice.
async function finishSeries(seriesId, imgs, blobs, { renderThumbs }) {
  const blobUrls = blobs.map(blob => blob && URL.createObjectURL(blob));

  // Per-image thumbnails only where the side panel shows them; the middle slice
  // always becomes the series card's thumbnail so it renders offline too.
  const middle = Math.floor(imgs.length / 2);
  await Promise.all(imgs.map(async (img, i) => {
    if (blobs[i] && renderThumbs && !thumbCache.has(img.id)) {
      const src = await renderDicomThumbnail(blobs[i]);
      if (src) thumbCache.set(img.id, src);
    }
  }));
  const thumbIndex = blobs[middle] ? middle : blobs.findIndex(Boolean);
  if (thumbIndex >= 0 && !thumbCache.has(`series:${seriesId}`)) {
    const src = thumbCache.get(imgs[thumbIndex].id) ?? await renderDicomThumbnail(blobs[thumbIndex]);
    if (src) thumbCache.set(`series:${seriesId}`, src);
  }

  const images = imgs.map((img, i) => blobUrls[i] ? { ...img, blobUrl: blobUrls[i] } : img);
  const firstBlobUrl = blobUrls.find(Boolean);
  const metadata = firstBlobUrl ? await getDicomMetadata(firstBlobUrl).catch(() => null) : null;
  return { images, metadata };
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
      // The stored copy and the server's image list (to check it's still current) together
      const [stored, listed] = await Promise.all([
        readStoredSeries(id).catch(() => null),
        fetchSeriesImages(id).then(records => ({ records }), error => ({ error })),
      ]);
      if (listed.error && !stored) throw listed.error;
      imgs = listed.records ?? stored.records; // offline: open the last downloaded copy
      const thumbKey = `series:${id}`;
      // A stored copy missing a DICOM file (downloads before the multipart fix dropped the
      // first one) is downloaded again rather than streaming that slice from the backend
      const fromDisk = !!stored && sameRecords(stored.records, imgs)
        && imgs.every((img, i) => img.type !== "application/dicom" || stored.blobs?.[i]);
      let blobs, bytes;
      if (fromDisk) {
        ({ blobs, bytes } = stored);
        if (stored.thumbnail && !thumbCache.has(thumbKey)) thumbCache.set(thumbKey, stored.thumbnail);
      } else {
        ({ blobs, bytes } = await fetchSeriesBulk(id, imgs));
      }
      const { images, metadata } = await finishSeries(id, imgs, blobs, { renderThumbs });
      const thumbnail = thumbCache.get(thumbKey) ?? null;
      const keep = fromDisk
        ? (!stored.thumbnail && thumbnail ? writeStoredThumbnail(id, thumbnail) : null)
        : writeStoredSeries(id, { records: imgs, blobs, bytes, thumbnail });
      keep?.catch(err => console.warn("[Series] couldn't keep the download on this device:", err));
      bytesHeld += bytes;
      setEntry(id, { status: "ready", images, metadata, bytes, partial: null });
      return { images, metadata };
    } catch (err) {
      setEntry(id, { status: "error", partial: null });
      if (!imgs.length) throw err;
      return { images: imgs, metadata: null };
    }
  })();
  setEntry(id, { status: "loading", promise });
  return promise;
}

// The series card's thumbnail without the network: rendered this session, or kept with
// the series' copy on disk (null if neither)
export async function storedSeriesThumbnail(seriesId) {
  const key = `series:${seriesId}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const thumbnail = (await readStoredSeries(String(seriesId)).catch(() => null))?.thumbnail ?? null;
  if (thumbnail) thumbCache.set(key, thumbnail);
  return thumbnail;
}

// Drop a series (e.g. after new images were uploaded to it) so the next load refetches.
export function invalidateSeries(seriesId) {
  const id = String(seriesId);
  deleteStoredSeries(id).catch(() => {});
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
    // Series already on this device need no download: open them all now, so their cards
    // don't wait behind downloads
    const stored = await storedSeriesIds().catch(() => new Set());
    const local = queue.filter(q => stored.has(q.id));
    queue.splice(0, queue.length, ...queue.filter(q => !stored.has(q.id)));
    await Promise.all(local.map(({ id, renderThumbs }) => (entries.has(id) ? null : loadSeries(id, { renderThumbs }).catch(() => {}))));
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
