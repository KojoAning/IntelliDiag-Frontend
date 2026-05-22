import React from "react";
import Sidebar from "../sidebar/Sidebar";
import Display from "../display_area/Display";

function Maincontent() {
  return (
    <div className="w-full flex flex-row gap-[30px] box-border mt-[30px] flex-1 min-h-0">
      <Sidebar activePage="Home" />
      <Display />
    </div>
  );
}

export default Maincontent;
