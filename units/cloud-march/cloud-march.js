/* Marching a Cloud Layer — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180;
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const h1 = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return h1(i) * (1 - u) + h1(i + 1) * u; };
  const h2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise2 = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1); return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy; };
  const fbm1 = (x, oct, p) => { let s = 0, a = 1, n = 0; for (let k = 0; k < oct; k++) { s += a * noise1(x * Math.pow(2, k)); n += a; a *= p; } return s / n; };
  const fbm2 = (x, y) => { let s = 0, a = 1, n = 0; for (let k = 0; k < 4; k++) { const f = Math.pow(2, k); s += a * noise2(x * f, y * f); n += a; a *= 0.5; } return s / n; };
  const remap = (n, c) => clamp((n - (1 - c)) / Math.max(c, 1e-3), 0, 1);
  const profile = (h, a, b) => ss(0, a, h) * (1 - ss(b, 1, h));

  A.fx('steps', {
    title: 'Steps along the ray through the layer',
    expr: 'Δ = ({t1} − {t0}) / {n},   t<sub>i</sub> = {t0} + (i + {j}) · Δ',
    vars: { t0: { sym: 't<sub>enter</sub>', name: 'where the ray enters the layer', unit: 'km', min: 0, max: 20, value: 2, step: 0.1 },
            t1: { sym: 't<sub>exit</sub>', name: 'where it leaves', unit: 'km', min: 1, max: 60, value: 14, step: 0.1 },
            n: { sym: 'N', name: 'steps', min: 4, max: 64, value: 12, step: 1 }, j: { name: 'jitter (per pixel, 0 to 1)', min: 0, max: 0.99, value: 0.5, step: 0.01 } },
    out: { sym: 'Δ', unit: 'km', f: v => Math.max(0, v.t1 - v.t0) / v.n },
    sub: v => { const d = Math.max(0, v.t1 - v.t0) / v.n; return `Δ = (${num(v.t1)} − ${num(v.t0)}) / ${v.n} = <b>${num(d)} km</b>; first sample at ${num(v.t0 + v.j * d)} km, last at ${num(v.t0 + (v.n - 1 + v.j) * d)} km`; },
    draw(ctx, W, H, v, X) {
      const L = 30, R = W - 20, tm = Math.max(v.t1, 20) * 1.05, P = t => L + t / tm * (R - L), y = H / 2, d = Math.max(0, v.t1 - v.t0) / v.n;
      ctx.fillStyle = alpha(col('ray'), 0.15); ctx.fillRect(P(v.t0), y - 40, P(v.t1) - P(v.t0), 80); X.label(ctx, 'inside the layer', (P(v.t0) + P(v.t1)) / 2, y - 52, col('ray'), 'center');
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke();
      for (let i = 0; i <= v.n; i++) { const x = P(v.t0 + i * d); ctx.strokeStyle = alpha(col('muted'), 0.7); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x, y + 14); ctx.stroke(); }
      for (let i = 0; i < v.n; i++) X.dot(ctx, P(v.t0 + (i + v.j) * d), y, col('accent'), 4);
      X.dot(ctx, L, y, col('ink'), 6); X.label(ctx, 'camera', L, y + 24, col('muted'), 'center');
      X.label(ctx, 'ticks: step boundaries · dots: samples', L, H - 14, col('muted'));
    },
    plot: { x: 'n', y: [0, 6] }
  });

  A.fx('profile', {
    title: 'Height profile of the layer',
    expr: 'profile = smoothstep(0, {a}, {h}) · (1 − smoothstep({b}, 1, {h}))',
    vars: { h: { name: 'height inside the layer (0 bottom, 1 top)', min: 0, max: 1, value: 0.3, step: 0.005 },
            a: { name: 'how fast density rises at the bottom', min: 0.02, max: 0.6, value: 0.12, step: 0.01 }, b: { name: 'where it starts to fade at the top', min: 0.2, max: 0.98, value: 0.55, step: 0.01 } },
    out: { sym: 'profile', f: v => profile(v.h, v.a, v.b) },
    draw(ctx, W, H, v, X) {
      const L = 60, R = W - 30, T = 20, B = H - 30, Y = h => B - h * (B - T);
      for (let y = T; y < B; y++) { const h = (B - y) / (B - T), p = profile(h, v.a, v.b); ctx.fillStyle = `rgba(235,238,245,${0.85 * p})`; ctx.fillRect(L, y, R - L, 1); }
      ctx.strokeStyle = col('muted'); ctx.strokeRect(L, T, R - L, B - T);
      X.label(ctx, 'top', L - 8, T + 4, col('muted'), 'right'); X.label(ctx, 'bottom', L - 8, B, col('muted'), 'right');
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L, Y(v.h)); ctx.lineTo(R, Y(v.h)); ctx.stroke();
    },
    plot: { x: 'h', y: [0, 1] }
  });

  A.fx('fbm', {
    title: 'Fractal noise: octaves added up',
    expr: 'n({x}) = Σ<sub>k&lt;{oct}</sub> {p}<sup>k</sup> · noise(2<sup>k</sup> · {x}) / Σ {p}<sup>k</sup>',
    vars: { x: { name: 'position', min: 0, max: 8, value: 2.3, step: 0.01 }, oct: { sym: 'octaves', name: 'number of octaves', min: 1, max: 6, value: 4, step: 1 },
            p: { name: 'persistence (strength of each finer octave)', min: 0.2, max: 0.8, value: 0.5, step: 0.01 } },
    out: { sym: 'n', f: v => fbm1(v.x, v.oct, v.p) },
    draw(ctx, W, H, v, X) {
      const L = 20, R = W - 20, Y = (y, base, h) => base - y * h;
      for (let k = 0; k < Math.min(v.oct, 4); k++) { const base = 40 + k * 40; ctx.strokeStyle = alpha(col('muted'), 0.8); ctx.lineWidth = 1; ctx.beginPath(); for (let px = L; px <= R; px += 2) { const x = (px - L) / (R - L) * 8; const y = noise1(x * Math.pow(2, k)) * Math.pow(v.p, k); px === L ? ctx.moveTo(px, Y(y, base, 30)) : ctx.lineTo(px, Y(y, base, 30)); } ctx.stroke(); X.label(ctx, 'octave ' + k, R, base - 34, col('muted'), 'right'); }
      const base = H - 20; ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); for (let px = L; px <= R; px += 1) { const x = (px - L) / (R - L) * 8, y = fbm1(x, v.oct, v.p); px === L ? ctx.moveTo(px, Y(y, base, 80)) : ctx.lineTo(px, Y(y, base, 80)); } ctx.stroke();
      X.label(ctx, 'sum', L, base - 86, col('accent'), 'left', true);
      const px = L + v.x / 8 * (R - L); ctx.strokeStyle = col('ray'); ctx.beginPath(); ctx.moveTo(px, 10); ctx.lineTo(px, H - 10); ctx.stroke();
    },
    plot: { x: 'x', y: [0, 1] }
  });

  A.fx('coverage', {
    title: 'Coverage: keeping only the peaks',
    expr: 'density = saturate(({n} − (1 − {c})) / {c})',
    vars: { n: { name: 'noise value', min: 0, max: 1, value: 0.62, step: 0.01 }, c: { name: 'coverage', min: 0.05, max: 1, value: 0.5, step: 0.01 } },
    out: { sym: 'density', f: v => remap(v.n, v.c) },
    draw(ctx, W, H, v, X) {
      const L = 20, R = W - 20, base = H - 60;
      ctx.strokeStyle = alpha(col('muted'), 0.8); ctx.lineWidth = 1; ctx.beginPath(); for (let px = L; px <= R; px++) { const n = fbm1((px - L) / (R - L) * 8 + 11, 5, 0.5); px === L ? ctx.moveTo(px, base - n * 120) : ctx.lineTo(px, base - n * 120); } ctx.stroke();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = col('accent'); ctx.beginPath(); ctx.moveTo(L, base - (1 - v.c) * 120); ctx.lineTo(R, base - (1 - v.c) * 120); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, 'threshold 1 − coverage', R, base - (1 - v.c) * 120 - 8, col('accent'), 'right');
      for (let px = L; px <= R; px++) { const d = remap(fbm1((px - L) / (R - L) * 8 + 11, 5, 0.5), v.c); ctx.fillStyle = `rgba(235,238,245,${d})`; ctx.fillRect(px, H - 40, 1, 26); }
      X.label(ctx, 'resulting density along a line', L, H - 48, col('muted'));
    },
    plot: { x: 'c', y: [0, 1] }
  });

  /* fixed density pattern along one ray: 40 samples */
  const RAYD = Array.from({ length: 64 }, (_, i) => remap(fbm1(i * 0.18 + 3.3, 4, 0.5), 0.55));
  A.fx('accum', {
    title: 'Transmittance along the ray',
    expr: 'T ← T · e<sup>−{s} · ρ<sub>i</sub> · {dt}</sup>',
    vars: { s: { sym: 'σ', name: 'extinction (per km at density 1)', min: 0.2, max: 20, value: 4, log: true }, dt: { sym: 'Δ', name: 'step length', unit: 'km', min: 0.05, max: 0.5, value: 0.2, step: 0.01 },
            k: { name: 'show the march up to step', min: 0, max: 63, value: 63, step: 1 } },
    out: { sym: 'T', f: v => { let T = 1; for (let i = 0; i <= v.k; i++) T *= Math.exp(-v.s * RAYD[i] * v.dt); return T; } },
    sub: v => { let T = 1, stop = -1; for (let i = 0; i <= v.k; i++) { T *= Math.exp(-v.s * RAYD[i] * v.dt); if (stop < 0 && T < 0.01) stop = i; } return `after ${v.k + 1} steps T = <b>${num(T)}</b>${stop >= 0 ? `; T fell below 0.01 at step ${stop + 1}, where the loop would stop` : ''}`; },
    draw(ctx, W, H, v, X) {
      const L = 20, R = W - 20, n = 64, sx = (R - L) / n;
      for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(235,238,245,${RAYD[i]})`; ctx.fillRect(L + i * sx, 30, sx, 60); }
      X.label(ctx, 'density ρ along the ray (white = dense)', L, 20, col('muted'));
      let T = 1; ctx.strokeStyle = col('accent'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(L, 120);
      for (let i = 0; i <= v.k; i++) { T *= Math.exp(-v.s * RAYD[i] * v.dt); ctx.lineTo(L + (i + 1) * sx, 120 + (1 - T) * (H - 150)); }
      ctx.stroke(); X.label(ctx, 'T = 1', L, 112, col('accent')); X.label(ctx, 'T = 0', L, H - 22, col('accent'));
      ctx.strokeStyle = alpha(col('bad'), 0.6); ctx.setLineDash([3, 3]); const y01 = 120 + 0.99 * (H - 150); ctx.beginPath(); ctx.moveTo(L, y01); ctx.lineTo(R, y01); ctx.stroke(); ctx.setLineDash([]);
    },
    plot: { x: 'k', y: [0, 1] }
  });

  A.fx('scatter', {
    title: 'Light one sample sends to the camera',
    expr: 'L<sub>i</sub> = T · σρΔ · T<sub>sun</sub> · phase,   T = e<sup>−{dv}</sup>,   T<sub>sun</sub> = e<sup>−{ds}</sup>',
    vars: { dv: { sym: 'τ<sub>view</sub>', name: 'optical depth between camera and sample (σ·Σρ·Δ)', min: 0, max: 6, value: 0.8, step: 0.01 },
            ds: { sym: 'τ<sub>sun</sub>', name: 'optical depth between sample and sun', min: 0, max: 6, value: 1.5, step: 0.01 },
            ph: { sym: 'phase', name: 'phase function value', min: 0.02, max: 2, value: 0.4, step: 0.01 }, sd: { sym: 'σρΔ', name: 'extinction of this one step', min: 0.01, max: 1, value: 0.2, step: 0.01 } },
    out: [{ sym: 'T', f: v => Math.exp(-v.dv), color: 'ax-y' }, { sym: 'T<sub>sun</sub>', f: v => Math.exp(-v.ds), color: 'accent' }, { sym: 'L<sub>i</sub>', f: v => Math.exp(-v.dv) * v.sd * Math.exp(-v.ds) * v.ph, color: 'ray' }],
    draw(ctx, W, H, v, X) {
      const c = [W / 2, H / 2 + 20];
      ctx.fillStyle = 'rgba(235,238,245,0.18)'; ctx.beginPath(); ctx.ellipse(c[0], c[1], 170, 80, 0, 0, 7); ctx.fill();
      X.dot(ctx, 30, c[1], col('ink'), 6); X.label(ctx, 'camera', 30, c[1] + 18, col('muted'), 'center');
      X.label(ctx, '☀ sun', c[0] + 120, 18, col('accent'), 'center', true);
      const s = [c[0] + 20, c[1] - 10];
      X.arrow(ctx, c[0] + 120, 30, s[0], s[1], alpha(col('accent'), 0.4 + 0.6 * Math.exp(-v.ds)), 3);
      X.arrow(ctx, s[0], s[1], 40, c[1], alpha(col('ray'), 0.3 + 0.7 * Math.exp(-v.dv)), 3);
      X.dot(ctx, s[0], s[1], col('ink'), 6); X.label(ctx, 'sample', s[0] + 10, s[1] + 14, col('ink'));
    },
    plot: { x: 'dv', y: [0, 0.5] }
  });

  const hg = (c, g) => (1 - g * g) / (4 * Math.PI * Math.pow(1 + g * g - 2 * g * c, 1.5));
  A.fx('hg', {
    title: 'Henyey–Greenstein phase function',
    expr: 'p = (1 − {g}²) / (4π · (1 + {g}² − 2·{g}·cos {th})<sup>1.5</sup>)',
    vars: { th: { sym: 'θ', name: 'angle between sun direction and view direction', unit: '°', min: 0, max: 180, value: 30, step: 1 }, g: { name: 'anisotropy', min: -0.9, max: 0.95, value: 0.7, step: 0.01 } },
    out: { sym: 'p', f: v => hg(Math.cos(v.th * DEG), v.g) },
    draw(ctx, W, H, v, X) {
      const c = [W / 2 - 40, H / 2], mx = hg(1, Math.max(Math.abs(v.g), 0.01)) * 1.05, s = 150 / Math.max(mx, 0.08);
      X.arrow(ctx, 20, c[1], c[0] - 10, c[1], col('accent'), 2.5); X.label(ctx, 'light travels →', 20, c[1] - 14, col('accent'));
      ctx.fillStyle = alpha(col('ray'), 0.18); ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.beginPath();
      for (let a = 0; a <= 360; a += 2) { const r = Math.min(hg(Math.cos(a * DEG), v.g) * s, 260); const x = c[0] + Math.cos(a * DEG) * r, y = c[1] - Math.sin(a * DEG) * r; a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fill(); ctx.stroke();
      const r = Math.min(hg(Math.cos(v.th * DEG), v.g) * s, 260); X.arrow(ctx, c[0], c[1], c[0] + Math.cos(v.th * DEG) * r, c[1] - Math.sin(v.th * DEG) * r, col('ink'), 2);
      X.dot(ctx, c[0], c[1], col('ink'), 4);
      X.label(ctx, 'polar plot: distance from the centre = how much light goes that way', 10, H - 10, col('muted'));
    },
    plot: { x: 'th', logY: true, y: [0.005, 10] }
  });

  A.fx('powder', {
    title: 'Beer–Lambert and the powder term',
    expr: 'E = 2 · e<sup>−{d}</sup> · (1 − e<sup>−2·{d}</sup>)',
    vars: { d: { name: 'optical depth toward the sun', min: 0, max: 5, value: 0.5, step: 0.01 } },
    out: [{ sym: 'Beer', f: v => Math.exp(-v.d), color: 'ray' }, { sym: 'Beer · powder', f: v => 2 * Math.exp(-v.d) * (1 - Math.exp(-2 * v.d)), color: 'accent' }],
    plot: { x: 'd', y: [0, 1.1] },
    note: 'Beer alone is brightest at d = 0, the cloud\'s outer rim. With the powder term the brightest point moves slightly inside.'
  });

  /* 2D march through a cloud slice, sun straight above */
  let FIELD = null; const FW = 220, FH = 60;
  function field() { if (FIELD) return FIELD; FIELD = new Float32Array(FW * FH); for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) { const h = j / (FH - 1); FIELD[j * FW + i] = remap(fbm2(i / 26, j / 26 + 3.1), 0.5) * profile(h, 0.15, 0.55); } return FIELD; }
  const dens = (x, y) => { if (y < 0 || y > 1 || x < 0 || x > 1) return 0; const f = field(), i = Math.min(FW - 1, Math.floor(x * FW)), j = Math.min(FH - 1, Math.floor(y * FH)); return f[j * FW + i]; };
  function march(v) {
    const r = v.el * DEG, dx = Math.cos(r), dy = Math.sin(r), ox = 0.02, oy = -0.6; // layer y in [0,1], x in [0,1] (aspect-scaled)
    const AS = 3.5; // layer is 3.5 times wider than tall
    const t0 = (0 - oy) / dy, t1 = (1 - oy) / dy; const dt = (t1 - t0) / v.n; let T = 1, L = 0; const pts = []; let stopped = -1;
    for (let i = 0; i < v.n; i++) { const t = t0 + (i + 0.5) * dt, x = (ox + dx * t) / AS, y = oy + dy * t, rho = dens(x, y);
      let tau = 0; for (let k = 1; k <= 5; k++) tau += dens(x, y + k * 0.08) * 0.08; const Ts = Math.exp(-v.s * tau * 1.5);
      const li = T * v.s * rho * dt * Ts; L += li; pts.push([x, y, li, T]); T *= Math.exp(-v.s * rho * dt); if (T < 0.01) { stopped = i; break; } }
    return { T, L, pts, stopped };
  }
  A.fx('march2d', {
    title: 'A complete march through a slice of the layer',
    expr: 'elevation {el},   {n} steps,   σ = {s}',
    vars: { el: { sym: 'θ', name: 'ray elevation', unit: '°', min: 12, max: 80, value: 26, step: 0.5 }, n: { name: 'steps', min: 4, max: 64, value: 24, step: 1 }, s: { sym: 'σ', name: 'extinction', min: 0.5, max: 12, value: 4, step: 0.1 } },
    out: [{ sym: 'T', name: 'transmittance at the end', f: v => march(v).T, color: 'ax-y' }, { sym: 'L', name: 'light gathered', f: v => march(v).L, color: 'accent' }],
    sub: v => { const q = march(v); return `T = <b>${num(q.T)}</b>, light <b>${num(q.L)}</b>${q.stopped >= 0 ? `, stopped early after ${q.stopped + 1} of ${v.n} steps` : ''}`; },
    draw(ctx, W, H, v, X) {
      const L = 10, R = W - 10, top = 40, bot = 160, f = field(), cw = (R - L) / FW, ch = (bot - top) / FH;
      for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) { const d = f[j * FW + i]; if (d < 0.01) continue; ctx.fillStyle = `rgba(235,238,245,${Math.min(1, d * 1.2)})`; ctx.fillRect(L + i * cw, bot - (j + 1) * ch, cw + 0.5, ch + 0.5); }
      ctx.strokeStyle = alpha(col('ray'), 0.5); ctx.strokeRect(L, top, R - L, bot - top); X.label(ctx, 'cloud layer (sun straight above)', L, top - 10, col('muted'));
      const q = march(v), P = (x, y) => [L + x * (R - L), bot - y * (bot - top)], r = v.el * DEG;
      const c0 = P(0.02 / 3.5, -0.6); ctx.strokeStyle = alpha(col('ink'), 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...c0); const e = P((0.02 + Math.cos(r) * 3) / 3.5, -0.6 + Math.sin(r) * 3); ctx.lineTo(...e); ctx.stroke();
      const mx = Math.max(1e-4, ...q.pts.map(p => p[2]));
      q.pts.forEach(([x, y, li]) => { const p = P(x, y); X.dot(ctx, p[0], p[1], `rgba(255,${180 + 60 * li / mx | 0},80,${0.35 + 0.65 * li / mx})`, 3.5); });
      // transmittance strip
      ctx.strokeStyle = col('ax-y'); ctx.lineWidth = 2; ctx.beginPath(); q.pts.forEach(([, , , T], i) => { const x = L + i / Math.max(1, v.n - 1) * (R - L), y = 200 + (1 - T) * 50; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
      X.label(ctx, 'T at each step', L, 192, col('ax-y'));
      const sh = Math.min(1, q.L * 1.4); ctx.fillStyle = `rgb(${Math.round(255 * (sh + q.T * 0.25))},${Math.round(255 * (sh * 0.97 + q.T * 0.45))},${Math.round(255 * (sh * 0.92 + q.T * 0.8))})`; ctx.fillRect(W - 70, H - 50, 56, 40); ctx.strokeStyle = col('line'); ctx.strokeRect(W - 70, H - 50, 56, 40);
      X.label(ctx, 'pixel', W - 42, H - 58, col('muted'), 'center');
    },
    size: [440, 290],
    plot: { x: 'el', y: [0, 1] }
  });

  A.fx('cloudcost', {
    title: 'Samples per frame',
    expr: 'samples = ({w} / {sc}) · ({h} / {sc}) · {n} · (1 + {m}) / {fr}',
    vars: { w: { sym: 'W', name: 'screen width', values: [1280, 1920, 2560, 3840], index: 1 }, h: { sym: 'H', name: 'screen height', values: [720, 1080, 1440, 2160], index: 1 },
            sc: { sym: 's', name: 'resolution divider per axis', values: [1, 2, 4], index: 1 }, n: { sym: 'N', name: 'view steps', min: 8, max: 128, value: 64, step: 1 },
            m: { sym: 'M', name: 'light steps per sample', min: 0, max: 8, value: 5, step: 1 }, fr: { sym: 'frames', name: 'frames the work is spread over', values: [1, 2, 4, 8, 16], index: 2 } },
    out: { sym: 'samples', f: v => v.w / v.sc * (v.h / v.sc) * v.n * (1 + v.m) / v.fr },
    sub: v => `<b>${num(v.w / v.sc * (v.h / v.sc) * v.n * (1 + v.m) / v.fr)}</b> density samples per frame (${num(v.n * (1 + v.m))} per traced pixel)`,
    plot: { x: 'n', logY: true, y: [1e5, 1e10] }
  });
})();
