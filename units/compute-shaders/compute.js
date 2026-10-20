/* Compute Shaders — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const cl = Math.ceil;

  /* ---------- total threads ---------- */
  A.fx('total', {
    title: 'Threads in a dispatch',
    expr: 'threads = ({gx} · {gy}) · ({tx} · {ty})',
    vars: { gx: { sym: 'G<sub>x</sub>', name: 'groups along X', min: 1, max: 16, value: 6, step: 1 }, gy: { sym: 'G<sub>y</sub>', name: 'groups along Y', min: 1, max: 10, value: 4, step: 1 },
            tx: { sym: 'n<sub>x</sub>', name: 'numthreads X: threads per group along X', values: [1, 2, 4, 8, 16], index: 3 }, ty: { sym: 'n<sub>y</sub>', name: 'numthreads Y: threads per group along Y', values: [1, 2, 4, 8, 16], index: 3 } },
    out: { sym: 'threads', f: v => v.gx * v.gy * v.tx * v.ty },
    sub: v => `<b>${num(v.gx * v.gy)}</b> groups × <b>${v.tx * v.ty}</b> threads = <b>${num(v.gx * v.gy * v.tx * v.ty)}</b> threads, all running the same function`,
    draw(ctx, W, H, v, X) {
      const pad = 20, cw = (W - 2 * pad) / (v.gx * v.tx), ch = (H - 2 * pad - 14) / (v.gy * v.ty), c = Math.min(cw, ch), x0 = (W - c * v.gx * v.tx) / 2, y0 = pad;
      for (let gy = 0; gy < v.gy; gy++) for (let gx = 0; gx < v.gx; gx++) {
        const hue = ((gx + gy * 3) % 6) * 50 + 190;
        ctx.fillStyle = `hsl(${hue} 55% 50% / 0.55)`; ctx.fillRect(x0 + gx * v.tx * c + 1, y0 + gy * v.ty * c + 1, v.tx * c - 2, v.ty * c - 2);
        if (c > 3) { ctx.fillStyle = alpha('#000000', 0.25); for (let ty = 0; ty < v.ty; ty++) for (let tx = 0; tx < v.tx; tx++) ctx.fillRect(x0 + (gx * v.tx + tx) * c + c * 0.3, y0 + (gy * v.ty + ty) * c + c * 0.3, c * 0.4, c * 0.4); }
      }
      X.label(ctx, 'coloured blocks: groups · dots: threads', pad, H - 8, col('muted'));
    },
    plot: false, size: [880, 260]
  });

  /* ---------- covering an image ---------- */
  const groups = v => [cl(v.w / v.t), cl(v.h / v.t)];
  A.fx('dispatch', {
    title: 'Groups needed for an image',
    expr: 'groups = (⌈{w} / {t}⌉, ⌈{h} / {t}⌉),   numthreads({t}, {t}, 1)',
    vars: { w: { sym: 'W', name: 'texture width', min: 8, max: 4096, value: 1920, step: 1, log: true }, h: { sym: 'H', name: 'texture height', min: 8, max: 4096, value: 1080, step: 1, log: true },
            t: { sym: 'n', name: 'threads per group along each axis', values: [4, 8, 16, 32], index: 1 } },
    out: [{ sym: 'idle threads', f: v => { const g = groups(v); return 100 * (1 - v.w * v.h / (g[0] * g[1] * v.t * v.t)); }, color: 'bad', fmt: x => num(x) + ' %' }],
    sub: v => { const g = groups(v), idle = g[0] * g[1] * v.t * v.t - v.w * v.h; return `Dispatch(<b>${g[0]}</b>, <b>${g[1]}</b>, 1): ${num(g[0] * g[1] * v.t * v.t)} threads for ${num(v.w * v.h)} pixels, <b>${num(idle)}</b> past the edge${v.t * v.t > 1024 ? ' · more than 1024 threads per group is not allowed' : ''}`; },
    draw(ctx, W, H, v, X) {
      const g = groups(v), gw = g[0] * v.t, gh = g[1] * v.t, s = Math.min((W - 30) / gw, (H - 40) / gh), x0 = 15, y0 = 12;
      ctx.fillStyle = alpha(col('bad'), 0.35); ctx.fillRect(x0, y0, gw * s, gh * s);
      ctx.fillStyle = alpha(col('ray'), 0.55); ctx.fillRect(x0, y0, v.w * s, v.h * s);
      if (v.t * s >= 3) { ctx.strokeStyle = alpha(col('ink'), 0.35); ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i <= g[0]; i++) { ctx.moveTo(x0 + i * v.t * s, y0); ctx.lineTo(x0 + i * v.t * s, y0 + gh * s); } for (let j = 0; j <= g[1]; j++) { ctx.moveTo(x0, y0 + j * v.t * s); ctx.lineTo(x0 + gw * s, y0 + j * v.t * s); } ctx.stroke(); }
      X.label(ctx, 'blue: the image · red: threads past the edge', x0, H - 10, col('muted'));
    },
    plot: { x: 'w', y: [0, 60] }
  });

  /* ---------- thread IDs ---------- */
  const N = 8;
  A.fx('ids', {
    title: 'The ID semantics of one thread',
    expr: 'DispatchThreadID = ({gx}, {gy}) · 8 + ({lx}, {ly}),   GroupIndex = {ly} · 8 + {lx}',
    vars: { gx: { sym: 'GroupID.x', name: 'group column', min: 0, max: 3, value: 2, step: 1 }, gy: { sym: 'GroupID.y', name: 'group row', min: 0, max: 2, value: 1, step: 1 },
            lx: { sym: 'GroupThreadID.x', name: 'thread column inside the group', min: 0, max: 7, value: 5, step: 1 }, ly: { sym: 'GroupThreadID.y', name: 'thread row inside the group', min: 0, max: 7, value: 3, step: 1 } },
    out: [{ sym: 'DispatchThreadID.x', f: v => v.gx * N + v.lx, color: 'accent' }, { sym: 'DispatchThreadID.y', f: v => v.gy * N + v.ly, color: 'ray' }, { sym: 'GroupIndex', f: v => v.ly * N + v.lx, color: 'good' }],
    sub: v => `DispatchThreadID = (<b>${v.gx * N + v.lx}</b>, <b>${v.gy * N + v.ly}</b>) · GroupIndex = <b>${v.ly * N + v.lx}</b>`,
    draw(ctx, W, H, v, X) {
      const c = Math.min((W - 40) / (4 * N), (H - 40) / (3 * N)), x0 = (W - c * 4 * N) / 2, y0 = 10;
      for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 4; gx++) { ctx.fillStyle = (gx === v.gx && gy === v.gy) ? alpha(col('ray'), 0.35) : alpha(col('muted'), 0.12); ctx.fillRect(x0 + gx * N * c + 1, y0 + gy * N * c + 1, N * c - 2, N * c - 2); }
      ctx.strokeStyle = alpha(col('muted'), 0.25); ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i <= 4 * N; i++) { ctx.moveTo(x0 + i * c, y0); ctx.lineTo(x0 + i * c, y0 + 3 * N * c); } for (let j = 0; j <= 3 * N; j++) { ctx.moveTo(x0, y0 + j * c); ctx.lineTo(x0 + 4 * N * c, y0 + j * c); } ctx.stroke();
      ctx.fillStyle = col('accent'); ctx.fillRect(x0 + (v.gx * N + v.lx) * c, y0 + (v.gy * N + v.ly) * c, c, c);
      X.label(ctx, '4 × 3 groups of 8 × 8 threads', x0, H - 8, col('muted'));
    },
    plot: false, size: [880, 300]
  });

  /* ---------- waves ---------- */
  const wv = v => cl(v.n / v.w);
  A.fx('waves', {
    title: 'Idle lanes from the group size',
    expr: 'waves = ⌈{n} / {w}⌉,   idle lanes = waves · {w} − {n}',
    vars: { n: { sym: 'threads', name: 'threads per group', min: 1, max: 256, value: 48, step: 1 }, w: { sym: 'wave', name: 'wave width of the GPU', values: [32, 64], index: 1 } },
    out: [{ sym: 'waves', f: wv, color: 'accent' }, { sym: 'lanes used', f: v => 100 * v.n / (wv(v) * v.w), color: 'good', fmt: x => num(x) + ' %' }],
    draw(ctx, W, H, v, X) {
      const waves = wv(v), lanes = waves * v.w, cols = 32, c = Math.min((W - 30) / cols, (H - 40) / cl(lanes / cols)), x0 = 15, y0 = 10;
      for (let i = 0; i < lanes; i++) { const x = i % cols, y = Math.floor(i / cols); ctx.fillStyle = i < v.n ? alpha(col('accent'), 0.85) : alpha(col('bad'), 0.3); ctx.fillRect(x0 + x * c + 1, y0 + y * c + 1, c - 2, c - 2); }
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; for (let k = 0; k < waves; k++) { const r0 = k * v.w / cols; ctx.strokeRect(x0, y0 + r0 * c, cols * c, (v.w / cols) * c); }
      X.label(ctx, `${waves} wave${waves > 1 ? 's' : ''} of ${v.w} lanes · red: idle`, x0, H - 8, col('muted'));
    },
    plot: { x: 'n', y: [0, 110] }
  });

  /* ---------- shared memory tile ---------- */
  A.fx('tile', {
    title: 'Texture reads per output pixel',
    expr: 'direct = 2 · {r} + 1,   shared = ({g} + 2 · {r}) / {g}',
    vars: { r: { name: 'blur radius in pixels', min: 1, max: 32, value: 8, step: 1 }, g: { sym: 'g', name: 'threads per group (one row)', values: [16, 32, 64, 128, 256], index: 2 } },
    out: [{ sym: 'direct', f: v => 2 * v.r + 1, color: 'bad' }, { sym: 'via shared memory', f: v => (v.g + 2 * v.r) / v.g, color: 'good' }],
    sub: v => `<b>${num((2 * v.r + 1) / ((v.g + 2 * v.r) / v.g))}×</b> fewer texture reads; the reads from shared memory are almost free`,
    draw(ctx, W, H, v, X) {
      const tot = v.g + 2 * v.r, c = (W - 30) / tot, y = H / 2 - 14, x0 = 15;
      for (let i = 0; i < tot; i++) { const ap = i < v.r || i >= v.r + v.g; ctx.fillStyle = ap ? alpha(col('accent'), 0.45) : alpha(col('ray'), 0.6); ctx.fillRect(x0 + i * c, y, Math.max(c - 1, 0.6), 28); }
      X.label(ctx, 'blue: one texel per thread · orange: apron of r texels per side', x0, y - 12, col('muted'));
      const k = v.r + Math.floor(v.g / 2); ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.strokeRect(x0 + (k - v.r) * c, y + 36, (2 * v.r + 1) * c, 10);
      X.label(ctx, 'what one thread reads (from shared memory)', x0 + (k - v.r) * c, y + 62, col('ink'));
    },
    plot: { x: 'r', y: [0, 70] }
  });

  /* ---------- atomics ---------- */
  A.fx('atomics', {
    title: 'Contention on a histogram',
    expr: 'per bin = {n} / {b},   with shared memory: global atomics = ⌈{n} / 256⌉ · {b}',
    vars: { n: { sym: 'pixels', name: 'threads adding a value', min: 10000, max: 8300000, value: 2073600, log: true }, b: { sym: 'bins', name: 'histogram bins', min: 1, max: 256, value: 64, step: 1 } },
    out: [{ sym: 'atomics on one bin', f: v => v.n / v.b, color: 'bad' }, { sym: 'global atomics with shared memory', f: v => cl(v.n / 256) * v.b, color: 'good' }],
    sub: v => `each bin is hit about <b>${num(v.n / v.b)}</b> times, one after another; grouping first leaves <b>${num(cl(v.n / 256))}</b> hits per bin (one per group of 256)`,
    plot: { x: 'b', logY: true, y: [100, 1e7] }
  });

  /* ---------- readback ---------- */
  A.fx('readback', {
    title: 'What a readback costs',
    expr: 'copy = {mb} MB / {bw} GB/s,   wait ≈ {f} frames at {fps} fps',
    vars: { mb: { sym: 'size', name: 'data to read back', unit: 'MB', min: 0.001, max: 256, value: 4, log: true }, bw: { sym: 'bandwidth', name: 'transfer bandwidth (PCIe, realistic)', unit: 'GB/s', min: 2, max: 32, value: 12, step: 1 },
            f: { sym: 'frames', name: 'frames until the GPU has run it', min: 1, max: 4, value: 2, step: 1 }, fps: { name: 'frame rate', values: [30, 60, 120], index: 1 } },
    out: [{ sym: 'copy', unit: 'ms', f: v => v.mb / 1024 / v.bw * 1000, color: 'accent' }, { sym: 'latency', unit: 'ms', f: v => v.f * 1000 / v.fps + v.mb / 1024 / v.bw * 1000, color: 'bad' }],
    sub: v => `the copy takes <b>${num(v.mb / 1024 / v.bw * 1000)} ms</b>, but the data arrives about <b>${num(v.f * 1000 / v.fps + v.mb / 1024 / v.bw * 1000)} ms</b> after the dispatch; a blocking read (GetData) would stall the frame that long`,
    plot: { x: 'mb', logY: true, y: [0.001, 100] }
  });
})();
