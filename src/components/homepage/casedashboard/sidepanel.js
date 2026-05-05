import React, { useState } from "react";
import Midsection from "./midsection";

function Sidepanel({
  images,
  onUploadClick,
  onImageUpload,
  fileInputRef,
  numBoxes,
  onSelectImage,
}) {
  const numBoxesDisplay = Math.max(images.length, 4);
  const [Idx, selectedIdx] = useState();

  return (
    <div
      style={{
        width: "220px",
        minWidth: "220px",
        maxWidth: "220px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        overflowY: "hidden", // prevent horizontal overflow
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
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
          Uploaded Images
        </div>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 400,
            color: "#01F480",
            padding: "8px 9px",
            width: "fit-content",
            borderRadius: "10px",
            backgroundColor: "rgba(1, 244, 128, 0.17)",
          }}
        >
          {images.length}
        </div>
      </div>

      {/* Scrollable container */}
      <div
        style={{
          flex: 1,
          overflowY: "scroll",
          overflowX: "hidden", // force vertical scroll only
          display: "flex",
          flexDirection: "column",

          gap: "15px",
          maxHeight: "800px",
          /* Custom scrollbar for Webkit browsers */
          scrollbarColor: "#1B1B1B #000000", // Firefox
          paddingRight: "8px", // Space for scrollbar
        }}
        className="sidepanel-scrollable"
      >
        {Array.from({ length: numBoxesDisplay }).map((_, idx) => {
          if (images[idx]) {
            return (
              <div
                onClick={() => onSelectImage(images[idx].url)}
                key={idx}
                style={{
                  minHeight: "185px",
                  width: "100%",
                  backgroundColor: "#111111",
                  borderRadius: "15px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid #242424",
                  color: "white",
                  fontSize: "18px",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <img
                  src={images[idx].url}
                  alt={`Uploaded ${idx + 1}`}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>
            );
          } else if (idx === images.length) {
            return (
              <button
                key={idx}
                style={{
                  height: "185px",
                  width: "100%",
                  backgroundColor: "#111111",
                  color: "#0694FB",
                  border: "none",
                  borderRadius: "15px",
                  cursor: "pointer",
                  fontSize: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid #0694FB",
                }}
                onClick={onUploadClick}
                type="button"
              >
                +
              </button>
            );
          } else {
            return (
              <div
                key={idx}
                style={{
                  height: "185px",
                  width: "100%",
                  backgroundColor: "#111111",
                  borderRadius: "15px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid #242424",
                  color: "white",
                  fontSize: "18px",
                }}
              >
                Image {idx + 1}
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}

export default Sidepanel;

// Custom scrollbar styles
const style = document.createElement("style");
style.innerHTML = `
.sidepanel-scrollable::-webkit-scrollbar {
  width: 8px;
  background: #222;
  border-radius: 8px;
}
.sidepanel-scrollable::-webkit-scrollbar-thumb {
  background: #0694FB;
  border-radius: 8px;
}
.sidepanel-scrollable::-webkit-scrollbar-thumb:hover {
  background: #0578d1;
}
`;
document.head.appendChild(style);
