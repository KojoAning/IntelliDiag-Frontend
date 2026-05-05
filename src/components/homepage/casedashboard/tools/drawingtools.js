import React, { useState } from "react";
import Component from "./component";
import { TbAngle, TbCirclePlus, TbRulerMeasure } from "react-icons/tb";
import { FaRegCircle, FaRegSquare } from "react-icons/fa";
import { LiaCircleSolid } from "react-icons/lia";
import { TfiText } from "react-icons/tfi";
import { CiEraser } from "react-icons/ci";
import { RiSketching } from "react-icons/ri";
import { PiPolygonLight } from "react-icons/pi";
import { GoArrowUpRight } from "react-icons/go";
import { IoSquareOutline } from "react-icons/io5";

function Drawingtools({ onToolSelect }) {
  const [activeTool, setActiveTool] = useState(null);

  const handleToolClick = (toolName) => {
    if (activeTool === toolName) {
      // If clicking the same tool, deactivate it
      setActiveTool(null);
      // Notify parent that no tool is selected
      if (onToolSelect) {
        onToolSelect(null);
      }
    } else {
      // Activate the clicked tool and deactivate others
      setActiveTool(toolName);
      // Notify parent about the selected tool
      if (onToolSelect) {
        onToolSelect(toolName);
      }
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
        icon={<LiaCircleSolid color="#FFFFFF" size={24} strokeWidth={1} />}
        tooltip="Draw Circle"
        onClick={() => handleToolClick("ruler")}
      />
      <Component
        isClicked={activeTool === "addBox1"}
        icon={<TfiText color="#FFFFFF" size={20} strokeWidth={0.1} />}
        tooltip="Add Text"
        onClick={() => handleToolClick("addBox1")}
      />
      <Component
        isClicked={activeTool === "square"}
        icon={<IoSquareOutline color="#FFFFFF" size={24} strokeWidth={0.1} />}
        tooltip="Draw Square"
        onClick={() => handleToolClick("square")}
      />
      <Component
        isClicked={activeTool === "arrow"}
        icon={<GoArrowUpRight color="#FFFFFF" size={24} strokeWidth={0.3} />}
        tooltip="Add Arrow"
        onClick={() => handleToolClick("arrow")}
      />
      <Component
        isClicked={activeTool === "polygon"}
        icon={<PiPolygonLight color="#FFFFFF" size={24} strokeWidth={0.3} />}
        tooltip="Draw Polygon"
        onClick={() => handleToolClick("polygon")}
      />
      <Component
        isClicked={activeTool === "sketch"}
        icon={<RiSketching color="#FFFFFF" size={27} strokeWidth={0.05} />}
        tooltip="Sketch"
        onClick={() => handleToolClick("sketch")}
      />

    </div>
  );
}

export default Drawingtools;
