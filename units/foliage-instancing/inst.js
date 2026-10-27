/* Foliage Rendering and Instancing — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num, clamp } = A;

  /* ---------- draws per frame ---------- */
  const per = v => v.T * v.N * v.m * v.P;
  const inst = v => v.T * v.L * v.m * v.P * Math.ceil(v.N / v.L / v.k);
  A.fx('draws', {
    title: 'Draws per frame: one by one or instanced',
    expr: 'per object = {T} · {N} · {m} · {P},   instanced = {T} · {L} · {m} · {P} · ⌈{N} / {L} / {k}⌉,   CPU ≈ draws · {c} µs',
    vars: { T: { sym: 'T', name: 'plant types (meshes)', min: 1, max: 60, value: 15, step: 1 },
            N: { sym: 'N', name: 'visible instances per type', min: 10, max: 50000, value: 2000, log: true },
            m: { sym: 'm', name: 'materials per mesh', min: 1, max: 3, value: 2, step: 1 },
            P: { sym: 'P', name: 'passes (main, prepass, shadow cascades)', min: 1, max: 6, value: 4, step: 1 },
            L: { sym: 'L', name: 'LOD levels visible per type', min: 1, max: 5, value: 3, step: 1 },
            k: { sym: 'k', name: 'instances per instanced draw', values: [128, 511, 1023, 100000], labels: ['128', '511', '1023', 'unlimited (indirect)'], index: 2 },
            c: { sym: 'c', name: 'CPU cost per draw call', unit: 'µs', min: 1, max: 40, value: 8, step: 1 } },
    out: [{ sym: 'per-object draws', f: per, color: 'bad' }, { sym: 'instanced draws', f: inst, color: 'accent' }],
    sub: (v, n) => `one by one: <b>${num(per(v))}</b> draws, about <b>${n(per(v) * v.c / 1000)} ms</b> of CPU time; instanced: <b>${num(inst(v))}</b> draws, ${n(inst(v) * v.c / 1000)} ms`,
    plot: { x: 'N', logY: true }
  });

  /* ---------- per-instance data ---------- */
  const bytes = v => v.M + (v.p ? v.M : 0) + v.e;
  A.fx('instdata', {
    title: 'Per-instance data',
    expr: 'bytes = {M} + {p} + {e},   memory = {N} · bytes',
    vars: { N: { sym: 'N', name: 'instances placed in the loaded area', min: 1000, max: 5000000, value: 400000, log: true },
            M: { sym: 'matrix', name: 'transform format', values: [48, 64, 16], labels: ['3 × 4 floats', '4 × 4 floats', 'position + scale + rotation, 16 bytes'], index: 0 },
            p: { sym: 'prev', name: 'previous transform for motion vectors (same size)', values: [0, 1], labels: ['no (static instances)', 'yes (moving instances)'], index: 0 },
            e: { sym: 'e', name: 'extra bytes (colour, phase, LOD fade)', min: 0, max: 32, value: 8, step: 4 } },
    out: { sym: 'MB', f: v => v.N * bytes(v) / 1048576 },
    sub: (v, n) => `${bytes(v)} bytes per instance, <b>${n(v.N * bytes(v) / 1048576)} MB</b> for ${num(v.N)} instances. Static foliage needs no previous transform; packing position, uniform scale and a yaw angle into 16 bytes and building the matrix in the shader cuts it further`,
    plot: { x: 'N', logY: true }
  });

  /* ---------- GPU-driven culling ---------- */
  A.fx('gpucull', {
    title: 'Culling instances on the CPU or the GPU',
    expr: 'CPU = {N} · {c} ns,   GPU compute = {N} · {g} ns',
    vars: { N: { sym: 'N', name: 'instances tested per frame', min: 1000, max: 5000000, value: 500000, log: true },
            c: { sym: 'c', name: 'CPU cost per instance (bounds test, LOD pick, list append)', unit: 'ns', min: 5, max: 200, value: 30, log: true },
            g: { sym: 'g', name: 'GPU cost per instance in a compute pass', unit: 'ns', min: 0.05, max: 5, value: 0.3, log: true } },
    out: [{ sym: 'CPU', unit: 'ms', f: v => v.N * v.c / 1e6, color: 'bad' }, { sym: 'GPU', unit: 'ms', f: v => v.N * v.g / 1e6, color: 'accent' }],
    sub: (v, n) => `testing ${num(v.N)} instances costs about <b>${n(v.N * v.c / 1e6)} ms</b> on one CPU thread or <b>${n(v.N * v.g / 1e6)} ms</b> as a compute pass, which then writes the visible list and the draw arguments for an indirect draw. Assumed throughputs; measure`,
    plot: { x: 'N', logY: true }
  });

  /* ---------- how many instances survive culling ---------- */
  const vis = v => v.rho * Math.PI * v.D * v.D * (v.f / 360) * (1 - v.o);
  A.fx('cull', {
    title: 'Instances left after frustum, distance and occlusion culling',
    expr: 'visible = {rho} · π · {D}² · ({f} / 360°) · (1 − {o})',
    vars: { rho: { sym: 'ρ', name: 'instances per m²', min: 0.001, max: 50, value: 2, log: true },
            D: { sym: 'D', name: 'cull distance for this type', unit: 'm', min: 10, max: 2000, value: 80, log: true },
            f: { sym: 'fov', name: 'horizontal field of view', unit: '°', min: 40, max: 120, value: 90, step: 1 },
            o: { sym: 'occl', name: 'share hidden by terrain and buildings', min: 0, max: 0.9, value: 0.3, step: 0.01 } },
    out: { sym: 'visible', f: vis },
    sub: (v, n) => `about <b>${num(Math.round(vis(v)))}</b> instances of this type survive. Halving the cull distance quarters the count, which is why grass, flowers and debris each get their own, short distance`,
    plot: { x: 'D', logY: true }
  });

  /* ---------- scattering density ---------- */
  const dens = v => 1 / (v.r * v.r * Math.sqrt(3) / 2) * v.q;
  A.fx('scatter', {
    title: 'Placement density from a minimum spacing',
    expr: 'density ≈ {q} · 2 / (√3 · {r}²),   instances = density · {a} ha · 10 000',
    vars: { r: { sym: 'r', name: 'minimum distance between plants', unit: 'm', min: 0.05, max: 20, value: 0.4, log: true },
            q: { sym: 'q', name: 'fill of a random (Poisson-disc) scatter against perfect packing', min: 0.4, max: 1, value: 0.7, step: 0.01 },
            a: { sym: 'a', name: 'area', unit: 'ha', min: 0.01, max: 100, value: 4, log: true } },
    out: [{ sym: 'per m²', f: dens, color: 'accent' }, { sym: 'instances', f: v => dens(v) * v.a * 10000, color: 'ray' }],
    sub: (v, n) => `${n(dens(v))} plants per m², <b>${num(Math.round(dens(v) * v.a * 10000))}</b> on ${n(v.a)} ha. Dense ground cover is usually generated around the camera at runtime instead of stored`,
    plot: { x: 'r', logY: true }
  });
})();
