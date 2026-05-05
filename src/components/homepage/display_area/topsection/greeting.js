import React from "react";
import PropTypes from "prop-types";

const Greeting = ({
  date = "Mon, July 2",
  name = "Courtney",
  message = "how can we help you today?",
}) => {
  return (
    <div className="w-full max-w-[493px] flex flex-col gap-[9px] m-0 p-4 box-border">
      <p className="m-0 text-white text-sm leading-[1.4] opacity-80">{date}</p>
      <h1 className="m-0 text-white font-medium text-[40px] md:text-[32px] leading-[1.2]">
        Hello, <span className="text-[#0694fb] font-medium">{name}</span>
        <br />
        {message}
      </h1>
    </div>
  );
};

Greeting.propTypes = {
  date: PropTypes.string,
  name: PropTypes.string,
  message: PropTypes.string,
};

export default Greeting;
