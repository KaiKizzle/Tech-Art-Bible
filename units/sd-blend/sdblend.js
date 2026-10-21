/* Blend Modes — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const sat = x => clamp(x, 0, 1);
  function pic(ctx, w, h, f, x, y, dw, dh, smooth) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const p = f(i, j), k = (j * w + i) * 4; im.data[k] = sat(p[0]) * 255; im.data[k + 1] = sat(p[1]) * 255; im.data[k + 2] = sat(p[2]) * 255; im.data[k + 3] = 255; }
    g.putImageData(im, 0, 0); ctx.imageSmoothingEnabled = !!smooth; ctx.drawImage(c, x, y, dw, dh); ctx.imageSmoothingEnabled = true;
  }

  /* the modes, on one channel; F = foreground, B = background. Integer formats clamp the result to 0..1. */
  const MODES = [
    ['Copy', (F, B) => F, 'F'],
    ['Add', (F, B) => B + F, 'B + F'],
    ['Subtract', (F, B) => B - F, 'B − F'],
    ['Multiply', (F, B) => B * F, 'B · F'],
    ['Divide', (F, B) => F > 0 ? B / F : (B > 0 ? 1e9 : 0), 'B / F'],
    ['Max (Lighten)', (F, B) => Math.max(B, F), 'max(B, F)'],
    ['Min (Darken)', (F, B) => Math.min(B, F), 'min(B, F)'],
    ['Add Sub', (F, B) => B + (F - 0.5), 'B + (F − 0.5)'],
    ['Screen', (F, B) => 1 - (1 - B) * (1 - F), '1 − (1 − B)(1 − F)'],
    ['Overlay', (F, B) => B < 0.5 ? 2 * B * F : 1 - 2 * (1 - B) * (1 - F), 'B < 0.5 ? 2BF : 1 − 2(1 − B)(1 − F)']
  ];
  window.SD_BLEND = MODES;
  const blend = (m, F, B, o) => { const r = sat(MODES[m][1](F, B)); return B + (r - B) * o; };

  A.fx('blendmode', {
    title: 'The Blend node, one channel at a time',
    expr: 'result = lerp({B}, mode<sub>{m}</sub>({F}, {B}), {o})',
    vars: { m: { sym: 'mode', name: 'blending mode', values: MODES.map((_, i) => i), labels: MODES.map(x => x[0]), index: 3 },
            F: { sym: 'F', name: 'foreground value', min: 0, max: 1, value: 0.7, step: 0.01 }, B: { sym: 'B', name: 'background value', min: 0, max: 1, value: 0.4, step: 0.01 },
            o: { sym: 'opacity', name: 'opacity × mask', min: 0, max: 1, value: 1, step: 0.01 } },
    out: { sym: 'result', f: v => blend(v.m, v.F, v.B, v.o), color: 'accent' },
    sub: v => { const raw = MODES[v.m][1](v.F, v.B), r = blend(v.m, v.F, v.B, v.o); return `${MODES[v.m][0]}: ${MODES[v.m][2]} = ${Math.abs(raw) > 1e6 ? '∞' : num(raw)}` + (raw > 1 || raw < 0 ? ` → clamped to ${num(sat(raw))} in integer formats` : '') + ` · mixed by opacity ${num(v.o)} → <b>${num(r)}</b>`; },
    draw(ctx, W, H, v, X) {
      const s = Math.min(W - 70, H - 46), x0 = 48, y0 = 10;
      pic(ctx, 96, 96, (i, j) => { const r = blend(v.m, i / 95, 1 - j / 95, v.o); return [r, r, r]; }, x0, y0, s, s, true);
      ctx.strokeStyle = col('line'); ctx.strokeRect(x0, y0, s, s);
      const px = x0 + v.F * s, py = y0 + (1 - v.B) * s; ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.stroke();
      X.label(ctx, 'F →', x0 + s - 4, y0 + s + 16, col('muted'), 'right'); X.label(ctx, '0', x0, y0 + s + 16, col('muted'));
      X.label(ctx, 'B', x0 - 10, y0 + 8, col('muted'), 'right'); X.label(ctx, '↑', x0 - 10, y0 + 24, col('muted'), 'right');
      X.label(ctx, 'every F and B', x0 + s + 8, y0 + 10, col('muted')); X.label(ctx, 'combination;', x0 + s + 8, y0 + 26, col('muted')); X.label(ctx, 'click to pick', x0 + s + 8, y0 + 42, col('muted'));
    },
    drag(p, kind) { if (kind === 'up') return null; const s = Math.min(440 - 70, 280 - 46), r = x => Math.round(clamp(x, 0, 1) * 100) / 100; return { F: r((p.x - 48) / s), B: r(1 - (p.y - 10) / s) }; },
    plot: { x: 'F', y: [0, 1] }, size: [440, 280]
  });

  /* ---------- combining two height shapes ---------- */
  const HM = ['Max', 'Min', 'Add', 'Multiply', 'Copy'];
  const bump = (x, c, r) => { const d = (x - c) / r; return d * d < 1 ? Math.sqrt(1 - d * d) : 0; };
  const ridge = (x, c, w, h) => h * clamp((w - Math.abs(x - c)) / 0.04, 0, 1);
  const comb = (m, a, b) => [Math.max(a, b), Math.min(a, b), a + b, a * b, b > 0 ? b : a][m];
  A.fx('heightunion', {
    title: 'Two height shapes, one Blend',
    expr: 'height = mode<sub>{m}</sub>(dome, block),   block at {c}, height {h}',
    vars: { m: { sym: 'mode', name: 'blending mode', values: [0, 1, 2, 3, 4], labels: HM, index: 0 }, c: { sym: 'x', name: 'block position', min: 0.15, max: 0.85, value: 0.62, step: 0.01 },
            h: { sym: 'h', name: 'block height', min: 0.1, max: 1, value: 0.55, step: 0.01 } },
    out: { sym: 'height at the block centre', f: v => sat(comb(v.m, 0.85 * bump(v.c, 0.42, 0.3), ridge(v.c, v.c, 0.12, v.h))), color: 'accent' },
    sub: v => ['<b>Max</b> keeps whichever surface is higher: a union of shapes, no seams, never above 1. The standard way to merge heights.',
      '<b>Min</b> keeps the lower surface: only the overlap survives, like an intersection.',
      '<b>Add</b> stacks one on the other. Where both are tall the sum passes 1 and an integer graph clips it flat.',
      '<b>Multiply</b> uses one as a mask for the other: zero anywhere either one is zero.',
      '<b>Copy</b> with the block as its own mask pastes it on top: the dome under it disappears, hard edge included.'][v.m],
    draw(ctx, W, H, v, X) {
      const x0 = 16, w = W - 32, base = H - 30, hh = H - 70, N = 320;
      const a = t => 0.85 * bump(t, 0.42, 0.3), b = t => ridge(t, v.c, 0.12, v.h);
      ctx.strokeStyle = alpha(col('bad'), 0.5); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, base - hh); ctx.lineTo(x0 + w, base - hh); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, '1.0, the integer ceiling', x0 + w, base - hh - 10, col('bad'), 'right');
      ctx.beginPath(); ctx.moveTo(x0, base);
      for (let i = 0; i <= N; i++) { const t = i / N, r = sat(comb(v.m, a(t), b(t))); ctx.lineTo(x0 + t * w, base - r * hh); }
      ctx.lineTo(x0 + w, base); ctx.closePath(); ctx.fillStyle = alpha(col('accent'), 0.25); ctx.fill(); ctx.strokeStyle = col('accent'); ctx.lineWidth = 2.5; ctx.stroke();
      [[a, 'ray'], [b, 'good']].forEach(([f, c]) => { ctx.strokeStyle = col(c); ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.beginPath(); for (let i = 0; i <= N; i++) { const t = i / N, y = base - f(t) * hh; i ? ctx.lineTo(x0 + t * w, y) : ctx.moveTo(x0 + t * w, y); } ctx.stroke(); ctx.setLineDash([]); });
      X.label(ctx, 'dashed blue: dome · dashed green: block · orange: result', x0, H - 10, col('muted'));
    },
    plot: false, size: [880, 260]
  });

  /* ---------- detail around 0.5 ---------- */
  const DM = ['Add Sub', 'Overlay', 'Multiply', 'Add'];
  function noise1(t, s) { let v = 0, a = 0.5, f = 9; for (let k = 0; k < 4; k++) { v += a * Math.sin(t * f * 6.283 + s * (k + 1) * 1.7 + Math.sin(t * f * 2.1 + k)); a *= 0.5; f *= 2.1; } return v; }
  const detMode = (m, F, B) => m === 0 ? B + (F - 0.5) : m === 1 ? (B < 0.5 ? 2 * B * F : 1 - 2 * (1 - B) * (1 - F)) : m === 2 ? B * F : B + F;
  A.fx('detail', {
    title: 'Small detail on a large shape',
    expr: 'height = lerp(base, mode<sub>{m}</sub>(detail, base), {o}),   detail = 0.5 + {a} · noise',
    vars: { m: { sym: 'mode', name: 'blending mode', values: [0, 1, 2, 3], labels: DM, index: 0 }, a: { sym: 'amp', name: 'detail amplitude around 0.5', min: 0, max: 0.5, value: 0.25, step: 0.01 },
            o: { sym: 'opacity', name: 'strength of the blend', min: 0, max: 1, value: 0.6, step: 0.01 } },
    out: { sym: 'mean change in height', f: v => { let s = 0; for (let i = 0; i < 200; i++) { const t = i / 199, B = 0.15 + 0.6 * Math.sin(t * Math.PI), F = 0.5 + v.a * noise1(t, 3); s += B + (sat(detMode(v.m, F, B)) - B) * v.o - B; } return s / 200; }, color: 'accent' },
    sub: v => ['<b>Add Sub</b>: detail above 0.5 raises the base, below 0.5 lowers it, 0.5 changes nothing. The large shape keeps its average height.',
      '<b>Overlay</b> also leaves 0.5 neutral, but scales the detail by the base: strong in the middle tones, weak near 0 and 1.',
      '<b>Multiply</b> can only darken: the whole shape sinks by about half the detail\'s average.',
      '<b>Add</b> can only raise: the whole shape lifts by the detail\'s average, here about 0.5 × opacity.'][v.m],
    draw(ctx, W, H, v, X) {
      const x0 = 16, w = W - 32, base = H - 28, hh = H - 50, N = 400;
      const B = t => 0.15 + 0.6 * Math.sin(t * Math.PI), F = t => 0.5 + v.a * noise1(t, 3);
      ctx.strokeStyle = alpha(col('muted'), 0.8); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); for (let i = 0; i <= N; i++) { const t = i / N; i ? ctx.lineTo(x0 + t * w, base - B(t) * hh) : ctx.moveTo(x0, base - B(t) * hh); } ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = alpha(col('good'), 0.6); ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i <= N; i++) { const t = i / N; i ? ctx.lineTo(x0 + t * w, base - F(t) * hh * 0.3 - hh * 0.6) : ctx.moveTo(x0, base - F(t) * hh * 0.3 - hh * 0.6); } ctx.stroke();
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2.5; ctx.beginPath();
      for (let i = 0; i <= N; i++) { const t = i / N, b = B(t), r = b + (sat(detMode(v.m, F(t), b)) - b) * v.o; i ? ctx.lineTo(x0 + t * w, base - r * hh) : ctx.moveTo(x0, base - r * hh); } ctx.stroke();
      X.label(ctx, 'dashed: the base shape · green (scaled, top): the detail · orange: the result', x0, H - 10, col('muted'));
    },
    plot: { x: 'o', y: [-0.4, 0.4] }, size: [440, 260]
  });

  /* ---------- a threshold mask ---------- */
  A.fx('mask', {
    title: 'Turning a height into a mask',
    expr: 'mask = saturate((h − ({p} − {w}/2)) / {w})',
    vars: { p: { sym: 'position', name: 'where the cut is', min: 0, max: 1, value: 0.55, step: 0.01 }, w: { sym: 'width', name: 'softness of the edge (1 − contrast)', min: 0.005, max: 0.6, value: 0.08, step: 0.005 },
            h: { sym: 'h', name: 'a height value', min: 0, max: 1, value: 0.6, step: 0.01 } },
    out: { sym: 'mask', f: v => sat((v.h - (v.p - v.w / 2)) / v.w), color: 'accent' },
    sub: v => `heights below ${num(v.p - v.w / 2)} → 0, above ${num(v.p + v.w / 2)} → 1, a ramp between · this height (${num(v.h)}) gives <b>${num(sat((v.h - (v.p - v.w / 2)) / v.w))}</b>`,
    draw(ctx, W, H, v, X) {
      const n = (x, y) => 0.5 + 0.25 * (Math.sin(x * 7.1 + Math.sin(y * 5.3)) * Math.cos(y * 6.7 - x * 2.1) + 0.5 * Math.sin(x * 17 + y * 13) * Math.sin(y * 19 - x * 4));
      const s = Math.min((W - 30) / 2, H - 40);
      pic(ctx, 110, 110, (i, j) => { const h = n(i / 110 * 3, j / 110 * 3); return [h, h, h]; }, 10, 22, s, s, true);
      pic(ctx, 110, 110, (i, j) => { const h = n(i / 110 * 3, j / 110 * 3), m = sat((h - (v.p - v.w / 2)) / v.w); return [m, m, m]; }, 20 + s, 22, s, s, true);
      X.label(ctx, 'height', 10, 12, col('muted')); X.label(ctx, 'mask', 20 + s, 12, col('muted'));
    },
    plot: { x: 'h', y: [0, 1] }, size: [440, 260]
  });

  /* ---------- height blend between two materials ---------- */
  A.fx('heightblend', {
    title: 'Which material shows: compare heights',
    expr: 'mask = saturate(0.5 + (h<sub>top</sub> + {o} − h<sub>bottom</sub>) / {c})',
    vars: { o: { sym: 'offset', name: 'height offset of the top material', min: -0.6, max: 0.6, value: 0, step: 0.01 }, c: { sym: 'contrast', name: 'transition width', min: 0.01, max: 0.5, value: 0.06, step: 0.005 } },
    out: { sym: 'top material coverage', f: v => { let s = 0; for (let i = 0; i < 400; i++) { const t = i / 399; s += sat(0.5 + (topH(t) + v.o - botH(t)) / v.c); } return s / 400; }, color: 'accent', fmt: x => num(x * 100) + ' %' },
    sub: v => 'the top material (cobbles) shows wherever its height plus the offset is higher than the bottom one (sand). Raising the offset floods the sand from the stones outward; a small contrast makes a crisp edge that follows the shapes.',
    draw(ctx, W, H, v, X) {
      const x0 = 16, w = W - 32, base = H - 40, hh = H - 70, N = 440;
      ctx.lineWidth = 1.5;
      [[t => topH(t) + v.o, 'muted'], [botH, 'good']].forEach(([f, c]) => { ctx.strokeStyle = col(c); ctx.beginPath(); for (let i = 0; i <= N; i++) { const t = i / N; i ? ctx.lineTo(x0 + t * w, base - f(t) * hh) : ctx.moveTo(x0, base - f(t) * hh); } ctx.stroke(); });
      for (let i = 0; i < N; i++) { const t = (i + 0.5) / N, m = sat(0.5 + (topH(t) + v.o - botH(t)) / v.c); ctx.fillStyle = `rgb(${Math.round(196 - 70 * m)},${Math.round(160 - 34 * m)},${Math.round(102 + 30 * m)})`; ctx.fillRect(x0 + i / N * w, base + 8, w / N + 0.6, 14); }
      X.label(ctx, 'grey: cobbles + offset · green: sand · strip: what shows (grey = cobbles)', x0, H - 6, col('muted'));
    },
    plot: { x: 'o', y: [0, 1] }, size: [440, 260]
  });
  function topH(t) { const k = t * 6, f = k - Math.floor(k); return 0.55 * Math.sqrt(Math.max(0, 1 - Math.pow((f - 0.5) / 0.42, 2))) + 0.05 * Math.sin(t * 50); }
  function botH(t) { return 0.3 + 0.08 * Math.sin(t * 9) + 0.04 * Math.sin(t * 31 + 1); }
})();
