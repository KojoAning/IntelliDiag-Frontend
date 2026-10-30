import dicomParser from "dicom-parser";

// De-identifies a DICOM file in place, for exporting a series without the patient's
// identity: each identifying value is overwritten inside the file at its own length
// (padded with spaces), so the file keeps its exact structure and stays valid — no
// re-encoding needed. Follows the DICOM basic profile's main identifiers:
//   names → "ANONYMOUS"; IDs, accession and study IDs → "ANON"; addresses, institution,
//   physicians, device and station → blank; dates → the year only (YYYY0101), times kept,
//   so intervals within a day (e.g. PET injection to scan, for SUV) still hold.
// Private (vendor) text fields are blanked; private numbers are kept (Philips' SUV factor).
// Not handled: identity burned into the pixels (ultrasound screens, scanned forms), and
// UIDs, which are kept (the "retain UIDs" option).

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
const TEXT_VRS = new Set(["AE", "AS", "CS", "DA", "DT", "LO", "LT", "PN", "SH", "ST", "TM", "UC", "UT"]);

function write(bytes, start, length, text) {
  for (let i = 0; i < length; i++) bytes[start + i] = i < text.length ? text.charCodeAt(i) : 0x20;
}
const readText = (bytes, start, length) => String.fromCharCode(...bytes.subarray(start, start + length));
const printable = (bytes, start, length) => {
  for (let i = start; i < start + length; i++) if (bytes[i] < 0x20 && bytes[i] !== 0 && bytes[i] !== 0x0a && bytes[i] !== 0x0d) return false;
  return true;
};

function scrub(dataSet, bytes) {
  Object.values(dataSet.elements).forEach(el => {
    if (el.items) {
      el.items.forEach(item => item.dataSet && scrub(item.dataSet, bytes));
      return;
    }
    if (!el.length || el.dataOffset == null) return;
    const rule = RULES[el.tag];
    const { dataOffset: at, length } = el;
    if (rule === NAME) write(bytes, at, length, "ANONYMOUS");
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

// ArrayBuffer of a DICOM file → de-identified copy (Uint8Array)
export function anonymizeDicom(buffer) {
  const bytes = new Uint8Array(buffer.slice(0));
  const dataSet = dicomParser.parseDicom(bytes);
  scrub(dataSet, bytes);
  return bytes;
}
