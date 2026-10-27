/* Skinned and Baked Foliage Animation — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num, clamp } = A;
  const TAU = Math.PI * 2;

  /* ---------- skinning cost ---------- */
  A.fx('skin', {
    title: 'What skinning a forest costs per frame',
    expr: 'matrix blends = {V} · {k} · {N},   bone data = {B} · 48 bytes · {N}',
    vars: { V: { sym: 'V', name: 'vertices per plant', min: 200, max: 50000, value: 4000, log: true },
            k: { sym: 'k', name: 'bone influences per vertex', min: 1, max: 4, value: 2, step: 1 },
            N: { sym: 'N', name: 'animated plants on screen', min: 1, max: 20000, value: 300, log: true },
            B: { sym: 'B', name: 'bones per plant', min: 4, max: 400, value: 60, log: true } },
    out: [{ sym: 'million vertex·bone blends', f: v => v.V * v.k * v.N / 1e6, color: 'accent' }, { sym: 'MB of bone matrices', f: v => v.B * 48 * v.N / 1048576, color: 'ray' }],
    sub: (v, n) => `<b>${n(v.V * v.k * v.N / 1e6)} M</b> weighted matrix transforms per pass, plus <b>${n(v.B * 48 * v.N / 1048576)} MB</b> of bone matrices to update and upload every frame. Procedural wind needs neither: its data is in the mesh.`,
    plot: { x: 'N', logY: true }
  });

  /* ---------- a branch as a damped spring ---------- */
  function sim(v) {
    const w0 = TAU * v.f, z = v.z, dt = 1 / 240, out = []; let x = 0, u = 0;
    for (let i = 0; i <= 240 * 4; i++) { const t = i * dt, F = (t > 0.25 && t < 0.25 + v.g) ? 1 : 0; const a = w0 * w0 * (F - x) - 2 * z * w0 * u; u += a * dt; x += u * dt; out.push(x); }
    return out;
  }
  const over = v => v.z < 1 ? Math.exp(-v.z * Math.PI / Math.sqrt(1 - v.z * v.z)) * 100 : 0;
  A.fx('spring', {
    title: 'A branch as a damped spring, hit by a gust',
    expr: 'x″ = ω² (F − x) − 2 {z} ω x′,   ω = 2π · {f},   gust lasts {g}',
    vars: { f: { sym: 'f', name: 'natural frequency of the branch', unit: 'Hz', min: 0.2, max: 4, value: 0.8, step: 0.05 },
            z: { sym: 'ζ', name: 'damping ratio', min: 0.02, max: 1.2, value: 0.15, step: 0.01 },
            g: { sym: 'gust', name: 'gust duration', unit: 's', min: 0.1, max: 3, value: 1.2, step: 0.05 } },
    out: { sym: 'overshoot', unit: '%', f: over },
    sub: (v, n) => `the branch overshoots by <b>${n(over(v))} %</b> and ${v.z < 0.3 ? 'rings for several swings after the gust' : v.z < 1 ? 'settles within a swing or two' : 'creeps back without swinging'}. Thin branches: higher f, lower damping; trunks: low f, high damping`,
    draw(ctx, W, H, v, X) {
      const s = sim(v), y0 = H - 24, sy = (H - 50) / 1.8;
      ctx.strokeStyle = col('line'); ctx.beginPath(); ctx.moveTo(10, y0); ctx.lineTo(W - 10, y0); ctx.stroke();
      ctx.fillStyle = alpha(col('ray'), 0.15); ctx.fillRect(10 + 0.25 / 4 * (W - 20), y0 - sy, v.g / 4 * (W - 20), sy); X.label(ctx, 'gust', 14 + 0.25 / 4 * (W - 20), y0 - sy - 8, col('ray'));
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath();
      s.forEach((x, i) => { const px = 10 + i / (s.length - 1) * (W - 20), py = y0 - x * sy; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke();
      X.label(ctx, '4 s', W - 10, H - 8, col('muted'), 'right'); X.label(ctx, 'deflection', 12, 14, col('accent'));
    },
    plot: { x: 'z', y: [0, 100] }, size: [480, 220]
  });

  /* ---------- VAT texture size ---------- */
  const vat = v => { const w = Math.min(v.V, v.Wm), rows = Math.ceil(v.V / v.Wm), h = rows * v.F; return { w, h, rows, mb: w * h * (8 + v.n) / 1048576 }; };
  A.fx('vatsize', {
    title: 'Vertex animation texture size',
    expr: 'width = min({V}, {Wm}),   rows per frame = ⌈{V} / {Wm}⌉,   height = rows · {F},   memory = w · h · (8 + {n}) bytes',
    vars: { V: { sym: 'V', name: 'vertices animated', min: 100, max: 60000, value: 5000, log: true },
            F: { sym: 'F', name: 'frames baked', min: 10, max: 600, value: 120, log: true },
            Wm: { sym: 'w<sub>max</sub>', name: 'maximum texture width', values: [2048, 4096, 8192], index: 1 },
            n: { sym: 'normals', name: 'bytes per texel for normals', values: [0, 4, 8], labels: ['none', 'RGBA8', 'RGBA16F'], index: 1 } },
    out: [{ sym: 'height', unit: 'px', f: v => vat(v).h, color: 'accent' }, { sym: 'MB', f: v => vat(v).mb, color: 'ray' }],
    sub: (v, n) => { const r = vat(v); return `${r.w} × ${r.h} texels (${r.rows} row${r.rows > 1 ? 's' : ''} per frame), <b>${n(r.mb)} MB</b> with 16-bit positions${v.n ? ' and normals' : ''}. Uncompressed: the data must stay exact`; },
    plot: { x: 'F', logY: true }
  });

  /* ---------- soft body against rigid pieces ---------- */
  const soft = v => v.V * v.F * 12, rigid = v => v.P * v.F * 16;
  A.fx('rigid', {
    title: 'Soft-body against rigid-piece VAT for a falling tree',
    expr: 'soft = {V} · {F} · 12 bytes,   rigid = {P} · {F} · 16 bytes (position + rotation)',
    vars: { V: { sym: 'V', name: 'vertices', min: 1000, max: 100000, value: 20000, log: true },
            P: { sym: 'P', name: 'rigid pieces (trunk segments, branches)', min: 1, max: 2000, value: 120, log: true },
            F: { sym: 'F', name: 'frames', min: 30, max: 600, value: 150, log: true } },
    out: [{ sym: 'soft MB', f: v => soft(v) / 1048576, color: 'ray' }, { sym: 'rigid MB', f: v => rigid(v) / 1048576, color: 'accent' }],
    sub: (v, n) => `soft body stores every vertex every frame: <b>${n(soft(v) / 1048576)} MB</b>; rigid pieces store one position and rotation per piece: <b>${n(rigid(v) / 1048576)} MB</b> (${n(soft(v) / rigid(v))}× less), if the motion really is rigid`,
    plot: { x: 'P', logY: true }
  });

  /* ---------- frame interpolation ---------- */
  const steps = v => TAU * v.f / v.r;
  A.fx('interp', {
    title: 'Playback error between baked frames',
    expr: 'Δφ = 2π · {f} / {r},   nearest frame: 2R sin(Δφ / 4),   lerp of two frames: R (1 − cos(Δφ / 2)),   R = {R}',
    vars: { r: { sym: 'fps', name: 'frames baked per second', min: 5, max: 60, value: 15, step: 1 },
            f: { sym: 'f', name: 'frequency of the motion', unit: 'Hz', min: 0.1, max: 3, value: 0.6, step: 0.05 },
            R: { sym: 'R', name: 'radius of the swing', unit: 'cm', min: 1, max: 200, value: 40, log: true } },
    out: [{ sym: 'nearest', unit: 'cm', f: v => 2 * v.R * Math.sin(steps(v) / 4), color: 'bad' }, { sym: 'lerp', unit: 'cm', f: v => v.R * (1 - Math.cos(steps(v) / 2)), color: 'accent' }],
    sub: (v, n) => `snapping to the nearest frame is off by up to <b>${n(2 * v.R * Math.sin(steps(v) / 4))} cm</b> and stutters; blending the two neighbouring frames (two texture reads) cuts it to <b>${n(v.R * (1 - Math.cos(steps(v) / 2)))} cm</b>, a slight shortening on curves`,
    plot: { x: 'r', logY: true }
  });
})();
