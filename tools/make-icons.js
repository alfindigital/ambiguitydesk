// Zero-dependency PNG icon generator.
// Motif: the collision table itself. Three candidate rows on desk ink;
// the middle row is the accent pick and reaches further right.
//   node tools/make-icons.js
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "icons");

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, px) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    px.copyWithin?.(0, 0);
    px.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const INK = [0x0b, 0x0c, 0x0a, 0xff];
const RAISED = [0x1a, 0x1e, 0x15, 0xff];
const ACCENT = [0x3d, 0xd6, 0x8c, 0xff];
const PAPER = [0xea, 0xe8, 0xda, 0xff];

function roundedRect(px, w, h, x0, y0, rw, rh, color, radius) {
  for (let y = y0; y < y0 + rh; y++) {
    for (let x = x0; x < x0 + rw; x++) {
      const cx = Math.max(x0 + radius, Math.min(x0 + rw - 1 - radius, x));
      const cy = Math.max(y0 + radius, Math.min(y0 + rh - 1 - radius, y));
      const inCore = x >= x0 + radius && x < x0 + rw - radius && y >= y0 && y < y0 + rh;
      const inVCore = x >= x0 && x < x0 + rw && y >= y0 + radius && y < y0 + rh - radius;
      if (inCore || inVCore || (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) {
        const o = (y * w + x) * 4;
        px[o] = color[0]; px[o + 1] = color[1]; px[o + 2] = color[2]; px[o + 3] = color[3];
      }
    }
  }
}

function icon(size, file) {
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) px.set(INK, i * 4);
  const m = Math.round(size * 0.14);          // margin
  const rowH = Math.round(size * 0.15);       // row height
  const gap = Math.round(size * 0.07);
  const r = Math.round(size * 0.04);
  // three candidate rows; the middle one is the pick, accent and longer
  const rows = [
    { y: m + 0 * (rowH + gap), w: size - 2 * m, color: RAISED },
    { y: m + 1 * (rowH + gap), w: Math.round(size * 0.62), color: RAISED },
    { y: m + 2 * (rowH + gap), w: size - 2 * m, color: ACCENT },
  ];
  for (const row of rows) roundedRect(px, size, size, m, row.y, row.w, rowH, row.color, r);
  // desk dot: paper chip on the pick row
  const d = Math.round(size * 0.09);
  roundedRect(px, size, size, size - m - d, m + 2 * (rowH + gap) + Math.round((rowH - d) / 2), d, d, PAPER, d / 2);
  writeFileSync(path.join(OUT, file), png(size, size, px));
  console.log("icons/" + file, size + "x" + size);
}

mkdirSync(OUT, { recursive: true });
icon(512, "icon-512.png");
icon(192, "icon-192.png");
icon(180, "icon-180.png");
icon(32, "favicon-32.png");
