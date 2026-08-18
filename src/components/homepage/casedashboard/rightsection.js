import React from "react";
import ModelPanel from "./rightsection/modelpanel";
import LLMResponse from "./rightsection/LLMResponse";
import TranslationPanel from "./rightsection/TranslationPanel";

function RightSection({ aiResponse, aiLoading, onModelSelect, onTranslate, expandReport, selectedModel }) {
  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
      <ModelPanel onModelSelect={onModelSelect} selectedModel={selectedModel} />
      <TranslationPanel onTranslate={onTranslate} />
      <LLMResponse response={aiResponse} loading={aiLoading}  expandReport={expandReport} />
    </div>
  );
}

export default RightSection;
