import { useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";

const Cursor = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #ffffff;
  pointer-events: none;
  will-change: transform;
  z-index: 9999;
  transition: width 0.2s ease, height 0.2s ease, background-color 0.2s ease;

  @media (pointer: coarse) {
    display: none;
  }

  ${(props) =>
    props.$isHovering &&
    css`
      width: 40px;
      height: 40px;
      background-color: rgba(255, 255, 255, 0.5);
    `}

  ${(props) =>
    props.$isClicking &&
    css`
      width: 15px;
      height: 15px;
      background-color: #21a2ff;
    `}

  @media (max-width: 768px) {
    width: 16px;
    height: 16px;

    ${(props) =>
      props.$isHovering &&
      css`
        width: 30px;
        height: 30px;
      `}
  }
`;

function CustomCursor() {
  const cursorRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);

  useEffect(() => {
    const updatePosition = (e) => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${e.clientX - 10}px, ${e.clientY - 10}px)`;
      }
    };

    const handleMouseEnter = () => setIsHovering(true);
    const handleMouseLeave = () => setIsHovering(false);
    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    const interactiveElements = document.querySelectorAll(
      'a, button, input, textarea, select, [role="button"]'
    );

    interactiveElements.forEach((el) => {
      el.addEventListener("mouseenter", handleMouseEnter);
      el.addEventListener("mouseleave", handleMouseLeave);
    });

    window.addEventListener("mousemove", updatePosition);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", updatePosition);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);

      interactiveElements.forEach((el) => {
        el.removeEventListener("mouseenter", handleMouseEnter);
        el.removeEventListener("mouseleave", handleMouseLeave);
      });
    };
  }, []);

  return (
    <Cursor
      ref={cursorRef}
      $isHovering={isHovering}
      $isClicking={isClicking}
    />
  );
}

export default CustomCursor;
