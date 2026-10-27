/* Foliage LODs, Impostors and Budgets — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num, clamp } = A;
  const rad = d => d * Math.PI / 180, TAN30 = Math.tan(rad(30));
  const screen = (h, d) => h / (2 * d * TAN30);   // fraction of the screen height

  /* ---------- an LOD chain ---------- */
  function lodAt(v, d) { const s = screen(12, d); let i = 0; while (i < v.L - 1 && s < 0.6 * Math.pow(0.5, i)) i++; return { i, s, tris: v.T * Math.pow(v.r, i) }; }
  A.fx('chain', {
    title: 'Triangles of a 12 m tree by distance',
    expr: 'triangles = {T} · {r}<sup>i</sup>,   LOD i when screen size &lt; 0.6 · 0.5<sup>i</sup>,   {L} levels,   distance {d}',
    vars: { T: { sym: 'T<sub>0</sub>', name: 'triangles of LOD0', min: 2000, max: 200000, value: 40000, log: true },
            r: { sym: 'r', name: 'kept per level', min: 0.2, max: 0.8, value: 0.45, step: 0.01 },
            L: { sym: 'L', name: 'LOD levels (the last can be an impostor)', min: 1, max: 6, value: 4, step: 1 },
            d: { sym: 'd', name: 'distance', unit: 'm', min: 2, max: 600, value: 60, log: true } },
    out: { sym: 'triangles', f: v => { const r = lodAt(v, v.d); return r.i === v.L - 1 && v.L > 2 ? Math.min(r.tris, 2) : r.tris; } },
    sub: (v, n) => { const r = lodAt(v, v.d); const imp = r.i === v.L - 1 && v.L > 2; return `at ${n(v.d)} m the tree fills ${n(r.s * 100)} % of the screen height and draws <b>LOD${r.i}</b>${imp ? ' (an impostor: 2 triangles)' : ': ' + num(r.tris) + ' triangles'}`; },
    plot: { x: 'd', logY: true }
  });

  /* ---------- LOD count against draws and batches ---------- */
  const mem = v => (1 - Math.pow(v.r, v.L)) / (1 - v.r);
  A.fx('count', {
    title: 'What the number of LODs does to draws and batches',
    expr: 'per-object draws = {N} · {m} · {P} · (1 + {f}),   instanced batches = {L} · {m} · {P},   mesh memory = Σ {r}<sup>i</sup>',
    vars: { N: { sym: 'N', name: 'visible instances of one tree type', min: 10, max: 50000, value: 3000, log: true },
            L: { sym: 'L', name: 'LOD levels in use', min: 1, max: 8, value: 4, step: 1 },
            m: { sym: 'm', name: 'materials per LOD', min: 1, max: 3, value: 2, step: 1 },
            P: { sym: 'P', name: 'passes (main, prepass, shadow cascades)', min: 1, max: 6, value: 4, step: 1 },
            f: { sym: 'f', name: 'share of instances cross-fading', min: 0, max: 0.3, value: 0.08, step: 0.01 },
            r: { sym: 'r', name: 'triangles kept per LOD', min: 0.2, max: 0.8, value: 0.5, step: 0.01 } },
    out: [{ sym: 'per-object draws', f: v => v.N * v.m * v.P * (1 + v.f), color: 'bad' }, { sym: 'instanced batches', f: v => v.L * v.m * v.P, color: 'accent' }],
    sub: (v, n) => `drawn one by one, ${num(v.N)} trees cost <b>${num(Math.round(v.N * v.m * v.P * (1 + v.f)))}</b> draws whatever the LOD count (each tree draws one LOD; cross-fading ones draw two). Instanced, they cost <b>${v.L * v.m * v.P}</b> batches: one per LOD level, material and pass, so every extra LOD adds ${v.m * v.P}. Mesh memory: ${n(mem(v))}× LOD0`,
    plot: { x: 'L', logY: true }
  });

  /* ---------- when a switch pops ---------- */
  const pop = v => v.e / 100 * 1080 / (2 * v.d * TAN30);
  A.fx('pop', {
    title: 'How visible an LOD switch is',
    expr: 'error on screen = {e} · 1080 / (2 · {d} · tan 30°)',
    vars: { e: { sym: 'e', name: 'largest shape change between the two LODs', unit: 'cm', min: 1, max: 200, value: 30, log: true },
            d: { sym: 'd', name: 'switch distance', unit: 'm', min: 2, max: 500, value: 40, log: true } },
    out: { sym: 'error', unit: 'px', f: pop },
    sub: (v, n) => `a ${n(v.e)} cm change at ${n(v.d)} m moves <b>${n(pop(v))} px</b> at 1080p: ${pop(v) < 1.5 ? 'invisible even without a fade' : pop(v) < 6 ? 'a soft pop; a cross-fade hides it' : 'a clear pop: switch later or make the LODs closer'}`,
    plot: { x: 'd', logY: true }
  });

  /* ---------- billboards ---------- */
  A.fx('billboard', {
    title: 'Billboard views: angular error and texture cost',
    expr: 'worst error = 360° / (2 · {n}),   texture = {n} · {R}²',
    vars: { n: { sym: 'n', name: 'captured views around the tree', min: 1, max: 16, value: 8, step: 1 },
            R: { sym: 'res', name: 'resolution per view', values: [128, 256, 512], index: 1 } },
    out: [{ sym: 'worst error', unit: '°', f: v => 180 / v.n, color: 'bad' }, { sym: 'MB (BC7 colour + normal)', f: v => v.n * v.R * v.R * 2 * 4 / 3 / 1048576, color: 'ray' }],
    sub: (v, n) => `${v.n} views: the camera can be up to <b>${n(180 / v.n)}°</b> away from the nearest captured one, which shows as the tree changing shape when you walk around it. Viewed from above, side views collapse into a line`,
    plot: { x: 'n', y: [0, 180] }
  });

  /* ---------- hemi-octahedral impostors ---------- */
  function enc(az, el) { const d = [Math.cos(rad(el)) * Math.cos(rad(az)), Math.sin(rad(el)), Math.cos(rad(el)) * Math.sin(rad(az))]; const s = Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]); const p = [d[0] / s, d[2] / s]; return [(p[0] + p[1]) * 0.5 + 0.5, (p[0] - p[1]) * 0.5 + 0.5]; }
  function dec(u, w) { const a = u * 2 - 1, b = w * 2 - 1, px = (a + b) / 2, pz = (a - b) / 2, y = 1 - Math.abs(px) - Math.abs(pz); const l = Math.hypot(px, y, pz); return [px / l, y / l, pz / l]; }
  function octa(v) {
    const uv = enc(v.az, v.el), N = v.N, cx = clamp(Math.floor(uv[0] * N), 0, N - 1), cy = clamp(Math.floor(uv[1] * N), 0, N - 1);
    const c0 = dec((cx + 0.5) / N, (cy + 0.5) / N), c1 = dec((Math.min(cx + 1, N - 1) + 0.5) / N, (cy + 0.5) / N);
    const ang = Math.acos(clamp(c0[0] * c1[0] + c0[1] * c1[1] + c0[2] * c1[2], -1, 1)) * 180 / Math.PI;
    return { uv, cx, cy, ang };
  }
  A.fx('octa', {
    title: 'Hemi-octahedral impostor: which frame a view uses',
    expr: 'p = d.xz / (|d.x| + |d.y| + |d.z|),   uv = (p.x + p.z, p.x − p.z) / 2 + ½,   frame = ⌊uv · {N}⌋,   azimuth {az}, elevation {el}',
    vars: { N: { sym: 'N', name: 'frames per side', min: 4, max: 32, value: 12, step: 1 },
            az: { sym: 'az', name: 'camera azimuth', unit: '°', min: 0, max: 360, value: 40, step: 1 },
            el: { sym: 'el', name: 'camera elevation', unit: '°', min: 0, max: 90, value: 20, step: 1 },
            R: { sym: 'R', name: 'impostor texture size', values: [1024, 2048, 4096], index: 1 } },
    out: [{ sym: 'frame spacing', unit: '°', f: v => 180 / (v.N - 1), color: 'accent' }, { sym: 'pixels per frame', f: v => v.R / v.N, color: 'ray' }],
    sub: (v, n) => { const o = octa(v); return `frame (${o.cx}, ${o.cy}) of ${v.N}×${v.N}; neighbouring frames are about <b>${n(o.ang)}°</b> apart here (${n(180 / (v.N - 1))}° on average) and each has <b>${Math.floor(v.R / v.N)} px</b>. The shader blends the three nearest frames, so the tree turns smoothly`; },
    draw(ctx, W, H, v, X) {
      const S = Math.min(W, H) - 30, x0 = (W - S) / 2, y0 = 12, N = v.N, o = octa(v);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const d = dec((i + 0.5) / N, (j + 0.5) / N); ctx.fillStyle = alpha(col('accent'), 0.08 + 0.35 * d[1]); ctx.fillRect(x0 + i * S / N + 0.5, y0 + j * S / N + 0.5, S / N - 1, S / N - 1); }
      ctx.strokeStyle = col('bad'); ctx.lineWidth = 2.5; ctx.strokeRect(x0 + o.cx * S / N, y0 + o.cy * S / N, S / N, S / N);
      X.dot(ctx, x0 + o.uv[0] * S, y0 + o.uv[1] * S, col('bad'), 4);
      X.label(ctx, 'centre = straight down from above; edges = horizon', x0, H - 4, col('muted'));
    },
    plot: { x: 'N', logY: true }, size: [300, 300]
  });

  /* ---------- leaves below a pixel ---------- */
  const lp = v => v.s / 100 * 1080 / (2 * v.d * TAN30);
  A.fx('subpixel', {
    title: 'When a leaf is smaller than a pixel',
    expr: 'leaf size on screen = {s} · 1080 / (2 · {d} · tan 30°)',
    vars: { s: { sym: 's', name: 'leaf size', unit: 'cm', min: 1, max: 40, value: 8, log: true },
            d: { sym: 'd', name: 'distance', unit: 'm', min: 1, max: 1000, value: 60, log: true } },
    out: { sym: 'leaf', unit: 'px', f: lp },
    sub: (v, n) => `a ${n(v.s)} cm leaf covers <b>${n(lp(v))} px</b> at ${n(v.d)} m. ${lp(v) < 1 ? 'Below a pixel, individual leaves only cause aliasing and wasted triangles: what remains visible is the crown\'s coverage and colour, which impostors and voxels represent directly' : 'Individual leaves still read; geometry or cards are worth their cost'}`,
    plot: { x: 'd', logY: true }
  });

  /* ---------- a scene budget ---------- */
  function scene(v) {
    const area = Math.PI * v.D * v.D * (60 / 360) * 1.6;          // a 60° view cone with some margin for shadows
    const trees = area / 10000 * v.th, grassA = Math.PI * v.gr * v.gr * (60 / 360) * 1.6, grass = grassA * v.gd;
    return { trees, grass, tris: (trees * v.tt + grass * v.gt) / 1e6 };
  }
  A.fx('budget', {
    title: 'A visible-foliage budget',
    expr: 'trees = view area · {th} / ha,   grass = near area · {gd} / m²,   triangles = trees · {tt} + grass · {gt}',
    vars: { th: { sym: 'ρ<sub>trees</sub>', name: 'trees per hectare', min: 10, max: 1500, value: 300, log: true },
            D: { sym: 'D', name: 'tree draw distance', unit: 'm', min: 100, max: 3000, value: 800, log: true },
            tt: { sym: 't<sub>tree</sub>', name: 'average triangles per visible tree (after LODs)', min: 2, max: 20000, value: 600, log: true },
            gd: { sym: 'ρ<sub>grass</sub>', name: 'grass clumps per m²', min: 0, max: 20, value: 4, step: 0.5 },
            gr: { sym: 'r<sub>grass</sub>', name: 'grass draw distance', unit: 'm', min: 10, max: 200, value: 60, log: true },
            gt: { sym: 't<sub>grass</sub>', name: 'triangles per grass clump', min: 2, max: 200, value: 24, log: true } },
    out: [{ sym: 'million triangles', f: v => scene(v).tris, color: 'accent' }],
    sub: (v, n) => { const s = scene(v); return `about <b>${num(Math.round(s.trees))}</b> trees and <b>${num(Math.round(s.grass))}</b> grass clumps in view, <b>${n(s.tris)} M</b> triangles before shadows. Compare with the budget your platform affords for foliage, and see which term dominates`; },
    plot: { x: 'tt', logY: true }
  });
})();
