import React from "react";
import { Nav, NavMenu } from "./NavBarElements";

const NAV_ITEMS = [
  { label: "Home",     id: "home"     },
  { label: "About",    id: "about"    },
  { label: "Features", id: "features" },
  { label: "Contact",  id: "contact"  },
];

const scrollTo = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  const offset = 80; // account for fixed navbar height
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: "smooth" });
};

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
          alignItems: "center",
        }}
      >
        <img
          src="/intellidiag.png"
          alt="IntelliDiag Logo"
          style={{ height: "18px", width: "auto", display: "block", cursor: "pointer" }}
          onClick={() => scrollTo("home")}
        />

        <NavMenu>
          {NAV_ITEMS.map(({ label, id }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              style={{
                color: "#fff",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "0 1rem",
                height: "100%",
                fontSize: "inherit",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
              }}
            >
              {label}
            </button>
          ))}
        </NavMenu>
      </Nav>
    </div>
  );
};

export default Navbar;
