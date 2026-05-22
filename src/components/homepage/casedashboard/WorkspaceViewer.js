import React, { useRef, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Appbar from "../appbar/appbar";
import Sidepanel from "./sidepanel";
import Midsection from "./midsection";
import RightSection from "./rightsection";
import { mockStudies } from "./CaseDashboard";
import { getImagesForStudy, getDicomDownloadUrl } from "../../../lib/api";

function WorkspaceViewer() {
  const { state: navState } = useLocation();
  const navigate = useNavigate();

  // Use navState directly — avoids mock-ID mismatch when series IDs are real UUIDs
  const activeStudy = navState?.study ?? mockStudies[0];
  const activeSeries = navState?.series ?? activeStudy.series?.[0];

  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

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
              />
              <div className="w-[20%] min-w-[260px] flex flex-col gap-4 overflow-hidden">
                <RightSection />
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
