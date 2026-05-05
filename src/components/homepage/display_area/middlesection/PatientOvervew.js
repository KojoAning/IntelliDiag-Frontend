import React from "react";

function Patientoverview() {
  return (
    <div className="flex flex-col gap-5 items-start w-full">
      <div className="flex flex-row w-full justify-between">
        <div className="bg-[rgba(6,148,251,0.17)] inline-flex rounded-[11px] px-[9px] py-[6px]">
          <p className="m-0 text-[13px] text-[#0694FB]">Patient / Case Overview</p>
        </div>
        <p className="m-0 text-[13px] text-[#0694FB]">View All</p>
      </div>
      <div className="bg-[#0C0C0C] h-full w-full rounded-[18px]" />
    </div>
  );
}

export default Patientoverview;
