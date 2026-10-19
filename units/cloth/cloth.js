/* Cloth Shading — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180, PI = Math.PI;
  const enc = x => Math.round(clamp(x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055, 0, 1) * 255);
  const css = c => `rgb(${c.map(enc).join(',')})`;
  const charlie = (noh, r) => { const a = Math.max(r * r, 0.01), inv = 1 / a, s2 = Math.max(1 - noh * noh, 0); return (2 + inv) * Math.pow(s2, inv * 0.5) / (2 * PI); };
  const ggx = (noh, r) => { const a = Math.max(r * r, 0.01), a2 = a * a, d = noh * noh * (a2 - 1) + 1; return a2 / (PI * d * d); };
  const vis = (nl, nv) => 1 / (4 * (nl + nv - nl * nv) + 1e-4);
  const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  /* shade a sphere, light from lAng (deg, around y, 0 = from the viewer), view along +z */
  function sphere(ctx, cx, cy, r, f) {
    for (let y = -r; y <= r; y += 2) for (let x = -r; x <= r; x += 2) { const q = x * x + y * y; if (q > r * r) continue; const n = [x / r, -y / r, Math.sqrt(1 - q / (r * r))]; ctx.fillStyle = css(f(n)); ctx.fillRect(cx + x, cy + y, 2, 2); }
  }

  A.fx('charlie', {
    title: 'Charlie sheen against GGX',
    expr: 'D<sub>Charlie</sub> = (2 + 1/α) · sin({th})<sup>1/α</sup> / 2π,   α = {r}²',
    vars: { th: { sym: 'θ<sub>H</sub>', name: 'angle between N and H', unit: '°', min: 0, max: 90, value: 70, step: 0.5 }, r: { sym: 'roughness', name: 'sheen roughness', min: 0.2, max: 1, value: 0.6, step: 0.01 },
            la: { sym: 'θ<sub>L</sub>', name: 'light angle from the view direction (sphere picture)', unit: '°', min: 0, max: 90, value: 20, step: 1 } },
    out: [{ sym: 'Charlie', f: v => charlie(Math.cos(v.th * DEG), v.r), color: 'accent' }, { sym: 'GGX', f: v => ggx(Math.cos(v.th * DEG), v.r), color: 'ray' }],
    draw(ctx, W, H, v, X) {
      const L = norm([Math.sin(v.la * DEG), 0.2, Math.cos(v.la * DEG)]), V = [0, 0, 1], Hh = norm([L[0] + V[0], L[1] + V[1], L[2] + V[2]]), base = [0.22, 0.01, 0.04], sheen = [1.0, 0.55, 0.6];
      const shade = (n, useCharlie) => { const nl = Math.max(dot(n, L), 0), nv = Math.max(n[2], 1e-3), nh = Math.max(dot(n, Hh), 0); const d = base.map(c => c / PI * nl * 2.2);
        const s = useCharlie ? charlie(nh, v.r) * vis(nl, nv) * nl * 6 : ggx(nh, v.r) * 0.25 / (nl * nv + 1e-3) * nl * 6 * 0.04; return d.map((c, i) => c + s * (useCharlie ? sheen[i] : 1)); };
      sphere(ctx, W / 4 + 5, H / 2, 90, n => shade(n, true)); sphere(ctx, W * 3 / 4 - 5, H / 2, 90, n => shade(n, false));
      X.label(ctx, 'velvet (Charlie)', W / 4 + 5, H - 12, col('muted'), 'center'); X.label(ctx, 'same colour with GGX', W * 3 / 4 - 5, H - 12, col('muted'), 'center');
    },
    plot: { x: 'th', logY: true, y: [0.001, 10] }
  });

  A.fx('clothvis', {
    title: 'Cloth visibility against the GGX denominator',
    expr: 'V<sub>cloth</sub> = 1 / (4 · (N·L + N·V − N·L · N·V)),   N·L = cos {tl},   N·V = cos {tv}',
    vars: { tl: { sym: 'θ<sub>L</sub>', name: 'light angle from the normal', unit: '°', min: 0, max: 89, value: 40, step: 1 }, tv: { sym: 'θ<sub>V</sub>', name: 'view angle from the normal', unit: '°', min: 0, max: 89.5, value: 70, step: 0.5 } },
    out: [{ sym: 'V<sub>cloth</sub>', f: v => vis(Math.cos(v.tl * DEG), Math.cos(v.tv * DEG)), color: 'accent' }, { sym: '1 / (4 N·L N·V)', f: v => 1 / (4 * Math.cos(v.tl * DEG) * Math.cos(v.tv * DEG)), color: 'bad' }],
    plot: { x: 'tv', logY: true, y: [0.1, 100] },
    note: 'Toward 90° the plain denominator explodes; the cloth term stays below 0.25 / N·L.'
  });

  const fdw = (c, w) => clamp((c + w) / ((1 + w) * (1 + w)), 0, 1);
  const SUB = [0.75, 0.2, 0.35];
  A.fx('clothdiff', {
    title: 'Wrapped diffuse tinted by a subsurface colour',
    expr: 'diffuse = albedo / π · wrap · saturate({k} · subsurface + cos {th}),   wrap = saturate((cos {th} + {w}) / (1 + {w})²)',
    vars: { th: { sym: 'θ', name: 'angle between normal and light', unit: '°', min: 0, max: 180, value: 100, step: 1 }, w: { name: 'wrap', min: 0, max: 1, value: 0.5, step: 0.01 },
            k: { name: 'subsurface colour strength', min: 0, max: 1, value: 0.8, step: 0.01 } },
    out: [{ sym: 'red', f: v => fdw(Math.cos(v.th * DEG), v.w) * clamp(v.k * SUB[0] + Math.cos(v.th * DEG), 0, 1), color: 'bad' }, { sym: 'blue', f: v => fdw(Math.cos(v.th * DEG), v.w) * clamp(v.k * SUB[2] + Math.cos(v.th * DEG), 0, 1), color: 'ray' }, { sym: 'Lambert', f: v => Math.max(0, Math.cos(v.th * DEG)), color: 'muted' }],
    sub: v => `the factor saturate(subsurface + cos θ) is 1 where the light hits directly, and falls to the subsurface colour (here red-purple) as the light wraps around`,
    draw(ctx, W, H, v, X) {
      const L = [0.97, 0.2, 0.15], base = [0.3, 0.38, 0.62];
      sphere(ctx, W / 2, H / 2, 105, n => { const nl = dot(n, L), w = fdw(nl, v.w); return base.map((c, i) => c * w * clamp(v.k * SUB[i] + nl, 0, 1) * 1.6); });
      X.label(ctx, 'light from the right; the wrapped part turns red-purple', 10, H - 10, col('muted'));
    },
    plot: { x: 'th', y: [0, 1] }
  });

  const aniso = (x, y, n, ax, ay) => { const d = x * x / (ax * ax) + y * y / (ay * ay) + n * n; return 1 / (PI * ax * ay * d * d); };
  A.fx('aniso', {
    title: 'Anisotropic GGX: the highlight shape',
    expr: 'D = 1 / (π · α<sub>T</sub> α<sub>B</sub> · ((T·H / α<sub>T</sub>)² + (B·H / α<sub>B</sub>)² + (N·H)²)²),   α<sub>T</sub> = {at},   α<sub>B</sub> = {ab}',
    vars: { at: { sym: 'α<sub>T</sub>', name: 'roughness along the threads', min: 0.02, max: 0.8, value: 0.08, step: 0.01 }, ab: { sym: 'α<sub>B</sub>', name: 'roughness across the threads', min: 0.02, max: 0.8, value: 0.45, step: 0.01 },
            rot: { name: 'thread direction', unit: '°', min: 0, max: 180, value: 0, step: 1 } },
    out: { sym: 'D at H = N', f: v => aniso(0, 0, 1, v.at, v.ab) },
    draw(ctx, W, H, v, X) {
      const c = [W / 2, H / 2], R = 110, cr = Math.cos(v.rot * DEG), sr = Math.sin(v.rot * DEG), mx = aniso(0, 0, 1, v.at, v.ab);
      for (let y = -R; y <= R; y += 2) for (let x = -R; x <= R; x += 2) { const hx = x / R * 0.9, hy = -y / R * 0.9, q = hx * hx + hy * hy; if (q > 0.81) continue; const n = Math.sqrt(1 - q), t = hx * cr + hy * sr, b = -hx * sr + hy * cr; const d = Math.pow(aniso(t, b, n, v.at, v.ab) / mx, 0.5); ctx.fillStyle = css([0.06 + d * 0.95, 0.05 + d * 0.85, 0.08 + d * 0.9]); ctx.fillRect(c[0] + x, c[1] + y, 2, 2); }
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; for (let k = -3; k <= 3; k++) { const ox = -sr * k * 26, oy = cr * k * 26; ctx.beginPath(); ctx.moveTo(c[0] + ox - cr * 130, c[1] - oy + sr * 130); ctx.lineTo(c[0] + ox + cr * 130, c[1] - oy - sr * 130); ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1; }
      X.label(ctx, 'highlight on a flat patch; orange lines: thread direction', 10, H - 10, col('muted'));
    },
    plot: { x: 'ab', logY: true, y: [0.1, 1000] }
  });

  A.fx('fuzz', {
    title: 'A fuzz rim',
    expr: 'fuzz = fuzzColor · (1 − N·V)<sup>{p}</sup> · {k}',
    vars: { p: { name: 'rim falloff', min: 1, max: 8, value: 3, step: 0.1 }, k: { name: 'strength', min: 0, max: 1, value: 0.5, step: 0.01 }, nv: { sym: 'N·V', name: 'N·V at a sample point', min: 0, max: 1, value: 0.3, step: 0.01 } },
    out: { sym: 'fuzz', f: v => Math.pow(1 - v.nv, v.p) * v.k },
    draw(ctx, W, H, v, X) {
      const L = norm([0.6, 0.5, 0.6]), base = [0.12, 0.28, 0.18], fz = [0.6, 0.8, 0.65];
      sphere(ctx, W / 2, H / 2, 105, n => { const nl = Math.max(dot(n, L), 0), f = Math.pow(1 - n[2], v.p) * v.k; return base.map((c, i) => c * nl * 0.9 + 0.03 + fz[i] * f); });
    },
    plot: { x: 'nv', y: [0, 1] }
  });

  A.fx('weavefade', {
    title: 'When the weave gets smaller than a pixel',
    expr: 'threads per pixel = {tpc} · 100 / ({Hs} / (2 · {d} · tan 30°))',
    vars: { tpc: { name: 'threads per centimetre', min: 2, max: 60, value: 20, log: true }, d: { name: 'distance to the camera', unit: 'm', min: 0.2, max: 30, value: 3, log: true }, Hs: { sym: 'H', name: 'screen height', values: [1080, 1440, 2160], index: 0 } },
    out: { sym: 'threads / px', f: v => v.tpc * 100 / (v.Hs / (2 * v.d * Math.tan(30 * DEG))) },
    sub: v => { const t = v.tpc * 100 / (v.Hs / (2 * v.d * Math.tan(30 * DEG))); return `<b>${num(t)}</b> threads per pixel → ${t > 0.5 ? 'fade the weave map out (it would only shimmer)' : 'weave visible'}`; },
    plot: { x: 'd', logY: true, y: [0.01, 100] }
  });
})();
