/* Hair: Strands and Cards — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180;
  const enc = x => Math.round(clamp(x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055, 0, 1) * 255);
  const css = c => `rgb(${c.map(enc).join(',')})`;

  A.fx('strands', {
    title: 'Triangle count: strands versus cards',
    expr: 'strands = {n} · {seg} · 2,   cards = {c} · {cs} · 2',
    vars: { n: { name: 'hair strands', min: 5000, max: 150000, value: 100000, log: true }, seg: { name: 'segments per strand (as ribbons)', min: 4, max: 32, value: 16, step: 1 },
            c: { name: 'hair cards', min: 100, max: 5000, value: 1200, log: true }, cs: { name: 'quads per card', min: 2, max: 12, value: 6, step: 1 } },
    out: [{ sym: 'strands', f: v => v.n * v.seg * 2, color: 'bad' }, { sym: 'cards', f: v => v.c * v.cs * 2, color: 'good' }],
    sub: v => `<b>${num(v.n * v.seg * 2)}</b> triangles as strands against <b>${num(v.c * v.cs * 2)}</b> as cards: ${num(v.n * v.seg / (v.c * v.cs))}× fewer`,
    plot: { x: 'n', logY: true, y: [1e3, 1e8] }
  });

  A.fx('cardcost', {
    title: 'Hair shader runs per frame',
    expr: 'runs = {px} · {l}',
    vars: { px: { name: 'screen pixels the hair covers', min: 10000, max: 2000000, value: 300000, log: true }, l: { name: 'card layers on top of each other (average)', min: 1, max: 20, value: 6, step: 1 } },
    out: { sym: 'runs', f: v => v.px * v.l },
    sub: v => `<b>${num(v.px * v.l)}</b> shader runs; a close-up head can cover a third of a 1080p screen (≈ 700 000 pixels)`,
    plot: { x: 'l', y: [0, 40000000] }
  });

  A.fx('kkdiff', {
    title: 'Kajiya–Kay diffuse',
    expr: 'diffuse = √(1 − (T·L)²),   angle between strand and light {a}',
    vars: { a: { sym: 'α', name: 'angle between strand and light', unit: '°', min: 0, max: 180, value: 60, step: 1 } },
    out: { sym: 'diffuse', f: v => Math.sin(v.a * DEG) },
    draw(ctx, W, H, v, X) {
      const c = [W / 2, H / 2 + 20];
      for (let i = -4; i <= 4; i++) { ctx.strokeStyle = css([0.5, 0.35, 0.2].map(x => x * (0.3 + 0.7 * Math.sin(v.a * DEG)))); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(c[0] - 160, c[1] + i * 9); ctx.lineTo(c[0] + 160, c[1] + i * 9); ctx.stroke(); }
      X.label(ctx, 'strands (T points right)', c[0] - 160, c[1] - 52, col('muted'));
      const L = [Math.cos(v.a * DEG), -Math.sin(v.a * DEG)]; X.arrow(ctx, c[0] + L[0] * 130, c[1] + L[1] * 130 - 10, c[0], c[1] - 10, col('accent'), 2.5); X.label(ctx, 'light', c[0] + L[0] * 140, c[1] + L[1] * 140 - 10, col('accent'), 'center', true);
    },
    plot: { x: 'a', y: [0, 1.1] }
  });

  /* side view of hair over the top of a head: strands follow a circle; the eye looks from the right, light from upper right */
  const spec = (th, h, p) => { const T = [Math.cos(th), -Math.sin(th)], tdh = T[0] * h[0] + T[1] * h[1], s = Math.sqrt(Math.max(0, 1 - tdh * tdh)); return ss(-1, 0, tdh) * Math.pow(s, p); };
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function headArc(ctx, W, H, f, X) {
    const c = [W / 2 - 40, H - 30], R = 150;
    for (let i = 0; i <= 90; i += 1) { const ph = i * DEG, x = c[0] + Math.sin(ph) * R, y = c[1] - Math.cos(ph) * R, k = f(ph); ctx.strokeStyle = css(k); ctx.lineWidth = 28; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(c[0] + Math.sin(ph + 1.2 * DEG) * R, c[1] - Math.cos(ph + 1.2 * DEG) * R); ctx.stroke(); }
    X.label(ctx, 'top of the head', c[0] - 6, c[1] - R - 16, col('muted')); X.label(ctx, 'side', c[0] + R + 14, c[1], col('muted'));
    X.label(ctx, 'eye →', W - 20, H / 2, col('muted'), 'right');
    return { c, R };
  }
  A.fx('kkspec', {
    title: 'Highlight band along the head (side view)',
    expr: 'spec = sin(T, H)<sup>{p}</sup>,   light at {la} above the view direction',
    vars: { p: { name: 'exponent (sharpness)', min: 4, max: 400, value: 80, log: true }, la: { sym: 'θ<sub>L</sub>', name: 'light elevation above the view direction', unit: '°', min: 0, max: 90, value: 50, step: 1 },
            ph: { sym: 'φ', name: 'position on the head (0° top, 90° side)', unit: '°', min: 0, max: 90, value: 62, step: 0.5 } },
    out: { sym: 'spec', f: v => { const hA = v.la / 2 * DEG, h = [Math.cos(hA), Math.sin(hA)]; return spec(v.ph * DEG, h, v.p); } },
    draw(ctx, W, H, v, X) {
      const hA = v.la / 2 * DEG, h = [Math.cos(hA), Math.sin(hA)];
      const g = headArc(ctx, W, H, ph => { const s = spec(ph, h, v.p); return [0.12 + s * 0.95, 0.07 + s * 0.85, 0.04 + s * 0.75]; }, X);
      const x = g.c[0] + Math.sin(v.ph * DEG) * (g.R + 22), y = g.c[1] - Math.cos(v.ph * DEG) * (g.R + 22); X.dot(ctx, x, y, col('ink'), 4);
    },
    plot: { x: 'ph', y: [0, 1] }
  });

  const shiftT = (ph, s) => { const T = [Math.cos(ph), -Math.sin(ph)], N = [Math.sin(ph), Math.cos(ph)], t = [T[0] + s * N[0], T[1] + s * N[1]], l = Math.hypot(...t); return [t[0] / l, t[1] / l]; };
  const specT = (T, h, p) => { const tdh = T[0] * h[0] + T[1] * h[1], s = Math.sqrt(Math.max(0, 1 - tdh * tdh)); return ss(-1, 0, tdh) * Math.pow(s, p); };
  A.fx('shift', {
    title: 'Primary and secondary highlights',
    expr: 'T′ = normalize(T + s · N),   R: s = {s1}, p = {p1};   TRT: s = {s2}, p = {p2}',
    vars: { s1: { sym: 's<sub>R</sub>', name: 'primary shift', min: -0.6, max: 0.6, value: 0.15, step: 0.01 }, p1: { sym: 'p<sub>R</sub>', name: 'primary exponent', min: 20, max: 400, value: 150, log: true },
            s2: { sym: 's<sub>TRT</sub>', name: 'secondary shift', min: -0.6, max: 0.6, value: -0.2, step: 0.01 }, p2: { sym: 'p<sub>TRT</sub>', name: 'secondary exponent', min: 4, max: 200, value: 30, log: true },
            ph: { sym: 'φ', name: 'position on the head', unit: '°', min: 0, max: 90, value: 60, step: 0.5 } },
    out: [{ sym: 'R', f: v => specT(shiftT(v.ph * DEG, v.s1), [Math.cos(25 * DEG), Math.sin(25 * DEG)], v.p1), color: 'ink' }, { sym: 'TRT', f: v => specT(shiftT(v.ph * DEG, v.s2), [Math.cos(25 * DEG), Math.sin(25 * DEG)], v.p2) * 0.6, color: 'accent' }],
    draw(ctx, W, H, v, X) {
      const h = [Math.cos(25 * DEG), Math.sin(25 * DEG)], base = [0.16, 0.08, 0.035];
      headArc(ctx, W, H, ph => { const r = specT(shiftT(ph, v.s1), h, v.p1), t = specT(shiftT(ph, v.s2), h, v.p2) * 0.6; return [base[0] * 0.8 + r + t * 0.9, base[1] * 0.8 + r + t * 0.55, base[2] * 0.8 + r + t * 0.3]; }, X);
      X.label(ctx, 'white: R · tinted: TRT', 10, 16, col('muted'));
    },
    plot: { x: 'ph', y: [0, 1.1] }
  });

  A.fx('roottip', {
    title: 'Root to tip gradient',
    expr: 'colour = lerp(root, tip, {v}<sup>{g}</sup>) · lerp({ao}, 1, {v})',
    vars: { v: { name: 'position along the card (0 root, 1 tip)', min: 0, max: 1, value: 0.3, step: 0.01 }, g: { name: 'gradient curve', min: 0.2, max: 4, value: 1, step: 0.05 }, ao: { name: 'darkening at the root', min: 0, max: 1, value: 0.35, step: 0.01 } },
    out: { sym: 'brightness', f: v => (0.05 + (0.3 - 0.05) * Math.pow(v.v, v.g)) * (v.ao + (1 - v.ao) * v.v) / 0.3 },
    draw(ctx, W, H, v, X) {
      const root = [0.05, 0.03, 0.02], tip = [0.55, 0.38, 0.2];
      for (let y = 30; y < H - 30; y++) { const t = (y - 30) / (H - 60), k = Math.pow(t, v.g), ao = v.ao + (1 - v.ao) * t; ctx.fillStyle = css(root.map((r, i) => (r + (tip[i] - r) * k) * ao)); ctx.fillRect(W / 2 - 60, y, 120, 1); }
      X.label(ctx, 'root', W / 2 + 70, 34, col('muted')); X.label(ctx, 'tip', W / 2 + 70, H - 34, col('muted'));
      const y = 30 + v.v * (H - 60); ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2 - 70, y); ctx.lineTo(W / 2 + 64, y); ctx.stroke();
    },
    plot: { x: 'v', y: [0, 1.1] }
  });
})();
