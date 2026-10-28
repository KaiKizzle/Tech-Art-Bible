/* Atlases, Texture Arrays and Unique Textures — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num, clamp } = A;

  /* ---------- what sharing a texture saves, per batching method ---------- */
  function counts(v) {
    const shared = v.mode === 1, mats = shared ? 1 : v.M;
    if (v.b === 0) return { draws: v.N, setups: mats };                       // one draw per object, sorted by material
    if (v.b === 1) return { draws: v.N, setups: 1 };                          // SRP Batcher style: per-object draws, cheap material switches
    if (v.b === 2) return { draws: mats, setups: mats };                      // static batching / merged meshes: one draw per material
    const pairs = shared ? v.K : Math.max(v.K, v.M);                          // instancing: one draw per mesh + material pair
    return { draws: pairs, setups: Math.min(pairs, mats) };
  }
  A.fx('batch', {
    title: 'Draws and material setups: separate textures or one shared atlas or array',
    expr: '{N} objects, {K} meshes, {M} texture sets,   texture layout: {mode},   batching: {b}',
    vars: { N: { sym: 'N', name: 'objects in view', min: 10, max: 5000, value: 600, log: true },
            K: { sym: 'K', name: 'different meshes', min: 1, max: 200, value: 20, log: true },
            M: { sym: 'M', name: 'different texture sets (one material each when separate)', min: 1, max: 200, value: 40, log: true },
            mode: { sym: 'layout', name: 'texture layout', values: [0, 1], labels: ['separate materials', 'shared atlas or array, one material'], index: 0 },
            b: { sym: 'method', name: 'how the engine batches', values: [0, 1, 2, 3], labels: ['none, sorted', 'persistent material data (SRP Batcher)', 'static batching / merged meshes', 'GPU instancing'], index: 1 } },
    out: [{ sym: 'draws', f: v => counts(v).draws, color: 'ray' }, { sym: 'material setups', f: v => counts(v).setups, color: 'accent' }],
    sub: (v, n) => { const c = counts(v), o = counts(Object.assign({}, v, { mode: 1 - v.mode })); return `<b>${num(Math.round(c.draws))}</b> draws and <b>${num(Math.round(c.setups))}</b> material setups (${v.mode ? 'separate textures' : 'one shared material'} would give ${num(Math.round(o.draws))} and ${num(Math.round(o.setups))}). ${v.b === 1 ? 'With persistent material data, separate materials are already cheap to switch: sharing textures saves little CPU time here.' : v.b === 2 ? 'Merging meshes is where one shared material pays most: every material is one more merged draw.' : v.b === 3 ? 'Instancing groups by mesh and material, so different meshes stay separate draws either way; a shared array helps when one mesh has several texture variants.' : 'Sorted draws pay one setup per material.'}`; },
    plot: { x: 'M', logY: true }
  });

  /* ---------- atlas mips and padding ---------- */
  A.fx('atlasmip', {
    title: 'Clean mip levels of an atlas tile',
    expr: 'clean mips = ⌊log₂ {p}⌋ + 1 of log₂ {t} + 1,   padding share = 1 − ({t} − 2{p})² / {t}²',
    vars: { t: { sym: 't', name: 'tile size in the atlas', unit: 'px', values: [64, 128, 256, 512, 1024], index: 2 },
            p: { sym: 'p', name: 'padding around each tile', unit: 'px', values: [2, 4, 8, 16, 32], index: 2 } },
    out: [{ sym: 'clean mips', f: v => Math.floor(Math.log2(v.p)) + 1, color: 'accent' }, { sym: 'padding share', unit: '%', f: v => (1 - Math.pow(v.t - 2 * v.p, 2) / (v.t * v.t)) * 100, color: 'bad' }],
    sub: (v, n) => `a ${v.t} px tile has ${Math.log2(v.t) + 1} mip levels, but with ${v.p} px padding only the first <b>${Math.floor(Math.log2(v.p)) + 1}</b> are free of its neighbours' colours; padding takes <b>${n((1 - Math.pow(v.t - 2 * v.p, 2) / (v.t * v.t)) * 100)} %</b> of the tile. Below that mip the tiles bleed into each other, so atlased objects either stop using the smallest mips (clamp the mip level) or accept the bleed at a distance`,
    plot: { x: 'p' }
  });

  /* ---------- texture array memory ---------- */
  A.fx('arraymem', {
    title: 'A texture array stays resident as a whole',
    expr: 'resident = {n} slices · {S}² · {b} B · 4/3,   needed = {k} slices · …',
    vars: { n: { sym: 'n', name: 'slices in the array', min: 2, max: 256, value: 32, log: true },
            k: { sym: 'k', name: 'slices actually visible in the current area', min: 1, max: 256, value: 6, log: true },
            S: { sym: 'S', name: 'slice size', unit: 'px', values: [512, 1024, 2048], index: 1 },
            b: { sym: 'b', name: 'bytes per texel (BC7, BC5 = 1; BC1 = 0.5)', values: [0.5, 1], index: 1 } },
    out: [{ sym: 'resident', unit: 'MB', f: v => v.n * v.S * v.S * v.b * 4 / 3 / 1048576, color: 'bad' }, { sym: 'needed', unit: 'MB', f: v => Math.min(v.k, v.n) * v.S * v.S * v.b * 4 / 3 / 1048576, color: 'accent' }],
    sub: (v, n) => `the array holds <b>${n(v.n * v.S * v.S * v.b * 4 / 3 / 1048576)} MB</b>; the area uses ${num(Math.round(Math.min(v.k, v.n)))} slices worth ${n(Math.min(v.k, v.n) * v.S * v.S * v.b * 4 / 3 / 1048576)} MB. Unity's mipmap streaming does not support texture arrays, so every slice is resident at full resolution. Split large arrays by area or biome`,
    plot: { x: 'k' }
  });

  /* ---------- streaming unique textures ---------- */
  const uniq = v => v.K * v.f * Math.pow(v.s / Math.pow(2, v.m), 2) * v.b * 4 / 3 / 1048576;
  const atl = v => v.K * v.s * v.s * v.b * 4 / 3 / 1048576;
  A.fx('stream', {
    title: 'Memory: streamed unique textures against one resident atlas',
    expr: 'unique ≈ {K} · {f} · ({s} / 2<sup>{m}</sup>)² · {b} B · 4/3,   atlas = {K} · {s}² · {b} B · 4/3',
    vars: { K: { sym: 'K', name: 'props, each with its own texture', min: 4, max: 400, value: 64, log: true },
            s: { sym: 's', name: 'texture size per prop', unit: 'px', values: [256, 512, 1024, 2048], index: 2 },
            f: { sym: 'f', name: 'share of the props near enough to need any detail', min: 0.05, max: 1, value: 0.3, step: 0.01 },
            m: { sym: 'm', name: 'mips dropped on average for those props', min: 0, max: 4, value: 1, step: 0.5 },
            b: { sym: 'b', name: 'bytes per texel', values: [0.5, 1, 2], index: 1 } },
    out: [{ sym: 'unique, streamed', unit: 'MB', f: uniq, color: 'accent' }, { sym: 'atlas, resident', unit: 'MB', f: atl, color: 'bad' }],
    sub: (v, n) => `streamed unique textures need about <b>${n(uniq(v))} MB</b> for what is near the camera; the same texels in an atlas stream as one texture and are resident at <b>${n(atl(v))} MB</b> as soon as any prop on it is close. Streaming works per texture, so the finer the textures, the closer memory follows the view`,
    plot: { x: 'f' }
  });
})();
