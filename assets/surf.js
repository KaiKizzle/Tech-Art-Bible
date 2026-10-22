/* Shared maths and pictures for the Surfaces units (metals, glass, water, reflections).
   Plain functions on window.Surf; every unit page that needs them loads this file before its own script. */
(function () {
  'use strict';
  const PI = Math.PI;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const sat = x => clamp(x, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix3 = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  const smooth = (e0, e1, x) => { const t = sat((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  /* colour: sRGB 0–255 <-> linear 0–1 */
  const s2l = v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const l2s = x => Math.round(sat(x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055) * 255);
  const tm = (c, e = 1) => c.map(x => { x = Math.max(x * e, 0); return x / (1 + x * 0.32); });
  const css = (c, map = false) => `rgb(${(map ? tm(c) : c).map(l2s).join(',')})`;
  const hex = c => '#' + c.map(x => l2s(x).toString(16).padStart(2, '0')).join('');
  const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

  /* Fresnel */
  function dielectric(cosi, n) {           // exact, unpolarised, from outside a medium of index n (relative)
    cosi = sat(cosi); const s2 = 1 - cosi * cosi, t = 1 - s2 / (n * n);
    if (t <= 0) return 1;                  // total internal reflection
    const cost = Math.sqrt(t), rs = (cosi - n * cost) / (cosi + n * cost), rp = (n * cosi - cost) / (n * cosi + cost);
    return 0.5 * (rs * rs + rp * rp);
  }
  function conductor(cos, n, k) {           // exact, unpolarised, from air onto a metal with complex IOR n + ik
    cos = clamp(cos, 1e-4, 1); const c2 = cos * cos, s2 = 1 - c2, t0 = n * n - k * k - s2;
    const a2b2 = Math.sqrt(t0 * t0 + 4 * n * n * k * k), a = Math.sqrt(Math.max(0.5 * (a2b2 + t0), 0));
    const rs = (a2b2 - 2 * a * cos + c2) / (a2b2 + 2 * a * cos + c2);
    const rp = rs * (a2b2 * c2 - 2 * a * cos * s2 + s2 * s2) / (a2b2 * c2 + 2 * a * cos * s2 + s2 * s2);
    return 0.5 * (rs + rp);
  }
  const f0FromIor = n => Math.pow((n - 1) / (n + 1), 2);
  const iorFromF0 = f => (1 + Math.sqrt(f)) / (1 - Math.sqrt(f));
  const f0Conductor = (n, k) => ((n - 1) * (n - 1) + k * k) / ((n + 1) * (n + 1) + k * k);
  const schlick = (f0, mu) => f0 + (1 - f0) * Math.pow(1 - sat(mu), 5);
  /* OpenPBR's F82-tint model (Kutz et al. 2021 after Hoffman 2019): Schlick, pulled down near 82° so that F(82°) = tint · Schlick(82°) */
  const MU82 = 1 / 7;
  function f82(f0, tint, mu) {
    mu = sat(mu); const sb = schlick(f0, MU82), denom = MU82 * Math.pow(1 - MU82, 6);
    return Math.max(0, schlick(f0, mu) - mu * Math.pow(1 - mu, 6) * (1 - tint) * sb / denom);
  }
  /* Gulbrandsen 2014, artist-friendly metallic Fresnel: reflectivity r and edge tint g to n, k */
  function gulbrandsen(r, g) {
    r = clamp(r, 0, 0.9999); const sr = Math.sqrt(r);
    const n = g * (1 - r) / (1 + r) + (1 - g) * (1 + sr) / (1 - sr);
    const k = Math.sqrt(Math.max(0, (r * (n + 1) * (n + 1) - (n - 1) * (n - 1)) / (1 - r)));
    return [n, k];
  }
  /* refraction, Snell; returns null on total internal reflection. i points towards the surface, nrm against it */
  function refract(i, nrm, eta) {
    const c = -dot(nrm, i), k = 1 - eta * eta * (1 - c * c);
    if (k < 0) return null;
    const t = eta * c - Math.sqrt(k); return norm([eta * i[0] + t * nrm[0], eta * i[1] + t * nrm[1], eta * i[2] + t * nrm[2]]);
  }

  /* GGX */
  function ggxD(nh, a) { const a2 = a * a, d = nh * nh * (a2 - 1) + 1; return a2 / (PI * d * d); }
  function smithG(nl, nv, a) { const a2 = a * a, gl = nv * Math.sqrt(nl * nl * (1 - a2) + a2), gv = nl * Math.sqrt(nv * nv * (1 - a2) + a2); return 0.5 / (gl + gv + 1e-6) * 4 * nl * nv; }
  /* Karis' analytic fit of the split-sum environment BRDF: returns [A, B] with spec = F0·A + B */
  function envBRDF(nv, rough) {
    const c0 = [-1, -0.0275, -0.572, 0.022], c1 = [1, 0.0425, 1.04, -0.04];
    const r = c0.map((c, i) => rough * c + c1[i]);
    const a004 = Math.min(r[0] * r[0], Math.pow(2, -9.28 * nv)) * r[0] + r[1];
    return [-1.04 * a004 + r[2], 1.04 * a004 + r[3]];
  }

  /* a procedural environment: sky, horizon glow, a checker floor, a sun and a soft box. Rougher = blurrier. */
  const SUN = norm([-0.55, 0.62, 0.55]), BOX = norm([0.62, 0.42, 0.66]);
  function env(r, rough = 0, opt = {}) {
    rough = sat(rough); const y = r[1], w = 0.015 + rough * 0.55;
    const zen = opt.zenith || [0.2, 0.36, 0.7], hor = opt.horizon || [1.0, 0.97, 0.92];
    const sky = mix3(hor, zen, Math.pow(sat(y), 0.6 + rough * 0.4));
    let gnd;
    if (opt.floor === false) gnd = [0.09, 0.08, 0.07];
    else { const yy = Math.min(y, -0.02), px = r[0] / -yy, pz = r[2] / -yy;
      const ch = ((Math.floor(px * 1.6) + Math.floor(pz * 1.6)) & 1) ? 0.13 : 0.03, fade = sat(rough * 2.6 + sat(Math.hypot(px, pz) / 14));
      const g = lerp(ch, 0.08, fade); gnd = [g * 1.05, g, g * 0.92]; }
    const t = smooth(-w, w, y);
    let c = mix3(gnd, sky, t);
    const e = 6 + 1800 * Math.pow(1 - rough, 4), amp = (opt.lights === false ? 0 : 1) * (2.6 - 2.1 * rough);
    const b = Math.pow(sat(dot(r, BOX)), e) * amp * 1.6, s = Math.pow(sat(dot(r, opt.sun || SUN)), e * 3) * amp * 6;
    return c.map(x => x + b + s);
  }
  function irradiance(n) { const t = n[1] * 0.5 + 0.5; return mix3([0.1, 0.09, 0.08], [0.55, 0.62, 0.75], t).map(x => x * 0.9); }

  /* shade one normal of a sphere seen straight on. m = { base:[3] linear, metal, rough, f0 (dielectric), tint:[3] (metal edge colour),
     coat (0–1), coatRough, light (key light intensity), env (0–1), envOpt } */
  function shade(n, m) {
    const v = [0, 0, 1], L = m.L || SUN, nv = Math.max(n[2], 1e-3), nl = Math.max(dot(n, L), 0);
    const h = norm([L[0] + v[0], L[1] + v[1], L[2] + v[2]]), nh = Math.max(dot(n, h), 0), vh = Math.max(dot(v, h), 0);
    const rough = clamp(m.rough != null ? m.rough : 0.3, 0.02, 1), a = rough * rough, metal = m.metal || 0;
    const base = m.base || [0.8, 0.8, 0.8], fd = m.f0 != null ? m.f0 : 0.04, tint = m.tint || [1, 1, 1];
    const F0 = base.map(b => lerp(fd, b, metal));
    const Fk = F0.map((f, i) => metal > 0 ? lerp(schlick(fd, vh), f82(f, tint[i], vh), metal) : schlick(f, vh));
    const D = ggxD(nh, a), G = smithG(nl, nv, a), I = m.light != null ? m.light : 2.6;
    const R = [2 * n[2] * n[0], 2 * n[2] * n[1], 2 * n[2] * n[2] - 1], E = env(R, rough, m.envOpt), AB = envBRDF(nv, rough), ke = m.env != null ? m.env : 1;
    const irr = irradiance(n);
    let out = base.map((b, i) => {
      const spec = D * G * Fk[i] / (4 * nl * nv + 1e-4) * nl * I;
      const tintB = metal > 0 ? lerp(1, tint[i], metal * 0.85) : 1;
      const specE = E[i] * (F0[i] * AB[0] + AB[1] * tintB) * ke;
      const kd = (1 - metal) * (1 - fd);
      return kd * b * (nl * I / PI + irr[i] * 0.55) + spec + specE;
    });
    if (m.coat) {
      const fc = schlick(0.04, nv) * m.coat, cr = clamp(m.coatRough || 0.03, 0.02, 1), Ec = env(R, cr, m.envOpt), ca = cr * cr;
      const cs = ggxD(nh, ca) * smithG(nl, nv, ca) * schlick(0.04, vh) * m.coat / (4 * nl * nv + 1e-4) * nl * I;
      out = out.map((x, i) => x * (1 - fc) * (1 - fc * 0.3) + Ec[i] * fc + cs);
    }
    return out;
  }
  function sphere(ctx, cx, cy, R, f, step = 2, exposure = 1) {
    for (let y = -R; y <= R; y += step) for (let x = -R; x <= R; x += step) {
      const q = x * x + y * y; if (q > R * R) continue;
      const n = [x / R, -y / R, Math.sqrt(Math.max(0, 1 - q / (R * R)))];
      ctx.fillStyle = css(tm(f(n, x, y), exposure)); ctx.fillRect(cx + x, cy + y, step, step);
    }
  }
  /* background for sphere pictures: the same environment seen straight behind */
  function backdrop(ctx, W, H, opt) {
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
      const d = norm([(x - W / 2) / H * 0.9, -(y - H * 0.55) / H * 0.9, -1]);
      ctx.fillStyle = css(tm(env([d[0], d[1], -d[2]], 0.65, Object.assign({ lights: false }, opt)).map(c => c * 0.3))); ctx.fillRect(x, y, 4, 4);
    }
  }

  /* metal reference colours, sRGB 0–255: F0 and F82 edge tint (Adobe Standard Material specification) */
  const METALS = [
    ['Silver', 'Ag', [254, 253, 251], [254, 255, 255]], ['Aluminium', 'Al', [245, 246, 246], [245, 248, 250]],
    ['Gold', 'Au', [255, 219, 152], [248, 251, 245]], ['Chromium', 'Cr', [196, 197, 196], [223, 225, 233]],
    ['Copper', 'Cu', [255, 211, 192], [252, 248, 247]], ['Iron', 'Fe', [243, 241, 233], [238, 241, 243]],
    ['Mercury', 'Hg', [229, 228, 228], [232, 238, 244]], ['Magnesium', 'Mg', [242, 241, 243], [243, 245, 249]],
    ['Nickel', 'Ni', [218, 209, 197], [233, 236, 240]], ['Palladium', 'Pd', [223, 218, 212], [232, 236, 240]],
    ['Platinum', 'Pt', [250, 247, 234], [249, 249, 248]], ['Titanium', 'Ti', [178, 169, 162], [239, 244, 249]],
    ['Zinc', 'Zn', [241, 240, 238], [241, 244, 247]]
  ];

  window.Surf = { PI, clamp, sat, lerp, mix3, smooth, norm, dot, s2l, l2s, tm, css, hex, lum,
    dielectric, conductor, f0FromIor, iorFromF0, f0Conductor, schlick, f82, MU82, gulbrandsen, refract,
    ggxD, smithG, envBRDF, env, irradiance, shade, sphere, backdrop, SUN, METALS };
})();
