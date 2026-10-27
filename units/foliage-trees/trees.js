/* Procedural Trees — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num, clamp } = A;
  const rad = d => d * Math.PI / 180;

  /* ---------- branch levels: how fast a tree multiplies ---------- */
  const branches = v => { let n = 0; for (let l = 0; l <= v.L; l++) n += Math.pow(v.c, l); return n; };
  A.fx('levels', {
    title: 'Branch count and triangles by level',
    expr: 'branches = Σ<sub>l=0..{L}</sub> {c}<sup>l</sup>,   triangles ≈ branches · {s} · {g} · 2',
    vars: { c: { sym: 'c', name: 'children per branch', min: 1, max: 8, value: 4, step: 1 },
            L: { sym: 'L', name: 'branch levels below the trunk', min: 0, max: 5, value: 3, step: 1 },
            s: { sym: 'sides', name: 'sides around each branch', min: 3, max: 12, value: 6, step: 1 },
            g: { sym: 'segs', name: 'segments along each branch', min: 1, max: 12, value: 5, step: 1 } },
    out: [{ sym: 'branches', f: branches, color: 'accent' }, { sym: 'triangles', f: v => branches(v) * v.s * v.g * 2, color: 'ray' }],
    sub: (v, n) => `${num(branches(v))} branches, about <b>${num(branches(v) * v.s * v.g * 2)}</b> triangles before a single leaf. Each extra level multiplies the count by ${v.c}.`,
    draw(ctx, W, H, v, X) {
      let budget = 3000;
      const grow = (x, y, a, len, w, d) => {
        if (budget-- <= 0) return;
        const x2 = x + Math.cos(a) * len, y2 = y - Math.sin(a) * len;
        ctx.strokeStyle = d === 0 ? col('ink') : alpha(col('accent'), 0.95 - d * 0.12); ctx.lineWidth = Math.max(0.6, w);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
        if (d >= v.L) return;
        for (let i = 0; i < v.c; i++) {
          const t = v.c === 1 ? 0.6 : 0.3 + 0.6 * i / (v.c - 1), side = i % 2 ? 1 : -1;
          const bx = x + (x2 - x) * t, by = y + (y2 - y) * t;
          grow(bx, by, a + side * rad(32 + 6 * d), len * 0.52 * (1.15 - 0.45 * t), w * 0.6, d + 1);
        }
      };
      grow(W / 2, H - 14, Math.PI / 2, H * 0.62, 7, 0);
      X.label(ctx, 'drawing capped at 3000 branches', 10, 14, col('muted'));
    },
    plot: { x: 'L', logY: true }, size: [440, 280]
  });

  /* ---------- the pipe model: radius of children ---------- */
  A.fx('pipe', {
    title: 'Branch radius from the pipe model',
    expr: '{r}<sup>{D}</sup> = Σ r<sub>i</sub><sup>{D}</sup>,   {n} equal children: r<sub>i</sub> = {r} / {n}<sup>1/{D}</sup>',
    vars: { r: { sym: 'r', name: 'parent radius', unit: 'cm', min: 2, max: 40, value: 20, step: 0.5 },
            n: { sym: 'n', name: 'children at the fork', min: 1, max: 6, value: 2, step: 1 },
            D: { sym: 'Δ', name: 'exponent (2 = cross-section area is kept)', min: 1.5, max: 3, value: 2, step: 0.05 } },
    out: [{ sym: 'r<sub>i</sub>', unit: 'cm', f: v => v.r / Math.pow(v.n, 1 / v.D), color: 'accent' }],
    sub: (v, n) => { const ri = v.r / Math.pow(v.n, 1 / v.D), area = v.n * ri * ri / (v.r * v.r); return `each child gets <b>${n(ri)} cm</b>; together the children have <b>${n(area * 100)} %</b> of the parent's cross-section`; },
    draw(ctx, W, H, v, X) {
      const ri = v.r / Math.pow(v.n, 1 / v.D), s = Math.min(3.2, (H - 60) / (2 * 40));
      const px = 90, py = H / 2;
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, v.r * s, 0, 7); ctx.stroke();
      X.label(ctx, 'parent', px, py + v.r * s + 16, col('muted'), 'center');
      const total = v.n * 2 * ri * s + (v.n - 1) * 8; let x = Math.max(200, W - 30 - total);
      for (let i = 0; i < v.n; i++) { ctx.fillStyle = alpha(col('accent'), 0.25); ctx.strokeStyle = col('accent'); ctx.beginPath(); ctx.arc(x + ri * s, py, ri * s, 0, 7); ctx.fill(); ctx.stroke(); x += 2 * ri * s + 8; }
      X.label(ctx, v.n + ' children', W - 30 - total / 2, py + Math.max(ri * s, 10) + 16, col('muted'), 'center');
    },
    plot: { x: 'n' }, size: [440, 220]
  });

  /* ---------- phyllotaxis: the golden angle ---------- */
  function gaps(a, n) {
    const ang = []; for (let i = 0; i < n; i++) ang.push(((i * a) % 360 + 360) % 360);
    ang.sort((x, y) => x - y); let m = 360;
    for (let i = 0; i < n; i++) m = Math.min(m, ((i + 1 < n ? ang[i + 1] : ang[0] + 360) - ang[i]));
    return m;
  }
  A.fx('phyllo', {
    title: 'Leaf placement around a stem',
    expr: 'leaf i at angle i · {a},   {n} leaves,   golden angle = 360° · (1 − 1/φ) ≈ 137.5°',
    vars: { a: { sym: 'α', name: 'divergence angle between successive leaves', unit: '°', min: 90, max: 180, value: 137.5, step: 0.1 },
            n: { sym: 'n', name: 'leaves', min: 4, max: 80, value: 34, step: 1 } },
    out: { sym: 'smallest gap', unit: '°', f: v => gaps(v.a, v.n) },
    sub: (v, n) => `seen from above, the closest two of ${v.n} leaves are <b>${n(gaps(v.a, v.n))}°</b> apart (an even spread would be ${n(360 / v.n)}°). Rational angles such as 120° or 144° stack leaves on top of each other.`,
    draw(ctx, W, H, v, X) {
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 14;
      ctx.strokeStyle = col('line'); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
      for (let i = 0; i < v.n; i++) {
        const a = rad(i * v.a), r = R * Math.sqrt((i + 1) / v.n);
        ctx.strokeStyle = alpha(col('accent'), 0.35); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy - Math.sin(a) * r); ctx.stroke();
        X.dot(ctx, cx + Math.cos(a) * r, cy - Math.sin(a) * r, col('accent'), 3.2);
      }
      X.label(ctx, 'top view, older leaves outside', 10, 14, col('muted'));
    },
    plot: { x: 'a', y: [0, 40] }, size: [300, 280]
  });

  /* ---------- length and droop along a parent ---------- */
  const lenAt = v => Math.pow(1 - v.t, v.k) * (0.25 + 0.75 * Math.min(1, v.t * 6));
  A.fx('profile', {
    title: 'Child length and droop along the parent',
    expr: 'L(t) = L<sub>max</sub> · (1 − {t})<sup>{k}</sup>,   droop ≈ {g} · L(t)',
    vars: { t: { sym: 't', name: 'position along the parent (0 = base, 1 = tip)', min: 0, max: 1, value: 0.3, step: 0.01 },
            k: { sym: 'k', name: 'taper of child length', min: 0, max: 3, value: 1.2, step: 0.05 },
            g: { sym: 'g', name: 'gravity response', min: 0, max: 1.2, value: 0.5, step: 0.01 } },
    out: [{ sym: 'L(t) / L<sub>max</sub>', f: lenAt, color: 'accent' }],
    sub: (v, n) => `at t = ${n(v.t)} a child branch is <b>${n(lenAt(v) * 100)} %</b> of the longest and its tip drops about <b>${n(v.g * lenAt(v) * 60)}°</b>`,
    draw(ctx, W, H, v, X) {
      const bx = W / 2, by = H - 12, top = 18, Ht = by - top;
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, top); ctx.stroke();
      for (let i = 1; i < 14; i++) {
        const t = i / 14, L = Math.pow(1 - t, v.k) * (0.25 + 0.75 * Math.min(1, t * 6)) * W * 0.42, side = i % 2 ? 1 : -1, y0 = by - t * Ht;
        const droop = rad(v.g * (L / (W * 0.42)) * 60);
        ctx.strokeStyle = Math.abs(t - v.t) < 0.036 ? col('accent') : alpha(col('ink'), 0.6); ctx.lineWidth = Math.abs(t - v.t) < 0.036 ? 3 : 1.6;
        ctx.beginPath(); ctx.moveTo(bx, y0);
        for (let s = 1; s <= 12; s++) { const u = s / 12, a = rad(35) - droop * u * u; ctx.lineTo(bx + side * Math.cos(a) * L * u, y0 - Math.sin(a) * L * u * 0.9 + 0); }
        ctx.stroke();
      }
    },
    plot: { x: 't', y: [0, 1.05] }, size: [440, 260]
  });

  /* ---------- an L-system ---------- */
  function lsys(n) { let s = 'F'; for (let i = 0; i < n; i++) s = s.replace(/F/g, 'F[+F]F[-F]F'); return s; }
  A.fx('lsys', {
    title: 'An L-system: one rule, repeated',
    expr: 'F → F[+F]F[−F]F,   {n} rewrites,   turn {a}',
    vars: { n: { sym: 'n', name: 'rewrites', min: 0, max: 5, value: 3, step: 1 },
            a: { sym: 'δ', name: 'turn angle for + and −', unit: '°', min: 10, max: 45, value: 25.7, step: 0.1 } },
    out: { sym: 'segments', f: v => Math.pow(5, v.n) },
    sub: (v, n) => `${v.n} rewrites give <b>${num(Math.pow(5, v.n))}</b> segments from one rule. F draws forward, + and − turn, [ and ] save and restore the turtle.`,
    draw(ctx, W, H, v, X) {
      const s = lsys(v.n), len = (H - 30) / Math.pow(3, v.n);
      let x = W / 2, y = H - 10, a = Math.PI / 2; const st = [];
      ctx.strokeStyle = col('accent'); ctx.lineWidth = v.n > 3 ? 1 : 1.6; ctx.beginPath();
      for (const ch of s) {
        if (ch === 'F') { const x2 = x + Math.cos(a) * len, y2 = y - Math.sin(a) * len; ctx.moveTo(x, y); ctx.lineTo(x2, y2); x = x2; y = y2; }
        else if (ch === '+') a += rad(v.a); else if (ch === '-') a -= rad(v.a);
        else if (ch === '[') st.push([x, y, a]); else if (ch === ']') [x, y, a] = st.pop();
      }
      ctx.stroke();
    },
    plot: { x: 'n', logY: true }, size: [360, 300]
  });

  /* ---------- leaves: cards against meshes ---------- */
  A.fx('leafcards', {
    title: 'Leaf meshes against leaf cards',
    expr: 'meshes: {N} · {t},   cards: ({N} / {k}) · {c}',
    vars: { N: { sym: 'N', name: 'leaves on the tree', min: 500, max: 200000, value: 20000, log: true },
            t: { sym: 't<sub>leaf</sub>', name: 'triangles per modelled leaf', min: 2, max: 40, value: 12, step: 1 },
            k: { sym: 'k', name: 'leaves painted on one card', min: 1, max: 60, value: 18, step: 1 },
            c: { sym: 't<sub>card</sub>', name: 'triangles per card (2 = quad, more = tight cutout)', min: 2, max: 16, value: 6, step: 1 } },
    out: [{ sym: 'mesh triangles', f: v => v.N * v.t, color: 'ray' }, { sym: 'card triangles', f: v => v.N / v.k * v.c, color: 'accent' }],
    sub: (v, n) => `modelled leaves: <b>${num(v.N * v.t)}</b> triangles; cards: <b>${num(v.N / v.k * v.c)}</b> triangles (${n(v.N * v.t / (v.N / v.k * v.c))}× fewer), paid for in overdraw on the transparent parts of each card`,
    plot: { x: 'k', logY: true }
  });
})();
