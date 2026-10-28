/* Texture and Cell Bombing — live formulas.
   The pictures sample a small procedural pebble texture with wrap and bilinear filtering, pixel by pixel,
   with the same maths a shader uses. */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num, clamp } = A;

  /* ---------- a 64 × 64 tileable pebble texture with one red marker pebble ---------- */
  const N = 64, TEX = new Float32Array(N * N * 3);
  (function build() {
    let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const peb = []; for (let i = 0; i < 24; i++) { const k = 0.55 + rnd() * 0.6; peb.push({ x: rnd() * N, y: rnd() * N, r: 3.5 + rnd() * 5.5, e: 0.7 + rnd() * 0.5, c: [0.52 * k, 0.47 * k, 0.4 * k] }); }
    peb.push({ x: 20, y: 40, r: 6.5, e: 1, c: [0.72, 0.17, 0.08] });
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let c = [0.25, 0.21, 0.16], best = 1e9;
      for (const p of peb) { let dx = Math.abs(x + 0.5 - p.x), dy = Math.abs(y + 0.5 - p.y); dx = Math.min(dx, N - dx); dy = Math.min(dy, N - dy); const d = Math.hypot(dx, dy * p.e) / p.r;
        if (d < 1 && d < best) { best = d; const sh = 0.7 + 0.45 * (1 - d * d); c = [p.c[0] * sh, p.c[1] * sh, p.c[2] * sh]; if (d > 0.82) c = c.map(q => q * 0.5); } }
      const g = 0.9 + 0.2 * rnd(); TEX.set([c[0] * g, c[1] * g, c[2] * g], (y * N + x) * 3);
    }
  })();
  function tex(u, v, out) {   // bilinear, repeat
    const x = u * N - 0.5, y = v * N - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const i = (a, b) => ((((b % N) + N) % N) * N + (((a % N) + N) % N)) * 3;
    const a = i(x0, y0), b = i(x0 + 1, y0), c = i(x0, y0 + 1), d = i(x0 + 1, y0 + 1);
    for (let k = 0; k < 3; k++) out[k] = (TEX[a + k] * (1 - fx) + TEX[b + k] * fx) * (1 - fy) + (TEX[c + k] * (1 - fx) + TEX[d + k] * fx) * fy;
    return out;
  }
  const fr = x => x - Math.floor(x);
  const h2 = (x, y, k) => fr(Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453);
  const ss = (a, b, x) => { const t = clamp((x - a) / Math.max(b - a, 1e-6), 0, 1); return t * t * (3 - 2 * t); };

  function paint(ctx, W, H, tiles, shade) {
    const img = ctx.createImageData(W, H), d = img.data, c = [0, 0, 0];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      shade((x + 0.5) / W * tiles, (y + 0.5) / W * tiles, c);
      const o = (y * W + x) * 4; d[o] = Math.min(255, c[0] * 255); d[o + 1] = Math.min(255, c[1] * 255); d[o + 2] = Math.min(255, c[2] * 255); d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  /* canvases from fig() are scaled for the device; draw into an offscreen image of the logical size */
  function blit(ctx, W, H, tiles, shade) {
    const w = Math.round(W), h = Math.round(H), off = document.createElement('canvas'); off.width = w; off.height = h;
    paint(off.getContext('2d'), w, h, tiles, shade); ctx.drawImage(off, 0, 0, W, H);
  }

  /* ---------- how many repeats are on screen ---------- */
  A.fx('repeat', {
    title: 'Repeats of a tiling texture in view',
    expr: 'tiles across = {W} / {T},   repeats in view ≈ ({W} / {T})²',
    vars: { T: { sym: 'T', name: 'size of one tile in the world', unit: 'm', min: 0.5, max: 8, value: 2, log: true },
            W: { sym: 'W', name: 'width of the surface in view', unit: 'm', min: 2, max: 60, value: 12, log: true } },
    out: { sym: 'repeats', f: v => Math.pow(v.W / v.T, 2) },
    sub: (v, n) => `about <b>${num(Math.round(Math.pow(v.W / v.T, 2)))}</b> copies of the same tile in view. The eye finds the pattern from a handful of copies once a feature stands out (the red pebble here), and the grid of copies is what gives tiling away, not any single tile`,
    draw(ctx, W, H, v) { const tiles = Math.min(v.W / v.T, 24); blit(ctx, W, H, tiles, (u, w, c) => tex(u, w, c)); },
    plot: { x: 'W', logY: true }, size: [300, 220]
  });

  /* ---------- random offset per cell, blended (Quilez technique 1) ---------- */
  function offsetShade(b, mirror) {
    const ca = [0, 0, 0], cb = [0, 0, 0], cc = [0, 0, 0], cd = [0, 0, 0];
    return (u, w, c) => {
      const iu = Math.floor(u), iv = Math.floor(w), fu = u - iu, fv = w - iv;
      const S = (ix, iy, out) => { let uu = u, vv = w; if (mirror) { if (h2(ix, iy, 3) > 0.5) uu = -uu; if (h2(ix, iy, 4) > 0.5) vv = -vv; } return tex(uu + h2(ix, iy, 1), vv + h2(ix, iy, 2), out); };
      if (b <= 0.001) { S(fu < 0.5 ? iu : iu + 1, fv < 0.5 ? iv : iv + 1, c); return c; }
      S(iu, iv, ca); S(iu + 1, iv, cb); S(iu, iv + 1, cc); S(iu + 1, iv + 1, cd);
      const bx = ss(0.5 - b / 2, 0.5 + b / 2, fu), by = ss(0.5 - b / 2, 0.5 + b / 2, fv);
      for (let k = 0; k < 3; k++) c[k] = (ca[k] * (1 - bx) + cb[k] * bx) * (1 - by) + (cc[k] * (1 - bx) + cd[k] * bx) * by;
      return c;
    };
  }
  A.fx('offset', {
    title: 'Random offset per cell, blended at the borders',
    expr: 'cell = ⌊uv⌋,   offset = hash(cell),   blend = smoothstep(0.5 − {b}/2, 0.5 + {b}/2, fract(uv)),   samples = {b} > 0 ? 4 : 1',
    vars: { b: { sym: 'b', name: 'width of the blend between cells', min: 0, max: 1, value: 0.5, step: 0.05 },
            m: { sym: 'mirror', name: 'random mirroring per cell', values: [0, 1], labels: ['off', 'on'], index: 0 },
            t: { sym: 'tiles', name: 'cells across the picture', values: [3, 6, 10], index: 1 } },
    out: { sym: 'samples per map', f: v => v.b > 0.001 ? 4 : 1 },
    sub: (v, n) => v.b > 0.001 ? `each pixel reads the texture with the offsets of the four nearest cells and blends them: <b>4 samples</b> per map. Wider blends hide the borders better but blur and wash out the texture where several samples mix` : `without blending each pixel reads one cell: 1 sample, but every cell border is a hard seam where the pattern breaks`,
    draw(ctx, W, H, v) { blit(ctx, W, H, v.t, offsetShade(v.b, v.m)); },
    plot: false, size: [320, 240]
  });

  /* ---------- Voronoi cell bombing (Quilez technique 2) ---------- */
  function voronoiShade(k) {
    const s = [0, 0, 0];
    return (u, w, c) => {
      const iu = Math.floor(u), iv = Math.floor(w), fu = u - iu, fv = w - iv; let wt = 0; c[0] = c[1] = c[2] = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = iu + i, cy = iv + j, ox = h2(cx, cy, 5), oy = h2(cx, cy, 6);
        const rx = i - fu + ox, ry = j - fv + oy, d = rx * rx + ry * ry, ww = Math.exp(-k * d);
        tex(u + h2(cx, cy, 7), w + h2(cx, cy, 8), s); c[0] += s[0] * ww; c[1] += s[1] * ww; c[2] += s[2] * ww; wt += ww;
      }
      c[0] /= wt; c[1] /= wt; c[2] /= wt; return c;
    };
  }
  A.fx('voronoi', {
    title: 'Cell bombing: each Voronoi cell gets its own offset',
    expr: 'w<sub>i</sub> = exp(−{k} · |p − feature<sub>i</sub>|²),   colour = Σ w<sub>i</sub> · tex(uv + offset<sub>i</sub>) / Σ w<sub>i</sub>,   9 cells → 9 samples',
    vars: { k: { sym: 'k', name: 'falloff (higher = sharper cells)', min: 2, max: 40, value: 8, log: true },
            t: { sym: 'tiles', name: 'cells across the picture', values: [3, 6, 10], index: 1 } },
    out: { sym: 'samples per map', f: v => 9 },
    sub: (v, n) => `every pixel weighs the nine surrounding feature points by distance. With k = ${n(v.k)} the cells ${v.k < 6 ? 'overlap widely: no seams, but averaged, low-contrast texture' : v.k > 20 ? 'are nearly hard-edged: crisp texture, visible cell borders' : 'blend over a narrow border'}. Dividing by the total weight keeps the brightness; nine samples per map is the most expensive variant`,
    draw(ctx, W, H, v) { blit(ctx, W, H, v.t, voronoiShade(v.k)); },
    plot: false, size: [320, 240]
  });

  /* ---------- hex tiling (Mikkelsen 2022) ---------- */
  const SQ3 = Math.sqrt(3);
  function hexShade(gamma, rot, contrast) {
    const c1 = [0, 0, 0], c2 = [0, 0, 0], c3 = [0, 0, 0];
    const cen = (vx, vy) => [(vx + 0.5 * vy) / (2 * SQ3), (vy / 1.15470054) / (2 * SQ3)];
    const samp = (u, w, vx, vy, out) => {
      const [cx, cy] = cen(vx, vy); let a = (Math.abs(vx * vy) + Math.abs(vx + vy) + Math.PI) % (2 * Math.PI); if (a > Math.PI) a -= 2 * Math.PI; a *= rot;
      const cs = Math.cos(a), sn = Math.sin(a), dx = u - cx, dy = w - cy;
      return tex(dx * cs + dy * sn + cx + h2(vx, vy, 1), -dx * sn + dy * cs + cy + h2(vx, vy, 2), out);
    };
    return (u, w, c) => {
      const sx = u * 2 * SQ3, sy = w * 2 * SQ3;
      const kx = sx - 0.57735027 * sy, ky = 1.15470054 * sy;            // skewed grid
      const bx = Math.floor(kx), by = Math.floor(ky); let tx = kx - bx, ty = ky - by, tz = 1 - tx - ty;
      const s = tz < 0 ? 1 : 0, s2 = 2 * s - 1;
      const w1 = -tz * s2, w2 = s - ty * s2, w3 = s - tx * s2;
      samp(u, w, bx + s, by + s, c1); samp(u, w, bx + s, by + 1 - s, c2); samp(u, w, bx + 1 - s, by + s, c3);
      const L = q => 0.299 * q[0] + 0.587 * q[1] + 0.114 * q[2];
      const d1 = 1 + 0.6 * (L(c1) - 1), d2 = 1 + 0.6 * (L(c2) - 1), d3 = 1 + 0.6 * (L(c3) - 1);
      let W1 = d1 * Math.pow(w1, gamma), W2 = d2 * Math.pow(w2, gamma), W3 = d3 * Math.pow(w3, gamma); const t = W1 + W2 + W3; W1 /= t; W2 /= t; W3 /= t;
      if (contrast !== 0.5) { const g = x => { const kk = Math.log(1 - contrast) / Math.log(0.5); return x < 0.5 ? 0.5 * Math.pow(2 * x, kk) : 1 - 0.5 * Math.pow(2 - 2 * x, kk); };
        W1 = g(W1); W2 = g(W2); W3 = g(W3); const t2 = W1 + W2 + W3; W1 /= t2; W2 /= t2; W3 /= t2; }
      for (let k = 0; k < 3; k++) c[k] = W1 * c1[k] + W2 * c2[k] + W3 * c3[k];
      return c;
    };
  }
  A.fx('hex', {
    title: 'Hex tiling: three samples on a triangle grid',
    expr: 'W<sub>i</sub> = δ<sub>i</sub> · b<sub>i</sub><sup>{g}</sup> / Σ,   δ<sub>i</sub> = lerp(1, luminance<sub>i</sub>, 0.6),   rotation per tile × {rot},   contrast {r}',
    vars: { g: { sym: 'γ', name: 'exponent on the barycentric weights (paper: 7)', min: 1, max: 15, value: 7, step: 1 },
            rot: { sym: 'rot', name: 'random rotation strength per hex tile', min: 0, max: 1, value: 0, step: 0.05 },
            r: { sym: 'r', name: 'contrast of the blend (0.5 = off; paper suggests 0.65–0.75)', min: 0.5, max: 0.9, value: 0.5, step: 0.05 },
            t: { sym: 'tiles', name: 'texture repeats across the picture', values: [3, 6, 10], index: 1 } },
    out: { sym: 'samples per map', f: v => 3 },
    sub: (v, n) => `each pixel lies in a triangle of the hex lattice and reads the texture three times, once per corner tile, each with its own offset${v.rot > 0 ? ' and rotation' : ''}. The exponent ${n(v.g)} narrows the blend zones; weighting by luminance lets bright features win instead of averaging into grey${v.r > 0.5 ? `, and the contrast curve sharpens the borders further` : ''}`,
    draw(ctx, W, H, v) { blit(ctx, W, H, v.t, hexShade(v.g, v.rot, v.r)); },
    plot: false, size: [320, 240]
  });

  /* ---------- the mip level at a jump in UVs ---------- */
  A.fx('mipseam', {
    title: 'Mip level the GPU picks where the UV jumps between cells',
    expr: 'λ = log₂(max(|Δuv| · {S}, {p})),   jump between cells Δuv ≈ {j}',
    vars: { S: { sym: 'S', name: 'texture size', unit: 'px', values: [512, 1024, 2048, 4096], index: 2 },
            j: { sym: 'Δ', name: 'UV jump from one cell to the next (random offset)', min: 0.01, max: 1, value: 0.4, log: true },
            p: { sym: 'p', name: 'texels per pixel without a jump (normal footprint)', min: 0.5, max: 8, value: 1, log: true } },
    out: [{ sym: 'λ at the seam', f: v => Math.log2(Math.max(v.j * v.S, v.p)), color: 'bad' }, { sym: 'λ elsewhere', f: v => Math.max(0, Math.log2(v.p)), color: 'accent' }],
    sub: (v, n) => `where neighbouring pixels sit in different cells, the GPU sees a UV change of ${n(v.j)} across one pixel and reads mip <b>${n(Math.log2(Math.max(v.j * v.S, v.p)))}</b> instead of ${n(Math.max(0, Math.log2(v.p)))}: a one-pixel line of blurred, averaged colour along every cell border. Sampling with the gradients of the original UV (SampleGrad, textureGrad) removes it`,
    plot: { x: 'j' }
  });

  /* ---------- what it costs ---------- */
  A.fx('bombcost', {
    title: 'Texture samples per frame for anti-tiling',
    expr: 'samples = {P} M pixels · {t} · {m} maps · {L} layers,   time ≈ samples · {c} ns',
    vars: { P: { sym: 'P', name: 'pixels covered by the material', unit: 'M', min: 0.2, max: 8.3, value: 3, step: 0.1 },
            t: { sym: 'n', name: 'samples per map', values: [1, 2, 3, 4, 9], labels: ['1 plain', '2 two-pattern blend', '3 hex tiling', '4 offset blend', '9 Voronoi'], index: 2 },
            m: { sym: 'm', name: 'maps per layer (colour, normal, masks)', min: 1, max: 4, value: 3, step: 1 },
            L: { sym: 'L', name: 'layers blended per pixel', min: 1, max: 4, value: 2, step: 1 },
            c: { sym: 'c', name: 'cost per sample (cache-friendly, assumed)', unit: 'ns', min: 0.005, max: 0.05, value: 0.012, log: true } },
    out: { sym: 'time', unit: 'ms', f: v => v.P * 1e6 * v.t * v.m * v.L * v.c / 1e6 },
    sub: (v, n) => `<b>${n(v.P * v.t * v.m * v.L)} M</b> samples per frame, roughly <b>${n(v.P * 1e6 * v.t * v.m * v.L * v.c / 1e6)} ms</b> with the assumed throughput (against ${n(v.P * 1e6 * v.m * v.L * v.c / 1e6)} ms without anti-tiling). Apply it to the maps that show the repetition (usually colour and normal), not to every mask`,
    plot: { x: 't' }
  });
})();
