import { useEffect, useState } from "react";
import styled, { css } from "styled-components";

const Cursor = styled.div`
  position: fixed;
  top: ${props => props.y}px;
  left: ${props => props.x}px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #FFFFFF;
  pointer-events: none;
  transform: translate(-50%, -50%);
  z-index: 9999;
  mix-blend-mode: difference;
  transition: transform 0.1s ease, width 0.2s ease, height 0.2s ease;
  
  /* Hide cursor on touch devices */
  @media (pointer: coarse) {
    display: none;
  }

  /* Different cursor states */
  ${props => props.$isHovering && css`
    width: 40px;
    height: 40px;
    background-color: rgba(255, 255, 255, 0.5);
  `}

  ${props => props.$isClicking && css`
    width: 15px;
    height: 15px;
    background-color: #21A2FF;
  `}

  /* Responsive sizing */
  @media (max-width: 768px) {
    width: 16px;
    height: 16px;
    
    ${props => props.$isHovering && css`
      width: 30px;
      height: 30px;
    `}
  }
`;

function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);

  useEffect(() => {
    const updatePosition = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseEnter = () => setIsHovering(true);
    const handleMouseLeave = () => setIsHovering(false);
    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    // Add hover detection for interactive elements
    const interactiveElements = document.querySelectorAll(
      'a, button, input, textarea, select, [role="button"]'
    );

    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', handleMouseEnter);
      el.addEventListener('mouseleave', handleMouseLeave);
    });

    window.addEventListener("mousemove", updatePosition);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", updatePosition);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      
      interactiveElements.forEach(el => {
        el.removeEventListener('mouseenter', handleMouseEnter);
        el.removeEventListener('mouseleave', handleMouseLeave);
      });
    };
  }, []);

  return (
    <Cursor 
      x={position.x} 
      y={position.y} 
      $isHovering={isHovering}
      $isClicking={isClicking}
    />
  );
}

export default CustomCursor;