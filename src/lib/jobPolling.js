// Waiting on an AI job: polls its status on the backend until it finishes, the viewer goes
// away, or the job stops moving. An inference worker that crashes never reports back, so a
// job whose status hasn't been updated for STALL_MS is treated as dead: it's marked failed
// and retired, so running the model again starts a fresh job instead of waiting on this one.
import { authFetch } from "./api";

const API = (process.env.REACT_APP_API_BASE || "").trim().replace(/\/$/, "");

export const STALL_MS = 20 * 60 * 1000;
const MAX_FAILED_CHECKS = 5; // status checks in a row that may fail (offline, server busy)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Mark a job failed and retired (best effort)
export async function retireJob(jobId) {
  try {
    await authFetch(`${API}/jobs/update/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "failed", deprecated: true }),
    });
  } catch { /* the next run replaces it anyway */ }
}

// Whether a job of the series is worth picking up instead of starting another: one that
// finished, or one still pending/running that has been updated recently. A failed or
// stalled one should be retired and replaced.
export function isReusable(job) {
  const status = String(job.status).toLowerCase();
  if (status === "completed") return true;
  return (status === "pending" || status === "running") && Date.now() - Date.parse(job.updated_at) <= STALL_MS;
}

// → "completed" | "failed" | "cancelled" (isCancelled() came true). Throws, with a message
// for the user, when the job has stalled, is gone, or the server can't be reached.
export async function waitForJob(jobId, { onProgress, isCancelled = () => false, interval = 2000 } = {}) {
  let failedChecks = 0;
  while (true) {
    await sleep(interval);
    if (isCancelled()) return "cancelled";

    let res;
    try {
      res = await authFetch(`${API}/jobs/check_status/${jobId}`);
    } catch {
      res = null;
    }
    if (isCancelled()) return "cancelled";
    if (res && (res.status === 403 || res.status === 404)) {
      throw new Error("This analysis job no longer exists — run the model again.");
    }
    if (!res || !res.ok) {
      if (++failedChecks >= MAX_FAILED_CHECKS) throw new Error("Lost contact with the server while waiting for the analysis.");
      continue;
    }
    failedChecks = 0;

    const job = await res.json();
    const status = String(job.status).toLowerCase();
    if (status === "completed" || status === "failed") return status;
    if (status === "running") onProgress?.(Math.round(job.progress ?? 0));
    if (Date.now() - Date.parse(job.updated_at) > STALL_MS) {
      await retireJob(jobId);
      throw new Error("The analysis stopped responding (no update for 20 minutes) — run it again.");
    }
  }
}
