/* Fabric and Folds — live formulas and the cloth lab */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180, PI = Math.PI;
  const enc = x => Math.round(clamp(x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055, 0, 1) * 255);
  const css = c => `rgb(${c.map(enc).join(',')})`;
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const FAB = [0.16, 0.36, 0.44];

  /* ---------- fold amplitude ---------- */
  const amp = v => v.lam * Math.sqrt(v.c / 100) / PI;
  A.fx('foldamp', {
    title: 'How high folds must be',
    expr: 'A ≈ {lam} · √{c} / π',
    vars: { c: { name: 'compression (how much shorter the cloth is pushed)', unit: '%', min: 0, max: 30, value: 15, step: 0.5 }, lam: { sym: 'λ', name: 'fold wavelength', unit: 'cm', min: 1, max: 20, value: 6, step: 0.1 } },
    out: { sym: 'A', name: 'fold amplitude', unit: 'cm', f: amp },
    sub: v => `folds rise and fall by <b>${num(amp(v))} cm</b> (${num(2 * amp(v))} cm from trough to crest)`,
    draw(ctx, W, H, v, X) {
      const L0 = W - 40, pxcm = L0 / 60, x0 = (W - L0) / 2, a = amp(v) * pxcm, lam = v.lam * pxcm, L = L0 * (1 - v.c / 100);
      ctx.lineCap = 'round'; ctx.strokeStyle = css(FAB.map(x => x * 1.6)); ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(x0, 60); ctx.lineTo(x0 + L0, 60); ctx.stroke();
      X.label(ctx, 'relaxed: 60 cm', x0, 40, col('muted'));
      const y0 = H / 2 + 50, xs = x0 + (L0 - L) / 2;
      ctx.beginPath(); for (let i = 0; i <= 400; i++) { const x = i / 400 * L, y = y0 - a * Math.sin(2 * PI * x / lam); i ? ctx.lineTo(xs + x, y) : ctx.moveTo(xs + x, y); } ctx.stroke();
      ctx.strokeStyle = col('line'); ctx.lineWidth = 1; ctx.setLineDash([4, 4]); [xs, xs + L].forEach(x => { ctx.beginPath(); ctx.moveTo(x, y0 - 70); ctx.lineTo(x, y0 + 70); ctx.stroke(); }); ctx.setLineDash([]);
      X.label(ctx, `pushed together to ${num(60 * (1 - v.c / 100))} cm`, xs, y0 - 80, col('muted'));
      if (a > 3) { X.arrow(ctx, xs + lam / 4, y0, xs + lam / 4, y0 - a + 4, col('accent'), 1.5); X.label(ctx, 'A', xs + lam / 4 + 6, y0 - a / 2, col('accent'), 'left', true); }
    },
    plot: { x: 'c', y: [0, 5] }
  });

  /* ---------- normal blending in 2D: a normal is a tilt angle ---------- */
  const nb = {
    rnm: v => v.a1 + v.a2,
    wo: v => Math.atan2(Math.sin(v.a1 * DEG) + Math.sin(v.a2 * DEG), Math.cos(v.a1 * DEG) * Math.cos(v.a2 * DEG)) / DEG,
    udn: v => Math.atan2(Math.sin(v.a1 * DEG) + Math.sin(v.a2 * DEG), Math.cos(v.a1 * DEG)) / DEG,
    lin: v => Math.atan2(Math.sin(v.a1 * DEG) + Math.sin(v.a2 * DEG), Math.cos(v.a1 * DEG) + Math.cos(v.a2 * DEG)) / DEG
  };
  const NB = [['rnm', 'RNM', 'accent'], ['wo', 'whiteout', 'good'], ['udn', 'UDN', 'ray'], ['lin', 'linear', 'muted']];
  A.fx('nblend', {
    title: 'Blending a fold normal with a detail normal',
    expr: 'RNM: θ = {a1} + {a2},   whiteout: n = (x₁ + x₂, z₁ · z₂),   UDN: n = (x₁ + x₂, z₁),   linear: n = n₁ + n₂',
    vars: { a1: { sym: 'θ<sub>1</sub>', name: 'tilt of the fold (base) normal', unit: '°', min: -60, max: 60, value: 40, step: 1 }, a2: { sym: 'θ<sub>2</sub>', name: 'tilt of the weave (detail) normal', unit: '°', min: -60, max: 60, value: 25, step: 1 } },
    out: NB.map(([k, n, c]) => ({ sym: n, f: nb[k], color: c, fmt: x => num(x) + '°' })),
    sub: v => `the correct tilt is <b>${num(nb.rnm(v))}°</b>; linear gives ${num(nb.lin(v))}°, UDN ${num(nb.udn(v))}°, whiteout ${num(nb.wo(v))}°`,
    draw(ctx, W, H, v, X) {
      const c = [W / 2, H - 70], t = v.a1 * DEG;
      ctx.strokeStyle = css(FAB.map(x => x * 1.6)); ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(c[0] - Math.cos(t) * 150, c[1] - Math.sin(t) * 150); ctx.lineTo(c[0] + Math.cos(t) * 150, c[1] + Math.sin(t) * 150); ctx.stroke();
      X.label(ctx, 'fold surface', c[0] + Math.cos(t) * 150, c[1] + Math.sin(t) * 150 + 20, col('muted'), 'right');
      NB.slice().reverse().forEach(([k, n, cc]) => { const a = nb[k](v) * DEG, L = 170; X.arrow(ctx, c[0], c[1], c[0] + Math.sin(a) * L, c[1] - Math.cos(a) * L, col(cc), k === 'rnm' ? 3 : 2); });
      NB.forEach(([k, n, cc], i) => X.label(ctx, `${n} ${num(nb[k](v))}°`, 12, 20 + i * 18, col(cc), 'left', k === 'rnm'));
    },
    plot: { x: 'a2', y: [-120, 120] }
  });

  /* ---------- tension masks ---------- */
  const sq = v => clamp((1 - v.r) * v.k, 0, 1), st = v => clamp((v.r - 1) * v.k, 0, 1);
  A.fx('tension', {
    title: 'Squash and stretch masks',
    expr: 'squash = saturate((1 − {r}) · {k}),   stretch = saturate(({r} − 1) · {k})',
    vars: { r: { sym: 'L / L₀', name: 'current edge length / rest length', min: 0.6, max: 1.3, value: 0.82, step: 0.01 }, k: { name: 'sensitivity', min: 1, max: 8, value: 4, step: 0.1 } },
    out: [{ sym: 'squash', f: sq, color: 'ray' }, { sym: 'stretch', f: st, color: 'bad' }],
    draw(ctx, W, H, v, X) {
      const L0 = 330, L = L0 * v.r, x0 = (W - L) / 2, y0 = H / 2 - 40, h = 90, q = sq(v), s = st(v);
      ctx.strokeStyle = col('line'); ctx.setLineDash([4, 4]); ctx.strokeRect((W - L0) / 2, y0 - 6, L0, h + 12); ctx.setLineDash([]);
      for (let x = 0; x < L; x++) { const w = Math.sin(x / L * 2 * PI * 7 + Math.sin(x * 0.05) * 0.8); const b = 1 + 0.75 * q * w - 0.15 * s; ctx.fillStyle = css(FAB.map(c => c * b * 1.4)); ctx.fillRect(x0 + x, y0, 1.2, h); }
      if (s > 0) { ctx.strokeStyle = alpha('#ffffff', 0.5 * s); ctx.lineWidth = 1.5; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x0 + 8, y0 + i * h / 6); ctx.lineTo(x0 + L - 8, y0 + i * h / 6 + (i - 3) * 3); ctx.stroke(); } }
      ctx.fillStyle = col('muted'); [x0 - 14, x0 + L + 14].forEach(x => { ctx.beginPath(); ctx.arc(x, y0 + h / 2, 16, 0, 2 * PI); ctx.fill(); });
      X.label(ctx, 'dashed: rest length', (W - L0) / 2, y0 - 16, col('muted'));
      [['squash → wrinkle map', q, 'ray'], ['stretch → pull lines', s, 'bad']].forEach(([n, val, c], i) => { const y = y0 + h + 40 + i * 30; ctx.fillStyle = col('line'); ctx.fillRect(170, y - 9, 200, 12); ctx.fillStyle = col(c); ctx.fillRect(170, y - 9, 200 * val, 12); X.label(ctx, n, 160, y + 1, col(c), 'right'); X.label(ctx, num(val), 380, y + 1, col('ink')); });
    },
    plot: { x: 'r', y: [0, 1.1] }
  });

  /* ---------- joint-driven wrinkles ---------- */
  const jw = v => ss(v.a0, v.a1, v.ang);
  A.fx('jointmask', {
    title: 'Elbow angle to wrinkle weight',
    expr: 'weight = smoothstep({a0}, {a1}, {ang})',
    vars: { ang: { sym: 'θ', name: 'elbow bend', unit: '°', min: 0, max: 150, value: 95, step: 1 }, a0: { sym: 'θ₀', name: 'wrinkles start at', unit: '°', min: 0, max: 90, value: 40, step: 1 }, a1: { sym: 'θ₁', name: 'full wrinkles at', unit: '°', min: 60, max: 150, value: 125, step: 1 } },
    out: { sym: 'weight', f: jw },
    draw(ctx, W, H, v, X) {
      const sh = [40, H - 60], el = [250, H - 60], a = v.ang * DEG, hd = [el[0] + Math.cos(a) * 140, el[1] - Math.sin(a) * 140], w = jw(v);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = css(FAB.map(x => x * 1.5)); ctx.lineWidth = 50;
      ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(el[0], el[1]); ctx.lineTo(hd[0], hd[1]); ctx.stroke();
      ctx.fillStyle = col('muted'); ctx.beginPath(); ctx.arc(hd[0] + Math.cos(a) * 34, hd[1] - Math.sin(a) * 34, 20, 0, 2 * PI); ctx.fill();
      /* wrinkles on the inside of the bend */
      const mid = a / 2 + PI / 2, inner = [el[0] + Math.cos(mid) * 6, el[1] - Math.sin(mid) * 6];
      ctx.strokeStyle = alpha('#06121a', 0.75 * w); ctx.lineWidth = 3;
      for (let i = -3; i <= 3; i++) { const r = 22 + Math.abs(i) * 2, off = i * 9 * DEG * 1.6; ctx.beginPath(); ctx.arc(inner[0], inner[1], r, -(mid + off) - 0.5, -(mid + off) + 0.5); ctx.stroke(); }
      X.label(ctx, `wrinkle weight ${num(w)}`, 20, 24, col('accent'), 'left', true);
    },
    plot: { x: 'ang', y: [0, 1.1] }
  });

  /* ---------- Verlet ---------- */
  A.fx('verlet', {
    title: 'Verlet integration and damping',
    expr: 'x<sub>new</sub> = x + (x − x<sub>prev</sub>) · (1 − {d}) + a · Δt²,   Δt = 1 / {hz}',
    vars: { d: { name: 'damping per step', min: 0, max: 0.2, value: 0.02, step: 0.001 }, hz: { sym: 'rate', name: 'simulation steps per second', values: [30, 60, 120, 240], labels: ['30 Hz', '60 Hz', '120 Hz', '240 Hz'], index: 1 } },
    out: { sym: 'speed kept after 1 s', f: v => Math.pow(1 - v.d, v.hz) },
    draw(ctx, W, H, v, X) {
      const s = 100, o = [40, H - 40], g = -9.8, dt = 1 / v.hz;
      const path = d => { let x = [0, 0], p = [-3.2 * dt, -5.5 * dt]; const out = [x]; for (let t = 0; t < 1.3; t += dt) { const n = [x[0] + (x[0] - p[0]) * (1 - d), x[1] + (x[1] - p[1]) * (1 - d) + g * dt * dt]; p = x; x = n; out.push(x); if (x[1] < -0.2) break; } return out; };
      ctx.strokeStyle = col('line'); ctx.beginPath(); ctx.moveTo(0, o[1]); ctx.lineTo(W, o[1]); ctx.stroke();
      ctx.setLineDash([3, 4]); ctx.strokeStyle = col('muted'); ctx.beginPath(); path(0).forEach((q, i) => i ? ctx.lineTo(o[0] + q[0] * s, o[1] - q[1] * s) : ctx.moveTo(o[0], o[1])); ctx.stroke(); ctx.setLineDash([]);
      path(v.d).forEach(q => X.dot(ctx, o[0] + q[0] * s, o[1] - q[1] * s, col('accent'), 2.5));
      X.label(ctx, 'dots: one per step · dashed: no damping', 10, 18, col('muted'));
    },
    plot: { x: 'd', y: [0, 1] }
  });

  /* ---------- PBD stiffness ---------- */
  A.fx('pbdstiff', {
    title: 'Stiffness and iterations',
    expr: 'fixed = 1 − (1 − {s})<sup>{n}</sup>,   s′ = 1 − (1 − {s})<sup>1/{n}</sup>',
    vars: { s: { name: 'stiffness per pass', min: 0.01, max: 1, value: 0.3, step: 0.01 }, n: { name: 'iterations', min: 1, max: 50, value: 8, step: 1 } },
    out: [{ sym: 'fixed after n passes', f: v => 1 - Math.pow(1 - v.s, v.n), color: 'accent' }, { sym: 's′ for the same total', f: v => 1 - Math.pow(1 - v.s, 1 / v.n), color: 'ray' }],
    draw(ctx, W, H, v, X) {
      const n = Math.min(v.n, 30), bw = Math.min(28, (W - 60) / (n + 1)), b = H - 40, h = H - 90;
      for (let k = 0; k <= n; k++) { const e = Math.pow(1 - v.s, k); ctx.fillStyle = alpha(col('bad'), 0.8); ctx.fillRect(40 + k * bw, b - e * h, bw - 3, e * h); }
      ctx.strokeStyle = col('line'); ctx.beginPath(); ctx.moveTo(36, b); ctx.lineTo(W - 10, b); ctx.stroke();
      X.label(ctx, 'remaining error after each pass', 40, 26, col('muted'));
      X.label(ctx, 'pass 0', 40, b + 16, col('muted')); X.label(ctx, String(n), 40 + n * bw, b + 16, col('muted'));
    },
    plot: { x: 'n', y: [0, 1.05] }
  });

  /* ---------- cost ---------- */
  const solves = v => v.p * v.c * v.it * v.sub;
  A.fx('clothcost', {
    title: 'Constraint solves per frame',
    expr: 'solves = {p} · {c} · {it} · {sub}',
    vars: { p: { name: 'particles', min: 100, max: 20000, value: 2000, log: true }, c: { name: 'constraints per particle', min: 2, max: 8, value: 6, step: 1 }, it: { name: 'iterations', min: 1, max: 30, value: 10, step: 1 }, sub: { name: 'substeps', values: [1, 2, 4, 8], index: 0 } },
    out: { sym: 'solves', f: solves },
    sub: v => `<b>${num(solves(v))}</b> solves per frame; at an illustrative 5 ns each, about <b>${num(solves(v) * 5e-6)} ms</b> on one CPU core`,
    plot: { x: 'p', logY: true, y: [1e3, 1e8] }
  });

  /* ---------- the cloth lab ---------- */
  (function lab() {
    const cv = document.getElementById('cl'); if (!cv) return;
    const NX = 21, NY = 16, WID = 1.1, R = WID / (NX - 1);
    let P = [], Q = [], pin = [], C = [], grabbed = -1, grabT = null, playing = !A.reduceMotion, time = 0, visible = true, mode = 'lit';
    const yaw = -28 * DEG, pitch = 10 * DEG, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), DIST = 2.4, F = 720;
    const toCam = p => { const x = p[0] * cy + p[2] * sy, z0 = -p[0] * sy + p[2] * cy, y = p[1] * cp - z0 * sp, z = p[1] * sp + z0 * cp; return [x, y, z + DIST]; };
    const fromCam = c => { const z = c[2] - DIST, y0 = c[1] * cp + z * sp, z0 = -c[1] * sp + z * cp; return [c[0] * cy - z0 * sy, y0, c[0] * sy + z0 * cy]; };
    const proj = (p, W, H) => { const c = toCam(p); return [W / 2 + c[0] / c[2] * F, H * 0.5 - c[1] / c[2] * F, c[2]]; };
    const id = (i, j) => j * NX + i;
    const rs = A.range('cl-pin', v => Math.round(v * 100) + ' %', () => { placePins(); if (!playing) f.draw(); }), rit = A.range('cl-it', v => String(v)), rst = A.range('cl-s', v => v.toFixed(2)), rb = A.range('cl-b', v => v.toFixed(2)), rw = A.range('cl-w', v => v.toFixed(2));
    A.seg('cl-view', v => { mode = v; f.draw(); });
    function pinPos(i) { const sp_ = rs.v; return [(i / (NX - 1) - 0.5) * WID * sp_, 0.42, (i % 2 ? 0.5 : -0.5) * R * Math.sqrt(Math.max(0, 1 - sp_ * sp_))]; } /* pleated like curtain hooks: neighbouring pins stay one rest length apart */
    function placePins() { for (let i = 0; i < NX; i++) { const k = id(i, 0); P[k] = pinPos(i); Q[k] = P[k].slice(); } }
    function reset() {
      P = []; Q = []; pin = [];
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const p = [(i / (NX - 1) - 0.5) * WID * rs.v, 0.42 - j * R, (Math.sin(i * 1.7 + j) * 0.004)]; P.push(p); Q.push(p.slice()); pin.push(j === 0); }
      C = [];
      const add = (a, b, t) => C.push([a, b, Math.hypot(...[0, 1, 2].map(k => (initRest(a)[k] - initRest(b)[k]))), t]);
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        if (i < NX - 1) add(id(i, j), id(i + 1, j), 0); if (j < NY - 1) add(id(i, j), id(i, j + 1), 0);
        if (i < NX - 1 && j < NY - 1) { add(id(i, j), id(i + 1, j + 1), 0); add(id(i + 1, j), id(i, j + 1), 0); }
        if (i < NX - 2) add(id(i, j), id(i + 2, j), 1); if (j < NY - 2) add(id(i, j), id(i, j + 2), 1);
      }
      placePins(); time = 0;
      for (let k = 0; k < 150; k++) step();
    }
    function initRest(k) { const i = k % NX, j = (k - i) / NX; return [i * R, -j * R, 0]; }
    function step() {
      const dt = 1 / 60, g = -9.8, wind = rw.v, damp = 0.012; time += dt;
      for (let k = 0; k < P.length; k++) {
        if (pin[k] || k === grabbed) continue;
        const p = P[k], q = Q[k], wz = wind * 3.2 * (0.55 + 0.45 * Math.sin(time * 1.7 + p[0] * 4 + p[1] * 2.5)) * (0.6 + 0.4 * Math.sin(time * 0.6));
        const n = [p[0] + (p[0] - q[0]) * (1 - damp), p[1] + (p[1] - q[1]) * (1 - damp) + g * dt * dt, p[2] + (p[2] - q[2]) * (1 - damp) + wz * dt * dt];
        Q[k] = p; P[k] = n;
      }
      if (grabbed >= 0 && grabT) { P[grabbed] = grabT.slice(); Q[grabbed] = grabT.slice(); }
      const it = rit.v, s = rst.v, b = rb.v;
      for (let n = 0; n < it; n++) for (const [a, c, rest, t] of C) {
        const wa = pin[a] || a === grabbed ? 0 : 1, wc = pin[c] || c === grabbed ? 0 : 1, w = wa + wc; if (!w) continue;
        const pa = P[a], pc = P[c], d0 = pc[0] - pa[0], d1 = pc[1] - pa[1], d2 = pc[2] - pa[2], len = Math.hypot(d0, d1, d2) || 1e-9;
        const k = (t ? b : s) * (len - rest) / len / w;
        pa[0] += d0 * k * wa; pa[1] += d1 * k * wa; pa[2] += d2 * k * wa; pc[0] -= d0 * k * wc; pc[1] -= d1 * k * wc; pc[2] -= d2 * k * wc;
      }
    }
    const L = (() => { const l = [0.85, 0.35, 0.45], n = Math.hypot(...l); return l.map(x => x / n); })();
    const f = A.fig(cv, (ctx, W, H) => {
      if (!P.length) return;
      const S = P.map(p => proj(p, W, H)), quads = [];
      for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
        const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
        const e1 = [0, 1, 2].map(k => P[c][k] - P[a][k]), e2 = [0, 1, 2].map(k => P[d][k] - P[b][k]);
        let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const nl = Math.hypot(...n) || 1; n = n.map(x => x / nl);
        const len = (u, w) => Math.hypot(P[u][0] - P[w][0], P[u][1] - P[w][1], P[u][2] - P[w][2]);
        const ratio = (len(a, b) + len(b, c) + len(c, d) + len(d, a)) / (4 * R);
        quads.push({ v: [a, b, c, d], z: (S[a][2] + S[b][2] + S[c][2] + S[d][2]) / 4, n, ratio });
      }
      quads.sort((p, q) => q.z - p.z);
      /* direction from the cloth toward the camera, in world space */
      const vdir = fromCam([0, 0, 0]).map((x, k) => x - fromCam([0, 0, 1])[k]);
      for (const q of quads) {
        let n = q.n, back = false; if (n[0] * vdir[0] + n[1] * vdir[1] + n[2] * vdir[2] < 0) { n = n.map(x => -x); back = true; }
        let c;
        if (mode === 'strain') { const sqz = clamp((1 - q.ratio) * 4, 0, 1), str = clamp((q.ratio - 1) * 8, 0, 1); c = [0.35 + str * 0.5 - sqz * 0.25, 0.35 - sqz * 0.15 - str * 0.2, 0.35 + sqz * 0.55 - str * 0.2].map(x => x * 0.7); }
        else { const dl = clamp((n[0] * L[0] + n[1] * L[1] + n[2] * L[2] + 0.25) / 1.25, 0, 1); const base = back ? [0.42, 0.2, 0.12] : FAB; c = base.map(x => x * (0.12 + 2.0 * dl * dl)); }
        ctx.fillStyle = css(c); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.8;
        ctx.beginPath(); q.v.forEach((k, i) => i ? ctx.lineTo(S[k][0], S[k][1]) : ctx.moveTo(S[k][0], S[k][1])); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 3; ctx.beginPath(); const r0 = proj([-WID * 0.55, 0.445, 0], W, H), r1 = proj([WID * 0.55, 0.445, 0], W, H); ctx.moveTo(r0[0], r0[1]); ctx.lineTo(r1[0], r1[1]); ctx.stroke();
      for (let i = 0; i < NX; i++) { const s = S[id(i, 0)]; ctx.fillStyle = col('ink'); ctx.beginPath(); ctx.arc(s[0], s[1], 2.2, 0, 2 * PI); ctx.fill(); }
      if (grabbed >= 0) { const s = S[grabbed]; ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s[0], s[1], 9, 0, 2 * PI); ctx.stroke(); }
    });
    A.pointer(cv, f.w, f.h, (pt, kind) => {
      if (kind === 'down') { let best = -1, bd = 900; P.forEach((p, k) => { if (pin[k]) return; const s = proj(p, f.w, f.h), d = (s[0] - pt.x) ** 2 + (s[1] - pt.y) ** 2; if (d < bd) { bd = d; best = k; } }); grabbed = best; if (best >= 0) { grabT = P[best].slice(); if (!playing) setPlay(true); } }
      else if (kind === 'move' && grabbed >= 0) { const c = toCam(P[grabbed]), z = c[2]; grabT = fromCam([(pt.x - f.w / 2) * z / F, -(pt.y - f.h * 0.5) * z / F, z]); }
      else if (kind === 'up') { grabbed = -1; grabT = null; }
    });
    const playBtn = document.getElementById('cl-play');
    function setPlay(on) { playing = on; playBtn.textContent = on ? 'Pause' : 'Play'; if (on) loop(); }
    playBtn.addEventListener('click', () => setPlay(!playing));
    document.getElementById('cl-reset').addEventListener('click', () => { reset(); report(); f.draw(); });
    const ro = document.getElementById('cl-ro'), cap = document.getElementById('cl-cap');
    function report() {
      let mx = 0; for (const [a, c, rest, t] of C) if (!t && !pin[a] && !pin[c]) { const l = Math.hypot(P[c][0] - P[a][0], P[c][1] - P[a][1], P[c][2] - P[a][2]); mx = Math.max(mx, l / rest - 1); }
      const nC = C.length;
      ro.innerHTML = `<tr><td>Particles</td><td>${P.length}</td></tr><tr><td>Constraints</td><td>${nC}</td></tr><tr><td>Solves per frame</td><td>${num(nC * rit.v)}</td></tr><tr><td>Worst stretch</td><td>${num(mx * 100)} %</td></tr>`;
      const pc = Math.round(mx * 100); cap.textContent = mx > 0.15 ? `The worst edge is ${pc} % longer than its rest length: the cloth reads as rubber. Add iterations or raise the stretch stiffness.` : mx > 0.06 ? `The worst edge is ${pc} % too long: slightly stretchy, like knitwear. More iterations would tighten it.` : `The worst edge is within ${Math.max(pc, 1)} % of its rest length: the corrections reach every particle within the iterations.`;
    }
    let raf = 0, frame = 0;
    function loop() { if (raf) return; raf = requestAnimationFrame(tick); }
    function tick() { raf = 0; if (!playing || !visible) return; step(); f.draw(); if (++frame % 10 === 0) report(); loop(); }
    try { new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && playing) loop(); }).observe(cv); } catch (e) {}
    reset(); report(); f.draw(); playBtn.textContent = playing ? 'Pause' : 'Play'; if (playing) loop();
  })();
})();
