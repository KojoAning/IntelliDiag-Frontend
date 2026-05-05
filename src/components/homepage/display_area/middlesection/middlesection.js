import React from "react";
import PreviousScan from "./PreviousScan";
import Patientoverview from "./PatientOvervew";

function Middlesection() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        width: "100%",
        gap: "60px",
        height: "366px",
      }}
    >
      <PreviousScan />
      <Patientoverview />
    </div>
  );
}

export default Middlesection;
