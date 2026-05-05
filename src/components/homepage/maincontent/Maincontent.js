import React from "react";
import Sidebar from "../sidebar/Sidebar";
import Display from "../display_area/Display";

function Maincontent() {
  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "row",
        gap: "30px",
        boxSizing: "border-box",
        marginTop: "30px",
      }}
    >
      <Sidebar />
      <Display />
    </div>
  );
}

export default Maincontent;
