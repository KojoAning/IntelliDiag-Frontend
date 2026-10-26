import React from "react";
import ModelPanel from "./rightsection/modelpanel";
import LLMResponse from "./rightsection/LLMResponse";
import TranslationPanel from "./rightsection/TranslationPanel";

function RightSection({ aiResponse, aiLoading, onModelSelect, onTranslate, expandReport, selectedModel, onSaveReport, reportSaving, modality, impression, onImpressionChange, patientHistory, onPatientHistoryChange, reportTab, onReportTabChange }) {
  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
      <ModelPanel onModelSelect={onModelSelect} selectedModel={selectedModel} modality={modality} />
      <TranslationPanel onTranslate={onTranslate} modality={modality} />
      <LLMResponse response={aiResponse} loading={aiLoading} expandReport={expandReport} onSaveReport={onSaveReport} reportSaving={reportSaving} impression={impression} onImpressionChange={onImpressionChange} patientHistory={patientHistory} onPatientHistoryChange={onPatientHistoryChange} activeTab={reportTab} onTabChange={onReportTabChange} />
    </div>
  );
}

export default RightSection;
