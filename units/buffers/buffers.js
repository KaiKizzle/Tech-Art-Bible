/* Buffers and Render Targets — formulas and labs */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, num } = A;
  const bytes = x => x >= 1073741824 ? num(x / 1073741824) + ' GiB' : x >= 1048576 ? num(x / 1048576) + ' MiB' : x >= 1024 ? num(x / 1024) + ' KiB' : num(x) + ' B';
  function hatch(ctx, x, y, w, h, c) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.strokeStyle = c; ctx.lineWidth = 1; for (let k = -h; k < w; k += 6) { ctx.beginPath(); ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); ctx.stroke(); } ctx.restore(); }

  A.fx('bufsize', {
    title: 'Buffer size',
    expr: 'bytes = {N} × {s}',
    vars: { N: { name: 'element count', min: 1, max: 1000000, value: 10000, log: true }, s: { name: 'stride', unit: 'bytes', values: [4, 8, 12, 16, 28, 32, 48, 64], index: 5 } },
    out: { sym: 'bytes', f: v => Math.round(v.N) * v.s, fmt: x => bytes(x) },
    sub: v => `bytes = ${num(Math.round(v.N), 6)} × ${v.s} = <b>${num(Math.round(v.N) * v.s, 7)} B (${bytes(Math.round(v.N) * v.s)})</b>`,
    draw(ctx, W, H, v, X) {
      const n = 12, cw = (W - 40) / n, y = 90;
      for (let i = 0; i < n; i++) { ctx.fillStyle = i === 5 ? alpha(col('accent'), 0.45) : alpha(col('ray'), 0.2); ctx.fillRect(20 + i * cw, y, cw - 3, 60); ctx.strokeStyle = col('line'); ctx.strokeRect(20 + i * cw, y, cw - 3, 60); X.label(ctx, String(i), 20 + (i + 0.5) * cw, y + 30, col('ink'), 'center', true); X.label(ctx, String(i * v.s), 20 + i * cw, y + 78, col('muted'), 'left'); }
      X.label(ctx, 'element index', 20, y - 16, col('muted')); X.label(ctx, 'start byte = index × stride', 20, y + 100, col('muted'));
      X.label(ctx, `element 5 starts at byte 5 × ${v.s} = ${5 * v.s}`, 20, 40, col('accent'), 'left', true);
    },
    plot: { x: 'N' }
  });

  A.fx('mesh', {
    title: 'A grid mesh with and without an index buffer',
    expr: 'indexed = ({n}+1)²·{s} + 6{n}²·{ib},   not indexed = 6{n}²·{s}',
    vars: { n: { name: 'quads per side', min: 1, max: 200, value: 50, step: 1 }, s: { name: 'vertex stride', unit: 'bytes', values: [12, 24, 32, 48, 64], index: 2 },
            ib: { name: 'bytes per index', values: [2, 4], labels: ['2 (16-bit)', '4 (32-bit)'], index: 0 } },
    out: [{ sym: 'indexed', f: v => (v.n + 1) ** 2 * v.s + 6 * v.n * v.n * v.ib, fmt: x => bytes(x), color: 'good' },
          { sym: 'not indexed', f: v => 6 * v.n * v.n * v.s, fmt: x => bytes(x), color: 'bad' }],
    steps: v => [['vertices', num((v.n + 1) ** 2, 6)], ['triangles', num(2 * v.n * v.n, 6)], ['indices', num(6 * v.n * v.n, 6)], ['saving', num(100 - ((v.n + 1) ** 2 * v.s + 6 * v.n * v.n * v.ib) / (6 * v.n * v.n * v.s) * 100) + '%']],
    sub: v => `indexed = <b>${bytes((v.n + 1) ** 2 * v.s + 6 * v.n * v.n * v.ib)}</b> · not indexed = <b>${bytes(6 * v.n * v.n * v.s)}</b>`,
    draw(ctx, W, H, v, X) {
      const n = Math.min(v.n, 6), S = 200 / n, x0 = 30, y0 = 40;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { ctx.strokeStyle = alpha(col('ray'), 0.7); ctx.lineWidth = 1.5; ctx.strokeRect(x0 + i * S, y0 + j * S, S, S); ctx.beginPath(); ctx.moveTo(x0 + i * S, y0 + (j + 1) * S); ctx.lineTo(x0 + (i + 1) * S, y0 + j * S); ctx.stroke(); }
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) X.dot(ctx, x0 + i * S, y0 + j * S, col('accent'), 3.5);
      X.label(ctx, `shared corners (orange) are stored once`, x0, y0 + 220, col('accent'));
      X.label(ctx, n < v.n ? `(drawing shows ${n} × ${n} of ${v.n} × ${v.n})` : '', x0, y0 + 238, col('muted'));
      X.label(ctx, 'each corner is used by up to 6 triangles', 260, 80, col('muted'));
    },
    plot: { x: 'n', logY: false }
  });

  A.fx('dispatch', {
    title: 'Thread groups to launch',
    expr: 'groups = ⌈ {N} / {T} ⌉',
    vars: { N: { name: 'elements to process', min: 1, max: 5000, value: 1000, step: 1 }, T: { name: 'threads per group', values: [32, 64, 128, 256], index: 1 } },
    out: { sym: 'groups', f: v => Math.ceil(v.N / v.T), fmt: x => String(x) },
    steps: v => [['threads launched', num(Math.ceil(v.N / v.T) * v.T, 6)], ['threads that return early', String(Math.ceil(v.N / v.T) * v.T - v.N)]],
    plot: { x: 'N' }
  });

  A.fx('rt', {
    title: 'Render target memory',
    expr: 'bytes = {W} × {H} × {b} / 8',
    vars: { W: { name: 'width', unit: 'px', values: [1280, 1920, 2560, 3840], index: 1 }, H: { name: 'height', unit: 'px', values: [720, 1080, 1440, 2160], index: 1 },
            b: { name: 'bits per pixel', values: [8, 32, 64, 128], labels: ['8 (R8 mask)', '32 (RGBA8, R11G11B10, D32)', '64 (RGBA16F)', '128 (RGBA32F)'], index: 2 } },
    out: { sym: 'bytes', f: v => v.W * v.H * v.b / 8, fmt: x => bytes(x) },
    plot: { x: 'b' },
    note: 'A deferred G-buffer writes four or five of these at once, before depth, shadows and post-processing buffers.'
  });

  /* ---------- lab: cbuffer packing ---------- */
  (function cbuf() {
    const cv = document.getElementById('cb-cv'); if (!cv) return;
    const SIZE = { float: 4, float2: 8, float3: 12, float4: 16 };
    let vars = ['float3', 'float', 'float2', 'float3'];
    const names = ['_Tint', '_Gloss', '_Tiling', '_WindDir', '_Speed', '_Offset', '_Fade', '_Scale', '_Mask', '_Pivot', '_Bias', '_Extra'];
    function layout() {
      let off = 0; const out = [];
      vars.forEach((t, i) => { const s = SIZE[t]; if (Math.floor(off / 16) !== Math.floor((off + s - 1) / 16)) off = Math.ceil(off / 16) * 16; out.push({ t, name: names[i % names.length], off, s }); off += s; });
      return { items: out, size: Math.ceil(off / 16) * 16, used: vars.reduce((a, t) => a + SIZE[t], 0) };
    }
    const f = A.fig(cv, (ctx, W, H) => {
      const L = layout(), rows = Math.max(1, L.size / 16), cw = (W - 160) / 16, rh = Math.min(40, (H - 40) / Math.max(rows, 4)), x0 = 140, y0 = 24;
      for (let r = 0; r < Math.max(rows, 4); r++) { A.text(ctx, `row ${r} (bytes ${r * 16}–${r * 16 + 15})`, x0 - 8, y0 + r * rh + rh / 2, col('muted'), 'right'); for (let b = 0; b < 16; b += 4) { ctx.strokeStyle = col('line'); ctx.strokeRect(x0 + b * cw, y0 + r * rh, 4 * cw, rh - 3); if (r < rows) hatch(ctx, x0 + b * cw, y0 + r * rh, 4 * cw, rh - 3, alpha(col('bad'), 0.35)); } }
      L.items.forEach((it, i) => { const r = Math.floor(it.off / 16), b = it.off % 16; ctx.fillStyle = `hsl(${(i * 67 + 190) % 360} 55% 50%)`; ctx.fillRect(x0 + b * cw + 1, y0 + r * rh + 1, it.s * cw - 2, rh - 5); A.text(ctx, `${it.t} ${it.name}`, x0 + b * cw + 6, y0 + r * rh + rh / 2 - 1, '#fff', 'left', true); });
      for (let b = 0; b <= 16; b += 4) A.text(ctx, String(b), x0 + b * cw, 12, col('muted'), 'center');
    });
    function up() {
      f.draw(); const L = layout();
      document.getElementById('cb-ro').innerHTML = `<tr><td>Bytes of data</td><td>${L.used}</td></tr><tr><td>Bytes with padding</td><td>${L.size}</td></tr><tr class="win"><td>Wasted</td><td>${L.size - L.used} B (${L.size ? Math.round((L.size - L.used) / L.size * 100) : 0}%)</td></tr>` + L.items.map(it => `<tr><td>${it.t} ${it.name}</td><td>offset ${it.off}</td></tr>`).join('');
      document.getElementById('cb-code').textContent = 'cbuffer Example\n{\n' + L.items.map(it => `    ${(it.t + ' ' + it.name + ';').padEnd(18)}// offset ${it.off}`).join('\n') + '\n};';
    }
    document.getElementById('cb-add').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (!b || vars.length >= 10) return; vars.push(b.dataset.t); up(); });
    document.getElementById('cb-undo').addEventListener('click', () => { vars.pop(); up(); });
    document.getElementById('cb-good').addEventListener('click', () => { vars = ['float4', 'float3', 'float', 'float2', 'float', 'float']; up(); });
    document.getElementById('cb-bad').addEventListener('click', () => { vars = ['float', 'float4', 'float2', 'float3', 'float', 'float3']; up(); });
    up();
  })();

  /* ---------- lab: append buffer ---------- */
  (function append() {
    const cv = document.getElementById('ap-cv'); if (!cv) return;
    const N = 16; let vals = Array.from({ length: N }, () => Math.round(Math.random() * 100) / 100), order = [...Array(N).keys()], step = 0, timer = 0, counter = 0, slots = [];
    const th = A.range('ap-th', x => x.toFixed(2), () => { reset(true); });
    function reset(keepVals) {
      clearTimeout(timer);
      if (!keepVals || !vals.length) vals = Array.from({ length: N }, () => Math.round(Math.random() * 100) / 100);
      order = [...Array(N).keys()]; for (let i = N - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      step = 0; counter = 0; slots = []; f.draw(); table();
    }
    const f = A.fig(cv, (ctx, W, H) => {
      const cw = (W - 40) / N;
      A.text(ctx, 'threads (value tested against the threshold)', 20, 16, col('muted'));
      for (let i = 0; i < N; i++) {
        const done = order.slice(0, step).includes(i), pass = vals[i] >= th.v;
        ctx.fillStyle = done ? (pass ? alpha(col('good'), 0.35) : alpha(col('muted'), 0.2)) : col('surface-2');
        ctx.fillRect(20 + i * cw, 30, cw - 4, 56); A.text(ctx, '#' + i, 20 + (i + 0.5) * cw, 46, col('ink'), 'center', true); A.text(ctx, vals[i].toFixed(2), 20 + (i + 0.5) * cw, 70, pass ? col('good') : col('muted'), 'center');
      }
      A.text(ctx, `hidden counter = ${counter}`, 20, 120, col('accent'), 'left', true);
      A.text(ctx, 'append buffer (slot: thread that wrote it)', 20, 160, col('muted'));
      for (let s = 0; s < N; s++) { ctx.strokeStyle = col('line'); ctx.strokeRect(20 + s * cw, 174, cw - 4, 56); A.text(ctx, String(s), 20 + (s + 0.5) * cw, 244, col('muted'), 'center'); if (slots[s] != null) { ctx.fillStyle = alpha(col('accent'), 0.35); ctx.fillRect(20 + s * cw, 174, cw - 4, 56); A.text(ctx, '#' + slots[s], 20 + (s + 0.5) * cw, 202, col('ink'), 'center', true); } }
      if (step > 0 && step <= N) { const i = order[step - 1]; ctx.strokeStyle = col('ink'); ctx.lineWidth = 2.5; ctx.strokeRect(20 + i * cw + 1, 31, cw - 6, 54); ctx.lineWidth = 1; }
    });
    function table() {
      const pass = vals.filter(x => x >= th.v).length;
      document.getElementById('ap-ro').innerHTML = `<tr><td>Threads run</td><td>${step} of ${N}</td></tr><tr class="win"><td>Counter</td><td>${counter}</td></tr><tr><td>Threads that will append</td><td>${pass}</td></tr><tr><td>Order in the buffer</td><td>${slots.length ? slots.map(s => '#' + s).join(' ') : '—'}</td></tr>`;
    }
    function tick() {
      if (step >= N) return;
      const i = order[step]; step++;
      if (vals[i] >= th.v) { slots[counter] = i; counter++; }
      f.draw(); table();
      if (step < N) timer = setTimeout(tick, A.reduceMotion ? 0 : 220);
    }
    document.getElementById('ap-run').addEventListener('click', () => { reset(false); tick(); });
    reset(false);
  })();
})();
