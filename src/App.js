import "./App.css";
import React, { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Navbar from "./components/navbar/Navbar";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Homepage from "./components/home";
import About from "./components/about";
import Partners from "./components/partners";
import Reach from "./components/reach_us";
import Footer from "./components/navbar/footer";
import Features from "./components/features";

import PrivacyPolicy from "./components/PrivacyPolicy";
import Others from "./components/others";
import Partners2 from "./components/partners2";
import Dashboard from "./components/homepage/Dashboard";
import CaseDashboard from "./components/homepage/casedashboard/CaseDashboard";
import WorkspaceViewer from "./components/homepage/casedashboard/WorkspaceViewer";
import CasesPage from "./components/homepage/casespage/CasesPage";
import NewCaseFlow from "./components/homepage/newcase/NewCaseFlow";
import CalendarPage from "./components/homepage/calendar/CalendarPage";
import PatientDetailsPage from "./components/homepage/patientdetails/PatientDetailsPage";
import SettingsPage from "./components/homepage/settings/SettingsPage";
import JobsPage from "./components/homepage/jobs/JobsPage";
import ReportsPage from "./components/homepage/casedashboard/reports/ReportsPage";
import ModelsPage from "./components/homepage/models/ModelsPage";
import ReportTemplateEditor from "./components/homepage/reporttemplates/ReportTemplateEditor";
import ReportViewer from "./components/homepage/casedashboard/reports/ReportViewer";
import Appbar from "./components/homepage/appbar/appbar";
import Sidebar from "./components/homepage/sidebar/Sidebar";

gsap.registerPlugin(ScrollTrigger);

const TOTAL_FRAMES = 298;

function App() {
  const canvasRef = useRef(null);
  const loadingRef = useRef(null);
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Preload all images with proper error handling
  useEffect(() => {
    let isMounted = true;
    const frameImages = [];
    const loadPromises = [];

    for (let i = 220; i <= 500; i++) {
      const img = new Image();
      img.src = `/frames/intellidiag${String(i).padStart(4, "0")}.webp`;
      img.loading = "eager";
      frameImages.push(img);

      loadPromises.push(
        new Promise((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve(); // Continue even if an image fails
        })
      );
    }

    Promise.all(loadPromises).then(() => {
      if (isMounted) {
        setImages(frameImages);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      frameImages.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
    };
  }, []);

  // Disable scroll while loading and fade out loading screen
  useEffect(() => {
    if (isLoading) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
      if (loadingRef.current) {
        gsap.to(loadingRef.current, {
          opacity: 0,
          duration: 0.5,
          ease: "power2.out",
          onComplete: () => {
            if (loadingRef.current) {
              loadingRef.current.style.display = "none";
            }
            // Force ScrollTrigger refresh after loading
            ScrollTrigger.refresh();
          },
        });
      }
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isLoading]);

  // Canvas setup and animation
  useEffect(() => {
    if (isLoading || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const baseWidth = 1280;
    const baseHeight = 720;

    canvas.width = baseWidth;
    canvas.height = baseHeight;
    context.fillStyle = "#000000";
    context.fillRect(0, 0, baseWidth, baseHeight);

    // Add transform and will-change for Safari performance
    canvas.style.transform = "translateZ(0)";
    canvas.style.willChange = "transform";

    const frameState = { frame: 0 };

    const render = () => {
      const img = images[Math.floor(frameState.frame)];

      if (!img?.complete) {
        context.fillStyle = "#000000";
        context.fillRect(0, 0, baseWidth, baseHeight);
        return;
      }

      const scale = Math.max(
        window.innerWidth / baseWidth,
        window.innerHeight / baseHeight
      );
      const displayWidth = baseWidth * scale;
      const displayHeight = baseHeight * scale;

      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      canvas.style.left = `${(window.innerWidth - displayWidth) / 2}px`;
      canvas.style.top = `${(window.innerHeight - displayHeight) / 2}px`;

      context.clearRect(0, 0, baseWidth, baseHeight);
      context.drawImage(img, 0, 0, baseWidth, baseHeight);
    };

    const forceRender = () => {
      requestAnimationFrame(() => {
        render();
        setTimeout(render, 100);
      });
    };

    const animation = gsap.to(frameState, {
      frame: TOTAL_FRAMES - 1,
      snap: "frame",
      ease: "none",
      scrollTrigger: {
        start: "top top",
        end: "7000px",
        scrub: true,
        invalidateOnRefresh: true, // Recalculate on resize/load
      },
      onUpdate: render,
      force3D: true, // Enable hardware acceleration
    });

    const handleLoad = () => {
      forceRender();
      setTimeout(() => {
        forceRender();
        ScrollTrigger.refresh(); // Ensure ScrollTrigger recalculates
      }, 300);
    };

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

    window.addEventListener("load", handleLoad);
    window.addEventListener("resize", () => {
      render();
      ScrollTrigger.refresh(); // Refresh on resize
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        forceRender();
        ScrollTrigger.refresh(); // Refresh on tab visibility
      }
    });

    forceRender();

    return () => {
      animation.kill();
      window.removeEventListener("load", handleLoad);
      window.removeEventListener("resize", render);
      document.removeEventListener("visibilitychange", forceRender);
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, [images, isLoading]);

  return (
    <div
      style={{
        backgroundColor: "black",
        width: "100%",
      }}
    >
      {/* Loading Screen */}
      <div
        ref={loadingRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100vh",
          backgroundColor: "black",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          opacity: 1,
          transition: "opacity 0.5s ease-out",
        }}
      >
        <div
          style={{
            border: "4px solid #f3f3f3",
            borderTop: "4px solid #3498db",
            borderRadius: "50%",
            width: "40px",
            height: "40px",
            animation: "spin 1s linear infinite",
          }}
        ></div>
        <p style={{ color: "white", marginTop: "16px", fontSize: "18px" }}>
          Loading...
        </p>
      </div>

      {/* CSS for spinner animation */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          /* Ensure no smooth scroll in Safari */
          html {
            scroll-behavior: auto !important;
          }
        `}
      </style>

      <Router>
        <Routes>
          <Route
            path="/"
            element={
              <div style={{ position: "relative" }}>
                <canvas
                  width="100vw"
                  height="100vh"
                  ref={canvasRef}
                  style={{
                    position: "fixed",
                    backgroundColor: "#000000",
                    zIndex: 1,
                    visibility: isLoading ? "hidden" : "visible",
                    transform: "translateZ(0)", // Force hardware acceleration
                    willChange: "transform", // Optimize rendering
                  }}
                />
                <div
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "6000px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0, 0, 0, 0.79)",
                    zIndex: 2,
                    pointerEvents: "none",
                  }}
                />
                <div style={{ zIndex: 3 }}>
                  <div id="home"><Homepage /></div>
                  <div id="about"><About /></div>
                  <div id="features"><Others /></div>
                  <Partners2 />
                  <div id="contact"><Reach /></div>
                  <Footer />
                </div>
                <Navbar />
              </div>
            }
          />
          <Route
            path="/dashboard"
            element={
              <>
                <Dashboard />
              </>
            }
          />
          <Route path="/new-case" element={<NewCaseFlow />} />
          <Route path="/case-workspace" element={<CaseDashboard />} />
          <Route path="/case-workspace/viewer" element={<WorkspaceViewer />} />
          <Route path="/cases" element={
            <div className="m-0 p-0 h-screen bg-black w-screen">
              <div className="flex flex-col px-[33px] py-[28px] w-full h-screen box-border overflow-hidden">
                <Appbar />
                <div className="w-full flex flex-row gap-[30px] box-border mt-[30px] flex-1 min-h-0">
                  <Sidebar activePage="Cases" />
                  <CasesPage />
                </div>
              </div>
            </div>
          } />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/cases/:id" element={<PatientDetailsPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/jobs" element={
            <div className="m-0 p-0 h-screen bg-black w-screen">
              <div className="flex flex-col px-[33px] py-[28px] w-full h-screen box-border overflow-hidden">
                <Appbar />
                <div className="w-full flex flex-row gap-[30px] box-border mt-[30px] flex-1 min-h-0">
                  <Sidebar activePage="Jobs" />
                  <JobsPage />
                </div>
              </div>
            </div>
          } />
          <Route path="/patient-reports" element={
            <div className="m-0 p-0 h-screen bg-black w-screen">
              <div className="flex flex-col px-[33px] py-[28px] w-full h-screen box-border overflow-hidden">
                <Appbar />
                <div className="w-full flex flex-row gap-[30px] box-border mt-[30px] flex-1 min-h-0">
                  <Sidebar activePage="Patient Reports" />
                  <ReportsPage />
                </div>
              </div>
            </div>
          } />
          <Route path="/patient-reports/:id" element={
            <div className="m-0 p-0 h-screen bg-black w-screen">
              <div className="flex flex-col px-[33px] py-[28px] w-full h-screen box-border overflow-hidden">
                <Appbar />
                <div className="w-full flex flex-row box-border mt-[15px] flex-1 min-h-0">
                  <ReportViewer />
                </div>
              </div>
            </div>
          } />
          <Route path="/models" element={
            <div className="m-0 p-0 h-screen bg-black w-screen">
              <div className="flex flex-col px-[33px] py-[28px] w-full h-screen box-border overflow-hidden">
                <Appbar />
                <div className="w-full flex flex-row gap-[30px] box-border mt-[30px] flex-1 min-h-0">
                  <Sidebar activePage="Models" />
                  <ModelsPage />
                </div>
              </div>
            </div>
          } />
          <Route path="/settings" element={
            <div className="m-0 p-0 h-screen bg-black w-screen">
              <div className="flex flex-col px-[33px] py-[28px] w-full h-screen box-border overflow-hidden">
                <Appbar />
                <div className="w-full flex flex-row gap-[30px] box-border mt-[30px] flex-1 min-h-0">
                  <Sidebar activePage="Settings" />
                  <SettingsPage />
                </div>
              </div>
            </div>
          } />
          <Route path="/report-templates" element={
            <div className="m-0 p-0 h-screen bg-black w-screen">
              <div className="flex flex-col px-[33px] py-[28px] w-full h-screen box-border overflow-hidden">
                <Appbar />
                <div className="w-full flex flex-row gap-[30px] box-border mt-[30px] flex-1 min-h-0">
                  <Sidebar activePage="Report Templates" />
                  <ReportTemplateEditor />
                </div>
              </div>
            </div>
          } />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
