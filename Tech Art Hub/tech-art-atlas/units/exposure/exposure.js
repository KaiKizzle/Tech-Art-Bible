/* Sun to Screen — labs. Every pixel of the scene is a physical luminance in cd/m². */
(function () {
  'use strict';
  const A = window.Atlas, { col, alpha, clamp, fmt } = A;

  /* ---------- shared math ---------- */
  const LUM = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const norm = c => { const l = LUM(c); return [c[0] / l, c[1] / l, c[2] / l]; };
  const evToExposure = ev => 1 / (1.2 * Math.pow(2, ev));
  const srgb = x => x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  function hableP(x) { const A = .15, B = .5, C = .1, D = .2, E = .02, F = .3; return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F; }
  const HW = hableP(11.2);
  const TM = {
    clip: x => Math.min(1, x),
    reinhard: x => x / (1 + x),
    aces: x => { x *= 0.6; return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1); },
    hable: x => clamp(hableP(2 * x) / HW, 0, 1)
  };
  const TM_NAME = { clip: 'Clip', reinhard: 'Reinhard', aces: 'ACES fit', hable: 'Hable' };

  /* ---------- the scene: a room with a lamp (left) and a sunlit window (right). X ∈ [0,2], Y ∈ [0,1] ---------- */
  const C = {
    wall: norm([1.0, 0.95, 0.88]), warm: norm([1.0, 0.78, 0.52]), sky: norm([0.55, 0.74, 1.0]),
    bldg: norm([1.0, 0.88, 0.74]), bldgWin: norm([0.5, 0.6, 0.75]), floor: norm([0.75, 0.55, 0.38]),
    shade: norm([1.0, 0.82, 0.55]), bulb: norm([1.0, 0.92, 0.8]), wood: norm([0.62, 0.42, 0.27]),
    paint: norm([0.32, 0.46, 0.52]), metal: norm([0.6, 0.6, 0.62]), frame: norm([1, 1, 1])
  };
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function scene(X, Y) {
    // window: frame and glass
    if (X > 1.25 && X < 1.75 && Y > 0.16 && Y < 0.62) {
      const glass = X > 1.27 && X < 1.73 && Y > 0.18 && Y < 0.60;
      const mull = Math.abs(X - 1.5) < 0.008 || Math.abs(Y - 0.39) < 0.007;
      if (!glass || mull) return [70, C.frame];
      const top = X < 1.52 ? 0.37 : 0.31;
      if (Y > top) {
        const wx = ((X - 1.2) * 40) % 1, wy = ((Y - top) * 34) % 1;
        if (wx > 0.35 && wx < 0.75 && wy > 0.3 && wy < 0.8) return [700, C.bldgWin];
        return [X < 1.52 ? 9000 : 4200, C.bldg];
      }
      return [4200 + 4500 * clamp((Y - 0.18) / 0.19, 0, 1), C.sky];
    }
    // lamp: shade, bulb, pole
    const ls = (Y - 0.36) / 0.12;
    if (ls >= 0 && ls <= 1 && Math.abs(X - 0.35) < 0.05 + 0.03 * ls) return [1500 * (0.8 + 0.3 * ls), C.shade];
    const bx = (X - 0.35) / 0.03, by = (Y - 0.488) / 0.01;
    if (bx * bx + by * by < 1) return [50000, C.bulb];
    if (Math.abs(X - 0.35) < 0.006 && Y > 0.48 && Y < 0.74) return [4, C.metal];
    if (Math.abs(X - 0.35) < 0.05 && Y > 0.735 && Y < 0.75) return [6, C.metal];
    // illuminance from window daylight and lamp (lux), used by wall, floor, furniture
    const dw = (X - 1.5) * (X - 1.5) + 0.5 * (Y - 0.4) * (Y - 0.4);
    const Ewin = 40 + 330 * Math.exp(-dw / 0.12);
    const dl = (X - 0.35) * (X - 0.35) + (Y - 0.47) * (Y - 0.47);
    const Elamp = 260 * 0.02 / (dl + 0.02);
    const E = Ewin + Elamp, wt = Elamp / E;
    // table
    if (X > 0.75 && X < 1.08 && Y > 0.6 && Y < 0.625) return [0.4 * E / Math.PI, C.wood];
    if (((X > 0.77 && X < 0.785) || (X > 1.045 && X < 1.06)) && Y >= 0.625 && Y < 0.76) return [0.12 * E / Math.PI * 0.4, C.wood];
    // floor
    if (Y > 0.74) {
      if (X > 0.76 && X < 1.07 && Y < 0.79) return [1.4, C.floor]; // shadow under table
      const sx = X - (Y - 0.74) * 0.9;           // sun patch, skewed parallelogram
      if (Y > 0.8 && Y < 0.95 && sx > 0.62 && sx < 0.95 && !(Math.abs(sx - 0.785) < 0.01) && !(Math.abs(Y - 0.875) < 0.006)) return [0.3 * 60000 / Math.PI, C.floor];
      return [0.3 * E * (0.75 + 0.25 * (Y - 0.74) / 0.26) / Math.PI, mix(C.floor, C.warm, wt * 0.5)];
    }
    // painting
    if (X > 0.55 && X < 0.68 && Y > 0.22 && Y < 0.38) {
      if (X < 0.56 || X > 0.67 || Y < 0.23 || Y > 0.37) return [0.5 * E / Math.PI, C.wood];
      const s = 0.12 + 0.08 * Math.sin(X * 90) * Math.sin(Y * 70);
      return [s * E / Math.PI, C.paint];
    }
    // baseboard and wall
    if (Y > 0.72) return [0.75 * E / Math.PI, C.frame];
    return [0.7 * E / Math.PI, mix(C.wall, C.warm, wt * 0.8)];
  }
  function bake(W, H, x0, x1, y0, y1) {
    const L = new Float32Array(W * H), R = new Float32Array(W * H * 3);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      // 2×2 supersampling smooths edges
      let l = 0, r = 0, g = 0, b = 0;
      for (let s = 0; s < 4; s++) {
        const X = x0 + (i + 0.25 + 0.5 * (s & 1)) / W * (x1 - x0), Y = y0 + (j + 0.25 + 0.5 * (s >> 1)) / H * (y1 - y0);
        const [ll, c] = scene(X, Y); l += ll; r += ll * c[0]; g += ll * c[1]; b += ll * c[2];
      }
      const k = j * W + i; L[k] = l / 4; R[k * 3] = r / 4; R[k * 3 + 1] = g / 4; R[k * 3 + 2] = b / 4;
    }
    return { W, H, L, R };
  }
  const FALSE = [[-99, '#16224f'], [-6, '#2b4fb4'], [-4, '#1f9fc4'], [-2, '#2f9b55'], [-0.5, '#9a9a9a'], [0.5, '#e3c33a'], [2, '#e7832e'], [3.27, '#d63a2e'], [6, '#e44fd6']];
  const FALSE_RGB = FALSE.map(([s, h]) => [s, [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]]);
  function develop(b, img, exposure, tm, falseColor) {
    const f = TM[tm], d = img.data; let clipped = 0;
    for (let k = 0; k < b.W * b.H; k++) {
      const v = b.L[k] * exposure;
      if (v >= 1) clipped++;
      if (falseColor) {
        const st = Math.log2(Math.max(1e-9, v) * 9.6);
        let c = FALSE_RGB[0][1]; for (const [s, rgb] of FALSE_RGB) if (st >= s) c = rgb;
        d[k * 4] = c[0]; d[k * 4 + 1] = c[1]; d[k * 4 + 2] = c[2]; d[k * 4 + 3] = 255; continue;
      }
      d[k * 4] = 255 * srgb(f(b.R[k * 3] * exposure)) + 0.5;
      d[k * 4 + 1] = 255 * srgb(f(b.R[k * 3 + 1] * exposure)) + 0.5;
      d[k * 4 + 2] = 255 * srgb(f(b.R[k * 3 + 2] * exposure)) + 0.5;
      d[k * 4 + 3] = 255;
    }
    return clipped / (b.W * b.H);
  }
  function blit(ctx, src, x, y, w, h) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, x, y, w, h); }
  function offscreen(W, H) { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; }

  /* ---------- hero ---------- */
  (function hero() {
    const cv = document.getElementById('hero'); if (!cv) return;
    const B = bake(280, 175, 0.2, 1.8, 0, 1);
    const off = offscreen(B.W, B.H), octx = off.getContext('2d'), img = octx.createImageData(B.W, B.H);
    let tm = 'aces', fc = false, clipped = 0;
    const cap = document.getElementById('hero-cap');
    let f = null;
    const ev = A.range('hero-ev', v => fmt(v, 1), () => f && f.draw());
    f = A.fig(cv, (ctx, W, H) => {
      clipped = develop(B, img, evToExposure(ev.v), tm, fc);
      octx.putImageData(img, 0, 0); blit(ctx, off, 0, 0, W, H);
      if (fc) {
        ctx.font = '600 10px "JetBrains Mono", monospace'; ctx.textBaseline = 'middle';
        const labels = ['', '−6', '−4', '−2', 'grey', '+0.5', '+2', 'clip', '+6'];
        FALSE.forEach(([s, h], i) => { if (!i) return; const x = 8 + (i - 1) * 52, y = H - 14; ctx.fillStyle = h; ctx.fillRect(x, y - 6, 12, 12); ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3; ctx.strokeText(labels[i], x + 16, y); ctx.fillText(labels[i], x + 16, y); });
      }
      const grey = Math.pow(2, ev.v) / 8;
      cap.textContent = `Exposure multiplier ${evToExposure(ev.v).toExponential(2)}. A ${fmt(grey, grey < 10 ? 1 : 0)} cd/m² surface lands on middle grey. ${(clipped * 100).toFixed(0)}% of pixels exceed the clipping point${tm === 'clip' ? ' and are flat white' : ', and the ' + TM_NAME[tm] + ' curve bends them back into range'}.`;
    });
    A.seg('hero-tm', v => { tm = v; f.draw(); });
    document.getElementById('hero-false').addEventListener('change', e => { fc = e.target.checked; f.draw(); });
    f.draw();
  })();

  /* ---------- units lab ---------- */
  (function units() {
    const cv = document.getElementById('u-cv'); if (!cv) return;
    const ro = document.getElementById('u-ro');
    const like = E => E < 1 ? 'moonlight' : E < 30 ? 'a street at night' : E < 200 ? 'a living room' : E < 700 ? 'an office desk' : E < 5000 ? 'a TV studio or overcast day' : 'daylight';
    let phi = +document.getElementById('u-phi').value, d = +document.getElementById('u-d').value, th = +document.getElementById('u-th').value, rho = +document.getElementById('u-rho').value;
    const f = A.fig(cv, (ctx, W, H) => {
      const ink = col('ink'), muted = col('muted'), line = col('line'), acc = col('accent'), ray = col('ray');
      const bx = 50, by = H / 2, s = (W - 110) / 5;
      // floor grid in meters
      ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.font = '10px "JetBrains Mono", monospace'; ctx.fillStyle = muted; ctx.textAlign = 'center';
      for (let m = 0; m <= 5; m++) { const x = bx + m * s; ctx.beginPath(); ctx.moveTo(x, H - 22); ctx.lineTo(x, H - 16); ctx.stroke(); ctx.fillText(m + ' m', x, H - 6); }
      ctx.beginPath(); ctx.moveTo(bx, H - 19); ctx.lineTo(bx + 5 * s, H - 19); ctx.stroke();
      // cone through a patch of ±h at distance d, extended to 2d
      const wx = bx + d * s, h = 22;
      const far = Math.min(2 * d, 5.4), fx = bx + far * s, fh = h * far / d;
      ctx.fillStyle = alpha(acc, 0.12); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(fx, by - fh); ctx.lineTo(fx, by + fh); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = alpha(acc, 0.7); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(fx, by - fh); ctx.moveTo(bx, by); ctx.lineTo(fx, by + fh); ctx.stroke(); ctx.setLineDash([]);
      if (far >= 2 * d - 1e-6) { ctx.fillStyle = alpha(acc, 0.35); ctx.fillRect(fx - 3, by - fh, 6, 2 * fh); ctx.fillStyle = muted; ctx.textAlign = 'left'; ctx.fillText('2d: ¼ of the lux', Math.min(fx + 6, W - 100), by - fh - 6); }
      // tilted wall at d
      const t = th * Math.PI / 180, len = 120;
      ctx.save(); ctx.translate(wx, by); ctx.rotate(t);
      ctx.fillStyle = col('surface-2'); ctx.fillRect(0, -len, 10, 2 * len);
      ctx.fillStyle = alpha(acc, 0.55 + 0.4 * clamp(Math.log10(1 + E()) / 3, 0, 1)); ctx.fillRect(-2, -h / Math.cos(t), 4, 2 * h / Math.cos(t));
      ctx.strokeStyle = ray; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-38, 0); ctx.stroke();
      ctx.fillStyle = ray; ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(-34, -5); ctx.lineTo(-34, 5); ctx.fill();
      ctx.restore();
      ctx.fillStyle = ray; ctx.textAlign = 'left'; ctx.fillText('normal', wx - 44 * Math.cos(t) - 10, by - 44 * Math.sin(t) - 10);
      // bulb
      const g = ctx.createRadialGradient(bx, by, 2, bx, by, 26 + phi / 120);
      g.addColorStop(0, alpha(acc, 0.9)); g.addColorStop(1, alpha(acc, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, 26 + phi / 120, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.fillText(phi + ' lm', bx, by + 40);
      ctx.fillStyle = muted; ctx.fillText('d = ' + d.toFixed(2) + ' m', (bx + wx) / 2, by + 14 + h);
    });
    function I() { return phi / (4 * Math.PI); }
    function E() { return I() * Math.cos(th * Math.PI / 180) / (d * d); }
    function update() {
      const i = I(), e = E(), L = rho * e / Math.PI, ev = Math.log2(8 * L);
      ro.innerHTML = `<tr><td>Intensity I = Φ/4π</td><td>${i.toFixed(1)} cd</td></tr><tr><td>Illuminance E = I cosθ / d²</td><td>${e.toFixed(1)} lx</td></tr><tr class="win"><td>Luminance L = ρE / π</td><td>${L.toFixed(2)} cd/m²</td></tr><tr><td>Meter would suggest</td><td>EV100 ${ev.toFixed(1)}</td></tr><tr><td>Light level like</td><td>${like(e)}</td></tr>`;
      f.draw();
    }
    A.range('u-phi', v => v + ' lm', v => { phi = v; update(); });
    A.range('u-d', v => v.toFixed(2) + ' m', v => { d = v; update(); });
    A.range('u-th', v => v + '°', v => { th = v; update(); });
    A.range('u-rho', v => v.toFixed(2), v => { rho = v; update(); });
    update();
  })();

  /* ---------- luminance ladder ---------- */
  (function ladder() {
    const cv = document.getElementById('ladder'); if (!cv) return;
    const cap = document.getElementById('ladder-cap');
    const M = [[2e-4, 'starry night sky'], [0.01, 'moonlit field'], [1, 'street at night'], [20, 'living room wall'], [80, 'office wall'], [250, 'SDR display white'], [2000, 'overcast sky'], [7000, 'clear blue sky'], [28000, 'sunlit snow'], [1e5, 'frosted bulb'], [1.6e9, 'sun disc']];
    const lo = -4.3, hi = 9.6;
    let ev = 8;
    const f = A.fig(cv, (ctx, W, H) => {
      const ink = col('ink'), muted = col('muted'), line = col('line'), acc = col('accent'), ray = col('ray');
      const x = l => 20 + (Math.log10(l) - lo) / (hi - lo) * (W - 40), ay = 175;
      const clipL = 1.2 * Math.pow(2, ev), floorL = clipL / 1024, greyL = Math.pow(2, ev) / 8, shoulder = clipL * 8;
      // zones
      const zone = (a, b, c) => { ctx.fillStyle = c; ctx.fillRect(Math.max(20, x(a)), ay - 22, Math.min(W - 20, x(b)) - Math.max(20, x(a)), 22); };
      zone(10 ** lo, floorL, alpha(muted, 0.25));
      zone(floorL, clipL, alpha(acc, 0.35));
      zone(clipL, shoulder, alpha(acc, 0.15));
      ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x(greyL), ay - 30); ctx.lineTo(x(greyL), ay); ctx.stroke();
      ctx.font = '10px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = col('accent-ink');
      ctx.fillText('grey', x(greyL), ay - 34);
      // axis
      ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(20, ay); ctx.lineTo(W - 20, ay); ctx.stroke();
      ctx.fillStyle = muted;
      for (let p = -4; p <= 9; p++) { const xx = x(10 ** p); ctx.beginPath(); ctx.moveTo(xx, ay); ctx.lineTo(xx, ay + 6); ctx.stroke(); ctx.fillText('10' + sup(p), xx, ay + 19); }
      ctx.fillText('cd/m²', W - 40, ay + 36);
      // markers in three rows
      ctx.textAlign = 'left';
      M.forEach(([l, name], i) => {
        const xx = x(l), row = i % 3, yy = 20 + row * 34;
        ctx.strokeStyle = alpha(muted, 0.6); ctx.beginPath(); ctx.moveTo(xx, yy + 6); ctx.lineTo(xx, ay - 24); ctx.stroke();
        ctx.fillStyle = ray; ctx.beginPath(); ctx.arc(xx, ay - 24, 3, 0, 7); ctx.fill();
        ctx.fillStyle = ink; const tw = ctx.measureText(name).width; ctx.fillText(name, Math.min(xx - 3, W - tw - 4), yy);
      });
      ctx.fillStyle = muted; ctx.textAlign = 'left';
      ctx.fillText('black', Math.max(22, x(floorL) - 60), ay - 8);
      ctx.fillStyle = ink; ctx.fillText('recorded', clamp(x(Math.sqrt(floorL * clipL)) - 25, 24, W - 80), ay - 8);
    });
    function sup(p) { const m = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }; return String(p).split('').map(c => m[c]).join(''); }
    const r = A.range('ld-ev', v => fmt(v, 1), v => {
      ev = v; f.draw();
      const clipL = 1.2 * Math.pow(2, ev);
      const n = v2 => v2 >= 100 ? Math.round(v2).toLocaleString('en-US') : v2 >= 1 ? v2.toFixed(1) : v2.toPrecision(2);
      cap.textContent = `At EV100 ${ev.toFixed(1)} the clipping point is ${n(clipL)} cd/m² and middle grey is ${n(Math.pow(2, ev) / 8)} cd/m². Roughly ten stops below the clip (${n(clipL / 1024)} cd/m²) everything reads as black. A tonemapper's shoulder keeps about three more stops above the clip (light band) before white.`;
    });
    r.set(r.v);
  })();

  /* ---------- camera ---------- */
  (function camera() {
    const cv = document.getElementById('cam'); if (!cv) return;
    const N = [1, 1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22, 32];
    const T = [30, 15, 8, 4, 2, 1, 1 / 2, 1 / 4, 1 / 8, 1 / 15, 1 / 30, 1 / 60, 1 / 125, 1 / 250, 1 / 500, 1 / 1000, 1 / 2000, 1 / 4000, 1 / 8000];
    const S = [100, 200, 400, 800, 1600, 3200, 6400, 12800];
    const tName = t => t >= 1 ? t + ' s' : '1/' + Math.round(1 / t) + ' s';
    document.getElementById('cam-t').value = 12;
    const nE = document.getElementById('cam-n'), tE = document.getElementById('cam-t'), sE = document.getElementById('cam-s');
    const SC = [[-3, 'a moonlit field'], [3, 'a street at night'], [7, 'a living room'], [9, 'an office'], [12, 'an overcast day'], [14, 'open shade on a clear day'], [15, 'direct sun'], [16, 'sunlit snow or sand']];
    let parts = [0, 0, 0];
    const f = A.fig(cv, (ctx, W, H) => {
      const ink = col('ink'), muted = col('muted'), acc = col('accent'), ray = col('ray'), line = col('line');
      const x0 = 110, sc = (W - x0 - 20) / 22, zero = x0 + 6 * sc;
      ctx.font = '11px "JetBrains Mono", monospace'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = line; for (let s = -6; s <= 16; s += 2) { const x = zero + s * sc; ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, H - 30); ctx.stroke(); ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.fillText(s, x, H - 16); }
      const labels = ['Aperture', 'Shutter', 'ISO', 'EV100'], vals = [...parts, parts[0] + parts[1] + parts[2]];
      vals.forEach((v, i) => {
        const y = 40 + i * 48; ctx.fillStyle = i === 3 ? ink : muted; ctx.textAlign = 'left'; ctx.fillText(labels[i], 8, y);
        ctx.fillStyle = i === 3 ? acc : alpha(ray, 0.75);
        const a = Math.min(zero, zero + v * sc), b = Math.max(zero, zero + v * sc); ctx.fillRect(a, y - 12, Math.max(2, b - a), 24);
        ctx.fillStyle = ink; ctx.textAlign = v >= 0 ? 'left' : 'right'; ctx.fillText((v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2), v >= 0 ? b + 6 : a - 6, y);
      });
      ctx.strokeStyle = ink; ctx.beginPath(); ctx.moveTo(zero, 20); ctx.lineTo(zero, H - 30); ctx.stroke();
    });
    function update() {
      const n = N[+nE.value], t = T[+tE.value], s = S[+sE.value];
      document.getElementById('cam-n-o').textContent = 'f/' + n; document.getElementById('cam-t-o').textContent = tName(t); document.getElementById('cam-s-o').textContent = s;
      parts = [Math.log2(n * n), Math.log2(1 / t), -Math.log2(s / 100)];
      const ev = parts[0] + parts[1] + parts[2];
      document.getElementById('cam-ev').innerHTML = 'EV100 ' + fmt(ev, 2);
      let best = SC[0]; for (const sc of SC) if (Math.abs(sc[0] - ev) < Math.abs(best[0] - ev)) best = sc;
      document.getElementById('cam-match').textContent = `Correct for roughly ${best[1]} (EV100 ≈ ${best[0]}). Exact f-stops are rounded on the lens: f/5.6 is really 2^2.5 ≈ 5.66, so marked settings are off by a few hundredths of a stop.`;
      f.draw();
    }
    [nE, tE, sE].forEach(e => e.addEventListener('input', update)); update();
  })();

  /* ---------- auto exposure ---------- */
  (function autoexp() {
    const vc = document.getElementById('ae-view'); if (!vc) return;
    const PW = 270, PH = 100, VW = 122;                      // panorama X 0..2, view width 0.9
    const B = bake(PW, PH, 0, 2, 0.12, 0.87);
    const view = { W: VW, H: PH, L: new Float32Array(VW * PH), R: new Float32Array(VW * PH * 3) };
    const off = offscreen(VW, PH), octx = off.getContext('2d'), img = octx.createImageData(VW, PH);
    const ro = document.getElementById('ae-ro');
    let mode = 'hist', ev = null, target = 0, lavg = 0, logs = [], hist = [], lastCol = -1, clipped = 0;
    const hBins = 38, hLo = -2, hHi = 17;
    const hist2 = [];                      // history [t, target, ev]
    const pan = A.range('ae-pan', v => Math.round(v * 100) + '%', () => kick());
    const lo = A.range('ae-lo', v => v + '%', () => { lastCol = -1; kick(); });
    const hi = A.range('ae-hi', v => v + '%', () => { lastCol = -1; kick(); });
    const comp = A.range('ae-comp', v => (v > 0 ? '+' : '') + v.toFixed(1), () => { lastCol = -1; kick(); });
    const up = A.range('ae-up', v => v.toFixed(1) + '/s');
    const dn = A.range('ae-down', v => v.toFixed(1) + '/s');
    A.seg('ae-mode', v => { mode = v; lastCol = -1; kick(); });
    function meter() {
      const c0 = Math.round(pan.v * (PW - VW));
      if (c0 === lastCol) return; lastCol = c0;
      logs = [];
      for (let j = 0; j < PH; j++) for (let i = 0; i < VW; i++) {
        const k = j * PW + c0 + i, q = j * VW + i;
        view.L[q] = B.L[k]; view.R[q * 3] = B.R[k * 3]; view.R[q * 3 + 1] = B.R[k * 3 + 1]; view.R[q * 3 + 2] = B.R[k * 3 + 2];
        logs.push(Math.log2(Math.max(1e-4, B.L[k])));
      }
      hist = new Array(hBins).fill(0);
      logs.forEach(l => { hist[clamp(Math.floor((l - hLo) / (hHi - hLo) * hBins), 0, hBins - 1)]++; });
      let mean;
      if (mode === 'avg') mean = logs.reduce((a, b) => a + b, 0) / logs.length;
      else {
        const s = [...logs].sort((a, b) => a - b), a = Math.floor(s.length * lo.v / 100), b = Math.ceil(s.length * (1 - hi.v / 100));
        const part = s.slice(a, Math.max(a + 1, b)); mean = part.reduce((x, y) => x + y, 0) / part.length;
      }
      lavg = Math.pow(2, mean);
      target = clamp(Math.log2(8 * lavg) - comp.v, -2, 17);
      if (ev === null) ev = target;
    }
    const fv = A.fig(vc, (ctx, W, H) => {
      clipped = develop(view, img, evToExposure(ev ?? 8), 'aces', false);
      octx.putImageData(img, 0, 0); blit(ctx, off, 0, 0, W, H);
    });
    const fh = A.fig(document.getElementById('ae-hist'), (ctx, W, H) => {
      const ink = col('ink'), muted = col('muted'), acc = col('accent'), ray = col('ray');
      const x = l => 14 + (l - hLo) / (hHi - hLo) * (W - 28), base = H - 30;
      const mx = Math.max(1, ...hist);
      if (mode === 'hist' && logs.length) {
        const s = [...logs].sort((a, b) => a - b);
        const la = s[Math.floor(s.length * lo.v / 100)], lb = s[Math.min(s.length - 1, Math.ceil(s.length * (1 - hi.v / 100)))];
        ctx.fillStyle = alpha(muted, 0.18); ctx.fillRect(14, 10, x(la) - 14, base - 10); ctx.fillRect(x(lb), 10, W - 14 - x(lb), base - 10);
      }
      hist.forEach((n, i) => { const x0 = 14 + i / hBins * (W - 28), w = (W - 28) / hBins - 1; const h = n / mx * (base - 20); ctx.fillStyle = alpha(ray, 0.8); ctx.fillRect(x0, base - h, w, h); });
      ctx.strokeStyle = ink; ctx.beginPath(); ctx.moveTo(14, base); ctx.lineTo(W - 14, base); ctx.stroke();
      ctx.font = '10px "JetBrains Mono", monospace'; ctx.fillStyle = muted; ctx.textAlign = 'center';
      for (let l = 0; l <= 16; l += 4) ctx.fillText(l, x(l), base + 13);
      ctx.fillText('log₂ cd/m²', W / 2, base + 25);
      const lm = Math.log2(Math.max(1e-4, lavg));
      ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x(lm), 12); ctx.lineTo(x(lm), base); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = col('accent-ink'); ctx.textAlign = lm > 10 ? 'right' : 'left'; ctx.fillText('meter', x(lm) + (lm > 10 ? -4 : 4), 20);
    });
    const ft = A.fig(document.getElementById('ae-time'), (ctx, W, H) => {
      const ink = col('ink'), muted = col('muted'), acc = col('accent'), line = col('line');
      const now = performance.now() / 1000, span = 8, y = e => H - 18 - (e - 4) / 12 * (H - 30), x = t => 36 + (1 - (now - t) / span) * (W - 46);
      ctx.font = '10px "JetBrains Mono", monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let e = 4; e <= 16; e += 4) { ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(36, y(e)); ctx.lineTo(W - 10, y(e)); ctx.stroke(); ctx.fillStyle = muted; ctx.fillText('EV ' + e, 32, y(e)); }
      const pts = hist2.filter(p => now - p[0] < span);
      const path = (i, dash, c, w) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.beginPath(); pts.forEach((p, k) => { const yy = y(clamp(p[i], 3, 17)); k ? ctx.lineTo(x(p[0]), yy) : ctx.moveTo(x(p[0]), yy); }); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; };
      path(1, [5, 4], muted, 1.5); path(2, [], acc, 2.5);
      ctx.fillStyle = muted; ctx.textAlign = 'left'; ctx.fillText('−8 s', 38, H - 6); ctx.textAlign = 'right'; ctx.fillText('now', W - 10, H - 6);
    });
    let running = false, last = 0, visible = true, swing = null, idle = 0;
    function kick() { if (!running && visible) { running = true; last = performance.now(); requestAnimationFrame(tick); } }
    function tick(t) {
      const dt = Math.min(0.1, (t - last) / 1000); last = t;
      if (swing) {
        const k = (t - swing) / 1000; let p;
        if (k < 1.2) p = k / 1.2; else if (k < 4.2) p = 1; else if (k < 5.4) p = 1 - (k - 4.2) / 1.2; else { p = 0; swing = null; }
        p = p * p * (3 - 2 * p); pan.set(p);
      }
      meter();
      const sp = target > ev ? up.v : dn.v;
      ev += (target - ev) * (1 - Math.exp(-sp * dt));
      hist2.push([t / 1000, target, ev]); while (hist2.length > 600) hist2.shift();
      fv.draw(); fh.draw(); ft.draw();
      ro.innerHTML = `<tr><td>Metered average</td><td>${lavg >= 100 ? Math.round(lavg) : lavg.toFixed(1)} cd/m²</td></tr><tr><td>Target EV100</td><td>${target.toFixed(2)}</td></tr><tr class="win"><td>Adapted EV100</td><td>${ev.toFixed(2)}</td></tr><tr><td>Pixels above clip</td><td>${(clipped * 100).toFixed(0)}%</td></tr>`;
      idle = Math.abs(target - ev) < 0.005 && !swing ? idle + dt : 0;
      if (visible && idle < 8.5) requestAnimationFrame(tick); else running = false;
    }
    document.getElementById('ae-swing').addEventListener('click', () => { swing = performance.now(); kick(); });
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }).observe(vc);
    meter(); kick();
  })();

  /* ---------- tonemap curves ---------- */
  (function curves() {
    const cv = document.getElementById('tm'); if (!cv) return;
    const ro = document.getElementById('tm-ro');
    let pick = 'aces', hover = null;
    const keys = ['clip', 'reinhard', 'aces', 'hable'];
    const colors = () => ({ clip: col('muted'), reinhard: col('ax-z'), aces: col('accent'), hable: col('ax-y') });
    const f = A.fig(cv, (ctx, W, H) => {
      const ink = col('ink'), muted = col('muted'), line = col('line'), C2 = colors();
      const L = 40, R = W - 14, T = 14, Bt = H - 34;
      const x = s => L + (s + 6) / 12 * (R - L), y = v => Bt - v * (Bt - T);
      ctx.font = '10px "JetBrains Mono", monospace'; ctx.textBaseline = 'middle';
      for (let s = -6; s <= 6; s += 2) { ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(x(s), T); ctx.lineTo(x(s), Bt); ctx.stroke(); ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.fillText((s > 0 ? '+' : '') + s, x(s), Bt + 12); }
      for (let v = 0; v <= 1.001; v += 0.25) { ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(L, y(v)); ctx.lineTo(R, y(v)); ctx.stroke(); ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.fillText(v.toFixed(2), L - 6, y(v)); }
      ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.fillText('stops from middle grey (0.18)', (L + R) / 2, Bt + 26);
      keys.forEach(k => {
        ctx.strokeStyle = C2[k]; ctx.lineWidth = k === pick ? 3 : 1.5; ctx.beginPath();
        for (let i = 0; i <= 240; i++) { const s = -6 + 12 * i / 240, v = TM[k](0.18 * Math.pow(2, s)); i ? ctx.lineTo(x(s), y(v)) : ctx.moveTo(x(s), y(v)); }
        ctx.stroke();
      });
      ctx.lineWidth = 1;
      // legend
      keys.forEach((k, i) => { const lx = L + 10 + i * 96, ly = T + 10; ctx.fillStyle = C2[k]; ctx.fillRect(lx, ly - 2, 14, 4); ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.fillText(TM_NAME[k], lx + 18, ly); });
      if (hover != null) {
        ctx.strokeStyle = ink; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x(hover), T); ctx.lineTo(x(hover), Bt); ctx.stroke(); ctx.setLineDash([]);
        keys.forEach(k => { const v = TM[k](0.18 * Math.pow(2, hover)); ctx.fillStyle = C2[k]; ctx.beginPath(); ctx.arc(x(hover), y(v), 3.5, 0, 7); ctx.fill(); });
      }
    });
    const strip = A.fig(document.getElementById('tm-strip'), (ctx, W, H) => {
      const id = ctx.createImageData(150, 1), o = norm([1.0, 0.45, 0.1]);
      for (let i = 0; i < 150; i++) {
        const v = 0.18 * Math.pow(2, -6 + 12 * (i + 0.5) / 150);
        for (let c = 0; c < 3; c++) id.data[i * 4 + c] = 255 * srgb(TM[pick](o[c] * v)) + 0.5;
        id.data[i * 4 + 3] = 255;
      }
      const o2 = offscreen(150, 1); o2.getContext('2d').putImageData(id, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.drawImage(o2, 0, 0, W, H);
    });
    function table() {
      const stops = [-3, 0, 3, 6];
      ro.innerHTML = '<tr><td>Curve</td>' + stops.map(s => `<td>${s > 0 ? '+' : ''}${s}</td>`).join('') + '</tr>' + keys.map(k => `<tr class="${k === pick ? 'on' : ''}"><td>${TM_NAME[k]}</td>${stops.map(s => `<td>${TM[k](0.18 * Math.pow(2, s)).toFixed(3)}</td>`).join('')}</tr>`).join('');
    }
    A.seg('tm-pick', v => { pick = v; f.draw(); strip.draw(); table(); });
    A.pointer(cv, f.w, f.h, (p, kind) => { hover = kind === 'up' ? hover : clamp((p.x - 40) / (f.w - 54) * 12 - 6, -6, 6); f.draw(); });
    cv.addEventListener('pointerleave', () => { hover = null; f.draw(); });
    table();
  })();

  /* ---------- banding ---------- */
  (function banding() {
    const cv = document.getElementById('band'); if (!cv) return;
    let bits = 6;
    const f = A.fig(cv, (ctx, W, H) => {
      const ink = col('ink'), muted = col('muted');
      const n = Math.pow(2, bits) - 1, top = 0.25;
      const rows = [['Continuous (reference)', x => srgb(x)], [`Linear values stored in ${bits} bits`, x => srgb(Math.round(x * n) / n)], [`sRGB-encoded values stored in ${bits} bits`, x => Math.round(srgb(x) * n) / n]];
      ctx.font = '11px "JetBrains Mono", monospace'; ctx.textBaseline = 'alphabetic';
      rows.forEach(([label, fn], r) => {
        const y = 4 + r * 56; ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.fillText(label, 2, y + 11);
        const id = ctx.createImageData(300, 1);
        for (let i = 0; i < 300; i++) { const v = fn(top * i / 299) * 255 + 0.5; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
        const o = offscreen(300, 1); o.getContext('2d').putImageData(id, 0, 0);
        ctx.imageSmoothingEnabled = false; ctx.drawImage(o, 0, y + 16, W, 32);
      });
    });
    const rb = A.range('band-bits', v => v + ' bit', v => {
      bits = v; f.draw();
      const n = Math.pow(2, v) - 1;
      document.getElementById('band-ro').innerHTML = `<tr><td>Codes in this range, linear</td><td>${Math.floor(0.25 * n) + 1}</td></tr><tr class="win"><td>Codes in this range, sRGB</td><td>${Math.floor(srgb(0.25) * n) + 1}</td></tr><tr><td>Range shown</td><td>0 – 0.25 linear</td></tr>`;
    });
    rb.set(rb.v);
  })();
})();
