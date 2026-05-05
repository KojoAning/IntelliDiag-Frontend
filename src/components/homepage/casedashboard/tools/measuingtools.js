import React, { useState } from "react";
import Component from "./component";
import { TbAngle, TbCirclePlus, TbRulerMeasure } from "react-icons/tb";

function Measuringtools() {
  const [activeTool, setActiveTool] = useState(null);

  const handleToolClick = (toolName) => {
    if (activeTool === toolName) {
      // If clicking the same tool, deactivate it
      setActiveTool(null);
    } else {
      // Activate the clicked tool and deactivate others
      setActiveTool(toolName);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: "12px",
        alignItems: "center",
        width: "fit-content",
      }}
    >
      <Component
        isClicked={activeTool === "ruler"}
        icon={<TbRulerMeasure color="#FFFFFF" size={24} strokeWidth={1} />}
        tooltip="Ruler"
        onClick={() => handleToolClick("ruler")}
      />
      <Component
        isClicked={activeTool === "addBox1"}
        icon={<TbAngle color="#FFFFFF" size={24} strokeWidth={1} />}
        tooltip="Measure Angle"
        onClick={() => handleToolClick("addBox1")}
      />
      <Component
        isClicked={activeTool === "addBox2"}
        icon={<TbCirclePlus color="#FFFFFF" size={24} strokeWidth={1} />}
        tooltip="Add Markers"
        onClick={() => handleToolClick("addBox2")}
      />
    </div>
  );
}

export default Measuringtools;
