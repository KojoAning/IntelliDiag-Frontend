import React, { useRef, useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiX } from "react-icons/fi";
import Appbar from "../appbar/appbar";
import Sidepanel from "./sidepanel";
import Midsection from "./midsection";
import RightSection from "./rightsection";
import { getImagesForStudy, uploadDicom, getModels, authFetch } from "../../../lib/api";
import { renderDicomThumbnail, parseMultipartBody, parseDicomInstanceInfo, getDicomMetadata } from "../../../lib/dicomUtils";
import { thumbCache } from "./sidepanel";
import { Info, } from "lucide-react";

const API_BASE = (process.env.REACT_APP_API_URL || "").trim().replace(/\/$/, "");

function WorkspaceViewer() {
  const { state: navState } = useLocation();
  const navigate = useNavigate();

  // Use navState directly — avoids mock-ID mismatch when series IDs are real UUIDs
  const activeStudy = navState?.study ?? {};
  const activeSeries = navState?.series ?? activeStudy.series?.[0];
  const from_jobs = navState?.from_jobs ?? false;
  const jobId = navState?.job_id ?? null;
  const initialJobStatus = navState?.initial_status ?? null;

  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [modelContexts, setModelContexts] = useState({}); // keyed by model id
  const [selectedModel, setSelectedModel] = useState(null);
  const [dicomMetadata, setDicomMetadata] = useState(null);
  const [noModelDialog, setNoModelDialog] = useState(false);
  const [noTranslationModeDialog, setNoTranslationModeDialog] = useState(false);
  const [showExpandedAiReport, setshowExpandedAiReport] = useState(false);
  const [selectedTranslationMode, setselectedTranslationMode] = useState(null);
  const [translationActive, setTranslationActive] = useState(false);
  const [jobFailedDialog, setJobFailedDialog] = useState(false);
  const [impression, setImpression] = useState("");

  const fileInputRef = useRef(null);

  // ── Per-model context helpers ─────────────────────────────────────────────────
  const updateCtx = useCallback((modelId, patch) => {
    if (!modelId) return;
    setModelContexts(prev => ({
      ...prev,
      [modelId]: { ...(prev[modelId] ?? {}), ...patch },
    }));
  }, []);

  const currentModelId = selectedModel?.id ?? null;
  const currentCtx = modelContexts[currentModelId] ?? {};
  const aiResponse = currentCtx.aiResponse ?? null;
  const aiLoading = currentCtx.aiLoading ?? false;
  const inferenceResult = currentCtx.inferenceResult ?? null;
  const inferenceProgress = currentCtx.inferenceProgress ?? null;
  const jobStatus = currentCtx.jobStatus ?? null;

  // ── Job status polling (when navigated from Jobs page) ───────────────────────
  useEffect(() => {
    if (!from_jobs || !jobId) return;
    let cancelled = false;

    // Pre-select the model that was used for this job
    const modelId = navState?.model_id ?? null;
    if (modelId) {
      getModels().then(models => {
        const found = (Array.isArray(models) ? models : []).find(m => String(m.id) === String(modelId));
        if (found && !cancelled) setSelectedModel(found);
      }).catch(() => { });
    }

    // Key context updates under the job's model id (falls back to jobId if model unknown)
    const pollModelId = navState?.model_id ?? jobId;

    const fetchResults = async () => {
      updateCtx(pollModelId, { aiLoading: true, inferenceProgress: null });
      try {
        const res = await authFetch(`${process.env.REACT_APP_API_INFERENCE_BASE}/results/${jobId}`);
        if (!res.ok) throw new Error(`Results fetch failed: ${res.status}`);
        const { url } = await res.json();
        const results = await fetch(url).then(r => r.json());
        if (cancelled) return;
        updateCtx(pollModelId, { inferenceResult: results, aiResponse: buildSummary(results), jobStatus: "completed" });
      } catch {
        if (!cancelled) updateCtx(pollModelId, { jobStatus: "failed" });
      } finally {
        if (!cancelled) updateCtx(pollModelId, { aiLoading: false, inferenceProgress: null });
      }
    };

    const poll = async () => {
      const status = (initialJobStatus || "").toLowerCase();

      if (status === "failed") { updateCtx(pollModelId, { jobStatus: "failed" }); return; }

      // Completed — auto-load results immediately, no user action needed
      if (status === "completed") { await fetchResults(); return; }

      // Still running/pending — show progress UI and poll until done
      updateCtx(pollModelId, { aiLoading: true, inferenceProgress: status === "running" ? 0 : null });

      while (!cancelled) {
        await new Promise(r => setTimeout(r, 2500));
        if (cancelled) break;
        try {
          const res = await authFetch(`${API_BASE}/jobs/check_status/${jobId}`);
          if (!res.ok || cancelled) break;
          const data = await res.json();
          if (data.status === "running") {
            updateCtx(pollModelId, { inferenceProgress: Math.round(data.progress ?? 0) });
          } else if (data.status === "completed") {
            await fetchResults(); break;
          } else if (data.status === "failed") {
            if (!cancelled) updateCtx(pollModelId, { jobStatus: "failed", aiLoading: false, inferenceProgress: null });
            break;
          }
        } catch { break; }
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [from_jobs, jobId, initialJobStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show the job-failed dialog only after slices have finished loading
  useEffect(() => {
    if (!imagesLoading && jobStatus === "failed") {
      setJobFailedDialog(true);
    }
  }, [imagesLoading, jobStatus]);

  // ── Inference cache (localStorage) ──────────────────────────────────────────
  // Key: "inference_<imageId>_<modelId>"  Value: { result, report }
  const cacheKey = useCallback((imageId, modelId) => `inference_${imageId}_${modelId}`, []);
  function renderReport(text) {
    if (!text) return null;
    const lines = text.split("\n");

    return lines.map((line, i) => {
      // Heading: ### Findings
      const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
      if (headingMatch) {
        return (
          <p key={i} className="text-[#0694FB] text-[13px] font-semibold m-0 mt-2 mb-0.5">
            {renderInline(headingMatch[2])}
          </p>
        );
      }

      // Bullet: - item or * item
      const bulletMatch = line.match(/^[-*]\s+(.+)/);
      if (bulletMatch) {
        return (
          <div key={i} className="flex items-start gap-2 my-0.5">
            <span className="text-[#0694FB] text-[10px] mt-[3px] shrink-0">●</span>
            <span className="text-[#CCCCCC] text-[12px] leading-relaxed">{renderInline(bulletMatch[1])}</span>
          </div>
        );
      }

      // Empty line → small spacer
      if (!line.trim()) {
        return <div key={i} className="h-1.5" />;
      }

      // Plain line
      return (
        <p key={i} className="text-[#CCCCCC] text-[12px] m-0 leading-relaxed">
          {renderInline(line)}
        </p>
      );
    });
  }

  function renderInline(text) {
    // Split on **bold** and *italic* patterns, preserving delimiters as groups
    const parts = text.split(/(\*\*[^*]+?\*\*|\*[^*]+?\*|__[^_]+?__|_[^_]+?_)/g);
    return parts.map((part, i) => {
      // **bold** or __bold__
      if (/^\*\*(.+)\*\*$/.test(part) || /^__(.+)__$/.test(part)) {
        const inner = part.replace(/^\*\*|\*\*$|^__|__$/g, "");
        return <span key={i} className="text-white font-semibold">{inner}</span>;
      }
      // *italic* or _italic_
      if (/^\*(.+)\*$/.test(part) || /^_(.+)_$/.test(part)) {
        const inner = part.replace(/^\*|\*$|^_|_$/g, "");
        return <span key={i} className="text-[#8a8a8a] italic">{inner}</span>;
      }
      return part;
    });
  }

  const getCachedInference = useCallback((imageId, modelId) => {
    if (!imageId || !modelId) return null;
    try {
      const raw = localStorage.getItem(cacheKey(imageId, modelId));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [cacheKey]);

  const setCachedInference = useCallback((imageId, modelId, result, report) => {
    if (!imageId || !modelId) return;
    try {
      localStorage.setItem(cacheKey(imageId, modelId), JSON.stringify({ result, report }));
    } catch { /* storage full — silently skip */ }
  }, [cacheKey]);

  // Keep a ref so the effect below can read inferenceResult without depending on it.
  const inferenceResultRef = useRef(inferenceResult);
  inferenceResultRef.current = inferenceResult;

  // When the selected image changes, restore cached inference or clear state.
  // Exception: bulk segmentation results (masks array) cover the whole series —
  // switching thumbnails just changes the visible slice, so don't clear them.
  useEffect(() => {
    if (!currentModelId) return;
    if (!selectedImage) {
      // Don't wipe a result that was already fetched (e.g. auto-loaded from Jobs page)
      // — images reset to [] during DICOM loading which briefly sets selectedImage to null.
      if (!inferenceResultRef.current) {
        updateCtx(currentModelId, { inferenceResult: null, aiResponse: null });
      }
      return;
    }
    const img = images.find(i => (i.blobUrl ?? i.url) === selectedImage);
    const cached = getCachedInference(img?.id, currentModelId);
    if (cached) {
      updateCtx(currentModelId, { inferenceResult: cached.result, aiResponse: cached.report });
    } else if (!inferenceResultRef.current) {
      // Only clear if this model has no results at all — switching back to a model
      // that already completed inference should preserve its results regardless of type.
      updateCtx(currentModelId, { inferenceResult: null, aiResponse: null });
    }
  }, [selectedImage, currentModelId, images, getCachedInference, updateCtx]);

  // Fetch all uploaded images for a series.
  // Constructs stream URLs directly (1 API call instead of N).
  const fetchImages = useCallback(async (seriesId) => {
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
  }, []);

  // Single bulk DICOM fetch for the whole series.
  // Returns the imgs array with blobUrl attached to each entry, and pre-populates thumbCache.
  // The viewer only receives images AFTER this resolves — Cornerstone never touches /stream.
  const prefetchBulk = useCallback(async (seriesId, imgs) => {
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
    console.log("[prefetchBulk] content-type:", contentType);
    // Boundary may be quoted: boundary="abc" or unquoted: boundary=abc
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
    const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
    if (!boundary) throw new Error(`No multipart boundary in bulk response. content-type: ${contentType}`);

    const buffer = await res.arrayBuffer();
    const parts = parseMultipartBody(buffer, boundary);
    console.log(`[prefetchBulk] ${parts.length} parts parsed, ${imgs.length} imgs expected`);

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
      console.warn("[prefetchBulk] instance sort failed, using original order:", sortErr);
    }

    const blobUrls = new Array(imgs.length).fill(null);
    await Promise.all(orderedParts.map(async (part, i) => {
      if (!imgs[i]) return;
      const blob = new Blob([part], { type: "application/dicom" });
      const blobUrl = URL.createObjectURL(blob);
      blobUrls[i] = blobUrl;

      if (!thumbCache.has(imgs[i].id)) {
        const src = await renderDicomThumbnail(blob);
        if (src) thumbCache.set(imgs[i].id, src);
      }
    }));

    const result = imgs.map((img, i) => blobUrls[i] ? { ...img, blobUrl: blobUrls[i] } : img);
    const missing = result.filter(img => !img.blobUrl).length;
    if (missing) console.warn(`[prefetchBulk] ${missing} image(s) have no blobUrl — will fall back to stream`);

    // Extract DICOM metadata from the first available slice
    const firstBlobUrl = blobUrls.find(Boolean);
    const metadata = firstBlobUrl ? await getDicomMetadata(firstBlobUrl).catch(() => null) : null;

    return { images: result, metadata };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const seriesId = activeSeries?.id;
    if (!seriesId) return;

    let cancelled = false;
    setImagesLoading(true);
    setImages([]);

    fetchImages(seriesId)
      .then(async imgs => {
        if (cancelled) return;
        // Sidebar gets the image list immediately (shows slice count + spinners)
        // but we hold off setting full images until bulk blobs are ready so
        // Cornerstone never needs to hit /stream.
        try {
          const { images: imgsWithBlobs, metadata } = await prefetchBulk(seriesId, imgs);
          if (!cancelled) {
            setImages(imgsWithBlobs);
            setDicomMetadata(metadata);
          }
        } catch (bulkErr) {
          console.error("[prefetchBulk] failed, falling back to stream URLs:", bulkErr);
          if (!cancelled) setImages(imgs);
        }
      })
      .catch(err => console.error("Failed to load images:", err))
      .finally(() => { if (!cancelled) setImagesLoading(false); });

    return () => { cancelled = true; };
  }, [activeSeries?.id, fetchImages, prefetchBulk]);

  // Upload selected DICOM files to the active series, then reload from backend.
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = null;
    if (!files.length) return;

    const seriesId = activeSeries?.id;
    if (!seriesId) {
      setUploadError("No series is open — can't add images.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    const errors = [];

    for (const file of files) {
      try {
        await uploadDicom(seriesId, file);
      } catch (err) {
        // 409 (already uploaded) is non-fatal; report anything else.
        if (!/already been uploaded/i.test(err.message)) {
          errors.push(`${file.name}: ${err.message}`);
        }
      }
    }

    try {
      setImages(await fetchImages(seriesId));
    } catch (err) {
      console.error("Failed to reload images:", err);
    }

    if (errors.length) setUploadError(errors.join(" · "));
    setUploading(false);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Free-text clinical context sent alongside the model output so the
  // report writer can ground its narrative (age, modality, region, …).
  const buildPatientContext = () => {
    return [
      activeStudy.name,
      activeStudy.region && `Region: ${activeStudy.region}`,
      activeSeries?.modality && `Modality: ${activeSeries.modality}`,
      activeStudy.date && `Study date: ${activeStudy.date}`,
    ].filter(Boolean).join(". ");
  };

  // Local fallback summary used when the /report/stream endpoint is unavailable.
  const buildSummary = (result) => {
    const lines = [];
    if (Array.isArray(result.slices)) {
      const tumorSlices = result.slices.filter(s => s.has_tumor);
      lines.push(`Slices analysed: ${result.slices.length}`);
      lines.push(`Tumor detected in: ${tumorSlices.length} slice${tumorSlices.length !== 1 ? "s" : ""}`);
      const meanConf = result.slices.reduce((s, m) => s + m.confidence, 0) / result.slices.length;
      lines.push(`Mean confidence: ${(meanConf * 100).toFixed(1)}%`);
    } else if (result.predicted_class !== undefined) {
      lines.push(`Predicted class: ${result.predicted_class}`);
      lines.push(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      if (result.scores?.length) {
        lines.push(`Scores: ${result.scores.map(s => s.toFixed(3)).join(", ")}`);
      }
      if (result.heatmap) lines.push(`GradCAM heatmap available`);
    } else if (result.has_tumor !== undefined) {
      lines.push(`Tumor detected: ${result.has_tumor ? "Yes" : "No"}`);
      lines.push(`Coverage: ${(result.tumor_coverage_pct * 100).toFixed(1)}%`);
      lines.push(`Mean confidence: ${(result.mean_confidence * 100).toFixed(1)}%`);
    }
    return lines.join("\n") || "Analysis complete — no summary available.";
  };

  const runAnalysis = async () => {
    if (aiLoading) return;

    if (!selectedModel) {
      setNoModelDialog(true);
      return;
    }

    const capturedModelId = selectedModel.id;

    if (!selectedImage) {
      updateCtx(capturedModelId, { aiResponse: "Please select an image first." });
      return;
    }

    const img = images.find(i => (i.blobUrl ?? i.url) === selectedImage);
    if (!img) {
      updateCtx(capturedModelId, { aiResponse: "Could not find the selected image." });
      return;
    }

    // Check cache first — skip the network round-trip if we already have results
    const cached = getCachedInference(img.id, capturedModelId);
    if (cached) {
      updateCtx(capturedModelId, { inferenceResult: cached.result, aiResponse: cached.report });
      return;
    }

    updateCtx(capturedModelId, { aiLoading: true, aiResponse: "", inferenceResult: null, inferenceProgress: 0 });

    const modelUrl = selectedModel.url || selectedModel.endpoint_url || selectedModel.inference_url || selectedModel.endpoint;

    try {
      const seriesToken = await getSeriesToken();

      const response = await fetch(modelUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: seriesToken,
          series_id: activeSeries?.id,
          image_id: img.id,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Inference failed: ${response.status} — ${errText.slice(0, 200)}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleSseLine = async (line) => {
        if (!line.startsWith("data: ")) return;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.status === "processing") {
            updateCtx(capturedModelId, { inferenceProgress: Math.round(event.processed / event.total * 100) });
          } else if (event.status === "done") {
            const results = await authFetch(`${API_BASE}/results/${event.job_id}`).then(r => r.json());
            const summary = buildSummary(results);
            updateCtx(capturedModelId, { inferenceResult: results, aiResponse: summary });
            setCachedInference(img.id, capturedModelId, results, summary);
          } else if (event.status === "error") {
            console.error("Inference error:", event.message);
            updateCtx(capturedModelId, { aiResponse: `Error: ${event.message}` });
          }
        } catch { /* malformed SSE line — skip */ }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();
          for (const line of lines) await handleSseLine(line);
        }
      } catch { /* ERR_INCOMPLETE_CHUNKED_ENCODING — server closed without proper terminator */ }
      // flush whatever is in the buffer regardless of how the stream ended
      if (buffer) await handleSseLine(buffer);

    } catch (e) {
      updateCtx(capturedModelId, { aiResponse: `Error: ${e.message}` });
    } finally {
      updateCtx(capturedModelId, { aiLoading: false, inferenceProgress: null });
    }
  };

  const getDicomMetaData = async () => {

  }

  // Fetches a short-lived series-scoped token from the main backend.
  // Used by both prefetchBulk (for DICOM retrieval) and runAnalysis (for inference).
  const getSeriesToken = async (seriesId) => {
    const id = seriesId ?? activeSeries?.id;
    const res = await authFetch(`${process.env.REACT_APP_API_BASE}/series/${id}/inference-token`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to get inference token");
    const data = await res.json();

    // const res2 = await fetch(`${process.env.REACT_APP_API_INFERENCE_BASE}/segment`, {
    //   method: "POST",
    //   body: {
    //     "series_id": seriesId,
    //     "token": data.token
    //   },
    //   headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    // });

    // const data2 = await res2.json();
    // console.log(data2)

    return data.token;
  };


  const runAnalysis2 = async () => {
    if (aiLoading) return;
    if (!selectedModel) {
      setNoModelDialog(true);
      return;
    }
    const capturedModelId = selectedModel.id;
    updateCtx(capturedModelId, { jobStatus: null, aiLoading: true, aiResponse: "", inferenceResult: null, inferenceProgress: 0 });

    try {

      const seriesToken = await getSeriesToken();

      // Step 1: Submit job, get job_id back
      const jobs_response = await authFetch(`${API_BASE}/series/${activeSeries?.id}/jobs`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!jobs_response.ok) {
        const errText = await jobs_response.text().catch(() => "");
        throw new Error(`unable to get series jobs: ${jobs_response.status} — ${errText.slice(0, 200)}`);
      }
      const jobs = await jobs_response.json();

      const existingJob = jobs.find(j => String(j.model_id) === String(selectedModel?.id));

      // Step 2: Use existing job id or submit a new job
      let job_id;
      if (existingJob) {
        job_id = existingJob.id;
      } else {
        const newJobId = crypto.randomUUID();
        const response = await fetch(`${process.env.REACT_APP_API_INFERENCE_BASE}${selectedModel.endpoint_url}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_id: newJobId,
            series_id: activeSeries?.id,
            token: seriesToken,
            user_token: localStorage.getItem("token"),
            user_id: localStorage.getItem("sub"),
            user_email: localStorage.getItem("email"),
            user_name: localStorage.getItem("name"),
            model_id: String(selectedModel.id),
          }),
        });
        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          throw new Error(`Inference failed: ${response.status} — ${errText.slice(0, 200)}`);
        }
        ({ job_id } = await response.json());
        // Fall back to the client-generated ID if the response doesn't include one
        if (!job_id) job_id = newJobId;
      }

      // Step 3: Poll until COMPLETED or FAILED
      let results = null;
      while (true) {
        await new Promise(r => setTimeout(r, 2000));

        const statusRes = await authFetch(`${API_BASE}/jobs/check_status/${job_id}`);
        if (!statusRes.ok) {
          const errText = await statusRes.text().catch(() => "");
          throw new Error(`Status check failed: ${statusRes.status} — ${errText.slice(0, 200)}`);
        }

        const status = await statusRes.json();

        console.log(status.status)
        if (status.status === "running") {
          updateCtx(capturedModelId, { inferenceProgress: Math.round(status.progress ?? 0) });
        } else if (status.status === "completed") {
          updateCtx(capturedModelId, { inferenceProgress: 100 });
          results = await authFetch(
            `${process.env.REACT_APP_API_INFERENCE_BASE}/results/${job_id}`
          ).then(r => r.json());
          break;
        } else if (status.status === "failed") {
          updateCtx(capturedModelId, { jobStatus: "failed" });
          setJobFailedDialog(true);
          throw new Error(status.message || "Inference job failed");
        }
        // any other status (PENDING, QUEUED, etc.) — keep polling
      }

      if (!results) throw new Error("No results received from inference job");
      updateCtx(capturedModelId, { inferenceResult: results });

      // Step 4: Stream the report (segmentation path only — GradCAM/classification use buildSummary)
      if (Array.isArray(results.slices)) {
        const tumorSlices = results.slices.filter(s => s.has_tumor);
        const firstTumor = results.slices.findIndex(s => s.has_tumor);
        const lastTumor = results.slices.findLastIndex(s => s.has_tumor);

        const reportRes = await fetch(`${process.env.REACT_APP_API_INFERENCE_BASE}/report/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metadata: dicomMetadata ? {
              modality: dicomMetadata.modality ?? null,
              series_description: dicomMetadata.seriesDescription ?? null,
              slice_thickness_mm: dicomMetadata.sliceThickness ?? null,
              pixel_spacing_mm: dicomMetadata.pixelSpacing ?? null,
              rows: dicomMetadata.rows ?? null,
              columns: dicomMetadata.columns ?? null,
            } : null,
            patient_context: dicomMetadata ? [
              dicomMetadata.patientName && `Patient: ${dicomMetadata.patientName}`,
              dicomMetadata.patientDob && `DOB: ${dicomMetadata.patientDob}`,
              dicomMetadata.patientSex && `Sex: ${dicomMetadata.patientSex}`,
              dicomMetadata.studyDate && `Study date: ${dicomMetadata.studyDate}`,
              dicomMetadata.studyDescription && `Study: ${dicomMetadata.studyDescription}`,
              dicomMetadata.institution && `Institution: ${dicomMetadata.institution}`,
              dicomMetadata.modality && `Modality: ${dicomMetadata.modality}`,
            ].filter(Boolean).join(". ") || null : null,
            has_tumor: tumorSlices.length > 0,
            tumor_coverage_pct: results.slices.reduce((a, s) => a + s.tumor_size, 0) / results.slice_count,
            mean_confidence: results.slices.reduce((a, s) => a + s.confidence, 0) / results.slice_count,
            total_slices: results.slice_count,
            slices_with_tumor: tumorSlices.length,
            max_slice_coverage_pct: Math.max(...results.slices.map(s => s.tumor_size)),
            tumor_location: firstTumor !== -1 ? `slices ${firstTumor + 1}-${lastTumor + 1} of ${results.slice_count}` : null,
          }),
        });

        if (reportRes.ok && reportRes.body) {
          const reportReader = reportRes.body.getReader();
          const reportDecoder = new TextDecoder();
          let reportText = "";
          while (true) {
            const { done, value } = await reportReader.read();
            if (done) break;
            reportText += reportDecoder.decode(value, { stream: true });
            updateCtx(capturedModelId, { aiResponse: reportText });
          }
          reportText += reportDecoder.decode();
          updateCtx(capturedModelId, { aiResponse: reportText || buildSummary(results) });
        } else {
          updateCtx(capturedModelId, { aiResponse: buildSummary(results) });
        }
      } else {
        // GradCAM / classification / binary detection — use local summary
        updateCtx(capturedModelId, { aiResponse: buildSummary(results) });
      }





    } catch (e) {
      updateCtx(capturedModelId, { aiResponse: `Error: ${e.message}` });
    } finally {
      updateCtx(capturedModelId, { aiLoading: false, inferenceProgress: null });
    }
  };




  const runTranslation = async () => {
    if (!selectedTranslationMode) {
      setNoTranslationModeDialog(true);
      return;
    }
    setTranslationActive(true);
  }

  const expandAiReport = async () => {
    if (!showExpandedAiReport) {
      setshowExpandedAiReport(true);
      return;
    }
    else {
      setshowExpandedAiReport(false)
    }
    console.log('started running translation');
  }

  return (
    <div className="m-0 p-0 h-screen bg-black w-screen">
      {/* No-model dialog */}
      <AnimatePresence>
        {noModelDialog && (
          <motion.div
            className="fixed inset-0 z-[999] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setNoModelDialog(false)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-[400px] bg-[#161616] border border-[#1E1E1E] rounded-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between px-7 pt-7 pb-5">
                <div>

                  <div className="flex flex-row gap-2 "> <Info size={20} className="text-[#ffffff]" /><h2 className="text-white text-[17px] font-medium m-0">No inference model selected</h2></div>

                  <p className="text-[#6B6B6B] text-[13px] m-0 mt-1">
                    Add and select an inference model from the panel on the right before running analysis.
                  </p>
                </div>
                <button onClick={() => setNoModelDialog(false)} className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1 mt-0.5">
                  <FiX size={18} />
                </button>
              </div>
              {/* Footer */}
              <div className="px-7 pb-6">
                <button
                  onClick={() => setNoModelDialog(false)}
                  className="w-full py-2.5 rounded-full bg-[#0694FB] hover:bg-[#0578d1] text-white text-[13px] font-medium border-none cursor-pointer transition-colors"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {noTranslationModeDialog && (
          <motion.div
            className="fixed inset-0 z-[999] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setNoModelDialog(false)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-[400px] bg-[#161616] border border-[#1E1E1E] rounded-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between px-7 pt-7 pb-5">
                <div>

                  <div className="flex flex-row gap-2 "> <Info size={20} className="text-[#ffffff]" /><h2 className="text-white text-[17px] font-medium m-0">No Translation mode selected</h2></div>

                  <p className="text-[#6B6B6B] text-[13px] m-0 mt-1">
                    Toggle a translation mode in order ti run an image tanslation.
                  </p>
                </div>
                <button onClick={() => setNoTranslationModeDialog(false)} className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1 mt-0.5">
                  <FiX size={18} />
                </button>
              </div>


              {/* Footer */}
              <div className="px-7 pb-6">
                <button
                  onClick={() => setNoTranslationModeDialog(false)}
                  className="w-full py-2.5 rounded-full bg-[#0694FB] hover:bg-[#0578d1] text-white text-[13px] font-medium border-none cursor-pointer transition-colors"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showExpandedAiReport && (
          <motion.div
            className="fixed inset-0 z-[999] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setNoModelDialog(false)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-[600px] bg-[#161616] border border-[#1E1E1E] rounded-2xl flex flex-col overflow-hidden max-h-[700px]"
            >
              {/* Header */}
              <div className="flex-col items-start justify-between px-7 pt-7 pb-5 gap-3">
                <div>
                  <div className="flex items-center justify-between shrink-0">
                    <div className="bg-[rgba(6,148,251,0.17)] rounded-full px-3 py-1.5 flex items-center gap-1.5">
                      <p className="text-[#0694FB] text-[12px] font-medium m-0">AI Generated Report</p>
                    </div>
                    <button onClick={() => setshowExpandedAiReport(false)} className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1 mt-0.5">
                      <FiX size={18} />
                    </button>
                  </div>
                </div>


              </div>
              <div className="flex flex-col flex-1 overflow-y-auto px-7 pb-4" style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}>
                {renderReport(aiResponse)}
              </div>

              {/* Radiologist Impression */}
              <div className="px-7 pb-4 flex flex-col gap-2 border-t border-[#1E1E1E] pt-4 shrink-0 h-[180px]">
                <p className="text-[#6B6B6B] text-[10px] uppercase tracking-wide m-0 shrink-0">Radiologist Impression</p>
                <textarea
                  value={impression}
                  onChange={e => setImpression(e.target.value)}
                  placeholder="Add your impression..."
                  className="flex-1 min-h-0 w-full bg-[#111] border border-[#1E1E1E] rounded-xl px-3 py-2.5 text-white text-[12px] outline-none placeholder-[#3a3a3a] focus:border-[#0694FB] transition-colors resize-none"
                  style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
                />
              </div>

              {/* Footer */}
              <div className="px-7 pb-6 shrink-0">
                <button
                  onClick={() => setshowExpandedAiReport(false)}
                  disabled={!aiResponse && !impression.trim()}
                  className="w-full py-2.5 rounded-full text-[13px] font-medium border-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#0694FB] hover:bg-[#0578d1] enabled:cursor-pointer text-white"
                >
                  Save & Generate Report
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {jobFailedDialog && (
          <motion.div
            className="fixed inset-0 z-[999] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setJobFailedDialog(false)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-[400px] bg-[#161616] border border-[#1E1E1E] rounded-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-start justify-between px-7 pt-7 pb-5">
                <div>
                  <div className="flex flex-row gap-2">
                    <FiX size={20} className="text-red-400 shrink-0 mt-0.5" />
                    <h2 className="text-white text-[17px] font-medium m-0">Inference job failed</h2>
                  </div>
                  <p className="text-[#6B6B6B] text-[13px] m-0 mt-1">
                    This inference job did not complete successfully. You can re-run the analysis from the viewer using a selected model.
                  </p>
                </div>
                <button onClick={() => setJobFailedDialog(false)} className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1 mt-0.5">
                  <FiX size={18} />
                </button>
              </div>
              <div className="px-7 pb-6">
                <button
                  onClick={() => setJobFailedDialog(false)}
                  className="w-full py-2.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[13px] font-medium border border-red-500/20 cursor-pointer transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex flex-col px-[33px] py-[28px] w-full h-screen box-border overflow-hidden">
        <Appbar />

        <div className="w-full flex flex-row box-border mt-[30px] flex-1 min-h-0">
          <div className="flex flex-col flex-1 min-w-0 gap-4 overflow-hidden">

            {/* Page header */}
            {/* <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-white text-[25px] font-medium m-0 leading-tight pb-1">
                      {activeStudy.name}
                    </h1>
                    <span className="text-[#6B6B6B] text-[18px] font-light">/</span>
                    <span className="text-[#6B6B6B] text-[17px] font-light">{activeSeries?.name}</span>
                  </div>
                  <p className="text-[#6B6B6B] text-sm m-0">{activeStudy.date} · {activeStudy.region}</p>
                </div>
              </div>


            </div> */}

            {/* Viewer layout */}
            <div className="flex flex-row gap-4 flex-1 min-h-0 overflow-hidden relative">
              {(imagesLoading || uploading) && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-xl">
                  <div className="w-8 h-8 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
                  <p className="text-[#6B6B6B] text-sm m-0">{uploading ? "Uploading…" : "Loading images…"}</p>
                </div>
              )}
              {uploadError && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 max-w-[80%] bg-[rgba(255,59,59,0.15)] border border-[#FF3B3B] text-[#FF3B3B] text-xs px-4 py-2 rounded-lg">
                  {uploadError}
                </div>
              )}
              <Sidepanel
                images={images}
                onUploadClick={handleUploadClick}
                onSelectImage={setSelectedImage}
                selectedImage={selectedImage}
                loading={imagesLoading || uploading}
                inferenceResult={inferenceResult}
              />
              <Midsection
                selectedImage={selectedImage}
                onSelectImage={setSelectedImage}
                images={images}
                activeStudy={activeStudy}
                activeSeries={activeSeries}
                onRunAnalysis={runAnalysis2}
                aiLoading={aiLoading}
                inferenceProgress={inferenceProgress}
                inferenceResult={inferenceResult}
                onInferenceResult={(r) => updateCtx(currentModelId, { inferenceResult: r })}
                onRunTranslation={runTranslation}
                translationActive={translationActive}
                translationMode={selectedTranslationMode}
                onCloseTranslation={() => setTranslationActive(false)}
                jobStatus={jobStatus}
              />
              <div className="w-[20%] min-w-[260px] flex flex-col gap-4 overflow-hidden">
                <RightSection aiResponse={aiResponse} aiLoading={aiLoading} onModelSelect={setSelectedModel} expandReport={expandAiReport} onTranslate={setselectedTranslationMode} selectedModel={selectedModel} />
              </div>
            </div>

          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".dcm,application/dicom,image/jpeg,image/png,image/gif,image/bmp,image/webp,image/tiff,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tiff,.tif" multiple className="hidden" onChange={handleImageUpload} />
    </div>
  );
}

export default WorkspaceViewer;
