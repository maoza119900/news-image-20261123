// THE WORLD TODAY — Monday 23 November 2026
// A newspaper front page drawn from scratch with the Node 22 standard
// library only. No network, no external images, no clock, no randomness:
// two runs write byte-identical PNG files.
//
// Run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Output: $MAKEFUN_OUTPUT_DIR/entry.png  (default: /output/entry.png)

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

const PAPER = [247, 243, 232];
const INK = [24, 24, 24];
const SOFT = [74, 72, 66];
const RED = [168, 18, 18];
const DARKRED = [120, 10, 10];
const BLUE = [28, 63, 110];
const SKY = [198, 214, 232];
const SAND = [232, 226, 208];
const WHITE = [255, 255, 255];
const GOLD = [176, 124, 24];
const GREEN = [36, 110, 60];

function setPx(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function fillRect(x, y, w, h, c) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
    }
  }
}

function hline(x0, x1, y, c, th) {
  const t = th || 1;
  for (let k = 0; k < t; k++) {
    for (let x = x0; x <= x1; x++) setPx(x, y + k, c);
  }
}

function vline(x, y0, y1, c, th) {
  const t = th || 1;
  for (let k = 0; k < t; k++) {
    for (let y = y0; y <= y1; y++) setPx(x + k, y, c);
  }
}

function rect(x, y, w, h, c, th) {
  const t = th || 1;
  hline(x, x + w - 1, y, c, t);
  hline(x, x + w - 1, y + h - t, c, t);
  vline(x, y, y + h - 1, c, t);
  vline(x + w - t, y, y + h - 1, c, t);
}

// Bresenham line.
function line(x0, y0, x1, y1, c, th) {
  const t = th || 1;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    if (t === 1) setPx(x, y, c);
    else fillRect(x - ((t / 2) | 0), y - ((t / 2) | 0), t, t, c);
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

function dashedLine(x0, y0, x1, y1, c) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    if (((i / 6) | 0) % 2 === 0) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps);
      const y = Math.round(y0 + ((y1 - y0) * i) / steps);
      setPx(x, y, c);
      setPx(x + 1, y, c);
    }
  }
}

function fillCircle(cx, cy, r, c) {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) setPx(cx + x, cy + y, c);
  }
}

function circle(cx, cy, r, c) {
  let x = r;
  let y = 0;
  let err = 0;
  while (x >= y) {
    setPx(cx + x, cy + y, c);
    setPx(cx + y, cy + x, c);
    setPx(cx - y, cy + x, c);
    setPx(cx - x, cy + y, c);
    setPx(cx - x, cy - y, c);
    setPx(cx - y, cy - x, c);
    setPx(cx + y, cy - x, c);
    setPx(cx + x, cy - y, c);
    y += 1;
    err += 1 + 2 * y;
    if (2 * (err - x) + 1 > 0) {
      x -= 1;
      err += 1 - 2 * x;
    }
  }
}

function fillPoly(pts, c) {
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
        xs.push(Math.round(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = xs[k]; x <= xs[k + 1]; x++) setPx(x, y, c);
    }
  }
}

function poly(pts, c, th) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    line(a[0], a[1], b[0], b[1], c, th || 1);
  }
}

// Four-point star (compass rose / map marker).
function star(cx, cy, r, c) {
  fillPoly(
    [
      [cx, cy - r],
      [cx + ((r * 2) / 7) | 0, cy - ((r * 2) / 7) | 0],
      [cx + r, cy],
      [cx + ((r * 2) / 7) | 0, cy + ((r * 2) / 7) | 0],
      [cx, cy + r],
      [cx - ((r * 2) / 7) | 0, cy + ((r * 2) / 7) | 0],
      [cx - r, cy],
      [cx - ((r * 2) / 7) | 0, cy - ((r * 2) / 7) | 0],
    ],
    c
  );
  fillCircle(cx, cy, Math.max(1, (r / 4) | 0), WHITE);
}

// ------------------------------------------------------------------- font
// Hand-drawn 5x7 bitmap glyphs. '#' is ink, '.' is blank.
const GLYPHS = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  a: [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
  b: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "####."],
  c: [".....", ".....", ".####", "#....", "#....", "#....", ".####"],
  d: ["....#", "....#", ".####", "#...#", "#...#", "#...#", ".####"],
  e: [".....", ".....", ".###.", "#...#", "#####", "#....", ".###."],
  f: ["..##.", ".#...", ".#...", "####.", ".#...", ".#...", ".#..."],
  g: [".....", ".####", "#...#", "#...#", ".####", "....#", ".###."],
  h: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "#...#"],
  i: [".....", "..#..", ".....", ".##..", "..#..", "..#..", ".###."],
  j: [".....", "...#.", ".....", "..##.", "...#.", "...#.", ".##.."],
  k: ["#....", "#....", "#..#.", "#.#..", "##...", "#.#..", "#..#."],
  l: [".##..", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  m: [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
  n: [".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#"],
  o: [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
  p: [".....", "####.", "#...#", "#...#", "####.", "#....", "#...."],
  q: [".....", ".####", "#...#", "#...#", ".####", "....#", "....#"],
  r: [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
  s: [".....", ".....", ".####", "#....", ".###.", "....#", "####."],
  t: [".#...", ".#...", "####.", ".#...", ".#...", ".#...", "..##."],
  u: [".....", ".....", "#...#", "#...#", "#...#", "#...#", ".###."],
  v: [".....", ".....", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  w: [".....", ".....", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  x: [".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  y: [".....", ".....", "#...#", "#...#", ".####", "....#", ".###."],
  z: [".....", ".....", "#####", "...#.", "..#..", ".#...", "#####"],
  "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  "'": ["..#..", "..#..", "..#..", ".....", ".....", ".....", "....."],
  '"': [".#.#.", ".#.#.", ".#.#.", ".....", ".....", ".....", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "/": ["....#", "....#", "...#.", "...#.", "..#..", ".#...", "#...."],
  "%": ["#...#", "#..#.", "...#.", "..#..", ".#...", "#..#.", "#...#"],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "+": [".....", "..#..", "..#..", ".###.", "..#..", "..#..", "....."],
  "=": [".....", ".....", ".###.", ".....", ".###.", ".....", "....."],
  "—": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
};

function glyphOf(ch) {
  return GLYPHS[ch] || GLYPHS["?"];
}

function drawChar(ch, x, y, s, c) {
  const g = glyphOf(ch);
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r][col] === "#") fillRect(x + col * s, y + r * s, s, s, c);
    }
  }
}

// Advance per character is 6*s; a space advances the same.
function textWidth(t, s) {
  if (t.length === 0) return 0;
  return t.length * 6 * s - s;
}

function drawText(t, x, y, s, c, bold) {
  let cx = x;
  for (const ch of t) {
    if (ch !== " ") {
      drawChar(ch, cx, y, s, c);
      if (bold && s >= 2) drawChar(ch, cx + 1, y, s, c);
    }
    cx += 6 * s;
  }
  return cx;
}

function drawTextCentered(t, cx, y, s, c, bold) {
  drawText(t, cx - ((textWidth(t, s) / 2) | 0), y, s, c, bold);
}

function wrapWords(t, maxW, s) {
  const words = t.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, s) <= maxW || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// Draw wrapped text; returns the y just below the last line.
function para(t, x, y, maxW, s, c, leading, bold) {
  const lines = wrapWords(t, maxW, s);
  const step = 7 * s + (leading === undefined ? 4 : leading);
  for (let i = 0; i < lines.length; i++) {
    drawText(lines[i], x, y + i * step, s, c, bold);
  }
  return y + lines.length * step;
}

// ------------------------------------------------------------------- icons
// Each icon draws inside a small square at (x, y) with side `s` (~30px).

function iconGlobe(x, y, s) {
  const u = s / 30;
  circle(x + 15 * u, y + 15 * u, 12 * u, BLUE);
  fillCircle(x + 11 * u, y + 11 * u, 3 * u, BLUE);
  fillCircle(x + 19 * u, y + 19 * u, 4 * u, BLUE);
  line(x + 3 * u, y + 15 * u, x + 27 * u, y + 15 * u, BLUE, 1);
  line(x + 15 * u, y + 3 * u, x + 15 * u, y + 27 * u, BLUE, 1);
}

function iconFlame(x, y, s) {
  const u = s / 30;
  fillPoly(
    [
      [x + 15 * u, y + 2 * u],
      [x + 24 * u, y + 14 * u],
      [x + 20 * u, y + 24 * u],
      [x + 10 * u, y + 24 * u],
      [x + 6 * u, y + 14 * u],
    ],
    RED
  );
  fillPoly(
    [
      [x + 15 * u, y + 12 * u],
      [x + 20 * u, y + 20 * u],
      [x + 15 * u, y + 24 * u],
      [x + 10 * u, y + 20 * u],
    ],
    GOLD
  );
  hline(x + 4 * u, x + 26 * u, y + 27 * u, INK, 2);
}

function iconBuilding(x, y, s) {
  const u = s / 30;
  // A five-storey block with its top corner broken off.
  fillPoly(
    [
      [x + 6 * u, y + 4 * u],
      [x + 24 * u, y + 4 * u],
      [x + 24 * u, y + 26 * u],
      [x + 6 * u, y + 26 * u],
    ],
    SOFT
  );
  fillPoly(
    [
      [x + 6 * u, y + 4 * u],
      [x + 13 * u, y + 8 * u],
      [x + 10 * u, y + 12 * u],
      [x + 6 * u, y + 10 * u],
    ],
    PAPER
  );
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      fillRect(x + (9 + c * 5) * u, y + (7 + r * 5) * u, 3 * u, 3 * u, PAPER);
    }
  }
  fillCircle(x + 10 * u, y + 28 * u, 1 * u, INK);
  fillCircle(x + 16 * u, y + 28 * u, 1 * u, INK);
  fillCircle(x + 22 * u, y + 28 * u, 1 * u, INK);
}

function iconChip(x, y, s) {
  const u = s / 30;
  rect(x + 7 * u, y + 7 * u, 16 * u, 16 * u, INK, 2);
  fillRect(x + 11 * u, y + 11 * u, 8 * u, 8 * u, BLUE);
  for (let i = 0; i < 4; i++) {
    const p = (9 + i * 4) * u;
    vline(x + p, y + 2 * u, y + 6 * u, INK, 1);
    vline(x + p, y + 24 * u, y + 28 * u, INK, 1);
    hline(x + 2 * u, x + 6 * u, y + p, INK, 1);
    hline(x + 24 * u, x + 28 * u, y + p, INK, 1);
  }
}

function iconTrade(x, y, s) {
  const u = s / 30;
  // Two overlapping circles (two partners) with a rising arrow.
  circle(x + 11 * u, y + 15 * u, 8 * u, BLUE);
  circle(x + 19 * u, y + 15 * u, 8 * u, GOLD);
  line(x + 4 * u, y + 24 * u, x + 26 * u, y + 8 * u, RED, 2);
  fillPoly(
    [
      [x + 26 * u, y + 8 * u],
      [x + 19 * u, y + 8 * u],
      [x + 26 * u, y + 15 * u],
    ],
    RED
  );
}

function iconCross(x, y, s) {
  const u = s / 30;
  fillCircle(x + 15 * u, y + 15 * u, 13 * u, RED);
  fillRect(x + 13 * u, y + 7 * u, 4 * u, 16 * u, WHITE);
  fillRect(x + 7 * u, y + 13 * u, 16 * u, 4 * u, WHITE);
}

const ICONS = {
  globe: iconGlobe,
  flame: iconFlame,
  building: iconBuilding,
  chip: iconChip,
  trade: iconTrade,
  cross: iconCross,
};

// ------------------------------------------------------------ situation map
function drawMap(x, y, w, h) {
  rect(x, y, w, h, INK, 2);
  drawTextCentered("THREE IMPACT SITES", x + (w / 2) | 0, y + 10, 2, RED, true);
  hline(x + 10, x + w - 11, y + 34, INK, 1);

  // Map area below the title.
  const mx = x + 12;
  const my = y + 44;
  const mw = w - 24;
  const mh = h - 122;

  drawText("BALTIC SEA", mx + 66, my + 2, 1, BLUE, false);
  // Schematic outline of Poland.
  const outline = [
    [mx + 18, my + 56],
    [mx + 66, my + 16],
    [mx + 132, my + 8],
    [mx + 202, my + 24],
    [mx + 242, my + 48],
    [mx + 230, my + 92],
    [mx + 254, my + 126],
    [mx + 222, my + 158],
    [mx + 188, my + 178],
    [mx + 122, my + 174],
    [mx + 74, my + 158],
    [mx + 28, my + 130],
    [mx + 12, my + 92],
  ];
  fillPoly(outline, SKY);
  poly(outline, INK, 2);

  // Neighbours.
  drawText("GERMANY", mx + 2, my + 122, 1, SOFT, false);
  drawText("UKRAINE", mx + 262, my + 116, 1, SOFT, false);

  // Warsaw.
  const wx = mx + 140;
  const wy = my + 98;
  fillCircle(wx, wy, 4, INK);
  drawText("WARSAW", wx + 8, wy - 3, 1, INK, true);

  // Impact site 1: Nowy Lipowiec, north-east.
  const s1x = mx + 214;
  const s1y = my + 52;
  star(s1x, s1y, 9, RED);
  drawText("NOWY", s1x - 62, s1y - 22, 1, RED, true);
  drawText("LIPOWIEC", s1x - 62, s1y - 14, 1, RED, true);

  // Impact site 2: Rudnik nad Sanem, south.
  const s2x = mx + 178;
  const s2y = my + 140;
  star(s2x, s2y, 9, RED);
  drawText("RUDNIK NAD", s2x - 72, s2y - 3, 1, RED, true);
  drawText("SANEM", s2x - 72, s2y + 5, 1, RED, true);

  // Impact site 3: Molodycz, east. The star sits on the eastern border,
  // so the label goes inside the polygon, above-left of the star, clear
  // of the border, the dashed flight path and the UKRAINE neighbour label.
  const s3x = mx + 228;
  const s3y = my + 92;
  star(s3x, s3y, 9, RED);
  drawText("MOLODYCZ", s3x - 62, s3y - 26, 1, RED, true);

  // Dashed flight path from the east.
  dashedLine(mx + mw - 2, my + 78, s3x + 12, s3y + 4, RED);

  // Caption under the map.
  hline(x + 10, x + w - 11, y + h - 62, INK, 1);
  para(
    "Two missiles and a jet-powered drone came down in south-east Poland on 20 November, 30-50 km from Ukraine.",
    x + 12,
    y + h - 54,
    w - 24,
    1,
    INK,
    3
  );
}

// ------------------------------------------------------------------ stories
const LEAD = {
  kicker: "BRUSSELS  —  NATO",
  headline: "NATO MEETS TODAY OVER POLAND MISSILE STRIKE",
  standfirst:
    "Council in Brussels as Warsaw seeks more air defences; Rutte vows to defend Poland.",
  body:
    "The North Atlantic Council holds an extraordinary meeting in Brussels today after three Russian weapons came down in south-east Poland on 20 November during a mass strike on Ukraine. Poland asks NATO for more air defences. PM Tusk calls it an intentional provocation.",
  next: "TODAY: NATO council meets in Brussels.",
};

const STORIES = [
  {
    kicker: "CLIMATE",
    icon: "globe",
    headline: "COP31 COLLAPSES WITH NO DEAL AS EU REJECTS TEXT",
    body:
      "The Antalya talks ended on Sunday with no cover decision after the EU rejected a draft that made no mention of fossil fuels. The summit ran about 48 hours into overtime.",
  },
  {
    kicker: "BAHRAIN",
    icon: "flame",
    headline: "IRAN HITS BAHRAIN: US BASES TARGETED, TWO HURT",
    body:
      "The IRGC launched a missile-and-drone attack on US positions in Bahrain on Saturday. A civilian plant on Sitra Island caught fire; two people were hurt, one critically.",
  },
  {
    kicker: "UKRAINE",
    icon: "building",
    headline: "DRONE HITS KYIV FLAT, 14 STILL MISSING",
    body:
      "A Russian drone struck a five-storey block in Dymer, north of Kyiv, on Sunday. Part of it collapsed; nine were evacuated and two, including a teenager, were hurt.",
  },
  {
    kicker: "TECH",
    icon: "chip",
    headline: "FT LINKS ALICE HUANG TO CHIP-SMUGGLING RING",
    body:
      "REPORT: the FT found the ex-Megaspeed chief tied to a network moving restricted AI chips to China. Nvidia says its shipments were legal; no charges have been reported.",
  },
  {
    kicker: "TRADE",
    icon: "trade",
    headline: "EU AND INDONESIA SIGN LANDMARK TRADE DEAL",
    body:
      "After ten years of talks the two sides signed a pact removing 98.5% of tariffs, worth an estimated EUR 650m a year in duty savings for EU exporters.",
  },
  {
    kicker: "BRAZIL",
    icon: "cross",
    headline: "BOLSONARO IN INTENSIVE CARE WITH BOWEL BLOCKAGE",
    body:
      "The ex-president, 71, was admitted in Brasilia on Friday with an acute bowel obstruction. The hospital says he is stable and breathing on his own.",
  },
];

const TICKER_A = "LATEST: BOAT CAPSIZES IN NIGERIA, AT LEAST 24 DEAD";
const TICKER_B = "FRANCE: 82,500 MARCH IN 6TH WEEKEND OF PROTESTS — UK-EU RESET DEAL";
const FOOTER =
  "Sources: Reuters, AP, AFP, Financial Times, Bloomberg, European Commission, Al Jazeera — All stories reported 20-23 November 2026.";

// -------------------------------------------------------------------- page
function drawPage() {
  fillRect(0, 0, W, H, PAPER);
  // Frame.
  rect(8, 8, W - 16, H - 16, INK, 2);

  // Masthead.
  drawTextCentered("THE WORLD TODAY", W / 2, 24, 7, INK, true);
  hline(28, W - 29, 84, INK, 1);
  drawText("WORLD EDITION", 28, 94, 2, SOFT, false);
  drawTextCentered("MONDAY, 23 NOVEMBER 2026", W / 2, 94, 2, RED, true);
  drawText("No. 327", W - 28 - textWidth("No. 327", 2), 94, 2, SOFT, false);
  hline(28, W - 29, 116, INK, 3);
  hline(28, W - 29, 121, INK, 1);

  // ---- Lead story (left) + situation map (right).
  const leadX = 28;
  const leadW = 600;
  const leadY = 134;
  drawText(LEAD.kicker, leadX, leadY, 2, RED, true);
  // Small NATO-style emblem at the top right of the lead column.
  fillCircle(leadX + leadW - 16, leadY + 7, 11, BLUE);
  circle(leadX + leadW - 16, leadY + 7, 11, INK);
  star(leadX + leadW - 16, leadY + 7, 7, WHITE);
  let y = leadY + 24;
  y = para(LEAD.headline, leadX, y, leadW, 4, INK, 6, true);
  y += 6;
  y = para(LEAD.standfirst, leadX, y, leadW, 2, BLUE, 4, false);
  y += 8;
  y = para(LEAD.body, leadX, y, leadW, 2, INK, 4, false);
  y += 10;
  hline(leadX, leadX + leadW - 1, y, INK, 1);
  y += 8;
  para(LEAD.next, leadX, y, leadW, 2, RED, 4, true);

  drawMap(652, 134, 344, 284);

  hline(28, W - 29, 430, INK, 2);

  // ---- Six supporting stories in a 2 x 3 grid.
  const colW = 472;
  const colX = [28, 524];
  const rowY = [438, 604, 770];
  const rowH = 160;
  for (let i = 0; i < STORIES.length; i++) {
    const st = STORIES[i];
    const cx = colX[i % 2];
    const cy = rowY[(i / 2) | 0];
    rect(cx, cy, colW, rowH, INK, 1);
    fillRect(cx + 1, cy + 1, colW - 2, 20, SAND);
    drawText(st.kicker, cx + 10, cy + 6, 1, RED, true);
    ICONS[st.icon](cx + colW - 40, cy + 26, 30);
    let sy = cy + 30;
    sy = para(st.headline, cx + 10, sy, colW - 56, 2, INK, 4, true);
    sy += 4;
    para(st.body, cx + 10, sy, colW - 20, 2, INK, 4, false);
  }

  // ---- Ticker.
  const ty = 938;
  fillRect(28, ty, W - 56, 44, DARKRED);
  drawText(TICKER_A, 40, ty + 6, 2, WHITE, false);
  drawText(TICKER_B, 40, ty + 25, 2, WHITE, false);

  // ---- Footer.
  drawTextCentered(FOOTER, W / 2, 988, 1, SOFT, false);
}

// ------------------------------------------------------------- PNG encoder
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data) {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng() {
  const stride = W * 3;
  const raw = Buffer.alloc(H * (stride + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(buf.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// --------------------------------------------------------------------- main
function main() {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  drawPage();
  writeFileSync(join(outDir, "entry.png"), encodePng());
}

main();
