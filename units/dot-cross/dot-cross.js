/* Dot and Cross Product — formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180, r1 = x => Math.round(x * 10) / 10;
  const G = { s: 44, cx: 220, cy: 150 };
  const ext = { min: -4.5, max: 4.5, step: 0.1 }, exty = { min: -3, max: 3, step: 0.1 };
  function picker(points) {
    let cur = null;
    return (p, kind, v) => {
      const x = (p.x - G.cx) / G.s, y = (G.cy - p.y) / G.s;
      if (kind === 'down') { let best = Infinity; points(v).forEach(([kx, ky, px, py]) => { const d = Math.hypot(px - x, py - y); if (d < best) { best = d; cur = [kx, ky]; } }); }
      if (!cur) return null;
      return { [cur[0]]: clamp(r1(x), -4.5, 4.5), [cur[1]]: clamp(r1(y), -3, 3) };
    };
  }
  function angleArc(ctx, g, a0, a1, r, c) { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.X(0), g.Y(0), r, -a0, -a1, a1 > a0); ctx.stroke(); }

  A.fx('dot', {
    title: 'Dot product',
    expr: 'a·b = {ax}·{bx} + {ay}·{by}',
    vars: { ax: Object.assign({ sym: 'a<sub>x</sub>', name: 'a, x', value: 3 }, ext), ay: Object.assign({ sym: 'a<sub>y</sub>', name: 'a, y', value: 1 }, exty),
            bx: Object.assign({ sym: 'b<sub>x</sub>', name: 'b, x', value: 1 }, ext), by: Object.assign({ sym: 'b<sub>y</sub>', name: 'b, y', value: 2 }, exty) },
    out: { sym: 'a·b', f: v => v.ax * v.bx + v.ay * v.by },
    steps: v => [['aₓbₓ', num(v.ax * v.bx)], ['a_y b_y', num(v.ay * v.by)]],
    draw(ctx, W, H, v, X) {
      const g = X.grid(ctx, W, H, G), d = v.ax * v.bx + v.ay * v.by;
      X.arrow(ctx, g.X(0), g.Y(0), g.X(v.ax), g.Y(v.ay), col('ray'), 3);
      X.arrow(ctx, g.X(0), g.Y(0), g.X(v.bx), g.Y(v.by), col('accent'), 3);
      X.label(ctx, 'a', g.X(v.ax) + 10, g.Y(v.ay), col('ray'), 'left', true); X.label(ctx, 'b', g.X(v.bx) + 10, g.Y(v.by), col('accent'), 'left', true);
      const c = d > 0.05 ? col('good') : d < -0.05 ? col('bad') : col('ink');
      X.label(ctx, d > 0.05 ? 'positive: roughly the same way' : d < -0.05 ? 'negative: pointing apart' : 'zero: at a right angle', 12, H - 14, c, 'left', true);
    },
    drag: picker(v => [['ax', 'ay', v.ax, v.ay], ['bx', 'by', v.bx, v.by]]),
    plot: { x: 'bx' }
  });

  A.fx('angle', {
    title: 'Dot product from lengths and angle',
    expr: 'a·b = {La} · {Lb} · cos {th}',
    vars: { th: { sym: 'θ', name: 'angle between a and b', unit: '°', min: 0, max: 180, value: 60, step: 1 },
            La: { sym: '|a|', name: 'length of a', min: 0, max: 3, value: 1, step: 0.05 },
            Lb: { sym: '|b|', name: 'length of b', min: 0, max: 3, value: 1, step: 0.05 } },
    out: { sym: 'a·b', f: v => v.La * v.Lb * Math.cos(v.th * DEG) },
    steps: v => [['cos θ', num(Math.cos(v.th * DEG))]],
    draw(ctx, W, H, v, X) {
      const g = X.grid(ctx, W, H, { s: 70, cx: W / 2, cy: H - 60 });
      X.arrow(ctx, g.X(0), g.Y(0), g.X(v.La), g.Y(0), col('ray'), 3);
      X.arrow(ctx, g.X(0), g.Y(0), g.X(v.Lb * Math.cos(v.th * DEG)), g.Y(v.Lb * Math.sin(v.th * DEG)), col('accent'), 3);
      angleArc(ctx, g, 0, v.th * DEG, 34, col(X.vars.th.color));
      X.label(ctx, 'θ = ' + Math.round(v.th) + '°', g.X(0) + 40, g.Y(0) - 18, col(X.vars.th.color), 'left', true);
      X.label(ctx, 'a', g.X(v.La) + 8, g.Y(0) + 12, col('ray'), 'left', true);
      X.label(ctx, 'b', g.X(v.Lb * Math.cos(v.th * DEG)) + 8, g.Y(v.Lb * Math.sin(v.th * DEG)) - 10, col('accent'), 'left', true);
    },
    plot: { x: 'th', y: [-9, 9] },
    note: 'With both lengths at 1 the curve is the cosine itself: 1 at 0°, 0 at 90°, −1 at 180°.'
  });

  A.fx('project', {
    title: 'Projection of a onto b̂',
    expr: 's = a · b̂ = {ax}·cos {phi} + {ay}·sin {phi}',
    vars: { ax: Object.assign({ sym: 'a<sub>x</sub>', name: 'a, x', value: 3 }, ext), ay: Object.assign({ sym: 'a<sub>y</sub>', name: 'a, y', value: 2 }, exty),
            phi: { sym: 'φ', name: 'direction of b̂', unit: '°', min: -180, max: 180, value: 15, step: 1 } },
    out: { sym: 's', f: v => v.ax * Math.cos(v.phi * DEG) + v.ay * Math.sin(v.phi * DEG) },
    draw(ctx, W, H, v, X) {
      const g = X.grid(ctx, W, H, G), bx = Math.cos(v.phi * DEG), by = Math.sin(v.phi * DEG), s = v.ax * bx + v.ay * by;
      ctx.strokeStyle = alpha(col('accent'), 0.5); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(g.X(-bx * 9), g.Y(-by * 9)); ctx.lineTo(g.X(bx * 9), g.Y(by * 9)); ctx.stroke();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = col('muted'); ctx.beginPath(); ctx.moveTo(g.X(v.ax), g.Y(v.ay)); ctx.lineTo(g.X(bx * s), g.Y(by * s)); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 6; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(g.X(0), g.Y(0)); ctx.lineTo(g.X(bx * s), g.Y(by * s)); ctx.stroke(); ctx.globalAlpha = 1;
      X.arrow(ctx, g.X(0), g.Y(0), g.X(v.ax), g.Y(v.ay), col('ray'), 3);
      X.arrow(ctx, g.X(0), g.Y(0), g.X(bx), g.Y(by), col('accent'), 3.5);
      X.label(ctx, 'a', g.X(v.ax) + 10, g.Y(v.ay), col('ray'), 'left', true); X.label(ctx, 'b̂', g.X(bx) + 6, g.Y(by) - 12, col('accent'), 'left', true);
      X.label(ctx, 'shadow length s = ' + num(s), 12, H - 14, col('ink'), 'left', true);
    },
    drag: (p) => ({ ax: clamp(r1((p.x - G.cx) / G.s), -4.5, 4.5), ay: clamp(r1((G.cy - p.y) / G.s), -3, 3) }),
    plot: { x: 'phi' },
    note: 'Drag a. The thick dark segment on b̂\'s line is the projection.'
  });

  A.fx('lambert', {
    title: 'Lambert diffuse',
    expr: 'D = saturate(N · L) = max(0, cos({phi} − {al}))',
    vars: { al: { sym: 'α', name: 'direction the light comes from', unit: '°', min: -180, max: 180, value: 40, step: 1 },
            phi: { sym: 'φ', name: 'where on the outline (normal direction)', unit: '°', min: -180, max: 180, value: 100, step: 1 } },
    out: { sym: 'D', f: v => Math.max(0, Math.cos((v.phi - v.al) * DEG)) },
    draw(ctx, W, H, v, X) {
      const R = 100, cx = W / 2 - 20, cy = H / 2 + 6, L = [Math.cos(v.al * DEG), Math.sin(v.al * DEG), 0];
      const img = ctx.createImageData(2 * R, 2 * R);
      for (let j = 0; j < 2 * R; j++) for (let i = 0; i < 2 * R; i++) {
        const x = (i - R + 0.5) / R, y = -(j - R + 0.5) / R, r2 = x * x + y * y; if (r2 > 1) continue;
        const n = [x, y, Math.sqrt(1 - r2)], d = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
        const g = Math.pow(0.03 + 0.85 * d, 1 / 2.2) * 255, k = (j * 2 * R + i) * 4;
        img.data[k] = g * 1.0; img.data[k + 1] = g * 0.93; img.data[k + 2] = g * 0.82; img.data[k + 3] = 255;
      }
      const off = document.createElement('canvas'); off.width = 2 * R; off.height = 2 * R; off.getContext('2d').putImageData(img, 0, 0); ctx.drawImage(off, cx - R, cy - R);
      // light arrow coming in from direction alpha
      const lx = cx + Math.cos(v.al * DEG) * (R + 70), ly = cy - Math.sin(v.al * DEG) * (R + 70);
      X.arrow(ctx, lx, ly, cx + Math.cos(v.al * DEG) * (R + 14), cy - Math.sin(v.al * DEG) * (R + 14), col('accent'), 3, 11);
      X.label(ctx, 'light', lx, ly - 12, col('accent'), 'center', true);
      // probe point and its normal
      const px = cx + Math.cos(v.phi * DEG) * R, py = cy - Math.sin(v.phi * DEG) * R;
      X.arrow(ctx, px, py, px + Math.cos(v.phi * DEG) * 50, py - Math.sin(v.phi * DEG) * 50, col('ray'), 3);
      X.arrow(ctx, px, py, px + Math.cos(v.al * DEG) * 50, py - Math.sin(v.al * DEG) * 50, alpha(col('accent'), 0.9), 2);
      X.dot(ctx, px, py, col('ink'), 5);
      X.label(ctx, 'N', px + Math.cos(v.phi * DEG) * 62, py - Math.sin(v.phi * DEG) * 62, col('ray'), 'center', true);
      X.label(ctx, 'D = ' + num(Math.max(0, Math.cos((v.phi - v.al) * DEG))), 12, H - 14, col('ink'), 'left', true);
    },
    drag: (p, kind, v) => ({ phi: Math.round(Math.atan2(-(p.y - (280 / 2 + 6)), p.x - (440 / 2 - 20)) / DEG) }),
    plot: { x: 'phi', y: [-0.1, 1.1] },
    note: 'Drag around the sphere to move the probe point. The graph is a cosine with its negative half cut off.'
  });

  A.fx('reflect', {
    title: 'Reflection',
    expr: 'r = d − 2({dn})·n,   d = (cos {be}, sin {be}),  n = (0, 1)',
    vars: { be: { sym: 'β', name: 'direction of the incoming ray d', unit: '°', min: -175, max: -5, value: -40, step: 1 },
            dn: { sym: 'd·n', name: 'part of d going into the surface', derived: v => Math.sin(v.be * DEG) } },
    out: [{ sym: 'r<sub>x</sub>', f: v => Math.cos(v.be * DEG), color: 'ax-x' }, { sym: 'r<sub>y</sub>', f: v => -Math.sin(v.be * DEG), color: 'ax-y' }],
    sub: v => { const dx = Math.cos(v.be * DEG), dy = Math.sin(v.be * DEG); return `d = (${num(dx)}, ${num(dy)}) · d·n = ${num(dy)} · r = d − 2·(${num(dy)})·(0, 1) = <b>(${num(dx)}, ${num(-dy)})</b>`; },
    draw(ctx, W, H, v, X) {
      const cx = W / 2, cy = H - 50, L = 150, dx = Math.cos(v.be * DEG), dy = Math.sin(v.be * DEG);
      ctx.fillStyle = alpha(col('muted'), 0.15); ctx.fillRect(0, cy, W, H - cy); ctx.strokeStyle = col('muted'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
      X.arrow(ctx, cx, cy, cx, cy - 70, col('ax-y'), 2.5); X.label(ctx, 'n', cx + 8, cy - 72, col('ax-y'), 'left', true);
      X.arrow(ctx, cx - dx * L, cy + dy * L, cx, cy, col('ray'), 3); X.label(ctx, 'd (incoming)', cx - dx * L - 6, cy + dy * L - 12, col('ray'), 'center', true);
      X.arrow(ctx, cx, cy, cx + dx * L, cy + dy * L, col('accent'), 3);
      X.label(ctx, 'r (reflected)', cx + dx * L + 6, cy + dy * L - 12, col('accent'), 'center', true);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = col('muted'); ctx.beginPath(); ctx.moveTo(cx - dx * L, cy + dy * L); ctx.lineTo(cx - dx * L, cy); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, 'd·n', cx - dx * L - 8, cy + dy * L / 2, col('muted'), 'right');
    },
    plot: { x: 'be', y: [-1.1, 1.1] }
  });

  /* cross product with a small oblique 3D view */
  const P3 = (x, y, z) => [x + z * 0.5, -y - z * 0.32]; // z drawn going into the screen (left-handed, as in Unity)
  A.fx('cross', {
    title: 'Cross product',
    expr: 'a × b = ({ay}{bz} − {az}{by},  {az}{bx} − {ax}{bz},  {ax}{by} − {ay}{bx})',
    vars: {
      ax: { sym: 'a<sub>x</sub>', name: 'a, x', min: -2, max: 2, value: 1.5, step: 0.1 }, ay: { sym: 'a<sub>y</sub>', name: 'a, y', min: -2, max: 2, value: 0, step: 0.1 }, az: { sym: 'a<sub>z</sub>', name: 'a, z', min: -2, max: 2, value: 0, step: 0.1 },
      bx: { sym: 'b<sub>x</sub>', name: 'b, x', min: -2, max: 2, value: 0.5, step: 0.1 }, by: { sym: 'b<sub>y</sub>', name: 'b, y', min: -2, max: 2, value: 1.2, step: 0.1 }, bz: { sym: 'b<sub>z</sub>', name: 'b, z', min: -2, max: 2, value: 0, step: 0.1 }
    },
    out: [
      { sym: '(a×b)<sub>x</sub>', f: v => v.ay * v.bz - v.az * v.by, color: 'ax-x' },
      { sym: '(a×b)<sub>y</sub>', f: v => v.az * v.bx - v.ax * v.bz, color: 'ax-y' },
      { sym: '(a×b)<sub>z</sub>', f: v => v.ax * v.by - v.ay * v.bx, color: 'ax-z' }
    ],
    sub: v => { const c = [v.ay * v.bz - v.az * v.by, v.az * v.bx - v.ax * v.bz, v.ax * v.by - v.ay * v.bx]; return `a × b = <b>(${c.map(x => num(x)).join(', ')})</b> · length ${num(Math.hypot(...c))} = area of the parallelogram`; },
    draw(ctx, W, H, v, X) {
      const s = 55, cx = W / 2 - 20, cy = H / 2 + 30, pt = (x, y, z) => { const [a, b] = P3(x, y, z); return [cx + a * s, cy + b * s]; };
      const axes = [[[2.2, 0, 0], 'x', 'ax-x'], [[0, 2.2, 0], 'y', 'ax-y'], [[0, 0, 2.2], 'z', 'ax-z']];
      axes.forEach(([d, n, c]) => { const [x, y] = pt(...d); ctx.strokeStyle = alpha(col(c), 0.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); X.label(ctx, n, x + 4, y, alpha(col(c), 0.8)); });
      const a = [v.ax, v.ay, v.az], b = [v.bx, v.by, v.bz], c = [v.ay * v.bz - v.az * v.by, v.az * v.bx - v.ax * v.bz, v.ax * v.by - v.ay * v.bx];
      const pa = pt(...a), pb = pt(...b), pab = pt(a[0] + b[0], a[1] + b[1], a[2] + b[2]);
      ctx.fillStyle = alpha(col('ray'), 0.15); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(...pa); ctx.lineTo(...pab); ctx.lineTo(...pb); ctx.closePath(); ctx.fill();
      X.arrow(ctx, cx, cy, ...pa, col('ray'), 3); X.arrow(ctx, cx, cy, ...pb, col('accent'), 3);
      const sc = 0.6, pc = pt(c[0] * sc, c[1] * sc, c[2] * sc); X.arrow(ctx, cx, cy, ...pc, col('ink'), 3.5);
      X.label(ctx, 'a', pa[0] + 8, pa[1], col('ray'), 'left', true); X.label(ctx, 'b', pb[0] + 8, pb[1], col('accent'), 'left', true); X.label(ctx, 'a × b (scaled 0.6)', pc[0] + 8, pc[1] - 8, col('ink'), 'left', true);
    },
    plot: { x: 'by', y: [-4.5, 4.5] },
    note: 'Unity and Unreal are left-handed, so with a along +x and b along +y the result points along +z, into the screen in Unity\'s default view.'
  });
})();
