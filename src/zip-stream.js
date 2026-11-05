// v138: a small ZIP writer that streams straight to the download.
//
// Used for "Download a copy of my data". Each file is added one at a time
// and written out immediately, so only one file is ever held in memory,
// however many photos or voice messages someone has. No outside package:
// the ZIP format is simple, and Node's own zlib does the compressing.
// Photos, video and audio are stored as they are (they're already
// compressed); text is compressed.
const zlib = require('zlib');

let CRC_TABLE = null;
function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosTime(d) {
  const t = ((d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2))) & 0xffff;
  const day = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  return { t, day };
}
const ALREADY_COMPRESSED = /\.(jpe?g|png|gif|webp|heic|mp4|mov|webm|m4a|mp3|ogg|zip|pdf)$/i;

// zip = createZip(writable); zip.add('folder/name.txt', bufferOrString); ... zip.finish()
function createZip(out) {
  const entries = [];
  let offset = 0;
  const write = (buf) => new Promise((resolve, reject) => {
    offset += buf.length;
    if (out.write(buf)) return resolve();
    out.once('drain', resolve); out.once('error', reject);
  });
  const now = dosTime(new Date());
  async function add(name, data) {
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
    const nameBuf = Buffer.from(String(name).replace(/\\/g, '/').replace(/^\/+/, ''), 'utf8');
    const store = ALREADY_COMPRESSED.test(name) || raw.length < 64;
    const body = store ? raw : zlib.deflateRawSync(raw, { level: 6 });
    const method = store ? 0 : 8;
    const crc = crc32(raw);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); // UTF-8 names
    h.writeUInt16LE(method, 8); h.writeUInt16LE(now.t, 10); h.writeUInt16LE(now.day, 12);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(body.length, 18); h.writeUInt32LE(raw.length, 22);
    h.writeUInt16LE(nameBuf.length, 26); h.writeUInt16LE(0, 28);
    entries.push({ nameBuf, method, crc, csize: body.length, usize: raw.length, offset });
    await write(h); await write(nameBuf); await write(body);
  }
  async function finish() {
    const start = offset;
    for (const e of entries) {
      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8);
      c.writeUInt16LE(e.method, 10); c.writeUInt16LE(now.t, 12); c.writeUInt16LE(now.day, 14);
      c.writeUInt32LE(e.crc, 16); c.writeUInt32LE(e.csize, 20); c.writeUInt32LE(e.usize, 24);
      c.writeUInt16LE(e.nameBuf.length, 28); c.writeUInt16LE(0, 30); c.writeUInt16LE(0, 32); c.writeUInt16LE(0, 34); c.writeUInt16LE(0, 36);
      c.writeUInt32LE(0, 38); c.writeUInt32LE(e.offset, 42);
      await write(c); await write(e.nameBuf);
    }
    const size = offset - start;
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(size, 12); end.writeUInt32LE(start, 16); end.writeUInt16LE(0, 20);
    await write(end);
    out.end();
  }
  return { add, finish, count: () => entries.length };
}

module.exports = { createZip, crc32 };
