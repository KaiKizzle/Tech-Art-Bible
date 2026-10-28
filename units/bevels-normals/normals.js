/* Bevels and Custom Normals — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num, clamp } = A;
  const ppm = v => v.H / (2 * v.d * Math.tan((v.fov || 60) * Math.PI / 360));   // pixels per metre at distance d

  /* ---------- how wide a rounded edge is on screen ---------- */
  const hw = v => v.r / 1000 * Math.SQRT2 * ppm(v);
  A.fx('highlight', {
    title: 'Width of a rounded edge on screen',
    expr: 'width ≈ {r} · √2 · {H} / (2 · {d} · tan({fov}/2))',
    vars: { r: { sym: 'r', name: 'bevel radius', unit: 'mm', min: 0.5, max: 50, value: 4, log: true },
            d: { sym: 'd', name: 'camera distance', unit: 'm', min: 0.3, max: 50, value: 3, log: true },
            fov: { sym: 'fov', name: 'vertical field of view', unit: '°', min: 30, max: 100, value: 60, step: 1 },
            H: { sym: 'H', name: 'screen height', unit: 'px', values: [720, 1080, 1440, 2160], index: 1 } },
    out: { sym: 'width', unit: 'px', f: hw },
    sub: (v, n) => { const w = hw(v); return `the rounded zone of a 90° edge is about <b>${n(w)} px</b> wide here. ${w < 1 ? 'Under a pixel it cannot hold a highlight: it shimmers or disappears, and the edge reads as sharp anyway.' : w < 3 ? 'One to three pixels is where a bevel reads as a thin bright line, the typical game-asset look.' : 'Wide enough to show the shape of the rounding, not just a line.'}`; },
    plot: { x: 'd', logY: true }
  });

  /* ---------- a chamfered box ---------- */
  const cv = s => 4 * (s + 1) * (s + 2), ct = s => 12 + 24 * s + 8 * s * s;
  A.fx('chamfer', {
    title: 'A box with rounded edges against a hard-edged box with a normal map',
    expr: 'vertices = 4({s} + 1)({s} + 2),   triangles = 12 + 24{s} + 8{s}²,   hard box: 24 and 12',
    vars: { s: { sym: 's', name: 'chamfer segments per edge', min: 1, max: 6, value: 1, step: 1 },
            b: { sym: 'b', name: 'bytes per vertex', values: [28, 36, 44], index: 1 },
            res: { sym: 'res', name: 'unique normal map the hard box would need instead', unit: 'px', values: [256, 512, 1024, 2048], index: 1 },
            N: { sym: 'N', name: 'different assets of this kind', min: 1, max: 500, value: 50, log: true } },
    out: [{ sym: 'extra vertex data', unit: 'KB', f: v => v.N * (cv(v.s) - 24) * v.b / 1024, color: 'accent' },
          { sym: 'normal maps (BC5 + mips)', unit: 'KB', f: v => v.N * v.res * v.res * 4 / 3 / 1024, color: 'bad' }],
    sub: (v, n) => `<b>${cv(v.s)}</b> vertices and <b>${ct(v.s)}</b> triangles for ${v.s} segment${v.s > 1 ? 's' : ''}. A single chamfer costs <b>no extra vertices</b> over the hard box: the hard box splits every corner into 3 vertices for its 3 normals, the chamfered box needs the same 24 with smooth normals. For ${num(Math.round(v.N))} assets the extra vertices take ${n(v.N * (cv(v.s) - 24) * v.b / 1024)} KB, the unique normal maps ${n(v.N * v.res * v.res * 4 / 3 / 1024 / 1024)} MB`,
    draw(ctx, W, H, v, X) {
      const s = v.s, cx = W / 2, cy = H / 2 + 6, R = Math.min(W, H) * 0.36, c = R * 0.28;
      // cross-section of a rounded square: straight sides and s-segment arcs at the corners
      const pts = [];
      const corner = (ccx, ccy, a0) => { for (let i = 0; i <= s; i++) { const a = a0 + i / s * Math.PI / 2; pts.push([ccx + Math.cos(a) * c, ccy + Math.sin(a) * c]); } };
      corner(cx + R - c, cy + R - c, 0); corner(cx - R + c, cy + R - c, Math.PI / 2); corner(cx - R + c, cy - R + c, Math.PI); corner(cx + R - c, cy - R + c, Math.PI * 1.5);
      ctx.fillStyle = alpha(col('accent'), 0.12); ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col('accent'); pts.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, 7); ctx.fill(); });
      X.label(ctx, 'dots: vertices, one smooth normal each', 10, H - 10, col('muted'));
    },
    plot: { x: 'N', logY: true }, size: [300, 260]
  });

  /* ---------- face-weighted normals ---------- */
  const tiltAvg = v => v.th / 4;
  const tiltArea = v => Math.atan2(v.c * Math.sin(v.th / 2 * Math.PI / 180), v.L + v.c * Math.cos(v.th / 2 * Math.PI / 180)) * 180 / Math.PI;
  const tilt = v => v.m === 0 ? tiltAvg(v) : tiltArea(v);
  A.fx('fwn', {
    title: 'Vertex normal at the edge of a large face: averaged or area-weighted',
    expr: 'n = normalize(Σ w<sub>f</sub> n<sub>f</sub>),   w<sub>f</sub> = 1 or face size,   tilt = atan({c} sin({th}/2) / ({L} + {c} cos({th}/2)))',
    vars: { L: { sym: 'L', name: 'width of the large face', unit: 'cm', min: 5, max: 200, value: 50, log: true },
            c: { sym: 'c', name: 'width of the chamfer', unit: 'cm', min: 0.2, max: 10, value: 1, log: true },
            th: { sym: 'θ', name: 'angle the surface turns at the edge', unit: '°', min: 20, max: 120, value: 90, step: 1 },
            m: { sym: 'weights', name: 'weighting', values: [0, 1], labels: ['plain average', 'by face size'], index: 1 } },
    out: [{ sym: 'tilt, average', unit: '°', f: tiltAvg, color: 'bad' }, { sym: 'tilt, area-weighted', unit: '°', f: tiltArea, color: 'accent' }],
    sub: (v, n) => `the normal at the edge of the large face tilts <b>${n(tilt(v))}°</b> away from the face. Interpolated across the face, ${v.m === 0 ? 'that tilt becomes a visible gradient: the flat face shades like a curved one and needs a normal map to correct it' : 'the tiny tilt keeps the face flat, and the chamfer carries the whole bend: a clean highlight without a normal map'}`,
    draw(ctx, W, H, v, X) {
      const sx = W - 30, sy = 40, s = Math.min((W - 60) / v.L, 6);
      const L = v.L * s, c = Math.max(v.c * s, 6), th = v.th * Math.PI / 180;
      const p0 = [sx - L, sy + 20], p1 = [sx, sy + 20];                               // large face (top), drawn right to left
      const p2 = [p1[0] + Math.cos(th / 2) * c, p1[1] + Math.sin(th / 2) * c];          // chamfer
      const p3 = [p2[0] + Math.cos(th) * 60, p2[1] + Math.sin(th) * 60];                // side face
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(Math.min(p3[0], W - 4), p3[1]); ctx.stroke();
      const t = tilt(v) * Math.PI / 180, len = 46;
      const nArrow = (p, a, c2) => { ctx.strokeStyle = c2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + Math.sin(a) * len, p[1] - Math.cos(a) * len); ctx.stroke(); };
      nArrow(p1, t, col(v.m === 0 ? 'bad' : 'accent'));
      nArrow(p0, -t, col(v.m === 0 ? 'bad' : 'accent'));
      for (let i = 1; i < 6; i++) { const f = i / 6, p = [p0[0] + (p1[0] - p0[0]) * f, p0[1]]; nArrow(p, -t + 2 * t * f, alpha(col('muted'), 0.7)); }
      X.label(ctx, 'normals across the large face', 10, H - 10, col('muted'));
    },
    plot: { x: 'c', y: [0, 35] }, size: [320, 200]
  });

  /* ---------- mid-poly memory ---------- */
  A.fx('midpoly', {
    title: 'Unique normal maps against chamfers with weighted normals',
    expr: 'baked = {N} · {res}² · 1 B · 4/3,   mid-poly = {N} · {dv} · {b} B',
    vars: { N: { sym: 'N', name: 'hard-surface assets in the level', min: 10, max: 2000, value: 300, log: true },
            res: { sym: 'res', name: 'unique normal map per asset (BC5)', unit: 'px', values: [512, 1024, 2048], index: 1 },
            dv: { sym: 'ΔV', name: 'extra vertices per asset from chamfers', min: 0, max: 20000, value: 1500, step: 100 },
            b: { sym: 'b', name: 'bytes per vertex', values: [28, 36, 44], index: 1 } },
    out: [{ sym: 'baked normal maps', unit: 'MB', f: v => v.N * v.res * v.res * 4 / 3 / 1048576, color: 'bad' },
          { sym: 'extra vertices', unit: 'MB', f: v => v.N * v.dv * v.b / 1048576, color: 'accent' }],
    sub: (v, n) => `unique normal maps: <b>${n(v.N * v.res * v.res * 4 / 3 / 1048576)} MB</b>; the extra chamfer vertices: <b>${n(v.N * v.dv * v.b / 1048576)} MB</b>. Mid-poly assets still need a tiling material or trims for their surface detail, and their UVs can overlap freely because nothing unique is baked`,
    plot: { x: 'dv' }
  });

  /* ---------- baked bevel width in texels ---------- */
  const tex0 = v => v.r / 1000 * Math.PI / 2 * v.D;
  const mipAt = v => Math.max(0, Math.log2(v.D / (v.H / (2 * v.d * Math.tan(Math.PI / 6)))));
  A.fx('bakedpx', {
    title: 'A baked bevel in texels, at the mip the GPU reads',
    expr: 'texels = {r} · π/2 · {D},   mip at {d} m = log₂({D} / pixels per metre),   texels at that mip = texels / 2<sup>mip</sup>',
    vars: { r: { sym: 'r', name: 'bevel radius', unit: 'mm', min: 0.5, max: 30, value: 3, log: true },
            D: { sym: 'D', name: 'texel density', unit: 'px/m', values: [256, 512, 1024, 2048], index: 2 },
            d: { sym: 'd', name: 'camera distance', unit: 'm', min: 0.5, max: 60, value: 5, log: true },
            H: { sym: 'H', name: 'screen height (60° field of view)', unit: 'px', values: [1080, 2160], index: 0 } },
    out: [{ sym: 'texels at mip 0', f: tex0, color: 'ray' }, { sym: 'texels at the used mip', f: v => tex0(v) / Math.pow(2, Math.floor(mipAt(v))), color: 'accent' }],
    sub: (v, n) => { const t = tex0(v) / Math.pow(2, Math.floor(mipAt(v))); return `the bevel is <b>${n(tex0(v))}</b> texels wide in the full texture; at ${n(v.d)} m the GPU reads mip ${Math.floor(mipAt(v))}, where it is <b>${n(t)}</b> texels. ${t < 2 ? 'Below about two texels the gradient is averaged away (and block compression blurs it further): the baked bevel vanishes at this distance.' : 'Enough texels to keep the gradient.'}`; },
    plot: { x: 'd', logY: true }
  });
})();
