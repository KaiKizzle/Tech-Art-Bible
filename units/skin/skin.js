/* Skin: Light Under the Surface — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180, PI = Math.PI;
  const enc = x => Math.round(clamp(x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055, 0, 1) * 255);
  const css = c => `rgb(${c.map(enc).join(',')})`;
  /* d'Eon & Luebke skin profile: variances in mm² and RGB weights */
  const GS = [[0.0064, [0.233, 0.455, 0.649]], [0.0484, [0.100, 0.336, 0.344]], [0.187, [0.118, 0.198, 0.0]], [0.567, [0.113, 0.007, 0.007]], [1.99, [0.358, 0.004, 0.0]], [7.41, [0.078, 0, 0]]];
  const gauss = (v, r) => Math.exp(-r * r / (2 * v)) / (2 * PI * v);
  const R = (r, c) => GS.reduce((s, [v, w]) => s + w[c] * gauss(v, r), 0);
  const ELL = [3.7, 1.4, 0.7];

  A.fx('mfp', {
    title: 'Scattering distance per colour',
    expr: 'I(d) = e<sup>−{d} / ℓ</sup>,   ℓ = ({lr}, 1.4, 0.7) mm',
    vars: { d: { name: 'distance travelled under the skin', unit: 'mm', min: 0, max: 8, value: 2, step: 0.05 }, lr: { sym: 'ℓ<sub>red</sub>', name: 'red scattering distance', unit: 'mm', min: 1, max: 8, value: 3.7, step: 0.1 } },
    out: [{ sym: 'red', f: v => Math.exp(-v.d / v.lr), color: 'bad' }, { sym: 'green', f: v => Math.exp(-v.d / ELL[1]), color: 'good' }, { sym: 'blue', f: v => Math.exp(-v.d / ELL[2]), color: 'ray' }],
    draw(ctx, W, H, v, X) {
      const L = 30, R2 = W - 30, s = (R2 - L) / 8;
      for (let px = L; px < R2; px++) { const d = (px - L) / s; ctx.fillStyle = css([Math.exp(-d / v.lr), Math.exp(-d / ELL[1]), Math.exp(-d / ELL[2])].map(x => x * 0.9)); ctx.fillRect(px, 60, 1, 90); }
      X.label(ctx, 'colour of the light left after travelling sideways under the skin', L, 44, col('muted'));
      X.label(ctx, '0 mm', L, 166, col('muted'), 'center'); X.label(ctx, '8 mm', R2, 166, col('muted'), 'center');
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L + v.d * s, 54); ctx.lineTo(L + v.d * s, 156); ctx.stroke();
    },
    plot: { x: 'd', y: [0, 1] }
  });

  const wrap = (nl, w) => clamp((nl + w) / (1 + w), 0, 1);
  A.fx('wrap', {
    title: 'Wrap lighting per channel',
    expr: 'diffuse = saturate((cos {th} + w) / (1 + w)),   w<sub>red</sub> = {wr},   w<sub>blue</sub> = {wb}',
    vars: { th: { sym: 'θ', name: 'angle between normal and light', unit: '°', min: 0, max: 180, value: 80, step: 1 }, wr: { sym: 'w<sub>r</sub>', name: 'wrap for red', min: 0, max: 1, value: 0.5, step: 0.01 },
            wb: { sym: 'w<sub>b</sub>', name: 'wrap for green and blue', min: 0, max: 1, value: 0.2, step: 0.01 } },
    out: [{ sym: 'red', f: v => wrap(Math.cos(v.th * DEG), v.wr), color: 'bad' }, { sym: 'blue', f: v => wrap(Math.cos(v.th * DEG), v.wb), color: 'ray' }, { sym: 'Lambert', f: v => Math.max(0, Math.cos(v.th * DEG)), color: 'muted' }],
    draw(ctx, W, H, v, X) {
      const c = [W / 2, H / 2], r = 100, skin = [0.85, 0.55, 0.42];
      for (let y = -r; y <= r; y += 2) for (let x = -r; x <= r; x += 2) { const q = x * x + y * y; if (q > r * r) continue; const n = [x / r, -y / r, Math.sqrt(1 - q / (r * r))]; const nl = n[0] * 0.97 + n[2] * 0.24;
        ctx.fillStyle = css([skin[0] * wrap(nl, v.wr), skin[1] * wrap(nl, v.wb), skin[2] * wrap(nl, v.wb)]); ctx.fillRect(c[0] + x, c[1] + y, 2, 2); }
      X.label(ctx, 'light from the right', W - 20, 20, col('accent'), 'right');
    },
    plot: { x: 'th', y: [0, 1] }
  });

  A.fx('profile', {
    title: 'Skin diffusion profile (six Gaussians)',
    expr: 'R(r) = Σ<sub>i</sub> w<sub>i</sub> · e<sup>−{r}² / 2v<sub>i</sub></sup> / (2π v<sub>i</sub>)',
    vars: { r: { name: 'distance from the point where light entered', unit: 'mm', min: 0.05, max: 6, value: 1, step: 0.01 } },
    out: [{ sym: 'R<sub>red</sub>', f: v => R(v.r, 0), color: 'bad' }, { sym: 'R<sub>green</sub>', f: v => R(v.r, 1), color: 'good' }, { sym: 'R<sub>blue</sub>', f: v => R(v.r, 2), color: 'ray' }],
    draw(ctx, W, H, v, X) {
      const c = [W / 2, H / 2], s = 22, mx = [R(0.02, 0), R(0.02, 1), R(0.02, 2)];
      for (let y = -110; y <= 110; y += 2) for (let x = -200; x <= 200; x += 2) { const r = Math.hypot(x, y) / s; const k = [0, 1, 2].map(i => Math.pow(R(r, i) / mx[i], 0.35)); ctx.fillStyle = css(k.map(t => t * 0.9)); ctx.fillRect(c[0] + x, c[1] + y, 2, 2); }
      ctx.strokeStyle = col('ink'); ctx.beginPath(); ctx.arc(c[0], c[1], v.r * s, 0, 7); ctx.stroke();
      X.label(ctx, 'glow around a laser dot (brightness compressed to show the tail)', 10, 16, col('muted'));
    },
    plot: { x: 'r', logY: true, y: [1e-5, 30] }
  });

  A.fx('ssswidth', {
    title: 'Screen-space blur width',
    expr: 'pixels = ({rad} / 1000) · {Hs} / (2 · {d} · tan({fov} / 2))',
    vars: { rad: { sym: 'radius', name: 'scattering radius', unit: 'mm', min: 1, max: 20, value: 6, step: 0.1 }, d: { name: 'distance to the face', unit: 'm', min: 0.2, max: 20, value: 1, log: true },
            Hs: { sym: 'H', name: 'screen height', values: [1080, 1440, 2160], index: 0 }, fov: { name: 'vertical field of view', unit: '°', min: 10, max: 90, value: 40, step: 1 } },
    out: { sym: 'pixels', f: v => v.rad / 1000 * v.Hs / (2 * v.d * Math.tan(v.fov / 2 * DEG)) },
    sub: v => { const p = v.rad / 1000 * v.Hs / (2 * v.d * Math.tan(v.fov / 2 * DEG)); return `the kernel spans <b>${num(p)} pixels</b>${p < 1 ? ': below one pixel the pass can be skipped' : ''}`; },
    plot: { x: 'd', logY: true, y: [0.05, 500] }
  });

  /* pre-integrated: integrate cos+ around a circle of radius r (mm) weighted by the profile */
  function preint(th, r, c) {
    let num_ = 0, den = 0; const n = 180;
    for (let i = 0; i < n; i++) { const x = -PI + (i + 0.5) / n * 2 * PI, w = R(2 * r * Math.sin(Math.abs(x) / 2), c); num_ += Math.max(0, Math.cos(th + x)) * w; den += w; }
    return num_ / den;
  }
  A.fx('preint', {
    title: 'Pre-integrated diffuse',
    expr: 'D(θ, r) = ∫ cos⁺({th} + x) · R(2{r} · sin(x/2) / {k}) dx / ∫ R(2{r} · sin(x/2) / {k}) dx',
    vars: { th: { sym: 'θ', name: 'angle between normal and light', unit: '°', min: 0, max: 180, value: 90, step: 1 }, r: { name: 'radius of the surface curve', unit: 'mm', min: 1, max: 200, value: 8, log: true }, k: { name: 'profile width scale (1 = measured skin)', min: 1, max: 8, value: 3, step: 0.1 } },
    out: [{ sym: 'red', f: v => preint(v.th * DEG, v.r / v.k, 0), color: 'bad' }, { sym: 'blue', f: v => preint(v.th * DEG, v.r / v.k, 2), color: 'ray' }, { sym: 'Lambert', f: v => Math.max(0, Math.cos(v.th * DEG)), color: 'muted' }],
    draw(ctx, W, H, v, X) {
      const L = 20, R2 = W - 20, skin = [0.85, 0.55, 0.42], rows = [[v.r / v.k, 'this radius', 60], [1e4, 'flat (Lambert)', 150]];
      rows.forEach(([r, n, y]) => { for (let px = L; px < R2; px += 3) { const th = (px - L) / (R2 - L) * PI; ctx.fillStyle = css([0, 1, 2].map(c => skin[c] * (r > 1e3 ? Math.max(0, Math.cos(th)) : preint(th, r, c)))); ctx.fillRect(px, y, 3, 60); } X.label(ctx, n, L, y - 10, col('muted')); });
      X.label(ctx, 'lit (0°)', L, 228, col('muted')); X.label(ctx, 'unlit (180°)', R2, 228, col('muted'), 'right');
      const px = L + v.th / 180 * (R2 - L); ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, 50); ctx.lineTo(px, 214); ctx.stroke();
    },
    plot: { x: 'th', y: [0, 1] },
    note: 'Animate the angle on a small radius: red keeps light well past 90°, where Lambert is already black.'
  });

  A.fx('trans', {
    title: 'Transmission through thin tissue',
    expr: 'T = e<sup>−{t} / ℓ</sup> · max(0, −cos {th}),   ℓ = (3.7, 1.4, 0.7) mm',
    vars: { t: { name: 'thickness', unit: 'mm', min: 0.5, max: 20, value: 4, step: 0.1 }, th: { sym: 'θ', name: 'angle between normal and light (180° = light right behind)', unit: '°', min: 90, max: 180, value: 160, step: 1 } },
    out: [0, 1, 2].map(c => ({ sym: ['red', 'green', 'blue'][c], f: v => Math.exp(-v.t / ELL[c]) * Math.max(0, -Math.cos(v.th * DEG)), color: ['bad', 'good', 'ray'][c] })),
    draw(ctx, W, H, v, X) {
      const T = ELL.map(l => Math.exp(-v.t / l) * Math.max(0, -Math.cos(v.th * DEG)));
      ctx.fillStyle = css(T.map(x => Math.min(1, x * 2.5))); ctx.beginPath(); ctx.ellipse(W / 2, H / 2, 70, 100, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = col('line'); ctx.stroke();
      X.label(ctx, 'an ear lit from behind (brightened)', W / 2, H - 14, col('muted'), 'center');
    },
    plot: { x: 't', logY: true, y: [1e-4, 1] }
  });

  const D = (noh, r) => { const a = r * r, a2 = a * a, d = noh * noh * (a2 - 1) + 1; return a2 / (PI * d * d); };
  A.fx('dualspec', {
    title: 'Dual specular lobes',
    expr: 'D = lerp(D({r1}), D({r2}), {mix}),   N·H = cos {th}',
    vars: { th: { sym: 'θ<sub>H</sub>', name: 'angle between N and H', unit: '°', min: 0, max: 60, value: 8, step: 0.5 }, r1: { sym: 'r₁', name: 'sharp lobe roughness', min: 0.1, max: 0.6, value: 0.3, step: 0.01 },
            r2: { sym: 'r₂', name: 'broad lobe roughness', min: 0.3, max: 1, value: 0.65, step: 0.01 }, mix: { name: 'share of the broad lobe', min: 0, max: 1, value: 0.15, step: 0.01 } },
    out: [{ sym: 'sharp', f: v => (1 - v.mix) * D(Math.cos(v.th * DEG), v.r1), color: 'accent' }, { sym: 'broad', f: v => v.mix * D(Math.cos(v.th * DEG), v.r2), color: 'ray' }, { sym: 'total', f: v => (1 - v.mix) * D(Math.cos(v.th * DEG), v.r1) + v.mix * D(Math.cos(v.th * DEG), v.r2), color: 'ink' }],
    plot: { x: 'th', logY: true, y: [0.01, 50] },
    note: 'Unreal\'s defaults are close to these: roughness × 0.75 and × 1.3 with a 15% second lobe.'
  });
})();
