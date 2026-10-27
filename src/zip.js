// Small uncompressed ZIP writer for exporting the public site, without a CDN.
export function createSiteZip(files) {
  const encoder = new TextEncoder();
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  const crc = bytes => { let c = 0xffffffff; for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const local = [], central = []; let offset = 0;
  const names = new Set();
  for (const file of files) {
    if (!/^[a-zA-Z0-9_.\/-]+$/.test(file.name) || file.name.startsWith('/') || file.name.split('/').includes('..') || names.has(file.name)) throw new Error('Некоректне або повторюване ім’я файла ZIP.');
    names.add(file.name);
    const name = encoder.encode(file.name), bytes = typeof file.data === 'string' ? encoder.encode(file.data) : new Uint8Array(file.data), sum = crc(bytes);
    const l = new Uint8Array(30 + name.length), lv = new DataView(l.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x800, true); lv.setUint16(12, 33, true); lv.setUint32(14, sum, true); lv.setUint32(18, bytes.length, true); lv.setUint32(22, bytes.length, true); lv.setUint16(26, name.length, true); l.set(name, 30);
    const c = new Uint8Array(46 + name.length), cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x800, true); cv.setUint16(14, 33, true); cv.setUint32(16, sum, true); cv.setUint32(20, bytes.length, true); cv.setUint32(24, bytes.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); c.set(name, 46);
    local.push(l, bytes); central.push(c); offset += l.length + bytes.length;
  }
  const centralSize = central.reduce((s, c) => s + c.length, 0), end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, files.length, true); view.setUint16(10, files.length, true); view.setUint32(12, centralSize, true); view.setUint32(16, offset, true);
  const output = new Uint8Array(offset + centralSize + 22); let pos = 0;
  for (const chunk of [...local, ...central, end]) { output.set(chunk, pos); pos += chunk.length; }
  return output;
}
