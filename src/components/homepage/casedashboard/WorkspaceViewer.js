import React, { useRef, useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiX } from "react-icons/fi";
import Appbar from "../appbar/appbar";
import Sidepanel from "./sidepanel";
import Midsection from "./midsection";
import RightSection from "./rightsection";
import { getSeriesForStudy, uploadDicom, getModels, authFetch, getStudy, updateStudy } from "../../../lib/api";
import { readSavedLayout, saveLayout } from "../../../lib/viewerLayout";
import { loadSeries, invalidateSeries, prefetchSeriesInBackground, PROJECTION_MODALITIES } from "../../../lib/seriesCache";
import { Info, } from "lucide-react";

const API_BASE = (process.env.REACT_APP_API_URL || "").trim().replace(/\/$/, "");

// The patient history typed into the report is the study's clinical indication (what the
// Add Study form calls "indication", and reports print as "Clinical history"). The latest
// text per study is kept here too, since the workspace remounts on every series switch.
const historyByStudy = new Map();
const HISTORY_SAVE_DELAY_MS = 800;

function WorkspaceViewer({ layout, onLayoutChange }) {
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
  // Carried across series switches (the viewer remounts per series — see the default export)
  const [patientHistory, setPatientHistory] = useState(navState?.patient_history ?? "");
  const [seriesList, setSeriesList] = useState(activeStudy.series ?? []);
  const [noHistoryDialog, setNoHistoryDialog] = useState(false);
  const [reportTab, setReportTab] = useState("system");
  const [viewMode, setViewMode] = useState("stack");
  const [dicomMetadata, setDicomMetadata] = useState(null);
  const [noModelDialog, setNoModelDialog] = useState(false);
  const [noTranslationModeDialog, setNoTranslationModeDialog] = useState(false);
  const [showExpandedAiReport, setshowExpandedAiReport] = useState(false);
  const [expandedTab, setExpandedTab] = useState("system");
  const [selectedTranslationMode, setselectedTranslationMode] = useState(null);
  const [translationActive, setTranslationActive] = useState(false);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(null);
  const [translationResult, setTranslationResult] = useState(null);
  const [jobFailedDialog, setJobFailedDialog] = useState(false);
  const [impression, setImpression] = useState("");
  const [caseId, setCaseId] = useState(activeStudy.case_id ?? null);
  // activeStudy.studyId comes from PatientDetailsPage, activeStudy.id may be a study or series ID
  const [studyId, setStudyId] = useState(activeStudy.study_id ?? activeStudy.studyId ?? (from_jobs ? null : activeStudy.id) ?? null);

  // Resolve case_id and study_id from the series record when not available from navigation
  useEffect(() => {
    if (caseId && studyId) return;
    const seriesId = activeSeries?.id;
    if (!seriesId) return;
    authFetch(`${API_BASE}/series/${seriesId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!caseId) {
          const resolvedCase = data?.case_id ?? data?.study?.case_id;
          if (resolvedCase) setCaseId(resolvedCase);
        }
        if (!studyId) {
          const resolvedStudy = data?.study_id ?? data?.study?.id;
          if (resolvedStudy) setStudyId(resolvedStudy);
        }
      })
      .catch(() => { });
  }, [activeSeries?.id, caseId, studyId]);

  // ── Patient history: load from the study, save (debounced) as it's typed. Nothing is
  // saved until it has loaded, so a failed load can't wipe the stored text.
  const historyLoadedForRef = useRef(historyByStudy.has(String(studyId)) ? String(studyId) : null);
  const historyDirtyRef = useRef(false); // typed before the load finished — keep what was typed
  const patientHistoryRef = useRef(patientHistory);
  patientHistoryRef.current = patientHistory;
  const historyTimerRef = useRef(null);
  useEffect(() => {
    const id = studyId && String(studyId);
    if (!id || historyLoadedForRef.current === id) return;
    if (historyByStudy.has(id)) {
      setPatientHistory(historyByStudy.get(id));
      historyLoadedForRef.current = id;
      return;
    }
    let cancelled = false;
    getStudy(id)
      .then(study => {
        if (cancelled) return;
        const saved = study?.clinical_indication ?? "";
        if (!historyDirtyRef.current) setPatientHistory(saved);
        historyByStudy.set(id, historyDirtyRef.current ? patientHistoryRef.current : saved);
        historyLoadedForRef.current = id;
        if (historyDirtyRef.current) historyTimerRef.current = setTimeout(saveHistory, HISTORY_SAVE_DELAY_MS);
      })
      .catch(err => console.warn("[History] couldn't load the study's clinical history:", err));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId]);

  const saveHistory = useCallback((options) => {
    historyTimerRef.current = null;
    const id = historyLoadedForRef.current;
    if (!id) return;
    updateStudy(id, { clinical_indication: patientHistoryRef.current.trim() || null }, options)
      .catch(err => console.warn("[History] couldn't save the clinical history:", err));
  }, []);
  const handlePatientHistoryChange = (text) => {
    setPatientHistory(text);
    patientHistoryRef.current = text;
    historyDirtyRef.current = true;
    const id = historyLoadedForRef.current;
    if (!id) return; // saved once the load finishes and the next edit comes in
    historyByStudy.set(id, text);
    clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(saveHistory, HISTORY_SAVE_DELAY_MS);
  };
  // Flush on series switch / leaving the viewer, and when the tab is closed, reloaded or
  // hidden (keepalive lets the save finish after the page is gone)
  useEffect(() => {
    const flush = (options) => {
      if (historyTimerRef.current) { clearTimeout(historyTimerRef.current); saveHistory(options); }
    };
    const onHide = () => { if (document.visibilityState === "hidden") flush({ keepalive: true }); };
    const onPageHide = () => flush({ keepalive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flush();
    };
  }, [saveHistory]);

  // Every series in the study, for the side panel's series cards
  useEffect(() => {
    if (!studyId) return;
    let cancelled = false;
    getSeriesForStudy(studyId)
      .then(data => {
        if (cancelled) return;
        setSeriesList((data ?? []).map(s => ({
          id: s.id,
          name: s.series_name,
          description: s.description ?? "",
          modality: s.modality ?? "",
          image_count: s.image_count ?? 0,
        })));
      })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [studyId]);

  const handleSelectSeries = (series) => {
    if (!series || String(series.id) === String(activeSeries?.id)) return;
    navigate("/case-workspace/viewer", {
      replace: true,
      state: {
        ...navState,
        study: { ...activeStudy, study_id: studyId ?? activeStudy.study_id, series: seriesList },
        series,
        case_id: caseId ?? navState?.case_id,
        // The jobs-page entry state belongs to the series the user arrived on
        from_jobs: false,
        job_id: null,
        initial_status: null,
        patient_history: patientHistory,
      },
    });
  };

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

  const enhancementCtx = modelContexts['10000001'] ?? {};
  const enhancementResponse = enhancementCtx.enhancementResponse ?? null;
  const enhancementDone = enhancementCtx.enhancementDone ?? null;
  const enhancementLoading = enhancementCtx.enhancementLoading ?? false;
  const enhancementResult = enhancementCtx.enhancementResult ?? null;
  const enhancementProgress = enhancementCtx.enhancementProgress ?? null;
  const jobStatus = currentCtx.jobStatus ?? null;


  useEffect(() => {
    if (!from_jobs || !jobId) return;
    let cancelled = false;

    // Pre-select the model that was used for this job
    const modelId = navState?.model_id ?? null;
    if (modelId) {
      if (modelId == '10000001') {
        // ── Enhancement job ───────────────────────────────────────────────────
        const fetchEnhancementResults = async () => {
          updateCtx('10000001', { enhancementLoading: true, enhancementProgress: 100 });
          try {
            let results;
            if (process.env.NODE_ENV === 'development') {
              const resR = await authFetch(`${process.env.REACT_APP_API_INFERENCE_BASE}/results/${jobId}`);
              if (!resR.ok) throw new Error(`Results fetch failed: ${resR.status}`);
              results = await resR.json();
            } else {
              const res = await authFetch(`${process.env.REACT_APP_API_INFERENCE_BASE}/results/${jobId}`);
              if (!res.ok) throw new Error(`Results fetch failed: ${res.status}`);
              const { url } = await res.json();
              results = await fetch(url).then(r => r.json());
            }
            if (!cancelled) updateCtx('10000001', { enhancementResult: results });
          } catch {
            if (!cancelled) updateCtx('10000001', { jobStatus: 'failed' });
          } finally {
            if (!cancelled) updateCtx('10000001', { enhancementLoading: false, enhancementProgress: null });
          }
        };

        const pollEnhancement = async () => {
          const status = (initialJobStatus || '').toLowerCase();
          if (status === 'failed') { updateCtx('10000001', { jobStatus: 'failed' }); return; }
          if (status === 'completed') { await fetchEnhancementResults(); return; }

          updateCtx('10000001', { enhancementLoading: true, enhancementProgress: status === 'running' ? 0 : null });

          while (!cancelled) {
            await new Promise(r => setTimeout(r, 2500));
            if (cancelled) break;
            try {
              const res = await authFetch(`${API_BASE}/jobs/check_status/${jobId}`);
              if (!res.ok || cancelled) break;
              const data = await res.json();
              if (data.status === 'running') {
                updateCtx('10000001', { enhancementProgress: Math.round(data.progress ?? 0) });
              } else if (data.status === 'completed') {
                await fetchEnhancementResults(); break;
              } else if (data.status === 'failed') {
                if (!cancelled) updateCtx('10000001', { jobStatus: 'failed', enhancementLoading: false, enhancementProgress: null });
                break;
              }
            } catch { break; }
          }
        };

        pollEnhancement();
        return () => { cancelled = true; };
      }
      else {
        getModels().then(models => {
          const found = (Array.isArray(models) ? models : []).find(m => String(m.id) === String(modelId));
          if (found && !cancelled) setSelectedModel(found);
        }).catch(() => { });
      }

    }

    // Key context updates under the job's model id (falls back to jobId if model unknown)
    const pollModelId = navState?.model_id ?? jobId;

    const fetchResults = async () => {
      updateCtx(pollModelId, { aiLoading: true, inferenceProgress: null });
      try {
        let results;
        if (process.env.NODE_ENV === 'development') {
          const resR = await authFetch(`${process.env.REACT_APP_API_INFERENCE_BASE}/results/${jobId}`);
          if (!resR.ok) throw new Error(`Results fetch failed: ${resR.status}`);
          results = await resR.json();
        } else {
          const res = await authFetch(`${process.env.REACT_APP_API_INFERENCE_BASE}/results/${jobId}`);
          if (!res.ok) throw new Error(`Results fetch failed: ${res.status}`);
          const { url } = await res.json();
          results = await fetch(url).then(r => r.json());
        }
        if (cancelled) return;
        updateCtx(pollModelId, { inferenceResult: results, jobStatus: "completed" });

        // Stream the report
        const slices = Array.isArray(results.slices) ? results.slices : [];
        const isGradCam = slices.some(s => s.predicted_class != null);
        // Classification bundles name their own classes; anatomy bundles report structure
        // volumes rather than "abnormality detected"
        const isClassification = Array.isArray(results.class_labels);
        const isAnatomy = results.class_volumes_cm3 != null;
        const detectedSlices = slices.filter(s => s.detected);
        const meanConf = slices.length ? slices.reduce((a, s) => a + (s.confidence ?? 0), 0) / slices.length : 0;
        const meanCoverage = slices.length ? slices.reduce((a, s) => a + (s.coverage_pct ?? 0), 0) / slices.length : 0;
        const vol = results.volume_analysis ?? {};

        const reportRes = await fetch(`${process.env.REACT_APP_API_INFERENCE_BASE}/report/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metadata: null,
            patient_context: null,
            model_type: isClassification ? "classification" : isGradCam ? "gradcam" : "segmentation",
            detected: isAnatomy || isClassification ? null : detectedSlices.length > 0,
            predicted_class: isGradCam ? (results.predicted_class ?? slices[0]?.predicted_class ?? null) : null,
            scores: isGradCam ? (results.scores ?? slices[0]?.scores ?? null) : null,
            class_labels: results.class_labels ?? null,
            class_volumes_cm3: results.class_volumes_cm3 ?? null,
            mean_confidence: meanConf,
            mean_coverage_pct: meanCoverage,
            total_slices: results.slice_count ?? slices.length,
            slices_with_detection: detectedSlices.length,
            max_coverage_pct: slices.length ? Math.max(...slices.map(s => s.coverage_pct ?? 0)) : 0,
            lesion_count: vol.lesion_count ?? null,
            total_volume_cm3: vol.total_volume_cm3 ?? null,
            largest_lesion_volume_cm3: vol.largest_lesion_volume_cm3 ?? null,
            largest_lesion_slice_range: vol.largest_lesion_slice_range ?? null,
            detection_location: vol.detection_location ?? null,
          }),
        });

        // Try to prefill from a saved report for this series
        const seriesId = activeSeries?.id;
        let hasSavedReport = false;
        if (seriesId) {
          try {
            const savedRes = await authFetch(`${API_BASE}/reports/series/${seriesId}`);
            if (savedRes.ok) {
              const saved = await savedRes.json();
              if (!cancelled) {
                if (saved.ai_report) {
                  updateCtx(pollModelId, { aiResponse: saved.ai_report });
                  hasSavedReport = true;
                }
                if (saved.notes) setImpression(saved.notes);
              }
            }
          } catch { /* no saved report — fall through to streaming */ }
        }

        // Only stream a new report if no saved one exists
        if (!hasSavedReport && reportRes.ok && reportRes.body) {
          const reader = reportRes.body.getReader();
          const decoder = new TextDecoder();
          let text = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done || cancelled) break;
            text += decoder.decode(value, { stream: true });
            updateCtx(pollModelId, { aiResponse: text });
          }
          text += decoder.decode();
          if (!cancelled) updateCtx(pollModelId, { aiResponse: text });
        }
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
    } else if (!inferenceResultRef.current && !modelContexts[currentModelId]?.aiResponse) {
      // Only clear if this model has no results and no report at all — switching back to a model
      // that already completed inference or has a saved report should preserve its state.
      updateCtx(currentModelId, { inferenceResult: null, aiResponse: null });
    }
  }, [selectedImage, currentModelId, images, getCachedInference, updateCtx]);

  // Load the open series from the shared cache (instant if it was already downloaded in
  // the background). The viewer only receives images once the bulk blobs are ready, so
  // Cornerstone never needs to hit /stream.
  useEffect(() => {
    const seriesId = activeSeries?.id;
    if (!seriesId) return;

    let cancelled = false;
    setImagesLoading(true);
    setImages([]);

    loadSeries(seriesId, { renderThumbs: PROJECTION_MODALITIES.has((activeSeries?.modality || "").toUpperCase()) })
      .then(({ images: imgs, metadata }) => {
        if (cancelled) return;
        setImages(imgs);
        if (metadata) setDicomMetadata(metadata);
      })
      .catch(() => { })
      .finally(() => { if (!cancelled) setImagesLoading(false); });

    return () => { cancelled = true; };
  }, [activeSeries?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once the open series is in, download the rest of the study in the background
  // so every series stays viewable offline.
  useEffect(() => {
    if (imagesLoading || !seriesList.length) return;
    prefetchSeriesInBackground(seriesList.filter(s => String(s.id) !== String(activeSeries?.id)));
  }, [imagesLoading, seriesList, activeSeries?.id]);

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

    // The cached copy no longer has every image — drop it and download the series again
    invalidateSeries(seriesId);
    try {
      const { images: imgs, metadata } = await loadSeries(seriesId, { renderThumbs: PROJECTION_MODALITIES.has((activeSeries?.modality || "").toUpperCase()) });
      setImages(imgs);
      if (metadata) setDicomMetadata(metadata);
    } catch (err) {
      // ignore reload error
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

  const enhanceImage = async () => {
    updateCtx('10000001', { jobStatus: null, enhancementLoading: true, enhancementResult: null, enhancementProgress: 0 });
    try {
      const seriesToken = await getSeriesToken();
      const jobs_response = await authFetch(`${API_BASE}/series/${activeSeries?.id}/jobs`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!jobs_response.ok) {
        const errText = await jobs_response.text().catch(() => "");
        throw new Error(`unable to get series jobs: ${jobs_response.status} — ${errText.slice(0, 200)}`);
      }
      const jobs = await jobs_response.json();

      const existingJob = jobs.find(j => String(j.model_id) === '10000001');

      let job_id;
      if (existingJob && existingJob.status !== "failed") {
        job_id = existingJob.id;
      } else {
        // Previous attempt failed — retire that job record and submit a fresh one.
        if (existingJob) await deprecateJob(existingJob.id);
        const newJobId = crypto.randomUUID();
        const response = await fetch(`${process.env.REACT_APP_API_IMAGE_ENHANCEMENT_BASE}/bm3d/enhance`, {
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
            model_id: 10000001,
            viewplane: viewMode === "mpr" ? "axial" : viewMode,
          }),
        });
        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          throw new Error(`Inference failed: ${response.status} — ${errText.slice(0, 200)}`);
        }
        ({ job_id } = await response.json());

        if (!job_id) job_id = newJobId;
      }


      let results = null;
      while (true) {
        await new Promise(r => setTimeout(r, 2000));

        const statusRes = await authFetch(`${API_BASE}/jobs/check_status/${job_id}`);
        if (!statusRes.ok) {
          const errText = await statusRes.text().catch(() => "");
          throw new Error(`Status check failed: ${statusRes.status} — ${errText.slice(0, 200)}`);
        }

        const status = await statusRes.json();

        if (status.status === "running") {
          updateCtx('10000001', { enhancementProgress: Math.round(status.progress ?? 0) });
        } else if (status.status === "completed") {
          updateCtx('10000001', { enhancementProgress: 100 });
          if (process.env.NODE_ENV === 'development') {
            const resR = await authFetch(`${process.env.REACT_APP_API_INFERENCE_BASE}/results/${job_id}`);
            if (!resR.ok) throw new Error(`Results fetch failed: ${resR.status}`);
            results = await resR.json();
          } else {
            const res = await authFetch(`${process.env.REACT_APP_API_INFERENCE_BASE}/results/${job_id}`);
            if (!res.ok) throw new Error(`Results fetch failed: ${res.status}`);
            const { url } = await res.json();
            results = await fetch(url).then(r => r.json());
          }
          break;
        } else if (status.status === "failed") {
          updateCtx('10000001', { jobStatus: "failed" });
          setJobFailedDialog(true);
          throw new Error(status.message || "Image Enhancement job failed");
        }
      }
      if (!results) throw new Error("No results received from inference job");
      updateCtx('10000001', { enhancementResult: results });


    } catch (e) {
      updateCtx('10000001', { enhancementResponse: `Error: ${e.message}` });
    } finally {
      updateCtx('10000001', { enhancementLoading: false, enhancementProgress: null });
    }
  };



  // Fetches a short-lived series-scoped token from the main backend.
  // Used by runAnalysis (for inference); the series cache fetches its own for DICOM retrieval.
  const getSeriesToken = async (seriesId) => {
    const id = seriesId ?? activeSeries?.id;
    const res = await authFetch(`${process.env.REACT_APP_API_BASE}/series/${id}/inference-token`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to get inference token");
    const data = await res.json();
    return data.token;
  };

  // Marks a dead (failed) job record as deprecated so it stops being treated as "the"
  // job for this series+model. Best-effort — a failure here shouldn't block the retry
  // that's about to happen under a new job id.
  const deprecateJob = async (jobId) => {
    try {
      await authFetch(`${API_BASE}/jobs/update/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deprecated: true }),
      });
    } catch (err) {
      console.warn(`Failed to deprecate job ${jobId}:`, err);
    }
  };


  const runAnalysis2 = async ({ skipHistoryCheck = false } = {}) => {
    if (aiLoading) return;
    if (!selectedModel) {
      setNoModelDialog(true);
      return;
    }
    // Nudge for clinical history before running — the user can still continue without it
    if (!skipHistoryCheck && !patientHistory.trim()) {
      setNoHistoryDialog(true);
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

      // Step 2: Use existing job id or submit a new job — but only reuse a job that's
      // still alive. A previously-failed job is a dead end server-side; reusing its id
      // would just re-poll the same stale "failed" status without ever re-running inference.
      let job_id;
      if (existingJob && existingJob.status !== "failed") {
        job_id = existingJob.id;
      } else {
        // Previous attempt failed — retire that job record and submit a fresh one.
        if (existingJob) await deprecateJob(existingJob.id);
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
            view_plane: "axial",
            // Lets the inference service reject the wrong modality and find related MR sequences
            modality: dicomMetadata?.modality || activeSeries?.modality || null,
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

        if (status.status === "running") {
          updateCtx(capturedModelId, { inferenceProgress: Math.round(status.progress ?? 0) });
        } else if (status.status === "completed") {
          updateCtx(capturedModelId, { inferenceProgress: 100 });


          if (process.env.NODE_ENV === 'development') {
            const resR = await authFetch(`${process.env.REACT_APP_API_INFERENCE_BASE}/results/${job_id}`);
            if (!resR.ok) throw new Error(`Results fetch failed: ${resR.status}`);
            results = await resR.json();
          } else {
            const res = await authFetch(`${process.env.REACT_APP_API_INFERENCE_BASE}/results/${job_id}`);
            if (!res.ok) throw new Error(`Results fetch failed: ${res.status}`);
            const { url } = await res.json();
            results = await fetch(url).then(r => r.json());
          }
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

      // Step 4: Stream the report for all result types
      {
        const slices = Array.isArray(results.slices) ? results.slices : [];
        const isGradCam = slices.some(s => s.predicted_class != null);
        // Classification bundles name their own classes; anatomy bundles report structure
        // volumes rather than "abnormality detected"
        const isClassification = Array.isArray(results.class_labels);
        const isAnatomy = results.class_volumes_cm3 != null;
        const detectedSlices = slices.filter(s => s.detected);
        const meanConf = slices.length ? slices.reduce((a, s) => a + (s.confidence ?? 0), 0) / slices.length : 0;
        const meanCoverage = slices.length ? slices.reduce((a, s) => a + (s.coverage_pct ?? 0), 0) / slices.length : 0;
        const vol = results.volume_analysis ?? {};
        const meta = results.dicom_metadata ?? null;

        const reportRes = await fetch(`${process.env.REACT_APP_API_INFERENCE_BASE}/report/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metadata: meta ?? (dicomMetadata ? {
              modality: dicomMetadata.modality ?? null,
              series_description: dicomMetadata.seriesDescription ?? null,
              slice_thickness_mm: dicomMetadata.sliceThickness ?? null,
              pixel_spacing_mm: dicomMetadata.pixelSpacing ?? null,
              rows: dicomMetadata.rows ?? null,
              columns: dicomMetadata.columns ?? null,
            } : null),
            patient_context: [
              dicomMetadata?.patientName && `Patient: ${dicomMetadata.patientName}`,
              dicomMetadata?.patientDob && `DOB: ${dicomMetadata.patientDob}`,
              dicomMetadata?.patientSex && `Sex: ${dicomMetadata.patientSex}`,
              dicomMetadata?.studyDate && `Study date: ${dicomMetadata.studyDate}`,
              dicomMetadata?.studyDescription && `Study: ${dicomMetadata.studyDescription}`,
              dicomMetadata?.institution && `Institution: ${dicomMetadata.institution}`,
              dicomMetadata?.modality && `Modality: ${dicomMetadata.modality}`,
              patientHistory.trim() && `Clinical history: ${patientHistory.trim()}`,
            ].filter(Boolean).join(". ") || null,
            model_type: isClassification ? "classification" : isGradCam ? "gradcam" : "segmentation",
            detected: isAnatomy || isClassification ? null : detectedSlices.length > 0,
            predicted_class: isGradCam ? (results.predicted_class ?? slices[0]?.predicted_class ?? null) : null,
            scores: isGradCam ? (results.scores ?? slices[0]?.scores ?? null) : null,
            class_labels: results.class_labels ?? null,
            class_volumes_cm3: results.class_volumes_cm3 ?? null,
            mean_confidence: meanConf,
            mean_coverage_pct: meanCoverage,
            total_slices: results.slice_count ?? slices.length,
            slices_with_detection: detectedSlices.length,
            max_coverage_pct: slices.length ? Math.max(...slices.map(s => s.coverage_pct ?? 0)) : 0,
            lesion_count: vol.lesion_count ?? null,
            total_volume_cm3: vol.total_volume_cm3 ?? null,
            largest_lesion_volume_cm3: vol.largest_lesion_volume_cm3 ?? null,
            largest_lesion_slice_range: vol.largest_lesion_slice_range ?? null,
            detection_location: vol.detection_location ?? null,
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
    setTranslationLoading(true);
    setTranslationProgress(0);
    setTranslationResult(null);

    const TRANSLATION_BASE = (process.env.REACT_APP_API_IMAGE_TRANSLATION_BASE || "").trim().replace(/\/$/, "");
    const { from, to } = selectedTranslationMode;
    const endpoint = from === "CT" && to === "MR"
      ? `${TRANSLATION_BASE}/image_translation/ct_to_mri`
      : `${TRANSLATION_BASE}/image_translation/mri_to_ct`;
    const direction = from === "CT" ? "ct2mr" : "mri2ct";

    try {
      // Check for an existing translation job on this series
      let activeJobId = null;
      const jobsRes = await authFetch(`${API_BASE}/series/${activeSeries?.id}/jobs`);
      if (jobsRes.ok) {
        const jobs = await jobsRes.json();
        const existing = jobs.find(j => String(j.model_id) === "10000011");
        if (existing) {
          activeJobId = existing.id;
          // If already completed, fetch results immediately and bail out
          if (existing.status === "completed") {
            const resultsRes = await fetch(`${process.env.REACT_APP_API_INFERENCE_BASE}/results/${activeJobId}`);
            if (resultsRes.ok) {
              const raw = await resultsRes.json();
              const resolved = raw.url && !raw.slices
                ? await (await fetch(raw.url)).json()
                : raw;
              setTranslationResult(resolved);
              setTranslationLoading(false);
              return;
            }
          }
        }
      }

      // No completed job found — submit a new one
      if (!activeJobId) {
        const jobId = crypto.randomUUID();
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_id: jobId,
            series_id: String(activeSeries?.id ?? ""),
            user_id: localStorage.getItem("sub") ?? "",
            user_email: localStorage.getItem("email") ?? "",
            user_name: localStorage.getItem("name") ?? "",
            model_id: 10000011,
            view_plane: "axial",
            user_token: localStorage.getItem("token") ?? "",
            direction,
          }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`Translation failed: ${res.status} — ${errText.slice(0, 200)}`);
        }
        const body = await res.json();
        activeJobId = body.job_id || jobId;
      }

      // Resolve results — handles both inline slices and a signed redirect URL
      const resolveResults = async (raw) => {
        if (raw.url && !raw.slices) {
          const redirectRes = await fetch(raw.url);
          if (!redirectRes.ok) throw new Error(`Results redirect fetch failed: ${redirectRes.status}`);
          return redirectRes.json();
        }
        return raw;
      };

      // Poll until completed or failed
      while (true) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await authFetch(`${API_BASE}/jobs/check_status/${activeJobId}`);
        if (!statusRes.ok) throw new Error(`Status check failed: ${statusRes.status}`);
        const status = await statusRes.json();

        if (status.status === "running") {
          setTranslationProgress(Math.round(status.progress ?? 0));
        } else if (status.status === "completed") {
          setTranslationProgress(100);
          const resultsRes = await fetch(`${process.env.REACT_APP_API_INFERENCE_BASE}/results/${activeJobId}`);
          if (!resultsRes.ok) throw new Error(`Results fetch failed: ${resultsRes.status}`);
          const raw = await resultsRes.json();
          setTranslationResult(await resolveResults(raw));
          break;
        } else if (status.status === "failed") {
          throw new Error(status.message || "Translation job failed");
        }
      }
    } catch (e) {
      setTranslationActive(false);
    } finally {
      setTranslationLoading(false);
      setTranslationProgress(null);
    }
  }

  const [reportSaving, setReportSaving] = useState(false);
  const [overrideDialog, setOverrideDialog] = useState(null); // stores payload when 409
  const [reportSuccessDialog, setReportSuccessDialog] = useState(null); // stores { caseId } on success

  const buildReportPayload = () => {
    const payload = {
      title: activeStudy.name || "Radiology Report",
      radiologist: localStorage.getItem("name") || undefined,
      modality: activeSeries?.modality || dicomMetadata?.modality || "Unknown",
      case_id: caseId || undefined,
      study_id: studyId || undefined,
      series_id: activeSeries?.id || undefined,
      job_id: jobId || undefined,
      ai_report: aiResponse || undefined,
      notes: impression.trim() || undefined,
      model_name: selectedModel?.name || undefined,
      severity: undefined,
      tat: undefined,
    };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    return payload;
  };

  const submitReport = async (payload, override = false) => {
    const url = override ? `${API_BASE}/reports/?override=true` : `${API_BASE}/reports/`;
    const res = await authFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res;
  };

  const handleSaveReport = async (impressionText) => {
    if (reportSaving) return;
    setReportSaving(true);
    try {
      const payload = buildReportPayload();
      const res = await submitReport(payload);

      if (res.status === 409) {
        setOverrideDialog(payload);
        return;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Save report failed: ${res.status} — ${errText.slice(0, 200)}`);
      }
      const data = await res.json();
      setReportSuccessDialog({ caseId: data.case_id || caseId });
    } catch (err) {
      // ignore save error
    } finally {
      setReportSaving(false);
    }
  };

  const handleOverrideConfirm = async () => {
    const payload = overrideDialog;
    setOverrideDialog(null);
    setReportSaving(true);
    try {
      const res = await submitReport(payload, true);
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Override report failed: ${res.status} — ${errText.slice(0, 200)}`);
      }
      const data = await res.json();
      setReportSuccessDialog({ caseId: data.case_id || caseId });
    } catch (err) {
      // ignore override error
    } finally {
      setReportSaving(false);
    }
  };

  const expandAiReport = async () => {
    if (!showExpandedAiReport) {
      setshowExpandedAiReport(true);
      return;
    }
    else {
      setshowExpandedAiReport(false)
    }
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
        {noHistoryDialog && (
          <motion.div
            className="fixed inset-0 z-[999] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setNoHistoryDialog(false)}
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
                  <div className="flex flex-row gap-2 "> <Info size={20} className="text-[#ffffff]" /><h2 className="text-white text-[17px] font-medium m-0">No patient history</h2></div>
                  <p className="text-[#6B6B6B] text-[13px] m-0 mt-1">
                    Adding the patient's clinical history helps the AI write a more accurate report. You can still continue without it.
                  </p>
                </div>
                <button onClick={() => setNoHistoryDialog(false)} className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1 mt-0.5">
                  <FiX size={18} />
                </button>
              </div>
              {/* Footer */}
              <div className="px-7 pb-6 flex flex-col gap-2">
                <button
                  onClick={() => { setNoHistoryDialog(false); setReportTab("history"); }}
                  className="w-full py-2.5 rounded-full bg-[#0694FB] hover:bg-[#0578d1] text-white text-[13px] font-medium border-none cursor-pointer transition-colors"
                >
                  Add history
                </button>
                <button
                  onClick={() => { setNoHistoryDialog(false); runAnalysis2({ skipHistoryCheck: true }); }}
                  className="w-full py-2.5 rounded-full bg-transparent hover:bg-[#1E1E1E] text-[#CCCCCC] text-[13px] font-medium border border-[#2a2a2a] cursor-pointer transition-colors"
                >
                  Continue without history
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
                    Toggle a translation mode in order to run an image tanslation.
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

        {overrideDialog && (
          <motion.div
            className="fixed inset-0 z-[1001] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOverrideDialog(null)}
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
                  <div className="flex flex-row gap-2">
                    <Info size={20} className="text-[#F59E0B]" />
                    <h2 className="text-white text-[17px] font-medium m-0">Report already exists</h2>
                  </div>
                  <p className="text-[#6B6B6B] text-[13px] m-0 mt-1">
                    A report for this series already exists. Do you want to override the existing report? This action cannot be undone.
                  </p>
                </div>
                <button onClick={() => setOverrideDialog(null)} className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1 mt-0.5">
                  <FiX size={18} />
                </button>
              </div>
              {/* Footer */}
              <div className="px-7 pb-6 flex gap-3">
                <button
                  onClick={() => setOverrideDialog(null)}
                  className="flex-1 py-2.5 rounded-full bg-transparent border border-[#2a2a2a] text-[#6B6B6B] hover:text-white hover:border-[#3a3a3a] text-[13px] font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOverrideConfirm}
                  disabled={reportSaving}
                  className="flex-1 py-2.5 rounded-full bg-[#F59E0B] hover:bg-[#d97706] text-black text-[13px] font-medium border-none cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {reportSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Overriding…
                    </span>
                  ) : "Override"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {reportSuccessDialog && (
          <motion.div
            className="fixed inset-0 z-[1001] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
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
              <div className="px-7 pt-7 pb-5 flex flex-col gap-3">
                <div className="w-10 h-10 rounded-full bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.2)] flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-white text-[17px] font-medium m-0">Report saved successfully</h2>
                  <p className="text-[#6B6B6B] text-[13px] m-0 mt-1">The report has been generated and saved. Would you like to view it or stay in the workspace?</p>
                </div>
              </div>
              <div className="px-7 pb-6 flex gap-3">
                <button
                  onClick={() => setReportSuccessDialog(null)}
                  className="flex-1 py-2.5 rounded-full bg-transparent border border-[#2a2a2a] text-[#6B6B6B] hover:text-white hover:border-[#3a3a3a] text-[13px] font-medium cursor-pointer transition-colors"
                >
                  Stay in Workspace
                </button>
                <button
                  onClick={() => navigate(`/patient-reports/${reportSuccessDialog.caseId}`)}
                  className="flex-1 py-2.5 rounded-full bg-[#22C55E] hover:bg-[#16a34a] text-white text-[13px] font-medium border-none cursor-pointer transition-colors"
                >
                  View Report
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
              <div className="flex items-center justify-between px-7 pt-6 pb-4 shrink-0">
                <div className="flex gap-2">
                  <button
                    onClick={() => setExpandedTab("system")}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium border-none cursor-pointer transition-all ${
                      expandedTab === "system"
                        ? "bg-[#0694FB] text-white"
                        : "bg-[rgba(6,148,251,0.17)] text-[#0694FB] hover:bg-[rgba(6,148,251,0.25)]"
                    }`}
                  >
                    System Generated Report
                  </button>
                  <button
                    onClick={() => setExpandedTab("yours")}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium border-none cursor-pointer transition-all ${
                      expandedTab === "yours"
                        ? "bg-[#0694FB] text-white"
                        : "bg-[rgba(6,148,251,0.17)] text-[#0694FB] hover:bg-[rgba(6,148,251,0.25)]"
                    }`}
                  >
                    Your Report
                  </button>
                </div>
                <button onClick={() => setshowExpandedAiReport(false)} className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1">
                  <FiX size={18} />
                </button>
              </div>

              {/* Tab content */}
              {expandedTab === "system" ? (
                <div className="flex flex-col flex-1 overflow-y-auto px-7 pb-6" style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}>
                  {renderReport(aiResponse)}
                </div>
              ) : (
                <div className="flex flex-col gap-3 px-7 pb-6 flex-1 min-h-0">
                  <p className="text-[#6B6B6B] text-[10px] uppercase tracking-wide m-0 shrink-0">Radiologist Impression</p>
                  <textarea
                    value={impression}
                    onChange={e => setImpression(e.target.value)}
                    placeholder="Add your impression..."
                    className="flex-1 min-h-0 w-full bg-[#111] border border-[#1E1E1E] rounded-xl px-3 py-2.5 text-white text-[12px] outline-none placeholder-[#3a3a3a] focus:border-[#0694FB] transition-colors resize-none"
                    style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
                  />
                  <button
                    onClick={() => handleSaveReport(impression)}
                    disabled={reportSaving || (!aiResponse && !impression.trim())}
                    className="w-full py-[10px] rounded-full bg-[#0694FB] hover:bg-[#0578d1] text-white text-[13px] font-medium border-none cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {reportSaving ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Saving…
                      </span>
                    ) : "Save & Generate Report"}
                  </button>
                </div>
              )}
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
                seriesList={seriesList}
                activeSeries={activeSeries}
                onSelectSeries={handleSelectSeries}
                shownSeriesIds={translationActive ? [] : layout?.panes?.filter(Boolean).map(s => String(s.id))}
              />
              <Midsection
                selectedImage={selectedImage}
                onSelectImage={setSelectedImage}
                images={images}
                activeStudy={activeStudy}
                activeSeries={activeSeries}
                onRunEnhancement={enhanceImage}
                enhancementLoading={enhancementLoading}
                enhancementProgress={enhancementProgress}
                enhancementResult={enhancementResult}
                onRunAnalysis={runAnalysis2}
                aiLoading={aiLoading}
                inferenceProgress={inferenceProgress}
                inferenceResult={inferenceResult}
                onInferenceResult={(r) => updateCtx(currentModelId, { inferenceResult: r })}
                onRunTranslation={runTranslation}
                translationActive={translationActive}
                translationLoading={translationLoading}
                translationProgress={translationProgress}
                translationResult={translationResult}
                translationMode={selectedTranslationMode}
                onCloseTranslation={() => { setTranslationActive(false); setTranslationResult(null); setTranslationProgress(null); setTranslationLoading(false); }}
                jobStatus={jobStatus}
                onViewModeChange={setViewMode}
                layout={layout}
                onLayoutChange={onLayoutChange}
                seriesList={seriesList}
                onSelectSeries={handleSelectSeries}
              />
              <div className="w-[20%] min-w-[260px] flex flex-col gap-4 overflow-hidden">
                <RightSection aiResponse={aiResponse} aiLoading={aiLoading} onModelSelect={setSelectedModel} expandReport={expandAiReport} onTranslate={setselectedTranslationMode} selectedModel={selectedModel} onSaveReport={handleSaveReport} reportSaving={reportSaving} modality={dicomMetadata?.modality || activeSeries?.modality} impression={impression} onImpressionChange={setImpression} patientHistory={patientHistory} onPatientHistoryChange={handlePatientHistoryChange} reportTab={reportTab} onReportTabChange={setReportTab} />
              </div>
            </div>

          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".dcm,application/dicom,image/jpeg,image/png,image/gif,image/bmp,image/webp,image/tiff,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tiff,.tif" multiple className="hidden" onChange={handleImageUpload} />
    </div>
  );
}

// Remount the whole workspace when the series changes, so inference results, masks,
// translation and the loaded volume from one series never leak into another.
// The viewer layout (lib/viewerLayout) lives out here, so making another pane active —
// which opens its series and remounts the workspace — keeps the other panes in place.
// It's also kept for the tab, so a reload comes back to the same viewers.
function WorkspaceViewerRoute() {
  const { state } = useLocation();
  const [layout, setLayout] = useState(() => readSavedLayout(state?.series?.id));
  useEffect(() => { saveLayout(layout); }, [layout]);
  return <WorkspaceViewer key={state?.series?.id ?? "none"} layout={layout} onLayoutChange={setLayout} />;
}

export default WorkspaceViewerRoute;
