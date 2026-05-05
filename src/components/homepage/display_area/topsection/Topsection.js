import React from "react";
import Greeting from "./greeting";
import Actions from "./actions";

function Topsection() {
  return (
    <div className="flex flex-row w-full justify-between">
      <Greeting />
      <Actions />
    </div>
  );
}

export default Topsection;
