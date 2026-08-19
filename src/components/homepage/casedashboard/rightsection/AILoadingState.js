import { useEffect, useState, useRef } from "react";

/* ─────────────────────────────────────────────────────────
 * AI Loading State — pixel-grid loader, blue accent
 * Variants: Drive (square), Dots (circular), Orbit (perimeter comet)
 * ───────────────────────────────────────────────────────── */

const chevron = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3), c = i % 3;
  return (c + Math.abs(r - 1)) * 90;
});

const ORBIT_ORDER = [0, 1, 2, 5, 8, 7, 6, 3];
const orbit = Array.from({ length: 9 }, (_, i) => {
  const k = ORBIT_ORDER.indexOf(i);
  return k === -1 ? null : k * 110;
});

const PATTERNS = {
  Drive: { delays: chevron, dur: 650, round: false },
  Dots:  { delays: chevron, dur: 650, round: true  },
  Orbit: { delays: orbit,   dur: 950, round: false },
};

// Inject keyframes once
let injected = false;
function injectKeyframes() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes pixel-on {
      0%, 100% { opacity: 0.12; }
      40%       { opacity: 1;    }
    }
    @keyframes shimmer-text-blue {
      0%   { background-position: 200% center; }
      100% { background-position: -200% center; }
    }
  `;
  document.head.appendChild(style);
}

function LoaderGrid({ delays, dur, round }) {
  injectKeyframes();
  return (
    <span
      aria-hidden
      style={{ display: "grid", gridTemplateColumns: "repeat(3, 4px)", gap: "1.5px", flexShrink: 0 }}
    >
      {delays.map((delay, index) => (
        <span
          key={index}
          style={{
            width: 4,
            height: 4,
            backgroundColor: "#0694FB",
            borderRadius: round ? "50%" : 1,
            opacity: delay === null ? 0.07 : 0.12,
            animation:
              delay === null
                ? "none"
                : `pixel-on ${dur}ms ease-in-out ${delay}ms infinite`,
          }}
        />
      ))}
    </span>
  );
}

function useElapsed() {
  const [ds, setDs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDs((d) => d + 1), 100);
    return () => clearInterval(t);
  }, []);
  const total = ds / 10;
  if (total < 60) return `${total.toFixed(1)}s`;
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
}

export default function AILoadingState({ label = "Generating", variant = "Drive" }) {
  const elapsed = useElapsed();
  const { delays, dur, round } = PATTERNS[variant] ?? PATTERNS.Drive;

  return (
    <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, width: "fit-content" }}>
      <LoaderGrid delays={delays} dur={dur} round={round} />

      {/* Shimmering label */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          background: "linear-gradient(90deg, #1a5a8a 35%, #0694FB 50%, #1a5a8a 65%)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          animation: "shimmer-text-blue 1.4s linear infinite",
        }}
      >
        {label}
      </span>

      {/* Elapsed timer */}
      <span
        style={{
          fontFamily: "monospace",
          fontSize: 12,
          color: "#3a6a8a",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {elapsed}
      </span>
    </div>
  );
}
