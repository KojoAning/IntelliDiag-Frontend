import { ExpandIcon } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { FiCpu, FiFileText } from "react-icons/fi";
import AILoadingState from "./AILoadingState";

/**
 * Parse markdown-ish text into styled React elements:
 *  - ### Headings   → blue, bold
 *  - **bold**       → white, semi-bold
 *  - *italic*       → dimmed, italic
 *  - - bullet items → accent dot + text
 *  - plain text     → default grey
 */
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

/** Render inline markdown: **bold** and *italic* */
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

// Height below which we collapse to the compact "View Report" button
const COLLAPSE_THRESHOLD = 260;

function LLMResponse({ response, loading, expandReport, onSaveReport, reportSaving }) {
  const [impression, setImpression] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const observerRef = useRef(null);

  // Callback ref — re-attaches the ResizeObserver whenever the DOM node changes
  const containerRef = useRef(null);
  const attachRef = (el) => {
    containerRef.current = el;
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setCollapsed(entry.contentRect.height < COLLAPSE_THRESHOLD);
    });
    observer.observe(el);
    observerRef.current = observer;
  };

  // Clean up on unmount
  useEffect(() => () => observerRef.current?.disconnect(), []);

  // ── Collapsed / small-screen mode ────────────────────────────────────────
  if (collapsed) {
    return (
      <div
        ref={attachRef}
        className="flex flex-col gap-2 bg-[#161616] rounded-[15px] p-[14px] box-border flex-1 min-h-0 items-center justify-center"
      >
        {loading && !response ? (
          <AILoadingState label="Generating" variant="Drive" />
        ) : (
          <button
            onClick={() => expandReport?.()}
            disabled={!response}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0694FB] hover:bg-[#0578d1] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-medium border-none cursor-pointer transition-colors"
          >
            <FiFileText size={14} />
            View Report
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={attachRef}
      className="flex flex-col gap-4 bg-[#161616] rounded-[15px] p-[18px] box-border flex-1 min-h-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="bg-[rgba(6,148,251,0.17)] rounded-full px-3 py-1.5 flex items-center gap-1.5">
          <p className="text-[#0694FB] text-[12px] font-medium m-0">AI Generated Report</p>
        </div>
        {response && <button onClick={()=>expandReport()}><ExpandIcon size={20}  className="text-[#0694FB]"/></button>}
        
      </div>

      {/* Response area */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#1B1B1B #000" }}>
        {!loading && !response ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <FiCpu size={24} className="text-[#6B6B6B]" />
            <p className="text-[#6B6B6B] text-[13px] m-0 text-center">
              Hit "Run Analysis" to generate a report
            </p>
          </div>
        ) : loading && !response ? (
          /* Initial load — pixel-grid loader before streaming begins */
          <div className="flex items-center justify-center py-8">
            <AILoadingState label="Generating" variant="Drive" />
          </div>
        ) : (
          <div className="bg-[#111] rounded-xl p-4 border border-[#1a1a1a] flex flex-col gap-2">
            {/* Streaming indicator while report is still being written */}
            {loading && (
              <div className="shrink-0">
                <AILoadingState label="Generating" variant="Dots" />
              </div>
            )}
            <div className="flex flex-col">
              {renderReport(response)}
              {loading && <span className="inline-block w-[2px] h-[13px] bg-[#0694FB] ml-0.5 mt-1 animate-pulse" />}
            </div>
          </div>
        )}
      </div>

      {/* Radiologist impression */}
      <div className="flex flex-col gap-2 shrink-0">
        <p className="text-[#6B6B6B] text-[10px] uppercase tracking-wide m-0">Radiologist Impression</p>
        <textarea
          value={impression}
          onChange={(e) => setImpression(e.target.value)}
          placeholder="Add your impression..."
          rows={3}
          className="w-full bg-[#111] border border-[#1E1E1E] rounded-xl px-3 py-2.5 text-white text-[12px] outline-none placeholder-[#3a3a3a] focus:border-[#0694FB] transition-colors resize-none"
        />
        <button
          disabled={reportSaving || (!response && !impression.trim())}
          onClick={() => onSaveReport?.(impression)}
          className="w-full py-[10px] text-white text-[12px] font-medium rounded-full border-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#0694FB] hover:bg-[#0578d1] enabled:cursor-pointer"
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
    </div>
  );
}

export default LLMResponse;
