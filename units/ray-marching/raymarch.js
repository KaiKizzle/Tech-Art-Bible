/* Ray Marching — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num, clamp } = A;
  const rad = d => d * Math.PI / 180;

  /* ---------- a terrain line with a thin spike ---------- */
  const terr = x => 0.32 + 0.1 * Math.sin(3 * x) + 0.05 * Math.sin(9 * x + 1) + 0.5 * Math.max(0, 1 - Math.abs(x - 1.75) / 0.03);
  const O = [0.05, 1.1];
  function march(dt, ang, maxT = 6) {
    const D = [Math.cos(rad(ang)), -Math.sin(rad(ang))], pts = []; let t = 0, hit = null, prev = 0;
    for (let i = 0; i < 400 && t < maxT; i++) { const p = [O[0] + D[0] * t, O[1] + D[1] * t]; pts.push(p); if (p[1] <= terr(p[0])) { hit = { t, prev, i }; break; } prev = t; t += dt; }
    return { D, pts, hit };
  }
  const EX = {};
  function exact(ang) { if (EX[ang] !== undefined) return EX[ang]; const D = [Math.cos(rad(ang)), -Math.sin(rad(ang))], f = t => O[1] + D[1] * t - terr(O[0] + D[0] * t); let t = 0, res = NaN;
    for (let i = 0; i < 6000; i++) { if (f(t + 0.001) <= 0) { let a = t, b = t + 0.001; for (let k = 0; k < 30; k++) { const m = (a + b) / 2; if (f(m) > 0) a = m; else b = m; } res = (a + b) / 2; break; } t += 0.001; }
    return (EX[ang] = res); }
  A.fx('fixed', {
    title: 'Fixed steps along a ray',
    expr: 'P(t) = O + t · D,   t += {dt},   stop when P.y < h(P.x),   ray {ang} below the horizon',
    vars: { dt: { sym: 'Δt', name: 'step length', min: 0.01, max: 0.5, value: 0.18, step: 0.01 },
            ang: { sym: 'θ', name: 'angle of the ray below the horizon', unit: '°', min: 5, max: 40, value: 21, step: 0.5 } },
    out: [{ sym: 'steps', f: v => { const r = march(v.dt, v.ang); return r.hit ? r.hit.i + 1 : r.pts.length; }, color: 'accent' },
          { sym: 'error', f: v => { const r = march(v.dt, v.ang), e = exact(v.ang); return r.hit ? Math.abs(r.hit.t - e) : NaN; }, color: 'bad' }],
    sub: (v, n) => { const r = march(v.dt, v.ang), e = exact(v.ang); if (!r.hit) return 'no hit: the ray left the picture'; const err = r.hit.t - e; return Math.abs(err) > 0.3 ? `<b>wrong surface</b>: the march stopped ${n(err)} units behind the first hit; it stepped over the spike` : `hit after <b>${r.hit.i + 1} steps</b>, ${n(Math.abs(err))} units behind the true surface`; },
    draw(ctx, W, H, v, X) {
      const sx = W / 4, sy = H / 1.25, P = p => [p[0] * sx, H - p[1] * sy];
      ctx.fillStyle = alpha(col('muted'), 0.22); ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= 4; x += 0.004) { const q = P([x, terr(x)]); ctx.lineTo(q[0], q[1]); } ctx.lineTo(W, H); ctx.fill();
      const r = march(v.dt, v.ang), e = exact(v.ang), end = P([O[0] + r.D[0] * 6, O[1] + r.D[1] * 6]), o = P(O);
      ctx.strokeStyle = alpha(col('ray'), 0.5); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(end[0], end[1]); ctx.stroke();
      r.pts.forEach((p, i) => { const q = P(p); X.dot(ctx, q[0], q[1], i === r.pts.length - 1 && r.hit ? col('bad') : col('ray'), 3.5); });
      if (isFinite(e)) { const q = P([O[0] + r.D[0] * e, O[1] + r.D[1] * e]); X.dot(ctx, q[0], q[1], col('good'), 5); X.label(ctx, 'first true hit', q[0] + 8, q[1] - 10, col('good')); }
    },
    plot: { x: 'dt' }, size: [440, 260]
  });

  /* ---------- refinement: bisection versus secant ---------- */
  const fr = t => 0.35 - 0.9 * t + 0.25 * Math.sin(4 * t);   // height above the surface along the ray
  function root() { let a = 0, b = 1.2; for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (fr(m) > 0) a = m; else b = m; } return (a + b) / 2; }
  const R0 = root();
  function bracket(dt) { let t = 0; while (fr(t + dt) > 0) t += dt; return [t, t + dt]; }
  function bis(dt, k) { let [a, b] = bracket(dt); for (let i = 0; i < k; i++) { const m = (a + b) / 2; if (fr(m) > 0) a = m; else b = m; } return (a + b) / 2; }
  function sec(dt, k) { let [a, b] = bracket(dt), fa = fr(a), fb = fr(b); for (let i = 0; i < k; i++) { const m = a + (b - a) * fa / (fa - fb), fm = fr(m); if (fm > 0) { a = m; fa = fm; } else { b = m; fb = fm; } } return a + (b - a) * fa / (fa - fb); }
  A.fx('refine', {
    title: 'Narrowing the hit: bisection or secant',
    expr: 'bisection: t = (t<sub>a</sub> + t<sub>b</sub>) / 2,   secant: t = t<sub>a</sub> + (t<sub>b</sub> − t<sub>a</sub>) · d<sub>a</sub> / (d<sub>a</sub> − d<sub>b</sub>),   {k} refinements after steps of {dt}',
    vars: { k: { sym: 'k', name: 'refinement steps', min: 0, max: 6, value: 2, step: 1 },
            dt: { sym: 'Δt', name: 'coarse step length', min: 0.05, max: 0.4, value: 0.25, step: 0.01 } },
    out: [{ sym: 'bisection error', f: v => Math.abs(bis(v.dt, v.k) - R0), color: 'ray' }, { sym: 'secant error', f: v => Math.abs(sec(v.dt, v.k) - R0), color: 'accent' }],
    sub: (v, n) => `after ${v.k} refinements: bisection is off by <b>${n(Math.abs(bis(v.dt, v.k) - R0))}</b>, secant by <b>${n(Math.abs(sec(v.dt, v.k) - R0))}</b>. Both cost one evaluation per step.`,
    draw(ctx, W, H, v, X) {
      const sx = (W - 40) / 1.0, X0 = 30, Y0 = H / 2, sy = H * 0.8, P = (t, d) => [X0 + t * sx, Y0 - d * sy];
      ctx.strokeStyle = col('line'); ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(W - 6, Y0); ctx.stroke(); X.label(ctx, 'surface (d = 0)', W - 100, Y0 - 10, col('muted'));
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); for (let t = 0; t <= 1; t += 0.005) { const q = P(t, fr(t)); t ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke();
      const [a, b] = bracket(v.dt); [a, b].forEach((t, i) => { const q = P(t, fr(t)); X.dot(ctx, q[0], q[1], i ? col('bad') : col('good'), 5); });
      const pa = P(a, fr(a)), pb = P(b, fr(b)); ctx.setLineDash([4, 4]); ctx.strokeStyle = col('accent'); ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke(); ctx.setLineDash([]);
      const tb = bis(v.dt, v.k), ts = sec(v.dt, v.k); [[tb, 'ray', 'bisection'], [ts, 'accent', 'secant']].forEach(([t, c, l], i) => { const q = P(t, 0); ctx.strokeStyle = col(c); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q[0], q[1] - 14); ctx.lineTo(q[0], q[1] + 14); ctx.stroke(); X.label(ctx, l, q[0], q[1] + 26 + i * 14, col(c), 'center'); });
      X.label(ctx, 'd(t): height of the ray above the surface', X0, 14, col('muted'));
    },
    plot: { x: 'k', logY: true, y: [1e-7, 1] }, size: [440, 260]
  });

  /* ---------- sphere tracing ---------- */
  const SC = [[2.6, 0.55, 0.35], [1.25, 0.35, 0.3]];
  const sdf = p => { let d = p[1] + 0.02; SC.forEach(c => { d = Math.min(d, Math.hypot(p[0] - c[0], p[1] - c[1]) - c[2]); }); return d; };
  function trace(ang, eps, maxN) { const D = [Math.cos(rad(ang)), -Math.sin(rad(ang))], o = [0.1, 1.0], st = []; let t = 0, hit = false;
    for (let i = 0; i < maxN; i++) { const p = [o[0] + D[0] * t, o[1] + D[1] * t], d = sdf(p); st.push([p, d]); if (d < eps) { hit = true; break; } t += d; if (t > 5) break; } return { st, hit, D, o, t }; }
  A.fx('sphere', {
    title: 'Sphere tracing: step by the distance to the nearest surface',
    expr: 't += sdf(O + t · D),   stop when sdf < {eps},   at most {n} steps,   ray {ang} below the horizon',
    vars: { ang: { sym: 'θ', name: 'angle of the ray below the horizon', unit: '°', min: 0, max: 40, value: 12, step: 0.5 },
            eps: { sym: 'ε', name: 'hit threshold', min: 0.0005, max: 0.05, value: 0.005, log: true },
            n: { sym: 'N', name: 'maximum steps', min: 4, max: 64, value: 32, step: 1 } },
    out: { sym: 'steps used', f: v => trace(v.ang, v.eps, v.n).st.length },
    sub: v => { const r = trace(v.ang, v.eps, v.n); return r.hit ? `hit after <b>${r.st.length}</b> steps. Grazing past an object costs many tiny steps; open space costs few large ones.` : r.st.length >= v.n ? `<b>out of steps</b> (${v.n}) before reaching the surface: the pixel shows a miss` : 'the ray left the scene'; },
    draw(ctx, W, H, v, X) {
      const s = W / 4, P = p => [p[0] * s, H - 20 - p[1] * s];
      ctx.fillStyle = alpha(col('muted'), 0.25); ctx.fillRect(0, P([0, -0.02])[1], W, 40); SC.forEach(c => { const q = P(c); ctx.beginPath(); ctx.arc(q[0], q[1], c[2] * s, 0, 7); ctx.fill(); });
      const r = trace(v.ang, v.eps, v.n);
      r.st.forEach(([p, d]) => { const q = P(p); ctx.strokeStyle = alpha(col('ray'), 0.45); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(d, 0) * s, 0, 7); ctx.stroke(); X.dot(ctx, q[0], q[1], col('ray'), 2.5); });
      const a = P(r.o), b = P([r.o[0] + r.D[0] * r.t, r.o[1] + r.D[1] * r.t]); ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      if (r.hit) X.dot(ctx, b[0], b[1], col('good'), 5);
    },
    plot: { x: 'ang' }, size: [440, 260]
  });

  /* ---------- bounding slab for height fields ---------- */
  A.fx('slab', {
    title: 'March only where the surface can be',
    expr: 'steps = {H} / (cos {th} · {dt}),   instead of the whole path from the camera',
    vars: { H: { sym: 'H', name: 'thickness of the slab (highest minus lowest point)', min: 0.02, max: 1, value: 0.15, step: 0.01 },
            th: { sym: 'θ', name: 'view angle from the surface normal', unit: '°', min: 0, max: 85, value: 60, step: 1 },
            dt: { sym: 'Δt', name: 'step length along the ray', min: 0.01, max: 0.1, value: 0.03, step: 0.005 } },
    out: { sym: 'steps', f: v => Math.ceil(v.H / (Math.cos(rad(v.th)) * v.dt)) },
    sub: (v, n) => `the ray crosses the slab over <b>${n(v.H / Math.cos(rad(v.th)))}</b> units: ${Math.ceil(v.H / (Math.cos(rad(v.th)) * v.dt))} steps. A thinner slab or a steeper view needs fewer.`,
    draw(ctx, W, H, v, X) {
      const top = H * 0.4, th = v.H * (H * 0.45), bot = top + th, cx = W * 0.35, a = rad(v.th);
      ctx.fillStyle = alpha(col('ray'), 0.12); ctx.fillRect(0, top, W, th); ctx.setLineDash([5, 5]); ctx.strokeStyle = col('muted'); [top, bot].forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }); ctx.setLineDash([]);
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x <= W; x += 3) { const y = bot - th * (0.5 + 0.45 * Math.sin(x * 0.05) * Math.cos(x * 0.013)); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      const x0 = cx - Math.tan(a) * top, x1 = cx + Math.tan(a) * th;
      ctx.strokeStyle = alpha(col('muted'), 0.7); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(cx, top); ctx.stroke();
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(x1, bot); ctx.stroke();
      const n = Math.min(Math.ceil(v.H / (Math.cos(a) * v.dt)), 80); for (let i = 0; i <= n; i++) { const f = i / n; X.dot(ctx, cx + (x1 - cx) * f, top + th * f, col('accent'), 2.2); }
      X.label(ctx, 'skipped: the surface cannot be up here', 10, top - 12, col('muted')); X.label(ctx, 'max height', W - 80, top - 8, col('muted')); X.label(ctx, 'min height', W - 80, bot + 12, col('muted'));
    },
    plot: { x: 'th', logY: true, y: [1, 1000] }, size: [440, 260]
  });

  /* ---------- volumes: integrate instead of stopping ---------- */
  const dens = x => Math.exp(-Math.pow((x - 0.5) / 0.18, 2));
  const exactOD = s => { let o = 0; for (let i = 0; i < 2000; i++) o += dens((i + 0.5) / 2000) / 2000; return o * s; };
  A.fx('volume', {
    title: 'Through a volume: add up density along the way',
    expr: 'T = Π e<sup>−σ(x<sub>i</sub>) Δt</sup>,   Δt = 1 / {N},   peak density {s}',
    vars: { N: { sym: 'N', name: 'number of steps through the volume', min: 1, max: 32, value: 4, step: 1 },
            s: { sym: 'σ', name: 'peak density', min: 0.5, max: 8, value: 4, step: 0.1 },
            j: { sym: 'offset', name: 'sample position in each step', values: [0, 0.5], labels: ['start of step', 'middle of step'], index: 0 } },
    out: [{ sym: 'T stepped', f: v => { let od = 0; for (let i = 0; i < v.N; i++) od += v.s * dens((i + v.j) / v.N) / v.N; return Math.exp(-od); }, color: 'accent' }, { sym: 'T exact', f: v => Math.exp(-exactOD(v.s)), color: 'good', dash: [5, 4] }],
    sub: (v, n) => { let od = 0; for (let i = 0; i < v.N; i++) od += v.s * dens((i + v.j) / v.N) / v.N; const a = Math.exp(-od), e = Math.exp(-exactOD(v.s)); return `${v.N} steps let <b>${n(a * 100)} %</b> of the light through; the exact answer is ${n(e * 100)} %. ${v.j ? 'Mid-step samples converge much faster.' : 'Sampling at the start of each step is biased.'}`; },
    draw(ctx, W, H, v, X) {
      const y0 = H - 30, sy = (H - 60) / 1.1; ctx.fillStyle = alpha(col('ray'), 0.2); ctx.beginPath(); ctx.moveTo(10, y0); for (let x = 0; x <= 1; x += 0.005) ctx.lineTo(10 + x * (W - 20), y0 - dens(x) * sy); ctx.lineTo(W - 10, y0); ctx.fill();
      for (let i = 0; i < v.N; i++) { const x = (i + v.j) / v.N, w = (W - 20) / v.N; ctx.strokeStyle = col('accent'); ctx.strokeRect(10 + i * w, y0 - dens(x) * sy, w, dens(x) * sy); X.dot(ctx, 10 + x * (W - 20), y0 - dens(x) * sy, col('accent'), 3); }
      X.label(ctx, 'density along the ray; boxes: what N steps add up', 10, 14, col('muted'));
    },
    plot: { x: 'N', y: [0, 1] }, size: [440, 260]
  });

  /* ---------- banding versus jitter ---------- */
  function hash(x, y) { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); }
  A.fx('jitter', {
    title: 'Too few steps: bands, or noise that TAA can clean up',
    expr: 'sample i at (i + {j}) · Δt,   {N} steps through a soft ball of fog',
    vars: { N: { sym: 'N', name: 'steps per ray', min: 2, max: 24, value: 5, step: 1 },
            j: { sym: 'offset', name: 'start offset', values: [0, 1], labels: ['fixed 0.5', 'per-pixel random'], index: 0 } },
    out: { sym: 'samples per pixel', f: v => v.N },
    sub: v => v.j ? `${v.N} samples per pixel at random offsets: no rings, only noise, which TAA averages away over a few frames` : `${v.N} samples per pixel at the same offset everywhere: <b>${v.N} visible rings</b>, one per step`,
    draw(ctx, W, H, v, X) {
      const S = 2, cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.42;
      for (let y = 0; y < H; y += S) for (let x = 0; x < W; x += S) {
        const u = (x - cx) / R, w = (y - cy) / R, half = Math.sqrt(Math.max(0, 1 - u * u - w * w)); let od = 0;
        if (half > 0) { const off = v.j ? hash(x, y) : 0.5; for (let i = 0; i < v.N; i++) { const z = -1 + 2 * (i + off) / v.N, r2 = u * u + w * w + z * z; od += Math.max(0, 1 - r2) * 1.6 * (2 / v.N); } }
        const T = Math.exp(-od), c = Math.round(255 * (0.12 + 0.8 * (1 - T))); ctx.fillStyle = `rgb(${c},${c},${Math.min(255, c + 12)})`; ctx.fillRect(x, y, S + 0.6, S + 0.6);
      }
      X.label(ctx, v.j ? 'noise: averages out over frames' : 'bands: one ring per step', 10, H - 10, '#fff');
    },
    plot: false, size: [520, 260]
  });
})();
