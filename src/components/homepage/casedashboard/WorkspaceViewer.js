import React, { useRef, useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Appbar from "../appbar/appbar";
import Sidepanel from "./sidepanel";
import Midsection from "./midsection";
import RightSection from "./rightsection";
import { getImagesForStudy, uploadDicom } from "../../../lib/api";
import { renderDicomThumbnail, parseMultipartBody, parseDicomInstanceInfo, getDicomMetadata } from "../../../lib/dicomUtils";
import { thumbCache } from "./sidepanel";

const API_BASE = (process.env.REACT_APP_API_URL || "").trim().replace(/\/$/, "");

function WorkspaceViewer() {
  const { state: navState } = useLocation();
  const navigate = useNavigate();

  // Use navState directly — avoids mock-ID mismatch when series IDs are real UUIDs
  const activeStudy = navState?.study ?? {};
  const activeSeries = navState?.series ?? activeStudy.series?.[0];

  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [aiResponse, setAiResponse] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [inferenceResult, setInferenceResult] = useState(null);
  const [inferenceProgress, setInferenceProgress] = useState(null); // 0-100 while streaming, null otherwise
  const [selectedModel, setSelectedModel] = useState(null);
  const [dicomMetadata, setDicomMetadata] = useState(null);

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

  // Keep a ref so the effect below can read inferenceResult without depending on it.
  const inferenceResultRef = useRef(inferenceResult);
  inferenceResultRef.current = inferenceResult;

  // When the selected image changes, restore cached inference or clear state.
  // Exception: bulk segmentation results (masks array) cover the whole series —
  // switching thumbnails just changes the visible slice, so don't clear them.
  useEffect(() => {
    if (!selectedImage) {
      setInferenceResult(null);
      setAiResponse(null);
      return;
    }
    const img = images.find(i => (i.blobUrl ?? i.url) === selectedImage);
    const cached = getCachedInference(img?.id, selectedModel?.id);
    if (cached) {
      setInferenceResult(cached.result);
      setAiResponse(cached.report);
    } else if (!inferenceResultRef.current?.slices) {
      // Only clear for single-image results; bulk results stay until explicitly dismissed
      setInferenceResult(null);
      setAiResponse(null);
    }
  }, [selectedImage, selectedModel?.id, images, getCachedInference]);

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
      setAiResponse("Please select an AI model from the panel first.");
      return;
    }

    if (!selectedImage) {
      setAiResponse("Please select an image first.");
      return;
    }

    const img = images.find(i => (i.blobUrl ?? i.url) === selectedImage);
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
    setInferenceProgress(0);

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
            setInferenceProgress(Math.round(event.processed / event.total * 100));
          } else if (event.status === "done") {
            const results = await fetch(`${API_BASE}/results/${event.job_id}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            }).then(r => r.json());
            setInferenceResult(results);
            const summary = buildSummary(results);
            setAiResponse(summary);
            setCachedInference(img.id, selectedModel.id, results, summary);
          } else if (event.status === "error") {
            console.error("Inference error:", event.message);
            setAiResponse(`Error: ${event.message}`);
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
      setAiResponse(`Error: ${e.message}`);
    } finally {
      setAiLoading(false);
      setInferenceProgress(null);
    }
  };

  const getDicomMetaData = async () => {

  }

  // Fetches a short-lived series-scoped token from the main backend.
  // Used by both prefetchBulk (for DICOM retrieval) and runAnalysis (for inference).
  const getSeriesToken = async (seriesId) => {
    const id = seriesId ?? activeSeries?.id;
    const res = await fetch(`${process.env.REACT_APP_API_BASE}/series/${id}/inference-token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
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
    setAiLoading(true);
    setAiResponse("");
    setInferenceResult(null);
    setInferenceProgress(0);

    try {
      const seriesToken = await getSeriesToken();

      const response = await fetch(`${process.env.REACT_APP_API_INFERENCE_BASE}/segment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          series_id: activeSeries?.id,
          token: seriesToken,
        }),
      });

      console.log(response);

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Inference failed: ${response.status} — ${errText.slice(0, 200)}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleSseLine = async (line) => {
        console.log(line)
        if (!line.startsWith("data: ")) return;

        try {
          const event = JSON.parse(line.slice(6));
          if (event.status === "processing") {
            setInferenceProgress(Math.round(event.processed / event.total * 100));
          } else if (event.status === "done") {
            const results = await fetch(`${process.env.REACT_APP_API_INFERENCE_BASE}/results/${event.job_id}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            }).then(r => r.json());
            setInferenceResult(results);


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
            console.log(reportRes)
            if (reportRes.ok && reportRes.body) {
              const reportReader = reportRes.body.getReader();
              const reportDecoder = new TextDecoder();
              let reportText = "";
              while (true) {
                const { done, value } = await reportReader.read();
                if (done) break;
                reportText += reportDecoder.decode(value, { stream: true });
                setAiResponse(reportText);
              }
              reportText += reportDecoder.decode();
              setAiResponse(reportText || buildSummary(results));
            } else {
              setAiResponse(buildSummary(results));
            }
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
      setAiResponse(`Error: ${e.message}`);
    } finally {
      setAiLoading(false);
      setInferenceProgress(null);
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
