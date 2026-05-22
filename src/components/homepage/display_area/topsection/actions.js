import React from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";

const Actions = ({
  buttonText = "Create New Case",
  stats = [
    { label: "Today's Inference", value: 56 },
    { label: "Average Inference Time", value: "56s" },
  ],
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-row gap-10 w-full max-w-[485px] h-full justify-center items-end flex-wrap md:gap-6 md:justify-start">
      <button
        onClick={() => navigate("/new-case")}
        className="bg-[#0694fb] rounded-full py-[8px] px-3 cursor-pointer transition-all duration-200 min-w-[128px] text-center border-none hover:bg-[#0578d1] hover:-translate-y-0.5"
      >
        <p className="m-0 text-white font-normal text-[0.8rem]">{buttonText}</p>
      </button>

      {/* {stats.map((stat, index) => (
        <div key={index} className="flex flex-col">
          <div className="bg-[rgba(6,148,251,0.17)] inline-flex rounded-[11px] px-[9px] py-[6px] mb-[5px]">
            <p className="m-0 text-xs text-[#0694FB] font-medium">{stat.label}</p>
          </div>
          <h1 className="m-0 pl-[10px] text-[30px] font-normal text-white">
            {stat.value}
          </h1>
        </div>
      ))} */}
    </div>
  );
};

Actions.propTypes = {
  buttonText: PropTypes.string,
  stats: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ),
};

export default Actions;
