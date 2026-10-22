/* Faking Transparency with Screen Passes — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, S = window.Surf, { col, alpha, num } = A;
  const { sat, clamp, css } = S;

  /* ---------- blend versus filter ---------- */
  const TINT = [0.85, 0.08, 0.06], BGS = [[0.9, 0.9, 0.9], [0.1, 0.75, 0.15], [0.1, 0.25, 0.85]], BGN = ['white', 'green', 'blue'];
  A.fx('filter', {
    title: 'Red glass: blending paints over, filtering lets through',
    expr: 'blended = tint · {a} + bg · (1 − {a}),   filtered = bg · T,   bg = {bg}',
    vars: { a: { sym: 'α', name: 'opacity used for blending', min: 0, max: 1, value: 0.5, step: 0.01 },
            bg: { sym: 'bg', name: 'background', values: [0, 1, 2], labels: BGN, index: 1 } },
    out: [{ sym: 'blended (green ch.)', f: v => TINT[1] * v.a + BGS[v.bg][1] * (1 - v.a), color: 'bad' }, { sym: 'filtered (green ch.)', f: v => BGS[v.bg][1] * TINT[1], color: 'good' }],
    sub: v => v.bg === 1 ? 'red glass in front of green: real glass lets almost nothing through (it absorbs green). Blending keeps half the green and looks <b>muddy brown</b> instead of <b>dark</b>.' : v.bg === 0 ? 'in front of white both look red; the difference shows only on coloured backgrounds' : 'red glass absorbs blue too: filtering goes dark, blending stays purple',
    draw(ctx, W, H, v, X) {
      const bg = BGS[v.bg], bl = bg.map((b, i) => TINT[i] * v.a + b * (1 - v.a)), fi = bg.map((b, i) => b * TINT[i]), w = (W - 60) / 3;
      [[bg, 'background'], [bl, 'blended'], [fi, 'filtered (real glass)']].forEach(([c, t], i) => { ctx.fillStyle = css(c); ctx.fillRect(15 + i * (w + 15), 40, w, H - 80); ctx.strokeStyle = col('line'); ctx.strokeRect(15 + i * (w + 15), 40, w, H - 80); X.label(ctx, t, 15 + i * (w + 15), 26, col('muted')); });
    },
    plot: { x: 'a', y: [0, 1] }, size: [440, 220]
  });

  /* ---------- the cost of a screen copy ---------- */
  const RES = [[1920, 1080], [2560, 1440], [3840, 2160]];
  A.fx('copycost', {
    title: 'What a copy of the screen costs',
    expr: 'memory = pixels({res}) · bytes({fmt}) · (mips ? 4/3 : 1),   mips = {mips}',
    vars: { res: { sym: 'res', name: 'resolution', values: [0, 1, 2], labels: ['1080p', '1440p', '4K'], index: 0 },
            fmt: { sym: 'format', name: 'colour format', values: [4, 8], labels: ['R11G11B10 (4 B)', 'RGBA16F (8 B)'], index: 1 },
            mips: { sym: 'mips', name: 'mip chain for blur', values: [0, 1], labels: ['no', 'yes'], index: 1 } },
    out: { sym: 'memory', f: v => RES[v.res][0] * RES[v.res][1] * v.fmt * (v.mips ? 4 / 3 : 1) / 1048576, unit: 'MB' },
    sub: (v, n) => { const mb = RES[v.res][0] * RES[v.res][1] * v.fmt * (v.mips ? 4 / 3 : 1) / 1048576; return `<b>${n(mb)} MB</b>, written and read once per frame: about ${n(mb * 2 * 60 / 1024)} GB/s of bandwidth at 60 fps, before any blur passes`; },
    plot: false
  });

  /* ---------- the full-screen pass with a mask ---------- */
  function sceneAt(x, y, W, H) { const stripe = Math.floor(x / (W / 9)) % 2 ? [0.2, 0.36, 0.55] : [0.85, 0.7, 0.35]; const dx = x - W * 0.62, dy = y - H * 0.55; return dx * dx + dy * dy < (H * 0.18) * (H * 0.18) ? [0.75, 0.12, 0.1] : stripe; }
  A.fx('mask', {
    title: 'One full-screen pass, many glass objects',
    expr: 'out = lerp(scene(uv), tint · scene(uv + {k} · n(uv)), mask),   edge softness {s}',
    vars: { k: { sym: 'k', name: 'distortion strength', min: 0, max: 0.06, value: 0.025, step: 0.001 },
            s: { sym: 's', name: 'mask edge softness', min: 0, max: 0.2, value: 0.03, step: 0.005 } },
    out: { sym: 'max offset at 1080p', f: v => v.k * 1920, unit: 'px', fmt: x => num(x) },
    sub: (v, n) => `one pass over the whole screen; inside the mask the scene is read up to <b>${n(v.k * 1920)} px</b> away (at 1080p) and tinted`,
    draw(ctx, W, H, v, X) {
      const pw = Math.floor((W - 40) / 3), ph = H - 50, step = 3;
      const mask = (x, y) => { const dx = (x / pw - 0.4) / 0.28, dy = (y / ph - 0.5) / 0.36, d = Math.max(Math.abs(dx), Math.abs(dy)); return 1 - S.smooth(1 - v.s * 4 - 0.001, 1, d); };
      for (let y = 0; y < ph; y += step) for (let x = 0; x < pw; x += step) {
        const sc = sceneAt(x, y, pw, ph), m = mask(x, y), nx = Math.sin(y * 0.09) * Math.cos(x * 0.05), ny = Math.cos(y * 0.07 + x * 0.04);
        const so = sceneAt(clamp(x + v.k * pw * 4 * nx, 0, pw - 1), clamp(y + v.k * ph * 4 * ny, 0, ph - 1), pw, ph).map((c, i) => c * [0.75, 0.95, 1.0][i]);
        ctx.fillStyle = css(sc); ctx.fillRect(10 + x, 30 + y, step + 0.6, step + 0.6);
        ctx.fillStyle = css([m, m, m]); ctx.fillRect(20 + pw + x, 30 + y, step + 0.6, step + 0.6);
        ctx.fillStyle = css(sc.map((c, i) => S.lerp(c, so[i], m))); ctx.fillRect(30 + 2 * pw + x, 30 + y, step + 0.6, step + 0.6);
      }
      ['scene colour', 'mask (custom buffer or stencil)', 'result'].forEach((t, i) => X.label(ctx, t, 10 + i * (pw + 10), 18, col('muted')));
    },
    plot: false, size: [880, 260]
  });

  /* ---------- leaks and depth rejection ---------- */
  function scan(v) {
    const N = 120, out = [], glass = [20, 100], pil = [52, 62]; let leaks = 0;
    for (let i = 0; i < N; i++) {
      const inGlass = i >= glass[0] && i < glass[1] && !(i >= pil[0] && i < pil[1]);
      const bgCol = j => (j >= pil[0] && j < pil[1]) ? 'fg' : (Math.floor(j / 10) % 2 ? 'a' : 'b');
      if (!inGlass) { out.push(bgCol(i)); continue; }
      const off = clamp(Math.round(i + v.o * Math.sin(i * 0.35)), 0, N - 1);
      let c = bgCol(off);
      if (c === 'fg') { if (v.rej) c = bgCol(i); else leaks++; }
      out.push(c === 'fg' ? 'leak' : c);
    }
    return { out, leaks };
  }
  A.fx('leak', {
    title: 'Foreground objects leak into the distortion',
    expr: 'uv′ = uv + offset({o}),   if depth(uv′) is in front of the glass: uv′ = uv   ({rej})',
    vars: { o: { sym: 'offset', name: 'distortion amplitude in pixels', min: 0, max: 12, value: 6, step: 1 },
            rej: { sym: 'reject', name: 'depth rejection', values: [0, 1], labels: ['off', 'on'], index: 0 } },
    out: { sym: 'leaking pixels', f: v => scan(v).leaks },
    sub: v => { const l = scan(v).leaks; return v.rej ? 'with rejection: samples that land on the pillar fall back to the undistorted pixel, no leak' : l ? `<b>${l} pixels</b> next to the pillar copy the pillar's colour: a ghost outline around anything in front of the glass` : 'no leaks at this offset'; },
    draw(ctx, W, H, v, X) {
      const r = scan(v), N = r.out.length, w = (W - 20) / N, C = { a: '#3d6f9e', b: '#d8b45c', fg: col('ink'), leak: '#e05a4f' };
      for (let i = 0; i < N; i++) { const isG = i >= 20 && i < 100; ctx.fillStyle = C[r.out[i]]; ctx.fillRect(10 + i * w, 50, w + 0.5, 80); if (isG && r.out[i] !== 'fg') { ctx.fillStyle = 'rgba(160,210,255,0.18)'; ctx.fillRect(10 + i * w, 50, w + 0.5, 80); } }
      ctx.strokeStyle = col('ray'); ctx.lineWidth = 2; ctx.strokeRect(10 + 20 * w, 46, 80 * w, 88); X.label(ctx, 'glass (distorted area)', 10 + 20 * w, 36, col('ray'));
      X.label(ctx, 'pillar in front of the glass', 10 + 57 * w, 150, col('ink'), 'center'); X.label(ctx, 'red: leaked pillar colour', 10, H - 12, '#e05a4f');
    },
    plot: { x: 'o', y: [0, 30] }, size: [520, 220]
  });

  /* ---------- thickness from depth ---------- */
  A.fx('thick', {
    title: 'Thickness from two depths',
    expr: 'thickness = depth<sub>back</sub> − depth<sub>front</sub>,   T = e<sup>−{mu} · thickness</sup>,   object radius {R}',
    vars: { mu: { sym: 'μ', name: 'absorption per metre (one channel)', min: 0, max: 6, value: 2, step: 0.05 },
            R: { sym: 'R', name: 'radius of the object', unit: 'm', min: 0.1, max: 1.5, value: 0.6, step: 0.01 } },
    out: { sym: 'T at the centre', f: v => Math.exp(-v.mu * 2 * v.R) },
    sub: (v, n) => `through the centre the ray crosses <b>${n(2 * v.R)} m</b> and keeps <b>${n(Math.exp(-v.mu * 2 * v.R) * 100)} %</b>; near the rim almost everything`,
    draw(ctx, W, H, v, X) {
      const cx = W / 2, cy = H / 2 - 8, s = (H - 70) / 3, R = v.R * s;
      ctx.fillStyle = alpha(col('muted'), 0.12); ctx.fillRect(0, 0, W, H);
      for (let y = -R; y <= R; y += 1) { const ch = 2 * Math.sqrt(Math.max(R * R - y * y, 0)) / s, T = Math.exp(-v.mu * ch); ctx.fillStyle = css([0.95 * T + 0.0, 0.85 * Math.pow(T, 0.6), 0.6 * Math.pow(T, 0.3)].map(x => x)); ctx.fillRect(cx - Math.sqrt(Math.max(R * R - y * y, 0)), cy + y, 2 * Math.sqrt(Math.max(R * R - y * y, 0)), 1.2); }
      ctx.strokeStyle = col('ray'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
      X.arrow(ctx, 20, cy, cx - R - 4, cy, col('accent'), 2, 8); X.label(ctx, 'view', 20, cy - 12, col('accent'));
      ctx.setLineDash([4, 4]); ctx.strokeStyle = col('accent'); ctx.beginPath(); ctx.moveTo(cx - R, cy + R + 14); ctx.lineTo(cx + R, cy + R + 14); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, 'front depth', cx - R, cy + R + 28, col('muted'), 'center'); X.label(ctx, 'back depth', cx + R, cy + R + 28, col('muted'), 'center');
      X.label(ctx, 'thick centre absorbs more than the thin rim', 10, H - 8, col('muted'));
    },
    plot: { x: 'mu', y: [0, 1.02] }, size: [440, 280]
  });

  /* ---------- screen edge fade ---------- */
  A.fx('edge', {
    title: 'Fade the distortion out at the screen border',
    expr: 'w = saturate(min({u}, 1 − {u}) / {f}),   uv′ = lerp(uv, uv + offset, w)',
    vars: { u: { sym: 'u', name: 'horizontal screen coordinate', min: 0, max: 1, value: 0.03, step: 0.005 },
            f: { sym: 'f', name: 'fade width', min: 0.005, max: 0.2, value: 0.05, step: 0.005 } },
    out: { sym: 'w', f: v => sat(Math.min(v.u, 1 - v.u) / v.f) },
    sub: (v, n) => `at u = ${n(v.u)} the offset is scaled by <b>${n(sat(Math.min(v.u, 1 - v.u) / v.f))}</b>: no reads outside the image, no smeared border`,
    plot: { x: 'u', y: [0, 1.05] }
  });
})();
