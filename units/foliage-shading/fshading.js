/* Foliage Shading — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num, clamp } = A;
  const rad = d => d * Math.PI / 180;
  const hash = i => { const s = Math.sin(i * 91.7 + 13.3) * 43758.5453; return s - Math.floor(s); };
  const shade = b => { const g = Math.round(40 + 200 * clamp(b, 0, 1)); return `rgb(${Math.round(g * 0.55)},${g},${Math.round(g * 0.35)})`; };

  /* ---------- card normals against a canopy normal ---------- */
  const CARDS = []; for (let i = 0; i < 70; i++) { const r = Math.sqrt(hash(i)) * 0.95, a = hash(i + 100) * Math.PI * 2; CARDS.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.85, o: hash(i + 200) * Math.PI * 2 }); }
  function cardLight(v) {
    const L = [Math.cos(rad(v.l)), Math.sin(rad(v.l))], out = [];
    CARDS.forEach(c => {
      let n = [Math.cos(c.o), Math.sin(c.o)]; if (n[0] * L[0] + n[1] * L[1] < 0) n = [-n[0], -n[1]];   // two-sided card: faces the light
      const s = [c.x, c.y / 0.85], sl = Math.hypot(...s) || 1, sn = [s[0] / sl, s[1] / sl];
      const m = [n[0] * (1 - v.k) + sn[0] * v.k, n[1] * (1 - v.k) + sn[1] * v.k], ml = Math.hypot(...m) || 1;
      out.push(Math.max(0, (m[0] * L[0] + m[1] * L[1]) / ml) * 0.85 + 0.12);
    });
    return out;
  }
  const NN = CARDS.map((c, i) => { let best = -1, bd = 1e9; CARDS.forEach((o, j) => { if (j === i) return; const d = (c.x - o.x) ** 2 + (c.y - o.y) ** 2; if (d < bd) { bd = d; best = j; } }); return best; });
  const spread = v => { const b = cardLight(v); let s = 0; for (let i = 0; i < b.length; i++) s += Math.abs(b[i] - b[NN[i]]); return s / b.length; };
  A.fx('cards', {
    title: 'Leaf cards lit by their own normals or by a canopy normal',
    expr: 'n = normalize(lerp(n<sub>card</sub>, normalize(p − c), {k})),   light from {l}',
    vars: { k: { sym: 'k', name: 'blend toward the canopy normal', min: 0, max: 1, value: 0, step: 0.01 },
            l: { sym: 'θ<sub>L</sub>', name: 'light direction', unit: '°', min: 0, max: 180, value: 50, step: 1 } },
    out: { sym: 'neighbour contrast', f: spread },
    sub: (v, n) => v.k < 0.3 ? `card normals point anywhere, so neighbouring cards jump in brightness (average difference ${n(spread(v))}): the crown reads as a pile of paper` : `with ${n(v.k * 100)} % of the canopy normal the crown shades like one volume, lit side to shadow side (average difference ${n(spread(v))})`,
    draw(ctx, W, H, v, X) {
      const cx = W / 2, cy = H / 2 + 6, R = Math.min(W, H) * 0.4, b = cardLight(v);
      CARDS.forEach((c, i) => { const x = cx + c.x * R, y = cy - c.y * R, d = [Math.cos(c.o + Math.PI / 2), Math.sin(c.o + Math.PI / 2)];
        ctx.strokeStyle = shade(b[i]); ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x - d[0] * 11, y + d[1] * 11); ctx.lineTo(x + d[0] * 11, y - d[1] * 11); ctx.stroke(); });
      const L = [Math.cos(rad(v.l)), Math.sin(rad(v.l))]; X.arrow(ctx, cx + L[0] * (R + 34), cy - L[1] * (R + 34), cx + L[0] * (R + 8), cy - L[1] * (R + 8), col('ax-y'), 2.5);
    },
    plot: { x: 'k', y: [0, 0.35] }, size: [360, 300]
  });

  /* ---------- grass normals toward the terrain ---------- */
  function grass(v) {
    const L = [Math.cos(rad(v.l)), Math.sin(rad(v.l))], g = [-Math.sin(rad(v.s)), Math.cos(rad(v.s))];
    const ground = Math.max(0, g[0] * L[0] + g[1] * L[1]);
    let blades = 0; const N = 9;
    for (let i = 0; i < N; i++) { const a = rad(-80 + 160 * i / (N - 1)), bn = [Math.cos(a), Math.sin(a) * 0.2], m = [bn[0] * (1 - v.k) + g[0] * v.k, bn[1] * (1 - v.k) + g[1] * v.k], ml = Math.hypot(...m); blades += Math.abs(m[0] * L[0] + m[1] * L[1]) / ml * (v.k > 0.999 ? 1 : 1); }
    return { ground, grass: blades / N };
  }
  A.fx('grass', {
    title: 'Grass lit with its own normals or with the terrain normal',
    expr: 'n<sub>grass</sub> = normalize(lerp(n<sub>blade</sub>, n<sub>terrain</sub>, {k})),   slope {s},   light {l}',
    vars: { k: { sym: 'k', name: 'blend toward the terrain normal', min: 0, max: 1, value: 0.15, step: 0.01 },
            s: { sym: 'slope', name: 'terrain slope', unit: '°', min: -40, max: 40, value: 15, step: 1 },
            l: { sym: 'θ<sub>L</sub>', name: 'sun elevation', unit: '°', min: 5, max: 175, value: 40, step: 1 } },
    out: [{ sym: 'ground', f: v => grass(v).ground, color: 'ax-y' }, { sym: 'grass', f: v => grass(v).grass, color: 'accent' }],
    sub: (v, n) => { const r = grass(v); return `ground ${n(r.ground)}, grass ${n(r.grass)}: ${Math.abs(r.ground - r.grass) < 0.08 ? 'the grass melts into the terrain' : 'a visible brightness seam between grass and ground'}`; },
    draw(ctx, W, H, v, X) {
      const r = grass(v), gy = H * 0.7, t = Math.tan(rad(v.s));
      ctx.fillStyle = shade(r.ground * 0.85 + 0.1); ctx.beginPath(); ctx.moveTo(0, gy + t * W / 2); ctx.lineTo(W, gy - t * W / 2); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
      for (let i = 0; i < 46; i++) { const x = 8 + i / 45 * (W - 16), y = gy - t * (x - W / 2); ctx.strokeStyle = shade(r.grass * 0.85 + 0.1); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.quadraticCurveTo(x + 3, y - 20, x + 6 * Math.sin(i), y - 34 - 8 * hash(i)); ctx.stroke(); }
      const L = [Math.cos(rad(v.l)), Math.sin(rad(v.l))]; X.arrow(ctx, W / 2 + L[0] * 90, 70 - L[1] * 50, W / 2 + L[0] * 50, 70 - L[1] * 20, col('ax-y'), 2.5);
    },
    plot: { x: 'k', y: [0, 1] }, size: [440, 220]
  });

  /* ---------- canopy proxy: sphere or ellipsoid ---------- */
  const ell = (v, p) => { const g = [p[0] / 1, p[1] / (v.a * v.a)], l = Math.hypot(...g); return [g[0] / l, g[1] / l]; };
  const sph = p => { const l = Math.hypot(...p); return [p[0] / l, p[1] / l]; };
  A.fx('proxy', {
    title: 'Canopy normals from a sphere or from a fitted ellipsoid',
    expr: 'n = normalize((p − c) / r²) for an ellipsoid with radii r = (1, {a}),   sphere: normalize(p − c)',
    vars: { a: { sym: 'a', name: 'crown height / width', min: 0.5, max: 3, value: 2, step: 0.05 },
            l: { sym: 'θ<sub>L</sub>', name: 'light direction', unit: '°', min: 0, max: 180, value: 60, step: 1 } },
    out: { sym: 'normal difference at the crown\'s shoulder', unit: '°', f: v => { const p = [0.7, 0.71 * v.a], e = ell(v, p), s = sph(p); return Math.acos(clamp(e[0] * s[0] + e[1] * s[1], -1, 1)) * 180 / Math.PI; } },
    sub: (v, n) => { const p = [0.7, 0.71 * v.a], e = ell(v, p), s = sph(p); return `on a crown ${n(v.a)}× taller than wide, a sphere's normals at the shoulder are off by <b>${n(Math.acos(clamp(e[0] * s[0] + e[1] * s[1], -1, 1)) * 180 / Math.PI)}°</b>: fit the proxy to the crown`; },
    draw(ctx, W, H, v, X) {
      const L = [Math.cos(rad(v.l)), Math.sin(rad(v.l))], R = Math.min(W / 4 - 12, (H - 30) / (2 * v.a));
      [[W * 0.27, 'sphere normals', p => sph(p)], [W * 0.73, 'ellipsoid normals', p => ell(v, p)]].forEach(([cx, lab, fn]) => {
        const cy = H / 2 + 6;
        for (let y = -1; y <= 1; y += 0.04) for (let x = -1; x <= 1; x += 0.04) { if (x * x + y * y > 1) continue; const p = [x, y * v.a], nn = fn(p); ctx.fillStyle = shade(Math.max(0, nn[0] * L[0] + nn[1] * L[1]) * 0.85 + 0.1); ctx.fillRect(cx + x * R - 2, cy - y * v.a * R - 2, 0.04 * R + 1, 0.04 * v.a * R + 1); }
        X.label(ctx, lab, cx, H - 6, col('muted'), 'center');
      });
    },
    plot: { x: 'a', y: [0, 40] }, size: [440, 280]
  });

  /* ---------- back faces: flip, mirror or none ---------- */
  const back = v => { const L = [Math.cos(rad(v.l)), Math.sin(rad(v.l))];
    // leaf in the x axis, front normal (0,1) in tangent space (x tangent). Viewer is on the back side (y < 0).
    const n = v.m === 0 ? [0, -1] : v.m === 1 ? [0, -1] : [0, 1];       // flip and mirror agree for a flat card's geometric normal
    const nm = [Math.sin(rad(v.b)), Math.cos(rad(v.b))];               // the normal map's tilt in tangent space
    const nb = v.m === 0 ? [-nm[0], -nm[1]] : v.m === 1 ? [nm[0], -nm[1]] : nm;
    return Math.max(0, nb[0] * L[0] + nb[1] * L[1]); };
  A.fx('twosided', {
    title: 'The back side of a leaf: flip, mirror or none',
    expr: 'back normal: flip = −n,   mirror = (n<sub>x</sub>, n<sub>y</sub>, −n<sub>z</sub>) in tangent space,   none = n,   mode {m}',
    vars: { m: { sym: 'mode', name: 'double-sided normal mode', values: [0, 1, 2], labels: ['flip', 'mirror', 'none'], index: 0 },
            b: { sym: 'tilt', name: 'normal map tilt at this pixel', unit: '°', min: -60, max: 60, value: 30, step: 1 },
            l: { sym: 'θ<sub>L</sub>', name: 'light direction (270° = from the back side)', unit: '°', min: 180, max: 360, value: 240, step: 1 } },
    out: { sym: 'N·L on the back side', f: back },
    sub: (v, n) => [`flip: the back uses −n, the normal of the same thin surface seen from behind, slopes included. N·L = <b>${n(back(v))}</b>`, `mirror: only the component out of the surface changes sign; the slopes keep their direction in tangent space. N·L = <b>${n(back(v))}</b>`, `none: the back uses the front normal and stays dark when lit from its own side. N·L = <b>${n(back(v))}</b>`][v.m],
    draw(ctx, W, H, v, X) {
      const cx = W / 2, cy = H / 2, L = [Math.cos(rad(v.l)), Math.sin(rad(v.l))];
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx - 120, cy); ctx.lineTo(cx + 120, cy); ctx.stroke();
      const nm = [Math.sin(rad(v.b)), Math.cos(rad(v.b))], nb = v.m === 0 ? [-nm[0], -nm[1]] : v.m === 1 ? [nm[0], -nm[1]] : nm;
      X.arrow(ctx, cx, cy, cx + nm[0] * 70, cy - nm[1] * 70, col('muted'), 2); X.label(ctx, 'front normal', cx + nm[0] * 70 + 6, cy - nm[1] * 70, col('muted'));
      X.arrow(ctx, cx, cy, cx + nb[0] * 70, cy - nb[1] * 70, col('ray'), 3); X.label(ctx, 'used on the back', cx + nb[0] * 70 + 6, cy - nb[1] * 70 + 12, col('ray'));
      X.arrow(ctx, cx - L[0] * 110, cy + L[1] * 110 * -1 + 0, cx - L[0] * 40, cy + L[1] * 40 * -1, col('ax-y'), 2.5);
      X.label(ctx, 'viewer and light below the leaf', 10, H - 8, col('muted'));
    },
    plot: { x: 'b', y: [0, 1] }, size: [440, 240]
  });

  /* ---------- thin translucency ---------- */
  const tr = v => { const c = Math.cos(rad(v.a)), wrap = clamp(-Math.cos(rad(v.n)) * 0.6 + 0.4, 0, 1), view = Math.pow(clamp(c, 0, 1), 4); return (wrap * (1 - v.d) + view * v.d) * v.t; };
  A.fx('transl', {
    title: 'Light through a leaf (Crysis back term)',
    expr: 'back = lerp(saturate(−N·L · 0.6 + 0.4), saturate(V·−L)⁴, {d}) · {t},   angle(V, −L) = {a},   angle(N, L) = {n}',
    vars: { a: { sym: 'φ', name: 'angle between the view and the light shining towards you', unit: '°', min: 0, max: 90, value: 20, step: 1 },
            n: { sym: 'θ', name: 'angle between the leaf normal and the light', unit: '°', min: 90, max: 180, value: 150, step: 1 },
            d: { sym: 'v', name: 'view dependency', min: 0, max: 1, value: 0.6, step: 0.01 },
            t: { sym: 'T', name: 'transmission (thin leaf ≈ 0.6, thick ≈ 0.2)', min: 0, max: 1, value: 0.6, step: 0.01 } },
    out: { sym: 'back light', f: tr },
    sub: (v, n) => `leaves between you and the sun glow: back light <b>${n(tr(v))}</b> of the front light, tinted by the leaf's transmission colour (yellow-green)`,
    plot: { x: 'a', y: [0, 1] }
  });

  /* ---------- per-instance variation and AO ---------- */
  A.fx('variation', {
    title: 'Per-instance colour variation and canopy occlusion',
    expr: 'hue ± {h},   value ± {b},   AO = lerp({o}, 1, (r / R)<sup>{p}</sup>)',
    vars: { h: { sym: 'Δhue', name: 'hue variation', unit: '°', min: 0, max: 30, value: 8, step: 0.5 },
            b: { sym: 'Δvalue', name: 'brightness variation', min: 0, max: 0.4, value: 0.12, step: 0.01 },
            o: { sym: 'AO<sub>min</sub>', name: 'occlusion at the centre of the crown', min: 0.1, max: 1, value: 0.35, step: 0.01 },
            p: { sym: 'p', name: 'occlusion falloff', min: 0.3, max: 3, value: 1.2, step: 0.05 } },
    out: { sym: 'AO at half radius', f: v => v.o + (1 - v.o) * Math.pow(0.5, v.p) },
    sub: (v, n) => `each instance draws its hue and brightness from a hash of its position; inside the crown the occlusion falls to ${n(v.o)}. Variation stays small: ${n(v.h)}° of hue reads as natural, 30° as a different species`,
    draw(ctx, W, H, v, X) {
      const n = 7, w = (W - 20) / n;
      for (let i = 0; i < n; i++) {
        const hu = 95 + (hash(i) * 2 - 1) * v.h, va = 0.62 + (hash(i + 9) * 2 - 1) * v.b, cx = 10 + w * (i + 0.5), cy = H / 2 + 10, R = w * 0.45;
        for (let r = R; r > 0; r -= 2) { const ao = v.o + (1 - v.o) * Math.pow(r / R, v.p); ctx.fillStyle = `hsl(${hu}, 45%, ${clamp(va * ao * 50, 4, 80)}%)`; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); }
      }
      X.label(ctx, 'seven instances of one tree, top view', 10, 14, col('muted'));
    },
    plot: { x: 'p', y: [0, 1] }, size: [480, 160]
  });
})();
