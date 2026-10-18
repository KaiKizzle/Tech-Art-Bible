/* Textures and Sampling — formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  /* a small procedural texture used by several drawings: 8 × 8 texels */
  const TEX = []; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const c = ((i + j) % 2) ? 0.85 : 0.25; TEX.push([c * (0.6 + 0.05 * i), c * (0.55 + 0.04 * j), c * 0.7]); }
  TEX[2 * 8 + 5] = [0.95, 0.35, 0.2]; TEX[5 * 8 + 2] = [0.2, 0.6, 0.95];
  const rgb = c => `rgb(${c.map(x => Math.round(clamp(x, 0, 1) * 255))})`;
  const texAt = (i, j) => TEX[(clamp(j, 0, 7)) * 8 + clamp(i, 0, 7)];

  A.fx('texbytes', {
    title: 'Memory of an uncompressed texture',
    expr: 'bytes = {W} × {H} × {b}',
    vars: {
      W: { name: 'width', unit: 'texels', values: [256, 512, 1024, 2048, 4096], index: 2 },
      H: { name: 'height', unit: 'texels', values: [256, 512, 1024, 2048, 4096], index: 2 },
      b: { name: 'bytes per texel', values: [1, 2, 4, 8, 16], labels: ['1 (R8)', '2 (RG8)', '4 (RGBA8)', '8 (RGBA16F)', '16 (RGBA32F)'], index: 2 }
    },
    out: { sym: 'bytes', f: v => v.W * v.H * v.b, fmt: x => x >= 1048576 ? num(x / 1048576) + ' MiB' : num(x / 1024) + ' KiB' },
    plot: { x: 'W' },
    note: 'Compressed formats use 0.5 to 1 byte per texel instead, see Texels on a Budget.'
  });

  A.fx('uv', {
    title: 'From UV to a texel',
    expr: 'x = {u} × {W} − 0.5,   texel = floor({u} × {W})',
    vars: { u: { name: 'u coordinate', min: 0, max: 1, value: 0.4, step: 0.001 }, W: { name: 'texture width', unit: 'texels', values: [4, 8, 16, 32], index: 1 } },
    out: [{ sym: 'x', name: 'continuous texel position (0 = centre of the first)', f: v => v.u * v.W - 0.5, color: 'accent' }, { sym: 'texel', f: v => Math.min(v.W - 1, Math.floor(v.u * v.W)), color: 'ink', fmt: x => String(x) }],
    sub: v => `u × W = ${num(v.u)} × ${v.W} = ${num(v.u * v.W)} → <b>texel ${Math.min(v.W - 1, Math.floor(v.u * v.W))}</b>, ${num(v.u * v.W - Math.floor(v.u * v.W))} of the way across it`,
    draw(ctx, W, H, v, X) {
      const L = 20, R = W - 20, n = v.W, cw = (R - L) / n, y0 = 80, h = 90, k = Math.min(n - 1, Math.floor(v.u * n));
      for (let i = 0; i < n; i++) { ctx.fillStyle = rgb(texAt(Math.floor(i / n * 8), 3)); ctx.fillRect(L + i * cw, y0, cw - 1, h); if (i === k) { ctx.strokeStyle = col('ink'); ctx.lineWidth = 3; ctx.strokeRect(L + i * cw + 1.5, y0 + 1.5, cw - 4, h - 3); } ctx.fillStyle = col('bg'); ctx.beginPath(); ctx.arc(L + (i + 0.5) * cw, y0 + h / 2, 3, 0, 7); ctx.fill(); if (n <= 16) X.label(ctx, String(i), L + (i + 0.5) * cw, y0 + h + 14, col('muted'), 'center'); }
      const ux = L + v.u * (R - L);
      ctx.strokeStyle = col(X.vars.u.color); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(ux, y0 - 26); ctx.lineTo(ux, y0 + h + 4); ctx.stroke();
      X.label(ctx, 'u = ' + num(v.u), ux, y0 - 36, col(X.vars.u.color), 'center', true);
      X.label(ctx, 'u = 0', L, y0 + h + 34, col('muted'), 'left'); X.label(ctx, 'u = 1', R, y0 + h + 34, col('muted'), 'right');
      X.label(ctx, 'dots mark texel centres', W / 2, H - 14, col('muted'), 'center');
    },
    plot: { x: 'u' }
  });

  A.fx('wrap', {
    title: 'Wrap modes',
    expr: "u' = {m} applied to {u}",
    vars: {
      m: { sym: 'mode', name: '0 repeat · 1 clamp · 2 mirror', values: [0, 1, 2], labels: ['repeat: frac(u)', 'clamp: saturate(u)', 'mirror'], index: 0 },
      u: { name: 'incoming u', min: -1, max: 3, value: 1.3, step: 0.01 }
    },
    out: { sym: "u'", f: v => v.m === 0 ? v.u - Math.floor(v.u) : v.m === 1 ? clamp(v.u, 0, 1) : (() => { const t = v.u - 2 * Math.floor(v.u / 2); return t <= 1 ? t : 2 - t; })() },
    sub: v => { const f = v.m === 0 ? `frac(${num(v.u)})` : v.m === 1 ? `saturate(${num(v.u)})` : `mirror(${num(v.u)})`; const o = v.m === 0 ? v.u - Math.floor(v.u) : v.m === 1 ? clamp(v.u, 0, 1) : (() => { const t = v.u - 2 * Math.floor(v.u / 2); return t <= 1 ? t : 2 - t; })(); return `u' = ${f} = <b>${num(o)}</b>`; },
    draw(ctx, W, H, v, X) {
      const L = 20, R = W - 20, u0 = -1, u1 = 3, y0 = 60, h = 120, map = u => v.m === 0 ? u - Math.floor(u) : v.m === 1 ? clamp(u, 0, 1) : (() => { const t = u - 2 * Math.floor(u / 2); return t <= 1 ? t : 2 - t; })();
      for (let px = L; px < R; px += 2) { const u = u0 + (px - L) / (R - L) * (u1 - u0), uu = map(u); for (let row = 0; row < 4; row++) { ctx.fillStyle = rgb(texAt(Math.min(7, Math.floor(uu * 8)), row * 2 + 1)); ctx.fillRect(px, y0 + row * h / 4, 2, h / 4); } }
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; const x0 = L + (0 - u0) / (u1 - u0) * (R - L), x1 = L + (1 - u0) / (u1 - u0) * (R - L); ctx.strokeRect(x0, y0 - 4, x1 - x0, h + 8);
      X.label(ctx, 'the texture itself (u from 0 to 1)', (x0 + x1) / 2, y0 - 16, col('accent'), 'center', true);
      [-1, 0, 1, 2, 3].forEach(u => X.label(ctx, String(u), L + (u - u0) / (u1 - u0) * (R - L), y0 + h + 18, col('muted'), 'center'));
      const ux = L + (v.u - u0) / (u1 - u0) * (R - L); ctx.strokeStyle = col(X.vars.u.color); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(ux, y0 - 8); ctx.lineTo(ux, y0 + h + 8); ctx.stroke();
    },
    plot: { x: 'u', y: [-0.1, 1.1] }
  });

  A.fx('bilinear', {
    title: 'Bilinear filtering',
    expr: 'c = lerp( lerp({c00}, {c10}, {fx}),  lerp({c01}, {c11}, {fx}),  {fy} )',
    vars: {
      fx: { sym: 'f<sub>x</sub>', name: 'fraction across', min: 0, max: 1, value: 0.3, step: 0.01 },
      fy: { sym: 'f<sub>y</sub>', name: 'fraction up', min: 0, max: 1, value: 0.65, step: 0.01 },
      c00: { sym: 'c<sub>00</sub>', name: 'bottom-left texel', min: 0, max: 1, value: 0.1, step: 0.01 },
      c10: { sym: 'c<sub>10</sub>', name: 'bottom-right texel', min: 0, max: 1, value: 0.9, step: 0.01 },
      c01: { sym: 'c<sub>01</sub>', name: 'top-left texel', min: 0, max: 1, value: 0.4, step: 0.01 },
      c11: { sym: 'c<sub>11</sub>', name: 'top-right texel', min: 0, max: 1, value: 0.2, step: 0.01 }
    },
    out: { sym: 'c', f: v => { const b = v.c00 + (v.c10 - v.c00) * v.fx, t = v.c01 + (v.c11 - v.c01) * v.fx; return b + (t - b) * v.fy; } },
    steps: v => { const b = v.c00 + (v.c10 - v.c00) * v.fx, t = v.c01 + (v.c11 - v.c01) * v.fx; return [['bottom row', num(b)], ['top row', num(t)]]; },
    draw(ctx, W, H, v, X) {
      const S = 200, x0 = 30, y0 = 30;
      // the four texels as flat squares on the left
      [[0, 1, v.c00], [1, 1, v.c10], [0, 0, v.c01], [1, 0, v.c11]].forEach(([i, j, c]) => { ctx.fillStyle = rgb([c, c, c]); ctx.fillRect(x0 + i * 60, y0 + j * 60, 58, 58); X.label(ctx, num(c), x0 + i * 60 + 29, y0 + j * 60 + 29, c > 0.5 ? '#000' : '#fff', 'center', true); });
      X.label(ctx, 'point filter', x0 + 59, y0 + 136, col('muted'), 'center');
      // bilinear surface between the four centres
      const bx = 210, by = 30, step = 4;
      for (let y = 0; y < S; y += step) for (let x = 0; x < S; x += step) { const fx = x / S, fy = 1 - y / S, b = v.c00 + (v.c10 - v.c00) * fx, t = v.c01 + (v.c11 - v.c01) * fx, c = b + (t - b) * fy; ctx.fillStyle = rgb([c, c, c]); ctx.fillRect(bx + x, by + y, step, step); }
      ctx.strokeStyle = col('line'); ctx.strokeRect(bx, by, S, S);
      const px = bx + v.fx * S, py = by + (1 - v.fy) * S; X.dot(ctx, px, py, col('accent'), 7);
      X.label(ctx, 'bilinear, between the four centres', bx + S / 2, by + S + 16, col('muted'), 'center');
    },
    plot: { x: 'fx', y: [0, 1] }
  });

  A.fx('mip', {
    title: 'Which mip level',
    expr: 'λ = log₂({T} / {P})',
    vars: { T: { name: 'texture size', unit: 'texels', values: [256, 512, 1024, 2048, 4096], index: 3 }, P: { name: 'size on screen', unit: 'px', min: 4, max: 4096, value: 300, log: true } },
    out: { sym: 'λ', name: 'mip level', f: v => Math.max(0, Math.log2(v.T / v.P)) },
    steps: v => [['texels per pixel', num(v.T / v.P)], ['level used', String(Math.min(Math.round(Math.max(0, Math.log2(v.T / v.P))), Math.log2(v.T)))], ['its size', num(v.T / Math.pow(2, Math.round(Math.max(0, Math.log2(v.T / v.P))))) + ' texels']],
    draw(ctx, W, H, v, X) {
      let s = 180, x = 16; const lv = Math.round(Math.max(0, Math.log2(v.T / v.P)));
      for (let m = 0; m <= Math.log2(v.T) && x < W - 8; m++) {
        const n = Math.max(1, Math.min(8, v.T >> m)), cs = s / n, y = 30 + (180 - s);
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { ctx.fillStyle = rgb(texAt(Math.floor(i / n * 8), Math.floor(j / n * 8))); ctx.fillRect(x + i * cs, y + j * cs, cs + 0.5, cs + 0.5); }
        ctx.strokeStyle = m === lv ? col('accent') : col('line'); ctx.lineWidth = m === lv ? 3 : 1; ctx.strokeRect(x, y, s, s);
        if (s > 22) X.label(ctx, 'mip ' + m, x + s / 2, 226, m === lv ? col('accent') : col('muted'), 'center', m === lv);
        x += s + 8; s = Math.max(6, s / 2);
      }
      X.label(ctx, '(each level is drawn simplified; the real level ' + lv + ' has ' + num(v.T >> lv) + ' × ' + num(v.T >> lv) + ' texels)', 16, H - 14, col('muted'));
    },
    plot: { x: 'P' }
  });
})();
