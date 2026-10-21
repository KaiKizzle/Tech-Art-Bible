/* Warps and Distortion — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const sat = x => clamp(x, 0, 1), fr = x => x - Math.floor(x);
  function pic(ctx, w, h, f, x, y, dw, dh, smooth) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const p = f(i, j), k = (j * w + i) * 4; im.data[k] = sat(p[0]) * 255; im.data[k + 1] = sat(p[1]) * 255; im.data[k + 2] = sat(p[2]) * 255; im.data[k + 3] = 255; }
    g.putImageData(im, 0, 0); ctx.imageSmoothingEnabled = !!smooth; ctx.drawImage(c, x, y, dw, dh); ctx.imageSmoothingEnabled = true;
  }
  /* tiling value noise on the unit square, period p cells */
  function hash(i, j, s) { const h = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); }
  function vnoise(x, y, p, s) {
    x *= p; y *= p; const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
    const m = k => ((k % p) + p) % p, a = hash(m(i), m(j), s), b = hash(m(i + 1), m(j), s), c = hash(m(i), m(j + 1), s), d = hash(m(i + 1), m(j + 1), s);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  }
  const fbm = (x, y, p, s) => 0.6 * vnoise(x, y, p, s) + 0.28 * vnoise(x, y, p * 2, s + 3) + 0.12 * vnoise(x, y, p * 4, s + 7);
  /* the image being warped: a tiling grid of lines with filled cells */
  function grid(u, v) { u = fr(u); v = fr(v); const gu = Math.abs(fr(u * 6) - 0.5), gv = Math.abs(fr(v * 6) - 0.5), line = Math.max(gu, gv) > 0.42 ? 1 : 0, ch = (Math.floor(u * 6) + Math.floor(v * 6)) % 2;
    return line ? [0.95, 0.55, 0.2] : ch ? [0.22, 0.24, 0.27] : [0.32, 0.34, 0.38]; }
  const N = 120;
  function panels(ctx, W, H, X, list) {
    const n = list.length, gap = 12, s = Math.min((W - gap * (n + 1)) / n, H - 34);
    list.forEach(([label, f], k) => { const x = gap + k * (s + gap); pic(ctx, N, N, f, x, 22, s, s, true); ctx.strokeStyle = col('line'); ctx.strokeRect(x, 22, s, s); X.label(ctx, label, x, 11, col('muted')); });
  }

  /* ---------- the idea in one dimension ---------- */
  A.fx('warpidea', {
    title: 'A warp moves where each pixel reads from',
    expr: 'out(x) = in(x + {k} · d(x))',
    vars: { k: { sym: 'intensity', name: 'how far pixels read', min: 0, max: 0.12, value: 0.05, step: 0.001 } },
    out: { sym: 'largest shift', f: v => v.k, color: 'accent', fmt: x => num(x * 1024) + ' px at 1k' },
    sub: v => `every output pixel reads the input ${num(v.k * 1024)} pixels away at most, in the direction d says. Nothing is pushed: pixels <em>fetch</em>, so the output never has holes, but it can stretch and repeat.`,
    draw(ctx, W, H, v, X) {
      const x0 = 20, w = W - 40, d = x => Math.sin(x * 6.283 * 2) * 0.7 + Math.sin(x * 6.283 * 5 + 1) * 0.3;
      const inp = x => (Math.floor(fr(x) * 16) % 2) ? 0.85 : 0.2;
      for (let i = 0; i < w; i++) { const x = i / w; let g = inp(x); ctx.fillStyle = `rgb(${g * 255},${g * 150},${g * 60})`; ctx.fillRect(x0 + i, 26, 1.2, 34);
        g = inp(x + v.k * d(x)); ctx.fillStyle = `rgb(${g * 255},${g * 150},${g * 60})`; ctx.fillRect(x0 + i, H - 64, 1.2, 34); }
      ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= w; i++) { const x = i / w, y = (26 + 60 + H - 64) / 2 - d(x) * 22; i ? ctx.lineTo(x0 + i, y) : ctx.moveTo(x0, y); } ctx.stroke();
      for (let k = 1; k < 16; k += 1) { const x = k / 16 + 0.03, sx = x + v.k * d(x); X.arrow(ctx, x0 + x * w, H - 66, x0 + sx * w, 62, alpha(col('ink'), 0.55), 1.2, 6); }
      X.label(ctx, 'input', x0, 14, col('muted')); X.label(ctx, 'd(x): the intensity map', x0, (26 + 60 + H - 64) / 2 - 32, col('ray')); X.label(ctx, 'output: each arrow shows where a pixel reads from', x0, H - 16, col('muted'));
    },
    plot: false, size: [880, 270]
  });

  /* ---------- directional warp ---------- */
  const I = (x, y, s) => fbm(x, y, s, 2);
  A.fx('dirwarp', {
    title: 'Directional Warp',
    expr: 'out(p) = in(p + {i} · (I(p) − {o}) · dir({a}))',
    vars: { i: { sym: 'intensity', name: 'intensity', min: 0, max: 0.4, value: 0.12, step: 0.005 }, a: { sym: 'angle', name: 'warp angle, in turns', min: 0, max: 1, value: 0.125, step: 0.005 },
            o: { sym: 'offset', name: 'intensity map offset', min: 0, max: 1, value: 0, step: 0.01 }, s: { sym: 'scale', name: 'intensity map scale (cells)', values: [2, 4, 8, 16], index: 1 } },
    out: { sym: 'largest shift', f: v => v.i * Math.max(Math.abs(1 - v.o), Math.abs(v.o)), color: 'accent', fmt: x => num(x * 1024) + ' px at 1k' },
    sub: v => `dir(a) = (cos 2πa, sin 2πa): every pixel reads along ${num(v.a * 360)}°, as far as the intensity map is bright, up to <b>${num(v.i * Math.max(Math.abs(1 - v.o), Math.abs(v.o)) * 1024)} px</b> at 1k` + (v.o > 0 ? `; with offset ${num(v.o)}, pixels darker than ${num(v.o)} read backwards` : '') + ` · a fine intensity map (scale ${v.s}) with a large intensity tears the image apart; a coarse one bends it`,
    draw(ctx, W, H, v, X) {
      const dx = Math.cos(v.a * 6.283), dy = -Math.sin(v.a * 6.283);
      panels(ctx, W, H, X, [['input', (i, j) => grid(i / N, j / N)], ['intensity map', (i, j) => { const t = I(i / N, j / N, v.s); return [t, t, t]; }],
        ['output', (i, j) => { const x = i / N, y = j / N, t = (I(x, y, v.s) - v.o) * v.i; return grid(x + t * dx, y + t * dy); }]]);
      const s = Math.min((W - 48) / 3, H - 34), cx = 12 + s / 2 + 2 * (s + 12), cy = 22 + s / 2; X.arrow(ctx, cx - dx * 26, cy - dy * 26, cx + dx * 26, cy + dy * 26, col('ink'), 2.5, 10);
    },
    plot: false, size: [880, 300]
  });

  /* ---------- warp along a gradient ---------- */
  const blob = (x, y) => { const d = Math.hypot(x - 0.5, y - 0.5); return Math.exp(-d * d / 0.03); };
  const G = (t, x, y) => t === 0 ? blob(x, y) : fbm(x, y, 3, 9);
  A.fx('gradwarp', {
    title: 'Warp: read uphill along the gradient',
    expr: 'out(p) = in(p + {k} · ∇G(p))',
    vars: { k: { sym: 'intensity', name: 'intensity', min: 0, max: 0.03, value: 0.012, step: 0.0005 }, t: { sym: 'G', name: 'gradient input', values: [0, 1], labels: ['one soft dot', 'noise'], index: 0 } },
    out: { sym: 'largest shift', f: v => { let m = 0; for (let i = 1; i < 40; i++) for (let j = 1; j < 40; j++) { const x = i / 40, y = j / 40, e = 1 / 256; const gx = (G(v.t, x + e, y) - G(v.t, x - e, y)) / (2 * e), gy = (G(v.t, x, y + e) - G(v.t, x, y - e)) / (2 * e); m = Math.max(m, Math.hypot(gx, gy)); } return m * v.k; }, color: 'accent', fmt: x => num(x * 1024) + ' px at 1k' },
    sub: v => 'the gradient ∇G points uphill, towards white. Reading uphill copies the content near the white areas outward, so the image looks pushed away from white. Flat areas of G, black or white, do not move at all: only slopes warp.',
    draw(ctx, W, H, v, X) {
      const e = 1 / 256, gr = (x, y) => [(G(v.t, x + e, y) - G(v.t, x - e, y)) / (2 * e), (G(v.t, x, y + e) - G(v.t, x, y - e)) / (2 * e)];
      panels(ctx, W, H, X, [['input', (i, j) => grid(i / N, j / N)], ['gradient input G', (i, j) => { const g = G(v.t, i / N, j / N); return [g, g, g]; }],
        ['output', (i, j) => { const x = i / N, y = j / N, d = gr(x, y); return grid(x + v.k * d[0], y + v.k * d[1]); }]]);
    },
    plot: false, size: [880, 300]
  });

  /* ---------- vector warp: directions stored as colours ---------- */
  A.fx('vecwarp', {
    title: 'A direction stored in a colour',
    expr: 'shift = {k} · (2·{R} − 1, ±(2·{G} − 1))   (sign of G: {f})',
    vars: { R: { sym: 'R', name: 'red channel', min: 0, max: 1, value: 0.8, step: 0.01 }, G: { sym: 'G', name: 'green channel', min: 0, max: 1, value: 0.35, step: 0.01 },
            k: { sym: 'intensity', name: 'intensity', min: 0, max: 0.2, value: 0.08, step: 0.005 }, f: { sym: 'format', name: 'vector format', values: [0, 1], labels: ['DirectX (Y down)', 'OpenGL (Y up)'], index: 0 } },
    out: [{ sym: 'shift x', f: v => v.k * (2 * v.R - 1) * 1024, color: 'bad', fmt: x => num(x) + ' px' }, { sym: 'shift y (up)', f: v => v.k * (2 * v.G - 1) * (v.f ? 1 : -1) * 1024, color: 'good', fmt: x => num(x) + ' px' }],
    sub: v => `the colour (${Math.round(v.R * 255)}, ${Math.round(v.G * 255)}, …) means "read ${num(Math.abs(v.k * (2 * v.R - 1) * 1024))} px ${v.R >= 0.5 ? 'right' : 'left'} and ${num(Math.abs(v.k * (2 * v.G - 1) * 1024))} px ${((2 * v.G - 1) * (v.f ? 1 : -1)) >= 0 ? 'up' : 'down'}" at 1k · (0.5, 0.5) means no shift`,
    draw(ctx, W, H, v, X) {
      const cx = W * 0.62, cy = H / 2, r = Math.min(W * 0.33, H / 2 - 20);
      pic(ctx, 80, 80, (i, j) => { const x = i / 79, y = j / 79; return [x, v.f ? 1 - y : y, 0.5]; }, cx - r, cy - r, 2 * r, 2 * r, true);
      ctx.strokeStyle = col('line'); ctx.strokeRect(cx - r, cy - r, 2 * r, 2 * r);
      const px = cx + (2 * v.R - 1) * r, py = cy - (2 * v.G - 1) * (v.f ? 1 : -1) * r;
      X.arrow(ctx, cx, cy, px, py, col('ink'), 3, 11); X.dot(ctx, cx, cy, col('ink'), 3);
      ctx.fillStyle = `rgb(${Math.round(v.R * 255)},${Math.round(v.G * 255)},128)`; ctx.fillRect(14, 30, 70, 70); ctx.strokeStyle = col('line'); ctx.strokeRect(14, 30, 70, 70);
      X.label(ctx, 'this pixel', 14, 18, col('muted')); X.label(ctx, 'all directions:', cx - r, cy - r - 10, col('muted'));
      X.label(ctx, 'R →', cx + r - 4, cy + r + 12, col('muted'), 'right');
    },
    plot: { x: 'R' }, size: [440, 280]
  });

  /* ---------- slope blur ---------- */
  const shape = (x, y) => { const dx = Math.max(Math.abs(x - 0.5) - 0.2, 0), dy = Math.max(Math.abs(y - 0.5) - 0.2, 0); return Math.hypot(dx, dy) < 0.06 ? 1 : 0; };
  const SM = ['Blur', 'Min', 'Max'];
  A.fx('slopeblur', {
    title: 'Slope Blur: many reads along the slope of a noise',
    expr: 'out(p) = {m} of in(p + {k} · t · slope dir),   t = 0, 1/{n}, …, 1',
    vars: { m: { sym: 'mode', name: 'mode', values: [0, 1, 2], labels: SM, index: 1 }, k: { sym: 'intensity', name: 'distance read along the slope', min: 0, max: 0.12, value: 0.05, step: 0.002 },
            n: { sym: 'samples', name: 'samples', values: [1, 2, 4, 8, 16, 32], index: 3 } },
    out: { sym: 'reads per pixel', f: v => v.n + 1, color: 'accent' },
    sub: v => `${v.n + 1} reads per pixel: at 2048 × 2048 that is ${num((v.n + 1) * 4.194)} million reads for one node · ` + ['<b>Blur</b> averages them: a smear along the noise.', '<b>Min</b> keeps the darkest: the shape is eaten away from its edges, like erosion or chipped stone.', '<b>Max</b> keeps the brightest: the shape grows ragged outgrowths, like moss or melted edges.'][v.m],
    draw(ctx, W, H, v, X) {
      const S = (x, y) => fbm(x, y, 4, 5), e = 1 / 200;
      const out = (x, y) => { let gx = S(x + e, y) - S(x - e, y), gy = S(x, y + e) - S(x, y - e); const l = Math.hypot(gx, gy) || 1; gx /= l; gy /= l; let acc = v.m === 1 ? 1 : 0;
        for (let j = 0; j <= v.n; j++) { const t = v.k * j / v.n, s = shape(x + gx * t, y + gy * t); acc = v.m === 0 ? acc + s / (v.n + 1) : v.m === 1 ? Math.min(acc, s) : Math.max(acc, s); } return acc; };
      panels(ctx, W, H, X, [['input', (i, j) => { const s = shape(i / N, j / N); return [s, s, s]; }], ['slope input S', (i, j) => { const s = S(i / N, j / N); return [s, s, s]; }], ['output', (i, j) => { const s = out(i / N, j / N); return [s, s, s]; }]]);
    },
    plot: false, size: [880, 300]
  });

  /* ---------- what warps cost ---------- */
  A.fx('warpcost', {
    title: 'Texture reads of a warp-heavy chain',
    expr: 'reads = {s}² · ({r} reads per pixel) · {w} nodes',
    vars: { s: { sym: 'size', name: 'output size', values: [512, 1024, 2048, 4096], labels: ['512', '1k', '2k', '4k'], index: 2 }, r: { sym: 'reads', name: 'reads per pixel (Warp 1–2, Slope Blur: samples + 1)', values: [1, 2, 5, 9, 17, 33], index: 3 },
            w: { sym: 'nodes', name: 'warp or blur nodes in the chain', min: 1, max: 30, value: 6, step: 1 } },
    out: { sym: 'reads', unit: 'million', f: v => v.s * v.s * v.r * v.w / 1e6, color: 'accent' },
    sub: v => `${num(v.s * v.s * v.r * v.w / 1e6)} million reads, ${num(v.r * v.w)}× a single Levels pass over the same image · half the size is a quarter of the reads`,
    plot: { x: 's', logY: true, y: [0.1, 100000] }
  });
})();
