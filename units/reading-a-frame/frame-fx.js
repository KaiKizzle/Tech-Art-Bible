/* Reading a Frame — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180;

  A.fx('ms', {
    title: 'Frame time, frame rate and the cost of a feature',
    expr: 'ms = 1000 / {fps},   new fps = 1000 / (ms + {c})',
    vars: { fps: { name: 'frame rate now', unit: 'fps', min: 20, max: 144, value: 60, step: 1 }, c: { name: 'cost of a new feature', unit: 'ms', min: 0, max: 10, value: 2, step: 0.1 } },
    out: [{ sym: 'ms', f: v => 1000 / v.fps, color: 'ax-y' }, { sym: 'new fps', f: v => 1000 / (1000 / v.fps + v.c), color: 'accent' }],
    sub: v => `ms = 1000 / ${v.fps} = ${num(1000 / v.fps)},   new fps = 1000 / (${num(1000 / v.fps)} + ${num(v.c)}) = <b>${num(1000 / (1000 / v.fps + v.c))}</b>, a drop of ${num(v.fps - 1000 / (1000 / v.fps + v.c))} fps`,
    plot: { x: 'fps', y: [0, 150] },
    note: 'The same 2 ms costs 7 fps at 60 but 28 fps at 144. That is why budgets are written in ms.'
  });

  const pipe = v => { const m = Math.max(v.g, v.r, v.gpu), frame = v.vs ? Math.ceil(m / (1000 / v.vs) - 1e-9) * 1000 / v.vs : m; return { m, frame, lat: v.g + v.r + v.gpu }; };
  A.fx('pipe', {
    title: 'The slowest stage sets the pace',
    expr: 'frame = max({g}, {r}, {gpu}),   latency ≈ {g} + {r} + {gpu}',
    vars: { g: { sym: 'game', name: 'game thread', unit: 'ms', min: 2, max: 40, value: 9, step: 0.5 }, r: { sym: 'render', name: 'render thread', unit: 'ms', min: 2, max: 40, value: 7, step: 0.5 },
            gpu: { sym: 'GPU', name: 'GPU', unit: 'ms', min: 2, max: 40, value: 14, step: 0.5 }, vs: { sym: 'vsync', name: 'vsync', values: [0, 60, 120], labels: ['off', '60 Hz', '120 Hz'] } },
    out: [{ sym: 'frame', unit: 'ms', f: v => pipe(v).frame, color: 'accent' }, { sym: 'fps', f: v => 1000 / pipe(v).frame, color: 'ax-y' }],
    sub: v => { const p = pipe(v); return `max = ${num(p.m)} ms${v.vs ? ` → rounded up to whole ${num(1000 / v.vs)} ms refreshes = ${num(p.frame)} ms` : ''} → <b>${num(1000 / p.frame)} fps</b>, latency about ${num(p.lat)} ms`; },
    draw(ctx, W, H, v, X) {
      const s = (W - 90) / 60, rows = [['game', v.g, 'ax-x'], ['render', v.r, 'ax-y'], ['GPU', v.gpu, 'ax-z']], p = pipe(v);
      rows.forEach(([n, t, c], i) => X.label(ctx, n, 60, 30 + i * 50 + 20, col(c), 'right', true));
      // pipelined: stage i of frame f starts at f·frame + offset i
      for (let f = 0; f < 4; f++) rows.forEach(([n, t, c], i) => { const x0 = 70 + (f + i) * p.frame * s * 0.999, y = 30 + i * 50; if (x0 > W) return; ctx.fillStyle = alpha(col(c), 0.75); ctx.fillRect(x0, y, Math.min(t * s, W - x0), 30); ctx.fillStyle = '#111'; if (t * s > 18 && x0 + 14 < W) X.label(ctx, 'F' + (f + 1), x0 + 4, y + 20, '#111'); });
      if (v.vs) { for (let k = 0; k * 1000 / v.vs < 60; k++) { const x = 70 + k * 1000 / v.vs * s; ctx.strokeStyle = alpha(col('muted'), 0.5); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, 190); ctx.stroke(); ctx.setLineDash([]); } }
      X.label(ctx, 'frame F1 moves down a stage each step; time runs to the right (0–60 ms)', 10, H - 14, col('muted'));
    },
    plot: { x: 'gpu', y: [0, 70] },
    note: 'With vsync at 60 Hz, push the GPU from 16 to 17 ms: the frame rate halves.'
  });

  A.fx('res', {
    title: 'The resolution test',
    expr: 'GPU = {vtx} + {pix} · {sc}²,   frame = max({cpu}, GPU)',
    vars: { sc: { sym: 'scale', name: 'resolution scale (per axis)', min: 0.25, max: 1, value: 1, step: 0.01 },
            pix: { sym: 'pixel', name: 'per-pixel GPU work at full resolution', unit: 'ms', min: 0, max: 20, value: 10, step: 0.1 },
            vtx: { sym: 'other', name: 'GPU work that does not depend on resolution', unit: 'ms', min: 0, max: 10, value: 3, step: 0.1 },
            cpu: { sym: 'CPU', name: 'slowest CPU thread', unit: 'ms', min: 2, max: 20, value: 8, step: 0.1 } },
    out: [{ sym: 'GPU', unit: 'ms', f: v => v.vtx + v.pix * v.sc * v.sc, color: 'ax-z' }, { sym: 'frame', unit: 'ms', f: v => Math.max(v.cpu, v.vtx + v.pix * v.sc * v.sc), color: 'accent' }],
    sub: v => { const g = v.vtx + v.pix * v.sc * v.sc; return `GPU = ${num(v.vtx)} + ${num(v.pix)} · ${num(v.sc * v.sc)} = ${num(g)} ms,   frame = <b>${num(Math.max(v.cpu, g))} ms</b> → ${g > v.cpu ? 'GPU-bound' : 'CPU-bound: lowering resolution no longer helps'}`; },
    plot: { x: 'sc', y: [0, 25] },
    note: 'Animate the scale. Where the frame line goes flat, the CPU has become the limit.'
  });

  const dcost = v => { const draws = v.inst ? Math.min(v.n, v.m * 4) : v.n, changes = v.sort ? v.m : Math.round(v.n * (1 - 1 / v.m)) + 1; return { draws, changes, us: draws * 2 + changes * 6 }; };
  A.fx('drawcost', {
    title: 'A simple CPU cost model for draws',
    expr: 'CPU ≈ draws · 2 µs + state changes · 6 µs,   {n} objects, {m} materials',
    vars: { n: { name: 'objects', min: 50, max: 5000, value: 1500, step: 50 }, m: { name: 'materials', min: 1, max: 200, value: 30, step: 1 },
            sort: { name: 'sorted by material', values: [0, 1], labels: ['no', 'yes'] }, inst: { name: 'instancing (4 meshes per material)', values: [0, 1], labels: ['no', 'yes'] } },
    out: { sym: 'CPU', unit: 'ms', f: v => dcost(v).us / 1000 },
    sub: v => { const q = dcost(v); return `${num(q.draws)} draws · 2 + ${num(q.changes)} changes · 6 = ${num(q.us)} µs = <b>${num(q.us / 1000)} ms</b>`; },
    plot: { x: 'n', y: [0, 40] },
    note: 'Unsorted, almost every draw changes material. Illustrative costs; the ratios are what matter.'
  });

  A.fx('od', {
    title: 'Counting pixel shader runs',
    expr: 'runs = {w} · {h} · {cov} · {layers}',
    vars: { w: { sym: 'W', name: 'width', values: [1280, 1920, 2560, 3840], index: 1 }, h: { sym: 'H', name: 'height', values: [720, 1080, 1440, 2160], index: 1 },
            cov: { name: 'screen fraction covered by the effect', min: 0.05, max: 1, value: 0.5, step: 0.01 }, layers: { name: 'transparent layers on top of each other', min: 1, max: 30, value: 8, step: 1 } },
    out: { sym: 'runs', f: v => v.w * v.h * v.cov * v.layers },
    sub: v => `${v.w} · ${v.h} · ${num(v.cov)} · ${v.layers} = <b>${num(v.w * v.h * v.cov * v.layers)}</b> pixel shader runs (the screen has ${num(v.w * v.h)} pixels)`,
    draw(ctx, W, H, v, X) {
      const x0 = 30, y0 = 30, w = W - 60, h = (W - 60) * 9 / 16 * 0.8;
      ctx.strokeStyle = col('line'); ctx.strokeRect(x0, y0, w, h);
      const cw = w * Math.sqrt(v.cov), ch = h * Math.sqrt(v.cov);
      for (let i = 0; i < v.layers; i++) { ctx.fillStyle = `rgba(255,170,60,${0.9 / v.layers + 0.04})`; ctx.fillRect(x0 + (w - cw) / 2 + i * 1.5, y0 + (h - ch) / 2 + i * 1.5, cw, ch); }
      X.label(ctx, `${v.layers} layers over ${Math.round(v.cov * 100)}% of the screen`, x0, y0 + h + 22, col('muted'));
      X.label(ctx, `= ${num(v.cov * v.layers)} shader runs per screen pixel on average`, x0, y0 + h + 42, col('accent'), 'left', true);
    },
    plot: { x: 'layers' },
    note: 'Opaque layers behind a depth prepass cost almost nothing; transparent layers each pay in full.'
  });

  /* rasterize a right isosceles triangle with legs L at a sub-pixel offset; count covered pixels and touched quads */
  function rast(L, ox, oy) {
    const cov = new Set(), quads = new Set();
    const n = Math.ceil(L) + 3;
    for (let y = -1; y < n; y++) for (let x = -1; x < n; x++) { const px = x + 0.5 - ox, py = y + 0.5 - oy; if (px >= 0 && py >= 0 && px + py <= L) { cov.add(x + ',' + y); quads.add((x >> 1) + ',' + (y >> 1)); } }
    return { cov, quads, c: cov.size, q: quads.size };
  }
  A.fx('quadeff', {
    title: 'Useful lanes for one triangle',
    expr: 'efficiency = covered pixels / (4 · quads touched),   legs {L} px',
    vars: { L: { name: 'triangle size (leg length in pixels)', min: 0.8, max: 24, value: 6, step: 0.1, log: true }, o: { name: 'position inside the pixel grid', min: 0, max: 1, value: 0.3, step: 0.01 } },
    out: { sym: 'efficiency', f: v => { const r = rast(v.L, v.o, v.o * 0.6 + 0.2); return r.q ? r.c / (4 * r.q) : 0; } },
    sub: v => { const r = rast(v.L, v.o, v.o * 0.6 + 0.2); return `${r.c} covered / (4 · ${r.q}) = <b>${r.q ? Math.round(r.c / (4 * r.q) * 100) : 0}%</b> useful, ${4 * r.q - r.c} helper lanes`; },
    draw(ctx, W, H, v, X) {
      const r = rast(v.L, v.o, v.o * 0.6 + 0.2), n = Math.max(8, Math.ceil(v.L) + 4), s = Math.min((W - 40) / n, (H - 50) / n), x0 = 20, y0 = 14;
      const P = (x, y) => [x0 + x * s, y0 + y * s];
      r.quads.forEach(k => { const [qx, qy] = k.split(',').map(Number); ctx.fillStyle = alpha(col('bad'), 0.18); ctx.fillRect(...P(qx * 2 + 1, qy * 2 + 1), 2 * s, 2 * s); });
      r.cov.forEach(k => { const [x, y] = k.split(',').map(Number); ctx.fillStyle = alpha(col('accent'), 0.75); ctx.fillRect(...P(x + 1, y + 1), s, s); });
      ctx.strokeStyle = alpha(col('muted'), 0.35); ctx.lineWidth = 1;
      for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(...P(i, 0)); ctx.lineTo(...P(i, n)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(...P(0, i)); ctx.lineTo(...P(n, i)); ctx.stroke(); }
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 2; for (let i = 1; i <= n; i += 2) { ctx.beginPath(); ctx.moveTo(...P(i, 1)); ctx.lineTo(...P(i, n)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(...P(1, i)); ctx.lineTo(...P(n, i)); ctx.stroke(); }
      const a = P(1 + v.o, 1 + v.o * 0.6 + 0.2); ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(a[0] + v.L * s, a[1]); ctx.lineTo(a[0], a[1] + v.L * s); ctx.closePath(); ctx.stroke();
      X.label(ctx, 'orange: covered · red: helper lanes in touched quads', 20, H - 10, col('muted'));
    },
    plot: { x: 'L', y: [0, 1] },
    note: 'The pixel centre decides coverage, so tiny triangles can cover 0 or 1 pixel and still cost a whole quad.'
  });

  A.fx('diverge', {
    title: 'Expected cost of a branch per wave',
    expr: 'cost = {a} · (1 − (1 − {p})<sup>{n}</sup>) + {b} · (1 − {p}<sup>{n}</sup>)',
    vars: { p: { name: 'fraction of pixels taking the expensive side', min: 0, max: 1, value: 0.2, step: 0.01 },
            a: { name: 'cost of the expensive side', min: 1, max: 200, value: 100, step: 1 }, b: { name: 'cost of the cheap side', min: 1, max: 200, value: 10, step: 1 },
            n: { name: 'lanes per wave', values: [32, 64], index: 0 } },
    out: [{ sym: 'random', name: 'pixels scattered randomly (noise)', f: v => v.a * (1 - Math.pow(1 - v.p, v.n)) + v.b * (1 - Math.pow(v.p, v.n)), color: 'bad' },
          { sym: 'coherent', name: 'pixels grouped in screen regions', f: v => v.p * v.a + (1 - v.p) * v.b, color: 'good' }],
    steps: v => [['P(no lane takes the expensive side)', num(Math.pow(1 - v.p, v.n))], ['P(every lane takes it)', num(Math.pow(v.p, v.n))]],
    plot: { x: 'p', y: [0, 220] },
    note: 'With noise, even 5% expensive pixels make almost every wave pay a + b. Grouped regions pay the plain average.'
  });

  A.fx('screensize', {
    title: 'Screen size and pixels per triangle',
    expr: 's = {r} / ({d} · tan({fov} / 2)),   px = π · (s · {H} / 2)²,   px per triangle = px / ({tris} · 0.5)',
    vars: { r: { name: 'bounding radius', unit: 'm', min: 0.1, max: 10, value: 1, log: true }, d: { name: 'distance', unit: 'm', min: 1, max: 300, value: 20, log: true },
            fov: { name: 'vertical field of view', unit: '°', min: 30, max: 100, value: 60, step: 1 }, H: { name: 'screen height', values: [720, 1080, 1440, 2160], index: 1 },
            tris: { name: 'triangles in the mesh', min: 100, max: 200000, value: 20000, log: true } },
    out: [{ sym: 's', name: 'screen size', f: v => v.r / (v.d * Math.tan(v.fov / 2 * DEG)), color: 'ax-y' },
          { sym: 'px/tri', f: v => { const s = v.r / (v.d * Math.tan(v.fov / 2 * DEG)); return Math.PI * Math.pow(s * v.H / 2, 2) / (v.tris * 0.5); }, color: 'accent' }],
    sub: v => { const s = v.r / (v.d * Math.tan(v.fov / 2 * DEG)), px = Math.PI * Math.pow(s * v.H / 2, 2), pt = px / (v.tris * 0.5); return `s = ${num(s)},   ${num(px)} pixels,   <b>${num(pt)} px per triangle</b> → ${pt >= 10 ? 'fine' : 'too dense: switch to a lower LOD'}`; },
    plot: { x: 'd', logY: true, y: [0.01, 10000] },
    note: 'About half the triangles face away, hence the 0.5. Aim for 10 px per triangle or more.'
  });
})();
