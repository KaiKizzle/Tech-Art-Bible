/* Texturing a Game Asset — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;

  /* ---------- UV stretch ---------- */
  A.fx('stretch', {
    title: 'Stretching an island',
    expr: 'aspect = {su} / {sv},   density = √({su} · {sv}) × the target',
    vars: { su: { sym: 's<sub>u</sub>', name: 'island scale along U (1 = correct)', min: 0.25, max: 4, value: 1.6, log: true }, sv: { sym: 's<sub>v</sub>', name: 'island scale along V', min: 0.25, max: 4, value: 1, log: true } },
    out: [{ sym: 'aspect', f: v => v.su / v.sv, color: 'accent' }, { sym: 'density', f: v => Math.sqrt(v.su * v.sv), color: 'ray', fmt: x => num(x) + '×' }],
    draw(ctx, W, H, v, X) {
      const s = Math.min(W / 2 - 30, H - 50), y0 = 16;
      const face = (x0, su, sv, label) => { const n = 6; for (let j = 0; j < Math.ceil(n * sv); j++) for (let i = 0; i < Math.ceil(n * su); i++) { const cw = s / (n * su), ch = s / (n * sv); const x = x0 + i * cw, y = y0 + j * ch; const w = Math.min(cw, x0 + s - x), h = Math.min(ch, y0 + s - y); if (w <= 0 || h <= 0) continue; ctx.fillStyle = (i + j) % 2 ? '#e8e3d8' : '#2b2e34'; ctx.fillRect(x, y, w, h); }
        ctx.strokeStyle = col('line'); ctx.strokeRect(x0, y0, s, s); X.label(ctx, label, x0, y0 + s + 18, col('muted')); };
      face(15, 1, 1, 'correct: square checker'); face(W / 2 + 15, v.su, v.sv, 'this island');
    },
    plot: false, size: [880, 300]
  });

  /* ---------- padding ---------- */
  A.fx('padding', {
    title: 'How far padding protects the mip chain',
    expr: 'clean down to mip ⌊log₂ {p}⌋ of a {t} texture',
    vars: { p: { sym: 'p', name: 'padding in texels', min: 1, max: 64, value: 8, step: 1 }, t: { sym: 'T', name: 'texture size', values: [512, 1024, 2048, 4096], index: 2 } },
    out: { sym: 'last clean mip', f: v => Math.floor(Math.log2(v.p)) },
    sub: v => { const k = Math.floor(Math.log2(v.p)); return `mips 0 to <b>${k}</b> are clean (down to ${v.t >> k} × ${v.t >> k}); from mip ${k + 1} (${v.t >> (k + 1)} px) the background bleeds into the seams`; },
    draw(ctx, W, H, v, X) {
      const levels = Math.log2(v.t) + 1, k = Math.floor(Math.log2(v.p)); let x = 15; const y = H / 2 + 10;
      for (let m = 0; m < Math.min(levels, 12); m++) { const s = Math.max(6, 90 / Math.pow(1.45, m)); ctx.fillStyle = m <= k ? alpha(col('good'), 0.75) : alpha(col('bad'), 0.7); ctx.fillRect(x, y - s, s, s); X.label(ctx, String(m), x + s / 2, y + 16, col('muted'), 'center'); x += s + 8; if (x > W - 20) break; }
      X.label(ctx, 'mip level · green: seams stay clean', 15, 20, col('muted'));
    },
    plot: { x: 'p', y: [0, 7] }
  });

  /* ---------- texel density ---------- */
  const dens = v => v.t * Math.sqrt(v.u / 100 / v.a);
  A.fx('td', {
    title: 'Texel density of an asset',
    expr: 'density = {t} · √({u} / {a})',
    vars: { t: { sym: 'T', name: 'texture size', values: [512, 1024, 2048, 4096], index: 2 }, a: { sym: 'A', name: 'surface area of the model', unit: 'm²', min: 0.1, max: 60, value: 6, log: true },
            u: { sym: 'u', name: 'share of the texture covered by UV islands', unit: '%', min: 30, max: 95, value: 70, step: 1 }, tg: { sym: 'target', name: 'team target', values: [256, 512, 1024, 2048], labels: ['256 px/m', '512 px/m', '1024 px/m', '2048 px/m'], index: 1 } },
    out: { sym: 'density', unit: 'px/m', f: dens },
    sub: v => { const d = dens(v), r = d / v.tg; return `<b>${num(d)} px/m</b> (${num(d / 100)} px/cm): ${r > 1.4 ? 'sharper than the target, could use a smaller texture' : r < 0.7 ? 'blurrier than the target' : 'on target'} · ${num(r)}× the target`; },
    plot: { x: 'a', logY: true, y: [32, 8192] }
  });

  /* ---------- baking rays ---------- */
  A.fx('cage', {
    title: 'Ray distance when baking',
    expr: 'captured if {h} ≤ {d} < {g}',
    vars: { h: { sym: 'h', name: 'how far the high-poly detail sticks out', unit: 'cm', min: 0, max: 5, value: 1.5, step: 0.1 }, d: { sym: 'd', name: 'maximum ray distance (cage)', unit: 'cm', min: 0.1, max: 10, value: 3, step: 0.1 }, g: { sym: 'g', name: 'distance to the nearest other surface', unit: 'cm', min: 0.5, max: 10, value: 4, step: 0.1 } },
    out: { sym: 'captured', f: v => (v.h <= v.d && v.d < v.g) ? 1 : 0, fmt: x => x ? 'yes' : 'no' },
    sub: v => v.d < v.h ? '<b>misses</b>: the ray stops before it reaches the detail (holes or flat spots in the bake)' : v.d >= v.g ? '<b>wrong surface</b>: the ray reaches the neighbouring part first (projected artefacts)' : 'the ray reaches the detail and stops before any other surface',
    draw(ctx, W, H, v, X) {
      const s = 26, base = H - 60, x0 = 20, x1 = W - 20;
      ctx.strokeStyle = col('ray'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, base); ctx.lineTo(x1, base); ctx.stroke(); X.label(ctx, 'low-poly surface', x0, base + 20, col('ray'));
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); for (let x = x0; x <= x1; x += 2) { const t = (x - x0) / (x1 - x0); const bump = Math.max(0, Math.sin(t * Math.PI * 4)) ; const y = base - bump * v.h * s; x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); X.label(ctx, 'high-poly detail', x0, base - v.h * s - 10, col('accent'));
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x0, base - v.g * s); ctx.lineTo(x1, base - v.g * s); ctx.stroke(); X.label(ctx, 'neighbouring part (a strap, another panel)', x1, base - v.g * s - 10, col('muted'), 'right');
      for (let x = x0 + 20; x < x1; x += 40) { const ok = v.h <= v.d && v.d < v.g; X.arrow(ctx, x, base, x, base - v.d * s, ok ? col('good') : col('bad'), 1.5); }
    },
    plot: false, size: [880, 320]
  });

  /* ---------- vertex splits ---------- */
  A.fx('splits', {
    title: 'Vertices the GPU actually draws',
    expr: 'GPU vertices ≈ {n} · (1 + {s} + {e})',
    vars: { n: { sym: 'n', name: 'vertex positions in the modelling tool', min: 500, max: 100000, value: 8000, log: true }, s: { sym: 'seams', name: 'share of vertices on UV seams', unit: '%', min: 0, max: 40, value: 18, step: 1 }, e: { sym: 'hard', name: 'share on hard edges that are not seams', unit: '%', min: 0, max: 40, value: 6, step: 1 } },
    out: { sym: 'GPU vertices', f: v => v.n * (1 + v.s / 100 + v.e / 100) },
    sub: v => `<b>${num(v.n * (1 + v.s / 100 + v.e / 100))}</b> vertices instead of ${num(v.n)}; put hard edges on seams and the second term disappears`,
    plot: { x: 'n', logY: true, y: [500, 200000] }
  });

  /* ---------- memory of strategies ---------- */
  const mb = (res, maps) => res * res * 1 * maps * 4 / 3 / 1048576;   /* BC7: 1 byte per texel */
  A.fx('texmem', {
    title: 'Memory: unique textures against shared trims',
    expr: 'unique = {n} · {r}² · 3 maps,   trims = {k} · 2048² · 3 maps   (BC7, with mips)',
    vars: { n: { sym: 'assets', name: 'number of props', min: 1, max: 200, value: 40, step: 1 }, r: { sym: 'size', name: 'unique texture size per prop', values: [512, 1024, 2048, 4096], index: 1 }, k: { sym: 'trims', name: 'trim sheets shared by all props', min: 1, max: 10, value: 3, step: 1 } },
    out: [{ sym: 'unique', unit: 'MB', f: v => v.n * mb(v.r, 3), color: 'bad' }, { sym: 'trim sheets', unit: 'MB', f: v => v.k * mb(2048, 3), color: 'good' }],
    plot: { x: 'n', y: [0, 600] }
  });
})();
