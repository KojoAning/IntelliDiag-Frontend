// DICOM tag browser data (Horos's "Meta-data" window): every element of the image's
// header, with names for the common tags, values decoded by VR, and sequences nested.
// Reads the dataset the wado-uri loader already parsed for display, so it costs nothing
// for an image on screen.
import { wadouri } from "@cornerstonejs/dicom-image-loader";

// Common tags: "ggggeeee" -> [VR, name]. Unknown public tags still list, by number; the
// VR is needed to decode implicit-VR files, which carry no VR of their own.
const DICTIONARY = {
  "00020000": ["UL", "File Meta Information Group Length"],
  "00020001": ["OB", "File Meta Information Version"],
  "00020002": ["UI", "Media Storage SOP Class UID"],
  "00020003": ["UI", "Media Storage SOP Instance UID"],
  "00020010": ["UI", "Transfer Syntax UID"],
  "00020012": ["UI", "Implementation Class UID"],
  "00020013": ["SH", "Implementation Version Name"],
  "00020016": ["AE", "Source Application Entity Title"],
  "00080005": ["CS", "Specific Character Set"],
  "00080008": ["CS", "Image Type"],
  "00080012": ["DA", "Instance Creation Date"],
  "00080013": ["TM", "Instance Creation Time"],
  "00080016": ["UI", "SOP Class UID"],
  "00080018": ["UI", "SOP Instance UID"],
  "00080020": ["DA", "Study Date"],
  "00080021": ["DA", "Series Date"],
  "00080022": ["DA", "Acquisition Date"],
  "00080023": ["DA", "Content Date"],
  "0008002A": ["DT", "Acquisition DateTime"],
  "00080030": ["TM", "Study Time"],
  "00080031": ["TM", "Series Time"],
  "00080032": ["TM", "Acquisition Time"],
  "00080033": ["TM", "Content Time"],
  "00080050": ["SH", "Accession Number"],
  "00080060": ["CS", "Modality"],
  "00080064": ["CS", "Conversion Type"],
  "00080070": ["LO", "Manufacturer"],
  "00080080": ["LO", "Institution Name"],
  "00080081": ["ST", "Institution Address"],
  "00080090": ["PN", "Referring Physician's Name"],
  "00081010": ["SH", "Station Name"],
  "00081030": ["LO", "Study Description"],
  "0008103E": ["LO", "Series Description"],
  "00081040": ["LO", "Institutional Department Name"],
  "00081050": ["PN", "Performing Physician's Name"],
  "00081060": ["PN", "Name of Physician(s) Reading Study"],
  "00081070": ["PN", "Operators' Name"],
  "00081090": ["LO", "Manufacturer's Model Name"],
  "00081140": ["SQ", "Referenced Image Sequence"],
  "00081150": ["UI", "Referenced SOP Class UID"],
  "00081155": ["UI", "Referenced SOP Instance UID"],
  "00082111": ["ST", "Derivation Description"],
  "00100010": ["PN", "Patient's Name"],
  "00100020": ["LO", "Patient ID"],
  "00100030": ["DA", "Patient's Birth Date"],
  "00100040": ["CS", "Patient's Sex"],
  "00101010": ["AS", "Patient's Age"],
  "00101020": ["DS", "Patient's Size"],
  "00101030": ["DS", "Patient's Weight"],
  "00102160": ["SH", "Ethnic Group"],
  "00104000": ["LT", "Patient Comments"],
  "00180010": ["LO", "Contrast/Bolus Agent"],
  "00180015": ["CS", "Body Part Examined"],
  "00180020": ["CS", "Scanning Sequence"],
  "00180021": ["CS", "Sequence Variant"],
  "00180022": ["CS", "Scan Options"],
  "00180023": ["CS", "MR Acquisition Type"],
  "00180024": ["SH", "Sequence Name"],
  "00180050": ["DS", "Slice Thickness"],
  "00180060": ["DS", "KVP"],
  "00180080": ["DS", "Repetition Time"],
  "00180081": ["DS", "Echo Time"],
  "00180082": ["DS", "Inversion Time"],
  "00180083": ["DS", "Number of Averages"],
  "00180084": ["DS", "Imaging Frequency"],
  "00180085": ["SH", "Imaged Nucleus"],
  "00180086": ["IS", "Echo Number(s)"],
  "00180087": ["DS", "Magnetic Field Strength"],
  "00180088": ["DS", "Spacing Between Slices"],
  "00180091": ["IS", "Echo Train Length"],
  "00180095": ["DS", "Pixel Bandwidth"],
  "00181000": ["LO", "Device Serial Number"],
  "00181020": ["LO", "Software Versions"],
  "00181030": ["LO", "Protocol Name"],
  "00181088": ["IS", "Heart Rate"],
  "00181100": ["DS", "Reconstruction Diameter"],
  "00181110": ["DS", "Distance Source to Detector"],
  "00181111": ["DS", "Distance Source to Patient"],
  "00181120": ["DS", "Gantry/Detector Tilt"],
  "00181130": ["DS", "Table Height"],
  "00181140": ["CS", "Rotation Direction"],
  "00181150": ["IS", "Exposure Time"],
  "00181151": ["IS", "X-Ray Tube Current"],
  "00181152": ["IS", "Exposure"],
  "00181160": ["SH", "Filter Type"],
  "00181164": ["DS", "Imager Pixel Spacing"],
  "00181170": ["IS", "Generator Power"],
  "00181190": ["DS", "Focal Spot(s)"],
  "00181210": ["SH", "Convolution Kernel"],
  "00181250": ["SH", "Receive Coil Name"],
  "00181251": ["SH", "Transmit Coil Name"],
  "00181310": ["US", "Acquisition Matrix"],
  "00181312": ["CS", "In-plane Phase Encoding Direction"],
  "00181314": ["DS", "Flip Angle"],
  "00181316": ["DS", "SAR"],
  "00185100": ["CS", "Patient Position"],
  "00185101": ["CS", "View Position"],
  "00189345": ["FD", "CTDIvol"],
  "0020000D": ["UI", "Study Instance UID"],
  "0020000E": ["UI", "Series Instance UID"],
  "00200010": ["SH", "Study ID"],
  "00200011": ["IS", "Series Number"],
  "00200012": ["IS", "Acquisition Number"],
  "00200013": ["IS", "Instance Number"],
  "00200020": ["CS", "Patient Orientation"],
  "00200032": ["DS", "Image Position (Patient)"],
  "00200037": ["DS", "Image Orientation (Patient)"],
  "00200052": ["UI", "Frame of Reference UID"],
  "00200060": ["CS", "Laterality"],
  "00200062": ["CS", "Image Laterality"],
  "00201040": ["LO", "Position Reference Indicator"],
  "00201041": ["DS", "Slice Location"],
  "00204000": ["LT", "Image Comments"],
  "00280002": ["US", "Samples per Pixel"],
  "00280004": ["CS", "Photometric Interpretation"],
  "00280006": ["US", "Planar Configuration"],
  "00280008": ["IS", "Number of Frames"],
  "00280010": ["US", "Rows"],
  "00280011": ["US", "Columns"],
  "00280030": ["DS", "Pixel Spacing"],
  "00280034": ["IS", "Pixel Aspect Ratio"],
  "00280100": ["US", "Bits Allocated"],
  "00280101": ["US", "Bits Stored"],
  "00280102": ["US", "High Bit"],
  "00280103": ["US", "Pixel Representation"],
  "00280106": ["US", "Smallest Image Pixel Value"],
  "00280107": ["US", "Largest Image Pixel Value"],
  "00280120": ["US", "Pixel Padding Value"],
  "00281050": ["DS", "Window Center"],
  "00281051": ["DS", "Window Width"],
  "00281052": ["DS", "Rescale Intercept"],
  "00281053": ["DS", "Rescale Slope"],
  "00281054": ["LO", "Rescale Type"],
  "00281055": ["LO", "Window Center & Width Explanation"],
  "00282110": ["CS", "Lossy Image Compression"],
  "00282112": ["DS", "Lossy Image Compression Ratio"],
  "00282114": ["CS", "Lossy Image Compression Method"],
  "00321060": ["LO", "Requested Procedure Description"],
  "00400244": ["DA", "Performed Procedure Step Start Date"],
  "00400245": ["TM", "Performed Procedure Step Start Time"],
  "00400253": ["SH", "Performed Procedure Step ID"],
  "00400254": ["LO", "Performed Procedure Step Description"],
  "00540016": ["SQ", "Radiopharmaceutical Information Sequence"],
  "00540081": ["US", "Number of Slices"],
  "00541001": ["CS", "Units"],
  "00541002": ["CS", "Counts Source"],
  "00541102": ["CS", "Decay Correction"],
  "00181072": ["TM", "Radiopharmaceutical Start Time"],
  "00181074": ["DS", "Radionuclide Total Dose"],
  "00181075": ["DS", "Radionuclide Half Life"],
  "00080100": ["SH", "Code Value"],
  "00080102": ["SH", "Coding Scheme Designator"],
  "00080104": ["LO", "Code Meaning"],
  "7FE00010": ["OW", "Pixel Data"],
  "FFFEE000": ["", "Item"],
};

const STRING_VRS = new Set(["AE", "AS", "CS", "DA", "DS", "DT", "IS", "LO", "LT", "PN", "SH", "ST", "TM", "UC", "UI", "UR", "UT"]);
const BINARY_VRS = new Set(["OB", "OD", "OF", "OL", "OV", "OW", "UN"]);
const MAX_VALUES_SHOWN = 16;

// "x00100010" -> "(0010,0010)"
export const formatTag = (tag) => `(${tag.slice(1, 5).toUpperCase()},${tag.slice(5, 9).toUpperCase()})`;

function tagInfo(tag) {
  const key = tag.slice(1).toUpperCase();
  const known = DICTIONARY[key];
  if (known) return { vr: known[0], name: known[1] };
  const group = parseInt(key.slice(0, 4), 16);
  const element = parseInt(key.slice(4), 16);
  if (element === 0) return { vr: "UL", name: "Group Length" };
  if (group % 2 === 1) return { vr: "", name: element < 0x100 ? "Private Creator" : "Private tag", isPrivate: true };
  return { vr: "", name: "" };
}

function numbers(dataSet, tag, read, size, length) {
  const count = Math.floor(length / size);
  const values = [];
  for (let n = 0; n < Math.min(count, MAX_VALUES_SHOWN); n++) values.push(read.call(dataSet, tag, n));
  return values.join("\\") + (count > MAX_VALUES_SHOWN ? ` … (${count} values)` : "");
}

function decodeValue(dataSet, tag, element, vr) {
  if (tag === "x7fe00010") return `<pixel data, ${element.length >= 0 ? element.length.toLocaleString() + " bytes" : "encapsulated"}>`;
  if (BINARY_VRS.has(vr)) return `<binary, ${element.length.toLocaleString()} bytes>`;
  switch (vr) {
    case "US": return numbers(dataSet, tag, dataSet.uint16, 2, element.length);
    case "SS": return numbers(dataSet, tag, dataSet.int16, 2, element.length);
    case "UL": return numbers(dataSet, tag, dataSet.uint32, 4, element.length);
    case "SL": return numbers(dataSet, tag, dataSet.int32, 4, element.length);
    case "FL": return numbers(dataSet, tag, dataSet.float, 4, element.length);
    case "FD": return numbers(dataSet, tag, dataSet.double, 8, element.length);
    case "AT": {
      const group = dataSet.uint16(tag, 0);
      const el = dataSet.uint16(tag, 1);
      return group == null ? "" : `(${group.toString(16).padStart(4, "0").toUpperCase()},${el.toString(16).padStart(4, "0").toUpperCase()})`;
    }
    default: {
      if (STRING_VRS.has(vr)) return dataSet.string(tag) ?? "";
      // Unknown/private tags: text when every byte is printable (trailing NUL/space padding
      // allowed) — dataSet.string() would stop at the first NUL and hide binary data
      const bytes = dataSet.byteArray.subarray(element.dataOffset, element.dataOffset + element.length);
      const printable = element.length < 1024 && bytes.every((b, n) => (b >= 0x20 && b <= 0x7e) || (b === 0 && n === bytes.length - 1));
      return printable ? (dataSet.string(tag) ?? "") : `<${element.length.toLocaleString()} bytes>`;
    }
  }
}

// dataSet: a dicom-parser DataSet. Returns rows { tag, name, vr, value, depth, isPrivate }
// in file order; sequence items follow their sequence one level deeper.
export function listDicomTags(dataSet, depth = 0) {
  const rows = [];
  Object.keys(dataSet.elements).sort().forEach(tag => {
    const element = dataSet.elements[tag];
    const info = tagInfo(tag);
    const vr = element.vr ?? info.vr;
    if (element.items) {
      rows.push({ tag, name: info.name, vr: "SQ", value: `${element.items.length} item${element.items.length === 1 ? "" : "s"}`, depth, isPrivate: info.isPrivate });
      element.items.forEach((item, n) => {
        rows.push({ tag: "xfffee000", name: `Item ${n + 1}`, vr: "", value: "", depth: depth + 1 });
        if (item.dataSet) rows.push(...listDicomTags(item.dataSet, depth + 2));
      });
      return;
    }
    let value;
    try { value = decodeValue(dataSet, tag, element, vr); } catch (_) { value = "<unreadable>"; }
    rows.push({ tag, name: info.name, vr, value, depth, isPrivate: info.isPrivate });
  });
  return rows;
}

// The parsed header for a wadouri:… imageId (null for web: images, which have none).
// Usually already cached from display; otherwise fetched and parsed once.
export async function loadDicomDataSet(imageId) {
  if (!imageId?.startsWith("wadouri:")) return null;
  const { url } = wadouri.parseImageId(imageId);
  const cache = wadouri.dataSetCacheManager;
  if (cache.isLoaded(url)) return cache.get(url);
  return cache.load(url, undefined, imageId);
}
