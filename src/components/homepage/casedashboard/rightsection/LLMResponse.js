import React, { useState } from "react";
import { FiDownload, FiCpu } from "react-icons/fi";

const mockFindings = [
  {
    model: "Fracture Detection",
    tag: "Fracture",
    tagColor: "text-[#FF6B35] bg-[rgba(255,107,53,0.17)]",
    confidence: 91,
    finding: "Hairline cortical discontinuity along the radial shaft mid-diaphysis. Consistent with a non-displaced stress fracture. Recommend immobilisation and follow-up X-ray in 2 weeks.",
  },
  {
    model: "Soft Tissue Analyser",
    tag: "Ligament",
    tagColor: "text-[#A855F7] bg-[rgba(168,85,247,0.17)]",
    confidence: 74,
    finding: "Mild interosseous membrane thickening noted. May indicate early inflammatory response. Clinical correlation advised.",
  },
];

function LLMResponse() {
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

      {/* AI findings */}
      <div className="flex flex-col gap-3">
        {mockFindings.map((f, i) => (
          <div key={i} className="bg-[#111] rounded-xl p-3 flex flex-col gap-2 border border-[#1a1a1a]">
            <div className="flex items-center justify-between">
              <p className="text-white text-[12px] font-medium m-0">{f.model}</p>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${f.tagColor}`}>{f.tag}</span>
            </div>

            {/* Confidence bar */}
            <div>
              <div className="flex justify-between mb-1">
                <p className="text-[#6B6B6B] text-[10px] m-0">Confidence</p>
                <p className="text-white text-[10px] font-medium m-0">{f.confidence}%</p>
              </div>
              <div className="w-full h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div className="h-full bg-[#0694FB] rounded-full" style={{ width: `${f.confidence}%` }} />
              </div>
            </div>

            <p className="text-[#CCCCCC] text-[11px] m-0 leading-relaxed">{f.finding}</p>
          </div>
        ))}
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
