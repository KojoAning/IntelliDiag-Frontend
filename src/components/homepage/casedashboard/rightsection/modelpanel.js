import React from "react";
import ModelCard from "./components/ModelCard.js";

function ModelPanel() {
  return (
    <div
      style={{
        width: "100%",
        maxHeight: "290px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden", 
        backgroundColor:"#0c0c0c",
        borderRadius:"15px",
        padding:"18px 18px",
        boxSizing:"border-box",
        gap:"19px",
        scrollbarColor: "#1B1B1B #000000", // Firefox
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
  
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
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
          Selected AI model
        </div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "#FFFFFF",
            padding: "8px 9px",
            width: "fit-content",
            borderRadius: "8px",
            backgroundColor: "#0694FB",
          }}
        >
          Add model
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
       
          boxSizing: "border-box",
          overflowY: "auto",
          flex: 1,
          minHeight: 0,
        }}
      >
        <ModelCard />
        <ModelCard />
        <ModelCard />

      </div>
    </div>
  );
}

export default ModelPanel;
