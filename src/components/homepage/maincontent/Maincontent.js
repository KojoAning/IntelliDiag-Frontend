import React from "react";
import Sidebar from "../sidebar/Sidebar";
import Display from "../display_area/Display";

function Maincontent() {
  return (
    <div className="w-full h-screen flex flex-row gap-[30px] box-border mt-[30px]">
      <Sidebar />
      <Display />
    </div>
  );
}

export default Maincontent;
