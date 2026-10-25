/* Water — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, S = window.Surf, { col, alpha, num } = A;
  const { PI, sat, clamp, css } = S;
  const rad = d => d * PI / 180, deg = r => r * 180 / PI, G = 9.81;

  /* ---------- reflection versus what is below ---------- */
  const SKY = [0.55, 0.68, 0.9], DEEP = [0.01, 0.06, 0.09];
  A.fx('wfresnel', {
    title: 'Water Fresnel by view angle',
    expr: 'F({th}) for n = 1.33,   colour = F · sky + (1 − F) · below',
    vars: { th: { sym: 'θ', name: 'angle between the view and the vertical', unit: '°', min: 0, max: 89.5, value: 60, step: 0.5 } },
    out: [{ sym: 'F', f: v => S.dielectric(Math.cos(rad(v.th)), 1.333), color: 'accent', fmt: x => num(x * 100) + ' %' }, { sym: 'from below', f: v => 1 - S.dielectric(Math.cos(rad(v.th)), 1.333), color: 'ray', fmt: x => num(x * 100) + ' %' }],
    sub: (v, n) => { const F = S.dielectric(Math.cos(rad(v.th)), 1.333); return `looking ${n(v.th)}° from straight down: <b>${n(F * 100)} %</b> reflected sky, <b>${n((1 - F) * 100)} %</b> light from the water body`; },
    draw(ctx, W, H, v, X) {
      for (let y = 0; y < H; y += 2) { const t = y / H, th = 89.5 - t * 89.5, F = S.dielectric(Math.cos(rad(th)), 1.333), c = SKY.map((s, i) => F * s + (1 - F) * S.lerp(0.25, DEEP[i] * 6, 1 - t) * [0.4, 1, 1.1][i] * 0.4); ctx.fillStyle = css(c); ctx.fillRect(0, y, W, 2); }
      const yy = (89.5 - v.th) / 89.5 * H; ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
      X.label(ctx, 'horizon (grazing)', 8, 12, '#fff'); X.label(ctx, 'at your feet (straight down)', 8, H - 10, '#fff');
    },
    plot: { x: 'th', y: [0, 1.02] }, size: [440, 260]
  });

  /* ---------- Gerstner waves ---------- */
  const wv = v => { const k = 2 * PI / v.L, w = Math.sqrt(G * k); return { k, w, c: w / k, T: 2 * PI / w }; };
  A.fx('gerstner', {
    title: 'Gerstner wave',
    expr: 'x = x₀ − {Q} · {A} · sin(k x₀ − ω{t}),   y = {A} · cos(k x₀ − ω{t}),   k = 2π / {L},   ω = √(g k)',
    vars: { A: { sym: 'A', name: 'amplitude', unit: 'm', min: 0.05, max: 2, value: 0.6, step: 0.01 },
            L: { sym: 'λ', name: 'wavelength', unit: 'm', min: 2, max: 60, value: 20, step: 0.5 },
            Q: { sym: 'Q', name: 'steepness (0 = sine, crest sharpens towards 1/(kA))', min: 0, max: 1, value: 0.6, step: 0.01 },
            t: { sym: 't', name: 'time', unit: 's', min: 0, max: 12, value: 0, step: 0.02 } },
    out: { sym: 'height at x = 0', f: v => v.A * Math.cos(-wv(v).w * v.t), unit: 'm' },
    sub: (v, n) => { const w = wv(v), qmax = 1 / (w.k * v.A); return `speed <b>${n(w.c)} m/s</b>, period <b>${n(w.T)} s</b> (deep water: longer waves travel faster)` + (v.Q > qmax ? `; <b>Q above 1/(kA) = ${n(qmax)}: the crest loops over itself</b>` : ''); },
    draw(ctx, W, H, v, X) {
      const w = wv(v), sx = W / 50, cy = H / 2 + 10, sy = Math.min(40, (H / 2 - 20) / Math.max(v.A, 0.3));
      ctx.fillStyle = 'rgba(40,110,150,0.25)'; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x0 = -2; x0 <= 62; x0 += 0.1) { const ph = w.k * x0 - w.w * v.t, x = x0 - v.Q * v.A * Math.sin(ph), y = v.A * Math.cos(ph); ctx.lineTo(x * sx, cy - y * sy); }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.beginPath(); let first = true;
      for (let x0 = -2; x0 <= 62; x0 += 0.1) { const ph = w.k * x0 - w.w * v.t, x = x0 - v.Q * v.A * Math.sin(ph), y = v.A * Math.cos(ph); first ? ctx.moveTo(x * sx, cy - y * sy) : ctx.lineTo(x * sx, cy - y * sy); first = false; }
      ctx.stroke();
      for (let i = 0; i < 6; i++) { const x0 = 5 + i * 10, ph = w.k * x0 - w.w * v.t; ctx.strokeStyle = alpha(col('muted'), 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x0 * sx, cy, v.Q * v.A * sx, v.A * sy, 0, 0, 7); ctx.stroke(); X.dot(ctx, (x0 - v.Q * v.A * Math.sin(ph)) * sx, cy - v.A * Math.cos(ph) * sy, col('accent'), 4); }
      X.label(ctx, 'dots: water particles, each on its own orbit', 8, H - 10, col('muted'));
    },
    plot: { x: 't' }, size: [440, 260]
  });

  /* ---------- water depth from the depth buffer ---------- */
  A.fx('wdepth', {
    title: 'Water path length',
    expr: 'path = ({zs} − {zw}) / cos α,   vertical depth = path · cos {phi}',
    vars: { zw: { sym: 'z<sub>water</sub>', name: 'linear depth of the water surface pixel', unit: 'm', min: 1, max: 40, value: 12, step: 0.1 },
            zs: { sym: 'z<sub>scene</sub>', name: 'linear depth of the ground behind it (from the depth buffer)', unit: 'm', min: 1, max: 60, value: 15, step: 0.1 },
            phi: { sym: 'φ', name: 'angle of the view ray from the vertical', unit: '°', min: 0, max: 85, value: 65, step: 1 } },
    out: [{ sym: 'path', f: v => Math.max(v.zs - v.zw, 0), unit: 'm', color: 'accent' }, { sym: 'vertical depth', f: v => Math.max(v.zs - v.zw, 0) * Math.cos(rad(v.phi)), unit: 'm', color: 'ray' }],
    sub: (v, n) => { const p = Math.max(v.zs - v.zw, 0); return `the ray travels <b>${n(p)} m</b> through water (for a pixel near the screen centre, α ≈ 0), but the water is only <b>${n(p * Math.cos(rad(v.phi)))} m</b> deep there. Absorption needs the path; foam and shore fades need the vertical depth.`; },
    draw(ctx, W, H, v, X) {
      const p = Math.max(v.zs - v.zw, 0), d = p * Math.cos(rad(v.phi)), sy = (H - 70) / Math.max(d, 1) * 0.8, sx = sy, ph = rad(v.phi);
      const x0 = 50, y0 = 40; ctx.fillStyle = 'rgba(40,110,150,0.3)'; ctx.fillRect(0, y0, W, d * sy); ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y0); ctx.stroke();
      ctx.fillStyle = '#b89a62'; ctx.fillRect(0, y0 + d * sy, W, H - y0 - d * sy);
      const ex = x0 + Math.sin(ph) * p * sx, ey = y0 + Math.cos(ph) * p * sy;
      X.arrow(ctx, x0 - Math.sin(ph) * 40, y0 - Math.cos(ph) * 40, x0, y0, col('accent'), 2, 8);
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(Math.min(ex, W - 10), ey); ctx.stroke();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = col('ink'); ctx.beginPath(); ctx.moveTo(Math.min(ex, W - 10), y0); ctx.lineTo(Math.min(ex, W - 10), ey); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, `path ${num(p)} m`, (x0 + Math.min(ex, W - 10)) / 2, (y0 + ey) / 2 - 12, col('accent'), 'center'); X.label(ctx, `depth ${num(d)} m`, Math.min(ex, W - 10) - 6, (y0 + ey) / 2, col('ink'), 'right');
    },
    plot: { x: 'phi' }, size: [440, 260]
  });

  /* ---------- absorption and scattering ---------- */
  const WATERS = [
    ['pure water', [0.35, 0.06, 0.012], [0, 0, 0]],
    ['clear ocean', [0.45, 0.09, 0.03], [0.004, 0.03, 0.06]],
    ['tropical lagoon', [0.5, 0.12, 0.09], [0.02, 0.12, 0.12]],
    ['green lake', [0.7, 0.3, 0.6], [0.02, 0.06, 0.03]],
    ['silty river', [0.9, 1.1, 1.6], [0.12, 0.09, 0.05]]];
  const SAND = [0.62, 0.52, 0.36];
  A.fx('wabs', {
    title: 'Water absorption and scattering',
    expr: 'T = e<sup>−a · {L}</sup>,   colour = bottom · T + scatter · (1 − T),   water = {w}',
    vars: { L: { sym: 'L', name: 'path length through water', unit: 'm', min: 0, max: 40, value: 5, step: 0.1 },
            w: { sym: 'water', name: 'water type', values: [0, 1, 2, 3, 4], labels: WATERS.map(x => x[0]), index: 1 } },
    out: [0, 1, 2].map(i => ({ sym: 'T ' + 'RGB'[i], f: v => Math.exp(-WATERS[v.w][1][i] * v.L), color: ['bad', 'good', 'ray'][i] })),
    sub: (v, n) => { const T = WATERS[v.w][1].map(a => Math.exp(-a * v.L)); return `${WATERS[v.w][0]}, ${n(v.L)} m of water: red keeps <b>${n(T[0] * 100)} %</b>, green <b>${n(T[1] * 100)} %</b>, blue <b>${n(T[2] * 100)} %</b>`; },
    steps: (v, n) => { const a = WATERS[v.w][1]; return [['a (per metre)', `(${a.map(x => n(x)).join(', ')})`], ['red gone at 1 %', n(Math.log(100) / a[0]) + ' m'], ['blue gone at 1 %', n(Math.log(100) / a[2]) + ' m']]; },
    draw(ctx, W, H, v, X) {
      const wt = WATERS[v.w], col3 = L => SAND.map((s, i) => { const T = Math.exp(-wt[1][i] * L); return s * T + wt[2][i] * (1 - T) * 3; });
      for (let x = 0; x < W - 20; x += 2) { const L = x / (W - 20) * 40; ctx.fillStyle = css(col3(L)); ctx.fillRect(10 + x, 34, 2, 70); }
      X.label(ctx, '0 m', 10, 116, col('muted')); X.label(ctx, '40 m', W - 10, 116, col('muted'), 'right'); X.label(ctx, 'sand seen through more and more water', 10, 24, col('muted'));
      const xm = 10 + v.L / 40 * (W - 20); ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xm, 30); ctx.lineTo(xm, 108); ctx.stroke();
      ctx.fillStyle = css(col3(v.L)); ctx.fillRect(10, 140, 90, 70); ctx.strokeStyle = col('line'); ctx.strokeRect(10, 140, 90, 70); X.label(ctx, `at ${num(v.L)} m`, 110, 175, col('ink'));
    },
    plot: { x: 'L', y: [0, 1.02] }, size: [440, 230]
  });

  /* ---------- shore foam and soft edge ---------- */
  A.fx('shore', {
    title: 'Depth-based foam and edges',
    expr: 'foam = 1 − saturate({d} / {w}),   edge alpha = saturate({d} / {f})',
    vars: { d: { sym: 'd', name: 'vertical water depth at the pixel', unit: 'm', min: 0, max: 2, value: 0.15, step: 0.01 },
            w: { sym: 'w', name: 'foam width (depth where foam ends)', unit: 'm', min: 0.05, max: 1.5, value: 0.4, step: 0.01 },
            f: { sym: 'f', name: 'edge fade depth', unit: 'm', min: 0.01, max: 0.5, value: 0.08, step: 0.01 } },
    out: [{ sym: 'foam', f: v => 1 - sat(v.d / v.w), color: 'ink' }, { sym: 'alpha', f: v => sat(v.d / v.f), color: 'ray' }],
    sub: (v, n) => `at ${n(v.d)} m: foam <b>${n(1 - sat(v.d / v.w))}</b> (before noise breaks it up), surface opacity <b>${n(sat(v.d / v.f))}</b>`,
    draw(ctx, W, H, v, X) {
      const y0 = 60, slope = (H - y0 - 20) / (W * 0.9), surf = x => y0, bed = x => y0 + (x - W * 0.25) * slope;
      ctx.fillStyle = '#b89a62'; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, y0 - 30); ctx.lineTo(W * 0.25 - 30 / slope * 0.3, y0 - 9); ctx.lineTo(W, bed(W)); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      const sc = (H - y0 - 20) / 2;
      for (let x = W * 0.25; x < W; x += 2) { const depth = (bed(x) - y0) / sc; if (depth <= 0) continue; const a = sat(depth / v.f), fo = 1 - sat(depth / v.w), n = 0.5 + 0.5 * Math.sin(x * 0.7) * Math.cos(x * 0.23); const fm = fo > n * 0.9 ? fo : 0;
        ctx.fillStyle = `rgba(40,110,150,${0.55 * a})`; ctx.fillRect(x, y0, 2, bed(x) - y0); ctx.fillStyle = `rgba(255,255,255,${fm * a})`; ctx.fillRect(x, y0 - 3, 2, 6); }
      const xd = W * 0.25 + v.d * sc / slope; ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(xd, y0 - 20); ctx.lineTo(xd, bed(xd)); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, `depth ${num(v.d)} m`, xd + 6, y0 - 16, col('accent'));
    },
    plot: { x: 'd', y: [0, 1.02] }, size: [440, 230]
  });

  /* ---------- refraction scaled by depth ---------- */
  A.fx('refroff', {
    title: 'Refraction offset by depth',
    expr: 'offset = N<sub>xz</sub> · {k} · saturate({d} / {d0})',
    vars: { k: { sym: 'k', name: 'distortion strength', min: 0, max: 0.05, value: 0.02, step: 0.001 },
            d: { sym: 'd', name: 'vertical water depth', unit: 'm', min: 0, max: 3, value: 0.3, step: 0.01 },
            d0: { sym: 'd₀', name: 'depth of full distortion', unit: 'm', min: 0.1, max: 3, value: 1, step: 0.05 } },
    out: { sym: 'offset scale', f: v => v.k * sat(v.d / v.d0) },
    sub: (v, n) => `at ${n(v.d)} m the offset is ${n(sat(v.d / v.d0) * 100)} % of full strength: the bottom right at the shoreline stays still, as it does in reality, and foreground objects at the water line leak less`,
    plot: { x: 'd', y: [0, 0.052] }
  });

  /* ---------- caustics: refraction of sunlight through a wavy surface ---------- */
  function causticHist(v, bins = 60) {
    const k = 2 * PI / v.L, h = new Array(bins).fill(0), N = 500, span = v.L * 2;
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) / N * span, slope = v.A * k * Math.cos(k * x), nrm = S.norm([-slope, 1, 0]), d = S.refract([0, -1, 0], nrm, 1 / 1.333);
      if (!d) continue; const t = (v.A * Math.sin(k * x) + v.d) / -d[1], xf = x + d[0] * t; let b = Math.floor(((xf % span) + span) % span / span * bins); h[b]++;
    }
    const mean = N / bins; return h.map(c => c / mean);
  }
  A.fx('caustic', {
    title: 'Caustics',
    expr: 'each ray: refract(sun, N(x), 1/1.33) to the floor at depth {d},   brightness = rays per area',
    vars: { d: { sym: 'd', name: 'depth of the floor', unit: 'm', min: 0.1, max: 8, value: 1.6, step: 0.05 },
            A: { sym: 'A', name: 'wave amplitude', unit: 'm', min: 0.005, max: 0.15, value: 0.04, step: 0.005 },
            L: { sym: 'λ', name: 'wavelength', unit: 'm', min: 0.3, max: 3, value: 1.2, step: 0.05 } },
    out: { sym: 'peak brightness', f: v => Math.max(...causticHist(v, 40)), fmt: x => num(x) + '×' },
    sub: (v, n) => { const f = 1.333 / 0.333 / (v.A * Math.pow(2 * PI / v.L, 2)); return `crests focus at about <b>${n(f)} m</b> (focal length of a crest acting as a lens); the floor is at ${n(v.d)} m, so the pattern is ${Math.abs(v.d - f) < f * 0.3 ? '<b>sharp</b>' : v.d < f ? 'soft (not yet focused)' : 'crossed and spreading'}`; },
    draw(ctx, W, H, v, X) {
      const k = 2 * PI / v.L, span = v.L * 2, sx = W / span, top = 30, sy = Math.min((H - top - 40) / v.d, 120), floorY = top + v.d * sy;
      ctx.fillStyle = 'rgba(40,110,150,0.18)'; ctx.fillRect(0, top, W, floorY - top);
      ctx.strokeStyle = alpha('#ffe9a8', 0.28); ctx.lineWidth = 1;
      for (let i = 0; i < 90; i++) { const x = (i + 0.5) / 90 * span, slope = v.A * k * Math.cos(k * x), nrm = S.norm([-slope, 1, 0]), d = S.refract([0, -1, 0], nrm, 1 / 1.333); if (!d) continue; const y0 = v.A * Math.sin(k * x), t = (y0 + v.d) / -d[1]; ctx.beginPath(); ctx.moveTo(x * sx, top - y0 * sy * 3); ctx.lineTo((x + d[0] * t) * sx, floorY); ctx.stroke(); }
      ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x <= span; x += span / 200) { const y = top - v.A * Math.sin(k * x) * sy * 3; x ? ctx.lineTo(x * sx, y) : ctx.moveTo(x * sx, y); } ctx.stroke();
      const hst = causticHist(v); hst.forEach((b, i) => { const c = Math.min(b / 3, 1); ctx.fillStyle = css([0.5 + c * 1.2, 0.45 + c * 1.1, 0.3 + c * 0.8]); ctx.fillRect(i * W / hst.length, floorY, W / hst.length + 1, 18); });
      X.label(ctx, 'surface (height exaggerated 3×)', 6, 14, col('muted')); X.label(ctx, 'floor: brightness from ray density', 6, Math.min(H - 6, floorY + 32), col('muted'));
    },
    plot: { x: 'd' }, size: [440, 300]
  });

  /* ---------- Snell's window ---------- */
  A.fx('snellwin', {
    title: 'Snell\'s window',
    expr: 'θ<sub>c</sub> = asin(1 / {n}),   window radius = {h} · tan θ<sub>c</sub>',
    vars: { n: { sym: 'n', name: 'index of refraction', min: 1.0, max: 1.6, value: 1.333, step: 0.001 },
            h: { sym: 'h', name: 'depth of the eye below the surface', unit: 'm', min: 0.2, max: 10, value: 2, step: 0.05 } },
    out: [{ sym: 'θ<sub>c</sub>', f: v => deg(Math.asin(1 / v.n)), unit: '°', color: 'accent' }, { sym: 'radius', f: v => v.h * Math.tan(Math.asin(1 / v.n)), unit: 'm', color: 'ray' }],
    sub: (v, n) => `the whole sky above the surface appears inside a cone of <b>${n(2 * deg(Math.asin(1 / v.n)))}°</b>; outside it the surface is a mirror showing the water below`,
    draw(ctx, W, H, v, X) {
      const tc = Math.asin(1 / v.n), s = Math.min((H - 60) / v.h, 40), ex = W / 2, ey = 30 + v.h * s, sy = 30, r = v.h * Math.tan(tc) * s;
      ctx.fillStyle = 'rgba(20,70,100,0.55)'; ctx.fillRect(0, sy, W, H - sy); ctx.fillStyle = 'rgba(170,210,240,0.5)'; ctx.fillRect(0, 0, W, sy);
      ctx.fillStyle = 'rgba(200,230,255,0.5)'; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - r, sy); ctx.lineTo(ex + r, sy); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
      ctx.strokeStyle = col('accent'); ctx.beginPath(); ctx.moveTo(ex - r, sy); ctx.lineTo(ex, ey); ctx.lineTo(ex + r, sy); ctx.stroke();
      const mx = ex + r + 60; if (mx < W) { X.arrow(ctx, ex, ey, mx, sy, col('muted'), 1.5, 7); X.arrow(ctx, mx, sy, mx + (mx - ex) * 0.5, sy + (ey - sy) * 0.5, col('muted'), 1.5, 7); X.label(ctx, 'mirror', mx + 6, sy + 16, col('muted')); }
      X.dot(ctx, ex, ey, col('ink'), 6); X.label(ctx, 'eye', ex + 10, ey, col('ink'));
      X.label(ctx, 'window to the sky', ex, sy - 10, col('ink'), 'center');
    },
    plot: { x: 'n', y: [0, 92] }, size: [440, 260]
  });
})();
