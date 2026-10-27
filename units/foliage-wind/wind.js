/* Foliage Wind — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num, clamp } = A;
  const rad = d => d * Math.PI / 180, TAU = Math.PI * 2;
  const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };

  /* ---------- wind field with travelling gusts ---------- */
  const W_AT = (v, x) => v.b + v.g * noise1(x * 0.08 - v.s * v.t * 0.08);
  A.fx('field', {
    title: 'Wind strength along a field, with gusts',
    expr: 'w(x, t) = {b} + {g} · noise((x − {s} · {t}) / 12 m)',
    vars: { b: { sym: 'w<sub>0</sub>', name: 'base strength', min: 0, max: 1, value: 0.3, step: 0.01 },
            g: { sym: 'gust', name: 'gust strength', min: 0, max: 1, value: 0.6, step: 0.01 },
            s: { sym: 'v', name: 'gust speed', unit: 'm/s', min: 1, max: 20, value: 6, step: 0.5 },
            t: { sym: 't', name: 'time', unit: 's', min: 0, max: 20, value: 3, step: 0.05 } },
    out: { sym: 'w at x = 0', f: v => W_AT(v, 0) },
    sub: (v, n) => `the gust pattern moves across the field at ${n(v.s)} m/s; a plant at x reads the same noise texture as its neighbours, a little earlier or later: <b>w(0) = ${n(W_AT(v, 0))}</b>`,
    draw(ctx, W, H, v, X) {
      const gy = H - 24, span = 80;
      ctx.strokeStyle = col('line'); ctx.beginPath(); ctx.moveTo(10, gy); ctx.lineTo(W - 10, gy); ctx.stroke();
      ctx.strokeStyle = alpha(col('ray'), 0.8); ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 200; i++) { const x = i / 200 * span, w = W_AT(v, x), px = 10 + i / 200 * (W - 20), py = 22 + (1 - w / 2) * 50; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke(); X.label(ctx, 'w along the field', 12, 14, col('ray'));
      for (let k = 0; k < 16; k++) {
        const x = (k + 0.5) / 16 * span, w = W_AT(v, x), px = 10 + (k + 0.5) / 16 * (W - 20), Ln = H * 0.42, a = rad(70 * clamp(w, 0, 1.6) / 1.6);
        ctx.strokeStyle = col('accent'); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(px, gy);
        for (let j = 1; j <= 10; j++) { const u = j / 10, b = a * u * u; ctx.lineTo(px + Math.sin(b) * Ln * u, gy - Math.cos(b) * Ln * u); }
        ctx.stroke();
      }
      X.label(ctx, '0 m', 10, H - 8, col('muted')); X.label(ctx, span + ' m', W - 10, H - 8, col('muted'), 'right');
    },
    plot: { x: 't', y: [0, 2] }, size: [480, 260]
  });

  /* ---------- trunk bend with length preservation ---------- */
  const f = h => (Math.pow(1 + h, 4) - Math.pow(1 + h, 2)) / 12;
  function trunk(v, keep) {
    const Ht = 10, pts = [];
    for (let i = 0; i <= 20; i++) { const h = i / 20, p = [0, h * Ht], o = v.w * v.B * Ht * f(h); let q = [p[0] + o, p[1]];
      if (keep && h > 0) { const L = Math.hypot(...p), l = Math.hypot(...q); q = [q[0] / l * L, q[1] / l * L]; } pts.push(q); }
    return pts;
  }
  A.fx('bend', {
    title: 'Trunk bend, with and without length preservation',
    expr: 'p′ = p + {w} · {B} · H · f(h),   f(h) = ((1 + h)⁴ − (1 + h)²) / 12,   {k}',
    vars: { w: { sym: 'w', name: 'wind strength', min: 0, max: 1.5, value: 0.8, step: 0.01 },
            B: { sym: 'B', name: 'bend amount (softness of the species)', min: 0, max: 0.5, value: 0.25, step: 0.01 },
            k: { sym: 'length', name: 'then', values: [0, 1], labels: ['offset only', 'renormalise to the old length'], index: 1 } },
    out: [{ sym: 'stretch without renormalising', unit: '%', f: v => { const t = trunk(v, false)[20]; return (Math.hypot(...t) / 10 - 1) * 100; }, color: 'bad' },
          { sym: 'tip sinks by', unit: '%', f: v => { const t = trunk(v, true)[20]; return (1 - t[1] / 10) * 100; }, color: 'accent' }],
    sub: (v, n) => { const t = trunk(v, false)[20]; return v.k ? `renormalised: every vertex keeps its distance to the base, so the tip sinks as it bends (an offset alone would stretch the trunk by ${n((Math.hypot(...t) / 10 - 1) * 100)} %)` : `offset only: the tip moves sideways but not down, and the trunk grows by <b>${n((Math.hypot(...t) / 10 - 1) * 100)} %</b>`; },
    draw(ctx, W, H, v, X) {
      const s = (H - 30) / 11, ox = W * 0.3, oy = H - 12, P = p => [ox + p[0] * s, oy - p[1] * s];
      ctx.strokeStyle = col('line'); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(ox, oy, 10 * s, -Math.PI / 2, 0); ctx.stroke(); ctx.setLineDash([]);
      const draw = (pts, c, w) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(...P(p)) : ctx.moveTo(...P(p))); ctx.stroke(); };
      draw(trunk({ w: 0, B: 0 }, false), alpha(col('muted'), 0.5), 5);
      draw(trunk(v, false), v.k ? alpha(col('bad'), 0.6) : col('bad'), v.k ? 2 : 5);
      if (v.k) draw(trunk(v, true), col('accent'), 5);
      X.label(ctx, 'dashed: the tip\'s possible path at constant length', 10, 12, col('muted'));
    },
    plot: { x: 'w', y: [0, 30] }, size: [420, 280]
  });

  /* ---------- branch sway: rotation against translation ---------- */
  A.fx('sway', {
    title: 'Branch sway: rotate around the pivot or push the vertices',
    expr: 'θ = {a} · (1 − {s}),   {m}',
    vars: { a: { sym: 'a', name: 'sway amplitude', unit: '°', min: 0, max: 35, value: 25, step: 1 },
            s: { sym: 's', name: 'stiffness from the vertex colour', min: 0, max: 1, value: 0.2, step: 0.01 },
            m: { sym: 'method', name: 'method', values: [0, 1], labels: ['rotate around the pivot', 'add an offset'], index: 0 } },
    out: { sym: 'branch length change', unit: '%', f: v => { const th = rad(v.a * (1 - v.s)); return v.m ? (Math.sqrt(1 + Math.sin(th) ** 2) - 1) * 100 : 0; } },
    sub: (v, n) => { const th = rad(v.a * (1 - v.s)); return v.m ? `pushing the tip up by L · sin θ stretches the branch by <b>${n((Math.sqrt(1 + Math.sin(th) ** 2) - 1) * 100)} %</b>; rotating keeps it rigid` : `rotating by ${n(v.a * (1 - v.s))}° around the stored pivot keeps the branch length exact`; },
    draw(ctx, W, H, v, X) {
      const px = 60, py = H / 2 + 20, L = W - 120, th = rad(v.a * (1 - v.s));
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(px - 10, H - 10); ctx.lineTo(px - 10, 10); ctx.stroke();
      ctx.strokeStyle = alpha(col('muted'), 0.5); ctx.lineWidth = 4; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + L, py); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px, py);
      for (let i = 1; i <= 20; i++) { const u = i / 20; if (v.m) ctx.lineTo(px + L * u, py - L * u * Math.sin(th)); else ctx.lineTo(px + L * u * Math.cos(th), py - L * u * Math.sin(th)); }
      ctx.stroke(); X.dot(ctx, px, py, col('bad'), 5); X.label(ctx, 'pivot', px + 6, py + 16, col('bad'));
    },
    plot: { x: 'a', y: [0, 15] }, size: [440, 220]
  });

  /* ---------- leaf flutter ---------- */
  const fl = (v, t, ph) => v.A * v.m * Math.sin(TAU * (v.f * t + ph));
  A.fx('flutter', {
    title: 'Leaf flutter: small, fast, out of phase',
    expr: 'offset = N · {A} · {m} · sin(2π({f} · t + phase))',
    vars: { f: { sym: 'f', name: 'flutter frequency', unit: 'Hz', min: 0.5, max: 12, value: 4, step: 0.1 },
            A: { sym: 'A', name: 'amplitude', unit: 'cm', min: 0, max: 5, value: 1.5, step: 0.1 },
            m: { sym: 'mask', name: 'vertex colour R (0 at the stem, 1 at the edge)', min: 0, max: 1, value: 1, step: 0.01 } },
    out: { sym: 'peak speed', unit: 'cm/s', f: v => TAU * v.f * v.A * v.m },
    sub: (v, n) => `three leaves with different phases; peak speed <b>${n(TAU * v.f * v.A * v.m)} cm/s</b>. Fast, small motion reads as life; the mask keeps the stem attached`,
    draw(ctx, W, H, v, X) {
      const cs = [col('accent'), col('ray'), col('ax-y')], phs = [0, 0.37, 0.71];
      for (let k = 0; k < 3; k++) {
        const y0 = (k + 0.5) / 3 * H; ctx.strokeStyle = alpha(col('line'), 0.8); ctx.beginPath(); ctx.moveTo(10, y0); ctx.lineTo(W - 10, y0); ctx.stroke();
        ctx.strokeStyle = cs[k]; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i <= 300; i++) { const t = i / 300 * 2, x = 10 + i / 300 * (W - 20), y = y0 - fl(v, t, phs[k]) * 7; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }
      X.label(ctx, '2 seconds', W - 10, H - 6, col('muted'), 'right');
    },
    plot: { x: 'f', y: [0, 400] }, size: [440, 200]
  });

  /* ---------- wave functions ---------- */
  const tri = x => Math.abs((x + 0.5) - Math.floor(x + 0.5) - 0.5) * 2;   // 0..1
  const stri = x => { const t = tri(x); return t * t * (3 - 2 * t) * 2 - 1; };
  const FREQ = [1.975, 0.793, 0.375, 0.193];
  const sig = (v, t) => { let s = 0; for (let i = 0; i < v.n; i++) s += stri(t * FREQ[i] * v.sp); return s / v.n; };
  A.fx('waves', {
    title: 'Smoothed triangle waves at unrelated frequencies',
    expr: 'wave(t) = Σ<sub>i&lt;{n}</sub> smooth(tri(t · f<sub>i</sub> · {sp})) / {n},   f = 1.975, 0.793, 0.375, 0.193',
    vars: { n: { sym: 'n', name: 'waves added', min: 1, max: 4, value: 4, step: 1 },
            sp: { sym: 'speed', name: 'time scale', min: 0.2, max: 3, value: 1, step: 0.05 } },
    out: { sym: 'ALU (approx.)', f: v => v.n * 5 },
    sub: (v, n) => v.n === 1 ? 'one wave repeats visibly: every plant pumps back and forth in the same rhythm' : `${v.n} waves at frequencies with no simple ratio: the sum does not visibly repeat, for about <b>${v.n * 5}</b> instructions (frac, abs, a multiply-add and the smoothing per wave; no sin)`,
    draw(ctx, W, H, v, X) {
      const y0 = H / 2; ctx.strokeStyle = col('line'); ctx.beginPath(); ctx.moveTo(10, y0); ctx.lineTo(W - 10, y0); ctx.stroke();
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 600; i++) { const t = i / 600 * 20, x = 10 + i / 600 * (W - 20), y = y0 - sig(v, t) * (H / 2 - 16); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); X.label(ctx, '20 s', W - 10, H - 6, col('muted'), 'right'); X.label(ctx, '0', 10, H - 6, col('muted'));
    },
    plot: false, size: [480, 180]
  });

  /* ---------- motion vectors ---------- */
  const pxm = v => 1080 / (2 * v.d * Math.tan(rad(30)));
  const pxf = v => v.A / 100 * TAU * v.f / v.fps * pxm(v);
  A.fx('mv', {
    title: 'How far a leaf moves on screen in one frame',
    expr: 'Δ = {A} · 2π · {f} / {fps} · px per m,   px per m = 1080 / (2 · {d} · tan 30°)',
    vars: { A: { sym: 'A', name: 'amplitude of the motion', unit: 'cm', min: 0.5, max: 30, value: 4, step: 0.5 },
            f: { sym: 'f', name: 'frequency', unit: 'Hz', min: 0.2, max: 8, value: 2, step: 0.1 },
            fps: { sym: 'fps', name: 'frame rate', values: [30, 60, 120], index: 1 },
            d: { sym: 'd', name: 'distance to the camera', unit: 'm', min: 0.5, max: 40, value: 3, log: true } },
    out: { sym: 'Δ', unit: 'px per frame', f: pxf },
    sub: (v, n) => `up to <b>${n(pxf(v))} px</b> per frame at 1080p and 60° field of view. Without motion vectors for the vertex animation, TAA and motion blur treat that as a static pixel, and ${pxf(v) > 1 ? 'leaves smear and ghost' : 'the error stays under a pixel'}`,
    plot: { x: 'd', logY: true }
  });

  /* ---------- interaction: pushing grass away ---------- */
  const push = v => Math.max(0, v.r - v.x) * v.k;
  A.fx('push', {
    title: 'Pushing grass away from a character',
    expr: 'offset = normalize(p − c) · max(0, {r} − |p − c|) · {k} · height mask,   |p − c| = {x}',
    vars: { r: { sym: 'r', name: 'push radius', unit: 'm', min: 0.2, max: 2, value: 0.8, step: 0.05 },
            k: { sym: 'k', name: 'push strength', min: 0, max: 1.5, value: 0.9, step: 0.01 },
            x: { sym: 'dist', name: 'distance of a blade from the character', unit: 'm', min: 0, max: 2, value: 0.4, step: 0.01 } },
    out: { sym: 'offset at the tip', unit: 'm', f: push },
    sub: (v, n) => `a blade ${n(v.x)} m from the character is pushed <b>${n(push(v))} m</b> outward at its tip; the height mask keeps the root planted`,
    draw(ctx, W, H, v, X) {
      const s = (W - 40) / 4, cx = 20 + 2 * s, gy = H - 18;
      ctx.strokeStyle = col('line'); ctx.beginPath(); ctx.moveTo(10, gy); ctx.lineTo(W - 10, gy); ctx.stroke();
      ctx.fillStyle = alpha(col('ray'), 0.18); ctx.strokeStyle = col('ray'); ctx.beginPath(); ctx.arc(cx, gy - 0.35 * s, 0.3 * s, 0, 7); ctx.fill(); ctx.stroke();
      for (let i = -14; i <= 14; i++) {
        const x = i / 14 * 2, d = Math.abs(x), o = Math.max(0, v.r - d) * v.k * Math.sign(x || 1), bx = cx + x * s, L = 0.55 * s;
        ctx.strokeStyle = Math.abs(d - v.x) < 0.075 ? col('accent') : alpha(col('accent'), 0.5); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, gy);
        for (let j = 1; j <= 8; j++) { const u = j / 8, ox = o * u * u * s; const ly = Math.sqrt(Math.max(0.01, L * L * u * u - ox * ox * 0.6)); ctx.lineTo(bx + ox, gy - ly); }
        ctx.stroke();
      }
    },
    plot: { x: 'x', y: [0, 2] }, size: [440, 200]
  });

  /* ---------- what wind costs ---------- */
  const inv = v => v.V * v.N * (1 + v.c * 0.6 + (v.p ? 1 : 0) + (v.mv ? 1 : 0)) * (1 - v.o * 0.85);
  A.fx('cost', {
    title: 'Vertex shader runs per frame',
    expr: 'runs = {V} · {N} · passes · (1 − 0.85 · {o}),   passes = 1 + {p} + 0.6 · {c} + {mv}',
    vars: { V: { sym: 'V', name: 'vertices per visible plant (average over LODs)', min: 100, max: 20000, value: 1500, log: true },
            N: { sym: 'N', name: 'visible plants', min: 100, max: 200000, value: 20000, log: true },
            c: { sym: 'cascades', name: 'shadow cascades the plants fall into', min: 0, max: 4, value: 3, step: 1 },
            p: { sym: 'prepass', name: 'depth prepass', values: [0, 1], labels: ['no', 'yes'], index: 1 },
            mv: { sym: 'mv', name: 'motion vector pass', values: [0, 1], labels: ['no', 'yes'], index: 1 },
            o: { sym: 'far', name: 'share of plants beyond the wind fade distance', min: 0, max: 0.95, value: 0.6, step: 0.01 } },
    out: { sym: 'runs', unit: 'million', f: v => inv(v) / 1e6 },
    sub: (v, n) => `about <b>${n(inv(v) / 1e6)} million</b> wind evaluations per frame. Every pass that draws the plant runs the vertex shader again, so the shadow cascades and the prepass multiply the wind cost; switching wind off beyond a distance removes most of it (the 0.85 assumes the far plants run a much cheaper vertex shader)`,
    plot: { x: 'o' }
  });
})();
