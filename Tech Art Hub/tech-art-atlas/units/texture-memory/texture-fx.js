/* Texels on a Budget — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180, L2 = Math.log2;
  const MiB = b => b >= 1048576 ? num(b / 1048576) + ' MiB' : b >= 1024 ? num(b / 1024) + ' KiB' : num(b) + ' B';
  const dec = x => x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  const enc = x => x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  const sizes = [256, 512, 1024, 2048, 4096, 8192];
  const fmts = [32, 8, 4], fmtL = ['RGBA8 · 32 bpp', 'BC7 · 8 bpp', 'BC1 · 4 bpp'];

  A.fx('texmem', {
    title: 'Memory of one texture',
    expr: 'bytes = {w} · {w} · {bpp} / 8 · {m}',
    vars: { w: { sym: 'size', name: 'width and height in texels', values: sizes, index: 4, log: true },
            bpp: { name: 'bits per texel (format)', values: fmts, index: 0, labels: fmtL },
            m: { sym: 'mips', name: 'mip chain', values: [1, 4 / 3], index: 1, labels: ['off (× 1)', 'on (× 4/3)'] } },
    out: { sym: 'bytes', f: v => v.w * v.w * v.bpp / 8 * v.m, fmt: MiB },
    sub: v => `${v.w} · ${v.w} · ${v.bpp} / 8 · ${v.m === 1 ? '1' : '4/3'} = <b>${MiB(v.w * v.w * v.bpp / 8 * v.m)}</b>`,
    draw(ctx, W, H, v, X) {
      const maxB = 8192 * 8192 * 4 * 4 / 3, s = (W - 40) / 8192;
      // the texture as a square, scaled by size, coloured by bytes
      const side = v.w * s * 0.9; ctx.fillStyle = alpha(col('ray'), 0.25); ctx.fillRect(20, 20, side, side * 0.5); ctx.strokeStyle = col('ray'); ctx.strokeRect(20, 20, side, side * 0.5);
      X.label(ctx, `${v.w}² texels (drawn at half height)`, 20, side * 0.5 + 38, col('muted'));
      const bars = fmts.map((b, i) => [fmtL[i], v.w * v.w * b / 8 * v.m]);
      bars.forEach(([n, b], i) => { const y = H - 90 + i * 26, w = Math.max(2, Math.sqrt(b / maxB) * (W - 180)); ctx.fillStyle = b === v.w * v.w * v.bpp / 8 * v.m ? col('accent') : alpha(col('muted'), 0.5); ctx.fillRect(130, y, w, 18); X.label(ctx, n, 124, y + 13, col('muted'), 'right'); X.label(ctx, MiB(b), 136 + w, y + 13, col('ink')); });
    },
    plot: { x: 'w', logY: true, y: [1e4, 5e8] },
    note: 'Each step right on the graph is ×4: both sides double.'
  });

  A.fx('mipsum', {
    title: 'The mip chain adds a third',
    expr: 'total = 1 + 1/4 + 1/16 + … ({n} levels)',
    vars: { n: { name: 'number of mip levels', min: 1, max: 13, value: 4, step: 1 } },
    out: { sym: 'total', f: v => { let s = 0; for (let i = 0; i < v.n; i++) s += Math.pow(0.25, i); return s; } },
    sub: v => { const t = []; let s = 0; for (let i = 0; i < v.n; i++) { s += Math.pow(0.25, i); if (i < 5) t.push(i ? '1/' + Math.pow(4, i) : '1'); } return `${t.join(' + ')}${v.n > 5 ? ' + …' : ''} = <b>${num(s, 5)}</b> (limit 4/3 = 1.3333)`; },
    draw(ctx, W, H, v, X) {
      let x = 20, s = 150;
      for (let i = 0; i < v.n; i++) { const w = s / Math.pow(2, i); ctx.fillStyle = alpha(col(i ? 'accent' : 'ray'), 0.35); ctx.fillRect(x, H - 60 - w, Math.max(w, 1), Math.max(w, 1)); ctx.strokeStyle = col(i ? 'accent' : 'ray'); ctx.strokeRect(x, H - 60 - w, Math.max(w, 1), Math.max(w, 1)); if (w > 14) X.label(ctx, 'mip ' + i, x + w / 2, H - 44, col('muted'), 'center'); x += Math.max(w, 1) + 6; }
      X.label(ctx, 'each level: half the width, half the height, a quarter of the texels', 20, 30, col('muted'));
    },
    plot: { x: 'n', y: [0.9, 1.4] }
  });

  A.fx('miplevel', {
    title: 'Which mip the GPU picks',
    expr: 'ρ = {du} · {w},   λ = log₂ ρ',
    vars: { du: { sym: 'Δuv', name: 'UV change from one pixel to the next (ddx)', min: 0.00002, max: 0.05, value: 0.002, log: true },
            w: { sym: 'size', name: 'texture size', values: sizes, index: 3, log: true } },
    out: [{ sym: 'ρ', name: 'texels per pixel', f: v => v.du * v.w, color: 'ax-y' }, { sym: 'λ', name: 'mip level', f: v => Math.max(0, L2(v.du * v.w)), color: 'accent' }],
    sub: v => { const r = v.du * v.w; return `ρ = ${num(v.du)} · ${v.w} = ${num(r)} texels per pixel,   λ = log₂ ${num(r)} = ${num(L2(r))} → <b>mip ${num(Math.max(0, L2(r)))}</b>${r < 1 ? ' (below 0: the texture is magnified, mip 0 is used)' : ''}`; },
    draw(ctx, W, H, v, X) {
      // a 2×2 quad of pixels over a texel grid: pixel size in texels = ρ
      const r = v.du * v.w, lvl = Math.max(0, Math.floor(L2(Math.max(r, 1)))), px = 70, tex = px / Math.max(r, 0.02), x0 = 40, y0 = 40;
      ctx.save(); ctx.beginPath(); ctx.rect(x0 - 20, y0 - 20, 2 * px + 40, 2 * px + 40); ctx.clip();
      ctx.strokeStyle = alpha(col('muted'), 0.35); ctx.lineWidth = 1;
      if (tex >= 3) { for (let x = x0 - 20; x < x0 + 2 * px + 20; x += tex) { ctx.beginPath(); ctx.moveTo(x, y0 - 20); ctx.lineTo(x, y0 + 2 * px + 20); ctx.stroke(); } for (let y = y0 - 20; y < y0 + 2 * px + 20; y += tex) { ctx.beginPath(); ctx.moveTo(x0 - 20, y); ctx.lineTo(x0 + 2 * px + 20, y); ctx.stroke(); } }
      else { ctx.fillStyle = alpha(col('muted'), 0.2); ctx.fillRect(x0 - 20, y0 - 20, 2 * px + 40, 2 * px + 40); }
      ctx.restore();
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2.5; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) ctx.strokeRect(x0 + i * px, y0 + j * px, px, px);
      X.label(ctx, 'a 2×2 quad of pixels over the texel grid', x0 - 20, y0 + 2 * px + 40, col('muted'));
      X.label(ctx, `one pixel spans ${num(r)} texels`, x0 + 2 * px + 40, y0 + 20, col('ink'), 'left', true);
      X.label(ctx, `→ sample mip ${lvl}, where it spans ${num(r / Math.pow(2, lvl))}`, x0 + 2 * px + 40, y0 + 44, col('accent'), 'left', true);
    },
    plot: { x: 'du', y: [-1, 13] },
    note: 'The GPU uses the larger of the ddx and ddy footprints. Each doubling of ρ is one mip level further down.'
  });

  const res = [720, 1080, 1440, 2160];
  const pxPerM = v => v.H / (2 * v.d * Math.tan(v.fov / 2 * DEG));
  A.fx('density', {
    title: 'Texel density against what the screen can show',
    expr: 'screen px/m = {H} / (2 · {d} · tan({fov} / 2)),   mip ≈ log₂({rho} / screen px/m)',
    vars: { rho: { sym: 'ρ<sub>tex</sub>', name: 'texel density of the asset', unit: 'px/m', values: [128, 256, 512, 1024, 2048, 4096], index: 3, log: true },
            d: { name: 'distance to the camera', unit: 'm', min: 0.25, max: 64, value: 4, log: true },
            H: { name: 'screen height', values: res, index: 1, labels: res.map(r => r + ' px') },
            fov: { name: 'vertical field of view', unit: '°', min: 30, max: 100, value: 60, step: 1 } },
    out: [{ sym: 'screen px/m', f: pxPerM, color: 'ax-y' }, { sym: 'mip', f: v => Math.max(0, L2(v.rho / pxPerM(v))), color: 'accent' }],
    sub: v => { const p = pxPerM(v), m = L2(v.rho / p); return `${v.H} / (2 · ${num(v.d)} · ${num(Math.tan(v.fov / 2 * DEG))}) = <b>${num(p)} px/m</b>,   log₂(${v.rho} / ${num(p)}) = <b>${num(m)}</b> → ${m <= 0 ? 'the top mip is needed (or more density)' : `the top ${Math.floor(m)} mip${Math.floor(m) === 1 ? ' is' : 's are'} never seen here`}`; },
    draw(ctx, W, H, v, X) {
      const p = pxPerM(v), cam = [30, H / 2], s = Math.min(1, 300 / (v.d * 30));
      const dx = Math.min(W - 80, 30 + v.d * 30 * Math.min(1, 10 / v.d) * 2.4);
      ctx.fillStyle = alpha(col('accent'), 0.1); const half = Math.tan(v.fov / 2 * DEG) * (dx - cam[0]);
      ctx.beginPath(); ctx.moveTo(...cam); ctx.lineTo(dx, cam[1] - Math.min(half, H / 2 - 10)); ctx.lineTo(dx, cam[1] + Math.min(half, H / 2 - 10)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(dx, cam[1] - 20); ctx.lineTo(dx, cam[1] + 20); ctx.stroke();
      X.label(ctx, '1 m of wall', dx + 6, cam[1] + 4, col('ink'));
      X.dot(ctx, cam[0], cam[1], col('ink'), 6); X.label(ctx, `${num(v.d)} m`, (cam[0] + dx) / 2, cam[1] + 16, col('muted'), 'center');
      const bars = [['texture', v.rho, 'ray'], ['screen', p, 'ax-y']], mx = Math.max(v.rho, p);
      bars.forEach(([n, x, c], i) => { const y = 20 + i * 22, w = (Math.log2(x) / Math.log2(Math.max(mx, 2))) * 160; ctx.fillStyle = col(c); ctx.fillRect(W - 220, y, Math.max(2, w), 14); X.label(ctx, `${n} ${num(x)} px/m`, W - 226, y + 11, col(c), 'right'); });
    },
    plot: { x: 'd', logY: false, y: [-2, 10] },
    note: 'Animate the distance: every doubling moves one mip further down.'
  });

  A.fx('bc1', {
    title: 'A BC1 palette, in one channel',
    expr: 'palette = lerp({e0}, {e1}, i / 3),   i = round(({x} − {e0}) / ({e1} − {e0}) · 3)',
    vars: { e0: { sym: 'e₀', name: 'first endpoint', min: 0, max: 1, value: 0.2, step: 0.01 },
            e1: { sym: 'e₁', name: 'second endpoint', min: 0, max: 1, value: 0.8, step: 0.01 },
            x: { name: 'a texel\'s original value', min: 0, max: 1, value: 0.47, step: 0.005 } },
    out: [{ sym: 'decoded', f: v => { const i = clamp(Math.round((v.x - v.e0) / ((v.e1 - v.e0) || 1e-9) * 3), 0, 3); return v.e0 + (v.e1 - v.e0) * i / 3; }, color: 'accent' },
          { sym: 'error', f: v => { const i = clamp(Math.round((v.x - v.e0) / ((v.e1 - v.e0) || 1e-9) * 3), 0, 3); return Math.abs(v.x - (v.e0 + (v.e1 - v.e0) * i / 3)); }, color: 'bad' }],
    sub: v => { const i = clamp(Math.round((v.x - v.e0) / ((v.e1 - v.e0) || 1e-9) * 3), 0, 3), d = v.e0 + (v.e1 - v.e0) * i / 3; return `index <b>${i}</b> (2 bits) → decoded ${num(d)}, error ${num(Math.abs(v.x - d))}`; },
    draw(ctx, W, H, v, X) {
      const L = 30, R = W - 30, P = x => L + x * (R - L), y = 120;
      for (let px = L; px < R; px++) { const g = Math.round(enc((px - L) / (R - L)) * 255); ctx.fillStyle = `rgb(${g},${g},${g})`; ctx.fillRect(px, y - 50, 1, 20); }
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke();
      const i = clamp(Math.round((v.x - v.e0) / ((v.e1 - v.e0) || 1e-9) * 3), 0, 3);
      for (let k = 0; k < 4; k++) { const p = v.e0 + (v.e1 - v.e0) * k / 3; X.dot(ctx, P(p), y, k === i ? col('accent') : col('ink'), k === i ? 8 : 5); X.label(ctx, String(k), P(p), y + 24, k === i ? col('accent') : col('muted'), 'center', k === i); }
      X.dot(ctx, P(v.x), y - 20, col('ray'), 5); ctx.strokeStyle = col('ray'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(P(v.x), y - 20); ctx.lineTo(P(v.e0 + (v.e1 - v.e0) * i / 3), y); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, 'original', P(v.x), y - 58, col('ray'), 'center');
      X.label(ctx, 'the four palette entries; the texel stores only the index', L, H - 40, col('muted'));
      X.label(ctx, '16 texels × 2 bits + 2 endpoints × 16 bits = 64 bits per 4×4 block', L, H - 18, col('muted'));
    },
    plot: { x: 'x', y: [0, 1] },
    note: 'Animate x: the decoded value moves in four steps. Narrow endpoints mean small steps, but values outside them clamp.'
  });

  A.fx('wrongflag', {
    title: 'A data texture sampled with sRGB on',
    expr: 'read = (({s} + 0.055) / 1.055)<sup>2.4</sup>',
    vars: { s: { name: 'stored value (e.g. roughness)', min: 0, max: 1, value: 0.5, step: 0.005 } },
    out: [{ sym: 'intended', f: v => v.s, color: 'good' }, { sym: 'read', f: v => dec(v.s), color: 'bad' }],
    sub: v => `stored ${num(v.s)} → the shader reads <b>${num(dec(v.s))}</b> (${num(v.s - dec(v.s))} too low)`,
    plot: { x: 's', y: [0, 1] },
    note: 'The gap is widest in the middle, where most roughness values live.'
  });

  A.fx('packmem', {
    title: 'Separate maps against one packed map',
    expr: 'separate = 3 · {w}² · 4 / 8 · 4/3,   packed = {w}² · 8 / 8 · 4/3',
    vars: { w: { sym: 'size', name: 'texture size', values: sizes, index: 3, log: true } },
    out: [{ sym: 'separate', name: 'three BC1 maps', f: v => 3 * v.w * v.w * 4 / 8 * 4 / 3, fmt: MiB, color: 'bad' }, { sym: 'packed', name: 'one BC7 RGBA map', f: v => v.w * v.w * 8 / 8 * 4 / 3, fmt: MiB, color: 'good' }],
    sub: v => `three BC1 maps: <b>${MiB(3 * v.w * v.w / 2 * 4 / 3)}</b> and 3 samples · one packed BC7: <b>${MiB(v.w * v.w * 4 / 3)}</b> and 1 sample (with mips)`,
    draw(ctx, W, H, v, X) {
      const sw = 50; [['R', 'roughness', '#d65a5a'], ['G', 'metallic', '#5fbf6a'], ['B', 'AO', '#5a8ad6'], ['A', 'smoothness or height', '#bbbbbb']].forEach(([c, n, h], i) => { const y = 30 + i * 52; ctx.fillStyle = h; ctx.fillRect(30, y, sw, 40); X.label(ctx, c, 55, y + 26, '#111', 'center', true); X.label(ctx, n, 96, y + 25, col('ink')); });
      X.label(ctx, 'one texel = float4(r, g, b, a)', 30, H - 20, col('muted'));
    },
    plot: { x: 'w', logY: true, y: [1e4, 2e8] }
  });

  A.fx('nz', {
    title: 'Rebuilding Z from the two stored channels',
    expr: 'x = {r} · 2 − 1,   y = {g} · 2 − 1,   z = √(1 − x² − y²)',
    vars: { r: { name: 'stored red (X)', min: 0, max: 1, value: 0.7, step: 0.005 }, g: { name: 'stored green (Y)', min: 0, max: 1, value: 0.5, step: 0.005 } },
    out: [{ sym: 'z', f: v => { const x = v.r * 2 - 1, y = v.g * 2 - 1; return Math.sqrt(clamp(1 - x * x - y * y, 0, 1)); }, color: 'ax-z' }],
    sub: v => { const x = v.r * 2 - 1, y = v.g * 2 - 1, q = 1 - x * x - y * y; return `x = ${num(x)},  y = ${num(y)},  z = √(1 − ${num(x * x)} − ${num(y * y)}) = <b>${num(Math.sqrt(clamp(q, 0, 1)))}</b>${q < 0 ? ' (saturate clamps a negative value to 0)' : ''}`; },
    draw(ctx, W, H, v, X) {
      const x = v.r * 2 - 1, y = v.g * 2 - 1, z = Math.sqrt(clamp(1 - x * x - y * y, 0, 1));
      const c = [W / 2 - 40, H - 50], s = 120;
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(c[0], c[1], s, Math.PI, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(c[0] - s - 10, c[1]); ctx.lineTo(c[0] + s + 10, c[1]); ctx.stroke();
      X.label(ctx, 'surface', c[0] + s + 12, c[1] + 4, col('muted'));
      // side view in the x-z plane
      X.arrow(ctx, c[0], c[1], c[0] + x * s, c[1] - z * s, col('accent'), 3);
      ctx.setLineDash([3, 3]); ctx.strokeStyle = col('ax-x'); ctx.beginPath(); ctx.moveTo(c[0] + x * s, c[1]); ctx.lineTo(c[0] + x * s, c[1] - z * s); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, 'x', c[0] + x * s / 2, c[1] + 16, col('ax-x'), 'center', true); X.label(ctx, 'z', c[0] + x * s + 8, c[1] - z * s / 2, col('ax-z'), 'left', true);
      ctx.fillStyle = `rgb(${Math.round(v.r * 255)},${Math.round(v.g * 255)},${Math.round((z * 0.5 + 0.5) * 255)})`; ctx.fillRect(W - 90, 20, 70, 70); ctx.strokeStyle = col('line'); ctx.strokeRect(W - 90, 20, 70, 70);
      X.label(ctx, 'texel colour', W - 55, 106, col('muted'), 'center');
      X.label(ctx, 'side view (x and z; y not shown)', 20, 20, col('muted'));
    },
    plot: { x: 'r', y: [0, 1] }
  });

  A.fx('stream', {
    title: 'Leaving out the top mips',
    expr: 'resident = {w}² · 8 / 8 · 4/3 / 4<sup>{k}</sup>',
    vars: { w: { sym: 'size', name: 'texture size', values: sizes, index: 4, log: true }, k: { name: 'top mips not loaded', min: 0, max: 4, value: 1, step: 1 } },
    out: { sym: 'resident', f: v => v.w * v.w * 4 / 3 / Math.pow(4, v.k), fmt: MiB },
    sub: v => `${MiB(v.w * v.w * 4 / 3)} / ${Math.pow(4, v.k)} = <b>${MiB(v.w * v.w * 4 / 3 / Math.pow(4, v.k))}</b> resident, effectively a ${v.w / Math.pow(2, v.k)}² texture`,
    plot: { x: 'k', logY: true, y: [1e4, 2e8] },
    note: 'BC7 at 8 bpp. Streaming one mip down saves 75% of that texture.'
  });
})();
