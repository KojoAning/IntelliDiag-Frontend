import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiUploadCloud, FiLoader } from "react-icons/fi";
import { createSeries, requestDicomUpload, uploadToS3, confirmDicomUpload } from "../../../lib/api";
import { parseDicomFile, renderDicomThumbnail, isDicomImage } from "../../../lib/dicomUtils";

const inputCls = "w-full bg-[#111111] border border-[#1E1E1E] rounded-xl px-4 py-2.5 text-white text-sm outline-none placeholder-[#3a3a3a] focus:border-[#0694FB] transition-colors";
const labelCls = "text-[#6B6B6B] text-xs mb-1.5 block";

// Renders a thumbnail for any image — uses canvas for DICOM, <img> for others
function ImageThumb({ img }) {
  const [src, setSrc] = useState(isDicomImage(img) ? null : img.url);

  useEffect(() => {
    if (!isDicomImage(img)) return;
    let cancelled = false;
    renderDicomThumbnail(img.file).then(dataUrl => {
      if (!cancelled) setSrc(dataUrl);
    });
    return () => { cancelled = true; };
  }, [img]);

  if (!src) return (
    <div className="w-full h-full bg-[#111] flex items-center justify-center">
      <span className="text-[#3a3a3a] text-[8px] font-mono">DCM</span>
    </div>
  );
  return <img src={src} alt={img.name} className="w-full h-full object-cover" />;
}


function SeriesCard({ s, index, total, onUpdate, onRemove }) {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const addImages = (files) => {
    const newImgs = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      name: file.name,
      file,
    }));
    onUpdate(s.id, "images", [...(s.images || []), ...newImgs]);
  };

  const removeImage = (imgId) => {
    onUpdate(s.id, "images", s.images.filter(img => img.id !== imgId));
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addImages(e.dataTransfer.files);
  };

  return (
    <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-4 flex flex-col gap-3">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <span className="text-[#3a3a3a] text-[10px] font-mono uppercase tracking-wide">
          Series {String(index + 1).padStart(2, "0")}
        </span>
        {total > 1 && (
          <button
            onClick={() => onRemove(s.id)}
            className="text-[#3a3a3a] hover:text-[#FF4A4A] bg-transparent border-none cursor-pointer transition-colors p-0"
          >
            <FiX size={13} />
          </button>
        )}
      </div>

      {/* Name + Series number */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Series Name</label>
          <input
            type="text"
            placeholder="e.g. Axial T2"
            value={s.name}
            onChange={e => onUpdate(s.id, "name", e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Series Number</label>
          <input
            type="number"
            placeholder="e.g. 1"
            min={0}
            value={s.seriesNumber}
            onChange={e => onUpdate(s.id, "seriesNumber", e.target.value === "" ? "" : parseInt(e.target.value, 10))}
            className={inputCls}
          />
        </div>
      </div>

      {/* Modality + Description */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Modality</label>
          <input
            type="text"
            value={s.modality || "—"}
            readOnly
            className={`${inputCls} cursor-not-allowed opacity-40 select-none`}
          />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input
            type="text"
            placeholder="e.g. TR 4500 TE 90"
            value={s.description}
            onChange={e => onUpdate(s.id, "description", e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* Image upload */}
      <div>
        <label className={labelCls}>Images <span className="text-[#2a2a2a]">— optional</span></label>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full rounded-xl border border-dashed flex flex-col items-center justify-center gap-1.5 py-4 cursor-pointer transition-all duration-200 ${
            dragging
              ? "border-[#0694FB] bg-[rgba(6,148,251,0.06)]"
              : "border-[#2a2a2a] bg-[#0d0d0d] hover:border-[#0694FB]/50 hover:bg-[rgba(6,148,251,0.03)]"
          }`}
        >
          <FiUploadCloud size={18} color={dragging ? "#0694FB" : "#3a3a3a"} />
          <p className={`text-[11px] m-0 transition-colors ${dragging ? "text-[#0694FB]" : "text-[#4a4a4a]"}`}>
            Drop images here or <span className="text-[#0694FB]">browse</span>
          </p>
          {s.images?.length > 0 && (
            <p className="text-[#3a3a3a] text-[10px] m-0">{s.images.length} file{s.images.length !== 1 ? "s" : ""} selected</p>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.dcm"
          multiple
          className="hidden"
          onChange={e => { addImages(e.target.files); e.target.value = null; }}
        />

        {s.images?.length > 0 && (
          <div className="grid grid-cols-5 gap-1.5 mt-2">
            {s.images.map(img => (
              <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border border-[#1E1E1E]">
                <ImageThumb img={img} />
                <button
                  onClick={e => { e.stopPropagation(); removeImage(img.id); }}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center border-none cursor-pointer"
                >
                  <FiX size={12} color="white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AddSeriesModal({ isOpen, onClose, onAdd, studyId, studyModality = "" }) {
  const blank = () => ({ id: crypto.randomUUID(), name: "", seriesNumber: "", modality: studyModality, description: "", images: [] });
  const [series, setSeries] = useState([blank()]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [uploadItems, setUploadItems] = useState([]); // [{ key, name, pct, status }]

  const setItemState = (key, updates) =>
    setUploadItems(prev => prev.map(it => it.key === key ? { ...it, ...updates } : it));

  useEffect(() => {
    if (isOpen) { setSeries([blank()]); setError(null); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, studyModality]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const addRow = () => setSeries(prev => [...prev, blank()]); // blank() closes over current studyModality

  const update = (id, field, value) => {
    setSeries(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const remove = (id) => setSeries(prev => prev.filter(s => s.id !== id));

  const canSubmit = !loading && series.some(s => s.name.trim());

  const handleSubmit = async () => {
    const valid = series.filter(s => s.name.trim());
    setLoading(true);
    setError(null);

    // Initialise progress list for all images across all series
    const allImages = valid.flatMap((s, si) =>
      (s.images || []).map((img, ii) => ({ key: `${si}-${ii}`, name: img.name, pct: 0, status: "pending" }))
    );
    setUploadItems(allImages);

    try {
      // Step 1 — create all series records
      const created = await Promise.all(
        valid.map(s =>
          createSeries({
            series_name:   s.name.trim(),
            series_number: s.seriesNumber !== "" ? Number(s.seriesNumber) : 0,
            modality:      s.modality || "",
            description:   s.description.trim(),
            study_id:      studyId,
          })
        )
      );

      // Step 2 — upload images for each series
      await Promise.all(
        valid.map(async (s, si) => {
          const seriesId = created[si]?.id;
          if (!seriesId || !s.images?.length) return;

          await Promise.all(
            s.images.map(async (img, ii) => {
              const key = `${si}-${ii}`;
              setItemState(key, { status: "uploading" });

              const { image_id: imageId, upload_url } = await requestDicomUpload({
                series_id:       seriesId,
                filename:        img.name,
                instance_number: ii,
              });

              const dicomMeta = await parseDicomFile(img.file);

              try {
                await uploadToS3(upload_url, img.file, (pct) =>
                  setItemState(key, { pct })
                );
                setItemState(key, { pct: 100, status: "done" });

                const metaFields = Object.fromEntries(
                  Object.entries(dicomMeta).filter(([, v]) => v != null)
                );
                await confirmDicomUpload(imageId, {
                  status:          "uploaded",
                  instance_number: ii,
                  ...metaFields,
                });
              } catch (uploadErr) {
                setItemState(key, { status: "error" });
                await confirmDicomUpload(imageId, { status: "failed" }).catch(() => {});
                throw uploadErr;
              }
            })
          );
        })
      );

      const localSeries = valid.map((s, i) => ({
        id:          created[i]?.id ?? crypto.randomUUID(),
        name:        s.name.trim(),
        description: s.description.trim(),
        modality:    s.modality,
        images:      s.images || [],
        expanded:    false,
      }));

      onAdd(localSeries);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create series. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-[560px] max-h-[90vh] bg-[#161616] border border-[#1E1E1E] rounded-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-7 pt-7 pb-5 shrink-0">
              <div>
                <h2 className="text-white text-lg font-medium m-0">Add Image Series</h2>
                <p className="text-[#6B6B6B] text-xs m-0 mt-0.5">Define sequences and optionally upload images</p>
              </div>
              <button onClick={onClose} className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1 mt-0.5">
                <FiX size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 px-7 pb-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}>
              <div className="flex flex-col gap-3">
                {series.map((s, i) => (
                  <SeriesCard
                    key={s.id}
                    s={s}
                    index={i}
                    total={series.length}
                    onUpdate={update}
                    onRemove={remove}
                  />
                ))}
              </div>

              <button
                onClick={addRow}
                className="w-full mt-3 py-2.5 rounded-xl border border-dashed border-[#2a2a2a] text-[#6B6B6B] text-sm hover:border-[#0694FB] hover:text-[#0694FB] bg-transparent cursor-pointer transition-all"
              >
                + Add Another Series
              </button>
            </div>

            {/* Upload progress */}
            {loading && uploadItems.length > 0 && (
              <div className="mx-7 mb-3 flex flex-col gap-2 max-h-[180px] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}>
                <p className="text-[#6B6B6B] text-[11px] m-0">Uploading images…</p>
                {uploadItems.map(item => (
                  <div key={item.key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white/50 text-[11px] font-mono truncate">{item.name}</span>
                      <span className={`text-[10px] font-mono shrink-0 ${
                        item.status === "done"     ? "text-[#22C55E]" :
                        item.status === "error"    ? "text-[#FF4A4A]" :
                        item.status === "uploading"? "text-[#0694FB]" :
                                                     "text-[#3a3a3a]"
                      }`}>
                        {item.status === "done"  ? "✓ done" :
                         item.status === "error" ? "✗ failed" :
                         item.status === "uploading" ? `${item.pct}%` :
                         "pending"}
                      </span>
                    </div>
                    <div className="w-full h-[2px] bg-[#1a1a1a] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${
                          item.status === "done"  ? "bg-[#22C55E]" :
                          item.status === "error" ? "bg-[#FF4A4A]" :
                                                    "bg-[#0694FB]"
                        }`}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mx-7 mb-3 px-4 py-2.5 rounded-xl bg-[rgba(255,74,74,0.08)] border border-[rgba(255,74,74,0.2)]">
                <p className="text-[#FF4A4A] text-xs m-0">{error}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-7 py-5 border-t border-[#1E1E1E] shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[#1E1E1E] text-[#6B6B6B] text-sm bg-transparent hover:border-[#2a2a2a] hover:text-white cursor-pointer transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`px-5 py-2 rounded-md text-sm font-medium border-none transition-all duration-200 flex items-center gap-2 ${
                  canSubmit ? "bg-[#0694FB] text-white cursor-pointer hover:bg-[#0578d1]" : "bg-[#1a1a1a] text-[#3a3a3a] cursor-not-allowed"
                }`}
              >
                {loading && <FiLoader size={13} className="animate-spin" />}
                {loading ? "Creating…" : "Add Series"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AddSeriesModal;
