import dicomParser from "dicom-parser";

// De-identifies a DICOM file in place, for exporting a series without the patient's
// identity: each identifying value is overwritten inside the file at its own length
// (padded with spaces), so the file keeps its exact structure and stays valid — no
// re-encoding needed. Follows the DICOM basic profile's main identifiers:
//   names → "ANONYMOUS"; IDs, accession and study IDs → "ANON"; addresses, institution,
//   physicians, device and station → blank; dates → the year only (YYYY0101), times kept,
//   so intervals within a day (e.g. PET injection to scan, for SUV) still hold.
// Private (vendor) text fields are blanked; private numbers are kept (Philips' SUV factor).
// UIDs (study, series, image, frame of reference, references between them) are replaced by
// new random ones (2.25.…) of the same length; one map is shared by every file of an export,
// so series still group and references still resolve. Class UIDs (what kind of object,
// transfer syntax) and the standard's own (1.2.840.10008.…) are kept.
// Not handled: identity burned into the pixels (ultrasound screens, scanned forms).

const NAME = "n", ID = "i", BLANK = "b", DATE = "d", DATETIME = "t";
const RULES = {
  x00100010: NAME, x00080090: NAME, x00081050: NAME, x00081060: NAME, x00081070: NAME,
  x00081048: NAME, x00321032: NAME, x00400006: NAME, x00101001: NAME, x00101060: NAME,
  x00101005: NAME, x0040a123: NAME,
  x00100020: ID, x00101000: ID, x00100021: ID, x00080050: ID, x00200010: ID,
  x00402016: ID, x00402017: ID, x00401001: ID, x00400253: ID, x00400009: ID, x00380010: ID,
  x00181000: BLANK, x00081010: BLANK, x00080080: BLANK, x00080081: BLANK, x00081040: BLANK,
  x00080092: BLANK, x00080094: BLANK, x00101040: BLANK, x00102154: BLANK, x00102180: BLANK,
  x001021b0: BLANK, x00104000: BLANK, x00102000: BLANK, x00102110: BLANK, x00101080: BLANK,
  x00101090: BLANK, x00321033: BLANK, x00080116: BLANK,
  x00100030: DATE, x00080020: DATE, x00080021: DATE, x00080022: DATE, x00080023: DATE,
  x00080012: DATE, x00181012: DATE, x00080024: DATE, x00080025: DATE,
  x0008002a: DATETIME, x00181078: DATETIME, x00181079: DATETIME,
};
// SOP class, transfer syntax and implementation class UIDs: describe the object, not the patient
const CLASS_UIDS = new Set(["x00020002", "x00020010", "x00020012", "x00080016", "x00081150", "x00041510", "x00041512", "x0008001a", "x00080062"]);
const TEXT_VRS = new Set(["AE", "AS", "CS", "DA", "DT", "LO", "LT", "PN", "SH", "ST", "TM", "UC", "UT"]);

function write(bytes, start, length, text) {
  for (let i = 0; i < length; i++) bytes[start + i] = i < text.length ? text.charCodeAt(i) : 0x20;
}
const readText = (bytes, start, length) => String.fromCharCode(...bytes.subarray(start, start + length));
const printable = (bytes, start, length) => {
  for (let i = start; i < start + length; i++) if (bytes[i] < 0x20 && bytes[i] !== 0 && bytes[i] !== 0x0a && bytes[i] !== 0x0d) return false;
  return true;
};

// A new UID of the given length: "2.25." and random digits (no leading zero)
function newUid(length) {
  if (length < 6) return null;
  const digits = crypto.getRandomValues(new Uint8Array(length - 5));
  return "2.25." + Array.from(digits, (d, i) => (i === 0 ? 1 + (d % 9) : d % 10)).join("");
}

// Implicit VR has no type: digits with two or more dots is a UID (a decimal has at most one)
const looksLikeUid = (text) => /^\d+(\.\d+){2,}(\\\d+(\.\d+){2,})*$/.test(text);

function replaceUids(bytes, at, length, uidMap) {
  const text = readText(bytes, at, length).replace(/[\0 ]+$/, "");
  const parts = text.split("\\").map(uid => {
    if (uid.startsWith("1.2.840.10008.")) return uid;
    if (!uidMap.has(uid)) uidMap.set(uid, newUid(uid.length) ?? uid);
    return uidMap.get(uid);
  });
  const next = parts.join("\\");
  for (let i = 0; i < length; i++) bytes[at + i] = i < next.length ? next.charCodeAt(i) : 0; // UI pads with NUL
}

function scrub(dataSet, bytes, uidMap) {
  Object.values(dataSet.elements).forEach(el => {
    if (el.items) {
      el.items.forEach(item => item.dataSet && scrub(item.dataSet, bytes, uidMap));
      return;
    }
    if (!el.length || el.dataOffset == null) return;
    const rule = RULES[el.tag];
    const { dataOffset: at, length } = el;
    const isUid = el.vr ? el.vr === "UI" : looksLikeUid(readText(bytes, at, length).replace(/[\0 ]+$/, ""));
    if (isUid) {
      if (!CLASS_UIDS.has(el.tag)) replaceUids(bytes, at, length, uidMap);
    } else if (rule === NAME) write(bytes, at, length, "ANONYMOUS");
    else if (rule === ID) write(bytes, at, length, "ANON");
    else if (rule === BLANK) write(bytes, at, length, "");
    else if (rule === DATE || rule === DATETIME) {
      // Every YYYYMMDD in the value (multi-valued ones too) → YYYY0101
      const text = readText(bytes, at, length).replace(/(\d{4})(\d{2})(\d{2})/g, (m, y) => `${y}0101`);
      write(bytes, at, length, text);
    } else {
      const group = parseInt(el.tag.slice(1, 5), 16);
      const element = parseInt(el.tag.slice(5, 9), 16);
      // Private data elements (not their creator tags): text blanked, numbers kept
      if (group % 2 === 1 && element > 0x00ff) {
        // Implicit VR has no type: text that isn't just a number (DS/IS, e.g. a SUV factor)
        const textual = el.vr ? TEXT_VRS.has(el.vr)
          : printable(bytes, at, length) && !/^[\s\d.+\-eE\\]*$/.test(readText(bytes, at, length).replace(/\0/g, ""));
        if (textual) write(bytes, at, length, "");
      }
    }
  });
}

// ArrayBuffer of a DICOM file → de-identified copy (Uint8Array). Pass the same uidMap for
// every file of one export, so their new UIDs agree.
export function anonymizeDicom(buffer, uidMap = new Map()) {
  const bytes = new Uint8Array(buffer.slice(0));
  const dataSet = dicomParser.parseDicom(bytes);
  scrub(dataSet, bytes, uidMap);
  return bytes;
}
