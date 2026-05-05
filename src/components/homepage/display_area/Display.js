import React from "react";
import Topsection from "./topsection/Topsection";
import Middlesection from "./middlesection/middlesection";
import Bottomsection from "./bottomsection/bottomsection";

function Display() {
  return (
    <div className="box-border w-[90%] h-[95%] mt-5 gap-[10px] flex flex-col justify-between">
      <Topsection />
      <Middlesection />
      <Bottomsection />
    </div>
  );
}

export default Display;
