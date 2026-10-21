/* Addressables — live formulas and labs */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  function box(ctx, x, y, w, h, title, sub, c, X, fill) {
    ctx.fillStyle = alpha(col(c), fill == null ? 0.14 : fill); ctx.fillRect(x, y, w, h); ctx.strokeStyle = col(c); ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
    X.label(ctx, title, x + w / 2, y + (sub ? h / 2 - 8 : h / 2), col('ink'), 'center', true); if (sub) X.label(ctx, sub, x + w / 2, y + h / 2 + 9, col('muted'), 'center');
  }

  /* ---------- direct references load everything ---------- */
  A.fx('directref', {
    title: 'A shop with 200 items: what is in memory when it opens',
    expr: 'direct = {N} · {s} MB,   addressable = {u} · {s} MB',
    vars: { N: { sym: 'N', name: 'items the shop can show', min: 10, max: 500, value: 200, step: 1 }, s: { sym: 's', name: 'size of one item (mesh, textures)', unit: 'MB', min: 0.5, max: 40, value: 6, log: true },
            u: { sym: 'u', name: 'items on screen right now', min: 1, max: 50, value: 12, step: 1 } },
    out: [{ sym: 'direct references', unit: 'MB', f: v => v.N * v.s, color: 'bad' }, { sym: 'addressable, on demand', unit: 'MB', f: v => Math.min(v.u, v.N) * v.s, color: 'good' }],
    sub: v => `a list field of ${v.N} prefabs makes the scene depend on all of them: opening it loads <b>${num(v.N * v.s)} MB</b>. Storing addresses and loading the ${Math.min(v.u, v.N)} visible items loads <b>${num(Math.min(v.u, v.N) * v.s)} MB</b>, and the rest can even live on a server.`,
    plot: { x: 'N' }
  });

  /* ---------- pack together versus separately ---------- */
  A.fx('packmode', {
    title: 'Bundle mode: one bundle per group, or one per asset',
    expr: 'update download: together = {N} · {s} MB,   separately = {k} · {s} MB',
    vars: { N: { sym: 'N', name: 'assets in the group', min: 2, max: 400, value: 60, step: 1 }, s: { sym: 's', name: 'size of one asset', unit: 'MB', min: 0.1, max: 20, value: 2, log: true },
            k: { sym: 'k', name: 'assets changed in a content update', min: 1, max: 60, value: 1, step: 1 } },
    out: [{ sym: 'Pack Together', unit: 'MB', f: v => v.N * v.s, color: 'bad' }, { sym: 'Pack Separately', unit: 'MB', f: v => Math.min(v.k, v.N) * v.s, color: 'good' }],
    sub: v => `Pack Together: <b>1</b> bundle; one changed asset changes the bundle\'s hash, so players re-download all <b>${num(v.N * v.s)} MB</b>. Pack Separately: <b>${v.N}</b> bundles, the update is <b>${num(Math.min(v.k, v.N) * v.s)} MB</b>, but every bundle adds a file, a catalog entry and some load overhead. Pack Together By Label sits between the two.`,
    plot: { x: 'N', logY: true }
  });

  /* ---------- reference counts ---------- */
  const STEPS = [
    ['start', [0, 0], 'Nothing loaded.'],
    ['Load Sword', [1, 0], '<code>LoadAssetAsync("Sword")</code>: the Weapons bundle is loaded (bundle count 1), then the Sword. Sword count 1.'],
    ['Load Shield', [1, 1], 'Shield comes from the same bundle: no new bundle, Shield count 1, bundle count 2.'],
    ['Load Sword again', [2, 1], 'A second load of the same key does not load twice: Sword count 2. Every load needs its own Release.'],
    ['Release Sword ×2', [0, 1], 'Sword count 0, but its memory is not freed: assets leave memory only when their whole bundle unloads. The bundle is still in use by Shield.'],
    ['Release Shield', [0, 0], 'Bundle count 0: Unity unloads the bundle and everything loaded from it, Sword included.']
  ];
  const mem = v => { const [a, b] = STEPS[v.t][1], bundle = a + b > 0; return (bundle ? 1 : 0) + (bundle && v.t >= 1 ? 30 : 0) + (bundle && v.t >= 2 ? 20 : 0); };
  A.fx('refcount', {
    title: 'Reference counts: assets, bundles and memory',
    expr: '{t}:  a bundle stays while any asset from it is held',
    vars: { t: { sym: 'step', name: 'step', values: STEPS.map((_, i) => i), labels: STEPS.map(x => x[0]), index: 4 } },
    out: { sym: 'MB in memory', f: v => mem(v), color: 'accent' },
    sub: v => STEPS[v.t][2],
    draw(ctx, W, H, v, X) {
      const [a, b] = STEPS[v.t][1], bundle = a + b > 0, sword = bundle && v.t >= 1, shield = bundle && v.t >= 2;
      ctx.fillStyle = alpha(col(bundle ? 'ray' : 'line'), bundle ? 0.08 : 0.02); ctx.fillRect(20, 30, 380, 150); ctx.strokeStyle = col(bundle ? 'ray' : 'line'); ctx.lineWidth = 1.5; ctx.strokeRect(20, 30, 380, 150);
      X.label(ctx, 'Weapons bundle', 32, 48, col('ink'), 'left', true); X.label(ctx, bundle ? `loaded · count ${a + b}` : 'not loaded', 32, 66, col('muted'));
      box(ctx, 40, 100, 160, 60, 'Sword  30 MB', `count ${a}${sword && a === 0 ? ' · still in memory' : ''}`, sword ? (a ? 'good' : 'accent') : 'line', X, sword ? 0.2 : 0.03);
      box(ctx, 220, 100, 160, 60, 'Shield  20 MB', `count ${b}`, shield ? (b ? 'good' : 'accent') : 'line', X, shield ? 0.2 : 0.03);
      const mb = (bundle ? 1 : 0) + (sword ? 30 : 0) + (shield ? 20 : 0);
      X.label(ctx, 'memory', 470, 40, col('muted')); ctx.fillStyle = alpha(col('accent'), 0.8); ctx.fillRect(470, 54, mb * 7, 24); X.label(ctx, mb + ' MB', 476 + mb * 7, 66, col('ink'), 'left', true);
      X.label(ctx, 'green: held · orange: released but still loaded', 470, 110, col('muted'));
      X.label(ctx, 'Resources.UnloadUnusedAssets() frees released assets', 470, 134, col('muted'));
      X.label(ctx, 'early, at the cost of a hitch (use it on loading screens)', 470, 152, col('muted'));
    },
    plot: false, size: [880, 200]
  });

  /* ---------- duplicated dependencies ---------- */
  A.fx('dupes', {
    title: 'One shared texture, pulled into several bundles',
    expr: 'disk waste = ({k} − 1) · {S},   memory waste = ({m} − 1) · {S};   fixed: {f}',
    vars: { S: { sym: 'S', name: 'shared dependency (a texture atlas)', unit: 'MB', min: 1, max: 100, value: 21, log: true }, k: { sym: 'k', name: 'groups whose assets use it', min: 1, max: 12, value: 4, step: 1 },
            m: { sym: 'm', name: 'of those groups loaded at once', min: 1, max: 12, value: 2, step: 1 }, f: { sym: 'shared group', name: 'atlas made addressable in its own group', values: [0, 1], labels: ['no', 'yes'], index: 0 } },
    out: [{ sym: 'disk waste', unit: 'MB', f: v => v.f ? 0 : (v.k - 1) * v.S, color: 'bad' }, { sym: 'memory waste', unit: 'MB', f: v => v.f ? 0 : (Math.min(v.m, v.k) - 1) * v.S, color: 'accent' }],
    sub: v => v.f ? `the atlas is addressable in its own group: one copy on disk and in memory, loaded as a dependency of whichever bundle needs it. One extra bundle.` : `the atlas is not addressable itself, so each of the ${v.k} bundles that needs it gets its <b>own copy</b>: ${num((v.k - 1) * v.S)} MB extra on disk, and with ${Math.min(v.m, v.k)} of them loaded, ${Math.min(v.m, v.k)} separate copies in memory (${num((Math.min(v.m, v.k) - 1) * v.S)} MB wasted). Copies are separate objects: a ScriptableObject duplicated this way has separate state in each bundle.`,
    draw(ctx, W, H, v, X) {
      const n = v.k, bw = Math.min(150, (W - 40) / n - 10);
      for (let i = 0; i < n; i++) { const x = 20 + i * (bw + 10), loaded = i < v.m; box(ctx, x, 14, bw, 90, 'Group ' + (i + 1), loaded ? 'loaded' : 'on disk', loaded ? 'ray' : 'line', X, loaded ? 0.15 : 0.04);
        if (!v.f) { ctx.fillStyle = loaded ? col('bad') : alpha(col('bad'), 0.35); ctx.fillRect(x + 8, 78, bw - 16, 18); X.label(ctx, 'atlas copy', x + bw / 2, 87, col('ink'), 'center'); } }
      if (v.f) { box(ctx, W / 2 - 100, 122, 200, 50, 'Shared group: atlas', 'one copy', 'good', X, 0.2); for (let i = 0; i < n; i++) { const x = 20 + i * (bw + 10) + bw / 2; X.arrow(ctx, x, 106, W / 2, 118, alpha(col('muted'), 0.7), 1, 5); } }
    },
    plot: false, size: [880, 190]
  });

  /* ---------- why things break ---------- */
  const SYM = [
    ['InvalidKeyException', 'The key is not in the loaded catalog: a typo, a renamed address, the asset was removed from its group, or Addressables content was never built for this player.', 'Use AssetReference fields instead of strings; set Addressables to build with every player build; check the Groups window for the address.'],
    ['works in the editor, fails in a build', 'The editor\'s Play Mode Script "Use Asset Database" reads assets directly and hides every build problem.', 'Test with "Use Existing Build" before shipping, and build content for the same platform as the player.'],
    ['pink materials from bundles', 'Shaders or shader variants the bundled materials need are missing for this platform: bundles built for another target, or variants stripped because nothing in the player build used them.', 'Rebuild content for the target platform; keep shaders in a shared group; check shader stripping settings.'],
    ['two copies of a manager or settings asset', 'A ScriptableObject is referenced directly by a scene in the build and also pulled into a bundle: two separate objects with separate state.', 'Make it addressable and load it through Addressables everywhere, or keep it out of bundles entirely; run Analyze.'],
    ['memory never goes down', 'Handles are never released, or one held asset keeps its whole bundle (and everything loaded from it) alive.', 'Release every handle you load; split groups so unrelated assets do not share bundles; call Resources.UnloadUnusedAssets on loading screens.'],
    ['old content after an update', 'The player still uses the catalog it shipped with, or the update was built as a new build instead of an update of the previous one.', 'Use "Update a Previous Build" with the saved content state; call CheckForCatalogUpdates and UpdateCatalogs at startup.']
  ];
  A.fx('addrlab', {
    title: 'Lab: symptom, cause, fix',
    expr: 'symptom: {s}',
    vars: { s: { sym: 'symptom', name: 'what you see', values: SYM.map((_, i) => i), labels: ['InvalidKeyException', 'editor OK, build fails', 'pink materials', 'duplicate manager', 'memory keeps growing', 'old content'], index: 0 } },
    out: { sym: 'n', f: v => v.s, color: 'accent' },
    sub: v => `<b>${SYM[v.s][0]}</b>`,
    draw(ctx, W, H, v, X) {
      const wrap = (text, x, y, w, c) => { ctx.font = '13px "Source Sans 3 Variable","Source Sans 3",sans-serif'; ctx.fillStyle = c; ctx.textAlign = 'left'; let line = '', yy = y; text.split(' ').forEach(word => { const t = line ? line + ' ' + word : word; if (ctx.measureText(t).width > w) { ctx.fillText(line, x, yy); line = word; yy += 18; } else line = t; }); ctx.fillText(line, x, yy); return yy; };
      X.label(ctx, 'cause', 20, 18, col('bad'), 'left', true); wrap(SYM[v.s][1], 20, 40, W / 2 - 40, col('ink'));
      X.label(ctx, 'fix', W / 2 + 10, 18, col('good'), 'left', true); wrap(SYM[v.s][2], W / 2 + 10, 40, W / 2 - 30, col('ink'));
    },
    plot: false, size: [880, 150]
  });
})();
