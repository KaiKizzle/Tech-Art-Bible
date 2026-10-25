/* Rooms Behind Glass — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180;
  const frac = x => x - Math.floor(x);
  const hash = n => frac(Math.sin(n * 12.9898 + 78.233) * 43758.5453);

  A.fx('roomuv', {
    title: 'Window position in the room rectangle',
    expr: 'u<sub>left</sub> = ({c} − {w} / 2) / {W},   u<sub>right</sub> = ({c} + {w} / 2) / {W}',
    vars: { W: { name: 'room width', unit: 'm', min: 1.5, max: 8, value: 4, step: 0.1 }, w: { name: 'window width', unit: 'm', min: 0.3, max: 4, value: 1, step: 0.05 },
            c: { name: 'window centre, from the room\'s left wall', unit: 'm', min: 0, max: 8, value: 2, step: 0.05 } },
    out: [{ sym: 'u<sub>left</sub>', f: v => (v.c - v.w / 2) / v.W, color: 'ax-x' }, { sym: 'u<sub>right</sub>', f: v => (v.c + v.w / 2) / v.W, color: 'accent' }],
    sub: v => `roomUV.x runs from <b>${num((v.c - v.w / 2) / v.W)}</b> to <b>${num((v.c + v.w / 2) / v.W)}</b> across this window${(v.c - v.w / 2) < 0 || (v.c + v.w / 2) > v.W ? ' (the window sticks out of the room: impossible on a real facade)' : ''}`,
    draw(ctx, W, H, v, X) {
      const L = 40, R = W - 40, s = (R - L) / 8, y0 = 50, h = 150;
      ctx.fillStyle = alpha(col('muted'), 0.2); ctx.fillRect(L, y0, v.W * s, h); ctx.setLineDash([5, 4]); ctx.strokeStyle = col('muted'); ctx.strokeRect(L, y0, v.W * s, h); ctx.setLineDash([]);
      ctx.fillStyle = alpha(col('ray'), 0.5); ctx.fillRect(L + (v.c - v.w / 2) * s, y0 + 30, v.w * s, 90); ctx.strokeStyle = col('ray'); ctx.strokeRect(L + (v.c - v.w / 2) * s, y0 + 30, v.w * s, 90);
      X.label(ctx, 'room rectangle', L, y0 - 10, col('muted')); X.label(ctx, 'glass', L + v.c * s, y0 + 80, col('ink'), 'center', true);
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L, y0 + h + 22); ctx.lineTo(L + v.W * s, y0 + h + 22); ctx.stroke();
      [0, 0.5, 1].forEach(u => X.label(ctx, String(u), L + u * v.W * s, y0 + h + 40, col('accent'), 'center'));
      X.label(ctx, 'roomUV.x', L + v.W * s + 8, y0 + h + 26, col('accent'));
    },
    plot: { x: 'c', y: [-0.2, 1.2] }
  });

  A.fx('viewvec', {
    title: 'View vector (top view)',
    expr: 'V = P − C = ({px} − {cx}, 0 − ({cz}))',
    vars: { cx: { sym: 'C<sub>x</sub>', name: 'camera across the facade', unit: 'm', min: -6, max: 6, value: -2, step: 0.1 }, cz: { sym: 'C<sub>z</sub>', name: 'camera distance from the facade', unit: 'm', min: 1, max: 12, value: 6, step: 0.1 },
            px: { sym: 'P<sub>x</sub>', name: 'glass pixel across the facade', unit: 'm', min: -3, max: 3, value: 1, step: 0.05 } },
    out: [{ sym: 'V<sub>x</sub>', f: v => v.px - v.cx, color: 'ax-x' }, { sym: 'V<sub>z</sub>', f: v => -v.cz, color: 'ax-z' }, { sym: 'angle', unit: '°', f: v => Math.atan2(v.px - v.cx, v.cz) / DEG, fmt: x => num(x) + '°', color: 'accent' }],
    sub: v => `V = (${num(v.px)} − ${A.pn(v.cx)}, −${num(v.cz)}) = <b>(${num(v.px - v.cx)}, ${num(-v.cz)})</b>, ${num(Math.abs(Math.atan2(v.px - v.cx, v.cz) / DEG))}° from straight in`,
    draw(ctx, W, H, v, X) {
      const s = 22, ox = W / 2, oy = 60, P = (x, z) => [ox + x * s, oy + z * s];
      ctx.fillStyle = alpha(col('muted'), 0.25); ctx.fillRect(0, oy - 50, W, 50); X.label(ctx, 'room (behind the facade)', 10, oy - 30, col('muted'));
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(...P(-3, 0)); ctx.lineTo(...P(3, 0)); ctx.stroke(); X.label(ctx, 'glass', P(3, 0)[0] + 6, oy + 4, col('ink'));
      const C = P(v.cx, v.cz), Pp = P(v.px, 0);
      ctx.strokeStyle = alpha(col('muted'), 0.7); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(...C); ctx.lineTo(...Pp); ctx.stroke();
      const dx = v.px - v.cx, dz = -v.cz, l = Math.hypot(dx, dz), Q = P(v.px + dx / l * 2, dz / l * 2);
      X.arrow(ctx, Pp[0], Pp[1], Q[0], Q[1], col('ray'), 3);
      X.dot(ctx, ...C, col('ink'), 6); X.label(ctx, 'camera C', C[0] + 8, C[1] + 4, col('ink'), 'left', true);
      X.dot(ctx, ...Pp, col('accent'), 6); X.label(ctx, 'P', Pp[0] + 8, Pp[1] + 16, col('accent'), 'left', true);
      X.label(ctx, 'grey: rasterization found P · blue: the shader continues the ray', 10, H - 10, col('muted'));
    },
    plot: { x: 'px', y: [-12, 12] }
  });

  A.fx('viewts', {
    title: 'View vector in room space (top view)',
    expr: 'viewTS.x = dot(V, T),   viewTS.z = dot(V, N),   building turned by {yaw}',
    vars: { yaw: { sym: 'yaw', name: 'building rotation', unit: '°', min: -70, max: 70, value: 25, step: 1 }, a: { sym: 'α', name: 'direction of V in the world', unit: '°', min: -80, max: 80, value: 10, step: 1 } },
    out: [{ sym: 'viewTS.x', f: v => Math.sin((v.a - v.yaw) * DEG), color: 'ax-x' }, { sym: 'viewTS.z', f: v => -Math.cos((v.a - v.yaw) * DEG), color: 'ax-z' }],
    sub: v => { const r = (v.a - v.yaw) * DEG; return `T = (cos ${v.yaw}°, sin ${v.yaw}°), N = (−sin ${v.yaw}°, −cos ${v.yaw}°) → viewTS = <b>(${num(Math.sin(r))}, ${num(-Math.cos(r))})</b>: the same arrow, measured along the room's axes`; },
    draw(ctx, W, H, v, X) {
      const c = [W / 2, H / 2 + 10], L = 100, y = v.yaw * DEG, a = v.a * DEG;
      const T = [Math.cos(y), Math.sin(y)], N = [-Math.sin(y), -Math.cos(y)], V = [Math.sin(a), Math.cos(a)];   // screen: x right, y down
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(c[0] - T[0] * 130, c[1] - T[1] * 130); ctx.lineTo(c[0] + T[0] * 130, c[1] + T[1] * 130); ctx.stroke();
      X.label(ctx, 'facade', c[0] + T[0] * 130 + 6, c[1] + T[1] * 130, col('ink'));
      X.arrow(ctx, c[0], c[1], c[0] + T[0] * L * 0.8, c[1] + T[1] * L * 0.8, col('ax-x'), 2.5); X.label(ctx, 'T', c[0] + T[0] * L * 0.8 + 6, c[1] + T[1] * L * 0.8 + 14, col('ax-x'), 'left', true);
      X.arrow(ctx, c[0], c[1], c[0] + N[0] * L * 0.8, c[1] + N[1] * L * 0.8, col('ax-z'), 2.5); X.label(ctx, 'N (to the street)', c[0] + N[0] * L * 0.8 + 6, c[1] + N[1] * L * 0.8, col('ax-z'), 'left', true);
      X.arrow(ctx, c[0] - V[0] * L, c[1] - V[1] * L, c[0], c[1], col('ray'), 3); X.label(ctx, 'V (from the camera)', c[0] - V[0] * L - 8, c[1] - V[1] * L - 6, col('ray'), 'right', true);
      // projections of V (as it arrives) onto T and N, drawn from the glass point
      const vx = V[0] * T[0] + V[1] * T[1], vz = V[0] * N[0] + V[1] * N[1];
      ctx.setLineDash([4, 4]); ctx.lineWidth = 2;
      ctx.strokeStyle = col('ax-x'); ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0] + T[0] * vx * L, c[1] + T[1] * vx * L); ctx.stroke();
      ctx.strokeStyle = col('ax-z'); ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0] + N[0] * vz * L, c[1] + N[1] * vz * L); ctx.stroke(); ctx.setLineDash([]);
      X.dot(ctx, c[0], c[1], col('accent'), 5);
      X.label(ctx, 'dashed: V\'s shadows on T and on N', 10, H - 10, col('muted'));
    },
    plot: { x: 'a', y: [-1, 1] }
  });

  const ub = v => { const r = v.a * DEG, Vx = Math.sin(r), Vz = -Math.cos(r); return { ox: v.u * 2 - 1, dx: Vx / (v.W / 2), dz: -Vz / v.D, Vx, Vz }; };
  A.fx('unitbox', {
    title: 'Metres to unit box (top view)',
    expr: 'o.x = {u} · 2 − 1,   d.x = viewTS.x / ({W} / 2),   d.z = −viewTS.z / {D}',
    vars: { u: { name: 'roomUV.x of the pixel', min: 0.02, max: 0.98, value: 0.3, step: 0.01 }, a: { sym: 'α', name: 'view angle from straight in', unit: '°', min: -75, max: 75, value: 40, step: 1 },
            W: { name: 'room width', unit: 'm', min: 1, max: 10, value: 6, step: 0.1 }, D: { name: 'room depth', unit: 'm', min: 1, max: 10, value: 3, step: 0.1 } },
    out: [{ sym: 'o.x', f: v => ub(v).ox, color: 'ax-y' }, { sym: 'd.x', f: v => ub(v).dx, color: 'ax-x' }, { sym: 'd.z', f: v => ub(v).dz, color: 'ax-z' }],
    sub: v => { const q = ub(v); return `viewTS = (${num(q.Vx)}, ${num(q.Vz)}) → o.x = <b>${num(q.ox)}</b>, d = <b>(${num(q.dx)}, ${num(q.dz)})</b>`; },
    draw(ctx, W, H, v, X) {
      const q = ub(v), hw = (W - 50) / 4, half = [[20, 'real room, metres'], [W / 2 + 5, 'unit box']];
      // real room
      const sR = Math.min((hw * 2 - 10) / v.W, (H - 70) / v.D), rx = 20, ry = 40;
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.5; ctx.strokeRect(rx, ry, v.W * sR, v.D * sR);
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(rx, ry + v.D * sR); ctx.lineTo(rx + v.W * sR, ry + v.D * sR); ctx.stroke();
      const hitR = (ox0, dx0, dz0, w, d) => { let t = Infinity; if (dx0 > 1e-6) t = Math.min(t, (w - ox0) / dx0); if (dx0 < -1e-6) t = Math.min(t, (0 - ox0) / dx0); t = Math.min(t, d / dz0); return t; };
      const x0 = v.u * v.W, tR = hitR(x0, q.Vx, -q.Vz, v.W, v.D);
      X.arrow(ctx, rx + x0 * sR, ry + v.D * sR, rx + (x0 + q.Vx * tR) * sR, ry + (v.D + q.Vz * tR) * sR, col('ray'), 2.5);
      X.label(ctx, half[0][1], rx, 24, col('muted'));
      // unit box: x −1..1, z 0..1
      const bx = W / 2 + 10, bw = W / 2 - 30, bh = H - 70, BX = x => bx + (x + 1) / 2 * bw, BZ = z => 40 + (1 - z) * bh;
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.5; ctx.strokeRect(bx, 40, bw, bh);
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx, BZ(0)); ctx.lineTo(bx + bw, BZ(0)); ctx.stroke();
      let t = 1 / q.dz; if (Math.abs(q.dx) > 1e-6) t = Math.min(t, (Math.sign(q.dx) - q.ox) / q.dx);
      X.arrow(ctx, BX(q.ox), BZ(0), BX(q.ox + q.dx * t), BZ(q.dz * t), col('ray'), 2.5);
      X.label(ctx, half[1][1], bx, 24, col('muted')); X.label(ctx, '−1', bx, BZ(0) + 16, col('muted'), 'center'); X.label(ctx, '1', bx + bw, BZ(0) + 16, col('muted'), 'center'); X.label(ctx, 'z = 1 (back wall)', bx + bw - 4, 54, col('muted'), 'right');
    },
    plot: { x: 'a', y: [-3, 3] },
    note: 'The hit lands on the same wall at the same fraction in both pictures, whatever W and D are.'
  });

  const slab = v => { const r = v.yaw * DEG; let dx = Math.sin(r), dz = Math.cos(r); dx = Math.abs(dx) < 1e-5 ? 1e-5 : dx; const tx = Math.abs(1 / dx) - v.ox / dx, tz = 1 / dz, t = Math.min(tx, tz); return { dx, dz, tx, tz, t, wall: tx < tz ? (dx > 0 ? 'right wall' : 'left wall') : 'back wall' }; };
  A.fx('slab2', {
    title: 'Wall hit (top view)',
    expr: 't<sub>x</sub> = |1/d.x| − {ox}/d.x,   t<sub>z</sub> = 1/d.z,   t = min(t<sub>x</sub>, t<sub>z</sub>),   d = (sin {yaw}, cos {yaw})',
    vars: { ox: { sym: 'o.x', name: 'start across the box', min: -0.98, max: 0.98, value: -0.4, step: 0.01 }, yaw: { sym: 'yaw', name: 'ray direction', unit: '°', min: -80, max: 80, value: 38, step: 1 } },
    out: [{ sym: 't<sub>x</sub>', f: v => slab(v).tx, color: 'ax-x' }, { sym: 't<sub>z</sub>', f: v => slab(v).tz, color: 'ax-z' }, { sym: 't', f: v => slab(v).t, color: 'accent' }],
    sub: v => { const q = slab(v); return `t<sub>x</sub> = ${num(Math.abs(1 / q.dx))} − ${A.pn(v.ox)} · ${num(1 / q.dx)} = ${num(q.tx)},   t<sub>z</sub> = ${num(q.tz)} → <b>t = ${num(q.t)}: ${q.wall}</b>`; },
    draw(ctx, W, H, v, X) {
      const q = slab(v), bw = Math.min(W - 80, H - 60), bx = (W - bw) / 2, by = 20, BX = x => bx + (x + 1) / 2 * bw, BZ = z => by + (1 - z) * bw;
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw, bw);
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx, BZ(0)); ctx.lineTo(bx + bw, BZ(0)); ctx.stroke(); X.label(ctx, 'glass', bx + bw + 6, BZ(0) + 4, col('ink'));
      const far = Math.min(Math.max(q.tx, q.tz), 4);
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = alpha(col('ray'), 0.6); ctx.beginPath(); ctx.moveTo(BX(v.ox), BZ(0)); ctx.lineTo(BX(v.ox + q.dx * far), BZ(q.dz * far)); ctx.stroke(); ctx.restore();
      X.arrow(ctx, BX(v.ox), BZ(0), BX(v.ox + q.dx * q.t), BZ(q.dz * q.t), col('ray'), 3);
      [[q.tx, 'ax-x', 't_x'], [q.tz, 'ax-z', 't_z']].forEach(([t, c, n]) => { const p = [BX(v.ox + q.dx * t), BZ(q.dz * t)]; if (p[0] < -50 || p[0] > W + 50 || p[1] < -50) return; ctx.strokeStyle = col(c); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, 7); t === q.t ? (ctx.fillStyle = col(c), ctx.fill()) : ctx.stroke(); X.label(ctx, n, p[0] + 9, p[1] - 6, col(c), 'left', true); });
      X.label(ctx, 'hollow: the crossing that happens outside the box', 10, H - 8, col('muted'));
    },
    plot: { x: 'yaw', y: [0, 4] },
    note: 'Animate the yaw: the winner switches from side wall to back wall where t_x and t_z cross.'
  });

  A.fx('proj', {
    title: 'Wall point to atlas cell',
    expr: 'k = 1/{b} − 1,   s = 1 / (1 + {z} · k),   cellUV = {x} · s · 0.5 + 0.5',
    vars: { b: { name: 'backWallFrac', min: 0.2, max: 0.8, value: 0.5, step: 0.01 }, z: { name: 'hit depth (0 glass, 1 back wall)', min: 0, max: 1, value: 0.5, step: 0.01 },
            x: { name: 'hit across the box (−1 to 1)', min: -1, max: 1, value: 1, step: 0.01 } },
    out: [{ sym: 's', f: v => 1 / (1 + v.z * (1 / v.b - 1)), color: 'ax-y' }, { sym: 'cellUV', f: v => v.x / (1 + v.z * (1 / v.b - 1)) * 0.5 + 0.5, color: 'accent' }],
    sub: v => { const k = 1 / v.b - 1, s = 1 / (1 + v.z * k); return `k = ${num(k)},   s = 1 / (1 + ${num(v.z)} · ${num(k)}) = ${num(s)},   cellUV = ${num(v.x)} · ${num(s)} · 0.5 + 0.5 = <b>${num(v.x * s * 0.5 + 0.5)}</b>`; },
    draw(ctx, W, H, v, X) {
      const k = 1 / v.b - 1, cs = H - 50, cx = 30, cy = 20;
      // the atlas cell with back wall square and wall lines
      ctx.fillStyle = alpha(col('muted'), 0.15); ctx.fillRect(cx, cy, cs, cs); ctx.strokeStyle = col('muted'); ctx.strokeRect(cx, cy, cs, cs);
      const bw = v.b * cs, b0 = cx + (cs - bw) / 2, b1 = cy + (cs - bw) / 2;
      ctx.strokeRect(b0, b1, bw, bw); [[cx, cy, b0, b1], [cx + cs, cy, b0 + bw, b1], [cx, cy + cs, b0, b1 + bw], [cx + cs, cy + cs, b0 + bw, b1 + bw]].forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); });
      for (let q = 1; q < 4; q++) { const s = 1 / (1 + q / 4 * k), o = cs / 2 * (1 - s); ctx.strokeStyle = alpha(col('ray'), 0.4); ctx.strokeRect(cx + o, cy + o, cs * s, cs * s); }
      const s = 1 / (1 + v.z * k), u = v.x * s * 0.5 + 0.5;
      X.dot(ctx, cx + u * cs, cy + cs / 2, col('accent'), 7);
      X.label(ctx, 'atlas cell (blue: quarter depths)', cx, cy + cs + 18, col('muted'));
      // side view
      const sx = cx + cs + 40, sw = W - sx - 20;
      X.label(ctx, `side view: camera ${num(1 / k)} depths out`, sx, cy + 10, col('muted'));
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.5; const g = sx + sw * 0.4, bk = sx + sw, camx = g - (sw * 0.6) / k;
      ctx.strokeRect(g, 60, bk - g, 120);
      if (camx > sx - 30) { X.dot(ctx, Math.max(camx, sx), 120, col('ink'), 5); ctx.strokeStyle = alpha(col('ink'), 0.4); ctx.beginPath(); ctx.moveTo(Math.max(camx, sx), 120); ctx.lineTo(bk, 60); ctx.moveTo(Math.max(camx, sx), 120); ctx.lineTo(bk, 180); ctx.stroke(); }
      const hx = g + v.z * (bk - g), hy = 120 - v.x * 60;
      X.dot(ctx, hx, hy, col('accent'), 6); X.label(ctx, 'hit', hx + 8, hy - 6, col('accent'));
    },
    plot: { x: 'z', y: [0, 1] },
    note: 'With x = 1: z = 0 lands on the cell edge (1), z = 1 on the back-wall corner (0.5 + 0.5·b).'
  });

  A.fx('texrate', {
    title: 'Side-wall sharpness along the depth',
    expr: 'rate = k / (1 + {z} · k)²,   k = 1/{b} − 1,   front / back = 1 / {b}²',
    vars: { z: { name: 'depth along the side wall', min: 0, max: 1, value: 0.5, step: 0.01 }, b: { name: 'backWallFrac', min: 0.2, max: 0.8, value: 0.5, step: 0.01 } },
    out: [{ sym: 'rate', f: v => { const k = 1 / v.b - 1; return k / Math.pow(1 + v.z * k, 2); }, color: 'accent' }],
    sub: v => { const k = 1 / v.b - 1; return `k = ${num(k)},   rate = ${num(k)} / (1 + ${num(v.z)} · ${num(k)})² = <b>${num(k / Math.pow(1 + v.z * k, 2))}</b> half-cells per unit of depth`; },
    steps: v => [['back wall share of the cell (b²)', Math.round(v.b * v.b * 100) + '%'], ['sharpness at glass ÷ at back (1/b²)', num(1 / (v.b * v.b))]],
    plot: { x: 'z', y: [0, 4] },
    note: 'Animate b: low b starves the back wall, high b flattens the side walls.'
  });

  A.fx('rendercam', {
    title: 'Render camera position',
    expr: 'c = {b} · {D} / (1 − {b}),   fov = 2 · atan(({W} / 2) / c)',
    vars: { b: { name: 'backWallFrac', min: 0.2, max: 0.8, value: 0.5, step: 0.01 }, W: { name: 'room width', unit: 'm', min: 1, max: 10, value: 4, step: 0.1 }, D: { name: 'room depth', unit: 'm', min: 1, max: 10, value: 4, step: 0.1 } },
    out: [{ sym: 'c', unit: 'm', f: v => v.b * v.D / (1 - v.b), color: 'ax-y' }, { sym: 'fov', unit: '°', f: v => 2 * Math.atan(v.W / 2 / (v.b * v.D / (1 - v.b))) / DEG, color: 'accent' }],
    sub: v => { const c = v.b * v.D / (1 - v.b); return `c = ${num(v.b)} · ${num(v.D)} / ${num(1 - v.b)} = <b>${num(c)} m</b>,   fov = 2 · atan(${num(v.W / 2)} / ${num(c)}) = <b>${num(2 * Math.atan(v.W / 2 / c) / DEG)}°</b>`; },
    plot: { x: 'b', y: [0, 120] }
  });

  A.fx('hash', {
    title: 'Hash function',
    expr: 'hash = frac(sin({n} · 12.9898 + 78.233) · {m})',
    vars: { n: { sym: 'seed', name: 'input', min: 0, max: 1, value: 0.318, step: 0.001 }, m: { name: 'scramble factor', values: [1, 10, 100, 1000, 43758.5453], index: 4, labels: ['1', '10', '100', '1000', '43758.5453'] } },
    out: { sym: 'hash', f: v => frac(Math.sin(v.n * 12.9898 + 78.233) * v.m) },
    sub: v => { const s = Math.sin(v.n * 12.9898 + 78.233); return `sin(…) = ${num(s, 5)},   × ${v.m} = ${num(s * v.m, 6)},   frac → <b>${num(frac(s * v.m), 4)}</b>`; },
    plot: { x: 'n', y: [0, 1], height: 240 },
    note: 'Set the scramble factor to 1, then step it up: the smooth curve turns into noise.'
  });

  const schlick = (c, n) => { const f0 = Math.pow((1 - n) / (1 + n), 2); return f0 + (1 - f0) * Math.pow(1 - c, 5); };
  A.fx('fresnel', {
    title: 'Fresnel on glass (Schlick)',
    expr: 'F0 = ((1 − {n}) / (1 + {n}))²,   F = F0 + (1 − F0) · (1 − cos {th})⁵',
    vars: { th: { sym: 'θ', name: 'angle from straight on', unit: '°', min: 0, max: 89, value: 60, step: 1 }, n: { name: 'refractive index of the glass', min: 1, max: 2.4, value: 1.5, step: 0.01 } },
    out: [{ sym: 'F', name: 'reflected', f: v => schlick(Math.cos(v.th * DEG), v.n), color: 'ray' }, { sym: '1 − F', name: 'transmitted (the room)', f: v => 1 - schlick(Math.cos(v.th * DEG), v.n), color: 'accent' }],
    sub: v => { const f0 = Math.pow((1 - v.n) / (1 + v.n), 2), F = schlick(Math.cos(v.th * DEG), v.n); return `F0 = ${num(f0)},   F = ${num(f0)} + ${num(1 - f0)} · ${num(Math.pow(1 - Math.cos(v.th * DEG), 5))} = <b>${num(F)}</b>: ${Math.round(F * 100)}% reflection, ${Math.round((1 - F) * 100)}% room`; },
    plot: { x: 'th', y: [0, 1] }
  });

  const curt = v => { const r = v.yaw * DEG, dx = Math.sin(r) / (v.W / 2), dz = Math.cos(r) / 4; const tx = Math.abs(dx) > 1e-6 ? Math.abs(1 / dx) : Infinity, tz = 1 / dz, t = Math.min(tx, tz), tc = v.zc / dz; return { dx, dz, t, tc, vis: tc <= t }; };
  A.fx('curtain', {
    title: 'Curtain visibility test',
    expr: 't<sub>c</sub> = {zc} / d.z,   visible if t<sub>c</sub> ≤ t',
    vars: { zc: { sym: 'z<sub>c</sub>', name: 'curtain depth (fraction of the room)', min: 0.02, max: 0.6, value: 0.1, step: 0.01 }, yaw: { name: 'view angle', unit: '°', min: -80, max: 80, value: 58, step: 1 },
            W: { name: 'room width (depth 4 m)', unit: 'm', min: 1, max: 6, value: 1.4, step: 0.1 } },
    out: [{ sym: 't<sub>c</sub>', f: v => curt(v).tc, color: 'accent' }, { sym: 't', name: 'wall hit', f: v => curt(v).t, color: 'ray' }],
    sub: v => { const q = curt(v); return `t<sub>c</sub> = ${num(q.tc)}, wall at t = ${num(q.t)} → <b>${q.vis ? 'curtain visible' : 'a wall comes first: hide the curtain'}</b>`; },
    plot: { x: 'yaw', y: [0, 3] },
    note: 'The ray starts at the centre of the window here.'
  });

  A.fx('seam', {
    title: 'Mip level at an atlas seam',
    expr: 'mip = log₂(Δuv · {size}),   inside: Δuv = {du},   at the seam: Δuv = 1 / {cols}',
    vars: { du: { sym: 'Δuv', name: 'normal UV change per pixel', min: 0.0002, max: 0.01, value: 0.001, log: true }, size: { name: 'atlas size', values: [1024, 2048, 4096], index: 1 }, cols: { name: 'cells per atlas row', min: 2, max: 8, value: 4, step: 1 } },
    out: [{ sym: 'mip inside', f: v => Math.max(0, Math.log2(v.du * v.size)), color: 'good' }, { sym: 'mip at seam', f: v => Math.max(0, Math.log2(v.size / v.cols)), color: 'bad' }],
    sub: v => `inside a room: log₂(${num(v.du)} · ${v.size}) = <b>${num(Math.max(0, Math.log2(v.du * v.size)))}</b>,   across the jump: log₂(${v.size} / ${v.cols}) = <b>${num(Math.log2(v.size / v.cols))}</b>`,
    plot: { x: 'du', y: [0, 12] },
    note: 'Gradients from the world position stay at the "inside" value everywhere, so the seam disappears.'
  });
})();
