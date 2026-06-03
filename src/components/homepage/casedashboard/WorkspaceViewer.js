import React, { useRef, useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Appbar from "../appbar/appbar";
import Sidepanel from "./sidepanel";
import Midsection from "./midsection";
import RightSection from "./rightsection";
import { getImagesForStudy, getDicomDownloadUrl, uploadDicom } from "../../../lib/api";

function WorkspaceViewer() {
  const { state: navState } = useLocation();
  const navigate = useNavigate();

  // Use navState directly — avoids mock-ID mismatch when series IDs are real UUIDs
  const activeStudy = navState?.study ?? {};
  const activeSeries = navState?.series ?? activeStudy.series?.[0];

  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [aiResponse, setAiResponse]   = useState(null);
  const [aiLoading, setAiLoading]     = useState(false);
  const [inferenceResult, setInferenceResult] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);

  const fileInputRef = useRef(null);

  // ── Inference cache (localStorage) ──────────────────────────────────────────
  // Key: "inference_<imageId>_<modelId>"  Value: { result, report }
  const cacheKey = useCallback((imageId, modelId) => `inference_${imageId}_${modelId}`, []);

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

  // When the selected image changes, restore cached inference or clear state.
  useEffect(() => {
    if (!selectedImage) {
      setInferenceResult(null);
      setAiResponse(null);
      return;
    }
    const img = images.find(i => i.url === selectedImage);
    const cached = getCachedInference(img?.id, selectedModel?.id);
    if (cached) {
      setInferenceResult(cached.result);
      setAiResponse(cached.report);
    } else {
      setInferenceResult(null);
      setAiResponse(null);
    }
  }, [selectedImage, selectedModel?.id, images, getCachedInference]);

  // Fetch all uploaded images for a series + their backend stream URLs.
  const fetchImages = useCallback(async (seriesId) => {
    const records = await getImagesForStudy(seriesId);
    const uploaded = (records ?? []).filter(r => r.status === "uploaded");
    const withUrls = await Promise.all(
      uploaded.map(async (record) => {
        try {
          const { download_url, image_type } = await getDicomDownloadUrl(record.id);
          const fname = record.filename ?? "";
          const isStandardImage = /\.(jpe?g|png|gif|bmp|webp|tiff?)$/i.test(fname);
          const isDicom = isStandardImage
            ? false
            : (image_type ?? record.image_type ?? "dicom") === "dicom";
          const fallbackName = isDicom ? `${record.id}.dcm` : `${record.id}.img`;
          return {
            id: record.id,
            url: download_url,
            name: fname || fallbackName,
            type: isDicom ? "application/dicom" : "image",
            file: null,
          };
        } catch {
          return null;
        }
      })
    );
    return withUrls.filter(Boolean);
  }, []);

  useEffect(() => {
    const seriesId = activeSeries?.id;
    if (!seriesId) return;

    let cancelled = false;
    setImagesLoading(true);
    setImages([]);

    fetchImages(seriesId)
      .then(imgs => { if (!cancelled) setImages(imgs); })
      .catch(err => console.error("Failed to load images:", err))
      .finally(() => { if (!cancelled) setImagesLoading(false); });

    return () => { cancelled = true; };
  }, [activeSeries?.id, fetchImages]);

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
    if (result.predicted_class !== undefined) {
      lines.push(`Predicted class: ${result.predicted_class}`);
      lines.push(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      if (result.scores?.length) {
        lines.push(`Scores: ${result.scores.map(s => s.toFixed(3)).join(", ")}`);
      }
    }
    if (result.has_tumor !== undefined) {
      lines.push(`Tumor detected: ${result.has_tumor ? "Yes" : "No"}`);
      lines.push(`Coverage: ${(result.tumor_coverage_pct * 100).toFixed(1)}%`);
      lines.push(`Mean confidence: ${(result.mean_confidence * 100).toFixed(1)}%`);
    }
    return lines.join("\n") || "Analysis complete — no summary available.";
  };

  const runAnalysis = async () => {
    if (aiLoading) return;

    if (!selectedModel) {
      setAiResponse("Please select an AI model from the panel first.");
      return;
    }

    if (!selectedImage) {
      setAiResponse("Please select an image first.");
      return;
    }

    const img = images.find(i => i.url === selectedImage);
    if (!img) {
      setAiResponse("Could not find the selected image.");
      return;
    }

    // Check cache first — skip the network round-trip if we already have results
    const cached = getCachedInference(img.id, selectedModel.id);
    if (cached) {
      setInferenceResult(cached.result);
      setAiResponse(cached.report);
      return;
    }

    setAiLoading(true);
    setAiResponse("");
    setInferenceResult(null);

    // Use the model's URL if available, otherwise fall back to its id
    const modelUrl = selectedModel.url || selectedModel.endpoint_url || selectedModel.inference_url || selectedModel.endpoint;

    try {
      // Fetch the image as a blob and send it to the model's URL
      const token = localStorage.getItem("token");
      const imgRes = await fetch(img.url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!imgRes.ok) throw new Error("Failed to fetch image for analysis");
      const blob = await imgRes.blob();

      const form = new FormData();
      form.append("image", blob, img.name ?? "image");

      const res = await fetch(modelUrl, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        let message = `${res.status} ${res.statusText}`;
        try { const d = await res.json(); message = d.detail || d.message || message; } catch {}
        throw new Error(message);
      }

      const result = await res.json();

      // Set the inference result for the comparison slider (heatmap or mask)
      if (result.heatmap || result.mask) {
        setInferenceResult(result);
      }

      // Build the report-generation payload from the inference response.
      const modelType = String(selectedModel.type || selectedModel.model_type || "").toLowerCase();
      const isSegmentation = modelType.includes("segmentation") || result.has_tumor !== undefined;

      const payload = isSegmentation
        ? {
            has_tumor: result.has_tumor,
            tumor_coverage_pct: result.tumor_coverage_pct,
            mean_confidence: result.mean_confidence,
            patient_context: buildPatientContext(),
          }
        : {
            predicted_class: result.predicted_class,
            confidence: result.confidence,
            scores: result.scores,
            patient_context: buildPatientContext(),
          };

      // Stream the generated report token-by-token from /report/stream
      let finalReport = "";
      try {
        const reportUrl = new URL("/report/stream", modelUrl).href;
        const reportRes = await fetch(reportUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!reportRes.ok || !reportRes.body) {
          throw new Error(`Report stream failed: ${reportRes.status}`);
        }

        const reader = reportRes.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          finalReport += decoder.decode(value, { stream: true });
          setAiResponse(finalReport);
        }
        finalReport += decoder.decode();
        finalReport = finalReport || buildSummary(result);
      } catch (streamErr) {
        console.error("Report stream failed, using local summary:", streamErr);
        finalReport = buildSummary(result);
      }

      setAiResponse(finalReport);

      // Cache the inference result + report so switching back to this image is instant
      setCachedInference(img.id, selectedModel.id, result, finalReport);
    } catch (e) {
      setAiResponse(`Error: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="m-0 p-0 h-screen bg-black w-screen">
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
              />
              <Midsection
                selectedImage={selectedImage}
                onSelectImage={setSelectedImage}
                images={images}
                activeStudy={activeStudy}
                activeSeries={activeSeries}
                onRunAnalysis={runAnalysis}
                aiLoading={aiLoading}
                inferenceResult={inferenceResult}
                onInferenceResult={setInferenceResult}
              />
              <div className="w-[20%] min-w-[260px] flex flex-col gap-4 overflow-hidden">
                <RightSection aiResponse={aiResponse} aiLoading={aiLoading} onModelSelect={setSelectedModel} />
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
