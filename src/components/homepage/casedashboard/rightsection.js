import React from "react";
import ModelPanel from "./rightsection/modelpanel";
import LLMResponse from "./rightsection/LLMResponse";
import TranslationPanel from "./rightsection/TranslationPanel";

function RightSection({ aiResponse, aiLoading, onModelSelect, onTranslate, expandReport, selectedModel, onSaveReport, reportSaving, modality, impression, onImpressionChange, inMprMode }) {
  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
      <ModelPanel onModelSelect={onModelSelect} selectedModel={selectedModel} modality={modality} inMprMode={inMprMode} />
      <TranslationPanel onTranslate={onTranslate} />
      <LLMResponse response={aiResponse} loading={aiLoading} expandReport={expandReport} onSaveReport={onSaveReport} reportSaving={reportSaving} impression={impression} onImpressionChange={onImpressionChange} />
    </div>
  );
}

export default RightSection;
