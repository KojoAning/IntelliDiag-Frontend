
import React from "react";

function Features() {
  return (
    <section
      style={{
        margin: "80px auto 0",
        minHeight: "809px",
        width: "90%",
        maxWidth: "1440px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        color: "#fff",
        zIndex: 5,
        position: "relative",
        gap: "clamp(40px, 6vw, 94px)",
        padding: "0 20px",
        boxSizing: "border-box"
      }}
    >
      {/* Features Badge - with stable dimensions */}
      <div
        style={{
          width: "100%",
          maxWidth: "1200px",
          padding: "10px 0"
        }}
      >
        <div
          style={{
            padding: "15px 25px",
            width: "fit-content",
            minWidth: "162px",
            background: "#0694FB",
            borderRadius: "28px",
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "center"
          }}
          aria-label="Our Features"
        >
          <h2
            style={{
              margin: 0,
              color: "white",
              fontSize: "clamp(18px, 2vw, 25px)",
              fontFamily: "SF Pro, sans-serif",
              fontWeight: "510",
              lineHeight: "1.2"
            }}
          >
            Our Features
          </h2>
        </div>
      </div>

      {/* Content Row - now responsive */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap-reverse",
          gap: "clamp(40px, 5vw, 92px)",
          justifyContent: "center",
          alignItems: "center",
          width: "100%"
        }}
      >
        {/* Image Placeholder - with aspect ratio */}
        <div
          style={{
            width: "min(100%, 454px)",
            aspectRatio: "1/1",
            borderRadius: "40px",
            background: "#0c0c0c",
            flexShrink: 0
          }}
          aria-hidden="true"
        ></div>

        {/* Text Content - with proper spacing */}
        <article
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            width: "min(100%, 871px)",
            maxWidth: "100%"
          }}
        >
          <h3
            style={{
              color: "#0694FB",
              fontSize: "clamp(20px, 2vw, 29px)",
              fontFamily: "SF Pro, sans-serif",
              fontWeight: "590",
              margin: "0 0 20px 0",
              lineHeight: "1.3"
            }}
          >
            Brain Tumor Analysis
          </h3>
          <p
            style={{
              fontSize: "clamp(16px, 1.5vw, 23px)",
              fontWeight: "400",
              color: "rgba(255, 255, 255, 0.77)",
              margin: 0,
              lineHeight: "1.6"
            }}
          >
            Brain Tumor Analysis with intelliDiag leverages advanced artificial
            intelligence and deep learning algorithms to assist clinicians in
            the early detection, localization, and classification of brain
            tumors from MRI scans. Our technology is trained on diverse,
            high-quality medical imaging datasets to ensure accurate
            differentiation between tumor types such as gliomas, meningiomas,
            and pituitary tumors.
          </p>
          <p
            style={{
              fontSize: "clamp(16px, 1.5vw, 23px)",
              fontWeight: "400",
              color: "rgba(255, 255, 255, 0.77)",
              margin: "20px 0 0",
              lineHeight: "1.6"
            }}
          >
            By providing automated, real-time analysis, Intellidiag reduces diagnostic delays and supports medical
            professionals in making faster and more informed treatment
            decisions. The system not only identifies tumor presence but also
            highlights affected regions, enabling precision in surgical planning
            and ongoing monitoring.
          </p>
        </article>
      </div>
    </section>
  );
}

export default Features;