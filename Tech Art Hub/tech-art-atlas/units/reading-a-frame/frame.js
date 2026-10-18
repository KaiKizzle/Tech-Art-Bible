/* Reading a Frame — labs. */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp } = A;
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const hue = (i, n, s = 55, l = 55, a = 1) => `hsl(${(i * 360 / n + 200) % 360} ${s}% ${l}% / ${a})`;
  function hatch(ctx, x, y, w, h, c) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.strokeStyle = c; ctx.lineWidth = 1; for (let k = -h; k < w; k += 5) { ctx.beginPath(); ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); ctx.stroke(); } ctx.restore(); }

  /* ---------- pipeline timeline ---------- */
  (function timeline() {
    const cv = document.getElementById('tl'); if (!cv) return;
    let vs = 0, sim = null;
    function simulate(a, b, c, T) {
      const K = 16, ms = [], me = [], rs = [], re = [], gs = [], ge = [], pr = [];
      for (let k = 0; k < K; k++) {
        ms[k] = Math.max(k ? me[k - 1] : 0, k ? rs[k - 1] : 0); me[k] = ms[k] + a;
        rs[k] = Math.max(k ? re[k - 1] : 0, me[k], k ? gs[k - 1] : 0); re[k] = rs[k] + b;
        gs[k] = Math.max(k ? ge[k - 1] : 0, re[k], T && k ? pr[k - 1] : 0); ge[k] = gs[k] + c;
        pr[k] = T ? Math.max(Math.ceil(ge[k] / T - 1e-9) * T, k ? pr[k - 1] + T : 0) : ge[k];
      }
      const interval = (pr[K - 1] - pr[K - 5]) / 4;
      let lat = 0; for (let k = K - 5; k < K; k++) lat += pr[k] - ms[k]; lat /= 5;
      return { K, ms, me, rs, re, gs, ge, pr, interval, lat };
    }
    const f = A.fig(cv, (ctx, W, H) => {
      if (!sim) return;
      const ink = col('ink'), muted = col('muted'), line = col('line');
      const k0 = sim.K - 6, t0 = sim.ms[k0], span = Math.max(60, sim.interval * 4.2), L = 70, R = W - 10;
      const x = t => L + (t - t0) / span * (R - L);
      const lanes = [['Game', 'ms', 'me'], ['Render', 'rs', 're'], ['GPU', 'gs', 'ge']];
      ctx.font = '11px "JetBrains Mono", monospace'; ctx.textBaseline = 'middle';
      // ms grid
      for (let t = 0; t <= span; t += 10) { const xx = x(t0 + t); if (xx > R - 16) break; ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(xx, 14); ctx.lineTo(xx, H - 34); ctx.stroke(); ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.fillText(t + ' ms', xx, H - 24); }
      if (vs) { ctx.strokeStyle = alpha(col('ray'), 0.5); ctx.setLineDash([2, 3]); for (let t = Math.ceil(t0 / vs) * vs; t < t0 + span; t += vs) { ctx.beginPath(); ctx.moveTo(x(t), 14); ctx.lineTo(x(t), H - 34); ctx.stroke(); } ctx.setLineDash([]); }
      lanes.forEach(([name, s, e], li) => {
        const y = 22 + li * 46;
        ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.fillText(name, 4, y + 15);
        hatch(ctx, L, y, R - L, 30, alpha(muted, 0.35));
        for (let k = 0; k < sim.K; k++) {
          const a = x(sim[s][k]), b = x(sim[e][k]); if (b < L || a > R) continue;
          const aa = Math.max(L, a), bb = Math.min(R, b);
          ctx.fillStyle = hue(k % 4, 4, 55, 52); ctx.fillRect(aa, y, bb - aa - 1, 30);
          if (bb - aa > 24) { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('F' + k, (aa + bb) / 2, y + 15); }
        }
      });
      const y = 22 + 3 * 46;
      ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.fillText('Display', 4, y + 8);
      for (let k = 0; k < sim.K; k++) { const xx = x(sim.pr[k]); if (xx < L || xx > R) continue; ctx.fillStyle = hue(k % 4, 4, 55, 52); ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx + 6, y + 16); ctx.lineTo(xx - 6, y + 16); ctx.fill(); }
      ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.fillText('hatched = waiting', R, H - 8);
    });
    const ra = A.range('tl-main', v => v.toFixed(1) + ' ms', up), rb = A.range('tl-rt', v => v.toFixed(1) + ' ms', up), rc = A.range('tl-gpu', v => v.toFixed(1) + ' ms', up);
    A.seg('tl-vs', v => { vs = +v ? 1000 / +v : 0; up(); });
    function up() {
      const a = ra.v, b = rb.v, c = rc.v;
      sim = simulate(a, b, c, vs);
      const mx = Math.max(a, b, c), who = mx === c ? 'GPU' : mx === a ? 'game thread' : 'render thread';
      const fps = 1000 / sim.interval;
      let msg = `Frame time ${sim.interval.toFixed(1)} ms (${fps.toFixed(0)} fps), latency about ${sim.lat.toFixed(0)} ms. `;
      if (vs && mx < vs - 0.05) msg += `Limited by vsync: the slowest stage (${who}, ${mx.toFixed(1)} ms) has ${(vs - mx).toFixed(1)} ms of headroom.`;
      else if (vs) msg += `The ${who} needs ${mx.toFixed(1)} ms, more than one ${vs.toFixed(1)} ms refresh, so each frame waits for the next one.`;
      else msg += `Bound by the ${who}. Speeding up anything else does not change the frame rate.`;
      document.getElementById('tl-cap').textContent = msg;
      f.draw();
    }
    up();
  })();

  /* ---------- draw calls ---------- */
  (function drawcalls() {
    const cv = document.getElementById('dc'); if (!cv) return;
    let list = [], stats = {};
    const N = A.range('dc-n', v => v, up), M = A.range('dc-m', v => v, up), K = A.range('dc-k', v => v, up), S = A.range('dc-s', v => v, up);
    ['dc-sort', 'dc-persist', 'dc-inst'].forEach(id => document.getElementById(id).addEventListener('change', up));
    const f = A.fig(cv, (ctx, W, H) => {
      const ink = col('ink'), muted = col('muted'), acc = col('accent');
      const show = Math.min(list.length, 240), cols = 40, cw = (W - 4) / cols, rh = 34;
      ctx.font = '10px "JetBrains Mono", monospace'; ctx.textBaseline = 'alphabetic';
      for (let i = 0; i < show; i++) {
        const d = list[i], x = 2 + (i % cols) * cw, y = 6 + Math.floor(i / cols) * rh;
        ctx.fillStyle = hue(d.m, Math.max(8, M.v), 50, 55); ctx.fillRect(x + 1, y + 8, cw - 2, rh - 16);
        if (d.inst > 1) { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('×' + d.inst, x + cw / 2, y + rh / 2 + 3); }
        if (d.sh) { ctx.fillStyle = ink; ctx.fillRect(x, y, 2, rh - 4); }
        else if (d.mc) { ctx.fillStyle = acc; ctx.fillRect(x, y + 4, 2, rh - 12); }
      }
      ctx.fillStyle = muted; ctx.textAlign = 'left';
      ctx.fillText(`first ${show} of ${list.length} draws · black tick: shader change · orange tick: material change`, 2, H - 4);
    });
    function up() {
      const n = N.v, m = M.v, k = K.v, s = Math.min(S.v, m), r = rng(n * 7919 + m * 131 + k);
      const sort = document.getElementById('dc-sort').checked, persist = document.getElementById('dc-persist').checked, inst = document.getElementById('dc-inst').checked;
      let objs = []; for (let i = 0; i < n; i++) { const mat = Math.floor(r() * m); objs.push({ m: mat, s: mat % s, k: Math.floor(r() * k) }); }
      if (sort || inst) objs.sort((a, b) => a.s - b.s || a.m - b.m || a.k - b.k);
      list = [];
      objs.forEach(o => { const last = list[list.length - 1]; if (inst && last && last.m === o.m && last.k === o.k) last.inst++; else list.push({ ...o, inst: 1 }); });
      let sc = 0, mc = 0, ps = -1, pm = -1;
      list.forEach(d => { d.sh = d.s !== ps; d.mc = d.m !== pm; if (d.sh) sc++; if (d.mc) mc++; ps = d.s; pm = d.m; });
      const us = list.length * 2 + mc * (persist ? 1 : 6) + sc * 15;
      document.getElementById('dc-ro').innerHTML = `<tr><td>Draw calls</td><td>${list.length}</td></tr><tr><td>Material changes</td><td>${mc}</td></tr><tr><td>Shader changes</td><td>${sc}</td></tr><tr class="win"><td>Render thread cost</td><td>${(us / 1000).toFixed(2)} ms</td></tr><tr><td>Of a 16.7 ms frame</td><td>${(us / 1000 / 16.67 * 100).toFixed(0)}%</td></tr>`;
      f.draw();
    }
    up();
  })();

  /* ---------- overdraw ---------- */
  (function overdraw() {
    const cv = document.getElementById('od'); if (!cv) return;
    const GW = 160, GH = 90;
    let mode = 'smoke', order = 'rand', counts = new Float32Array(GW * GH);
    const HEAT = [[0, [0, 0, 0, 0]], [1, [40, 70, 170, 255]], [2, [30, 150, 190, 255]], [3, [50, 165, 80, 255]], [4, [220, 200, 50, 255]], [6, [235, 130, 40, 255]], [9, [215, 50, 40, 255]], [14, [255, 255, 255, 255]]];
    function heat(v) { if (v <= 0) return null; let a = HEAT[0], b = HEAT[HEAT.length - 1]; for (let i = 0; i < HEAT.length - 1; i++) if (v >= HEAT[i][0] && v <= HEAT[i + 1][0]) { a = HEAT[i]; b = HEAT[i + 1]; break; } if (v > b[0]) return b[1]; const t = (v - a[0]) / (b[0] - a[0] || 1); return a[1].map((x, i) => i < 3 ? x + (b[1][i] - x) * t : 255); }
    const n = A.range('od-n', v => v, up), sz = A.range('od-s', v => v.toFixed(2), up);
    const orderEl = document.getElementById('od-order');
    A.seg('od-mode', v => { mode = v; orderEl.hidden = v !== 'crowd'; up(); });
    A.seg(orderEl, v => { order = v; up(); });
    orderEl.hidden = true;
    const o = document.createElement('canvas'); o.width = GW; o.height = GH; const octx = o.getContext('2d'); const img = octx.createImageData(GW, GH);
    const f = A.fig(cv, (ctx, W, H) => {
      for (let k = 0; k < GW * GH; k++) { const c = heat(counts[k]); const p = k * 4; if (c) { img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255; } else img.data[p + 3] = 0; }
      octx.putImageData(img, 0, 0);
      ctx.fillStyle = col('surface-2'); ctx.fillRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(o, 0, 0, W, H);
    });
    A.fig(document.getElementById('od-key'), (ctx, W, H) => {
      ctx.font = '10px "JetBrains Mono", monospace'; ctx.textBaseline = 'middle';
      for (let i = 0; i < W - 60; i++) { const v = 1 + i / (W - 60) * 14; const c = heat(v); ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.fillRect(i, 4, 1, 12); }
      ctx.fillStyle = col('muted'); ctx.textAlign = 'left'; ctx.fillText('1×', 0, 22); ctx.textAlign = 'right'; ctx.fillText('15× shaded', W - 60, 22);
    });
    function up() {
      counts = new Float32Array(GW * GH);
      const N = n.v, s = sz.v, r = rng(N * 31 + Math.round(s * 1000) + (mode === 'smoke' ? 7 : 13));
      let parts = [];
      if (mode === 'smoke') {
        for (let i = 0; i < N; i++) { const t = r(); parts.push({ x: GW * (0.5 + (r() - 0.5) * 0.25 * (0.4 + t)), y: GH * (0.95 - 0.85 * t), rad: GH * s * (0.6 + 0.8 * t), z: 0 }); }
        parts.forEach(p => { const x0 = Math.max(0, Math.floor(p.x - p.rad)), x1 = Math.min(GW - 1, Math.ceil(p.x + p.rad)), y0 = Math.max(0, Math.floor(p.y - p.rad)), y1 = Math.min(GH - 1, Math.ceil(p.y + p.rad)); for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) { const dx = i + 0.5 - p.x, dy = j + 0.5 - p.y; if (Math.abs(dx) <= p.rad && Math.abs(dy) <= p.rad) counts[j * GW + i]++; } }); // quads: the whole sprite rectangle is shaded
      } else {
        for (let i = 0; i < N; i++) parts.push({ x: GW * r(), y: GH * (0.25 + 0.7 * r()), rad: GH * s * 0.5 * (0.7 + 0.6 * r()), z: r() });
        parts.forEach(p => { p.z = 1 - p.y / GH * 0.9 + p.z * 0.1; }); // lower on screen = nearer
        const ordered = parts.slice();
        if (order === 'b2f') ordered.sort((a, b) => b.z - a.z); else if (order === 'f2b' || order === 'pre') ordered.sort((a, b) => a.z - b.z);
        const depth = new Float32Array(GW * GH).fill(Infinity);
        ordered.forEach(p => { const x0 = Math.max(0, Math.floor(p.x - p.rad)), x1 = Math.min(GW - 1, Math.ceil(p.x + p.rad)), y0 = Math.max(0, Math.floor(p.y - p.rad * 1.6)), y1 = Math.min(GH - 1, Math.ceil(p.y + p.rad * 1.6)); for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) { const dx = (i + 0.5 - p.x) / p.rad, dy = (j + 0.5 - p.y) / (p.rad * 1.6); if (dx * dx + dy * dy <= 1) { const k = j * GW + i; if (p.z < depth[k]) { depth[k] = p.z; if (order !== 'pre') counts[k]++; } } } });
        if (order === 'pre') for (let k = 0; k < GW * GH; k++) if (depth[k] < Infinity) counts[k] = 1;
      }
      let cov = 0, sum = 0, mx = 0; for (let k = 0; k < GW * GH; k++) if (counts[k] > 0) { cov++; sum += counts[k]; mx = Math.max(mx, counts[k]); }
      const scale = 1920 * 1080 / (GW * GH);
      document.getElementById('od-ro').innerHTML = `<tr><td>Average per covered pixel</td><td>${cov ? (sum / cov).toFixed(2) : '0'}×</td></tr><tr><td>Worst pixel</td><td>${mx}×</td></tr><tr class="win"><td>Pixel shader runs at 1080p</td><td>${(sum * scale / 1e6).toFixed(1)} M</td></tr><tr><td>Screen pixels covered</td><td>${(cov / (GW * GH) * 100).toFixed(0)}%</td></tr>`;
      document.getElementById('od-cap').textContent = mode === 'smoke' ? 'Each sprite is a quad, so its whole square runs the shader even where the texture is transparent.' : order === 'pre' ? 'The prepass draws all depth first; shading then runs exactly once per covered pixel, at the cost of drawing the geometry twice.' : order === 'f2b' ? 'Nearest first: every hidden fragment fails the depth test before shading.' : order === 'b2f' ? 'Farthest first: every layer passes the depth test and gets shaded, then overwritten.' : 'Random order: a fragment is shaded whenever it is nearer than everything drawn so far.';
      f.draw();
    }
    up();
  })();

  /* ---------- quad efficiency ---------- */
  (function quads() {
    const cv = document.getElementById('qd'); if (!cv) return;
    const GW = 32, GH = 20, cx = 16, cy = 10;
    let res = null;
    const T = A.range('qd-t', v => v, up), R = A.range('qd-r', v => v.toFixed(1) + ' px', up);
    function inside(p, a, b, c) {
      const e = (u, v) => (v[0] - u[0]) * (p[1] - u[1]) - (v[1] - u[1]) * (p[0] - u[0]);
      const d1 = e(a, b), d2 = e(b, c), d3 = e(c, a);
      return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
    }
    function up() {
      const n = T.v, r = R.v, owner = new Int16Array(GW * GH).fill(-1), qcount = new Int16Array((GW / 2) * (GH / 2));
      const tris = []; for (let t = 0; t < n; t++) { const a0 = t / n * 2 * Math.PI + 0.13, a1 = (t + 1) / n * 2 * Math.PI + 0.13; tris.push([[cx, cy], [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], [cx + r * Math.cos(a1), cy + r * Math.sin(a1)]]); }
      const quadsPer = tris.map(() => new Set());
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
        const p = [i + 0.5, j + 0.5];
        for (let t = 0; t < n; t++) if (inside(p, ...tris[t])) { owner[j * GW + i] = t; quadsPer[t].add((j >> 1) * (GW / 2) + (i >> 1)); break; }
      }
      let lanes = 0; quadsPer.forEach(s => { lanes += s.size * 4; s.forEach(q => qcount[q]++); });
      let covered = 0; for (let k = 0; k < owner.length; k++) if (owner[k] >= 0) covered++;
      res = { owner, qcount, tris, n };
      const eff = lanes ? covered / lanes : 0;
      document.getElementById('qd-ro').innerHTML = `<tr><td>Covered pixels</td><td>${covered}</td></tr><tr><td>Average triangle area</td><td>${(Math.PI * r * r / n).toFixed(1)} px</td></tr><tr><td>Lanes shaded</td><td>${lanes}</td></tr><tr><td>Helper lanes</td><td>${lanes - covered}</td></tr><tr class="win"><td>Quad efficiency</td><td>${(eff * 100).toFixed(0)}%</td></tr><tr><td>Cost vs one big triangle</td><td>${covered ? (lanes / covered).toFixed(2) : '–'}× per pixel</td></tr>`;
      f.draw();
    }
    const f = A.fig(cv, (ctx, W, H) => {
      if (!res) return;
      const c = W / GW, ink = col('ink'), muted = col('muted'), line = col('line');
      ctx.fillStyle = col('bg'); ctx.fillRect(0, 0, W, H);
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
        const o = res.owner[j * GW + i], x = i * c, y = j * c;
        if (o >= 0) { ctx.fillStyle = hue(o % 6, 6, 55, 58); ctx.fillRect(x, y, c, c); }
        else if (res.qcount[(j >> 1) * (GW / 2) + (i >> 1)]) hatch(ctx, x, y, c, c, alpha(col('bad'), 0.6));
        ctx.strokeStyle = alpha(line, 0.7); ctx.lineWidth = 0.5; ctx.strokeRect(x, y, c, c);
      }
      ctx.font = '600 10px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let qj = 0; qj < GH / 2; qj++) for (let qi = 0; qi < GW / 2; qi++) {
        const q = res.qcount[qj * (GW / 2) + qi]; if (!q) continue;
        ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.strokeRect(qi * 2 * c + 0.75, qj * 2 * c + 0.75, 2 * c - 1.5, 2 * c - 1.5);
        if (q > 1) { ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(qi * 2 * c + c - 8, qj * 2 * c + c - 7, 16, 14); ctx.fillStyle = '#fff'; ctx.fillText(q, qi * 2 * c + c, qj * 2 * c + c); }
      }
      ctx.strokeStyle = alpha(ink, 0.8); ctx.lineWidth = 1;
      res.tris.forEach(t => { ctx.beginPath(); ctx.moveTo(t[0][0] * c, t[0][1] * c); ctx.lineTo(t[1][0] * c, t[1][1] * c); ctx.lineTo(t[2][0] * c, t[2][1] * c); ctx.closePath(); ctx.stroke(); });
    });
    up();
  })();

  /* ---------- divergence ---------- */
  (function diverge() {
    const cv = document.getElementById('dv'); if (!cv) return;
    const GW = 64, GH = 32;
    let mask = 'circle', bits = null;
    const P = A.range('dv-p', v => v.toFixed(2), up), CA = A.range('dv-a', v => v, up), CB = A.range('dv-b', v => v, up);
    A.seg('dv-mask', v => { mask = v; up(); });
    function vnoise(x, y) { const h = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }; const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v; }
    function up() {
      const p = P.v; bits = new Uint8Array(GW * GH);
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
        let t;
        if (mask === 'circle') t = Math.hypot(i + 0.5 - GW / 2, (j + 0.5 - GH / 2) * 1.0) < p * 30;
        else { const cs = 0.6 + p * 10; t = vnoise((i + 0.5) / cs, (j + 0.5) / cs) > 0.5; }
        bits[j * GW + i] = t ? 1 : 0;
      }
      let cost = 0, ideal = 0, div = 0, waves = 0;
      for (let wj = 0; wj < GH / 4; wj++) for (let wi = 0; wi < GW / 8; wi++) {
        let on = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) on += bits[(wj * 4 + j) * GW + wi * 8 + i];
        waves++; ideal += (on * CA.v + (32 - on) * CB.v) / 32;
        if (on === 0) cost += CB.v; else if (on === 32) cost += CA.v; else { cost += CA.v + CB.v; div++; }
      }
      document.getElementById('dv-ro').innerHTML = `<tr><td>Waves</td><td>${waves}</td></tr><tr><td>Divergent waves</td><td>${div} (${(div / waves * 100).toFixed(0)}%)</td></tr><tr><td>Cost if lanes ran alone</td><td>${(ideal / waves).toFixed(0)} per pixel</td></tr><tr class="win"><td>Actual cost</td><td>${(cost / waves).toFixed(0)} per pixel</td></tr><tr><td>Waste from divergence</td><td>${((cost / ideal - 1) * 100).toFixed(0)}%</td></tr>`;
      f.draw();
    }
    const f = A.fig(cv, (ctx, W, H) => {
      if (!bits) return;
      const c = W / GW, acc = col('accent'), bad = col('bad'), line = col('line');
      ctx.fillStyle = col('bg'); ctx.fillRect(0, 0, W, H);
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (bits[j * GW + i]) { ctx.fillStyle = alpha(acc, 0.75); ctx.fillRect(i * c, j * c, c, c); }
      for (let wj = 0; wj < GH / 4; wj++) for (let wi = 0; wi < GW / 8; wi++) {
        let on = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) on += bits[(wj * 4 + j) * GW + wi * 8 + i];
        const d = on > 0 && on < 32;
        if (d) { ctx.fillStyle = alpha(bad, 0.12); ctx.fillRect(wi * 8 * c, wj * 4 * c, 8 * c, 4 * c); }
        ctx.strokeStyle = d ? bad : line; ctx.lineWidth = d ? 2 : 1; ctx.strokeRect(wi * 8 * c + 1, wj * 4 * c + 1, 8 * c - 2, 4 * c - 2);
      }
    });
    up();
  })();

  /* ---------- LODs ---------- */
  (function lods() {
    const cv = document.getElementById('lod'); if (!cv) return;
    const SH = [720, 1080, 1440, 2160], tf = Math.tan(Math.PI / 6);
    const LODS = [[0.5, 40000], [0.25, 12000], [0.12, 3500], [0.015, 900]];
    const d = A.range('lod-d', v => v.toFixed(1) + ' m', draw), hs = A.range('lod-h', v => SH[v] + 'p', draw);
    document.getElementById('lod-off').addEventListener('change', draw);
    const size = dist => 1 / (dist * tf);
    const pick = s => { if (document.getElementById('lod-off').checked) return s >= 0.015 ? 0 : -1; for (let i = 0; i < LODS.length; i++) if (s >= LODS[i][0]) return i; return -1; };
    const ppt = (s, i, H) => i < 0 ? 0 : Math.PI * (s * H / 2) ** 2 / (0.5 * LODS[i][1]);
    const f = A.fig(cv, (ctx, W, H) => {
      const ink = col('ink'), muted = col('muted'), line = col('line'), acc = col('accent'), ray = col('ray'), Hs = SH[hs.v];
      const L = 46, R = W - 12, T = 12, B = H - 34;
      const x = dist => L + Math.log(dist) / Math.log(200) * (R - L), y = v => B - (Math.log10(clamp(v, 0.01, 1e4)) + 2) / 6 * (B - T);
      ctx.font = '10px "JetBrains Mono", monospace'; ctx.textBaseline = 'middle';
      // LOD bands
      let prev = 1;
      for (let dist = 1; dist <= 200; dist *= 1.01) { const i = pick(size(dist)); ctx.fillStyle = i < 0 ? alpha(muted, 0.08) : hue(i, 4, 50, 55, 0.16); ctx.fillRect(x(prev), T, x(dist) - x(prev) + 1, B - T); prev = dist; }
      [1, 2, 5, 10, 20, 50, 100, 200].forEach(v => { ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(x(v), T); ctx.lineTo(x(v), B); ctx.stroke(); ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.fillText(v + ' m', x(v), B + 12); });
      [0.01, 0.1, 1, 10, 100, 1000, 10000].forEach(v => { ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(L, y(v)); ctx.lineTo(R, y(v)); ctx.stroke(); ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.fillText(v >= 1 ? v : v.toString(), L - 4, y(v)); });
      ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.fillText('distance (log)', (L + R) / 2, B + 25);
      ctx.save(); ctx.translate(10, (T + B) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('pixels per triangle', 0, 0); ctx.restore();
      ctx.strokeStyle = acc; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(L, y(10)); ctx.lineTo(R, y(10)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col('accent-ink'); ctx.textAlign = 'left'; ctx.fillText('10 px target', L + 4, y(10) - 8);
      const curve = (fixed, c, w, dash) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.beginPath(); let started = false; for (let dist = 1; dist <= 200; dist *= 1.01) { const s = size(dist), i = fixed ? (s >= 0.015 ? 0 : -1) : pick(s); if (i < 0) { started = false; continue; } const v = ppt(s, i, Hs); started ? ctx.lineTo(x(dist), y(v)) : ctx.moveTo(x(dist), y(v)); started = true; } ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; };
      curve(true, muted, 1.5, [4, 4]); curve(false, ray, 2.5, []);
      const s = size(d.v), i = pick(s), v = ppt(s, i, Hs);
      ctx.strokeStyle = ink; ctx.beginPath(); ctx.moveTo(x(d.v), T); ctx.lineTo(x(d.v), B); ctx.stroke();
      if (i >= 0) { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x(d.v), y(v), 5, 0, 7); ctx.fill(); }
      // screen preview
      const pw = 96, ph = 54, px = R - pw - 6, py = T + 6;
      ctx.fillStyle = col('surface'); ctx.fillRect(px, py, pw, ph); ctx.strokeStyle = ink; ctx.strokeRect(px, py, pw, ph);
      const rr = Math.min(ph * 3, s * ph / 2); ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
      ctx.fillStyle = i < 0 ? muted : hue(Math.max(0, i), 4, 50, 50); ctx.beginPath(); ctx.arc(px + pw / 2, py + ph / 2, Math.max(0.6, rr), 0, 7); ctx.fill(); ctx.restore();
      ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.fillText('on screen', px - 4, py + 8);
    });
    function draw() {
      f.draw();
      const s = size(d.v), i = pick(s), Hs = SH[hs.v], v = ppt(s, i, Hs);
      document.getElementById('lod-ro').innerHTML = `<tr><td>Screen size</td><td>${s.toFixed(3)}</td></tr><tr><td>Pixels covered</td><td>${Math.round(Math.PI * (s * Hs / 2) ** 2).toLocaleString('en-US')}</td></tr><tr class="win"><td>Active LOD</td><td>${i < 0 ? 'culled' : 'LOD ' + i + ' · ' + LODS[i][1].toLocaleString('en-US') + ' tris'}</td></tr><tr class="win"><td>Pixels per triangle</td><td>${i < 0 ? '–' : v < 1 ? v.toFixed(2) : v.toFixed(1)}</td></tr><tr><td>LOD switch sizes</td><td>0.5 · 0.25 · 0.12 · cull 0.015</td></tr>`;
    }
    draw();
  })();
})();
