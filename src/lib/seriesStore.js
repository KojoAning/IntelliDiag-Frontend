// On-disk copy of downloaded series (IndexedDB), so a page reload doesn't download every
// series again and a series already seen can still be opened if the network drops.
//
// This holds patient images on the device, so it's bounded: entries belong to the signed-in
// user (others' are ignored and removed), expire after a week, the total is capped, and the
// whole store is cleared when the session ends (clearSeriesStore, called from sign-out).
// A stored copy is only used while the server's image list for the series still matches it.

const DB_NAME = "intellidiag-series";
const STORE = "series";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 1024 * 1024 * 1024;

let dbPromise = null;
function openDb() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch(err => { dbPromise = null; throw err; });
  }
  return dbPromise;
}

// Runs fn(store) in one transaction; resolves with the last request's result
async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let result;
    const req = fn(tx.objectStore(STORE));
    if (req) req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const currentOwner = () => localStorage.getItem("sub") ?? "";
const isUsable = (entry) => entry && entry.owner === currentOwner() && Date.now() - entry.savedAt < MAX_AGE_MS;

// { records, blobs, bytes, thumbnail } for a series, or null (missing, expired or another user's)
export async function readStoredSeries(seriesId) {
  const entry = await withStore("readonly", store => store.get(String(seriesId)));
  if (!entry) return null;
  if (!isUsable(entry)) {
    deleteStoredSeries(seriesId).catch(() => {});
    return null;
  }
  return entry;
}

// records: the image records; blobs: one Blob (or null) per record; thumbnail: the series
// card's image (data URL), so the side panel needn't ask the server for one after a reload
export async function writeStoredSeries(seriesId, { records, blobs, bytes, thumbnail = null }) {
  if (bytes > MAX_BYTES) return;
  const entries = await withStore("readonly", store => store.getAll());
  // Drop what's unusable, then the oldest, until this one fits under the cap
  const keep = (entries ?? []).filter(e => e.id !== String(seriesId) && isUsable(e)).sort((a, b) => b.savedAt - a.savedAt);
  let total = bytes;
  const evict = (entries ?? []).filter(e => e.id !== String(seriesId) && !isUsable(e)).map(e => e.id);
  keep.forEach(e => {
    if (total + e.bytes > MAX_BYTES) evict.push(e.id);
    else total += e.bytes;
  });
  await withStore("readwrite", store => {
    evict.forEach(id => store.delete(id));
    return store.put({ id: String(seriesId), owner: currentOwner(), savedAt: Date.now(), records, blobs, bytes, thumbnail });
  });
}

// Add the card thumbnail to a copy stored without one
export async function writeStoredThumbnail(seriesId, thumbnail) {
  await withStore("readwrite", store => {
    const req = store.get(String(seriesId));
    req.onsuccess = () => {
      if (req.result && isUsable(req.result)) store.put({ ...req.result, thumbnail });
    };
  });
}

// Ids of the series this user has a usable copy of (the Blobs in the entries are handles
// to disk, so listing doesn't read the files)
export async function storedSeriesIds() {
  const entries = await withStore("readonly", store => store.getAll());
  return new Set((entries ?? []).filter(isUsable).map(e => e.id));
}

export async function deleteStoredSeries(seriesId) {
  await withStore("readwrite", store => store.delete(String(seriesId)));
}

// Sign-out: nothing of this user's stays on the device
export async function clearSeriesStore() {
  await withStore("readwrite", store => store.clear());
}

// Whether the server's image list still matches the stored copy
export function sameRecords(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((r, i) => String(r.id) === String(b[i].id) && (r.sopInstanceUid ?? null) === (b[i].sopInstanceUid ?? null));
}
