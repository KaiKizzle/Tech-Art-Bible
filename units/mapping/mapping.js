/* Simple Mapping Techniques — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180, PI = Math.PI;
  const enc = x => Math.round(clamp(x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055, 0, 1) * 255);
  const css = c => `rgb(${c.map(enc).join(',')})`;
  const frac = x => x - Math.floor(x);
  const hash = (x, y) => frac(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
  const CX = [0.75, 0.22, 0.18], CY = [0.25, 0.62, 0.3], CZ = [0.22, 0.35, 0.8];

  /* ---------- planar ---------- */
  A.fx('planar', {
    title: 'Planar projection stretches on slopes',
    expr: 'stretch = 1 / |cos {th}|',
    vars: { th: { sym: 'θ', name: 'angle between the surface normal and the projection axis', unit: '°', min: 0, max: 85, value: 60, step: 0.5 } },
    out: { sym: 'stretch', f: v => 1 / Math.cos(v.th * DEG), fmt: x => num(x) + '×' },
    sub: v => `one texel of the texture covers <b>${num(1 / Math.cos(v.th * DEG))}×</b> as much surface here as on flat ground`,
    draw(ctx, W, H, v, X) {
      const c = [W / 2, H - 30], R = 150, cell = 18;
      ctx.strokeStyle = alpha(col('accent'), 0.35); ctx.setLineDash([2, 4]); for (let x = c[0] - R; x <= c[0] + R; x += cell) { ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, c[1]); ctx.stroke(); } ctx.setLineDash([]);
      for (let a = -88; a < 88; a += 0.5) { const p0 = [c[0] + Math.sin(a * DEG) * R, c[1] - Math.cos(a * DEG) * R], p1 = [c[0] + Math.sin((a + 0.5) * DEG) * R, c[1] - Math.cos((a + 0.5) * DEG) * R]; const k = Math.floor((p0[0] - c[0] + 1000) / cell) % 2; ctx.strokeStyle = k ? '#e9e4da' : '#2a2d33'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); }
      const p = [c[0] + Math.sin(v.th * DEG) * R, c[1] - Math.cos(v.th * DEG) * R];
      X.arrow(ctx, p[0], p[1], p[0] + Math.sin(v.th * DEG) * 50, p[1] - Math.cos(v.th * DEG) * 50, col('ink'), 2); X.label(ctx, 'N', p[0] + Math.sin(v.th * DEG) * 60, p[1] - Math.cos(v.th * DEG) * 60, col('ink'), 'center', true);
      X.label(ctx, 'projected from above ↓', 10, 18, col('accent'));
    },
    plot: { x: 'th', logY: true, y: [1, 20] }
  });

  /* ---------- triplanar weights (2D section: z = 0) ---------- */
  const tw = (ph, k) => { const x = Math.pow(Math.abs(Math.cos(ph * DEG)), k), y = Math.pow(Math.abs(Math.sin(ph * DEG)), k); return [x / (x + y), y / (x + y)]; };
  A.fx('triblend', {
    title: 'Triplanar blend weights',
    expr: 'w<sub>x</sub> = |cos {ph}|<sup>{k}</sup> / Σ,   w<sub>y</sub> = |sin {ph}|<sup>{k}</sup> / Σ',
    vars: { ph: { sym: 'φ', name: 'normal direction (0° faces X, 90° faces Y)', unit: '°', min: 0, max: 90, value: 30, step: 0.5 }, k: { name: 'sharpness', min: 1, max: 16, value: 4, step: 0.1 } },
    out: [{ sym: 'w<sub>x</sub>', f: v => tw(v.ph, v.k)[0], color: 'bad' }, { sym: 'w<sub>y</sub>', f: v => tw(v.ph, v.k)[1], color: 'good' }],
    draw(ctx, W, H, v, X) {
      const c = [W / 2, H / 2 + 5], R = 100;
      for (let a = 0; a < 360; a += 1) { const w = tw(a, v.k), cc = CX.map((x, i) => x * w[0] + CY[i] * w[1]); const chk = (Math.floor((c[0] + Math.cos(a * DEG) * R) / 12) + Math.floor((c[1] - Math.sin(a * DEG) * R) / 12)) % 2 ? 1 : 0.65;
        ctx.strokeStyle = css(cc.map(x => x * chk * 1.3)); ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(c[0], c[1], R, -(a + 1.2) * DEG, -a * DEG); ctx.stroke(); }
      const p = [c[0] + Math.cos(v.ph * DEG) * (R + 26), c[1] - Math.sin(v.ph * DEG) * (R + 26)]; X.dot(ctx, p[0], p[1], col('ink'), 5);
      X.label(ctx, 'red: X projection', 10, 18, css(CX.map(x => x * 1.3))); X.label(ctx, 'green: Y projection', 10, 36, css(CY.map(x => x * 1.3)));
    },
    plot: { x: 'ph', y: [0, 1.05] }
  });

  A.fx('tricost', {
    title: 'Texture samples per pixel',
    expr: 'samples = {t} · {m}',
    vars: { t: { name: 'textures in the material (albedo, normal, mask…)', min: 1, max: 6, value: 3, step: 1 }, m: { name: 'projection', values: [1, 2, 3], labels: ['UVs (1)', 'biplanar (2)', 'triplanar (3)'], index: 2 } },
    out: { sym: 'samples', f: v => v.t * v.m },
    sub: v => `<b>${v.t * v.m}</b> samples per pixel instead of ${v.t} with UVs`,
    plot: { x: 't', y: [0, 20] }
  });

  /* ---------- triplanar normals ---------- */
  A.fx('trinormal', {
    title: 'Why a projected normal map must be rotated',
    expr: 'correct = {ph} + {t},   naive = {t}',
    vars: { ph: { sym: 'φ', name: 'where on the object (surface normal, from up)', unit: '°', min: -90, max: 90, value: 60, step: 1 }, t: { sym: 'θ<sub>bump</sub>', name: 'tilt stored in the normal map', unit: '°', min: -40, max: 40, value: 20, step: 1 } },
    out: [{ sym: 'correct', f: v => v.ph + v.t, color: 'accent', fmt: x => num(x) + '°' }, { sym: 'naive', f: v => v.t, color: 'bad', fmt: x => num(x) + '°' }],
    draw(ctx, W, H, v, X) {
      const c = [W / 2, H - 40], R = 120;
      ctx.strokeStyle = css([0.4, 0.42, 0.45]); ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(c[0], c[1], R, PI, 2 * PI); ctx.stroke();
      const a = v.ph * DEG, p = [c[0] + Math.sin(a) * R, c[1] - Math.cos(a) * R];
      const arr = (ang, cc, w) => X.arrow(ctx, p[0], p[1], p[0] + Math.sin(ang) * 80, p[1] - Math.cos(ang) * 80, cc, w);
      arr(a, col('muted'), 1.5); arr((v.ph + v.t) * DEG, col('accent'), 3); arr(v.t * DEG, col('bad'), 2.5);
      X.label(ctx, 'grey: surface normal', 10, 18, col('muted')); X.label(ctx, 'orange: bump rotated onto the surface', 10, 36, col('accent')); X.label(ctx, 'red: sample used as a world normal', 10, 54, col('bad'));
    },
    plot: { x: 'ph', y: [-130, 130] }
  });

  /* ---------- detail ---------- */
  const fade = v => 1 - clamp((v.d - v.f0) / Math.max(v.f1 - v.f0, 1e-3), 0, 1);
  const detail = (v, dv) => clamp(0.5 * (1 + (2 * dv - 1) * fade(v)), 0, 1);
  A.fx('detail', {
    title: 'Overlay detail, faded with distance',
    expr: 'colour = base · lerp(1, 2 · {dv}, fade),   fade = 1 − saturate(({d} − {f0}) / ({f1} − {f0}))',
    vars: { dv: { name: 'detail texel value (0.5 = neutral)', min: 0, max: 1, value: 0.3, step: 0.01 }, d: { name: 'distance to the camera', unit: 'm', min: 0.1, max: 20, value: 1.5, log: true },
            f0: { name: 'fade starts', unit: 'm', min: 0.5, max: 10, value: 2, step: 0.1 }, f1: { name: 'fade ends', unit: 'm', min: 1, max: 20, value: 6, step: 0.1 } },
    out: [{ sym: 'base × factor', f: v => 2 * detail(v, v.dv), color: 'accent' }, { sym: 'fade', f: fade, color: 'ray' }],
    draw(ctx, W, H, v, X) {
      const base = [0.62, 0.42, 0.33], x0 = 20, x1 = W - 20, y0 = 40, h = H - 110, lg = d => x0 + (Math.log(d / 0.1) / Math.log(200)) * (x1 - x0);
      for (let x = x0; x < x1; x += 2) { const d = 0.1 * Math.pow(200, (x - x0) / (x1 - x0)), vv = { ...v, d }; for (let y = 0; y < h; y += 2) { const n = hash(Math.floor(x / 4), Math.floor(y / 4)); ctx.fillStyle = css(base.map(c => c * 2 * detail(vv, 0.5 + (n - 0.5) * 0.55))); ctx.fillRect(x, y0 + y, 2, 2); } }
      [[0.1, '0.1 m'], [1, '1 m'], [10, '10 m']].forEach(([d, t]) => X.label(ctx, t, lg(d), y0 + h + 18, col('muted'), 'center'));
      const xd = lg(v.d); ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xd, y0 - 6); ctx.lineTo(xd, y0 + h + 4); ctx.stroke();
      X.label(ctx, 'skin with a pore detail map, near → far', x0, 24, col('muted'));
    },
    plot: { x: 'd', y: [0, 1.6] }
  });

  /* ---------- flow ---------- */
  const fw = t => Math.abs(1 - 2 * frac(t));
  A.fx('flow', {
    title: 'Two phases hide the reset',
    expr: 't₀ = frac({t}),   t₁ = frac({t} + 0.5),   w = |1 − 2 · t₀|,   strength {s}',
    vars: { t: { name: 'time × speed', min: 0, max: 2, value: 0.35, step: 0.005 }, s: { name: 'distortion strength', min: 0, max: 1, value: 0.6, step: 0.01 } },
    out: [{ sym: 'weight of copy b (w)', f: v => fw(v.t), color: 'accent' }, { sym: 't₀', f: v => frac(v.t), color: 'ray' }],
    draw(ctx, W, H, v, X) {
      const t0 = frac(v.t), t1 = frac(v.t + 0.5), w = fw(v.t), x0 = 120, rw = W - x0 - 12, rh = 56;
      const tex = (x, y, ph, off) => { const flow = 0.25 + 0.75 * (y / rh); return 0.5 + 0.5 * Math.sin(2 * PI * ((x / 28) - flow * ph * v.s * 6 + off) + Math.sin(y * 0.15) * 0.3); };
      const rows = [['copy a', (x, y) => tex(x, y, t0, 0), 1 - w], ['copy b', (x, y) => tex(x, y, t1, 0.5), w], ['blend', (x, y) => tex(x, y, t0, 0) * (1 - w) + tex(x, y, t1, 0.5) * w, 1]];
      rows.forEach(([n, f, op], i) => { const y0 = 22 + i * (rh + 24); for (let x = 0; x < rw; x += 2) for (let y = 0; y < rh; y += 2) { const g = f(x, y); ctx.fillStyle = css([0.1 + g * 0.3, 0.25 + g * 0.45, 0.4 + g * 0.5]); ctx.fillRect(x0 + x, y0 + y, 2, 2); }
        X.label(ctx, n, x0 - 10, y0 + rh / 2 - 4, col('ink'), 'right', true); if (i < 2) X.label(ctx, `weight ${num(op)}`, x0 - 10, y0 + rh / 2 + 12, col('muted'), 'right'); });
      X.label(ctx, 'flow: slow at the top of each strip, fast at the bottom', x0, 14, col('muted'));
    },
    plot: { x: 't', y: [0, 1.05] }
  });

  /* ---------- matcap ---------- */
  const mc = (nx, ny) => { const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)); const L = [-0.5, 0.6, 0.62], ll = Math.hypot(...L), l = L.map(x => x / ll); const dif = Math.max(0, nx * l[0] + ny * l[1] + nz * l[2]); const Hh = [l[0], l[1], l[2] + 1], hl = Math.hypot(...Hh); const sp = Math.pow(Math.max(0, (nx * Hh[0] + ny * Hh[1] + nz * Hh[2]) / hl), 50); const rim = Math.pow(1 - nz, 3);
    return [0.55, 0.22, 0.16].map((b, i) => b * (0.08 + 0.95 * dif) + sp * 1.2 + rim * [0.25, 0.35, 0.6][i]); };
  const nOf = v => { const s = Math.sin(v.ph * DEG); return [s * Math.cos(v.th * DEG), s * Math.sin(v.th * DEG), Math.cos(v.ph * DEG)]; };
  A.fx('matcap', {
    title: 'Looking up a matcap with the view-space normal',
    expr: 'uv = N<sub>view</sub>.xy · 0.5 + 0.5,   N<sub>view</sub> at {th} around, {ph} from the view axis',
    vars: { th: { sym: 'θ', name: 'direction around the view axis', unit: '°', min: 0, max: 360, value: 130, step: 1 }, ph: { sym: 'φ', name: 'angle away from the camera', unit: '°', min: 0, max: 89, value: 55, step: 0.5 } },
    out: [{ sym: 'u', f: v => nOf(v)[0] * 0.5 + 0.5, color: 'ray' }, { sym: 'v', f: v => nOf(v)[1] * 0.5 + 0.5, color: 'good' }],
    draw(ctx, W, H, v, X) {
      /* object: an ellipsoid shaded only by the matcap */
      const a = [80, 115, 65], o = [W * 0.3, H / 2];
      for (let y = -a[1]; y <= a[1]; y += 2) for (let x = -a[0]; x <= a[0]; x += 2) { const q = (x * x) / (a[0] * a[0]) + (y * y) / (a[1] * a[1]); if (q > 1) continue; const z = a[2] * Math.sqrt(1 - q); let n = [x / (a[0] * a[0]), -y / (a[1] * a[1]), z / (a[2] * a[2])]; const l = Math.hypot(...n); n = n.map(t => t / l); ctx.fillStyle = css(mc(n[0], n[1])); ctx.fillRect(o[0] + x, o[1] + y, 2, 2); }
      /* the matcap itself */
      const mcC = [W * 0.7, H / 2], R = 115;
      for (let y = -R; y <= R; y += 2) for (let x = -R; x <= R; x += 2) { if (x * x + y * y > R * R) continue; ctx.fillStyle = css(mc(x / R, -y / R)); ctx.fillRect(mcC[0] + x, mcC[1] + y, 2, 2); }
      const n = nOf(v); X.dot(ctx, mcC[0] + n[0] * R, mcC[1] - n[1] * R, col('accent'), 5);
      const s = Math.hypot(n[0] * a[0], n[1] * a[1], n[2] * a[2]); X.dot(ctx, o[0] + a[0] * a[0] * n[0] / s, o[1] - a[1] * a[1] * n[1] / s, col('accent'), 5);
      X.label(ctx, 'object', o[0], H - 10, col('muted'), 'center'); X.label(ctx, 'matcap texture', mcC[0], H - 10, col('muted'), 'center');
    },
    sub: v => { const n = nOf(v); return `uv = (<b>${num(n[0] * 0.5 + 0.5)}</b>, <b>${num(n[1] * 0.5 + 0.5)}</b>): the orange dots mark that texel and the point on the object that shows it`; },
    size: [880, 300],
    plot: false
  });

  /* ---------- equirectangular ---------- */
  const dirOf = v => [Math.cos(v.el * DEG) * Math.cos(v.az * DEG), Math.sin(v.el * DEG), Math.cos(v.el * DEG) * Math.sin(v.az * DEG)];
  const eu = v => { const d = dirOf(v); return Math.atan2(d[2], d[0]) / (2 * PI) + 0.5; }, ev = v => Math.acos(clamp(dirOf(v)[1], -1, 1)) / PI;
  A.fx('equirect', {
    title: 'Direction to latitude–longitude UV',
    expr: 'u = atan2(d.z, d.x) / 2π + 0.5,   v = acos(d.y) / π,   d at {az} around, {el} up',
    vars: { az: { sym: 'azimuth', name: 'direction around the horizon', unit: '°', min: -180, max: 180, value: 40, step: 1 }, el: { sym: 'elevation', name: 'angle above the horizon', unit: '°', min: -90, max: 90, value: 25, step: 1 } },
    out: [{ sym: 'u', f: eu, color: 'ray' }, { sym: 'v', f: ev, color: 'good' }],
    sub: v => `uv = (<b>${num(eu(v))}</b>, <b>${num(ev(v))}</b>); the horizon is at v = 0.5`,
    draw(ctx, W, H, v, X) {
      const w = W - 40, h = w / 2, x0 = 20, y0 = (H - h) / 2 - 6, sun = [0.62, 0.3];
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { const u = x / w, vv = y / h; let c; if (vv < 0.5) { const t = vv / 0.5; c = [0.15 + 0.4 * t, 0.3 + 0.4 * t, 0.65 + 0.2 * t]; } else { const t = (vv - 0.5) / 0.5; c = [0.32 - 0.15 * t, 0.26 - 0.12 * t, 0.18 - 0.08 * t]; }
        const ds = Math.hypot((u - sun[0]) * 2, vv - sun[1]); if (ds < 0.03) c = [3, 2.7, 2.2]; else c = c.map(k => k + 0.15 * Math.exp(-ds * 12)); ctx.fillStyle = css(c); ctx.fillRect(x0 + x, y0 + y, 2, 2); }
      ctx.strokeStyle = col('line'); ctx.strokeRect(x0, y0, w, h);
      X.dot(ctx, x0 + eu(v) * w, y0 + ev(v) * h, col('accent'), 5);
      X.label(ctx, 'u = 0', x0, y0 + h + 16, col('muted')); X.label(ctx, 'u = 1', x0 + w, y0 + h + 16, col('muted'), 'right'); X.label(ctx, 'v = 0 (straight up)', x0, y0 - 8, col('muted'));
    },
    plot: { x: 'el', y: [0, 1] }
  });

  /* ---------- decal ---------- */
  const dfade = v => clamp((Math.cos(v.th * DEG) - Math.cos(v.lim * DEG)) / (1 - Math.cos(v.lim * DEG)), 0, 1);
  A.fx('decal', {
    title: 'Decal stretch and angle fade',
    expr: 'stretch = 1 / cos {th},   fade = saturate((cos {th} − cos {lim}) / (1 − cos {lim}))',
    vars: { th: { sym: 'θ', name: 'angle between the surface normal and the decal axis', unit: '°', min: 0, max: 89, value: 45, step: 0.5 }, lim: { sym: 'θ<sub>max</sub>', name: 'angle where the decal has faded out', unit: '°', min: 20, max: 89, value: 70, step: 0.5 } },
    out: [{ sym: 'stretch', f: v => 1 / Math.cos(v.th * DEG), color: 'bad', fmt: x => num(x) + '×' }, { sym: 'fade', f: dfade, color: 'accent' }],
    draw(ctx, W, H, v, X) {
      const c = [W / 2, H / 2 + 40], t = v.th * DEG, bw = 120, f = dfade(v);
      ctx.strokeStyle = col('muted'); ctx.setLineDash([5, 4]); ctx.strokeRect(c[0] - bw / 2, 16, bw, H - 40); ctx.setLineDash([]);
      X.label(ctx, 'decal box, projecting ↓', c[0] - bw / 2, 12, col('muted'));
      const L = 170; ctx.lineWidth = 10; ctx.strokeStyle = css([0.35, 0.36, 0.38]); ctx.beginPath(); ctx.moveTo(c[0] - Math.cos(t) * L, c[1] + Math.sin(t) * L); ctx.lineTo(c[0] + Math.cos(t) * L, c[1] - Math.sin(t) * L); ctx.stroke();
      /* projected stripes inside the box: each stripe covers bw/6 horizontally, so 1 / cos θ along the slope */
      for (let k = 0; k < 6; k++) { if (k % 2) continue; const xa = -bw / 2 + k * bw / 6, xb = xa + bw / 6; ctx.strokeStyle = alpha(col('bad'), 0.9 * f + 0.06); ctx.beginPath(); ctx.moveTo(c[0] + xa, c[1] - xa * Math.tan(t)); ctx.lineTo(c[0] + xb, c[1] - xb * Math.tan(t)); ctx.stroke(); }
      X.arrow(ctx, c[0], c[1], c[0] - Math.sin(t) * 60, c[1] - Math.cos(t) * 60, col('ink'), 2); X.label(ctx, 'N', c[0] - Math.sin(t) * 72, c[1] - Math.cos(t) * 72, col('ink'), 'center', true);
    },
    plot: { x: 'th', y: [0, 4] }
  });
})();
