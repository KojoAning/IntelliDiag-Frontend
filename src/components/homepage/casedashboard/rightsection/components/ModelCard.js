import React from "react";

function ModelCard() {
  return (
    <div style={{ display: "flex", flexDirection: "row", gap: "12px" ,alignItems:"center"}}>
      <div style={{ width: "109px", height: "88px", borderRadius:"10px",backgroundColor:"#000000"}}>img</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ fontSize: "14px", fontWeight: "400", color: "#FFFFFF" }}>
          Model Name
        </div>
        <div style={{ fontSize: "14px", fontWeight: "400", color: "#FFFFFF" }}>
          Model id
        </div>
        <div style={{height:"3px"}}></div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: "400",
            color: "#DB4437",
            borderRadius: "10px",
            backgroundColor: "rgba(255,74,74,0.17)",
            padding: "6px 9px",
            boxSizing: "border-box",
          }}
        >
          Brain Tumor
        </div>
      </div>
    </div>
  );
}

export default ModelCard;
