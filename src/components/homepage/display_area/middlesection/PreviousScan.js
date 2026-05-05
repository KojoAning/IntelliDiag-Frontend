import React from "react";

function PreviousScan() {
  return (
    <div className="flex flex-col gap-5 w-[40%] h-full items-start">
      <div className="bg-[rgba(6,148,251,0.17)] inline-flex rounded-[11px] px-[9px] py-[6px]">
        <p className="m-0 text-[13px] text-[#0694FB]">Previously Viewed Scan</p>
      </div>
      <div className="bg-[#0C0C0C] h-full w-full rounded-[18px]" />
    </div>
  );
}

export default PreviousScan;
