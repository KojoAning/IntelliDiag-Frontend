import React, { useRef, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Appbar from "../appbar/appbar";
import Sidepanel from "./sidepanel";
import Midsection from "./midsection";
import RightSection from "./rightsection";
import { getImagesForStudy, getDicomDownloadUrl } from "../../../lib/api";

function WorkspaceViewer() {
  const { state: navState } = useLocation();
  const navigate = useNavigate();

  // Use navState directly — avoids mock-ID mismatch when series IDs are real UUIDs
  const activeStudy = navState?.study ?? {};
  const activeSeries = navState?.series ?? activeStudy.series?.[0];

  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [aiResponse, setAiResponse]   = useState(null);
  const [aiLoading, setAiLoading]     = useState(false);

  const fileInputRef = useRef(null);

  // Fetch presigned download URLs for all uploaded images in this series
  useEffect(() => {
    const seriesId = activeSeries?.id;
    if (!seriesId) return;

    let cancelled = false;
    setImagesLoading(true);
    setImages([]);

    getImagesForStudy(seriesId)
      .then(async (records) => {
        if (cancelled) return;

        const uploaded = (records ?? []).filter(r => r.status === "uploaded");

        const withUrls = await Promise.all(
          uploaded.map(async (record) => {
            try {
              const { download_url } = await getDicomDownloadUrl(record.id);
              return {
                id: record.id,
                url: download_url,
                name: record.filename ?? record.id,
                file: null,
              };
            } catch {
              return null;
            }
          })
        );

        if (cancelled) return;
        setImages(withUrls.filter(Boolean));
      })
      .catch(err => console.error("Failed to load images:", err))
      .finally(() => { if (!cancelled) setImagesLoading(false); });

    return () => { cancelled = true; };
  }, [activeSeries?.id]);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const newImages = files.map(file => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      name: file.name,
      file,
    }));
    setImages(prev => [...prev, ...newImages]);
    e.target.value = null;
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const runAnalysis = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiResponse("");
    const prompt =
      `You are a radiology AI assistant. Provide a concise structured clinical impression for the following imaging series.\n` +
      `Series name: ${activeSeries?.name ?? "Unknown"}\n` +
      `Modality: ${activeStudy?.modality ?? "Unknown"}\n` +
      `Description: ${activeSeries?.description ?? "N/A"}\n\n` +
      `Provide key imaging findings and any clinical recommendations in plain paragraphs. No asterisks, just plain paragraphs.`;
    try {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ model: "gpt-4o-mini", input: prompt, store: true, stream: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `${res.status} ${res.statusText}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === "response.output_text.delta") {
              setAiResponse(prev => prev + evt.delta);
            }
          } catch {}
        }
      }
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
              {imagesLoading && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-xl">
                  <div className="w-8 h-8 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
                  <p className="text-[#6B6B6B] text-sm m-0">Loading images…</p>
                </div>
              )}
              <Sidepanel
                images={images}
                onUploadClick={handleUploadClick}
                onSelectImage={setSelectedImage}
                selectedImage={selectedImage}
                loading={imagesLoading}
              />
              <Midsection
                selectedImage={selectedImage}
                onSelectImage={setSelectedImage}
                images={images}
                activeStudy={activeStudy}
                activeSeries={activeSeries}
                onRunAnalysis={runAnalysis}
                aiLoading={aiLoading}
              />
              <div className="w-[20%] min-w-[260px] flex flex-col gap-4 overflow-hidden">
                <RightSection aiResponse={aiResponse} aiLoading={aiLoading} />
              </div>
            </div>

          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
    </div>
  );
}

export default WorkspaceViewer;
