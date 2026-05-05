import React from "react";
import PropTypes from "prop-types";

const Bottomsection = ({ cardCount = 6 }) => {
  return (
    <div className="flex flex-col gap-5 w-full mt-[10px] h-[268px] items-start">
      <div className="bg-[rgba(6,148,251,0.17)] inline-flex rounded-[11px] px-[9px] py-[6px]">
        <p className="m-0 text-[13px] text-[#0694FB] font-medium">Ai models</p>
      </div>

      <div
        className="flex h-full w-full gap-[35px] overflow-x-auto pb-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}
      >
        {Array.from({ length: cardCount }).map((_, index) => (
          <div
            key={index}
            className="bg-[#0C0C0C] h-full min-w-[234px] rounded-[18px] shrink-0 transition-transform duration-200 hover:-translate-y-1 md:min-w-[192px]"
          />
        ))}
      </div>
    </div>
  );
};

Bottomsection.propTypes = {
  cardCount: PropTypes.number,
};

export default Bottomsection;
