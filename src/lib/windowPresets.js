// CT window presets (width / level in HU). Number keys 1–9 pick them, as in Horos/OsiriX;
// 0 goes back to the image's own window. Values are common radiology defaults — adjust
// here if your radiologists use different ones.
export const CT_WINDOW_PRESETS = [
  { key: "1", name: "Soft tissue", width: 400, center: 40 },
  { key: "2", name: "Lung", width: 1500, center: -600 },
  { key: "3", name: "Bone", width: 2000, center: 300 },
  { key: "4", name: "Brain", width: 80, center: 40 },
  { key: "5", name: "Subdural", width: 200, center: 75 },
  { key: "6", name: "Stroke", width: 40, center: 40 },
  { key: "7", name: "Mediastinum", width: 350, center: 50 },
  { key: "8", name: "Liver", width: 150, center: 30 },
  { key: "9", name: "Angio", width: 600, center: 170 },
];
