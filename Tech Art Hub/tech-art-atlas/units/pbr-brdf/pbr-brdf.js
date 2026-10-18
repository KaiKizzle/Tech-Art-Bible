/* Inside a PBR Shader — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180, PI = Math.PI;
  const D = (noh, r) => { const a = r * r, a2 = a * a, d = noh * noh * (a2 - 1) + 1; return a2 / (PI * d * d); };
  const G1 = (x, k) => x / (x * (1 - k) + k);
  const schlick = (f0, c) => f0 + (1 - f0) * Math.pow(1 - c, 5);
  /* in-plane BRDF value: light at angle tl from the normal, view at tv (signed, same plane) */
  function brdf(tl, tv, r, metal, base) {
    const L = [Math.sin(tl), Math.cos(tl)], V = [Math.sin(tv), Math.cos(tv)], Hn = [L[0] + V[0], L[1] + V[1]], hl = Math.hypot(...Hn), H = [Hn[0] / hl, Hn[1] / hl];
    const nol = Math.max(L[1], 0), nov = Math.max(V[1], 0) + 1e-4, noh = Math.max(H[1], 0), voh = Math.max(V[0] * H[0] + V[1] * H[1], 0);
    const f0 = 0.04 + (base - 0.04) * metal, F = schlick(f0, voh), k = (r + 1) * (r + 1) / 8, G = G1(nol, k) * G1(nov, k);
    const spec = D(noh, r) * F * G / (4 * nol * nov + 1e-4), kd = (1 - F) * (1 - metal);
    return { spec, diff: kd * base / PI, nol, total: (kd * base / PI + spec) * nol };
  }

  A.fx('split', {
    title: 'Sharing the light between specular and diffuse',
    expr: 'k<sub>s</sub> = {F},   k<sub>d</sub> = (1 − {F}) · (1 − {m})',
    vars: { F: { name: 'share reflected at the surface (Fresnel)', min: 0, max: 1, value: 0.04, step: 0.01 }, m: { name: 'metallic', min: 0, max: 1, value: 0, step: 0.01 } },
    sub: v => `k<sub>s</sub> = <b>${num(v.F)}</b>,   k<sub>d</sub> = (1 − ${num(v.F)}) · (1 − ${num(v.m)}) = <b>${num((1 - v.F) * (1 - v.m))}</b>,   absorbed ${num((1 - v.F) * v.m)}`,
    out: [{ sym: 'k<sub>s</sub>', name: 'specular', f: v => v.F, color: 'ray' }, { sym: 'k<sub>d</sub>', name: 'diffuse', f: v => (1 - v.F) * (1 - v.m), color: 'accent' }, { sym: 'absorbed', f: v => (1 - v.F) * v.m, color: 'muted' }],
    draw(ctx, W, H, v, X) {
      const x0 = 40, w = W - 80, y = 80, h = 60, ks = v.F, kd = (1 - v.F) * (1 - v.m);
      ctx.fillStyle = col('ray'); ctx.fillRect(x0, y, w * ks, h); ctx.fillStyle = col('accent'); ctx.fillRect(x0 + w * ks, y, w * kd, h); ctx.fillStyle = alpha(col('muted'), 0.4); ctx.fillRect(x0 + w * (ks + kd), y, w * (1 - ks - kd), h);
      ctx.strokeStyle = col('line'); ctx.strokeRect(x0, y, w, h);
      X.label(ctx, 'all the light arriving', x0, y - 12, col('muted'));
      [['bounces (specular)', 'ray', ks], ['scatters out (diffuse)', 'accent', kd], ['absorbed (metals)', 'muted', 1 - ks - kd]].forEach(([n, c, s], i) => X.label(ctx, `${n}: ${Math.round(s * 100)}%`, x0, y + h + 26 + i * 20, col(c), 'left', true));
    },
    plot: { x: 'm', y: [0, 1] }
  });

  A.fx('diffuse', {
    title: 'Lambert diffuse',
    expr: 'L<sub>out</sub> = {alb} / π · {E} · max(cos {th}, 0)',
    vars: { alb: { sym: 'albedo', name: 'diffuse albedo', min: 0.02, max: 0.95, value: 0.5, step: 0.01 }, E: { name: 'light arriving head-on', unit: 'lx', min: 1, max: 100000, value: 1000, log: true },
            th: { sym: 'θ', name: 'light angle from the normal', unit: '°', min: 0, max: 100, value: 30, step: 1 } },
    out: { sym: 'L<sub>out</sub>', unit: 'cd/m²', f: v => v.alb / PI * v.E * Math.max(Math.cos(v.th * DEG), 0) },
    plot: { x: 'th', y: [0, 160] }
  });

  A.fx('half', {
    title: 'The half vector',
    expr: 'H = normalize(L + V),   L at {tl},   V at {tv}',
    vars: { tl: { sym: 'θ<sub>L</sub>', name: 'light angle from the normal (left is negative)', unit: '°', min: -85, max: 85, value: -40, step: 1 }, tv: { sym: 'θ<sub>V</sub>', name: 'view angle from the normal', unit: '°', min: -85, max: 85, value: 20, step: 1 } },
    out: [{ sym: 'θ<sub>H</sub>', f: v => (v.tl + v.tv) / 2, fmt: x => num(x) + '°', color: 'accent' }, { sym: 'N·H', f: v => Math.cos((v.tl + v.tv) / 2 * DEG), color: 'ray' }],
    draw(ctx, W, H, v, X) {
      const c = [W / 2, H - 40], R = 150, dir = a => [c[0] + Math.sin(a * DEG) * R, c[1] - Math.cos(a * DEG) * R];
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(30, c[1]); ctx.lineTo(W - 30, c[1]); ctx.stroke();
      for (let i = -6; i <= 6; i++) { const x = c[0] + i * 26, a = Math.sin(i * 1.7) * 0.4; ctx.strokeStyle = alpha(col('muted'), 0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 10, c[1] + 6 - Math.sin(a) * 10); ctx.lineTo(x + Math.cos(a) * 10, c[1] + 6 + Math.sin(a) * 10); ctx.stroke(); }
      X.label(ctx, 'microfacets', c[0] + 6 * 26 + 14, c[1] + 10, col('muted'));
      ctx.setLineDash([4, 4]); ctx.strokeStyle = col('muted'); ctx.beginPath(); ctx.moveTo(...c); ctx.lineTo(c[0], c[1] - R); ctx.stroke(); ctx.setLineDash([]); X.label(ctx, 'N', c[0] + 6, c[1] - R, col('muted'));
      X.arrow(ctx, ...c, ...dir(v.tl), col('accent'), 2.5); X.label(ctx, 'L', dir(v.tl)[0] - 12, dir(v.tl)[1], col('accent'), 'center', true);
      X.arrow(ctx, ...c, ...dir(v.tv), col('ray'), 2.5); X.label(ctx, 'V', dir(v.tv)[0] + 12, dir(v.tv)[1], col('ray'), 'center', true);
      const hh = (v.tl + v.tv) / 2; X.arrow(ctx, ...c, c[0] + Math.sin(hh * DEG) * R * 0.7, c[1] - Math.cos(hh * DEG) * R * 0.7, col('ink'), 3); X.label(ctx, 'H', c[0] + Math.sin(hh * DEG) * R * 0.7 + 10, c[1] - Math.cos(hh * DEG) * R * 0.7, col('ink'), 'left', true);
    },
    plot: { x: 'tv', y: [-90, 90] }
  });

  A.fx('ggx', {
    title: 'GGX normal distribution',
    expr: 'D = α² / (π · ((N·H)² · (α² − 1) + 1)²),   α = {r}²,   N·H = cos {th}',
    vars: { th: { sym: 'θ<sub>H</sub>', name: 'angle between N and H', unit: '°', min: 0, max: 89, value: 10, step: 0.5 }, r: { sym: 'roughness', name: 'roughness', min: 0.05, max: 1, value: 0.4, step: 0.01 } },
    out: { sym: 'D', f: v => D(Math.cos(v.th * DEG), v.r) },
    draw(ctx, W, H, v, X) {
      const c = [W / 2, H - 40], mx = D(1, v.r), s = 150 / Math.max(mx, 0.3);
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(20, c[1]); ctx.lineTo(W - 20, c[1]); ctx.stroke();
      ctx.fillStyle = alpha(col('ray'), 0.18); ctx.strokeStyle = col('ray'); ctx.beginPath();
      for (let a = -90; a <= 90; a += 1) { const r = 160 * Math.sqrt(D(Math.cos(a * DEG), v.r) / mx); const p = [c[0] + Math.sin(a * DEG) * r, c[1] - Math.cos(a * DEG) * r]; a === -90 ? ctx.moveTo(...p) : ctx.lineTo(...p); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      X.label(ctx, 'how many facets point each way (radius ∝ √D, so both extremes fit)', 20, 20, col('muted'));
    },
    plot: { x: 'th', logY: true, y: [0.001, 1000] },
    note: 'Low roughness: a tall, narrow spike. High roughness: a low, wide dome.'
  });

  A.fx('f0', {
    title: 'F0 from base colour and metallic, and Fresnel by angle',
    expr: 'F0 = lerp(0.04, {b}, {m}),   F = F0 + (1 − F0) · (1 − cos {th})⁵',
    vars: { b: { sym: 'base', name: 'base colour (one channel, linear)', min: 0, max: 1, value: 0.9, step: 0.01 }, m: { name: 'metallic', min: 0, max: 1, value: 0, step: 0.01 },
            th: { sym: 'θ', name: 'angle between V and H', unit: '°', min: 0, max: 89, value: 0, step: 1 } },
    out: [{ sym: 'F0', f: v => 0.04 + (v.b - 0.04) * v.m, color: 'accent' }, { sym: 'F', f: v => schlick(0.04 + (v.b - 0.04) * v.m, Math.cos(v.th * DEG)), color: 'ray' }],
    plot: { x: 'th', y: [0, 1] }
  });

  A.fx('smith', {
    title: 'Smith–Schlick geometry term',
    expr: 'G₁(x) = x / (x(1 − k) + k),   k = ({r} + 1)² / 8,   G = G₁(cos {tl}) · G₁(cos {tv})',
    vars: { tl: { sym: 'θ<sub>L</sub>', name: 'light angle', unit: '°', min: 0, max: 89, value: 30, step: 1 }, tv: { sym: 'θ<sub>V</sub>', name: 'view angle', unit: '°', min: 0, max: 89, value: 70, step: 1 },
            r: { sym: 'roughness', name: 'roughness', min: 0.05, max: 1, value: 0.6, step: 0.01 } },
    out: { sym: 'G', f: v => { const k = (v.r + 1) * (v.r + 1) / 8; return G1(Math.cos(v.tl * DEG), k) * G1(Math.cos(v.tv * DEG), k); } },
    plot: { x: 'tv', y: [0, 1] }
  });

  A.fx('brdf', {
    title: 'The full BRDF: reflected light toward each direction',
    expr: 'f = k<sub>d</sub> · {b} / π + D · F · G / (4 · N·L · N·V),   light at {tl},   roughness {r},   metallic {m}',
    vars: { tl: { sym: 'θ<sub>L</sub>', name: 'light angle (from the left)', unit: '°', min: 0, max: 85, value: 45, step: 1 }, r: { sym: 'r', name: 'roughness', min: 0.05, max: 1, value: 0.35, step: 0.01 },
            m: { name: 'metallic', min: 0, max: 1, value: 0, step: 0.01 }, b: { sym: 'base', name: 'base colour (one channel)', min: 0, max: 1, value: 0.8, step: 0.01 },
            tv: { sym: 'θ<sub>V</sub>', name: 'view angle (positive = right)', unit: '°', min: -85, max: 85, value: 45, step: 1 } },
    out: [{ sym: 'diffuse', f: v => brdf(-v.tl * DEG, v.tv * DEG, v.r, v.m, v.b).diff * Math.cos(v.tl * DEG), color: 'accent' }, { sym: 'specular', f: v => { const q = brdf(-v.tl * DEG, v.tv * DEG, v.r, v.m, v.b); return q.spec * q.nol; }, color: 'ray' }],
    draw(ctx, W, H, v, X) {
      const c = [W / 2, H - 30], tl = -v.tl * DEG;
      let mx = 0; const pts = []; for (let a = -88; a <= 88; a += 1) { const q = brdf(tl, a * DEG, v.r, v.m, v.b); pts.push([a, q.total]); mx = Math.max(mx, q.total); }
      const s = 170 / Math.max(mx, 0.05);
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(20, c[1]); ctx.lineTo(W - 20, c[1]); ctx.stroke();
      ctx.fillStyle = alpha(col('ray'), 0.18); ctx.strokeStyle = col('ray'); ctx.beginPath(); ctx.moveTo(...c);
      pts.forEach(([a, t]) => ctx.lineTo(c[0] + Math.sin(a * DEG) * t * s, c[1] - Math.cos(a * DEG) * t * s)); ctx.closePath(); ctx.fill(); ctx.stroke();
      X.arrow(ctx, c[0] + Math.sin(tl) * 180, c[1] - Math.cos(tl) * 180, c[0], c[1], col('accent'), 2.5); X.label(ctx, 'light', c[0] + Math.sin(tl) * 180 - 6, c[1] - Math.cos(tl) * 180 - 10, col('accent'), 'center', true);
      X.arrow(ctx, ...c, c[0] + Math.sin(v.tv * DEG) * 120, c[1] - Math.cos(v.tv * DEG) * 120, col('ink'), 1.5); X.label(ctx, 'V', c[0] + Math.sin(v.tv * DEG) * 128, c[1] - Math.cos(v.tv * DEG) * 128, col('ink'), 'center', true);
      X.label(ctx, 'blue: reflected light in each direction (scaled to fit)', 20, 18, col('muted'));
    },
    plot: { x: 'tv', y: [0, 3] }
  });

  /* lobe half-width: angle where D falls to half of its peak */
  const halfWidth = r => { const p = D(1, r); for (let a = 0; a < 90; a += 0.1) if (D(Math.cos(a * DEG), r) < p / 2) return a; return 90; };
  A.fx('ibl', {
    title: 'Which pre-filtered mip a roughness reads',
    expr: 'mip = {r} · ({n} − 1)',
    vars: { r: { sym: 'roughness', name: 'roughness (perceptual)', min: 0, max: 1, value: 0.5, step: 0.01 }, n: { name: 'mip levels of the cubemap', values: [6, 7, 8, 9], index: 1 } },
    out: { sym: 'mip', f: v => v.r * (v.n - 1) },
    sub: v => `mip = ${num(v.r)} · ${v.n - 1} = <b>${num(v.r * (v.n - 1))}</b>; the GGX lobe at this roughness is about <b>${num(halfWidth(Math.max(v.r, 0.02)) * 2)}°</b> wide (where D falls to half)`,
    draw(ctx, W, H, v, X) {
      const sz = 128;
      for (let i = 0; i < v.n; i++) { const s = Math.max(4, sz / Math.pow(2, i) * 0.9), x = 20 + i * (W - 40) / v.n, y = 60; const b = Math.min(1, i / (v.n - 1)); ctx.fillStyle = `rgb(${Math.round(60 + 90 * (1 - b))},${Math.round(90 + 60 * (1 - b))},${Math.round(130 + 50 * (1 - b))})`; ctx.fillRect(x, y, Math.min(s, (W - 40) / v.n - 6), Math.min(s, (W - 40) / v.n - 6)); X.label(ctx, 'mip ' + i, x, y + 70, col('muted')); }
      const m = v.r * (v.n - 1), x = 20 + m * (W - 40) / v.n; ctx.strokeStyle = col('accent'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, 150); ctx.stroke();
      X.label(ctx, 'each mip is the environment blurred by a wider GGX lobe', 20, 30, col('muted'));
      X.label(ctx, 'between two mips, the GPU blends them (trilinear)', 20, H - 20, col('muted'));
    },
    plot: { x: 'r', y: [0, 9] }
  });
})();
