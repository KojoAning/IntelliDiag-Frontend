import styled from "styled-components";
import { NavLink as Link } from "react-router-dom";

export const Nav = styled.nav`
  height: 70px;
  display: flex;
  justify-content: space-between;
  //   align-items: center;
  // padding-right: 400px;
  padding-left: 0px;
  z-index: 5;
  position: fixed;
  width: 98%;
  margin-right: "50px";
  top: 0;
`;

export const NavLink = styled(Link)`
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  padding: 0 1rem;
  height: 100%;
  justify-content: center;
  position: relative;
  cursor: pointer;

  &::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 4px;
    border-radius: 10px;
    background: #0694fb;
    transition: width 0.3s ease;
  }

  &.active::after {
    width: 100%;
  }
`;
export const Bars = styled.div`
  display: none;
`;

export const NavMenu = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  // width: 400px; /* Full width of parent */
  background-color:red

  padding: 0 2rem; /* Optional: side spacing */
  gap: 70px; /* Optional: spacing between child items */
  margin-right:40px;
  @media screen and (max-width: 760px) {
    display: none;
  }
`;

export const NavBtn = styled.nav`
  display: flex;
  align-items: center;
  margin-right: 24px;

  @media screen and (max-width: 768px) {
    display: none;
  }
`;

export const NavBtnLink = styled(Link)`
  border-radus: 4px;
`;
