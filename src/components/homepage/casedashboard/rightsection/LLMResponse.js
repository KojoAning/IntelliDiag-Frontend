import React, { useState } from "react";
import { FiCpu } from "react-icons/fi";

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

function LLMResponse({ response, loading }) {
  const [impression, setImpression] = useState("");

  return (
    <div
      className="flex flex-col gap-4 bg-[#161616] rounded-[15px] p-[18px] box-border flex-1 overflow-y-auto"
      style={{ scrollbarWidth: "thin", scrollbarColor: "#1B1B1B #000" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="bg-[rgba(6,148,251,0.17)] rounded-full px-3 py-1.5 flex items-center gap-1.5">
          <p className="text-[#0694FB] text-[12px] font-medium m-0">AI Generated Report</p>
        </div>
      </div>

      {/* Response area */}
      <div className="flex-1 flex flex-col">
        {!loading && !response ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <FiCpu size={24} className="text-[#2a2a2a]" />
            <p className="text-[#3a3a3a] text-[11px] m-0 text-center">
              Hit "Run AI Analysis" to generate a report
            </p>
          </div>
        ) : (
          <div className="bg-[#111] rounded-xl p-4 border border-[#1a1a1a] flex flex-col gap-2">
            {/* Show spinner in corner while still streaming */}
            {loading && (
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-3 h-3 border-2 border-[#0694FB] border-t-transparent rounded-full animate-spin" />
                <span className="text-[#0694FB] text-[11px]">Generating…</span>
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
        <button className="w-full py-[10px] bg-[#0694FB] hover:bg-[#0578d1] text-white text-[12px] font-medium rounded-full border-none cursor-pointer transition-colors">
          Save & Generate Report
        </button>
      </div>
    </div>
  );
}

export default LLMResponse;
