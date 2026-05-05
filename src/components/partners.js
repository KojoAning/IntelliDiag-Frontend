"use client";
import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "../App.css";

gsap.registerPlugin(ScrollTrigger);

function Partners() {
  const containerRef = useRef(null);
  const boxRef = useRef(null);
  const boxRef2 = useRef(null);
  const boxRef3 = useRef(null);
  const boxRef4 = useRef(null);
  const endTextRef = useRef(null);

  useGSAP(() => {
    // Set initial container height and text scale
    gsap.set(containerRef.current, { height: "100vh" });
    gsap.set(endTextRef.current, { scale: 0.4, opacity: 0.0 }); // Start scaled down

    // Create master timeline
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: "500 center",
        end: "+=1000", // Longer scroll distance
        scrub: 1,
        pin: true,
        markers: false,
        onUpdate: (self) => {
          // Dynamically increase container height during scroll
          const newHeight = 100 + self.progress * 100; // 100vh to 200vh
          containerRef.current.style.height = `${newHeight}vh`;
        },
      },
    });

    // Box animations (all start at time 0)
    tl.to(
      boxRef.current,
      {
        scale: 0.8,
        duration: 1,
        rotation: 5,
      },
      0
    )
      .to(
        boxRef3.current,
        {
          scale: 0.8,
          rotation: 20,
          duration: 1,
        },
        0
      )
      .to(
        boxRef2.current,
        {
          scale: 0.8,
          rotation: -2,
          duration: 1,
        },
        0
      )
      .to(
        boxRef4.current,
        {
          scale: 0.8,
          rotation: -7,
          duration: 1,
        },
        0
      );

    tl.to(
      containerRef.current,
      {
        rowGap: "190px", // or any larger value
        duration: 1,
      },
      0 // sync with box scale animations
    );

    // End text SCALE animation (starts at 80% of timeline)
    tl.to(
      endTextRef.current,
      {
        opacity: 1,
        scale: 1, // Scale up to normal size
        duration: 1,
        ease: "back.out(1.7)", // Nice elastic bounce effect
      },
      0
    );
  }, []);

  return (
    <div
      style={{
        height: "2000px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        backgroundColor: "red", // optional page bg
        zIndex: 99,
      }}
    >
      <div
        ref={containerRef}
        style={{
          // marginTop: "80px",
          paddingBottom: "40px",
          height: "90vh",
          width: "100%",
          color: "#fff",
          zIndex: 5,
          position: "relative",
          // backgroundColor: "green",
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(400px, 400px))",
          gap: "30px",
          justifyContent: "center",
          alignContent: "center",
          overflow: "hidden",
        }}
      >
        <div
          ref={boxRef}
          style={{
            height: "270px",
            width: "100%",
            backgroundColor: "#FFFFFF",
            borderRadius: "30px",
            willChange: "transform",
          }}
        ></div>
        <div
          ref={boxRef2}
          style={{
            height: "270px",
            width: "100%",
            backgroundColor: "#FFFFFF",
            overflow: "hidden",
            borderRadius: "30px",
            willChange: "transform",
          }}
        >
          <img
            src="africa1.jpg"
            style={{
              height: "100%",
              width: "100%",
              objectFit: "cover",
              display: "block",
            }}
            alt="Africa"
          />
        </div>
        <div
          ref={boxRef3}
          style={{
            height: "270px",
            width: "100%",
            backgroundColor: "#FFFFFF",
            borderRadius: "30px",
            willChange: "transform",
            overflow: "hidden", // prevent overflow from rounded corners
            position: "relative",
          }}
        >
          <img
            src="africa1.jpg"
            style={{
              height: "100%",
              width: "100%",
              objectFit: "cover",
              display: "block",
            }}
            alt="Africa"
          />
        </div>
        <div
          ref={boxRef4}
          style={{
            height: "270px",
            width: "100%",
            overflow: "hidden",
            backgroundColor: "#FFFFFF",
            borderRadius: "30px",
            willChange: "transform, opacity",
          }}
        >
          <img
            src="africa1.jpg"
            style={{
              height: "100%",
              width: "100%",
              objectFit: "cover",
              display: "block",
            }}
            alt="Africa"
          />
        </div>

        {/* End text (initially scaled down) */}
        <div
          ref={endTextRef}
          style={{
            position: "absolute",
            top: "48%",
            left: "50%",

            transform: "translate(-50%, -50%) scale(0)", // Initial scale 0
            fontSize: "1.8rem",
            fontWeight: "400",
            textAlign: "center",
            width: "40%",
            willChange: "transform",
            transformOrigin: "center center",
          }}
        >
          A passionate group of innovators, engineers, and healthcare experts
          driven to transform diagnostics through AI-powered solutions.
        </div>
      </div>
    </div>
  );
}

export default Partners;
