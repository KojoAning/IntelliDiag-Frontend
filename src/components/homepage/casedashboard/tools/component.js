import React, { useState } from "react";
import { TbRulerMeasure } from "react-icons/tb";

function Component({ icon, tooltip, isClicked, onClick }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        width: "48px",
        height: "48px",
        backgroundColor: isHovered && !isClicked
          ? "#383838"
          : isClicked
          ? "#0694FB"
          : "#0c0c0c",
        borderRadius: "10px",
        // padding:"9px 12px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        cursor: "pointer",
      }}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      title={tooltip}
      onClick={onClick}
    >
      {icon}
    </div>
  );
}
export default Component;
