import React from "react";
import { motion } from "framer-motion";
import styled from "styled-components";

const ReachContainer = styled.div`
  min-height: 60vh;
  width: 100%;
  display: flex;
  margin: 0;
  padding: 40px 20px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  z-index: 5;
  position: relative;
  box-sizing: border-box;

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    min-height: 80vh;
    padding: 30px 15px;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    min-height: 50vh;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    min-height: 60vh;
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
    margn-bottom: 60px;
  }
`;

const LogoContainer = styled.div`
  margin-bottom: clamp(20px, 4vw, 40px);
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Logo = styled.img`
  height: 100%;
  width: auto;
  max-width: 100%;

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    height: 25px;
    width: auto;
  }
`;

const MainHeading = styled.h1`
  width: min(100%, 696px);
  font-size: clamp(28px, 5vw, 50px);
  font-weight: 500;
  text-align: center;
  line-height: 1.3;
  margin: 0 0 clamp(20px, 4vw, 40px) 0;

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    font-size: 28px;
    width: 320px;
    line-height: 1.4;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    font-size: 42px;
    max-width: 70%;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    font-size: 52px;
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
    font-size: 62px;
  }

  br {
    /* Hide line break on mobile */
    @media (max-width: 768px) {
      display: none;
    }
  }
`;

const Highlight = styled.span`
  color: #21a2ff;
`;

const ActionButton = styled(motion.button)`
  height: 48px;
  // width: 160px;
  background-color: #0694fb;
  border-radius: 13px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 16px;
  cursor: pointer;
  border: none;
  color: #fff;
  padding: 0 20px;

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    height: 56px;
    // width: 175px;
    font-size: 20px;
    margin-bottom: 10px;
  }

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    height: 40px;
    padding: 0px 20px;
    font-size: 13px;
    border-radius: 9px;
    margin-bottom: 10px;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    height: 55px;
    // width: 180px;
    font-size: 19px;
    margin-bottom: 10px;
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
    height: 58px;
    // width: 182px;
    font-size: 20px;
    margin-bottom: 20px;
  }

    @media (min-width: 1201px) {
    font-size: 20px;
    margin-bottom: 20px;
  }
`;

function Reach() {
  return (
    <ReachContainer>
      {/* Logo Container */}
      <LogoContainer>
        <Logo src="intellidiag.png" alt="IntelliDiag Logo" />
      </LogoContainer>

      {/* Main Heading */}
      <MainHeading>
        <Highlight>Smarter</Highlight> diagnostics,{" "}
        <Highlight>seamlessly</Highlight> integrated & <br />
        visually tailored to empower care.
      </MainHeading>

      {/* Button */}
      <ActionButton
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        For business
      </ActionButton>
      <ActionButton
        style={{
          backgroundColor: "transparent",
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        For researchers
      </ActionButton>
    </ReachContainer>
  );
}

export default Reach;
