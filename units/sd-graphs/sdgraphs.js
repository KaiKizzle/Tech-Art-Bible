/* Graphs, Bit Depth and Colour Space — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const s2l = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const l2s = c => c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  const SIZES = [256, 512, 1024, 2048, 4096, 8192], SL = SIZES.map(s => s >= 1024 ? s / 1024 + 'k' : String(s));
  /* paint a w × h picture computed per pixel by f(x, y) → [r, g, b] (0..1), scaled into the box */
  function pic(ctx, w, h, f, x, y, dw, dh, smooth) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const p = f(i, j), k = (j * w + i) * 4; im.data[k] = clamp(p[0], 0, 1) * 255; im.data[k + 1] = clamp(p[1], 0, 1) * 255; im.data[k + 2] = clamp(p[2], 0, 1) * 255; im.data[k + 3] = 255; }
    g.putImageData(im, 0, 0); ctx.imageSmoothingEnabled = !!smooth; ctx.drawImage(c, x, y, dw, dh); ctx.imageSmoothingEnabled = true;
  }

  /* ---------- memory of one node ---------- */
  const FMT = ['8-bit', '16-bit', '16F', '32F'], BYTES = [1, 2, 2, 4];
  const nodeMB = v => v.s * v.s * v.c * BYTES[v.f] / 1048576;
  A.fx('nodemem', {
    title: 'Memory of one node\'s image',
    expr: 'MB = {s}² · {c} channels · bytes({f}) / 1 048 576,   cache = MB · {n} nodes',
    vars: { s: { sym: 'size', name: 'output size', values: SIZES, labels: SL, index: 3 }, c: { sym: 'ch', name: 'greyscale (1) or colour (4)', values: [1, 4], labels: ['L', 'C'], index: 1 },
            f: { sym: 'format', name: 'output format', values: [0, 1, 2, 3], labels: FMT, index: 0 }, n: { sym: 'N', name: 'nodes in the graph', min: 10, max: 300, value: 80, step: 1 } },
    out: [{ sym: 'one node', unit: 'MB', f: nodeMB, color: 'accent' }, { sym: 'whole graph cached', unit: 'MB', f: v => nodeMB(v) * v.n, color: 'ray' }],
    sub: v => `${v.s} × ${v.s} ${v.c === 1 ? 'L' : 'C'}${['8', '16', '16F', '32F'][v.f]}: <b>${num(nodeMB(v))} MB</b> per node · ${v.n} nodes ≈ <b>${num(nodeMB(v) * v.n / 1024)} GB</b> if every result is kept`,
    plot: { x: 's', logY: true, y: [0.05, 100000] }
  });

  /* ---------- output size from inheritance ---------- */
  A.fx('relsize', {
    title: 'Relative to parent: sizes as powers of two',
    expr: 'width = 2<sup>{p} + {dx}</sup>,   height = 2<sup>{p} + {dy}</sup>',
    vars: { p: { sym: 'parent', name: 'parent size (log2)', values: [8, 9, 10, 11, 12, 13], labels: SL, index: 2 },
            dx: { sym: 'Δx', name: 'width offset', min: -4, max: 3, value: 0, step: 1 }, dy: { sym: 'Δy', name: 'height offset', min: -4, max: 3, value: -1, step: 1 } },
    out: [{ sym: 'width', unit: 'px', f: v => Math.pow(2, clamp(v.p + v.dx, 0, 13)), color: 'accent' }, { sym: 'height', unit: 'px', f: v => Math.pow(2, clamp(v.p + v.dy, 0, 13)), color: 'ray' }],
    sub: v => { const w = Math.pow(2, clamp(v.p + v.dx, 0, 13)), h = Math.pow(2, clamp(v.p + v.dy, 0, 13)); return `parent ${Math.pow(2, v.p)} px, offset (${v.dx}, ${v.dy}) → <b>${w} × ${h}</b>` + (w < 16 || h < 16 ? ' · below 16 px: Adobe advises against it, it renders slower' : '') + ' · change the parent and the node follows'; },
    draw(ctx, W, H, v, X) {
      const P = Math.pow(2, v.p), w = Math.pow(2, clamp(v.p + v.dx, 0, 13)), h = Math.pow(2, clamp(v.p + v.dy, 0, 13));
      const sc = Math.min((W - 40) / Math.max(P, w), (H - 50) / Math.max(P, h)) * 0.95, x0 = 20, y0 = 30;
      ctx.strokeStyle = col('muted'); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.strokeRect(x0, y0, P * sc, P * sc); ctx.setLineDash([]);
      X.label(ctx, `parent ${P} × ${P}`, x0, y0 - 12, col('muted'));
      ctx.fillStyle = alpha(col('accent'), 0.22); ctx.fillRect(x0, y0, w * sc, h * sc); ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.strokeRect(x0, y0, w * sc, h * sc);
      X.label(ctx, `node ${w} × ${h}`, x0 + Math.min(w * sc, W - 160) + 8, y0 + Math.min(h * sc, H - 60) / 2, col('accent'), 'left', true);
    },
    plot: false, size: [880, 260]
  });

  /* ---------- levels per bit depth ---------- */
  A.fx('levels', {
    title: 'How many levels an integer format stores',
    expr: 'levels = 2<sup>{n}</sup>,   step = 1 / (2<sup>{n}</sup> − 1);   showing {r} of the 0–1 range',
    vars: { n: { sym: 'n', name: 'bits per channel', min: 1, max: 16, value: 8, step: 1 }, r: { sym: 'zoom', name: 'part of the range shown', values: [1, 0.25, 0.05, 0.01], labels: ['all of 0–1', '0.4–0.65', '0.5–0.55', '0.5–0.51'], index: 2 } },
    out: [{ sym: 'levels', f: v => Math.pow(2, v.n), color: 'accent' }, { sym: 'step', f: v => 1 / (Math.pow(2, v.n) - 1), color: 'ray' }],
    sub: v => { const L = Math.pow(2, v.n) - 1, steps = v.r * L; return `${v.n} bits: <b>${num(L + 1)}</b> levels, one step = ${num(1 / L)} · the strip below spans ${num(v.r)} of the range, so it holds about <b>${num(Math.max(1, steps))}</b> distinct value${steps >= 1.5 ? 's' : ''}` + (steps < 40 ? ': visible bands' : ''); },
    draw(ctx, W, H, v, X) {
      const L = Math.pow(2, v.n) - 1, a = v.r === 1 ? 0 : v.r === 0.25 ? 0.4 : 0.5, x0 = 16, w = W - 32;
      const q = x => Math.round(x * L) / L, lo = a, hi = a + v.r;
      const stretch = x => clamp((x - lo) / (hi - lo), 0, 1);           // show the zoomed part with full contrast
      pic(ctx, w, 1, i => { const t = q(lo + (hi - lo) * (i + 0.5) / w); const g = stretch(t); return [g, g, g]; }, x0, 30, w, 70);
      pic(ctx, w, 1, i => { const g = (i + 0.5) / w; return [g, g, g]; }, x0, 132, w, 40, true);
      X.label(ctx, `stored at ${v.n} bits (contrast stretched so the zoomed part fills black to white)`, x0, 18, col('muted'));
      X.label(ctx, 'the smooth ramp it should be', x0, 120, col('muted'));
      X.label(ctx, num(lo), x0, H - 14, col('muted')); X.label(ctx, num(hi), x0 + w, H - 14, col('muted'), 'right');
    },
    plot: { x: 'n', logY: true, y: [1, 100000] }, size: [440, 230]
  });

  /* ---------- banding in a shallow height ramp ---------- */
  A.fx('banding', {
    title: 'A gentle height ramp, stored as integers',
    expr: 'pixels per level = {s} / ({r} · (2<sup>{n}</sup> − 1))',
    vars: { n: { sym: 'n', name: 'bits per channel', values: [8, 16], index: 0 }, r: { sym: 'Δh', name: 'height change across the image', min: 0.01, max: 1, value: 0.06, log: true },
            s: { sym: 'size', name: 'image width', values: SIZES, labels: SL, index: 3 } },
    out: { sym: 'pixels per level', f: v => v.s / (v.r * (Math.pow(2, v.n) - 1)), color: 'accent' },
    sub: v => { const p = v.s / (v.r * (Math.pow(2, v.n) - 1)); return p > 1.2 ? `each stored value covers <b>${num(p)} pixels</b>: flat terraces with a jump of 1/${Math.pow(2, v.n) - 1} between them. A normal map made from this shows a ridge every ${num(p)} pixels and nothing in between.` : `<b>${num(p)}</b> pixels per level: every pixel gets its own value, the slope survives`; },
    draw(ctx, W, H, v, X) {
      const L = Math.pow(2, v.n) - 1, step = v.r / v.s, ppl = 1 / (step * L), N = Math.round(clamp(ppl * 4.5, 24, 4096));
      const x0 = 20, w = W - 40, top = 18, hh = H * 0.46, h0 = 0.5 + 0.37 / L;
      const hq = i => Math.round((h0 + i * step) * L) / L, span = N * step * 1.15, base = h0 - N * step * 0.05;
      const Y = h => top + hh - (h - base) / span * hh;
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x0, Y(h0)); ctx.lineTo(x0 + w, Y(h0 + N * step)); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2.5; ctx.beginPath();
      for (let i = 0; i < N; i++) { const a = x0 + i / N * w, b = x0 + (i + 1) / N * w, y = clamp(Y(hq(i)), top - 6, top + hh + 6); i ? ctx.lineTo(a, y) : ctx.moveTo(a, y); ctx.lineTo(b, y); } ctx.stroke();
      X.label(ctx, `${N} pixels of the ramp: dashed = intended, orange = stored at ${v.n} bits`, x0, H * 0.6, col('muted'));
      const by = H * 0.68, bh = H * 0.2, bw = Math.max(1, Math.min(4, w / N * 0.6));
      ctx.fillStyle = alpha(col('muted'), 0.35); ctx.fillRect(x0, by + bh - 1, w, 1);
      for (let i = 1; i < N; i++) { const d = hq(i) - hq(i - 1); if (d <= 0) continue; const x = x0 + i / N * w, t = clamp(d * L / 3, 0.2, 1); ctx.fillStyle = col('bad'); ctx.fillRect(x - bw / 2, by + bh - t * bh, bw, t * bh); }
      X.label(ctx, ppl > 1.2 ? 'slope per pixel: zero on the terraces, a spike at each jump' : 'slope per pixel: every pixel changes, the slope is smooth', x0, H - 8, col('muted'));
    },
    plot: { x: 'r', logY: true, y: [0.05, 20000] }, size: [440, 260]
  });

  /* ---------- precision of each format near a value ---------- */
  const halfStep = x => Math.pow(2, Math.max(Math.floor(Math.log2(x)), -14) - 10);
  const floatStep = x => Math.pow(2, Math.floor(Math.log2(x)) - 23);
  A.fx('precision', {
    title: 'The smallest change each format can store near a value',
    expr: '8-bit: 1/255,   16-bit: 1/65 535,   16F: 2<sup>⌊log₂ {x}⌋ − 10</sup>,   32F: 2<sup>⌊log₂ {x}⌋ − 23</sup>',
    vars: { x: { sym: 'x', name: 'stored value', min: 0.0005, max: 4, value: 0.5, log: true } },
    out: [{ sym: '8-bit', f: v => v.x <= 1 ? 1 / 255 : NaN, color: 'bad' }, { sym: '16-bit', f: v => v.x <= 1 ? 1 / 65535 : NaN, color: 'accent' }, { sym: '16F', f: v => halfStep(v.x), color: 'ray' }, { sym: '32F', f: v => floatStep(v.x), color: 'good' }],
    sub: v => `near ${num(v.x)}: 8-bit ${v.x <= 1 ? num(1 / 255) : 'cannot store it'} · 16-bit ${v.x <= 1 ? num(1 / 65535) : 'cannot store it'} · 16F <b>${num(halfStep(v.x))}</b> · 32F ${num(floatStep(v.x))}` + (v.x > 1 / 64 && v.x <= 1 ? ' · above about 1/64, 16-bit integer is finer than 16F' : v.x <= 1 / 64 ? ' · in the darks, 16F is finer than 16-bit integer' : ' · above 1 only the float formats work'),
    plot: { x: 'x', logY: true, y: [1e-9, 0.01] }
  });

  /* ---------- clamping between nodes ---------- */
  A.fx('clampmath', {
    title: 'Subtract, then add back: integer versus float',
    expr: 'result = ({a} − {b}) + {b}',
    vars: { a: { sym: 'a', name: 'input value', min: 0, max: 1, value: 0.3, step: 0.01 }, b: { sym: 'b', name: 'value subtracted and added back', min: 0, max: 1, value: 0.6, step: 0.01 } },
    out: [{ sym: 'integer formats', f: v => clamp(clamp(v.a - v.b, 0, 1) + v.b, 0, 1), color: 'bad' }, { sym: 'float formats', f: v => v.a - v.b + v.b, color: 'good' }],
    sub: v => { const m = v.a - v.b, mi = clamp(m, 0, 1); return `between the nodes: ${num(m)} → integer stores <b>${num(mi)}</b>, float keeps ${num(m)} · back again: integer <b>${num(clamp(mi + v.b, 0, 1))}</b>, float <b>${num(v.a)}</b>` + (m < 0 ? ' · the integer graph lost the information the moment it went below 0' : ''); },
    plot: { x: 'a', y: [0, 1.05] }
  });

  /* ---------- dark codes: why linear needs more bits ---------- */
  A.fx('darkcodes', {
    title: 'How many 8-bit codes describe the darks',
    expr: 'codes below {L}:   linear = {L} · 255,   sRGB-encoded = encode({L}) · 255',
    vars: { L: { sym: 'L', name: 'linear brightness', min: 0.001, max: 1, value: 0.05, log: true } },
    out: [{ sym: 'stored linear', f: v => v.L * 255, color: 'bad' }, { sym: 'stored sRGB', f: v => l2s(v.L) * 255, color: 'good' }],
    sub: v => `everything darker than ${num(v.L)} linear gets <b>${num(Math.floor(v.L * 255))}</b> codes stored linear, <b>${num(Math.floor(l2s(v.L) * 255))}</b> stored sRGB-encoded. Eyes are most sensitive in the darks, so 8-bit linear colour bands there: 16 bits fixes it.`,
    plot: { x: 'L', y: [0, 260] }
  });

  /* ---------- blending in encoded versus linear values ---------- */
  const PAIRS = [['red to green', [0.9, 0.08, 0.05], [0.1, 0.8, 0.1]], ['black to white', [0, 0, 0], [1, 1, 1]], ['blue to yellow', [0.08, 0.2, 0.9], [0.95, 0.85, 0.1]], ['orange to teal', [0.95, 0.45, 0.1], [0.05, 0.55, 0.6]]];
  const mixE = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  const mixL = (a, b, t) => a.map((x, i) => l2s(s2l(x) + (s2l(b[i]) - s2l(x)) * t));
  const lum = c => 0.2126 * s2l(c[0]) + 0.7152 * s2l(c[1]) + 0.0722 * s2l(c[2]);
  A.fx('mixspace', {
    title: 'A 50 % blend: on encoded values or on linear values',
    expr: 'encoded: lerp(a, b, {t}),   linear: encode(lerp(decode(a), decode(b), {t}));   colours {p}',
    vars: { t: { sym: 't', name: 'opacity of the blend', min: 0, max: 1, value: 0.5, step: 0.01 }, p: { sym: 'pair', name: 'colour pair', values: [0, 1, 2, 3], labels: PAIRS.map(p => p[0]), index: 0 } },
    out: [{ sym: 'encoded mix', f: v => lum(mixE(PAIRS[v.p][1], PAIRS[v.p][2], v.t)), color: 'bad' }, { sym: 'linear mix', f: v => lum(mixL(PAIRS[v.p][1], PAIRS[v.p][2], v.t)), color: 'good' }],
    sub: v => { const e = mixE(PAIRS[v.p][1], PAIRS[v.p][2], v.t), l = mixL(PAIRS[v.p][1], PAIRS[v.p][2], v.t); return `at ${num(v.t)}: encoded blend (Legacy mode) gives (${e.map(x => Math.round(x * 255)).join(', ')}), linear blend (OCIO or ACE mode) gives (${l.map(x => Math.round(x * 255)).join(', ')}) in sRGB values. The graph plots the brightness (relative luminance) of each: the encoded mix is darker in the middle.`; },
    draw(ctx, W, H, v, X) {
      const [, a, b] = PAIRS[v.p], x0 = 14, w = W - 28;
      pic(ctx, w, 1, i => mixE(a, b, i / (w - 1)), x0, 26, w, 54, true);
      pic(ctx, w, 1, i => mixL(a, b, i / (w - 1)), x0, 112, w, 54, true);
      X.label(ctx, 'blended on the stored (sRGB-encoded) values', x0, 16, col('muted')); X.label(ctx, 'blended on linear values', x0, 102, col('muted'));
      const x = x0 + w * v.t; ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 22); ctx.lineTo(x, 170); ctx.stroke();
      const e = mixE(a, b, v.t), l = mixL(a, b, v.t);
      [[e, 'encoded'], [l, 'linear']].forEach(([c, n], i) => { ctx.fillStyle = `rgb(${c.map(z => Math.round(clamp(z, 0, 1) * 255)).join(',')})`; ctx.fillRect(x0 + i * 110, 190, 96, 40); X.label(ctx, n, x0 + i * 110, 242, col('muted')); });
    },
    plot: { x: 't', y: [0, 1] }, size: [440, 260]
  });
})();
