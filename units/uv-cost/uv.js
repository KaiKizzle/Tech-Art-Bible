/* UV Layout and Cost — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num, clamp } = A;

  /* ---------- vertex stride ---------- */
  const stride = v => v.base + v.n * v.uvf + v.c;
  A.fx('stride', {
    title: 'Bytes per vertex and the share taken by UVs',
    expr: 'stride = {base} + {n} · {uvf} + {c} bytes,   memory = {V} · stride',
    vars: { base: { sym: 'base', name: 'position, normal and tangent', values: [40, 24, 16], labels: ['40 B: all 32-bit floats', '24 B: 32-bit position, 16-bit normal and tangent', '16 B: 32-bit position, packed normal and tangent'], index: 0 },
            n: { sym: 'n', name: 'UV channels', min: 1, max: 8, value: 2, step: 1 },
            uvf: { sym: 'UV', name: 'UV format', values: [8, 4], labels: ['32-bit float (8 B)', '16-bit float (4 B)'], index: 0 },
            c: { sym: 'colour', name: 'vertex colour', values: [0, 4], labels: ['none', '4 B'], index: 1 },
            V: { sym: 'V', name: 'GPU vertices in memory (all loaded meshes)', min: 1e5, max: 1e8, value: 2e7, log: true } },
    out: [{ sym: 'stride', unit: 'B', f: stride, color: 'accent' }, { sym: 'UV share', unit: '%', f: v => v.n * v.uvf / stride(v) * 100, color: 'ray' }],
    sub: (v, n) => `<b>${stride(v)} bytes</b> per vertex, ${n(v.n * v.uvf / stride(v) * 100)} % of it UVs: <b>${n(v.V * stride(v) / 1048576)} MB</b> for ${num(v.V)} vertices. Every pass that draws the mesh fetches this data again, so the stride is bandwidth too, not only memory`,
    plot: { x: 'n' }
  });

  /* ---------- half-float UV precision ---------- */
  const spacing = v => Math.pow(2, Math.floor(Math.log2(Math.max(v.U, 1e-6))) - 10);
  A.fx('half', {
    title: '16-bit UVs: rounding error in texels',
    expr: 'step between half floats near u = 2<sup>⌊log₂ {U}⌋ − 10</sup>,   worst error = step / 2 · {S} texels',
    vars: { U: { sym: 'u', name: 'largest UV value in the mesh', min: 0.5, max: 512, value: 16, log: true },
            S: { sym: 'S', name: 'texture size', unit: 'px', values: [512, 1024, 2048, 4096], index: 2 } },
    out: { sym: 'error', unit: 'texels', f: v => spacing(v) / 2 * v.S },
    sub: (v, n) => { const e = spacing(v) / 2 * v.S; return `a 16-bit float has 11 significant bits, so near u = ${n(v.U)} neighbouring values are ${n(spacing(v))} apart: UVs can be off by up to <b>${n(e)} texels</b> of a ${v.S} px texture. ${e < 0.1 ? 'Invisible.' : e < 0.5 ? 'Small, but visible as wobble on fine, high-contrast patterns.' : 'Visible: texels snap and patterns break at triangle edges. Keep the UVs near 0 or store this channel at 32 bits.'}`; },
    plot: { x: 'U', logY: true }
  });

  /* ---------- seams in every channel ---------- */
  const gv = v => v.V * (1 + v.h + v.s0 + v.s1 * (1 - v.a));
  A.fx('union', {
    title: 'GPU vertices with seams in two UV channels',
    expr: 'GPU vertices ≈ {V} · (1 + {h} + {s0} + {s1} · (1 − {a}))',
    vars: { V: { sym: 'V', name: 'positions', min: 500, max: 200000, value: 10000, log: true },
            h: { sym: 'h', name: 'extra vertices from hard edges not on seams', min: 0, max: 0.5, value: 0.05, step: 0.01 },
            s0: { sym: 's₀', name: 'extra vertices from UV0 seams', min: 0, max: 0.8, value: 0.3, step: 0.01 },
            s1: { sym: 's₁', name: 'extra vertices from lightmap (UV1) seams', min: 0, max: 0.8, value: 0.25, step: 0.01 },
            a: { sym: 'a', name: 'share of UV1 seams that lie on UV0 seams', min: 0, max: 1, value: 0.3, step: 0.01 } },
    out: { sym: 'GPU vertices', f: gv },
    sub: (v, n) => `about <b>${num(Math.round(gv(v)))}</b> GPU vertices for ${num(v.V)} positions; the lightmap UVs alone add ${n(v.s1 * (1 - v.a) * 100)} %. Lightmap seams placed on the existing UV0 seams cost nothing extra; automatic lightmap unwraps rarely do that`,
    plot: { x: 'a' }
  });

  /* ---------- packing efficiency ---------- */
  A.fx('pack', {
    title: 'Packing efficiency: texels paid for and texels used',
    expr: 'wasted = (1 − {p}) · {S}² texels,   effective density = √{p} of a perfect pack,   memory per material = {S}² · {m} B · 4/3',
    vars: { p: { sym: 'p', name: 'share of the UV square covered by islands', min: 0.3, max: 0.95, value: 0.65, step: 0.01 },
            S: { sym: 'S', name: 'texture size', unit: 'px', values: [1024, 2048, 4096], index: 1 },
            m: { sym: 'm', name: 'bytes per texel for the whole material (all maps, compressed)', values: [2, 3, 4], labels: ['2 B (2 BC7/BC5 maps)', '3 B (3 maps)', '4 B (4 maps)'], index: 1 } },
    out: [{ sym: 'wasted', unit: 'MB', f: v => (1 - v.p) * v.S * v.S * v.m * 4 / 3 / 1048576, color: 'bad' }, { sym: 'effective density', unit: '%', f: v => Math.sqrt(v.p) * 100, color: 'accent' }],
    sub: (v, n) => `${n((1 - v.p) * 100)} % of the texture is padding and gaps: <b>${n((1 - v.p) * v.S * v.S * v.m * 4 / 3 / 1048576)} MB</b> of this material holds nothing. The islands get ${n(Math.sqrt(v.p) * 100)} % of the texel density a perfect pack would give; going from ${n(v.p * 100)} % to 80 % packing ${v.p < 0.8 ? `raises density by ${n((Math.sqrt(0.8 / v.p) - 1) * 100)} % at the same size` : 'gains little more'}`,
    plot: { x: 'p' }
  });

  /* ---------- interpolators ---------- */
  A.fx('varyings', {
    title: 'Interpolators written per frame on a tile-based GPU',
    expr: 'bytes = {V} M vertices · {k} · 16 B,   bandwidth = bytes · {fps}',
    vars: { V: { sym: 'V', name: 'vertices after culling per frame', unit: 'M', min: 0.1, max: 10, value: 1.5, log: true },
            k: { sym: 'k', name: 'float4 interpolators per vertex (UVs, normal, tangent, colour …)', min: 2, max: 12, value: 5, step: 1 },
            fps: { sym: 'fps', name: 'frame rate', values: [30, 60, 120], index: 1 } },
    out: { sym: 'bandwidth', unit: 'GB/s', f: v => v.V * 1e6 * v.k * 16 * v.fps / 1e9 },
    sub: (v, n) => `${n(v.V * v.k * 16)} MB of vertex outputs per frame, <b>${n(v.V * 1e6 * v.k * 16 * v.fps / 1e9)} GB/s</b> at ${v.fps} fps. Tile-based mobile GPUs write these outputs to memory between the geometry and pixel phases, so each interpolator removed saves bandwidth there; desktop GPUs keep them on chip and care much less`,
    plot: { x: 'k' }
  });
})();
