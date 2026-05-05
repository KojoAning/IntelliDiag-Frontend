"use client";
import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "../App.css";

function Others() {
  const containerRef = useRef();
  const swipeThroughRef = useRef();
  const componentsRef = useRef([]);
  const descsRef = useRef([]);

  gsap.registerPlugin(ScrollTrigger, useGSAP);

  useGSAP(
    () => {
      const componentWidth = 850;
      const gap = 100;
      const totalScrollDistance =
        (componentWidth + gap) * (componentsRef.current.length - 1);
      const centerOffset = (window.innerWidth - componentWidth) / 2;

      // Set initial position to show first component centered
      gsap.set(swipeThroughRef.current, {
        x: centerOffset,
      });

      // Create timeline with snapping
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          pin: true,
          scrub: 0.5,
          snap: {
            snapTo: (value) => {
              const snapPoint = Math.round(
                value * (componentsRef.current.length - 1)
              );
              return snapPoint / (componentsRef.current.length - 1);
            },
            duration: { min: 0.3, max: 0.8 },
            ease: "power3.out",
          },
          end: () => `+=${totalScrollDistance}`,
          invalidateOnRefresh: true,
        },
      });

      // Animate through components
      tl.to(swipeThroughRef.current, {
        x: centerOffset - totalScrollDistance,
        ease: "none",
        onUpdate: () => {
          // Get current scroll position
          const x = gsap.getProperty(swipeThroughRef.current, "x");

          // Update opacity for all components based on their position
          componentsRef.current.forEach((comp, i) => {
            const compX = centerOffset - i * (componentWidth + gap);
            const distanceFromCenter = Math.abs(Number(x) - compX);
            const opacity = gsap.utils.clamp(
              0.3,
              1,
              1 - distanceFromCenter / (componentWidth * 0.75)
            );
            const scale = gsap.utils.clamp(
              0.65,
              1,
              1 - distanceFromCenter / (componentWidth * 1.5)
            );

            gsap.to(comp, {
              opacity: opacity,
              scale: scale,
              duration: 0.1,
            });
          });
        },
      });

      // Description animations
      componentsRef.current.forEach((comp, i) => {
        gsap.from(descsRef.current[i], {
          opacity: 0,
          y: 30,
          duration: 0.6,
          delay: 0.3,
          scrollTrigger: {
            trigger: comp,
            containerAnimation: tl,
            start: "left center",
            end: "right center",
            toggleActions: "play none none none",
          },
        });
      });
    },
    { scope: containerRef }
  );

  const addToRefs = (el, refArray) => {
    if (el && !refArray.current.includes(el)) {
      refArray.current.push(el);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        marginTop: "100px",
        marginBottom: "100px",
        height: "80vh",
        display: "flex",
        flexDirection: "column",
        // padding: "40px",
        alignItems: "center",
        color: "#fff",
        zIndex: 5,
        position: "relative",
        borderRadius: "30px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontSize: "60px",
          fontWeight: 500,
          marginTop: "150px",
          textAlign: "center",
          width: "800px",
        }}
      >
        We believe diagnosis could be made
      </div>

      <div
        style={{
          width: "100%",
          overflow: "hidden",
          position: "relative",
          height: "60vh",
        }}
      >
        <div
          ref={swipeThroughRef}
          style={{
            display: "flex",
            position: "absolute",
            height: "100%",
            alignItems: "center",
            gap: "100px",
            left: 0,
          }}
        >
          {["Faster", "Easier", "Accessible"].map((word, i) => (
            <div
              key={i}
              ref={(el) => addToRefs(el, componentsRef)}
              style={{
                width: "800px",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "0 20px",
                willChange: "transform, opacity",
              }}
            >
              <div
                style={{
                  fontSize: "120px",
                  fontWeight: 500,
                  color: "#0694FB",
                //   marginBottom: "40px",
                }}
              >
                {word}
              </div>
              <div
                style={{
           
                  fontWeight: 400,
                  color: "#9C9C9C",
                  textAlign: "center",
                  height: "5px",
                  width: "80px",
                  background:
                    "linear-gradient(90deg, rgba(1, 72, 99, 0.17) 0%, rgba(20, 157, 255, 1) 100%)",
                }}
              ></div>
              <div
                ref={(el) => addToRefs(el, descsRef)}
                style={{
                  fontSize: "20px",
                  fontWeight: 400,
                  color: "#9C9C9C",
                  width: "600px",
                  textAlign: "center",
                }}
              >
                Brain Tumor Analysis with intelliDiag leverages advanced
                artificial intelligence and deep learning algorithms to assist
                clinicians...
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Others;
