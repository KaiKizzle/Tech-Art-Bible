/* Layered Tiling Materials and Decals — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num, clamp } = A;

  /* ---------- unique against tiling + masks ---------- */
  const uni = v => v.A * v.D * v.D * v.b * 4 / 3 / 1048576;
  const til = v => (v.L * v.S * v.S * v.b * 4 / 3 + v.A * v.Dm * v.Dm * 1 * 4 / 3) / 1048576;
  A.fx('scale', {
    title: 'Memory: unique textures against tiling materials with masks',
    expr: 'unique = {A} m² · {D}² · {b} B · 4/3,   tiling = {L} · {S}² · {b} B · 4/3 + {A} m² · {Dm}² · 1 B · 4/3 (masks)',
    vars: { A: { sym: 'A', name: 'surface area in the loaded part of the level', unit: 'm²', min: 100, max: 1e6, value: 2e4, log: true },
            D: { sym: 'D', name: 'texel density', unit: 'px/m', values: [256, 512, 1024], index: 1 },
            b: { sym: 'b', name: 'bytes per texel for a full material (colour, normal, masks; compressed)', values: [2, 3], index: 1 },
            L: { sym: 'L', name: 'tiling materials in the library', min: 5, max: 200, value: 40, log: true },
            S: { sym: 'S', name: 'tiling texture size', unit: 'px', values: [1024, 2048], index: 1 },
            Dm: { sym: 'D<sub>m</sub>', name: 'density of unique blend masks (0 = vertex colour only)', unit: 'px/m', values: [0, 16, 32, 64], index: 1 } },
    out: [{ sym: 'unique', unit: 'MB', f: uni, color: 'bad' }, { sym: 'tiling + masks', unit: 'MB', f: til, color: 'accent' }],
    sub: (v, n) => `unique texturing of ${num(v.A)} m² at ${v.D} px/m needs <b>${n(uni(v) / 1024)} GB</b>; ${num(Math.round(v.L))} tiling materials plus ${v.Dm ? `${v.Dm} px/m masks` : 'vertex colours'} need <b>${n(til(v))} MB</b>. Unique memory grows with the area, tiling memory with the size of the library`,
    plot: { x: 'A', logY: true }
  });

  /* ---------- how close detail holds up ---------- */
  const dHold = (D, v) => v.H / (2 * D * Math.tan(v.fov * Math.PI / 360));
  A.fx('closeup', {
    title: 'Closest distance at which a texture still has a texel per pixel',
    expr: 'd = {H} / (2 · density · tan({fov}/2)),   unique {Du} px/m,   tiling detail {Dt} px/m',
    vars: { Du: { sym: 'D<sub>u</sub>', name: 'texel density of the unique (baked) texture', unit: 'px/m', values: [128, 256, 512, 1024], index: 2 },
            Dt: { sym: 'D<sub>t</sub>', name: 'texel density of the tiling detail layer', unit: 'px/m', values: [1024, 2048, 4096, 8192], index: 2 },
            H: { sym: 'H', name: 'screen height', unit: 'px', values: [1080, 1440, 2160], index: 0 },
            fov: { sym: 'fov', name: 'vertical field of view', unit: '°', min: 40, max: 90, value: 60, step: 1 } },
    out: [{ sym: 'unique holds to', unit: 'm', f: v => dHold(v.Du, v), color: 'bad' }, { sym: 'detail holds to', unit: 'm', f: v => dHold(v.Dt, v), color: 'accent' }],
    sub: (v, n) => `the unique texture runs out of texels closer than <b>${n(dHold(v.Du, v))} m</b>; a tiling detail layer at ${v.Dt} px/m holds up to <b>${n(dHold(v.Dt, v) * 100)} cm</b>. That is how a baked module stays sharp under close inspection: the bake carries the large forms, the tiling layers carry the fine detail, and the masks decide where each layer shows`,
    plot: false
  });

  /* ---------- vertex colour resolution ---------- */
  A.fx('vcres', {
    title: 'Vertex colour as a mask: how fine can it be?',
    expr: 'smallest painted feature ≈ 2 · {s},   vertices per m² ≈ (100 / {s})²',
    vars: { s: { sym: 's', name: 'vertex spacing on the surface', unit: 'cm', min: 5, max: 200, value: 50, log: true },
            f: { sym: 'f', name: 'smallest blend shape you want to paint', unit: 'cm', min: 5, max: 200, value: 30, log: true } },
    out: [{ sym: 'smallest feature', unit: 'cm', f: v => 2 * v.s, color: 'ray' }, { sym: 'vertices per m² needed', f: v => Math.pow(100 / (v.f / 2), 2), color: 'accent' }],
    sub: (v, n) => `with vertices every ${n(v.s)} cm, painted blends cannot be smaller than about <b>${n(2 * v.s)} cm</b>, and their edges follow the triangles. For ${n(v.f)} cm shapes the surface needs about <b>${num(Math.round(Math.pow(200 / v.f, 2)))}</b> vertices per m². Height-modulated blending is what makes coarse vertex paint look detailed: the texture, not the vertices, draws the edge`,
    plot: { x: 's', logY: true }
  });

  /* ---------- combined repeat of several tiling scales ---------- */
  const n2 = x => (Math.round(x * 10) / 10).toString();
  function period(v) {
    const p = [v.p1, v.p2, v.p3].filter(x => x > 0), base = p[0];
    for (let k = 1; k <= 4000; k++) { const L = k * base; if (p.every(q => { const r = L / q; return Math.abs(r - Math.round(r)) < v.tol; })) return L; }
    return 4000 * base;
  }
  A.fx('period', {
    title: 'When do several tiling layers repeat together?',
    expr: 'L / p<sub>i</sub> ≈ whole number (± {tol}) for all i,   tiles {p1}, {p2}, {p3}',
    vars: { p1: { sym: 'p₁', name: 'tile size of the base material', unit: 'm', min: 0.5, max: 4, value: 2, step: 0.05 },
            p2: { sym: 'p₂', name: 'tile size of the blend mask', unit: 'm', min: 0.5, max: 12, value: 3.23, step: 0.01 },
            p3: { sym: 'p₃', name: 'tile size of a third layer (0 = none)', unit: 'm', min: 0, max: 30, value: 7.9, step: 0.1 },
            tol: { sym: 'δ', name: 'how close counts as the same (share of a tile)', min: 0.01, max: 0.15, value: 0.04, step: 0.01 } },
    out: { sym: 'L', unit: 'm', f: period },
    sub: (v, n) => { const L = period(v); return `the layers line up again only every <b>${n(L)} m</b>, ${n(L / v.p1)} base tiles. ${L >= 4000 * v.p1 ? 'Effectively never inside a level.' : L < 4 * v.p1 ? 'Simple ratios (2 : 1, 3 : 2) repeat almost as soon as the base.' : 'Every spot in between combines the layers differently.'} Ratios that are not simple fractions, and masks that are rotated or projected in world space, push this beyond any level size`; },
    draw(ctx, W, H, v, X) {
      const L = Math.min(period(v), 60), span = Math.max(L * 1.15, v.p1 * 6), sc = (W - 20) / span, ys = [30, 70, 110];
      const strip = (p, y, c) => { if (!(p > 0)) return; for (let x = 0; x < span; x += p) { ctx.fillStyle = alpha(col(c), 0.25); ctx.fillRect(10 + x * sc, y, Math.max(1, p * sc - 2), 24); ctx.fillStyle = col(c); ctx.fillRect(10 + x * sc, y, 2, 24); } };
      strip(v.p1, ys[0], 'accent'); strip(v.p2, ys[1], 'ray'); strip(v.p3, ys[2], 'ax-y');
      if (period(v) <= span) { ctx.strokeStyle = col('bad'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10 + L * sc, 20); ctx.lineTo(10 + L * sc, 145); ctx.stroke(); }
      X.label(ctx, `tile starts of each layer over ${n2(span)} m; red: they line up again`, 10, H - 10, col('muted'));
    },
    plot: false, size: [640, 180]
  });

  /* ---------- decal cost ---------- */
  A.fx('decalcost', {
    title: 'Pixel work for projected decals',
    expr: 'work = {P} M pixels · {o} decals per pixel · {c} ns,   mesh decals: + their geometry, no volume test',
    vars: { P: { sym: 'P', name: 'pixels covered by decals', unit: 'M', min: 0.1, max: 8.3, value: 1.5, step: 0.1 },
            o: { sym: 'o', name: 'decals overlapping on average where there are any', min: 1, max: 8, value: 2, step: 0.5 },
            c: { sym: 'c', name: 'cost per decal per pixel (volume test, samples, blend)', unit: 'ns', min: 0.05, max: 1, value: 0.2, step: 0.01 } },
    out: { sym: 'time', unit: 'ms', f: v => v.P * v.o * v.c },
    sub: (v, n) => `about <b>${n(v.P * v.o * v.c)} ms</b> for ${n(v.P)} M decal pixels with ${n(v.o)} decals each. Overlap is the multiplier to watch: stacked dirt, leaks and stains on the same wall each pay for every pixel they cover. Assumed costs; profile with the decal pass in a GPU capture`,
    plot: { x: 'o' }
  });

  /* ---------- layer cost ---------- */
  A.fx('layercost', {
    title: 'Texture samples per pixel for a layered material',
    expr: 'all layers: {L} · {m} + {q},   limited to {k} per pixel: {k} · {m} + {q}',
    vars: { L: { sym: 'L', name: 'layers in the material', min: 1, max: 8, value: 4, step: 1 },
            k: { sym: 'k', name: 'layers allowed per pixel (per triangle)', min: 1, max: 4, value: 2, step: 1 },
            m: { sym: 'm', name: 'maps per layer', min: 1, max: 4, value: 3, step: 1 },
            q: { sym: 'q', name: 'mask and macro samples', min: 0, max: 4, value: 2, step: 1 } },
    out: [{ sym: 'all layers', f: v => v.L * v.m + v.q, color: 'bad' }, { sym: 'limited', f: v => Math.min(v.k, v.L) * v.m + v.q, color: 'accent' }],
    sub: (v, n) => `sampling every layer everywhere costs <b>${v.L * v.m + v.q}</b> samples per pixel; limiting each triangle to ${Math.min(v.k, v.L)} layers (and skipping layers whose weight is zero) costs <b>${Math.min(v.k, v.L) * v.m + v.q}</b>. id Software's vertex-painting tool allows 4 materials per asset and 2 per triangle for this reason`,
    plot: { x: 'L' }
  });
})();
