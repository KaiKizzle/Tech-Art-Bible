/* Tinting and Clamping Colour — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num, clamp } = A;
  const s2l = v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const l2s = x => Math.round(clamp(x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055, 0, 1) * 255);
  const css = c => `rgb(${c.map(l2s).join(',')})`;
  const L = [0.2126, 0.7152, 0.0722], lum = c => c[0] * L[0] + c[1] * L[1] + c[2] * L[2];
  const hsv = (h, s, v) => { const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)]; };   // sRGB 0..1
  const lin = c => c.map(x => s2l(x * 255));
  const sat = c => { const mx = Math.max(...c), mn = Math.min(...c); return mx > 0 ? (mx - mn) / mx : 0; };
  function clampPlausible(c, lmin, lmax, sd, sl) {
    const y0 = Math.max(lum(c), 1e-6), y = clamp(y0, lmin, lmax), h = c.map(x => x / y0), mx = Math.max(...h), mn = Math.min(...h), s = (mx - mn) / Math.max(mx, 1e-6);
    const t = clamp((y - 0.03) / 0.27, 0, 1), sm = sd + (sl - sd) * t * t * (3 - 2 * t), k = s > sm ? sm / ((mx - mn) - sm * (mx - 1)) : 1;
    return h.map(x => (1 + (x - 1) * k) * y);
  }
  const TINTS = [[46, 120, 190], [140, 90, 40], [60, 160, 90], [200, 60, 50]].map(c => c.map(x => x / 255)), TN = ['blue', 'brown', 'green', 'red'];
  const sw = (ctx, X, x, y, w, h, c, label) => { ctx.fillStyle = css(c); ctx.fillRect(x, y, w, h); ctx.strokeStyle = col('line'); ctx.strokeRect(x, y, w, h); if (label) X.label(ctx, label, x, y - 8, col('muted')); };

  /* ---------- linear versus sRGB multiply ---------- */
  A.fx('linmul', {
    title: 'Multiply in sRGB values versus linear light',
    expr: 'linear: lin({t}) · lin({g}),   naive: {t} · {g} on sRGB values',
    vars: { g: { sym: 'tex', name: 'texture value (sRGB 0–255)', min: 0, max: 255, value: 128, step: 1 },
            t: { sym: 'tint', name: 'tint colour', values: [0, 1, 2, 3], labels: TN, index: 0 } },
    out: [{ sym: 'linear result Y', f: v => lum(lin(TINTS[v.t]).map(x => x * s2l(v.g))), color: 'good' }, { sym: 'sRGB-maths result Y', f: v => lum(lin(TINTS[v.t].map(x => x * v.g / 255))), color: 'bad' }],
    sub: (v, n) => { const a = lum(lin(TINTS[v.t]).map(x => x * s2l(v.g))), b = lum(lin(TINTS[v.t].map(x => x * v.g / 255))); return `multiplying the sRGB numbers gives <b>${n(b / Math.max(a, 1e-6))}×</b> the light of the linear multiply: brighter for mid greys, and the hue shifts`; },
    draw(ctx, W, H, v, X) {
      const t = TINTS[v.t], a = lin(t).map(x => x * s2l(v.g)), b = lin(t.map(x => x * v.g / 255)), w = (W - 60) / 3;
      sw(ctx, X, 15, 40, w, H - 70, lin(t), 'tint'); sw(ctx, X, 30 + w, 40, w, H - 70, a, 'linear multiply'); sw(ctx, X, 45 + 2 * w, 40, w, H - 70, b, 'sRGB-number multiply');
    },
    plot: { x: 'g', y: [0, 0.5] }, size: [440, 200]
  });

  /* ---------- multiply darkens ---------- */
  A.fx('mul', {
    title: 'Brightness loss of a multiply tint',
    expr: 'colour = tint · tex,   tex mean = lin({m})',
    vars: { m: { sym: 'mean', name: 'mean value of the texture (sRGB 0–255)', min: 40, max: 255, value: 128, step: 1 },
            t: { sym: 'tint', name: 'tint colour', values: [0, 1, 2, 3], labels: TN, index: 2 } },
    out: { sym: 'brightness vs. picked tint', f: v => s2l(v.m), fmt: x => num(x * 100) + ' %' },
    sub: (v, n) => `with a texture averaging ${v.m}, the material is <b>${n(s2l(v.m) * 100)} %</b> as bright as the colour in the picker. Artists compensate by picking brighter, oversaturated tints.`,
    draw(ctx, W, H, v, X) {
      const t = lin(TINTS[v.t]), w = W - 30;
      for (let i = 0; i < w; i += 2) { const g = 40 + i / w * 215; ctx.fillStyle = css(t.map(x => x * s2l(g))); ctx.fillRect(15 + i, 40, 2, 60); }
      X.label(ctx, 'texture 40 → 255, multiplied by the tint', 15, 30, col('muted'));
      const xm = 15 + (v.m - 40) / 215 * w; ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xm, 34); ctx.lineTo(xm, 106); ctx.stroke();
      sw(ctx, X, 15, 130, 90, 50, t, 'picked'); sw(ctx, X, 125, 130, 90, 50, t.map(x => x * s2l(v.m)), 'what you get on average');
    },
    plot: { x: 'm', y: [0, 1.02] }, size: [440, 200]
  });

  /* ---------- the 50 % grey convention ---------- */
  A.fx('greymask', {
    title: 'Grey tint mask (50 % grey = tint)',
    expr: 'colour = tint · Y(tex) / 0.214,   tex = {g}',
    vars: { g: { sym: 'tex', name: 'texel value (sRGB 0–255)', min: 0, max: 255, value: 128, step: 1 },
            t: { sym: 'tint', name: 'tint colour', values: [0, 1, 2, 3], labels: TN, index: 0 } },
    out: { sym: 'brightness vs. tint', f: v => s2l(v.g) / 0.214, fmt: x => num(x * 100) + ' %' },
    sub: (v, n) => `0.214 is 128 sRGB in linear. This texel shows the tint at <b>${n(s2l(v.g) / 0.214 * 100)} %</b>: the texture carries the detail, the tint carries the colour.`,
    draw(ctx, W, H, v, X) {
      const t = lin(TINTS[v.t]), w = W - 30;
      for (let i = 0; i < w; i += 2) { const g = i / w * 255; const c = s2l(g); ctx.fillStyle = css([c, c, c]); ctx.fillRect(15 + i, 36, 2, 34); ctx.fillStyle = css(t.map(x => Math.min(1, x * c / 0.214))); ctx.fillRect(15 + i, 76, 2, 34); }
      const x128 = 15 + 128 / 255 * w; ctx.strokeStyle = col('ink'); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x128, 30); ctx.lineTo(x128, 116); ctx.stroke(); ctx.setLineDash([]); X.label(ctx, '128 = the tint', x128 + 4, 126, col('ink'));
      const xg = 15 + v.g / 255 * w; ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xg, 30); ctx.lineTo(xg, 116); ctx.stroke();
      X.label(ctx, 'mask (grey texture)', 15, 26, col('muted'));
      sw(ctx, X, 15, 150, 80, 40, t, 'tint'); sw(ctx, X, 110, 150, 80, 40, t.map(x => Math.min(1, x * s2l(v.g) / 0.214)), 'this texel');
    },
    plot: { x: 'g', y: [0, 4.8] }, size: [440, 210]
  });

  /* ---------- luminance and hue ---------- */
  A.fx('lum', {
    title: 'Luminance and hue at Y = 1',
    expr: 'Y = 0.2126 R + 0.7152 G + 0.0722 B,   hue = colour / Y,   colour = sRGB({r}, {g}, {b})',
    vars: { r: { sym: 'R', name: 'red (sRGB 0–255)', min: 0, max: 255, value: 60, step: 1, color: 'bad' },
            g: { sym: 'G', name: 'green (sRGB 0–255)', min: 0, max: 255, value: 140, step: 1, color: 'good' },
            b: { sym: 'B', name: 'blue (sRGB 0–255)', min: 0, max: 255, value: 200, step: 1, color: 'ray' } },
    out: { sym: 'Y', f: v => lum([s2l(v.r), s2l(v.g), s2l(v.b)]) },
    sub: (v, n) => `luminance <b>${n(lum([s2l(v.r), s2l(v.g), s2l(v.b)]))}</b>: the grey swatch on the right has the same brightness, only the colour is gone`,
    steps: (v, n) => { const c = [s2l(v.r), s2l(v.g), s2l(v.b)], y = Math.max(lum(c), 1e-6); return [['linear', `(${c.map(x => n(x)).join(', ')})`], ['hue at Y = 1', `(${c.map(x => n(x / y)).join(', ')})`], ['saturation (HSV)', n(sat(c))]]; },
    draw(ctx, W, H, v, X) {
      const c = [s2l(v.r), s2l(v.g), s2l(v.b)], y = lum(c);
      sw(ctx, X, 15, 40, (W - 45) / 2, H - 70, c, 'colour'); sw(ctx, X, 30 + (W - 45) / 2, 40, (W - 45) / 2, H - 70, [y, y, y], 'same luminance in grey');
    },
    plot: false, size: [440, 180]
  });

  /* ---------- hue-preserving desaturation ---------- */
  A.fx('satclamp', {
    title: 'Hue-preserving saturation cap',
    expr: 'k = s<sub>max</sub> / ((max − min) − s<sub>max</sub> · (max − 1)),   hue′ = lerp(1, hue, k),   s<sub>max</sub> = {sm}',
    vars: { h: { sym: 'H', name: 'hue of the input', unit: '°', min: 0, max: 359, value: 125, step: 1 },
            s: { sym: 'S', name: 'saturation of the input (sRGB HSV)', min: 0, max: 1, value: 1, step: 0.01 },
            sm: { sym: 's<sub>max</sub>', name: 'saturation cap (linear HSV)', min: 0.2, max: 1, value: 0.6, step: 0.01 } },
    out: [{ sym: 'saturation before', f: v => sat(lin(hsv(v.h, v.s, 0.85))), color: 'bad' }, { sym: 'after', f: v => { const c = lin(hsv(v.h, v.s, 0.85)); return sat(clampPlausible(c, 0, 10, v.sm, v.sm)); }, color: 'good' }],
    sub: (v, n) => { const c = lin(hsv(v.h, v.s, 0.85)), o = clampPlausible(c, 0, 10, v.sm, v.sm); return `luminance before ${n(lum(c))}, after ${n(lum(o))}: unchanged. Only the distance from grey shrank.`; },
    draw(ctx, W, H, v, X) {
      const c = lin(hsv(v.h, v.s, 0.85)), o = clampPlausible(c, 0, 10, v.sm, v.sm), w = (W - 45) / 2;
      sw(ctx, X, 15, 40, w, H - 70, c, 'input'); sw(ctx, X, 30 + w, 40, w, H - 70, o, 'clamped');
    },
    plot: { x: 's', y: [0, 1.02] }, size: [440, 180]
  });

  /* ---------- the full plausibility clamp ---------- */
  const TESTS = [[0, 1, 0], [0, 0, 1], [1, 0, 0], [0, 0, 0], [1, 1, 1], [0.95, 0.75, 0.2]].map(lin), TESTN = ['neon green', 'pure blue', 'pure red', 'black', 'white', 'gold'];
  A.fx('range', {
    title: 'Plausibility clamp',
    expr: 'Y′ = clamp(Y, {lmin}, {lmax}),   s<sub>max</sub> = lerp({sd}, {sl}, smoothstep(0.03, 0.30, Y′))',
    vars: { lmin: { sym: 'Y<sub>min</sub>', name: 'darkest allowed luminance', min: 0.001, max: 0.1, value: 0.006, log: true },
            lmax: { sym: 'Y<sub>max</sub>', name: 'brightest allowed luminance', min: 0.1, max: 0.9, value: 0.32, step: 0.01 },
            sd: { sym: 's<sub>dark</sub>', name: 'saturation cap for dark colours', min: 0.3, max: 1, value: 0.88, step: 0.01 },
            sl: { sym: 's<sub>light</sub>', name: 'saturation cap for light colours', min: 0.1, max: 1, value: 0.55, step: 0.01 } },
    out: { sym: 's<sub>max</sub> at Y = 0.1', f: v => { const t = clamp((0.1 - 0.03) / 0.27, 0, 1); return v.sd + (v.sl - v.sd) * t * t * (3 - 2 * t); } },
    sub: (v, n) => `luminance is held between <b>${n(v.lmin)}</b> and <b>${n(v.lmax)}</b>; saturation may reach ${n(v.sd)} in dark colours and ${n(v.sl)} in light ones. Every hue survives.`,
    note: 'Defaults: the iris ranges from the eye unit. Top row: what was picked. Bottom row: what the material shows.',
    draw(ctx, W, H, v, X) {
      const n = TESTS.length, w = (W - 20 - (n - 1) * 8) / n;
      TESTS.forEach((c, i) => { const x = 10 + i * (w + 8); sw(ctx, X, x, 30, w, 50, c); sw(ctx, X, x, 92, w, 50, clampPlausible(c, v.lmin, v.lmax, v.sd, v.sl)); X.label(ctx, TESTN[i], x + w / 2, 160, col('muted'), 'center'); });
      X.label(ctx, 'picked', 10, 20, col('muted'));
    },
    plot: false, size: [520, 180]
  });

  /* ---------- hue rotation ---------- */
  A.fx('hue', {
    title: 'Hue rotation around the grey axis',
    expr: 'c′ = c cos {a} + (k × c) sin {a} + k (k·c)(1 − cos {a}),   k = (1, 1, 1) / √3',
    vars: { a: { sym: 'θ', name: 'hue rotation', unit: '°', min: -180, max: 180, value: 60, step: 1 },
            t: { sym: 'colour', name: 'input', values: [0, 1, 2, 3], labels: TN, index: 3 } },
    out: { sym: 'luminance change', f: v => { const c = lin(TINTS[v.t]), r = rot(c, v.a); return lum(r) / lum(c); }, fmt: x => num(x * 100) + ' %' },
    sub: (v, n) => { const c = lin(TINTS[v.t]), r = rot(c, v.a); return `rotated by ${Math.round(v.a)}°, the colour is <b>${n(lum(r) / lum(c) * 100)} %</b> as bright as before: hue rotation does not keep luminance`; },
    draw(ctx, W, H, v, X) {
      const c = lin(TINTS[v.t]), w = (W - 20 - 5 * 6) / 6;
      for (let i = 0; i < 6; i++) { const a = v.a * i / 5; sw(ctx, X, 10 + i * (w + 6), 40, w, H - 70, rot(c, a).map(x => Math.max(0, x))); X.label(ctx, Math.round(a) + '°', 10 + i * (w + 6) + w / 2, H - 16, col('muted'), 'center'); }
    },
    plot: { x: 'a', y: [0, 3] }, size: [520, 170]
  });
  function rot(c, deg) { const a = deg * Math.PI / 180, k = 1 / Math.sqrt(3), co = Math.cos(a), si = Math.sin(a), kd = k * (c[0] + c[1] + c[2]);
    const cr = [k * (c[2] - c[1]), k * (c[0] - c[2]), k * (c[1] - c[0])]; return c.map((x, i) => x * co + cr[i] * si + k * kd * (1 - co)); }
})();
