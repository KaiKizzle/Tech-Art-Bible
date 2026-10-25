/* How a GPU Draws a Frame — formulas and labs */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const RES_W = [640, 1280, 1920, 2560, 3840], RES_H = [360, 720, 1080, 1440, 2160];

  A.fx('pixels', {
    title: 'Pixels in one frame',
    expr: 'N = {W} × {H}',
    vars: {
      W: { name: 'width', unit: 'px', values: RES_W, index: 2 },
      H: { name: 'height', unit: 'px', values: RES_H, index: 2 }
    },
    out: { sym: 'N', name: 'pixels', f: v => v.W * v.H, fmt: x => num(x, 4) },
    draw(ctx, W, H, v, X) {
      // the current resolution drawn to scale against 4K
      const s = Math.min((W - 40) / 3840, (H - 50) / 2160), x0 = 20, y0 = 16;
      ctx.strokeStyle = col('line'); ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.strokeRect(x0, y0, 3840 * s, 2160 * s); ctx.setLineDash([]);
      X.label(ctx, '3840 × 2160 (4K)', x0 + 3840 * s - 4, y0 + 2160 * s + 12, col('muted'), 'right');
      ctx.fillStyle = alpha(col('ray'), 0.18); ctx.fillRect(x0, y0, v.W * s, v.H * s);
      ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.strokeRect(x0, y0, v.W * s, v.H * s);
      // a few grid lines to suggest pixels (1 line per 160 px)
      ctx.strokeStyle = alpha(col('ray'), 0.25); ctx.lineWidth = 1;
      for (let x = 160; x < v.W; x += 160) { ctx.beginPath(); ctx.moveTo(x0 + x * s, y0); ctx.lineTo(x0 + x * s, y0 + v.H * s); ctx.stroke(); }
      for (let y = 160; y < v.H; y += 160) { ctx.beginPath(); ctx.moveTo(x0, y0 + y * s); ctx.lineTo(x0 + v.W * s, y0 + y * s); ctx.stroke(); }
      X.label(ctx, `${v.W} × ${v.H}`, x0 + 8, y0 + 14, col('ink'), 'left', true);
      X.label(ctx, `${(v.W * v.H / (3840 * 2160) * 100).toFixed(0)}% of 4K`, x0 + 8, y0 + 32, col('muted'));
    },
    plot: { x: 'W' },
    note: 'Each faint line in the picture marks 160 pixels.'
  });

  A.fx('invocations', {
    title: 'Pixel shader runs per second',
    expr: 'R = {W} × {H} × {f}',
    vars: {
      W: { name: 'width', unit: 'px', values: RES_W, index: 2 },
      H: { name: 'height', unit: 'px', values: RES_H, index: 2 },
      f: { name: 'frame rate', unit: 'fps', values: [30, 60, 90, 120, 144, 240], index: 1 }
    },
    out: { sym: 'R', name: 'runs per second', unit: '/s', f: v => v.W * v.H * v.f },
    plot: { x: 'f' },
    note: 'This assumes every pixel is shaded exactly once. Real frames shade many pixels several times.'
  });

  A.fx('waves', {
    title: 'Waves needed',
    expr: 'waves = ⌈ {N} / {L} ⌉',
    vars: {
      N: { name: 'pixels to shade', min: 1, max: 4000, value: 100, step: 1 },
      L: { name: 'lanes per wave', values: [32, 64], index: 1 }
    },
    out: { sym: 'waves', name: 'waves', f: v => Math.ceil(v.N / v.L), fmt: x => String(x) },
    steps: v => [['N / L', num(v.N / v.L)], ['empty lanes', String(Math.ceil(v.N / v.L) * v.L - v.N)]],
    plot: { x: 'N', zero: true },
    note: '⌈ ⌉ means round up to the next whole number. The graph is a staircase: one more pixel can cost a whole new wave.'
  });

  // edge function: triangle a b c fixed, point p draggable
  const TA = [80, 230], TB = [360, 40], TC = [400, 250];
  const edge = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  A.fx('edge', {
    title: 'Edge function',
    expr: 'E(p) = (b<sub>x</sub>−a<sub>x</sub>)({py}−a<sub>y</sub>) − (b<sub>y</sub>−a<sub>y</sub>)({px}−a<sub>x</sub>)',
    vars: {
      px: { sym: 'p<sub>x</sub>', name: 'point x', min: 0, max: 440, value: 250, step: 1 },
      py: { sym: 'p<sub>y</sub>', name: 'point y', min: 0, max: 280, value: 170, step: 1 }
    },
    out: [
      { sym: 'E<sub>ab</sub>', name: 'edge a→b', f: v => edge(TA, TB, [v.px, v.py]), color: 'ax-x' },
      { sym: 'E<sub>bc</sub>', name: 'edge b→c', f: v => edge(TB, TC, [v.px, v.py]), color: 'ax-y' },
      { sym: 'E<sub>ca</sub>', name: 'edge c→a', f: v => edge(TC, TA, [v.px, v.py]), color: 'ax-z' }
    ],
    sub: v => {
      const p = [v.px, v.py], e = [edge(TA, TB, p), edge(TB, TC, p), edge(TC, TA, p)];
      const inside = e.every(x => x >= 0) || e.every(x => x <= 0);
      return `E<sub>ab</sub> = ${num(e[0])} · E<sub>bc</sub> = ${num(e[1])} · E<sub>ca</sub> = ${num(e[2])} → <b>${inside ? 'all the same sign: inside' : 'signs differ: outside'}</b>`;
    },
    draw(ctx, W, H, v, X) {
      const p = [v.px, v.py], cell = 20;
      // pixel grid, cells whose centre is inside are filled
      for (let y = 0; y < H; y += cell) for (let x = 0; x < W; x += cell) {
        const c = [x + cell / 2, y + cell / 2], e = [edge(TA, TB, c), edge(TB, TC, c), edge(TC, TA, c)];
        const ins = e.every(q => q >= 0) || e.every(q => q <= 0);
        ctx.fillStyle = ins ? alpha(col('ray'), 0.28) : 'transparent'; if (ins) ctx.fillRect(x, y, cell, cell);
        ctx.strokeStyle = alpha(col('muted'), 0.18); ctx.strokeRect(x + 0.5, y + 0.5, cell, cell);
        ctx.fillStyle = alpha(col('muted'), 0.5); ctx.fillRect(c[0] - 1, c[1] - 1, 2, 2);
      }
      const edges = [[TA, TB, 'ax-x', 'a', 'b'], [TB, TC, 'ax-y', 'b', 'c'], [TC, TA, 'ax-z', 'c', 'a']];
      edges.forEach(([a, b, c]) => { ctx.strokeStyle = col(c); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
      [[TA, 'a'], [TB, 'b'], [TC, 'c']].forEach(([q, n]) => { X.dot(ctx, q[0], q[1], col('ink'), 4); X.label(ctx, n, q[0] + 8, q[1] - 8, col('ink'), 'left', true); });
      const e = [edge(TA, TB, p), edge(TB, TC, p), edge(TC, TA, p)], ins = e.every(x => x >= 0) || e.every(x => x <= 0);
      X.dot(ctx, p[0], p[1], ins ? col('good') : col('bad'), 7);
      X.label(ctx, 'p (drag me)', p[0] + 10, p[1] + 2, col('ink'), 'left', true);
    },
    drag: (p) => ({ px: Math.round(clamp(p.x, 0, 440)), py: Math.round(clamp(p.y, 0, 280)) }),
    plot: { x: 'px' },
    note: 'Screen y grows downwards here, as it does in pixel coordinates. Drag p in the picture or click a symbol to graph the three edge values.'
  });

  A.fx('budget', {
    title: 'Frame budget',
    expr: 't = 1000 / {f}',
    vars: { f: { name: 'frame rate', unit: 'fps', min: 20, max: 240, value: 60, step: 1 } },
    out: { sym: 't', name: 'time per frame', unit: 'ms', f: v => 1000 / v.f, fmt: x => x.toFixed(1) },
    plot: { x: 'f', y: [0, 50] }
  });

  /* ---------- lab: one shader per pixel ---------- */
  (function perPixel() {
    const cv = document.getElementById('pp-grid'); if (!cv) return;
    const GX = 24, GY = 14;
    const SH = {
      grad: { code: 'float4 Frag(float2 uv)\n{\n    // red grows to the right,\n    // green grows upwards\n    return float4(uv.x, uv.y, 0, 1);\n}', f: (u, v) => [u, v, 0] },
      circle: { code: 'float4 Frag(float2 uv)\n{\n    float d = distance(uv, float2(0.5, 0.5));\n    float inside = step(d, 0.35);\n    return float4(inside, inside * 0.6, 0.2, 1);\n}', f: (u, v) => { const d = Math.hypot((u - 0.5) * GX / GY, v - 0.5); const i = d <= 0.35 ? 1 : 0; return [i, i * 0.6, 0.2]; } },
      check: { code: 'float4 Frag(float2 uv)\n{\n    float2 cell = floor(uv * 6);\n    float c = fmod(cell.x + cell.y, 2);\n    return float4(c, c, c, 1);\n}', f: (u, v) => { const c = (Math.floor(u * 6) + Math.floor(v * 6)) % 2; return [c, c, c]; } }
    };
    let pick = 'grad', hover = null;
    const code = document.getElementById('pp-code'), ro = document.getElementById('pp-ro');
    const uvOf = (i, j) => [(i + 0.5) / GX, 1 - (j + 0.5) / GY];
    const f = A.fig(cv, (ctx, W, H) => {
      const cw = W / GX, ch = H / GY;
      for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
        const [u, v] = uvOf(i, j), c = SH[pick].f(u, v).map(x => Math.round(clamp(x, 0, 1) * 255));
        ctx.fillStyle = `rgb(${c})`; ctx.fillRect(i * cw, j * ch, cw - 1, ch - 1);
      }
      if (hover) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(hover[0] * cw + 1, hover[1] * ch + 1, cw - 3, ch - 3); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(hover[0] * cw - 1, hover[1] * ch - 1, cw + 1, ch + 1); }
    });
    function table() {
      const h = hover || [3, 10], [u, v] = uvOf(h[0], h[1]), c = SH[pick].f(u, v);
      ro.innerHTML = `<tr><td>Pixel (column, row)</td><td>${h[0]}, ${h[1]}</td></tr><tr class="win"><td>Input uv</td><td>${u.toFixed(3)}, ${v.toFixed(3)}</td></tr><tr><td>Output colour (r, g, b)</td><td>${c.map(x => x.toFixed(2)).join(', ')}</td></tr><tr><td>Runs of this code per frame</td><td>${GX * GY}</td></tr>`;
      code.textContent = SH[pick].code;
    }
    A.seg('pp-pick', v => { pick = v; f.draw(); table(); });
    A.pointer(cv, f.w, f.h, (p) => { hover = [clamp(Math.floor(p.x / (f.w / GX)), 0, GX - 1), clamp(Math.floor(p.y / (f.h / GY)), 0, GY - 1)]; f.draw(); table(); });
    table();
  })();

  /* ---------- lab: waves in random order ---------- */
  (function parallel() {
    const cv = document.getElementById('par-grid'); if (!cv) return;
    const GX = 32, GY = 16, N = GX * GY;
    let lanes = 32, order = [], done = new Int16Array(N).fill(-1), raf = 0, step = 0;
    const cores = A.range('par-cores', v => v, () => {});
    function plan() {
      const waves = Math.ceil(N / lanes); order = [...Array(waves).keys()];
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      done.fill(-1); step = 0;
    }
    const waveOf = k => Math.floor(k / lanes); // pixels are grouped in row-major blocks of `lanes`
    const f = A.fig(cv, (ctx, W, H) => {
      const cw = W / GX, ch = H / GY;
      for (let k = 0; k < N; k++) {
        const i = k % GX, j = Math.floor(k / GX), w = done[k];
        ctx.fillStyle = w < 0 ? col('surface-2') : `hsl(${(w * 47) % 360} 55% 55%)`;
        ctx.fillRect(i * cw, j * ch, cw - 1, ch - 1);
      }
    });
    function frame() {
      const per = cores.v; let any = false;
      for (let c = 0; c < per && step < order.length; c++, step++) { const w = order[step]; for (let k = w * lanes; k < Math.min(N, (w + 1) * lanes); k++) done[k] = step; any = true; }
      f.draw();
      document.getElementById('par-cap').textContent = `${Math.min(step, order.length)} of ${order.length} waves done. ${per} waves run at the same time; the order is different on every run.`;
      if (any && step < order.length) raf = setTimeout(frame, 140); else raf = 0;
    }
    function run() { clearTimeout(raf); plan(); frame(); }
    A.seg('par-lanes', v => { lanes = +v; run(); });
    document.getElementById('par-run').addEventListener('click', run);
    plan(); step = order.length; for (let k = 0; k < N; k++) done[k] = order.indexOf(waveOf(k)); f.draw();
    document.getElementById('par-cap').textContent = `${order.length} waves of ${lanes} pixels cover this ${GX} × ${GY} screen. Press Run to watch them.`;
  })();
})();
