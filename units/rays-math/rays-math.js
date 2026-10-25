/* Rays and Solving for t — formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180;
  const P2 = (x, y) => `(${num(x)}, ${num(y)})`;

  A.fx('ray', {
    title: 'Point on a ray',
    expr: 'P(t) = O + {t}·D,   D = (cos {phi}, sin {phi})',
    vars: { t: { name: 'distance along the ray', min: -2, max: 8, value: 4, step: 0.05 }, phi: { sym: 'φ', name: 'direction', unit: '°', min: -90, max: 90, value: 20, step: 1 },
            ox: { sym: 'O<sub>x</sub>', name: 'start x', min: -4, max: 2, value: -3, step: 0.1 }, oy: { sym: 'O<sub>y</sub>', name: 'start y', min: -2, max: 2, value: -0.5, step: 0.1 } },
    out: [{ sym: 'P<sub>x</sub>', f: v => v.ox + v.t * Math.cos(v.phi * DEG), color: 'ax-x' }, { sym: 'P<sub>y</sub>', f: v => v.oy + v.t * Math.sin(v.phi * DEG), color: 'ax-y' }],
    sub: v => { const d = [Math.cos(v.phi * DEG), Math.sin(v.phi * DEG)]; return `P = ${P2(v.ox, v.oy)} + ${num(v.t)} · ${P2(...d)} = <b>${P2(v.ox + v.t * d[0], v.oy + v.t * d[1])}</b>${v.t < 0 ? ' (behind the start)' : ''}`; },
    draw(ctx, W, H, v, X) {
      const g = X.grid(ctx, W, H, { s: 36, cx: W / 2 - 40, cy: H / 2 }), d = [Math.cos(v.phi * DEG), Math.sin(v.phi * DEG)];
      ctx.setLineDash([4, 5]); ctx.strokeStyle = alpha(col('muted'), 0.7); ctx.beginPath(); ctx.moveTo(g.X(v.ox), g.Y(v.oy)); ctx.lineTo(g.X(v.ox - d[0] * 4), g.Y(v.oy - d[1] * 4)); ctx.stroke(); ctx.setLineDash([]);
      X.arrow(ctx, g.X(v.ox), g.Y(v.oy), g.X(v.ox + d[0] * 12), g.Y(v.oy + d[1] * 12), alpha(col('ray'), 0.5), 2);
      for (let k = -2; k <= 8; k++) { X.dot(ctx, g.X(v.ox + d[0] * k), g.Y(v.oy + d[1] * k), alpha(col('ray'), 0.6), 2.5); X.label(ctx, String(k), g.X(v.ox + d[0] * k) - d[1] * 14, g.Y(v.oy + d[1] * k) - d[0] * 14, col('muted'), 'center'); }
      X.arrow(ctx, g.X(v.ox), g.Y(v.oy), g.X(v.ox + d[0]), g.Y(v.oy + d[1]), col('accent'), 3);
      X.dot(ctx, g.X(v.ox), g.Y(v.oy), col('ink'), 6); X.label(ctx, 'O', g.X(v.ox) - 10, g.Y(v.oy) + 12, col('ink'), 'center', true); X.label(ctx, 'D', g.X(v.ox + d[0]) + 4, g.Y(v.oy + d[1]) - 12, col('accent'), 'center', true);
      const p = [v.ox + d[0] * v.t, v.oy + d[1] * v.t]; X.dot(ctx, g.X(p[0]), g.Y(p[1]), col('ax-y'), 7); X.label(ctx, 'P(t)', g.X(p[0]) + 10, g.Y(p[1]) - 12, col('ax-y'), 'left', true);
      X.label(ctx, 'numbers along the ray are values of t', 10, H - 12, col('muted'));
    },
    drag: (p, k, v) => { const d = [Math.cos(v.phi * DEG), Math.sin(v.phi * DEG)], x = (p.x - (440 / 2 - 40)) / 36 - v.ox, y = (280 / 2 - p.y) / 36 - v.oy; return { t: clamp(Math.round((x * d[0] + y * d[1]) * 20) / 20, -2, 8) }; },
    plot: { x: 't' },
    note: 'Drag along the ray to move P. The dashed part is t < 0.'
  });

  const floorT = v => (v.h - v.oy) / Math.sin(v.be * DEG);
  A.fx('plane', {
    title: 'Ray–plane intersection',
    expr: 't = ({h} − {oy}) / D<sub>y</sub>,   D<sub>y</sub> = sin {be}',
    vars: { be: { sym: 'β', name: 'ray pitch (negative = looking down)', unit: '°', min: -80, max: 80, value: -25, step: 1 },
            oy: { sym: 'O<sub>y</sub>', name: 'start height', unit: 'm', min: 0, max: 5, value: 2, step: 0.1 },
            h: { name: 'floor height', unit: 'm', min: -1, max: 3, value: 0, step: 0.1 } },
    out: { sym: 't', f: v => floorT(v) },
    sub: v => { const dy = Math.sin(v.be * DEG), t = floorT(v); return `t = (${num(v.h)} − ${num(v.oy)}) / ${A.pn(dy)} = <b>${Math.abs(dy) < 1e-6 ? '∞ (parallel)' : num(t)}</b> → ${Math.abs(dy) < 1e-6 ? 'no hit' : t > 0 ? 'hit ahead' : 'behind: no hit'}`; },
    draw(ctx, W, H, v, X) {
      const s = 34, ox = 60, base = H - 50, Y = y => base - y * s, Xp = x => ox + x * s, d = [Math.cos(v.be * DEG), Math.sin(v.be * DEG)], t = floorT(v);
      ctx.fillStyle = alpha(col('muted'), 0.15); ctx.fillRect(0, Y(v.h), W, H - Y(v.h)); ctx.strokeStyle = col('muted'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, Y(v.h)); ctx.lineTo(W, Y(v.h)); ctx.stroke();
      X.label(ctx, `floor at h = ${num(v.h)} m`, W - 10, Y(v.h) + 16, col('muted'), 'right');
      const far = t > 0 && isFinite(t) ? Math.min(t, 30) : 30;
      X.arrow(ctx, Xp(0), Y(v.oy), Xp(d[0] * far), Y(v.oy + d[1] * far), col('ray'), 2.5);
      ctx.setLineDash([4, 5]); ctx.strokeStyle = alpha(col('muted'), 0.6); ctx.beginPath(); ctx.moveTo(Xp(0), Y(v.oy)); ctx.lineTo(Xp(-d[0] * 3), Y(v.oy - d[1] * 3)); ctx.stroke(); ctx.setLineDash([]);
      X.dot(ctx, Xp(0), Y(v.oy), col('ink'), 6); X.label(ctx, 'O', Xp(0) - 12, Y(v.oy), col('ink'), 'center', true);
      if (t > 0 && isFinite(t)) { X.dot(ctx, Xp(d[0] * t), Y(v.h), col('accent'), 7); X.label(ctx, `hit at t = ${num(t)}`, Xp(d[0] * t) + 8, Y(v.h) - 14, col('accent'), 'left', true); }
      else if (isFinite(t)) { X.dot(ctx, Xp(d[0] * t), Y(v.h), alpha(col('bad'), 0.8), 6); X.label(ctx, `t = ${num(t)}: behind`, Math.max(10, Xp(d[0] * t) + 8), Y(v.h) - 14, col('bad'), 'left', true); }
    },
    plot: { x: 'be', y: [-20, 20] }
  });

  /* sphere at the origin, horizontal ray starting at x = −6 at height oy */
  const geo = v => { const L = [-6, v.oy], b = L[0], c = L[0] * L[0] + L[1] * L[1] - v.r * v.r, h = b * b - c; return { b, c, h, t0: h < 0 ? NaN : -b - Math.sqrt(h), t1: h < 0 ? NaN : -b + Math.sqrt(h) }; };
  function sphereScene(ctx, W, H, v, X, extra) {
    const g = X.grid(ctx, W, H, { s: 26, cx: W / 2 + 40, cy: H / 2 }), q = geo(v);
    ctx.fillStyle = alpha(col('ray'), 0.12); ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.X(0), g.Y(0), v.r * 26, 0, 7); ctx.fill(); ctx.stroke();
    X.dot(ctx, g.X(0), g.Y(0), col('ray'), 4); X.label(ctx, 'C', g.X(0) + 8, g.Y(0) + 10, col('ray'), 'left', true);
    X.arrow(ctx, g.X(-6), g.Y(v.oy), g.X(7.5), g.Y(v.oy), col('ink'), 2); X.dot(ctx, g.X(-6), g.Y(v.oy), col('ink'), 6); X.label(ctx, 'O', g.X(-6), g.Y(v.oy) - 14, col('ink'), 'center', true);
    if (q.h >= 0) { [[q.t0, 't₀'], [q.t1, 't₁']].forEach(([t, n]) => { X.dot(ctx, g.X(-6 + t), g.Y(v.oy), col('accent'), 6); X.label(ctx, `${n} = ${num(t)}`, g.X(-6 + t), g.Y(v.oy) + (n === 't₀' ? 18 : -16), col('accent'), 'center', true); }); }
    else X.label(ctx, 'miss: the ray passes the sphere', 10, H - 14, col('bad'), 'left', true);
    if (extra) extra(g, q);
    return g;
  }
  A.fx('quadsetup', {
    title: 'Quadratic in t',
    expr: 'f({t}) = {t}² + 2·b·{t} + c,   b = −6,  c = 36 + {oy}² − {r}²',
    vars: { t: { name: 'distance along the ray', min: 0, max: 12, value: 3, step: 0.05 }, oy: { sym: 'O<sub>y</sub>', name: 'ray height relative to the centre', min: -4, max: 4, value: 1.2, step: 0.05 }, r: { name: 'sphere radius', min: 0.5, max: 4, value: 3, step: 0.05 } },
    out: { sym: 'f(t)', f: v => { const q = geo(v); return v.t * v.t + 2 * q.b * v.t + q.c; } },
    steps: v => { const q = geo(v); return [['b = dot(L, D)', num(q.b)], ['c = dot(L, L) − r²', num(q.c)]]; },
    draw: (ctx, W, H, v, X) => sphereScene(ctx, W, H, v, X, (g) => { X.dot(ctx, g.X(-6 + v.t), g.Y(v.oy), col(X.vars.t.color), 5); X.label(ctx, 'P(t)', g.X(-6 + v.t), g.Y(v.oy) - 30, col(X.vars.t.color), 'center', true); }),
    plot: { x: 't', y: [-15, 40] },
    note: 'The curve crosses zero exactly at the two hit distances. Lower the radius until the curve stays above zero: the ray misses.'
  });
  A.fx('quad', {
    title: 'Entry and exit solutions',
    expr: 't<sub>0,1</sub> = −b ∓ √(b² − c),   b = −6,   c = 36 + {oy}² − {r}²',
    vars: { oy: { sym: 'O<sub>y</sub>', name: 'ray height relative to the centre', min: -4, max: 4, value: 1.2, step: 0.05 }, r: { name: 'sphere radius', min: 0.5, max: 4, value: 3, step: 0.05 } },
    out: [{ sym: 't<sub>0</sub>', f: v => geo(v).t0, color: 'accent' }, { sym: 't<sub>1</sub>', f: v => geo(v).t1, color: 'ray' }],
    steps: v => { const q = geo(v); return [['b', num(q.b)], ['c', num(q.c)], ['h = b² − c', num(q.h)], ['', q.h < 0 ? 'negative: miss' : q.h < 1e-6 ? 'zero: graze' : 'positive: two hits']]; },
    sub: v => { const q = geo(v); return q.h < 0 ? `h = ${num(q.h)} < 0 → <b>no hit</b>` : `t = ${num(-q.b)} ∓ √${num(q.h)} = <b>${num(q.t0)} and ${num(q.t1)}</b>`; },
    draw: (ctx, W, H, v, X) => sphereScene(ctx, W, H, v, X),
    plot: { x: 'oy', y: [0, 12] },
    note: 'Animate the ray height: the two curves meet where the ray grazes the sphere, and vanish beyond it.'
  });
  A.fx('whicht', {
    title: 'Ray origin inside and outside the sphere',
    expr: 'O = ({s}, 1),   r = 3',
    vars: { s: { name: 'start position along the line', min: -9, max: 9, value: -6, step: 0.05 } },
    out: [{ sym: 't<sub>0</sub>', f: v => { const b = v.s, c = v.s * v.s + 1 - 9, h = b * b - c; return h < 0 ? NaN : -b - Math.sqrt(h); }, color: 'accent' },
          { sym: 't<sub>1</sub>', f: v => { const b = v.s, c = v.s * v.s + 1 - 9, h = b * b - c; return h < 0 ? NaN : -b + Math.sqrt(h); }, color: 'ray' }],
    sub: v => { const b = v.s, c = v.s * v.s - 8, h = b * b - c, t0 = -b - Math.sqrt(h), t1 = -b + Math.sqrt(h); const k = t0 > 0 ? 'outside, sphere ahead: use t₀ to enter, t₁ to leave' : t1 > 0 ? 'inside: t₀ is behind, use t₁' : 'sphere behind: no hit ahead'; return `t₀ = ${num(t0)}, t₁ = ${num(t1)} → <b>${k}</b>`; },
    draw(ctx, W, H, v, X) {
      const g = X.grid(ctx, W, H, { s: 22, cx: W / 2, cy: H / 2 + 10 }), b = v.s, c = v.s * v.s - 8, h = Math.sqrt(b * b - c);
      ctx.fillStyle = alpha(col('ray'), 0.12); ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.X(0), g.Y(0), 3 * 22, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = alpha(col('muted'), 0.6); ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(0, g.Y(1)); ctx.lineTo(W, g.Y(1)); ctx.stroke(); ctx.setLineDash([]);
      X.arrow(ctx, g.X(v.s), g.Y(1), g.X(v.s + 4), g.Y(1), col('ink'), 3);
      X.dot(ctx, g.X(v.s), g.Y(1), col('ink'), 6); X.label(ctx, 'O', g.X(v.s), g.Y(1) - 16, col('ink'), 'center', true);
      [[-b - h, 't₀', 'accent'], [-b + h, 't₁', 'ray']].forEach(([t, n, c2]) => { X.dot(ctx, g.X(v.s + t), g.Y(1), t > 0 ? col(c2) : alpha(col(c2), 0.35), 6); X.label(ctx, `${n} = ${num(t)}`, g.X(v.s + t), g.Y(1) + (n === 't₀' ? 20 : 36), t > 0 ? col(c2) : col('muted'), 'center', true); });
    },
    plot: { x: 's', y: [-14, 14] }
  });

  /* slab test against the box [−2, 2] × [−1.2, 1.2] */
  const BX = 2, BY = 1.2;
  function slabs(v) {
    const d = [Math.cos(v.phi * DEG), Math.sin(v.phi * DEG)], o = [v.ox, v.oy];
    const ax = [BX, BY].map((hb, i) => { const inv = 1 / (Math.abs(d[i]) < 1e-9 ? 1e-9 : d[i]); const a = (-hb - o[i]) * inv, b = (hb - o[i]) * inv; return [Math.min(a, b), Math.max(a, b)]; });
    const tN = Math.max(ax[0][0], ax[1][0]), tF = Math.min(ax[0][1], ax[1][1]);
    return { d, ax, tN, tF, hit: tN <= tF && tF > 0 };
  }
  A.fx('slab', {
    title: 'Slab test for a box',
    expr: 't<sub>enter</sub> = max(t<sub>x,near</sub>, t<sub>y,near</sub>),  t<sub>exit</sub> = min(t<sub>x,far</sub>, t<sub>y,far</sub>),  O = ({ox}, {oy}),  D = (cos {phi}, sin {phi})',
    vars: { phi: { sym: 'φ', name: 'ray direction', unit: '°', min: -60, max: 60, value: 12, step: 1 }, ox: { sym: 'O<sub>x</sub>', name: 'start x', min: -6, max: -2.2, value: -5, step: 0.05 }, oy: { sym: 'O<sub>y</sub>', name: 'start y', min: -3, max: 3, value: -0.6, step: 0.05 } },
    out: [{ sym: 't<sub>enter</sub>', f: v => slabs(v).tN, color: 'accent' }, { sym: 't<sub>exit</sub>', f: v => slabs(v).tF, color: 'ray' }],
    steps: v => { const s = slabs(v); return [['x slab', `[${num(s.ax[0][0])}, ${num(s.ax[0][1])}]`], ['y slab', `[${num(s.ax[1][0])}, ${num(s.ax[1][1])}]`]]; },
    sub: v => { const s = slabs(v); return `enter = ${num(s.tN)}, exit = ${num(s.tF)} → <b>${s.hit ? 'hit (enter < exit)' : 'miss (enter > exit)'}</b>`; },
    draw(ctx, W, H, v, X) {
      const g = X.grid(ctx, W, H, { s: 34, cx: W / 2 + 60, cy: H / 2, axes: false }), s = slabs(v);
      ctx.fillStyle = alpha(col('ax-x'), 0.08); ctx.fillRect(g.X(-BX), 0, g.X(BX) - g.X(-BX), H);
      ctx.fillStyle = alpha(col('ax-y'), 0.08); ctx.fillRect(0, g.Y(BY), W, g.Y(-BY) - g.Y(BY));
      X.label(ctx, 'x slab', g.X(-BX) + 4, 14, col('ax-x'), 'left', true); X.label(ctx, 'y slab', 6, g.Y(BY) + 12, col('ax-y'), 'left', true);
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.strokeRect(g.X(-BX), g.Y(BY), g.X(BX) - g.X(-BX), g.Y(-BY) - g.Y(BY));
      const P = t => [g.X(v.ox + s.d[0] * t), g.Y(v.oy + s.d[1] * t)];
      X.arrow(ctx, ...P(0), ...P(13), alpha(col('muted'), 0.8), 1.8);
      [[s.ax[0][0], 'ax-x'], [s.ax[0][1], 'ax-x'], [s.ax[1][0], 'ax-y'], [s.ax[1][1], 'ax-y']].forEach(([t, c]) => { if (isFinite(t) && Math.abs(t) < 30) X.dot(ctx, ...P(t), col(c), 4); });
      if (s.hit) { ctx.strokeStyle = col('accent'); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(...P(Math.max(0, s.tN))); ctx.lineTo(...P(s.tF)); ctx.stroke(); X.dot(ctx, ...P(Math.max(0, s.tN)), col('accent'), 7); X.dot(ctx, ...P(s.tF), col('ray'), 7); }
      X.dot(ctx, ...P(0), col('ink'), 6); X.label(ctx, 'O', P(0)[0] - 10, P(0)[1] - 12, col('ink'), 'center', true);
    },
    plot: { x: 'phi', y: [-2, 12] },
    note: 'Small dots: where the ray crosses each slab\'s two planes. The thick part of the ray is inside both slabs at once, which is inside the box.'
  });
})();
