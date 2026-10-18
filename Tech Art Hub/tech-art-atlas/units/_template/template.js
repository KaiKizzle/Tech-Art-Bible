/* Template unit — formulas and labs. Rename to <your-slug>.js. Everything goes through window.Atlas (assets/atlas.js). */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, num } = A;

  /* A live formula. {key} in expr becomes a coloured chip; each var gets a slider; click a chip to graph against it. */
  A.fx('example', {
    title: 'Distance an object falls',
    expr: 'd = ½ · {g} · {t}²',
    vars: {
      g: { name: 'gravity', unit: 'm/s²', min: 1, max: 25, value: 9.81, step: 0.01 },
      t: { name: 'time', unit: 's', min: 0, max: 5, value: 2, step: 0.01 }
    },
    out: { sym: 'd', unit: 'm', f: v => 0.5 * v.g * v.t * v.t },
    // optional: sub(v) => custom substituted line; steps(v) => [[label, value], ...]
    draw(ctx, W, H, v, X) {                       // optional picture, in fixed logical units W×H
      const y = 30 + Math.min(1, 0.5 * v.g * v.t * v.t / 122) * (H - 60);
      X.dot(ctx, W / 2, y, col('accent'), 10);
      X.label(ctx, 'd = ' + num(0.5 * v.g * v.t * v.t) + ' m', W / 2 + 16, y + 4, col('ink'));
    },
    plot: { x: 't' },                             // graph the output against t; false to hide
    note: 'Animate t to see the parabola.'
  });

  /* A hand-made lab. A.fig() gives a canvas with a fixed logical size (its width/height attributes),
     drawn sharp at any pixel ratio; it never resizes itself. */
  (function demo() {
    const cv = document.getElementById('demo-cv'); if (!cv) return;
    let f = null;
    const k = A.range('demo-k', x => num(x), () => f && f.draw());
    f = A.fig(cv, (ctx, W, H) => {
      ctx.fillStyle = alpha(col('ray'), 0.25); ctx.fillRect(20, 20, (W - 40) * k.v, H - 40);
      A.text(ctx, 'k = ' + num(k.v), 28, 44, col('ink'), 'left', true);
    });
    A.pointer(cv, f.w, f.h, (p, kind) => { if (kind === 'down' || kind === 'move') k.set(Math.max(0, Math.min(1, (p.x - 20) / (f.w - 40)))); });
  })();
})();
