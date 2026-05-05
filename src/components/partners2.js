import React from "react";
import { motion } from "framer-motion";
import styled from "styled-components";

const PartnersContainer = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  z-index: 5;
  position: relative;
  // background-color: red;
  padding: 40px 20px;
  box-sizing: border-box;

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    padding: 30px 15px;
    margin-bottom: 100px;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    gap: 20px;
    margin-bottom: 150px;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    padding: 50px 70px;
    min-height: 54vh;
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
    margin-bottom: 150px;
  }
`;

const PartnersHeading = styled.h1`
  width: 90%;
  max-width: 636px;
  font-size: 32px;
  font-weight: 500;
  text-align: center;
  line-height: 1.2;
  margin-bottom: 0px;

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    font-size: 28px;
    width: 260px;
    // margin-bottom: 35px;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    font-size: 42px;
    max-width: 70%;
    margin-bottom: 0px;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    font-size: 52px;
    width: 70%;
    margin-bottom: 20px;
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
    font-size: 50px;
    margin-bottom: 35px;
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
    font-size: 62px;
    margin-bottom: 10px;
  }
`;

const Highlight = styled.span`
  color: #0094ff;
`;

const PartnersGrid = styled(motion.div)`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 15px;
  margin-top: 40px;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 1400px;

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    gap: 45px;
  }

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    gap: 20px;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    gap: 20px;
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
  }
`;

const PartnerCard = styled(motion.div)`
  overflow: hidden;
  height: 200px;
  // width: 4vw;

  border-radius: 15px;
  background-color: rgb(28, 28, 28);
  position: relative;
  // flex: 1 1 300px;

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    height: 190px;
    width: 60%;
    min-width: 50%;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    height: 250px;
    width: 270px;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    height: 260px;
    width: 270px;
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
    height: 280px;
    width: calc(33.333% - 20px);
    min-width: calc(33.333% - 20px);
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
    height: 297px;
    width: 20rem;
    min-width: 20rem;
  }
`;

const Subheading = styled.h2`
  font-size: 14px;
  font-weight: 400;
  color: #9c9c9c;
  text-align: center;
  margin: 0px;

  @media (min-width: 320px) and (max-width: 480px) {
    font-size: 16px;
    margin-top: 10px;
    width: 80%;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    font-size: 22px;
    width: 80%;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    font-size: 25px;
    width: 80%;
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
    font-size: 25px;
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
    font-size: 22px;
    width: 50%;
    margin-bottom: 20px;
  }
`;

const PartnerLogo = styled.img`
  height: 100%;
  width: 100%;
  object-fit: cover;
  object-position: center;
`;

const PartnerOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 148, 255, 0.1);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;

  ${PartnerCard}:hover & {
    opacity: 1;
  }

  @media (hover: none) {
    display: none;
  }
`;
const isDesktop = window.innerWidth >= 768;

function Partners2() {
  return (
    <PartnersContainer>
      {/* Heading */}
      <PartnersHeading>
        Strategic and support partners for <Highlight>intelliDiag</Highlight>
      </PartnersHeading>
      <Subheading>
        We are proud to collaborate with organizations that share our vision of
        transforming diagnostics through innovation, accessibility, and
        technology
      </Subheading>

      {/* Partners Grid */}
      <PartnersGrid
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: isDesktop ? 0.1 : 0,
              delayChildren: isDesktop ? 0.3 : 0,
            },
          },
        }}
      >
        {["mastercard2.png", "h2i.png", "afc.png"].map((logo, index) => (
          <PartnerCard
            key={index}
            whileHover={{
              scale: isDesktop ? 1.05 : 1.015,
              border: "2px solid rgba(0, 149, 255, 0.4)",
              zIndex: 10,
            }}
            whileTap={{ scale: isDesktop ? 0.98 : null }}
            transition={{
              type: isDesktop ? "spring" : "",
              stiffness: isDesktop ? 300 : 0,
              damping: isDesktop ? 15 : 0,
            }}
          >
            <PartnerLogo
              src={logo}
              alt={`Partner logo ${index + 1}`}
              loading="lazy"
            />
            <PartnerOverlay />
          </PartnerCard>
        ))}
      </PartnersGrid>
    </PartnersContainer>
  );
}

export default Partners2;
