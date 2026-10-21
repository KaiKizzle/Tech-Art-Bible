/* Pixel Processor and FX-Maps — live formulas */
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
  function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  /* ---------- a pixel processor: a function of $pos ---------- */
  A.fx('ppcircle', {
    title: 'A Pixel Processor function: soft dots from $pos',
    expr: 'q = frac($pos · {n}),   value = saturate(({r} − length(q − 0.5)) / {s})',
    vars: { n: { sym: 'n', name: 'repeats per tile', values: [1, 2, 3, 4, 6, 8], index: 2 }, r: { sym: 'r', name: 'radius', min: 0.05, max: 0.7, value: 0.3, step: 0.01 }, s: { sym: 'soft', name: 'edge softness', min: 0.005, max: 0.3, value: 0.05, step: 0.005 } },
    out: { sym: 'value at the centre of a cell', f: v => sat(v.r / v.s), color: 'accent' },
    sub: v => `run once for each of the ${num(512 * 512)} pixels of a 512 × 512 output: read <code>$pos</code> (0–1), compute, return one number. No pixel knows its neighbours\' results · <code>frac</code> repeats the cell ${v.n} × ${v.n} times and keeps the result tiling`,
    draw(ctx, W, H, v, X) {
      const s = H - 30, f = (x, y) => { const qx = fr(x * v.n) - 0.5, qy = fr(y * v.n) - 0.5; return sat((v.r - Math.hypot(qx, qy)) / v.s); };
      pic(ctx, 160, 160, (i, j) => { const t = f((i + 0.5) / 160, (j + 0.5) / 160); return [t, t, t]; }, 14, 20, s, s, true);
      X.label(ctx, 'output', 14, 10, col('muted'));
      const x0 = s + 50, w = W - x0 - 20, yb = H - 30, hh = H - 70; ctx.strokeStyle = col('line'); ctx.beginPath(); ctx.moveTo(x0, yb); ctx.lineTo(x0 + w, yb); ctx.stroke();
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i <= 300; i++) { const x = i / 300, y = yb - f(x, 0.5 / v.n) * hh; i ? ctx.lineTo(x0 + x * w, y) : ctx.moveTo(x0, y); } ctx.stroke();
      X.label(ctx, 'value along one row, through the dot centres', x0, 14, col('muted')); X.label(ctx, '$pos.x 0', x0, H - 12, col('muted')); X.label(ctx, '1', x0 + w, H - 12, col('muted'), 'right');
      ctx.strokeStyle = alpha(col('ray'), 0.8); ctx.setLineDash([4, 4]); ctx.strokeRect(14, 20 + (0.5 / v.n) * s - 1, s, 2); ctx.setLineDash([]);
    },
    plot: false, size: [880, 270]
  });

  /* ---------- reading neighbours ---------- */
  const shape = (x, y) => { const d = Math.hypot(x - 0.42, y - 0.5); return (d < 0.28 ? 1 : 0) * (Math.abs(x - 0.66) < 0.07 && y > 0.3 && y < 0.7 ? 0 : 1) + (Math.abs(x - 0.82) < 0.06 && Math.abs(y - 0.5) < 0.25 ? 1 : 0); };
  const NB = ['edge detect', 'emboss', 'box blur'];
  A.fx('neighbours', {
    title: 'Sampling neighbours: $pos plus an offset in pixels',
    expr: 'e = 1 / $size,   value = f(in($pos), in($pos ± {o}·e))   ({m})',
    vars: { o: { sym: 'k', name: 'offset in pixels', min: 1, max: 8, value: 2, step: 1 }, m: { sym: 'filter', name: 'what to compute', values: [0, 1, 2], labels: NB, index: 0 } },
    out: { sym: 'reads per pixel', f: v => [5, 3, 9][v.m], color: 'accent' },
    sub: v => [`<b>edge detect</b>: |in(p + k·e.x) − in(p − k·e.x)| + |in(p + k·e.y) − in(p − k·e.y)|: bright where the value changes, 5 reads per pixel`,
      `<b>emboss</b>: 0.5 + in(p − k·e) − in(p + k·e) along a diagonal: a slope picture, the first step towards a normal map, 3 reads`,
      `<b>box blur</b>: the average of a 3 × 3 grid spaced k pixels apart, 9 reads; real blurs use many more`][v.m] + ' · <code>$size</code> turns pixels into the 0–1 units of <code>$pos</code>',
    draw(ctx, W, H, v, X) {
      const n = 120, e = v.o / n, inn = (x, y) => shape(x, y);
      const f = (x, y) => v.m === 0 ? Math.abs(inn(x + e, y) - inn(x - e, y)) + Math.abs(inn(x, y + e) - inn(x, y - e))
        : v.m === 1 ? 0.5 + 0.5 * (inn(x - e, y - e) - inn(x + e, y + e))
        : (() => { let s = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) s += inn(x + a * e, y + b * e); return s / 9; })();
      const s = H - 30;
      pic(ctx, n, n, (i, j) => { const t = inn((i + 0.5) / n, (j + 0.5) / n); return [t, t, t]; }, 14, 20, s, s, false);
      pic(ctx, n, n, (i, j) => { const t = f((i + 0.5) / n, (j + 0.5) / n); return [t, t, t]; }, s + 34, 20, s, s, false);
      X.label(ctx, 'input', 14, 10, col('muted')); X.label(ctx, 'output (120 × 120)', s + 34, 10, col('muted'));
      const cx = 2 * s + 150, cy = H / 2, g = 16; X.label(ctx, 'reads around one pixel', cx - 10, 10, col('muted'));
      const taps = v.m === 0 ? [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]] : v.m === 1 ? [[-1, -1], [1, 1], [0, 0]] : [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
      for (let a = -8; a <= 8; a++) for (let b = -5; b <= 5; b++) { ctx.strokeStyle = alpha(col('line'), 0.8); ctx.strokeRect(cx + a * g * 0.55, cy + b * g * 0.55, g * 0.55, g * 0.55); }
      taps.forEach(([a, b]) => { const x = cx + a * v.o * g * 0.55, y = cy + b * v.o * g * 0.55; ctx.fillStyle = a || b ? col('ray') : col('accent'); ctx.fillRect(x, y, g * 0.55, g * 0.55); });
    },
    plot: false, size: [880, 260]
  });

  /* ---------- FX-Map quadtree ---------- */
  A.fx('quadtree', {
    title: 'Quadrant nodes: each level splits every cell in four',
    expr: 'patterns at level {d} = 4<sup>{d}</sup>,   pattern size = 1 / 2<sup>{d}</sup>;   random offset {j}, random size {z}',
    vars: { d: { sym: 'd', name: 'level ($depth)', min: 0, max: 6, value: 3, step: 1 }, j: { sym: 'jitter', name: 'random offset, in cells', min: 0, max: 1, value: 0.3, step: 0.01 },
            z: { sym: 'size var', name: 'random size', min: 0, max: 1, value: 0.4, step: 0.01 }, seed: { sym: 'seed', name: 'random seed', min: 0, max: 50, value: 7, step: 1 } },
    out: { sym: 'patterns', f: v => Math.pow(4, v.d), color: 'accent' },
    sub: v => `level ${v.d}: <b>${num(Math.pow(4, v.d))}</b> patterns, each 1/${Math.pow(2, v.d)} of the image · a chain of Quadrant nodes down to level ${v.d} draws ${num((Math.pow(4, v.d + 1) - 1) / 3)} in total if every level draws`,
    draw(ctx, W, H, v, X) {
      const s = H - 20, x0 = (W - s) / 2, y0 = 10, n = Math.pow(2, v.d), c = s / n, r = rng(v.seed + 1);
      ctx.fillStyle = col('bg'); ctx.fillRect(x0, y0, s, s);
      ctx.strokeStyle = alpha(col('line'), 0.9); ctx.lineWidth = 1; for (let k = 0; k <= n; k++) { ctx.beginPath(); ctx.moveTo(x0 + k * c, y0); ctx.lineTo(x0 + k * c, y0 + s); ctx.moveTo(x0, y0 + k * c); ctx.lineTo(x0 + s, y0 + k * c); ctx.stroke(); }
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, s, s); ctx.clip();
      for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) { const ox = (r() - 0.5) * v.j * c, oy = (r() - 0.5) * v.j * c, sz = c * 0.42 * (1 - v.z * r()); const g = ctx.createRadialGradient(x0 + (i + 0.5) * c + ox, y0 + (k + 0.5) * c + oy, 0, x0 + (i + 0.5) * c + ox, y0 + (k + 0.5) * c + oy, sz);
        g.addColorStop(0, col('ink')); g.addColorStop(1, alpha(col('ink'), 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x0 + (i + 0.5) * c + ox, y0 + (k + 0.5) * c + oy, sz, 0, 7); ctx.fill(); }
      ctx.restore();
    },
    plot: { x: 'd', logY: true, y: [1, 5000] }, size: [440, 280]
  });

  /* ---------- Iterate: scatter N patterns, Add versus Max ---------- */
  const BM = ['Add', 'Max'];
  function scatter(v) { const r = rng(v.seed + 11), list = []; for (let i = 0; i < v.N; i++) list.push([r(), r(), v.sz * (1 - v.rz * r()), r()]); return list; }
  const clipped = v => { const L = scatter(v); let c = 0, t = 0; for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) { const x = (i + 0.5) / 40, y = (j + 0.5) / 40; let a = 0, mx = 0; L.forEach(([px, py, s]) => { const dx = Math.abs(x - px), dy = Math.abs(y - py), d = Math.hypot(Math.min(dx, 1 - dx), Math.min(dy, 1 - dy)) / s; if (d < 1) { const h = Math.sqrt(1 - d * d) * 0.8; a += h; mx = Math.max(mx, h); } }); if ((v.m ? mx : a) > 0.001) t++; if (v.m === 0 && a > 1) c++; } return t ? c / t : 0; };
  A.fx('iterate', {
    title: 'Iterate: the same pattern N times, random per copy',
    expr: 'for $number = 0…{N} − 1:  pos = random,  size = {sz} · (1 − {rz} · random);   blending {m}',
    vars: { N: { sym: 'N', name: 'iterations', min: 1, max: 200, value: 40, step: 1 }, sz: { sym: 'size', name: 'pattern size', min: 0.03, max: 0.3, value: 0.12, step: 0.005 },
            rz: { sym: 'rand', name: 'random size amount', min: 0, max: 1, value: 0.5, step: 0.01 }, m: { sym: 'mode', name: 'blending of overlapping patterns', values: [0, 1], labels: BM, index: 1 }, seed: { sym: 'seed', name: 'random seed', min: 0, max: 99, value: 3, step: 1 } },
    out: { sym: 'clipped area', f: clipped, color: 'bad', fmt: x => num(x * 100) + ' %' },
    sub: v => v.m === 0 ? `overlapping domes <b>add up</b>: where they pile past 1 an integer FX-Map clips them flat (red, <b>${num(clipped(v) * 100)} %</b> of the covered area). Good for brightness that accumulates, wrong for stones.` : '<b>Max</b> keeps the taller dome where they overlap: stones lean on each other, nothing clips. The usual choice for height scatters.',
    draw(ctx, W, H, v, X) {
      const L = scatter(v), n = 120, s = H - 26;
      pic(ctx, n, n, (i, j) => { const x = (i + 0.5) / n, y = (j + 0.5) / n; let a = 0, mx = 0;
        L.forEach(([px, py, sz]) => { const dx = Math.abs(x - px), dy = Math.abs(y - py), d = Math.hypot(Math.min(dx, 1 - dx), Math.min(dy, 1 - dy)) / sz; if (d < 1) { const h = Math.sqrt(1 - d * d) * 0.8; a += h; mx = Math.max(mx, h); } });
        const t = v.m ? mx : a; return t > 1 ? [0.95, 0.25, 0.2] : [t, t, t]; }, 14, 18, s, s, true);
      X.label(ctx, `${v.N} patterns, tiling: copies wrap around the edges`, 14, 9, col('muted'));
      ctx.strokeStyle = alpha(col('ray'), 0.8); ctx.setLineDash([4, 4]); ctx.strokeRect(14, 18 + s * 0.5 - 1, s, 2); ctx.setLineDash([]);
      const x0 = s + 50, w = W - x0 - 20, yb = H - 30, hh = (H - 70) / 1.4, M = 300;
      const row = x => { let a = 0, mx = 0; L.forEach(([px, py, sz]) => { const dx = Math.abs(x - px), dy = Math.abs(0.5 - py), d = Math.hypot(Math.min(dx, 1 - dx), Math.min(dy, 1 - dy)) / sz; if (d < 1) { const h = Math.sqrt(1 - d * d) * 0.8; a += h; mx = Math.max(mx, h); } }); return [a, mx]; };
      ctx.strokeStyle = alpha(col('bad'), 0.6); ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(x0, yb - hh); ctx.lineTo(x0 + w, yb - hh); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, '1.0', x0 + w, yb - hh - 10, col('bad'), 'right');
      if (v.m === 0) { ctx.strokeStyle = alpha(col('muted'), 0.9); ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); for (let i = 0; i <= M; i++) { const y = yb - Math.min(row(i / M)[0], 1.4) * hh; i ? ctx.lineTo(x0 + i / M * w, y) : ctx.moveTo(x0, y); } ctx.stroke(); ctx.setLineDash([]); }
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i <= M; i++) { const r = row(i / M), y = yb - Math.min(v.m ? r[1] : r[0], 1) * hh; i ? ctx.lineTo(x0 + i / M * w, y) : ctx.moveTo(x0, y); } ctx.stroke();
      X.label(ctx, v.m ? 'one row through the middle: the taller dome wins' : 'one row: grey dashed = the sum, orange = what an integer format keeps', x0, 14, col('muted'));
    },
    plot: false, size: [880, 300]
  });

  /* ---------- gather versus scatter ---------- */
  A.fx('gatherscatter', {
    title: 'Who does the work: every pixel, or every pattern',
    expr: 'Pixel Processor: {s}² · {t} reads,   FX-Map: {N} patterns · ({p} · {s})² pixels',
    vars: { s: { sym: 'size', name: 'output size', values: [512, 1024, 2048, 4096], labels: ['512', '1k', '2k', '4k'], index: 2 }, t: { sym: 'taps', name: 'reads per pixel in the function', values: [1, 2, 4, 8, 16], index: 0 },
            N: { sym: 'N', name: 'patterns drawn', min: 10, max: 20000, value: 400, log: true }, p: { sym: 'p', name: 'pattern size, fraction of the image', min: 0.01, max: 0.5, value: 0.06, log: true } },
    out: [{ sym: 'Pixel Processor', unit: 'M', f: v => v.s * v.s * v.t / 1e6, color: 'ray' }, { sym: 'FX-Map', unit: 'M', f: v => v.N * Math.pow(v.p * v.s, 2) / 1e6, color: 'accent' }],
    sub: v => { const a = v.s * v.s * v.t / 1e6, b = v.N * Math.pow(v.p * v.s, 2) / 1e6; return `pixel work: Pixel Processor <b>${num(a)} M</b>, FX-Map <b>${num(b)} M</b> pixels touched · ` + (b > a ? 'many large, overlapping patterns cost more than computing every pixel once' : 'a few small patterns touch only a fraction of the image') + '. Rough work counts, not timings: the FX-Map also runs its functions per pattern on the CPU.'; },
    plot: { x: 'N', logY: true, y: [0.1, 100000] }
  });
})();
