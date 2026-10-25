/* Glass — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, S = window.Surf, { col, alpha, num } = A;
  const { PI, sat, clamp, css } = S;
  const rad = d => d * PI / 180, deg = r => r * 180 / PI;

  /* ---------- dielectric Fresnel ---------- */
  A.fx('dielectric', {
    title: 'Glass surface and pane reflectance',
    expr: 'F0 = (({n} − 1) / ({n} + 1))²,   F({th}) exact,   pane with two surfaces: 2F / (1 + F)',
    vars: { n: { sym: 'n', name: 'index of refraction', min: 1.0, max: 2.5, value: 1.5, step: 0.01 },
            th: { sym: 'θ', name: 'angle from the normal', unit: '°', min: 0, max: 89.5, value: 60, step: 0.5 } },
    out: [{ sym: 'one surface', f: v => S.dielectric(Math.cos(rad(v.th)), v.n), color: 'accent' },
          { sym: 'pane (2 surfaces)', f: v => { const F = S.dielectric(Math.cos(rad(v.th)), v.n); return 2 * F / (1 + F); }, color: 'ray' },
          { sym: 'Schlick', f: v => S.schlick(S.f0FromIor(v.n), Math.cos(rad(v.th))), color: 'muted', dash: [4, 4] }],
    sub: (v, n) => { const F = S.dielectric(Math.cos(rad(v.th)), v.n), P = 2 * F / (1 + F); return `at ${n(v.th)}°: one surface reflects <b>${n(F * 100)} %</b>, a pane <b>${n(P * 100)} %</b>; <b>${n((1 - P) * 100)} %</b> goes through`; },
    plot: { x: 'th', y: [0, 1.02] }
  });

  /* ---------- Snell and the slab ---------- */
  A.fx('snell', {
    title: 'Lateral shift through a pane',
    expr: '1 · sin {th} = {n} · sin θ<sub>t</sub>,   shift = {t} · sin({th} − θ<sub>t</sub>) / cos θ<sub>t</sub>',
    vars: { th: { sym: 'θ', name: 'angle of the incoming ray', unit: '°', min: 0, max: 85, value: 45, step: 1 },
            n: { sym: 'n', name: 'index of refraction of the glass', min: 1, max: 2.5, value: 1.5, step: 0.01 },
            t: { sym: 't', name: 'thickness', unit: 'mm', min: 1, max: 40, value: 20, step: 1 } },
    sub: (v, n) => { const tt = Math.asin(Math.sin(rad(v.th)) / v.n); return `inside the glass the ray runs at <b>${n(deg(tt))}°</b>; it leaves parallel to how it came, shifted by <b>${n(v.t * Math.sin(rad(v.th) - tt) / Math.cos(tt))} mm</b>`; },
    out: [{ sym: 'θ<sub>t</sub>', f: v => deg(Math.asin(Math.sin(rad(v.th)) / v.n)), unit: '°', color: 'accent' }, { sym: 'shift', f: v => { const tt = Math.asin(Math.sin(rad(v.th)) / v.n); return v.t * Math.sin(rad(v.th) - tt) / Math.cos(tt); }, unit: 'mm', color: 'ray' }],
    draw(ctx, W, H, v, X) {
      const s = Math.min(4, (H - 60) / v.t * 0.7), cx = W / 2, y0 = H / 2 - v.t * s / 2, y1 = y0 + v.t * s, th = rad(v.th), tt = Math.asin(Math.sin(th) / v.n);
      ctx.fillStyle = alpha(col('ray'), 0.18); ctx.fillRect(0, y0, W, y1 - y0); ctx.strokeStyle = alpha(col('ray'), 0.6); ctx.strokeRect(-1, y0, W + 2, y1 - y0);
      const L = 110, inx = cx - Math.sin(th) * L, iny = y0 - Math.cos(th) * L, ex = cx + Math.tan(tt) * (y1 - y0);
      X.arrow(ctx, inx, iny, cx, y0, col('accent'), 2.5, 9);
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, y0); ctx.lineTo(ex, y1); ctx.stroke();
      X.arrow(ctx, ex, y1, ex + Math.sin(th) * L, y1 + Math.cos(th) * L, col('accent'), 2.5, 9);
      ctx.setLineDash([5, 5]); ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, y0); ctx.lineTo(cx + Math.sin(th) * (L + (y1 - y0) / Math.cos(th)), y0 + Math.cos(th) * (L + (y1 - y0) / Math.cos(th))); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = col('muted'); ctx.beginPath(); ctx.moveTo(cx, y0 - 40); ctx.lineTo(cx, y0 + 40); ctx.stroke();
      X.label(ctx, 'dashed: where it would go without glass', 10, H - 10, col('muted'));
    },
    plot: { x: 'th' }, size: [440, 300]
  });

  /* ---------- a ball or a bulb ---------- */
  function trace2d(y0, n, hollow, R, wall) {
    const rin = R * (1 - wall), idx = r => r > R ? 1 : (hollow && r < rin) ? 1 : n;
    let p = [-R * 2.2, y0], d = [1, 0], pts = [p.slice()], cur = 1;
    for (let it = 0; it < 8; it++) {
      let best = Infinity;
      [R, hollow ? rin : null].forEach(rc => { if (!rc) return; const b = p[0] * d[0] + p[1] * d[1], c = p[0] * p[0] + p[1] * p[1] - rc * rc, D = b * b - c; if (D < 0) return; const s = Math.sqrt(D); [-b - s, -b + s].forEach(t => { if (t > 1e-6 && t < best) best = t; }); });
      if (!isFinite(best)) { pts.push([p[0] + d[0] * R * 4, p[1] + d[1] * R * 4]); break; }
      p = [p[0] + d[0] * best, p[1] + d[1] * best]; pts.push(p.slice());
      const r = Math.hypot(p[0], p[1]), nOut = [p[0] / r, p[1] / r], going = (d[0] * nOut[0] + d[1] * nOut[1]) > 0;
      const nxt = idx(going ? r * 1.0001 + 1e-6 : r * 0.9999 - 1e-6), N = going ? [-nOut[0], -nOut[1]] : nOut;
      const eta = cur / nxt, ci = -(d[0] * N[0] + d[1] * N[1]), k = 1 - eta * eta * (1 - ci * ci);
      if (k < 0) { d = [d[0] + 2 * ci * N[0], d[1] + 2 * ci * N[1]]; }
      else { const tt = eta * ci - Math.sqrt(k); d = [eta * d[0] + tt * N[0], eta * d[1] + tt * N[1]]; const l = Math.hypot(d[0], d[1]); d = [d[0] / l, d[1] / l]; cur = nxt; }
      p = [p[0] + d[0] * 1e-5, p[1] + d[1] * 1e-5];
    }
    return { pts, d };
  }
  A.fx('ball', {
    title: 'Solid ball versus hollow bulb',
    expr: 'Snell at every surface: n₁ sin θ₁ = n₂ sin θ₂,   n = {n},   ray height {h}',
    vars: { n: { sym: 'n', name: 'index of refraction', min: 1, max: 2, value: 1.5, step: 0.01 },
            h: { sym: 'h', name: 'height of the highlighted ray (radius = 1)', min: -0.98, max: 0.98, value: 0.5, step: 0.01 },
            sh: { sym: 'shape', name: 'shape', values: [0, 1], labels: ['solid ball', 'hollow bulb (5 % wall)'], index: 0 } },
    out: { sym: 'exit direction', f: v => { const r = trace2d(v.h, v.n, v.sh === 1, 1, 0.05); return deg(Math.atan2(r.d[1], r.d[0])); }, unit: '°' },
    sub: (v, n) => { const r = trace2d(v.h, v.n, v.sh === 1, 1, 0.05), a = deg(Math.atan2(r.d[1], r.d[0])); return v.sh ? `the bulb turns the ray by only ${n(a)}°: thin walls barely bend light, like a window` : `the ball turns the ray by ${n(a)}°; rays from the top leave towards the bottom, so the image behind it is <b>upside down</b>`; },
    draw(ctx, W, H, v, X) {
      const s = Math.min(W / 5, H / 2.6), ox = W / 2 - s * 0.4, oy = H / 2, P = p => [ox + p[0] * s, oy - p[1] * s];
      ctx.fillStyle = alpha(col('ray'), 0.15); ctx.beginPath(); ctx.arc(ox, oy, s, 0, 7); ctx.fill(); ctx.strokeStyle = alpha(col('ray'), 0.7); ctx.lineWidth = 2; ctx.stroke();
      if (v.sh) { ctx.fillStyle = col('bg'); ctx.beginPath(); ctx.arc(ox, oy, s * 0.95, 0, 7); ctx.fill(); ctx.strokeStyle = alpha(col('ray'), 0.7); ctx.stroke(); }
      for (let i = -9; i <= 9; i++) { const y = i / 10; const r = trace2d(y, v.n, v.sh === 1, 1, 0.05); ctx.strokeStyle = alpha(col('muted'), 0.45); ctx.lineWidth = 1; ctx.beginPath(); r.pts.forEach((p, j) => { const q = P(p); j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke(); }
      const r = trace2d(v.h, v.n, v.sh === 1, 1, 0.05); ctx.strokeStyle = col('accent'); ctx.lineWidth = 2.5; ctx.beginPath(); r.pts.forEach((p, j) => { const q = P(p); j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke();
    },
    plot: { x: 'h', y: [-90, 90] }, size: [520, 300]
  });

  /* ---------- Beer–Lambert ---------- */
  const GL = [[[0.86, 0.95, 0.9], 'window glass, seen through 1 cm'], [[0.35, 0.55, 0.92], 'blue bottle glass'], [[0.9, 0.55, 0.12], 'amber bottle glass']];
  A.fx('beer', {
    title: 'Glass colour by path length',
    expr: 'μ = −ln(T<sub>ref</sub>) / 1 cm,   T = e<sup>−μ · {d}</sup>,   T<sub>ref</sub> = {g}',
    vars: { d: { sym: 'd', name: 'path length through the glass', unit: 'cm', min: 0, max: 30, value: 1, step: 0.1 },
            g: { sym: 'glass', name: 'glass', values: [0, 1, 2], labels: GL.map(x => x[1].split(',')[0]), index: 0 } },
    out: [0, 1, 2].map(i => ({ sym: 'T ' + 'RGB'[i], f: v => Math.pow(GL[v.g][0][i], v.d), color: ['bad', 'good', 'ray'][i] })),
    sub: (v, n) => { const T = GL[v.g][0].map(c => Math.pow(c, v.d)); return `through ${n(v.d)} cm: T = (${T.map(x => n(x)).join(', ')})`; },
    draw(ctx, W, H, v, X) {
      const T0 = GL[v.g][0], bg = [0.9, 0.9, 0.9];
      for (let i = 0; i < W - 40; i += 2) { const d = (i / (W - 40)) * 30, T = T0.map(c => Math.pow(c, d)); ctx.fillStyle = css(bg.map((b, k) => b * T[k])); ctx.fillRect(20 + i, 40, 2, 50); }
      X.label(ctx, '0 cm', 20, 104, col('muted')); X.label(ctx, '30 cm', W - 20, 104, col('muted'), 'right');
      const xd = 20 + v.d / 30 * (W - 40); ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xd, 34); ctx.lineTo(xd, 96); ctx.stroke();
      const T = T0.map(c => Math.pow(c, v.d)), Te = T0.map(c => Math.pow(c, Math.max(v.d * 12, 0.1)));
      const py = 140, pw = 150, ph = 110;
      ctx.fillStyle = css(bg.map((b, k) => b * T[k])); ctx.fillRect(40, py, pw, ph); ctx.fillStyle = css(bg.map((b, k) => b * Te[k])); ctx.fillRect(40 + pw, py, 12, ph);
      X.label(ctx, 'a pane: face and edge', 40, py - 10, col('muted')); X.label(ctx, 'the edge is ~12× longer, so it shows the colour', 40, py + ph + 16, col('muted'));
    },
    plot: { x: 'd', y: [0, 1.02] }, size: [440, 290]
  });

  /* ---------- screen-space refraction offset ---------- */
  const FPX = 540 / Math.tan(rad(30));
  function shift(v) { const ti = rad(v.tilt), tt = Math.asin(Math.sin(ti) / v.n), dist = v.t / 100 / Math.cos(tt), lat = dist * Math.sin(ti - tt); return { lat, px: FPX * lat / v.z, tt }; }
  A.fx('ssrefr', {
    title: 'Screen-space refraction offset',
    expr: 'exit = P + refract(V, N, 1/{n}) · {t} / cos θ<sub>t</sub>,   offset = project(exit) − project(P),   glass {z} away',
    vars: { tilt: { sym: 'θ', name: 'tilt of the surface normal against the view', unit: '°', min: 0, max: 60, value: 20, step: 1 },
            n: { sym: 'n', name: 'index of refraction', min: 1, max: 2, value: 1.5, step: 0.01 },
            t: { sym: 'thickness', name: 'thickness (HDRP: Refraction Thickness)', unit: 'cm', min: 0.5, max: 50, value: 5, step: 0.5 },
            z: { sym: 'z', name: 'distance of the glass from the camera', unit: 'm', min: 0.5, max: 20, value: 3, step: 0.1 } },
    out: { sym: 'offset', f: v => shift(v).px, unit: 'px', fmt: x => num(x) },
    sub: (v, n) => `on a 1080p screen with a 60° field of view the background is read <b>${n(shift(v).px)} px</b> away. The background distance does not enter: only the assumed thickness does.`,
    draw(ctx, W, H, v, X) {
      const gx = W * 0.42, cy = H / 2 - 8, ti = rad(v.tilt), sh = shift(v), tp = 16 + v.t * 2, td = Math.max(ti - 2.5 * (ti - sh.tt), -ti);
      ctx.save(); ctx.translate(gx, cy); ctx.rotate(ti);
      ctx.fillStyle = alpha(col('ray'), 0.2); ctx.strokeStyle = alpha(col('ray'), 0.7); ctx.lineWidth = 1.5; ctx.fillRect(0, -110, tp, 220); ctx.strokeRect(0, -110, tp, 220);
      const d = [Math.cos(ti), -Math.sin(ti)], L = gx - 30, cam = [-d[0] * L, -d[1] * L], E = [tp, -tp * Math.tan(td)];
      X.arrow(ctx, cam[0], cam[1], 0, 0, col('accent'), 2.5, 8);
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(E[0], E[1]); ctx.stroke();
      X.arrow(ctx, E[0], E[1], E[0] + d[0] * 220, E[1] + d[1] * 220, col('accent'), 2.5, 8);
      ctx.setLineDash([5, 5]); ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(d[0] * 260, d[1] * 260); ctx.stroke(); ctx.setLineDash([]);
      X.dot(ctx, cam[0], cam[1], col('ink'), 6); X.dot(ctx, E[0], E[1], col('accent'), 4);
      ctx.restore();
      X.label(ctx, 'camera', 30, cy + 22, col('ink'));
      X.label(ctx, 'solid: refracted path; dashed: straight on', 10, H - 26, col('muted')); X.label(ctx, 'thickness and bending exaggerated', 10, H - 10, col('muted'));
    },
    plot: { x: 'tilt' }, size: [520, 260]
  });

  /* ---------- frosted glass ---------- */
  A.fx('frost', {
    title: 'Frosted glass blur level',
    expr: 'mip = {r}<sup>1.3</sup> · ({lods} − 1),   blur ≈ 2<sup>mip</sup> px',
    vars: { r: { sym: 'r', name: 'perceptual roughness', min: 0, max: 1, value: 0.35, step: 0.01 },
            lods: { sym: 'mips', name: 'mip levels of the colour pyramid (1080p: 11)', values: [9, 10, 11, 12], labels: ['9', '10', '11', '12'], index: 2 } },
    out: [{ sym: 'mip', f: v => Math.pow(v.r, 1.3) * (v.lods - 1), color: 'accent' }],
    sub: (v, n) => { const m = Math.pow(v.r, 1.3) * (v.lods - 1); return `mip <b>${n(m)}</b>: each texel there covers about <b>${n(Math.pow(2, m))} px</b> of the screen`; },
    draw(ctx, W, H, v, X) {
      const m = Math.pow(v.r, 1.3) * (v.lods - 1), b = Math.min(Math.pow(2, m) * 0.35, 40);
      const scene = c => { for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? '#2a5d8f' : '#e8c35a'; c.fillRect(i * W / 10, 0, W / 10, H); } c.fillStyle = '#fff'; c.font = '700 42px sans-serif'; c.fillText('EXIT', W * 0.55, H * 0.45); c.fillStyle = '#c0392b'; c.beginPath(); c.arc(W * 0.3, H * 0.6, 34, 0, 7); c.fill(); };
      ctx.save(); scene(ctx); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(W * 0.2, H * 0.12, W * 0.6, H * 0.76); ctx.clip(); ctx.filter = `blur(${b}px)`; scene(ctx); ctx.filter = 'none'; ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, 0, W, H); ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(W * 0.2, H * 0.12, W * 0.6, H * 0.76);
    },
    plot: { x: 'r', y: [0, 11.5] }, size: [440, 260]
  });

  /* ---------- premultiplied glass ---------- */
  A.fx('premul', {
    title: 'Premultiplied reflection on alpha glass',
    expr: 'alpha blend: (F · env) · {a} + bg · (1 − {a}),   premultiplied: F · env + bg · (1 − {a}),   F = {F}',
    vars: { a: { sym: 'α', name: 'opacity of the glass', min: 0, max: 1, value: 0.1, step: 0.01 },
            F: { sym: 'F', name: 'Fresnel reflectance at this pixel', min: 0, max: 1, value: 0.3, step: 0.01 },
            env: { sym: 'env', name: 'brightness of the reflected light', min: 0, max: 4, value: 2, step: 0.05, const: false } },
    out: [{ sym: 'alpha blend', f: v => v.F * v.env * v.a + 0.1 * (1 - v.a), color: 'bad' }, { sym: 'premultiplied', f: v => v.F * v.env + 0.1 * (1 - v.a), color: 'good' }],
    sub: (v, n) => `on a dark background (0.1): plain alpha blending shows <b>${n(v.F * v.env * v.a + 0.1 * (1 - v.a))}</b>, premultiplied <b>${n(v.F * v.env + 0.1 * (1 - v.a))}</b>. Clear glass with a bright reflection only works premultiplied.`,
    plot: { x: 'a', y: [0, 1.6] }
  });
})();
