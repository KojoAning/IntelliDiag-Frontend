"use client";
import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
  useIsPresent,
} from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import { FiX } from "react-icons/fi";
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
    font-size: 16px;
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
  background: radial-gradient(ellipse at 50% 40%, rgba(6, 148, 251, 0.18) 0%, rgba(0, 0, 0, 0.72) 65%);
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
  max-height: 90vh;
  overflow-y: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

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
  background-color: rgba(255, 255, 255, 0.05);
  color: white;
  font-size: 16px;
  outline: none;
  box-sizing: border-box;
  width: 100%;

  caret-color: #0694fb;

  &::selection {
    background: rgba(6, 148, 251, 0.5);
    color: #fff;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
    font-size: 16px;
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
  color: rgba(245, 245, 245, 0.75);
  margin: 0;

  @media (min-width: 320px) and (max-width: 480px) {
    font-size: 13px;
  }
`;

const ModalLink = styled.span`
  color: #0694fb;
  cursor: pointer;
  font-weight: 500;
  &:hover {
    text-decoration: underline;
  }
`;

const ModalSelect = styled.select`
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
  option {
    background-color: #111;
    color: white;
  }
`;


const ModalSuccess = styled.p`
  color: #4dff91;
  font-size: 13px;
  margin: 0;
  text-align: center;
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
  const navigate = useNavigate();
  const [view, setView] = useState("signin");

  // Sign in state
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  // Sign up state
  const [fullName, setFullName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [institution, setInstitution] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");

  // Sign-in validation
  const [signInErrors, setSignInErrors] = useState({});
  const [signInTouched, setSignInTouched] = useState({});

  // Signup validation
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotEmailError, setForgotEmailError] = useState("");
  const [forgotTouched, setForgotTouched] = useState(false);

  // Reset password state
  const [resetOtp, setResetOtp] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");

  // Verification state
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");


  function decodeToken(token) {
    const payload = token.split(".")[1];                        // middle segment
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/")); // base64url → base64
    return JSON.parse(decoded);
  }


  const parseApiError = (data, fallback) => {
    if (!data) return fallback;
    const detail = data.detail ?? data.message;
    if (Array.isArray(detail)) return detail.map(e => e.msg ?? String(e)).join(". ");
    return detail || fallback;
  };

  const handleSignIn = async (e) => {
    e.stopPropagation();
    setError("");
    setLoading(true);

    try {
      const baseURL = process.env.REACT_APP_API_URL || "";
      const res = await fetch(`${baseURL}/auth/sign-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: signInEmail, password: signInPassword }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(parseApiError(data, "Invalid email or password"));
      }
      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);

      const { sub, role, name, exp } = decodeToken(data.access_token);
      localStorage.setItem("name", name);
      localStorage.setItem("role", role);
      localStorage.setItem("sub", sub);
      localStorage.setItem("email", signInEmail);

      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.stopPropagation();
    const emailErr = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail) ? "" : "Enter a valid email address";
    setForgotTouched(true);
    setForgotEmailError(emailErr);
    if (emailErr) return;

    setError("");
    setLoading(true);
    try {
      const baseURL = process.env.REACT_APP_API_URL || "";
      await fetch(`${baseURL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      setResetOtp(""); setResetPassword(""); setResetConfirm("");
      setView("reset");
    } catch {
      setResetOtp(""); setResetPassword(""); setResetConfirm("");
      setView("reset");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.stopPropagation();
    if (resetPassword.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (resetPassword !== resetConfirm) { setError("Passwords do not match."); return; }
    setError("");
    setLoading(true);
    try {
      const baseURL = process.env.REACT_APP_API_URL || "";
      const res = await fetch(`${baseURL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail, otp: resetOtp, new_password: resetPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(parseApiError(data, "Could not reset password."));
      }
      setSuccess("Password reset! You can now sign in.");
      setTimeout(() => { setSuccess(""); switchView("signin"); }, 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.stopPropagation();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const baseURL = process.env.REACT_APP_API_URL || "";
      const res = await fetch(`${baseURL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signUpEmail,
          full_name: fullName,
          password: signUpPassword,
          phone,
          institution,
          license_number: licenseNumber,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(parseApiError(data, "Sign up failed"));
      }

      setView("verify");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.stopPropagation();
    setError("");
    setLoading(true);

    try {
      const baseURL = process.env.REACT_APP_API_URL || "";
      const res = await fetch(`${baseURL}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: signUpEmail, otp }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(parseApiError(data, "Verification failed"));
      }

      setSuccess("Email verified! You can now sign in.");
      setOtp("");
      setTimeout(() => { setSuccess(""); setView("signin"); }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Signup validation ────────────────────────────────────────────────────
  const validateField = (name, value) => {
    switch (name) {
      case "fullName":
        return value.trim().length < 2 ? "Full name must be at least 2 characters" : "";
      case "signUpEmail":
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "" : "Enter a valid email address";
      case "signUpPassword":
        if (value.length < 8) return "Password must be at least 8 characters";
        if (!/[A-Z]/.test(value)) return "Include at least one uppercase letter";
        if (!/[0-9]/.test(value)) return "Include at least one number";
        return "";
      case "confirmPassword":
        return value !== signUpPassword ? "Passwords do not match" : "";
      case "phone":
        return value.trim().length < 7 ? "Phone number is required" : "";
      case "licenseNumber":
        return value.trim().length < 2 ? "License number is required" : "";
      default:
        return "";
    }
  };

  const handleBlur = (name, value) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    setFieldErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
  };

  const passwordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { score, label: "Weak", color: "#ef4444" };
    if (score <= 3) return { score, label: "Fair", color: "#f59e0b" };
    return { score, label: "Strong", color: "#22c55e" };
  };

  const handleResendOtp = async (e) => {
    e.stopPropagation();
    if (resendCooldown > 0) return;
    setError("");

    try {
      const baseURL = process.env.REACT_APP_API_URL || "";
      await fetch(`${baseURL}/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: signUpEmail }),
      });
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setError("Could not resend code. Try again.");
    }
  };

  const switchView = (v) => {
    setError("");
    setSuccess("");
    setFieldErrors({});
    setTouched({});
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirm(false);
    setSignInErrors({});
    setResetOtp(""); setResetPassword(""); setResetConfirm("");
    setSignInTouched({});
    setForgotEmail("");
    setForgotEmailError("");
    setForgotTouched(false);
    setView(v);
  };

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
    <>
    <OverlayRoot onClick={close}>
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
            style={{ height: "24px", width: "auto" }}
          />

          {view === "forgot" ? (
            <>
              <ModalHeader>
                <ModalTitle>Reset your password</ModalTitle>
                <ModalSubtitle>
                  Enter your email address and we'll send you a 6-digit reset code.
                </ModalSubtitle>
              </ModalHeader>

              <ModalInputs>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <ModalInput
                    type="email"
                    placeholder="Email"
                    value={forgotEmail}
                    onChange={(e) => { setForgotEmail(e.target.value); if (forgotTouched) setForgotEmailError(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value) ? "" : "Enter a valid email address"); }}
                    onBlur={(e) => { setForgotTouched(true); setForgotEmailError(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value) ? "" : "Enter a valid email address"); }}
                    style={forgotTouched && forgotEmailError ? { borderColor: "#ef4444" } : {}}
                  />
                  {forgotTouched && forgotEmailError && <span style={{ color: "#ef4444", fontSize: 12, paddingLeft: 4 }}>{forgotEmailError}</span>}
                </div>
              </ModalInputs>

              {error ? <span style={{ color: "#ef4444", fontSize: 13 }}>{error}</span> : null}

              <ModalControls>
                <ModalButton onClick={handleForgotPassword} disabled={loading}>
                  {loading ? "Sending..." : "Send reset code"}
                </ModalButton>
                <ModalFooterText>
                  <ModalLink onClick={() => switchView("signin")}>Back to Sign In</ModalLink>
                </ModalFooterText>
              </ModalControls>
            </>
          ) : view === "reset" ? (
            <>
              <ModalHeader>
                <ModalTitle>Enter your reset code</ModalTitle>
                <ModalSubtitle>
                  We sent a 6-digit code to <strong style={{ color: "#f5f5f5" }}>{forgotEmail}</strong>. Enter it below along with your new password.
                </ModalSubtitle>
              </ModalHeader>

              <ModalInputs>
                <ModalInput
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  style={{ letterSpacing: "0.3em", textAlign: "center", fontSize: "22px" }}
                />
                <ModalInput
                  type="password"
                  placeholder="New password (min 8 characters)"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                />
                <ModalInput
                  type="password"
                  placeholder="Confirm new password"
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                />
              </ModalInputs>

              {error ? <span style={{ color: "#ef4444", fontSize: 13 }}>{error}</span> : null}
              {success ? <ModalSuccess>{success}</ModalSuccess> : null}

              <ModalControls>
                <ModalButton onClick={handleResetPassword} disabled={loading || resetOtp.length < 6 || !!success}>
                  {loading ? "Resetting..." : "Reset password"}
                </ModalButton>
                <ModalFooterText>
                  Didn't get a code?{" "}
                  <ModalLink onClick={() => switchView("forgot")}>Try again</ModalLink>
                </ModalFooterText>
              </ModalControls>
            </>
          ) : view === "verify" ? (
            <>
              <ModalHeader>
                <ModalTitle>Check your email</ModalTitle>
                <ModalSubtitle>
                  We sent a 6-digit code to <strong style={{ color: "#f5f5f5" }}>{signUpEmail}</strong>. Enter it below to verify your account.
                </ModalSubtitle>
              </ModalHeader>

              <ModalInputs>
                <ModalInput
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  style={{ letterSpacing: "0.3em", textAlign: "center", fontSize: "22px" }}
                />
              </ModalInputs>

              {success ? <ModalSuccess>{success}</ModalSuccess> : null}

              <ModalControls>
                <ModalButton onClick={handleVerify} disabled={loading || otp.length < 6}>
                  {loading ? "Verifying..." : "Verify Email"}
                </ModalButton>
                <ModalFooterText>
                  Didn't receive a code?{" "}
                  <ModalLink onClick={handleResendOtp} style={{ opacity: resendCooldown > 0 ? 0.5 : 1, cursor: resendCooldown > 0 ? "default" : "pointer" }}>
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend"}
                  </ModalLink>
                </ModalFooterText>
              </ModalControls>
            </>
          ) : view === "signin" ? (
            <>
              <ModalHeader>
                <ModalTitle>Sign In to your account</ModalTitle>
                <ModalSubtitle>
                  Sign in to access all the features and functions of our platform
                </ModalSubtitle>
              </ModalHeader>

              <ModalInputs>
                {/* Email */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <ModalInput
                    type="text"
                    placeholder="Email"
                    value={signInEmail}
                    onChange={(e) => { setSignInEmail(e.target.value); if (signInTouched.email) setSignInErrors(p => ({ ...p, email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value) ? "" : "Enter a valid email address" })); }}
                    onBlur={(e) => { setSignInTouched(p => ({ ...p, email: true })); setSignInErrors(p => ({ ...p, email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value) ? "" : "Enter a valid email address" })); }}
                    style={signInTouched.email && signInErrors.email ? { borderColor: "#ef4444" } : {}}
                  />
                  {signInTouched.email && signInErrors.email && <span style={{ color: "#ef4444", fontSize: 12, paddingLeft: 4 }}>{signInErrors.email}</span>}
                </div>

                {/* Password */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <ModalInput
                    type="password"
                    placeholder="Password"
                    value={signInPassword}
                    onChange={(e) => { setSignInPassword(e.target.value); if (signInTouched.password) setSignInErrors(p => ({ ...p, password: e.target.value ? "" : "Password is required" })); }}
                    onBlur={(e) => { setSignInTouched(p => ({ ...p, password: true })); setSignInErrors(p => ({ ...p, password: e.target.value ? "" : "Password is required" })); }}
                    style={signInTouched.password && signInErrors.password ? { borderColor: "#ef4444" } : {}}
                  />
                  {signInTouched.password && signInErrors.password && <span style={{ color: "#ef4444", fontSize: 12, paddingLeft: 4 }}>{signInErrors.password}</span>}
                  <span
                    onClick={() => switchView("forgot")}
                    style={{ alignSelf: "flex-end", fontSize: 12, color: "#6b6b6b", cursor: "pointer", paddingRight: 4 }}
                    onMouseEnter={e => e.target.style.color = "#f5f5f5"}
                    onMouseLeave={e => e.target.style.color = "#6b6b6b"}
                  >
                    Forgot password?
                  </span>
                </div>
              </ModalInputs>

              <ModalControls>
                <ModalButton
                  disabled={loading}
                  onClick={(e) => {
                    const emailErr = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signInEmail) ? "" : "Enter a valid email address";
                    const passwordErr = signInPassword ? "" : "Password is required";
                    setSignInErrors({ email: emailErr, password: passwordErr });
                    setSignInTouched({ email: true, password: true });
                    if (emailErr || passwordErr) return;
                    handleSignIn(e);
                  }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Signing in...
                    </span>
                  ) : "Sign In"}
                </ModalButton>
                <ModalFooterText>
                  Don't have an account?{" "}
                  <ModalLink onClick={() => switchView("signup")}>Sign up</ModalLink>
                </ModalFooterText>
              </ModalControls>
            </>
          ) : (
            <>
              <ModalHeader>
                <ModalTitle>Create an account</ModalTitle>
                <ModalSubtitle>
                  Join intelliDiag and start using AI-powered diagnostics
                </ModalSubtitle>
              </ModalHeader>

              <ModalInputs>
                {/* Full Name */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <ModalInput
                    type="text"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); if (touched.fullName) setFieldErrors(p => ({ ...p, fullName: validateField("fullName", e.target.value) })); }}
                    onBlur={(e) => handleBlur("fullName", e.target.value)}
                    style={touched.fullName && fieldErrors.fullName ? { borderColor: "#ef4444" } : {}}
                  />
                  {touched.fullName && fieldErrors.fullName && <span style={{ color: "#ef4444", fontSize: 12, paddingLeft: 4 }}>{fieldErrors.fullName}</span>}
                </div>

                {/* Email */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <ModalInput
                    type="email"
                    placeholder="Email"
                    value={signUpEmail}
                    onChange={(e) => { setSignUpEmail(e.target.value); if (touched.signUpEmail) setFieldErrors(p => ({ ...p, signUpEmail: validateField("signUpEmail", e.target.value) })); }}
                    onBlur={(e) => handleBlur("signUpEmail", e.target.value)}
                    style={touched.signUpEmail && fieldErrors.signUpEmail ? { borderColor: "#ef4444" } : {}}
                  />
                  {touched.signUpEmail && fieldErrors.signUpEmail && <span style={{ color: "#ef4444", fontSize: 12, paddingLeft: 4 }}>{fieldErrors.signUpEmail}</span>}
                </div>

                {/* Password */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ position: "relative" }}>
                    <ModalInput
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={signUpPassword}
                      onChange={(e) => { setSignUpPassword(e.target.value); if (touched.signUpPassword) setFieldErrors(p => ({ ...p, signUpPassword: validateField("signUpPassword", e.target.value), confirmPassword: confirmPassword ? validateField("confirmPassword", confirmPassword) : p.confirmPassword })); }}
                      onBlur={(e) => handleBlur("signUpPassword", e.target.value)}
                      style={{ paddingRight: 44, ...(touched.signUpPassword && fieldErrors.signUpPassword ? { borderColor: "#ef4444" } : {}) }}
                    />
                    <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b6b6b", fontSize: 13 }}>
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {signUpPassword && (() => { const s = passwordStrength(signUpPassword); return (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 3, borderRadius: 99, background: "#1e1e1e", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(s.score / 5) * 100}%`, background: s.color, borderRadius: 99, transition: "width 0.3s, background 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 11, color: s.color, minWidth: 40 }}>{s.label}</span>
                    </div>
                  ); })()}
                  {touched.signUpPassword && fieldErrors.signUpPassword && <span style={{ color: "#ef4444", fontSize: 12, paddingLeft: 4 }}>{fieldErrors.signUpPassword}</span>}
                </div>

                {/* Confirm Password */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ position: "relative" }}>
                    <ModalInput
                      type={showConfirm ? "text" : "password"}
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); if (touched.confirmPassword) setFieldErrors(p => ({ ...p, confirmPassword: e.target.value !== signUpPassword ? "Passwords do not match" : "" })); }}
                      onBlur={(e) => handleBlur("confirmPassword", e.target.value)}
                      style={{ paddingRight: 44, ...(touched.confirmPassword && fieldErrors.confirmPassword ? { borderColor: "#ef4444" } : touched.confirmPassword && confirmPassword && !fieldErrors.confirmPassword ? { borderColor: "#22c55e" } : {}) }}
                    />
                    <button type="button" onClick={() => setShowConfirm(p => !p)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b6b6b", fontSize: 13 }}>
                      {showConfirm ? "Hide" : "Show"}
                    </button>
                  </div>
                  {touched.confirmPassword && fieldErrors.confirmPassword && <span style={{ color: "#ef4444", fontSize: 12, paddingLeft: 4 }}>{fieldErrors.confirmPassword}</span>}
                </div>

                {/* Phone */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "#9ca3af", paddingLeft: 4 }}>
                    Phone Number <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <ModalInput
                    type="tel"
                    placeholder="Phone Number"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); if (touched.phone) setFieldErrors(p => ({ ...p, phone: validateField("phone", e.target.value) })); }}
                    onBlur={(e) => handleBlur("phone", e.target.value)}
                    style={touched.phone && fieldErrors.phone ? { borderColor: "#ef4444" } : {}}
                  />
                  {touched.phone && fieldErrors.phone && <span style={{ color: "#ef4444", fontSize: 12, paddingLeft: 4 }}>{fieldErrors.phone}</span>}
                </div>

                {/* Institution (optional) */}
                <ModalInput
                  type="text"
                  placeholder="Hospital / Institution (optional)"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                />

                {/* License Number */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <ModalInput
                    type="text"
                    placeholder="Medical License Number"
                    value={licenseNumber}
                    onChange={(e) => { setLicenseNumber(e.target.value); if (touched.licenseNumber) setFieldErrors(p => ({ ...p, licenseNumber: validateField("licenseNumber", e.target.value) })); }}
                    onBlur={(e) => handleBlur("licenseNumber", e.target.value)}
                    style={touched.licenseNumber && fieldErrors.licenseNumber ? { borderColor: "#ef4444" } : {}}
                  />
                  {touched.licenseNumber && fieldErrors.licenseNumber && <span style={{ color: "#ef4444", fontSize: 12, paddingLeft: 4 }}>{fieldErrors.licenseNumber}</span>}
                </div>
              </ModalInputs>


              <ModalControls>
                <ModalButton
                  onClick={(e) => {
                    // Touch all required fields to show any missed errors
                    const fields = { fullName, signUpEmail, signUpPassword, confirmPassword, phone, licenseNumber };
                    const errors = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, validateField(k, v)]));
                    setFieldErrors(errors);
                    setTouched({ fullName: true, signUpEmail: true, signUpPassword: true, confirmPassword: true, phone: true, licenseNumber: true });
                    if (Object.values(errors).some(Boolean)) return;
                    handleSignUp(e);
                  }}
                  disabled={loading}
                >
                  {loading ? "Creating account..." : "Sign Up"}
                </ModalButton>
                <ModalFooterText>
                  Already have an account?{" "}
                  <ModalLink onClick={() => switchView("signin")}>Sign in</ModalLink>
                </ModalFooterText>
              </ModalControls>
            </>
          )}
        </ModalContent>
      </OverlayContent>

    </OverlayRoot>

    {/* ── Error dialog — portalled to body to escape all stacking contexts ── */}
    {ReactDOM.createPortal(
      <AnimatePresence>
        {error && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setError("")}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[400px] bg-[#161616] border border-[#1E1E1E] rounded-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between px-7 pt-7 pb-5">
                <div>
                  <div className="flex flex-row gap-2 items-center">
                    <Info size={20} className="text-white" />
                    <h2 className="text-white text-[17px] font-medium m-0">Something went wrong</h2>
                  </div>
                  <p className="text-[#6B6B6B] text-[13px] m-0 mt-1">{error}</p>
                </div>
                <button onClick={() => setError("")} className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1 mt-0.5">
                  <FiX size={18} />
                </button>
              </div>
              {/* Footer */}
              <div className="px-7 pb-6">
                <button
                  onClick={() => setError("")}
                  className="w-full py-2.5 rounded-full bg-[#0694FB] hover:bg-[#0578d1] text-white text-[13px] font-medium cursor-pointer transition-colors border-none"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </>
  );
}

export default Homepage;
