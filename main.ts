// THE WORLD TODAY — Monday 23 November 2026.
// A Node 22+ program (standard library only) that draws a 1024x1024
// newspaper front page and writes it to $MAKEFUN_OUTPUT_DIR/entry.png.
// No network, no external images, no Date.now, no Math.random:
// every run writes byte-identical output.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;
const PAPER = [247, 242, 227];
const INK = [17, 17, 17];
const RED = [140, 29, 24];
const GREY = [96, 92, 80];
const MAPFILL = [233, 224, 196];

const buf = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  buf[i * 3] = PAPER[0];
  buf[i * 3 + 1] = PAPER[1];
  buf[i * 3 + 2] = PAPER[2];
}

function setPixel(x, y, c) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] = c[0];
  buf[o + 1] = c[1];
  buf[o + 2] = c[2];
}

function fillRect(x, y, w, h, c) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const o = (yy * W + xx) * 3;
      buf[o] = c[0];
      buf[o + 1] = c[1];
      buf[o + 2] = c[2];
    }
  }
}

function hline(x, y, w, c, t = 1) {
  fillRect(x, y, w, t, c);
}

function vline(x, y, h, c, t = 1) {
  fillRect(x, y, t, h, c);
}

function line(x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPixel(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function rectOutline(x, y, w, h, c, t = 1) {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

function polygonOutline(pts, c) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    line(a[0], a[1], b[0], b[1], c);
  }
}

function fillPolygon(pts, c) {
  let minY = H;
  let maxY = 0;
  for (const p of pts) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const x0 = Math.max(0, Math.ceil(xs[i]));
      const x1 = Math.min(W - 1, Math.floor(xs[i + 1]));
      for (let x = x0; x <= x1; x++) setPixel(x, y, c);
    }
  }
}

function star(cx, cy, r, c) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const ang = (-90 + i * 36) * (Math.PI / 180);
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push([
      Math.round(cx + rr * Math.cos(ang)),
      Math.round(cy + rr * Math.sin(ang)),
    ]);
  }
  fillPolygon(pts, c);
  polygonOutline(pts, INK);
}

// ---- PNG encoding (8-bit RGB, filter 0) ----

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([td, data])));
  return Buffer.concat([len, td, data, crc]);
}

function encodePNG() {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- 5x7 bitmap font. Each glyph is 7 rows; bit 4 is the left pixel. ----
const FONT = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  a: [0x00, 0x00, 0x0e, 0x01, 0x0f, 0x11, 0x0f],
  b: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x1e],
  c: [0x00, 0x00, 0x0e, 0x11, 0x10, 0x11, 0x0e],
  d: [0x01, 0x01, 0x0f, 0x11, 0x11, 0x11, 0x0f],
  e: [0x00, 0x00, 0x0e, 0x11, 0x1f, 0x10, 0x0e],
  f: [0x06, 0x09, 0x08, 0x1e, 0x08, 0x08, 0x08],
  g: [0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  h: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x11],
  i: [0x04, 0x00, 0x0c, 0x04, 0x04, 0x04, 0x0e],
  j: [0x02, 0x00, 0x06, 0x02, 0x02, 0x02, 0x12],
  k: [0x10, 0x10, 0x12, 0x14, 0x18, 0x14, 0x12],
  l: [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  m: [0x00, 0x00, 0x1a, 0x15, 0x15, 0x15, 0x15],
  n: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x11, 0x11],
  o: [0x00, 0x00, 0x0e, 0x11, 0x11, 0x11, 0x0e],
  p: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x1e, 0x10],
  q: [0x00, 0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01],
  r: [0x00, 0x00, 0x16, 0x19, 0x10, 0x10, 0x10],
  s: [0x00, 0x00, 0x0f, 0x10, 0x0e, 0x01, 0x1e],
  t: [0x04, 0x04, 0x1f, 0x04, 0x04, 0x04, 0x03],
  u: [0x00, 0x00, 0x11, 0x11, 0x11, 0x13, 0x0d],
  v: [0x00, 0x00, 0x11, 0x11, 0x11, 0x0a, 0x04],
  w: [0x00, 0x00, 0x11, 0x11, 0x15, 0x15, 0x0a],
  x: [0x00, 0x00, 0x11, 0x11, 0x0a, 0x11, 0x11],
  y: [0x00, 0x00, 0x11, 0x11, 0x11, 0x0f, 0x01],
  z: [0x00, 0x00, 0x1f, 0x02, 0x04, 0x08, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  "-": [0, 0, 0, 0x1f, 0, 0, 0],
  "—": [0, 0, 0, 0x1f, 0, 0, 0],
  "–": [0, 0, 0, 0x1f, 0, 0, 0],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  "’": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '"': [0x0a, 0x0a, 0x0a, 0, 0, 0, 0],
  "%": [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "€": [0x06, 0x09, 0x10, 0x1e, 0x10, 0x09, 0x06],
  "$": [0x04, 0x0e, 0x15, 0x0e, 0x15, 0x0e, 0x04],
  "•": [0, 0, 0x0e, 0x11, 0x11, 0x0e, 0],
  "ł": [0x0c, 0x04, 0x04, 0x0e, 0x04, 0x04, 0x0e],
  "[": [0x0e, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0e],
  "]": [0x0e, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0e],
  "*": [0, 0x04, 0x15, 0x0e, 0x15, 0x04, 0],
  "#": [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
};

// ---- Text helpers ----

function textWidth(s, scale) {
  return s.length * 6 * scale;
}

function drawChar(x, y, ch, scale, c) {
  const g = FONT[ch] || FONT[" "];
  for (let r = 0; r < 7; r++) {
    const row = g[r];
    for (let col = 0; col < 5; col++) {
      if ((row >> (4 - col)) & 1) fillRect(x + col * scale, y + r * scale, scale, scale, c);
    }
  }
}

function drawText(x, y, s, scale, c) {
  let cx = x;
  for (const ch of s) {
    drawChar(cx, y, ch, scale, c);
    cx += 6 * scale;
  }
  return cx;
}

function drawCentered(cx, y, s, scale, c) {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}

function wrapText(s, maxWidth, scale) {
  const maxChars = Math.max(1, Math.floor(maxWidth / (6 * scale)));
  const words = s.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const trial = line ? line + " " + w : w;
    if (trial.length <= maxChars) {
      line = trial;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrapped(x, y, s, scale, c, maxWidth, pitch) {
  const lines = wrapText(s, maxWidth, scale);
  for (let i = 0; i < lines.length; i++) {
    drawText(x, y + i * pitch, lines[i], scale, c);
  }
  return y + lines.length * pitch;
}

// ---- Page copy (all facts from SPEC.md) ----

const LEAD_KICKER = "NATO COUNCIL MEETS IN BRUSSELS TODAY";
const LEAD_HEADLINE = "NATO MEETS TODAY OVER POLAND MISSILE INCURSION";
const LEAD_STANDFIRST =
  "The North Atlantic Council holds an extraordinary meeting in Brussels today after three Russian weapons came down in south-east Poland on 20 November during a mass strike on Ukraine.";
const LEAD_BODY =
  "A Kh-101 cruise missile was confirmed near Nowy Lipowiec; two more objects fell near Rudnik nad Sanem and Mo\u0142odycz. Poland has asked NATO for more air defences \u2014 AWACS surveillance aircraft and F-35 jets \u2014 under Operation Eastern Sentry. Prime Minister Donald Tusk called the incursion an intentional provocation. NATO chief Mark Rutte pledged the alliance would defend every inch of Poland.";

const STORIES = [
  {
    h: "COP31 COLLAPSES WITH NO DEAL",
    b: "The UN climate talks in Antalya ended on Sunday with no cover decision after the EU and others rejected a final draft that made no mention of fossil fuels. The summit ran 44-48 hours into overtime, the longest ever; COP31 president Murat Kurum conceded there was no consensus.",
  },
  {
    h: "IRAN HITS BAHRAIN",
    b: "On Saturday the IRGC launched a missile-and-drone attack on US military positions in Bahrain, home of the US Navy's Fifth Fleet; a civilian industrial facility on Sitra Island caught fire. Bahrain said two people were injured, one in critical condition. Saudi Arabia, Kuwait and Qatar condemned the attack.",
  },
  {
    h: "DRONE HITS FLAT IN KYIV REGION",
    b: "On Sunday a Russian drone struck a five-storey residential building in Dymer, north of Kyiv; part of the building collapsed. President Zelenskyy said 14 people were unaccounted for; nine were evacuated and two, including a teenager, were injured.",
  },
  {
    h: "FT LINKS ALICE HUANG TO CHIP NETWORK",
    b: "REPORT: A Financial Times investigation links Alice Huang, the former Megaspeed executive at the centre of the Nvidia scandal, to a network moving restricted AI chips to China-based users. REPORT: The Information said it moved about 240,000 banned chips worth $7.5bn. Nvidia says its shipments were legal and authorised; no charges have been reported.",
  },
  {
    h: "EU AND INDONESIA SIGN TRADE DEAL",
    b: "After ten years of talks the two sides signed a Comprehensive Economic Partnership Agreement (CEPA) removing 98.5% of tariffs, worth an estimated \u20ac650m a year in duty savings for EU exporters.",
  },
  {
    h: "BOLSONARO IN INTENSIVE CARE",
    b: "Brazil's former president, 71, was admitted to the DF Star hospital in Brasilia with an acute bowel obstruction on Friday. The hospital says he is clinically stable, conscious and breathing on his own, with no discharge date set. He is serving a 27-year sentence for plotting a coup.",
  },
];

const TICKER_1 = "BAYELSA BOAT CAPSIZE KILLS AT LEAST 24 \u2014 FRANCE: 82,500 AT PROTESTS";
const TICKER_2 = "UK AND EU AGREE BREXIT RESET DEAL ON FOOD, CARBON AND YOUTH MOBILITY";

const SOURCES =
  "Sources: EU Today; EuropeSays (AFP); EU Insider; Army Recognition; AP; phys.org; Seoul Economic Daily (Reuters); Helsinki Times; Reuters; ABC News; Times of Israel; Gulf News; Brussels Reporter; Particle News; Financial Times; Bloomberg; The Information; European Commission; Cutthroat News; Al Jazeera; LaPresse.";

// Rough outline of Poland, in page coordinates.
const POLAND = [
  [668, 190], [700, 170], [760, 168], [830, 172], [900, 180],
  [950, 196], [968, 230], [960, 280], [940, 330], [930, 380],
  [905, 420], [860, 432], [800, 428], [740, 420], [690, 400],
  [668, 360], [655, 300], [650, 240],
];

function buildPage() {
  // Frame.
  rectOutline(14, 14, 996, 996, INK, 2);
  rectOutline(20, 20, 984, 984, INK, 1);

  // Masthead.
  drawCentered(512, 36, "THE WORLD TODAY", 7, INK);
  hline(30, 96, 964, INK, 2);
  drawCentered(512, 104, "MONDAY 23 NOVEMBER 2026", 2, INK);
  hline(30, 124, 964, INK, 1);

  // ---- Lead story (left column) ----
  drawText(30, 136, LEAD_KICKER, 2, RED);
  drawWrapped(30, 162, LEAD_HEADLINE, 3, INK, 590, 26);
  drawWrapped(30, 224, LEAD_STANDFIRST, 2, INK, 590, 20);
  drawWrapped(30, 316, LEAD_BODY, 1, INK, 590, 12);

  // Pull line.
  rectOutline(30, 378, 590, 58, RED, 2);
  drawCentered(325, 390, "DEFEND EVERY INCH OF POLAND", 2, RED);
  drawCentered(325, 414, "\u2014 NATO CHIEF MARK RUTTE", 1, INK);

  // ---- Map (right column) ----
  drawText(640, 136, "THREE IMPACT SITES \u2014 SOUTH-EAST POLAND", 1, RED);
  rectOutline(640, 156, 354, 284, INK, 1);
  fillPolygon(POLAND, MAPFILL);
  polygonOutline(POLAND, INK);
  drawText(768, 232, "POLAND", 2, INK);
  // Stars, south-east, with labels placed above-left of each star.
  star(856, 402, 6, RED);
  drawText(772, 386, "NOWY LIPOWIEC", 1, INK);
  star(878, 372, 6, RED);
  drawText(782, 354, "RUDNIK NAD SANEM", 1, INK);
  star(912, 396, 6, RED);
  drawText(862, 380, "MO\u0141ODYCZ", 1, INK);
  drawText(918, 424, "UKRAINE", 1, INK);
  drawText(640, 448, "IMPACT SITES, 20 NOVEMBER \u2014 KH-101 AND TWO MORE OBJECTS", 1, GREY);

  // ---- Story grid: 2 columns x 3 rows ----
  hline(30, 478, 964, INK, 2);
  const cols = [30, 520];
  const rows = [492, 624, 756];
  for (let i = 0; i < 6; i++) {
    const x = cols[i % 2];
    const y = rows[Math.floor(i / 2)];
    rectOutline(x, y, 474, 120, INK, 1);
    const headLines = wrapText(STORIES[i].h, 454, 2);
    drawWrapped(x + 10, y + 8, STORIES[i].h, 2, INK, 454, 18);
    const bodyY = y + 8 + headLines.length * 18 + 4;
    drawWrapped(x + 10, bodyY, STORIES[i].b, 1, INK, 454, 12);
  }

  // ---- Latest-news ticker ----
  fillRect(30, 890, 964, 54, INK);
  fillRect(40, 900, 8, 8, RED);
  drawText(56, 898, TICKER_1, 2, PAPER);
  fillRect(40, 922, 8, 8, RED);
  drawText(56, 920, TICKER_2, 2, PAPER);

  // ---- Sources footer ----
  drawWrapped(30, 956, SOURCES, 1, GREY, 964, 12);
}

function main() {
  buildPage();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, encodePNG());
  console.log("wrote " + outPath);
}

main();
