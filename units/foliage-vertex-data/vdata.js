/* Foliage Vertex Data — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num } = A;
  const rad = d => d * Math.PI / 180;
  const rot = (p, c, a) => { const s = Math.sin(a), k = Math.cos(a), x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * k - y * s, c[1] + x * s + y * k]; };

  /* ---------- the right pivot ---------- */
  const BASE = [0.0, 2.2], TIP = [1.8, 3.4];   // metres, object space, trunk at x = 0
  A.fx('pivot', {
    title: 'Rotating a branch around the right point',
    expr: 'p′ = R({a}) · (p − pivot) + pivot,   pivot = {pv}',
    vars: { a: { sym: 'θ', name: 'sway angle', unit: '°', min: -35, max: 35, value: 20, step: 1 },
            pv: { sym: 'pivot', name: 'rotation centre', values: [0, 1], labels: ['object origin', 'branch base'], index: 0 } },
    out: { sym: 'gap at the trunk', unit: 'cm', f: v => { const c = v.pv ? BASE : [0, 0], b = rot(BASE, c, rad(v.a)); return Math.hypot(b[0] - BASE[0], b[1] - BASE[1]) * 100; } },
    sub: (v, n) => { const c = v.pv ? BASE : [0, 0], b = rot(BASE, c, rad(v.a)); const g = Math.hypot(b[0] - BASE[0], b[1] - BASE[1]) * 100; return v.pv ? `rotating around its own base, the branch stays attached: gap <b>${n(g)} cm</b>` : `rotating around the object origin, the branch base moves <b>${n(g)} cm</b> away from the trunk`; },
    draw(ctx, W, H, v, X) {
      const s = (H - 40) / 4, ox = W * 0.32, oy = H - 16, P = p => [ox + p[0] * s, oy - p[1] * s];
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(...P([0, 0])); ctx.lineTo(...P([0, 3.8])); ctx.stroke();
      ctx.strokeStyle = alpha(col('muted'), 0.6); ctx.lineWidth = 4; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(...P(BASE)); ctx.lineTo(...P(TIP)); ctx.stroke(); ctx.setLineDash([]);
      const c = v.pv ? BASE : [0, 0], b = rot(BASE, c, rad(v.a)), t = rot(TIP, c, rad(v.a));
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(...P(b)); ctx.lineTo(...P(t)); ctx.stroke();
      X.dot(ctx, ...P(c), col('bad'), 5); X.label(ctx, 'pivot', P(c)[0] + 8, P(c)[1] - 8, col('bad'));
    },
    plot: { x: 'a' }, size: [380, 260]
  });

  /* ---------- memory per vertex ---------- */
  const bpv = v => 48 + (v.c ? 4 : 0) + v.k * (v.f / 8);
  A.fx('vbytes', {
    title: 'Vertex size with extra data',
    expr: 'bytes per vertex = 48 + {c} + {k} · {f} / 8,   memory = {V} · bytes',
    vars: { V: { sym: 'V', name: 'vertices (all LODs of one tree)', min: 1000, max: 1000000, value: 60000, log: true },
            c: { sym: 'colour', name: 'vertex colour (RGBA8)', values: [0, 4], labels: ['off', 'on'], index: 1 },
            k: { sym: 'k', name: 'extra floats in UV channels', min: 0, max: 16, value: 6, step: 1 },
            f: { sym: 'bits', name: 'precision of the extra floats', values: [16, 32], labels: ['16-bit half', '32-bit float'], index: 1 } },
    out: [{ sym: 'bytes per vertex', f: bpv, color: 'accent' }, { sym: 'MB', f: v => v.V * bpv(v) / 1048576, color: 'ray' }],
    sub: (v, n) => `${n(bpv(v))} bytes per vertex (48 for position, normal, tangent and UV0), <b>${n(v.V * bpv(v) / 1048576)} MB</b> for this tree. Shared by every instance: vertex data is per mesh, not per copy.`,
    plot: { x: 'k' }
  });

  /* ---------- precision ---------- */
  const err = v => {
    const S = v.S;
    if (v.f === 0) return S / 255 / 2 * 1000;
    if (v.f === 1) return S / 65535 / 2 * 1000;
    if (v.f === 2) return Math.pow(2, Math.floor(Math.log2(S)) - 10) / 2 * 1000;
    return Math.pow(2, Math.floor(Math.log2(S)) - 23) / 2 * 1000;
  };
  A.fx('precision', {
    title: 'Worst rounding error of a stored pivot',
    expr: 'error = range / (2<sup>bits</sup> − 1) / 2 (normalised),   ulp(x) / 2 (floats),   tree size {S},   format {f}',
    vars: { S: { sym: 'S', name: 'largest coordinate (tree height or radius)', unit: 'm', min: 0.5, max: 60, value: 18, log: true },
            f: { sym: 'format', name: 'storage', values: [0, 1, 2, 3], labels: ['8-bit colour', '16-bit normalised', '16-bit half float', '32-bit float'], index: 2 } },
    out: { sym: 'error', unit: 'mm', f: err },
    sub: (v, n) => `worst error <b>${n(err(v))} mm</b>. ${err(v) > 5 ? 'Visible: branches wobble or detach by that much when they rotate.' : 'Fine for wind.'} Normalised formats need the range (the bounds) to decode.`,
    plot: { x: 'S', logY: true }
  });

  /* ---------- how many UV channels ---------- */
  const floats = v => v.L * v.p + v.e;
  A.fx('layout', {
    title: 'UV channels needed for a hierarchy',
    expr: 'floats = {L} · {p} + {e},   channels = ⌈floats / 2⌉ (float2) or ⌈floats / 4⌉ (float4)',
    vars: { L: { sym: 'L', name: 'hierarchy levels that move on their own', min: 1, max: 4, value: 2, step: 1 },
            p: { sym: 'per level', name: 'data per level', values: [3, 4, 7], labels: ['pivot', 'pivot + phase', 'pivot + axis + length'], index: 1 },
            e: { sym: 'e', name: 'extra per-vertex values (not in vertex colour)', min: 0, max: 4, value: 0, step: 1 } },
    out: [{ sym: 'float2 channels', f: v => Math.ceil(floats(v) / 2), color: 'accent' }, { sym: 'float4 channels', f: v => Math.ceil(floats(v) / 4), color: 'ray' }],
    sub: (v, n) => `${floats(v)} floats: <b>${Math.ceil(floats(v) / 2)}</b> extra UV channels in Unreal (2 components each), <b>${Math.ceil(floats(v) / 4)}</b> in Unity if you use all 4 components`,
    plot: { x: 'L' }
  });

  /* ---------- hierarchy: children first ---------- */
  const T0 = [0, 0], B0 = [0, 2.0], B1 = [1.6, 3.0], C0 = [1.0, 2.62], C1 = [1.2, 3.6];
  function pose(v, wrong) {
    const ab = rad(v.b), at = rad(v.t);
    // child (twig) around its base on the branch, then branch around its base, then trunk around the ground
    let c0 = C0, c1 = rot(C1, C0, ab * 1.4);
    let b0 = B0, b1 = rot(B1, B0, ab); if (!wrong) { c0 = rot(c0, B0, ab); c1 = rot(c1, B0, ab); }
    b0 = rot(b0, T0, at); b1 = rot(b1, T0, at); c0 = rot(c0, T0, at); c1 = rot(c1, T0, at);
    const top = rot([0, 3.9], T0, at);
    return { b0, b1, c0, c1, top };
  }
  A.fx('hierarchy', {
    title: 'A child follows its parent',
    expr: 'p′ = R<sub>trunk</sub>( R<sub>branch</sub>( R<sub>twig</sub>(p − c) + c − b ) + b ),   trunk {t},   branch {b},   {o}',
    vars: { t: { sym: 'θ<sub>trunk</sub>', name: 'trunk bend', unit: '°', min: -15, max: 15, value: -8, step: 1 },
            b: { sym: 'θ<sub>branch</sub>', name: 'branch sway', unit: '°', min: -30, max: 30, value: 18, step: 1 },
            o: { sym: 'order', name: 'twig rotation', values: [0, 1], labels: ['through the branch, then the trunk', 'skips the branch'], index: 0 } },
    out: { sym: 'twig gap', unit: 'cm', f: v => { const p = pose(v, v.o === 1), q = pose(v, false); return Math.hypot(p.c0[0] - q.c0[0], p.c0[1] - q.c0[1]) * 100; } },
    sub: (v, n) => { const p = pose(v, v.o === 1), q = pose(v, false), g = Math.hypot(p.c0[0] - q.c0[0], p.c0[1] - q.c0[1]) * 100; return v.o ? `the twig ignores the branch's rotation and floats <b>${n(g)} cm</b> away from it: each level must apply its parents' rotations too` : 'each level is rotated by its own pivot, then carried by every parent: the twig stays on the branch'; },
    draw(ctx, W, H, v, X) {
      const s = (H - 30) / 4.2, ox = W * 0.35, oy = H - 12, P = p => [ox + p[0] * s, oy - p[1] * s], q = pose(v, v.o === 1);
      const seg = (a, b, c, w) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(...P(a)); ctx.lineTo(...P(b)); ctx.stroke(); };
      seg(T0, q.top, col('ink'), 8); seg(q.b0, q.b1, col('ray'), 5); seg(q.c0, q.c1, col('accent'), 3);
      X.dot(ctx, ...P(q.b0), col('ray'), 4); X.dot(ctx, ...P(q.c0), col('accent'), 4);
      X.label(ctx, 'trunk', P(q.top)[0] - 10, P(q.top)[1], col('muted'), 'right'); X.label(ctx, 'branch', P(q.b1)[0] + 8, P(q.b1)[1], col('ray')); X.label(ctx, 'twig', P(q.c1)[0] + 8, P(q.c1)[1], col('accent'));
    },
    plot: { x: 'b' }, size: [380, 260]
  });

  /* ---------- data in textures (Pivot Painter 2) ---------- */
  A.fx('pptex', {
    title: 'Element data in textures',
    expr: 'texels = {n},   side ≈ ⌈√{n}⌉,   memory = side² · ({a} + {b}) bytes',
    vars: { n: { sym: 'n', name: 'elements (branches, twigs, leaves)', min: 10, max: 30000, value: 2400, log: true },
            a: { sym: 'pos', name: 'bytes per texel, position texture', values: [4, 8], labels: ['RGBA8', 'RGBA16F'], index: 1 },
            b: { sym: 'axis', name: 'bytes per texel, axis texture', values: [4, 8], labels: ['RGBA8', 'RGBA16F'], index: 0 } },
    out: [{ sym: 'side', unit: 'px', f: v => Math.ceil(Math.sqrt(v.n)), color: 'accent' }, { sym: 'KB', f: v => Math.pow(Math.ceil(Math.sqrt(v.n)), 2) * (v.a + v.b) / 1024, color: 'ray' }],
    sub: (v, n) => `${num(v.n)} elements fit in about <b>${Math.ceil(Math.sqrt(v.n))} × ${Math.ceil(Math.sqrt(v.n))}</b> texels per texture, <b>${n(Math.pow(Math.ceil(Math.sqrt(v.n)), 2) * (v.a + v.b) / 1024)} KB</b> in total. The mesh then only needs one UV channel holding each vertex's element index.`,
    plot: { x: 'n', logY: true }
  });
})();
