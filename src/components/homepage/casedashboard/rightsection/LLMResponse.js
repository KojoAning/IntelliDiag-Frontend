import React from "react";

function LLMResponse() {
  return (
    <div
      style={{
        width: "100%",
        maxHeight: "341px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: "#0c0c0c",
        borderRadius: "15px",
        padding: "18px 18px",
        boxSizing: "border-box",
        gap: "19px",
        scrollbarColor: "#1B1B1B #000000", // Firefox
      }}
    >
      <div >
        <div
          style={{
            fontSize: "12px",
            fontWeight: 400,
            color: "#0694FB",
            padding: "8px 9px",
            width: "fit-content",
            borderRadius: "10px",
            backgroundColor: "rgba(6, 148, 251, 0.17)",
          }}
        >
          AI Generated Report
        </div>
      </div>
    </div>
  );
}

export default LLMResponse;
