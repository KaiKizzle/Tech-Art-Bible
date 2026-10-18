/* Texels on a Budget — labs. */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, fmt } = A;
  const srgbDecode = x => x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  const srgbEncode = x => x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  function off(W, H) { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; }
  function putRGB(W, H, fn) { // fn(i,j) -> [r,g,b] 0..255
    const c = off(W, H), x = c.getContext('2d'), id = x.createImageData(W, H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const p = fn(i, j), k = (j * W + i) * 4; id.data[k] = p[0]; id.data[k + 1] = p[1]; id.data[k + 2] = p[2]; id.data[k + 3] = 255; }
    x.putImageData(id, 0, 0); return c;
  }
  function blitPx(ctx, src, x, y, w, h) { ctx.imageSmoothingEnabled = false; ctx.drawImage(src, x, y, w, h); }
  const MiB = 1024 * 1024;
  const mb = b => b >= 1024 * MiB ? (b / 1024 / MiB).toFixed(2) + ' GiB' : b >= MiB ? (b / MiB).toFixed(b >= 100 * MiB ? 0 : 1) + ' MiB' : (b / 1024).toFixed(0) + ' KiB';

  /* ---------- BC1 encoder (shared by two labs) ---------- */
  const q565 = c => [Math.round(c[0] * 31 / 255), Math.round(c[1] * 63 / 255), Math.round(c[2] * 31 / 255)];
  const dq565 = q => [(q[0] << 3) | (q[0] >> 2), (q[1] << 2) | (q[1] >> 4), (q[2] << 3) | (q[2] >> 2)];
  const pack565 = q => (q[0] << 11) | (q[1] << 5) | q[2];
  function bc1Block(px, mode) { // px: 16 × [r,g,b]
    let e0, e1;
    if (mode === 'box') {
      e0 = [255, 255, 255]; e1 = [0, 0, 0];
      px.forEach(p => { for (let c = 0; c < 3; c++) { e0[c] = Math.min(e0[c], p[c]); e1[c] = Math.max(e1[c], p[c]); } });
    } else {
      const m = [0, 0, 0]; px.forEach(p => { m[0] += p[0] / 16; m[1] += p[1] / 16; m[2] += p[2] / 16; });
      const cv = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      px.forEach(p => { const d = [p[0] - m[0], p[1] - m[1], p[2] - m[2]]; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) cv[a][b] += d[a] * d[b]; });
      let v = [1, 1, 1];
      for (let it = 0; it < 12; it++) { const n = [0, 1, 2].map(a => cv[a][0] * v[0] + cv[a][1] * v[1] + cv[a][2] * v[2]); const l = Math.hypot(...n); if (l < 1e-9) break; v = n.map(x => x / l); }
      let lo = Infinity, hi = -Infinity;
      px.forEach(p => { const t = (p[0] - m[0]) * v[0] + (p[1] - m[1]) * v[1] + (p[2] - m[2]) * v[2]; lo = Math.min(lo, t); hi = Math.max(hi, t); });
      e0 = m.map((x, c) => clamp(x + v[c] * lo, 0, 255)); e1 = m.map((x, c) => clamp(x + v[c] * hi, 0, 255));
    }
    let a = q565(e0), b = q565(e1);
    if (pack565(a) < pack565(b)) [a, b] = [b, a];
    const c0 = dq565(a), c1 = dq565(b);
    const pal = pack565(a) === pack565(b) ? [c0, c0, c0, c0] : [c0, c1, c0.map((x, i) => Math.round((2 * x + c1[i]) / 3)), c0.map((x, i) => Math.round((x + 2 * c1[i]) / 3))];
    const idx = px.map(p => { let best = 0, bd = Infinity; pal.forEach((q, k) => { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (d < bd) { bd = d; best = k; } }); return best; });
    return { q0: a, q1: b, pal, idx, out: idx.map(k => pal[k]) };
  }
  function bc1Image(img, W, H, mode) { // img: array of [r,g,b]
    const out = new Array(W * H), blocks = [];
    for (let by = 0; by < H / 4; by++) for (let bx = 0; bx < W / 4; bx++) {
      const px = []; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) px.push(img[(by * 4 + j) * W + bx * 4 + i]);
      const r = bc1Block(px, mode); blocks.push(r);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) out[(by * 4 + j) * W + bx * 4 + i] = r.out[j * 4 + i];
    }
    return { out, blocks };
  }
  const rmse = (a, b) => { let s = 0; for (let k = 0; k < a.length; k++) for (let c = 0; c < 3; c++) s += (a[k][c] - b[k][c]) ** 2; return Math.sqrt(s / (a.length * 3)); };

  /* ---------- memory calculator ---------- */
  (function memory() {
    const rowsEl = document.getElementById('mem-rows'); if (!rowsEl) return;
    const F = { 'RGBA8': [1, 1, 4], 'BC1': [4, 4, 8], 'BC3': [4, 4, 16], 'BC4': [4, 4, 8], 'BC5': [4, 4, 16], 'BC6H': [4, 4, 16], 'BC7': [4, 4, 16], 'ASTC 4×4': [4, 4, 16], 'ASTC 6×6': [6, 6, 16], 'ASTC 8×8': [8, 8, 16], 'RGBA16F': [1, 1, 8] };
    const RES = [0, 256, 512, 1024, 2048, 4096, 8192];
    const ROWS = [['Base color', 'sRGB', 2048, 'BC7'], ['Normal', 'linear', 2048, 'BC5'], ['Mask / ORM', 'linear', 2048, 'BC7'], ['Height', 'linear', 1024, 'BC4'], ['Emission', 'sRGB', 0, 'BC1']];
    const colors = ['accent', 'ray', 'ax-y', 'ax-z', 'ax-x'];
    rowsEl.innerHTML = '<div class="memrow head"><span>Map</span><span>Size</span><span>Format</span><span style="text-align:right">Memory</span></div>' + ROWS.map((r, i) => `<div class="memrow"><span class="nm">${r[0]}<small>${r[1]}</small></span><select class="sel" id="mem-r${i}" aria-label="${r[0]} size">${RES.map(v => `<option value="${v}"${v === r[2] ? ' selected' : ''}>${v ? v + '²' : 'none'}</option>`).join('')}</select><select class="sel" id="mem-f${i}" aria-label="${r[0]} format">${Object.keys(F).map(f => `<option${f === r[3] ? ' selected' : ''}>${f}</option>`).join('')}</select><output id="mem-o${i}"></output></div>`).join('');
    function bytes(size, f, mips) {
      if (!size) return 0; const [bw, bh, bb] = F[f]; let t = 0, w = size;
      for (;;) { t += Math.ceil(w / bw) * Math.ceil(w / bh) * bb; if (!mips || w === 1) break; w = Math.max(1, w >> 1); }
      return t;
    }
    let parts = [];
    const bar = A.fig(document.getElementById('mem-bar'), (ctx, W, H) => {
      const tot = parts.reduce((a, b) => a + b, 0) || 1; let x = 0;
      ctx.font = '10px "JetBrains Mono", monospace'; ctx.textBaseline = 'middle';
      parts.forEach((p, i) => { const w = p / tot * W; ctx.fillStyle = col(colors[i]); ctx.fillRect(x, 6, Math.max(0, w - 2), 28); if (w > 60) { ctx.fillStyle = col('bg'); ctx.fillText(ROWS[i][0], x + 6, 20); } x += w; });
      ctx.fillStyle = col('muted'); ctx.fillText('share of this material\'s memory', 0, 50);
    });
    const n = A.range('mem-n', v => v, update);
    function update() {
      const mips = document.getElementById('mem-mips').checked;
      parts = ROWS.map((r, i) => bytes(+document.getElementById('mem-r' + i).value, document.getElementById('mem-f' + i).value, mips));
      parts.forEach((p, i) => { document.getElementById('mem-o' + i).textContent = p ? mb(p) : '—'; });
      const one = parts.reduce((a, b) => a + b, 0);
      const raw = ROWS.reduce((a, r, i) => a + bytes(+document.getElementById('mem-r' + i).value, 'RGBA8', mips), 0);
      document.getElementById('mem-cap').textContent = `One material: ${mb(one)} (uncompressed RGBA8 would be ${mb(raw)}). ${n.v} unique materials like this: ${mb(one * n.v)}${one * n.v > 4 * 1024 * MiB ? ', more than many consoles give a whole game for textures' : ''}.`;
      bar.draw();
    }
    rowsEl.addEventListener('change', update); document.getElementById('mem-mips').addEventListener('change', update);
    update();
  })();

  /* ---------- mip selection on a floor ---------- */
  (function mips() {
    const cv = document.getElementById('mip'); if (!cv) return;
    const SH = [720, 1080, 1440, 2160];
    const MIPC = ['#2f6fd6', '#2aa5b8', '#3d9a4a', '#9bbf3a', '#e0b52d', '#e57c2c', '#d6453a', '#a3418f'];
    document.getElementById('mip-key').innerHTML = MIPC.map((c, i) => `<span><i style="background:${c}"></i>mip ${i}${i === 7 ? '+' : ''}</span>`).join('');
    let aniso = 1, hover = null;
    const RW = 280, RH = 170, camH = 1.7, pitch = -16 * Math.PI / 180;
    const o = off(RW, RH), octx = o.getContext('2d'), img = octx.createImageData(RW, RH);
    const dens = A.range('mip-d', v => (2 ** v) + ' px/m', () => draw());
    const sh = A.range('mip-res', v => SH[v] + 'p', () => draw());
    const fov = A.range('mip-fov', v => v + '°', () => draw());
    A.seg('mip-aniso', v => { aniso = +v; draw(); });
    // ray for continuous screen coords (sx, sy) in real screen pixels, H = screen height
    function hit(sx, sy, H, W, tf) {
      const x = (2 * sx / W - 1) * tf * (W / H), y = (1 - 2 * sy / H) * tf;
      // camera basis: forward pitched down
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const d = [x, y * cp + sp, -y * sp + cp]; // y up, z forward
      if (d[1] >= -1e-6) return null;
      const t = camH / -d[1]; return [d[0] * t, d[2] * t, t * Math.hypot(...d)];
    }
    function lambda(sx, sy, H, W, tf, D) {
      const p = hit(sx, sy, H, W, tf), px = hit(sx + 1, sy, H, W, tf), py = hit(sx, sy + 1, H, W, tf);
      if (!p || !px || !py) return null;
      const ax = Math.hypot(px[0] - p[0], px[1] - p[1]) * D, ay = Math.hypot(py[0] - p[0], py[1] - p[1]) * D;
      const mx = Math.max(ax, ay), mn = Math.max(1e-9, Math.min(ax, ay));
      const r = mx / Math.min(aniso, mx / mn);
      return { lam: Math.max(0, Math.log2(r)), rho: mx, ratio: mx / mn, dist: p[2], x: p[0], z: p[1] };
    }
    const f = A.fig(cv, (ctx, W, H) => {
      const Hs = SH[sh.v], Ws = Hs * W / H, tf = Math.tan(fov.v * Math.PI / 360), D = 2 ** dens.v;
      const bg = col('surface-2'), bgc = [parseInt(bg.slice(1, 3), 16) || 200, parseInt(bg.slice(3, 5), 16) || 200, parseInt(bg.slice(5, 7), 16) || 200];
      const mc = MIPC.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
      for (let j = 0; j < RH; j++) for (let i = 0; i < RW; i++) {
        const sx = (i + 0.5) / RW * Ws, sy = (j + 0.5) / RH * Hs, k = (j * RW + i) * 4;
        const L = lambda(sx, sy, Hs, Ws, tf, D);
        if (!L) { img.data[k] = bgc[0]; img.data[k + 1] = bgc[1]; img.data[k + 2] = bgc[2]; img.data[k + 3] = 255; continue; }
        const lv = Math.min(7, Math.floor(L.lam)), c = mc[lv];
        const chk = ((Math.floor(L.x) + Math.floor(L.z)) & 1) ? 0.82 : 1;
        const fog = clamp(L.dist / 60, 0, 0.6);
        for (let c2 = 0; c2 < 3; c2++) img.data[k + c2] = (c[c2] * chk) * (1 - fog) + bgc[c2] * fog;
        img.data[k + 3] = 255;
      }
      octx.putImageData(img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(o, 0, 0, W, H);
      if (hover) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hover.x, hover.y, 6, 0, 7); ctx.stroke();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(hover.x, hover.y, 7.5, 0, 7); ctx.stroke();
      }
    });
    function draw() {
      f.draw();
      const Hs = SH[sh.v], tf = Math.tan(fov.v * Math.PI / 360), D = 2 ** dens.v, Ws = Hs * f.w / f.h;
      let rows = '';
      if (hover) {
        const L = lambda(hover.x / f.w * Ws, hover.y / f.h * Hs, Hs, Ws, tf, D);
        rows += L ? `<tr class="win"><td>At cursor: distance</td><td>${L.dist.toFixed(1)} m</td></tr><tr><td>Texels per pixel (long axis)</td><td>${L.rho.toFixed(2)}</td></tr><tr><td>Footprint stretch</td><td>${L.ratio.toFixed(1)} : 1</td></tr><tr class="win"><td>Mip level λ</td><td>${L.lam.toFixed(2)}</td></tr>` : '<tr><td>At cursor</td><td>sky</td></tr>';
      }
      const ppm = Hs / (2 * tf);
      for (let m = 0; m <= 4; m++) rows += `<tr><td>Facing wall reaches λ = ${m} at</td><td>${(2 ** m * ppm / D).toFixed(1)} m</td></tr>`;
      document.getElementById('mip-ro').innerHTML = rows;
    }
    A.pointer(cv, f.w, f.h, (p, k) => { hover = p; draw(); });
    cv.addEventListener('pointerleave', () => { hover = null; draw(); });
    draw();
  })();

  /* ---------- BC1 lab ---------- */
  (function bc1lab() {
    const cv = document.getElementById('bc'); if (!cv) return;
    const N = 64, src = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let c;
      const u = i / N, v = j / N;
      if (j < 24) c = [90 + 100 * v, 140 + 90 * v, 230 - 30 * v];                      // sky gradient
      else if (j < 44) c = [214 - 20 * u, 196 - 24 * u, 160 - 40 * u];               // plaster
      else c = [120 + 60 * u, 82 + 30 * u, 54];                                      // wood
      if (j >= 44 && ((i * 3 + j * 7) % 23) < 2) c = [92, 60, 40];                    // grain
      const dx = i - 18, dy = j - 22; if (dx * dx + dy * dy < 100) c = [220, 40, 40];  // red disc
      const lx = i - 25, ly = j - 15; if (lx * lx * 0.6 + ly * ly < 22 && !(dx * dx + dy * dy < 90)) c = [50, 170, 60]; // leaf
      if (i >= 40 && i < 60 && j >= 28 && j < 40) c = [[230, 30, 30], [30, 200, 40], [40, 60, 230]][i % 3]; // RGB stripes
      if (j >= 30 && j < 41 && i >= 4 && i < 34 && (j === 32 || j === 36) && ((i >> 1) % 3)) c = [40, 36, 30]; // text
      src.push(c.map(x => Math.round(clamp(x, 0, 255))));
    }
    let mode = 'pca', sel = [11, 8], R = null;
    const imgSrc = putRGB(N, N, (i, j) => src[j * N + i]);
    let imgOut = null, imgErr = null;
    const P = 192, X = [0, 204, 408], Y = 4;
    function encode() {
      R = bc1Image(src, N, N, mode);
      imgOut = putRGB(N, N, (i, j) => R.out[j * N + i]);
      imgErr = putRGB(N, N, (i, j) => { const a = src[j * N + i], b = R.out[j * N + i]; return [0, 1, 2].map(c => Math.min(255, Math.abs(a[c] - b[c]) * 6)); });
    }
    encode();
    const f = A.fig(cv, (ctx, W, H) => {
      [imgSrc, imgOut, imgErr].forEach((im, k) => blitPx(ctx, im, X[k], Y, P, P));
      ctx.font = '11px "JetBrains Mono", monospace'; ctx.fillStyle = col('muted'); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ['Source RGB888', 'BC1 (4 bpp)', 'Error × 6'].forEach((t, k) => ctx.fillText(t, X[k], Y + P + 18));
      const s = P / N * 4;
      X.forEach(x => { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x + sel[0] * s, Y + sel[1] * s, s, s); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(x + sel[0] * s - 1.5, Y + sel[1] * s - 1.5, s + 3, s + 3); });
    });
    const fb = A.fig(document.getElementById('bc-block'), (ctx, W, H) => {
      const b = R.blocks[sel[1] * (N / 4) + sel[0]], c = 26;
      ctx.font = '10px "JetBrains Mono", monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const p = src[(sel[1] * 4 + j) * N + sel[0] * 4 + i], q = b.out[j * 4 + i];
        ctx.fillStyle = `rgb(${p})`; ctx.fillRect(i * c, 14 + j * c, c - 1, c - 1);
        ctx.fillStyle = `rgb(${q})`; ctx.fillRect(118 + i * c, 14 + j * c, c - 1, c - 1);
        const k = b.idx[j * 4 + i]; ctx.fillStyle = (q[0] * 0.3 + q[1] * 0.59 + q[2] * 0.11) > 128 ? '#000' : '#fff'; ctx.fillText(k, 118 + i * c + c / 2, 14 + j * c + c / 2);
      }
      b.pal.forEach((p, k) => { ctx.fillStyle = `rgb(${p})`; ctx.fillRect(236, 14 + k * 26, 40, 22); ctx.fillStyle = col('ink'); ctx.textAlign = 'left'; ctx.fillText(k + (k < 2 ? ' end' : k === 2 ? ' ⅔·0+⅓·1' : ' ⅓·0+⅔·1'), 280, 25 + k * 26); });
      ctx.fillStyle = col('muted'); ctx.textAlign = 'left'; ctx.fillText('source', 0, 6); ctx.fillText('decoded + index', 118, 6); ctx.fillText('palette', 236, 6);
    });
    function table() {
      const b = R.blocks[sel[1] * (N / 4) + sel[0]];
      const bs = [], bo = []; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { bs.push(src[(sel[1] * 4 + j) * N + sel[0] * 4 + i]); bo.push(b.out[j * 4 + i]); }
      const e = rmse(src, R.out), be = rmse(bs, bo);
      const hx = q => '0x' + pack565(q).toString(16).padStart(4, '0');
      document.getElementById('bc-ro').innerHTML = `<tr><td>Endpoint 0 (R5 G6 B5)</td><td>${b.q0.join(' ')} · ${hx(b.q0)}</td></tr><tr><td>Endpoint 1 (R5 G6 B5)</td><td>${b.q1.join(' ')} · ${hx(b.q1)}</td></tr><tr class="win"><td>Block RMS error</td><td>${be.toFixed(1)} / 255</td></tr><tr><td>Image RMS error</td><td>${e.toFixed(2)} · PSNR ${(20 * Math.log10(255 / e)).toFixed(1)} dB</td></tr><tr><td>Size: RGBA8 → BC1</td><td>16 KiB → 2 KiB</td></tr><tr><td>Bits in this block</td><td>2×16 + 16×2 = 64</td></tr>`;
    }
    function all() { encode(); f.draw(); fb.draw(); table(); }
    A.seg('bc-mode', v => { mode = v; all(); });
    A.pointer(cv, f.w, f.h, (p, k) => {
      if (k !== 'down') return;
      const panel = X.findIndex(x => p.x >= x && p.x < x + P); if (panel < 0 || p.y < Y || p.y > Y + P) return;
      sel = [Math.floor((p.x - X[panel]) / (P / 16)), Math.floor((p.y - Y) / (P / 16))].map(v => clamp(v, 0, 15)); f.draw(); fb.draw(); table();
    });
    all();
  })();

  /* ---------- sRGB flag ---------- */
  (function srgbLab() {
    const cv = document.getElementById('srgb'); if (!cv) return;
    const v = A.range('sr-v', x => x, () => { f.draw(); fs.draw(); table(); });
    const f = A.fig(cv, (ctx, W, H) => {
      const L = 40, R = W - 12, T = 12, B = H - 34, x = s => L + s * (R - L), y = s => B - s * (B - T);
      const ink = col('ink'), muted = col('muted'), line = col('line'), acc = col('accent'), ray = col('ray');
      ctx.font = '10px "JetBrains Mono", monospace'; ctx.textBaseline = 'middle';
      for (let k = 0; k <= 4; k++) { const s = k / 4; ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(x(s), T); ctx.lineTo(x(s), B); ctx.moveTo(L, y(s)); ctx.lineTo(R, y(s)); ctx.stroke(); ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.fillText(Math.round(s * 255), x(s), B + 12); ctx.textAlign = 'right'; ctx.fillText(s.toFixed(2), L - 5, y(s)); }
      ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.fillText('stored byte', (L + R) / 2, B + 26);
      ctx.strokeStyle = ray; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x(0), y(0)); ctx.lineTo(x(1), y(1)); ctx.stroke();
      ctx.strokeStyle = acc; ctx.beginPath(); for (let i = 0; i <= 100; i++) { const s = i / 100; i ? ctx.lineTo(x(s), y(srgbDecode(s))) : ctx.moveTo(x(s), y(srgbDecode(s))); } ctx.stroke(); ctx.lineWidth = 1;
      const s = v.v / 255; [[s, ray], [srgbDecode(s), acc]].forEach(([r, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x(s), y(r), 5, 0, 7); ctx.fill(); });
      ctx.strokeStyle = muted; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x(s), B); ctx.lineTo(x(s), y(s)); ctx.stroke(); ctx.setLineDash([]);
      ctx.textAlign = 'left'; ctx.fillStyle = ray; ctx.fillText('sRGB off: read as stored', L + 8, T + 10); ctx.fillStyle = acc; ctx.fillText('sRGB on: decoded', L + 8, T + 26);
    });
    const fs = A.fig(document.getElementById('srgb-spec'), (ctx, W, H) => {
      const vals = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9];
      ctx.font = '10px "JetBrains Mono", monospace'; ctx.textBaseline = 'middle';
      [['as painted', r => r], ['flagged sRGB', r => srgbDecode(r)]].forEach(([lab, fn], row) => {
        ctx.fillStyle = col('muted'); ctx.textAlign = 'left'; ctx.fillText(lab, 0, 14 + row * 52);
        vals.forEach((r, i) => {
          const cx = 112 + i * 38, cy = 28 + row * 52, rr = 16, a = fn(r) ** 2;
          ctx.fillStyle = '#3a4248'; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.fill();
          const hs = 2 + 26 * Math.sqrt(a), g = ctx.createRadialGradient(cx - 5, cy - 5, 0, cx - 5, cy - 5, hs);
          g.addColorStop(0, `rgba(255,255,255,${clamp(0.25 / (a + 0.02), 0.15, 1)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(cx - rr, cy - rr, 2 * rr, 2 * rr); ctx.restore();
        });
      });
    });
    function table() {
      const s = v.v / 255, d = srgbDecode(s);
      document.getElementById('sr-ro').innerHTML = `<tr><td>Value you painted</td><td>${s.toFixed(3)}</td></tr><tr><td>Shader reads, sRGB off</td><td>${s.toFixed(3)}</td></tr><tr class="win"><td>Shader reads, sRGB on</td><td>${d.toFixed(3)}</td></tr><tr><td>As roughness, GGX α = r²</td><td>${(s * s).toFixed(3)} → ${(d * d).toFixed(3)}</td></tr>`;
    }
    table();
  })();

  /* ---------- channel packing ---------- */
  (function packing() {
    const cv = document.getElementById('pack'); if (!cv) return;
    const N = 48;
    const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
    const panelMetal = (i, j) => (Math.floor(i / 16) + Math.floor(j / 24)) % 2 === 0;
    const seam = (i, j) => Math.min(i % 16, 15 - (i % 16), j % 24, 23 - (j % 24));
    const MAPS = {
      metallic: { n: 'Metallic', f: (i, j) => panelMetal(i, j) ? 1 : 0 },
      ao: { n: 'AO', f: (i, j) => clamp(0.45 + seam(i, j) * 0.18, 0, 1) },
      detail: { n: 'Detail mask', f: (i, j) => clamp(0.5 + 0.5 * Math.sin(i * 0.31 + Math.sin(j * 0.2) * 2) * Math.cos(j * 0.17), 0, 1) },
      smooth: { n: 'Smoothness', f: (i, j) => clamp((panelMetal(i, j) ? 0.7 : 0.3) + 0.1 * (hash(i >> 1, j >> 1) - 0.5) + (((i + j * 2) % 17 === 0) ? 0.25 : 0), 0, 1) },
      rough: { n: 'Roughness', f: (i, j) => 1 - MAPS.smooth.f(i, j) },
      height: { n: 'Height', f: (i, j) => { const r = Math.hypot((i % 8) - 3.5, (j % 8) - 3.5); return clamp(0.5 + (r < 2 ? 0.4 * (1 - r / 2) : 0) - (seam(i, j) < 1 ? 0.3 : 0), 0, 1); } },
      none: { n: 'Empty (0)', f: () => 0 },
      one: { n: 'White (1)', f: () => 1 }
    };
    const PRESET = { hdrp: ['metallic', 'ao', 'detail', 'smooth'], urp: ['metallic', 'none', 'none', 'smooth'], unreal: ['ao', 'rough', 'metallic', 'height'] };
    const NAME = { hdrp: 'HDRP mask map', urp: 'URP metallic map', unreal: 'Unreal ORM convention' };
    const READS = { hdrp: ['metallic', 'AO', 'detail mask', 'smoothness'], urp: ['metallic', 'nothing', 'nothing', 'smoothness'], unreal: ['AO', 'roughness', 'metallic', 'anything (free)'] };
    let target = 'hdrp', slots = PRESET.hdrp.slice();
    const CH = ['R', 'G', 'B', 'A'], CLS = ['r', 'g', 'b', 'a'];
    const sEl = document.getElementById('pack-slots');
    sEl.innerHTML = CH.map((c, k) => `<label class="${CLS[k]}"><b>${c}</b><select class="sel" id="pack-s${k}">${Object.keys(MAPS).map(m => `<option value="${m}">${MAPS[m].n}</option>`).join('')}</select></label>`).join('');
    const fmtEl = document.getElementById('pack-fmt'), srgbEl = document.getElementById('pack-srgb');
    let res = null;
    function compute() {
      const chans = slots.map(m => { const a = new Float32Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) a[j * N + i] = MAPS[m].f(i, j); return a; });
      const fmtv = fmtEl.value, out = chans.map(a => Float32Array.from(a));
      if (fmtv !== 'bc7') {
        const img = []; for (let k = 0; k < N * N; k++) img.push([0, 1, 2].map(c => Math.round(chans[c][k] * 255)));
        const r = bc1Image(img, N, N, 'pca');
        for (let k = 0; k < N * N; k++) for (let c = 0; c < 3; c++) out[c][k] = r.out[k][c] / 255;
        if (fmtv === 'bc1') for (let k = 0; k < N * N; k++) out[3][k] = chans[3][k] >= 0.5 ? 1 : 0;
      } else for (let c = 0; c < 4; c++) for (let k = 0; k < N * N; k++) out[c][k] = Math.round(chans[c][k] * 255) / 255;
      const read = out.map(a => srgbEl.checked ? a.map((x, k) => srgbDecode(x)) : a);
      const err = read.map((a, c) => { let s = 0; for (let k = 0; k < N * N; k++) s += (a[k] - chans[c][k]) ** 2; return Math.sqrt(s / (N * N)) * 255; });
      res = { chans, read, err };
    }
    const P = 108, G2 = 15;
    const f = A.fig(cv, (ctx, W, H) => {
      if (!res) return;
      ctx.font = '10px "JetBrains Mono", monospace'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      const tint = [[1, .3, .3], [.3, 1, .3], [.35, .5, 1], [1, 1, 1]];
      res.read.forEach((a, c) => {
        const im = putRGB(N, N, (i, j) => { const v = a[j * N + i] * 255; return [v, v, v]; });
        blitPx(ctx, im, c * (P + G2), 4, P, P);
        ctx.fillStyle = col(['ax-x', 'ax-y', 'ax-z', 'ink'][c]); ctx.fillText(CH[c] + ' ' + MAPS[slots[c]].n, c * (P + G2), P + 20);
        ctx.fillStyle = col(res.err[c] > 6 ? 'bad' : 'muted'); ctx.fillText('error ' + res.err[c].toFixed(1), c * (P + G2), P + 34);
      });
      const comp = putRGB(N, N, (i, j) => [0, 1, 2].map(c => res.read[c][j * N + i] * 255));
      blitPx(ctx, comp, 4 * (P + G2), 4, P, P);
      ctx.fillStyle = col('muted'); ctx.fillText('RGB as stored', 4 * (P + G2), P + 20);
    });
    function warn() {
      const L = [], fmtv = fmtEl.value, exp = PRESET[target];
      slots.forEach((m, c) => {
        if (target === 'unreal' && c === 3) return;
        const want = exp[c];
        if (m !== want) {
          const inv = (m === 'rough' && want === 'smooth') || (m === 'smooth' && want === 'rough');
          L.push(['bad', `${CH[c]} holds ${MAPS[m].n.toLowerCase()}, but the ${NAME[target]} reads ${READS[target][c]} there.${inv ? ' Invert the channel, do not just move it.' : ''}`]);
        }
      });
      if (srgbEl.checked) L.push(['bad', 'sRGB is on. The shader decodes every channel: a stored 0.5 arrives as 0.21. Data maps must be linear.']);
      if (fmtv === 'bc1' && slots[3] !== 'none' && slots[3] !== 'one') L.push(['bad', `BC1 keeps only 1-bit alpha: ${MAPS[slots[3]].n.toLowerCase()} in A collapses to black and white.`]);
      const rgbData = slots.slice(0, 3).filter(m => m !== 'none' && m !== 'one').length;
      if (fmtv !== 'bc7' && rgbData >= 2) L.push(['warn', `${fmtv.toUpperCase()} encodes R, G and B together on one color line per block. With ${rgbData} unrelated maps there, sharp edges in one channel add error to the others (see the error numbers). BC7 handles this better at the same 8 bpp as BC3.`]);
      if (fmtv === 'bc1' || fmtv === 'bc3') L.push(['warn', 'In this format green has 6 bits per endpoint, red and blue only 5.']);
      if (!L.some(x => x[0] === 'bad')) L.unshift(['good', `Matches the ${NAME[target]} layout.`]);
      document.getElementById('pack-warn').innerHTML = L.map(([k, t]) => `<li><span class="pill ${k}">${k === 'good' ? 'ok' : k === 'bad' ? 'wrong' : 'note'}</span><span>${t}</span></li>`).join('');
    }
    function setSlots() { slots.forEach((m, k) => { document.getElementById('pack-s' + k).value = m; }); }
    function all() { compute(); f.draw(); warn(); }
    sEl.addEventListener('change', () => { slots = [0, 1, 2, 3].map(k => document.getElementById('pack-s' + k).value); all(); });
    fmtEl.addEventListener('change', all); srgbEl.addEventListener('change', all);
    A.seg('pack-preset', v => { target = v; slots = PRESET[v].slice(); setSlots(); all(); });
    setSlots(); all();
  })();

  /* ---------- normal maps ---------- */
  (function normals() {
    const cv = document.getElementById('nrm'); if (!cv) return;
    const N = 96;
    const h = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let v = 0;
      const bx = (i % 24) - 11.5, by = (j % 24) - 11.5, r = Math.hypot(bx, by);
      if (r < 6) v += Math.sqrt(36 - r * r) / 6 * 0.9;                                    // rivet (bump)
      const gy = Math.abs(j - 60); if (gy < 3) v -= (1 - gy / 3) * 0.8;                     // horizontal groove
      const gd = Math.abs(i - j * 0.6 - 10) / 1.17; if (gd < 2.5 && j < 50) v -= (1 - gd / 2.5) * 0.6; // diagonal groove
      const e = Math.min(i, j, N - 1 - i, N - 1 - j); if (e < 6) v += (6 - e) / 6 * 0.5;    // raised border
      h[j * N + i] = v;
    }
    const truth = new Float32Array(N * N * 3), S = 3.0;
    const H = (i, j) => h[clamp(j, 0, N - 1) * N + clamp(i, 0, N - 1)];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const du = (H(i + 1, j) - H(i - 1, j)) / 2, dr = (H(i, j + 1) - H(i, j - 1)) / 2;
      // OpenGL convention: +Y points up the texture (decreasing row)
      let n = [-du * S, dr * S, 1]; const l = Math.hypot(...n); n = n.map(x => x / l);
      truth.set(n, (j * N + i) * 3);
    }
    let flip = false, two = true, maxErr = 0;
    const a = A.range('nrm-a', v => v + '°', () => draw());
    const el = A.range('nrm-e', v => v + '°', () => draw());
    document.getElementById('nrm-flip').addEventListener('change', e => { flip = e.target.checked; draw(); });
    document.getElementById('nrm-2ch').addEventListener('change', e => { two = e.target.checked; draw(); });
    const mapImg = putRGB(N, N, (i, j) => { const k = (j * N + i) * 3; return [0, 1, 2].map(c => Math.round((truth[k + c] * 0.5 + 0.5) * 255)); });
    const f = A.fig(cv, (ctx, W, Hh) => {
      const az = a.v * Math.PI / 180, ev = el.v * Math.PI / 180, L = [Math.cos(ev) * Math.cos(az), Math.cos(ev) * Math.sin(az), Math.sin(ev)];
      maxErr = 0;
      const lit = putRGB(N, N, (i, j) => {
        const k = (j * N + i) * 3;
        const enc = [0, 1, 2].map(c => Math.round((truth[k + c] * 0.5 + 0.5) * 255) / 255);
        let n = [enc[0] * 2 - 1, enc[1] * 2 - 1, 0];
        if (two) n[2] = Math.sqrt(clamp(1 - n[0] * n[0] - n[1] * n[1], 0, 1));
        else { n[2] = enc[2] * 2 - 1; }
        const l = Math.hypot(...n); n = n.map(x => x / l);
        const dot = n[0] * truth[k] + n[1] * truth[k + 1] + n[2] * truth[k + 2];
        maxErr = Math.max(maxErr, Math.acos(clamp(dot, -1, 1)) * 180 / Math.PI);
        if (flip) n[1] = -n[1];
        const d = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
        const v = 255 * srgbEncode(clamp(0.04 + 0.75 * d, 0, 1));
        return [v * 0.95, v * 0.97, v];
      });
      const P = 288;
      blitPx(ctx, mapImg, 0, 0, P, P); blitPx(ctx, lit, W - P, 0, P, P);
      // light direction arrow on lit panel
      const cx = W - P / 2, cy = P / 2, rr = P / 2 - 16;
      ctx.strokeStyle = '#ffd36b'; ctx.fillStyle = '#ffd36b'; ctx.lineWidth = 2;
      const lx = cx + Math.cos(az) * rr, ly = cy - Math.sin(az) * rr;
      ctx.beginPath(); ctx.arc(lx, ly, 7, 0, 7); ctx.fill();
      ctx.font = '600 10px "JetBrains Mono", monospace'; ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('L', lx, ly + 0.5);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, P - 20, 130, 20); ctx.fillRect(W - P, P - 20, 150, 20);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = '10px "JetBrains Mono", monospace'; ctx.fillText('normal map (Y+)', 6, P - 10); ctx.fillText(flip ? 'lit, read as Y−' : 'lit, read as Y+', W - P + 6, P - 10);
    });
    function draw() {
      f.draw();
      const verdict = flip ? (Math.abs(Math.sin(a.v * Math.PI / 180)) > 0.5 ? 'rivets read as dents' : 'looks almost right: light is along X') : 'rivets read as bumps';
      document.getElementById('nrm-ro').innerHTML = `<tr><td>Storage</td><td>${two ? '2 channels, Z rebuilt' : '3 channels'}</td></tr><tr><td>Max error vs. float</td><td>${maxErr.toFixed(2)}°</td></tr><tr class="win"><td>With this light</td><td>${verdict}</td></tr>`;
    }
    draw();
  })();
})();
