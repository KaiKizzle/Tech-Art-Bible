/* Diffuse, Albedo, Base Colour — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, S = window.Surf, { col, alpha, num } = A;
  const { PI, sat, clamp, s2l, css, tm, norm, dot } = S;

  /* ---------- Phong: two independent knobs ---------- */
  A.fx('phong', {
    title: 'The Phong model: diffuse and specular are separate knobs',
    expr: 'colour = {kd} · (N·L) + {ks} · (R·V)<sup>{n}</sup>',
    vars: { kd: { sym: 'k<sub>d</sub>', name: 'diffuse colour (one channel)', min: 0, max: 1, value: 0.8, step: 0.01 },
            ks: { sym: 'k<sub>s</sub>', name: 'specular colour', min: 0, max: 1, value: 0.6, step: 0.01 },
            n: { sym: 'n', name: 'shininess exponent', min: 1, max: 300, value: 40, log: true } },
    out: [{ sym: 'brightest point', f: v => v.kd + v.ks, color: 'accent' }, { sym: 'diffuse share', f: v => v.kd, color: 'ray' }],
    sub: v => `at the highlight: ${num(v.kd)} + ${num(v.ks)} = <b>${num(v.kd + v.ks)}</b>` + (v.kd + v.ks > 1 ? ', <b>more light leaves than arrives</b>. Nothing in the model forbids it.' : ', within what arrives (by luck, not by rule).'),
    draw(ctx, W, H, v, X) {
      const L = norm([-0.5, 0.55, 0.67]);
      S.sphere(ctx, W / 2, H / 2 - 6, Math.min(W, H) / 2 - 24, nn => { const nl = Math.max(dot(nn, L), 0), r = [2 * nl * nn[0] - L[0], 2 * nl * nn[1] - L[1], 2 * nl * nn[2] - L[2]], rv = Math.max(r[2], 0); const d = v.kd * nl + 0.05, sp = v.ks * Math.pow(rv, v.n); return [d * 1.0 + sp, d * 0.55 + sp, d * 0.42 + sp].map(x => x * 1.05); }, 2, 1);
      X.label(ctx, 'diffuse tinted orange, specular white-ish, no rule linking them', 10, H - 10, col('muted'));
    },
    plot: { x: 'n', y: [0, 2.05] }
  });

  /* ---------- light painted into a diffuse map ---------- */
  A.fx('baked', {
    title: 'A diffuse map with light painted in, under a new light',
    expr: 'old map = albedo · baked(top-left),   on screen = map · light({th}),   should be = albedo · light({th})',
    vars: { th: { sym: 'θ', name: 'direction of the new light', unit: '°', min: -180, max: 180, value: 120, step: 1 },
            b: { sym: 'bake', name: 'how much shading the artist painted in', min: 0, max: 1, value: 0.8, step: 0.01 } },
    out: { sym: 'error on the lit side', f: v => { const t = v.th * PI / 180, Ln = norm([Math.sin(t), Math.cos(t) * 0.7, 0.7]), n = Ln, baked = Math.max(dot(n, norm([-0.6, 0.6, 0.53])), 0); const m = 1 - v.b + v.b * (0.25 + 0.75 * baked); return 1 - m; }, fmt: x => num(x * 100) + ' % too dark' },
    sub: v => `the side facing the new light is dimmed by the old painted shading; with bake 0 the map is a pure albedo and both pictures match`,
    draw(ctx, W, H, v, X) {
      const t = v.th * PI / 180, L = norm([Math.sin(t), Math.cos(t) * 0.7, 0.7]), B = norm([-0.6, 0.6, 0.53]), R = Math.min(W / 4, H / 2) - 22, alb = [0.55, 0.32, 0.18];
      const mapF = n => { const baked = Math.max(dot(n, B), 0), ao = 0.25 + 0.75 * baked, spec = Math.pow(Math.max(n[0] * -0.4 + n[1] * 0.45 + n[2] * 0.8, 0), 30) * 0.6; return alb.map(a => a * (1 - v.b + v.b * ao) + v.b * spec); };
      const lit = n => Math.max(dot(n, L), 0) * 2.4 + 0.12;
      S.sphere(ctx, W / 4, H / 2 - 6, R, n => mapF(n).map(c => c * lit(n)), 2, 1);
      S.sphere(ctx, 3 * W / 4, H / 2 - 6, R, n => alb.map(c => c * lit(n)), 2, 1);
      X.label(ctx, 'old diffuse map', W / 4, H - 10, col('muted'), 'center'); X.label(ctx, 'base colour (no light)', 3 * W / 4, H - 10, col('muted'), 'center');
      const ax = W / 2, ay = 26; X.arrow(ctx, ax + Math.sin(t) * 18, ay - Math.cos(t) * 12, ax - Math.sin(t) * 2, ay + Math.cos(t) * 2, col('accent'), 2, 7); X.label(ctx, 'new light', ax, ay + 18, col('accent'), 'center');
    },
    plot: false, size: [880, 300]
  });

  /* ---------- albedo: the physics word ---------- */
  const REF = [[0.04, 'charcoal'], [0.12, 'the Moon'], [0.3, 'Earth'], [0.85, 'fresh snow']];
  A.fx('albedo', {
    title: 'Albedo: the fraction of light a surface sends back',
    expr: 'f = {rho} / π,   L<sub>out</sub> = f · {E} = {rho} · {E} / π',
    vars: { rho: { sym: 'ρ', name: 'albedo (diffuse reflectance)', min: 0, max: 1, value: 0.3, step: 0.01 },
            E: { sym: 'E', name: 'light arriving (irradiance)', unit: 'W/m²', min: 0, max: 1000, value: 600, step: 10 } },
    out: [{ sym: 'L<sub>out</sub>', f: v => v.rho * v.E / PI, color: 'accent', fmt: x => num(x) + ' W/m²/sr' }, { sym: 'reflected in total', f: v => v.rho * v.E, color: 'ray', fmt: x => num(x) + ' W/m²' }],
    draw(ctx, W, H, v, X) {
      const x0 = 24, w = W - 48, y = 60, h = 26;
      ctx.fillStyle = alpha(col('ray'), 0.35); ctx.fillRect(x0, y, w, h); ctx.fillStyle = col('ray'); ctx.fillRect(x0, y, w * v.rho, h);
      X.label(ctx, `arrives ${num(v.E)} W/m²`, x0, y - 10, col('muted')); X.label(ctx, `sent back ${num(v.rho * v.E)} W/m² (${num(v.rho * 100)} %)`, x0 + 4, y + h / 2, col('bg'));
      REF.forEach(([r, n], i) => { const x = x0 + w * r; ctx.strokeStyle = col('muted'); ctx.beginPath(); ctx.moveTo(x, y + h + 4); ctx.lineTo(x, y + h + 18 + (i % 2) * 14); ctx.stroke(); X.label(ctx, n, x, y + h + 26 + (i % 2) * 14, col('muted'), 'center'); });
      ctx.fillStyle = css([v.rho, v.rho, v.rho]); ctx.fillRect(x0, H - 70, 70, 50); X.label(ctx, `as a base colour: ${S.l2s(v.rho)} sRGB`, x0 + 82, H - 45, col('ink'));
    },
    plot: { x: 'rho' }, size: [440, 240]
  });

  /* ---------- base colour: one number, two meanings ---------- */
  const COLS = [[200, 40, 30], [255, 219, 152], [128, 128, 128], [255, 211, 192]], CN = ['red paint', 'gold', 'mid grey', 'copper'];
  A.fx('base', {
    title: 'Base colour means albedo or F0, depending on metalness',
    expr: 'diffuse albedo = base · (1 − {m}),   F0 = lerp(F0<sub>dielectric</sub>({ior}), base, {m}),   base = {c}',
    vars: { c: { sym: 'base', name: 'base colour', values: [0, 1, 2, 3], labels: CN, index: 0 },
            m: { sym: 'metalness', name: 'metalness', min: 0, max: 1, value: 0, step: 0.01 },
            ior: { sym: 'IOR', name: 'index of refraction of the dielectric', min: 1.3, max: 2, value: 1.5, step: 0.01 } },
    out: [{ sym: 'diffuse (red)', f: v => s2l(COLS[v.c][0]) * (1 - v.m), color: 'accent' }, { sym: 'F0 (red)', f: v => S.lerp(S.f0FromIor(v.ior), s2l(COLS[v.c][0]), v.m), color: 'ray' }],
    steps: (v, n) => { const b = COLS[v.c].map(s2l), f0d = S.f0FromIor(v.ior); return [['diffuse albedo', `(${b.map(x => n(x * (1 - v.m))).join(', ')})`], ['F0', `(${b.map(x => n(S.lerp(f0d, x, v.m))).join(', ')})`]]; },
    draw(ctx, W, H, v, X) {
      const b = COLS[v.c].map(s2l), f0d = S.f0FromIor(v.ior), R = Math.min(W, H) / 2 - 30;
      S.sphere(ctx, W / 2 + 40, H / 2 - 4, R, n => S.shade(n, { base: b, metal: v.m, rough: 0.28, f0: f0d }), 2, 1);
      const sw = (y, c, t) => { ctx.fillStyle = css(c); ctx.fillRect(14, y, 56, 36); ctx.strokeStyle = col('line'); ctx.strokeRect(14, y, 56, 36); X.label(ctx, t, 14, y - 8, col('muted')); };
      sw(40, b.map(x => x * (1 - v.m)), 'diffuse'); sw(110, b.map(x => S.lerp(f0d, x, v.m)), 'F0 (reflection)'); sw(180, b, 'base colour');
    },
    sub: (v, n) => { const b = COLS[v.c].map(s2l), f0d = S.f0FromIor(v.ior); return v.m < 0.05 ? `metalness ${n(v.m)}: the base colour is the <b>diffuse albedo</b>; the reflection is a colourless F0 of ${n(f0d, 3)}` : v.m > 0.95 ? `metalness ${n(v.m)}: the base colour is the <b>colour of the reflection</b> (F0); no diffuse light at all` : `metalness ${n(v.m)}: part albedo, part F0, a blend that only exists where two materials share a texel`; },
    plot: { x: 'm', y: [0, 1.05] }
  });

  /* ---------- roughness, smoothness, gloss ---------- */
  A.fx('rough', {
    title: 'One property, four numbers',
    expr: 'α = {r}²,   smoothness = gloss = 1 − {r},   Blinn-Phong n = 2 / α² − 2',
    vars: { r: { sym: 'r', name: 'perceptual roughness (what you paint)', min: 0.02, max: 1, value: 0.4, step: 0.01 } },
    out: [{ sym: 'α', f: v => v.r * v.r, color: 'accent' }, { sym: 'smoothness', f: v => 1 - v.r, color: 'ray' }, { sym: 'Blinn-Phong n', f: v => 2 / Math.pow(v.r, 4) - 2, color: 'ax-y' }],
    sub: (v, n) => `Unity smoothness <b>${n(1 - v.r)}</b> · Unreal and OpenPBR roughness <b>${n(v.r)}</b> · the shader's α <b>${n(v.r * v.r)}</b> · old Blinn-Phong exponent <b>${n(2 / Math.pow(v.r, 4) - 2)}</b>`,
    draw(ctx, W, H, v, X) { S.sphere(ctx, W / 2, H / 2 - 4, Math.min(W, H) / 2 - 22, n => S.shade(n, { base: [0.5, 0.06, 0.04], rough: v.r }), 2, 1); },
    plot: { x: 'r', logY: true, y: [0.0004, 2e6] }
  });

  /* ---------- the many names of F0 ---------- */
  A.fx('f0', {
    title: 'IOR, F0, specular, reflectance: one dielectric property',
    expr: 'F0 = {w} · (({n} − 1) / ({n} + 1))²,   Unreal specular = F0 / 0.08,   Filament reflectance = √(F0 / 0.16)',
    vars: { n: { sym: 'IOR', name: 'index of refraction (OpenPBR specular_ior)', min: 1, max: 3, value: 1.5, step: 0.01 },
            w: { sym: 'weight', name: 'OpenPBR specular_weight', min: 0, max: 1, value: 1, step: 0.01 } },
    out: [{ sym: 'F0', f: v => v.w * S.f0FromIor(v.n), color: 'accent', fmt: x => num(x, 3) + ' (' + num(x * 100) + ' %)' },
          { sym: 'Unreal Specular', f: v => v.w * S.f0FromIor(v.n) / 0.08, color: 'ray' }, { sym: 'Filament reflectance', f: v => Math.sqrt(v.w * S.f0FromIor(v.n) / 0.16), color: 'ax-y' }],
    sub: (v, n) => { const f = v.w * S.f0FromIor(v.n), us = f / 0.08; return `F0 = <b>${n(f, 3)}</b>: Unreal Specular ${n(us)}${us > 1 ? ' (<b>above 1, out of Unreal\'s range</b>)' : ''}, Filament reflectance ${n(Math.sqrt(f / 0.16))}, linear grey ${S.l2s(f)} sRGB in a specular map`; },
    draw(ctx, W, H, v, X) {
      const x0 = 30, w = W - 60, y = 70, X1 = n => x0 + (n - 1) / 2 * w;
      ctx.strokeStyle = col('line'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke();
      [[1, 'air'], [1.33, 'water'], [1.5, 'glass, plastic'], [1.76, 'sapphire'], [2.42, 'diamond']].forEach(([n, t], i) => { const x = X1(n); ctx.strokeStyle = col('muted'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6); ctx.stroke(); X.label(ctx, t, x, y + 20 + (i % 2) * 14, col('muted'), 'center'); X.label(ctx, n.toFixed(2), x, y - 14, col('muted'), 'center'); });
      X.dot(ctx, X1(v.n), y, col('accent'), 6);
      const f = v.w * S.f0FromIor(v.n); ctx.fillStyle = css([f, f, f]); ctx.fillRect(x0, H - 70, 60, 46); ctx.strokeStyle = col('line'); ctx.strokeRect(x0, H - 70, 60, 46);
      X.label(ctx, 'F0 as a grey specular colour', x0 + 72, H - 47, col('ink'));
    },
    plot: { x: 'n', y: [0, 1.25] }
  });

  /* ---------- normal map green channel ---------- */
  A.fx('normal', {
    title: 'Same texture, two conventions for the green channel',
    expr: 'n.y = {s} · (2 · {g} / 255 − 1)',
    vars: { g: { sym: 'G', name: 'green value in the texture (0–255)', min: 0, max: 255, value: 200, step: 1 },
            s: { sym: 'sign', name: 'how the engine reads green', values: [1, -1], labels: ['as authored', 'flipped (other convention)'], index: 0 } },
    out: { sym: 'n.y', f: v => v.s * (2 * v.g / 255 - 1) },
    sub: (v, n) => `n.y = <b>${n(v.s * (2 * v.g / 255 - 1))}</b>: ${v.s > 0 ? 'the bump reads as raised' : '<b>the bump reads as a dent</b>, lit from the wrong side'}`,
    draw(ctx, W, H, v, X) {
      const cx = W / 2, cy = H / 2 - 6, R = Math.min(W, H) / 2 - 30, L = norm([0, 0.85, 0.5]);
      for (let y = -R; y <= R; y += 2) for (let x = -R; x <= R; x += 2) { const q = (x * x + y * y) / (R * R); let n = [0, 0, 1]; if (q < 1) { n = norm([x / R * 1.3, -y / R * 1.3 * v.s, Math.sqrt(1 - q) + 0.15]); }
        const c = 0.06 + Math.pow(Math.max(dot(n, L), 0), 1.5) * 0.9; ctx.fillStyle = css([c * 0.75, c * 0.72, c * 0.7]); ctx.fillRect(cx + x, cy + y, 2, 2); }
      X.label(ctx, 'light from the top', cx, 12, col('muted'), 'center');
    },
    plot: { x: 'g', y: [-1.05, 1.05] }, size: [440, 260]
  });

  /* ---------- OpenPBR coat over base ---------- */
  A.fx('coat', {
    title: 'A layer on top changes what the base gets',
    expr: 'coat reflects {c} · F<sub>coat</sub>({th}),   base sees (1 − {c} · F<sub>coat</sub>) · lerp(1, {cc}², {c})',
    vars: { c: { sym: 'coat', name: 'OpenPBR coat_weight', min: 0, max: 1, value: 1, step: 0.01 },
            th: { sym: 'θ', name: 'viewing angle from the normal', unit: '°', min: 0, max: 89, value: 30, step: 1 },
            cc: { sym: 'coat colour', name: 'OpenPBR coat_color (one channel)', min: 0, max: 1, value: 1, step: 0.01 } },
    out: [{ sym: 'coat reflection', f: v => v.c * S.dielectric(Math.cos(v.th * PI / 180), 1.6), color: 'ray', fmt: x => num(x * 100) + ' %' },
          { sym: 'reaches the base', f: v => (1 - v.c * S.dielectric(Math.cos(v.th * PI / 180), 1.6)) * S.lerp(1, v.cc * v.cc, v.c), color: 'accent', fmt: x => num(x * 100) + ' %' }],
    sub: (v, n) => { const F = v.c * S.dielectric(Math.cos(v.th * PI / 180), 1.6); return `the coat reflects <b>${n(F * 100)} %</b> at ${n(v.th)}°; the base receives <b>${n((1 - F) * S.lerp(1, v.cc * v.cc, v.c) * 100)} %</b> of the light`; },
    note: 'Coat IOR 1.6 (the OpenPBR default). The coat tint is roughly squared because light crosses the layer on the way in and on the way out.',
    plot: { x: 'th', y: [0, 1.05] }
  });
})();
