import React, { useState } from "react";
import Measuringtools from "./tools/measuingtools";
import Drawingtools from "./tools/drawingtools";
import { Canvas } from "react-sketch-canvas";
import CustomCanvas from "./tools/CustomCanvas";
import SketchActions from "./tools/SketchActions";
import PolygonCanvas from "./tools/PolygonCanvas";
import ReactPolygonDrawer from "react-polygon-drawer";

function Midsection({ selectedImage }) {
  const [selectedDrawingTool, setSelectedDrawingTool] = useState(null);
  const [selectedMeasuringTool, setSelectedMeasuringTool] = useState(null);

  const handleDrawingToolSelect = (toolName) => {
    setSelectedDrawingTool(toolName);
    console.log("Selected drawing tool:", toolName);
  };

  const handleMeasuringToolSelect = (toolName) => {
    setSelectedMeasuringTool(toolName);
    console.log("Selected measuring tool:", toolName);
  };

  const [currentAction, setCurrentAction] = useState(null);

  const handleUndo = () => {
    setCurrentAction("undo");
    console.log("Current action:", currentAction);
  };

  const handleRedo = () => {
    setCurrentAction("redo");
  };

  const handleClear = () => {
    setCurrentAction("clear");
  };

  const handleEraser = () => {
    setCurrentAction("eraser");
  };

  return (
    <div
      style={{
        width: "100%",
        minWidth: "989px",
        height: "100%",
        gap: "18px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "fit-content",
          // backgroundColor: "blue",
          display: "flex",
          flexDirection: "row",
          // width: "100%",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            minWidth: "458px",
            height: "fit-content",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            fontSize: "13px",
            fontWeight: "400",
            color: "rgba(255,255,255,0.56)",
          }}
        >
          Drawing Tools
          <div
            style={{
              width: "fit-content",
              height: "fit-content",
              backgroundColor: "#0c0c0c",
              borderRadius: "11px",

              padding: "9px 12px",
            }}
          >
            <Drawingtools onToolSelect={handleDrawingToolSelect} />
          </div>
        </div>
        <div
          style={{
            // minWidth: "458px",
            width: "fit-content",
            height: "fit-content",
            display: "flex",
            flexDirection: "column",
            // justifyContent: "flex-end",

            gap: "16px",
            // backgroundColor: "red",
            fontSize: "13px",
            fontWeight: "400",
            color: "rgba(255,255,255,0.56)",
          }}
        >
          Measuring Tools
          <div
            style={{
              // miWidth: "458px",
              width: "fit-content",
              height: "fit-content",
              backgroundColor: "#0c0c0c",
              borderRadius: "11px",
              display: "flex",
              // flexDirection: "row",
              gap: "12px",
              padding: "9px 12px",
            }}
          >
            <Measuringtools onToolSelect={handleMeasuringToolSelect} />
            <div style={{ height: "48px" }}></div>
          </div>
          {selectedMeasuringTool && (
            <div
              style={{
                fontSize: "12px",
                color: "#0694FB",
                fontWeight: "500",
              }}
            >
              Selected: {selectedMeasuringTool}
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#0c0c0c",
          position: "relative", // allow stacking
          overflow: "hidden",
        }}
      >
        {/* Background Image */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 0,
          }}
        >
          <img
            src={selectedImage}
            style={{
              height: "100%", // fill parent vertically
              width: "auto", // maintain aspect ratio
              maxWidth: "100%", // prevent horizontal overflow
              objectFit: "contain",
            }}
            alt=""
          />
        </div>

        {/* Overlay Canvas */}
        <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              zIndex: 1,
              backgroundColor: "transparent",
            }}
          >
            <CustomCanvas isActive={true} currentAction={selectedDrawingTool} />
          </div>
      </div>
    </div>
  );
}

export default Midsection;
