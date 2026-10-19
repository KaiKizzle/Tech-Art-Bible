/* Sun to Screen — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const DEG = Math.PI / 180, L2 = Math.log2;
  const enc = x => x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  const grey = x => { const c = Math.round(clamp(enc(clamp(x, 0, 1)), 0, 1) * 255); return `rgb(${c},${c},${c})`; };
  function hableP(x) { const a = .15, b = .5, c = .1, d = .2, e = .02, f = .3; return ((x * (a * x + c * b) + d * e) / (x * (a * x + b) + d * f)) - e / f; }
  const HW = hableP(11.2);
  const TM = {
    clip: x => Math.min(1, x), reinhard: x => x / (1 + x),
    aces: x => { x *= 0.6; return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1); },
    hable: x => clamp(hableP(2 * x) / HW, 0, 1)
  };
  /* a horizontal log axis helper: returns x(px) for a value */
  function logAxis(ctx, X, L, R, y, lo, hi, unit) {
    const P = v => L + (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * (R - L);
    ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke();
    for (let e = Math.ceil(Math.log10(lo)); e <= Math.log10(hi); e++) { const x = P(Math.pow(10, e)); ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke(); X.label(ctx, A.short(Math.pow(10, e)), x, y + 18, col('muted'), 'center'); }
    if (unit) X.label(ctx, unit, R, y - 10, col('muted'), 'right');
    return P;
  }

  A.fx('stops', {
    title: 'Counting stops between two brightnesses',
    expr: 'stops = log₂({a} / {b})',
    vars: { a: { name: 'brighter luminance', unit: 'cd/m²', min: 0.01, max: 100000, value: 7000, log: true },
            b: { name: 'darker luminance', unit: 'cd/m²', min: 0.001, max: 1000, value: 2, log: true } },
    out: { sym: 'stops', f: v => L2(v.a / v.b) },
    sub: v => `stops = log₂(${num(v.a)} / ${num(v.b)}) = log₂(${num(v.a / v.b)}) = <b>${num(L2(v.a / v.b))}</b>: the brighter value is 2 multiplied by itself ${num(L2(v.a / v.b))} times`,
    draw(ctx, W, H, v, X) {
      const P = logAxis(ctx, X, 24, W - 24, 150, 0.001, 100000, 'cd/m², log scale');
      const lo = Math.min(v.a, v.b), hi = Math.max(v.a, v.b);
      ctx.fillStyle = alpha(col('accent'), 0.18); ctx.fillRect(P(lo), 70, P(hi) - P(lo), 60);
      const n = Math.floor(L2(hi / lo));
      if (n <= 60) for (let k = 0; k <= n; k++) { const x = P(lo * Math.pow(2, k)); ctx.strokeStyle = alpha(col('accent'), 0.8); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 74); ctx.lineTo(x, 126); ctx.stroke(); }
      X.dot(ctx, P(v.a), 100, col('ray'), 6); X.dot(ctx, P(v.b), 100, col('accent'), 6);
      X.label(ctx, 'each tick is one doubling', P(lo), 60, col('accent'));
      [['night street', 1], ['wall at noon', 6000], ['office', 80]].forEach(([n2, l]) => { X.dot(ctx, P(l), 150, col('muted'), 3); X.label(ctx, n2, P(l), 196, col('muted'), 'center'); });
    },
    plot: { x: 'a' },
    note: 'The display range is about 10 stops. Everything outside the band has to be squeezed in or cut off.'
  });

  A.fx('lm2cd', {
    title: 'Lumens to candela for a bulb that shines everywhere',
    expr: 'I = {Phi} / 4π',
    vars: { Phi: { sym: 'Φ', name: 'luminous flux of the bulb', unit: 'lm', min: 50, max: 5000, value: 800, step: 10 } },
    out: { sym: 'I', unit: 'cd', f: v => v.Phi / (4 * Math.PI) },
    sub: v => `I = ${num(v.Phi)} / 12.566 = <b>${num(v.Phi / (4 * Math.PI))} cd</b>`,
    draw(ctx, W, H, v, X) {
      const c = [W / 2, H / 2], I = v.Phi / (4 * Math.PI), r = 30 + Math.sqrt(I) * 6;
      for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; ctx.strokeStyle = alpha(col('accent'), 0.5); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(c[0] + Math.cos(a) * 18, c[1] + Math.sin(a) * 18); ctx.lineTo(c[0] + Math.cos(a) * Math.min(r, 120), c[1] + Math.sin(a) * Math.min(r, 120)); ctx.stroke(); }
      ctx.strokeStyle = alpha(col('ray'), 0.6); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(c[0], c[1], 120, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      X.dot(ctx, c[0], c[1], col('accent'), 12);
      X.label(ctx, `${num(v.Phi)} lm in total, shared by a sphere of 4π ≈ 12.57 sr`, W / 2, H - 14, col('muted'), 'center');
      X.label(ctx, `${num(I)} cd in each direction`, W / 2, 22, col('accent'), 'center', true);
    },
    plot: { x: 'Phi' }
  });

  A.fx('invsq', {
    title: 'Candela to lux: the inverse-square law',
    expr: 'E = {I} · cos {th} / {d}²',
    vars: { I: { name: 'intensity toward the wall', unit: 'cd', min: 1, max: 500, value: 64, step: 1 },
            th: { sym: 'θ', name: 'tilt of the wall', unit: '°', min: 0, max: 85, value: 0, step: 1 },
            d: { name: 'distance', unit: 'm', min: 0.5, max: 6, value: 2, step: 0.05 } },
    out: { sym: 'E', unit: 'lx', f: v => v.I * Math.cos(v.th * DEG) / (v.d * v.d) },
    sub: v => `E = ${num(v.I)} · ${num(Math.cos(v.th * DEG))} / ${num(v.d * v.d)} = <b>${num(v.I * Math.cos(v.th * DEG) / (v.d * v.d))} lx</b>`,
    draw(ctx, W, H, v, X) {
      const bx = 40, cy = H / 2, s = 62, wx = bx + v.d * s, half = 0.25 * v.d * s; // a fixed cone
      ctx.fillStyle = alpha(col('accent'), 0.12); ctx.beginPath(); ctx.moveTo(bx, cy); ctx.lineTo(wx, cy - half); ctx.lineTo(wx, cy + half); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = alpha(col('accent'), 0.6); ctx.beginPath(); ctx.moveTo(bx, cy); ctx.lineTo(wx, cy - half); ctx.moveTo(bx, cy); ctx.lineTo(wx, cy + half); ctx.stroke();
      // tilted wall
      const t = v.th * DEG, L = 110, dx = Math.sin(t) * L, dy = Math.cos(t) * L;
      ctx.strokeStyle = col('ink'); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(wx - dx, cy - dy); ctx.lineTo(wx + dx, cy + dy); ctx.stroke();
      const patch = half / Math.cos(t);
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(wx - Math.sin(t) * patch, cy - Math.cos(t) * patch); ctx.lineTo(wx + Math.sin(t) * patch, cy + Math.cos(t) * patch); ctx.stroke();
      X.dot(ctx, bx, cy, col('accent'), 9); X.label(ctx, 'bulb', bx, cy + 24, col('muted'), 'center');
      X.label(ctx, `the same light lands on a patch ${num(v.d * v.d / Math.cos(t))}× the size it has at 1 m, head-on`, 12, H - 12, col('muted'));
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, H - 40); ctx.lineTo(wx, H - 40); ctx.stroke(); X.label(ctx, `d = ${num(v.d)} m`, (bx + wx) / 2, H - 46, col('muted'), 'center');
    },
    plot: { x: 'd' },
    note: 'Doubling d divides E by four. Animate d to see the 1/d² curve.'
  });

  A.fx('lambert', {
    title: 'Lux to nits on a matte surface',
    expr: 'L = {rho} · {E} / π',
    vars: { rho: { sym: 'ρ', name: 'albedo (fraction reflected)', min: 0.02, max: 0.95, value: 0.6, step: 0.01 },
            E: { name: 'illuminance arriving', unit: 'lx', min: 1, max: 100000, value: 16, log: true } },
    out: { sym: 'L', unit: 'cd/m²', f: v => v.rho * v.E / Math.PI },
    sub: v => `L = ${num(v.rho)} · ${num(v.E)} / 3.1416 = <b>${num(v.rho * v.E / Math.PI)} cd/m²</b>`,
    draw(ctx, W, H, v, X) {
      const g = [['charcoal', 0.04], ['asphalt', 0.1], ['concrete', 0.3], ['grass', 0.25], ['white paint', 0.8], ['fresh snow', 0.9]];
      g.forEach(([n, r], i) => { const x = 20 + i * ((W - 40) / 6), w = (W - 40) / 6 - 8; ctx.fillStyle = grey(r); ctx.fillRect(x, 40, w, 80); ctx.strokeStyle = col('line'); ctx.strokeRect(x, 40, w, 80); X.label(ctx, n, x + w / 2, 136, col('muted'), 'center'); X.label(ctx, 'ρ ' + r, x + w / 2, 152, col('muted'), 'center'); });
      const x = 20 + v.rho * (W - 40); ctx.fillStyle = col('accent'); ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x - 6, 20); ctx.lineTo(x + 6, 20); ctx.fill();
      ctx.fillStyle = grey(v.rho); ctx.fillRect(20, 180, W - 40, 50); ctx.strokeStyle = col('line'); ctx.strokeRect(20, 180, W - 40, 50);
      X.label(ctx, `your surface, ρ = ${num(v.rho)}: reflects ${Math.round(v.rho * 100)}% of the light`, W / 2, 210, v.rho > 0.4 ? '#111' : '#eee', 'center', true);
    },
    plot: { x: 'E' },
    note: 'Real materials stay between about 0.04 and 0.9. A pure white 1.0 wall would look like it glows.'
  });

  const Ns = [1, 1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22], Ts = [1, 1 / 2, 1 / 4, 1 / 8, 1 / 15, 1 / 30, 1 / 60, 1 / 125, 1 / 250, 1 / 500, 1 / 1000, 1 / 2000, 1 / 4000], Ss = [100, 200, 400, 800, 1600, 3200, 6400];
  const evOf = v => L2(v.N * v.N / v.t) - L2(v.S / 100);
  A.fx('ev', {
    title: 'Three camera settings, one number',
    expr: 'EV100 = log₂({N}² / {t}) − log₂({S} / 100)',
    vars: { N: { name: 'aperture (f-number)', values: Ns, index: 6, labels: Ns.map(n => 'f/' + n), log: true },
            t: { name: 'shutter time', values: Ts, index: 7, labels: Ts.map(t => t >= 1 ? t + ' s' : '1/' + Math.round(1 / t) + ' s'), log: true },
            S: { name: 'ISO', values: Ss, index: 0, labels: Ss.map(String), log: true } },
    out: { sym: 'EV100', f: evOf },
    steps: v => [['aperture: log₂(N²)', num(L2(v.N * v.N)) + ' stops'], ['shutter: log₂(1 / t)', num(L2(1 / v.t)) + ' stops'], ['ISO: −log₂(S / 100)', num(-L2(v.S / 100)) + ' stops'], ['sum', num(evOf(v))]],
    draw(ctx, W, H, v, X) {
      const parts = [['aperture', L2(v.N * v.N), 'ax-x'], ['shutter', L2(1 / v.t), 'ax-y'], ['ISO', -L2(v.S / 100), 'ax-z']];
      const s = 13, x0 = 120; let x = x0;
      ctx.strokeStyle = col('muted'); ctx.beginPath(); ctx.moveTo(x0, 30); ctx.lineTo(x0, H - 40); ctx.stroke();
      parts.forEach(([n, st, c], i) => { const y = 40 + i * 52; ctx.fillStyle = col(c); ctx.fillRect(Math.min(x, x + st * s), y, Math.abs(st * s), 30); X.label(ctx, n, x0 - 10, y + 20, col(c), 'right', true); X.label(ctx, (st >= 0 ? '+' : '') + num(st), Math.max(x, x + st * s) + 6, y + 20, col('ink')); x += st * s; });
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, H - 50); ctx.stroke();
      X.label(ctx, `EV100 = ${num(evOf(v))}`, x, H - 30, col('accent'), 'center', true);
      X.label(ctx, 'stops added left to right', x0, 22, col('muted'));
    },
    plot: { x: 't', y: [-6, 22] },
    note: 'Sunny 16: f/16, 1/125 s, ISO 100 gives about 15, the EV100 for direct sun.'
  });

  A.fx('expo', {
    title: 'EV100 to the multiplier a shader uses',
    expr: 'exposure = 1 / (1.2 · 2<sup>{ev}</sup>),   pixel = {L} · exposure',
    vars: { ev: { sym: 'EV100', name: 'exposure value', min: -2, max: 17, value: 8, step: 0.1 },
            L: { name: 'scene luminance of a surface', unit: 'cd/m²', min: 0.01, max: 100000, value: 20, log: true } },
    out: [{ sym: 'exposure', f: v => 1 / (1.2 * Math.pow(2, v.ev)), color: 'ax-y' }, { sym: 'pixel', f: v => v.L / (1.2 * Math.pow(2, v.ev)), color: 'accent' }],
    sub: v => { const e = 1 / (1.2 * Math.pow(2, v.ev)); return `exposure = 1 / (1.2 · ${num(Math.pow(2, v.ev))}) = ${num(e)},   pixel = ${num(v.L)} · ${num(e)} = <b>${num(v.L * e)}</b>${v.L * e > 1 ? ' (above 1: the tonemapper has to compress it)' : ''}`; },
    draw(ctx, W, H, v, X) {
      const P = logAxis(ctx, X, 24, W - 24, 170, 0.01, 100000, 'scene luminance, cd/m²');
      const Lmax = 1.2 * Math.pow(2, v.ev), lo = Lmax / 1024;
      ctx.fillStyle = alpha(col('accent'), 0.15); ctx.fillRect(P(Math.max(lo, 0.01)), 90, P(Math.min(Lmax, 100000)) - P(Math.max(lo, 0.01)), 60);
      X.label(ctx, '10 stops below the clip point', P(Math.max(lo, 0.01)) + 4, 84, col('accent'));
      ctx.strokeStyle = col('bad'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P(Lmax), 70); ctx.lineTo(P(Lmax), 160); ctx.stroke(); X.label(ctx, 'pixel = 1', P(Lmax), 62, col('bad'), 'center', true);
      const mg = Lmax * 0.104; ctx.strokeStyle = col('ink'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(P(mg), 90); ctx.lineTo(P(mg), 160); ctx.stroke(); ctx.setLineDash([]); X.label(ctx, 'metered mid tone', P(mg), 120, col('ink'), 'center');
      X.dot(ctx, P(v.L), 170, col('ray'), 7); X.label(ctx, 'your surface', P(v.L), 214, col('ray'), 'center', true);
    },
    plot: { x: 'ev', logY: true, y: [1e-6, 1000] },
    note: 'Raising EV100 by one halves every pixel: the whole window slides one stop to the right.'
  });

  A.fx('meter', {
    title: 'What a light meter (and auto exposure) computes',
    expr: 'EV100 = log₂({La} · 100 / 12.5) = log₂(8 · {La})',
    vars: { La: { sym: 'L<sub>avg</sub>', name: 'average scene luminance', unit: 'cd/m²', min: 0.001, max: 100000, value: 25, log: true } },
    out: { sym: 'EV100', f: v => L2(8 * v.La) },
    sub: v => `EV100 = log₂(8 · ${num(v.La)}) = log₂(${num(8 * v.La)}) = <b>${num(L2(8 * v.La))}</b>`,
    plot: { x: 'La' },
    note: 'A straight line on a log axis: ten times brighter is about 3.3 more EV.'
  });

  const logavg = v => { const n = v.n, m = 100; return { ar: (n * v.Lb + (m - n) * v.Ld) / m, ge: Math.exp((n * Math.log(v.Lb) + (m - n) * Math.log(v.Ld)) / m) }; };
  A.fx('logavg', {
    title: 'Arithmetic mean against log average',
    expr: 'L<sub>avg</sub> = exp(mean(ln L)),   {n} sky pixels at {Lb}, the rest at {Ld}',
    vars: { n: { name: 'sky pixels out of 100', min: 0, max: 50, value: 3, step: 1 },
            Lb: { sym: 'L<sub>sky</sub>', name: 'sky luminance', unit: 'cd/m²', min: 100, max: 100000, value: 7000, log: true },
            Ld: { sym: 'L<sub>room</sub>', name: 'room luminance', unit: 'cd/m²', min: 1, max: 200, value: 20, log: true } },
    out: [{ sym: 'mean', name: 'plain average', f: v => logavg(v).ar, color: 'bad' }, { sym: 'log avg', f: v => logavg(v).ge, color: 'good' }],
    sub: v => { const q = logavg(v); return `plain average <b>${num(q.ar)}</b> against log average <b>${num(q.ge)}</b>: ${num(L2(q.ar / q.ge))} stops apart`; },
    steps: v => { const q = logavg(v); return [['plain average', num(q.ar)], ['log average', num(q.ge)], ['EV100 from the plain average', num(L2(8 * q.ar))], ['EV100 from the log average', num(L2(8 * q.ge))]]; },
    draw(ctx, W, H, v, X) {
      const s = 14, x0 = 20, y0 = 20;
      for (let i = 0; i < 100; i++) { const r = Math.floor(i / 10), c = i % 10, sky = i < v.n; ctx.fillStyle = sky ? '#cfe3ff' : '#6b5440'; ctx.fillRect(x0 + c * s, y0 + r * s, s - 2, s - 2); }
      X.label(ctx, 'the frame: 100 pixels', x0, y0 + 10 * s + 16, col('muted'));
      const P = logAxis(ctx, X, 190, W - 16, 120, 1, 100000, 'cd/m²');
      const q = logavg(v);
      [[q.ar, 'plain', 'bad', 80], [q.ge, 'log', 'good', 160]].forEach(([x, n2, c, y]) => { ctx.strokeStyle = col(c); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(P(x), 120); ctx.lineTo(P(x), y); ctx.stroke(); X.label(ctx, n2, P(x), y + (y < 120 ? -6 : 14), col(c), 'center', true); });
      X.dot(ctx, P(v.Ld), 120, '#6b5440', 5); X.dot(ctx, P(v.Lb), 120, '#cfe3ff', 5);
    },
    plot: { x: 'n', logY: true, y: [1, 100000] },
    note: 'Three bright pixels drag the plain average up five stops; the log average barely moves.'
  });

  A.fx('adapt', {
    title: 'Adapting toward the target over time',
    expr: 'EV({time}) = {tg} + ({e0} − {tg}) · e<sup>−{k} · {time}</sup>',
    vars: { time: { sym: 'time', name: 'seconds since the change', unit: 's', min: 0, max: 5, value: 1, step: 0.02 },
            k: { name: 'adaptation speed', min: 0.2, max: 10, value: 1.5, step: 0.1 },
            e0: { sym: 'EV<sub>0</sub>', name: 'EV at the start (indoors)', min: 4, max: 16, value: 8, step: 0.5 },
            tg: { sym: 'EV<sub>T</sub>', name: 'target EV (looking at the window)', min: 4, max: 16, value: 14, step: 0.5 } },
    out: { sym: 'EV', f: v => v.tg + (v.e0 - v.tg) * Math.exp(-v.k * v.time) },
    sub: v => { const r = Math.exp(-v.k * v.time); return `EV = ${num(v.tg)} + (${num(v.e0)} − ${num(v.tg)}) · ${num(r)} = <b>${num(v.tg + (v.e0 - v.tg) * r)}</b>, ${Math.round((1 - r) * 100)}% of the way`; },
    draw(ctx, W, H, v, X) {
      const ev = v.tg + (v.e0 - v.tg) * Math.exp(-v.k * v.time), P = e => 30 + (e - 4) / 12 * (W - 60);
      ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(30, 150); ctx.lineTo(W - 30, 150); ctx.stroke();
      for (let e = 4; e <= 16; e += 2) X.label(ctx, String(e), P(e), 170, col('muted'), 'center');
      X.dot(ctx, P(v.e0), 150, col('muted'), 6); X.label(ctx, 'start', P(v.e0), 130, col('muted'), 'center');
      X.dot(ctx, P(v.tg), 150, col('ray'), 6); X.label(ctx, 'target', P(v.tg), 130, col('ray'), 'center', true);
      X.arrow(ctx, P(v.e0), 100, P(ev), 100, col('accent'), 3); X.label(ctx, `EV now ${num(ev)}`, P(ev), 86, col('accent'), 'center', true);
      // the frame darkening/brightening: a grey whose brightness = room seen at this EV
      const room = 20 / (1.2 * Math.pow(2, ev)), win = 7000 / (1.2 * Math.pow(2, ev));
      ctx.fillStyle = grey(TM.aces(room)); ctx.fillRect(30, 196, (W - 60) / 2, 50); ctx.fillStyle = grey(TM.aces(win)); ctx.fillRect(30 + (W - 60) / 2, 196, (W - 60) / 2, 50);
      X.label(ctx, 'room at this EV', 36, 262, col('muted')); X.label(ctx, 'window at this EV', W / 2 + 6, 262, col('muted'));
    },
    size: [440, 280],
    plot: { x: 'time', y: [4, 16] },
    note: 'After 1/k seconds the EV has covered 63% of the distance, after 3/k seconds 95%, at any frame rate.'
  });

  A.fx('tmc', {
    title: 'Four tonemapping curves',
    expr: 'x = 0.18 · 2<sup>{s}</sup>,   Reinhard: x / (1 + x)',
    vars: { s: { sym: 'stops', name: 'stops above middle grey', min: -6, max: 8, value: 2, step: 0.05 } },
    out: [{ sym: 'clip', f: v => TM.clip(0.18 * Math.pow(2, v.s)), color: 'muted' }, { sym: 'Reinhard', f: v => TM.reinhard(0.18 * Math.pow(2, v.s)), color: 'ax-y' },
          { sym: 'ACES fit', f: v => TM.aces(0.18 * Math.pow(2, v.s)), color: 'accent' }, { sym: 'Hable', f: v => TM.hable(0.18 * Math.pow(2, v.s)), color: 'ray' }],
    sub: v => `x = 0.18 · 2<sup>${num(v.s)}</sup> = <b>${num(0.18 * Math.pow(2, v.s))}</b> (exposed, linear)`,
    draw(ctx, W, H, v, X) {
      const x = 0.18 * Math.pow(2, v.s), names = [['clip', 'Clip'], ['reinhard', 'Reinhard'], ['aces', 'ACES fit'], ['hable', 'Hable']], w = (W - 50) / 4;
      names.forEach(([k, n], i) => {
        const y = TM[k](x), x0 = 20 + i * (w + 3);
        ctx.fillStyle = grey(y); ctx.fillRect(x0, 40, w, 80);
        const o = [x * 1.0, x * 0.55, x * 0.15].map(TM[k]); ctx.fillStyle = `rgb(${o.map(c => Math.round(enc(c) * 255)).join(',')})`; ctx.fillRect(x0, 128, w, 60);
        ctx.strokeStyle = col('line'); ctx.strokeRect(x0, 40, w, 148);
        X.label(ctx, n, x0 + w / 2, 30, col('ink'), 'center', true); X.label(ctx, num(y), x0 + w / 2, 206, col('muted'), 'center');
      });
      X.label(ctx, 'top: grey · bottom: an orange light, curve applied per channel', 20, H - 16, col('muted'));
    },
    plot: { x: 's', y: [0, 1] },
    note: 'Animate the stops: watch Clip flatten at +2.5 stops while the others keep separating highlights, and the orange drift to yellow.'
  });

  A.fx('codes', {
    title: 'Where the 8-bit codes go',
    expr: 'code = round(f({x}) · (2<sup>{bits}</sup> − 1))',
    vars: { x: { name: 'display-linear value', min: 0, max: 0.25, value: 0.02, step: 0.001 },
            bits: { name: 'bits per channel', values: [3, 4, 5, 6, 7, 8, 10], index: 5 } },
    out: [{ sym: 'linear code', f: v => Math.round(v.x * (Math.pow(2, v.bits) - 1)), color: 'bad' }, { sym: 'sRGB code', f: v => Math.round(enc(v.x) * (Math.pow(2, v.bits) - 1)), color: 'good' }],
    sub: v => { const m = Math.pow(2, v.bits) - 1; return `linear: round(${num(v.x)} · ${m}) = <b>${Math.round(v.x * m)}</b>,   sRGB: round(${num(enc(v.x))} · ${m}) = <b>${Math.round(enc(v.x) * m)}</b>`; },
    steps: v => { const m = Math.pow(2, v.bits) - 1; return [['codes for the darkest quarter, stored linear', String(Math.round(0.25 * m))], ['stored with sRGB', String(Math.round(enc(0.25) * m))]]; },
    draw(ctx, W, H, v, X) {
      const m = Math.pow(2, v.bits) - 1, L = 20, R = W - 20;
      [['stored linear', x => Math.round(x * m) / m, 40], ['stored as sRGB', x => { const c = Math.round(enc(x) * m) / m; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }, 140]].forEach(([n, q, y]) => {
        for (let px = L; px < R; px++) { const x = (px - L) / (R - L) * 0.25; ctx.fillStyle = grey(q(x) * 4); ctx.fillRect(px, y, 1, 60); }
        X.label(ctx, n + ' (brightened ×4 to make it visible)', L, y - 8, col('muted'));
      });
      const px = L + v.x / 0.25 * (R - L); ctx.strokeStyle = col('accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, 34); ctx.lineTo(px, 206); ctx.stroke();
      X.label(ctx, '0', L, 222, col('muted'), 'center'); X.label(ctx, '0.25', R, 222, col('muted'), 'center');
    },
    plot: { x: 'x' },
    note: 'Fewer codes means visible steps (banding). The sRGB curve gives the dark tones about twice as many.'
  });
})();
