import React from "react";
import ModelPanel from "./rightsection/modelpanel";
import LLMResponse from "./rightsection/LLMResponse";
import TranslationPanel from "./rightsection/TranslationPanel";

function RightSection({ aiResponse, aiLoading, onModelSelect, onTranslate, expandReport, selectedModel, onSaveReport, reportSaving, modality }) {
  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
      <ModelPanel onModelSelect={onModelSelect} selectedModel={selectedModel} modality={modality} />
      <TranslationPanel onTranslate={onTranslate} />
      <LLMResponse response={aiResponse} loading={aiLoading} expandReport={expandReport} onSaveReport={onSaveReport} reportSaving={reportSaving} />
    </div>
  );
}

export default RightSection;
