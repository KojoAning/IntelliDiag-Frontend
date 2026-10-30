/* global BigInt */
// Builds a ZIP (stored, no compression — DICOM pixel data is usually compressed already)
// in the browser, for downloading a series. ZIP64 is used when it's needed (over 4 GB or
// 65,535 files).

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// files: [{ name, data: Uint8Array }] → Blob
export function zipFiles(files) {
  const encoder = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  const big = (v) => v > 0xfffffffe;
  files.forEach(({ name, data }) => {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const zip64 = big(data.length) || big(offset);
    const localExtra = zip64 ? 20 : 0;
    const local = new DataView(new ArrayBuffer(30 + nameBytes.length + localExtra));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, zip64 ? 45 : 20, true);
    local.setUint16(6, 0x0800, true);           // UTF-8 names
    local.setUint16(8, 0, true);                // stored
    local.setUint32(14, crc, true);
    local.setUint32(18, zip64 ? 0xffffffff : data.length, true);
    local.setUint32(22, zip64 ? 0xffffffff : data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, localExtra, true);
    new Uint8Array(local.buffer).set(nameBytes, 30);
    if (zip64) {
      local.setUint16(30 + nameBytes.length, 0x0001, true);
      local.setUint16(32 + nameBytes.length, 16, true);
      local.setBigUint64(34 + nameBytes.length, BigInt(data.length), true);
      local.setBigUint64(42 + nameBytes.length, BigInt(data.length), true);
    }
    parts.push(local.buffer, data);
    central.push({ nameBytes, crc, size: data.length, offset, zip64 });
    offset += local.byteLength + data.length;
  });

  const dirStart = offset;
  central.forEach(({ nameBytes, crc, size, offset: at, zip64 }) => {
    const extra = zip64 ? 28 : 0;
    const entry = new DataView(new ArrayBuffer(46 + nameBytes.length + extra));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, zip64 ? 45 : 20, true);
    entry.setUint16(6, zip64 ? 45 : 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, zip64 ? 0xffffffff : size, true);
    entry.setUint32(24, zip64 ? 0xffffffff : size, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint16(30, extra, true);
    entry.setUint32(42, zip64 ? 0xffffffff : at, true);
    new Uint8Array(entry.buffer).set(nameBytes, 46);
    if (zip64) {
      const p = 46 + nameBytes.length;
      entry.setUint16(p, 0x0001, true);
      entry.setUint16(p + 2, 24, true);
      entry.setBigUint64(p + 4, BigInt(size), true);
      entry.setBigUint64(p + 12, BigInt(size), true);
      entry.setBigUint64(p + 20, BigInt(at), true);
    }
    parts.push(entry.buffer);
    offset += entry.byteLength;
  });
  const dirSize = offset - dirStart;
  const needs64 = files.length > 0xfffe || big(dirStart) || big(dirSize);
  if (needs64) {
    const record = new DataView(new ArrayBuffer(56));
    record.setUint32(0, 0x06064b50, true);
    record.setBigUint64(4, 44n, true);
    record.setUint16(12, 45, true);
    record.setUint16(14, 45, true);
    record.setBigUint64(24, BigInt(files.length), true);
    record.setBigUint64(32, BigInt(files.length), true);
    record.setBigUint64(40, BigInt(dirSize), true);
    record.setBigUint64(48, BigInt(dirStart), true);
    const locator = new DataView(new ArrayBuffer(20));
    locator.setUint32(0, 0x07064b50, true);
    locator.setBigUint64(8, BigInt(offset), true);
    locator.setUint32(16, 1, true);
    parts.push(record.buffer, locator.buffer);
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, Math.min(files.length, 0xffff), true);
  end.setUint16(10, Math.min(files.length, 0xffff), true);
  end.setUint32(12, needs64 ? 0xffffffff : dirSize, true);
  end.setUint32(16, needs64 ? 0xffffffff : dirStart, true);
  parts.push(end.buffer);
  return new Blob(parts, { type: "application/zip" });
}
