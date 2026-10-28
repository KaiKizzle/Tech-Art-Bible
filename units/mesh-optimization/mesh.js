/* Mesh Optimization: Hidden Faces and Vertex Counts — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num, clamp } = A;

  /* ---------- what a mesh costs ---------- */
  const gpuV = v => v.T / 2 * (1 + v.s);
  const vsRuns = v => Math.max(gpuV(v), v.T * v.acmr);
  A.fx('meshcost', {
    title: 'GPU vertices, memory and vertex shader work for one mesh',
    expr: 'GPU vertices ≈ {T} / 2 · (1 + {s}),   memory = vertices · {b} B,   vertex shader runs ≈ {T} · {acmr}',
    vars: { T: { sym: 'T', name: 'triangles', min: 100, max: 2000000, value: 20000, log: true },
            s: { sym: 's', name: 'extra vertices from seams, hard edges and material borders', min: 0, max: 1.5, value: 0.4, step: 0.05 },
            b: { sym: 'b', name: 'bytes per vertex (position, normal, tangent, UVs, colour)', values: [20, 28, 36, 44, 52], index: 2 },
            acmr: { sym: 'ACMR', name: 'average cache miss ratio of the index order (0.5 best, 3 worst)', min: 0.5, max: 3, value: 0.85, step: 0.05 } },
    out: [{ sym: 'GPU vertices', f: gpuV, color: 'accent' }, { sym: 'vertex shader runs', f: vsRuns, color: 'ray' }],
    sub: (v, n) => `a closed mesh has about half as many positions as triangles; seams and hard edges turn them into <b>${num(Math.round(gpuV(v)))}</b> GPU vertices, <b>${n(gpuV(v) * v.b / 1024)} KB</b> of vertex data. With this index order the vertex shader runs about <b>${num(Math.round(vsRuns(v)))}</b> times per draw and pass`,
    plot: { x: 'T', logY: true }
  });

  /* ---------- hidden faces ---------- */
  const savedTris = v => v.N * v.T * v.h * v.P;
  A.fx('hidden', {
    title: 'Triangles saved by deleting faces nobody sees',
    expr: 'saved per frame = {N} · {T} · {h} · {P}',
    vars: { N: { sym: 'N', name: 'placed copies of the module visible in a frame', min: 1, max: 5000, value: 300, log: true },
            T: { sym: 'T', name: 'triangles per module', min: 50, max: 50000, value: 2500, log: true },
            h: { sym: 'h', name: 'share of the triangles that can never be seen', min: 0, max: 0.6, value: 0.2, step: 0.01 },
            P: { sym: 'P', name: 'passes that draw it (main view, depth prepass, shadow cascades)', min: 1, max: 6, value: 4, step: 1 } },
    out: { sym: 'saved', unit: 'M triangles', f: v => savedTris(v) / 1e6 },
    sub: (v, n) => `deleting ${n(v.h * 100)} % of each module removes <b>${n(savedTris(v) / 1e6)} M</b> triangles per frame. Back-face culling would have discarded many of them, but only after their vertices were shaded in every pass, and the vertex data stays in memory either way`,
    plot: { x: 'h' }
  });

  /* ---------- how many viewpoints a visibility test needs ---------- */
  const miss = v => Math.pow(1 - v.q, v.k);
  const need = v => Math.ceil(Math.log(v.e) / Math.log(1 - v.q));
  A.fx('vissample', {
    title: 'Viewpoints needed so a visible triangle is not deleted by mistake',
    expr: 'P(miss) = (1 − {q})<sup>{k}</sup>,   viewpoints for P(miss) ≤ {e}:  k = ln {e} / ln(1 − {q})',
    vars: { q: { sym: 'q', name: 'share of the reachable area from which the triangle can be seen', min: 0.002, max: 0.5, value: 0.02, log: true },
            k: { sym: 'k', name: 'random viewpoints tested', min: 8, max: 4096, value: 128, log: true },
            e: { sym: 'ε', name: 'acceptable chance of a wrong deletion', values: [0.1, 0.01, 0.001], labels: ['10 %', '1 %', '0.1 %'], index: 1 } },
    out: [{ sym: 'P(miss)', unit: '%', f: v => miss(v) * 100, color: 'bad' }],
    sub: (v, n) => `a triangle visible from ${n(v.q * 100)} % of the play space is missed by all ${num(Math.round(v.k))} viewpoints with a chance of <b>${n(miss(v) * 100)} %</b>; for ${v.e * 100} % you need about <b>${num(need(v))}</b> viewpoints. Faces seen only through a gap or from one corner need the most samples, so place viewpoints along the paths players use, not only at random`,
    plot: { x: 'k', y: [0, 100] }
  });

  /* ---------- segments for a round silhouette ---------- */
  const rpx = v => v.r * v.H / (2 * v.d * Math.tan(v.fov * Math.PI / 360));
  const segs = v => { const R = rpx(v); if (R <= v.err) return 3; return Math.max(3, Math.ceil(Math.PI / Math.acos(1 - v.err / R))); };
  A.fx('segments', {
    title: 'Sides a round silhouette needs on screen',
    expr: 'radius on screen R = {r} · {H} / (2 · {d} · tan({fov}/2)),   sides n = ⌈π / acos(1 − {err} / R)⌉',
    vars: { r: { sym: 'r', name: 'radius of the round part', unit: 'm', min: 0.01, max: 5, value: 0.15, log: true },
            d: { sym: 'd', name: 'camera distance', unit: 'm', min: 0.3, max: 200, value: 4, log: true },
            fov: { sym: 'fov', name: 'vertical field of view', unit: '°', min: 30, max: 100, value: 60, step: 1 },
            H: { sym: 'H', name: 'screen height', unit: 'px', values: [720, 1080, 1440, 2160], index: 1 },
            err: { sym: 'e', name: 'allowed silhouette error', unit: 'px', min: 0.25, max: 4, value: 1, step: 0.25 } },
    out: { sym: 'sides', f: segs },
    sub: (v, n) => `the part is <b>${n(rpx(v))} px</b> in radius on screen; <b>${segs(v)}</b> sides keep the outline within ${n(v.err)} px of a true circle. More sides than that only add vertices; fewer show corners. Each LOD needs its own answer at its switch distance`,
    draw(ctx, W, H, v, X) {
      const ns = segs(v), cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.38;
      ctx.strokeStyle = alpha(col('muted'), 0.6); ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.fillStyle = alpha(col('accent'), 0.12); ctx.beginPath();
      for (let i = 0; i <= ns; i++) { const a = i / ns * Math.PI * 2 - Math.PI / 2; const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.fill(); ctx.stroke();
      X.label(ctx, `${ns} sides (drawn at a fixed size)`, 10, H - 10, col('muted'));
    },
    plot: { x: 'd', logY: true }, size: [300, 260]
  });

  /* ---------- triangulation and quad efficiency (rasterised for real) ---------- */
  const cache = {};
  function layouts(n) {
    const P = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; P.push([Math.cos(a), Math.sin(a)]); }
    const C = [0, 0];
    const fan = []; for (let i = 0; i < n; i++) fan.push([C, P[i], P[(i + 1) % n]]);
    const strip = []; let lo = 1, hi = n - 1, a0 = 0, side = 0;   // zigzag across the circle
    const order = [0]; while (lo <= hi) { order.push(side ? hi-- : lo++); side ^= 1; }
    for (let i = 0; i + 2 < order.length; i++) strip.push([P[order[i]], P[order[i + 1]], P[order[i + 2]]]);
    const max = [];   // Humus: start with the largest triangle, then recursively fill each arc with its largest triangle
    const third = Math.round(n / 3), t0 = 0, t1 = third, t2 = Math.round(2 * n / 3);
    max.push([P[t0], P[t1], P[t2]]);
    const arc = (i, j) => { if (j - i < 2) return; const m = Math.round((i + j) / 2); max.push([P[i % n], P[m % n], P[j % n]]); arc(i, m); arc(m, j); };
    arc(t0, t1); arc(t1, t2); arc(t2, n);
    return { fan, strip, max };
  }
  function shade(tris, R) {
    let covered = 0, lanes = 0; const S = Math.ceil(R) + 2;
    for (const t of tris) {
      const p = t.map(q => [q[0] * R + S, q[1] * R + S]);
      const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]); if (Math.abs(area) < 1e-9) continue;
      const sg = area > 0 ? 1 : -1;
      const x0 = Math.floor(Math.min(p[0][0], p[1][0], p[2][0])), x1 = Math.ceil(Math.max(p[0][0], p[1][0], p[2][0]));
      const y0 = Math.floor(Math.min(p[0][1], p[1][1], p[2][1])), y1 = Math.ceil(Math.max(p[0][1], p[1][1], p[2][1]));
      const quads = new Set();
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5; let inside = true;
        for (let e = 0; e < 3 && inside; e++) { const a = p[e], b = p[(e + 1) % 3]; const w = ((b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0])) * sg;
          if (w < 0 || (w === 0 && !((b[1] - a[1]) * sg < 0 || ((b[1] - a[1]) === 0 && (b[0] - a[0]) * sg > 0)))) inside = false; }
        if (inside) { covered++; quads.add((x >> 1) + ',' + (y >> 1)); }
      }
      lanes += quads.size * 4;
    }
    return { covered, lanes, eff: lanes ? covered / lanes : 0 };
  }
  function eff(kind, n, R) { const key = kind + n + '|' + R; if (!(key in cache)) cache[key] = shade(layouts(n)[kind], R).eff; return cache[key]; }
  A.fx('triang', {
    title: 'Three triangulations of the same disc: useful share of shaded lanes',
    expr: 'useful = pixels / (4 · quads),   radius {R} px,   {n} rim vertices',
    vars: { n: { sym: 'n', name: 'vertices around the rim', values: [8, 12, 16, 24, 32, 48, 64, 96], index: 4 },
            R: { sym: 'R', name: 'disc radius on screen', unit: 'px', values: [12, 24, 48, 96, 160], index: 2 },
            show: { sym: 'shown', name: 'layout in the picture', values: [0, 1, 2], labels: ['fan from the centre', 'zigzag strip', 'max area'], index: 0 } },
    out: [{ sym: 'fan', unit: '%', f: v => eff('fan', v.n, v.R) * 100, color: 'bad' },
          { sym: 'strip', unit: '%', f: v => eff('strip', v.n, v.R) * 100, color: 'ax-y' },
          { sym: 'max area', unit: '%', f: v => eff('max', v.n, v.R) * 100, color: 'accent' }],
    sub: (v, n) => `same pixels, same vertices: the fan wastes <b>${n(100 - eff('fan', v.n, v.R) * 100)} %</b> of its shading lanes, the strip ${n(100 - eff('strip', v.n, v.R) * 100)} %, max area <b>${n(100 - eff('max', v.n, v.R) * 100)} %</b>. The difference grows with the vertex count and shrinks with the size on screen. Rasterised here pixel by pixel, the way the GPU counts 2 × 2 quads`,
    draw(ctx, W, H, v, X) {
      const L = layouts(v.n)[['fan', 'strip', 'max'][v.show]], cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.42;
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 1;
      L.forEach((t, i) => { ctx.fillStyle = alpha(col(i % 2 ? 'accent' : 'ray'), 0.18); ctx.beginPath(); t.forEach((q, j) => { const x = cx + q[0] * R, y = cy + q[1] * R; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.fill(); ctx.stroke(); });
      X.label(ctx, ['fan: every triangle touches the centre', 'strip: long slivers across the disc', 'max area: big triangles first'][v.show], 10, H - 10, col('muted'));
    },
    plot: { x: 'n', y: [0, 100] }, size: [300, 280]
  });

  /* ---------- vertex order ---------- */
  A.fx('acmr', {
    title: 'Vertex cache: shader runs per triangle',
    expr: 'vertex shader runs = {T} · {acmr},   ATVR = runs / GPU vertices = {T} · {acmr} / {V}',
    vars: { T: { sym: 'T', name: 'triangles', min: 1000, max: 1000000, value: 50000, log: true },
            V: { sym: 'V', name: 'GPU vertices', min: 500, max: 600000, value: 32000, log: true },
            acmr: { sym: 'ACMR', name: 'cache misses per triangle', values: [0.55, 0.7, 1.0, 1.5, 3.0], labels: ['0.55 grid, optimised', '0.7 optimised', '1.0', '1.5 poor', '3.0 no reuse'], index: 1 } },
    out: [{ sym: 'runs', f: v => v.T * v.acmr, color: 'ray' }, { sym: 'ATVR', f: v => v.T * v.acmr / v.V, color: 'accent' }],
    sub: (v, n) => `<b>${num(Math.round(v.T * v.acmr))}</b> vertex shader runs for ${num(Math.round(v.V))} vertices: each vertex is shaded <b>${n(v.T * v.acmr / v.V)}</b> times on average (1.0 is ideal). The order of the index buffer decides this, not the modelling`,
    plot: { x: 'T', logY: true }
  });
})();
