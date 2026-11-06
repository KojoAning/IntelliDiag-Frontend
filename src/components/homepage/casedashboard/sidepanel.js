import React, { useState, useEffect, useSyncExternalStore } from "react";
import { FiUploadCloud, FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { authFetch, getImagesForStudy } from "../../../lib/api";
import { thumbCache, PROJECTION_MODALITIES, getSeriesStatus, subscribeSeriesCache, storedSeriesThumbnail } from "../../../lib/seriesCache";
import { SERIES_DRAG_TYPE } from "../../../lib/viewerLayout";

async function fetchAuthenticatedThumb(url) {
  try {
    const resp = await authFetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// Mirrors classify_sequence() in the inference service, so the badge shows exactly
// which of the four BraTS inputs (t1c, t1n, t2w, flair) a series will be treated as.
function classifySequence(text) {
  const desc = (text || "").toLowerCase();
  if (desc.includes("flair") || desc.includes("t2f")) return "FLAIR";
  if (desc.includes("t1c") || (desc.includes("t1") && ["gad", "contrast", "+c", "post"].some(k => desc.includes(k)))) return "T1c";
  if (desc.includes("t1")) return "T1";
  if (desc.includes("t2")) return "T2";
  return null;
}

function ThumbImage({ src, loading, alt }) {
  if (loading) {
    return (
      <div className="w-full h-full bg-[#111] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (src) {
    return <img src={src} alt={alt} className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} />;
  }
  return (
    <div className="w-full h-full bg-[#111] flex items-center justify-center">
      <span className="text-[#2a2a2a] text-[9px] font-mono">DCM</span>
    </div>
  );
}

function SliceThumb({ img, index, selected, onSelect, hasTumor }) {
  const [thumbSrc, setThumbSrc] = useState(() => thumbCache.get(img.id) ?? null);
  const [thumbLoading, setThumbLoading] = useState(!thumbSrc);

  useEffect(() => {
    // Already cached — skip fetch
    if (thumbCache.has(img.id)) {
      setThumbSrc(thumbCache.get(img.id));
      setThumbLoading(false);
      return;
    }

    let cancelled = false;
    setThumbLoading(true);

    (async () => {
      // Use the pre-rendered JPEG thumbnail from the backend — fast, no DICOM
      // parsing in the browser. Falls back to the stream URL for non-DICOM images.
      const src = await fetchAuthenticatedThumb(img.thumbnailUrl ?? img.url);
      if (!cancelled && src) {
        thumbCache.set(img.id, src);
        setThumbSrc(src);
      }
      if (!cancelled) setThumbLoading(false);
    })();

    return () => { cancelled = true; };
  }, [img.id, img.thumbnailUrl]);

  return (
    <div
      onClick={() => onSelect(img.blobUrl ?? img.url)}
      className={`relative rounded-lg overflow-hidden border bg-black cursor-pointer transition-all duration-150 shrink-0 aspect-square ${
        selected
          ? "border-[#0694FB] ring-1 ring-[#0694FB]"
          : "border-[#1E1E1E] hover:border-[#0694FB]/50"
      }`}
    >
      <ThumbImage src={thumbSrc} loading={thumbLoading} alt={img.name} />
      {hasTumor && (
        <div className="absolute top-1 left-1 z-10 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shadow-md">
          <span className="text-white text-[8px] font-bold leading-none">!</span>
        </div>
      )}
      <span className="absolute bottom-1 right-1.5 text-[9px] text-white/50 font-mono leading-none">
        {String(index + 1).padStart(3, "0")}
      </span>
    </div>
  );
}

// Click opens the series in the active viewer; drag it onto any viewer of a multi-viewer layout.
// shown: it's in one of the layout's other viewers
function SeriesCard({ series, active, shown, images, onSelect }) {
  const cacheKey = `series:${series.id}`;
  const [thumbSrc, setThumbSrc] = useState(() => thumbCache.get(cacheKey) ?? null);
  const [thumbLoading, setThumbLoading] = useState(!thumbSrc);

  // The open series already has its slice thumbnails loaded, so its middle slice is
  // free. Any other series needs one image-list call to find a slice to render.
  const middleImage = active && images.length ? images[Math.floor(images.length / 2)] : null;

  useEffect(() => {
    if (thumbCache.has(cacheKey)) {
      setThumbSrc(thumbCache.get(cacheKey));
      setThumbLoading(false);
      return;
    }
    if (middleImage && thumbCache.has(middleImage.id)) {
      const src = thumbCache.get(middleImage.id);
      thumbCache.set(cacheKey, src);
      setThumbSrc(src);
      setThumbLoading(false);
      return;
    }

    let cancelled = false;
    setThumbLoading(true);

    (async () => {
      // Kept on this device with the series' download? Then no server calls
      let src = await storedSeriesThumbnail(series.id);
      if (cancelled) return;
      if (src) {
        setThumbSrc(src);
        setThumbLoading(false);
        return;
      }
      try {
        const records = (await getImagesForStudy(series.id) ?? []).filter(r => r.status === "uploaded");
        const record = records[Math.floor(records.length / 2)];
        if (record) src = await fetchAuthenticatedThumb(`${process.env.REACT_APP_API_BASE}/dicom/${record.id}/rendered?quality=jpeg`);
      } catch {
        // leave the placeholder in place
      }
      if (!cancelled && src) {
        thumbCache.set(cacheKey, src);
        setThumbSrc(src);
      }
      if (!cancelled) setThumbLoading(false);
    })();

    return () => { cancelled = true; };
  }, [cacheKey, series.id, middleImage]);

  // Download state from the shared series cache: "idle" | "loading" | "ready" | "error" | "skipped"
  const status = useSyncExternalStore(subscribeSeriesCache, () => getSeriesStatus(series.id));
  const imageCount = active && images.length ? images.length : series.image_count;
  const sequence = (series.modality || "").toUpperCase() === "MR"
    ? classifySequence(`${series.name ?? ""} ${series.description ?? ""}`)
    : null;

  return (
    <div
      onClick={() => !active && onSelect(series)}
      draggable
      onDragStart={e => {
        const { id, name, description, modality, image_count } = series;
        e.dataTransfer.setData(SERIES_DRAG_TYPE, JSON.stringify({ id, name, description, modality, image_count }));
        e.dataTransfer.effectAllowed = "copy";
      }}
      className={`flex flex-col gap-1.5 p-1.5 rounded-xl border shrink-0 transition-all duration-150 ${
        active
          ? "border-[#0694FB] bg-[rgba(6,148,251,0.08)]"
          : "border-[#1E1E1E] hover:border-[#0694FB]/50 cursor-pointer"
      }`}
    >
      <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-black">
        <ThumbImage src={thumbSrc} loading={thumbLoading} alt={series.name} />
        {sequence && (
          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/70 text-[#0694FB] text-[9px] font-semibold leading-none">
            {sequence}
          </span>
        )}
        {status === "loading" && !thumbLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-0.5 min-w-0">
        <p className="text-white text-[11px] font-medium m-0 truncate" title={series.name}>{series.name || "Untitled series"}</p>
        {series.description && (
          <p className="text-[#6B6B6B] text-[10px] m-0 truncate" title={series.description}>{series.description}</p>
        )}
        <p className="text-[#868686] text-[10px] m-0">
          {imageCount ?? 0} image{imageCount === 1 ? "" : "s"}{series.modality ? ` · ${series.modality}` : ""}
        </p>
        {shown && <p className="text-[#0694FB] text-[10px] m-0">In a viewer</p>}
        {status === "loading" && <p className="text-[#0694FB] text-[10px] m-0">Downloading…</p>}
        {status === "ready" && (
          <p className="flex items-center gap-1 text-[#22C55E] text-[10px] m-0"><FiCheckCircle size={10} /> Available offline</p>
        )}
        {status === "skipped" && <p className="text-[#868686] text-[10px] m-0">Loads when opened</p>}
        {status === "error" && (
          <p className="flex items-center gap-1 text-[#FF6B35] text-[10px] m-0"><FiAlertCircle size={10} /> Download failed</p>
        )}
      </div>
    </div>
  );
}

function Sidepanel({ images = [], onUploadClick, onSelectImage, selectedImage, loading, inferenceResult, seriesList = [], activeSeries, onSelectSeries, shownSeriesIds = [] }) {
  // The open series may be missing from the fetched list (e.g. opened from the Jobs page
  // before the study's series have loaded) — always show it.
  const allSeries = activeSeries && !seriesList.some(s => String(s.id) === String(activeSeries.id))
    ? [activeSeries, ...seriesList]
    : seriesList;
  const showImageThumbs = PROJECTION_MODALITIES.has((activeSeries?.modality || "").toUpperCase());

  return (
    <div className="w-[160px] min-w-[160px] h-full flex flex-col gap-2 overflow-hidden">

      <div className="inline-flex self-start bg-[rgba(6,148,251,0.17)] rounded-[10px] px-3 py-1.5">
        <p className="text-[#0694FB] text-[12px] font-medium m-0">
          {`${allSeries.length} Series`}
        </p>
      </div>
      <div className="w-full h-px bg-[#1E1E1E] shrink-0" />

      <div
        className="flex flex-col gap-1.5 overflow-y-auto flex-1"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#1a1a1a transparent" }}
      >
        {allSeries.length === 0 && (
          <div className="flex items-center justify-center py-4">
            <p className="text-[#2a2a2a] text-[10px] text-center m-0">No series yet</p>
          </div>
        )}

        {allSeries.map(series => {
          const active = String(series.id) === String(activeSeries?.id);
          return (
            <React.Fragment key={series.id}>
              <SeriesCard series={series} active={active} shown={!active && shownSeriesIds.includes(String(series.id))} images={loading ? [] : images} onSelect={onSelectSeries} />

              {/* Per-image thumbnails only for projection studies, nested under the open series */}
              {active && showImageThumbs && (
                <div className="flex flex-col gap-1.5 pl-2">
                  {loading && Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="w-full aspect-square rounded-lg bg-[#111] shrink-0 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ))}
                  {!loading && images.map((img, i) => (
                    <SliceThumb
                      key={img.id}
                      img={img}
                      index={i}
                      selected={selectedImage === (img.blobUrl ?? img.url)}
                      onSelect={onSelectImage}
                      hasTumor={inferenceResult?.slices?.[i]?.has_tumor ?? false}
                    />
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}

        <button
          onClick={() => onUploadClick()}
          className="shrink-0 w-full py-2 rounded-xl border border-dashed border-[#1E1E1E] hover:border-[#0694FB]/60 hover:bg-[rgba(6,148,251,0.04)] bg-transparent flex items-center justify-center gap-1.5 cursor-pointer transition-all group"
        >
          <FiUploadCloud size={13} className="text-[#3a3a3a] group-hover:text-[#0694FB] transition-colors" />
          <span className="text-[#3a3a3a] group-hover:text-[#0694FB] text-[11px] transition-colors">Add images</span>
        </button>
      </div>

    </div>
  );
}

export default Sidepanel;
