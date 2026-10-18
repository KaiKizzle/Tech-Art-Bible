/* Reading a Shader — formulas and labs */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const sat = x => Math.min(1, Math.max(0, x));
  const rgb = c => `rgb(${c.map(x => Math.round(sat(x) * 255)).join(',')})`;

  /* draws what a 1D function does to a gradient: x runs left to right, brightness = output */
  function ramp(xKey, x0, x1, f, opts = {}) {
    return function (ctx, W, H, v, X) {
      const top = 34, h = H - 92;
      for (let i = 0; i < W - 40; i++) {
        const x = x0 + (x1 - x0) * i / (W - 41), y = f(Object.assign({}, v, { [xKey]: x }));
        const g = isFinite(y) ? sat(opts.scale ? y / opts.scale : y) : 0;
        ctx.fillStyle = `rgb(${Math.round(g * 255)},${Math.round(g * 255)},${Math.round(g * 255)})`; ctx.fillRect(20 + i, top, 1.5, h);
      }
      ctx.strokeStyle = col('line'); ctx.strokeRect(20, top, W - 40, h);
      const cx = 20 + (v[xKey] - x0) / (x1 - x0) * (W - 40), y = f(v);
      ctx.strokeStyle = col(X.vars[xKey].color); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, top - 6); ctx.lineTo(cx, top + h + 6); ctx.stroke();
      X.label(ctx, `input ${xKey} = ${num(v[xKey])}  →  output ${num(y)}`, 20, 16, col('ink'), 'left', true);
      X.label(ctx, num(x0), 20, top + h + 18, col('muted'), 'left'); X.label(ctx, num(x1), W - 20, top + h + 18, col('muted'), 'right');
      X.label(ctx, opts.caption || 'brightness = output, left to right = input', W / 2, H - 14, col('muted'), 'center');
    };
  }

  /* ---------- types: part-by-part multiply ---------- */
  const S = [0.8, 0.35, 0.1];
  A.fx('mulrgb', {
    title: 'Colour times colour: part by part',
    expr: 'c = ({Lr}, {Lg}, {Lb}) × (0.80, 0.35, 0.10)',
    vars: {
      Lr: { sym: 'L<sub>r</sub>', name: 'light red', min: 0, max: 1, value: 1, step: 0.01 },
      Lg: { sym: 'L<sub>g</sub>', name: 'light green', min: 0, max: 1, value: 1, step: 0.01 },
      Lb: { sym: 'L<sub>b</sub>', name: 'light blue', min: 0, max: 1, value: 1, step: 0.01 }
    },
    out: [
      { sym: 'c<sub>r</sub>', name: 'red', f: v => v.Lr * S[0], color: 'ax-x' },
      { sym: 'c<sub>g</sub>', name: 'green', f: v => v.Lg * S[1], color: 'ax-y' },
      { sym: 'c<sub>b</sub>', name: 'blue', f: v => v.Lb * S[2], color: 'ax-z' }
    ],
    sub: v => `c = (${num(v.Lr)} × 0.80, ${num(v.Lg)} × 0.35, ${num(v.Lb)} × 0.10) = <b>(${num(v.Lr * S[0])}, ${num(v.Lg * S[1])}, ${num(v.Lb * S[2])})</b>`,
    draw(ctx, W, H, v, X) {
      const L = [v.Lr, v.Lg, v.Lb], C = L.map((x, i) => x * S[i]);
      const sw = (x, c, t) => { ctx.fillStyle = rgb(c); ctx.fillRect(x, 50, 110, 150); ctx.strokeStyle = col('line'); ctx.strokeRect(x, 50, 110, 150); X.label(ctx, t, x + 55, 220, col('ink'), 'center', true); X.label(ctx, c.map(q => q.toFixed(2)).join(', '), x + 55, 240, col('muted'), 'center'); };
      sw(20, L, 'light L'); X.label(ctx, '×', 152, 125, col('ink'), 'center', true); sw(165, S, 'surface'); X.label(ctx, '=', 297, 125, col('ink'), 'center', true); sw(310, C, 'result c');
    },
    plot: { x: 'Lb', y: [0, 1] },
    note: 'Lower the light\'s blue: the orange surface barely changes, because it reflects little blue anyway.'
  });

  /* ---------- interpolation: barycentric ---------- */
  const TA = [70, 240], TB = [230, 30], TC = [400, 220];
  const ef = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const area = ef(TA, TB, TC);
  const bary = p => [ef(TB, TC, p) / area, ef(TC, TA, p) / area, ef(TA, TB, p) / area];
  const CA = [0.95, 0.25, 0.2], CB = [0.25, 0.85, 0.3], CC = [0.25, 0.4, 0.95];
  A.fx('bary', {
    title: 'Barycentric interpolation',
    expr: 'colour = {wa}·c<sub>a</sub> + {wb}·c<sub>b</sub> + {wc}·c<sub>c</sub>',
    vars: {
      px: { sym: 'p<sub>x</sub>', name: 'point x', min: 0, max: 440, value: 235, step: 1 },
      py: { sym: 'p<sub>y</sub>', name: 'point y', min: 0, max: 280, value: 170, step: 1 },
      wa: { sym: 'w<sub>a</sub>', name: 'weight of a', color: 'ax-x', derived: v => bary([v.px, v.py])[0] },
      wb: { sym: 'w<sub>b</sub>', name: 'weight of b', color: 'ax-y', derived: v => bary([v.px, v.py])[1] },
      wc: { sym: 'w<sub>c</sub>', name: 'weight of c', color: 'ax-z', derived: v => bary([v.px, v.py])[2] }
    },
    out: [
      { sym: 'w<sub>a</sub>', f: v => bary([v.px, v.py])[0], color: 'ax-x' },
      { sym: 'w<sub>b</sub>', f: v => bary([v.px, v.py])[1], color: 'ax-y' },
      { sym: 'w<sub>c</sub>', f: v => bary([v.px, v.py])[2], color: 'ax-z' }
    ],
    sub: v => { const w = bary([v.px, v.py]), c = [0, 1, 2].map(i => w[0] * CA[i] + w[1] * CB[i] + w[2] * CC[i]);
      const ins = w.every(x => x >= -1e-9);
      return `w<sub>a</sub> = ${num(w[0])}, w<sub>b</sub> = ${num(w[1])}, w<sub>c</sub> = ${num(w[2])} · sum = ${num(w[0] + w[1] + w[2])} → <b>colour (${c.map(x => num(x)).join(', ')})</b>${ins ? '' : ' · a weight is negative: p is outside'}`; },
    draw(ctx, W, H, v, X) {
      const img = ctx.createImageData(W, H), dpr = 1;
      // fill the triangle with the interpolated colour (coarse 2 px steps for speed)
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
        const w = bary([x + 1, y + 1]); if (w[0] < 0 || w[1] < 0 || w[2] < 0) continue;
        const c = [0, 1, 2].map(i => w[0] * CA[i] + w[1] * CB[i] + w[2] * CC[i]);
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const k = ((y + dy) * W + x + dx) * 4; img.data[k] = c[0] * 255; img.data[k + 1] = c[1] * 255; img.data[k + 2] = c[2] * 255; img.data[k + 3] = 255; }
      }
      const off = document.createElement('canvas'); off.width = W; off.height = H; off.getContext('2d').putImageData(img, 0, 0); ctx.drawImage(off, 0, 0, W, H);
      const p = [v.px, v.py];
      [[TA, 'a', CA], [TB, 'b', CB], [TC, 'c', CC]].forEach(([q, n, c]) => { ctx.strokeStyle = alpha(col('ink'), 0.5); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); ctx.setLineDash([]); X.dot(ctx, q[0], q[1], rgb(c), 7); X.label(ctx, n, q[0] + 10, q[1] - 8, col('ink'), 'left', true); });
      X.dot(ctx, p[0], p[1], col('bg'), 8); X.dot(ctx, p[0], p[1], col('ink'), 5);
      X.label(ctx, 'drag p', p[0] + 10, p[1] + 2, col('ink'), 'left', true);
    },
    drag: p => ({ px: Math.round(clamp(p.x, 0, 440)), py: Math.round(clamp(p.y, 0, 280)) }),
    plot: { x: 'px', y: [-0.5, 1.5] },
    note: 'Each weight is the area of the triangle formed by p and the two other corners, divided by the whole area.'
  });

  /* ---------- functions ---------- */
  A.fx('saturate', {
    title: 'saturate(x)',
    expr: 'y = saturate({x}) = min(max({x}, 0), 1)',
    vars: { x: { name: 'input', min: -1, max: 2, value: 0.6, step: 0.01 } },
    out: { sym: 'y', f: v => sat(v.x) },
    draw: ramp('x', -1, 2, v => sat(v.x)),
    plot: { x: 'x', y: [-1, 2] },
    note: 'Lighting, masks and colours often leave the 0–1 range. saturate cuts them back and costs nothing on most GPUs.'
  });
  A.fx('lerp', {
    title: 'lerp(a, b, t)',
    expr: 'y = {a} + ({b} − {a}) · {t}',
    vars: {
      t: { name: 'blend amount', min: 0, max: 1, value: 0.3, step: 0.01 },
      a: { name: 'value at t = 0', min: 0, max: 1, value: 0.15, step: 0.01 },
      b: { name: 'value at t = 1', min: 0, max: 1, value: 0.9, step: 0.01 }
    },
    out: { sym: 'y', f: v => v.a + (v.b - v.a) * v.t },
    draw: ramp('t', 0, 1, v => v.a + (v.b - v.a) * v.t),
    plot: { x: 't', y: [0, 1] }
  });
  A.fx('invlerp', {
    title: 'Inverse lerp',
    expr: 't = ({x} − {a}) / ({b} − {a})',
    vars: {
      x: { name: 'value', unit: 'm', min: 0, max: 300, value: 120, step: 1 },
      a: { name: 'start of range', unit: 'm', min: 0, max: 200, value: 100, step: 1 },
      b: { name: 'end of range', unit: 'm', min: 100, max: 300, value: 150, step: 1 }
    },
    out: { sym: 't', f: v => (v.x - v.a) / (v.b - v.a) },
    draw: ramp('x', 0, 300, v => (v.x - v.a) / (v.b - v.a), { caption: 'mask from height: black below a, white above b (clipped to 0–1)' }),
    plot: { x: 'x', y: [-1, 2] },
    note: 'Outside the range t goes below 0 or above 1. Wrap it in saturate to get a clean mask.'
  });
  A.fx('step', {
    title: 'step(edge, x)',
    expr: 'y = {x} ≥ {e} ? 1 : 0',
    vars: { x: { name: 'input', min: 0, max: 1, value: 0.62, step: 0.01 }, e: { name: 'edge', min: 0, max: 1, value: 0.5, step: 0.01 } },
    out: { sym: 'y', f: v => v.x >= v.e ? 1 : 0, fmt: x => String(x) },
    draw: ramp('x', 0, 1, v => v.x >= v.e ? 1 : 0),
    plot: { x: 'x', y: [-0.1, 1.1] },
    note: 'A hard cut. On screen it aliases: the edge flickers when the input moves less than a pixel. smoothstep softens it.'
  });
  A.fx('smoothstep', {
    title: 'smoothstep(e0, e1, x)',
    expr: 'y = t²(3 − 2t),  t = saturate(({x} − {e0}) / ({e1} − {e0}))',
    vars: {
      x: { name: 'input', min: 0, max: 1, value: 0.45, step: 0.01 },
      e0: { sym: 'e<sub>0</sub>', name: 'start of the soft edge', min: 0, max: 1, value: 0.3, step: 0.01 },
      e1: { sym: 'e<sub>1</sub>', name: 'end of the soft edge', min: 0, max: 1, value: 0.6, step: 0.01 }
    },
    out: { sym: 'y', f: v => { const t = sat((v.x - v.e0) / (v.e1 - v.e0)); return t * t * (3 - 2 * t); } },
    steps: v => { const t = sat((v.x - v.e0) / (v.e1 - v.e0)); return [['t', num(t)], ['t²', num(t * t)], ['3 − 2t', num(3 - 2 * t)]]; },
    draw: ramp('x', 0, 1, v => { const t = sat((v.x - v.e0) / (v.e1 - v.e0)); return t * t * (3 - 2 * t); }),
    plot: { x: 'x', y: [-0.1, 1.1] },
    note: 't²(3 − 2t) starts and ends flat, so the transition has no visible kink. Making e0 and e1 one pixel apart gives an anti-aliased edge.'
  });
  A.fx('frac', {
    title: 'frac(x · k)',
    expr: 'y = frac({x} · {k}) = {x}·{k} − floor({x}·{k})',
    vars: { x: { name: 'input (e.g. a uv)', min: 0, max: 1, value: 0.37, step: 0.005 }, k: { name: 'repeats', min: 1, max: 10, value: 4, step: 1 } },
    out: { sym: 'y', f: v => { const q = v.x * v.k; return q - Math.floor(q); } },
    draw: ramp('x', 0, 1, v => { const q = v.x * v.k; return q - Math.floor(q); }),
    plot: { x: 'x', y: [0, 1] }
  });
  A.fx('pow', {
    title: 'pow(x, p)',
    expr: 'y = {x}<sup>{p}</sup>',
    vars: { x: { name: 'input', min: 0, max: 1, value: 0.5, step: 0.01 }, p: { name: 'exponent', min: 0.1, max: 8, value: 2.2, step: 0.01, log: true } },
    out: { sym: 'y', f: v => Math.pow(v.x, v.p) },
    draw: ramp('x', 0, 1, v => Math.pow(v.x, v.p)),
    plot: { x: 'x', y: [0, 1] },
    note: 'Exponents above 1 push mid tones down (tighter highlights, sharper masks); below 1 they lift them. 2.2 is close to the sRGB curve, see Colour as Numbers.'
  });

  /* ---------- lab: swizzles ---------- */
  (function swizzle() {
    const cv = document.getElementById('sw-cv'); if (!cv) return;
    const v = { x: 0, y: 0, z: 0, w: 0 }; let pick = 'rgb';
    const map = { r: 'x', g: 'y', b: 'z', a: 'w', x: 'x', y: 'y', z: 'z', w: 'w' };
    let f = null;
    ['x', 'y', 'z', 'w'].forEach(k => { const r = A.range('sw-' + k, x => x.toFixed(2), x => { v[k] = x; if (f) upd(); }); v[k] = r.v; });
    f = A.fig(cv, (ctx, W, H) => {
      const out = pick.split('').map(c => v[map[c]]);
      const c3 = out.length >= 3 ? out.slice(0, 3) : [out[0], out[1], 0];
      [[20, [v.x, v.y, v.z], 'c.rgb (original)'], [250, c3, 'c.' + pick]].forEach(([x, c, t]) => {
        ctx.fillStyle = rgb(c); ctx.fillRect(x, 20, 190, 140); ctx.strokeStyle = col('line'); ctx.strokeRect(x, 20, 190, 140);
        ctx.fillStyle = col('ink'); ctx.font = '600 13px "Source Sans 3 Variable",sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t, x + 95, 182);
        ctx.fillStyle = col('muted'); ctx.font = '12px "JetBrains Mono Variable",monospace'; ctx.fillText('(' + (x === 20 ? [v.x, v.y, v.z] : out).map(q => q.toFixed(2)).join(', ') + ')', x + 95, 202);
      });
    });
    function upd() {
      f.draw();
      const out = pick.split('').map(c => v[map[c]]);
      document.getElementById('sw-cap').textContent = `c.${pick} is a float${out.length}: (${out.map(q => q.toFixed(2)).join(', ')}).` + (pick === 'xy' ? ' Only two numbers; the swatch shows blue as 0.' : '');
    }
    A.seg('sw-pick', p => { pick = p; upd(); });
    upd();
  })();
})();
