import React from "react";

// Vertical scale bar on the left edge, below the orientation letter, as Horos/OsiriX draw
// it: a round length (1 mm … 50 cm) at most a quarter of the pane's height, with a tick
// every centimetre (or every millimetre on very short bars). Follows zoom, since the
// viewer recomputes mmPerPixel on every render.
const NICE_LENGTHS_MM = [1, 2, 5, 10, 20, 50, 100, 200, 500];

export default function ScaleBar({ mmPerPixel, paneHeight }) {
  if (!mmPerPixel || !paneHeight) return null;
  const maxPx = paneHeight * 0.25;
  const lengthMm = [...NICE_LENGTHS_MM].reverse().find(mm => mm / mmPerPixel <= maxPx);
  if (!lengthMm) return null;
  const lengthPx = lengthMm / mmPerPixel;
  if (lengthPx < 12) return null;
  const tickMm = lengthMm >= 20 ? 10 : 1;
  const ticks = lengthMm / tickMm <= 10 ? Array.from({ length: lengthMm / tickMm + 1 }, (_, n) => n * tickMm / mmPerPixel) : [0, lengthPx];
  const label = lengthMm >= 10 ? `${lengthMm / 10} cm` : `${lengthMm} mm`;

  return (
    <div className="absolute left-2 pointer-events-none select-none z-10 flex items-start gap-1" style={{ top: "calc(50% + 16px)" }}>
      <svg width={8} height={lengthPx + 2} className="overflow-visible">
        <line x1={1} y1={1} x2={1} y2={lengthPx + 1} stroke="#E5E5E5" strokeWidth={1.5} style={{ filter: "drop-shadow(0 0 1px #000)" }} />
        {ticks.map((y, n) => {
          const end = n === 0 || n === ticks.length - 1;
          return <line key={n} x1={1} y1={y + 1} x2={end ? 8 : 5} y2={y + 1} stroke="#E5E5E5" strokeWidth={1} style={{ filter: "drop-shadow(0 0 1px #000)" }} />;
        })}
      </svg>
      <span className="text-[10px] text-[#E5E5E5] font-mono leading-none" style={{ textShadow: "0 0 3px #000, 0 0 3px #000", marginTop: lengthPx / 2 - 5 }}>
        {label}
      </span>
    </div>
  );
}
