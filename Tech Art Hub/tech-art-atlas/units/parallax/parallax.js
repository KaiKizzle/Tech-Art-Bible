/* Parallax and POM — live formulas, all in a side view: u across, depth downward */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180;
  /* depth map along u: bricks with mortar gaps and a gentle bump on each brick */
  const depthAt = u => { const f = ((u * 1.6) % 1 + 1) % 1; if (f < 0.12) return 0.85; const b = Math.sin((f - 0.12) / 0.88 * Math.PI); return 0.42 - 0.32 * b; };
  const rayU = (v, z) => v.u + Math.tan(v.th * DEG) * v.s * z;
  function trueHit(v) { for (let z = 0; z <= 1; z += 0.0005) { if (z >= depthAt(rayU(v, z))) return { z, u: rayU(v, z) }; } return { z: 1, u: rayU(v, 1) }; }
  function steep(v) { const pts = []; let i = 0; for (; i <= v.n; i++) { const z = i / v.n, u = rayU(v, z), d = depthAt(u); pts.push([u, z, d]); if (z >= d) break; } return pts; }
  function pom(v) { const p = steep(v); if (p.length < 2) return { u: p[0][0], z: p[0][1], pts: p }; const [ui, zi, di] = p[p.length - 1], [up, zp, dp] = p[p.length - 2]; const after = di - zi, before = dp - zp, w = after / (after - before); return { u: ui * (1 - w) + up * w, z: zi * (1 - w) + zp * w, w, pts: p }; }

  function scene(ctx, W, H, v, X, opt = {}) {
    const L = 20, R = W - 20, top = 50, k = (H - 100) / v.s, u0 = v.u - 60 / k, u1 = u0 + (R - L) / k, PU = u => L + (u - u0) * k, PZ = z => top + z * v.s * k;
    ctx.fillStyle = alpha(col('accent'), 0.18); ctx.beginPath(); ctx.moveTo(PU(u0), PZ(1.05));
    for (let u = u0; u <= u1; u += 0.005) ctx.lineTo(PU(u), PZ(depthAt(u))); ctx.lineTo(PU(u1), PZ(1.05)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = col('accent'); ctx.lineWidth = 1.5; ctx.beginPath(); for (let u = u0; u <= u1; u += 0.005) { const p = [PU(u), PZ(depthAt(u))]; u === u0 ? ctx.moveTo(...p) : ctx.lineTo(...p); } ctx.stroke();
    ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L, top); ctx.lineTo(R, top); ctx.stroke(); X.label(ctx, 'flat surface (what the mesh really is)', L, top - 10, col('muted'));
    // sightline
    const zEnd = 1.05, e = [PU(rayU(v, zEnd)), PZ(zEnd)], s0 = [PU(v.u), top];
    const back = [s0[0] - (e[0] - s0[0]) * 0.35, s0[1] - (e[1] - s0[1]) * 0.35];
    ctx.strokeStyle = alpha(col('ray'), 0.8); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(...back); ctx.lineTo(...e); ctx.stroke();
    X.label(ctx, 'from the camera', back[0] + 4, back[1] + 10, col('ray'));
    X.dot(ctx, ...s0, col('ink'), 4);
    if (opt.truth !== false) { const t = trueHit(v); X.dot(ctx, PU(t.u), PZ(t.z), col('good'), 6); X.label(ctx, 'true hit', PU(t.u) + 8, PZ(t.z) + 12, col('good')); }
    return { PU, PZ, top, L, R };
  }
  const baseVars = () => ({ u: { name: 'pixel position across the texture', min: 0.05, max: 1.6, value: 0.5, step: 0.005 },
    th: { sym: 'θ', name: 'view angle from the normal', unit: '°', min: 0, max: 80, value: 55, step: 1 },
    s: { sym: 'scale', name: 'height scale (depth of the relief)', min: 0.05, max: 0.6, value: 0.3, step: 0.01 } });

  A.fx('shift', {
    title: 'Sideways shift per unit of depth',
    expr: 'shift = tan {th} = |V.xy| / V.z',
    vars: { th: { sym: 'θ', name: 'view angle from the normal', unit: '°', min: 0, max: 85, value: 45, step: 1 } },
    out: { sym: 'shift', f: v => Math.tan(v.th * DEG) },
    draw(ctx, W, H, v, X) {
      const c = [W / 2 - 60, 80], d = 120, t = Math.tan(v.th * DEG);
      ctx.fillStyle = alpha(col('accent'), 0.12); ctx.fillRect(20, c[1], W - 40, d); ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(20, c[1]); ctx.lineTo(W - 20, c[1]); ctx.stroke();
      const e = [c[0] + t * d, c[1] + d]; ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c[0] - t * 60, c[1] - 60); ctx.lineTo(Math.min(e[0], W + 200), e[1]); ctx.stroke();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = col('muted'); ctx.beginPath(); ctx.moveTo(c[0], c[1] - 60); ctx.lineTo(c[0], c[1] + d); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c[0], c[1] + d); ctx.lineTo(Math.min(e[0], W - 10), c[1] + d); ctx.stroke();
      X.label(ctx, 'normal', c[0] + 4, c[1] - 52, col('muted')); X.label(ctx, 'one unit deep', 24, c[1] + d / 2, col('muted'));
      X.label(ctx, `shift ${num(t)}`, Math.min((c[0] + e[0]) / 2, W - 60), c[1] + d + 16, col('accent'), 'center', true);
    },
    plot: { x: 'th', y: [0, 12] }
  });

  A.fx('offset', {
    title: 'Offset parallax: one sample',
    expr: 'uv′ = {u} + tan {th} · {s} · depth({u})',
    vars: Object.assign(baseVars(), { lim: { name: 'offset limiting', values: [0, 1], labels: ['off', 'on'] } }),
    out: [{ sym: 'uv′', f: v => v.u + (v.lim ? Math.sin(v.th * DEG) : Math.tan(v.th * DEG)) * v.s * depthAt(v.u), color: 'accent' }, { sym: 'true', f: v => trueHit(v).u, color: 'good' }],
    sub: v => { const g = v.u + (v.lim ? Math.sin(v.th * DEG) : Math.tan(v.th * DEG)) * v.s * depthAt(v.u), t = trueHit(v).u; return `depth(${num(v.u)}) = ${num(depthAt(v.u))} → uv′ = <b>${num(g)}</b>, true hit at ${num(t)}, error <b>${num(Math.abs(g - t))}</b>`; },
    draw(ctx, W, H, v, X) {
      const g = scene(ctx, W, H, v, X), uO = v.u + (v.lim ? Math.sin(v.th * DEG) : Math.tan(v.th * DEG)) * v.s * depthAt(v.u);
      ctx.setLineDash([3, 3]); ctx.strokeStyle = col('bad'); ctx.beginPath(); ctx.moveTo(g.PU(v.u), g.top); ctx.lineTo(g.PU(v.u), g.PZ(depthAt(v.u))); ctx.stroke(); ctx.setLineDash([]);
      X.dot(ctx, g.PU(uO), g.PZ(depthAt(v.u)), col('bad'), 6); X.label(ctx, 'guess', g.PU(uO) + 8, g.PZ(depthAt(v.u)) - 10, col('bad'), 'left', true);
    },
    plot: { x: 'th', y: [0, 3] }
  });

  A.fx('steep', {
    title: 'Steep parallax: marching in layers',
    expr: 'layer<sub>i</sub> = i / {n},   stop when layer<sub>i</sub> ≥ depth(uv<sub>i</sub>)',
    vars: Object.assign({ n: { sym: 'N', name: 'layers', min: 2, max: 48, value: 8, step: 1 } }, baseVars()),
    out: [{ sym: 'uv<sub>hit</sub>', f: v => { const p = steep(v); return p[p.length - 1][0]; }, color: 'accent' }, { sym: 'true', f: v => trueHit(v).u, color: 'good' }],
    sub: v => { const p = steep(v); return `stopped at layer <b>${p.length - 1}</b> of ${v.n} after ${p.length} texture samples, error ${num(Math.abs(p[p.length - 1][0] - trueHit(v).u))}`; },
    draw(ctx, W, H, v, X) {
      const g = scene(ctx, W, H, v, X), p = steep(v);
      for (let i = 0; i <= v.n; i++) { ctx.strokeStyle = alpha(col('muted'), 0.25); ctx.beginPath(); ctx.moveTo(g.L, g.PZ(i / v.n)); ctx.lineTo(g.R, g.PZ(i / v.n)); ctx.stroke(); }
      p.forEach(([u, z, d], i) => X.dot(ctx, g.PU(u), g.PZ(z), i === p.length - 1 ? col('bad') : col('ray'), i === p.length - 1 ? 6 : 4));
    },
    plot: { x: 'n', y: [0, 2] }
  });

  A.fx('pom', {
    title: 'POM: interpolating the last two layers',
    expr: 'w = after / (after − before),   uv = lerp(uv<sub>i</sub>, uv<sub>i−1</sub>, w),   {n} layers',
    vars: Object.assign({ n: { sym: 'N', name: 'layers', min: 2, max: 48, value: 8, step: 1 } }, baseVars()),
    out: [{ sym: 'error steep', f: v => { const p = steep(v); return Math.abs(p[p.length - 1][0] - trueHit(v).u); }, color: 'bad' }, { sym: 'error POM', f: v => Math.abs(pom(v).u - trueHit(v).u), color: 'accent' }],
    sub: v => { const q = pom(v); return q.w == null ? 'stopped on the first sample' : `w = <b>${num(q.w)}</b> → uv = <b>${num(q.u)}</b>, true hit ${num(trueHit(v).u)}`; },
    draw(ctx, W, H, v, X) {
      const g = scene(ctx, W, H, v, X), q = pom(v), p = q.pts;
      p.forEach(([u, z], i) => X.dot(ctx, g.PU(u), g.PZ(z), col('ray'), 3.5));
      if (p.length >= 2) { const [ui, , di] = p[p.length - 1], [up, , dp] = p[p.length - 2]; ctx.strokeStyle = col('bad'); ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(g.PU(up), g.PZ(dp)); ctx.lineTo(g.PU(ui), g.PZ(di)); ctx.stroke(); ctx.setLineDash([]); }
      X.dot(ctx, g.PU(q.u), g.PZ(q.z), col('accent'), 6); X.label(ctx, 'POM', g.PU(q.u) - 8, g.PZ(q.z) - 10, col('accent'), 'right', true);
      X.label(ctx, 'red dashes: the height between the two samples, taken as a straight line', g.L, H - 14, col('muted'));
    },
    plot: { x: 'n', y: [0, 0.5] },
    note: 'Animate N: POM with 8 layers is often as close as steep parallax with 32.'
  });

  A.fx('adaptive', {
    title: 'Layers by viewing angle',
    expr: 'N = lerp({mx}, {mn}, |cos {th}|),   fetches ≈ N',
    vars: { th: { sym: 'θ', name: 'view angle from the normal', unit: '°', min: 0, max: 89, value: 60, step: 1 }, mn: { sym: 'min', name: 'layers seen straight on', min: 2, max: 16, value: 8, step: 1 },
            mx: { sym: 'max', name: 'layers at grazing angles', min: 8, max: 96, value: 32, step: 1 } },
    out: { sym: 'N', f: v => Math.round(v.mx + (v.mn - v.mx) * Math.abs(Math.cos(v.th * DEG))) },
    plot: { x: 'th', y: [0, 100] }
  });

  function shadowAt(v) {
    const t = trueHit(v), dirU = -Math.tan(v.la * DEG) * v.s; let mx = 0; const pts = [];
    for (let i = 1; i <= 12; i++) { const z = t.z * (1 - i / 12), u = t.u + dirU * (t.z - z) / v.s * v.s; const uu = t.u - Math.tan(v.la * DEG) * v.s * (t.z - z); const h = z - depthAt(uu); pts.push([uu, z, h]); mx = Math.max(mx, h); }
    return { t, pts, sh: clamp(1 - mx * v.k, 0, 1) };
  }
  A.fx('pomshadow', {
    title: 'Self-shadow: marching toward the light',
    expr: 'shadow = 1 − {k} · max<sub>j</sub>(layer<sub>j</sub> − depth(uv<sub>j</sub>)),   light at {la}',
    vars: Object.assign(baseVars(), { la: { sym: 'θ<sub>L</sub>', name: 'light angle from the normal', unit: '°', min: 0, max: 85, value: 65, step: 1 }, k: { name: 'softness (higher = harder)', min: 1, max: 30, value: 8, step: 0.5 } }),
    out: { sym: 'lit', f: v => shadowAt(v).sh },
    draw(ctx, W, H, v, X) {
      const g = scene(ctx, W, H, v, X), q = shadowAt(v);
      q.pts.forEach(([u, z, h]) => X.dot(ctx, g.PU(u), g.PZ(z), h > 0 ? col('bad') : alpha(col('accent'), 0.9), 3.5));
      const L0 = q.pts[q.pts.length - 1]; X.label(ctx, '☀', g.PU(L0[0]) - 10, g.top - 26, col('accent'), 'center', true);
      X.label(ctx, `lit ${Math.round(q.sh * 100)}%`, g.PU(q.t.u) + 10, g.PZ(q.t.z) + 26, col('ink'), 'left', true);
      X.label(ctx, 'red: samples below the height field (blocking)', g.L, H - 14, col('muted'));
    },
    plot: { x: 'la', y: [0, 1] }
  });

  A.fx('pdo', {
    title: 'Pixel depth offset',
    expr: 'extra depth = depth<sub>hit</sub> · {s} · {sz} / cos {th}',
    vars: { th: { sym: 'θ', name: 'view angle from the normal', unit: '°', min: 0, max: 80, value: 40, step: 1 }, s: { sym: 'h', name: 'hit depth found by POM (0 to 1)', min: 0, max: 1, value: 0.6, step: 0.01 },
            sz: { sym: 'height', name: 'relief depth in world units', unit: 'cm', min: 0.5, max: 20, value: 4, step: 0.1 } },
    out: { sym: 'offset', unit: 'cm', f: v => v.s * v.sz / Math.cos(v.th * DEG) },
    plot: { x: 'th', y: [0, 40] },
    note: 'The offset is measured along the view ray; Unreal and HDRP convert it to depth for you.'
  });
})();
