/* Transparency and Alpha — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const enc = x => { x = clamp(x, 0, 1); return Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055) * 255); };
  const css = c => `rgb(${c.map(enc).join(',')})`;
  function checker(ctx, x, y, w, h, s = 10) { for (let j = 0; j < h / s; j++) for (let i = 0; i < w / s; i++) { ctx.fillStyle = (i + j) % 2 ? '#3a3d44' : '#7a7e88'; ctx.fillRect(x + i * s, y + j * s, Math.min(s, w - i * s), Math.min(s, h - j * s)); } }
  function swatch(ctx, X, x, y, w, h, c, label) { ctx.fillStyle = css(c); ctx.fillRect(x, y, w, h); ctx.strokeStyle = col('line'); ctx.strokeRect(x, y, w, h); if (label) X.label(ctx, label, x + w / 2, y + h + 14, col('muted'), 'center'); }
  const SRC = [1.0, 0.45, 0.08], DST = [0.08, 0.3, 0.75];

  A.fx('over', {
    title: 'The over operator',
    expr: 'result = {s} · {a} + {d} · (1 − {a})',
    vars: { a: { sym: 'α', name: 'alpha of the new layer', min: 0, max: 1, value: 0.4, step: 0.01 },
            s: { sym: 'src', name: 'new colour (one channel)', min: 0, max: 1, value: 1, step: 0.01 },
            d: { sym: 'dst', name: 'colour already in the target', min: 0, max: 1, value: 0.1, step: 0.01 } },
    out: { sym: 'result', f: v => v.s * v.a + v.d * (1 - v.a) },
    draw(ctx, W, H, v, X) {
      const r = v.s * v.a + v.d * (1 - v.a);
      swatch(ctx, X, 30, 40, 100, 100, [v.d, v.d, v.d], 'dst');
      swatch(ctx, X, 160, 40, 100, 100, [v.s, v.s, v.s], 'src');
      swatch(ctx, X, 300, 40, 110, 100, [r, r, r], 'result');
      X.label(ctx, `${Math.round(v.a * 100)}% src + ${Math.round((1 - v.a) * 100)}% dst`, 355, 180, col('accent'), 'center', true);
      checker(ctx, 30, 210, W - 60, 40); ctx.fillStyle = `rgba(255,255,255,${v.a})`; ctx.fillRect(30, 210, W - 60, 40);
      X.label(ctx, 'a white layer with this alpha over a checkerboard', 30, 266, col('muted'));
    },
    plot: { x: 'a', y: [0, 1] }
  });

  const MODES = ['alpha', 'additive', 'multiply', 'premultiplied'];
  const blend = (m, s, d, a) => m === 0 ? s * a + d * (1 - a) : m === 1 ? s + d : m === 2 ? s * d : s * a + d * (1 - a);
  A.fx('modes', {
    title: 'Four blend modes (orange source over a blue destination)',
    expr: 'result = src · SrcFactor + dst · DstFactor,   mode {m},   α = {a}',
    vars: { m: { name: 'blend mode', values: [0, 1, 2, 3], labels: MODES }, a: { sym: 'α', name: 'source alpha', min: 0, max: 1, value: 0.6, step: 0.01 } },
    out: [0, 1, 2].map(i => ({ sym: ['r', 'g', 'b'][i], f: v => blend(v.m, v.m === 3 ? SRC[i] * v.a : SRC[i], DST[i], v.a), color: ['ax-x', 'ax-y', 'ax-z'][i] })),
    sub: v => ['SrcFactor = α, DstFactor = 1 − α', 'SrcFactor = 1, DstFactor = 1: light only adds up', 'SrcFactor = dst, DstFactor = 0: colours multiply, only ever darker', 'source stored as colour × α; SrcFactor = 1, DstFactor = 1 − α'][v.m],
    draw(ctx, W, H, v, X) {
      const r = [0, 1, 2].map(i => blend(v.m, v.m === 3 ? SRC[i] * v.a : SRC[i], DST[i], v.a));
      swatch(ctx, X, 30, 50, 100, 100, DST, 'dst'); swatch(ctx, X, 160, 50, 100, 100, SRC, 'src'); swatch(ctx, X, 300, 50, 110, 100, r, MODES[v.m]);
      MODES.forEach((n, i) => { const x = 30 + i * 100; const ri = [0, 1, 2].map(k => blend(i, i === 3 ? SRC[k] * v.a : SRC[k], DST[k], v.a)); ctx.fillStyle = css(ri); ctx.fillRect(x, 200, 90, 40); ctx.strokeStyle = i === v.m ? col('accent') : col('line'); ctx.lineWidth = i === v.m ? 2 : 1; ctx.strokeRect(x, 200, 90, 40); X.label(ctx, n, x + 45, 254, col('muted'), 'center'); });
    },
    plot: { x: 'a', y: [0, 1.4] }
  });

  const RED = [0.9, 0.1, 0.08], BLU = [0.1, 0.25, 0.95], BG = [0.85, 0.85, 0.85];
  const over = (c, a, d) => c.map((x, i) => x * a + d[i] * (1 - a));
  A.fx('order', {
    title: 'Red and blue layers in both orders',
    expr: 'red α = {ar},   blue α = {ab}',
    vars: { ar: { sym: 'α<sub>red</sub>', name: 'alpha of the red layer', min: 0, max: 1, value: 0.6, step: 0.01 }, ab: { sym: 'α<sub>blue</sub>', name: 'alpha of the blue layer', min: 0, max: 1, value: 0.6, step: 0.01 } },
    out: [{ sym: 'red share, blue on top', f: v => v.ar * (1 - v.ab), color: 'bad' }, { sym: 'red share, red on top', f: v => v.ar, color: 'accent' }],
    sub: v => { const a = over(BLU, v.ab, over(RED, v.ar, BG)), b = over(RED, v.ar, over(BLU, v.ab, BG)); const d = Math.hypot(...a.map((x, i) => x - b[i])); return d < 0.01 ? 'the two orders give <b>the same</b> colour' : `the two orders differ by <b>${num(d)}</b> (RGB distance): order matters`; },
    draw(ctx, W, H, v, X) {
      const a = over(BLU, v.ab, over(RED, v.ar, BG)), b = over(RED, v.ar, over(BLU, v.ab, BG));
      swatch(ctx, X, 40, 50, 150, 130, a, 'red first, then blue'); swatch(ctx, X, 250, 50, 150, 130, b, 'blue first, then red');
      X.label(ctx, 'back to front is the only correct order', W / 2, 230, col('muted'), 'center');
    },
    plot: { x: 'ab', y: [0, 1] }
  });

  A.fx('fringe', {
    title: 'Filtering at the edge of a leaf',
    expr: 'halfway between a green texel (α 1) and a transparent texel, at {t};  {mode}',
    vars: { t: { name: 'position between the two texels', min: 0, max: 1, value: 0.5, step: 0.01 }, mode: { name: 'storage', values: [0, 1], labels: ['straight alpha', 'premultiplied'] },
            bg: { name: 'background brightness', min: 0, max: 1, value: 0.9, step: 0.01 } },
    out: [{ sym: 'drawn', name: 'green channel after blending', f: v => { const a = 1 - v.t, g = (1 - v.t) * 0.8; return v.mode ? g + v.bg * (1 - a) : g * a + v.bg * (1 - a); }, color: 'accent' },
          { sym: 'correct', f: v => { const a = 1 - v.t; return 0.8 * a + v.bg * (1 - a); }, color: 'good' }],
    sub: v => { const a = 1 - v.t, g = (1 - v.t) * 0.8; const dr = v.mode ? g + v.bg * (1 - a) : g * a + v.bg * (1 - a), co = 0.8 * a + v.bg * (1 - a); return `filtered: colour ${num(g)}, alpha ${num(a)} → drawn ${num(dr)}, correct ${num(co)} → <b>${Math.abs(dr - co) < 0.005 ? 'no fringe' : 'dark fringe'}</b>`; },
    draw(ctx, W, H, v, X) {
      const L = 30, R = W - 30;
      for (let px = L; px < R; px++) { const t = (px - L) / (R - L), a = 1 - t, g = (1 - t) * 0.8, dr = v.mode ? g + v.bg * (1 - a) : g * a + v.bg * (1 - a), bgc = v.bg * (1 - a) + 0; ctx.fillStyle = css([v.mode ? v.bg * (1 - a) : v.bg * (1 - a), dr, v.mode ? v.bg * (1 - a) : v.bg * (1 - a)]); ctx.fillRect(px, 60, 1, 90); }
      for (let px = L; px < R; px++) { const t = (px - L) / (R - L), a = 1 - t, g = 0.8 * a + v.bg * (1 - a); ctx.fillStyle = css([v.bg * (1 - a), g, v.bg * (1 - a)]); ctx.fillRect(px, 180, 1, 40); }
      X.label(ctx, (v.mode ? 'premultiplied' : 'straight alpha') + ': the edge as drawn', L, 46, col('muted')); X.label(ctx, 'correct', L, 172, col('muted'));
      X.label(ctx, 'leaf texel', L, 236, col('muted')); X.label(ctx, 'transparent texel (stored colour black)', R, 236, col('muted'), 'right');
      const px = L + v.t * (R - L); ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, 54); ctx.lineTo(px, 226); ctx.stroke();
    },
    plot: { x: 't', y: [0, 1] },
    note: 'Switch storage to premultiplied: the drawn and correct curves become one.'
  });

  /* coverage of a thin strand across mips */
  A.fx('mipcoverage', {
    title: 'A thin twig in smaller mips',
    expr: 'α<sub>mip</sub> = {w} / 2<sup>{k}</sup>,   visible if α<sub>mip</sub> ≥ {c}',
    vars: { w: { name: 'twig width in mip-0 texels', min: 0.5, max: 4, value: 1, step: 0.1 }, k: { name: 'mip level', min: 0, max: 5, value: 2, step: 1 },
            c: { name: 'alpha cutoff', min: 0.1, max: 0.9, value: 0.5, step: 0.01 } },
    out: [{ sym: 'α<sub>mip</sub>', f: v => Math.min(1, v.w / Math.pow(2, v.k)), color: 'accent' }, { sym: 'drawn width', name: 'in mip-0 texels', f: v => Math.min(1, v.w / Math.pow(2, v.k)) >= v.c ? Math.max(v.w, Math.pow(2, v.k)) : 0, color: 'ray' }],
    sub: v => { const a = Math.min(1, v.w / Math.pow(2, v.k)); return `α = ${num(a)} ${a >= v.c ? '≥' : '<'} ${num(v.c)} → <b>${a >= v.c ? 'twig drawn' : 'twig gone'}</b>`; },
    draw(ctx, W, H, v, X) {
      const cells = 16, s = Math.min((W - 60) / cells, 14), x0 = 30, y0 = 40, b = Math.pow(2, v.k);
      for (let i = 0; i < cells; i++) for (let j = 0; j < 12; j++) { const xi = Math.floor(i / b) * b; let cov = 0; for (let q = xi; q < xi + b; q++) cov += clamp(Math.min(q + 1, 8 + v.w / 2) - Math.max(q, 8 - v.w / 2), 0, 1); const aa = Math.min(1, cov / b); const vis = aa >= v.c; ctx.fillStyle = vis ? `rgba(110,190,90,${0.35 + 0.65 * aa})` : aa > 0 ? `rgba(110,190,90,${0.12 + 0.2 * aa})` : alpha(col('muted'), 0.08); ctx.fillRect(x0 + i * s, y0 + j * s, s - 1, s - 1); }
      X.label(ctx, `mip ${v.k}: blocks of ${b} texels averaged`, x0, y0 - 14, col('muted'));
      X.label(ctx, 'faint: below the cutoff, discarded', x0, y0 + 12 * s + 18, col('muted'));
    },
    plot: { x: 'k', y: [0, 1.5] },
    note: 'Animate the mip level: at mip 1 or 2 the twig vanishes completely.'
  });

  const SPOS = [[0.375, 0.125], [0.875, 0.375], [0.125, 0.625], [0.625, 0.875], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
  A.fx('a2c', {
    title: 'Alpha to coverage',
    expr: 'covered = round({a} · {n})',
    vars: { a: { sym: 'α', name: 'alpha', min: 0, max: 1, value: 0.6, step: 0.01 }, n: { name: 'MSAA samples', values: [2, 4, 8], index: 1 } },
    out: { sym: 'coverage', f: v => Math.round(v.a * v.n) / v.n },
    sub: v => `round(${num(v.a)} · ${v.n}) = ${Math.round(v.a * v.n)} of ${v.n} samples → effective alpha <b>${num(Math.round(v.a * v.n) / v.n)}</b>`,
    draw(ctx, W, H, v, X) {
      const s = 150, x0 = 40, y0 = 40, c = Math.round(v.a * v.n), pos = v.n === 2 ? [[0.25, 0.25], [0.75, 0.75]] : v.n === 4 ? SPOS.slice(0, 4) : SPOS;
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 2; ctx.strokeRect(x0, y0, s, s);
      pos.forEach(([px, py], i) => X.dot(ctx, x0 + px * s, y0 + py * s, i < c ? col('accent') : alpha(col('muted'), 0.6), 8));
      X.label(ctx, 'one pixel, its MSAA samples', x0, y0 + s + 18, col('muted'));
      ctx.fillStyle = css([0.4 * c / v.n + 0.1 * (1 - c / v.n), 0.6 * c / v.n + 0.1 * (1 - c / v.n), 0.2 * c / v.n + 0.1 * (1 - c / v.n)]); ctx.fillRect(250, y0, 150, s); ctx.strokeStyle = col('line'); ctx.strokeRect(250, y0, 150, s);
      X.label(ctx, 'resolved pixel', 325, y0 + s + 18, col('muted'), 'center');
    },
    plot: { x: 'a', y: [0, 1] }
  });

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  A.fx('dither', {
    title: 'Ordered dithering with a 4 × 4 Bayer matrix',
    expr: 'visible if {a} > (bayer(x, y) + 0.5) / 16',
    vars: { a: { sym: 'α', name: 'alpha (fade amount)', min: 0, max: 1, value: 0.5, step: 0.01 } },
    sub: v => `<b>${BAYER.filter(b => v.a > (b + 0.5) / 16).length} of 16</b> pixels in every 4 × 4 block are drawn`,
    out: { sym: 'visible', name: 'fraction of pixels drawn', f: v => BAYER.filter(b => v.a > (b + 0.5) / 16).length / 16 },
    draw(ctx, W, H, v, X) {
      const s = 14, x0 = 30, y0 = 30;
      for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) { const b = BAYER[(j % 4) * 4 + (i % 4)]; ctx.fillStyle = v.a > (b + 0.5) / 16 ? '#e8a34a' : '#25272c'; ctx.fillRect(x0 + i * s, y0 + j * s, s - 1, s - 1); }
      X.label(ctx, 'pixels drawn (orange) at this alpha', x0, y0 + 12 * s + 16, col('muted'));
      const x1 = 240; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const b = BAYER[j * 4 + i]; ctx.fillStyle = alpha(col('muted'), 0.15 + b / 20); ctx.fillRect(x1 + i * 36, y0 + j * 36, 34, 34); X.label(ctx, String(b), x1 + i * 36 + 17, y0 + j * 36 + 17, col('ink'), 'center', true); }
      X.label(ctx, 'the threshold pattern (÷ 16)', x1, y0 + 4 * 36 + 16, col('muted'));
    },
    plot: { x: 'a', y: [0, 1] },
    note: 'The steps in the graph are the 16 levels a 4 × 4 pattern can show.'
  });

  A.fx('oit', {
    title: 'Weighted blended OIT for two layers',
    expr: 'C = (c₁a₁ + c₂a₂) / (a₁ + a₂),   revealage = (1 − {a1})(1 − {a2}),   result = C · (1 − revealage) + dst · revealage',
    vars: { a1: { sym: 'a₁', name: 'alpha of the red layer (front)', min: 0, max: 1, value: 0.4, step: 0.01 }, a2: { sym: 'a₂', name: 'alpha of the blue layer (back)', min: 0, max: 1, value: 0.4, step: 0.01 } },
    sub: v => { const rev = (1 - v.a1) * (1 - v.a2); return `revealage = ${num(1 - v.a1)} · ${num(1 - v.a2)} = <b>${num(rev)}</b>: ${Math.round(rev * 100)}% of the background shows through, in either order`; },
    out: [{ sym: 'error', name: 'distance from the sorted result', f: v => { const s = over(RED, v.a1, over(BLU, v.a2, BG)), rev = (1 - v.a1) * (1 - v.a2), C = RED.map((x, i) => (x * v.a1 + BLU[i] * v.a2) / Math.max(1e-6, v.a1 + v.a2)), o = C.map((x, i) => x * (1 - rev) + BG[i] * rev); return Math.hypot(...s.map((x, i) => x - o[i])); } }],
    draw(ctx, W, H, v, X) {
      const s = over(RED, v.a1, over(BLU, v.a2, BG)), rev = (1 - v.a1) * (1 - v.a2), C = RED.map((x, i) => (x * v.a1 + BLU[i] * v.a2) / Math.max(1e-6, v.a1 + v.a2)), o = C.map((x, i) => x * (1 - rev) + BG[i] * rev);
      swatch(ctx, X, 40, 50, 150, 130, s, 'sorted (correct)'); swatch(ctx, X, 250, 50, 150, 130, o, 'weighted blended OIT');
      X.label(ctx, `revealage ${num(rev)}: the share of the background that survives`, W / 2, 230, col('muted'), 'center');
    },
    plot: { x: 'a1', y: [0, 0.6] },
    note: 'The error is small at moderate alpha and grows when both layers are nearly opaque.'
  });
})();
