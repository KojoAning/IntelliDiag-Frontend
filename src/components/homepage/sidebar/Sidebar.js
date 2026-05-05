import React, { useState } from "react";
import {
  FiHome,
  FiSettings,
  FiUser,
  FiCalendar,
  FiMessageSquare,
} from "react-icons/fi";
import { RiHistoryLine } from "react-icons/ri";

function Sidebar() {
  const [activeItem, setActiveItem] = useState("Home");

  const menuItems = [
    { name: "Home", icon: <FiHome size={20} /> },
    { name: "Cases", icon: <FiUser size={20} /> },
    { name: "History", icon: <RiHistoryLine size={20} /> },
    { name: "Calendar", icon: <FiCalendar size={20} /> },
    { name: "Settings", icon: <FiSettings size={20} /> },
  ];

  return (
    <div
      style={{
        width: "321px",
        height: "100%",
        backgroundColor: "#0C0C0C",
        borderRadius: "12px",
        padding: "24px 16px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        borderRight: "1px solid #1E1E1E",
      }}
    >
      <div
        style={{
          padding: "0 12px 16px",
          borderBottom: "1px solid #1E1E1E",
          marginBottom: "16px",
        }}
      >
        <h2
          style={{
            color: "#FFFFFF",
            margin: 0,
            fontSize: "16px",
            fontWeight: "500",
          }}
        >
          Dashboard
        </h2>
      </div>

      {menuItems.map((item) => (
        <div
          key={item.name}
          onClick={() => setActiveItem(item.name)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 16px",
            borderRadius: "8px",

            fontWeight: "500px",
            backgroundColor:
              activeItem === item.name ? "rgba(6,148,251,0.17)" : "transparent",
            color: activeItem === item.name ? "#0694FB" : "#A0A0A0",
            transition: "all 0.3s ease",
            ":hover": {
              backgroundColor: "rgba(6,148,251,0.17)",
              color: "#0694FB",
              transform: "translateX(4px)",
            },
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "24px",
              height: "24px",
            }}
          >
            {item.icon}
          </div>
          <span
            style={{
              fontSize: "15px",
              fontWeight: "400",
            }}
          >
            {item.name}
          </span>
        </div>
      ))}

      <div
        style={{
          marginTop: "auto",
          padding: "16px 12px 0",
          borderTop: "1px solid #1E1E1E",
          color: "#A0A0A0",
          fontSize: "13px",
        }}
      >
        © 2025 intelliDiag
      </div>
    </div>
  );
}

export default Sidebar;
