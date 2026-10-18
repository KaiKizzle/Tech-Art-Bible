/* Rooms Behind Glass — labs: the interior-mapping shader math, a software facade renderer and the chapter labs. */
(function () {
'use strict';

"use strict";
/* ---------- small utilities ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const fract = x => x - Math.floor(x);
const RAD = Math.PI / 180;
function fmt(x, n = 2) {
  if (x === Infinity || x > 1e7) return '∞';
  if (x === -Infinity || x < -1e7) return '−∞';
  if (Number.isNaN(x)) return 'NaN';
  let s = x.toFixed(n);
  if (/^-0\.?0*$/.test(s)) s = s.slice(1);
  return s.replace('-', '−');
}
const vec = (a, n = 2) => '(' + Array.from(a).map(x => fmt(x, n)).join(', ') + ')';


/* ---------- theme palette for 2D diagrams ---------- */
const PAL = {};
const PAL_KEYS = ['bg', 'surface', 'surface-2', 'ink', 'muted', 'line', 'accent', 'accent-ink', 'accent-soft', 'ray', 'ray-soft', 'ax-x', 'ax-y', 'ax-z', 'good', 'bad'];
function readPal() {
  const cs = getComputedStyle(document.documentElement);
  PAL_KEYS.forEach(k => { PAL[k] = cs.getPropertyValue('--' + k).trim() || '#888'; });
}
const redrawers = [];
function onRedraw(f) { redrawers.push(f); }
function redrawAll() { readPal(); redrawers.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }

/* Canvas drawn in CSS pixels at device pixel ratio. Its height always comes from its width and a fixed
   aspect ratio, never from clientHeight, so the canvas can never grow by itself. */
function fig(canvas, draw) {
  const ctx = canvas.getContext('2d');
  const st = { w: 0, h: 0, ctx, canvas };
  let ar = 0;
  const m = (canvas.getAttribute('style') || '').match(/aspect-ratio:\s*([\d.]+)\s*\/\s*([\d.]+)/);
  if (m) ar = +m[1] / +m[2]; else if (canvas.getAttribute('width') && canvas.getAttribute('height')) ar = +canvas.getAttribute('width') / +canvas.getAttribute('height'); else ar = 4 / 3;
  canvas.style.aspectRatio = String(ar); canvas.style.height = 'auto';
  function size() {
    const w = canvas.clientWidth;
    if (!w) return false;
    const h = Math.round(w / ar);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    st.w = w; st.h = h; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }
  let lastW = -1;
  st.draw = () => { if (size()) { ctx.clearRect(0, 0, st.w, st.h); draw(ctx, st.w, st.h); } };
  new ResizeObserver(() => { const w = canvas.clientWidth; if (w !== lastW) { lastW = w; st.draw(); } }).observe(canvas);
  onRedraw(st.draw);
  return st;
}
function ppos(e, el) { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; }

/* 2D drawing helpers */
const G = {
  line(c, x1, y1, x2, y2, col, w = 1.5, dash) { c.beginPath(); c.setLineDash(dash || []); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = col; c.lineWidth = w; c.stroke(); c.setLineDash([]); },
  arrow(c, x1, y1, x2, y2, col, w = 2, head = 8) {
    G.line(c, x1, y1, x2, y2, col, w);
    const a = Math.atan2(y2 - y1, x2 - x1);
    c.beginPath(); c.moveTo(x2, y2);
    c.lineTo(x2 - head * Math.cos(a - 0.4), y2 - head * Math.sin(a - 0.4));
    c.lineTo(x2 - head * Math.cos(a + 0.4), y2 - head * Math.sin(a + 0.4));
    c.closePath(); c.fillStyle = col; c.fill();
  },
  dot(c, x, y, r, fill, stroke, sw = 1.5) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = sw; c.stroke(); } },
  text(c, t, x, y, col, o = {}) {
    c.font = `${o.weight || 500} ${o.size || 11}px "JetBrains Mono", ui-monospace, monospace`;
    c.fillStyle = col; c.textAlign = o.align || 'left'; c.textBaseline = o.base || 'middle';
    if (o.halo) { c.lineWidth = 3; c.strokeStyle = o.halo; c.strokeText(t, x, y); }
    c.fillText(t, x, y);
  },
  rect(c, x, y, w, h, fill, stroke, sw = 1, dash) { if (fill) { c.fillStyle = fill; c.fillRect(x, y, w, h); } if (stroke) { c.setLineDash(dash || []); c.strokeStyle = stroke; c.lineWidth = sw; c.strokeRect(x, y, w, h); c.setLineDash([]); } }
};

/* ---------- the shader math, shared by every lab ---------- */
/* Non-allocating core. Writes into out:
   0-2 o, 3-5 d, 6-8 invD, 9 tX, 10 tY, 11 tZ, 12 t, 13 wall id, 14-16 hit
   wall ids: 0 left, 1 right, 2 floor, 3 ceiling, 4 back */
const WALLS = ['left wall', 'right wall', 'floor', 'ceiling', 'back wall'];
function traceInto(out, u, v, W, H, D, vx, vy, vz, noNorm) {
  const ox = u * 2 - 1, oy = v * 2 - 1;
  let dx, dy, dz;
  if (noNorm) { dx = vx; dy = vy; dz = -vz; }
  else { dx = vx / (0.5 * W); dy = vy / (0.5 * H); dz = -vz / D; }
  if (Math.abs(dx) < 1e-5) dx = 1e-5;
  if (Math.abs(dy) < 1e-5) dy = 1e-5;
  if (Math.abs(dz) < 1e-5) dz = 1e-5;
  const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
  const tX = Math.abs(ix) - ox * ix, tY = Math.abs(iy) - oy * iy, tZ = iz;
  let t = tX, wall = dx > 0 ? 1 : 0;
  if (tY < t) { t = tY; wall = dy > 0 ? 3 : 2; }
  if (tZ < t) { t = tZ; wall = 4; }
  out[0] = ox; out[1] = oy; out[2] = 0; out[3] = dx; out[4] = dy; out[5] = dz;
  out[6] = ix; out[7] = iy; out[8] = iz; out[9] = tX; out[10] = tY; out[11] = tZ; out[12] = t; out[13] = wall;
  out[14] = ox + dx * t; out[15] = oy + dy * t; out[16] = dz * t;
  return out;
}
const IM = {
  trace(u, v, W, H, D, V, noNorm) {
    const a = traceInto(new Float64Array(17), u, v, W, H, D, V[0], V[1], V[2], noNorm);
    return { o: [a[0], a[1], a[2]], d: [a[3], a[4], a[5]], inv: [a[6], a[7], a[8]], tX: a[9], tY: a[10], tZ: a[11], t: a[12], wall: a[13], hit: [a[14], a[15], a[16]] };
  },
  project(hit, b) { const k = 1 / b - 1, s = 1 / (1 + hit[2] * k); return { k, s, cu: hit[0] * s * 0.5 + 0.5, cv: hit[1] * s * 0.5 + 0.5 }; }
};
const hash = n => fract(Math.sin(n * 12.9898 + 78.233) * 43758.5453);
function roomHashes(seed) {
  return { cell: hash(seed * 17 + 1), flip: hash(seed * 31 + 2), lit: hash(seed * 47 + 3), curt: hash(seed * 59 + 4), state: hash(seed * 71 + 5), tint: hash(seed * 83 + 6), depth: hash(seed * 97 + 7) };
}
function schlick(cosT, f0 = 0.04) { const m = 1 - clamp(cosT, 0, 1); return f0 + (1 - f0) * m * m * m * m * m; }

/* ---------- the building used by every facade lab ---------- */
const FLOORS = [
  { h: 4.2, type: 2, name: 'shop', rooms: [{ w: 6, d: 6.5, wins: [[0.5, 0.45, 5.0, 3.2]] }, { w: 4, d: 6, wins: [[0.7, 0.45, 2.6, 3.2]] }] },
  { h: 3.2, type: 0, name: 'office', rooms: [{ w: 4, d: 4.5, wins: [[0.5, 0.85, 1.1, 1.75], [2.4, 0.85, 1.1, 1.75]] }, { w: 3, d: 4.5, wins: [[0.7, 0.85, 1.6, 1.75]] }, { w: 3, d: 3.0, wins: [[1.15, 1.65, 0.7, 0.8]] }] },
  { h: 3.2, type: 1, name: 'flat', rooms: [{ w: 5, d: 4.2, wins: [[0.4, 0.95, 4.2, 1.55]] }, { w: 5, d: 4.0, wins: [[0.6, 0.55, 1.4, 2.05], [3.0, 0.55, 1.4, 2.05]] }] }
];
const BW = 10, BH = 10.6;
const ROOMS = [];
(() => {
  let y = 0;
  FLOORS.forEach((f, fi) => {
    let x = 0;
    f.rooms.forEach(r => {
      const id = ROOMS.length, seed = fract(id * 0.618034 + 0.137);
      ROOMS.push({ id, floor: fi, x0: x, y0: y, w: r.w, h: f.h, d: r.d, type: f.type, typeName: f.name, seed, H: roomHashes(seed),
        wins: r.wins.map(([wx, wy, ww, wh]) => ({ x0: x + wx, y0: y + wy, w: ww, h: wh })) });
      x += r.w;
    });
    y += f.h;
  });
})();
function roomAt(px, py) { for (const r of ROOMS) if (px >= r.x0 && px < r.x0 + r.w && py >= r.y0 && py < r.y0 + r.h) return r; return null; }
function winAt(r, px, py) { for (const w of r.wins) if (px >= w.x0 && px <= w.x0 + w.w && py >= w.y0 && py <= w.y0 + w.h) return w; return null; }

/* ---------- atlas: room renders painted with the exact one-point projection ---------- */
const ATL = { cols: 4, rows: 3, cell: 160 };
const ROW_NAMES = ['office', 'flat', 'shop'];
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function hexRGB(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function shade(hex, f) { const c = hexRGB(hex).map(v => clamp(Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)), 0, 255)); return `rgb(${c[0]},${c[1]},${c[2]})`; }

function painter(ctx, ox, oy, C, b) {
  const k = 1 / b - 1;
  const P = (x, y, z) => { const s = 1 / (1 + z * k); return [ox + (x * s * 0.5 + 0.5) * C, oy + (1 - (y * s * 0.5 + 0.5)) * C]; };
  const p = {
    P,
    poly(pts, fill) { ctx.beginPath(); pts.forEach((q, i) => { const a = P(q[0], q[1], q[2]); i ? ctx.lineTo(a[0], a[1]) : ctx.moveTo(a[0], a[1]); }); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); },
    seg(a, b2, col, w = 1) { const p1 = P(...a), p2 = P(...b2); ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); },
    box(x0, x1, y0, y1, z0, z1, top, side, front) {
      if (y1 < 0) p.poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], top);
      if (y0 > 0) p.poly([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], side);
      if (x0 > 0) p.poly([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], side);
      if (x1 < 0) p.poly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], side);
      p.poly([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], front);
    },
    onLeft(y0, y1, z0, z1, f) { p.poly([[-1, y0, z0], [-1, y1, z0], [-1, y1, z1], [-1, y0, z1]], f); },
    onRight(y0, y1, z0, z1, f) { p.poly([[1, y0, z0], [1, y1, z0], [1, y1, z1], [1, y0, z1]], f); },
    onBack(x0, x1, y0, y1, f) { p.poly([[x0, y0, 1], [x1, y0, 1], [x1, y1, 1], [x0, y1, 1]], f); },
    onFloor(x0, x1, z0, z1, f) { p.poly([[x0, -1, z0], [x1, -1, z0], [x1, -1, z1], [x0, -1, z1]], f); },
    onCeil(x0, x1, z0, z1, f) { p.poly([[x0, 1, z0], [x1, 1, z0], [x1, 1, z1], [x0, 1, z1]], f); },
    walls(wall, floor, ceil) {
      p.poly([[-1, -1, 0], [-1, 1, 0], [-1, 1, 1], [-1, -1, 1]], shade(wall, -0.07));
      p.poly([[1, -1, 0], [1, 1, 0], [1, 1, 1], [1, -1, 1]], shade(wall, 0.02));
      p.poly([[-1, -1, 0], [1, -1, 0], [1, -1, 1], [-1, -1, 1]], floor);
      p.poly([[-1, 1, 0], [1, 1, 0], [1, 1, 1], [-1, 1, 1]], ceil);
      p.poly([[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], shade(wall, -0.02));
    }
  };
  return p;
}
const OFFICE = [
  { wall: '#d9d4c8', floor: '#6f7780', ceil: '#e9e7e1', acc: '#2f5d7c', desk: '#b48a5a', dx: -0.6, shelf: 'L' },
  { wall: '#c9d4cf', floor: '#7a6a58', ceil: '#ebe9e3', acc: '#8b3a2e', desk: '#e3dfd6', dx: -0.15, shelf: 'R' },
  { wall: '#e1dccf', floor: '#5d6b63', ceil: '#efede6', acc: '#c49a2c', desk: '#9a7650', dx: -0.75, shelf: 'L' },
  { wall: '#d4d0db', floor: '#6c6672', ceil: '#e9e7ef', acc: '#2e6b57', desk: '#d8d2c4', dx: -0.35, shelf: 'R' }];
const FLAT = [
  { wall: '#e3d6c3', floor: '#9a6b43', ceil: '#efe9e0', acc: '#7a8f6a', art: '#3f6e8c', side: 'L' },
  { wall: '#cfdcd4', floor: '#8a6040', ceil: '#eef0ea', acc: '#9c4a3a', art: '#d9a441', side: 'R' },
  { wall: '#e6cfc7', floor: '#a37650', ceil: '#f1ebe6', acc: '#3e5f7f', art: '#5f7f4a', side: 'L' },
  { wall: '#d8d2e6', floor: '#7c5a3e', ceil: '#ece9f2', acc: '#b0884a', art: '#8c3f5a', side: 'R' }];
const SHOP = [
  { wall: '#ecebe6', floor: '#c9c4b8', acc: '#b8432f' }, { wall: '#e6ebec', floor: '#bfc6c4', acc: '#2f6f8f' },
  { wall: '#efe9de', floor: '#cbbfa9', acc: '#d49a2a' }, { wall: '#e8ece4', floor: '#c2c7b9', acc: '#3f7a4a' }];
const PRODUCTS = ['#c0392b', '#e1a32b', '#2e86ab', '#3f8f4f', '#8e44ad', '#e5e1d8', '#d35400', '#34495e'];

function paintRoom(p, row, v, pass) {
  const lampCol = pass === 'night' ? '#fff3cf' : '#f4f3ee';
  if (row === 0) {
    const c = OFFICE[v];
    if (pass === 'albedo') {
      p.walls(c.wall, c.floor, c.ceil);
      for (const z of [0.25, 0.5, 0.75]) p.seg([-1, -1, z], [1, -1, z], 'rgba(0,0,0,0.10)', 1);
      p.onRight(-0.15, 0.55, 0.2, 0.62, '#5a5f63'); p.onRight(-0.1, 0.5, 0.23, 0.59, '#f2f2ee');
      p.onBack(0.35, 0.85, 0.0, 0.55, c.acc); p.onBack(0.42, 0.78, 0.08, 0.47, shade(c.acc, 0.35));
      const sx = c.shelf === 'L' ? [-1, -0.8] : [0.8, 1];
      p.box(sx[0], sx[1], -1, 0.15, 0.3, 0.62, shade(c.acc, 0.2), shade(c.acc, -0.2), shade(c.acc, -0.1));
      const fx = c.shelf === 'L' ? -0.8 : 0.8;
      let n = v * 7 + 3;
      for (const yy of [-0.82, -0.42, -0.02]) for (let z = 0.32; z < 0.58; z += 0.05) {
        n = (n * 13 + 5) % 97; const h = 0.18 + (n % 5) * 0.02;
        p.poly([[fx, yy, z], [fx, yy + h, z], [fx, yy + h, z + 0.04], [fx, yy, z + 0.04]], PRODUCTS[n % PRODUCTS.length]);
      }
      p.box(0.68, 0.88, -1, -0.72, 0.86, 0.96, '#8a6a4a', '#6f5338', '#7a5c40');
      p.box(0.6, 0.95, -0.72, -0.28, 0.84, 0.98, '#5a8a4e', '#3c6335', '#467341');
      const x0 = c.dx, x1 = c.dx + 0.95;
      p.box(x0, x1, -1, -0.52, 0.8, 1, c.desk, shade(c.desk, -0.25), shade(c.desk, -0.15));
      p.box(x0 + 0.28, x0 + 0.66, -0.52, -0.1, 0.9, 0.93, '#2a2f33', '#1b1f22', '#15191c');
      p.box(x0 + 0.33, x0 + 0.6, -1, -0.62, 0.62, 0.71, '#3a3f44', '#2d3135', '#33383d');
      p.box(x0 + 0.33, x0 + 0.6, -0.62, -0.18, 0.6, 0.63, '#3a3f44', '#2d3135', '#2a2e33');
    }
    p.onCeil(-0.35, 0.35, 0.25, 0.42, lampCol); p.onCeil(-0.35, 0.35, 0.6, 0.76, lampCol);
    if (pass === 'night') p.box(c.dx + 0.31, c.dx + 0.63, -0.49, -0.13, 0.905, 0.91, '#9fc6e8', '#9fc6e8', '#a9d0f0');
  } else if (row === 1) {
    const c = FLAT[v], L = c.side === 'L';
    if (pass === 'albedo') {
      p.walls(c.wall, c.floor, c.ceil);
      for (let x = -0.75; x < 0.8; x += 0.25) p.seg([x, -1, 0], [x, -1, 1], 'rgba(0,0,0,0.16)', 1);
      p.onFloor(-0.5, 0.45, 0.35, 0.75, shade(c.acc, 0.45));
      if (L) p.onRight(-1, 0.45, 0.55, 0.8, '#6b4c33'); else p.onLeft(-1, 0.45, 0.55, 0.8, '#6b4c33');
      p.onBack(-0.45, 0.2, 0.05, 0.58, '#2d2a26'); p.onBack(-0.4, 0.15, 0.1, 0.53, c.art);
      const bx = L ? [0.35, 0.88] : [-0.88, -0.35];
      p.box(bx[0], bx[1], -1, 0.3, 0.92, 1, '#a07c56', '#7d6043', '#8c6b4a');
      for (const yy of [-0.7, -0.3, 0.05]) p.box(bx[0] + 0.04, bx[1] - 0.04, yy, yy + 0.2, 0.93, 0.95, '#c9b28f', '#a58e6c', PRODUCTS[(v + Math.round(yy * 10) + 8) % 8]);
      if (L) {
        p.box(-1, -0.6, -1, -0.45, 0.35, 0.8, shade(c.acc, 0.15), shade(c.acc, -0.2), shade(c.acc, -0.1));
        p.box(-1, -0.86, -0.45, -0.08, 0.35, 0.8, shade(c.acc, 0.05), shade(c.acc, -0.15), shade(c.acc, -0.18));
        p.box(0.7, 0.74, -1, 0.2, 0.8, 0.84, '#333', '#222', '#2a2a2a');
      } else {
        p.box(0.6, 1, -1, -0.45, 0.35, 0.8, shade(c.acc, 0.15), shade(c.acc, -0.2), shade(c.acc, -0.1));
        p.box(0.86, 1, -0.45, -0.08, 0.35, 0.8, shade(c.acc, 0.05), shade(c.acc, -0.15), shade(c.acc, -0.18));
        p.box(-0.74, -0.7, -1, 0.2, 0.8, 0.84, '#333', '#222', '#2a2a2a');
      }
      p.box(-0.18, 0.2, -1, -0.72, 0.45, 0.62, '#7a5a3c', '#5c4430', '#6a4e35');
    }
    const lx = L ? [0.6, 0.84] : [-0.84, -0.6];
    const shadeC = pass === 'night' ? '#ffd892' : '#efe4cc';
    p.box(lx[0], lx[1], 0.2, 0.42, 0.76, 0.88, shadeC, shadeC, shade(shadeC.slice(0, 7), -0.05));
    p.box(-0.08, 0.08, 0.72, 0.84, 0.45, 0.55, shadeC, shadeC, shadeC);
  } else {
    const c = SHOP[v];
    if (pass === 'albedo') {
      p.walls(c.wall, c.floor, '#f2f1ec');
      for (let x = -0.5; x < 0.6; x += 0.5) p.seg([x, -1, 0], [x, -1, 1], 'rgba(0,0,0,0.12)', 1);
      for (const z of [0.2, 0.4, 0.6, 0.8]) p.seg([-1, -1, z], [1, -1, z], 'rgba(0,0,0,0.12)', 1);
      p.onBack(-0.85, 0.85, 0.45, 0.72, c.acc);
      for (const side of [-1, 1]) {
        const xs = side < 0 ? [-1, -0.8] : [0.8, 1], fx = side < 0 ? -0.8 : 0.8;
        p.box(xs[0], xs[1], -1, 0.4, 0.12, 0.92, '#d8d4cc', '#b9b4aa', '#c8c3b9');
        let n = v * 5 + (side > 0 ? 11 : 2);
        for (const yy of [-0.85, -0.5, -0.15, 0.2]) for (let z = 0.15; z < 0.88; z += 0.07) {
          n = (n * 17 + 7) % 101;
          p.poly([[fx, yy, z], [fx, yy + 0.16, z], [fx, yy + 0.16, z + 0.055], [fx, yy, z + 0.055]], PRODUCTS[n % 8]);
        }
      }
      p.box(-0.3, 0.55, -1, -0.42, 0.55, 0.7, '#e9e6df', shade(c.acc, -0.2), c.acc);
      p.box(-0.55, 0.15, -1, -0.62, 0.2, 0.32, '#cfc9bd', '#a39d92', '#b8b2a6');
      for (let x = -0.5; x < 0.12; x += 0.13) p.box(x, x + 0.08, -0.62, -0.48, 0.23, 0.27, PRODUCTS[Math.abs(Math.round(x * 20 + v)) % 8], '#555', PRODUCTS[Math.abs(Math.round(x * 20 + v + 3)) % 8]);
    }
    for (const z of [0.3, 0.55, 0.8]) p.onCeil(-0.6, 0.6, z, z + 0.03, pass === 'night' ? '#fff3cf' : '#ffffff');
  }
}

/* depth/wall of any pixel of a cell, inverted from the projection */
function cellPoint(X, Y, b, k, out) {
  const m = Math.max(Math.abs(X), Math.abs(Y));
  if (m <= b) { out.wall = 4; out.z = 1; out.x = X / b; out.y = Y / b; }
  else {
    out.z = (1 / m - 1) / k;
    if (Math.abs(X) >= Math.abs(Y)) { out.wall = X < 0 ? 0 : 1; out.x = Math.sign(X); out.y = Y / m; }
    else { out.wall = Y < 0 ? 2 : 3; out.x = X / m; out.y = Math.sign(Y); }
  }
  return out;
}
function lightPass(data, Wimg, ox, oy, C, b, night) {
  const k = 1 / b - 1, q = {};
  for (let py = 0; py < C; py++) for (let px = 0; px < C; px++) {
    const X = (px + 0.5) / C * 2 - 1, Y = 1 - (py + 0.5) / C * 2;
    cellPoint(X, Y, b, k, q);
    let L, cr = 1, cg = 1, cb = 1;
    let ea, ez;
    if (q.wall === 4) { ea = Math.min(1 - Math.abs(q.x), 1 - Math.abs(q.y)); ez = 1; }
    else if (q.wall < 2) { ea = 1 - Math.abs(q.y); ez = 1 - q.z; }
    else { ea = 1 - Math.abs(q.x); ez = 1 - q.z; }
    const ao = 0.78 + 0.22 * clamp(Math.min(ea, ez) * 6, 0, 1);
    if (!night) {
      L = 0.6 + 0.55 * Math.exp(-2.4 * q.z);
      if (q.wall === 2) L *= 1.06; if (q.wall === 3) L *= 0.9;
      cr = 0.98; cg = 1.0; cb = 1.04;
    } else {
      const mx = q.x * 2, my = (q.y - 0.8) * 1.6, mz = (q.z - 0.5) * 4.5;
      const d2 = mx * mx + my * my + mz * mz, dl = Math.sqrt(d2) || 1;
      const n = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, -1]][q.wall];
      const ndl = Math.max(0, -(n[0] * mx + n[1] * my + n[2] * mz) / dl);
      L = 0.3 + 3.4 * ndl / (1 + d2 * 0.32);
      cr = 1.0; cg = 0.83; cb = 0.6;
    }
    const i = ((oy + py) * Wimg + ox + px) * 4;
    data[i] = clamp(data[i] * L * ao * cr, 0, 255);
    data[i + 1] = clamp(data[i + 1] * L * ao * cg, 0, 255);
    data[i + 2] = clamp(data[i + 2] * L * ao * cb, 0, 255);
  }
}
const GRID_COL = [[233, 170, 160], [240, 196, 186], [176, 214, 166], [205, 232, 196], [176, 198, 238]];
function gridCell(data, Wimg, ox, oy, C, b) {
  const k = 1 / b - 1, qs = [{}, {}, {}, {}];
  for (let py = 0; py < C; py++) for (let px = 0; px < C; px++) {
    const cs = [[px, py], [px + 1, py], [px, py + 1], [px + 1, py + 1]];
    let wmin = 9, wmax = -1, amin = 9, amax = -9, cmin = 9, cmax = -9;
    for (let j = 0; j < 4; j++) {
      const X = cs[j][0] / C * 2 - 1, Y = 1 - cs[j][1] / C * 2, q = cellPoint(X, Y, b, k, qs[j]);
      wmin = Math.min(wmin, q.wall); wmax = Math.max(wmax, q.wall);
      let a, c;
      if (q.wall === 4) { a = q.x * 2; c = q.y * 2; } else if (q.wall < 2) { a = q.z * 4; c = q.y * 2; } else { a = q.z * 4; c = q.x * 2; }
      amin = Math.min(amin, a); amax = Math.max(amax, a); cmin = Math.min(cmin, c); cmax = Math.max(cmax, c);
    }
    const X = (px + 0.5) / C * 2 - 1, Y = 1 - (py + 0.5) / C * 2, q = cellPoint(X, Y, b, k, {});
    let col = GRID_COL[q.wall], f = 1;
    if (wmin !== wmax) f = 0.25;
    else if (Math.floor(amin) !== Math.floor(amax) || Math.floor(cmin) !== Math.floor(cmax)) f = 0.55;
    const i = ((oy + py) * Wimg + ox + px) * 4;
    data[i] = col[0] * f; data[i + 1] = col[1] * f; data[i + 2] = col[2] * f; data[i + 3] = 255;
  }
}
function buildAtlas(kind, b = 0.5) {
  const C = ATL.cell, W = C * ATL.cols, H = C * ATL.rows, cv = mkCanvas(W, H), ctx = cv.getContext('2d', { willReadFrequently: true });
  if (kind === 'grid') {
    const img = ctx.createImageData(W, H);
    for (let r = 0; r < ATL.rows; r++) for (let c = 0; c < ATL.cols; c++) gridCell(img.data, W, c * C, (ATL.rows - 1 - r) * C, C, b);
    ctx.putImageData(img, 0, 0);
  } else {
    const night = kind === 'night';
    for (let r = 0; r < ATL.rows; r++) for (let c = 0; c < ATL.cols; c++) {
      const ox = c * C, oy = (ATL.rows - 1 - r) * C;
      ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, C, C); ctx.clip();
      paintRoom(painter(ctx, ox, oy, C, b), r, c, 'albedo'); ctx.restore();
    }
    const img = ctx.getImageData(0, 0, W, H);
    for (let r = 0; r < ATL.rows; r++) for (let c = 0; c < ATL.cols; c++) lightPass(img.data, W, c * C, (ATL.rows - 1 - r) * C, C, b, night);
    ctx.putImageData(img, 0, 0);
    for (let r = 0; r < ATL.rows; r++) for (let c = 0; c < ATL.cols; c++) {
      const ox = c * C, oy = (ATL.rows - 1 - r) * C;
      ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, C, C); ctx.clip();
      paintRoom(painter(ctx, ox, oy, C, b), r, c, night ? 'night' : 'day'); ctx.restore();
    }
  }
  const data = ctx.getImageData(0, 0, W, H).data;
  const avg = [];
  for (let r = 0; r < ATL.rows; r++) for (let c = 0; c < ATL.cols; c++) {
    let s = [0, 0, 0], n = 0; const ox = c * C, oy = (ATL.rows - 1 - r) * C;
    for (let y = 0; y < C; y += 4) for (let x = 0; x < C; x += 4) { const i = ((oy + y) * W + ox + x) * 4; s[0] += data[i]; s[1] += data[i + 1]; s[2] += data[i + 2]; n++; }
    avg[r * ATL.cols + c] = s.map(v => v / n);
  }
  return { canvas: cv, data, w: W, h: H, avg };
}
function sampleAtlas(A, u, v, out) {
  const x = u * A.w - 0.5, y = (1 - v) * A.h - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const xa = clamp(x0, 0, A.w - 1), xb = clamp(x0 + 1, 0, A.w - 1), ya = clamp(y0, 0, A.h - 1), yb = clamp(y0 + 1, 0, A.h - 1);
  const d = A.data, i00 = (ya * A.w + xa) * 4, i10 = (ya * A.w + xb) * 4, i01 = (yb * A.w + xa) * 4, i11 = (yb * A.w + xb) * 4;
  for (let c = 0; c < 3; c++) out[c] = (d[i00 + c] * (1 - fx) + d[i10 + c] * fx) * (1 - fy) + (d[i01 + c] * (1 - fx) + d[i11 + c] * fx) * fy;
  return out;
}
let ATLAS = null;
function atlases() {
  if (!ATLAS) ATLAS = { day: buildAtlas('day'), night: buildAtlas('night'), grid: buildAtlas('grid') };
  return ATLAS;
}

/* ---------- curtains (procedural texture on the curtain plane) ---------- */
const CURT_COL = [[0.86, 0.82, 0.72], [0.55, 0.62, 0.52], [0.42, 0.47, 0.55], [0.66, 0.4, 0.32]];
function curtainAlpha(state, x, y) {
  if (state === 0) return Math.abs(x) > 0.72 ? 0.96 : 0;
  if (state === 1) return x > -0.08 ? 0.94 : 0;
  if (state === 2) return y > -0.15 && fract(y * 6) < 0.62 ? 0.95 : 0;
  return 0.6;
}

/* ---------- sky and street ---------- */
const SKY = {
  day: { hor: [0.8, 0.86, 0.9], zen: [0.42, 0.6, 0.8], wall: [0.73, 0.7, 0.65], frame: [0.2, 0.21, 0.22], ground: [0.36, 0.37, 0.38], walk: [0.62, 0.6, 0.57], int: 0.74, refl: 1 },
  dusk: { hor: [0.95, 0.66, 0.46], zen: [0.22, 0.26, 0.45], wall: [0.55, 0.45, 0.42], frame: [0.12, 0.12, 0.14], ground: [0.2, 0.19, 0.21], walk: [0.36, 0.32, 0.31], int: 0.34, refl: 0.85 },
  night: { hor: [0.1, 0.12, 0.19], zen: [0.02, 0.03, 0.07], wall: [0.12, 0.13, 0.16], frame: [0.04, 0.04, 0.05], ground: [0.05, 0.05, 0.06], walk: [0.09, 0.09, 0.1], int: 0.06, refl: 0.6 }
};
function skyCol(T, dy, out) { const t = clamp(dy * 1.6 + 0.08, 0, 1); for (let c = 0; c < 3; c++) out[c] = lerp(T.hor[c], T.zen[c], t); return out; }

/* ---------- the facade renderer ---------- */
const WALL_DBG = [[0.78, 0.25, 0.22], [0.97, 0.55, 0.45], [0.28, 0.6, 0.27], [0.62, 0.86, 0.52], [0.3, 0.46, 0.85]];
class FacadeView {
  constructor(canvas, opt = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.W = canvas.width; this.H = canvas.height;
    this.img = this.ctx.createImageData(this.W, this.H);
    this.s = Object.assign({ yaw: 0.42, pitch: 0.12, dist: 17, mode: 'final', time: 'day', tex: 'art', bug: 'none', lod: 0, depthMul: 1, showRects: false, lit: 0.45, curt: 0.55, jitter: 0.2 }, opt.state || {});
    this.onPick = opt.onPick || null; this.pick = opt.pick || null; this.onInteract = opt.onInteract || null;
    this.tr = new Float64Array(17); this.tmp = [0, 0, 0]; this.col = [0, 0, 0]; this.sky = [0, 0, 0];
    this.pending = false;
    let down = null;
    canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, yaw: this.s.yaw, pitch: this.s.pitch, moved: false }; canvas.setPointerCapture(e.pointerId); if (this.onInteract) this.onInteract(); });
    canvas.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!down.moved && Math.hypot(dx, dy) < 4) return;
      down.moved = true;
      this.s.yaw = clamp(down.yaw - dx * 0.006, -1.15, 1.15);
      this.s.pitch = clamp(down.pitch + dy * 0.004, -0.25, 0.6);
      this.request(true);
    });
    const end = e => {
      if (!down) return;
      if (!down.moved && this.onPick) { const p = ppos(e, canvas); this.pick = { i: Math.floor(p.x / p.w * this.W), j: Math.floor(p.y / p.h * this.H) }; }
      down = null; this.request(false);
    };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', () => { down = null; this.request(false); });
  }
  set(k, v) { this.s[k] = v; this.request(false); }
  request(fast) {
    this.fast = fast; if (this.pending) return; this.pending = true;
    requestAnimationFrame(() => { this.pending = false; this.render(this.fast); });
  }
  camera() {
    const s = this.s, tx = 5, ty = 5.3;
    const P = [tx + s.dist * Math.sin(s.yaw) * Math.cos(s.pitch), ty + s.dist * Math.sin(s.pitch), s.dist * Math.cos(s.yaw) * Math.cos(s.pitch)];
    let F = [tx - P[0], ty - P[1], -P[2]]; const fl = Math.hypot(...F); F = F.map(x => x / fl);
    let R = [-F[2], 0, F[0]]; const rl = Math.hypot(...R); R = R.map(x => x / rl);
    const U = [R[1] * F[2] - R[2] * F[1], R[2] * F[0] - R[0] * F[2], R[0] * F[1] - R[1] * F[0]];
    return { P, F, R, U };
  }
  rayFor(cam, i, j, out) {
    const th = 0.36, asp = this.W / this.H;
    const sx = ((i + 0.5) / this.W * 2 - 1) * th * asp, sy = (1 - (j + 0.5) / this.H * 2) * th;
    let x = cam.F[0] + cam.R[0] * sx + cam.U[0] * sy, y = cam.F[1] + cam.R[1] * sx + cam.U[1] * sy, z = cam.F[2] + cam.R[2] * sx + cam.U[2] * sy;
    const l = Math.hypot(x, y, z); out[0] = x / l; out[1] = y / l; out[2] = z / l; return out;
  }
  /* shades one camera ray. rec (optional) receives every intermediate value for the inspector */
  shade(P, dx, dy, dz, out, rec) {
    const s = this.s, T = SKY[s.time];
    let fx = 0, fy = 0, hitF = false;
    if (dz < 0) { const t = -P[2] / dz; fx = P[0] + dx * t; fy = P[1] + dy * t; hitF = fx >= 0 && fx <= BW && fy >= 0 && fy <= BH; }
    if (!hitF) {
      if (dy < 0) {
        const t = -P[1] / dy, gz = P[2] + dz * t, gx = P[0] + dx * t;
        const base = gz > 0 && gz < 3.2 && gx > -30 && gx < 40 ? T.walk : T.ground;
        const fog = clamp(t / 140, 0, 1); skyCol(T, 0, this.sky);
        for (let c = 0; c < 3; c++) out[c] = lerp(base[c], this.sky[c], fog);
      } else skyCol(T, dy, out);
      if (rec) rec.kind = 'sky';
      return out;
    }
    const room = roomAt(fx, fy) || ROOMS[ROOMS.length - 1];
    const win = winAt(room, fx, fy);
    if (rec) { rec.fx = fx; rec.fy = fy; rec.room = room; rec.win = win; }
    if (!win) {
      let f = 1;
      const ly = fy - room.y0;
      if (ly < 0.22) f = 0.82;
      if (fy > BH - 0.3) f = 0.78;
      if (fract(fx / 2.5) < 0.01) f *= 0.9;
      for (let c = 0; c < 3; c++) out[c] = T.wall[c] * f;
      if (s.showRects) {
        const ex = Math.min(fx - room.x0, room.x0 + room.w - fx), ey = Math.min(fy - room.y0, room.y0 + room.h - fy);
        const e = Math.min(ex, ey), along = ex < ey ? fy : fx;
        if (e < 0.07 && fract(along * 2.2) < 0.55) { out[0] = 0.95; out[1] = 0.56; out[2] = 0.16; }
      }
      if (rec) rec.kind = 'wall';
      return out;
    }
    const FR = 0.06;
    if (fx < win.x0 + FR || fx > win.x0 + win.w - FR || fy < win.y0 + FR || fy > win.y0 + win.h - FR) {
      for (let c = 0; c < 3; c++) out[c] = T.frame[c];
      if (rec) rec.kind = 'frame';
      return out;
    }
    return this.glass(room, win, fx, fy, dx, dy, dz, out, rec);
  }
  glass(room, win, fx, fy, dx, dy, dz, out, rec) {
    const s = this.s, T = SKY[s.time], Hh = room.H, A = atlases();
    const perwin = s.bug === 'perwin';
    const u = perwin ? (fx - win.x0) / win.w : (fx - room.x0) / room.w;
    const v = perwin ? (fy - win.y0) / win.h : (fy - room.y0) / room.h;
    const Wm = perwin ? win.w : room.w, Hm = perwin ? win.h : room.h;
    const D = room.d * lerp(1 - s.jitter, 1 + s.jitter, Hh.depth) * s.depthMul;
    let vx = dx, vy = dy, vz = dz;
    if (s.bug === 'tflip') vx = -dx;
    if (s.bug === 'vneg') { vx = -dx; vy = -dy; vz = -dz; }
    const tr = traceInto(this.tr, u, v, Wm, Hm, D, vx, vy, vz, s.bug === 'nonorm');
    const bS = s.bug === 'bwf' ? 0.35 : 0.5, k = 1 / bS - 1;
    let hx = tr[14], hy = tr[15], hz = tr[16], sc, cu, cv;
    if (s.lod === 1) {
      hx = clamp(tr[0] + tr[3] / tr[5], -1, 1); hy = clamp(tr[1] + tr[4] / tr[5], -1, 1); hz = 1; sc = bS;
    } else sc = 1 / (1 + hz * k);
    cu = hx * sc * 0.5 + 0.5; cv = hy * sc * 0.5 + 0.5;
    const flip = Hh.flip > 0.5, cuRaw = cu, cvRaw = cv;
    if (flip) cu = 1 - cu;
    const inset = 0.5 / ATL.cell;
    cu = clamp(cu, inset, 1 - inset); cv = clamp(cv, inset, 1 - inset);
    const col = Math.floor(Hh.cell * ATL.cols), row = room.type;
    const au = (col + cu) / ATL.cols, av = (row + cv) / ATL.rows;
    const lit = Hh.lit < s.lit;
    const useNight = s.time !== 'day' && lit;
    const atlas = s.tex === 'grid' ? A.grid : (useNight ? A.night : A.day);
    if (rec) Object.assign(rec, { kind: 'glass', u, v, Wm, Hm, D, V: [dx, dy, dz], Vts: [vx, vy, vz], tr: Array.from(tr), bS, k, s: sc, hit: [hx, hy, hz], cuRaw, cvRaw, flip, cu, cv, cell: [col, row], au, av, lit, perwin });
    const m = s.mode;
    if (m === 'hit') { out[0] = clamp(hx * 0.5 + 0.5, 0, 1); out[1] = clamp(hy * 0.5 + 0.5, 0, 1); out[2] = clamp(hz, 0, 1); return out; }
    if (m === 'wall') { const w = WALL_DBG[s.lod === 1 ? 4 : tr[13]]; out[0] = w[0]; out[1] = w[1]; out[2] = w[2]; return out; }
    if (m === 'cell') { out[0] = cu; out[1] = cv; out[2] = 0.15; return out; }
    let r, g, b;
    if (s.lod === 2) { const a = A.day.avg[row * ATL.cols + col]; r = a[0] / 255; g = a[1] / 255; b = a[2] / 255; if (useNight) { r = r * 1.4 + 0.25; g = g * 1.25 + 0.15; b = b * 0.9; } }
    else { sampleAtlas(atlas, au, av, this.tmp); r = this.tmp[0] / 255; g = this.tmp[1] / 255; b = this.tmp[2] / 255; }
    if (s.tex !== 'grid') {
      const t0 = [1, 0.93, 0.86], t1 = [0.92, 0.97, 1.05], ht = Hh.tint;
      const ao = s.lod === 2 ? 0.85 : lerp(1, 0.6, clamp(hz, 0, 1));
      const ex = useNight ? 1.08 : T.int;
      r *= lerp(t0[0], t1[0], ht) * ao * ex; g *= lerp(t0[1], t1[1], ht) * ao * ex; b *= lerp(t0[2], t1[2], ht) * ao * ex;
    }
    let curtA = 0, curtInfo = null;
    if (s.lod === 0 && s.tex !== 'grid' && Hh.curt < s.curt) {
      const zc = 0.08, tc = zc * tr[8];
      const pcx = tr[0] + tr[3] * tc, pcy = tr[1] + tr[4] * tc, st = Math.floor(Hh.state * 4);
      const vis = tc <= tr[12];
      curtA = vis ? curtainAlpha(st, pcx, pcy) : 0;
      curtInfo = { zc, tc, pc: [pcx, pcy], state: st, vis, a: curtA };
      if (curtA > 0) {
        const cc = CURT_COL[Math.floor(Hh.tint * 4) % 4], fold = 0.9 + 0.1 * Math.sin(pcx * 42);
        const glow = useNight ? 0.9 : T.int * 1.3;
        r = lerp(r, cc[0] * fold * glow, curtA); g = lerp(g, cc[1] * fold * glow, curtA); b = lerp(b, cc[2] * fold * glow, curtA);
      }
    }
    const F = schlick(-dz), trn = 1 - F;
    skyCol(T, dy < 0 ? -dy * 0.5 + 0.1 : dy, this.sky);
    const rk = T.refl;
    out[0] = r * trn + this.sky[0] * F * rk; out[1] = g * trn + this.sky[1] * F * rk; out[2] = b * trn + this.sky[2] * F * rk;
    if (rec) Object.assign(rec, { curt: curtInfo, F, trn, color: [out[0], out[1], out[2]] });
    return out;
  }
  render(fast) {
    const W = this.W, H = this.H, d = this.img.data, cam = this.camera(), st = fast ? 2 : 1, ray = [0, 0, 0], c = this.col;
    for (let j = 0; j < H; j += st) for (let i = 0; i < W; i += st) {
      this.rayFor(cam, i + (st - 1) * 0.5, j + (st - 1) * 0.5, ray);
      this.shade(cam.P, ray[0], ray[1], ray[2], c, null);
      const R = Math.round(Math.pow(clamp(c[0], 0, 1), 0.94) * 255), Gc = Math.round(Math.pow(clamp(c[1], 0, 1), 0.94) * 255), B = Math.round(Math.pow(clamp(c[2], 0, 1), 0.94) * 255);
      for (let y = j; y < Math.min(H, j + st); y++) for (let x = i; x < Math.min(W, i + st); x++) { const o = (y * W + x) * 4; d[o] = R; d[o + 1] = Gc; d[o + 2] = B; d[o + 3] = 255; }
    }
    this.ctx.putImageData(this.img, 0, 0);
    if (this.pick) {
      const rec = {}; this.rayFor(cam, this.pick.i, this.pick.j, ray);
      this.shade(cam.P, ray[0], ray[1], ray[2], [0, 0, 0], rec);
      rec.cam = cam.P; rec.ray = ray.slice();
      const x = this.pick.i + 0.5, y = this.pick.j + 0.5, ctx = this.ctx;
      ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#ffb648'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 16, y); ctx.lineTo(x - 11, y); ctx.moveTo(x + 11, y); ctx.lineTo(x + 16, y); ctx.moveTo(x, y - 16); ctx.lineTo(x, y - 11); ctx.moveTo(x, y + 11); ctx.lineTo(x, y + 16); ctx.stroke();
      if (this.onPick) this.onPick(rec);
    }
  }
}

/* ---------- a single window seen from a camera, for the small labs ----------
   p: {W,H,D, cam:[x,y,z] relative to window centre in room space (z>0 outside), b, cell:[c,r], flip, tex, curtain:{z,state,nocheck}, tflip} */
function renderWindow(target, p, res = 2) {
  const w = Math.max(40, Math.round(target.w / res)), h = Math.max(30, Math.round(target.h / res));
  if (!target._off || target._off.width !== w || target._off.height !== h) { target._off = mkCanvas(w, h); }
  const off = target._off, octx = off.getContext('2d'), img = octx.createImageData(w, h), d = img.data;
  const A = p.atlas || (p.tex === 'grid' ? atlases().grid : atlases().day), tr = new Float64Array(17), tmp = [0, 0, 0];
  const k = 1 / p.b - 1, inset = 0.5 / ATL.cell;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = (i + 0.5) / w, v = 1 - (j + 0.5) / h;
    const px = (u - 0.5) * p.W, py = (v - 0.5) * p.H;
    let vx = px - p.cam[0], vy = py - p.cam[1], vz = -p.cam[2];
    const l = Math.hypot(vx, vy, vz); vx /= l; vy /= l; vz /= l;
    if (p.tflip) vx = -vx;
    traceInto(tr, u, v, p.W, p.H, p.D, vx, vy, vz, false);
    const s = 1 / (1 + tr[16] * k);
    let cu = tr[14] * s * 0.5 + 0.5, cv = tr[15] * s * 0.5 + 0.5;
    if (p.flip) cu = 1 - cu;
    cu = clamp(cu, inset, 1 - inset); cv = clamp(cv, inset, 1 - inset);
    sampleAtlas(A, (p.cell[0] + cu) / ATL.cols, (p.cell[1] + cv) / ATL.rows, tmp);
    let r = tmp[0], g = tmp[1], b = tmp[2];
    if (p.tex !== 'grid') { const ao = lerp(1, 0.6, tr[16]); r *= ao; g *= ao; b *= ao; }
    if (p.curtain) {
      const tc = p.curtain.z * tr[8], vis = p.curtain.nocheck || tc <= tr[12];
      if (vis) {
        const a = curtainAlpha(p.curtain.state, tr[0] + tr[3] * tc, tr[1] + tr[4] * tc);
        const cc = CURT_COL[3], fold = 0.9 + 0.1 * Math.sin((tr[0] + tr[3] * tc) * 42);
        r = lerp(r, cc[0] * 255 * fold, a); g = lerp(g, cc[1] * 255 * fold, a); b = lerp(b, cc[2] * 255 * fold, a);
      }
    }
    const o = (j * w + i) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  const c = target.ctx; c.imageSmoothingEnabled = true; c.drawImage(off, 0, 0, target.w, target.h);
  c.strokeStyle = 'rgba(20,24,28,0.9)'; c.lineWidth = 6; c.strokeRect(0, 0, target.w, target.h);
}
/* ---------- control helpers ---------- */
const val = id => +$('#' + id).value;
function bindRange(id, f, cb) {
  const el = $('#' + id), out = $('#' + id + '-o');
  const go = () => { if (out) out.textContent = f(+el.value); if (cb) cb(+el.value); };
  el.addEventListener('input', go);
  if (out) out.textContent = f(+el.value);
  return el;
}
function bindSeg(id, cb) {
  const g = $('#' + id);
  g.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', g).forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    cb(b.dataset.v);
  });
  return () => { const b = $('button[aria-pressed="true"]', g); return b ? b.dataset.v : null; };
}
function ro(id, rows) { $('#' + id).innerHTML = rows.map(r => `<tr class="${r[2] || ''}"><td>${r[0]}</td><td>${r[1]}</td></tr>`).join(''); }
const deg = x => fmt(x, 0) + '°';
const m = x => fmt(x, 1) + ' m';

/* ===== Chapter 02: room data inspector ===== */
function labData() {
  let sel = { room: 2, win: 1 };
  const perwin = $('#data-perwin');
  let map = null;
  const F = fig($('#data-facade'), (c, w, h) => {
    const pad = 14, sc = Math.min((w - 2 * pad) / BW, (h - 2 * pad) / BH);
    const ox = (w - BW * sc) / 2, oy = h - (h - BH * sc) / 2;
    map = { sc, ox, oy };
    const X = x => ox + x * sc, Y = y => oy - y * sc;
    G.rect(c, X(0), Y(BH), BW * sc, BH * sc, PAL['surface-2'], PAL.line, 1);
    for (const r of ROOMS) {
      const isSel = r.id === sel.room;
      if (isSel) G.rect(c, X(r.x0), Y(r.y0 + r.h), r.w * sc, r.h * sc, PAL['accent-soft']);
      G.rect(c, X(r.x0) + 2, Y(r.y0 + r.h) + 2, r.w * sc - 4, r.h * sc - 4, null, PAL.accent, isSel ? 2 : 1.2, [5, 4]);
      r.wins.forEach((wn, i) => {
        const on = isSel && i === sel.win;
        G.rect(c, X(wn.x0), Y(wn.y0 + wn.h), wn.w * sc, wn.h * sc, on ? PAL.ray : PAL['ray-soft'], PAL.ray, 1.2);
      });
    }
    for (const fl of [0, 2, 5]) { const r = ROOMS[fl]; G.text(c, r.typeName, X(r.x0) + 6, Y(r.y0 + r.h) + 12, PAL.muted, { size: 10 }); }
  });
  const U = fig($('#data-uv'), (c, w, h) => {
    const r = ROOMS[sel.room], pad = 22, s = Math.min(w, h) - 2 * pad, X = u => pad + u * s, Y = v => pad + (1 - v) * s;
    G.rect(c, X(0), Y(1), s, s, PAL.surface, PAL.accent, 1.5, [5, 4]);
    G.text(c, '0', X(0) - 4, Y(0) + 10, PAL.muted, { align: 'right', size: 10 });
    G.text(c, 'u 1', X(1), Y(0) + 12, PAL.muted, { align: 'right', size: 10 });
    G.text(c, 'v 1', X(0) - 4, Y(1), PAL.muted, { align: 'right', size: 10 });
    if (perwin.checked) {
      G.rect(c, X(0), Y(1), s, s, PAL.ray, PAL.ray, 1.5);
      G.text(c, 'this window = 0..1', X(0.5), Y(0.5), PAL.bg, { align: 'center', size: 11, weight: 600 });
      return;
    }
    r.wins.forEach((wn, i) => {
      const u0 = (wn.x0 - r.x0) / r.w, v0 = (wn.y0 - r.y0) / r.h, uw = wn.w / r.w, vh = wn.h / r.h;
      G.rect(c, X(u0), Y(v0 + vh), uw * s, vh * s, i === sel.win ? PAL.ray : PAL['ray-soft'], PAL.ray, 1.2);
    });
  });
  function table() {
    const r = ROOMS[sel.room], wn = r.wins[sel.win], pw = perwin.checked;
    const u0 = (wn.x0 - r.x0) / r.w, u1 = (wn.x0 + wn.w - r.x0) / r.w, v0 = (wn.y0 - r.y0) / r.h, v1 = (wn.y0 + wn.h - r.y0) / r.h;
    const D = r.d;
    ro('data-ro', [
      ['Room', `#${r.id}, ${r.typeName}, ${r.wins.length} window${r.wins.length > 1 ? 's' : ''}`],
      ['Rectangle', `${fmt(r.w, 1)} × ${fmt(r.h, 1)} m`],
      ['Glass', `window ${sel.win + 1}: ${fmt(wn.w, 2)} × ${fmt(wn.h, 2)} m`],
      ['UV1 u', pw ? '0.00 … 1.00' : `${fmt(u0)} … ${fmt(u1)}`, pw ? 'on' : 'win'],
      ['UV1 v', pw ? '0.00 … 1.00' : `${fmt(v0)} … ${fmt(v1)}`, pw ? 'on' : 'win'],
      ['UV2 (W, H)', pw ? `(${fmt(wn.w)}, ${fmt(wn.h)})` : `(${fmt(r.w)}, ${fmt(r.h)})`, pw ? 'on' : ''],
      ['UV3 (D, seed)', `(${fmt(D)}, ${fmt(r.seed, 3)})`],
      ['Color.r', `${r.type} / 15 = ${fmt(r.type / 15, 3)}`]
    ]);
  }
  $('#data-facade').addEventListener('click', e => {
    if (!map) return;
    const p = ppos(e, e.currentTarget), x = (p.x - map.ox) / map.sc, y = (map.oy - p.y) / map.sc;
    const r = roomAt(x, y); if (!r) return;
    let wi = r.wins.findIndex(wn => x >= wn.x0 && x <= wn.x0 + wn.w && y >= wn.y0 && y <= wn.y0 + wn.h);
    sel = { room: r.id, win: wi < 0 ? 0 : wi }; F.draw(); U.draw(); table();
  });
  perwin.addEventListener('change', () => { U.draw(); table(); });
  table();
}

/* ===== Chapter 03: camera ray fan ===== */
function labFan() {
  const fl = ROOMS.filter(r => r.floor === 1);
  const F = fig($('#fan-canvas'), (c, w, h) => {
    const camX = val('fan-cx'), N = val('fan-n'), fi = val('fan-i'), tf = val('fan-t');
    const zTop = -5.2, camZ = 9;
    const sc = Math.min(w / 21, h / (camZ - zTop + 1.3)), x0w = -5.5;
    const X = x => (x - x0w) * sc + (w - 21 * sc) / 2, Y = z => 10 + (z - zTop) * sc;
    G.rect(c, 0, Y(0), w, h - Y(0), PAL['surface-2']);
    G.text(c, 'street', 8, Y(0) + 14, PAL.muted, { size: 10 });
    for (const r of fl) {
      G.rect(c, X(r.x0), Y(-r.d), r.w * sc, r.d * sc, PAL.surface, PAL.line, 1);
      G.text(c, `room ${r.id}`, X(r.x0 + r.w / 2), Y(-r.d) + 11, PAL.muted, { align: 'center', size: 10 });
    }
    c.lineWidth = 4; c.strokeStyle = PAL.muted; c.beginPath(); c.moveTo(X(0), Y(0)); c.lineTo(X(BW), Y(0)); c.stroke();
    for (const r of fl) for (const wn of r.wins) { c.lineWidth = 5; c.strokeStyle = PAL.ray; c.beginPath(); c.moveTo(X(wn.x0), Y(0)); c.lineTo(X(wn.x0 + wn.w), Y(0)); c.stroke(); }
    const half = 38 * RAD, fd = 0.9;
    G.line(c, X(camX - Math.tan(half) * fd), Y(camZ - fd), X(camX + Math.tan(half) * fd), Y(camZ - fd), PAL.ink, 2);
    const follow = Math.round(fi * (N - 1));
    let info = null;
    for (let i = 0; i < N; i++) {
      const sx = (i / (N - 1)) * 2 - 1, dx0 = sx * Math.tan(half), dz0 = -1, l = Math.hypot(dx0, dz0), dx = dx0 / l, dz = dz0 / l;
      const tF = -camZ / dz, fx = camX + dx * tF;
      const on = i === follow;
      G.dot(c, X(camX + dx0 * fd), Y(camZ - fd), on ? 3 : 1.6, PAL.ink);
      const room = fx >= 0 && fx < BW ? fl.find(r => fx >= r.x0 && fx < r.x0 + r.w) : null;
      const wn = room ? room.wins.find(q => fx >= q.x0 && fx <= q.x0 + q.w) : null;
      G.line(c, X(camX), Y(camZ), X(fx), Y(0), on ? PAL.ink : PAL.muted, on ? 2 : 1, on ? null : [3, 3]);
      let rec = { dx, dz, tF, fx, room, wn, tEnd: tF };
      if (wn) {
        const u = (fx - room.x0) / room.w, tr = IM.trace(u, 0.5, room.w, room.h, room.d, [dx, 0, dz]);
        const hx = room.x0 + (tr.hit[0] + 1) / 2 * room.w, hz = -tr.hit[2] * room.d;
        const tIn = Math.hypot(hx - fx, hz);
        G.line(c, X(fx), Y(0), X(hx), Y(hz), PAL.ray, on ? 2.6 : 1.4);
        G.dot(c, X(hx), Y(hz), on ? 4 : 2.5, PAL.accent);
        Object.assign(rec, { u, tr, hx, hz, tEnd: tF + tIn });
      } else G.dot(c, X(fx), Y(0), on ? 3.5 : 2, PAL.muted);
      if (on) info = rec;
    }
    G.dot(c, X(camX), Y(camZ), 6, PAL.ink); G.text(c, 'camera', X(camX) + 10, Y(camZ), PAL.ink, { size: 10 });
    if (info) {
      const t = tf * info.tEnd, px = camX + info.dx * t, pz = camZ + info.dz * t;
      G.dot(c, X(px), Y(pz), 6, PAL.bg, PAL.accent, 2.5);
      G.text(c, 'p(t)', X(px) + 10, Y(pz) - 10, PAL['accent-ink'], { size: 11, weight: 600, halo: PAL.bg });
      const inRoom = t > info.tF && info.wn;
      const rows = [
        ['o (camera)', `(${fmt(camX, 1)}, ${fmt(camZ, 1)})`],
        ['d (unit)', `(${fmt(info.dx, 3)}, ${fmt(info.dz, 3)})`],
        ['t', fmt(t, 2) + ' m'],
        ['p(t) = o + t·d', `(${fmt(px, 2)}, ${fmt(pz, 2)})`, 'win'],
        ['t at the glass', fmt(info.tF, 2) + ' m'],
        ['segment', t <= info.tF ? 'rasterizer (camera → glass)' : (info.wn ? 'shader (glass → wall)' : 'stopped at concrete')]
      ];
      if (info.wn) rows.push(['room / roomUV.x', `#${info.room.id} / ${fmt(info.u, 3)}`], ['box hit', `${WALLS[info.tr.wall]} at t_box ${fmt(info.tr.t, 3)}`]);
      else rows.push(['glass?', info.room ? 'no, this ray hits wall' : 'misses the building']);
      ro('fan-ro', rows.map((r, i) => (i === 5 && inRoom) ? [r[0], r[1], 'on'] : r));
    }
  });
  bindRange('fan-cx', x => fmt(x, 1) + ' m', () => F.draw());
  bindRange('fan-n', x => fmt(x, 0), () => F.draw());
  bindRange('fan-i', x => fmt(x, 2), () => F.draw());
  bindRange('fan-t', x => fmt(x * 100, 0) + '%', () => F.draw());
}

/* ===== Chapter 04: tangent frame ===== */
function labFrame() {
  const st = {};
  function compute() {
    const th = val('frame-yaw') * RAD, cx = val('frame-cx'), flip = $('#frame-flip').checked;
    const ctr = [0, -3];
    const N = [Math.sin(th), Math.cos(th)];
    const Gp = [ctr[0] + N[0] * 2, ctr[1] + N[1] * 2];
    let T = [N[1], -N[0]]; if (flip) T = [-T[0], -T[1]];
    const cam = [cx, 6.5], camH = 1.5;
    let V = [Gp[0] - cam[0], -camH, Gp[1] - cam[1]]; const l = Math.hypot(...V); V = V.map(x => x / l);
    const vts = [V[0] * T[0] + V[2] * T[1], V[1], V[0] * N[0] + V[2] * N[1]];
    const relX = (cam[0] - Gp[0]) * T[0] + (cam[1] - Gp[1]) * T[1], relZ = (cam[0] - Gp[0]) * N[0] + (cam[1] - Gp[1]) * N[1];
    Object.assign(st, { th, N, T, Gp, ctr, cam, V, vts, flip, relX, relZ, camH });
  }
  const F = fig($('#frame-canvas'), (c, w, h) => {
    compute();
    const sc = Math.min(w / 14, h / 14.5), X = x => w / 2 + x * sc, Y = z => h * 0.5 + (z - 0.1) * sc;
    const { th, N, T, Gp, ctr, cam, V } = st;
    const R = (x, z) => [ctr[0] + x * Math.cos(th) + z * Math.sin(th), ctr[1] - x * Math.sin(th) + z * Math.cos(th)];
    const corners = [R(-3, -2), R(3, -2), R(3, 2), R(-3, 2)];
    c.beginPath(); corners.forEach((p, i) => i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1]))); c.closePath();
    c.fillStyle = PAL['surface-2']; c.fill(); c.strokeStyle = PAL.muted; c.lineWidth = 1.5; c.stroke();
    const g0 = R(-1.4, 2), g1 = R(1.4, 2);
    G.line(c, X(g0[0]), Y(g0[1]), X(g1[0]), Y(g1[1]), PAL.ray, 5);
    G.text(c, 'building', X(ctr[0]), Y(ctr[1]), PAL.muted, { align: 'center', size: 10 });
    G.line(c, X(cam[0]), Y(cam[1]), X(Gp[0]), Y(Gp[1]), PAL.ray, 1.5, [4, 4]);
    const L = 2.6, hv = Math.hypot(V[0], V[2]), E = [Gp[0] + V[0] / hv * L, Gp[1] + V[2] / hv * L];
    G.arrow(c, X(Gp[0]), Y(Gp[1]), X(E[0]), Y(E[1]), PAL.ray, 2.2);
    G.text(c, 'V', X(E[0]) + 8, Y(E[1]), PAL.ray, { weight: 700, size: 12, halo: PAL.bg });
    const vt = (V[0] * T[0] + V[2] * T[1]) / hv * L, vn = (V[0] * N[0] + V[2] * N[1]) / hv * L;
    const pT = [Gp[0] + T[0] * vt, Gp[1] + T[1] * vt], pN = [Gp[0] + N[0] * vn, Gp[1] + N[1] * vn];
    G.line(c, X(E[0]), Y(E[1]), X(pT[0]), Y(pT[1]), PAL['ax-x'], 1.2, [3, 3]);
    G.line(c, X(E[0]), Y(E[1]), X(pN[0]), Y(pN[1]), PAL['ax-z'], 1.2, [3, 3]);
    G.arrow(c, X(Gp[0]), Y(Gp[1]), X(Gp[0] + T[0] * 1.7), Y(Gp[1] + T[1] * 1.7), PAL['ax-x'], 2.4);
    G.arrow(c, X(Gp[0]), Y(Gp[1]), X(Gp[0] + N[0] * 1.7), Y(Gp[1] + N[1] * 1.7), PAL['ax-z'], 2.4);
    G.text(c, 'T', X(Gp[0] + T[0] * 2.05), Y(Gp[1] + T[1] * 2.05), PAL['ax-x'], { weight: 700, size: 12, align: 'center', halo: PAL.bg });
    G.text(c, 'N', X(Gp[0] + N[0] * 2.05), Y(Gp[1] + N[1] * 2.05), PAL['ax-z'], { weight: 700, size: 12, align: 'center', halo: PAL.bg });
    G.dot(c, X(Gp[0]), Y(Gp[1]), 5, PAL.bg, PAL['ax-y'], 2); G.dot(c, X(Gp[0]), Y(Gp[1]), 1.6, PAL['ax-y']);
    G.dot(c, X(cam[0]), Y(cam[1]), 6, PAL.ink); G.text(c, 'camera, 1.5 m up', X(cam[0]) + 10, Y(cam[1]), PAL.ink, { size: 10 });
    const v = st.vts;
    ro('frame-ro', [
      ['N', `(${fmt(N[0])}, 0, ${fmt(N[1])})`],
      ['T', `(${fmt(T[0])}, 0, ${fmt(T[1])})`, st.flip ? 'on' : ''],
      ['B', '(0, 1, 0)'],
      ['V (unit)', vec(V)],
      ['viewTS.x = V·T', fmt(v[0], 3), 'win'],
      ['viewTS.y = V·B', fmt(v[1], 3), 'win'],
      ['viewTS.z = V·N', fmt(v[2], 3), 'win'],
      ['verdict', st.flip ? '<span class="pill bad">room mirrored sideways</span>' : '<span class="pill good">correct</span>']
    ]);
    P.draw();
  });
  const P = fig($('#frame-prev'), (c, w, h) => {
    if (!st.Gp) compute();
    renderWindow({ ctx: c, w, h }, { W: 4, H: 3, D: 4, cam: [st.relX, st.camH, st.relZ], b: 0.5, cell: [1, 0], flip: false, tflip: st.flip });
  });
  bindRange('frame-yaw', deg, () => F.draw());
  bindRange('frame-cx', x => fmt(x, 1) + ' m', () => F.draw());
  $('#frame-flip').addEventListener('change', () => F.draw());
}

/* ===== Chapter 05: meters versus unit box ===== */
function labNorm() {
  let cur = null;
  function compute() {
    const W = val('norm-w'), D = val('norm-d'), u = val('norm-u'), a = val('norm-a') * RAD;
    const V = [Math.sin(a), 0, -Math.cos(a)];
    cur = { W, D, u, a, V, tr: IM.trace(u, 0.5, W, 3, D, V) };
  }
  const A = fig($('#norm-real'), (c, w, h) => {
    compute(); const { W, D, u, tr } = cur;
    const sc = (Math.min(w, h) - 36) / 10.5, ox = (w - W * sc) / 2, oy = h - 22;
    const X = x => ox + x * sc, Y = z => oy - z * sc;
    G.rect(c, X(0), Y(D), W * sc, D * sc, PAL.surface, PAL.muted, 1.2);
    const wl = tr.wall;
    const hl = (x1, z1, x2, z2) => G.line(c, X(x1), Y(z1), X(x2), Y(z2), PAL.accent, 4);
    if (wl === 0) hl(0, 0, 0, D); if (wl === 1) hl(W, 0, W, D); if (wl === 4) hl(0, D, W, D);
    G.line(c, X(0), Y(0), X(W), Y(0), PAL.ray, 4);
    const ex = u * W, hx = (tr.hit[0] + 1) / 2 * W, hz = tr.hit[2] * D;
    G.arrow(c, X(ex), Y(0), X(hx), Y(hz), PAL.ray, 2);
    G.dot(c, X(hx), Y(hz), 5, PAL.accent);
    G.text(c, `${fmt(W, 1)} m`, X(W / 2), oy + 12, PAL.muted, { align: 'center', size: 10 });
    G.text(c, `${fmt(D, 1)} m`, X(W) + 6, Y(D / 2), PAL.muted, { size: 10 });
    G.text(c, `${deg(cur.a / RAD)} in meters`, 8, 12, PAL.muted, { size: 10 });
    B.draw();
  });
  const B = fig($('#norm-unit'), (c, w, h) => {
    if (!cur) compute(); const { tr } = cur;
    const sc = (Math.min(w, h) - 40) / 2.1, ox = w / 2, oy = h - 22;
    const X = x => ox + x * sc, Y = z => oy - z * sc;
    G.rect(c, X(-1), Y(1), 2 * sc, sc, PAL.surface, PAL.muted, 1.2);
    const wl = tr.wall, hl = (x1, z1, x2, z2) => G.line(c, X(x1), Y(z1), X(x2), Y(z2), PAL.accent, 4);
    if (wl === 0) hl(-1, 0, -1, 1); if (wl === 1) hl(1, 0, 1, 1); if (wl === 4) hl(-1, 1, 1, 1);
    G.line(c, X(-1), Y(0), X(1), Y(0), PAL.ray, 4);
    G.arrow(c, X(tr.o[0]), Y(0), X(tr.hit[0]), Y(tr.hit[2]), PAL.ray, 2);
    G.dot(c, X(tr.hit[0]), Y(tr.hit[2]), 5, PAL.accent);
    G.text(c, '−1', X(-1), oy + 12, PAL.muted, { align: 'center', size: 10 }); G.text(c, '1', X(1), oy + 12, PAL.muted, { align: 'center', size: 10 });
    G.text(c, 'z = 1', X(1) + 6, Y(1), PAL.muted, { size: 10 });
    const ang = Math.atan2(tr.d[0], tr.d[2]) / RAD;
    G.text(c, `${deg(ang)} in the box`, 8, 12, PAL.muted, { size: 10 });
  });
  function table() {
    const { W, D, V, tr } = cur;
    const frac = tr.wall === 4 ? `x = ${fmt((tr.hit[0] + 1) / 2 * 100, 0)}% across` : `z = ${fmt(tr.hit[2] * 100, 0)}% deep`;
    ro('norm-ro', [
      ['viewTS', `(${fmt(V[0], 3)}, 0, ${fmt(V[2], 3)})`],
      ['W/2, D', `${fmt(W / 2, 2)}, ${fmt(D, 2)}`],
      ['d.x = V.x/(W/2)', fmt(tr.d[0], 3)],
      ['d.z = −V.z/D', fmt(tr.d[2], 3)],
      ['t_x, t_z', `${fmt(tr.tX, 3)}, ${fmt(tr.tZ, 3)}`],
      ['wall', WALLS[tr.wall], 'win'],
      ['where on it', frac, 'win'],
      ['hit in meters', `x ${fmt((tr.hit[0] + 1) / 2 * W, 2)}, depth ${fmt(tr.hit[2] * D, 2)}`]
    ]);
  }
  const all = () => { A.draw(); table(); };
  ['norm-w', 'norm-d'].forEach(id => bindRange(id, m, all));
  bindRange('norm-u', x => fmt(x, 2), all);
  bindRange('norm-a', deg, all);
  compute(); table();
}

/* ===== Chapter 06: slab test ===== */
function labSlab() {
  let step = 7, tr = null;
  const STEPS = [
    'Start on the glass. o = (2u − 1, 2v − 1, 0) puts the glass point in box coordinates.',
    'Scale the view direction by the room: d = (V.x/(W/2), V.y/(H/2), −V.z/D). Here W = 4 m, H = 3 m, D = 4 m.',
    'Every plane test divides by d, so compute 1/d once.',
    't_x: when does the ray reach the side wall it is moving toward? |1/d.x| − o.x/d.x.',
    't_y: same for the floor or ceiling.',
    't_z: the back wall at z = 1. o.z is 0, so t_z = 1/d.z.',
    'Take the smallest t. That is the first wall the ray reaches, and hit = o + t·d is the point the pixel sees.',
    'All steps shown. Filled dot: the winner. Hollow dots: crossings of the invisible plane extensions, outside the box.'
  ];
  const ROWS = ['o', 'd', '1/d', 't_x', 't_y', 't_z', 't = min', 'wall', 'hit'];
  const rowStep = [0, 1, 2, 3, 4, 5, 6, 6, 6];
  function compute() {
    const yaw = val('slab-yaw') * RAD, pitch = val('slab-pitch') * RAD;
    const V = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
    tr = IM.trace(val('slab-u'), val('slab-v'), 4, 3, 4, V);
  }
  function drawView(c, w, h, side) {
    const pad = 10, rangeA = [-1.9, 1.9], rangeZ = [-0.3, 1.95];
    const sc = Math.min((w - 2 * pad) / (rangeA[1] - rangeA[0]), (h - 2 * pad) / (rangeZ[1] - rangeZ[0]));
    const cx = w / 2, by = h - pad - (-rangeZ[0]) * sc;
    const P = side ? (a, z) => [pad + (z - rangeZ[0]) * sc, h / 2 - a * sc] : (a, z) => [cx + a * sc, by - z * sc];
    const ln = (a1, z1, a2, z2, col, wd, dash) => { const p = P(a1, z1), q = P(a2, z2); G.line(c, p[0], p[1], q[0], q[1], col, wd, dash); };
    ln(-1, 1, -1, 3, PAL.line, 1, [4, 4]); ln(1, 1, 1, 3, PAL.line, 1, [4, 4]); ln(-3, 1, -1, 1, PAL.line, 1, [4, 4]); ln(1, 1, 3, 1, PAL.line, 1, [4, 4]);
    const q0 = P(-1, 0), q1 = P(1, 1);
    c.fillStyle = PAL.surface; c.fillRect(Math.min(q0[0], q1[0]), Math.min(q0[1], q1[1]), Math.abs(q1[0] - q0[0]), Math.abs(q1[1] - q0[1]));
    ln(-1, 0, -1, 1, PAL.muted, 1.4); ln(1, 0, 1, 1, PAL.muted, 1.4); ln(-1, 1, 1, 1, PAL.muted, 1.4);
    ln(-1, 0, 1, 0, PAL.ray, 4);
    const ai = side ? 1 : 0;
    const lab = side ? ['y', 'z'] : ['x', 'z'];
    const t0 = P(1.05, 0); G.text(c, 'glass', side ? t0[0] + 4 : t0[0] + 4, side ? P(1.6, 0)[1] : t0[1], PAL.ray, { size: 10 });
    const at = P(rangeA[0] + 0.1, rangeZ[1] - 0.12); G.text(c, side ? 'side: z →, y ↑' : 'top: x →, z ↑', side ? 6 : at[0], side ? 12 : at[1], PAL.muted, { size: 10 });
    if (!tr) return;
    const pt = t => [tr.o[ai] + tr.d[ai] * t, tr.o[2] + tr.d[2] * t];
    const cand = [['t_x', tr.tX, 3], ['t_y', tr.tY, 4], ['t_z', tr.tZ, 5]];
    const tMax = Math.min(Math.max(tr.tX, tr.tY, tr.tZ), 50);
    if (step >= 1) {
      const e = pt(tMax), o = P(tr.o[ai], 0), ee = P(e[0], e[1]);
      G.line(c, o[0], o[1], ee[0], ee[1], PAL.ray, 1.2, [5, 4]);
      const hh = pt(tr.t), hp = P(hh[0], hh[1]);
      G.line(c, o[0], o[1], hp[0], hp[1], PAL.ray, 2.6);
    }
    for (const [name, t, s] of cand) {
      if (step < s) continue;
      const q = pt(t), p = P(q[0], q[1]), win = Math.abs(t - tr.t) < 1e-9 && step >= 6;
      const inView = q[0] > rangeA[0] && q[0] < rangeA[1] && q[1] < rangeZ[1];
      if (!inView || t > 1e4) continue;
      G.dot(c, p[0], p[1], win ? 6 : 5, win ? PAL.accent : PAL.bg, win ? PAL['accent-ink'] : PAL.muted, 1.8);
      const off = { t_x: [8, -10], t_y: [8, 12], t_z: [-30, -10] }[name];
      G.text(c, name, p[0] + off[0], p[1] + off[1], win ? PAL['accent-ink'] : PAL.muted, { size: 10, weight: 600, halo: PAL.bg });
    }
    const o = P(tr.o[ai], 0); G.dot(c, o[0], o[1], 4.5, PAL.ink);
    G.text(c, 'o', o[0] - 10, o[1] + (side ? 0 : 10), PAL.ink, { size: 11, weight: 700, halo: PAL.bg });
  }
  const A = fig($('#slab-top'), (c, w, h) => drawView(c, w, h, false));
  const B = fig($('#slab-side'), (c, w, h) => drawView(c, w, h, true));
  function table() {
    const vals = [vec(tr.o), vec(tr.d, 3), vec(tr.inv, 2), fmt(tr.tX, 3), fmt(tr.tY, 3), fmt(tr.tZ, 3), fmt(tr.t, 3), WALLS[tr.wall], vec(tr.hit, 3)];
    ro('slab-ro', ROWS.map((r, i) => [r, step >= rowStep[i] ? vals[i] : '·', (step < 7 && rowStep[i] === step) ? 'on' : (i >= 6 && step >= 6 ? 'win' : '')]));
    $('#slab-explain').textContent = STEPS[step];
    $('#slab-step').textContent = step < 7 ? `step ${step + 1} of 7` : 'all steps';
  }
  const all = () => { compute(); A.draw(); B.draw(); table(); };
  bindRange('slab-u', x => fmt(x, 2), all); bindRange('slab-v', x => fmt(x, 2), all);
  bindRange('slab-yaw', deg, all); bindRange('slab-pitch', deg, all);
  $('#slab-next').addEventListener('click', () => { step = step >= 7 ? 0 : step + 1; all(); });
  $('#slab-prev').addEventListener('click', () => { step = step <= 0 ? 7 : step - 1; all(); });
  $('#slab-all').addEventListener('click', () => { step = 7; all(); });
  compute(); table();
}

/* ===== Chapter 07: projection, side view ===== */
function labProj() {
  const Dn = 2;
  const F = fig($('#proj-canvas'), (c, w, h) => {
    const b = val('proj-b'), pp = val('proj-p'), k = 1 / b - 1, cdist = Dn / k;
    const L = 2 * Dn + 2; let d = pp * L, z, y;
    if (d < Dn) { z = d / Dn; y = 1; } else if (d < Dn + 2) { z = 1; y = 1 - (d - Dn); } else { z = 1 - (d - Dn - 2) / Dn; y = -1; }
    const s = 1 / (1 + z * k), yi = y * s, cv = yi * 0.5 + 0.5;
    const strip = 54, avail = w - strip - 30, span = cdist + Dn + 0.4;
    const sc = Math.min(avail / span, (h - 30) / 2.4);
    const X = zz => 14 + (zz + cdist + 0.2) * sc, Y = yy => h / 2 - yy * sc;
    G.rect(c, X(0), Y(1), Dn * sc, 2 * sc, PAL.surface, PAL.muted, 1.4);
    G.line(c, X(0), Y(1), X(0), Y(-1), PAL.ray, 4);
    const bwX = X(Dn); G.line(c, bwX, Y(1), bwX, Y(-1), PAL.muted, 2.5);
    G.line(c, X(-cdist), Y(0), X(0), Y(1), PAL.line, 1.2); G.line(c, X(-cdist), Y(0), X(0), Y(-1), PAL.line, 1.2);
    G.line(c, X(-cdist), Y(0), X(Dn), Y(1), PAL.line, 1, [3, 4]); G.line(c, X(-cdist), Y(0), X(Dn), Y(-1), PAL.line, 1, [3, 4]);
    G.line(c, X(0) - 6, Y(b), X(0) + 6, Y(b), PAL.muted, 1.5); G.line(c, X(0) - 6, Y(-b), X(0) + 6, Y(-b), PAL.muted, 1.5);
    const px = X(z * Dn), py = Y(y);
    G.line(c, X(-cdist), Y(0), px, py, PAL.accent, 2);
    G.dot(c, px, py, 6, PAL.accent);
    G.dot(c, X(0), Y(yi), 5, PAL.bg, PAL['accent-ink'], 2.2);
    G.dot(c, X(-cdist), Y(0), 6, PAL.ink);
    G.text(c, 'camera', X(-cdist), Y(0) + 16, PAL.ink, { align: 'center', size: 10 });
    G.text(c, `c = ${fmt(cdist / Dn, 2)} D`, X(-cdist / 2), Y(0) - 10, PAL.muted, { align: 'center', size: 10, halo: PAL.bg });
    G.text(c, 'opening', X(0), Y(1) - 10, PAL.ray, { align: 'center', size: 10 });
    G.text(c, 'back wall', bwX, Y(1) - 10, PAL.muted, { align: 'center', size: 10 });
    const sx = w - strip + 8, sw = 16, top = Y(1), bot = Y(-1), Hs = bot - top;
    G.rect(c, sx, top, sw, Hs, PAL['surface-2'], PAL.line, 1);
    G.rect(c, sx, top + Hs * (0.5 - b / 2), sw, Hs * b, PAL['ray-soft'], PAL.ray, 1);
    const my = top + Hs * (1 - cv);
    G.line(c, sx - 5, my, sx + sw + 5, my, PAL['accent-ink'], 2.5);
    G.text(c, '1', sx + sw + 6, top + 4, PAL.muted, { size: 10 }); G.text(c, '0', sx + sw + 6, bot - 4, PAL.muted, { size: 10 });
    G.text(c, 'cell v', sx - 2, bot + 12, PAL.muted, { size: 10 });
    ro('proj-ro', [
      ['k = 1/b − 1', fmt(k, 3)],
      ['camera distance', `c = D/k = ${fmt(1 / k, 2)} × depth`],
      ['point (z, y)', `(${fmt(z, 3)}, ${fmt(y, 3)})`],
      ['s = 1/(1 + z·k)', fmt(s, 3), 'win'],
      ['image y = y·s', fmt(yi, 3)],
      ['cell v = y·s·0.5 + 0.5', fmt(cv, 3), 'win'],
      ['back-wall corner', `0.5 ± 0.5·b = ${fmt(0.5 - b / 2, 3)} / ${fmt(0.5 + b / 2, 3)}`]
    ]);
  });
  bindRange('proj-b', x => fmt(x, 2), () => F.draw());
  bindRange('proj-p', x => fmt(x, 2), () => F.draw());
}
function labDepth() {
  const A = atlases();
  let pts = [];
  const view = () => { const yaw = val('depth-yaw') * RAD, p = val('depth-pitch') * RAD, dist = 5; return [dist * Math.sin(yaw) * Math.cos(p), -dist * Math.sin(p), dist * Math.cos(yaw) * Math.cos(p)]; };
  const P = fig($('#depth-prev'), (c, w, h) => {
    const cam = view(), D = val('depth-d');
    renderWindow({ ctx: c, w, h }, { W: 4, H: 3.2, D, cam, b: 0.5, cell: [0, 0], flip: false, tex: 'grid' });
    pts = [];
    for (let j = 0; j <= 6; j++) for (let i = 0; i <= 8; i++) {
      const u = 0.02 + i / 8 * 0.96, v = 0.02 + j / 6 * 0.96;
      let V = [(u - 0.5) * 4 - cam[0], (v - 0.5) * 3.2 - cam[1], -cam[2]]; const l = Math.hypot(...V); V = V.map(x => x / l);
      const tr = IM.trace(u, v, 4, 3.2, D, V), pr = IM.project(tr.hit, 0.5);
      pts.push({ cu: pr.cu, cv: pr.cv, corner: (i === 0 || i === 8) && (j === 0 || j === 6) });
    }
    C.draw();
  });
  const C = fig($('#depth-cell'), (c, w, h) => {
    const s = Math.min(w, h), Cc = ATL.cell;
    c.imageSmoothingEnabled = true;
    c.drawImage(A.grid.canvas, 0, (ATL.rows - 1) * Cc, Cc, Cc, 0, 0, s, s);
    for (const p of pts) G.dot(c, p.cu * s, (1 - p.cv) * s, p.corner ? 5 : 2.2, p.corner ? PAL.accent : 'rgba(20,20,20,.75)', p.corner ? '#1b1b1b' : null, 1.5);
  });
  bindRange('depth-d', m, () => P.draw()); bindRange('depth-yaw', deg, () => P.draw()); bindRange('depth-pitch', deg, () => P.draw());
}

/* ===== Chapter 08: backWallFrac budget ===== */
function labBwf() {
  const cache = new Map();
  function cellFor(b) {
    const key = b.toFixed(2); if (cache.has(key)) return cache.get(key);
    const Cc = 200, cv = mkCanvas(Cc, Cc), ctx = cv.getContext('2d'), img = ctx.createImageData(Cc, Cc);
    gridCell(img.data, Cc, 0, 0, Cc, b); ctx.putImageData(img, 0, 0); cache.set(key, cv); return cv;
  }
  const A = fig($('#bwf-cell'), (c, w, h) => {
    const b = val('bwf-b'), s = Math.min(w, h);
    c.drawImage(cellFor(b), 0, 0, s, s);
    const q = s * (0.5 - b / 2); G.rect(c, q, q, s * b, s * b, null, '#1d1d1d', 2, [5, 4]);
  });
  const B = fig($('#bwf-chart'), (c, w, h) => {
    const b = val('bwf-b'), D = val('bwf-d'), k = 1 / b - 1, k5 = 1;
    const f = (kk, z) => 256 * kk / Math.pow(1 + z * kk, 2) / D;
    const ymax = Math.max(f(k, 0), f(k5, 0)) * 1.12;
    const L = 40, R = 10, T = 12, Bm = 30, pw = w - L - R, ph = h - T - Bm;
    const X = z => L + z * pw, Y = v => T + ph - v / ymax * ph;
    const step = [10, 20, 25, 50, 100, 200, 250, 500].find(s => ymax / s <= 6) || 1000;
    for (let v = 0; v <= ymax; v += step) { G.line(c, L, Y(v), L + pw, Y(v), PAL.line, 1); G.text(c, fmt(v, 0), L - 6, Y(v), PAL.muted, { align: 'right', size: 10 }); }
    G.line(c, L, T + ph, L + pw, T + ph, PAL.muted, 1);
    for (let i = 0; i <= 4; i++) G.text(c, fmt(D * i / 4, 1), X(i / 4), T + ph + 12, PAL.muted, { align: 'center', size: 10 });
    G.text(c, 'depth (m)', L + pw, T + ph + 24, PAL.muted, { align: 'right', size: 10 });
    const curve = (kk, col, wd, dash) => { c.beginPath(); for (let i = 0; i <= 60; i++) { const z = i / 60, p = [X(z), Y(f(kk, z))]; i ? c.lineTo(...p) : c.moveTo(...p); } c.setLineDash(dash || []); c.strokeStyle = col; c.lineWidth = wd; c.stroke(); c.setLineDash([]); };
    c.beginPath(); c.moveTo(X(0), Y(0)); for (let i = 0; i <= 60; i++) { const z = i / 60; c.lineTo(X(z), Y(f(k, z))); } c.lineTo(X(1), Y(0)); c.closePath(); c.fillStyle = PAL['accent-soft']; c.fill();
    curve(k5, PAL.muted, 1.5, [5, 4]); curve(k, PAL.accent, 2.5);
    G.dot(c, X(0), Y(f(k, 0)), 3.5, PAL.accent); G.dot(c, X(1), Y(f(k, 1)), 3.5, PAL.accent);
    G.text(c, `${fmt(f(k, 0), 0)} px/m`, X(0) + 8, Y(f(k, 0)) + 2, PAL['accent-ink'], { size: 10, weight: 600, halo: PAL.bg });
  });
  function table() {
    const b = val('bwf-b'), W = val('bwf-w'), D = val('bwf-d'), H = 3.2, k = 1 / b - 1, c = b * D / (1 - b);
    ro('bwf-ro', [
      ['k = 1/b − 1', fmt(k, 3)],
      ['back wall share b²', fmt(b * b * 100, 1) + ' %', 'win'],
      ['each side band (1−b)/2', fmt((1 - b) / 2 * 100, 1) + ' %'],
      ['sharpness front / back', fmt(1 / (b * b), 2) + ' ×', 'win'],
      ['camera distance c', fmt(c, 2) + ' m'],
      ['horizontal FOV', deg(2 * Math.atan(W / 2 / c) / RAD)],
      ['vertical FOV (H 3.2 m)', deg(2 * Math.atan(H / 2 / c) / RAD)],
      ['lens on 36 mm sensor', fmt(36 * c / W, 1) + ' mm']
    ]);
  }
  const all = () => { A.draw(); B.draw(); table(); };
  bindRange('bwf-b', x => fmt(x, 2), all); bindRange('bwf-w', m, all); bindRange('bwf-d', m, all);
  table();
}

/* ===== Chapter 09: pixel inspector ===== */
function swatch(col) { const c = col.map(v => Math.round(Math.pow(clamp(v, 0, 1), 0.94) * 255)); return `<span style="display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;border:1px solid var(--line);background:rgb(${c})"></span> rgb(${c.join(', ')})`; }
function labTrace() {
  let rec = null;
  const view = new FacadeView($('#trace-view'), { state: { yaw: 0.5, pitch: 0.16 }, onPick: r => { rec = r; panel(); minis(); } });
  function findDefault() {
    const cam = view.camera(), ray = [0, 0, 0];
    for (let j = 40; j < view.H - 20; j += 3) for (let i = 30; i < view.W - 30; i += 3) {
      view.rayFor(cam, i, j, ray); const r = {}; view.shade(cam.P, ray[0], ray[1], ray[2], [0, 0, 0], r);
      if (r.kind === 'glass' && r.room.id === 2 && r.win === r.room.wins[1] && r.v > 0.55 && r.u > 0.78) return { i, j };
    }
    return { i: 300, j: 160 };
  }
  view.pick = findDefault();
  const step = (title, body) => `<div class="st"><h4>${title}</h4><div class="f">${body}</div></div>`;
  function panel() {
    const el = $('#trace-steps');
    if (!rec || rec.kind !== 'glass') {
      const what = rec ? { sky: 'sky or street', wall: 'concrete', frame: 'a window frame' }[rec.kind] : 'nothing';
      el.innerHTML = step('Nothing to trace', `This pixel sees ${what}.\nOnly glass pixels run the interior shader.\nClick a window.`);
      return;
    }
    const r = rec, t = r.tr, o = t.slice(0, 3), d = t.slice(3, 6), inv = t.slice(6, 9), hit = r.hit, room = r.room;
    const wl = WALLS[t[13]];
    const lines = [];
    lines.push(step('Rasterization found the glass',
      `facade point   (${fmt(r.fx, 2)}, ${fmt(r.fy, 2)}) m\nroom          #${room.id} ${room.typeName}, window ${room.wins.indexOf(r.win) + 1}`));
    lines.push(step('View vector in room space',
      `V = P − C     ${vec(r.V, 3)}  <span class="c">(unit)</span>\nT=(1,0,0) B=(0,1,0) N=(0,0,1) <span class="c">this facade faces +z</span>\nviewTS        ${vec(r.Vts, 3)}`));
    lines.push(step('Position in the room rectangle',
      `u = (x − x0)/W = (${fmt(r.fx, 2)} − ${fmt(r.perwin ? r.win.x0 : room.x0, 2)}) / ${fmt(r.Wm, 2)} = ${fmt(r.u, 3)}\nv = (y − y0)/H = ${fmt(r.v, 3)}\nroomSize      (${fmt(r.Wm, 2)}, ${fmt(r.Hm, 2)}, ${fmt(r.D, 2)}) m <span class="c">depth incl. jitter</span>`));
    lines.push(step('Into the unit box',
      `o = (2u−1, 2v−1, 0)       ${vec(o, 3)}\nd = (Vx/(W/2), Vy/(H/2), −Vz/D)\n  = ${vec(d, 3)}`));
    lines.push(step('Slab test',
      `1/d           ${vec(inv, 2)}\nt_x = |1/dx| − ox/dx = ${fmt(t[9], 3)}\nt_y = |1/dy| − oy/dy = ${fmt(t[10], 3)}\nt_z = 1/dz           = ${fmt(t[11], 3)}\nt = min = ${fmt(t[12], 3)}  →  <b>${wl}</b>`));
    lines.push(step('Hit point',
      `hit = o + t·d = ${vec(hit, 3)}` + (view.s.lod === 1 ? '\n<span class="c">LOD1: back plane only</span>' : '')));
    lines.push(step('Into the picture',
      `k = 1/b − 1 = 1/${fmt(r.bS, 2)} − 1 = ${fmt(r.k, 3)}\ns = 1/(1 + ${fmt(hit[2], 3)}·${fmt(r.k, 2)}) = ${fmt(r.s, 3)}\ncellUV = hit.xy·s·0.5 + 0.5 = (${fmt(r.cuRaw, 3)}, ${fmt(r.cvRaw, 3)})`));
    lines.push(step('Pick the room',
      `seed ${fmt(room.seed, 3)}  hCell ${fmt(room.H.cell, 3)} → column ${r.cell[0]}, row ${r.cell[1]} (${ROW_NAMES[r.cell[1]]})\nflip ${r.flip ? 'yes → cellUV.x = 1 − x = ' + fmt(r.cu, 3) : 'no'}\natlasUV = (cell + cellUV) / (4, 3) = (${fmt(r.au, 3)}, ${fmt(r.av, 3)})`));
    const cu = r.curt;
    lines.push(step('Layers and glass',
      `lit ${r.lit ? 'yes' : 'no'} <span class="c">(hLit ${fmt(room.H.lit, 2)} vs LitChance ${fmt(view.s.lit, 2)})</span>\ncurtain ${cu ? (cu.vis ? `plane at z ${cu.zc}, t_c ${fmt(cu.tc, 3)} ≤ t, alpha ${fmt(cu.a, 2)}` : `t_c ${fmt(cu.tc, 3)} > t, hidden by the ${wl}`) : 'none in this room'}\nFresnel F ${fmt(r.F, 3)}, transmission ${fmt(r.trn, 3)}\nfinal ${swatch(r.color)}`));
    el.innerHTML = lines.join('');
  }
  function drawBox(c, w, h, side) {
    const pad = 8, sc = Math.min((w - 2 * pad) / 2.4, (h - 2 * pad) / 2.4);
    const P = side ? (a, z) => [w / 2 + (z - 0.5) * sc * 1.6, h / 2 - a * sc] : (a, z) => [w / 2 + a * sc, h / 2 + (0.5 - z) * sc * 1.6];
    const q0 = P(-1, 0), q1 = P(1, 1);
    G.rect(c, Math.min(q0[0], q1[0]), Math.min(q0[1], q1[1]), Math.abs(q1[0] - q0[0]), Math.abs(q1[1] - q0[1]), PAL.surface, PAL.muted, 1.2);
    const g0 = P(-1, 0), g1 = P(1, 0); G.line(c, g0[0], g0[1], g1[0], g1[1], PAL.ray, 3);
    if (!rec || rec.kind !== 'glass') return;
    const t = rec.tr, ai = side ? 1 : 0, o = [t[ai], 0], hp = [rec.hit[ai], rec.hit[2]];
    const a = P(o[0], o[1]), b2 = P(clamp(hp[0], -1.15, 1.15), clamp(hp[1], 0, 1.1));
    G.line(c, a[0], a[1], b2[0], b2[1], PAL.ray, 2);
    G.dot(c, b2[0], b2[1], 4, PAL.accent); G.dot(c, a[0], a[1], 3, PAL.ink);
  }
  const TT = fig($('#trace-top'), (c, w, h) => drawBox(c, w, h, false));
  const TS = fig($('#trace-side'), (c, w, h) => drawBox(c, w, h, true));
  const TC = fig($('#trace-cell'), (c, w, h) => {
    const s = Math.min(w, h);
    G.rect(c, 0, 0, s, s, PAL['surface-2']);
    if (!rec || rec.kind !== 'glass') return;
    const A = atlases(), at = view.s.tex === 'grid' ? A.grid : (view.s.time !== 'day' && rec.lit ? A.night : A.day), Cc = ATL.cell;
    const sx = rec.cell[0] * Cc, sy = (ATL.rows - 1 - rec.cell[1]) * Cc;
    c.drawImage(at.canvas, sx, sy, Cc, Cc, 0, 0, s, s);
    G.dot(c, rec.cu * s, (1 - rec.cv) * s, 6, PAL.accent, '#141414', 2);
    if (rec.flip) G.text(c, 'mirrored', 4, s - 8, '#fff', { size: 10, halo: '#000' });
  });
  function minis() { TT.draw(); TS.draw(); TC.draw(); }
  bindSeg('trace-mode', v => view.set('mode', v));
  bindSeg('trace-tex', v => view.set('tex', v));
  bindRange('trace-depth', x => fmt(x, 2) + '×', x => view.set('depthMul', x));
  return view;
}

/* ===== Chapter 10: hashes ===== */
function labHash() {
  let prop = 'cell', selRoom = null;
  const COLS = ['#5b8bb5', '#c1874c', '#6f9e6a', '#a56b9a'];
  const F = fig($('#hash-facade'), (c, w, h) => {
    const lit = val('hash-lit'), pad = 10, sc = Math.min((w - 2 * pad) / BW, (h - 2 * pad) / BH), ox = (w - BW * sc) / 2, oy = h - (h - BH * sc) / 2;
    F.map = { sc, ox, oy };
    const X = x => ox + x * sc, Y = y => oy - y * sc;
    for (const r of ROOMS) {
      const Hh = r.H; let fill = PAL['surface-2'], text = '', tcol = PAL.ink;
      if (prop === 'cell') { fill = COLS[Math.floor(Hh.cell * 4)]; text = `col ${Math.floor(Hh.cell * 4)}`; tcol = '#fff'; }
      if (prop === 'flip') { fill = Hh.flip > 0.5 ? PAL['accent-soft'] : PAL['surface-2']; text = Hh.flip > 0.5 ? 'mirrored' : 'as rendered'; }
      if (prop === 'lit') { const on = Hh.lit < lit; fill = on ? '#f2b14c' : '#26303a'; text = `hLit ${fmt(Hh.lit, 2)}`; tcol = on ? '#3b2405' : '#cfd8de'; }
      if (prop === 'curt') { const on = Hh.curt < 0.55; fill = on ? PAL['ray-soft'] : PAL['surface-2']; text = on ? ['open', 'half', 'blinds', 'sheer'][Math.floor(Hh.state * 4)] : 'no curtain'; }
      if (prop === 'tint') { const t = [lerp(1, 0.92, Hh.tint), lerp(0.93, 0.97, Hh.tint), lerp(0.86, 1.05, Hh.tint)].map(v => Math.round(clamp(v * 200, 0, 255))); fill = `rgb(${t})`; text = `hTint ${fmt(Hh.tint, 2)}`; tcol = '#222'; }
      G.rect(c, X(r.x0) + 1.5, Y(r.y0 + r.h) + 1.5, r.w * sc - 3, r.h * sc - 3, fill, selRoom === r.id ? PAL.ink : PAL.line, selRoom === r.id ? 2.5 : 1);
      G.text(c, `#${r.id}`, X(r.x0) + 7, Y(r.y0 + r.h) + 12, tcol, { size: 10, weight: 600 });
      G.text(c, text, X(r.x0 + r.w / 2), Y(r.y0 + r.h / 2), tcol, { size: 11, align: 'center' });
    }
  });
  $('#hash-facade').addEventListener('click', e => {
    const mp = F.map; if (!mp) return; const p = ppos(e, e.currentTarget);
    const r = roomAt((p.x - mp.ox) / mp.sc, (mp.oy - p.y) / mp.sc); if (!r) return;
    selRoom = r.id; const s = $('#hash-seed'); s.value = r.seed.toFixed(3); s.dispatchEvent(new Event('input'));
  });
  const Pl = fig($('#hash-plot'), (c, w, h) => {
    const seed = val('hash-seed'), half = h / 2 - 6;
    G.line(c, 0, h / 2, w, h / 2, PAL.line, 1);
    c.beginPath(); for (let i = 0; i <= w; i++) { const sd = i / w, y = Math.sin((sd * 17 + 1) * 12.9898 + 78.233); i ? c.lineTo(i, 4 + (1 - (y * 0.5 + 0.5)) * (half - 4)) : c.moveTo(i, 4 + (1 - (y * 0.5 + 0.5)) * (half - 4)); }
    c.strokeStyle = PAL.ray; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = PAL.accent; for (let i = 0; i <= w; i += 2) { const sd = i / w, y = hash(sd * 17 + 1); c.fillRect(i, h / 2 + 6 + (1 - y) * (half - 4), 1.6, 1.6); }
    G.line(c, seed * w, 0, seed * w, h, PAL.ink, 1.2, [3, 3]);
  });
  function table() {
    const sd = val('hash-seed'), lit = val('hash-lit'), n = sd * 17 + 1, a = n * 12.9898 + 78.233, si = Math.sin(a), big = si * 43758.5453, Hh = roomHashes(sd);
    ro('hash-ro', [
      ['n = seed·17 + 1', fmt(n, 4)],
      ['a = n·12.9898 + 78.233', fmt(a, 4)],
      ['sin(a)', fmt(si, 6)],
      ['× 43758.5453', fmt(big, 3)],
      ['frac → hCell', fmt(Hh.cell, 4), 'win'],
      ['column = floor(hCell·4)', String(Math.floor(Hh.cell * 4))],
      ['hFlip > 0.5 → mirror', `${fmt(Hh.flip, 3)} → ${Hh.flip > 0.5 ? 'yes' : 'no'}`],
      ['hLit < LitChance → lit', `${fmt(Hh.lit, 3)} → ${Hh.lit < lit ? 'yes' : 'no'}`],
      ['hCurt < 0.55 → curtain', `${fmt(Hh.curt, 3)} → ${Hh.curt < 0.55 ? ['open', 'half', 'blinds', 'sheer'][Math.floor(Hh.state * 4)] : 'none'}`],
      ['depth × lerp(0.8, 1.2, hDepth)', fmt(lerp(0.8, 1.2, Hh.depth), 3)]
    ]);
  }
  bindSeg('hash-prop', v => { prop = v; F.draw(); });
  bindRange('hash-lit', x => fmt(x, 2), () => { F.draw(); table(); });
  bindRange('hash-seed', x => fmt(x, 3), () => { Pl.draw(); table(); });
  table();
}

/* ===== Chapter 11: Fresnel and exposure ===== */
function fresnelExact(cosI, n) {
  const sinT2 = (1 - cosI * cosI) / (n * n); if (sinT2 >= 1) return 1;
  const cosT = Math.sqrt(1 - sinT2);
  const rs = (cosI - n * cosT) / (cosI + n * cosT), rp = (cosT - n * cosI) / (cosT + n * cosI);
  return (rs * rs + rp * rp) / 2;
}
function labFresnel() {
  const F = fig($('#fres-chart'), (c, w, h) => {
    const a = val('fres-a'), n = val('fres-n'), f0 = Math.pow((1 - n) / (1 + n), 2);
    const L = 36, R = 10, T = 10, B = 26, pw = w - L - R, ph = h - T - B, X = d => L + d / 90 * pw, Y = v => T + ph - v * ph;
    for (const v of [0, 0.25, 0.5, 0.75, 1]) { G.line(c, L, Y(v), L + pw, Y(v), PAL.line, 1); G.text(c, fmt(v, 2), L - 5, Y(v), PAL.muted, { align: 'right', size: 10 }); }
    for (const d of [0, 30, 60, 90]) G.text(c, d + '°', X(d), T + ph + 13, PAL.muted, { align: 'center', size: 10 });
    const curve = (fn, col, wd, dash) => { c.beginPath(); for (let i = 0; i <= 180; i++) { const d = i / 2, p = [X(d), Y(fn(Math.cos(d * RAD)))]; i ? c.lineTo(...p) : c.moveTo(...p); } c.setLineDash(dash || []); c.strokeStyle = col; c.lineWidth = wd; c.stroke(); c.setLineDash([]); };
    curve(ci => fresnelExact(ci, n), PAL.muted, 1.5, [5, 4]);
    curve(ci => schlick(ci, f0), PAL.accent, 2.5);
    const fs = schlick(Math.cos(a * RAD), f0);
    G.line(c, X(a), T, X(a), T + ph, PAL.ink, 1, [3, 3]);
    G.dot(c, X(a), Y(fs), 5, PAL.accent, PAL['accent-ink'], 1.5);
    ro('fres-ro', [
      ['F0 = ((1−n)/(1+n))²', fmt(f0, 4), 'win'],
      ['cos θ', fmt(Math.cos(a * RAD), 3)],
      ['F Schlick', fmt(fs, 4), 'win'],
      ['F exact', fmt(fresnelExact(Math.cos(a * RAD), n), 4)],
      ['transmission 1 − F', fmt(1 - fs, 4)]
    ]);
  });
  bindRange('fres-a', deg, () => F.draw()); bindRange('fres-n', x => fmt(x, 2), () => F.draw());
}
function labExposure() {
  const SC = {
    noon: { ev: 14, src: [['Sunlit facade', 9000, [0.78, 0.74, 0.68]], ['Room by daylight', 150, [0.86, 0.8, 0.72]], ['Room with lamps on', 200, [1, 0.82, 0.55]]] },
    dusk: { ev: 9, src: [['Facade at dusk', 300, [0.7, 0.62, 0.62]], ['Room by daylight', 20, [0.86, 0.8, 0.72]], ['Room with lamps on', 70, [1, 0.82, 0.55]]] },
    night: { ev: 5.5, src: [['Facade, street-lit', 3, [0.6, 0.62, 0.7]], ['Unlit room', 0.5, [0.86, 0.8, 0.72]], ['Room with lamps on', 50, [1, 0.82, 0.55]]] }
  };
  let sc = 'noon';
  const F = fig($('#exp-canvas'), (c, w, h) => {
    const ev = val('exp-ev'), mul = 1 / (1.2 * Math.pow(2, ev)), S = SC[sc].src, n = S.length, gap = 10, sw = (w - gap * (n - 1)) / n;
    S.forEach(([name, nits, tint], i) => {
      const v = nits * mul, g = Math.pow(clamp(v, 0, 1), 1 / 2.2), x = i * (sw + gap);
      const rgb = tint.map(t => Math.round(clamp(g * t, 0, 1) * 255));
      G.rect(c, x, 0, sw, h - 34, `rgb(${rgb})`, PAL.line, 1);
      if (v > 1) G.text(c, 'clipped', x + sw / 2, (h - 34) / 2, '#3b2405', { align: 'center', size: 10, weight: 600 });
      G.text(c, name, x + 2, h - 22, PAL.ink, { size: 10 });
      G.text(c, `${fmt(nits, nits < 10 ? 1 : 0)} nits → ${fmt(v, 3)}`, x + 2, h - 8, PAL.muted, { size: 10 });
    });
    ro('exp-ro', [['multiplier 1/(1.2·2^EV)', mul.toExponential(2)], ...S.map(([nm, nits]) => [nm, fmt(nits * mul, 4)])]);
  });
  const setEv = e => { const el = $('#exp-ev'); el.value = e; el.dispatchEvent(new Event('input')); };
  bindSeg('exp-preset', v => { sc = v; setEv(SC[v].ev); });
  bindRange('exp-ev', x => fmt(x, 1), () => F.draw());
}

/* ===== Chapter 12: curtains ===== */
function labCurtain() {
  let state = 3, tr = null;
  function compute() {
    const yaw = val('curt-yaw') * RAD, W = val('curt-w');
    tr = IM.trace(0.3, 0.5, W, 3, 4, [-Math.sin(yaw), -0.05, -Math.cos(yaw)]);
  }
  const A = fig($('#curt-top'), (c, w, h) => {
    compute();
    const zc = val('curt-z'), sc = Math.min((w - 20) / 2.6, (h - 20) / 1.6), X = x => w / 2 + x * sc, Y = z => h - 14 - (z + 0.15) * sc;
    G.rect(c, X(-1), Y(1), 2 * sc, sc, PAL.surface, PAL.muted, 1.2);
    G.line(c, X(-1), Y(0), X(1), Y(0), PAL.ray, 4);
    G.line(c, X(-1.2), Y(zc), X(1.2), Y(zc), PAL.accent, 2, [6, 4]);
    G.text(c, `z_c ${fmt(zc, 2)}`, X(-1.2), Y(zc) - 9, PAL['accent-ink'], { size: 10, halo: PAL.surface });
    const tc = zc / tr.d[2], pc = [tr.o[0] + tr.d[0] * tc, zc];
    const vis = tc <= tr.t;
    G.line(c, X(tr.o[0]), Y(0), X(tr.hit[0]), Y(tr.hit[2]), PAL.ray, 2.4);
    if (!vis) G.line(c, X(tr.hit[0]), Y(tr.hit[2]), X(clamp(pc[0], -1.25, 1.25)), Y(zc), PAL.ray, 1.2, [3, 3]);
    G.dot(c, X(tr.hit[0]), Y(tr.hit[2]), 5, PAL.accent);
    const cx = X(clamp(pc[0], -1.25, 1.25)), cy = Y(zc);
    if (vis) G.dot(c, cx, cy, 5, PAL.bg, PAL['accent-ink'], 2);
    else { G.line(c, cx - 5, cy - 5, cx + 5, cy + 5, PAL.bad, 2.2); G.line(c, cx - 5, cy + 5, cx + 5, cy - 5, PAL.bad, 2.2); }
    G.dot(c, X(tr.o[0]), Y(0), 3.5, PAL.ink);
    ro('curt-ro', [
      ['d', vec(tr.d, 3)],
      ['t (wall)', `${fmt(tr.t, 3)}, ${WALLS[tr.wall]}`],
      ['t_c = z_c / d.z', fmt(tc, 3), 'win'],
      ['p_c.x = o.x + d.x·t_c', fmt(pc[0], 3)],
      ['t_c ≤ t', vis ? '<span class="pill good">yes, curtain visible</span>' : '<span class="pill bad">no, wall is in front</span>']
    ]);
    P.draw();
  });
  const P = fig($('#curt-prev'), (c, w, h) => {
    const yaw = val('curt-yaw') * RAD, W = val('curt-w');
    renderWindow({ ctx: c, w, h }, { W, H: 3, D: 4, cam: [4 * Math.sin(yaw), 0.2, 4 * Math.cos(yaw)], b: 0.5, cell: [0, 1], flip: false, curtain: { z: val('curt-z'), state, nocheck: $('#curt-nocheck').checked } });
  });
  bindSeg('curt-state', v => { state = +v; P.draw(); });
  bindRange('curt-z', x => fmt(x, 2), () => A.draw()); bindRange('curt-w', m, () => A.draw()); bindRange('curt-yaw', deg, () => A.draw());
  $('#curt-nocheck').addEventListener('change', () => P.draw());
}

/* ===== Chapter 13: mips ===== */
function labMip() {
  const A = atlases().day, levels = [];
  let cv = A.canvas;
  levels.push({ w: A.w, h: A.h, data: A.data });
  for (let l = 1; l <= 8; l++) {
    const nw = Math.max(1, A.w >> l), nh = Math.max(1, A.h >> l), c2 = mkCanvas(nw, nh), x = c2.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(cv, 0, 0, nw, nh);
    levels.push({ w: nw, h: nh, data: x.getImageData(0, 0, nw, nh).data }); cv = c2;
  }
  const NX = 96, NY = 48, rooms = [{ x0: 0, w: 4, cell: [1, 0], flip: false }, { x0: 4, w: 3, cell: [2, 0], flip: true }];
  const V = (() => { const v = [0.35, -0.12, -1]; const l = Math.hypot(...v); return v.map(x => x / l); })();
  let src = 'uv';
  const trB = new Float64Array(17);
  function px(i, j) {
    const fx = (i + 0.5) / NX * 7, fy = 0.75 + (1 - (j + 0.5) / NY) * 1.7;
    const r = fx < 4 ? rooms[0] : rooms[1], u = (fx - r.x0) / r.w, v = fy / 3.2;
    traceInto(trB, u, v, r.w, 3.2, 4.5, V[0], V[1], V[2], false);
    const s = 1 / (1 + trB[16]); let cu = trB[14] * s * 0.5 + 0.5, cvv = trB[15] * s * 0.5 + 0.5;
    if (r.flip) cu = 1 - cu;
    return { au: (r.cell[0] + cu) / ATL.cols, av: (r.cell[1] + cvv) / ATL.rows, s, r, fx };
  }
  let img = null, heat = null;
  function compute() {
    img = new Uint8ClampedArray(NX * NY * 4); heat = new Float32Array(NX * NY);
    const tmp = [0, 0, 0];
    for (let qj = 0; qj < NY; qj += 2) for (let qi = 0; qi < NX; qi += 2) {
      const p00 = px(qi, qj), p10 = px(qi + 1, qj), p01 = px(qi, qj + 1);
      let mip;
      if (src === 'uv') {
        const dx = Math.max(Math.abs(p10.au - p00.au) * A.w, Math.abs(p10.av - p00.av) * A.h);
        const dy = Math.max(Math.abs(p01.au - p00.au) * A.w, Math.abs(p01.av - p00.av) * A.h);
        mip = Math.log2(Math.max(dx, dy, 1e-6));
      } else {
        const dxm = 7 / NX, dym = 1.7 / NY;
        const gx = dxm / p00.r.w * p00.s / ATL.cols * A.w, gy = dym / 3.2 * p00.s / ATL.rows * A.h;
        mip = Math.log2(Math.max(gx, gy, 1e-6));
      }
      mip = clamp(mip, 0, 8);
      for (let j = qj; j < qj + 2; j++) for (let i = qi; i < qi + 2; i++) {
        const p = px(i, j), L = levels[Math.round(mip)];
        sampleAtlas(L, p.au, p.av, tmp);
        const o = (j * NX + i) * 4; img[o] = tmp[0]; img[o + 1] = tmp[1]; img[o + 2] = tmp[2]; img[o + 3] = 255; heat[j * NX + i] = mip;
      }
    }
  }
  const off = mkCanvas(NX, NY), offH = mkCanvas(NX, NY);
  function blit(c, w, h, canvas) { c.imageSmoothingEnabled = false; c.drawImage(canvas, 0, 0, w, h); }
  const I = fig($('#mip-img'), (c, w, h) => {
    off.getContext('2d').putImageData(new ImageData(img, NX, NY), 0, 0); blit(c, w, h, off);
    const bx = 4 / 7 * w; G.line(c, bx, 0, bx, 10, PAL.accent, 2); G.line(c, bx, h - 10, bx, h, PAL.accent, 2);
  });
  const Hc = fig($('#mip-heat'), (c, w, h) => {
    const id = new ImageData(NX, NY);
    for (let k = 0; k < NX * NY; k++) { const t = heat[k] / 8; id.data[k * 4] = 20 + t * 235; id.data[k * 4 + 1] = 24 + Math.pow(t, 1.6) * 190; id.data[k * 4 + 2] = 40 + (1 - t) * 60; id.data[k * 4 + 3] = 255; }
    offH.getContext('2d').putImageData(id, 0, 0); blit(c, w, h, offH);
    c.strokeStyle = 'rgba(255,255,255,0.10)'; c.lineWidth = 1;
    for (let i = 0; i <= NX; i += 2) { c.beginPath(); c.moveTo(i / NX * w, 0); c.lineTo(i / NX * w, h); c.stroke(); }
    for (let j = 0; j <= NY; j += 2) { c.beginPath(); c.moveTo(0, j / NY * h); c.lineTo(w, j / NY * h); c.stroke(); }
    let mx = 0; for (let k = 0; k < NX * NY; k++) mx = Math.max(mx, heat[k]);
    G.text(c, `max mip ${fmt(mx, 1)}`, 6, 12, '#fff', { size: 10, halo: '#000' });
  });
  bindSeg('mip-src', v => { src = v; compute(); I.draw(); Hc.draw(); });
  compute();
}

/* ===== Chapter 14: bug lab ===== */
const BUGS = {
  none: ['Correct shader', 'Use this as the reference. In Hit xyz every room is a clean box: red grows to the right, green grows upward, blue grows with depth.', '', ''],
  perwin: ['Per-window UVs', 'The double-window office shows two separate rooms, each with its own back wall. The small bathroom slot shows a whole squashed room.', 'UV1 runs 0 to 1 across each window, and the room size is the window size.', 'Measure UV1 inside the room rectangle and store the room\'s width and height.'],
  tflip: ['Tangent flipped', 'Rooms look inside out sideways: look from the left and you see the left wall. Vertical parallax is still right.', 'T points to the viewer\'s left, so viewTS.x has the wrong sign while roomUV.x still runs right.', 'Build T with cross(N, up) in Unity\'s left-handed space, or flip whichever side disagrees with the Blender u direction.'],
  vneg: ['View vector not negated', 'The room becomes a flat poster sliding behind the glass. Walls never change perspective, and steep views smear the edge pixels.', 'Shader Graph\'s View Direction points from the surface to the camera. Used as is, d.z is negative, the back-wall t comes out negative and wins the min every time.', 'Negate it. In HDRP the camera-relative Position node already points from the camera to the surface.'],
  bwf: ['Shader b ≠ render b', 'The painted corners don\'t meet the geometric corners. Back-wall content spills onto the side walls and slides as you move.', 'The shader uses b = 0.35 while the atlas was rendered at b = 0.5, so the projection maps depth to the wrong rings of the image.', 'Use one b for every cell and pass exactly that value to the shader.'],
  nonorm: ['Room size ignored', 'Every room looks as deep as half its width, whatever depth you set. A 6 m shop and a 3 m bathroom get the same proportions.', 'd is built from viewTS without dividing by W/2, H/2 and D, as if every room were 2 × 2 × 1 m.', 'Divide by the half sizes and the depth, all in meters.']
};
function labBug() {
  const view = new FacadeView($('#bug-view'), { state: { yaw: -0.55, pitch: 0.12 } });
  let bug = 'none';
  function note() {
    const [t, sym, cause, fix] = BUGS[bug], lod = view.s.lod;
    let h = `<b>${t}.</b> ${sym}`;
    if (cause) h += `<br><b>Cause.</b> ${cause}<br><b>Fix.</b> ${fix}`;
    if (lod === 1) h += `<br><b>LOD1.</b> Back plane only: no side walls, one fetch. Fine past 50 to 100 m.`;
    if (lod === 2) h += `<br><b>LOD2.</b> One flat color per room plus the lit flag. Switch to Night in the hero to see why it works at city scale.`;
    $('#bug-note').innerHTML = h;
  }
  $('#bug-list').addEventListener('change', e => { if (e.target.name === 'bug') { bug = e.target.value; view.set('bug', bug); note(); } });
  bindSeg('bug-mode', v => view.set('mode', v));
  bindSeg('bug-lod', v => { view.set('lod', +v); note(); });
  note();
  return view;
}

/* ===== hero ===== */
function hero() {
  const view = new FacadeView($('#hero-view'), { state: { yaw: 0.45, pitch: 0.1 }, onInteract: () => { stopped = true; } });
  let stopped = matchMedia('(prefers-reduced-motion: reduce)').matches, visible = true, t0 = performance.now(), last = 0;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe($('#hero-view'));
  function loop(now) {
    if (!stopped && visible && now - last > 50) { last = now; view.s.yaw = 0.45 * Math.sin((now - t0) / 1000 * 0.32); view.render(false); }
    if (!stopped) requestAnimationFrame(loop);
  }
  bindSeg('hero-time', v => view.set('time', v));
  $('#hero-rects').addEventListener('change', e => view.set('showRects', e.target.checked));
  view.render(false);
  requestAnimationFrame(loop);
  return view;
}
/* ===== boot (labs only; navigation, glossary and checks come from the shared site script) ===== */
function boot() {
  readPal();
  const run = [hero, labData, labFan, labFrame, labNorm, labSlab, labProj, labDepth, labBwf, labTrace, labHash, labFresnel, labExposure, labCurtain, labMip, labBug];
  const views = [];
  run.forEach(f => { try { const v = f(); if (v instanceof FacadeView) views.push(v); } catch (e) { console.error(f.name, e); } });
  views.forEach(v => v.render(false));
  const again = () => { redrawAll(); views.forEach(v => v.request(false)); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', again);
  new MutationObserver(again).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawAll);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

})();
