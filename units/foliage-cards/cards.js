/* Foliage Cards, Overdraw and Atlases — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num, clamp } = A;

  /* ---------- overdraw cost per pixel ---------- */
  const harm = k => { let h = 0; for (let i = 1; i <= Math.max(1, Math.round(k)); i++) h += 1 / i; return h; };
  function od(v) {
    const passing = Math.max(1, v.d * v.c);
    const shaded = v.o === 0 ? 1 : v.o === 1 ? harm(passing) : passing;
    const without = v.d * v.a + shaded * v.s;
    const withP = v.d * v.a + v.d * 0.15 + 1 * v.s;           // prepass: alpha-only shader on every layer, then one shaded fragment
    return { shaded, without, withP };
  }
  A.fx('overdraw', {
    title: 'Shader work per pixel under layered leaf cards',
    expr: 'work = {d} · {a} (alpha test) + shaded layers · {s},   passing layers = {d} · {c},   order {o}',
    vars: { d: { sym: 'd', name: 'cards covering the pixel (depth complexity)', min: 1, max: 20, value: 8, step: 1 },
            c: { sym: 'c', name: 'share of card pixels that pass the alpha test', min: 0.1, max: 1, value: 0.45, step: 0.01 },
            a: { sym: 'a', name: 'cost of the alpha test part (texture read, clip)', min: 1, max: 20, value: 4, step: 1 },
            s: { sym: 's', name: 'cost of full shading', min: 10, max: 200, value: 60, step: 1 },
            o: { sym: 'order', name: 'draw order of the cards', values: [0, 1, 2], labels: ['front to back', 'random', 'back to front'], index: 1 } },
    out: [{ sym: 'without prepass', f: v => od(v).without, color: 'bad' }, { sym: 'with prepass', f: v => od(v).withP, color: 'accent' }],
    sub: (v, n) => { const r = od(v); return `of ${n(v.d)} card layers, ${n(v.d * v.c)} pass the alpha test and about <b>${n(r.shaded)}</b> get fully shaded before the nearest one wins: <b>${n(r.without)}</b> units per pixel, against <b>${n(r.withP)}</b> with a depth prepass that leaves exactly one shaded fragment`; },
    plot: { x: 'd' }
  });

  /* ---------- tight cutouts ---------- */
  const polyFill = n => (Math.PI / n) / Math.tan(Math.PI / n);         // circle area / circumscribed regular n-gon area
  const waste = v => 1 - v.f * polyFill(v.n);
  A.fx('cutout', {
    title: 'Card outline: vertices against transparent pixels',
    expr: 'transparent share = 1 − {f} · (π/{n}) / tan(π/{n}),   vertices per card = {n}',
    vars: { n: { sym: 'n', name: 'vertices around the card', min: 3, max: 16, value: 4, step: 1 },
            f: { sym: 'f', name: 'how much of the cluster\'s outline the leaves fill', min: 0.3, max: 1, value: 0.65, step: 0.01 } },
    out: [{ sym: 'transparent pixels', unit: '%', f: v => waste(v) * 100, color: 'bad' }],
    sub: (v, n) => `a ${v.n}-vertex outline leaves <b>${n(waste(v) * 100)} %</b> of the card's pixels transparent; every one of them still runs the alpha test. ${v.n <= 4 ? 'Adding vertices around the outline is usually cheaper than those pixels.' : 'Beyond about 8 vertices the saving flattens while the vertex cost keeps growing.'}`,
    draw(ctx, W, H, v, X) {
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36, Rp = R / Math.cos(Math.PI / v.n);
      ctx.fillStyle = alpha(col('bad'), 0.12); ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= v.n; i++) { const a = (i + 0.5) / v.n * Math.PI * 2; const x = cx + Math.cos(a) * Rp, y = cy + Math.sin(a) * Rp; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = alpha(col('accent'), 0.85);
      for (let i = 0; i < 140; i++) { const a = i * 2.39996, r = R * Math.sqrt((i + 0.5) / 140); if ((i * 7919 % 100) / 100 > v.f + 0.2) continue; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 7, 3.5, a, 0, 7); ctx.fill(); }
      X.label(ctx, 'red: pixels that run the shader and are discarded', 10, H - 8, col('muted'));
    },
    plot: { x: 'n', y: [0, 80] }, size: [320, 280]
  });

  /* ---------- does a depth prepass pay? ---------- */
  const pre = v => { const extra = v.V * 1e6 * v.cv * 1e-9 * 1e3, saved = v.P * 1e6 * (v.k - 1) * v.cs * 1e-9 * 1e3; return { extra, saved }; };
  A.fx('prepass', {
    title: 'Depth prepass: extra geometry against saved shading',
    expr: 'extra = {V} M vertices · {cv} ns,   saved = {P} M pixels · ({k} − 1) · {cs} ns',
    vars: { V: { sym: 'V', name: 'foliage vertices per frame', unit: 'M', min: 0.5, max: 40, value: 8, log: true },
            cv: { sym: 'c<sub>v</sub>', name: 'cost per vertex in the prepass (with wind)', unit: 'ns', min: 0.05, max: 1, value: 0.2, step: 0.01 },
            P: { sym: 'P', name: 'pixels covered by foliage', unit: 'M', min: 0.2, max: 8.3, value: 3, step: 0.1 },
            k: { sym: 'k', name: 'fully shaded layers per pixel without prepass', min: 1, max: 6, value: 2.5, step: 0.1 },
            cs: { sym: 'c<sub>s</sub>', name: 'cost of shading one fragment', unit: 'ns', min: 0.05, max: 1, value: 0.25, step: 0.01 } },
    out: [{ sym: 'saved − extra', unit: 'ms', f: v => { const r = pre(v); return r.saved - r.extra; } }],
    sub: (v, n) => { const r = pre(v); return `the prepass costs about <b>${n(r.extra)} ms</b> of extra vertex work and saves <b>${n(r.saved)} ms</b> of shading: ${r.saved > r.extra ? 'worth it' : 'not worth it here'}. Rough throughput numbers: measure on the target GPU`; },
    plot: { x: 'k' }
  });

  /* ---------- shadow casters ---------- */
  const sh = v => v.N * v.T * v.c * v.ov * v.s / 1e6;
  A.fx('shadows', {
    title: 'Triangles drawn into shadow maps',
    expr: 'shadow triangles = {N} · {T} · {c} · {ov} · {s}',
    vars: { N: { sym: 'N', name: 'shadow-casting plants near the camera', min: 100, max: 100000, value: 8000, log: true },
            T: { sym: 'T', name: 'triangles per plant (LOD in use)', min: 50, max: 20000, value: 1500, log: true },
            c: { sym: 'c', name: 'cascades', min: 1, max: 4, value: 3, step: 1 },
            ov: { sym: 'share', name: 'share of plants inside each cascade', min: 0.1, max: 1, value: 0.5, step: 0.01 },
            s: { sym: 'proxy', name: 'shadow mesh size relative to the visible LOD', min: 0.1, max: 1, value: 1, step: 0.05 } },
    out: { sym: 'shadow triangles', unit: 'million', f: sh },
    sub: (v, n) => `<b>${n(sh(v))} M</b> triangles per frame only for shadows, each alpha-tested if the caster uses its leaf texture. Cheaper shadow meshes, fewer cascades for grass and no shadows from small plants cut this directly`,
    plot: { x: 's' }
  });

  /* ---------- atlas strategy ---------- */
  function atl(v) {
    const tex = v.R * v.R * 2 * 4 / 3 / 1048576;                          // BC7 colour + BC5 normal, with mips
    if (v.m === 0) return { mats: v.S, mb: v.S * tex, dens: 1 };
    if (v.m === 1) { const n = Math.ceil(v.S / v.k); return { mats: n, mb: n * tex, dens: 1 / Math.sqrt(v.k) }; }
    return { mats: 1, mb: v.S * tex, dens: 1 };
  }
  A.fx('atlas', {
    title: 'Leaf atlases: one per species, shared, or a texture array',
    expr: '{S} species,   {m},   {k} species per shared atlas,   atlas size {R}',
    vars: { S: { sym: 'S', name: 'species in the biome', min: 1, max: 30, value: 12, step: 1 },
            m: { sym: 'layout', name: 'texture layout', values: [0, 1, 2], labels: ['one atlas per species', 'shared atlases', 'texture array'], index: 1 },
            k: { sym: 'k', name: 'species sharing one atlas', min: 1, max: 12, value: 4, step: 1 },
            R: { sym: 'size', name: 'atlas size', values: [1024, 2048, 4096], index: 1 } },
    out: [{ sym: 'leaf materials', f: v => atl(v).mats, color: 'accent' }, { sym: 'MB', f: v => atl(v).mb, color: 'ray' }, { sym: 'texel density', f: v => atl(v).dens, color: 'ax-y' }],
    sub: (v, n) => { const r = atl(v); return `<b>${r.mats}</b> leaf material${r.mats > 1 ? 's' : ''} (each a separate batch per LOD), <b>${n(r.mb)} MB</b> of leaf textures, texel density ×${n(r.dens)}. ${v.m === 1 ? 'Sharing trades sharpness for fewer batches.' : v.m === 2 ? 'An array keeps each species at full resolution with one material, at the cost of a slice index per vertex or instance.' : 'Simplest to author; one material per species.'}`; },
    plot: { x: 'S' }
  });
})();
