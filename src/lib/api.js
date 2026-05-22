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
export const getCases       = (qs = "")  => request("GET", `/cases/${qs}`);
export const getStudies     = (qs = "")  => request("GET", `/studies/${qs}`);
export const getDicomImages = (qs = "")  => request("GET", `/dicom/${qs}`);
export const getReports     = (qs = "")  => request("GET", `/reports/${qs}`);
export const getImagesForStudy  = (seriesId) => request("GET", `/dicom/series/${seriesId}`);
export const getDicomDownloadUrl = (imageId)  => request("GET", `/dicom/${imageId}/download-url`);
// ── Series ────────────────────────────────────────────────────────────────────

/**
 * GET /series/study/{study_id}
 */
export function getSeriesForStudy(studyId) {
  return request("GET", `/series/study/${studyId}`);
}

/**
 * POST /dicom/request-upload
 * Step 1: creates a DicomImage record and returns a presigned S3 URL.
 * @param {{ series_id, filename, instance_number }} payload
 * @returns {{ upload_url: string, dicom_id: string, ... }}
 */
export function requestDicomUpload(payload) {
  return request("POST", "/dicom/request-upload", payload);
}

/**
 * PATCH /dicom/{image_id}/confirm-upload
 * Step 3: notify the backend after the S3 upload succeeds or fails.
 * @param {string} imageId
 * @param {{ status: "uploaded"|"failed", metadata?: object }} payload
 */
export function confirmDicomUpload(imageId, payload) {
  return request("PATCH", `/dicom/${imageId}/confirm-upload`, payload);
}

/**
 * Step 2: upload the file directly to S3 using the presigned URL.
 * Uses XMLHttpRequest so callers can receive progress events.
 * @param {string}   presignedUrl
 * @param {File}     file
 * @param {(pct: number) => void} [onProgress]
 */
export function uploadToS3(presignedUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presignedUrl);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.onload  = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("S3 upload network error"));
    xhr.send(file);
  });
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
