/* Eyes — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num, clamp } = A;
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI, lerp = (a, b, t) => a + (b - a) * t;
  const sstep = s => s * s * (3 - 2 * s);

  /* ---------- the cornea cap ---------- */
  A.fx('cornea', {
    title: 'Cornea height and iris depth',
    expr: 'h = {R} − √({R}² − {r}²),   apex to iris = h + {d}',
    vars: { R: { sym: 'R', name: 'radius of curvature of the cornea', unit: 'mm', min: 6.5, max: 9, value: 7.8, step: 0.05 },
            r: { sym: 'r', name: 'radius of the limbus (half the visible iris width)', unit: 'mm', min: 5.2, max: 6.4, value: 5.8, step: 0.05 },
            d: { sym: 'd', name: 'depth of the iris behind the limbus plane', unit: 'mm', min: 0.5, max: 4, value: 2.5, step: 0.05 } },
    out: [{ sym: 'h', f: v => v.R - Math.sqrt(Math.max(v.R * v.R - v.r * v.r, 0)), unit: 'mm', color: 'accent' }, { sym: 'apex to iris', f: v => v.R - Math.sqrt(Math.max(v.R * v.R - v.r * v.r, 0)) + v.d, unit: 'mm', color: 'ray' }],
    draw(ctx, W, H, v, X) {
      const s = H / 11.5, cx = W / 2 - 30, cy = H * 0.5, P = (x, y) => [cx + x * s, cy - y * s], h = v.R - Math.sqrt(v.R * v.R - v.r * v.r);
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 2; const ball = 12, a0 = Math.asin(v.r / ball);
      ctx.beginPath(); for (let a = a0; a <= 2 * Math.PI - a0; a += 0.02) { const q = P(ball * Math.sin(a), ball * Math.cos(a) - Math.sqrt(ball * ball - v.r * v.r)); a === a0 ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1]); } ctx.stroke();
      ctx.strokeStyle = col('ray'); ctx.lineWidth = 2.5; ctx.beginPath(); const ac = Math.asin(v.r / v.R); for (let a = -ac; a <= ac + 1e-6; a += 0.01) { const q = P(v.R * Math.sin(a), h - v.R * (1 - Math.cos(a))); a === -ac ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1]); } ctx.stroke();
      ctx.fillStyle = alpha(col('ray'), 0.12); ctx.beginPath(); for (let a = -ac; a <= ac + 1e-6; a += 0.01) { const q = P(v.R * Math.sin(a), h - v.R * (1 - Math.cos(a))); ctx.lineTo(q[0], q[1]); } const ip = P(v.r * 0.95, -v.d), im = P(-v.r * 0.95, -v.d); ctx.lineTo(ip[0], ip[1]); ctx.lineTo(im[0], im[1]); ctx.fill();
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 4; [[-v.r * 0.95, -1.6], [1.6, v.r * 0.95]].forEach(([a, b]) => { const p0 = P(a, -v.d), p1 = P(b, -v.d); ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); });
      ctx.setLineDash([4, 4]); ctx.strokeStyle = col('muted'); ctx.lineWidth = 1; const l0 = P(-v.r, 0), l1 = P(v.r, 0); ctx.beginPath(); ctx.moveTo(l0[0] - 20, l0[1]); ctx.lineTo(l1[0] + 20, l1[1]); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, 'cornea', P(v.r * 0.4, h)[0] + 6, P(0, h)[1] - 10, col('ray')); X.label(ctx, 'iris', P(v.r, -v.d)[0] + 8, P(0, -v.d)[1], col('accent')); X.label(ctx, 'pupil', P(0, -v.d)[0], P(0, -v.d)[1] + 14, col('muted'), 'center');
      X.label(ctx, 'limbus plane', l1[0] + 24, l1[1], col('muted')); X.label(ctx, 'anterior chamber', P(0, -v.d / 2)[0], P(0, -v.d / 2)[1], col('muted'), 'center'); X.label(ctx, 'sclera', P(-ball * 0.8, 0)[0], P(0, -6)[1], col('muted'));
    },
    sub: (v, n) => { const h = v.R - Math.sqrt(Math.max(v.R * v.R - v.r * v.r, 0)); return `the cornea rises <b>${n(h)} mm</b> above the limbus; the iris lies <b>${n(h + v.d)} mm</b> below the cornea apex, behind clear fluid`; },
    plot: { x: 'd', y: [0, 7] }, size: [520, 300]
  });

  /* ---------- where the iris appears at an angle ---------- */
  const shiftR = v => v.d * Math.tan(Math.asin(Math.sin(rad(v.th)) / v.n));
  A.fx('shift', {
    title: 'Iris shift by viewing angle',
    expr: 'shift = {d} · tan(asin(sin {th} / {n}))',
    vars: { th: { sym: 'θ', name: 'viewing angle from the eye\'s axis', unit: '°', min: 0, max: 70, value: 40, step: 1 },
            d: { sym: 'd', name: 'depth of the iris below the cornea', unit: 'mm', min: 0.5, max: 4, value: 3, step: 0.05 },
            n: { sym: 'n', name: 'refractive index of the aqueous humour', min: 1, max: 1.5, value: 1.336, step: 0.001 } },
    out: { sym: 'shift', f: shiftR, unit: 'mm' },
    sub: (v, n) => `seen from ${n(v.th)}°, the iris sits <b>${n(shiftR(v))} mm</b> (${n(shiftR(v) / 5.8 * 100)} % of its radius) away from where a painted iris would be`,
    plot: { x: 'th', y: [0, 3.5] }
  });

  /* ---------- bump offset versus refraction ---------- */
  A.fx('bump', {
    title: 'Parallax offset versus refraction',
    expr: 'offset = {d} · tan {th}  (plain),   {d} · tan {th} / {n}  (scaled),   {d} · tan θ<sub>t</sub>  (refracted)',
    vars: { th: { sym: 'θ', name: 'viewing angle', unit: '°', min: 0, max: 80, value: 45, step: 1 },
            d: { sym: 'd', name: 'iris depth', unit: 'mm', min: 0.5, max: 4, value: 3, step: 0.05 },
            n: { sym: 'n', name: 'index of refraction', min: 1, max: 1.5, value: 1.336, step: 0.001 } },
    out: [{ sym: 'plain', f: v => v.d * Math.tan(rad(v.th)), unit: 'mm', color: 'bad' }, { sym: 'scaled by 1/n', f: v => v.d * Math.tan(rad(v.th)) / v.n, unit: 'mm', color: 'ax-y' }, { sym: 'refracted', f: shiftR, unit: 'mm', color: 'good' }],
    sub: (v, n) => `at ${n(v.th)}°: plain parallax ${n(v.d * Math.tan(rad(v.th)))} mm, scaled ${n(v.d * Math.tan(rad(v.th)) / v.n)} mm, refraction <b>${n(shiftR(v))} mm</b>. The plain offset runs away at grazing angles; refraction levels off.`,
    plot: { x: 'th', y: [0, 12] }
  });

  /* ---------- refraction onto the iris plane (HDRP Eye) ---------- */
  const EYE = { R: 7.8, r: 5.8 };
  function corneaHit(x0, th, n, d) {
    const h = EYE.R - Math.sqrt(EYE.R * EYE.R - EYE.r * EYE.r), c = [0, h - EYE.R], D = [Math.sin(rad(th)), -Math.cos(rad(th))];
    const o = [x0 - D[0] * 20, -D[1] * -20 + 0]; // start far above along -D
    const O = [x0 - D[0] * 20, 20 * Math.cos(rad(th))];
    const oc = [O[0] - c[0], O[1] - c[1]], b = oc[0] * D[0] + oc[1] * D[1], cc = oc[0] * oc[0] + oc[1] * oc[1] - EYE.R * EYE.R, disc = b * b - cc;
    if (disc < 0) return null; const t = -b - Math.sqrt(disc), P = [O[0] + D[0] * t, O[1] + D[1] * t];
    if (Math.abs(P[0]) > EYE.r || P[1] < 0) return null;
    const N = [(P[0] - c[0]) / EYE.R, (P[1] - c[1]) / EYE.R], eta = 1 / n, ci = -(N[0] * D[0] + N[1] * D[1]), k = 1 - eta * eta * (1 - ci * ci);
    if (k < 0) return null; const tt = eta * ci - Math.sqrt(k), T = [eta * D[0] + tt * N[0], eta * D[1] + tt * N[1]];
    const s = (-d - P[1]) / T[1], I = [P[0] + T[0] * s, -d], s0 = (-d - P[1]) / D[1], I0 = [P[0] + D[0] * s0, -d];
    return { O, P, T, I, I0, h };
  }
  A.fx('plane', {
    title: 'Refraction onto the iris plane',
    expr: 'T = refract(V, N<sub>cornea</sub>, 1/{n}),   iris point = P + T · (−{d} − P.y) / T.y,   view {th}',
    vars: { th: { sym: 'θ', name: 'viewing angle from the eye\'s axis', unit: '°', min: 0, max: 60, value: 35, step: 1 },
            x0: { sym: 'x', name: 'where the highlighted ray meets the cornea', unit: 'mm', min: -5, max: 5, value: 1, step: 0.05 },
            n: { sym: 'n', name: 'index of refraction', min: 1, max: 1.6, value: 1.336, step: 0.001 },
            d: { sym: 'd', name: 'iris plane depth', unit: 'mm', min: 0.5, max: 4, value: 2.5, step: 0.05 } },
    out: { sym: 'iris point x', f: v => { const r = corneaHit(v.x0, v.th, v.n, v.d); return r ? r.I[0] : NaN; }, unit: 'mm' },
    sub: (v, n) => { const r = corneaHit(v.x0, v.th, v.n, v.d); if (!r) return 'the ray misses the cornea'; return `refracted, the ray lands at <b>${n(r.I[0])} mm</b>; without refraction it would land at ${n(r.I0[0])} mm` + (Math.abs(r.I[0]) > EYE.r * 0.95 ? '; <b>outside the iris</b>: the shader shows sclera or limbus' : ''); },
    draw(ctx, W, H, v, X) {
      const s = Math.min(W / 16, H / 12), cx = W / 2, cy = H * 0.42, P = p => [cx + p[0] * s, cy - p[1] * s], h = EYE.R - Math.sqrt(EYE.R * EYE.R - EYE.r * EYE.r);
      ctx.fillStyle = alpha(col('ray'), 0.1); ctx.beginPath(); const ac = Math.asin(EYE.r / EYE.R); for (let a = -ac; a <= ac + 1e-6; a += 0.01) { const q = P([EYE.R * Math.sin(a), h - EYE.R * (1 - Math.cos(a))]); ctx.lineTo(q[0], q[1]); } const q1 = P([EYE.r, -v.d]), q2 = P([-EYE.r, -v.d]); ctx.lineTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.fill();
      ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.beginPath(); for (let a = -ac; a <= ac + 1e-6; a += 0.01) { const q = P([EYE.R * Math.sin(a), h - EYE.R * (1 - Math.cos(a))]); a === -ac ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1]); } ctx.stroke();
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 4; const a0 = P([-EYE.r, -v.d]), a1 = P([EYE.r, -v.d]); ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke();
      for (let x = -5; x <= 5.01; x += 1) { if (Math.abs(x - v.x0) < 0.3) continue; const r = corneaHit(x, v.th, v.n, v.d); if (!r) continue; ctx.strokeStyle = alpha(col('muted'), 0.4); ctx.lineWidth = 1; ctx.beginPath(); const a = P(r.O), b = P(r.P), c = P(r.I); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); }
      const r = corneaHit(v.x0, v.th, v.n, v.d);
      if (r) { const a = P(r.O), b = P(r.P), c = P(r.I), c0 = P(r.I0); ctx.setLineDash([4, 4]); ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(c0[0], c0[1]); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = col('ink'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); X.dot(ctx, c[0], c[1], col('good'), 5); X.dot(ctx, c0[0], c0[1], col('bad'), 4); }
      X.label(ctx, 'iris plane', a1[0] + 6, a1[1], col('accent')); X.label(ctx, 'green: refracted hit, red: unrefracted', 10, H - 10, col('muted'));
    },
    plot: { x: 'th', y: [-8, 8] }, size: [520, 300]
  });

  /* ---------- the iris profile ---------- */
  function shape(r, v) { const s = clamp((1 - r) / Math.max(1 - v.p, 1e-3), 0, 1); const dd = (r - lerp(v.p, 1, 0.35)) * 12; return v.cone * sstep(s) + v.col * Math.exp(-dd * dd); }
  A.fx('profile', {
    title: 'Iris height profile',
    expr: 'h(r) = {cone} · smoothstep(s) + {col} · e<sup>−((r − r<sub>c</sub>) · 12)²</sup>,   s = (1 − r) / (1 − {p}),   r<sub>c</sub> = lerp({p}, 1, 0.35)',
    vars: { cone: { sym: 'cone', name: 'height of the pupil margin above the iris root (× iris radius)', min: 0, max: 0.35, value: 0.16, step: 0.005 },
            col: { sym: 'ridge', name: 'height of the collarette ridge', min: 0, max: 0.1, value: 0.035, step: 0.002 },
            p: { sym: 'pupil', name: 'pupil radius (× iris radius)', min: 0.12, max: 0.6, value: 0.28, step: 0.01 },
            r: { sym: 'r', name: 'radius where h is read', min: 0, max: 1, value: 0.5, step: 0.01, const: false } },
    out: { sym: 'h', f: v => v.r < v.p ? NaN : shape(v.r, v) },
    sub: (v, n) => v.r < v.p ? 'inside the pupil: no iris here' : `at r = ${n(v.r)} the iris surface is <b>${n(shape(v.r, v))}</b> iris radii above its root; the pupil margin sits ${n(v.cone)} above it`,
    draw(ctx, W, H, v, X) {
      const s = (W - 40) / 2.2, cx = W / 2, base = H * 0.68, P = (x, y) => [cx + x * s, base - y * s * 2.2];
      ctx.strokeStyle = col('line'); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(10, base); ctx.lineTo(W - 10, base); ctx.stroke(); ctx.setLineDash([]); X.label(ctx, 'iris root plane', 12, base + 14, col('muted'));
      [-1, 1].forEach(sg => { ctx.fillStyle = alpha(col('accent'), 0.25); ctx.beginPath(); const a = P(sg * 1, 0); ctx.moveTo(a[0], a[1]); for (let r = 1; r >= v.p; r -= 0.005) { const q = P(sg * r, shape(r, v)); ctx.lineTo(q[0], q[1]); } const b = P(sg * v.p, 0); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = col('accent'); ctx.lineWidth = 2.5; ctx.beginPath(); for (let r = 1; r >= v.p; r -= 0.005) { const q = P(sg * r, shape(r, v)); r === 1 ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1]); } ctx.stroke(); });
      X.label(ctx, 'pupil', cx, base + 14, col('muted'), 'center'); X.label(ctx, 'collarette', P(lerp(v.p, 1, 0.35), 0)[0], P(0, shape(lerp(v.p, 1, 0.35), v))[1] - 14, col('ink'), 'center');
      X.label(ctx, 'heights exaggerated 2.2×', W - 150, 16, col('muted'));
    },
    plot: { x: 'r', y: [0, 0.4] }, size: [520, 220]
  });

  /* ---------- marching the iris ---------- */
  const PV = { cone: 0.16, col: 0.035, p: 0.28 };
  function irisMarch(v) {
    const depth = 0.27, top = -depth + PV.cone + PV.col, D = [Math.sin(rad(v.th)), -Math.cos(rad(v.th))], O = [v.x0 - D[0] * (0.5 / -D[1]), 0.0];
    const zAt = t => O[1] + D[1] * t, xAt = t => O[0] + D[0] * t, f = t => { const x = xAt(t), r = Math.abs(x); return zAt(t) - (r < PV.p ? -depth : -depth + shape(Math.min(r, 1), PV)); };
    const tTop = Math.max((top - O[1]) / D[1], 0), tBot = (-depth - O[1]) / D[1];
    const steps = Math.max(1, Math.round(lerp(v.mx, v.mn, -D[1]))), dt = (tBot - tTop) / steps; let tp = tTop, dp = f(tTop), tc = tBot, dc = -1e-5; const pts = [tTop];
    for (let i = 1; i <= steps; i++) { const t = tTop + dt * i, d = f(t); pts.push(t); if (d <= 0) { tc = t; dc = d; break; } tp = t; dp = d; }
    const sec = [];
    for (let k = 0; k < 2; k++) { const tm = lerp(tp, tc, dp / Math.max(dp - dc, 1e-7)), dm = f(tm); sec.push(tm); if (dm > 0) { tp = tm; dp = dm; } else { tc = tm; dc = dm; } }
    const th = lerp(tp, tc, dp / Math.max(dp - dc, 1e-7));
    let lo = tTop, hi = tBot; for (let i = 0; i < 4000; i++) { const t = lerp(tTop, tBot, i / 4000); if (f(t) <= 0) { hi = t; lo = lerp(tTop, tBot, Math.max(i - 1, 0) / 4000); break; } } for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
    return { D, O, tTop, tBot, pts, sec, th, ex: (lo + hi) / 2, steps, xAt, zAt, top, depth };
  }
  A.fx('march', {
    title: 'Iris slab ray march',
    expr: 'steps = lerp({mx}, {mn}, −D.z),   then 2 secant steps,   ray {th}',
    vars: { th: { sym: 'θ', name: 'angle of the refracted ray from the eye\'s axis', unit: '°', min: 0, max: 60, value: 38, step: 1 },
            x0: { sym: 'x', name: 'where the ray enters (× iris radius)', min: -0.9, max: 0.9, value: -0.2, step: 0.01 },
            mn: { sym: 'min', name: 'steps looking straight in', min: 1, max: 12, value: 4, step: 1 },
            mx: { sym: 'max', name: 'steps at grazing angles', min: 2, max: 24, value: 8, step: 1 } },
    out: [{ sym: 'evaluations', f: v => { const r = irisMarch(v); return r.pts.length + 2; }, color: 'accent' }, { sym: 'error (× iris radius)', f: v => { const r = irisMarch(v); return Math.abs(r.xAt(r.th) - r.xAt(r.ex)); }, color: 'bad' }],
    sub: (v, n) => { const r = irisMarch(v); return `<b>${r.pts.length + 2}</b> profile evaluations (no texture reads); the hit is off by ${n(Math.abs(r.xAt(r.th) - r.xAt(r.ex)) * 100)} % of the iris radius`; },
    draw(ctx, W, H, v, X) {
      const r = irisMarch(v), s = (W - 30) / 2.3, cx = W / 2, cy = 30, P = (x, z) => [cx + x * s, cy - z * s * 2.2];
      [r.top, -r.depth].forEach(z => { const a = P(-1.15, z), b = P(1.15, z); ctx.setLineDash([5, 4]); ctx.strokeStyle = col('muted'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]); });
      [-1, 1].forEach(sg => { ctx.strokeStyle = col('accent'); ctx.lineWidth = 2.5; ctx.beginPath(); for (let q = 1; q >= PV.p; q -= 0.005) { const p = P(sg * q, -r.depth + shape(q, PV)); q === 1 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); } ctx.stroke(); });
      const a = P(r.O[0], r.O[1]), b = P(r.xAt(r.tBot), r.zAt(r.tBot)); ctx.strokeStyle = alpha(col('ray'), 0.55); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      r.pts.forEach(t => { const p = P(r.xAt(t), r.zAt(t)); X.dot(ctx, p[0], p[1], col('ray'), 3); });
      r.sec.forEach(t => { const p = P(r.xAt(t), r.zAt(t)); X.dot(ctx, p[0], p[1], col('ax-y'), 3); });
      const ph = P(r.xAt(r.th), r.zAt(r.th)); X.dot(ctx, ph[0], ph[1], col('good'), 5);
      X.label(ctx, 'slab top: highest point of the profile', 8, P(0, r.top)[1] - 8, col('muted')); X.label(ctx, 'iris root', 8, P(0, -r.depth)[1] + 12, col('muted'));
      X.label(ctx, 'blue: linear steps, yellow: secant, green: hit', 8, H - 8, col('muted'));
    },
    plot: { x: 'th', y: [0, 30] }, size: [520, 260]
  });

  /* ---------- cost ---------- */
  A.fx('eyecost', {
    title: 'Eye cost on screen',
    expr: 'iris pixels = π · (0.22 · {w})² · 2 eyes,   work = pixels · (base + {s} · step)',
    vars: { w: { sym: 'w', name: 'width of one eye opening on screen', unit: 'px', min: 20, max: 900, value: 220, step: 1 },
            s: { sym: 'steps', name: 'march steps + refinements', min: 0, max: 20, value: 10, step: 1 } },
    out: [{ sym: 'iris pixels', f: v => Math.PI * Math.pow(0.22 * v.w, 2) * 2, color: 'accent', fmt: x => num(x) }, { sym: 'share of a 1080p frame', f: v => Math.PI * Math.pow(0.22 * v.w, 2) * 2 / (1920 * 1080), color: 'ray', fmt: x => num(x * 100) + ' %' }],
    sub: (v, n) => { const px = Math.PI * Math.pow(0.22 * v.w, 2) * 2; return `${n(px)} iris pixels × ${v.s} steps of about 20 instructions = <b>${n(px * v.s * 20 / 1e6)} M</b> instructions. A transparent cornea with screen refraction instead pays a full-screen copy of ${n(1920 * 1080 / 1e6)} M pixels.`; },
    plot: { x: 'w', logY: true, y: [100, 3e6] }
  });
})();
