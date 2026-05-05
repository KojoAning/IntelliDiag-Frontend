import React from "react";
import { FaBell } from "react-icons/fa";

function Appbar() {
  return (
    <div className="bg-[#0D0D0D] px-[27px] py-[15px] w-full flex flex-row items-center justify-between box-border rounded-[15px]">
      <div className="h-[42px] flex flex-col justify-center">
        <img src="intellidiag.png" alt="IntelliDiag Logo" height="22px" />
      </div>

      <div className="flex flex-row items-center gap-5">
        <FaBell size={20} color="#0694FB" />
        <div className="inline-flex">
          <div className="inline-flex justify-start items-center gap-3">
            <img
              className="w-11 h-11 rounded-full"
              src="https://placehold.co/44x44"
              alt="avatar"
            />
            <div className="inline-flex flex-col justify-start items-start">
              <div className="flex flex-col justify-center text-white/50 text-[10px] font-medium uppercase font-[Inter]">
                MD
              </div>
              <div className="text-white/80 text-sm font-medium font-[Inter]">
                Courtney Smith
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Appbar;
