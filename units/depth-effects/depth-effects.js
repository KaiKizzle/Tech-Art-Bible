/* Reading the Depth Buffer — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180;
  const dStd = (z, n, f) => f / (f - n) * (1 - n / z);            // 0 at near, 1 at far
  const dRev = (z, n, f) => n / (f - n) * (f / z - 1);            // 1 at near, 0 at far
  const zOf = (d, n, f) => n * f / (f - d * (f - n));

  A.fx('ztest', {
    title: 'Depth test',
    expr: 'keep the new pixel if {dn} ≤ {ds}',
    vars: { dn: { sym: 'd<sub>new</sub>', name: 'depth of the new fragment (0 near, 1 far)', min: 0, max: 1, value: 0.35, step: 0.01 },
            ds: { sym: 'd<sub>stored</sub>', name: 'depth already in the buffer', min: 0, max: 1, value: 0.6, step: 0.01 } },
    out: { sym: 'kept', f: v => v.dn <= v.ds ? 1 : 0, fmt: x => x ? 'yes' : 'no' },
    sub: v => v.dn <= v.ds ? `${num(v.dn)} ≤ ${num(v.ds)} → <b>drawn</b>, the buffer now stores ${num(v.dn)}` : `${num(v.dn)} > ${num(v.ds)} → <b>discarded</b>, the buffer keeps ${num(v.ds)}`,
    draw(ctx, W, H, v, X) {
      const cam = [30, H / 2], P = d => 70 + d * (W - 110);
      X.dot(ctx, cam[0], cam[1], col('ink'), 6); X.label(ctx, 'camera', cam[0], cam[1] + 20, col('muted'), 'center');
      ctx.strokeStyle = alpha(col('muted'), 0.5); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(cam[0], cam[1]); ctx.lineTo(W - 20, cam[1]); ctx.stroke(); ctx.setLineDash([]);
      const kept = v.dn <= v.ds;
      ctx.lineWidth = 6; ctx.strokeStyle = kept ? alpha(col('ray'), 0.35) : col('ray'); ctx.beginPath(); ctx.moveTo(P(v.ds), cam[1] - 60); ctx.lineTo(P(v.ds), cam[1] + 60); ctx.stroke();
      X.label(ctx, 'stored surface', P(v.ds), cam[1] - 72, col('ray'), 'center');
      ctx.strokeStyle = kept ? col('accent') : alpha(col('accent'), 0.35); ctx.beginPath(); ctx.moveTo(P(v.dn), cam[1] - 40); ctx.lineTo(P(v.dn), cam[1] + 40); ctx.stroke();
      X.label(ctx, 'new surface', P(v.dn), cam[1] + 54, col('accent'), 'center');
      X.label(ctx, kept ? 'the pixel shows the new surface' : 'the pixel keeps the old surface', 20, H - 14, kept ? col('accent') : col('ray'), 'left', true);
    },
    plot: { x: 'dn', y: [-0.1, 1.1] }
  });

  A.fx('devdepth', {
    title: 'Stored depth versus distance',
    expr: 'd = {f} / ({f} − {n}) · (1 − {n} / {z})',
    vars: { z: { name: 'distance from the camera', unit: 'm', min: 0.1, max: 1000, value: 2, log: true },
            n: { name: 'near plane', unit: 'm', min: 0.01, max: 1, value: 0.1, log: true },
            f: { name: 'far plane', unit: 'm', min: 100, max: 10000, value: 1000, log: true } },
    out: [{ sym: 'd', name: 'standard (0 near, 1 far)', f: v => v.z < v.n ? NaN : dStd(v.z, v.n, v.f), color: 'accent' }, { sym: 'd<sub>rev</sub>', name: 'reversed-Z', f: v => v.z < v.n ? NaN : dRev(v.z, v.n, v.f), color: 'ray' }],
    sub: v => `d = <b>${num(dStd(v.z, v.n, v.f), 5)}</b>, reversed-Z: <b>${num(dRev(v.z, v.n, v.f), 5)}</b>. Half of all standard values lie closer than ${num(2 * v.n * v.f / (v.f + v.n))} m`,
    draw(ctx, W, H, v, X) {
      const L = 20, R = W - 20;
      // ruler of equally spaced depth values mapped back to distance
      X.label(ctx, 'ten equal steps of stored depth, drawn at the distance they stand for (log scale)', L, 22, col('muted'));
      const P = z => L + (Math.log(z) - Math.log(v.n)) / (Math.log(v.f) - Math.log(v.n)) * (R - L);
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(L, 90); ctx.lineTo(R, 90); ctx.stroke();
      for (let k = 0; k <= 10; k++) { const d = Math.min(k / 10, 0.99999), z = zOf(d, v.n, v.f), x = P(z); ctx.strokeStyle = col('accent'); ctx.beginPath(); ctx.moveTo(x, 70); ctx.lineTo(x, 110); ctx.stroke(); if (k === 0 || k === 10) X.label(ctx, 'd = ' + (k / 10), x, 60, col('accent'), 'center'); }
      [v.n, 1, 10, 100, v.f].forEach(z => { if (z < v.n || z > v.f) return; X.label(ctx, num(z) + ' m', P(z), 128, col('muted'), 'center'); });
      X.dot(ctx, P(v.z), 90, col('ray'), 7); X.label(ctx, 'z', P(v.z), 148, col('ray'), 'center', true);
      X.label(ctx, 'almost all the steps are crowded at the near end', L, H - 16, col('muted'));
    },
    plot: { x: 'z', y: [0, 1] },
    note: 'Animate z: the standard curve jumps to almost 1 within the first metres.'
  });

  A.fx('zprec', {
    title: 'Depth precision by distance',
    expr: 'Δz ≈ {z}² · ({f} − {n}) / ({n} · {f}) · 2<sup>−24</sup>',
    vars: { z: { name: 'distance', unit: 'm', min: 1, max: 1000, value: 100, log: true },
            n: { name: 'near plane', unit: 'm', min: 0.01, max: 1, value: 0.1, log: true },
            f: { name: 'far plane', unit: 'm', min: 100, max: 10000, value: 1000, log: true } },
    out: [{ sym: 'Δz<sub>24-bit</sub>', name: 'standard 24-bit buffer', f: v => v.z * v.z * (v.f - v.n) / (v.n * v.f) * Math.pow(2, -24), fmt: x => x >= 1 ? num(x) + ' m' : num(x * 100) + ' cm', color: 'bad' },
          { sym: 'Δz<sub>rev</sub>', name: 'reversed-Z 32-bit float, about', f: v => v.z * Math.pow(2, -23), fmt: x => x >= 1 ? num(x) + ' m' : x >= 0.01 ? num(x * 100) + ' cm' : num(x * 1000) + ' mm', color: 'good' }],
    plot: { x: 'z', logY: true, y: [1e-8, 100] },
    note: 'Two surfaces closer together than Δz flicker against each other (z-fighting).'
  });

  A.fx('lineyedepth', {
    title: 'Linear eye depth from the stored value',
    expr: 'z = {n} · {f} / ({f} − {d} · ({f} − {n}))',
    vars: { d: { name: 'stored depth (standard, 0 near, 1 far)', min: 0, max: 0.9999, value: 0.99, step: 0.0001 },
            n: { name: 'near plane', unit: 'm', min: 0.01, max: 1, value: 0.3, log: true },
            f: { name: 'far plane', unit: 'm', min: 100, max: 10000, value: 1000, log: true } },
    out: [{ sym: 'z', name: 'eye depth', unit: 'm', f: v => zOf(v.d, v.n, v.f), color: 'accent' }, { sym: 'z / f', name: 'Linear01Depth', f: v => zOf(v.d, v.n, v.f) / v.f, color: 'ray' }],
    plot: { x: 'd', logY: true, y: [0.01, 10000] },
    note: 'The last few thousandths of the stored range cover almost the whole scene.'
  });

  A.fx('reconstruct', {
    title: 'Position from pixel and depth (side view)',
    expr: 'y = {ny} · tan({fov} / 2) · {z},   z = {z}',
    vars: { ny: { sym: 'ndc.y', name: 'vertical NDC of the pixel', min: -1, max: 1, value: 0.4, step: 0.01 },
            fov: { name: 'vertical field of view', unit: '°', min: 20, max: 110, value: 60, step: 1 },
            z: { name: 'linear eye depth', unit: 'm', min: 0.5, max: 20, value: 8, step: 0.1 } },
    out: { sym: 'y', name: 'height above the view axis', unit: 'm', f: v => v.ny * Math.tan(v.fov / 2 * DEG) * v.z },
    draw(ctx, W, H, v, X) {
      const cam = [30, H / 2], s = (W - 60) / 20, k = Math.tan(v.fov / 2 * DEG);
      ctx.fillStyle = alpha(col('accent'), 0.07); ctx.beginPath(); ctx.moveTo(...cam); ctx.lineTo(cam[0] + 20 * s, cam[1] - 20 * s * k); ctx.lineTo(cam[0] + 20 * s, cam[1] + 20 * s * k); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = alpha(col('muted'), 0.6); ctx.beginPath(); ctx.moveTo(...cam); ctx.lineTo(W, cam[1]); ctx.stroke();
      const y = v.ny * k * v.z, P = [cam[0] + v.z * s, cam[1] - y * s];
      ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...cam); ctx.lineTo(cam[0] + 20 * s, cam[1] - v.ny * k * 20 * s); ctx.stroke();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = col('muted'); ctx.beginPath(); ctx.moveTo(P[0], cam[1]); ctx.lineTo(P[0], P[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(P[0] + 6, P[1] - 40); ctx.lineTo(P[0] - 6, P[1] + 40); ctx.stroke();
      X.dot(ctx, P[0], P[1], col('accent'), 7); X.label(ctx, `(${num(y)}, ${num(v.z)})`, P[0] + 10, P[1] - 12, col('accent'), 'left', true);
      X.dot(ctx, ...cam, col('ink'), 6); X.label(ctx, 'camera', cam[0], cam[1] + 18, col('muted'), 'center');
      X.label(ctx, 'blue: the pixel\'s view ray · black: the surface the depth buffer saw', 10, H - 10, col('muted'));
    },
    plot: { x: 'z', y: [-12, 12] }
  });

  A.fx('softfade', {
    title: 'Soft particle fade',
    expr: 'fade = saturate(({zs} − {zp}) / {dist})',
    vars: { zs: { sym: 'z<sub>scene</sub>', name: 'scene depth behind the particle pixel', unit: 'm', min: 0, max: 10, value: 5.2, step: 0.01 },
            zp: { sym: 'z<sub>particle</sub>', name: 'particle depth at that pixel', unit: 'm', min: 0, max: 10, value: 5, step: 0.01 },
            dist: { name: 'fade distance', unit: 'm', min: 0.05, max: 2, value: 0.5, step: 0.01 } },
    out: { sym: 'fade', f: v => clamp((v.zs - v.zp) / v.dist, 0, 1) },
    draw(ctx, W, H, v, X) {
      // side view: ground line tilted, particle quad vertical, fade along quad
      const s = 26, gy = x => H - 40 - x * 0.35 * s, x0 = 30;
      ctx.fillStyle = alpha(col('muted'), 0.2); ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, gy(-1)); ctx.lineTo(W, gy((W) / s)); ctx.lineTo(W, H); ctx.fill();
      const px = W * 0.55, top = 30;
      for (let y = top; y < H; y += 2) { const ground = gy(px / s); if (y > ground) break; const zDiff = (ground - y) / s; const a = clamp(zDiff / v.dist, 0, 1); ctx.fillStyle = `rgba(255,170,70,${0.8 * a})`; ctx.fillRect(px - 50, y, 100, 2); }
      ctx.strokeStyle = col('ink'); ctx.setLineDash([3, 3]); ctx.strokeRect(px - 50, top, 100, gy(px / s) - top + 30); ctx.setLineDash([]);
      X.label(ctx, 'particle quad, faded where it nears the ground', px, 18, col('muted'), 'center');
      X.label(ctx, 'ground (scene depth)', 20, H - 12, col('muted'));
    },
    plot: { x: 'zp', y: [0, 1] }
  });

  A.fx('waterdepth', {
    title: 'Water transmittance by depth',
    expr: 'T = e<sup>−{s} · ({zs} − {zw})</sup>',
    vars: { s: { sym: 'σ', name: 'absorption per metre (red absorbs most)', min: 0.05, max: 3, value: 0.6, step: 0.01 },
            zs: { sym: 'z<sub>ground</sub>', name: 'scene depth behind the water', unit: 'm', min: 5, max: 25, value: 9, step: 0.05 },
            zw: { sym: 'z<sub>water</sub>', name: 'depth of the water surface', unit: 'm', min: 5, max: 25, value: 6, step: 0.05 } },
    out: [{ sym: 'T<sub>r</sub>', f: v => Math.exp(-v.s * 1.6 * Math.max(0, v.zs - v.zw)), color: 'bad' }, { sym: 'T<sub>g</sub>', f: v => Math.exp(-v.s * 0.5 * Math.max(0, v.zs - v.zw)), color: 'good' }, { sym: 'T<sub>b</sub>', f: v => Math.exp(-v.s * 0.25 * Math.max(0, v.zs - v.zw)), color: 'ray' }],
    sub: v => `water along the view ray: ${num(Math.max(0, v.zs - v.zw))} m → red, green and blue keep <b>${[1.6, 0.5, 0.25].map(k => Math.round(Math.exp(-v.s * k * Math.max(0, v.zs - v.zw)) * 100) + '%').join(', ')}</b>`,
    draw(ctx, W, H, v, X) {
      const d = Math.max(0, v.zs - v.zw), T = [1.6, 0.5, 0.25].map(k => Math.exp(-v.s * k * d)), ground = [0.75, 0.62, 0.42], water = [0.02, 0.12, 0.16];
      const c = ground.map((g, i) => g * T[i] + water[i] * (1 - T[i])), enc = x => Math.round(Math.pow(clamp(x, 0, 1), 1 / 2.2) * 255);
      ctx.fillStyle = `rgb(${c.map(enc).join(',')})`; ctx.fillRect(30, 40, W - 60, 120); ctx.strokeStyle = col('line'); ctx.strokeRect(30, 40, W - 60, 120);
      X.label(ctx, `seen through ${num(d)} m of water`, W / 2, 180, col('muted'), 'center');
      for (let i = 0; i < 12; i++) { const dd = i * 1.2, Ti = [1.6, 0.5, 0.25].map(k => Math.exp(-v.s * k * dd)), ci = ground.map((g, j) => g * Ti[j] + water[j] * (1 - Ti[j])); ctx.fillStyle = `rgb(${ci.map(enc).join(',')})`; ctx.fillRect(30 + i * (W - 60) / 12, 200, (W - 60) / 12, 30); }
      X.label(ctx, '0 m', 30, 244, col('muted'), 'center'); X.label(ctx, '13 m', W - 30, 244, col('muted'), 'center');
    },
    plot: { x: 'zs', y: [0, 1] }
  });

  /* SSAO in 2D: a terrain profile, a point on it, samples in the half-disc above */
  const ter = x => 0.35 * Math.sin(1.4 * x) + 0.18 * Math.sin(3.1 * x + 1) + (x > 1.2 ? (x - 1.2) * 1.4 : 0);
  const SAMPLES = Array.from({ length: 32 }, (_, i) => { const a = ((i * 0.618034) % 1) * Math.PI, r = Math.sqrt(((i * 0.7548777 + 0.31) % 1)); return [Math.cos(a) * r, Math.sin(a) * r]; });
  function ssao(v) {
    const px = v.x, py = ter(px), e = 0.01, nx = -(ter(px + e) - ter(px - e)) / (2 * e), l = Math.hypot(nx, 1), n = [nx / l, 1 / l], t = [n[1], -n[0]];
    let occ = 0; const pts = [];
    for (let i = 0; i < v.n; i++) {
      const [a, b] = SAMPLES[i], sx = px + (t[0] * a + n[0] * b) * v.r, sy = py + (t[1] * a + n[1] * b) * v.r, hy = ter(sx);
      const blocked = hy > sy, inRange = Math.abs(hy - sy) < v.r || !v.rc; const o = blocked && inRange; if (o) occ++;
      pts.push([sx, sy, blocked, inRange]);
    }
    return { ao: 1 - occ / v.n, occ, pts, p: [px, py], n };
  }
  A.fx('ssao', {
    title: 'AO sample occlusion (2D)',
    expr: 'AO = 1 − blocked / {n},   radius {r}',
    vars: { x: { name: 'point on the surface', min: -2.4, max: 2.4, value: 0.9, step: 0.01 }, r: { name: 'sample radius', unit: 'm', min: 0.1, max: 1.5, value: 0.6, step: 0.01 },
            n: { name: 'samples', min: 4, max: 32, value: 16, step: 1 }, rc: { name: 'range check', values: [1, 0], labels: ['on', 'off'] } },
    out: { sym: 'AO', f: v => ssao(v).ao },
    sub: v => { const q = ssao(v); return `${q.occ} of ${v.n} samples are behind the depth buffer → AO = <b>${num(q.ao)}</b>`; },
    draw(ctx, W, H, v, X) {
      const s = 70, cx = W / 2, cy = H * 0.62, P = (x, y) => [cx + x * s, cy - y * s];
      ctx.fillStyle = alpha(col('muted'), 0.22); ctx.beginPath(); ctx.moveTo(0, H); for (let x = -3.5; x <= 3.5; x += 0.02) ctx.lineTo(...P(x, ter(x))); ctx.lineTo(W, H); ctx.fill();
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 2; ctx.beginPath(); for (let x = -3.5; x <= 3.5; x += 0.02) { const p = P(x, ter(x)); x === -3.5 ? ctx.moveTo(...p) : ctx.lineTo(...p); } ctx.stroke();
      const q = ssao(v), c = P(...q.p);
      ctx.strokeStyle = alpha(col('ray'), 0.5); ctx.lineWidth = 1; ctx.beginPath(); const na = Math.atan2(-q.n[1], q.n[0]); ctx.arc(c[0], c[1], v.r * s, na - Math.PI / 2, na + Math.PI / 2); ctx.stroke();
      q.pts.forEach(([x, y, b, ir]) => { const p = P(x, y); X.dot(ctx, p[0], p[1], b ? (ir ? col('bad') : alpha(col('muted'), 0.7)) : col('good'), 3.5); });
      X.dot(ctx, c[0], c[1], col('ink'), 5);
      X.label(ctx, 'red: behind the surface (blocked) · green: free · grey: blocked but out of range', 10, 14, col('muted'));
      X.label(ctx, 'camera looks down from above: the depth buffer stores this profile', 10, H - 10, col('muted'));
    },
    plot: { x: 'x', y: [0, 1] }
  });

  A.fx('edge', {
    title: 'Depth edge test',
    expr: 'edge if |{z1} − {z2}| / {z1} > {th}',
    vars: { z1: { name: 'depth of this pixel', unit: 'm', min: 1, max: 200, value: 10, log: true }, z2: { name: 'depth of the neighbour', unit: 'm', min: 1, max: 200, value: 10.6, log: true },
            th: { name: 'threshold (fraction of the depth)', min: 0.005, max: 0.3, value: 0.05, step: 0.005 } },
    out: { sym: 'Δz / z', f: v => Math.abs(v.z1 - v.z2) / v.z1 },
    sub: v => { const r = Math.abs(v.z1 - v.z2) / v.z1; return `|${num(v.z1)} − ${num(v.z2)}| / ${num(v.z1)} = ${num(r)} ${r > v.th ? '>' : '≤'} ${num(v.th)} → <b>${r > v.th ? 'edge' : 'no edge'}</b>`; },
    plot: { x: 'z2', y: [0, 1] }
  });
})();
