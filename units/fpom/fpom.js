/* Fast Parallax Occlusion Mapping — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num, clamp } = A;
  const rad = d => d * Math.PI / 180, lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- adaptive step count ---------- */
  A.fx('adapt', {
    title: 'Steps by view angle',
    expr: 'steps = lerp({mx}, {mn}, cos {th})',
    vars: { th: { sym: 'θ', name: 'view angle from the surface normal', unit: '°', min: 0, max: 89, value: 30, step: 1 },
            mn: { sym: 'min', name: 'steps when looking straight on', min: 2, max: 16, value: 4, step: 1 },
            mx: { sym: 'max', name: 'steps at grazing angles', min: 8, max: 64, value: 24, step: 1 } },
    out: [{ sym: 'adaptive', f: v => Math.round(lerp(v.mx, v.mn, Math.cos(rad(v.th)))), color: 'accent' }, { sym: 'fixed', f: v => v.mx, color: 'muted', dash: [5, 4] }],
    sub: (v, n) => { const a = Math.round(lerp(v.mx, v.mn, Math.cos(rad(v.th)))); return `${a} fetches instead of ${v.mx}. Most of a floor is seen at moderate angles, so the average saving is large.`; },
    plot: { x: 'th', y: [0, 66] }
  });

  /* ---------- start at the highest point ---------- */
  const prof = x => 0.38 + 0.18 * Math.sin(x * 13) * Math.cos(x * 5) + 0.06 * Math.sin(x * 41);
  A.fx('start', {
    title: 'Start at the highest point the map contains',
    expr: 'layers needed = {N} · {Hm}   (same spacing, start at depth 1 − {Hm})',
    vars: { N: { sym: 'N', name: 'layers over the full 0–1 range', min: 8, max: 64, value: 32, step: 1 },
            Hm: { sym: 'H<sub>max</sub>', name: 'highest value in the height map', min: 0.2, max: 1, value: 0.62, step: 0.01 } },
    out: { sym: 'layers', f: v => Math.ceil(v.N * v.Hm) },
    sub: (v, n) => `the top ${n((1 - v.Hm) * 100)} % of the range is empty: <b>${Math.ceil(v.N * v.Hm)}</b> layers give the same precision as ${v.N}`,
    draw(ctx, W, H, v, X) {
      const top = 20, bot = H - 20, Y = h => bot - h * (bot - top);
      for (let i = 0; i <= v.N; i++) { const h = 1 - i / v.N, y = Y(h); ctx.strokeStyle = h > v.Hm ? alpha(col('bad'), 0.35) : alpha(col('ray'), 0.45); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.fillStyle = alpha(col('muted'), 0.3); ctx.beginPath(); ctx.moveTo(0, bot); for (let x = 0; x <= W; x += 2) ctx.lineTo(x, Y(prof(x / W) * v.Hm / 0.62)); ctx.lineTo(W, bot); ctx.fill();
      ctx.setLineDash([5, 4]); ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, Y(v.Hm)); ctx.lineTo(W, Y(v.Hm)); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, 'H max: march from here', 8, Y(v.Hm) - 10, col('accent')); X.label(ctx, 'red layers: wasted', W - 120, top + 10, col('bad'));
    },
    plot: { x: 'Hm', y: [0, 66] }, size: [440, 240]
  });

  /* ---------- coarse steps plus secant ---------- */
  const hmap = x => 0.45 + 0.22 * Math.sin(x * 9.0) + 0.1 * Math.sin(x * 23 + 1.0);
  function rayH(l) { return 1 - l; }
  function search(v) {
    const slope = Math.tan(rad(v.th)) * 0.15, x0 = 0.12, xAt = l => x0 + slope * l, f = l => rayH(l) - hmap(xAt(l));
    let a = 0, b = 1, fa = f(0), fb = f(1), n = 0; const dl = 1 / v.N, pts = [];
    for (let i = 1; i <= v.N; i++) { const l = i * dl, d = f(l); n++; pts.push(l); if (d <= 0) { b = l; fb = d; break; } a = l; fa = d; }
    for (let k = 0; k < v.k; k++) { const m = a + (b - a) * fa / (fa - fb), fm = f(m); n++; if (fm > 0) { a = m; fa = fm; } else { b = m; fb = fm; } }
    const est = a + (b - a) * fa / (fa - fb);
    let lo = 0, hi = 1; for (let i = 0; i < 2000; i++) { const l = i / 2000; if (f(l) <= 0) { hi = l; lo = Math.max(0, l - 1 / 2000); break; } } for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
    return { est, exact: (lo + hi) / 2, n, pts, xAt, slope };
  }
  A.fx('coarse', {
    title: 'Few coarse steps, then secant refinement',
    expr: '{N} linear steps until the ray is below the map, then {k} secant steps,   view {th} from the normal',
    vars: { N: { sym: 'N', name: 'linear steps', min: 4, max: 48, value: 8, step: 1 },
            k: { sym: 'k', name: 'secant refinements', min: 0, max: 3, value: 2, step: 1 },
            th: { sym: 'θ', name: 'view angle from the normal', unit: '°', min: 10, max: 80, value: 60, step: 1 } },
    out: [{ sym: 'error (texels of 1024)', f: v => { const r = search(v); return Math.abs(r.xAt(r.est) - r.xAt(r.exact)) * 1024; }, color: 'bad' }, { sym: 'fetches', f: v => search(v).n, color: 'accent' }],
    sub: (v, n) => { const r = search(v); return `<b>${r.n}</b> fetches, hit off by <b>${n(Math.abs(r.xAt(r.est) - r.xAt(r.exact)) * 1024)}</b> texels on a 1024 map`; },
    draw(ctx, W, H, v, X) {
      const r = search(v), x1 = r.xAt(1), sx = (W - 20) / Math.max(x1 - 0.1, 0.3), X0 = 10 - 0.1 * sx, top = 16, bot = H - 16, Y = h => bot - h * (bot - top), PX = x => X0 + x * sx;
      ctx.fillStyle = alpha(col('muted'), 0.3); ctx.beginPath(); ctx.moveTo(0, bot); for (let px = 0; px <= W; px += 2) { const x = (px - X0) / sx; ctx.lineTo(px, Y(hmap(x))); } ctx.lineTo(W, bot); ctx.fill();
      ctx.strokeStyle = alpha(col('ray'), 0.6); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PX(r.xAt(0)), Y(1)); ctx.lineTo(PX(r.xAt(1)), Y(0)); ctx.stroke();
      r.pts.forEach(l => X.dot(ctx, PX(r.xAt(l)), Y(rayH(l)), col('ray'), 3));
      X.dot(ctx, PX(r.xAt(r.exact)), Y(rayH(r.exact)), col('good'), 5); X.dot(ctx, PX(r.xAt(r.est)), Y(rayH(r.est)), col('accent'), 3.5);
      X.label(ctx, 'green: true hit, orange: estimate', 10, 12, col('muted'));
    },
    plot: { x: 'N', logY: true, y: [0.001, 300] }, size: [440, 240]
  });

  /* ---------- fetches versus arithmetic ---------- */
  A.fx('alu', {
    title: 'A fetch in the loop versus arithmetic in the loop',
    expr: 'cost ≈ {s} · ({f} + {a}),   analytic: {s} · {a}',
    vars: { s: { sym: 'steps', name: 'steps per pixel', min: 1, max: 32, value: 12, step: 1 },
            f: { sym: 'fetch', name: 'cost of a dependent texture fetch, in ALU instructions', min: 4, max: 60, value: 20, step: 1 },
            a: { sym: 'alu', name: 'instructions per step for the height test (or the analytic height)', min: 2, max: 40, value: 8, step: 1 } },
    out: [{ sym: 'texture height', f: v => v.s * (v.f + v.a), color: 'bad' }, { sym: 'analytic height', f: v => v.s * v.a, color: 'good' }],
    note: 'Rough model: a fetch whose UV depends on the previous step cannot be issued early, so its latency is paid every step. Real numbers depend on the GPU, the cache hit rate and how many waves hide the latency.',
    plot: { x: 's' }
  });

  /* ---------- derivatives and mips ---------- */
  A.fx('mip', {
    title: 'Mip level from derivatives, and what a jump does to it',
    expr: 'mip = log2(max(|∂uv/∂x|, |∂uv/∂y|) · {size}),   ∂uv/∂x = {g} + {j}',
    vars: { size: { sym: 'size', name: 'texture size', values: [512, 1024, 2048, 4096], labels: ['512', '1024', '2048', '4096'], index: 2 },
            g: { sym: 'g', name: 'smooth UV change per pixel', min: 0.0001, max: 0.004, value: 0.0005, log: true },
            j: { sym: 'jump', name: 'extra UV jump between neighbours in different loop iterations', min: 0, max: 0.2, value: 0, step: 0.005 } },
    out: [{ sym: 'mip with jump', f: v => Math.max(0, Math.log2((v.g + v.j) * v.size)), color: 'bad' }, { sym: 'mip from gradients taken outside', f: v => Math.max(0, Math.log2(v.g * v.size)), color: 'good' }],
    sub: (v, n) => v.j > 0 ? `the neighbour stopped at a different step, so the UVs differ by ${n(v.j)}: the GPU picks mip <b>${n(Math.max(0, Math.log2((v.g + v.j) * v.size)))}</b> instead of ${n(Math.max(0, Math.log2(v.g * v.size)))}, a blurry square along every step edge` : 'smooth derivatives: the right mip',
    plot: { x: 'j', y: [0, 13] }
  });

  /* ---------- distance fade ---------- */
  A.fx('fade', {
    title: 'Fewer steps with distance, none beyond the fade',
    expr: 'steps(d) = {N} · (1 − saturate((d − {d0}) / ({d1} − {d0}))),   pixels ∝ 1 / d²',
    vars: { d: { sym: 'd', name: 'distance to the camera', unit: 'm', min: 1, max: 40, value: 8, step: 0.5 },
            N: { sym: 'N', name: 'steps close up', min: 4, max: 32, value: 16, step: 1 },
            d0: { sym: 'd₀', name: 'fade start', unit: 'm', min: 1, max: 20, value: 5, step: 0.5 },
            d1: { sym: 'd₁', name: 'fade end', unit: 'm', min: 5, max: 40, value: 15, step: 0.5 } },
    out: [{ sym: 'steps', f: v => Math.round(v.N * (1 - clamp((v.d - v.d0) / Math.max(v.d1 - v.d0, 0.01), 0, 1))), color: 'accent' }],
    sub: (v, n) => { const s = Math.round(v.N * (1 - clamp((v.d - v.d0) / Math.max(v.d1 - v.d0, 0.01), 0, 1))); return s ? `${s} steps at ${n(v.d)} m; a distant surface also covers fewer pixels, so the total cost drops fast` : `no march at ${n(v.d)} m: the flat surface with its normal map is indistinguishable there`; },
    plot: { x: 'd', y: [0, 33] }
  });
})();
