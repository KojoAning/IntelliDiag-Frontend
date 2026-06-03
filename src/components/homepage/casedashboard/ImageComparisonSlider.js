import React, { useState, useRef, useCallback, useEffect } from "react";

/**
 * Draggable before/after comparison slider.
 *
 * Props:
 *  - originalSrc  : URL (backend stream endpoint) or data-URI for the original image
 *  - overlaySrc   : URL or data-URI for the heatmap / mask overlay
 *  - overlayLabel : "Heatmap" | "Mask" (shown in badge)
 *  - onClose      : callback to dismiss the comparison view
 */
function ImageComparisonSlider({ originalSrc, overlaySrc, overlayLabel = "AI Overlay", onClose }) {
  const containerRef = useRef(null);
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);

  // Resolve the original image URL into a displayable blob URL.
  // The backend stream endpoint requires an auth header and may serve
  // binary data that <img> can't render directly.
  const [resolvedOriginal, setResolvedOriginal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!originalSrc) return;

    // If it's already a data-URI or blob URL, use directly
    if (originalSrc.startsWith("data:") || originalSrc.startsWith("blob:")) {
      setResolvedOriginal(originalSrc);
      setLoading(false);
      return;
    }

    let revoked = false;
    setLoading(true);

    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(originalSrc, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
        const blob = await res.blob();

        // Create a displayable blob URL — force image type if backend
        // returns application/octet-stream or application/dicom
        const type = blob.type;
        const isDisplayable = type.startsWith("image/") && !type.includes("dicom");
        const finalBlob = isDisplayable
          ? blob
          : new Blob([blob], { type: "image/png" });

        if (!revoked) {
          const url = URL.createObjectURL(finalBlob);
          setResolvedOriginal(url);
          setLoading(false);
        }
      } catch (err) {
        console.error("ImageComparisonSlider: failed to load original", err);
        setLoading(false);
      }
    })();

    return () => {
      revoked = true;
      setResolvedOriginal(prev => {
        if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [originalSrc]);

  const updatePosition = useCallback((clientX) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(pct);
  }, []);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
    updatePosition(e.clientX);
  }, [updatePosition]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e) => updatePosition(e.clientX);
    const onUp = () => setDragging(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, updatePosition]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-black rounded-xl overflow-hidden">

      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0C0C0C] border-b border-[#1E1E1E] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-xs font-mono">Comparison</span>
          <span className="bg-[#0694FB]/20 text-[#0694FB] text-[10px] font-mono px-2 py-0.5 rounded-full">
            {overlayLabel}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[#6B6B6B] hover:text-white text-xs bg-transparent border border-[#1E1E1E] hover:border-[#2a2a2a] rounded-lg px-3 py-1 cursor-pointer transition-all"
        >
          Close
        </button>
      </div>

      {/* Comparison area */}
      <div
        ref={containerRef}
        className="relative flex-1 cursor-col-resize select-none overflow-hidden"
        onPointerDown={handlePointerDown}
      >
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Original image — full width, sits behind */}
            {resolvedOriginal && (
              <img
                src={resolvedOriginal}
                alt="Original"
                draggable={false}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              />
            )}

            {/* Overlay image — clipped to the right portion */}
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{ clipPath: `inset(0 0 0 ${position}%)` }}
            >
              <img
                src={overlaySrc}
                alt="AI Overlay"
                draggable={false}
                className="absolute inset-0 w-full h-full object-contain opacity-30"
              />
            </div>

            {/* Divider line */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-white/80 pointer-events-none"
              style={{ left: `${position}%`, transform: "translateX(-50%)" }}
            />

            {/* Drag handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${position}%`, transform: "translate(-50%, -50%)" }}
            >
              <div className="w-10 h-10 rounded-full bg-white/90 border-2 border-white flex items-center justify-center shadow-lg backdrop-blur-sm">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M6 9L3 6M3 6L6 3M3 6H8" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="translate(0, 3)" />
                  <path d="M12 9L15 6M15 6L12 3M15 6H10" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="translate(0, 3)" />
                </svg>
              </div>
            </div>

            {/* Labels */}
            <div className="absolute top-3 left-3 pointer-events-none">
              <span className="bg-black/60 text-white/80 text-[10px] font-mono px-2 py-1 rounded">
                Original
              </span>
            </div>
            <div className="absolute top-3 right-3 pointer-events-none">
              <span className="bg-[#0694FB]/40 text-white text-[10px] font-mono px-2 py-1 rounded">
                {overlayLabel}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ImageComparisonSlider;
