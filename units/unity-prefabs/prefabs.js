/* FBX, Prefabs, Variants and Nested Prefabs — live formulas and labs */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  function box(ctx, x, y, w, h, title, sub, c, X, fill) {
    ctx.fillStyle = alpha(col(c), fill == null ? 0.14 : fill); ctx.fillRect(x, y, w, h); ctx.strokeStyle = col(c); ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
    X.label(ctx, title, x + w / 2, y + (sub ? h / 2 - 8 : h / 2), col('ink'), 'center', true); if (sub) X.label(ctx, sub, x + w / 2, y + h / 2 + 9, col('muted'), 'center');
  }

  /* ---------- FBX units ---------- */
  const UNIT = [['centimetres', 0.01], ['metres', 1], ['millimetres', 0.001], ['inches', 0.0254]];
  const metres = v => v.L * (v.c ? UNIT[v.u][1] : 1) * v.f;
  A.fx('units', {
    title: 'Imported model size',
    expr: 'size in Unity = {L} · ({c} ? unit({u}) : 1) · {f}',
    vars: { L: { sym: 'L', name: 'object height in file units', min: 0.5, max: 300, value: 180, log: true }, u: { sym: 'unit', name: 'unit stored in the FBX', values: [0, 1, 2, 3], labels: UNIT.map(u => u[0]), index: 0 },
            c: { sym: 'convert', name: 'Convert Units', values: [1, 0], labels: ['on', 'off'], index: 0 }, f: { sym: 'scale', name: 'Scale Factor', min: 0.01, max: 100, value: 1, log: true } },
    out: { sym: 'height', unit: 'm', f: metres, color: 'accent' },
    sub: v => { const m = metres(v); return `a ${num(v.L)}-unit object in ${UNIT[v.u][0]} arrives <b>${num(m)} m</b> tall` + (m > 20 ? ': a giant. Physics, lighting and LODs all assume 1 unit = 1 metre.' : m < 0.2 ? ': tiny. Shadows, physics and LOD distances will all look wrong.' : ' · next to a 1.8 m person'); },
    draw(ctx, W, H, v, X) {
      const m = metres(v), base = H - 30, px = (H - 70) / Math.max(1.8, Math.min(m, 400)) ;
      ctx.strokeStyle = col('line'); ctx.beginPath(); ctx.moveTo(10, base); ctx.lineTo(W - 10, base); ctx.stroke();
      const ph = 1.8 * px; ctx.fillStyle = col('ray'); ctx.beginPath(); ctx.arc(80, base - ph + ph * 0.07, ph * 0.07, 0, 7); ctx.fill(); ctx.fillRect(80 - ph * 0.08, base - ph * 0.86, ph * 0.16, ph * 0.86);
      X.label(ctx, '1.8 m', 80, base + 14, col('muted'), 'center');
      const oh = Math.min(m, 400) * px, ow = Math.max(4, oh * 0.6); ctx.fillStyle = alpha(col('accent'), 0.5); ctx.fillRect(200, base - oh, ow, oh); ctx.strokeStyle = col('accent'); ctx.strokeRect(200, base - oh, ow, oh);
      X.label(ctx, `model: ${num(m)} m`, 200, base + 14, col('accent'));
    },
    plot: { x: 'f', logY: true, y: [0.001, 10000] }, size: [440, 280]
  });

  /* ---------- which override wins ---------- */
  const LAY = ['Door.prefab (base)', 'Door_Red (variant)', 'House.prefab (nests Door_Red)', 'House instance in the scene'];
  A.fx('override', {
    title: 'Override priority',
    expr: 'winner = scene {s} ▸ house {h} ▸ variant {r} ▸ base',
    vars: { r: { sym: 'variant', name: 'Door_Red overrides the colour', values: [0, 1], labels: ['no', 'yes'], index: 1 }, h: { sym: 'house', name: 'House overrides it on its nested door', values: [0, 1], labels: ['no', 'yes'], index: 0 },
            s: { sym: 'scene', name: 'the scene instance overrides it', values: [0, 1], labels: ['no', 'yes'], index: 0 } },
    out: { sym: 'winning layer', f: v => v.s ? 3 : v.h ? 2 : v.r ? 1 : 0, color: 'accent' },
    sub: v => { const w = v.s ? 3 : v.h ? 2 : v.r ? 1 : 0, c = ['grey', 'red', 'green', 'blue'][w]; return `the door in the scene is <b>${c}</b>, set by ${LAY[w]}. A change to the base colour now reaches it only if no layer above overrides it` + (w > 0 ? ' — here it does not.' : ' — here it does.'); },
    draw(ctx, W, H, v, X) {
      const on = [1, v.r, v.h, v.s], val = ['grey', 'red', 'green', 'blue'], hex = ['#8a8f96', '#d2402f', '#3fa34d', '#3b7fd9'], w = v.s ? 3 : v.h ? 2 : v.r ? 1 : 0;
      for (let i = 0; i < 4; i++) { const y = H - 40 - i * 44, act = on[i]; box(ctx, 20, y, 520, 36, LAY[i], act ? (i ? 'override: ' : 'value: ') + val[i] : 'no override, passes the value up', i === w ? 'accent' : act ? 'ray' : 'line', X, i === w ? 0.25 : 0.08);
        if (act) { ctx.fillStyle = hex[i]; ctx.fillRect(500, y + 8, 28, 20); } }
      X.arrow(ctx, 560, H - 22, 560, 26, col('muted'), 1.5, 8); X.label(ctx, 'outer layers win', 570, H / 2, col('muted'));
      ctx.fillStyle = hex[w]; ctx.fillRect(720, 60, 90, 120); ctx.strokeStyle = col('ink'); ctx.strokeRect(720, 60, 90, 120); X.dot(ctx, 795, 125, col('ink'), 4); X.label(ctx, 'the door you see', 765, 196, col('muted'), 'center');
    },
    plot: false, size: [880, 220]
  });

  /* ---------- where a change propagates ---------- */
  const EDITS = ['Door.prefab (base)', 'Door_Red (variant)', 'House_A.prefab', 'one House_A in the scene'];
  A.fx('propagate', {
    title: 'Edit reach per level',
    expr: 'reach({e}) = copies below it without an override',
    vars: { e: { sym: 'edit', name: 'where you change the door\'s hinge', values: [0, 1, 2, 3], labels: EDITS, index: 0 } },
    out: { sym: 'doors changed', f: v => [8, 5, 3, 1][v.e], color: 'accent' },
    sub: v => [`the base: all <b>8</b> doors in the scene change, plain and red, nested or not. Right for fixes every door needs.`,
      `the variant: the <b>5</b> red doors change (3 inside House_A, 2 on their own); plain doors do not.`,
      `House_A: an override on its nested door. The <b>3</b> doors inside House_A instances change; other red doors do not.`,
      `one scene instance: <b>1</b> door. Fine for a one-off, but it is invisible in the prefab and easy to lose.`][v.e],
    draw(ctx, W, H, v, X) {
      const hit = (lvl) => lvl >= v.e;
      const N = { base: [330, 14], red: [200, 64], house: [120, 114] }, bw = 150, bh = 30;
      box(ctx, N.base[0], N.base[1], bw, bh, 'Door (base)', '', v.e === 0 ? 'accent' : 'line', X);
      box(ctx, N.red[0], N.red[1], bw, bh, 'Door_Red (variant)', '', v.e === 1 ? 'accent' : 'line', X);
      box(ctx, N.house[0], N.house[1], bw, bh, 'House_A (nests Door_Red)', '', v.e === 2 ? 'accent' : 'line', X);
      X.arrow(ctx, N.base[0] + 40, N.base[1] + bh, N.red[0] + bw / 2, N.red[1], col('muted'), 1.2, 6); X.arrow(ctx, N.red[0] + 30, N.red[1] + bh, N.house[0] + bw / 2, N.house[1], col('muted'), 1.2, 6);
      const doors = [['house', 0], ['house', 1], ['house', 2], ['red', 3], ['red', 4], ['base', 5], ['base', 6], ['base', 7]], y = H - 62;
      doors.forEach(([k, i]) => { const x = 30 + i * 102, lvl = k === 'house' ? 2 : k === 'red' ? 1 : 0;
        const changed = v.e === 3 ? i === 0 : lvl >= v.e; ctx.fillStyle = changed ? col('accent') : alpha(col('muted'), 0.3); ctx.fillRect(x, y, 34, 36);
        ctx.fillStyle = k === 'base' ? '#8a8f96' : '#d2402f'; ctx.fillRect(x + 40, y + 8, 6, 20);
        X.label(ctx, k === 'house' ? 'in House_A' : k === 'red' ? 'red door' : 'plain door', x + 17, y + 46, col('muted'), 'center'); });
      X.label(ctx, 'scene instances (orange: changed)', 30, y - 12, col('muted'));
    },
    plot: false, size: [880, 260]
  });

  /* ---------- re-exporting a model ---------- */
  const DCC = [
    ['change vertex positions', 'ok', 'Same object names, same fileIDs. The mesh updates everywhere; every override and added component stays.'],
    ['add a new child object', 'ok', 'A new fileID appears. Existing references and overrides are untouched; prefabs simply gain the new child.'],
    ['reorder children', 'ok', 'fileIDs follow names, not order: nothing breaks, the hierarchy order updates.'],
    ['rename a child', 'bad', 'The child gets a new fileID. Overrides and added components that targeted the old one have nothing to attach to; Unity lists them as unused overrides. Colliders or scripts you added to that child are gone from the hierarchy.'],
    ['delete a child', 'bad', 'Like a rename without a replacement: everything that targeted it is orphaned, and objects you parented under it lose their parent.'],
    ['rename a material', 'warn', 'With materials extracted or remapped by name, the remap no longer matches: the slot falls back to the embedded or default material until you remap it.'],
    ['two children with the same name', 'warn', 'The names no longer identify the objects uniquely. References can swap or break on the next reimport; give every child a unique name.']
  ];
  A.fx('reimport', {
    title: 'Reimport behaviour per change',
    expr: 'change in the DCC tool: {d}',
    vars: { d: { sym: 'change', name: 'what changed in Robot.fbx', values: DCC.map((_, i) => i), labels: DCC.map(x => x[0]), index: 3 } },
    out: { sym: 'safe', f: v => DCC[v.d][1] === 'ok' ? 1 : 0, color: 'accent' },
    sub: v => DCC[v.d][2],
    draw(ctx, W, H, v, X) {
      const k = DCC[v.d][1], c = k === 'ok' ? 'good' : k === 'bad' ? 'bad' : 'accent';
      const before = ['Robot', '├ Body', '├ Arm_L', '└ Arm_R   + BoxCollider (added in variant)'];
      const after = [['Robot', '├ Body', '├ Arm_L', '└ Arm_R   + BoxCollider'], ['Robot', '├ Body', '├ Arm_L', '├ Arm_R   + BoxCollider', '└ Antenna (new)'], ['Robot', '├ Arm_R   + BoxCollider', '├ Body', '└ Arm_L'],
        ['Robot', '├ Body', '├ Arm_L', '└ Arm_Right   (new fileID)', '!  BoxCollider: unused override'], ['Robot', '├ Body', '└ Arm_L', '!  BoxCollider: unused override'], ['Robot', '├ Body  (material: default)', '├ Arm_L', '└ Arm_R   + BoxCollider'], ['Robot', '├ Arm', '├ Arm   (which is which?)', '└ Arm_R   + BoxCollider']][v.d];
      const list = (x, lines, title, cc) => { X.label(ctx, title, x, 16, col(cc), 'left', true); ctx.font = '12px "JetBrains Mono Variable","JetBrains Mono",monospace'; ctx.textAlign = 'left';
        lines.forEach((l, i) => { ctx.fillStyle = l.startsWith('!') ? col('bad') : col('ink'); ctx.fillText(l.replace(/^!/, ''), x, 40 + i * 18); }); };
      list(20, before, 'Robot_Variant before', 'muted'); list(460, after, 'after reimport', c);
      X.arrow(ctx, 400, 70, 440, 70, col('muted'), 1.5, 7);
    },
    plot: false, size: [880, 150]
  });
})();
