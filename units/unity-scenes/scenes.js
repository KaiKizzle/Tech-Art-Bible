/* Scene Management — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  function box(ctx, x, y, w, h, title, sub, c, X, fill) {
    ctx.fillStyle = alpha(col(c), fill == null ? 0.14 : fill); ctx.fillRect(x, y, w, h); ctx.strokeStyle = col(c); ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
    X.label(ctx, title, x + 10, y + (sub ? h / 2 - 8 : h / 2), col('ink'), 'left', true); if (sub) X.label(ctx, sub, x + 10, y + h / 2 + 9, col('muted'));
  }

  /* ---------- several scenes, one active ---------- */
  const SC = [['Bootstrap', 'managers, audio, save system', 40], ['UI', 'menus and HUD', 60], ['Level_A', 'geometry, lights, gameplay', 900], ['Level_B', 'the next area', 750]];
  A.fx('scenestack', {
    title: 'Loaded scenes and the active one',
    expr: 'loaded: Bootstrap, UI, Level_A {a}, Level_B {b};   active {s}',
    vars: { a: { sym: 'A', name: 'Level_A loaded', values: [0, 1], labels: ['no', 'yes'], index: 1 }, b: { sym: 'B', name: 'Level_B loaded', values: [0, 1], labels: ['no', 'yes'], index: 0 },
            s: { sym: 'active', name: 'active scene', values: [0, 1, 2, 3], labels: SC.map(x => x[0]), index: 2 } },
    out: { sym: 'memory', unit: 'MB', f: v => 100 + (v.a ? 900 : 0) + (v.b ? 750 : 0), color: 'accent' },
    sub: v => { const on = [1, 1, v.a, v.b]; if (!on[v.s]) return `${SC[v.s][0]} is not loaded, so it cannot be active: <code>SetActiveScene</code> fails until it is.`;
      return `<b>${SC[v.s][0]}</b> is active: <code>Instantiate</code> and <code>new GameObject</code> put objects there, and in URP and the built-in pipeline its Lighting settings (skybox, ambient, fog) apply to everything. HDRP takes the environment from Volumes instead. Unloading ${SC[v.s][0]} destroys what was spawned into it.`; },
    draw(ctx, W, H, v, X) {
      const on = [1, 1, v.a, v.b];
      SC.forEach((sc, i) => { const y = 12 + i * 46; box(ctx, 20, y, 420, 38, sc[0] + (on[i] ? '' : '  (not loaded)'), sc[1] + ' · ' + sc[2] + ' MB', i === v.s && on[i] ? 'accent' : on[i] ? 'ray' : 'line', X, on[i] ? (i === v.s ? 0.28 : 0.12) : 0.03);
        if (i === v.s && on[i]) X.label(ctx, 'ACTIVE', 430, y + 19, col('accent'), 'right', true); });
      X.label(ctx, 'Hierarchy window: one section per loaded scene', 470, 30, col('muted'));
      X.label(ctx, `memory for loaded scenes: ${100 + (v.a ? 900 : 0) + (v.b ? 750 : 0)} MB`, 470, 54, col('ink'), 'left', true);
      X.label(ctx, 'Bootstrap and UI stay loaded; levels come and go', 470, 78, col('muted'));
    },
    plot: false, size: [880, 200]
  });

  /* ---------- async loading and the activation hitch ---------- */
  A.fx('asyncload', {
    title: 'LoadSceneAsync: progress, then activation',
    expr: 'progress = 0.9 · min(1, t / {T});   activation frame ≈ {n} objects · {c} µs',
    vars: { T: { sym: 'T', name: 'time to load the data', unit: 's', min: 0.5, max: 10, value: 3, step: 0.1 }, n: { sym: 'n', name: 'objects in the scene', min: 100, max: 50000, value: 8000, log: true },
            c: { sym: 'c', name: 'Awake + OnEnable cost per object', unit: 'µs', min: 1, max: 100, value: 12, log: true }, w: { sym: 'allow', name: 'allowSceneActivation', values: [1, 0], labels: ['true', 'false (wait for the player)'], index: 0 } },
    out: { sym: 'activation frame', unit: 'ms', f: v => v.n * v.c / 1000, color: 'bad' },
    sub: v => { const ms = v.n * v.c / 1000; return `loading runs in the background for about ${num(v.T)} s while the game keeps rendering; progress stops at <b>0.9</b>` + (v.w ? ' and continues straight into activation' : ' and waits there until you set <code>allowSceneActivation = true</code>') + `. Activation integrates the scene on the main thread: one frame of about <b>${num(ms)} ms</b>` + (ms > 33 ? ', a visible hitch. Hide it behind a loading screen or split the scene.' : ', short enough to pass unnoticed.'); },
    draw(ctx, W, H, v, X) {
      const x0 = 84, w = W - 104, T = v.T + (v.w ? 0 : 1.5) + 0.8, X0 = t => x0 + t / T * w, top = 18, ph = H * 0.42;
      ctx.strokeStyle = col('line'); ctx.strokeRect(x0, top, w, ph);
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2.5; ctx.beginPath();
      for (let i = 0; i <= 200; i++) { const t = i / 200 * T, p = t < v.T ? 0.9 * t / v.T : t < v.T + (v.w ? 0 : 1.5) ? 0.9 : 1; const y = top + ph - p * ph; i ? ctx.lineTo(X0(t), y) : ctx.moveTo(X0(t), y); } ctx.stroke();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = col('muted'); ctx.beginPath(); ctx.moveTo(x0, top + ph * 0.1); ctx.lineTo(x0 + w, top + ph * 0.1); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, '0.9', x0 - 6, top + ph * 0.1, col('muted'), 'right'); X.label(ctx, 'progress', x0 - 6, top + 8, col('muted'), 'right');
      const fy = H - 24, fh = H * 0.36, ms = v.n * v.c / 1000, fT = 1000 / 60, sc = fh / Math.max(60, ms * 1.1);
      for (let t = 0; t < T; t += 1 / 30) { const act = Math.abs(t - (v.T + (v.w ? 0 : 1.5))) < 1 / 60, d = act ? ms + fT : fT; ctx.fillStyle = act ? col('bad') : alpha(col('ray'), 0.6); ctx.fillRect(X0(t), fy - d * sc, Math.max(1.5, w / T / 30 - 1), d * sc); }
      ctx.strokeStyle = alpha(col('good'), 0.8); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x0, fy - 33.3 * sc); ctx.lineTo(x0 + w, fy - 33.3 * sc); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, 'frame time', x0 - 6, fy - fh + 8, col('muted'), 'right'); X.label(ctx, '33 ms', x0 - 6, fy - 33.3 * sc, col('good'), 'right');
      X.label(ctx, 'time →', x0 + w, H - 8, col('muted'), 'right');
    },
    plot: false, size: [880, 300]
  });

  /* ---------- peak memory when switching levels ---------- */
  const STRAT = ['LoadScene Single, A → B', 'via an empty transition scene', 'load B additive, then unload A'];
  const curve = (v) => { const T = 0.08, base = 150; // returns [[t, MB]] and peak
    if (v.m === 0) return [[0, base + v.A], [0.3, base + v.A], [0.6, base + v.A + v.B], [0.65, base + v.B], [1, base + v.B]];
    if (v.m === 1) return [[0, base + v.A], [0.3, base + v.A], [0.35, base + T * 1000], [0.45, base + T * 1000], [0.75, base + v.B], [1, base + v.B]];
    return [[0, base + v.A], [0.3, base + v.A], [0.6, base + v.A + v.B], [0.7, base + v.A + v.B - (v.u ? 0 : 0)], [0.72, base + v.B + (v.u ? 0 : v.A * 0.6)], [1, base + v.B + (v.u ? 0 : v.A * 0.6)]]; };
  A.fx('peakmem', {
    title: 'Peak memory when switching from level A to level B',
    expr: 'peak = {m}: Single A + B,  transition max(A, B),  additive A + B',
    vars: { A: { sym: 'A', name: 'level A', unit: 'MB', min: 100, max: 2000, value: 900, step: 10 }, B: { sym: 'B', name: 'level B', unit: 'MB', min: 100, max: 2000, value: 1100, step: 10 },
            m: { sym: 'how', name: 'strategy', values: [0, 1, 2], labels: ['Single', 'transition scene', 'additive'], index: 0 }, u: { sym: 'unload', name: 'UnloadUnusedAssets after unloading', values: [1, 0], labels: ['yes', 'no'], index: 0 } },
    out: { sym: 'peak', unit: 'MB', f: v => Math.max(...curve(v).map(p => p[1])), color: 'accent' },
    sub: v => { const pk = Math.max(...curve(v).map(p => p[1])); return `${STRAT[v.m]}: peak <b>${num(pk)} MB</b> (150 MB of it is the bootstrap)` + (v.m === 2 && !v.u ? ' · without <code>Resources.UnloadUnusedAssets</code>, A\'s textures and meshes stay in memory after its objects are gone' : '') + (v.m === 0 ? ' · B is loaded before A is released, so both are in memory at once' : '') + (v.m === 1 ? ' · A is released before B arrives' : ''); },
    draw(ctx, W, H, v, X) {
      const pts = curve(v), x0 = 60, w = W - 80, yb = H - 26, mx = 4400, Y = m => yb - m / mx * (H - 50), Xt = t => x0 + t * w;
      ctx.strokeStyle = col('line'); ctx.beginPath(); ctx.moveTo(x0, yb); ctx.lineTo(x0 + w, yb); ctx.moveTo(x0, yb); ctx.lineTo(x0, 14); ctx.stroke();
      [1000, 2000, 3000, 4000].forEach(m => { X.label(ctx, m + '', x0 - 6, Y(m), col('muted'), 'right'); ctx.strokeStyle = alpha(col('line'), 0.5); ctx.beginPath(); ctx.moveTo(x0, Y(m)); ctx.lineTo(x0 + w, Y(m)); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(Xt(0), yb); pts.forEach(p => ctx.lineTo(Xt(p[0]), Y(p[1]))); ctx.lineTo(Xt(1), yb); ctx.closePath(); ctx.fillStyle = alpha(col('accent'), 0.25); ctx.fill();
      ctx.strokeStyle = col('accent'); ctx.lineWidth = 2.5; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(Xt(p[0]), Y(p[1])) : ctx.moveTo(Xt(p[0]), Y(p[1]))); ctx.stroke();
      const pk = Math.max(...pts.map(p => p[1])); ctx.setLineDash([4, 4]); ctx.strokeStyle = col('bad'); ctx.beginPath(); ctx.moveTo(x0, Y(pk)); ctx.lineTo(x0 + w, Y(pk)); ctx.stroke(); ctx.setLineDash([]);
      X.label(ctx, 'peak', x0 + w, Y(pk) - 10, col('bad'), 'right'); X.label(ctx, 'MB', x0 - 6, 10, col('muted'), 'right');
      X.label(ctx, 'playing A', Xt(0.12), yb - 12, col('muted'), 'center'); X.label(ctx, 'playing B', Xt(0.88), yb - 12, col('muted'), 'center');
    },
    plot: false, size: [880, 260]
  });
})();
