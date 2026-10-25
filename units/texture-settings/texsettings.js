/* Texture Packing and Import Settings — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const s2l = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  /* ---------- memory per format ---------- */
  const FMT = ['RGBA32', 'BC1', 'BC3', 'BC4', 'BC5', 'BC6H', 'BC7', 'ASTC 4×4', 'ASTC 6×6', 'ASTC 8×8'], BPP = [32, 4, 8, 4, 8, 8, 8, 8, 128 / 36, 2];
  const mem = v => v.s * v.s * BPP[v.f] / 8 * 4 / 3 / 1048576;
  A.fx('fmtmem', {
    title: 'Texture memory with mips',
    expr: 'MB = {s}² · bpp({f}) / 8 · 4/3',
    vars: { s: { sym: 'size', name: 'texture size', values: [256, 512, 1024, 2048, 4096, 8192], index: 3 }, f: { sym: 'format', name: 'format', values: FMT.map((_, i) => i), labels: FMT, index: 6 } },
    out: { sym: 'memory', unit: 'MB', f: mem },
    sub: v => `${FMT[v.f]}: <b>${num(BPP[v.f])}</b> bits per texel, <b>${num(mem(v))} MB</b> with mips · uncompressed RGBA32 would be ${num(v.s * v.s * 4 * 4 / 3 / 1048576)} MB`,
    plot: { x: 'f', y: [0, 30] }
  });

  /* ---------- sRGB mistake ---------- */
  A.fx('srgbbug', {
    title: 'Data map with sRGB on',
    expr: 'read = (({v} + 0.055) / 1.055)<sup>2.4</sup> instead of {v}',
    vars: { v: { sym: 'stored', name: 'value stored in the roughness map', min: 0, max: 1, value: 0.5, step: 0.01 } },
    out: [{ sym: 'sRGB off (correct)', f: v => v.v, color: 'good' }, { sym: 'sRGB on (wrong)', f: v => s2l(v.v), color: 'bad' }],
    sub: v => `roughness ${num(v.v)} arrives as <b>${num(s2l(v.v))}</b>: the surface looks much glossier than painted`,
    draw(ctx, W, H, v, X) {
      const x0 = 20, w = W - 40;
      [['as painted (sRGB off)', x => x, 40], ['as read with sRGB on', s2l, 120]].forEach(([n, f, y]) => {
        for (let i = 0; i < w; i++) { const t = f(i / w); const g = Math.round(t * 255); ctx.fillStyle = `rgb(${g},${g},${g})`; ctx.fillRect(x0 + i, y, 1, 40); }
        X.label(ctx, n, x0, y - 8, col('muted'));
      });
      const x = x0 + w * v.v; ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 36); ctx.lineTo(x, 164); ctx.stroke();
    },
    plot: { x: 'v', y: [0, 1] }
  });

  /* ---------- packing layouts ---------- */
  const LAY = [
    { n: 'HDRP mask map', ch: ['metallic', 'AO', 'detail mask', 'smoothness'], f: v => [v.m, v.ao, 1, 1 - v.r] },
    { n: 'URP metallic map', ch: ['metallic', '(unused)', '(unused)', 'smoothness'], f: v => [v.m, 0, 0, 1 - v.r] },
    { n: 'Unreal ORM', ch: ['AO', 'roughness', 'metallic', '(none)'], f: v => [v.ao, v.r, v.m, 1] }
  ];
  A.fx('layout', {
    title: 'Packed texel per engine layout',
    expr: 'layout {e}: metallic {m}, AO {ao}, roughness {r}',
    vars: { e: { sym: 'engine', name: 'layout', values: [0, 1, 2], labels: LAY.map(l => l.n), index: 0 }, m: { sym: 'metallic', name: 'metallic', min: 0, max: 1, value: 1, step: 1 },
            ao: { sym: 'AO', name: 'ambient occlusion', min: 0, max: 1, value: 0.8, step: 0.01 }, r: { sym: 'roughness', name: 'roughness', min: 0, max: 1, value: 0.3, step: 0.01 } },
    out: [0, 1, 2, 3].map(i => ({ sym: 'RGBA'[i], f: v => LAY[v.e].f(v)[i], color: ['bad', 'good', 'ray', 'muted'][i] })),
    sub: v => `${LAY[v.e].n}: ` + LAY[v.e].ch.map((c, i) => `${'RGBA'[i]} = ${c} <b>${num(LAY[v.e].f(v)[i])}</b>`).join(' · ') + (v.e === 1 ? ' · URP reads AO from a separate occlusion map' : ''),
    draw(ctx, W, H, v, X) {
      const L = LAY[v.e], vals = L.f(v), sw = (W - 50) / 4, y = 40;
      L.ch.forEach((c, i) => { const g = Math.round(vals[i] * 255); ctx.fillStyle = `rgb(${g},${g},${g})`; ctx.fillRect(10 + i * (sw + 10), y, sw, 70); ctx.fillStyle = col(['bad', 'good', 'ray', 'muted'][i]); ctx.fillRect(10 + i * (sw + 10), y + 70, sw, 5); X.label(ctx, 'RGBA'[i] + ': ' + c, 10 + i * (sw + 10), y - 8, col('muted')); });
      const c = vals.slice(0, 3).map(x => Math.round(x * 255)); ctx.fillStyle = `rgb(${c.join(',')})`; ctx.fillRect(10, y + 100, 120, 60); X.label(ctx, 'how the packed texture looks (RGB)', 140, y + 134, col('muted'));
    },
    plot: false, size: [880, 230]
  });

  /* ---------- BC1 versus per-channel on uncorrelated data ---------- */
  function rng(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function block(v) {
    const r = rng(v.seed), pts = [];
    for (let i = 0; i < 16; i++) { const a = r(), b = r(); pts.push([a, clamp(v.c * a + (1 - v.c) * b, 0, 1)]); }
    return pts;
  }
  function bc1(pts) {
    const mx = pts.reduce((s, p) => s + p[0], 0) / 16, my = pts.reduce((s, p) => s + p[1], 0) / 16;
    let xx = 0, xy = 0, yy = 0; pts.forEach(p => { const dx = p[0] - mx, dy = p[1] - my; xx += dx * dx; xy += dx * dy; yy += dy * dy; });
    const ang = 0.5 * Math.atan2(2 * xy, xx - yy), d = [Math.cos(ang), Math.sin(ang)];
    const ts = pts.map(p => (p[0] - mx) * d[0] + (p[1] - my) * d[1]), t0 = Math.min(...ts), t1 = Math.max(...ts);
    const e0 = [mx + d[0] * t0, my + d[1] * t0], e1 = [mx + d[0] * t1, my + d[1] * t1], pal = [0, 1 / 3, 2 / 3, 1].map(k => [e0[0] + (e1[0] - e0[0]) * k, e0[1] + (e1[1] - e0[1]) * k]);
    let err = 0; const q = pts.map(p => { let best = pal[0], bd = 9; pal.forEach(c => { const dd = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2; if (dd < bd) { bd = dd; best = c; } }); err += bd; return best; });
    return { pal, q, rms: Math.sqrt(err / 32) * 255 };
  }
  function perChannel(pts) {
    let err = 0;
    [0, 1].forEach(ch => { const vs = pts.map(p => p[ch]), lo = Math.min(...vs), hi = Math.max(...vs); vs.forEach(x => { const k = hi > lo ? Math.round((x - lo) / (hi - lo) * 7) / 7 : 0; err += (lo + k * (hi - lo) - x) ** 2; }); });
    return Math.sqrt(err / 32) * 255;
  }
  A.fx('bcerror', {
    title: 'BC block of two mask channels',
    expr: 'BC1: 4 colours on one line;   BC4/BC5: 8 levels per channel;   correlation {c}',
    vars: { c: { sym: 'correlation', name: 'how much the two channels follow each other', min: 0, max: 1, value: 0.15, step: 0.01 }, seed: { sym: 'block', name: 'a different random block', min: 1, max: 30, value: 7, step: 1 } },
    out: [{ sym: 'BC1 error', f: v => bc1(block(v)).rms, color: 'bad', fmt: x => num(x) + ' / 255' }, { sym: 'per-channel error', f: v => perChannel(block(v)), color: 'good', fmt: x => num(x) + ' / 255' }],
    draw(ctx, W, H, v, X) {
      const pts = block(v), b = bc1(pts), s = Math.min(W - 60, H - 50), x0 = (W - s) / 2, y0 = 14;
      ctx.strokeStyle = col('line'); ctx.strokeRect(x0, y0, s, s);
      const P = p => [x0 + p[0] * s, y0 + (1 - p[1]) * s];
      ctx.strokeStyle = col('bad'); ctx.lineWidth = 2; ctx.beginPath(); const a = P(b.pal[0]), c = P(b.pal[3]); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
      b.pal.forEach(p => { const q = P(p); X.dot(ctx, q[0], q[1], col('bad'), 5); });
      pts.forEach((p, i) => { const q = P(p), r = P(b.q[i]); ctx.strokeStyle = alpha(col('bad'), 0.4); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(r[0], r[1]); ctx.stroke(); X.dot(ctx, q[0], q[1], col('ink'), 3); });
      X.label(ctx, 'channel R (e.g. metallic) →', x0, y0 + s + 18, col('muted')); X.label(ctx, '↑ G (AO)', x0 - 6, y0 + 10, col('muted'), 'right');
    },
    plot: { x: 'c', y: [0, 60] }
  });

  /* ---------- ASTC ---------- */
  const AB = [4, 5, 6, 8, 10, 12];
  A.fx('astc', {
    title: 'ASTC bitrate by block size',
    expr: 'bits per texel = 128 bits / ({b} texels)',
    vars: { b: { sym: 'block', name: 'block size (square)', values: AB, labels: AB.map(x => x + '×' + x), index: 2 }, s: { sym: 'size', name: 'texture size', values: [512, 1024, 2048, 4096], index: 2 } },
    out: [{ sym: 'bits per texel', f: v => 128 / (v.b * v.b), color: 'accent' }, { sym: 'MB with mips', f: v => v.s * v.s * 128 / (v.b * v.b) / 8 * 4 / 3 / 1048576, color: 'ray' }],
    plot: { x: 'b', y: [0, 9] }
  });

  /* ---------- anisotropy ---------- */
  const DEG = Math.PI / 180;
  A.fx('aniso', {
    title: 'Anisotropic filtering at a grazing angle',
    expr: 'ratio = 1 / cos {th},   remaining blur = max(1, ratio / {n})',
    vars: { th: { sym: 'θ', name: 'angle between the view and the surface normal', unit: '°', min: 0, max: 87, value: 75, step: 0.5 }, n: { sym: 'aniso', name: 'Aniso Level', values: [1, 2, 4, 8, 16], index: 2 } },
    out: [{ sym: 'footprint ratio', f: v => 1 / Math.cos(v.th * DEG), color: 'accent' }, { sym: 'remaining blur', f: v => Math.max(1, 1 / Math.cos(v.th * DEG) / v.n), color: 'bad', fmt: x => num(x) + '×' }],
    sub: v => { const r = 1 / Math.cos(v.th * DEG); return `the pixel covers a ${num(r)} : 1 strip of the texture; ${num(Math.min(v.n, Math.ceil(r)))} samples along it` + (r > v.n ? `, still ${num(r / v.n)}× blurred across` : ', no extra blur'); },
    draw(ctx, W, H, v, X) {
      const r = 1 / Math.cos(v.th * DEG), c = [W / 2, H / 2], w = 30, L = Math.min(w * r, W - 40), k = Math.min(v.n, Math.ceil(r));
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(c[0], c[1], L / 2, w / 2, 0, 0, 2 * Math.PI); ctx.stroke();
      for (let i = 0; i < k; i++) { const x = c[0] - L / 2 + (i + 0.5) * L / k; ctx.fillStyle = alpha(col('ray'), 0.5); ctx.beginPath(); ctx.arc(x, c[1], Math.max(w / 2, L / k / 2), 0, 2 * Math.PI); ctx.fill(); }
      X.label(ctx, 'orange: the pixel\'s footprint on the texture · blue: filtered samples', 10, H - 10, col('muted'));
    },
    plot: { x: 'th', logY: true, y: [1, 30] }
  });
})();
