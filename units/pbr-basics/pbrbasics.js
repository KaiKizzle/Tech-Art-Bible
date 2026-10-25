/* PBR Materials: the Basics — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const PI = Math.PI;
  const s2l = v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const enc = x => Math.round(clamp(x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055, 0, 1) * 255);
  const css = c => `rgb(${c.map(enc).join(',')})`;
  const tm = c => c.map(x => x / (1 + x * 0.35));   /* gentle tonemap for the pictures */
  const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const L = norm([-0.55, 0.65, 0.55]);

  /* a small PBR sphere: GGX key light + a sky/ground environment approximated by roughness */
  function env(r, rough) { const t = clamp(r[1] * 0.5 + 0.5, 0, 1); const sky = [0.55, 0.62, 0.75], gnd = [0.12, 0.1, 0.09]; const k = Math.pow(t, 1 + 6 * (1 - rough)); const c = gnd.map((g, i) => g + (sky[i] - g) * (rough > 0.6 ? t : k));
    const win = Math.pow(clamp(dot(r, norm([0.6, 0.45, 0.65])), 0, 1), 4 + 400 * Math.pow(1 - rough, 3)) * (3 - 2.5 * rough); return c.map(x => x + win); }
  function shade(n, base, metal, rough) {
    const v = [0, 0, 1], h = norm([L[0] + v[0], L[1] + v[1], L[2] + v[2]]), nl = Math.max(dot(n, L), 0), nv = Math.max(dot(n, v), 1e-3), nh = Math.max(dot(n, h), 0), vh = Math.max(dot(v, h), 0);
    const a = Math.max(rough * rough, 0.003), a2 = a * a, d = nh * nh * (a2 - 1) + 1, D = a2 / (PI * d * d), k = (rough + 1) * (rough + 1) / 8, G = (nl / (nl * (1 - k) + k)) * (nv / (nv * (1 - k) + k));
    const f0 = base.map(b => 0.04 + (b - 0.04) * metal), F = f0.map(f => f + (1 - f) * Math.pow(1 - vh, 5)), Fe = f0.map(f => f + (Math.max(1 - rough, f) - f) * Math.pow(1 - nv, 5));
    const r = [2 * n[0] * n[2], 2 * n[1] * n[2], 2 * n[2] * n[2] - 1], e = env(r, rough);
    return base.map((b, i) => { const kd = (1 - F[i]) * (1 - metal); return (kd * b / PI + D * F[i] * G / (4 * nl * nv + 1e-3)) * 3.2 * nl + e[i] * Fe[i] * 0.55 + kd * b * 0.12; });
  }
  function sphere(ctx, cx, cy, R, f) { for (let y = -R; y <= R; y += 2) for (let x = -R; x <= R; x += 2) { const q = x * x + y * y; if (q > R * R) continue; const n = [x / R, -y / R, Math.sqrt(1 - q / (R * R))]; ctx.fillStyle = css(tm(f(n))); ctx.fillRect(cx + x, cy + y, 2, 2); } }

  /* ---------- energy ---------- */
  A.fx('energy', {
    title: 'Reflected versus absorbed light',
    expr: 'reflected ≈ {f0} + (1 − {f0}) · albedo,   albedo = linear({v})',
    vars: { v: { sym: 'base', name: 'base colour value (sRGB 0–255)', min: 0, max: 255, value: 200, step: 1 }, f0: { sym: 'F0', name: 'specular reflectance at normal incidence', min: 0.02, max: 0.08, value: 0.04, step: 0.005 } },
    out: [{ sym: 'specular', f: v => v.f0, color: 'ray', fmt: x => num(x * 100) + ' %' }, { sym: 'diffuse', f: v => (1 - v.f0) * s2l(v.v), color: 'accent', fmt: x => num(x * 100) + ' %' }, { sym: 'absorbed', f: v => 1 - v.f0 - (1 - v.f0) * s2l(v.v), color: 'muted', fmt: x => num(x * 100) + ' %' }],
    sub: v => `reflected in total: <b>${num((v.f0 + (1 - v.f0) * s2l(v.v)) * 100)} %</b> (specular ${num(v.f0 * 100)} % + diffuse ${num((1 - v.f0) * s2l(v.v) * 100)} %)`,
    draw(ctx, W, H, v, X) {
      const sp = v.f0, df = (1 - v.f0) * s2l(v.v), ab = 1 - sp - df, x0 = 20, w = W - 40, y = H / 2 - 30, h = 50;
      [[sp, 'ray', 'specular'], [df, 'accent', 'diffuse'], [ab, 'line', 'absorbed']].reduce((x, [f, c, n]) => { ctx.fillStyle = col(c); ctx.fillRect(x, y, w * f, h); if (w * f > 60) X.label(ctx, n, x + 6, y + h + 18, col('muted')); return x + w * f; }, x0);
      X.label(ctx, '100 % of the light that arrives', x0, y - 12, col('muted'));
      ctx.fillStyle = css([s2l(v.v), s2l(v.v), s2l(v.v)]); ctx.fillRect(x0, y + h + 34, 40, 30); X.label(ctx, 'base colour', x0 + 48, y + h + 54, col('muted'));
    },
    plot: { x: 'v', y: [0, 1] }
  });

  /* ---------- base colour range ---------- */
  const REF = [[56, 'charcoal'], [80, 'asphalt'], [170, 'dry sand'], [237, 'fresh snow']];
  A.fx('albedo', {
    title: 'Base colour range check',
    expr: 'linear = (({v} / 255 + 0.055) / 1.055)<sup>2.4</sup>',
    vars: { v: { sym: 'value', name: 'brightest channel of the base colour (sRGB 0–255)', min: 0, max: 255, value: 128, step: 1 } },
    out: { sym: 'reflectance', f: v => s2l(v.v), fmt: x => num(x * 100) + ' %' },
    sub: v => v.v < 30 ? '<b>too dark</b> for almost any real non-metal' : v.v < 50 ? 'very dark: fine for charcoal or soot, suspicious for anything else' : v.v > 240 ? '<b>too bright</b>: brighter than fresh snow' : 'inside the usual range for non-metals',
    draw(ctx, W, H, v, X) {
      const x0 = 20, w = W - 40, y = 50, h = 34;
      for (let i = 0; i < w; i++) { const s = i / w * 255; ctx.fillStyle = `rgb(${s},${s},${s})`; ctx.fillRect(x0 + i, y, 1, h); }
      ctx.fillStyle = alpha(col('bad'), 0.55); ctx.fillRect(x0, y + h, w * 30 / 255, 8); ctx.fillRect(x0 + w * 240 / 255, y + h, w * 15 / 255, 8);
      ctx.fillStyle = alpha(col('good'), 0.7); ctx.fillRect(x0 + w * 50 / 255, y + h, w * 190 / 255, 8);
      REF.forEach(([s, n], i) => { const x = x0 + w * s / 255; ctx.strokeStyle = col('muted'); ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y - 14 - (i % 2) * 14); ctx.stroke(); X.label(ctx, n, x, y - 18 - (i % 2) * 14, col('muted'), 'center'); });
      const xm = x0 + w * v.v / 255; ctx.strokeStyle = col('accent'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xm, y - 2); ctx.lineTo(xm, y + h + 12); ctx.stroke();
      ctx.fillStyle = `rgb(${v.v},${v.v},${v.v})`; ctx.fillRect(x0, y + h + 30, 80, 50); X.label(ctx, `${v.v} sRGB = ${num(s2l(v.v) * 100)} % reflectance`, x0 + 92, y + h + 60, col('ink'));
    },
    plot: { x: 'v', y: [0, 1] }
  });

  /* ---------- metallic ---------- */
  const GOLD = [1.0, 0.85, 0.57];
  A.fx('metal', {
    title: 'Metallic values between 0 and 1',
    expr: 'F0 = lerp(0.04, base, {m}),   diffuse = base · (1 − {m})',
    vars: { m: { sym: 'metallic', name: 'metallic', min: 0, max: 1, value: 1, step: 0.01 }, r: { sym: 'roughness', name: 'roughness', min: 0.05, max: 1, value: 0.3, step: 0.01 } },
    out: [{ sym: 'F0 (red)', f: v => 0.04 + (GOLD[0] - 0.04) * v.m, color: 'accent' }, { sym: 'diffuse (red)', f: v => GOLD[0] * (1 - v.m), color: 'ray' }],
    sub: v => v.m > 0.05 && v.m < 0.95 ? `metallic ${num(v.m)}: <b>no real material</b> looks like this (half diffuse, dull reflection)` : v.m >= 0.95 ? 'a metal: no diffuse, coloured reflection' : 'a non-metal: gold-coloured diffuse, faint white reflection',
    draw(ctx, W, H, v, X) { sphere(ctx, W / 2, H / 2 - 4, Math.min(W, H) / 2 - 22, n => shade(n, GOLD, v.m, v.r)); },
    plot: { x: 'm', y: [0, 1.05] }
  });

  /* ---------- roughness ---------- */
  const RED = [0.6, 0.06, 0.04];
  A.fx('rough', {
    title: 'Roughness and highlight spread',
    expr: 'α = {r}²,   peak of the highlight = 1 / (π α²),   smoothness = 1 − {r}',
    vars: { r: { sym: 'roughness', name: 'roughness', min: 0.03, max: 1, value: 0.35, step: 0.01 } },
    out: [{ sym: 'peak', f: v => 1 / (PI * Math.pow(v.r, 4)), color: 'accent' }, { sym: 'smoothness', f: v => 1 - v.r, color: 'ray' }],
    draw(ctx, W, H, v, X) { sphere(ctx, W / 2, H / 2 - 4, Math.min(W, H) / 2 - 22, n => shade(n, RED, 0, v.r)); X.label(ctx, `Unity smoothness ${num(1 - v.r)}`, 10, H - 8, col('muted')); },
    plot: { x: 'r', logY: true, y: [0.1, 1e6] }
  });

  /* ---------- AO ---------- */
  A.fx('ao', {
    title: 'AO input versus baked AO',
    expr: 'correct = sun + sky · {ao},   baked = (sun + sky) · {ao},   sun share {s}',
    vars: { ao: { sym: 'AO', name: 'occlusion at this point (1 = open)', min: 0, max: 1, value: 0.4, step: 0.01 }, s: { sym: 'sun', name: 'share of the light coming from the sun', min: 0, max: 1, value: 0.7, step: 0.01 } },
    out: [{ sym: 'correct', f: v => v.s + (1 - v.s) * v.ao, color: 'good' }, { sym: 'baked into albedo', f: v => v.ao, color: 'bad' }],
    sub: v => `a crevice facing the sun: baking AO into the base colour makes it <b>${num((v.s + (1 - v.s) * v.ao) / Math.max(v.ao, 1e-3))}×</b> too dark`,
    plot: { x: 'ao', y: [0, 1.05] }
  });

  /* ---------- workflow conversion ---------- */
  A.fx('convert', {
    title: 'Metal/roughness to specular/gloss',
    expr: 'specular = lerp(0.04, base, {m}),   diffuse = base · (1 − {m}),   gloss = 1 − {r},   base = linear({v})',
    vars: { v: { sym: 'base', name: 'base colour value (sRGB 0–255)', min: 0, max: 255, value: 180, step: 1 }, m: { sym: 'metallic', name: 'metallic', min: 0, max: 1, value: 0, step: 1 }, r: { sym: 'roughness', name: 'roughness', min: 0, max: 1, value: 0.4, step: 0.01 } },
    out: [{ sym: 'specular', f: v => 0.04 + (s2l(v.v) - 0.04) * v.m, color: 'ray' }, { sym: 'diffuse', f: v => s2l(v.v) * (1 - v.m), color: 'accent' }, { sym: 'gloss', f: v => 1 - v.r, color: 'good' }],
    draw(ctx, W, H, v, X) {
      const b = s2l(v.v), sp = 0.04 + (b - 0.04) * v.m, df = b * (1 - v.m), g = 1 - v.r, sw = (W - 60) / 3, y = 50;
      [[[b, b, b], 'base colour'], [[v.m, v.m, v.m], 'metallic'], [[v.r, v.r, v.r], 'roughness']].forEach(([c, n], i) => { ctx.fillStyle = css(i ? c.map(x => Math.pow(x, 2.2)) : c); ctx.fillRect(15 + i * (sw + 15), y, sw, 60); X.label(ctx, n, 15 + i * (sw + 15), y - 8, col('muted')); });
      X.label(ctx, '↓', W / 2, y + 86, col('muted'), 'center');
      [[[df, df, df], 'diffuse'], [[sp, sp, sp], 'specular'], [[g, g, g], 'gloss']].forEach(([c, n], i) => { ctx.fillStyle = css(i === 2 ? c.map(x => Math.pow(x, 2.2)) : c); ctx.fillRect(15 + i * (sw + 15), y + 116, sw, 60); X.label(ctx, n, 15 + i * (sw + 15), y + 108, col('muted')); });
    },
    plot: false, size: [880, 270]
  });
})();
