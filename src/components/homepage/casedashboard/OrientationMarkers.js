import React from "react";

// Patient-orientation letters on the four image edges (A/P, R/L, S/I), as every
// radiology viewer shows them. Patient space is DICOM LPS: +x = Left, +y = Posterior,
// +z = Superior. Derived from the camera, so they follow rotation and flips (Cornerstone
// flips by turning the camera, not by mirroring pixels).

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const negate = (v) => v.map(x => -x);

// Up to two letters, strongest first — e.g. "L" on a true axial, "LA" on an oblique
function orientationString(v) {
  return [[v[0], "L", "R"], [v[1], "P", "A"], [v[2], "S", "I"]]
    .map(([c, pos, neg]) => ({ mag: Math.abs(c), letter: c > 0 ? pos : neg }))
    .filter(p => p.mag > 0.25)
    .sort((a, b) => b.mag - a.mag)
    .slice(0, 2)
    .map(p => p.letter)
    .join("");
}

// camera: Cornerstone camera ({ viewUp, viewPlaneNormal } in patient coordinates)
export function getOrientationMarkers(camera) {
  const { viewUp, viewPlaneNormal } = camera ?? {};
  if (!viewUp || !viewPlaneNormal) return null;
  // viewPlaneNormal points toward the viewer, so screen-right = up × out-of-screen
  const right = cross(viewUp, viewPlaneNormal);
  return {
    top: orientationString(viewUp),
    bottom: orientationString(negate(viewUp)),
    right: orientationString(right),
    left: orientationString(negate(right)),
  };
}

const LETTER = "absolute text-[#E5E5E5] text-[13px] font-semibold pointer-events-none select-none";
const SHADOW = { textShadow: "0 0 3px #000, 0 0 3px #000" };

export default function OrientationMarkers({ markers }) {
  if (!markers) return null;
  return (
    <>
      <span className={`${LETTER} top-1 left-1/2 -translate-x-1/2`} style={SHADOW}>{markers.top}</span>
      <span className={`${LETTER} bottom-1 left-1/2 -translate-x-1/2`} style={SHADOW}>{markers.bottom}</span>
      <span className={`${LETTER} left-1.5 top-1/2 -translate-y-1/2`} style={SHADOW}>{markers.left}</span>
      <span className={`${LETTER} right-1.5 top-1/2 -translate-y-1/2`} style={SHADOW}>{markers.right}</span>
    </>
  );
}
