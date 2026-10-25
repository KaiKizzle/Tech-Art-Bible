/* Light Types and Falloff — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180, PI = Math.PI;
  const win = (d, r) => Math.pow(clamp(1 - Math.pow(d / r, 4), 0, 1), 2) / (d * d + 1);

  A.fx('window', {
    title: 'Physical and windowed falloff',
    expr: 'falloff = saturate(1 − ({d} / {r})⁴)² / ({d}² + 1)',
    vars: { d: { name: 'distance from the light', unit: 'm', min: 0, max: 15, value: 4, step: 0.05 }, r: { name: 'light range', unit: 'm', min: 1, max: 15, value: 8, step: 0.1 } },
    out: [{ sym: '1 / d²', name: 'physical', f: v => 1 / Math.max(v.d * v.d, 1e-3), color: 'muted' }, { sym: 'windowed', f: v => win(v.d, v.r), color: 'accent' }],
    sub: v => `physical ${num(1 / Math.max(v.d * v.d, 1e-3))}, windowed <b>${num(win(v.d, v.r))}</b>${v.d >= v.r ? ' (outside the range: exactly 0)' : ''}`,
    draw(ctx, W, H, v, X) {
      const L = 20, R = W - 20, cy = H / 2, s = (R - L) / 15;
      for (let px = L; px < R; px++) { const d = (px - L) / s, e = win(d, v.r), b = Math.round(255 * Math.pow(Math.min(1, e * 2), 1 / 2.2)); ctx.fillStyle = `rgb(${b},${Math.round(b * 0.85)},${Math.round(b * 0.6)})`; ctx.fillRect(px, cy - 40, 1, 80); }
      ctx.strokeStyle = col('ray'); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(L + v.r * s, cy - 60); ctx.lineTo(L + v.r * s, cy + 60); ctx.stroke(); ctx.setLineDash([]); X.label(ctx, 'range', L + v.r * s, cy - 68, col('ray'), 'center');
      X.dot(ctx, L, cy, '#fff2c0', 8); X.dot(ctx, L + v.d * s, cy + 58, col('accent'), 5); X.label(ctx, 'd', L + v.d * s, cy + 74, col('accent'), 'center', true);
      X.label(ctx, 'brightness along the floor (display-encoded)', L, 18, col('muted'));
    },
    plot: { x: 'd', logY: true, y: [0.001, 10] }
  });

  const cone = (t, i, o) => { const c = Math.cos(t * DEG), ci = Math.cos(i * DEG), co = Math.cos(o * DEG); return Math.pow(clamp((c - co) / Math.max(ci - co, 1e-4), 0, 1), 2); };
  A.fx('spot', {
    title: 'Spot cone attenuation',
    expr: 'cone = saturate((cos {th} − cos {o}) / (cos {i} − cos {o}))²',
    vars: { th: { sym: 'θ', name: 'angle from the light\'s axis', unit: '°', min: 0, max: 80, value: 20, step: 0.5 }, i: { sym: 'inner', name: 'inner angle (full strength)', unit: '°', min: 0, max: 60, value: 15, step: 1 },
            o: { sym: 'outer', name: 'outer angle (zero)', unit: '°', min: 5, max: 80, value: 30, step: 1 } },
    out: { sym: 'cone', f: v => cone(v.th, Math.min(v.i, v.o - 0.5), v.o) },
    draw(ctx, W, H, v, X) {
      const c = [W / 2, 30], Lh = H - 60;
      for (let y = 0; y < Lh; y += 2) for (let x = -W / 2; x < W / 2; x += 2) { const t = Math.atan2(Math.abs(x), y + 1) / DEG, k = cone(t, Math.min(v.i, v.o - 0.5), v.o) * Math.min(1, 900 / ((y + 30) * (y + 30)) * 3); if (k < 0.01) continue; ctx.fillStyle = `rgba(255,220,150,${k})`; ctx.fillRect(c[0] + x, c[1] + y, 2, 2); }
      [[v.o, col('ray')], [Math.min(v.i, v.o), col('accent')]].forEach(([a, cc]) => { ctx.strokeStyle = cc; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(c[0] - Math.tan(a * DEG) * Lh, c[1] + Lh); ctx.lineTo(...c); ctx.lineTo(c[0] + Math.tan(a * DEG) * Lh, c[1] + Lh); ctx.stroke(); ctx.setLineDash([]); });
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...c); ctx.lineTo(c[0] + Math.tan(v.th * DEG) * Lh, c[1] + Lh); ctx.stroke();
      X.dot(ctx, ...c, '#fff2c0', 7); X.label(ctx, 'orange: inner · blue: outer · black: θ', 10, H - 10, col('muted'));
    },
    plot: { x: 'th', y: [0, 1] }
  });

  A.fx('spotlm', {
    title: 'Candela of a spot with a reflector',
    expr: 'I = {phi} / (2π · (1 − cos({ang} / 2)))',
    vars: { phi: { sym: 'Φ', name: 'lumens', unit: 'lm', min: 100, max: 5000, value: 800, step: 10 }, ang: { sym: 'θ', name: 'full cone angle', unit: '°', min: 5, max: 179, value: 40, step: 1 } },
    out: [{ sym: 'I', unit: 'cd', f: v => v.phi / (2 * PI * (1 - Math.cos(v.ang / 2 * DEG))), color: 'accent' }, { sym: 'I<sub>bare bulb</sub>', unit: 'cd', f: v => v.phi / (4 * PI), color: 'muted' }],
    sub: v => { const I = v.phi / (2 * PI * (1 - Math.cos(v.ang / 2 * DEG))); return `solid angle ${num(2 * PI * (1 - Math.cos(v.ang / 2 * DEG)))} sr → <b>${num(I)} cd</b>, ${num(I / (v.phi / (4 * PI)))}× a bare bulb of the same lumens`; },
    plot: { x: 'ang', logY: true, y: [10, 100000] }
  });

  A.fx('penumbra', {
    title: 'Sun penumbra width',
    expr: 'penumbra ≈ {d} · tan({s})',
    vars: { d: { name: 'distance from the shadow caster\'s edge to the ground', unit: 'm', min: 0.01, max: 30, value: 5, log: true }, s: { sym: 'size', name: 'angular size of the sun', unit: '°', min: 0.1, max: 3, value: 0.53, step: 0.01 } },
    out: { sym: 'penumbra', unit: 'cm', f: v => v.d * Math.tan(v.s * DEG) * 100 },
    draw(ctx, W, H, v, X) {
      // top view: a pole at the left casts a shadow strip to the right; each edge blurs with the distance to the pole's top
      const x0 = 50, x1 = W - 30, cy = H / 2, hw = 18, k = Math.tan(v.s * DEG) * 14; // blur exaggerated
      for (let x = x0; x < x1; x += 2) { const t = (x - x0) / (x1 - x0), blur = Math.max(0.5, t * (x1 - x0) * k);
        for (let y = -60; y <= 60; y += 2) { const e = clamp((hw - Math.abs(y)) / blur * 0.5 + 0.5, 0, 1); if (e < 0.02) continue; ctx.fillStyle = `rgba(0,0,0,${0.6 * e})`; ctx.fillRect(x, cy + y, 2, 2); } }
      ctx.fillStyle = col('ink'); ctx.beginPath(); ctx.arc(x0 - 6, cy, 10, 0, 7); ctx.fill();
      X.label(ctx, 'pole (seen from above)', x0 - 14, cy - 26, col('muted'));
      X.label(ctx, 'sharp near the foot', x0 + 10, cy + 80, col('muted')); X.label(ctx, 'soft far away', x1, cy + 80, col('muted'), 'right');
      X.label(ctx, 'shadow seen from above (sun size exaggerated)', 10, 18, col('muted'));
    },
    plot: { x: 'd', logY: true, y: [0.01, 200] }
  });

  function sphereE(r, d, beta) {
    const ca = Math.sqrt(Math.max(0, 1 - Math.min(1, r / d) ** 2)), N = 40, M = 48, sb = Math.sin(beta * DEG), cb = Math.cos(beta * DEG); let s = 0;
    for (let i = 0; i < N; i++) { const u = ca + (1 - ca) * (i + 0.5) / N, st = Math.sqrt(1 - u * u); for (let j = 0; j < M; j++) { const ph = (j + 0.5) / M * 2 * PI; s += Math.max(0, st * Math.cos(ph) * sb + u * cb); } }
    return s * 2 * PI * (1 - ca) / (N * M);
  }
  A.fx('sphere', {
    title: 'Sphere light on a tilted surface',
    expr: 'E<sub>point</sub> = π · L · sin²α · max(cos {b}, 0),   sin α = {r} / {d}',
    vars: { r: { name: 'light radius', unit: 'm', min: 0.05, max: 1, value: 0.4, step: 0.01 }, d: { name: 'distance to the light\'s centre', unit: 'm', min: 0.45, max: 6, value: 1, step: 0.01 },
            b: { sym: 'β', name: 'tilt of the surface away from the light', unit: '°', min: 0, max: 120, value: 80, step: 1 } },
    out: [{ sym: 'E<sub>sphere</sub>', name: 'exact, per unit luminance', f: v => sphereE(v.r, v.d, v.b), color: 'good' }, { sym: 'E<sub>point</sub>', f: v => PI * Math.min(1, (v.r / v.d) ** 2) * Math.max(0, Math.cos(v.b * DEG)), color: 'bad' }],
    sub: v => { const e = sphereE(v.r, v.d, v.b), p = PI * Math.min(1, (v.r / v.d) ** 2) * Math.max(0, Math.cos(v.b * DEG)); return `α = ${num(Math.asin(Math.min(1, v.r / v.d)) / DEG)}°: sphere <b>${num(e)}</b>, point <b>${num(p)}</b>${p < 1e-6 && e > 1e-4 ? ' (the point is below the horizon, the sphere is not)' : ''}`; },
    draw(ctx, W, H, v, X) {
      const s = 60, c = [W / 2, H / 2 + 20], b = v.b * DEG, Lc = [c[0], c[1] - v.d * s];
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c[0] - Math.cos(b) * 120, c[1] - Math.sin(b) * 120); ctx.lineTo(c[0] + Math.cos(b) * 120, c[1] + Math.sin(b) * 120); ctx.stroke();
      X.arrow(ctx, ...c, c[0] + Math.sin(b) * 50, c[1] - Math.cos(b) * 50, col('ax-y'), 2); X.label(ctx, 'N', c[0] + Math.sin(b) * 60, c[1] - Math.cos(b) * 60, col('ax-y'), 'center', true);
      ctx.fillStyle = 'rgba(255,230,160,0.9)'; ctx.beginPath(); ctx.arc(Lc[0], Lc[1], v.r * s, 0, 7); ctx.fill();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = col('muted'); ctx.beginPath(); ctx.moveTo(c[0] - Math.cos(b) * 200, c[1] - Math.sin(b) * 200); ctx.lineTo(c[0] + Math.cos(b) * 200, c[1] + Math.sin(b) * 200); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, 'dashed: the surface\'s horizon', 10, H - 10, col('muted'));
    },
    plot: { x: 'b', y: [0, 1.5] },
    note: 'Facing the light, both agree exactly. Tilt toward 90°: the point light vanishes while part of the sphere is still above the horizon.'
  });

  const ies = (t, n, s) => Math.pow(Math.max(Math.cos(t * DEG), 0), n) + s * Math.max(0, Math.sin(t * DEG));
  A.fx('ies', {
    title: 'IES-like profile',
    expr: 'I(θ) = I₀ · (cos {th})<sup>{n}</sup> + {sp} · sin {th}',
    vars: { th: { sym: 'θ', name: 'angle from straight down', unit: '°', min: 0, max: 180, value: 30, step: 1 }, n: { name: 'beam tightness', min: 1, max: 60, value: 8, step: 1 }, sp: { sym: 'spill', name: 'sideways spill', min: 0, max: 0.6, value: 0.15, step: 0.01 } },
    out: { sym: 'I / I₀', f: v => ies(v.th, v.n, v.sp) },
    draw(ctx, W, H, v, X) {
      const c = [W / 2, 40], s = 160;
      ctx.fillStyle = alpha(col('accent'), 0.18); ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath();
      for (let a = -180; a <= 180; a += 2) { const r = ies(Math.abs(a), v.n, v.sp) * s; const p = [c[0] + Math.sin(a * DEG) * r, c[1] + Math.cos(a * DEG) * r]; a === -180 ? ctx.moveTo(...p) : ctx.lineTo(...p); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      X.dot(ctx, ...c, '#fff2c0', 7); X.label(ctx, 'fixture', c[0] + 10, c[1] - 8, col('muted'));
      const r = ies(v.th, v.n, v.sp) * s; X.arrow(ctx, ...c, c[0] + Math.sin(v.th * DEG) * r, c[1] + Math.cos(v.th * DEG) * r, col('ink'), 2);
      X.label(ctx, 'polar plot: candela by direction (down is 0°)', 10, H - 10, col('muted'));
    },
    plot: { x: 'th', y: [0, 1.2] }
  });

  A.fx('lightcost', {
    title: 'Lights per pixel',
    expr: 'per pixel ≈ {n} · π · ({r} / ({d} · tan 30°))² / (4 · 16/9)',
    vars: { n: { sym: 'N', name: 'lights in view', min: 1, max: 1000, value: 100, log: true }, r: { name: 'average light range', unit: 'm', min: 0.5, max: 30, value: 5, step: 0.1 }, d: { name: 'average distance from the camera', unit: 'm', min: 2, max: 200, value: 30, log: true } },
    out: { sym: 'lights / pixel', f: v => v.n * PI * Math.pow(v.r / (v.d * Math.tan(30 * DEG)), 2) / (4 * 16 / 9) },
    sub: v => { const s = PI * Math.pow(v.r / (v.d * Math.tan(30 * DEG)), 2) / (4 * 16 / 9); return `each light covers about <b>${num(Math.min(s, 1) * 100)}%</b> of the screen → <b>${num(v.n * s)}</b> lighting evaluations per pixel on average`; },
    plot: { x: 'r', logY: true, y: [0.01, 1000] }
  });
})();
