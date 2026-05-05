import React from "react";
import { Nav, NavLink, NavMenu, Bars } from "./NavBarElements";

const Navbar = () => {
  return (
    <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
      <Nav
        style={{
          background: "rgba(73, 73, 73, 0.1)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: "12px",
          zIndex: "999",
          display: "flex",
          gap: "90px",
          justifyContent: "center",
        }}
      >
        
          <h1>
            <img src="intellidiag.png" alt="IntelliDiag Logo" height="30px" />
          </h1>
    

        <NavMenu>
          <NavLink to="/home" activeStyle={{ color: "#0094FF" }}>
            Home
          </NavLink>
          <NavLink to="/about" activeStyle={{ color: "#0094FF" }}>
            About
          </NavLink>
          <NavLink to="/features" activeStyle={{ color: "#0094FF" }}>
            Features
          </NavLink>
          <NavLink to="/contact" activeStyle={{ color: "#0094FF" }}>
            Contact
          </NavLink>
        </NavMenu>
      </Nav>
    </div>
  );
};

export default Navbar;
