import React from "react";
import ModelPanel from "./rightsection/modelpanel";
import LLMResponse from "./rightsection/LLMResponse";

function RightSection({ aiResponse, aiLoading, onModelSelect }) {
  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      <ModelPanel onModelSelect={onModelSelect} />
      <LLMResponse response={aiResponse} loading={aiLoading} />
    </div>
  );
}

export default RightSection;
