/* GUIDs and .meta Files — live formulas and a reference lab */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  function box(ctx, x, y, w, h, title, lines, c, X) {
    ctx.fillStyle = alpha(col(c || 'line'), 0.12); ctx.fillRect(x, y, w, h); ctx.strokeStyle = col(c || 'line'); ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
    X.label(ctx, title, x + 8, y + 13, col('ink'), 'left', true);
    ctx.font = '11px "JetBrains Mono Variable","JetBrains Mono",monospace'; ctx.fillStyle = col('muted'); ctx.textAlign = 'left';
    lines.forEach((l, i) => { ctx.fillStyle = l.startsWith('!') ? col('bad') : l.startsWith('+') ? col('good') : col('muted'); ctx.fillText(l.replace(/^[!+]/, ''), x + 8, y + 32 + i * 15); });
  }

  /* ---------- what a reference stores ---------- */
  const REF = [
    ['texture in a PNG', '2800000', 'a3f1…9c', 3, 'Texture2D is class 28, so the main object of an imported texture has fileID 28 · 100 000.'],
    ['mesh inside an FBX', '-2097…8811', '6b02…e4', 3, 'Sub-objects of an imported model get fileIDs computed from their names in the file.'],
    ['material (.mat)', '2100000', '1d7c…05', 2, 'A native asset with one main object: Material is class 21.'],
    ['MonoBehaviour script', '11500000', '9e4a…7f', 3, 'Components point at their script asset: MonoScript is class 115.'],
    ['built-in default material', '10303', '0000000000000000f000000000000000', 0, 'Built-in resources use fixed GUIDs and fileIDs inside Unity itself.'],
    ['object in the same scene', '1843…27', '(none)', '', 'Within one file, only the fileID is stored: the object\'s local ID.']
  ];
  A.fx('reftriple', {
    title: 'Serialized reference',
    expr: 'ref({o}) = { fileID, guid, type }',
    vars: { o: { sym: 'target', name: 'what is referenced', values: REF.map((_, i) => i), labels: REF.map(r => r[0]), index: 0 } },
    out: { sym: 'type', f: v => +REF[v.o][3] || 0, color: 'accent' },
    sub: v => `<code>{fileID: ${REF[v.o][1]}${REF[v.o][2] !== '(none)' ? `, guid: ${REF[v.o][2]}, type: ${REF[v.o][3]}` : ''}}</code> · ${REF[v.o][4]}`,
    draw(ctx, W, H, v, X) {
      const r = REF[v.o], same = r[2] === '(none)';
      box(ctx, 14, 30, 250, 120, 'Scene.unity (the referrer)', ['m_Materials:', `- {fileID: ${r[1]},`, same ? '   (same file, no guid)}' : `   guid: ${r[2]},`, same ? '' : `   type: ${r[3]}}`], 'ray', X);
      box(ctx, 314, 30, 250, 120, same ? '(not needed)' : 'the asset\'s .meta file', same ? ['objects in the same file', 'are found by fileID only'] : ['fileFormatVersion: 2', `guid: ${r[2]}`, '…importer settings…'], same ? 'line' : 'accent', X);
      box(ctx, 614, 30, 250, 120, same ? 'the object in this scene' : 'the asset file', same ? [`--- !u!… &${r[1]}`, 'GameObject: …'] : [`${r[0]}`, `object with fileID ${r[1]}`, 'inside it'], 'good', X);
      if (!same) { X.arrow(ctx, 268, 90, 310, 90, col('ink'), 2, 8); X.label(ctx, 'guid', 289, 78, col('muted'), 'center'); X.arrow(ctx, 568, 90, 610, 90, col('ink'), 2, 8); X.label(ctx, 'fileID', 589, 78, col('muted'), 'center'); }
      X.label(ctx, 'guid finds the file through its .meta; fileID finds the object inside the file; type tells Unity where the data lives', 14, 180, col('muted'));
      X.label(ctx, 'type 2: native asset read from Assets (.mat, .asset) · type 3: imported, read from the Library (textures, models, prefabs, scripts) · 0: built-in', 14, 200, col('muted'));
    },
    plot: false, size: [880, 220]
  });

  /* ---------- fileIDs from names ---------- */
  function toyHash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  const NAMES = ['Body', 'body', 'Body_LOD0', 'Body.001'];
  A.fx('fileid', {
    title: 'FBX sub-object fileIDs',
    expr: 'fileID = hash(type, "Robot/{n}")',
    vars: { n: { sym: 'name', name: 'the child object\'s name in the next export', values: [0, 1, 2, 3], labels: NAMES, index: 0 } },
    out: { sym: 'still found', f: v => v.n === 0 ? 1 : 0, color: 'accent' },
    sub: v => (v.n === 0 ? 'same name, same fileID: every prefab, material slot and override that points at this mesh still finds it.' : `renamed to <b>${NAMES[v.n]}</b>: a new fileID. The old one no longer exists in the model, so references to it show <em>Missing (Mesh)</em>, and overrides on that object stop applying. Renames in the DCC tool, even capitalisation or an added <code>.001</code>, are reference changes.`) + ' (The hash shown is an illustration; Unity\'s own differs.)',
    draw(ctx, W, H, v, X) {
      const old = toyHash('Mesh/Robot/Body'), now = toyHash('Mesh/Robot/' + NAMES[v.n]), ok = old === now;
      box(ctx, 14, 26, 370, 96, 'Robot.prefab (uses the mesh)', ['m_Mesh: {fileID: ' + old + ',', '         guid: 6b02…e4, type: 3}'], 'ray', X);
      box(ctx, 480, 26, 386, 96, 'Robot.fbx after re-export', ['Robot', `└ ${NAMES[v.n]}   fileID ${now}`, ok ? '+found' : '!no object with fileID ' + old], ok ? 'good' : 'bad', X);
      X.arrow(ctx, 390, 74, 474, 74, ok ? col('good') : col('bad'), 2.5, 9);
      X.label(ctx, ok ? 'resolves' : 'Missing', 432, 60, ok ? col('good') : col('bad'), 'center', true);
    },
    plot: false, size: [880, 150]
  });

  /* ---------- the reference lab ---------- */
  const ACTS = [
    ['Move in Unity', 'ok', 'Unity moves the .meta with the file. GUID unchanged, every reference still resolves.'],
    ['Move with .meta, outside', 'ok', 'The pair moved together: on the next refresh Unity reads the same GUID at the new path. Safe, if you never forget the .meta.'],
    ['Move without .meta', 'bad', 'Unity sees a deleted asset and a new one. The new file gets a <b>new GUID</b>, the orphaned .meta is deleted, and every reference to the old GUID is <b>Missing</b>.'],
    ['Forget to commit .meta', 'bad', 'On a teammate\'s machine Unity generates its own .meta with a <b>different GUID</b>. Their references break, and if they commit that .meta, everyone\'s do.'],
    ['Duplicate outside Unity', 'warn', 'Two files claim the same GUID. Unity logs a GUID conflict and gives one of them a new GUID; which one keeps the original decides what existing references point to.'],
    ['Overwrite in place', 'ok', 'The .meta stays, so the GUID stays. Only objects inside may change: renamed sub-objects get new fileIDs.'],
    ['Delete Library folder', 'ok', 'Library is a cache. Unity reimports everything from Assets and the .meta files; references survive. Slow, but safe.']
  ];
  A.fx('guidlab', {
    title: 'Reference behaviour per action',
    expr: 'action: {a}',
    vars: { a: { sym: 'action', name: 'what you do with Rock.png', values: ACTS.map((_, i) => i), labels: ACTS.map(x => x[0]), index: 2 } },
    out: { sym: 'references intact', f: v => ACTS[v.a][1] === 'ok' ? 1 : 0, color: 'accent' },
    sub: v => ['Rename or move it in Unity\'s Project window', 'Move it in Explorer or Finder together with its .meta', 'Move it in Explorer or Finder without its .meta', 'Commit the PNG but forget the .meta', 'Copy the PNG and its .meta in the file system', 'Re-export it over the old file', 'Delete the Library folder'][v.a] + ': ' + ACTS[v.a][2],
    draw(ctx, W, H, v, X) {
      const k = ACTS[v.a][1], newG = k === 'bad', c = k === 'ok' ? 'good' : k === 'bad' ? 'bad' : 'accent';
      box(ctx, 14, 26, 260, 100, 'Rock.mat references', ['_BaseColorMap:', '{fileID: 2800000,', ' guid: a3f19c…, type: 3}'], 'ray', X);
      box(ctx, 314, 26, 260, 100, 'before', ['Textures/Rock.png', 'Textures/Rock.png.meta', 'guid: a3f19c…'], 'line', X);
      box(ctx, 614, 26, 252, 100, 'after', v.a === 6 ? ['Textures/Rock.png', 'Rock.png.meta  guid: a3f19c…', '+Library rebuilt'] : [v.a === 5 ? 'Textures/Rock.png (new pixels)' : v.a === 4 ? 'Rock.png + Rock copy.png' : 'Props/Rock.png', newG ? '!guid: 7c20e1…  (new)' : v.a === 4 ? '!one of them: new guid' : '+guid: a3f19c…', v.a === 2 ? '!old .meta deleted' : v.a === 3 ? '!teammate\'s own .meta' : ''], c, X);
      X.arrow(ctx, 278, 76, 310, 76, col('muted'), 1.5, 7); X.arrow(ctx, 578, 76, 610, 76, col('muted'), 1.5, 7);
      X.label(ctx, k === 'ok' ? 'Rock.mat: texture found' : k === 'bad' ? 'Rock.mat: Missing (Texture2D)' : 'Rock.mat: depends on which copy kept the GUID', 14, 150, col(c), 'left', true);
    },
    plot: false, size: [880, 170]
  });

  /* ---------- GUID collisions ---------- */
  A.fx('collision', {
    title: 'GUID collision probability',
    expr: 'p ≈ 1 − exp(−{n}² / 2<sup>129</sup>)',
    vars: { n: { sym: 'n', name: 'assets ever created', min: 10, max: 1e12, value: 1e6, log: true } },
    out: { sym: 'log₁₀ p', f: v => { const x = v.n * v.n / Math.pow(2, 129); return Math.log10(x < 1e-8 ? x : 1 - Math.exp(-x)); }, color: 'accent' },
    sub: v => { const x = v.n * v.n / Math.pow(2, 129); return `${num(v.n)} random 128-bit GUIDs: chance of any collision ≈ <b>${num(x < 1e-8 ? x : 1 - Math.exp(-x))}</b>. A broken reference is always a lost or duplicated .meta file, never bad luck.`; },
    plot: { x: 'n', y: [-40, 0] }
  });
})();
