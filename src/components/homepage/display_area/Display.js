import React from "react";
import Topsection from "./topsection/Topsection";
import Middlesection from "./middlesection/middlesection";
import Bottomsection from "./bottomsection/bottomsection";

function Display() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: "90%",
        height: "95%",
        marginTop: "20px",
        // marginBottom: "40px",
        gap:"10px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        // backgroundColor: "blue",
      }}
    >
      <Topsection />
      <Middlesection />
      <Bottomsection />
    </div>
  );
}

export default Display;
