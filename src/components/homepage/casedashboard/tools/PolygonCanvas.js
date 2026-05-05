import React from "react";
import ReactPolygonDrawer from "react-polygon-drawer";

function PolygonCanvas() {
  return (
    <div>
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          backgroundColor: "green",
        }}
      >
        <ReactPolygonDrawer
          width="100%"
          height={900}
          style={{
            backgroundColor: "green",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        />
      </div>
    </div>
  );
}

export default PolygonCanvas;
