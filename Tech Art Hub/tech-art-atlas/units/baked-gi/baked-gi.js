/* Baked Light — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180, PI = Math.PI;
  const MiB = b => b >= 1048576 ? num(b / 1048576) + ' MiB' : num(b / 1024) + ' KiB';

  A.fx('bounce', {
    title: 'One bounce from a sunlit wall',
    expr: 'E<sub>bounce</sub> = {rho} · {E} · {F}',
    vars: { E: { name: 'light on the sunlit wall', unit: 'lx', min: 1000, max: 100000, value: 60000, log: true }, rho: { sym: 'ρ', name: 'wall albedo', min: 0.05, max: 0.9, value: 0.5, step: 0.01 },
            F: { name: 'view factor: share of the floor\'s view the wall fills', min: 0, max: 0.5, value: 0.2, step: 0.01 } },
    out: { sym: 'E<sub>bounce</sub>', unit: 'lx', f: v => v.rho * v.E * v.F },
    sub: v => `${num(v.rho)} · ${num(v.E)} · ${num(v.F)} = <b>${num(v.rho * v.E * v.F)} lx</b> on the floor, ${num(v.rho * v.E * v.F / v.E * 100)}% of the direct light; a second bounce adds about ${num(v.rho * v.rho * v.E * v.F * v.F)} lx`,
    draw(ctx, W, H, v, X) {
      ctx.fillStyle = alpha(col('muted'), 0.2); ctx.fillRect(40, H - 50, W - 80, 12); ctx.fillRect(W - 60, 40, 14, H - 78);
      const wl = Math.round(120 + 135 * v.rho); ctx.fillStyle = `rgb(${wl},${Math.round(wl * 0.55)},${Math.round(wl * 0.4)})`; ctx.fillRect(W - 60, 60, 14, 120);
      X.label(ctx, '☀', 60, 30, col('accent'), 'center', true); for (let i = 0; i < 4; i++) X.arrow(ctx, 70 + i * 20, 40, W - 64, 80 + i * 26, alpha(col('accent'), 0.6), 1.5);
      for (let i = 0; i < 5; i++) X.arrow(ctx, W - 64, 80 + i * 22, 120 + i * 50, H - 54, `rgba(230,120,90,${0.25 + 0.6 * v.rho})`, 1.5);
      X.label(ctx, 'sunlit wall', W - 70, 50, col('muted'), 'right'); X.label(ctx, 'floor in shade, lit by the wall', 50, H - 22, col('muted'));
    },
    plot: { x: 'F', y: [0, 25000] }
  });

  A.fx('lmbudget', {
    title: 'Lightmap texels and memory',
    expr: 'texels = {area} · {d}²,   bytes = texels · {bpt}',
    vars: { area: { name: 'static surface area in the level', unit: 'm²', min: 100, max: 1000000, value: 20000, log: true }, d: { sym: 'density', name: 'lightmap texels per metre', min: 0.5, max: 40, value: 8, log: true },
            bpt: { sym: 'bytes', name: 'bytes per texel (format)', values: [1, 2, 8], index: 0, labels: ['1 (BC6H)', '2 (RGBM in BC3, + dir.)', '8 (RGBA16F)'] } },
    out: [{ sym: 'texels', f: v => v.area * v.d * v.d, color: 'accent' }, { sym: 'memory', f: v => v.area * v.d * v.d * v.bpt * 4 / 3, fmt: MiB, color: 'ray' }],
    sub: v => `${num(v.area)} m² · ${num(v.d)}² = <b>${num(v.area * v.d * v.d)}</b> texels ≈ <b>${MiB(v.area * v.d * v.d * v.bpt * 4 / 3)}</b> with mips (one texel every ${num(100 / v.d)} cm)`,
    plot: { x: 'd', logY: true, y: [1e4, 1e11] }
  });

  const hemi = (t, s, g) => PI * (s * (1 + Math.cos(t)) / 2 + g * (1 - Math.cos(t)) / 2);
  A.fx('hemi', {
    title: 'Hemisphere light: a sky above, the ground below',
    expr: 'E = π · ({Ls} · (1 + cos {th}) / 2 + {Lg} · (1 − cos {th}) / 2)',
    vars: { th: { sym: 'θ', name: 'normal tilt from straight up', unit: '°', min: 0, max: 180, value: 60, step: 1 }, Ls: { sym: 'L<sub>sky</sub>', name: 'sky luminance', unit: 'cd/m²', min: 100, max: 10000, value: 3000, log: true },
            Lg: { sym: 'L<sub>ground</sub>', name: 'ground luminance', unit: 'cd/m²', min: 10, max: 3000, value: 300, log: true } },
    out: { sym: 'E', unit: 'lx', f: v => hemi(v.th * DEG, v.Ls, v.Lg) },
    draw(ctx, W, H, v, X) {
      const c = [W / 2, H / 2 + 10], R = 100;
      ctx.fillStyle = 'rgba(120,170,240,0.35)'; ctx.beginPath(); ctx.arc(c[0], c[1], R, Math.PI, 0); ctx.fill(); ctx.fillStyle = 'rgba(150,120,80,0.35)'; ctx.beginPath(); ctx.arc(c[0], c[1], R, 0, Math.PI); ctx.fill();
      X.label(ctx, 'sky', c[0], c[1] - R - 10, col('ray'), 'center'); X.label(ctx, 'ground', c[0], c[1] + R + 16, col('muted'), 'center');
      const t = v.th * DEG; ctx.strokeStyle = col('ink'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c[0] - Math.cos(t) * 40, c[1] - Math.sin(t) * 40); ctx.lineTo(c[0] + Math.cos(t) * 40, c[1] + Math.sin(t) * 40); ctx.stroke();
      X.arrow(ctx, ...c, c[0] + Math.sin(t) * 70, c[1] - Math.cos(t) * 70, col('accent'), 2.5); X.label(ctx, 'N', c[0] + Math.sin(t) * 80, c[1] - Math.cos(t) * 80, col('accent'), 'center', true);
    },
    plot: { x: 'th', y: [0, 10000] }
  });

  /* zonal SH demo: radiance depends only on the angle from the zenith */
  const P = [m => 1, m => m, m => 0.5 * (3 * m * m - 1), m => 0.5 * (5 * m * m * m - 3 * m)];
  const LAM = [0.5, 1 / 3, 1 / 8, 0];
  const rad = (m, w) => (Math.acos(clamp(m, -1, 1)) < w ? 1 : 0.08);
  const coef = (w) => { const a = [0, 0, 0, 0], n = 400; for (let i = 0; i < n; i++) { const m = -1 + (i + 0.5) / n * 2; for (let l = 0; l < 4; l++) a[l] += rad(m, w) * P[l](m) * (2 / n); } return a.map((x, l) => x * (2 * l + 1) / 2); };
  const approx = (m, w, b) => { const a = coef(w); let s = 0; for (let l = 0; l < b; l++) s += a[l] * P[l](m); return s; };
  const shIrr = (mn, w, b) => { const a = coef(w); let s = 0; for (let l = 0; l < b; l++) s += 2 * PI * LAM[l] * a[l] * P[l](mn); return s; };
  function exactIrr(tn, w) { // integrate radiance over the sphere, cosine weighted, normal tilted by tn
    const n = [Math.sin(tn), 0, Math.cos(tn)]; let s = 0; const NT = 48, NP = 64;
    for (let i = 0; i < NT; i++) { const th = (i + 0.5) / NT * PI, st = Math.sin(th), ct = Math.cos(th), L = rad(ct, w); if (!L) continue;
      for (let j = 0; j < NP; j++) { const ph = (j + 0.5) / NP * 2 * PI, d = [st * Math.cos(ph), st * Math.sin(ph), ct], c = Math.max(0, d[0] * n[0] + d[2] * n[2]); s += L * c * st; } }
    return s * (PI / NT) * (2 * PI / NP);
  }
  A.fx('sh', {
    title: 'A sky window, its SH bands, and the irradiance',
    expr: 'E(θ<sub>n</sub>) ≈ Σ<sub>l&lt;{b}</sub> 2π · λ<sub>l</sub> · a<sub>l</sub> · P<sub>l</sub>(cos {tn}),   window {w}',
    vars: { tn: { sym: 'θ<sub>n</sub>', name: 'tilt of the surface normal from the zenith', unit: '°', min: 0, max: 180, value: 60, step: 1 }, b: { name: 'SH bands used', min: 1, max: 3, value: 3, step: 1 },
            w: { sym: 'window', name: 'angular radius of the bright sky window', unit: '°', min: 10, max: 120, value: 40, step: 1, fmt: x => num(x) + '°' } },
    out: [{ sym: 'E exact', f: v => exactIrr(v.tn * DEG, v.w * DEG), color: 'good' }, { sym: 'E with SH', f: v => shIrr(Math.cos(v.tn * DEG), v.w * DEG, v.b), color: 'accent' }],
    draw(ctx, W, H, v, X) {
      const L = 30, R = W - 20, T = 30, B = H - 40, Xp = t => L + t / 180 * (R - L), Yp = y => B - (y + 0.3) / 1.5 * (B - T), w = v.w * DEG;
      ctx.strokeStyle = alpha(col('muted'), 0.4); ctx.beginPath(); ctx.moveTo(L, Yp(0)); ctx.lineTo(R, Yp(0)); ctx.stroke();
      ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.beginPath(); for (let t = 0; t <= 180; t += 0.5) { const y = rad(Math.cos(t * DEG), w); t ? ctx.lineTo(Xp(t), Yp(y)) : ctx.moveTo(Xp(t), Yp(y)); } ctx.stroke();
      ctx.strokeStyle = col('bad'); ctx.setLineDash([5, 4]); ctx.beginPath(); for (let t = 0; t <= 180; t += 1) { const y = approx(Math.cos(t * DEG), w, v.b); t ? ctx.lineTo(Xp(t), Yp(y)) : ctx.moveTo(Xp(t), Yp(y)); } ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, 'blue: sky light by angle from the zenith · red dashes: its approximation with ' + v.b + ' band' + (v.b > 1 ? 's' : ''), L, 16, col('muted'));
      X.label(ctx, '0° (zenith)', L, B + 16, col('muted')); X.label(ctx, '180° (straight down)', R, B + 16, col('muted'), 'right');
    },
    plot: { x: 'tn', y: [0, 3.5] },
    note: 'The light approximation is poor; the two irradiance curves on the graph almost overlap from 2 bands on.'
  });

  A.fx('leak', {
    title: 'Interpolating through a wall',
    expr: 'E(x) = lerp({Eo}, {Ei}, x / 4),   wall at x = {w}',
    vars: { x: { name: 'object position', unit: 'm', min: 0, max: 4, value: 2.8, step: 0.01 }, w: { name: 'wall position', unit: 'm', min: 0.3, max: 3.7, value: 1.5, step: 0.05 },
            Eo: { sym: 'E<sub>out</sub>', name: 'light at the outside probe', unit: 'lx', min: 1000, max: 50000, value: 20000, log: true }, Ei: { sym: 'E<sub>in</sub>', name: 'light at the inside probe', unit: 'lx', min: 5, max: 500, value: 30, log: true } },
    out: [{ sym: 'E probes', f: v => v.Eo + (v.Ei - v.Eo) * v.x / 4, color: 'bad' }, { sym: 'E true', f: v => v.x < v.w ? v.Eo : v.Ei, color: 'good' }],
    sub: v => { const e = v.Eo + (v.Ei - v.Eo) * v.x / 4, t = v.x < v.w ? v.Eo : v.Ei; return `interpolated <b>${num(e)} lx</b>, true <b>${num(t)} lx</b>${e / t > 2 ? `: ${num(e / t)}× too bright` : ''}`; },
    draw(ctx, W, H, v, X) {
      const L = 40, R = W - 40, P = x => L + x / 4 * (R - L), y = H / 2;
      ctx.fillStyle = 'rgba(255,200,90,0.15)'; ctx.fillRect(L - 30, 40, P(v.w) - L + 30, H - 80); X.label(ctx, 'outside (sunlit)', L - 26, 30, col('accent'));
      X.label(ctx, 'inside (dark room)', R + 26, 30, col('muted'), 'right');
      ctx.fillStyle = col('ink'); ctx.fillRect(P(v.w) - 4, 40, 8, H - 80);
      X.dot(ctx, P(0), y, col('accent'), 9); X.dot(ctx, P(4), y, col('ray'), 9); X.label(ctx, 'probe', P(0), y + 22, col('muted'), 'center'); X.label(ctx, 'probe', P(4), y + 22, col('muted'), 'center');
      ctx.setLineDash([4, 4]); ctx.strokeStyle = col('bad'); ctx.beginPath(); ctx.moveTo(P(0), y); ctx.lineTo(P(4), y); ctx.stroke(); ctx.setLineDash([]);
      const e = v.Eo + (v.Ei - v.Eo) * v.x / 4, b = Math.round(60 + 195 * Math.min(1, Math.log10(e) / Math.log10(v.Eo)));
      ctx.fillStyle = `rgb(${b},${b},${Math.round(b * 0.9)})`; ctx.beginPath(); ctx.arc(P(v.x), y - 50, 16, 0, 7); ctx.fill(); X.label(ctx, 'object', P(v.x), y - 76, col('ink'), 'center');
    },
    plot: { x: 'x', logY: true, y: [5, 60000] }
  });

  /* box projection in 2D: room [-3,3] x [0,4] (x across, y up), probe at the centre */
  function boxProj(v) {
    const p = [v.px, 0.0], r = [Math.sin(v.a * DEG), Math.cos(v.a * DEG)], bmin = [-3, 0], bmax = [3, 4];
    const t = [0, 1].map(i => { const inv = 1 / (Math.abs(r[i]) < 1e-6 ? 1e-6 : r[i]); return Math.max((bmin[i] - p[i]) * inv, (bmax[i] - p[i]) * inv); });
    const tf = Math.min(...t), hit = [p[0] + r[0] * tf, p[1] + r[1] * tf], c = [0, v.py];
    const d = [hit[0] - c[0], hit[1] - c[1]], dl = Math.hypot(...d);
    return { p, r, hit, c, corr: [d[0] / dl, d[1] / dl], err: Math.acos(clamp((r[0] * d[0] + r[1] * d[1]) / dl, -1, 1)) / DEG };
  }
  A.fx('boxproj', {
    title: 'Box-projected reflection (2D)',
    expr: 'hit = slab(p, r, box),   lookup = normalize(hit − probe),   p at x = {px},   r at {a}',
    vars: { px: { sym: 'p<sub>x</sub>', name: 'surface point across the floor', unit: 'm', min: -2.8, max: 2.8, value: -1.8, step: 0.01 }, a: { name: 'reflection direction from straight up', unit: '°', min: -80, max: 80, value: 30, step: 1 },
            py: { sym: 'probe y', name: 'probe height', unit: 'm', min: 0.5, max: 3.5, value: 2, step: 0.05 } },
    out: { sym: 'error', name: 'angle between naive and corrected lookup', unit: '°', f: v => boxProj(v).err },
    sub: v => `without box projection the lookup direction is off by <b>${num(boxProj(v).err)}°</b>`,
    draw(ctx, W, H, v, X) {
      const s = 52, ox = W / 2, oy = H - 30, P = (x, y) => [ox + x * s, oy - y * s], q = boxProj(v);
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 2; const a = P(-3, 4), b = P(3, 0); ctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
      X.dot(ctx, ...P(...q.c), col('ray'), 7); X.label(ctx, 'probe', P(...q.c)[0] + 10, P(...q.c)[1], col('ray'));
      X.arrow(ctx, ...P(...q.p), ...P(...q.hit), col('accent'), 2.5); X.dot(ctx, ...P(...q.hit), col('accent'), 5); X.label(ctx, 'what the reflection should show', P(...q.hit)[0], P(...q.hit)[1] - 12, col('accent'), 'center');
      X.arrow(ctx, ...P(...q.c), ...P(q.c[0] + q.corr[0] * 1.6, q.c[1] + q.corr[1] * 1.6), col('good'), 2); X.arrow(ctx, ...P(...q.c), ...P(q.c[0] + q.r[0] * 1.6, q.c[1] + q.r[1] * 1.6), col('bad'), 2);
      X.label(ctx, 'from the probe: green corrected, red naive', 10, 16, col('muted'));
      X.dot(ctx, ...P(...q.p), col('ink'), 5);
    },
    plot: { x: 'px', y: [0, 90] }
  });
})();
