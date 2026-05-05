import React from "react";

function Patientoverview() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        alignItems: "flex-start",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(6,148,251,0.17)",
            display: "inline-flex",
            //   width: "175px",
            borderRadius: "11px",
            padding: "6px 9px",
          }}
        >
          <p
            style={{
              margin: "0px",
              fontSize: "13px",
              color: "rgba(6,148,251,1)",
            }}
          >
            Patient / Case Overview
          </p>
        </div>
        <p
          style={{
            margin: "0px",
            fontSize: "13px",
            color: "rgba(6,148,251,1)",
          }}
        >
          View All
        </p>
      </div>

      <div
        style={{
          backgroundColor: "#0C0C0C",
          height: "100%",
          width: "100%",
          borderRadius: "18px",
        }}
      ></div>
    </div>
  );
}

export default Patientoverview;
