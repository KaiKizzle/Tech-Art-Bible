/* Metals — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, S = window.Surf, { col, alpha, num } = A;
  const { PI, sat, clamp, s2l, css, norm, dot } = S;
  const rad = d => d * PI / 180;
  const STUDIO = { zenith: [0.3, 0.31, 0.34], horizon: [1, 0.98, 0.95] };

  /* ---------- skin depth ---------- */
  A.fx('skin', {
    title: 'How far light gets into a metal',
    expr: 'δ = {lam} / (4π · {k})',
    vars: { lam: { sym: 'λ', name: 'wavelength', unit: 'nm', min: 380, max: 750, value: 550, step: 1 },
            k: { sym: 'k', name: 'extinction coefficient (imaginary part of the IOR)', min: 0.5, max: 10, value: 3, step: 0.05 } },
    out: { sym: 'δ', f: v => v.lam / (4 * PI * v.k), unit: 'nm', fmt: x => num(x) },
    sub: (v, n) => `light intensity falls to 37 % after <b>${n(v.lam / (4 * PI * v.k))} nm</b>, about ${n(v.lam / (4 * PI * v.k) / 0.25)} atom layers; nothing comes back out as diffuse light`,
    draw(ctx, W, H, v, X) {
      const d = v.lam / (4 * PI * v.k), x0 = 40, x1 = W - 20, y0 = 40, y1 = H - 50, sc = (x1 - x0) / 120;   // 120 nm across
      ctx.fillStyle = alpha(col('muted'), 0.18); ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      X.label(ctx, 'metal', x0 + 6, y0 + 12, col('muted')); X.label(ctx, 'air', 6, y0 + 12, col('muted'));
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath();
      for (let px = 0; px <= x1 - 8; px++) { const z = (px - x0) / sc, amp = px < x0 ? 1 : Math.exp(-z / (2 * d)), y = (y0 + y1) / 2 - Math.sin(px / (v.lam / 40) * 2 * PI * 0.25) * amp * (y1 - y0) * 0.4; px ? ctx.lineTo(px, y) : ctx.moveTo(px, y); }
      ctx.stroke();
      const xd = x0 + d * sc; ctx.setLineDash([4, 4]); ctx.strokeStyle = col('ray'); ctx.beginPath(); ctx.moveTo(xd, y0); ctx.lineTo(xd, y1); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, `δ = ${num(d)} nm`, Math.min(xd + 4, W - 90), y1 + 16, col('ray'));
      ctx.strokeStyle = col('muted'); ctx.beginPath(); ctx.moveTo(x0, y1 + 32); ctx.lineTo(x0 + 50 * sc, y1 + 32); ctx.stroke(); X.label(ctx, '50 nm', x0 + 50 * sc + 6, y1 + 32, col('muted'));
    },
    plot: { x: 'k', logY: true, y: [3, 150] }, size: [440, 260]
  });

  /* ---------- exact conductor Fresnel versus Schlick ---------- */
  A.fx('cfresnel', {
    title: 'Fresnel for a metal: exact and Schlick',
    expr: 'F0 = (({n} − 1)² + {k}²) / (({n} + 1)² + {k}²),   F({th}) exact vs F0 + (1 − F0)(1 − cos {th})<sup>5</sup>',
    vars: { n: { sym: 'n', name: 'real part of the IOR', min: 0.05, max: 3.5, value: 1.37, step: 0.01 },
            k: { sym: 'k', name: 'extinction coefficient', min: 0, max: 8, value: 7.62, step: 0.01 },
            th: { sym: 'θ', name: 'angle from the normal', unit: '°', min: 0, max: 89.5, value: 70, step: 0.5 } },
    out: [{ sym: 'exact', f: v => S.conductor(Math.cos(rad(v.th)), v.n, v.k), color: 'accent' }, { sym: 'Schlick', f: v => S.schlick(S.f0Conductor(v.n, v.k), Math.cos(rad(v.th))), color: 'ray', dash: [6, 4] }],
    sub: (v, n) => { const f0 = S.f0Conductor(v.n, v.k), e = S.conductor(Math.cos(rad(v.th)), v.n, v.k), s = S.schlick(f0, Math.cos(rad(v.th))); return `F0 = <b>${n(f0)}</b>; at ${n(v.th)}° exact ${n(e)}, Schlick ${n(s)} (${s > e ? '+' : '−'}${n(Math.abs(s - e) * 100)} points)`; },
    note: 'Start values: aluminium in the red (n ≈ 1.37, k ≈ 7.6). Try n 0.18, k 3.4 (gold in the red) or n 2.9, k 3.0 (iron): the dip before 90° is what Schlick misses.',
    plot: { x: 'th', y: [0, 1.02] }
  });

  /* ---------- F82: fitting the edge tint ---------- */
  A.fx('f82', {
    title: 'Edge tint: matching the measured curve at 82°',
    expr: 'tint = F<sub>exact</sub>(82°) / Schlick(82°),   F<sub>82</sub>({th}) = Schlick({th}) − c · cos {th} · (1 − cos {th})<sup>6</sup>,   c sets F<sub>82</sub>(82°) = tint · Schlick(82°)',
    sub: (v, n) => { const f0 = S.f0Conductor(v.n, v.k), t = S.conductor(S.MU82, v.n, v.k) / S.schlick(f0, S.MU82), mu = Math.cos(rad(v.th)); return `at ${n(v.th)}°: exact <b>${n(S.conductor(mu, v.n, v.k))}</b>, F82 fit <b>${n(S.f82(f0, t, mu))}</b>, plain Schlick ${n(S.schlick(f0, mu))}`; },
    vars: { n: { sym: 'n', name: 'real part of the IOR', min: 0.05, max: 3.5, value: 2.9, step: 0.01 },
            k: { sym: 'k', name: 'extinction coefficient', min: 0.5, max: 8, value: 3.0, step: 0.01 },
            th: { sym: 'θ', name: 'angle from the normal', unit: '°', min: 0, max: 89.5, value: 82, step: 0.5 } },
    out: [{ sym: 'exact', f: v => S.conductor(Math.cos(rad(v.th)), v.n, v.k), color: 'accent' },
          { sym: 'F82 fit', f: v => { const f0 = S.f0Conductor(v.n, v.k), t = S.conductor(S.MU82, v.n, v.k) / S.schlick(f0, S.MU82); return S.f82(f0, t, Math.cos(rad(v.th))); }, color: 'good', dash: [6, 4] },
          { sym: 'Schlick', f: v => S.schlick(S.f0Conductor(v.n, v.k), Math.cos(rad(v.th))), color: 'ray', dash: [2, 4] }],
    steps: (v, n) => { const f0 = S.f0Conductor(v.n, v.k), t = S.conductor(S.MU82, v.n, v.k) / S.schlick(f0, S.MU82); return [['F0', n(f0)], ['tint', n(t)], ['as sRGB 0–255', `${S.l2s(f0)} / ${S.l2s(t)}`]]; },
    note: 'One channel. A metal needs this per colour channel, which is how the measured F0 and edge-tint tables are made.',
    plot: { x: 'th', y: [0, 1.02] }
  });

  /* ---------- metal library ---------- */
  const M = S.METALS;
  A.fx('library', {
    title: 'Measured metals as base colour and edge tint',
    expr: 'F0 = {i},   roughness {r}',
    vars: { i: { sym: 'metal', name: 'metal', values: M.map((_, j) => j), labels: M.map(m => m[0]), index: 2 },
            r: { sym: 'r', name: 'roughness', min: 0.03, max: 1, value: 0.25, step: 0.01 },
            t: { sym: 'edge', name: 'edge tint', values: [1, 0], labels: ['on (F82)', 'off (plain Schlick)'], index: 0 } },
    out: { sym: 'F0 luminance', f: v => S.lum(M[v.i][2].map(s2l)) },
    sub: (v, n) => { const m = M[v.i]; return `${m[0]} (${m[1]}): base colour <b>${m[2].join(', ')}</b> sRGB, edge tint ${m[3].join(', ')} sRGB`; },
    steps: (v, n) => { const f = M[v.i][2].map(s2l), t = M[v.i][3].map(s2l); return [['F0 linear', `(${f.map(x => n(x)).join(', ')})`], ['tint linear', `(${t.map(x => n(x)).join(', ')})`], ['hex', S.hex(f)]]; },
    draw(ctx, W, H, v, X) {
      const m = M[v.i], f = m[2].map(s2l), t = v.t ? m[3].map(s2l) : [1, 1, 1], R = Math.min(W, H) / 2 - 18;
      S.backdrop(ctx, W, H, STUDIO);
      S.sphere(ctx, W / 2, H / 2, R, nn => S.shade(nn, { base: f, metal: 1, rough: v.r, tint: t, envOpt: STUDIO }), 2, 1);
      ctx.fillStyle = css(f); ctx.fillRect(12, 12, 40, 26); ctx.fillStyle = css(m[3].map(s2l)); ctx.fillRect(12, 42, 40, 14);
      X.label(ctx, 'F0', 58, 25, '#fff'); X.label(ctx, 'tint', 58, 49, '#fff');
    },
    plot: false, size: [520, 340]
  });

  /* ---------- energy lost at high roughness ---------- */
  const cache = new Map();
  function dirAlbedo(mu, r) {                 // directional albedo of single-scattering GGX with F = 1
    const key = Math.round(mu * 200) + ':' + Math.round(r * 200); if (cache.has(key)) return cache.get(key);
    const a = Math.max(r * r, 1e-3), a2 = a * a, nv = Math.max(mu, 1e-3), v = [Math.sqrt(1 - nv * nv), 0, nv], N = 24; let sum = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const u1 = (i + 0.5) / N, u2 = (j + 0.5) / N, ct = Math.sqrt((1 - u1) / (1 + (a2 - 1) * u1)), st = Math.sqrt(1 - ct * ct), ph = 2 * PI * u2;
      const h = [st * Math.cos(ph), st * Math.sin(ph), ct], vh = dot(v, h), l = [2 * vh * h[0] - v[0], 2 * vh * h[1] - v[1], 2 * vh * h[2] - v[2]], nl = l[2];
      if (nl <= 0 || vh <= 0) continue;
      const g2 = 2 * nl * nv / (nv * Math.sqrt(a2 + (1 - a2) * nl * nl) + nl * Math.sqrt(a2 + (1 - a2) * nv * nv));
      sum += g2 * vh / (ct * nv);
    }
    const e = Math.min(sum / (N * N), 1); cache.set(key, e); return e;
  }
  A.fx('energy', {
    title: 'Rough metals lose light that should bounce again',
    expr: 'E = ∫ D · G · F / (4 μ<sub>i</sub> μ<sub>o</sub>) · μ<sub>i</sub> dω  (F = 1, roughness {r}, view {th}),   compensation = 1 + {f0} · (1 − E) / E',
    vars: { r: { sym: 'r', name: 'roughness', min: 0.02, max: 1, value: 0.8, step: 0.01 },
            th: { sym: 'θ', name: 'view angle from the normal', unit: '°', min: 0, max: 85, value: 30, step: 1 },
            f0: { sym: 'F0', name: 'F0 of the metal (one channel)', min: 0.5, max: 1, value: 0.95, step: 0.01 } },
    out: [{ sym: 'E', f: v => dirAlbedo(Math.cos(rad(v.th)), v.r), color: 'accent' }, { sym: 'missing', f: v => 1 - dirAlbedo(Math.cos(rad(v.th)), v.r), color: 'bad' },
          { sym: 'compensation', f: v => { const e = dirAlbedo(Math.cos(rad(v.th)), v.r); return 1 + v.f0 * (1 - e) / e; }, color: 'good' }],
    sub: (v, n) => { const e = dirAlbedo(Math.cos(rad(v.th)), v.r); return `a perfect white metal at roughness ${n(v.r)} returns only <b>${n(e * 100)} %</b>; ${n((1 - e) * 100)} % is lost because light that hits a second microfacet is ignored. Multiply by <b>${n(1 + v.f0 * (1 - e) / e)}</b> to get it back.`; },
    note: 'E computed numerically with height-correlated Smith masking. The compensation is the Kulla-Conty / Fdez-Agüera style factor most engines use.',
    plot: { x: 'r', y: [0, 1.6] }
  });

  /* ---------- anisotropy ---------- */
  function dAniso(h, t, b, n, at, ab) { const x = dot(h, t) / at, y = dot(h, b) / ab, z = dot(h, n); const d = x * x + y * y + z * z; return 1 / (PI * at * ab * d * d); }
  A.fx('aniso', {
    title: 'Brushed metal: two roughnesses',
    expr: 'α<sub>t</sub> = α · (1 + {an}),   α<sub>b</sub> = α · (1 − {an}),   α = {r}²',
    vars: { r: { sym: 'r', name: 'roughness', min: 0.05, max: 1, value: 0.45, step: 0.01 },
            an: { sym: 'aniso', name: 'anisotropy', min: -0.95, max: 0.95, value: 0.8, step: 0.01 } },
    out: [{ sym: 'α<sub>t</sub>', f: v => Math.max(v.r * v.r * (1 + v.an), 1e-3), color: 'accent' }, { sym: 'α<sub>b</sub>', f: v => Math.max(v.r * v.r * (1 - v.an), 1e-3), color: 'ray' }],
    draw(ctx, W, H, v, X) {
      const a = v.r * v.r, at = Math.max(a * (1 + v.an), 0.002), ab = Math.max(a * (1 - v.an), 0.002), L = norm([-0.35, 0.45, 0.82]), V = [0, 0, 1], h = norm([L[0], L[1], L[2] + 1]), f = [0.91, 0.92, 0.92];
      S.backdrop(ctx, W, H, STUDIO);
      S.sphere(ctx, W / 2, H / 2, Math.min(W, H) / 2 - 18, nn => {
        const t = norm([-nn[2], 0, nn[0]]), b = [nn[1] * t[2] - nn[2] * t[1], nn[2] * t[0] - nn[0] * t[2], nn[0] * t[1] - nn[1] * t[0]];
        const nl = Math.max(dot(nn, L), 0), nv = Math.max(nn[2], 1e-3), D = dAniso(h, t, b, nn, at, ab), G = S.smithG(nl, nv, Math.sqrt(at * ab));
        const spec = D * G / (4 * nl * nv + 1e-4) * nl * 2.2, R = [2 * nn[2] * nn[0], 2 * nn[2] * nn[1], 2 * nn[2] * nn[2] - 1], e = S.env(R, Math.min(1, Math.sqrt(Math.max(at, ab))), STUDIO);
        return f.map((c, i) => c * (spec + e[i] * 0.55));
      }, 2, 1);
      X.label(ctx, v.an > 0 ? 'stretched along the tangent (brushed around the sphere)' : v.an < 0 ? 'stretched along the bitangent' : 'isotropic', 10, H - 10, '#fff');
    },
    plot: { x: 'an', y: [0, 1.2] }, size: [440, 300]
  });

  /* ---------- clear coat over metal ---------- */
  A.fx('coat', {
    title: 'Lacquer over metal',
    expr: 'F<sub>coat</sub>({th}) = Fresnel(1.5),   metal seen through the coat ≈ F<sub>metal</sub> · (1 − {c} · F<sub>coat</sub>)²',
    vars: { c: { sym: 'coat', name: 'coat weight', min: 0, max: 1, value: 1, step: 0.01 },
            th: { sym: 'θ', name: 'view angle from the normal', unit: '°', min: 0, max: 89, value: 60, step: 1 },
            r: { sym: 'r', name: 'roughness of the metal under the coat', min: 0.05, max: 1, value: 0.55, step: 0.01 } },
    out: [{ sym: 'coat', f: v => v.c * S.dielectric(Math.cos(rad(v.th)), 1.5), color: 'ray' }, { sym: 'through the coat', f: v => Math.pow(1 - v.c * S.dielectric(Math.cos(rad(v.th)), 1.5), 2), color: 'accent' }],
    draw(ctx, W, H, v, X) {
      const f = [0.96, 0.64, 0.54]; S.backdrop(ctx, W, H, STUDIO);
      S.sphere(ctx, W / 2, H / 2, Math.min(W, H) / 2 - 18, nn => S.shade(nn, { base: f, metal: 1, rough: v.r, coat: v.c, coatRough: 0.03, envOpt: STUDIO }), 2, 1);
      X.label(ctx, 'copper, rough, under a smooth clear coat', 10, H - 10, '#fff');
    },
    sub: (v, n) => { const F = v.c * S.dielectric(Math.cos(rad(v.th)), 1.5); return `at ${n(v.th)}° the coat reflects <b>${n(F * 100)} %</b>; the metal below keeps <b>${n(Math.pow(1 - F, 2) * 100)} %</b> of its reflection`; },
    plot: { x: 'th', y: [0, 1.02] }, size: [440, 300]
  });

  /* ---------- metalness as area fraction ---------- */
  function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function noise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    return S.lerp(S.lerp(hash(xi, yi), hash(xi + 1, yi), u), S.lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), w); }
  const fbm = (x, y) => noise(x, y) * 0.55 + noise(x * 2.1, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3) * 0.15;
  A.fx('mix', {
    title: 'Rust on iron: metalness as the share of bare metal',
    expr: 'F0 = lerp(0.04, F0<sub>iron</sub>, {m}),   diffuse = (1 − {m}) · albedo<sub>rust</sub>',
    vars: { m: { sym: 'm', name: 'share of bare metal (metalness)', min: 0, max: 1, value: 0.5, step: 0.01 } },
    out: [{ sym: 'F0 (red)', f: v => S.lerp(0.04, 0.9, v.m), color: 'ray' }, { sym: 'diffuse (red)', f: v => (1 - v.m) * 0.25, color: 'accent' }],
    sub: (v, n) => `left: each pixel is either iron or rust, ${n(v.m * 100)} % iron. Right: the same share as one metalness of ${n(v.m)}. From a distance they match.`,
    draw(ctx, W, H, v, X) {
      const iron = [0.9, 0.88, 0.82], rust = [0.25, 0.08, 0.035], R = Math.min(W / 4, H / 2) - 16;
      S.backdrop(ctx, W, H, STUDIO);
      S.sphere(ctx, W / 4, H / 2 - 6, R, (nn, x, y) => { const isMetal = fbm(x / 9 + 3, y / 9 + 7) < S.lerp(0.18, 0.86, v.m) ? 1 : 0; return S.shade(nn, isMetal ? { base: iron, metal: 1, rough: 0.3, envOpt: STUDIO } : { base: rust, metal: 0, rough: 0.8, envOpt: STUDIO }); }, 2, 1);
      S.sphere(ctx, 3 * W / 4, H / 2 - 6, R, nn => S.shade(nn, { base: iron.map((c, i) => S.lerp(rust[i], c, v.m)), metal: v.m, rough: S.lerp(0.8, 0.3, v.m), envOpt: STUDIO }), 2, 1);
      X.label(ctx, 'texel by texel', W / 4, H - 8, '#fff', 'center'); X.label(ctx, 'averaged metalness', 3 * W / 4, H - 8, '#fff', 'center');
    },
    plot: { x: 'm', y: [0, 1] }, size: [880, 300]
  });
})();
