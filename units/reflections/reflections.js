/* Reflections, Mirrors and Cheap Metal — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, S = window.Surf, { col, alpha, num } = A;
  const { PI, sat, clamp, css, norm, dot } = S;
  const rad = d => d * PI / 180, deg = r => r * 180 / PI;
  const STUDIO = { zenith: [0.3, 0.31, 0.34], horizon: [1, 0.98, 0.95] };

  /* ---------- the mirror direction ---------- */
  A.fx('reflect', {
    title: 'Every reflection starts with the mirror direction',
    expr: 'R = 2 (N·V) N − V,   V at {v} from the surface, surface tilted {t}',
    vars: { v: { sym: 'θ<sub>V</sub>', name: 'view angle above the surface', unit: '°', min: 2, max: 90, value: 35, step: 1 },
            t: { sym: 'tilt', name: 'tilt of the surface (a normal map or a bump)', unit: '°', min: -30, max: 30, value: 0, step: 1 } },
    out: { sym: 'R above horizon', f: v => { const n = [Math.sin(rad(v.t)), Math.cos(rad(v.t))], V = [-Math.cos(rad(v.v)), Math.sin(rad(v.v))], d = n[0] * V[0] + n[1] * V[1]; const R = [2 * d * n[0] - V[0], 2 * d * n[1] - V[1]]; return deg(Math.atan2(R[1], R[0])); }, unit: '°' },
    sub: (v, n) => { const nn = [Math.sin(rad(v.t)), Math.cos(rad(v.t))], V = [-Math.cos(rad(v.v)), Math.sin(rad(v.v))], d = nn[0] * V[0] + nn[1] * V[1], R = [2 * d * nn[0] - V[0], 2 * d * nn[1] - V[1]], a = deg(Math.atan2(R[1], R[0])); return a < 0 ? `R points <b>into the ground</b> (${n(a)}°): the surface would show what lies below the horizon` : a < 12 ? `R grazes the horizon (${n(a)}°): the reflection shows distant objects, the hardest case for every technique` : `R points ${n(a)}° up: the reflection shows the sky or what stands in that direction`; },
    draw(ctx, W, H, v, X) {
      const cx = W / 2, cy = H * 0.62, Rr = Math.min(W / 2, H * 0.55) - 14;
      for (let a = 0; a < 360; a += 2) { const d = [Math.cos(rad(a)), Math.sin(rad(a)), 0]; const c = S.env([d[0], d[1], 0.0001], 0.5, { lights: false, floor: false }); ctx.strokeStyle = css(S.tm(c)); ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, Rr, -rad(a + 1.2), -rad(a - 1.2), true); ctx.stroke(); }
      const nn = [Math.sin(rad(v.t)), Math.cos(rad(v.t))], V = [-Math.cos(rad(v.v)), Math.sin(rad(v.v))], d = nn[0] * V[0] + nn[1] * V[1], R = [2 * d * nn[0] - V[0], 2 * d * nn[1] - V[1]], L = Rr - 14;
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 60 * Math.cos(rad(v.t)), cy + 60 * Math.sin(rad(v.t))); ctx.lineTo(cx + 60 * Math.cos(rad(v.t)), cy - 60 * Math.sin(rad(v.t))); ctx.stroke();
      X.arrow(ctx, cx, cy, cx + nn[0] * 46, cy - nn[1] * 46, col('muted'), 2, 8); X.label(ctx, 'N', cx + nn[0] * 54, cy - nn[1] * 54, col('muted'), 'center');
      X.arrow(ctx, cx + V[0] * L, cy - V[1] * L, cx, cy, col('ray'), 2.5, 9); X.label(ctx, 'from the eye', cx + V[0] * L * 0.5, cy - V[1] * L * 0.5 + 16, col('ray'), 'center');
      X.arrow(ctx, cx, cy, cx + R[0] * L, cy - R[1] * L, col('accent'), 2.5, 9); X.label(ctx, 'R', cx + R[0] * (L + 8), cy - R[1] * (L + 8), col('accent'), 'center', true);
      X.label(ctx, 'sky', cx, cy - Rr - 2 + 22, col('muted'), 'center'); X.label(ctx, 'ground', cx, Math.min(H - 6, cy + Rr - 18), col('muted'), 'center');
    },
    plot: { x: 'v', y: [-60, 95] }, size: [440, 300]
  });

  /* ---------- roughness to mip ---------- */
  A.fx('mip', {
    title: 'Rougher reflections read a blurrier mip',
    expr: 'mip = {r} · (1.7 − 0.7 · {r}) · 6,   face size = {res} / 2<sup>mip</sup>',
    vars: { r: { sym: 'r', name: 'perceptual roughness', min: 0, max: 1, value: 0.4, step: 0.01 },
            res: { sym: 'size', name: 'probe resolution per face', values: [128, 256, 512, 1024], labels: ['128', '256', '512', '1024'], index: 1 } },
    out: { sym: 'mip', f: v => v.r * (1.7 - 0.7 * v.r) * 6, color: 'accent' },
    sub: (v, n) => { const m = v.r * (1.7 - 0.7 * v.r) * 6; return `roughness ${n(v.r)} reads mip <b>${n(m)}</b>, where a face is only <b>${n(v.res / Math.pow(2, m))} px</b> wide`; },
    draw(ctx, W, H, v, X) {
      const m = v.r * (1.7 - 0.7 * v.r) * 6, x0 = 14;
      let x = x0;
      for (let i = 0; i <= 6; i++) { const s = Math.max(6, 90 / Math.pow(1.45, i)); ctx.fillStyle = Math.abs(i - m) < 0.5 ? alpha(col('accent'), 0.5) : alpha(col('muted'), 0.2); ctx.fillRect(x, 20, s, s); ctx.strokeStyle = col('line'); ctx.strokeRect(x, 20, s, s); X.label(ctx, String(i), x + s / 2, 118, col('muted'), 'center'); x += s + 8; }
      X.label(ctx, 'mip', x0, 136, col('muted'));
      const y0 = 160, h = H - y0 - 20, w = W - 28;
      for (let i = 0; i < w; i += 2) for (let j = 0; j < h; j += 3) { const a = (i / w - 0.5) * 2.4, e = (0.5 - j / h) * 1.4; const d = norm([Math.sin(a), e, Math.cos(a)]); ctx.fillStyle = css(S.tm(S.env(d, v.r, STUDIO))); ctx.fillRect(14 + i, y0 + j, 2, 3); }
      X.label(ctx, 'what the probe returns at this roughness', 18, y0 + 12, '#fff');
    },
    plot: { x: 'r', y: [0, 6.2] }, size: [440, 300]
  });

  /* ---------- box projection ---------- */
  const BX = 4, BY = 2.6, WALLC = ['#d9584a', '#4a90d9', '#6bbf59', '#e3b341'];
  function wallAt(p) { const ax = Math.abs(p[0] / BX), ay = Math.abs(p[1] / BY); if (ax > ay) return p[0] > 0 ? 1 : 3; return p[1] > 0 ? 0 : 2; }
  function boxHit(p, r) { let t = Infinity; for (let i = 0; i < 2; i++) { const b = i ? BY : BX; if (Math.abs(r[i]) > 1e-6) { const tt = ((r[i] > 0 ? b : -b) - p[i]) / r[i]; if (tt > 0) t = Math.min(t, tt); } } return t; }
  A.fx('box', {
    title: 'Box projection: aim the lookup at the right wall',
    expr: 't = ray–box distance from {px} along R,   lookup = (P + t·R) − probe,   not just R',
    vars: { px: { sym: 'P', name: 'position of the shaded point (x)', min: -3.5, max: 3.5, value: 2.6, step: 0.05 },
            a: { sym: 'R', name: 'direction of the reflection', unit: '°', min: 0, max: 359, value: 60, step: 1 },
            cx: { sym: 'probe', name: 'position of the probe (x)', min: -3, max: 3, value: -1.5, step: 0.05 } },
    out: { sym: 'lookup error', f: v => { const p = [v.px, -1.2], r = [Math.cos(rad(v.a)), Math.sin(rad(v.a))], t = boxHit(p, r), h = [p[0] + t * r[0], p[1] + t * r[1]], d = [h[0] - v.cx, h[1]]; let e = Math.abs(deg(Math.atan2(d[1], d[0]) - Math.atan2(r[1], r[0]))); if (e > 180) e = 360 - e; return e; }, unit: '°' },
    sub: (v, n) => { const p = [v.px, -1.2], r = [Math.cos(rad(v.a)), Math.sin(rad(v.a))], t = boxHit(p, r), h = [p[0] + t * r[0], p[1] + t * r[1]], wr = wallAt(h), wn = wallAt([v.cx + r[0] * 50, r[1] * 50]); return wr === wn ? 'both lookups land on the same wall here; the error shows up as a shift' : `<b>without projection the reflection shows the wrong wall</b> (${['top', 'right', 'bottom', 'left'][wn]} instead of ${['top', 'right', 'bottom', 'left'][wr]})`; },
    draw(ctx, W, H, v, X) {
      const s = Math.min((W - 30) / (2 * BX), (H - 30) / (2 * BY)), ox = W / 2, oy = H / 2, P = (x, y) => [ox + x * s, oy - y * s];
      [[[-BX, BY], [BX, BY]], [[BX, BY], [BX, -BY]], [[BX, -BY], [-BX, -BY]], [[-BX, -BY], [-BX, BY]]].forEach((w, i) => { const a = P(...w[0]), b = P(...w[1]); ctx.strokeStyle = WALLC[i]; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
      const p = [v.px, -1.2], r = [Math.cos(rad(v.a)), Math.sin(rad(v.a))], t = boxHit(p, r), h = [p[0] + t * r[0], p[1] + t * r[1]];
      const c = [v.cx, 0], tc = boxHit(c, r), hn = [c[0] + tc * r[0], c[1] + tc * r[1]];
      const pp = P(...p), hp = P(...h), cp = P(...c), np = P(...hn);
      ctx.setLineDash([5, 5]); X.arrow(ctx, cp[0], cp[1], np[0], np[1], col('bad'), 2, 8); ctx.setLineDash([]);
      X.arrow(ctx, pp[0], pp[1], hp[0], hp[1], col('accent'), 2.5, 9);
      ctx.strokeStyle = col('good'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cp[0], cp[1]); ctx.lineTo(hp[0], hp[1]); ctx.stroke();
      X.dot(ctx, pp[0], pp[1], col('accent'), 6); X.dot(ctx, cp[0], cp[1], col('ink'), 6);
      X.label(ctx, 'P', pp[0] + 8, pp[1] + 12, col('accent')); X.label(ctx, 'probe', cp[0] + 8, cp[1] + 12, col('ink'));
      X.label(ctx, 'dashed: plain lookup with R from the probe', 30, H - 48, col('bad')); X.label(ctx, 'solid: box-projected lookup', 30, H - 32, col('good'));
    },
    plot: false, size: [520, 340]
  });

  /* ---------- screen-space reflections ---------- */
  const CAM = [0, 2.2], PITCH = -14, HALF = 24;
  function ssrCase(v) {
    const F = [v.fx, 0], Vd = norm([F[0] - CAM[0], F[1] - CAM[1], 0]), R = [Vd[0], -Vd[1]];
    let hit = null, face = '';
    if (R[0] > 0) { const t = (v.bx - F[0]) / R[0], y = t * R[1]; if (t > 0 && y >= 0 && y <= v.h) { hit = [v.bx, y]; face = 'front'; } }
    if (!hit && R[1] > 0) { const t = v.h / R[1], x = F[0] + t * R[0]; if (t > 0 && x >= v.bx && x <= v.bx + 1.2) { hit = [x, v.h]; face = 'top'; } }
    if (!hit) return { R, hit: null, kind: 'sky' };
    const ang = deg(Math.atan2(hit[1] - CAM[1], hit[0] - CAM[0]));
    if (ang > PITCH + HALF) return { R, hit, kind: 'off' };
    if (face === 'top' && CAM[1] < v.h) return { R, hit, kind: 'hidden' };
    return { R, hit, kind: 'ok' };
  }
  A.fx('ssr', {
    title: 'Screen-space reflections only know what is on screen',
    expr: 'R = reflect(V, N) at {fx},   step along R until behind the depth buffer,   box at {bx}, height {h}',
    vars: { fx: { sym: 'F', name: 'floor point that is being shaded', min: 1, max: 9, value: 4, step: 0.05 },
            bx: { sym: 'box', name: 'distance of the box', min: 3, max: 11, value: 8, step: 0.05 },
            h: { sym: 'h', name: 'height of the box', min: 0.3, max: 5, value: 2.4, step: 0.05 } },
    out: { sym: 'result', f: v => ({ sky: 0, ok: 1, off: 2, hidden: 3 })[ssrCase(v).kind], fmt: x => ['no hit: sky or probe', 'found on screen', 'off screen: fallback', 'hidden on screen: fallback'][x] },
    sub: v => { const k = ssrCase(v).kind; return k === 'ok' ? '<b>found</b>: the hit point is visible on screen, SSR can copy its colour' : k === 'off' ? '<b>off screen</b>: the box is reflected, but the part the ray hits is above the top of the screen. SSR falls back to a probe and the reflection of the box vanishes' : k === 'hidden' ? '<b>not on screen</b>: the ray hits the top of the box, which the camera cannot see. SSR falls back' : 'the ray misses the box: sky, taken from the probe or sky fallback'; },
    draw(ctx, W, H, v, X) {
      const s = (W - 30) / 12, ox = 16, oy = H - 34, P = (x, y) => [ox + x * s, oy - y * s];
      ctx.fillStyle = alpha(col('muted'), 0.15); ctx.fillRect(0, oy, W, 34); X.label(ctx, 'floor (reflective)', W - 110, oy + 18, col('muted'));
      const c = P(...CAM);
      [PITCH + HALF, PITCH - HALF].forEach(a => { ctx.strokeStyle = alpha(col('ray'), 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0] + Math.cos(rad(a)) * W, c[1] - Math.sin(rad(a)) * W); ctx.stroke(); });
      ctx.fillStyle = alpha(col('ray'), 0.06); ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0] + Math.cos(rad(PITCH + HALF)) * W * 1.5, c[1] - Math.sin(rad(PITCH + HALF)) * W * 1.5); ctx.lineTo(c[0] + Math.cos(rad(PITCH - HALF)) * W * 1.5, c[1] - Math.sin(rad(PITCH - HALF)) * W * 1.5); ctx.closePath(); ctx.fill();
      const b0 = P(v.bx, v.h), b1 = P(v.bx + 1.2, 0); ctx.fillStyle = col('ax-y'); ctx.fillRect(b0[0], b0[1], b1[0] - b0[0], b1[1] - b0[1]);
      const k = ssrCase(v), F = P(v.fx, 0);
      ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(F[0], F[1]); ctx.stroke();
      const end = k.hit ? P(...k.hit) : [F[0] + k.R[0] * W, F[1] - k.R[1] * W];
      const colr = k.kind === 'ok' ? col('good') : k.kind === 'sky' ? col('muted') : col('bad');
      X.arrow(ctx, F[0], F[1], end[0], end[1], colr, 2.5, 9); if (k.hit) X.dot(ctx, end[0], end[1], colr, 6);
      X.dot(ctx, c[0], c[1], col('ink'), 6); X.label(ctx, 'camera', c[0] + 8, c[1] - 12, col('ink'));
    },
    plot: false, size: [880, 300]
  });

  /* ---------- planar mirror ---------- */
  A.fx('planar', {
    title: 'A planar reflection renders the scene from a mirrored camera',
    expr: 'p′ = p − 2 (n·p − d) n,   mirror tilted {t}, offset {d}',
    vars: { t: { sym: 'tilt', name: 'tilt of the mirror plane', unit: '°', min: -40, max: 40, value: 0, step: 1 },
            d: { sym: 'd', name: 'height of the plane', min: -1, max: 1, value: 0, step: 0.05 },
            cy: { sym: 'cam', name: 'camera height', min: 0.5, max: 3, value: 1.6, step: 0.05 } },
    out: { sym: 'mirrored camera height', f: v => { const n = [Math.sin(rad(v.t)), Math.cos(rad(v.t))], p = [-3, v.cy], k = n[0] * p[0] + n[1] * p[1] - v.d; return p[1] - 2 * k * n[1]; } },
    sub: (v, n) => 'everything is drawn a second time from the mirrored camera, clipped at the mirror plane: about <b>2×</b> the draw calls of the view, for each mirror',
    draw(ctx, W, H, v, X) {
      const s = 46, ox = W / 2, oy = H / 2 + 10, P = (x, y) => [ox + x * s, oy - y * s];
      const n = [Math.sin(rad(v.t)), Math.cos(rad(v.t))], tg = [n[1], -n[0]], o = [n[0] * v.d, n[1] * v.d];
      const a = P(o[0] - tg[0] * 6, o[1] - tg[1] * 6), b = P(o[0] + tg[0] * 6, o[1] + tg[1] * 6);
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      const mir = p => { const k = n[0] * p[0] + n[1] * p[1] - v.d; return [p[0] - 2 * k * n[0], p[1] - 2 * k * n[1]]; };
      const cam = [-3, v.cy], obj = [2, 1.2], cm = mir(cam), om = mir(obj);
      const tri = (p, c, lab, dash) => { const q = P(...p); ctx.setLineDash(dash ? [4, 4] : []); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q[0] - 10, q[1] - 9); ctx.lineTo(q[0] + 10, q[1] - 9); ctx.lineTo(q[0], q[1] + 9); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]); X.label(ctx, lab, q[0] + 14, q[1], c); };
      tri(obj, col('accent'), 'object'); tri(om, alpha(col('accent'), 0.7), 'its mirror image', true);
      const cp = P(...cam), cmp = P(...cm), op = P(...obj), omp = P(...om);
      X.dot(ctx, cp[0], cp[1], col('ray'), 6); X.label(ctx, 'camera', cp[0] - 8, cp[1] - 14, col('ray'), 'right');
      ctx.setLineDash([4, 4]); X.dot(ctx, cmp[0], cmp[1], col('ray'), 5); X.label(ctx, 'mirrored camera', cmp[0] - 8, cmp[1] + 14, col('ray'), 'right');
      ctx.strokeStyle = alpha(col('ray'), 0.8); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cmp[0], cmp[1]); ctx.lineTo(op[0], op[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = col('ray'); ctx.beginPath(); ctx.moveTo(cp[0], cp[1]); ctx.lineTo(omp[0], omp[1]); ctx.stroke();
    },
    plot: false, size: [520, 320]
  });

  /* ---------- ray tracing cost ---------- */
  const RES = [[1920, 1080], [2560, 1440], [3840, 2160]];
  A.fx('rtcost', {
    title: 'How many reflection rays a frame needs',
    expr: 'rays = pixels({res}) · {sc}² · {spp} · {sh},   per second at 60 fps',
    vars: { res: { sym: 'res', name: 'output resolution', values: [0, 1, 2], labels: ['1080p', '1440p', '4K'], index: 0 },
            sc: { sym: 'scale', name: 'reflection resolution (1 = full)', min: 0.25, max: 1, value: 0.5, step: 0.05 },
            spp: { sym: 'spp', name: 'rays per traced pixel', values: [1, 2, 4], labels: ['1', '2', '4'], index: 0 },
            sh: { sym: 'share', name: 'share of pixels smooth enough to trace', min: 0, max: 1, value: 0.4, step: 0.01 } },
    out: [{ sym: 'rays per frame', f: v => RES[v.res][0] * RES[v.res][1] * v.sc * v.sc * v.spp * v.sh / 1e6, color: 'accent', fmt: x => num(x) + ' M' }, { sym: 'per second', f: v => RES[v.res][0] * RES[v.res][1] * v.sc * v.sc * v.spp * v.sh * 60 / 1e9, color: 'ray', fmt: x => num(x) + ' G' }],
    note: 'Ray counts only. Each ray also needs shading at the hit, and noisy results need denoising; both often cost more than the trace.',
    plot: { x: 'sh' }
  });

  /* ---------- specular occlusion ---------- */
  const so = v => sat(Math.pow(v.nv + v.ao, Math.pow(2, -16 * v.r * v.r - 1)) - 1 + v.ao);
  A.fx('specocc', {
    title: 'Specular occlusion from ambient occlusion',
    expr: 'SO = saturate(({nv} + {ao})<sup>2<sup>−16α − 1</sup></sup> − 1 + {ao}),   α = {r}²',
    vars: { ao: { sym: 'AO', name: 'ambient occlusion at the point', min: 0, max: 1, value: 0.4, step: 0.01 },
            nv: { sym: 'N·V', name: 'cosine of the view angle', min: 0, max: 1, value: 0.9, step: 0.01 },
            r: { sym: 'r', name: 'roughness', min: 0, max: 1, value: 0.15, step: 0.01 } },
    out: { sym: 'SO', f: so },
    sub: (v, n) => `the probe reflection is multiplied by <b>${n(so(v))}</b> (AO alone would give ${n(v.ao)}): smooth surfaces viewed head-on keep more of their reflection, as they should`,
    plot: { x: 'ao', y: [0, 1.02] }
  });

  /* ---------- cheap reflections ---------- */
  const GRD = [0.06, 0.055, 0.05], HOR = [1.0, 0.95, 0.85], SKY = [0.3, 0.45, 0.75];
  function grad(R, w) { const y = R[1]; const lo = S.mix3(GRD, HOR, S.smooth(-w, 0, y)); return S.mix3(lo, SKY, S.smooth(0, w * 1.5 + 0.2, y)); }
  A.fx('cheap', {
    title: 'A three-colour gradient as the whole environment',
    expr: 'env(R) = ground → horizon → sky, blended by smoothstep(R.y) over a width {w}',
    vars: { w: { sym: 'w', name: 'horizon softness (raise with roughness)', min: 0.01, max: 0.8, value: 0.08, step: 0.01 },
            m: { sym: 'metal', name: 'material', values: [0, 1, 2], labels: ['chrome', 'gold', 'red plastic'], index: 0 } },
    out: { sym: 'env at the horizon', f: v => S.lum(grad([1, 0, 0], v.w)) },
    sub: v => 'left: three colours and a smoothstep, no texture. Right: a full environment probe. On a moving object most players cannot tell.',
    draw(ctx, W, H, v, X) {
      const mats = [{ base: [0.95, 0.95, 0.95], metal: 1 }, { base: [1, 0.71, 0.31], metal: 1 }, { base: [0.5, 0.05, 0.04], metal: 0 }], m = mats[v.m], R = Math.min(W / 4, H / 2) - 18, rough = clamp(v.w * 1.2, 0.03, 1);
      S.sphere(ctx, W / 4, H / 2 - 4, R, nn => { const Rv = [2 * nn[2] * nn[0], 2 * nn[2] * nn[1], 2 * nn[2] * nn[2] - 1], e = grad(Rv, v.w), nv = nn[2], f0 = m.base.map(b => S.lerp(0.04, b, m.metal)), AB = S.envBRDF(nv, rough); return m.base.map((b, i) => e[i] * (f0[i] * AB[0] + AB[1]) + (1 - m.metal) * b * 0.45 * (nn[1] * 0.4 + 0.6)); }, 2, 1);
      S.sphere(ctx, 3 * W / 4, H / 2 - 4, R, nn => S.shade(nn, { base: m.base, metal: m.metal, rough, light: 0, envOpt: STUDIO }), 2, 1);
      X.label(ctx, 'gradient', W / 4, H - 8, col('muted'), 'center'); X.label(ctx, 'environment probe', 3 * W / 4, H - 8, col('muted'), 'center');
    },
    plot: false, size: [880, 290]
  });
})();
