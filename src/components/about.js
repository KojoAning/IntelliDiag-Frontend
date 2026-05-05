import React, { useEffect, useRef } from "react";
import { motion, useAnimation, useInView } from "framer-motion";
import styled from "styled-components";

const AboutContainer = styled.div`
  min-height: 96vh;
  color: #fff;
  z-index: 5;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  box-sizing: border-box;
  overflow: hidden;
  margin-bottom: 40px;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const AboutContent = styled(motion.div)`
  z-index: 56;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 80%;
  max-width: 1261px;
  gap: 1.4rem;
  padding: 0 1rem;

  @media (max-width: 768px) {
    padding: 0;
  }
`;

const AboutHeading = styled(motion.h1)`
  font-size: 32px;
  font-weight: 500;
  text-align: center;
  line-height: 1.2;
  margin-bottom: 20px;

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    font-size: 28px;
    width: 280px;
    margin-bottom: 20px;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    font-size: 42px;
    margin: 0px;
    width: 100%;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    font-size: 52px;
    margin-bottom: 0px;
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

const AboutSubheading = styled(motion.p)`
  width: 100%;
  max-width: 65rem;
  font-size: clamp(1rem, 1.2vw, 1.2rem);
  font-weight: 400;
  color: #9c9c9c;

  @media (min-width: 320px) and (max-width: 480px) {
    font-size: 16px;
    margin-top: 0;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    font-size: 19px;
    margin-bottom: 10px;
    margin-top: 0px;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    font-size: 25px;
    margin-bottom: 30px;
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
    font-size: 20px;
    margin-bottom: 35px;
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
    font-size: 22px;
    margin-top: 0px;
    margin-bottom: 40px;
  }
`;

const AboutCardsContainer = styled(motion.div)`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1.2rem;
  margin-top: 1.5rem;
  width: 100%;
`;

const AboutCard = styled(motion.div)`
  height: auto;
  // max-width: 20rem;
  border-radius: 15px;
  background-color: #0f0f0f;
  overflow: hidden;
  flex: 1 1 300px;

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    height: 18rem;
    max-width: 75%;
    width: 15rem;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    gap: 20px;
    flex: 1 1 200px;
    max-width: 290px;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    flex: 1 1 290px;
    height: 400px;
    max-width: 310px;
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
    height: auto;
    width: 100px;
    flex: 1 1 200px;
  }
`;

const AboutCardImage = styled.img`
  height: 100%;
  width: 100%;
  object-fit: cover;
  display: block;
  object-position: center;
`;

const isDesktop = window.innerWidth >= 768;

function About() {
  const controls = useAnimation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }
  }, [isInView, controls]);

  return (
    <AboutContainer ref={ref}>
      <AboutContent
        initial="hidden"
        animate={controls}
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.2, delayChildren: 0.3 },
          },
        }}
      >
        <AboutHeading
          variants={{
            hidden: { opacity: 0, y: 40 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.8, ease: [0.2, 0.65, 0.3, 0.9] },
            },
          }}
        >
          We dreamed of better diagnostics, so we built{" "}
          <Highlight>intelliDiag</Highlight> for everyone.
        </AboutHeading>

        <AboutSubheading
          variants={{
            hidden: { opacity: 0, x: -30 },
            visible: {
              opacity: 1,
              x: 0,
              transition: { duration: 0.7, ease: "backOut", delay: 0.5 },
            },
          }}
        >
          Built by award-winning medical researchers, engineers and developers,
          IntelliDiag gives you access to the tools, models, and methods behind
          our breakthrough diagnostic platform. Analyze, adapt, and expand.
          whether you're a researcher, developer, or healthcare provider.
        </AboutSubheading>

        <AboutCardsContainer
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: isDesktop ? 0.1 : 0,
                delayChildren: 0.3,
              },
            },
          }}
        >
          {[1, 2, 3].map((item) => (
            <AboutCard
              key={item}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
              whileHover={{ scale: isDesktop ? 1.05 : 1.015 }}
              transition={{ type: isDesktop ? "spring" : "", stiffness: 400 }}
            >
              <AboutCardImage src={`card${item}.webp`} alt="Diagnostic tools" />
            </AboutCard>
          ))}
        </AboutCardsContainer>
      </AboutContent>
    </AboutContainer>
  );
}

export default About;
