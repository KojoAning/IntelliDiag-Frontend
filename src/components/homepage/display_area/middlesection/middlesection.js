import React from "react";
import PreviousScan from "./PreviousScan";
import Patientoverview from "./PatientOvervew";

function Middlesection() {
  return (
    <div className="flex flex-row w-full gap-[60px] h-[366px]">
      <PreviousScan />
      <Patientoverview />
    </div>
  );
}

export default Middlesection;
