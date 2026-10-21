/* Parameters, Publishing and Export — live formulas */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const sat = x => clamp(x, 0, 1);

  /* ---------- one exposed input drives several nodes ---------- */
  const DR = [
    ['edge wear: Histogram Scan position', v => 0.9 - 0.5 * v.w, 'lerp(0.9, 0.4, wear)'],
    ['dirt: Blend opacity', v => v.w * v.w, 'wear²'],
    ['roughness: Levels offset', v => 0.25 * v.w, '0.25 · wear'],
    ['rust: Switch on', v => v.w > v.t ? 1 : 0, 'wear > threshold']
  ];
  A.fx('drive', {
    title: 'One exposed input, four parameter functions',
    expr: 'edge = lerp(0.9, 0.4, {w}),  dirt = {w}²,  rough = 0.25 · {w},  rust = {w} > {t}',
    vars: { w: { sym: 'wear', name: 'the exposed input', min: 0, max: 1, value: 0.4, step: 0.01 }, t: { sym: 'threshold', name: 'when rust appears', min: 0, max: 1, value: 0.6, step: 0.01 } },
    out: DR.map((d, i) => ({ sym: ['edge', 'dirt', 'rough', 'rust'][i], f: d[1], color: ['accent', 'ray', 'good', 'bad'][i] })),
    sub: v => DR.map(d => `${d[0]} = ${d[2]} = <b>${num(d[1](v))}</b>`).join(' · '),
    plot: { x: 'w', y: [0, 1.05] }
  });

  /* ---------- export file names ---------- */
  const PAT = ['$(graph)_$(identifier)', '$(graph)/$(identifier)', 'T_$(graph)_$(identifier)'];
  const OUTS = [['basecolor', 'BC', 'B'], ['normal', 'N', 'N'], ['roughness', 'R', 'R'], ['height', 'H', 'H'], ['MaskMap', 'MS', 'ORM']];
  A.fx('pattern', {
    title: 'The export pattern decides every file name',
    expr: 'file = {p} with {i},  format {f}',
    vars: { p: { sym: 'pattern', name: 'pattern', values: [0, 1, 2], labels: ['G_ID', 'G/ID', 'T_G_ID'], index: 2 }, i: { sym: 'ids', name: 'output identifiers', values: [0, 1, 2], labels: ['Designer defaults', 'short suffixes (Unity)', 'Unreal style'], index: 1 },
            f: { sym: 'format', name: 'file format', values: [0, 1, 2], labels: ['png', 'tga', 'exr'], index: 0 } },
    out: { sym: 'files', f: v => OUTS.length, color: 'accent' },
    sub: v => `pattern <code>${PAT[v.p]}</code> (G = $(graph) = <code>RustyMetal</code>, ID = $(identifier), each output\'s identifier) · one format for the whole export: ${['PNG keeps 8 or 16 bits per output', 'TGA stores 8 bits only: a 16-bit height loses its precision', 'EXR stores float: right for HDR, wasteful for masks'][v.f]}`,
    draw(ctx, W, H, v, X) {
      const ext = ['png', 'tga', 'exr'][v.f];
      OUTS.forEach((o, k) => { const id = o[v.i] === 'MS' && v.i === 2 ? 'ORM' : o[v.i]; const name = PAT[v.p].replace('$(graph)', 'RustyMetal').replace('$(identifier)', id) + '.' + ext;
        X.label(ctx, name, 20, 26 + k * 32, col('ink'), 'left', true); X.label(ctx, ['colour, sRGB', 'data, normal', 'data', 'data, 16 bit', 'data, packed'][k], W - 20, 26 + k * 32, col('muted'), 'right'); });
      X.label(ctx, v.i === 1 ? 'suffixes match the import script in Texture Packing and Import Settings' : v.i === 2 ? 'T_ prefix and _B, _N, _R, _ORM suffixes follow common Unreal naming' : 'readable, but an import script cannot tell map types apart reliably', 20, H - 14, col('muted'));
    },
    plot: false, size: [880, 210]
  });

  /* ---------- file size versus GPU memory ---------- */
  const MAPS = [['base colour', 3, 'BC7', 8], ['normal', 3, 'BC5', 8], ['mask (packed)', 4, 'BC7', 8], ['roughness', 1, 'BC4', 4], ['height', 1, 'R16', 16]];
  A.fx('filesize', {
    title: 'Bits on disk and bits on the GPU',
    expr: 'raw file = {s}² · channels · {b} bits,   GPU = {s}² · bpp(engine format) · 4/3;   map {m}',
    vars: { s: { sym: 'size', name: 'texture size', values: [1024, 2048, 4096], labels: ['1k', '2k', '4k'], index: 1 }, b: { sym: 'bits', name: 'bits per channel exported', values: [8, 16], index: 0 },
            m: { sym: 'map', name: 'map', values: [0, 1, 2, 3, 4], labels: MAPS.map(x => x[0]), index: 0 } },
    out: [{ sym: 'raw file', unit: 'MB', f: v => v.s * v.s * MAPS[v.m][1] * v.b / 8 / 1048576, color: 'ray' }, { sym: 'on the GPU', unit: 'MB', f: v => v.s * v.s * MAPS[v.m][3] / 8 * 4 / 3 / 1048576, color: 'accent' }],
    sub: v => { const M = MAPS[v.m]; return `${M[0]}: ${v.b}-bit file, about <b>${num(v.s * v.s * M[1] * v.b / 8 / 1048576)} MB</b> before PNG\'s lossless compression · the engine stores it as ${M[2]} (${M[3]} bits per texel): <b>${num(v.s * v.s * M[3] / 8 * 4 / 3 / 1048576)} MB</b> with mips` + (v.b === 16 && M[2] !== 'R16' ? ` · the extra 8 bits are discarded by ${M[2]}; they only help if another tool processes the file further` : '') + (v.b === 8 && M[2] === 'R16' ? ' · an 8-bit file cannot fill R16: the terraces are already in it' : ''); },
    plot: { x: 's' }
  });

  /* ---------- normal format: DirectX versus OpenGL ---------- */
  A.fx('normalflip', {
    title: 'A normal map read with the wrong green channel',
    expr: 'exported as {e},  read by an engine expecting {g}  →  G is {flip}',
    vars: { e: { sym: 'export', name: 'normal format on export', values: [0, 1], labels: ['DirectX (Y−)', 'OpenGL (Y+)'], index: 0 }, g: { sym: 'engine', name: 'engine', values: [0, 1], labels: ['Unreal (DirectX)', 'Unity (OpenGL)'], index: 1 },
            flip: { sym: 'G', derived: v => v.e === v.g ? 1 : -1, values: [-1, 1], labels: ['inverted', 'correct'], index: 1 }, a: { sym: 'light', name: 'light direction', unit: '°', min: 0, max: 360, value: 120, step: 1 } },
    out: { sym: 'G sign', f: v => v.e === v.g ? 1 : -1, color: 'accent' },
    sub: v => v.e === v.g ? 'formats match: bumps catch the light on the side facing it' : 'formats differ: the green channel is upside down, so bumps are lit from the wrong side vertically. Domes look like dents and dents like domes, while horizontal shading stays right, which is why the mistake is easy to miss.',
    draw(ctx, W, H, v, X) {
      const s = H - 40, n = 96, L = [Math.cos(v.a * Math.PI / 180), Math.sin(v.a * Math.PI / 180), 0.7], ll = Math.hypot(...L), l = L.map(x => x / ll);
      const draw = (ox, gs, label) => { const c = document.createElement('canvas'); c.width = n; c.height = n; const g = c.getContext('2d'), im = g.createImageData(n, n);
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = (i + 0.5) / n * 4 % 1 - 0.5, y = (j + 0.5) / n * 4 % 1 - 0.5, r = Math.hypot(x, y) / 0.38, cell = (Math.floor((i + 0.5) / n * 4) + Math.floor((j + 0.5) / n * 4)) % 2;
          let nx = 0, ny = 0; if (r < 1) { const k = (cell ? -1 : 1) * 0.9 * r / Math.sqrt(Math.max(1 - r * r * 0.8, 0.05)); nx = x / (Math.hypot(x, y) || 1) * k * 0.6; ny = -y / (Math.hypot(x, y) || 1) * k * 0.6; }
          ny *= gs; const nz = 1, nl = Math.hypot(nx, ny, nz), d = Math.max(0, (nx * l[0] + ny * l[1] + nz * l[2]) / nl), q = (j * n + i) * 4, b = 40 + 200 * d;
          im.data[q] = b; im.data[q + 1] = b * 0.97; im.data[q + 2] = b * 0.92; im.data[q + 3] = 255; }
        g.putImageData(im, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(c, ox, 24, s, s); X.label(ctx, label, ox, 12, col('muted')); };
      draw(20, 1, 'as authored: domes and dents');
      draw(40 + s, v.e === v.g ? 1 : -1, 'as the engine shows it');
      const cx = 60 + 2 * s + 60, cy = 24 + s / 2; X.arrow(ctx, cx + l[0] * 50, cy - l[1] * 50, cx + l[0] * 6, cy - l[1] * 6, col('accent'), 2.5, 9); X.dot(ctx, cx, cy, col('muted'), 3); X.label(ctx, 'light', cx - 20, cy + 60, col('accent'));
    },
    plot: false, size: [880, 280]
  });
})();
