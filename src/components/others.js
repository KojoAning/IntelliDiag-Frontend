"use client";
import React, { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styled from "styled-components";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Styled components
const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  color: #fff;
  z-index: 5;
  position: relative;
  overflow: hidden;
  padding: 40px 0;
  box-sizing: border-box;
  margin-bottom: 60px;
  // background-color: green;

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    margin-top: 0px;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
  }
`;

const Heading = styled.div`
  font-size: 60px;
  font-weight: 500;
  // margin-bottom: 2vh;
  text-align: center;
  max-width: 60%;
  width: 100%;

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    font-size: 28px;
    margin-top: 100px;
    max-width: 85%;
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
    font-size: 48px;
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
    font-size: 62px;
  }
`;

const Highlight = styled.span`
  color: #0094ff;
`;

const SwipeContainer = styled.div`
  width: 100%;
  overflow: hidden;
  position: relative;
  height: 50vh;
  display: flex;
  align-items: center;

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    // height: 300px;
  }
`;

const SwipeContent = styled.div`
  display: flex;
  position: absolute;
  height: 100%;
  align-items: center;
  gap: 100px;
  left: 10px;

  @media (max-width: 1200px) {
    gap: 80px;
  }

  @media (max-width: 768px) {
    gap: 40px;
  }

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    align-items: center;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
  }
`;

const SwipeItem = styled.div`
  width: 800px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  will-change: transform, opacity;
  // background-color: red;

  @media (max-width: 1200px) {
    width: 600px;
  }

  @media (max-width: 768px) {
    width: calc(100vw - 40px);
  }
`;

const ItemTitle = styled.div`
  font-size: 120px;
  font-weight: 500;
  color: #0694fb;
  text-align: center;

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    font-size: 48px;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    font-size: 80px;
    margin: 0;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    font-size: 95px;
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
    font-size: 100px;
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
  }
`;

const Subheading = styled.h2`
  font-size: 14px;
  font-weight: 400;
  color: #9c9c9c;
  text-align: center;

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
  }
`;

const Divider = styled.div`
  height: 3px;
  width: 80px;
  margin: 20px 0;
  border-radius: 20px;
  background: linear-gradient(
    90deg,
    rgba(1, 72, 99, 0.17) 0%,
    rgba(20, 157, 255, 1) 100%
  );
`;

const Description = styled.div`
  font-size: 20px;
  font-weight: 400;
  color: #9c9c9c;
  text-align: center;
  max-width: 700px;
  width: 100%;
  opacity: 1;

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    font-size: 16px;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    font-size: 20px;
    max-width: 90%;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    font-size: 23px;
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
    font-size: 18px;
    max-width: 600px;
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
  }
`;

function Others() {
  const containerRef = useRef();
  const swipeThroughRef = useRef();
  const componentsRef = useRef([]);
  const descsRef = useRef([]);
  const [dimensions, setDimensions] = useState({
    componentWidth: 800,
    gap: 100,
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setDimensions({
        componentWidth: width > 1200 ? 800 : width > 768 ? 600 : width - 40,
        gap: width > 1200 ? 100 : width > 768 ? 80 : 40,
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useGSAP(() => {
    const { componentWidth, gap } = dimensions;
    const totalScrollDistance =
      (componentWidth + gap) * (componentsRef.current.length - 1);
    const centerOffset = (window.innerWidth - componentWidth) / 2.08;

    // Reset and reinitialize animations
    ScrollTrigger.getAll().forEach((t) => t.kill());
    gsap.set(swipeThroughRef.current, { x: centerOffset });

    if (ScrollTrigger.isTouch === 1) {
      // Enable normalizeScroll only on touch devices
      ScrollTrigger.normalizeScroll(true);

      //    ScrollTrigger.config({
      //   // limitCallbacks: true,
      //   ignoreMobileResize: true,
      // });
    }

    ScrollTrigger.config({
      // limitCallbacks: true,
      ignoreMobileResize: true,
    });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        pin: true,
        // markers: true,
        scrub: 0.5,
        start: "bottom bottom",
        snap: {
          snapTo: (value) => {
            const snapPoint = Math.round(
              value * (componentsRef.current.length - 1)
            );
            return snapPoint / (componentsRef.current.length - 1);
          },
          duration: { min: 0.2, max: 0.5 },
          ease: "power3.out",
        },
        end: () => `+=1500`,
        invalidateOnRefresh: true,
      },
    });

    tl.to(swipeThroughRef.current, {
      x: centerOffset - totalScrollDistance,
      ease: "none",
      onUpdate: () => {
        const x = gsap.getProperty(swipeThroughRef.current, "x");
        componentsRef.current.forEach((comp, i) => {
          const compX = centerOffset - i * (componentWidth + gap);
          const distanceFromCenter = Math.abs(Number(x) - compX);
          const opacity = gsap.utils.clamp(
            0.1,
            1,
            1 - distanceFromCenter / (componentWidth * 0.75)
          );
          const scale = gsap.utils.clamp(
            0.65,
            1,
            1 - distanceFromCenter / (componentWidth * 1.5)
          );

          gsap.to(comp, {
            opacity,
            scale,
            duration: 0.1,
          });
        });
      },
    });

    // Initialize descriptions as visible
    gsap.set(descsRef.current, { opacity: 1 });

    // Add subtle animation to descriptions when they come into view
    componentsRef.current.forEach((comp, i) => {
      gsap.from(descsRef.current[i], {
        y: 30,
        duration: 0.6,
        scrollTrigger: {
          trigger: comp,
          containerAnimation: tl,
          start: "left center",
          end: "right center",
          toggleActions: "play none none none",
        },
      });
    });
  }, [dimensions]);

  const addToRefs = (el, refArray) => {
    if (el && !refArray.current.includes(el)) {
      refArray.current.push(el);
    }
  };

  return (
    <Container ref={containerRef}>
      <Heading>
        <Highlight>intelliDiag</Highlight>, is redefining diagnostic
        intelligence
      </Heading>
      <Subheading>
        That’s why we focus on making the diagnostic process not just more
        efficient, but genuinely
      </Subheading>

      <SwipeContainer>
        <SwipeContent ref={swipeThroughRef}>
          {[
            {
              title: "Faster",
              description:
                "By harnessing the power of AI and intelligent imaging, we're redefining what's possible in medical diagnostics. Our technology accelerates the diagnostic process while improving accuracy, empowering healthcare professionals to make timely, confident decisions that can lead to better outcomes for patients when every second counts.",
            },
            {
              title: "Easier",
              description:
                "With an intuitive interface and intelligent automation, we simplify the diagnostic workflow from end to end. Our system handles complex image analysis seamlessly, reducing the cognitive burden on healthcare professionals and allowing them to focus on what matters most by delivering quality care with greater efficiency and confidence",
            },
            {
              title: "Accessible",
              description:
                "Breaking down barriers to quality healthcare, our platform works seamlessly across devices and locations. Whether in urban hospitals or remote clinics, healthcare providers can access advanced diagnostic capabilities, ensuring consistent care quality everywhere.",
            },
          ].map((item, i) => (
            <SwipeItem
              key={i}
              ref={(el) => addToRefs(el, componentsRef)}
              style={{ width: `${dimensions.componentWidth}px` }}
            >
              <ItemTitle>{item.title}</ItemTitle>
              <Divider />
              <Description ref={(el) => addToRefs(el, descsRef)}>
                {item.description}
              </Description>
            </SwipeItem>
          ))}
        </SwipeContent>
      </SwipeContainer>
    </Container>
  );
}

export default Others;
