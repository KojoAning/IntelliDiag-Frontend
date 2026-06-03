const BASE = (process.env.REACT_APP_API_URL || "").trim().replace(/\/$/, "");

async function request(method, path, body) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try { const d = await res.json(); message = d.detail || d.message || message; } catch { }
    throw new Error(message);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Generic resource fetchers ─────────────────────────────────────────────────

export const getPatients    = (qs = "")  => request("GET", `/patients/${qs}`);
export const getPatientById = (id)       => request("GET", `/patients/${id}`);
export const getCases       = (qs = "")  => request("GET", `/cases/${qs}`);
export const getStudies     = (qs = "")  => request("GET", `/imaging-studies/${qs}`);
export const getDicomImages = (qs = "")  => request("GET", `/dicom/${qs}`);
export const getReports     = (qs = "")  => request("GET", `/reports/${qs}`);
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
export function uploadDicom(seriesId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("series_id", seriesId);
    form.append("file", file);

    const token = localStorage.getItem("token");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/dicom/upload`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(xhr.responseText ? JSON.parse(xhr.responseText) : null); }
        catch { resolve(null); }
      } else {
        let message = `DICOM upload failed: ${xhr.status}`;
        try { const d = JSON.parse(xhr.responseText); message = d.detail || message; } catch { }
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("DICOM upload network error"));
    xhr.send(form);
  });
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
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("case_id", caseId);
    form.append("file", file);

    const token = localStorage.getItem("token");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/dicom/ingest`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(xhr.responseText ? JSON.parse(xhr.responseText) : null); }
        catch { resolve(null); }
      } else {
        let message = `DICOM ingest failed: ${xhr.status}`;
        try { const d = JSON.parse(xhr.responseText); message = d.detail || message; } catch { }
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("DICOM ingest network error"));
    xhr.send(form);
  });
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
