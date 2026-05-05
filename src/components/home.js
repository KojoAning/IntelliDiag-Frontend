"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
  useIsPresent,
} from "framer-motion";
import { useNavigate } from "react-router-dom";
import styled, { createGlobalStyle } from "styled-components";

// Global styles for the overlay
const GlobalOverlayStyle = createGlobalStyle`
  body {
    overflow: ${(props) => (props.isOverlayOpen ? "hidden" : "auto")};
  }
`;

const HomepageContainer = styled.div`
  font-family: "SF Pro Display";
  min-height: 100vh;
  width: 100%;
  color: #fff;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    padding: 15px;
  }
`;

const HomepageContent = styled.div`
  width: 90%;
  max-width: 1216px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  z-index: 56;
  position: relative;
`;

const HomepageHeading = styled.h1`
  font-size: 32px;
  font-weight: 500;
  margin: 0;
  line-height: 1.2;

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    font-size: 28px;
    margin-bottom: 10px;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    font-size: 42px;
    margin-bottom: 0px;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    font-size: 52px;
    margin-bottom: 0px;
    width: 90%;
  }

  /* Desktops, large screens (1024px - 1200px) */
  @media (min-width: 1024px) and (max-width: 1200px) {
    font-size: 58px;
    margin-bottom: 0px;
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
    font-size: 62px;
  }
`;

const Highlight = styled.span`
  color: #0094ff;
`;

const HomepageSubcontent = styled.div`
  width: 100%;
  max-width: 545px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
`;

const HomepageSubheading = styled.h2`
  font-size: 14px;
  font-weight: 400;
  color: #9c9c9c;
  margin: 0;

  @media (min-width: 320px) and (max-width: 480px) {
    font-size: 16px;
    margin-top: 0;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    font-size: 22px;
    margin-bottom: 25px;
  }

  /* Small screens, laptops (769px - 1023px) */
  @media (min-width: 769px) and (max-width: 1023px) {
    font-size: 25px;
    margin-bottom: 25px;
    margin-top: 0;
  }

  /* Desktops, large screens (1023px - 1200px) */
  @media (min-width: 1023px) and (max-width: 1200px) {
    font-size: 22px;
    margin-bottom: 25px;
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
    font-size: 22px;
  }
`;

const HomepageButton = styled(motion.button)`
  height: 48px;
  width: 160px;
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
    width: 175px;
    font-size: 20px;
  }

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    height: 40px;
    width: 115px;
    font-size: 13px;
    border-radius: 9px;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    height: 55px;
    width: 180px;
    font-size: 19px;
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
    height: 58px;
    width: 182px;
    font-size: 20px;
  }
`;

const OverlayRoot = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  z-index: 1000;
`;

const OverlayContent = styled(motion.div)`
  backdrop-filter: blur(4px);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  z-index: 1001;
  will-change: opacity;
`;

const ModalContent = styled(motion.div)`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: space-between;
  text-align: left;
  padding: 30px;
  border-radius: 30px;
  color: #f5f5f5;
  will-change: transform;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(8px);
  width: 90%;
  max-width: 400px;

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    font-size: 35px;
    width: 70%;
    margin-bottom: 35px;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    // height: 52px;
    width: 50%;
    font-size: 18px;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    width: 384px;
    font-size: 19px;
  }

  // /* Desktops, large screens (1025px - 1200px) */
  // @media (min-width: 1025px) and (max-width: 1200px) {
  //   height: 58px;
  //   width: 182px;
  //   font-size: 20px;
  // }
`;

const ModalLogo = styled.img`
  margin-bottom: 10px;
  padding-right: 2px;
  align-self: center;

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    font-size: 35px;
    width: 140px;
    height: auto;
    margin-bottom: 25px;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    width: 120px;
    height: auto;
    margin-bottom: 25px;
  }
  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    height: auto;
    width: 170px;

    margin-bottom: 25px;
  }
`;

const ModalHeader = styled.header`
  display: flex;
  flex-direction: column;
  justify-content: left;
  align-items: center;
  margin-bottom: 10px;
  gap: 5px;
`;

const ModalTitle = styled.h2`
  font-size: 24px;
  margin: 0;
  font-weight: 500;

  @media (min-width: 320px) and (max-width: 480px) {
    font-size: 20px;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    font-size: 19px;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    font-size: 25px;
    margin-bottom: 5px;
  }
`;

const ModalSubtitle = styled.p`
  font-size: 16px;
  color: rgba(245, 245, 245, 0.75);
  margin: 0;
  text-align: center;
  width: 90%;

  @media (min-width: 320px) and (max-width: 480px) {
    font-size: 14px;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    font-size: 13px;
    width: 100%;
    font-weight: 400;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    font-size: 18px;
  }
`;

const ModalInputs = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 10px;
  margin: 20px 0;
  box-sizing: border-box;
  color: white;

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    font-size: 14px;
    width: 100%;
    height: 90px;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    font-size: 20px;
  }
`;

const ModalInput = styled.input`
  border: 1px solid rgba(255, 255, 255, 0.1);
  height: 50px;
  border-radius: 10px;
  padding-left: 12px;
  background-color: transparent;
  color: white;
  font-size: 16px;
  outline: none;
  box-sizing: border-box;
  width: 100%;

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    font-size: 20px;
    color: #fff;
  }
`;

const ModalControls = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 20px;
  width: 100%;
`;

const ModalButton = styled.button`
  background-color: #0694fb;
  color: #fff;
  border-radius: 10px;
  padding: 15px 23px;
  border: none;
  cursor: pointer;
  font-size: 16px;
  width: 100%;

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    height: 55px;
    font-size: 18px;
    margin-bottom: 10px;
  }
`;

const ModalFooterText = styled.p`
  font-size: 15px;
  display: none;

  @media (min-width: 320px) and (max-width: 480px) {
    font-size: 20px;
    display: none;
  }
`;

const GradientContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1001;
`;

const ExpandingCircle = styled(motion.div)`
  position: absolute;
  border-radius: 50%;
  background: rgba(0, 149, 255, 0.8);
  filter: blur(15px);
  transform-origin: center;
  will-change: transform;
`;

const GradientCircle = styled(motion.div)`
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  width: 200%;
  aspect-ratio: 1;
  will-change: transform;
`;

function Homepage() {
  const navigate = useNavigate();
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      setSize({
        width: ref.current?.clientWidth || 0,
        height: ref.current?.clientHeight || 0,
      });
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    return () => window.removeEventListener("resize", updateSize);
  }, [ref]);

  const handleButtonClick = () => {
    setIsOverlayOpen(true);
  };

  const closeOverlay = () => {
    setIsOverlayOpen(false);
  };

  return (
    <>
      <GlobalOverlayStyle isOverlayOpen={isOverlayOpen} />
      <HomepageContainer ref={ref}>
        <HomepageContent>
          <HomepageHeading>
            Revolutionizing <Highlight>Diagnosis</Highlight> with the help of
            Artificial Intelligence
          </HomepageHeading>

          <HomepageSubcontent>
            <HomepageSubheading>
              Empowering individuals and healthcare professionals with advanced
              diagnostic tools and personalized treatment plans
            </HomepageSubheading>

            <HomepageButton
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={handleButtonClick}
              aria-label="Get Started"
            >
              Get Started
            </HomepageButton>
          </HomepageSubcontent>
        </HomepageContent>

        <AnimatePresence>
          {isOverlayOpen ? (
            <ImmersiveOverlay close={closeOverlay} size={size} />
          ) : null}
        </AnimatePresence>
      </HomepageContainer>
    </>
  );
}

function GradientOverlay({ size }) {
  const breathe = useMotionValue(0);
  const isPresent = useIsPresent();

  useEffect(() => {
    if (!isPresent) {
      animate(breathe, 0, { duration: 0.5, ease: "easeInOut" });
    }

    async function playBreathingAnimation() {
      await animate(breathe, 1, {
        duration: 0.5,
        delay: 0.35,
        ease: [0, 0.55, 0.45, 1],
      });

      animate(breathe, [null, 0.7, 1], {
        duration: 15,
        repeat: Infinity,
        repeatType: "loop",
        ease: "easeInOut",
      });
    }

    playBreathingAnimation();
  }, [isPresent]);

  const enterDuration = 0.75;
  const exitDuration = 0.5;
  const expandingCircleRadius = size.width / 3;

  return (
    <GradientContainer>
      <ExpandingCircle
        initial={{
          scale: 0,
          opacity: 1,
          backgroundColor: "#0694FB",
        }}
        animate={{
          scale: 10,
          opacity: 0.2,
          backgroundColor: "rgb(34, 121, 179)",
          transition: {
            duration: enterDuration,
            opacity: { duration: enterDuration, ease: "easeInOut" },
          },
        }}
        exit={{
          scale: 0,
          opacity: 1,
          backgroundColor: "rgb(42, 164, 246)",
          transition: { duration: exitDuration },
        }}
        style={{
          left: `calc(50% - ${expandingCircleRadius / 2}px)`,
          top: "100%",
          width: expandingCircleRadius,
          height: expandingCircleRadius,
          originX: 0.5,
          originY: 1,
        }}
      />

      <GradientCircle
        className="top-left"
        initial={{ opacity: 0 }}
        animate={{
          opacity: 0.9,
          transition: { duration: enterDuration },
        }}
        exit={{
          opacity: 0,
          transition: { duration: exitDuration },
        }}
        style={{
          scale: breathe,
          width: size.width * 2,
          height: size.width * 2,
          top: -size.width,
          left: -size.width,
          background: "rgba(6, 148, 251, 0.7)",
        }}
      />

      <GradientCircle
        className="bottom-right"
        initial={{ opacity: 0 }}
        animate={{
          opacity: 0.9,
          transition: { duration: enterDuration },
        }}
        exit={{
          opacity: 0,
          transition: { duration: exitDuration },
        }}
        style={{
          scale: breathe,
          width: size.width * 2,
          height: size.width * 2,
          top: size.height - size.width,
          left: 0,
          background: "rgba(0, 147, 252, 0.73)",
        }}
      />
    </GradientContainer>
  );
}

function ImmersiveOverlay({ close, size }) {
  const transition = {
    duration: 0.35,
    ease: [0.59, 0, 0.35, 1],
  };

  const enteringState = {
    rotateX: 0,
    skewY: 0,
    scaleY: 1,
    scaleX: 1,
    y: 0,
    transition: {
      ...transition,
      y: { type: "spring", visualDuration: 0.7, bounce: 0.2 },
    },
  };

  const exitingState = {
    rotateX: -5,
    skewY: -1.5,
    scaleY: 2,
    scaleX: 0.4,
    y: 100,
  };

  return (
    <OverlayRoot onClick={close}>
      <GradientOverlay size={size} />
      <OverlayContent
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={transition}
      >
        <ModalContent
          onClick={(e) => e.stopPropagation()}
          initial={exitingState}
          animate={enteringState}
          exit={exitingState}
          transition={transition}
        >
          <ModalLogo
            src="intellidiag.png"
            alt="IntelliDiag Logo"
            height="36px"
          />

          <ModalHeader>
            <ModalTitle>Sign In to your account</ModalTitle>
            <ModalSubtitle>
              Sign in to access all the features and functions of our platform
            </ModalSubtitle>
          </ModalHeader>

          <ModalInputs>
            <ModalInput type="text" placeholder="Email" />

            <ModalInput type="password" placeholder="Password" />
          </ModalInputs>

          <ModalControls>
            <ModalButton onClick={close} className="confirm">
              Sign In
            </ModalButton>
            <ModalFooterText>Don't have an account? Sign up</ModalFooterText>
          </ModalControls>
        </ModalContent>
      </OverlayContent>
    </OverlayRoot>
  );
}

export default Homepage;
