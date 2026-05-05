import React from "react";
import ModelPanel from "./rightsection/modelpanel";
import LLMResponse from "./rightsection/LLMResponse";

function RightSection() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <ModelPanel />
      <LLMResponse />
    </div>
  );
}

export default RightSection;
