import React from "react";
import Greeting from "./greeting";
import Actions from "./actions";

function Topsection() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        width: "100%",
        justifyContent: "space-between",
      }}
    >
      <Greeting />
      <Actions />
    </div>
  );
}

export default Topsection;
