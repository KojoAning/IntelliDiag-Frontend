import React from "react";
import ModelPanel from "./rightsection/modelpanel";
import LLMResponse from "./rightsection/LLMResponse";

function RightSection() {
  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      <ModelPanel />
      <LLMResponse />
    </div>
  );
}

export default RightSection;
