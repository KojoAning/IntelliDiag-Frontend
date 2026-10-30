import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { TbStarFilled } from "react-icons/tb";
import { renderDicomThumbnail } from "../../../lib/dicomUtils";

// The series' key images on their own: a thumbnail per marked slice to jump to or unmark,
// and their exports (pictures, or the DICOM files).
const thumbs = new Map(); // imageId -> data URL (null: couldn't be drawn)

function KeyThumb({ imageId, src }) {
  const [url, setUrl] = useState(() => thumbs.get(imageId));
  useEffect(() => {
    if (!src || thumbs.has(imageId)) return;
    let cancelled = false;
    fetch(src)
      .then(r => r.blob())
      .then(blob => renderDicomThumbnail(blob, 96))
      .catch(() => null)
      .then(result => {
        thumbs.set(imageId, result);
        if (!cancelled) setUrl(result);
      });
    return () => { cancelled = true; };
  }, [imageId, src]);
  return url
    ? <img src={url} alt="" className="w-12 h-12 rounded object-cover bg-black shrink-0" draggable={false} />
    : <span className="w-12 h-12 rounded bg-black shrink-0 flex items-center justify-center"><TbStarFilled size={14} className="text-[#FACC15]" /></span>;
}

export default function KeyImagesPanel({ keyed, currentIndex, total, onGoTo, onUnmark, onClose, onSavePictures, onDownloadDicom }) {
  const button = "px-2.5 py-1.5 rounded-lg text-[12px] bg-[#1E1E1E] text-[#CCCCCC] hover:bg-[#2a2a2a] hover:text-white border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";
  return (
    <div className="shrink-0 w-[250px] bg-[#161616] rounded-xl flex flex-col overflow-hidden select-none">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1E1E1E] shrink-0">
        <span className="text-white text-[13px] font-semibold">{`Key images${keyed.length ? ` (${keyed.length})` : ""}`}</span>
        <button onClick={onClose} className="text-[#6B6B6B] hover:text-white bg-transparent border-none cursor-pointer p-0" title="Close">
          <FiX size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#1B1B1B #000" }}>
        {keyed.length === 0 && (
          <p className="text-[#6B6B6B] text-[12px] leading-relaxed m-0 px-3 py-4">
            No key images yet. Press K (or the star) on a slice to mark it; Shift+K goes to the next one.
          </p>
        )}
        {keyed.map(({ index, imageId, src }) => (
          <div
            key={imageId}
            onClick={() => onGoTo(index)}
            className={`flex items-center gap-2.5 px-3 py-2 border-b border-[#1E1E1E] cursor-pointer ${index === currentIndex ? "bg-[#0694FB]/10" : "hover:bg-[#1a1a1a]"}`}
          >
            <KeyThumb imageId={imageId} src={src} />
            <span className={`flex-1 text-[12px] ${index === currentIndex ? "text-white" : "text-[#CCCCCC]"}`}>{`Slice ${index + 1} / ${total}`}</span>
            <button
              onClick={e => { e.stopPropagation(); onUnmark(index); }}
              className="text-[#6B6B6B] hover:text-white bg-transparent border-none cursor-pointer p-0"
              title="Unmark"
            >
              <FiX size={13} />
            </button>
          </div>
        ))}
      </div>

      {keyed.length > 0 && (
        <div className="shrink-0 border-t border-[#1E1E1E] px-3 py-2.5 flex flex-col gap-1.5">
          <span className="text-[11px] text-[#555]">Export key images</span>
          <div className="flex flex-wrap gap-1.5">
            <button className={button} onClick={onSavePictures} title="Each key image as on screen, without patient details">Pictures (ZIP)</button>
            <button className={button} onClick={() => onDownloadDicom(false)}>DICOM (ZIP)</button>
            <button className={button} onClick={() => onDownloadDicom(true)} title="Names, IDs, addresses and institution removed; dates kept to the year; new UIDs">Anonymised</button>
          </div>
        </div>
      )}
    </div>
  );
}
