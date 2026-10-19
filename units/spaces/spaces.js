/* Coordinate Spaces — formulas and labs */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180;
  const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  const P2 = (x, y) => `(${num(x)}, ${num(y)})`;

  /* ---------- scene shared by the two labs (top-down: x right, z up the page) ---------- */
  const CAM = { x: -1.5, z: -0.8, a: 55 * DEG, fov: 60 * DEG, near: 0.5, far: 9 };
  const LAMP = [[-0.35, -0.35], [0.35, -0.35], [0.35, 0.35], [-0.35, 0.35]]; // base square, local
  const BULB = [0, 1.2];
  function camAxes() { const f = [Math.cos(CAM.a), Math.sin(CAM.a)], r = [Math.sin(CAM.a), -Math.cos(CAM.a)]; return { f, r }; }
  function toView(p) { const { f, r } = camAxes(), d = [p[0] - CAM.x, p[1] - CAM.z]; return [d[0] * r[0] + d[1] * r[1], d[0] * f[0] + d[1] * f[1]]; }
  function toWorld(l, L) { const q = rot(l[0], l[1], L.r); return [q[0] + L.x, q[1] + L.z]; }
  function toClip(v) { const t = Math.tan(CAM.fov / 2); return [v[0] / (v[1] * t), (v[1] - CAM.near) / (CAM.far - CAM.near) * 2 - 1]; }
  function drawAxes(ctx, o, ax, ay, c, la, lb, s = 40) {
    A.arrow(ctx, o[0], o[1], o[0] + ax[0] * s, o[1] - ax[1] * s, c, 2, 8); A.arrow(ctx, o[0], o[1], o[0] + ay[0] * s, o[1] - ay[1] * s, c, 2, 8);
    A.text(ctx, la, o[0] + ax[0] * (s + 10), o[1] - ax[1] * (s + 10), c, 'center', true); A.text(ctx, lb, o[0] + ay[0] * (s + 10), o[1] - ay[1] * (s + 10), c, 'center', true);
  }

  (function threeSpaces() {
    const cv = document.getElementById('sp-cv'); if (!cv) return;
    const L = { x: 3, z: 2, r: 30 * DEG }; let f = null;
    A.range('sp-x', v => num(v), v => { L.x = v; if (f) up(); }); A.range('sp-z', v => num(v), v => { L.z = v; if (f) up(); }); A.range('sp-r', v => v + '°', v => { L.r = v * DEG; if (f) up(); });
    const S = 34, O = [170, 290], W2 = (p) => [O[0] + p[0] * S, O[1] - p[1] * S];
    f = A.fig(cv, (ctx, W, H) => {
      ctx.strokeStyle = alpha(col('line'), 0.6); ctx.lineWidth = 1;
      for (let x = -5; x <= 12; x++) { const [px] = W2([x, 0]); ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke(); }
      for (let z = -3; z <= 9; z++) { const [, py] = W2([0, z]); ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke(); }
      drawAxes(ctx, O, [1, 0], [0, 1], col('muted'), 'x', 'z', 46); A.text(ctx, 'world origin', O[0] + 6, O[1] + 16, col('muted'));
      // camera
      const cp = W2([CAM.x, CAM.z]), { f: fw, r } = camAxes();
      ctx.fillStyle = alpha(col('accent'), 0.08); ctx.beginPath(); ctx.moveTo(...cp);
      [-1, 1].forEach(sg => { const d = rot(fw[0], fw[1], sg * CAM.fov / 2); ctx.lineTo(cp[0] + d[0] * 600, cp[1] - d[1] * 600); }); ctx.closePath(); ctx.fill();
      drawAxes(ctx, cp, r, fw, col('accent'), 'x', 'z', 36); A.text(ctx, 'camera', cp[0] - 8, cp[1] + 16, col('accent'), 'right', true);
      // lamp
      const lo = W2([L.x, L.z]), base = LAMP.map(p => W2(toWorld(p, L))), b = W2(toWorld(BULB, L));
      ctx.fillStyle = alpha(col('ray'), 0.25); ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.beginPath(); base.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(...lo); ctx.lineTo(...b); ctx.stroke();
      drawAxes(ctx, lo, rot(1, 0, L.r), rot(0, 1, L.r), col('ray'), 'x', 'z', 30);
      ctx.fillStyle = col('ax-y'); ctx.beginPath(); ctx.arc(b[0], b[1], 8, 0, 7); ctx.fill(); A.text(ctx, 'bulb', b[0] + 12, b[1], col('ax-y'), 'left', true);
    });
    function up() {
      f.draw();
      const w = toWorld(BULB, L), v = toView(w);
      document.getElementById('sp-ro').innerHTML = `<tr><td>Object space (lamp pivot)</td><td>${P2(...BULB)}</td></tr><tr class="win"><td>World space</td><td>${P2(...w)}</td></tr><tr><td>View space (camera)</td><td>${P2(...v)}</td></tr><tr><td>Distance from camera</td><td>${num(Math.hypot(...v))}</td></tr>`;
    }
    up();
  })();

  (function chain() {
    const cv = document.getElementById('ch-cv'); if (!cv) return;
    const L = { x: 3, z: 2.5, r: 30 * DEG }; let space = 'obj';
    const map = {
      obj: p => { const d = [p[0] - L.x, p[1] - L.z]; return rot(d[0], d[1], -L.r); },
      world: p => p,
      view: p => toView(p),
      clip: p => toClip(toView(p))
    };
    const scale = { obj: 40, world: 34, view: 34, clip: 120 }, origin = { obj: [280, 210], world: [170, 290], view: [280, 310], clip: [280, 180] };
    const f = A.fig(cv, (ctx, W, H) => {
      const S = scale[space], O = origin[space], T = p => { const q = map[space](p); return [O[0] + q[0] * S, O[1] - q[1] * S]; };
      ctx.strokeStyle = alpha(col('line'), 0.5); ctx.lineWidth = 1;
      if (space === 'clip') { ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.strokeRect(O[0] - S, O[1] - S, 2 * S, 2 * S); A.text(ctx, '−1', O[0] - S - 6, O[1] + S + 10, col('accent'), 'right'); A.text(ctx, '+1', O[0] + S + 6, O[1] - S - 10, col('accent'), 'left'); }
      // origin cross
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(O[0] - 10, O[1]); ctx.lineTo(O[0] + 10, O[1]); ctx.moveTo(O[0], O[1] - 10); ctx.lineTo(O[0], O[1] + 10); ctx.stroke();
      A.text(ctx, space === 'clip' ? 'x and depth in NDC' : 'origin of this space', O[0] + 12, O[1] + 14, col('muted'));
      // frustum in all but clip
      if (space !== 'clip') {
        const { f: fw } = camAxes(), cp = [CAM.x, CAM.z];
        ctx.fillStyle = alpha(col('accent'), 0.07); ctx.beginPath(); ctx.moveTo(...T(cp));
        [-1, 1].forEach(sg => { const d = rot(fw[0], fw[1], sg * CAM.fov / 2); ctx.lineTo(...T([cp[0] + d[0] * 12, cp[1] + d[1] * 12])); }); ctx.closePath(); ctx.fill();
        const c = T(cp); ctx.fillStyle = col('accent'); ctx.beginPath(); ctx.arc(c[0], c[1], 7, 0, 7); ctx.fill(); A.text(ctx, 'camera', c[0] + 10, c[1] + 12, col('accent'), 'left', true);
      }
      const base = LAMP.map(p => T(toWorld(p, L))), b = T(toWorld(BULB, L)), lo = T([L.x, L.z]);
      ctx.fillStyle = alpha(col('ray'), 0.25); ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.beginPath(); base.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(...lo); ctx.lineTo(...b); ctx.stroke();
      ctx.fillStyle = col('ax-y'); ctx.beginPath(); ctx.arc(b[0], b[1], 8, 0, 7); ctx.fill();
    });
    const caps = {
      obj: 'Object space: the lamp\'s pivot is the origin. This is how the mesh is stored.',
      world: 'World space: after the model matrix M. The level\'s origin is the origin.',
      view: 'View space: after the view matrix V. The camera is at the origin, looking up the page (+z).',
      clip: 'NDC: after the projection matrix P and the divide by w. Everything visible is inside the −1 to +1 square. The depth axis here is drawn linear for clarity; real depth buffers are not.'
    };
    function up() {
      f.draw();
      const w = toWorld(BULB, L), v = toView(w), c = toClip(v);
      document.getElementById('ch-ro').innerHTML = `<tr${space === 'obj' ? ' class="on"' : ''}><td>Object</td><td>${P2(...BULB)}</td></tr><tr${space === 'world' ? ' class="on"' : ''}><td>World = M · object</td><td>${P2(...w)}</td></tr><tr${space === 'view' ? ' class="on"' : ''}><td>View = V · world</td><td>${P2(...v)}</td></tr><tr${space === 'clip' ? ' class="on"' : ''}><td>NDC = (P · view) / w</td><td>${P2(...c)}</td></tr>`;
      document.getElementById('ch-cap').textContent = caps[space];
    }
    A.seg('ch-pick', s => { space = s; up(); });
    up();
  })();

  /* ---------- formulas ---------- */
  const HOUSE = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.3], [0, 0.8], [-0.5, 0.3]];
  A.fx('xform', {
    title: 'Scale, rotate, translate',
    expr: "p' = ({s}·cos{th}·{px} − {s}·sin{th}·{py} + {tx},  {s}·sin{th}·{px} + {s}·cos{th}·{py} + {ty})",
    vars: {
      th: { sym: 'θ', name: 'rotation', unit: '°', min: -180, max: 180, value: 30, step: 1 },
      s: { name: 'scale', min: 0.2, max: 2.5, value: 1.5, step: 0.05 },
      tx: { sym: 't<sub>x</sub>', name: 'move x', min: -3, max: 3, value: 1.5, step: 0.1 },
      ty: { sym: 't<sub>y</sub>', name: 'move y', min: -2, max: 2, value: 0.5, step: 0.1 },
      px: { sym: 'x', name: 'local point x', min: -1, max: 1, value: 0, step: 0.05 },
      py: { sym: 'y', name: 'local point y', min: -1, max: 1, value: 0.8, step: 0.05 }
    },
    out: [{ sym: "x'", f: v => v.s * Math.cos(v.th * DEG) * v.px - v.s * Math.sin(v.th * DEG) * v.py + v.tx, color: 'ax-x' },
          { sym: "y'", f: v => v.s * Math.sin(v.th * DEG) * v.px + v.s * Math.cos(v.th * DEG) * v.py + v.ty, color: 'ax-y' }],
    sub: v => { const c = Math.cos(v.th * DEG) * v.s, sn = Math.sin(v.th * DEG) * v.s; return `p' = <b>${P2(c * v.px - sn * v.py + v.tx, sn * v.px + c * v.py + v.ty)}</b>`; },
    steps: v => { const c = Math.cos(v.th * DEG) * v.s, sn = Math.sin(v.th * DEG) * v.s; return [['matrix row 1', `[ ${num(c)}  ${num(-sn)}  ${num(v.tx)} ]`], ['row 2', `[ ${num(sn)}  ${num(c)}  ${num(v.ty)} ]`], ['row 3', '[ 0  0  1 ]']]; },
    draw(ctx, W, H, v, X) {
      const g = X.grid(ctx, W, H, { s: 50, cx: W / 2 - 30, cy: H / 2 + 20 });
      const T = p => { const q = rot(p[0] * v.s, p[1] * v.s, v.th * DEG); return [g.X(q[0] + v.tx), g.Y(q[1] + v.ty)]; };
      ctx.strokeStyle = alpha(col('muted'), 0.7); ctx.setLineDash([4, 4]); ctx.beginPath(); HOUSE.forEach((p, i) => i ? ctx.lineTo(g.X(p[0]), g.Y(p[1])) : ctx.moveTo(g.X(p[0]), g.Y(p[1]))); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = alpha(col('ray'), 0.22); ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.beginPath(); HOUSE.forEach((p, i) => i ? ctx.lineTo(...T(p)) : ctx.moveTo(...T(p))); ctx.closePath(); ctx.fill(); ctx.stroke();
      const o = T([0, 0]); X.arrow(ctx, ...o, ...T([0.6, 0]), col('ax-x'), 2); X.arrow(ctx, ...o, ...T([0, 0.6]), col('ax-y'), 2);
      X.dot(ctx, g.X(v.px), g.Y(v.py), col('muted'), 4); X.dot(ctx, ...T([v.px, v.py]), col('accent'), 6);
      X.label(ctx, "p'", T([v.px, v.py])[0] + 10, T([v.px, v.py])[1] - 8, col('accent'), 'left', true);
      X.label(ctx, 'dashed: the shape in its own (object) space', 10, H - 12, col('muted'));
    },
    plot: { x: 'th' }
  });

  A.fx('pointdir', {
    title: 'w = 1 for points, w = 0 for directions',
    expr: "v' = R({th})·(1, 0.5) + ({tx}, {ty})·{w}",
    vars: {
      w: { name: '1 = position, 0 = direction', values: [0, 1], labels: ['0', '1'], index: 0 },
      th: { sym: 'θ', name: 'rotation', unit: '°', min: -180, max: 180, value: 40, step: 1 },
      tx: { sym: 't<sub>x</sub>', name: 'object moved x', min: -3, max: 3, value: 2, step: 0.1 },
      ty: { sym: 't<sub>y</sub>', name: 'object moved y', min: -2, max: 2, value: 1, step: 0.1 }
    },
    out: [{ sym: "v'<sub>x</sub>", f: v => rot(1, 0.5, v.th * DEG)[0] + v.tx * v.w, color: 'ax-x' }, { sym: "v'<sub>y</sub>", f: v => rot(1, 0.5, v.th * DEG)[1] + v.ty * v.w, color: 'ax-y' }],
    sub: v => { const q = rot(1, 0.5, v.th * DEG); return `v' = ${P2(...q)} + ${P2(v.tx, v.ty)} × ${v.w} = <b>${P2(q[0] + v.tx * v.w, q[1] + v.ty * v.w)}</b> ${v.w ? '(a position: moved with the object)' : '(a direction: only turned)'}`; },
    draw(ctx, W, H, v, X) {
      const g = X.grid(ctx, W, H, { s: 50, cx: W / 2 - 60, cy: H / 2 + 30 }), q = rot(1, 0.5, v.th * DEG);
      // the object
      ctx.fillStyle = alpha(col('ray'), 0.2); ctx.strokeStyle = col('ray'); ctx.lineWidth = 2;
      const T = p => { const r = rot(p[0], p[1], v.th * DEG); return [g.X(r[0] + v.tx), g.Y(r[1] + v.ty)]; };
      ctx.beginPath(); [[-0.5, -0.4], [0.5, -0.4], [0.5, 0.4], [-0.5, 0.4]].forEach((p, i) => i ? ctx.lineTo(...T(p)) : ctx.moveTo(...T(p))); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (v.w) { X.dot(ctx, g.X(q[0] + v.tx), g.Y(q[1] + v.ty), col('accent'), 7); X.label(ctx, 'point (w = 1) moves with the object', g.X(q[0] + v.tx) + 10, g.Y(q[1] + v.ty) - 10, col('accent'), 'left', true); }
      else { X.arrow(ctx, g.X(0), g.Y(0), g.X(q[0]), g.Y(q[1]), col('accent'), 3); X.arrow(ctx, ...T([0, 0]), g.X(q[0] + v.tx), g.Y(q[1] + v.ty), alpha(col('accent'), 0.5), 2); X.label(ctx, 'direction (w = 0): only turned', g.X(q[0]) + 10, g.Y(q[1]) - 10, col('accent'), 'left', true); }
    },
    plot: { x: 'th' }
  });

  A.fx('persp', {
    title: 'Perspective projection',
    expr: 'y<sub>ndc</sub> = {y} / ({z} · tan({fov} / 2))',
    vars: {
      y: { name: 'height of the point above the view axis', unit: 'm', min: 0, max: 5, value: 1.8, step: 0.05 },
      z: { name: 'distance in front of the camera', unit: 'm', min: 0.5, max: 60, value: 6, log: true },
      fov: { name: 'vertical field of view', unit: '°', min: 20, max: 120, value: 60, step: 1 }
    },
    out: { sym: 'y<sub>ndc</sub>', f: v => v.y / (v.z * Math.tan(v.fov * DEG / 2)) },
    steps: v => [['tan(fov/2)', num(Math.tan(v.fov * DEG / 2))], ['z · tan(fov/2): half the view height at that distance', num(v.z * Math.tan(v.fov * DEG / 2)) + ' m']],
    draw(ctx, W, H, v, X) {
      // true side view: camera at the left, the frustum widens with distance
      const cx = 24, cy = H / 2, zv = Math.max(8, v.z * 1.25), sc = (W - cx - 16) / zv, t = Math.tan(v.fov * DEG / 2);
      const P = (z, y) => [cx + z * sc, cy - y * sc];
      ctx.fillStyle = alpha(col('accent'), 0.08); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(...P(zv, zv * t)); ctx.lineTo(...P(zv, -zv * t)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(...P(zv, zv * t)); ctx.moveTo(cx, cy); ctx.lineTo(...P(zv, -zv * t)); ctx.stroke();
      ctx.strokeStyle = alpha(col('muted'), 0.6); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(W - 10, cy); ctx.stroke(); ctx.setLineDash([]);
      // object
      const ob = P(v.z, 0), ot = P(v.z, v.y);
      ctx.strokeStyle = col('ray'); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(...ob); ctx.lineTo(...ot); ctx.stroke();
      // the view height at the object's distance
      ctx.strokeStyle = alpha(col('accent'), 0.9); ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(...P(v.z, -v.z * t)); ctx.lineTo(...P(v.z, v.z * t)); ctx.stroke(); ctx.setLineDash([]);
      // sight line to the top and the image plane at a fixed distance
      const zi = zv * 0.18, yi = v.y / v.z * zi;
      ctx.strokeStyle = alpha(col('ray'), 0.7); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(...ot); ctx.stroke();
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...P(zi, -zi * t)); ctx.lineTo(...P(zi, zi * t)); ctx.stroke();
      X.dot(ctx, ...P(zi, Math.min(yi, zi * t * 1.05)), col('ray'), 5);
      X.label(ctx, 'screen', P(zi, zi * t)[0], P(zi, zi * t)[1] - 10, col('ink'), 'center', true);
      X.dot(ctx, cx, cy, col('ink'), 5);
      X.label(ctx, `${num(v.y)} m at ${num(v.z)} m`, ot[0] + 8, Math.max(14, ot[1]), col('ray'), 'left', true);
      X.label(ctx, `visible height there: ${num(2 * v.z * t)} m`, Math.min(P(v.z, 0)[0] + 8, W - 190), Math.min(H - 14, P(v.z, -v.z * t)[1] - 8), col('accent'));
    },
    plot: { x: 'z', y: [0, 3] },
    note: 'y_ndc is the object\'s height divided by half the visible height at its own distance. The dot on the screen line moves the same way.'
  });

  A.fx('ndc', {
    title: 'NDC to UV to pixel',
    expr: 'pixel = ({n} · 0.5 + 0.5) · {W}',
    vars: {
      n: { sym: 'x<sub>ndc</sub>', name: 'NDC x', min: -1, max: 1, value: 0.25, step: 0.01 },
      W: { name: 'screen width', unit: 'px', values: [1280, 1920, 2560, 3840], index: 1 }
    },
    out: [{ sym: 'u', name: 'screen UV', f: v => v.n * 0.5 + 0.5, color: 'accent' }, { sym: 'pixel', f: v => (v.n * 0.5 + 0.5) * v.W, color: 'ink' }],
    sub: v => `u = ${A.pn(v.n)} · 0.5 + 0.5 = ${num(v.n * 0.5 + 0.5)} · pixel = ${num(v.n * 0.5 + 0.5)} · ${v.W} = <b>${num((v.n * 0.5 + 0.5) * v.W)}</b>`,
    draw(ctx, W, H, v, X) {
      const L = 30, R = W - 30, rows = [['NDC', -1, 1, v.n], ['UV', 0, 1, v.n * 0.5 + 0.5], ['pixel', 0, v.W, (v.n * 0.5 + 0.5) * v.W]];
      rows.forEach(([n, a, b, x], i) => {
        const y = 60 + i * 80, px = L + (x - a) / (b - a) * (R - L);
        ctx.strokeStyle = col('muted'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke();
        X.label(ctx, n, L, y - 22, col('ink'), 'left', true); X.label(ctx, num(a), L, y + 18, col('muted'), 'center'); X.label(ctx, num(b), R, y + 18, col('muted'), 'center');
        X.dot(ctx, px, y, col('accent'), 7); X.label(ctx, num(x), px, y - 18, col('accent'), 'center', true);
      });
    },
    plot: { x: 'n', y: [0, 1] }
  });

  A.fx('tbn', {
    title: 'Tangent space to world space',
    expr: 'n<sub>world</sub> = {nx}·T + {nz}·N',
    vars: {
      al: { sym: 'α', name: 'tilt of the surface in the world', unit: '°', min: -60, max: 60, value: 20, step: 1 },
      be: { sym: 'β', name: 'tilt stored in the normal map', unit: '°', min: -60, max: 60, value: 25, step: 1 },
      nx: { sym: 'x<sub>t</sub>', name: 'normal map x = sin β', derived: v => Math.sin(v.be * DEG) },
      nz: { sym: 'z<sub>t</sub>', name: 'normal map z = cos β', derived: v => Math.cos(v.be * DEG) }
    },
    out: [{ sym: 'n<sub>x</sub>', f: v => Math.sin(v.be * DEG) * Math.cos(v.al * DEG) - Math.cos(v.be * DEG) * Math.sin(v.al * DEG), color: 'ax-x' },
          { sym: 'n<sub>y</sub>', f: v => Math.sin(v.be * DEG) * Math.sin(v.al * DEG) + Math.cos(v.be * DEG) * Math.cos(v.al * DEG), color: 'ax-y' }],
    sub: v => { const a = v.al * DEG, b = v.be * DEG, T = [Math.cos(a), Math.sin(a)], N = [-Math.sin(a), Math.cos(a)];
      return `T = ${P2(...T)}, N = ${P2(...N)} · n = ${num(Math.sin(b))}·T + ${num(Math.cos(b))}·N = <b>${P2(Math.sin(b) * T[0] + Math.cos(b) * N[0], Math.sin(b) * T[1] + Math.cos(b) * N[1])}</b>`; },
    draw(ctx, W, H, v, X) {
      const cx = W / 2, cy = H / 2 + 50, a = v.al * DEG, b = v.be * DEG, T = [Math.cos(a), Math.sin(a)], N = [-Math.sin(a), Math.cos(a)], L = 110;
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - T[0] * 200, cy + T[1] * 200); ctx.lineTo(cx + T[0] * 200, cy - T[1] * 200); ctx.stroke();
      X.arrow(ctx, cx, cy, cx + T[0] * 80, cy - T[1] * 80, col('ax-x'), 2.5); X.label(ctx, 'T', cx + T[0] * 94, cy - T[1] * 94, col('ax-x'), 'center', true);
      X.arrow(ctx, cx, cy, cx + N[0] * 80, cy - N[1] * 80, col('ax-z'), 2.5); X.label(ctx, 'N', cx + N[0] * 94, cy - N[1] * 94, col('ax-z'), 'center', true);
      const n = [Math.sin(b) * T[0] + Math.cos(b) * N[0], Math.sin(b) * T[1] + Math.cos(b) * N[1]];
      ctx.setLineDash([4, 4]); ctx.strokeStyle = col('muted'); ctx.beginPath(); ctx.moveTo(cx + n[0] * L, cy - n[1] * L); ctx.lineTo(cx + Math.cos(b) * N[0] * L, cy - Math.cos(b) * N[1] * L); ctx.stroke(); ctx.setLineDash([]);
      X.arrow(ctx, cx, cy, cx + n[0] * L, cy - n[1] * L, col('accent'), 3.5); X.label(ctx, 'world normal', cx + n[0] * L + 8, cy - n[1] * L - 10, col('accent'), 'left', true);
    },
    plot: { x: 'be', y: [-1.1, 1.1] }
  });
})();
