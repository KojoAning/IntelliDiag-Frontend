import React from "react";
import { FaBell } from "react-icons/fa";

function Appbar() {
  return (
    <div
      style={{
        backgroundColor: "#0D0D0D",
        padding: "15px 27px",
        width: "100%",
        // height: "92px",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        boxSizing: "border-box",
        borderRadius: "15px",
      }}
    >
      <div
        style={{
          height: "42px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <img
          style={
            {
              //   padding: "48px 0px",
            }
          }
          src="intellidiag.png"
          alt="IntelliDiag Logo"
          height="22px"
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <FaBell size={20} color="#0694FB" />
        <div
          style={{
            display: "inline-flex",
          }}
        >
          <div
            style={{
              justifyContent: "flex-start",
              alignItems: "center",
              gap: 12,
              display: "inline-flex",
            }}
          >
            <img
              style={{ width: 44, height: 44, borderRadius: 36.22 }}
              src="https://placehold.co/44x44"
            />
            <div
              style={{
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",

                display: "inline-flex",
              }}
            >
              <div
                style={{
                  justifyContent: "center",
                  display: "flex",
                  flexDirection: "column",
                  color: "rgba(255, 255, 255, 0.50)",
                  fontSize: 10,
                  fontFamily: "Inter",
                  fontWeight: "500",
                  textTransform: "uppercase",
                }}
              >
                MD
              </div>
              <div
                style={{
                  alignSelf: "stretch",
                  color: "rgba(255, 255, 255, 0.80)",
                  fontSize: 14,
                  fontFamily: "Inter",
                  fontWeight: "500",
                }}
              >
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
