/* Rays, Spheres and Shaders — formulas and diagrams */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180, R = 6371000, LO = 1500, HI = 2500;
  /* helper used by the goal diagram (the fx widgets receive their own X) */
  const X0 = { dot: (ctx, x, y, c, r) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }, label: (ctx, s, x, y, c, al, b) => A.text(ctx, s, x, y, c, al, b) };
  const km = x => !isFinite(x) || Number.isNaN(x) ? '—' : Math.abs(x) < 10000 ? num(Math.round(x * 10) / 10, 4) + ' m' : num(x / 1000, 4) + ' km';

  /* ray from camera at altitude h, elevation el (deg), against a sphere of radius r around the planet centre */
  function hitSphere(h, el, r) {
    const b = (R + h) * Math.sin(el * DEG), c = (R + h) * (R + h) - r * r, d = b * b - c;
    if (d < 0) return { b, c, d, t0: NaN, t1: NaN };
    const s = Math.sqrt(d); return { b, c, d, t0: -b - s, t1: -b + s };
  }
  /* altitude after distance t, and ground distance (arc) below that point */
  const altAt = (h, el, t) => Math.sqrt(t * t + 2 * t * (R + h) * Math.sin(el * DEG) + (R + h) * (R + h)) - R;
  const groundAt = (h, el, t) => R * Math.atan2(t * Math.cos(el * DEG), (R + h) + t * Math.sin(el * DEG));

  /* interval through the layer for any camera altitude (the three cases) */
  function layer(h, el) {
    const lo = hitSphere(h, el, R + LO), hi = hitSphere(h, el, R + HI), gr = hitSphere(h, el, R);
    const ground = gr.d >= 0 && gr.t0 > 0 ? gr.t0 : Infinity;
    let a = NaN, b = NaN, kase;
    if (h < LO) { kase = 'below'; if (lo.t1 > 0 && lo.t1 < ground) { a = lo.t1; b = hi.t1; } }
    else if (h <= HI) { kase = 'inside'; a = 0; b = hi.t1; if (lo.d >= 0 && lo.t0 > 0) b = Math.min(b, lo.t0); }
    else { kase = 'above'; if (hi.d >= 0 && hi.t0 > 0) { a = hi.t0; b = lo.d >= 0 && lo.t0 > 0 ? lo.t0 : hi.t1; } }
    return { a, b, kase, lo, hi, ground };
  }

  /* Flattened side view: x = distance along the ground, y = altitude (exaggerated). A straight ray curves upward. */
  function flatView(ctx, W, H, X, h, el, tA, tB, opts = {}) {
    const tMax = opts.tMax || (isFinite(tB) ? tB * 1.15 : 200000);
    const gMax = Math.max(groundAt(h, el, tMax), opts.minX || 3000), aMax = opts.aMax || Math.max(3200, h * 1.25);
    const L = 54, Rr = W - 14, T = 18, B = H - 42;
    const px = g => L + g / gMax * (Rr - L), py = a => B - a / aMax * (B - T);
    ctx.fillStyle = alpha(col('ray'), 0.13); ctx.fillRect(L, py(HI), Rr - L, py(LO) - py(HI));
    ctx.strokeStyle = alpha(col('ray'), 0.6); ctx.lineWidth = 1; [LO, HI].forEach(a => { ctx.beginPath(); ctx.moveTo(L, py(a)); ctx.lineTo(Rr, py(a)); ctx.stroke(); });
    X.label(ctx, 'cloud layer 1500–2500 m', Rr - 6, py(HI) + 14, col('ray'), 'right');
    ctx.fillStyle = alpha(col('muted'), 0.18); ctx.fillRect(L, B, Rr - L, H - B); ctx.strokeStyle = col('muted'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L, B); ctx.lineTo(Rr, B); ctx.stroke();
    ctx.fillStyle = col('muted'); ctx.font = '11px "JetBrains Mono", monospace'; ctx.textAlign = 'right';
    for (let k = 0; k <= 4; k++) { const a = aMax * k / 4; ctx.fillText(A.short(Math.round(a)) + ' m', L - 6, py(a) + 4); }
    ctx.textAlign = 'center'; for (let k = 1; k <= 4; k++) { const g = gMax * k / 4; ctx.fillText(g >= 10000 ? num(g / 1000, 3) + ' km' : Math.round(g) + ' m', Math.min(L + (Rr - L) * k / 4, Rr - 24), B + 15); }
    // the ray, sampled
    const N = 160, path = []; let tEnd = tMax;
    if (isFinite(opts.ground) && opts.ground < tEnd) tEnd = opts.ground;
    for (let i = 0; i <= N; i++) { const t = tEnd * i / N; path.push([t, groundAt(h, el, t), altAt(h, el, t)]); }
    ctx.save(); ctx.beginPath(); ctx.rect(L, T - 6, Rr - L, B - T + 6); ctx.clip();
    ctx.strokeStyle = col('ink'); ctx.lineWidth = 1.6; ctx.beginPath(); path.forEach(([, g, a], i) => i ? ctx.lineTo(px(g), py(a)) : ctx.moveTo(px(g), py(a))); ctx.stroke();
    if (isFinite(tA) && isFinite(tB) && tB > tA) {
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 5; ctx.beginPath(); let st = false;
      for (let i = 0; i <= N; i++) { const t = tA + (tB - tA) * i / N, g = groundAt(h, el, t), a = altAt(h, el, t); st ? ctx.lineTo(px(g), py(a)) : (ctx.moveTo(px(g), py(a)), st = true); }
      ctx.stroke();
    }
    ctx.restore();
    X.dot(ctx, px(0), py(h), col('ink'), 5); X.label(ctx, 'camera', px(0) + 8, py(h) - 8, col('ink'), 'left', true);
    if (isFinite(tA) && isFinite(tB) && tB > tA) {
      [[tA, 'enter'], [tB, 'exit']].forEach(([t, n], i) => { const g = groundAt(h, el, t), a = altAt(h, el, t), x = clamp(px(g), L + 4, Rr - 4); X.dot(ctx, x, py(a), col('accent'), 5); X.label(ctx, `${n} ${km(t)}`, clamp(x + (i ? 8 : -8), L + 40, Rr - 40), py(a) + (i ? -10 : 18), col('accent'), i ? 'left' : 'right', true); });
    }
    if (isFinite(opts.ground)) { const g = groundAt(h, el, opts.ground); X.dot(ctx, px(g), B, col('bad'), 5); X.label(ctx, 'hits the ground', px(g), B - 10, col('bad'), 'center'); }
    X.label(ctx, 'not to scale · ground drawn flat, so the straight ray curves up', 10, H - 6, col('muted'));
  }

  /* ---------- goal: exaggerated planet with a fan of rays ---------- */
  (function goal() {
    const cv = document.getElementById('goal-cv'); if (!cv) return;
    let f = null; const up = () => f && f.draw();
    const pitch = A.range('goal-pitch', v => v + '°', up), fov = A.range('goal-fov', v => v + '°', up);
    // drawing units: planet radius 520, layer 470..?  exaggerated: shell at +46 and +80
    const Rp = 520, Lo = Rp + 46, Hi = Rp + 80, hc = 6;
    f = A.fig(cv, (ctx, W, H) => {
      const cx = 150, cy = 300 + Rp - 40;   // camera stands near (150, 254)
      const C = [cx, cy];
      const ring = (r, fill, stroke) => { ctx.beginPath(); ctx.arc(C[0], C[1], r, 0, 7); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); } };
      ring(Hi, alpha(col('ray'), 0.16), alpha(col('ray'), 0.7)); ring(Lo, col('bg'), alpha(col('ray'), 0.7));
      ring(Rp, alpha(col('muted'), 0.35), col('muted'));
      const O = [cx, cy - Rp - hc];
      X0.dot(ctx, O[0], O[1], col('ink'), 5);
      const n = 9, fv = fov.v, p = pitch.v;
      for (let i = 0; i < n; i++) {
        const el = p - fv / 2 + fv * i / (n - 1), d = [Math.cos(el * DEG), -Math.sin(el * DEG)];
        const L = [O[0] - C[0], O[1] - C[1]], b = L[0] * d[0] + L[1] * d[1], cc = r => L[0] * L[0] + L[1] * L[1] - r * r;
        const sol = r => { const h = b * b - cc(r); return h < 0 ? null : [-b - Math.sqrt(h), -b + Math.sqrt(h)]; };
        const g = sol(Rp), lo = sol(Lo), hi = sol(Hi);
        const ground = g && g[0] > 0 ? g[0] : Infinity;
        const tEnd = Math.min(ground, 700);
        ctx.strokeStyle = alpha(col('ink'), 0.55); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...O); ctx.lineTo(O[0] + d[0] * tEnd, O[1] + d[1] * tEnd); ctx.stroke();
        if (lo && hi && lo[1] < ground) {
          const a = lo[1], e = hi[1];
          ctx.strokeStyle = col('accent'); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(O[0] + d[0] * a, O[1] + d[1] * a); ctx.lineTo(O[0] + d[0] * Math.min(e, 700), O[1] + d[1] * Math.min(e, 700)); ctx.stroke();
        } else if (isFinite(ground)) { X0.dot(ctx, O[0] + d[0] * ground, O[1] + d[1] * ground, col('bad'), 3); }
      }
      X0.label(ctx, 'camera', O[0] - 8, O[1] + 4, col('ink'), 'right', true);
      X0.label(ctx, 'cloud layer', 470, 92, col('ray'), 'left', true);
      X0.label(ctx, 'planet (radius hugely reduced)', W - 12, H - 10, col('muted'), 'right');
      X0.label(ctx, 'thick: inside the layer · red dot: ray hits the ground first', 12, 18, col('muted'));
    });
  })();

  /* ---------- pixel → uv → ndc ---------- */
  A.fx('pixuv', {
    title: 'Pixel column to UV to NDC',
    expr: 'uv = ({px} + 0.5) / {w},   ndc = uv · 2 − 1',
    vars: { px: { sym: 'p', name: 'pixel column', min: 0, max: 1919, value: 1440, step: 1 },
            w: { sym: 'W', name: 'screen width in pixels', values: [8, 16, 1280, 1920, 3840], index: 3 } },
    out: [{ sym: 'uv', f: v => (Math.min(v.px, v.w - 1) + 0.5) / v.w, color: 'ax-x' }, { sym: 'ndc', f: v => (Math.min(v.px, v.w - 1) + 0.5) / v.w * 2 - 1, color: 'accent' }],
    sub: v => { const p = Math.min(v.px, v.w - 1), u = (p + 0.5) / v.w; return `uv = (${p} + 0.5) / ${v.w} = ${num(u, 4)},   ndc = ${num(u, 4)} · 2 − 1 = <b>${num(u * 2 - 1, 4)}</b>${p !== v.px ? ' (column clamped to the screen)' : ''}`; },
    draw(ctx, W, H, v, X) {
      const p = Math.min(v.px, v.w - 1), L = 30, Rr = W - 30, u = (p + 0.5) / v.w;
      const n = v.w <= 16 ? v.w : 0;
      // the screen row
      ctx.fillStyle = col('surface-2'); ctx.fillRect(L, 60, Rr - L, 60); ctx.strokeStyle = col('line'); ctx.strokeRect(L, 60, Rr - L, 60);
      if (n) for (let i = 0; i < n; i++) { const x0 = L + (Rr - L) * i / n, x1 = L + (Rr - L) * (i + 1) / n; ctx.fillStyle = i === p ? alpha(col('accent'), 0.35) : 'transparent'; ctx.fillRect(x0, 60, x1 - x0, 60); ctx.strokeStyle = col('line'); ctx.strokeRect(x0, 60, x1 - x0, 60); X.dot(ctx, (x0 + x1) / 2, 90, col('muted'), 2); X.label(ctx, String(i), (x0 + x1) / 2, 136, col('muted'), 'center'); }
      const x = L + u * (Rr - L);
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x, 130); ctx.stroke(); X.dot(ctx, x, 90, col('accent'), 5);
      X.label(ctx, n ? 'pixel numbers (dots: pixel centres)' : `${v.w} pixels in a row — too many to draw`, L, 44, col('muted'));
      // uv and ndc rulers
      const ruler = (y, a, b, c, name, color) => { ctx.strokeStyle = col(color); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(Rr, y); ctx.stroke(); [[L, a], [(L + Rr) / 2, b], [Rr, c]].forEach(([xx, t]) => { ctx.beginPath(); ctx.moveTo(xx, y - 5); ctx.lineTo(xx, y + 5); ctx.stroke(); X.label(ctx, t, xx, y + 18, col(color), 'center'); }); X.label(ctx, name, L - 4, y - 10, col(color), 'left', true); X.dot(ctx, x, y, col('accent'), 5); };
      ruler(180, '0', '0.5', '1', 'uv', 'ax-x'); ruler(236, '−1', '0', '+1', 'ndc', 'accent');
    },
    drag: (p, k, v) => ({ px: clamp(Math.floor((p.x - 30) / (440 - 60) * v.w), 0, v.w - 1) }),
    plot: { x: 'px', y: [-1, 1] },
    note: 'Pick W = 8 or 16 to see single pixels, then drag across the row.'
  });

  /* ---------- NDC → view ray (side view: y and z) ---------- */
  const vray = v => { const k = Math.tan(v.fov / 2 * DEG), y = v.ny * k, l = Math.hypot(y, 1); return { k, y, l, dy: y / l, dz: 1 / l, ang: Math.atan(y) / DEG }; };
  A.fx('viewray', {
    title: 'The pixel\'s direction relative to the camera',
    expr: 'd = normalize(0, {ny} · tan({fov} / 2), 1)',
    vars: { ny: { sym: 'ndc.y', name: 'vertical NDC of the pixel', min: -1, max: 1, value: 0.6, step: 0.01 },
            fov: { sym: 'fov', name: 'vertical field of view', unit: '°', min: 10, max: 150, value: 60, step: 1 } },
    out: [{ sym: 'd<sub>y</sub>', f: v => vray(v).dy, color: 'ax-y' }, { sym: 'd<sub>z</sub>', f: v => vray(v).dz, color: 'ax-z' }],
    sub: v => { const r = vray(v); return `d = <b>(0, ${num(r.dy)}, ${num(r.dz)})</b>, which points <b>${num(r.ang)}°</b> ${r.ang >= 0 ? 'above' : 'below'} the view centre`; },
    steps: v => { const r = vray(v); return [['tan(fov/2)', num(r.k, 4)], ['point on the plane z = 1', `(0, ${num(r.y, 4)}, 1)`], ['its length', num(r.l, 4)], ['divide by the length', `(0, ${num(r.dy, 4)}, ${num(r.dz, 4)})`]]; },
    draw(ctx, W, H, v, X) {
      const r = vray(v), cam = [60, H / 2], s = 170, P = (z, y) => [cam[0] + z * s, cam[1] - y * s];
      const top = Math.min(r.k, 1.3);
      ctx.fillStyle = alpha(col('accent'), 0.07); ctx.beginPath(); ctx.moveTo(...cam); ctx.lineTo(...P(2, 2 * r.k)); ctx.lineTo(...P(2, -2 * r.k)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...P(1, Math.min(r.k, 1.3))); ctx.lineTo(...P(1, -Math.min(r.k, 1.3))); ctx.stroke();
      X.label(ctx, 'plane at z = 1', P(1, 0)[0] + 8, 16, col('muted'));
      if (r.k <= 1.3) { X.label(ctx, `top edge: tan(fov/2) = ${num(r.k)}`, P(1, r.k)[0] + 8, P(1, r.k)[1] + 4, col('muted')); }
      ctx.strokeStyle = alpha(col('line'), 0.9); ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(cam[0], cam[1], s, -1.2, 1.2); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = alpha(col('muted'), 0.6); ctx.beginPath(); ctx.moveTo(...cam); ctx.lineTo(...P(1.4, 0)); ctx.stroke();
      if (Math.abs(r.y) < 1.4) { ctx.strokeStyle = alpha(col('ink'), 0.5); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(...cam); ctx.lineTo(...P(1, r.y)); ctx.stroke(); ctx.setLineDash([]); X.dot(ctx, ...P(1, r.y), col('ink'), 5); X.label(ctx, `(0, ${num(r.y)}, 1)`, P(1, r.y)[0] + 10, P(1, r.y)[1] - 8, col('ink')); }
      X.arrow(ctx, cam[0], cam[1], ...P(r.dz, r.dy), col('accent'), 3); X.label(ctx, 'd (length 1)', P(r.dz, r.dy)[0] - 10, P(r.dz, r.dy)[1] - 10, col('accent'), 'right', true);
      X.dot(ctx, cam[0], cam[1], col('ink'), 6); X.label(ctx, 'camera', cam[0], cam[1] + 20, col('ink'), 'center', true);
      X.label(ctx, '+z: forward', P(1.4, 0)[0], cam[1] + 16, col('muted'), 'right');
    },
    plot: { x: 'ny', y: [-1, 1] },
    note: 'The dashed circle has radius 1: normalizing pulls the point on the plane back onto it.'
  });

  /* ---------- world elevation ---------- */
  A.fx('worldray', {
    title: 'Adding the camera\'s pitch',
    expr: 'elevation = {pitch} + {a},   D<sub>y</sub> = sin(elevation)',
    vars: { pitch: { sym: 'pitch', name: 'camera pitch (up is positive)', unit: '°', min: -60, max: 80, value: 10, step: 1 },
            a: { sym: 'α', name: 'pixel angle inside the view (previous widget)', unit: '°', min: -45, max: 45, value: 25, step: 1 } },
    out: { sym: 'D<sub>y</sub>', f: v => Math.sin((v.pitch + v.a) * DEG), color: 'ax-y' },
    sub: v => `elevation = ${v.pitch}° + ${A.pn(v.a)}° = <b>${v.pitch + v.a}°</b>,   D<sub>y</sub> = sin ${v.pitch + v.a}° = <b>${num(Math.sin((v.pitch + v.a) * DEG))}</b>`,
    draw(ctx, W, H, v, X) {
      const c = [90, H / 2 + 30], L = 300, e = (v.pitch + v.a) * DEG, p = v.pitch * DEG;
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(10, c[1]); ctx.lineTo(W - 10, c[1]); ctx.stroke(); X.label(ctx, 'horizon (elevation 0°)', W - 12, c[1] + 16, col('muted'), 'right');
      ctx.strokeStyle = alpha(col('ink'), 0.5); ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(...c); ctx.lineTo(c[0] + Math.cos(p) * L, c[1] - Math.sin(p) * L); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, 'view centre', c[0] + Math.cos(p) * 220 + 6, c[1] - Math.sin(p) * 220 + 14, col('ink'));
      ctx.lineWidth = 2; ctx.strokeStyle = col('ax-y'); ctx.beginPath(); ctx.arc(c[0], c[1], 54, -Math.max(p, e), -Math.min(p, e)); ctx.stroke();
      ctx.strokeStyle = col('muted'); ctx.beginPath(); ctx.arc(c[0], c[1], 36, p < 0 ? 0 : -p, p < 0 ? -p : 0); ctx.stroke();
      X.arrow(ctx, c[0], c[1], c[0] + Math.cos(e) * 160, c[1] - Math.sin(e) * 160, col('accent'), 3);
      X.label(ctx, 'world ray', c[0] + Math.cos(e) * 160 + 6, c[1] - Math.sin(e) * 160 - 6, col('accent'), 'left', true);
      X.label(ctx, `pitch ${v.pitch}°`, c[0] + 40, c[1] + 18, col('muted')); X.label(ctx, `+ α ${v.a}°`, c[0] + 60 * Math.cos((p + e) / 2) + 8, c[1] - 60 * Math.sin((p + e) / 2), col('ax-y'));
      X.dot(ctx, c[0], c[1], col('ink'), 6);
    },
    plot: { x: 'a', y: [-1, 1] }
  });

  /* ---------- float precision ---------- */
  const spacing = x => Math.pow(2, Math.floor(Math.log2(Math.max(x, 1e-30))) - 23);
  A.fx('fprec', {
    title: 'How far apart neighbouring 32-bit floats are',
    expr: 'gap = 2<sup>floor(log₂ {x}) − 23</sup>',
    vars: { x: { name: 'size of the number (e.g. metres from the origin)', min: 1, max: 1e8, value: 6371000, log: true, fmt: x => num(x) } },
    out: { sym: 'gap', f: v => spacing(v.x), fmt: x => x >= 0.01 ? num(x) + ' m' : num(x * 1000) + ' mm' },
    sub: v => `log₂ ${num(v.x)} = ${num(Math.log2(v.x), 4)} → floor ${Math.floor(Math.log2(v.x))} → gap = 2<sup>${Math.floor(Math.log2(v.x)) - 23}</sup> = <b>${spacing(v.x) >= 0.01 ? num(spacing(v.x)) + ' m' : num(spacing(v.x) * 1000) + ' mm'}</b>`,
    draw(ctx, W, H, v, X) {
      const g = spacing(v.x), L = 30, Rr = W - 30, win = 2, y = 130;
      X.label(ctx, `A 2 m window of the number line around ${num(v.x)}`, L, 30, col('muted'));
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(Rr, y); ctx.stroke();
      const n = win / g;
      if (n <= 120) { ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; const start = Math.ceil(-1 / g) * g; for (let t = start; t <= 1 + 1e-9; t += g) { const x = L + (t + 1) / win * (Rr - L); ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.lineTo(x, y + 22); ctx.stroke(); } X.label(ctx, 'every tick is a value a float can hold; anything between snaps to a tick', L, y + 52, col('accent')); }
      else { ctx.fillStyle = alpha(col('accent'), 0.45); ctx.fillRect(L, y - 22, Rr - L, 44); X.label(ctx, `${num(n)} values in this window: effectively smooth`, L, y + 52, col('accent')); }
      X.label(ctx, '−1 m', L, y + 36, col('muted'), 'center'); X.label(ctx, '+1 m', Rr, y + 36, col('muted'), 'center');
      const tag = v.x > 3e6 ? 'planet scale: a vertex can only move in steps of ' + num(g) + ' m' : v.x > 1e4 ? 'open-world scale: visible jitter in fine detail' : 'near the origin: precise';
      X.label(ctx, tag, L, H - 30, v.x > 1e4 ? col('bad') : col('good'), 'left', true);
    },
    plot: { x: 'x', logY: true, y: [1e-7, 10] },
    note: 'Camera-relative rendering keeps x small near the viewer, where detail is visible.'
  });

  /* ---------- altitude along the ray ---------- */
  A.fx('alt', {
    title: 'Altitude along a straight ray over a round planet',
    expr: 'alt = √({t}² + 2·{t}·(R + {h})·sin {el} + (R + {h})²) − R',
    vars: { t: { name: 'distance along the ray', min: 0, max: 300000, value: 100000, step: 500, fmt: km },
            el: { sym: 'θ', name: 'elevation of the ray', unit: '°', min: -2, max: 30, value: 0, step: 0.1 },
            h: { name: 'camera height above ground', unit: 'm', min: 2, max: 3000, value: 2, log: true },
            R: { name: 'planet radius', unit: 'm', value: R, min: R, max: R, const: true } },
    out: { sym: 'alt', unit: 'm', f: v => altAt(v.h, v.el, v.t) },
    steps: v => { const a = altAt(v.h, v.el, v.t); return [['distance from the centre', num(a + R, 7) + ' m'], ['minus R', num(a) + ' m'], ['flat-ground guess t·sin θ + h', num(v.t * Math.sin(v.el * DEG) + v.h) + ' m'], ['extra height from curvature', num(a - v.t * Math.sin(v.el * DEG) - v.h) + ' m']]; },
    draw(ctx, W, H, v, X) {
      flatView(ctx, W, H, X, v.h, v.el, NaN, NaN, { tMax: 300000, aMax: 8000 });
      const L = 54, Rr = W - 14, B = H - 42, T = 18, gMax = groundAt(v.h, v.el, 300000);
      const x = L + groundAt(v.h, v.el, v.t) / gMax * (Rr - L), y = B - altAt(v.h, v.el, v.t) / 8000 * (B - T);
      if (y > T) { X.dot(ctx, x, y, col('accent'), 6); X.label(ctx, `t = ${km(v.t)}`, x - 8, y - 10, col('accent'), 'right', true); }
    },
    plot: { x: 't', y: [0, 10000] },
    note: 'Even a ray aimed exactly at the horizon (θ = 0) climbs into the layer after about 138 km.'
  });

  /* ---------- entering and leaving the layer ---------- */
  A.fx('layer', {
    title: 'Where the ray enters and leaves the layer (camera below it)',
    expr: 'b = (R + {h})·sin {el},   t<sub>enter</sub> = −b + √(b² − c<sub>lo</sub>),   t<sub>exit</sub> = −b + √(b² − c<sub>hi</sub>)',
    vars: { el: { sym: 'θ', name: 'elevation of the ray', unit: '°', min: 0, max: 90, value: 90, step: 0.5 },
            h: { name: 'camera height', unit: 'm', min: 2, max: 1400, value: 2, step: 1, fmt: x => num(x) } },
    out: [{ sym: 't<sub>enter</sub>', f: v => hitSphere(v.h, v.el, R + LO).t1, fmt: km, color: 'accent' },
          { sym: 't<sub>exit</sub>', f: v => hitSphere(v.h, v.el, R + HI).t1, fmt: km, color: 'ray' },
          { sym: 'path', name: 'distance through the layer', f: v => hitSphere(v.h, v.el, R + HI).t1 - hitSphere(v.h, v.el, R + LO).t1, fmt: km, color: 'ax-y' }],
    sub: v => { const lo = hitSphere(v.h, v.el, R + LO), hi = hitSphere(v.h, v.el, R + HI); return `b = (R + ${num(v.h)})·sin ${num(v.el)}° = ${num(lo.b)} → enter <b>${km(lo.t1)}</b>, exit <b>${km(hi.t1)}</b>, path <b>${km(hi.t1 - lo.t1)}</b>`; },
    steps: v => { const lo = hitSphere(v.h, v.el, R + LO), hi = hitSphere(v.h, v.el, R + HI); return [['b', num(lo.b)], ['c (lower sphere)', num(lo.c)], ['c (upper sphere)', num(hi.c)], ['both c negative', 'camera inside both spheres → use t₁']]; },
    draw(ctx, W, H, v, X) { const lo = hitSphere(v.h, v.el, R + LO), hi = hitSphere(v.h, v.el, R + HI); flatView(ctx, W, H, X, v.h, v.el, lo.t1, hi.t1, { minX: 1500 }); },
    plot: { x: 'el', logY: true, y: [500, 400000] },
    note: 'Test values: θ = 90° gives 1498 m and 2498 m; θ = 0° enters at about 138 km.'
  });

  /* ---------- three cases ---------- */
  A.fx('cases', {
    title: 'Camera below, inside or above the layer',
    expr: 'camera altitude {h},  ray elevation {el}',
    vars: { h: { name: 'camera altitude', unit: 'm', min: 2, max: 4500, value: 2000, step: 1 },
            el: { sym: 'θ', name: 'elevation of the ray', unit: '°', min: -90, max: 90, value: -20, step: 0.5 } },
    out: [{ sym: 't<sub>enter</sub>', f: v => layer(v.h, v.el).a, fmt: km, color: 'accent' }, { sym: 't<sub>exit</sub>', f: v => layer(v.h, v.el).b, fmt: km, color: 'ray' }],
    sub: v => { const q = layer(v.h, v.el), w = { below: 'below the layer: enter = lower t₁, exit = upper t₁', inside: 'inside the layer: enter = 0, exit = first of upper t₁ and lower t₀', above: 'above the layer: enter = upper t₀, exit = lower t₀ or upper t₁' }[q.kase]; return `${w} → <b>${Number.isNaN(q.a) ? 'no cloud on this ray' : km(q.a) + ' to ' + km(q.b)}</b>`; },
    draw(ctx, W, H, v, X) { const q = layer(v.h, v.el); flatView(ctx, W, H, X, v.h, v.el, q.a, q.b, { aMax: 5000, minX: 4000, tMax: isFinite(q.b) ? q.b * 1.15 : Math.min(q.ground * 1.05, 200000), ground: isFinite(q.ground) && (Number.isNaN(q.a) || q.ground < q.b) ? q.ground : NaN }); },
    plot: { x: 'el', logY: true, y: [100, 400000] },
    note: 'Fly the camera up through the layer and sweep the elevation.'
  });

  /* ---------- Beer–Lambert ---------- */
  A.fx('beer', {
    title: 'Transmittance: how much background shows through',
    expr: 'T = e<sup>−{s} · {d}</sup>',
    vars: { s: { sym: 'σ', name: 'density (extinction per metre)', min: 0.00001, max: 0.01, value: 0.001, log: true },
            d: { name: 'distance through the cloud', unit: 'm', min: 0, max: 5000, value: 1000, step: 10 } },
    out: { sym: 'T', f: v => Math.exp(-v.s * v.d) },
    sub: v => `T = e<sup>−${num(v.s * v.d)}</sup> = <b>${num(Math.exp(-v.s * v.d))}</b> → ${Math.round(Math.exp(-v.s * v.d) * 100)}% of the background passes`,
    draw(ctx, W, H, v, X) {
      const T = Math.exp(-v.s * v.d), x0 = 30, x1 = W - 30, y0 = 50, y1 = 190;
      for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#3f6fb5' : '#e5b552'; ctx.fillRect(x0 + (x1 - x0) * i / 12, y0, (x1 - x0) / 12, y1 - y0); }
      X.label(ctx, 'background', x0, y0 - 10, col('muted'));
      const xs = x0 + (x1 - x0) * 0.35; ctx.fillStyle = `rgba(238,240,244,${1 - T})`; ctx.fillRect(xs, y0, x1 - xs, y1 - y0);
      X.label(ctx, `behind the cloud: ${Math.round(T * 100)}% of the background`, xs, y1 + 22, col('ink'), 'left', true);
      X.label(ctx, 'no cloud', x0 + 6, y1 + 22, col('muted'));
    },
    plot: { x: 'd', y: [0, 1] },
    note: 'Doubling the distance squares T: two layers of 37% let through 37% × 37% ≈ 14%.'
  });

})();
