/* Shadow Maps — live formulas. Side views: x across, y up; the sun shines from the upper left. */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180;
  const BOX = [1.2, 2.2, 0, 1.6]; // occluder x0, x1, y0, y1

  /* distance of point p from the light plane along direction d (unit, pointing from light) */
  function lightDepth(p, a) { const d = [Math.sin(a), -Math.cos(a)]; return p[0] * d[0] + p[1] * d[1]; }
  /* first hit along the light ray through point p: ground y=0 or the box */
  function firstHit(p, a) {
    const d = [Math.sin(a), -Math.cos(a)], o = [p[0] - d[0] * 20, p[1] - d[1] * 20];
    let tmin = Infinity;
    const tg = -o[1] / d[1]; if (tg > 0) tmin = tg;
    const t1x = (BOX[0] - o[0]) / d[0], t2x = (BOX[1] - o[0]) / d[0], t1y = (BOX[2] - o[1]) / d[1], t2y = (BOX[3] - o[1]) / d[1];
    const tn = Math.max(Math.min(t1x, t2x), Math.min(t1y, t2y)), tf = Math.min(Math.max(t1x, t2x), Math.max(t1y, t2y)); if (tn <= tf && tn > 0) tmin = Math.min(tmin, tn);
    return [o[0] + d[0] * tmin, o[1] + d[1] * tmin];
  }
  function sideScene(ctx, W, H, v, X) {
    const s = 52, ox = 40, oy = H - 50, P = (x, y) => [ox + x * s, oy - y * s];
    ctx.fillStyle = alpha(col('muted'), 0.2); ctx.fillRect(0, oy, W, H - oy); ctx.strokeStyle = col('muted'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.stroke();
    ctx.fillStyle = alpha(col('ink'), 0.75); const b0 = P(BOX[0], BOX[3]), b1 = P(BOX[1], BOX[2]); ctx.fillRect(b0[0], b0[1], b1[0] - b0[0], b1[1] - b0[1]);
    // shadow region on the ground
    const a = v.sun * DEG, sh0 = BOX[0] + Math.tan(a) * 0 , d = [Math.sin(a), -Math.cos(a)];
    const xs = [BOX[0] - BOX[3] * d[0] / d[1] * -1, BOX[1] - BOX[3] * d[0] / d[1] * -1];
    const g0 = Math.min(BOX[0], BOX[1] + BOX[3] * Math.tan(a)), g1 = Math.max(BOX[1], BOX[0] + BOX[3] * Math.tan(a));
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; const q0 = P(BOX[1], 0), q1 = P(BOX[1] + BOX[3] * Math.tan(a), 0); ctx.fillRect(q0[0], oy, q1[0] - q0[0], 8);
    return { P, s, ox, oy };
  }

  A.fx('shadowtest', {
    title: 'The shadow comparison',
    expr: 'shadowed if d<sub>point</sub> > d<sub>map</sub>,   sun at {sun},   point at x = {x}',
    vars: { x: { name: 'point on the ground', unit: 'm', min: 0, max: 7, value: 3.4, step: 0.01 }, sun: { name: 'sun angle from straight down', unit: '°', min: 0, max: 70, value: 40, step: 1 } },
    out: [{ sym: 'd<sub>point</sub>', f: v => lightDepth([v.x, 0], v.sun * DEG) + 20, color: 'accent' }, { sym: 'd<sub>map</sub>', f: v => lightDepth(firstHit([v.x, 0], v.sun * DEG), v.sun * DEG) + 20, color: 'ray' }],
    sub: v => { const a = v.sun * DEG, dp = lightDepth([v.x, 0], a), dm = lightDepth(firstHit([v.x, 0], a), a); return `point ${num(dp + 20)} m from the light, the light saw ${num(dm + 20)} m first → <b>${dp > dm + 1e-6 ? 'shadowed' : 'lit'}</b>`; },
    draw(ctx, W, H, v, X) {
      const g = sideScene(ctx, W, H, v, X), a = v.sun * DEG, d = [Math.sin(a), -Math.cos(a)], hit = firstHit([v.x, 0], a), p = [v.x, 0];
      const src = [v.x - d[0] * 6, -d[1] * 6]; ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...g.P(...src)); ctx.lineTo(...g.P(...hit)); ctx.stroke();
      if (Math.hypot(hit[0] - p[0], hit[1] - p[1]) > 1e-3) { ctx.setLineDash([4, 4]); ctx.strokeStyle = alpha(col('accent'), 0.5); ctx.beginPath(); ctx.moveTo(...g.P(...hit)); ctx.lineTo(...g.P(...p)); ctx.stroke(); ctx.setLineDash([]); X.dot(ctx, ...g.P(...hit), col('ray'), 6); X.label(ctx, 'what the light saw first', g.P(...hit)[0] + 8, g.P(...hit)[1] - 10, col('ray')); }
      X.dot(ctx, ...g.P(...p), col('ink'), 6); X.label(ctx, '☀', g.P(...src)[0], g.P(...src)[1] - 10, col('accent'), 'center', true);
    },
    plot: { x: 'x', y: [17, 26] }
  });

  A.fx('lightuv', {
    title: 'A point in the sun\'s coordinates (orthographic)',
    expr: 'x<sub>L</sub> = x·cos {sun} + y·sin {sun},   z<sub>L</sub> = x·sin {sun} − y·cos {sun},   uv = x<sub>L</sub> / {ext} · 0.5 + 0.5',
    vars: { px: { sym: 'x', name: 'point x', unit: 'm', min: -5, max: 5, value: 2, step: 0.05 }, py: { sym: 'y', name: 'point y', unit: 'm', min: 0, max: 4, value: 1, step: 0.05 },
            sun: { name: 'sun angle from straight down', unit: '°', min: 0, max: 80, value: 35, step: 1 }, ext: { name: 'half size of the area the map covers', unit: 'm', min: 2, max: 50, value: 8, step: 0.5 } },
    out: [{ sym: 'uv', f: v => (v.px * Math.cos(v.sun * DEG) + v.py * Math.sin(v.sun * DEG)) / v.ext * 0.5 + 0.5, color: 'accent' }, { sym: 'z<sub>L</sub>', unit: 'm', f: v => v.px * Math.sin(v.sun * DEG) - v.py * Math.cos(v.sun * DEG), color: 'ray' }],
    draw(ctx, W, H, v, X) {
      const g = X.grid(ctx, W, H, { s: 20, cx: W / 2, cy: H - 40 }), a = v.sun * DEG, xa = [Math.cos(a), Math.sin(a)], za = [Math.sin(a), -Math.cos(a)];
      X.arrow(ctx, g.X(0), g.Y(0), g.X(xa[0] * 4), g.Y(xa[1] * 4), col('ax-x'), 2); X.label(ctx, 'x_L (map u)', g.X(xa[0] * 4) + 6, g.Y(xa[1] * 4), col('ax-x'));
      X.arrow(ctx, g.X(0), g.Y(0), g.X(za[0] * 4), g.Y(za[1] * 4), col('ax-z'), 2); X.label(ctx, 'z_L (depth)', g.X(za[0] * 4) + 6, g.Y(za[1] * 4) + 8, col('ax-z'));
      ctx.strokeStyle = alpha(col('accent'), 0.5); for (let k = -3; k <= 3; k++) { const b = [xa[0] * k * 3, xa[1] * k * 3]; ctx.beginPath(); ctx.moveTo(g.X(b[0] - za[0] * 8), g.Y(b[1] - za[1] * 8)); ctx.lineTo(g.X(b[0] + za[0] * 3), g.Y(b[1] + za[1] * 3)); ctx.stroke(); }
      X.dot(ctx, g.X(v.px), g.Y(v.py), col('ink'), 6);
      X.label(ctx, 'orange: parallel sun rays', 10, 16, col('accent'));
    },
    plot: { x: 'px', y: [-1, 2] }
  });

  /* acne: a tilted receiver, depth quantised per texel */
  function acne(v) {
    const n = 200, tex = v.t, slope = Math.tan(v.th * DEG); let bad = 0;
    for (let i = 0; i < n; i++) { const x = i / n * 4; const d = x * slope; const xc = (Math.floor(x / tex) + 0.5) * tex; const stored = xc * slope; if (d > stored + v.b + v.k * slope * tex) bad++; }
    return { frac: bad / n, gap: (v.b + v.k * slope * tex) / Math.max(slope, 0.05) };
  }
  A.fx('acne', {
    title: 'Acne on a tilted surface, and the bias that fixes it',
    expr: 'shadowed if d > d<sub>map</sub> + {b} + {k} · tan {th} · {t}',
    vars: { th: { sym: 'θ', name: 'surface angle to the light', unit: '°', min: 0, max: 80, value: 50, step: 1 }, t: { sym: 'texel', name: 'shadow texel size', unit: 'm', min: 0.05, max: 0.6, value: 0.3, step: 0.01 },
            b: { sym: 'bias', name: 'constant depth bias', unit: 'm', min: 0, max: 0.4, value: 0, step: 0.005 }, k: { sym: 'slope', name: 'slope-scaled bias factor', min: 0, max: 1.5, value: 0, step: 0.05 } },
    sub: v => { const q = acne(v); return `<b>${Math.round(q.frac * 100)}%</b> of the surface shadows itself; shadows detach by <b>${num(q.gap)} m</b>`; },
    out: [{ sym: 'acne', name: 'share of falsely shadowed pixels', f: v => acne(v).frac, color: 'bad' }, { sym: 'gap', name: 'how far shadows detach', unit: 'm', f: v => acne(v).gap, color: 'ray' }],
    draw(ctx, W, H, v, X) {
      const s = 90, ox = 30, oy = H - 40, slope = Math.tan(v.th * DEG), P = (x, d) => [ox + x * s, oy - d * s * 0.5];
      const tex = v.t; for (let x = 0; x < 4.3; x += tex) { const xc = x + tex / 2, st = xc * slope; ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...P(x, st + v.b + v.k * slope * tex)); ctx.lineTo(...P(x + tex, st + v.b + v.k * slope * tex)); ctx.stroke(); }
      for (let i = 0; i < 240; i++) { const x = i / 240 * 4.3, d = x * slope, xc = (Math.floor(x / tex) + 0.5) * tex, bad = d > xc * slope + v.b + v.k * slope * tex; ctx.fillStyle = bad ? col('bad') : col('good'); ctx.fillRect(P(x, d)[0], P(x, d)[1] - 2, 2, 4); }
      X.label(ctx, 'depth from the light → (vertical: compared depth)', 10, 16, col('muted'));
      X.label(ctx, 'blue: stored depth per texel (+ bias) · red: surface falsely in shadow', 10, H - 12, col('muted'));
    },
    plot: { x: 'b', y: [0, 1] }
  });

  const pxPerM = (H, d, fov) => H / (2 * d * Math.tan(fov / 2 * DEG));
  A.fx('stexel', {
    title: 'Shadow texels against screen pixels',
    expr: 'texel = 2 · {ext} / {res},   screen pixels per texel = texel · {Hs} / (2 · {d} · tan(30°))',
    vars: { ext: { name: 'half size of the shadowed area', unit: 'm', min: 5, max: 500, value: 50, log: true }, res: { name: 'shadow map resolution', values: [512, 1024, 2048, 4096, 8192], index: 2 },
            d: { name: 'distance from the camera', unit: 'm', min: 1, max: 200, value: 10, log: true }, Hs: { sym: 'H', name: 'screen height', values: [1080, 1440, 2160], index: 0 } },
    out: [{ sym: 'texel', unit: 'cm', f: v => 2 * v.ext / v.res * 100, color: 'accent' }, { sym: 'px / texel', f: v => 2 * v.ext / v.res * pxPerM(v.Hs, v.d, 60), color: 'ray' }],
    sub: v => { const t = 2 * v.ext / v.res, r = t * pxPerM(v.Hs, v.d, 60); return `one shadow texel is <b>${num(t * 100)} cm</b> and covers <b>${num(r)}</b> screen pixels here → ${r > 2 ? 'blocky edges' : r > 0.7 ? 'about right' : 'more resolution than needed'}`; },
    plot: { x: 'd', logY: true, y: [0.01, 1000] }
  });

  const pcfVal = (x, e, k, t) => { if (k <= 1) return x > e ? 1 : 0; let s = 0; for (let i = 0; i < k; i++) { const xs = x + (i - (k - 1) / 2) * t; s += xs > e ? 1 : 0; } return s / k; };
  A.fx('pcf', {
    title: 'Percentage-closer filtering across a shadow edge',
    expr: 'lit = (1/{k}) · Σ<sub>i</sub> [x + o<sub>i</sub> > edge],   texel {t}',
    vars: { x: { name: 'position across the edge', unit: 'm', min: -1, max: 1, value: 0.1, step: 0.005 }, k: { sym: 'k', name: 'filter taps (per axis)', min: 1, max: 9, value: 5, step: 1 }, t: { sym: 'texel', name: 'texel size', unit: 'm', min: 0.02, max: 0.2, value: 0.08, step: 0.005 } },
    out: { sym: 'lit', f: v => pcfVal(v.x, 0, v.k, v.t) },
    draw(ctx, W, H, v, X) {
      const L = 20, R = W - 20, P = x => L + (x + 1) / 2 * (R - L);
      for (let px = L; px < R; px++) { const x = (px - L) / (R - L) * 2 - 1, l = pcfVal(x, 0, v.k, v.t); const c = Math.round(40 + 190 * l); ctx.fillStyle = `rgb(${c},${c},${Math.round(c * 0.95)})`; ctx.fillRect(px, 40, 1, 100); }
      for (let i = 0; i < v.k; i++) X.dot(ctx, P(v.x + (i - (v.k - 1) / 2) * v.t), 170, (v.x + (i - (v.k - 1) / 2) * v.t) > 0 ? col('good') : col('bad'), 5);
      X.label(ctx, 'taps: green lit, red shadowed', L, 196, col('muted'));
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P(v.x), 34); ctx.lineTo(P(v.x), 180); ctx.stroke();
      X.label(ctx, 'shadow', L, 28, col('muted')); X.label(ctx, 'lit', R, 28, col('muted'), 'right');
    },
    plot: { x: 'x', y: [0, 1] }
  });

  const splits = v => Array.from({ length: v.n + 1 }, (_, i) => v.l * v.nr * Math.pow(v.f / v.nr, i / v.n) + (1 - v.l) * (v.nr + (v.f - v.nr) * i / v.n));
  A.fx('cascades', {
    title: 'Where to split the cascades',
    expr: 'split<sub>i</sub> = {l} · n · (f/n)<sup>i/{n}</sup> + (1 − {l}) · (n + (f − n) · i / {n}),   n = {nr},   f = {f}',
    vars: { n: { sym: 'N', name: 'cascades', min: 1, max: 4, value: 4, step: 1 }, l: { sym: 'λ', name: 'blend: 0 even, 1 logarithmic', min: 0, max: 1, value: 0.75, step: 0.01 },
            nr: { sym: 'n', name: 'near distance', unit: 'm', min: 0.1, max: 2, value: 0.3, step: 0.05 }, f: { name: 'shadow distance', unit: 'm', min: 20, max: 1000, value: 150, log: true } },
    out: { sym: 'split₁', name: 'end of the first cascade', unit: 'm', f: v => splits(v)[1] },
    sub: v => `cascades end at <b>${splits(v).slice(1).map(x => num(x) + ' m').join(', ')}</b>`,
    draw(ctx, W, H, v, X) {
      const sp = splits(v), L = 20, R = W - 20, P = d => L + Math.sqrt(d / v.f) * (R - L), cols = ['accent', 'ray', 'ax-y', 'ax-x'];
      for (let i = 0; i < v.n; i++) { ctx.fillStyle = alpha(col(cols[i]), 0.35); ctx.fillRect(P(sp[i]), 60, P(sp[i + 1]) - P(sp[i]), 70); ctx.strokeStyle = col(cols[i]); ctx.strokeRect(P(sp[i]), 60, P(sp[i + 1]) - P(sp[i]), 70); X.label(ctx, `${i + 1}`, (P(sp[i]) + P(sp[i + 1])) / 2, 95, col('ink'), 'center', true); X.label(ctx, num(sp[i + 1]) + ' m', P(sp[i + 1]), 146 + (i % 2) * 14, col(cols[i]), 'center'); }
      X.label(ctx, 'distance from the camera (square-root scale)', L, 40, col('muted'));
      X.label(ctx, 'texel size grows with each cascade\'s width at the same resolution', L, H - 16, col('muted'));
    },
    plot: { x: 'l', y: [0, 60] }
  });

  A.fx('shadowcost', {
    title: 'Shadow render passes and draws',
    expr: 'draws ≈ {c} · ({cs} + {sp} + 6 · {pt})',
    vars: { c: { sym: 'casters', name: 'shadow-casting objects in range (average)', min: 10, max: 5000, value: 400, log: true }, cs: { sym: 'cascades', name: 'directional cascades', min: 0, max: 4, value: 4, step: 1 },
            sp: { sym: 'spots', name: 'shadowed spot lights', min: 0, max: 16, value: 2, step: 1 }, pt: { sym: 'points', name: 'shadowed point lights', min: 0, max: 16, value: 2, step: 1 } },
    out: { sym: 'draws', f: v => v.c * (v.cs + v.sp + 6 * v.pt) },
    sub: v => `${v.cs + v.sp + 6 * v.pt} shadow passes × ${num(v.c)} casters ≈ <b>${num(v.c * (v.cs + v.sp + 6 * v.pt))}</b> draws (fewer in practice: each pass only draws what it can see)`,
    plot: { x: 'pt', y: [0, 60000] },
    note: 'Point lights are expensive: six passes each. Cache shadows of lights and objects that do not move.'
  });
})();
