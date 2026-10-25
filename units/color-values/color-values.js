/* Colour as Numbers — formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const enc = x => x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  const dec = x => x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  const css = c => `rgb(${c.map(x => Math.round(clamp(x, 0, 1) * 255)).join(',')})`;   // c already display-encoded
  const swatch = (ctx, x, y, w, h, c, X, label, sub) => { ctx.fillStyle = css(c); ctx.fillRect(x, y, w, h); ctx.strokeStyle = col('line'); ctx.strokeRect(x, y, w, h); if (label) X.label(ctx, label, x + w / 2, y + h + 16, col('ink'), 'center', true); if (sub) X.label(ctx, sub, x + w / 2, y + h + 34, col('muted'), 'center'); };

  A.fx('rgb', {
    title: 'From 0–255 to 0–1',
    expr: 'c = ({R}, {G}, {B}) / 255',
    vars: { R: { name: 'red byte', min: 0, max: 255, value: 255, step: 1 }, G: { name: 'green byte', min: 0, max: 255, value: 128, step: 1 }, B: { name: 'blue byte', min: 0, max: 255, value: 0, step: 1 } },
    out: [{ sym: 'c<sub>r</sub>', f: v => v.R / 255, color: 'ax-x' }, { sym: 'c<sub>g</sub>', f: v => v.G / 255, color: 'ax-y' }, { sym: 'c<sub>b</sub>', f: v => v.B / 255, color: 'ax-z' }],
    sub: v => `c = (${v.R}, ${v.G}, ${v.B}) / 255 = <b>(${num(v.R / 255)}, ${num(v.G / 255)}, ${num(v.B / 255)})</b>`,
    draw(ctx, W, H, v, X) {
      swatch(ctx, 30, 40, 160, 160, [v.R / 255, v.G / 255, v.B / 255], X, 'the colour', `#${[v.R, v.G, v.B].map(x => x.toString(16).padStart(2, '0')).join('')}`);
      [[v.R, 'red', [1, 0, 0]], [v.G, 'green', [0, 1, 0]], [v.B, 'blue', [0, 0, 1]]].forEach(([x, n, c], i) => { const y = 50 + i * 54; ctx.fillStyle = col('surface-2'); ctx.fillRect(230, y, 180, 22); ctx.fillStyle = css(c); ctx.fillRect(230, y, 180 * x / 255, 22); X.label(ctx, `${n} ${x} / 255 = ${num(x / 255)}`, 230, y - 8, col('muted')); });
    },
    plot: { x: 'G', y: [0, 1] }
  });

  A.fx('srgb', {
    title: 'sRGB decoding',
    expr: 'linear = ({s} ≤ 0.04045) ? {s} / 12.92 : (({s} + 0.055) / 1.055)<sup>2.4</sup>',
    vars: { s: { name: 'stored (encoded) value', min: 0, max: 1, value: 0.5, step: 0.005 } },
    out: [{ sym: 'linear', f: v => dec(v.s), color: 'accent' }],
    sub: v => `stored ${num(v.s)} → <b>linear ${num(dec(v.s))}</b> (${Math.round(dec(v.s) * 100)}% of full light)`,
    draw(ctx, W, H, v, X) {
      const L = 20, R = W - 20;
      for (let x = L; x < R; x++) { const t = (x - L) / (R - L); ctx.fillStyle = css([t, t, t]); ctx.fillRect(x, 40, 1, 70); const lin = dec(t), e = enc(lin); }
      X.label(ctx, 'stored values 0 → 1, evenly spaced: looks even to the eye', L, 26, col('muted'));
      for (let x = L; x < R; x++) { const t = (x - L) / (R - L), e = enc(t); ctx.fillStyle = css([e, e, e]); ctx.fillRect(x, 150, 1, 70); }
      X.label(ctx, 'linear light 0 → 1, evenly spaced: most of the ramp looks bright', L, 136, col('muted'));
      const px = L + v.s * (R - L), lx = L + dec(v.s) * (R - L);
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, 112); ctx.lineTo(lx, 148); ctx.stroke(); X.dot(ctx, px, 110, col('accent'), 5); X.dot(ctx, lx, 150, col('accent'), 5);
      X.label(ctx, 'same brightness, different numbers', W / 2, H - 14, col('muted'), 'center');
    },
    plot: { x: 's', y: [0, 1] }
  });

  A.fx('blend', {
    title: '50/50 blend of red and green',
    expr: 'mix = lerp(red, green, {t})',
    vars: { t: { name: 'blend amount', min: 0, max: 1, value: 0.5, step: 0.01 } },
    out: [{ sym: 'Y linear', name: 'brightness when blended in linear', f: v => 0.2126 * (1 - v.t) + 0.7152 * v.t, color: 'good' },
          { sym: 'Y encoded', name: 'brightness when blended on stored values', f: v => 0.2126 * dec(1 - v.t) + 0.7152 * dec(v.t), color: 'bad' }],
    sub: v => `linear blend: (${num(1 - v.t)}, ${num(v.t)}, 0) · on encoded values: (${num(dec(1 - v.t))}, ${num(dec(v.t))}, 0) in linear terms`,
    draw(ctx, W, H, v, X) {
      const L = 20, R = W - 20;
      for (let x = L; x < R; x++) { const t = (x - L) / (R - L); ctx.fillStyle = css([enc(1 - t), enc(t), 0]); ctx.fillRect(x, 40, 1, 70); ctx.fillStyle = css([1 - t, t, 0]); ctx.fillRect(x, 150, 1, 70); }
      X.label(ctx, 'blended in linear (correct)', L, 26, col('good'), 'left', true);
      X.label(ctx, 'blended on encoded values (dark band in the middle)', L, 136, col('bad'), 'left', true);
      const px = L + v.t * (R - L); ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, 34); ctx.lineTo(px, 226); ctx.stroke();
    },
    plot: { x: 't', y: [0, 0.8] },
    note: 'The graph shows the luminance of each blend. Blending encoded values dips by about half in the middle.'
  });

  A.fx('hdr', {
    title: 'From HDR to the screen (simplified)',
    expr: 'display = {L}·{e} / (1 + {L}·{e})',
    vars: { L: { name: 'linear scene value', min: 0.01, max: 1000, value: 6, log: true }, e: { name: 'exposure', min: 0.01, max: 10, value: 0.5, log: true } },
    out: { sym: 'display', f: v => v.L * v.e / (1 + v.L * v.e) },
    sub: v => `display = ${num(v.L * v.e)} / (1 + ${num(v.L * v.e)}) = <b>${num(v.L * v.e / (1 + v.L * v.e))}</b>`,
    plot: { x: 'L', y: [0, 1] },
    note: 'This is the Reinhard curve, the simplest tonemapper. Production curves are compared in Sun to Screen.'
  });

  A.fx('luma', {
    title: 'Luminance',
    expr: 'Y = 0.2126·{R} + 0.7152·{G} + 0.0722·{B}',
    vars: { R: { name: 'red (linear)', min: 0, max: 1, value: 0.2, step: 0.01 }, G: { name: 'green (linear)', min: 0, max: 1, value: 0.2, step: 0.01 }, B: { name: 'blue (linear)', min: 0, max: 1, value: 0.9, step: 0.01 } },
    out: { sym: 'Y', f: v => 0.2126 * v.R + 0.7152 * v.G + 0.0722 * v.B },
    draw(ctx, W, H, v, X) {
      const y = 0.2126 * v.R + 0.7152 * v.G + 0.0722 * v.B, e = enc(y);
      swatch(ctx, 40, 50, 160, 150, [enc(v.R), enc(v.G), enc(v.B)], X, 'colour');
      swatch(ctx, 240, 50, 160, 150, [e, e, e], X, 'grey of equal luminance');
    },
    plot: { x: 'G', y: [0, 1] }
  });
})();
