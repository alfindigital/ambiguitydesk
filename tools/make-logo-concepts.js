// Zero-dependency PNG logo concept generator — amber terminal palette.
//   node tools/make-logo-concepts.js   →  logo-concepts/A..E-512.png
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "logo-concepts");
mkdirSync(OUT, { recursive: true });

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
function png(w, h, px) {
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++)
    px.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const INK = [0x0e, 0x0b, 0x07, 0xff];
const RAISED = [0x2d, 0x25, 0x14, 0xff];
const RAISED_DIM = [0x24, 0x1e, 0x11, 0xff];
const AMBER = [0xf7, 0xad, 0x33, 0xff];
const AMBER_SOFT = [0xb4, 0x7c, 0x1e, 0xff];
const TEXT = [0xf6, 0xef, 0xdc, 0xff];

function canvas(size, bg = INK) {
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) px.set(bg, i * 4);
  return px;
}
function rr(px, w, x0, y0, rw, rh, color, radius = 6) {
  for (let y = y0; y < y0 + rh; y++)
    for (let x = x0; x < x0 + rw; x++) {
      const cx = Math.max(x0 + radius, Math.min(x0 + rw - 1 - radius, x));
      const cy = Math.max(y0 + radius, Math.min(y0 + rh - 1 - radius, y));
      const ok =
        (x >= x0 + radius && x < x0 + rw - radius && y >= y0 && y < y0 + rh) ||
        (x >= x0 && x < x0 + rw && y >= y0 + radius && y < y0 + rh - radius) ||
        (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius;
      if (ok) { const o = (y * w + x) * 4; px.set(color, o); }
    }
}
function circle(px, w, cx, cy, r, color, hollow = 0) {
  const r2 = r * r, rIn = hollow ? (r - hollow) ** 2 : -1;
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d <= r2 && d > rIn) { const o = (y * w + x) * 4; px.set(color, o); }
    }
}
function save(name, size, px) {
  writeFileSync(path.join(OUT, name), png(size, size, px));
  console.log("logo-concepts/" + name);
}

const S = 512, m = 72;

/* A — "the pick row": three candidate bars, middle amber & longest (existing motif re-paletted) */
{
  const px = canvas(S);
  const rh = 66, gap = 34;
  const rows = [
    { w: S - 2 * m, c: RAISED },
    { w: Math.round(S * 0.58), c: RAISED_DIM },
    { w: S - 2 * m, c: AMBER },
  ];
  rows.forEach((row, i) => rr(px, S, m, m + i * (rh + gap), row.w, rh, row.c, 14));
  circle(px, S, S - m - 20, m + 2 * (rh + gap) + rh / 2, 13, INK); // punched hole in amber row
  save("A-pickrow-512.png", S, px);
}

/* B — "ghost duplicate": two identical rounded squares, back ghost, front amber */
{
  const px = canvas(S);
  rr(px, S, m + 60, m - 20, S - 2 * m - 60, S - 2 * m - 60, RAISED, 40);
  rr(px, S, m - 20, m + 60, S - 2 * m - 60, S - 2 * m - 60, AMBER, 40);
  save("B-ghost-512.png", S, px);
}

/* C — "fork": one bar splits into two — ticker collision */
{
  const px = canvas(S);
  const bw = 60;
  rr(px, S, m, S / 2 - bw / 2, S / 2 - m - bw / 2, bw, AMBER, 20);            // stem
  // two diverging bars to the right
  for (const dir of [-1, 1]) {
    const y0 = S / 2 + dir * 52 - bw / 2;
    const x0 = S / 2 - bw / 2;
    // diagonal bar approximated by steps
    for (let i = 0; i < 170; i += 8) {
      rr(px, S, x0 + i, Math.round(y0 + dir * i * 0.55), 34, bw, dir < 0 ? AMBER_SOFT : RAISED, 14);
    }
  }
  save("C-fork-512.png", S, px);
}

/* D — "scanner": candidate rows under a magnifier ring */
{
  const px = canvas(S);
  const rh = 56, gap = 26;
  for (let i = 0; i < 4; i++)
    rr(px, S, m, m + i * (rh + gap), (i % 2 ? 0.62 : 1) * (S - 2 * m), rh, i === 2 ? AMBER : RAISED, 12);
  circle(px, S, S - m - 30, m + 2 * (rh + gap) + rh / 2, 90, TEXT, 12);      // ring
  rr(px, S, S - m + 20, m + 2 * (rh + gap) + 68, 26, 90, TEXT, 10);           // handle
  save("D-scanner-512.png", S, px);
}

/* E — "stamp check": amber block with a check cut out */
{
  const px = canvas(S);
  rr(px, S, m, m, S - 2 * m, S - 2 * m, AMBER, 48);
  // check mark as thick polyline
  const pts = [];
  for (let t = 0; t <= 1; t += 0.01) pts.push([m + 120 + t * 90, m + 210 + t * 90]);
  for (let t = 0; t <= 1; t += 0.01) pts.push([m + 210 + t * 130, m + 300 - t * 150]);
  for (const [x, y] of pts) circle(px, S, x, y, 16, INK);
  save("E-check-512.png", S, px);
}
