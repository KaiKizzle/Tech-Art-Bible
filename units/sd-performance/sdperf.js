/* Keeping Graphs Fast — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const SZ = [256, 512, 1024, 2048, 4096, 8192], SL = ['256', '512', '1k', '2k', '4k', '8k'];

  /* ---------- cost per resolution step ---------- */
  A.fx('pixcost', {
    title: 'Render time against output size',
    expr: 'time = {t} · ({s} / 2048)²',
    vars: { t: { sym: 't<sub>2k</sub>', name: 'graph time at 2048', unit: 'ms', min: 50, max: 3000, value: 600, log: true }, s: { sym: 'size', name: 'parent size', values: SZ, labels: SL, index: 2 } },
    out: { sym: 'time', unit: 'ms', f: v => v.t * Math.pow(v.s / 2048, 2), color: 'accent' },
    sub: v => { const t = v.t * Math.pow(v.s / 2048, 2); return `at ${v.s}: <b>${num(t)} ms</b> per full recompute · one step down is 4× faster, two steps 16× · ${t < 100 ? 'interactive' : t < 500 ? 'noticeable lag on every slider move' : 'too slow to tweak comfortably'}`; },
    plot: { x: 's', logY: true, y: [1, 100000] }
  });

  /* ---------- where a tweak recomputes ---------- */
  const COST = [4, 6, 3, 40, 5, 8, 3, 25, 4, 6, 3, 2];
  const NAMES = ['Noise', 'Levels', 'Blend', 'Slope Blur', 'Blend', 'Warp', 'Levels', 'Blur HQ', 'Blend', 'Normal', 'HSL', 'Output'];
  A.fx('recompute', {
    title: 'A tweak recomputes everything after it',
    expr: 'recompute = Σ cost of nodes from position {k} to the end',
    vars: { k: { sym: 'k', name: 'node whose parameter you change', min: 1, max: 12, value: 2, step: 1 } },
    out: { sym: 'recompute', unit: 'ms', f: v => COST.slice(v.k - 1).reduce((a, b) => a + b, 0), color: 'accent' },
    sub: v => `changing ${NAMES[v.k - 1]} (node ${v.k}) recomputes ${12 - v.k + 1} nodes: <b>${COST.slice(v.k - 1).reduce((a, b) => a + b, 0)} ms</b> of ${COST.reduce((a, b) => a + b, 0)} · everything before it comes from the cache. Exposed parameters near the end make tweaking cheap; near the start, every tweak recomputes the blurs and warps.`,
    draw(ctx, W, H, v, X) {
      const n = 12, gap = 6, w = (W - 20 - gap * (n - 1)) / n, y = 40, mx = 40;
      for (let i = 0; i < n; i++) { const x = 10 + i * (w + gap), on = i >= v.k - 1, h = 20 + 120 * COST[i] / mx;
        ctx.fillStyle = on ? alpha(col('accent'), 0.85) : alpha(col('muted'), 0.25); ctx.fillRect(x, y + 140 - h, w, h);
        X.label(ctx, NAMES[i], x + w / 2, y + 156, on ? col('ink') : col('muted'), 'center'); X.label(ctx, COST[i] + ' ms', x + w / 2, y + 172, col('muted'), 'center');
        if (i < n - 1) X.arrow(ctx, x + w + 1, y + 130, x + w + gap - 1, y + 130, col('line'), 1, 4); }
      X.label(ctx, 'orange: recomputed · grey: cached', 10, 16, col('muted'));
    },
    plot: false, size: [880, 240]
  });

  /* ---------- blur at full size versus downscaled ---------- */
  A.fx('blurcost', {
    title: 'A wide blur, full size or after downscaling',
    expr: 'cost ∝ ({s} / 2<sup>{k}</sup>)² · 2 · {r} / 2<sup>{k}</sup>',
    vars: { s: { sym: 'size', name: 'output size', values: [1024, 2048, 4096], labels: ['1k', '2k', '4k'], index: 1 }, r: { sym: 'r', name: 'blur radius in pixels at full size', min: 2, max: 256, value: 64, log: true },
            k: { sym: 'k', name: 'times halved before blurring', min: 0, max: 4, value: 2, step: 1 } },
    out: { sym: 'reads', unit: 'million', f: v => Math.pow(v.s / Math.pow(2, v.k), 2) * 2 * Math.max(1, v.r / Math.pow(2, v.k)) / 1e6, color: 'accent' },
    sub: v => { const full = v.s * v.s * 2 * v.r, now = Math.pow(v.s / Math.pow(2, v.k), 2) * 2 * Math.max(1, v.r / Math.pow(2, v.k)); return `a separable blur reads about 2 · r pixels for each output pixel. Halving the image ${v.k}× divides the pixels by ${Math.pow(4, v.k)} and the radius in pixels by ${Math.pow(2, v.k)}: <b>${num(full / now)}× fewer reads</b>. A wide blur loses nothing visible; upscale with bilinear filtering afterwards.`; },
    plot: { x: 'k', logY: true, y: [0.01, 3000] }
  });

  /* ---------- Copy versus Switch on an optional branch ---------- */
  A.fx('switchcost', {
    title: 'An optional feature switched off',
    expr: 'Copy: main + optional,   Switch: main + (opacity > 0 ? optional : 0);   opacity {o}',
    vars: { m: { sym: 'main', name: 'main chain', unit: 'ms', min: 50, max: 500, value: 200, step: 10 }, b: { sym: 'optional', name: 'optional branch (moss, dirt…)', unit: 'ms', min: 0, max: 500, value: 180, step: 10 },
            o: { sym: 'opacity', name: 'feature amount (exposed)', values: [0, 0.5, 1], index: 0 } },
    out: [{ sym: 'Copy', unit: 'ms', f: v => v.m + v.b, color: 'bad' }, { sym: 'Switch', unit: 'ms', f: v => v.o > 0 ? (v.o < 1 ? v.m + v.b : v.b + 0) : v.m, color: 'good' }],
    sub: v => v.o === 0 ? `feature off: Copy still computes the optional branch (<b>${v.m + v.b} ms</b>), Switch skips it (<b>${v.m} ms</b>)` : v.o === 1 ? `feature fully on: Switch skips the background chain instead (<b>${v.b} ms</b>)` : `in between, both inputs are needed either way: <b>${v.m + v.b} ms</b>`,
    plot: { x: 'b', y: [0, 1000] }
  });

  /* ---------- runtime: rendering substances at load ---------- */
  A.fx('runtime', {
    title: 'Rendering Substance materials while a level loads',
    expr: 'load time = {M} materials · {t} · ({s} / 2048)²',
    vars: { M: { sym: 'M', name: 'materials rendered at load', min: 1, max: 200, value: 30, step: 1 }, t: { sym: 't<sub>2k</sub>', name: 'one graph at 2048 in the engine', unit: 'ms', min: 50, max: 5000, value: 900, log: true },
            s: { sym: 'size', name: 'output size', values: [512, 1024, 2048, 4096], labels: ['512', '1k', '2k', '4k'], index: 2 } },
    out: { sym: 'load time', unit: 's', f: v => v.M * v.t * Math.pow(v.s / 2048, 2) / 1000, color: 'accent' },
    sub: v => `${v.M} materials: <b>${num(v.M * v.t * Math.pow(v.s / 2048, 2) / 1000)} s</b> of rendering before the textures exist, every time the level loads. Baked textures load in a fraction of that, so only materials that must change at runtime should stay as SBSAR.`,
    plot: { x: 'M' }
  });
})();
