/* global BigInt */
import dicomParser from "dicom-parser";

// Writes a DICOM Secondary Capture image (explicit VR little endian, uncompressed RGB) from a
// picture of the viewer, so an exported view can go into a PACS beside the study it came
// from: the patient and study come from a source image of the series; the capture gets its
// own series ("IntelliDiag capture") and new UIDs.

const SC_SOP_CLASS = "1.2.840.10008.5.1.4.1.1.7";
const EXPLICIT_LE = "1.2.840.10008.1.2.1";
const IMPLEMENTATION_UID = "2.25.302619237187409148721394517840266931011";
const IMPLEMENTATION_NAME = "INTELLIDIAG_1";

// A new UID: "2.25." and a random 128-bit number
export function newUid() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return `2.25.${n}`;
}

// VRs with a 4-byte length (and 2 reserved bytes) in explicit VR
const LONG_VRS = new Set(["OB", "OD", "OF", "OL", "OW", "SQ", "UC", "UN", "UR", "UT"]);

function element(tag, vr, value) {
  let bytes;
  if (value instanceof Uint8Array) bytes = value;
  else if (vr === "US") { bytes = new Uint8Array(2); new DataView(bytes.buffer).setUint16(0, value, true); }
  else if (vr === "UL") { bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value, true); }
  else bytes = new TextEncoder().encode(String(value ?? ""));
  if (bytes.length % 2) {
    const padded = new Uint8Array(bytes.length + 1);
    padded.set(bytes);
    padded[bytes.length] = vr === "UI" || vr === "OB" ? 0 : 0x20;
    bytes = padded;
  }
  const long = LONG_VRS.has(vr);
  const head = new DataView(new ArrayBuffer(long ? 12 : 8));
  head.setUint16(0, tag >>> 16, true);
  head.setUint16(2, tag & 0xffff, true);
  head.setUint8(4, vr.charCodeAt(0));
  head.setUint8(5, vr.charCodeAt(1));
  if (long) head.setUint32(8, bytes.length, true);
  else head.setUint16(6, bytes.length, true);
  return [new Uint8Array(head.buffer), bytes];
}

const concat = (arrays) => {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let at = 0;
  for (const a of arrays) { out.set(a, at); at += a.length; }
  return out;
};

const pad2 = (n) => String(n).padStart(2, "0");

// Patient / study tags copied from the source image (VR, tag); empty when it hasn't them
// (they're required, even if empty). Not the frame of reference: a picture of the screen
// doesn't share the scan's coordinates.
const COPIED = [
  ["DA", 0x00080020], ["TM", 0x00080030], ["SH", 0x00080050], ["PN", 0x00080090],
  ["LO", 0x00081030], ["PN", 0x00100010], ["LO", 0x00100020], ["DA", 0x00100030],
  ["CS", 0x00100040], ["AS", 0x00101010], ["UI", 0x0020000d], ["SH", 0x00200010],
];
const tagKey = (tag) => `x${tag.toString(16).padStart(8, "0")}`;

// canvas: the picture; source: ArrayBuffer of a DICOM image of the series (patient and study
// details), or null. Returns a Uint8Array .dcm file.
export function secondaryCapture(canvas, source, { seriesDescription = "IntelliDiag capture", seriesNumber = 9901 } = {}) {
  const { width, height } = canvas;
  const rgba = canvas.getContext("2d").getImageData(0, 0, width, height).data;
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i]; rgb[j + 1] = rgba[i + 1]; rgb[j + 2] = rgba[i + 2];
  }

  let sourceSet = null;
  try { sourceSet = source ? dicomParser.parseDicom(new Uint8Array(source)) : null; } catch { sourceSet = null; }
  const copied = new Map();
  COPIED.forEach(([vr, tag]) => {
    const value = (sourceSet?.string(tagKey(tag)) ?? "").replace(/\0+$/, "");
    if (value || tag !== 0x00101010) copied.set(tag, [vr, value]);
  });
  if (!copied.get(0x0020000d)[1]) copied.set(0x0020000d, ["UI", newUid()]);

  const now = new Date();
  const date = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  const sopUid = newUid();

  const fields = new Map([
    [0x00080008, ["CS", "DERIVED\\SECONDARY"]],
    [0x00080016, ["UI", SC_SOP_CLASS]],
    [0x00080018, ["UI", sopUid]],
    [0x00080021, ["DA", date]],
    [0x00080023, ["DA", date]],
    [0x00080031, ["TM", time]],
    [0x00080033, ["TM", time]],
    [0x00080060, ["CS", "OT"]],
    [0x00080064, ["CS", "WSD"]],
    [0x00080070, ["LO", "IntelliDiag"]],
    [0x0008103e, ["LO", seriesDescription]],
    [0x00181012, ["DA", date]],
    [0x00181014, ["TM", time]],
    [0x00181016, ["LO", "IntelliDiag"]],
    [0x0020000e, ["UI", newUid()]],
    [0x00200011, ["IS", String(seriesNumber)]],
    [0x00200013, ["IS", "1"]],
    [0x00200020, ["CS", ""]],
    [0x00280002, ["US", 3]],
    [0x00280004, ["CS", "RGB"]],
    [0x00280006, ["US", 0]],
    [0x00280010, ["US", height]],
    [0x00280011, ["US", width]],
    [0x00280100, ["US", 8]],
    [0x00280101, ["US", 8]],
    [0x00280102, ["US", 7]],
    [0x00280103, ["US", 0]],
    [0x7fe00010, ["OB", rgb]],
    ...copied,
  ]);
  const body = concat([...fields.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([tag, [vr, value]]) => element(tag, vr, value)));

  const metaBody = concat([
    ...element(0x00020001, "OB", new Uint8Array([0, 1])),
    ...element(0x00020002, "UI", SC_SOP_CLASS),
    ...element(0x00020003, "UI", sopUid),
    ...element(0x00020010, "UI", EXPLICIT_LE),
    ...element(0x00020012, "UI", IMPLEMENTATION_UID),
    ...element(0x00020013, "SH", IMPLEMENTATION_NAME),
  ]);
  const preamble = new Uint8Array(132);
  preamble.set([0x44, 0x49, 0x43, 0x4d], 128); // "DICM"
  return concat([preamble, ...element(0x00020000, "UL", metaBody.length), metaBody, body]);
}
