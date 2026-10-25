/* Vectors — formulas and diagrams */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const S = 40, G = { s: S, cx: 220, cy: 160 };          // 40 px per unit, origin in the canvas
  const r1 = x => Math.round(x * 10) / 10;
  const V = (x, y) => `(${num(x)}, ${num(y)})`;
  /* handle picking for drawings with several draggable points */
  function picker(points) {
    let cur = null;
    return (p, kind, v, g) => {
      const [x, y] = [(p.x - G.cx) / S, (G.cy - p.y) / S];
      if (kind === 'down') { let best = Infinity; points(v).forEach(([kx, ky, px, py]) => { const d = Math.hypot(px - x, py - y); if (d < best) { best = d; cur = [kx, ky]; } }); }
      if (!cur) return null;
      return { [cur[0]]: clamp(r1(x), -5, 5), [cur[1]]: clamp(r1(y), -3.8, 3.8) };
    };
  }
  const ext = { min: -5, max: 5, step: 0.1 }, exty = { min: -3.8, max: 3.8, step: 0.1 };

  A.fx('components', {
    title: 'Vector components',
    expr: 'v = ({x}, {y})',
    vars: { x: Object.assign({ name: 'x component', value: 3 }, ext), y: Object.assign({ name: 'y component', value: 2 }, exty) },
    sub: v => `v = <b>${V(v.x, v.y)}</b>: ${num(Math.abs(v.x))} ${v.x >= 0 ? 'right' : 'left'}, ${num(Math.abs(v.y))} ${v.y >= 0 ? 'up' : 'down'}`,
    plot: false,
    draw(ctx, W, H, v, X) {
      const g = X.grid(ctx, W, H, G);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = col(X.vars.x.color); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(g.X(0), g.Y(0)); ctx.lineTo(g.X(v.x), g.Y(0)); ctx.stroke();
      ctx.strokeStyle = col(X.vars.y.color); ctx.beginPath(); ctx.moveTo(g.X(v.x), g.Y(0)); ctx.lineTo(g.X(v.x), g.Y(v.y)); ctx.stroke(); ctx.setLineDash([]);
      X.arrow(ctx, g.X(0), g.Y(0), g.X(v.x), g.Y(v.y), col('ink'), 3);
      X.label(ctx, 'x = ' + num(v.x), g.X(v.x / 2), g.Y(0) + (v.y >= 0 ? 14 : -14), col(X.vars.x.color), 'center', true);
      X.label(ctx, 'y = ' + num(v.y), g.X(v.x) + (v.x >= 0 ? 8 : -8), g.Y(v.y / 2), col(X.vars.y.color), v.x >= 0 ? 'left' : 'right', true);
      X.label(ctx, 'drag the tip', g.X(v.x) + 10, g.Y(v.y) - 12, col('muted'));
    },
    drag: (p) => ({ x: clamp(r1((p.x - G.cx) / S), -5, 5), y: clamp(r1((G.cy - p.y) / S), -3.8, 3.8) }),
    size: [880, 320]
  });

  A.fx('add', {
    title: 'Adding vectors',
    expr: 'a + b = ({ax} + {bx}, {ay} + {by})',
    vars: { ax: Object.assign({ sym: 'a<sub>x</sub>', name: 'a, x', value: 2 }, ext), ay: Object.assign({ sym: 'a<sub>y</sub>', name: 'a, y', value: 1 }, exty),
            bx: Object.assign({ sym: 'b<sub>x</sub>', name: 'b, x', value: 1 }, ext), by: Object.assign({ sym: 'b<sub>y</sub>', name: 'b, y', value: 2 }, exty) },
    out: [{ sym: '(a+b)<sub>x</sub>', f: v => v.ax + v.bx, color: 'ax-x' }, { sym: '(a+b)<sub>y</sub>', f: v => v.ay + v.by, color: 'ax-y' }],
    sub: v => `a + b = (${num(v.ax)} + ${A.pn(v.bx)}, ${num(v.ay)} + ${A.pn(v.by)}) = <b>${V(v.ax + v.bx, v.ay + v.by)}</b>`,
    plot: false,
    draw(ctx, W, H, v, X) {
      const g = X.grid(ctx, W, H, G);
      X.arrow(ctx, g.X(0), g.Y(0), g.X(v.ax), g.Y(v.ay), col('ray'), 3);
      X.arrow(ctx, g.X(v.ax), g.Y(v.ay), g.X(v.ax + v.bx), g.Y(v.ay + v.by), col('accent'), 3);
      ctx.setLineDash([6, 5]); X.arrow(ctx, g.X(0), g.Y(0), g.X(v.ax + v.bx), g.Y(v.ay + v.by), col('ink'), 2); ctx.setLineDash([]);
      X.label(ctx, 'a', g.X(v.ax / 2) - 10, g.Y(v.ay / 2) - 10, col('ray'), 'center', true);
      X.label(ctx, 'b', g.X(v.ax + v.bx / 2) + 10, g.Y(v.ay + v.by / 2) - 10, col('accent'), 'center', true);
      X.label(ctx, 'a + b', g.X(v.ax + v.bx) + 10, g.Y(v.ay + v.by), col('ink'), 'left', true);
    },
    drag: (() => { const pk = picker(v => [['ax', 'ay', v.ax, v.ay], ['sx', 'sy', v.ax + v.bx, v.ay + v.by]]); return (p, k, v) => { const r = pk(p, k, v); if (!r) return null; if ('sx' in r) return { bx: r1(r.sx - v.ax), by: r1(r.sy - v.ay) }; return r; }; })(),
    size: [880, 320],
    note: 'Drag the tip of a, or the tip of the dashed sum to change b.'
  });

  A.fx('sub', {
    title: 'B − A',
    expr: 'd = B − A = ({Bx} − {Ax}, {By} − {Ay})',
    vars: { Ax: Object.assign({ sym: 'A<sub>x</sub>', name: 'start point, x', value: -3 }, ext), Ay: Object.assign({ sym: 'A<sub>y</sub>', name: 'start point, y', value: -1 }, exty),
            Bx: Object.assign({ sym: 'B<sub>x</sub>', name: 'target point, x', value: 2 }, ext), By: Object.assign({ sym: 'B<sub>y</sub>', name: 'target point, y', value: 2 }, exty) },
    sub: v => `d = (${num(v.Bx)} − ${A.pn(v.Ax)}, ${num(v.By)} − ${A.pn(v.Ay)}) = <b>${V(v.Bx - v.Ax, v.By - v.Ay)}</b>`,
    plot: false,
    draw(ctx, W, H, v, X) {
      const g = X.grid(ctx, W, H, G);
      ctx.setLineDash([3, 4]); ctx.strokeStyle = alpha(col('muted'), 0.8); ctx.lineWidth = 1.5;
      [[v.Ax, v.Ay], [v.Bx, v.By]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(g.X(0), g.Y(0)); ctx.lineTo(g.X(x), g.Y(y)); ctx.stroke(); }); ctx.setLineDash([]);
      X.arrow(ctx, g.X(v.Ax), g.Y(v.Ay), g.X(v.Bx), g.Y(v.By), col('accent'), 3.5);
      X.dot(ctx, g.X(v.Ax), g.Y(v.Ay), col('ray'), 7); X.dot(ctx, g.X(v.Bx), g.Y(v.By), col('ax-y'), 7);
      X.label(ctx, 'A (e.g. the pixel)', g.X(v.Ax) + 10, g.Y(v.Ay) + 14, col('ray'), 'left', true);
      X.label(ctx, 'B (e.g. the light)', g.X(v.Bx) + 10, g.Y(v.By) - 14, col('ax-y'), 'left', true);
      X.label(ctx, 'B − A', g.X((v.Ax + v.Bx) / 2) + 12, g.Y((v.Ay + v.By) / 2), col('accent'), 'left', true);
    },
    drag: picker(v => [['Ax', 'Ay', v.Ax, v.Ay], ['Bx', 'By', v.Bx, v.By]]),
    size: [880, 320],
    note: 'The dashed lines are A and B as positions. Their difference does not start at the origin; it starts at A.'
  });

  A.fx('scale', {
    title: 'Scaling a vector',
    expr: 'k·v = ({k}·{x}, {k}·{y})',
    vars: { k: { name: 'scale factor', min: -2, max: 3, value: 1.5, step: 0.05 }, x: Object.assign({ name: 'v, x', value: 2 }, ext), y: Object.assign({ name: 'v, y', value: 1 }, exty) },
    out: [{ sym: '(kv)<sub>x</sub>', f: v => v.k * v.x, color: 'ax-x' }, { sym: '(kv)<sub>y</sub>', f: v => v.k * v.y, color: 'ax-y' }],
    sub: v => `k·v = (${num(v.k)} × ${A.pn(v.x)}, ${num(v.k)} × ${A.pn(v.y)}) = <b>${V(v.k * v.x, v.k * v.y)}</b>`,
    draw(ctx, W, H, v, X) {
      const g = X.grid(ctx, W, H, { s: 32, cx: W / 2, cy: H / 2 });
      ctx.strokeStyle = alpha(col('muted'), 0.4); ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(g.X(-v.x * 8), g.Y(-v.y * 8)); ctx.lineTo(g.X(v.x * 8), g.Y(v.y * 8)); ctx.stroke(); ctx.setLineDash([]);
      X.arrow(ctx, g.X(0), g.Y(0), g.X(v.k * v.x), g.Y(v.k * v.y), col('accent'), 5, 12);
      X.arrow(ctx, g.X(0), g.Y(0), g.X(v.x), g.Y(v.y), col('ray'), 2.5);
      X.label(ctx, 'v', g.X(v.x) + 8, g.Y(v.y) + 12, col('ray'), 'left', true);
      X.label(ctx, 'k·v', g.X(v.k * v.x) + 8, g.Y(v.k * v.y) - 12, col('accent'), 'left', true);
    },
    plot: { x: 'k' }
  });

  A.fx('length', {
    title: 'Length (Pythagoras)',
    expr: '|v| = √({x}² + {y}²)',
    vars: { x: Object.assign({ name: 'x component', value: 3 }, ext), y: Object.assign({ name: 'y component', value: 2 }, exty) },
    out: { sym: '|v|', f: v => Math.hypot(v.x, v.y) },
    steps: v => [['x²', num(v.x * v.x)], ['y²', num(v.y * v.y)], ['x² + y²', num(v.x * v.x + v.y * v.y)]],
    draw(ctx, W, H, v, X) {
      const g = X.grid(ctx, W, H, G);
      ctx.fillStyle = alpha(col('ray'), 0.08); ctx.beginPath(); ctx.moveTo(g.X(0), g.Y(0)); ctx.lineTo(g.X(v.x), g.Y(0)); ctx.lineTo(g.X(v.x), g.Y(v.y)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col(X.vars.x.color); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(g.X(0), g.Y(0)); ctx.lineTo(g.X(v.x), g.Y(0)); ctx.stroke();
      ctx.strokeStyle = col(X.vars.y.color); ctx.beginPath(); ctx.moveTo(g.X(v.x), g.Y(0)); ctx.lineTo(g.X(v.x), g.Y(v.y)); ctx.stroke();
      X.arrow(ctx, g.X(0), g.Y(0), g.X(v.x), g.Y(v.y), col('ink'), 3);
      X.label(ctx, '|v| = ' + num(Math.hypot(v.x, v.y)), g.X(v.x / 2) - 8, g.Y(v.y / 2) - 12, col('ink'), 'right', true);
    },
    drag: (p) => ({ x: clamp(r1((p.x - G.cx) / S), -5, 5), y: clamp(r1((G.cy - p.y) / S), -3.8, 3.8) }),
    plot: { x: 'x' }
  });

  A.fx('normalize', {
    title: 'Normalize',
    expr: 'v̂ = ({x}, {y}) / |v|',
    vars: { x: Object.assign({ name: 'x component', value: 3 }, ext), y: Object.assign({ name: 'y component', value: 2 }, exty) },
    out: [{ sym: 'v̂<sub>x</sub>', f: v => v.x / Math.hypot(v.x, v.y), color: 'ax-x' }, { sym: 'v̂<sub>y</sub>', f: v => v.y / Math.hypot(v.x, v.y), color: 'ax-y' }],
    sub: v => { const L = Math.hypot(v.x, v.y); return L < 1e-9 ? 'v̂ = (0, 0) / 0 = <b>NaN: undefined</b>' : `|v| = ${num(L)} · v̂ = (${num(v.x)} / ${num(L)}, ${num(v.y)} / ${num(L)}) = <b>${V(v.x / L, v.y / L)}</b> · length 1`; },
    draw(ctx, W, H, v, X) {
      const g = X.grid(ctx, W, H, G);
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(g.X(0), g.Y(0), S, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, 'radius 1', g.X(0) + S * 0.72 + 6, g.Y(0) + S * 0.72 + 8, col('accent'));
      X.arrow(ctx, g.X(0), g.Y(0), g.X(v.x), g.Y(v.y), alpha(col('ink'), 0.6), 2);
      const L = Math.hypot(v.x, v.y) || 1;
      X.arrow(ctx, g.X(0), g.Y(0), g.X(v.x / L), g.Y(v.y / L), col('accent'), 4, 11);
      X.label(ctx, 'v', g.X(v.x) + 8, g.Y(v.y) - 10, col('ink'), 'left', true);
      X.label(ctx, 'v̂', g.X(v.x / L) + 10, g.Y(v.y / L) + 12, col('accent'), 'left', true);
    },
    drag: (p) => ({ x: clamp(r1((p.x - G.cx) / S), -5, 5), y: clamp(r1((G.cy - p.y) / S), -3.8, 3.8) }),
    plot: { x: 'x', y: [-1.1, 1.1] },
    note: 'However far you drag v, v̂ stays on the circle.'
  });

  /* ---------- axes diagram ---------- */
  (function axes() {
    const cv = document.getElementById('axes-cv'); if (!cv) return;
    // simple oblique projection: x right, y into screen (up-right), z up
    const P = (x, y, z) => [x * 1 + y * 0.55, -z * 1 - y * 0.35];
    const sets = [
      ['Unity', [['X', [1, 0, 0], 'ax-x', 'right'], ['Y', [0, 0, 1], 'ax-y', 'up'], ['Z', [0, 1, 0], 'ax-z', 'forward']], 'Y up · left-handed · 1 unit = 1 m'],
      ['Unreal Engine', [['X', [0, 1, 0], 'ax-x', 'forward'], ['Y', [1, 0, 0], 'ax-y', 'right'], ['Z', [0, 0, 1], 'ax-z', 'up']], 'Z up · left-handed · 1 unit = 1 cm'],
      ['Blender', [['X', [1, 0, 0], 'ax-x', 'right'], ['Y', [0, 1, 0], 'ax-y', 'back (away from front view)'], ['Z', [0, 0, 1], 'ax-z', 'up']], 'Z up · right-handed · 1 unit = 1 m']
    ];
    A.fig(cv, (ctx, W, H) => {
      sets.forEach(([name, ax, note], i) => {
        const ox = 110 + i * 300, oy = 170, L = 80;
        A.text(ctx, name, ox + 40, 22, col('ink'), 'center', true);
        ax.forEach(([n, d, c, what]) => { const [px, py] = P(d[0] * L, d[1] * L, d[2] * L); A.arrow(ctx, ox, oy, ox + px, oy + py, col(c), 3, 11); A.text(ctx, `+${n}  ${what}`, ox + px * 1.12 + (px >= 0 ? 4 : -4), oy + py * 1.15, col(c), px >= -1 ? 'left' : 'right', true); });
        A.text(ctx, note, ox + 40, H - 18, col('muted'), 'center');
      });
    });
  })();
})();
