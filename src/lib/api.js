const BASE = (process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_URL || "").trim().replace(/\/$/, "");

// ── Token refresh ────────────────────────────────────────────────────────────
let refreshPromise = null;


async function tryRefreshToken() {
  // Deduplicate: if a refresh is already in flight, piggyback on it
  if (refreshPromise) return refreshPromise;

  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return false;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) {
        ["token","refresh_token","name","role","sub","email"].forEach(k => localStorage.removeItem(k));
        window.location.href = "/login";
        return false;
      }
      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      return true;
    } catch {
      ["token","refresh_token","name","role","sub","email"].forEach(k => localStorage.removeItem(k));
      window.location.href = "/login";
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request(method, path, body) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // On 401, try refreshing the access token and retry once
  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newToken = localStorage.getItem("token");
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    }
  }

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try { const d = await res.json(); message = d.detail || d.message || message; } catch { }
    throw new Error(message);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Drop-in replacement for `fetch()` that:
 *   1. Injects the Bearer token from localStorage
 *   2. On 401, attempts a token refresh and retries the request once
 *   3. On refresh failure, clears tokens and redirects to /login
 *
 * Usage (same signature as fetch):
 *   const res = await authFetch(url, { method: "POST", body: ... });
 */
export async function authFetch(url, options = {}) {
  const token = localStorage.getItem("token");
  const headers = new Headers(options.headers ?? {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newToken = localStorage.getItem("token");
      headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(url, { ...options, headers });
    }
  }

  return res;
}

// ── Generic resource fetchers ─────────────────────────────────────────────────

export const getPatients    = (qs = "")  => request("GET", `/patients/${qs}`);
export const getPatientById = (id)       => request("GET", `/patients/${id}`);
export const getCases       = (qs = "")  => request("GET", `/cases/${qs}`);
export const getStudies     = (qs = "")  => request("GET", `/imaging-studies/${qs}`);
export const deleteStudy    = (studyId)  => request("DELETE", `/imaging-studies/${studyId}`);
export const getDicomImages = (qs = "")  => request("GET", `/dicom/${qs}`);
export const getReports     = (qs = "")  => request("GET", `/reports/${qs}`);
export const getRecentJobs  = ()         => request("GET", `/jobs/recent`);
export const getSettings              = ()     => request("GET",   `/settings`);
export const patchProfileSettings      = (body) => request("PATCH", `/settings/profile`,        body);
export const patchNotificationSettings = (body) => request("PATCH", `/settings/notifications`,  body);
export const patchSecuritySettings     = (body) => request("PATCH", `/settings/security`,       body);
export const patchDataRetentionSettings= (body) => request("PATCH", `/settings/data-retention`, body);
export const getImagesForStudy  = (seriesId) => request("GET", `/dicom/series/${seriesId}`);
// Backend returns a relative stream path (e.g. "/dicom/{id}/stream"); prepend
// our API base so Cornerstone fetches it from the backend (and the JWT hook,
// which matches on this base, attaches the token).
export const getDicomDownloadUrl = async (imageId) => {
  const res = await request("GET", `/dicom/${imageId}/download-url`);
  return { ...res, download_url: `${BASE}${res.download_url}` };
};
// ── Series ────────────────────────────────────────────────────────────────────

/**
 * GET /series/study/{study_id}
 */
export function getSeriesForStudy(studyId) {
  return request("GET", `/series/study/${studyId}`);
}

/**
 * POST /dicom/upload  (single-step, multipart)
 * Sends the .dcm file directly to the backend, which parses metadata
 * server-side, stores it in the Google Cloud Healthcare API, and creates
 * the DicomImage record. Uses XMLHttpRequest for upload progress events.
 * @param {string} seriesId
 * @param {File}   file
 * @param {(pct: number) => void} [onProgress]
 * @returns {Promise<object>} the created DicomImageResponse
 */
function _xhrUpload(url, form, onProgress) {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem("token");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.onload = () => resolve(xhr);
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(form);
  });
}

async function _xhrUploadWithRefresh(url, form, errorPrefix, onProgress) {
  let xhr = await _xhrUpload(url, form, onProgress);

  if (xhr.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) xhr = await _xhrUpload(url, form, onProgress);
  }

  if (xhr.status >= 200 && xhr.status < 300) {
    try { return xhr.responseText ? JSON.parse(xhr.responseText) : null; }
    catch { return null; }
  }
  let message = `${errorPrefix}: ${xhr.status}`;
  try { const d = JSON.parse(xhr.responseText); message = d.detail || message; } catch { }
  throw new Error(message);
}

export function uploadDicom(seriesId, file, onProgress) {
  const form = new FormData();
  form.append("series_id", seriesId);
  form.append("file", file);
  return _xhrUploadWithRefresh(`${BASE}/dicom/upload`, form, "DICOM upload failed", onProgress);
}

/**
 * POST /dicom/ingest  (PACS-style, multipart)
 * Sends a single .dcm file plus a case id. The backend reconstructs the
 * Study -> Series hierarchy from the embedded DICOM UIDs (creating them only
 * if missing) and files the instance under the resolved series.
 * @param {string} caseId
 * @param {File}   file
 * @param {(pct: number) => void} [onProgress]
 * @returns {Promise<object>} the DicomIngestResponse
 */
export function ingestDicom(caseId, file, onProgress) {
  const form = new FormData();
  form.append("case_id", caseId);
  form.append("file", file);
  return _xhrUploadWithRefresh(`${BASE}/dicom/ingest`, form, "DICOM ingest failed", onProgress);
}

/**
 * Upload a file directly to a presigned/signed storage URL via HTTP PUT.
 * Works for GCS V4 signed URLs (Content-Type is not a signed header, so the
 * browser-set type is ignored by the signature check).
 * Uses XMLHttpRequest so callers can receive progress events.
 * @param {string}   signedUrl
 * @param {File}     file
 * @param {(pct: number) => void} [onProgress]
 */
export function uploadToSignedUrl(signedUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.onload  = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.send(file);
  });
}

/**
 * GET /documents/patient/{patient_id}
 * Fetch all documents for a patient.
 */
export function getDocumentsForPatient(patientId) {
  return request("GET", `/documents/patient/${patientId}`);
}

/**
 * GET /documents/{document_id}/download-url
 * Returns a signed GCS URL to download the document.
 * @returns {{ download_url: string, expires_in: number }}
 */
export function getDocumentDownloadUrl(documentId) {
  return request("GET", `/documents/${documentId}/download-url`);
}

/**
 * POST /documents/request-upload
 * Step 1: Creates a document record and returns a signed GCS upload URL.
 * @param {{ patient_id: string, file_name: string, document_type: string }} payload
 * @returns {{ document_id: string, upload_url: string, gcs_key: string }}
 */
export function requestDocumentUpload(payload) {
  return request("POST", "/documents/request-upload", payload);
}

/**
 * PATCH /documents/{document_id}/confirm-upload
 * Step 2: Mark a document as uploaded or failed after the GCS PUT.
 * @param {string} documentId
 * @param {"uploaded"|"failed"} status
 */
export function confirmDocumentUpload(documentId, status) {
  return request("PATCH", `/documents/${documentId}/confirm-upload`, { status });
}

/**
 * POST /series/
 * @param {{ series_name, series_number, modality, description, study_id }} payload
 */
export function createSeries(payload) {
  return request("POST", "/series/", payload);
}

/**
 * DELETE /series/{series_id}
 */
export function deleteSeries(seriesId) {
  return request("DELETE", `/series/${seriesId}`);
}

// ── Notifications ─────────────────────────────────────────────────────────────

/**
 * GET /notifications/
 * @param {{ unread_only?: boolean, limit?: number, offset?: number }} params
 */
export function getNotifications(params = {}) {
  const qs = new URLSearchParams();
  if (params.unread_only) qs.set("unread_only", "true");
  if (params.limit != null) qs.set("limit", params.limit);
  if (params.offset != null) qs.set("offset", params.offset);
  const q = qs.toString();
  return request("GET", `/notifications/${q ? `?${q}` : ""}`);
}

/** GET /notifications/unread-count */
export const getUnreadCount = () => request("GET", "/notifications/unread-count");

/** PATCH /notifications/{id}/read */
export const markNotificationRead = (id) => request("PATCH", `/notifications/${id}/read`);

/** PATCH /notifications/read-all */
export const markAllNotificationsRead = () => request("PATCH", "/notifications/read-all");

/**
 * GET /models/
 * Returns all AI models available for inference.
 */
export function getModels() {
  return request("GET", "/models/");
}

/**
 * POST /models/{model_id}/infer
 * Run inference on a DICOM image using a specific AI model.
 * Returns one of:
 *   - Classification: { predicted_class, confidence, scores[], heatmap }
 *   - Segmentation:   { has_tumor, tumor_coverage_pct, mean_confidence, mask }
 * @param {string} modelId
 * @param {string} imageId
 * @returns {Promise<object>}
 */
export function runInference(modelId, imageId) {
  return request("POST", `/models/${modelId}/infer`, { image_id: imageId });
}
