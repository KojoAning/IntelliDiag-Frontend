// Reads the files out of a ZIP in the browser, for importing a zipped study. Uses the
// archive's central directory and the browser's DecompressionStream ("deflate-raw"); the
// archive is read a slice at a time, so a large one isn't loaded whole. Handles stored and
// deflated entries, including ZIP64 archives (over 4 GB or 65,535 files).

const EOCD = 0x06054b50;
const EOCD64_LOCATOR = 0x07064b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

const read = async (file, start, length) => new DataView(await file.slice(start, start + length).arrayBuffer());
const u64 = (view, at) => Number(view.getBigUint64(at, true));

async function inflateRaw(blob) {
  const stream = blob.stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).blob();
}

// [{ name, file: File }] for every file in the archive (folders and macOS metadata skipped)
export async function unzipFiles(zip) {
  // End of central directory: in the last 22–65,557 bytes
  const tailLength = Math.min(zip.size, 65557);
  const tail = await read(zip, zip.size - tailLength, tailLength);
  let eocd = -1;
  for (let i = tailLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error(`${zip.name} isn't a ZIP archive`);
  let count = tail.getUint16(eocd + 10, true);
  let dirSize = tail.getUint32(eocd + 12, true);
  let dirOffset = tail.getUint32(eocd + 16, true);

  // ZIP64: the real values are in the ZIP64 end record the locator points to
  if (eocd >= 20 && tail.getUint32(eocd - 20, true) === EOCD64_LOCATOR) {
    const record = await read(zip, u64(tail, eocd - 20 + 8), 56);
    count = u64(record, 32);
    dirSize = u64(record, 40);
    dirOffset = u64(record, 48);
  }

  const dir = await read(zip, dirOffset, dirSize);
  const decoder = new TextDecoder();
  const entries = [];
  for (let at = 0, n = 0; n < count && at + 46 <= dir.byteLength; n++) {
    if (dir.getUint32(at, true) !== CENTRAL) break;
    const method = dir.getUint16(at + 10, true);
    let compressed = dir.getUint32(at + 20, true);
    let size = dir.getUint32(at + 24, true);
    const nameLength = dir.getUint16(at + 28, true);
    const extraLength = dir.getUint16(at + 30, true);
    const commentLength = dir.getUint16(at + 32, true);
    let localOffset = dir.getUint32(at + 42, true);
    const name = decoder.decode(new Uint8Array(dir.buffer, dir.byteOffset + at + 46, nameLength));
    // ZIP64 extra field (0x0001): 64-bit values for whichever fields are 0xFFFFFFFF
    let extra = at + 46 + nameLength;
    const extraEnd = extra + extraLength;
    while (extra + 4 <= extraEnd) {
      const id = dir.getUint16(extra, true);
      const len = dir.getUint16(extra + 2, true);
      if (id === 0x0001) {
        let p = extra + 4;
        if (size === 0xffffffff) { size = u64(dir, p); p += 8; }
        if (compressed === 0xffffffff) { compressed = u64(dir, p); p += 8; }
        if (localOffset === 0xffffffff) { localOffset = u64(dir, p); }
      }
      extra += 4 + len;
    }
    entries.push({ name, method, compressed, size, localOffset });
    at += 46 + nameLength + extraLength + commentLength;
  }

  const out = [];
  for (const e of entries) {
    const base = e.name.split("/").pop();
    if (!base || e.name.endsWith("/") || e.name.startsWith("__MACOSX/") || base.startsWith("._")) continue;
    const local = await read(zip, e.localOffset, 30);
    if (local.getUint32(0, true) !== LOCAL) continue;
    const dataStart = e.localOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
    const raw = zip.slice(dataStart, dataStart + e.compressed);
    let blob;
    if (e.method === 0) blob = raw;
    else if (e.method === 8) blob = await inflateRaw(raw);
    else continue; // other compression methods aren't used for DICOM archives in practice
    out.push({ name: e.name, file: new File([blob], base) });
  }
  return out;
}

export const isZip = (file) => /\.zip$/i.test(file.name) || file.type === "application/zip" || file.type === "application/x-zip-compressed";
