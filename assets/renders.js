/* Tech Art Atlas — key art renderer.
   One small WebGL context renders studio shots of each unit's own technique, then copies them into 2D canvases.
   Usage: <canvas data-render="exposure"></canvas> anywhere, then AtlasRender.drawAll() (or AtlasRender.draw(canvas, name)).
   The image is sized from the canvas' CSS box × devicePixelRatio. Without WebGL a flat backdrop is drawn instead.
   Add a scene: add a GLSL function body to SCENES with a `vec3 render(vec2 frag)` and register its name. */
(function () {
  'use strict';

  const PRELUDE = `
precision highp float;
uniform vec2 uRes;
uniform float uAA;
const float PI = 3.14159265;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float noise3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash13(i), hash13(i+vec3(1,0,0)), f.x), mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), f.x), mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = .5, s = 0.0; for (int i = 0; i < 6; i++){ s += a*noise3(p); p = p*2.03 + 1.7; a *= .5; } return s; }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0.0, 1.0); }
vec3 srgb(vec3 c){ return mix(12.92*c, 1.055*pow(c, vec3(1.0/2.4)) - .055, step(.0031308, c)); }
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
mat3 lookAt(vec3 ro, vec3 ta){ vec3 f = normalize(ta-ro); vec3 r = normalize(cross(f, vec3(0,1,0))); vec3 u = cross(r, f); return mat3(r, u, f); }
vec2 sphIntersect(vec3 ro, vec3 rd, vec4 s){ vec3 oc = ro - s.xyz; float b = dot(oc, rd); float c = dot(oc, oc) - s.w*s.w; float h = b*b - c; if (h < 0.0) return vec2(-1.0); h = sqrt(h); return vec2(-b-h, -b+h); }
float sphSoftShadow(vec3 ro, vec3 rd, vec4 s, float k){ vec3 oc = ro - s.xyz; float b = dot(oc, rd); float c = dot(oc, oc) - s.w*s.w; float h = b*b - c;
  float d = sqrt(max(0.0, s.w*s.w - h)) - s.w; float t = -b - sqrt(max(h, 0.0)); return (t < 0.0) ? 1.0 : smoothstep(0.0, 1.0, 2.5*k*d/t); }
float sphOcc(vec3 p, vec3 n, vec4 s){ vec3 d = s.xyz - p; float l = length(d); return clamp(max(0.0, dot(n, d/l)) * (s.w*s.w)/(l*l), 0.0, 1.0); }
// slab test against an axis-aligned box centred at the origin; returns t and writes the face normal
float boxIntersect(vec3 ro, vec3 rd, vec3 h, out vec3 n){ vec3 m = 1.0/rd; vec3 k = abs(m)*h; vec3 t1 = -m*ro - k; vec3 t2 = -m*ro + k;
  float tN = max(max(t1.x, t1.y), t1.z); float tF = min(min(t2.x, t2.y), t2.z); if (tN > tF || tF < 0.0) return -1.0;
  n = -sign(rd) * step(t1.yzx, t1.xyz) * step(t1.zxy, t1.xyz); return tN; }
float uvk(){ return min(uRes.y, uRes.x/1.3); }
vec2 screenUV(vec2 frag){ return (2.0*frag - uRes)/uvk(); }
vec3 studio(vec3 rd){ float t = clamp(rd.y*.6 + .45, 0.0, 1.0); return mix(vec3(.004,.0045,.0055), vec3(.03,.032,.037), t); }
vec3 render(vec2 frag);
void main(){
  vec3 col = vec3(0.0); float n = 0.0;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++){
    if (uAA < 1.5 && (i + j) > 0) continue;
    vec2 o = (vec2(float(i), float(j)) + .5)/2.0 - .5;
    col += render(gl_FragCoord.xy + o); n += 1.0;
  }
  col /= n;
  vec2 q = gl_FragCoord.xy/uRes; col *= .55 + .45*pow(16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), .18); // lens vignette
  col = srgb(aces(col));
  col += (hash12(gl_FragCoord.xy) - .5)/255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

  const SCENES = {
    /* Lookdev set: chrome ball, 18% grey ball and a colour checker under sun and sky. Exposure and tonemapping. */
    exposure: `
vec3 SUN = normalize(vec3(-.55, .78, .45));
vec4 S1 = vec4(-1.15, .5, .1, .5);   // chrome
vec4 S2 = vec4(-.05, .5, -.15, .5);  // grey 18%
const float ANG = -.42;
vec3 PLATE = vec3(1.25, .56, .05);
vec3 macbeth(int i){
  if(i==0)return vec3(115,82,68); if(i==1)return vec3(194,150,130); if(i==2)return vec3(98,122,157); if(i==3)return vec3(87,108,67);
  if(i==4)return vec3(133,128,177); if(i==5)return vec3(103,189,170); if(i==6)return vec3(214,126,44); if(i==7)return vec3(80,91,166);
  if(i==8)return vec3(193,90,99); if(i==9)return vec3(94,60,108); if(i==10)return vec3(157,188,64); if(i==11)return vec3(224,163,46);
  if(i==12)return vec3(56,61,150); if(i==13)return vec3(70,148,73); if(i==14)return vec3(175,54,60); if(i==15)return vec3(231,199,31);
  if(i==16)return vec3(187,86,149); if(i==17)return vec3(8,133,161); if(i==18)return vec3(243,243,242); if(i==19)return vec3(200,200,200);
  if(i==20)return vec3(160,160,160); if(i==21)return vec3(122,122,121); if(i==22)return vec3(85,85,85); return vec3(52,52,52); }
mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c,0,-s, 0,1,0, s,0,c); }
// returns t, id (1 chrome, 2 grey, 3 plate, 4 floor), normal, local plate coords
float trace(vec3 ro, vec3 rd, out float id, out vec3 nor, out vec3 lp){
  float t = 1e9; id = 0.0;
  vec2 a = sphIntersect(ro, rd, S1); if (a.x > 0.0 && a.x < t){ t = a.x; id = 1.0; nor = normalize(ro + rd*t - S1.xyz); }
  vec2 b = sphIntersect(ro, rd, S2); if (b.x > 0.0 && b.x < t){ t = b.x; id = 2.0; nor = normalize(ro + rd*t - S2.xyz); }
  mat3 R = rotY(ANG); vec3 lro = (ro - PLATE)*R; vec3 lrd = rd*R; vec3 ln;
  float tb = boxIntersect(lro, lrd, vec3(.52, .36, .025), ln);
  if (tb > 0.0 && tb < t){ t = tb; id = 3.0; nor = R*ln; lp = lro + lrd*tb; }
  if (rd.y < 0.0){ float tp = -ro.y/rd.y; if (tp < t){ t = tp; id = 4.0; nor = vec3(0,1,0); } }
  return id > 0.0 ? t : -1.0;
}
float shadow(vec3 p, vec3 l){
  float s = min(sphSoftShadow(p, l, S1, 3.0), sphSoftShadow(p, l, S2, 3.0));
  mat3 R = rotY(ANG); vec3 n; float tb = boxIntersect((p + l*.002 - PLATE)*R, l*R, vec3(.52, .36, .025), n);
  return tb > 0.0 ? 0.0 : s;
}
vec3 sky(vec3 rd){ return mix(vec3(.55,.62,.72)*.6, vec3(.18,.32,.62)*.9, clamp(rd.y, 0.0, 1.0)) + vec3(60.0,55.0,48.0)*pow(max(dot(rd, SUN), 0.0), 2000.0); }
vec3 shadeDiffuse(vec3 p, vec3 n, vec3 alb){
  float sh = shadow(p + n*.002, SUN);
  float occ = 1.0 - .8*max(sphOcc(p, n, S1), sphOcc(p, n, S2));
  vec3 c = alb * vec3(2.1,1.95,1.75) * max(dot(n, SUN), 0.0) * sh;
  c += alb * mix(vec3(.10,.10,.11), vec3(.22,.30,.45), n.y*.5+.5) * occ;
  return c;
}
vec3 shade(vec3 ro, vec3 rd, float id, vec3 n, vec3 lp, float t){
  vec3 p = ro + rd*t;
  if (id == 2.0) return shadeDiffuse(p, n, vec3(.18));
  if (id == 3.0){
    vec2 uv = vec2(lp.x/.52, lp.y/.36)*.5 + .5;
    vec3 alb = vec3(.025);
    if (lp.z > .02){ vec2 g = uv*vec2(6.0, 4.0); vec2 c = floor(g); vec2 f = fract(g);
      if (f.x > .1 && f.x < .9 && f.y > .1 && f.y < .9){ int i = int((3.0 - c.y)*6.0 + c.x); alb = lin(macbeth(i)/255.0); } }
    return shadeDiffuse(p, n, alb) + .04*sky(reflect(rd, n))*shadow(p + n*.002, reflect(rd, n));
  }
  if (id == 4.0){
    vec3 c = shadeDiffuse(p, n, vec3(.035));
    return mix(c, studio(rd), smoothstep(2.2, 6.5, length(p.xz)));
  }
  return studio(rd);
}
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag);
  vec3 ro = vec3(.15, 1.15, 4.4); mat3 cam = lookAt(ro, vec3(.05, .48, 0.0));
  vec3 rd = cam*normalize(vec3(uv, 3.0));
  float id; vec3 n, lp; float t = trace(ro, rd, id, n, lp);
  if (t < 0.0) return studio(rd);
  if (id == 1.0){ // chrome: one reflection bounce
    vec3 p = ro + rd*t, r = reflect(rd, n); float id2; vec3 n2, lp2;
    float t2 = trace(p + n*.002, r, id2, n2, lp2);
    vec3 refl = t2 < 0.0 ? sky(r)*.35 + studio(r) : shade(p + n*.002, r, id2, n2, lp2, t2);
    float fre = .65 + .35*pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
    return refl*fre;
  }
  return shade(ro, rd, id, n, lp, t);
}`,

    /* A planet with an atmosphere and a cloud shell, seen from orbit. Ray-sphere intersection. */
    'ray-sphere': `
vec3 SUN = normalize(vec3(-.9, .35, .55));
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag);
  vec3 ro = vec3(0.0, .32, 3.05); mat3 cam = lookAt(ro, vec3(.55, -.25, 0.0));
  vec3 rd = cam*normalize(vec3(uv, 2.2));
  // stars
  vec3 col = vec3(0.0);
  vec3 sd = floor(rd*380.0); float st = hash13(sd); col += vec3(.9,.95,1.0)*step(.9975, st)*hash13(sd+3.1)*2.0;
  vec4 P = vec4(0,0,0,1.0); vec4 ATM = vec4(0,0,0,1.07);
  vec2 hp = sphIntersect(ro, rd, P), ha = sphIntersect(ro, rd, ATM);
  if (hp.x > 0.0){
    vec3 p = ro + rd*hp.x, n = normalize(p);
    float land = smoothstep(.53, .56, fbm(n*2.2 + vec3(4.0)));
    vec3 alb = mix(vec3(.010,.028,.07), mix(vec3(.10,.085,.05), vec3(.05,.09,.035), smoothstep(.3,.7,fbm(n*6.0))), land);
    float cl = smoothstep(.52, .78, fbm(n*3.6 + vec3(1.3, 0.0, 2.1)) + .15*fbm(n*14.0));
    float ndl = dot(n, SUN), day = smoothstep(-.08, .25, ndl);
    float cloudShadow = 1.0 - .55*smoothstep(.52, .78, fbm((n - SUN*.012)*3.6 + vec3(1.3,0.0,2.1)));
    vec3 c = alb * 2.0 * max(ndl, 0.0) * cloudShadow;
    float spec = pow(max(dot(reflect(-SUN, n), -rd), 0.0), 60.0) * (1.0 - land) * (1.0 - cl);
    c += vec3(2.2, 2.0, 1.7) * spec * day;
    c = mix(c, vec3(.9) * 1.25 * max(ndl, 0.0) + vec3(.004,.006,.01), cl);
    // city lights on the night side
    float city = step(.9, hash13(floor(n*220.0))) * land * (1.0 - cl) * (1.0 - smoothstep(-.25, .0, ndl));
    c += vec3(1.0, .62, .25) * city * .35;
    col = c;
  }
  if (ha.y > 0.0){
    float t0 = max(ha.x, 0.0), t1 = hp.x > 0.0 ? hp.x : ha.y;
    float len = max(t1 - t0, 0.0);
    vec3 m = normalize(ro + rd*(t0 + t1)*.5);
    float lit = smoothstep(-.35, .35, dot(m, SUN));
    float mu = dot(rd, SUN);
    vec3 ray = vec3(.18, .42, 1.0) * (1.0 + mu*mu);
    vec3 sunset = vec3(1.0, .45, .15) * smoothstep(.0, .3, 1.0 - abs(dot(m, SUN)+.05)*3.0);
    vec3 scat = (ray*.9 + sunset*.35) * (1.0 - exp(-len*5.5)) * lit;
    col = col*exp(-len*1.2) + scat*.42;
  }
  return col;
}`,

    /* A facade block with interior-mapped windows at dusk. Interior mapping. */
    'interior-mapping': `
const float ANG = .62;
vec3 HALF = vec3(1.05, 1.32, .52);
vec3 CEN = vec3(0.0, 1.32, 0.0);
vec3 MOON = normalize(vec3(-.6, .55, .7));
mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c,0,-s, 0,1,0, s,0,c); }
vec3 skyc(vec3 rd){ return mix(vec3(.02,.025,.04), vec3(.05,.07,.13), clamp(rd.y*.8+.3, 0.0, 1.0)); }
// interior: o = point on glass in room-cell units, d = direction (x across, y up, z into the building)
vec3 room(vec3 o, vec3 d, vec2 cell){
  float h = hash12(cell*7.13 + 1.7);
  vec3 k = (step(0.0, d) - o) / d;               // distance to each wall pair
  float t = min(min(k.x, k.y), k.z); vec3 p = o + d*t;
  vec3 warm = mix(vec3(1.0,.62,.30), vec3(1.0,.80,.55), hash12(cell+3.3));
  vec3 lightc = h < .18 ? vec3(.0) : (h < .3 ? vec3(.35,.55,1.0)*.6 : warm);
  float lamp = 1.0/(1.0 + 7.0*dot(p.xz - vec2(.5, .55), p.xz - vec2(.5, .55)));
  vec3 c;
  if (t == k.z) c = vec3(.55,.50,.44) * (.35 + .65*smoothstep(1.0, .0, length(p.xy - vec2(.5, .82))));      // back wall
  else if (t == k.y) c = d.y < 0.0 ? vec3(.32,.20,.12) * lamp : vec3(.75,.72,.68) * (.5 + 1.5*lamp);       // floor / ceiling
  else c = vec3(.48,.44,.40) * (.3 + .7*(1.0 - p.z)) * (.6 + .4*p.y);                                     // side walls
  // a lit painting or shelf block on the back wall in some rooms
  if (t == k.z && hash12(cell+9.0) > .55 && abs(p.x - .3) < .12 && abs(p.y - .45) < .1) c = vec3(.12,.16,.2);
  return c * lightc * 2.6 + vec3(.004);
}
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag);
  vec3 ro = vec3(.3, 1.55, 5.6); mat3 cam = lookAt(ro, vec3(-.05, 1.12, 0.0));
  vec3 rd = cam*normalize(vec3(uv, 2.5));
  mat3 R = rotY(ANG); vec3 lro = (ro - CEN)*R, lrd = rd*R; vec3 ln;
  float tb = boxIntersect(lro, lrd, HALF, ln);
  float tp = rd.y < 0.0 ? -ro.y/rd.y : 1e9;
  if (tb > 0.0 && tb < tp){
    vec3 lp = lro + lrd*tb;
    vec3 n = R*ln;
    vec3 base = vec3(.26,.245,.23) * (.85 + .3*fbm(lp*9.0));
    vec3 c = base * (vec3(.10,.14,.24)*(.6 + .4*n.y) + vec3(.35,.40,.55)*max(dot(n, MOON), 0.0));
    vec2 f; vec3 d; bool face = false;
    if (ln.z > .5){ f = vec2(lp.x + HALF.x, lp.y + HALF.y); d = vec3(lrd.x, lrd.y, -lrd.z); face = true; }
    else if (ln.x > .5){ f = vec2(HALF.z - lp.z, lp.y + HALF.y); d = vec3(-lrd.z, lrd.y, -lrd.x); face = true; }
    else if (ln.x < -.5){ f = vec2(lp.z + HALF.z, lp.y + HALF.y); d = vec3(lrd.z, lrd.y, lrd.x); face = true; }
    if (face && f.y > .2){
      vec2 csz = vec2(.42, .4); vec2 g = (f - vec2(.0, .2))/csz; vec2 cell = floor(g); vec2 q = fract(g);
      float frame = step(.14, q.x)*step(q.x, .86)*step(.18, q.y)*step(q.y, .86);
      // sill light under each window
      c += base * vec3(1.0,.7,.4) * .25 * smoothstep(.18, .0, abs(q.y - .14)) * step(.14, q.x)*step(q.x, .86) * step(.3, hash12(cell*7.13+1.7));
      if (frame > .5 && cell.y < 6.0 && f.y < 2.6){
        vec2 qi = (q - vec2(.14, .18))/vec2(.72, .68);
        vec3 o = vec3(qi, 0.0);
        vec3 dd = normalize(d) / vec3(csz*vec2(.72,.68), .45);
        vec3 inside = room(o, dd, cell + (abs(ln.x) > .5 ? vec2(37.0)*sign(ln.x) : vec2(0.0)));
        float fre = .04 + .96*pow(1.0 - abs(dot(normalize(d), vec3(0,0,1))), 5.0);
        vec3 refl = skyc(reflect(rd, n)) * 1.4;
        float mull = smoothstep(.012, .0, abs(qi.x - .5)) + smoothstep(.015, .0, abs(qi.y - .62));
        c = mix(inside*(1.0 - fre) + refl*fre, vec3(.03), clamp(mull, 0.0, 1.0));
      }
    }
    return c;
  }
  if (tp < 1e8){
    vec3 p = ro + rd*tp;
    vec3 lp = (p - CEN)*R; vec2 dd = abs(lp.xz) - HALF.xz; float sd = length(max(dd, 0.0)) + min(max(dd.x, dd.y), 0.0);
    float ao = .35 + .65*smoothstep(0.0, .8, sd);
    vec3 n; float sh = boxIntersect((p + MOON*.002 - CEN)*R, MOON*R, HALF, n) > 0.0 ? 0.2 : 1.0;
    vec3 c = vec3(.08) * (vec3(.10,.13,.22)*ao + vec3(.35,.40,.55)*max(MOON.y, 0.0)*sh);
    // warm spill on the ground in front of the lit facade
    c += vec3(.06,.035,.015) * smoothstep(1.2, 0.0, sd) * ao;
    return mix(c, skyc(rd)*.5, smoothstep(3.5, 10.0, length(p.xz)));
  }
  return skyc(rd)*.5;
}`,

    /* A material ball with a tiled stone material; the right half shows the mip level each pixel samples. */
    'texture-memory': `
vec3 KEY = normalize(vec3(-.7, .65, .55));
vec4 B = vec4(0.0, .92, 0.0, .9);
vec3 mipc(float l){ l = clamp(l, 0.0, 7.0);
  vec3 a = vec3(.18,.44,.84), b = vec3(.16,.65,.72), c = vec3(.24,.6,.29), d = vec3(.6,.75,.23), e = vec3(.88,.71,.18), f = vec3(.9,.49,.17), g = vec3(.84,.27,.23), h = vec3(.64,.25,.56);
  if (l < 1.0) return mix(a, b, l); if (l < 2.0) return mix(b, c, l-1.0); if (l < 3.0) return mix(c, d, l-2.0); if (l < 4.0) return mix(d, e, l-3.0);
  if (l < 5.0) return mix(e, f, l-4.0); if (l < 6.0) return mix(f, g, l-5.0); return mix(g, h, l-6.0); }
vec2 sphUV(vec3 n){ return vec2(atan(n.z, n.x)/(2.0*PI) + .5, acos(clamp(n.y, -1.0, 1.0))/PI); }
float tileH(vec2 uv, out vec2 id){
  vec2 g = uv*vec2(18.0, 9.0); g.x += step(1.0, mod(floor(g.y), 2.0))*.5; id = floor(g); vec2 f = fract(g);
  vec2 e = min(f, 1.0 - f); float m = min(e.x*1.6, e.y);
  return smoothstep(.0, .09, m) * (.85 + .15*hash12(id));
}
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag);
  vec3 ro = vec3(0.0, 1.35, 4.2); mat3 cam = lookAt(ro, vec3(0.0, .82, 0.0));
  vec3 rd = cam*normalize(vec3(uv, 2.8));
  vec2 h = sphIntersect(ro, rd, B);
  float tp = rd.y < 0.0 ? -ro.y/rd.y : 1e9;
  float split = uv.x - .06*uv.y;
  if (h.x > 0.0 && h.x < tp){
    vec3 p = ro + rd*h.x, n = normalize(p - B.xyz);
    vec2 tuv = sphUV(n), id;
    float hh = tileH(tuv, id);
    // bump from finite differences of the height in texture space
    vec2 e = vec2(.0007, 0.0), i2;
    float hx = tileH(tuv + e.xy, i2), hy = tileH(tuv + e.yx, i2);
    vec3 T = normalize(vec3(-n.z, 0.0, n.x)), Bt = normalize(cross(n, T));
    vec3 nb = normalize(n - (T*(hx - hh) + Bt*(hy - hh))*1.6);
    vec3 alb = mix(vec3(.16,.15,.14), vec3(.42,.31,.21)*(.65 + .55*hash12(id*1.3)) * (.8 + .4*fbm(vec3(tuv*60.0, 1.0))), smoothstep(.2, .8, hh));
    float rough = mix(.85, .45 + .3*hash12(id), smoothstep(.2, .8, hh));
    float ndl = max(dot(nb, KEY), 0.0);
    vec3 hv = normalize(KEY - rd); float spec = pow(max(dot(nb, hv), 0.0), mix(8.0, 90.0, 1.0 - rough)) * (1.0 - rough) * .9;
    vec3 c = alb * vec3(2.2,2.1,1.9) * ndl + vec3(2.0)*spec*ndl;
    c += alb * mix(vec3(.04,.04,.045), vec3(.16,.19,.25), nb.y*.5 + .5);
    c += vec3(.9,.95,1.0) * .6 * pow(1.0 - max(dot(-rd, n), 0.0), 4.0) * smoothstep(-.2, .6, dot(n, normalize(vec3(.8, .3, -.6))));
    if (split > .02){
      // mip level from the texel footprint of one screen pixel (one 2048² texture tiled 3 × 2 over the ball)
      vec3 rdx = cam*normalize(vec3(uv + vec2(2.0/uvk(), 0.0), 2.8)), rdy = cam*normalize(vec3(uv + vec2(0.0, 2.0/uvk()), 2.8));
      vec2 hx2 = sphIntersect(ro, rdx, B), hy2 = sphIntersect(ro, rdy, B);
      vec2 u0 = tuv, ux = hx2.x > 0.0 ? sphUV(normalize(ro + rdx*hx2.x - B.xyz)) : u0, uy = hy2.x > 0.0 ? sphUV(normalize(ro + rdy*hy2.x - B.xyz)) : u0;
      vec2 dx = ux - u0, dy = uy - u0; dx.x -= floor(dx.x + .5); dy.x -= floor(dy.x + .5);
      float rho = max(length(dx*vec2(3.0, 2.0)*2048.0), length(dy*vec2(3.0, 2.0)*2048.0)) * (uvk()/1080.0);
      float l = log2(max(rho, 1e-4));
      float lum = dot(c, vec3(.2126, .7152, .0722));
      c = lin(mipc(floor(l)))*(.12 + 1.1*sqrt(lum)) * (.8 + .2*smoothstep(.2, .8, hh));
    }
    if (abs(split - .02) < 3.2/uvk()) c = vec3(2.0);
    return c;
  }
  if (tp < 1e8){
    vec3 p = ro + rd*tp; vec3 n = vec3(0,1,0);
    float sh = sphSoftShadow(p, KEY, B, 4.0), occ = 1.0 - .9*sphOcc(p, n, B);
    vec3 c = vec3(.03) * (vec3(2.2,2.1,1.9)*KEY.y*sh + vec3(.12,.14,.18)*occ);
    return mix(c, studio(rd), smoothstep(2.0, 6.0, length(p.xz)));
  }
  return studio(rd);
}`,

    /* A block of instanced towers, lit on the left; the right shows how many raymarch steps each pixel cost. */
    'reading-a-frame': `
vec3 KEY = normalize(vec3(-.6, .75, .45));
float cellH(vec2 id){ float r = length(id); return (.18 + 1.1*pow(hash12(id*1.37 + 4.1), 2.0)) * smoothstep(7.5, 2.0, r); }
float map(vec3 p){
  float d = p.y;
  vec2 sp = vec2(.5);
  vec2 id = floor(p.xz/sp + .5); id = clamp(id, vec2(-7.0), vec2(7.0));
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 c = id + vec2(float(i), float(j));
    float h = cellH(c); if (h < .05) continue;
    vec3 q = p - vec3(c.x*sp.x, h, c.y*sp.y);
    vec3 b = abs(q) - vec3(.17, h, .17);
    d = min(d, length(max(b, 0.0)) + min(max(b.x, max(b.y, b.z)), 0.0) - .006);
  }
  return d;
}
vec3 normalAt(vec3 p){ vec2 e = vec2(.0015, 0.0); return normalize(vec3(map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx))); }
float softShadow(vec3 ro, vec3 rd){ float res = 1.0, t = .02; for (int i = 0; i < 48; i++){ float h = map(ro + rd*t); res = min(res, 10.0*h/t); t += clamp(h, .02, .3); if (res < .002 || t > 6.0) break; } return clamp(res, 0.0, 1.0); }
float ao(vec3 p, vec3 n){ float o = 0.0, s = 1.0; for (int i = 1; i <= 5; i++){ float h = .04*float(i); o += (h - map(p + n*h))*s; s *= .7; } return clamp(1.0 - 3.0*o, 0.0, 1.0); }
vec3 heat(float x){ x = clamp(x, 0.0, 1.0); return x < .5 ? mix(vec3(.05,.45,.12), vec3(.95,.8,.1), x*2.0) : mix(vec3(.95,.8,.1), vec3(.95,.12,.08), x*2.0 - 1.0); }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag);
  vec3 ro = vec3(4.6, 3.3, 5.6); mat3 cam = lookAt(ro, vec3(-.1, .3, 0.0));
  vec3 rd = cam*normalize(vec3(uv, 2.6));
  float t = .5, steps = 0.0; bool hit = false;
  for (int i = 0; i < 160; i++){ vec3 p = ro + rd*t; float d = map(p); steps += 1.0; if (d < .0007*t){ hit = true; break; } t += d*.85; if (t > 30.0) break; }
  float split = uv.x + .35*uv.y;
  if (split > .08) {
    vec3 c = lin(heat(steps/90.0));
    if (!hit) return mix(studio(rd), c*.25, .5);
    vec3 pn = ro + rd*t; float sha = .55 + .45*max(dot(normalAt(pn), KEY), 0.0);
    return c * sha * (pn.y < .02 ? .35 : 1.0);
  }
  if (abs(split - .08) < 3.2/uvk()) return vec3(2.0);
  if (!hit) return studio(rd);
  vec3 p = ro + rd*t, n = normalAt(p);
  float sh = softShadow(p + n*.003, KEY), o = ao(p, n);
  vec3 alb = p.y < .02 ? vec3(.03) : vec3(.30,.31,.33)*(.85 + .15*hash12(floor(p.xz/.5 + .5)));
  vec3 c = alb*vec3(2.2,2.1,1.9)*max(dot(n, KEY), 0.0)*sh + alb*mix(vec3(.03,.03,.035), vec3(.14,.17,.23), n.y*.5 + .5)*o;
  return mix(c, studio(rd), smoothstep(4.5, 9.0, length(p.xz)));
}`
  };
  /* ---------- Foundations: small SDF still lifes on the studio floor, sharing one lighting rig ---------- */
  const SDF = `
vec2 map(vec3 p);
vec3 albedo(float id, vec3 p, vec3 n);
vec3 emit(float id, vec3 p, vec3 n);
float sdSphere(vec3 p, float r){ return length(p) - r; }
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0); return length(pa - ba*h) - r; }
float sdCappedCone(vec3 p, vec3 a, vec3 b, float ra, float rb){
  float rba = rb - ra; float baba = dot(b - a, b - a); float papa = dot(p - a, p - a); float paba = dot(p - a, b - a)/baba;
  float x = sqrt(max(papa - paba*paba*baba, 0.0));
  float cax = max(0.0, x - ((paba < 0.5) ? ra : rb)); float cay = abs(paba - 0.5) - 0.5;
  float k = rba*rba + baba; float f = clamp((rba*(x - ra) + paba*baba)/k, 0.0, 1.0);
  float cbx = x - ra - f*rba; float cby = paba - f;
  float s = (cbx < 0.0 && cay < 0.0) ? -1.0 : 1.0;
  return s*sqrt(min(cax*cax + cay*cay*baba, cbx*cbx + cby*cby*baba)); }
float sdArrow(vec3 p, vec3 a, vec3 b, float r){ vec3 d = normalize(b - a); float hl = min(r*7.0, length(b - a)*.4); vec3 m = b - d*hl;
  return min(sdCapsule(p, a, m, r), sdCappedCone(p, m, b, r*2.6, 0.0)); }
float sdBoxFrame(vec3 p, vec3 b, float e){ p = abs(p) - b; vec3 q = abs(p + e) - e;
  return min(min(length(max(vec3(p.x, q.y, q.z), 0.0)) + min(max(p.x, max(q.y, q.z)), 0.0),
                 length(max(vec3(q.x, p.y, q.z), 0.0)) + min(max(q.x, max(p.y, q.z)), 0.0)),
                 length(max(vec3(q.x, q.y, p.z), 0.0)) + min(max(q.x, max(q.y, p.z)), 0.0)); }
mat3 rY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rX(float a){ float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
vec2 U(vec2 a, float d, float id){ return d < a.x ? vec2(d, id) : a; }
#ifndef KEYDIR
#define KEYDIR vec3(-.5, .8, .45)
#endif
vec3 KEY = normalize(KEYDIR);
vec3 calcN(vec3 p){ vec2 e = vec2(.0008, 0.0); return normalize(vec3(map(p + e.xyy).x - map(p - e.xyy).x, map(p + e.yxy).x - map(p - e.yxy).x, map(p + e.yyx).x - map(p - e.yyx).x)); }
vec2 march(vec3 ro, vec3 rd){ float t = .01; for (int i = 0; i < 140; i++){ vec2 h = map(ro + rd*t); if (h.x < .0004*t) return vec2(t, h.y); t += h.x; if (t > 30.0) break; } return vec2(-1.0, 0.0); }
float softSh(vec3 ro, vec3 rd){ float r = 1.0, t = .02; for (int i = 0; i < 40; i++){ float h = map(ro + rd*t).x; r = min(r, 9.0*h/t); t += clamp(h, .02, .35); if (r < .002 || t > 8.0) break; } return clamp(r, 0.0, 1.0); }
float calcAO(vec3 p, vec3 n){ float o = 0.0, s = 1.0; for (int i = 0; i < 5; i++){ float h = .01 + .09*float(i); o += (h - map(p + n*h).x)*s; s *= .7; } return clamp(1.0 - 1.8*o, 0.0, 1.0); }
vec3 shadeHit(vec3 ro, vec3 rd, vec2 h){
  vec3 p = ro + rd*h.x, n = calcN(p), alb = albedo(h.y, p, n);
  float sh = softSh(p + n*.01, KEY), oc = calcAO(p, n);
  vec3 c = alb*vec3(2.3, 2.15, 1.95)*max(dot(n, KEY), 0.0)*sh + alb*mix(vec3(.05, .05, .06), vec3(.17, .2, .26), n.y*.5 + .5)*oc;
  c += vec3(.35)*pow(max(dot(reflect(rd, n), KEY), 0.0), 48.0)*sh*step(.5, h.y);
  c += emit(h.y, p, n);
  if (h.y < .5) c = mix(c, studio(rd), smoothstep(3.2, 8.5, length(p.xz)));
  return c; }
vec3 scene(vec3 ro, vec3 ta, float fl, vec2 frag){ vec2 uv = screenUV(frag); mat3 cam = lookAt(ro, ta); vec3 rd = cam*normalize(vec3(uv, fl));
  vec2 h = march(ro, rd); return h.x < 0.0 ? studio(rd) : shadeHit(ro, rd, h); }
vec3 FLOOR = vec3(.035);
const vec3 ORANGE = vec3(1.0, .45, .07), BLUE = vec3(.08, .38, .85), RED = vec3(.85, .12, .08), GREEN = vec3(.18, .62, .12), ZBLUE = vec3(.12, .25, .9);
`;
  Object.assign(SCENES, {
    /* The screen is a grid: the right half of the image is shown at a coarse pixel size with the grid drawn. */
    'gpu-basics': SDF + `
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  r = U(r, sdSphere(p - vec3(-.2, .8, 0.0), .8), 1.0);
  r = U(r, sdBox((p - vec3(1.35, .38, .55))*rY(.5), vec3(.36)) - .03, 2.0);
  r = U(r, sdSphere(p - vec3(-1.6, .32, .7), .32), 3.0); return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; if (id < 1.5) return ORANGE*.75; if (id < 2.5) return BLUE*.7; return vec3(.6); }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){
  float k = uRes.y/18.0, split = uRes.x*.56; bool pix = frag.x > split;
  vec2 f = pix ? (floor(frag/k) + .5)*k : frag;
  vec3 c = scene(vec3(.4, 1.6, 4.6), vec3(.1, .55, 0.0), 2.6, f);
  if (pix){ vec2 g = fract(frag/k); float l = max(step(g.x, 1.5/k), step(g.y, 1.5/k)); c = mix(c, vec3(.0), l*.7); }
  c += vec3(.5, .25, .05)*smoothstep(2.0, 0.0, abs(frag.x - split));
  return c; }`,

    /* lerp as objects: five spheres blending from blue to orange over a smoothstep ramp. */
    'shader-anatomy': SDF + `
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  for (int i = 0; i < 5; i++){ float fi = float(i); r = U(r, sdSphere(p - vec3(-2.0 + fi, .42, 0.0), .42), 1.0 + fi); }
  return r; }
vec3 albedo(float id, vec3 p, vec3 n){
  if (id < .5){ if (abs(p.z - .95) < .28 && abs(p.x) < 2.5) return vec3(.02 + .4*smoothstep(-2.0, 2.0, p.x)); return FLOOR; }
  return mix(BLUE, ORANGE, (id - 1.0)/4.0)*.8; }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(.0, 1.7, 5.2), vec3(0.0, .3, .2), 2.7, frag); }`,

    /* Three axis arrows and their sum. */
    vectors: SDF + `
vec3 O = vec3(-.7, .05, .2);
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  r = U(r, sdArrow(p, O, O + vec3(1.7, 0, 0), .045), 1.0);
  r = U(r, sdArrow(p, O, O + vec3(0, 1.5, 0), .045), 2.0);
  r = U(r, sdArrow(p, O, O + vec3(0, 0, 1.4), .045), 3.0);
  r = U(r, sdArrow(p, O, O + vec3(1.3, 1.05, -.9), .06), 4.0);
  r = U(r, sdSphere(p - O, .11), 5.0); return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; if (id < 1.5) return RED; if (id < 2.5) return GREEN; if (id < 3.5) return ZBLUE; if (id < 4.5) return ORANGE; return vec3(.7); }
vec3 emit(float id, vec3 p, vec3 n){ return id > 3.5 && id < 4.5 ? ORANGE*.15 : vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(1.6, 1.9, 4.4), vec3(.0, .6, 0.0), 2.6, frag); }`,

    /* N·L made visible: the sphere is banded by the dot product, with the normal and light arrows. */
    'dot-cross': SDF + `
vec3 C = vec3(0.0, .85, 0.0);
vec3 PN = vec3(0.0, .85, 0.0) + normalize(vec3(.35, .55, .75))*.85;
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  r = U(r, sdSphere(p - C, .85), 1.0);
  r = U(r, sdArrow(p, PN, PN + normalize(vec3(.35, .55, .75))*.9, .035), 2.0);
  r = U(r, sdArrow(p, PN, PN + KEY*.9, .035), 3.0); return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; if (id < 1.5) return vec3(.03); if (id < 2.5) return GREEN; return ORANGE; }
vec3 emit(float id, vec3 p, vec3 n){
  if (id > .5 && id < 1.5){ float d = dot(n, KEY); float b = floor(max(d, 0.0)*6.0)/6.0; vec3 c = mix(BLUE*.08, ORANGE*1.2, b); return d < 0.0 ? BLUE*.04 : c; }
  return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(.4, 1.6, 4.4), vec3(0.0, .85, 0.0), 2.6, frag); }`,

    /* An object with its own axes inside world axes, over a grid. */
    spaces: SDF + `
vec3 OC = vec3(.55, .75, -.1);
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  vec3 q = (p - OC)*(rY(.6)*rX(-.18));
  r = U(r, sdBoxFrame(q, vec3(.55), .025), 1.0);
  r = U(r, sdArrow(q, vec3(0.0), vec3(.85, 0, 0), .03), 2.0);
  r = U(r, sdArrow(q, vec3(0.0), vec3(0, .85, 0), .03), 3.0);
  r = U(r, sdArrow(q, vec3(0.0), vec3(0, 0, .85), .03), 4.0);
  vec3 W0 = vec3(-1.6, .02, .9);
  r = U(r, sdArrow(p, W0, W0 + vec3(.7, 0, 0), .025), 2.0);
  r = U(r, sdArrow(p, W0, W0 + vec3(0, .7, 0), .025), 3.0);
  r = U(r, sdArrow(p, W0, W0 + vec3(0, 0, .7), .025), 4.0);
  return r; }
vec3 albedo(float id, vec3 p, vec3 n){
  if (id < .5){ vec2 g = abs(fract(p.xz*2.0 + .5) - .5); float l = 1.0 - smoothstep(.0, .03, min(g.x, g.y)); return mix(FLOOR, vec3(.12), l); }
  if (id < 1.5) return vec3(.75); if (id < 2.5) return RED; if (id < 3.5) return GREEN; return ZBLUE; }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(1.2, 2.0, 4.6), vec3(-.1, .55, 0.0), 2.5, frag); }`,

    /* A textured ball over a receding checkerboard, tinted by the mip level the distance would pick. */
    'textures-sampling': SDF + `
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0); r = U(r, sdSphere(p - vec3(.3, .7, .8), .7), 1.0); return r; }
vec3 mipTint(float m){ m = clamp(m, 0.0, 5.0); vec3 a = vec3(.2, .5, 1.0), b = vec3(.3, .9, .4), c = vec3(1.0, .75, .2), d = vec3(1.0, .3, .3);
  return m < 1.0 ? mix(vec3(1.0), a, m) : m < 2.5 ? mix(a, b, (m - 1.0)/1.5) : m < 4.0 ? mix(b, c, (m - 2.5)/1.5) : mix(c, d, m - 4.0); }
vec3 albedo(float id, vec3 p, vec3 n){
  if (id < .5){ float dist = length(p - vec3(.0, 1.1, 5.0)); vec2 g = floor(p.xz*2.0); float ch = mod(g.x + g.y, 2.0);
    float fade = smoothstep(4.0, 16.0, dist); float v = mix(ch, .5, fade); vec3 t = mipTint(log2(max(dist, 1.0))*1.4 - .6);
    return mix(vec3(.03), vec3(.3), v)*mix(vec3(1.0), t, .85)*(1.0 - smoothstep(14.0, 26.0, dist)); }
  vec3 q = normalize(p - vec3(.3, .7, .8)); vec2 uv = vec2(atan(q.z, q.x)/6.2832 + .5, acos(q.y)/3.1416);
  vec2 g = floor(uv*vec2(12.0, 6.0)); float ch = mod(g.x + g.y, 2.0); return mix(ORANGE*.7, vec3(.05), ch); }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){ vec2 uv = screenUV(frag); mat3 cam = lookAt(vec3(.0, 1.1, 5.0), vec3(.4, .5, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.4));
  vec2 h = march(vec3(.0, 1.1, 5.0), rd); if (h.x < 0.0) return studio(rd);
  vec3 c = shadeHit(vec3(.0, 1.1, 5.0), rd, h);
  if (h.y < .5){ vec3 p = vec3(.0, 1.1, 5.0) + rd*h.x; c = mix(c, studio(rd), smoothstep(10.0, 24.0, length(p.xz))) ; }
  return c; }`,

    /* Memory as rows of cells: vertex, index and constant data; the first cells of each row are filled. */
    buffers: SDF + `
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  for (int row = 0; row < 3; row++){
    float z = .9 - float(row)*.75;
    vec3 q = p - vec3(0.0, .2, z); float id = clamp(floor(q.x/.42 + .5), -6.0, 6.0); q.x -= id*.42;
    float fill = row == 0 ? 4.0 : row == 1 ? 1.0 : -2.0;
    r = U(r, sdBox(q, vec3(.17, .17, .26)) - .02, (id < fill ? 10.0 : 20.0) + float(row)); }
  return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; float row = mod(id, 10.0); vec3 c = row < .5 ? BLUE : row < 1.5 ? GREEN : ORANGE;
  return id < 15.0 ? c*.85 : vec3(.09); }
vec3 emit(float id, vec3 p, vec3 n){ if (id < 15.0 && id > .5){ float row = mod(id, 10.0); vec3 c = row < .5 ? BLUE : row < 1.5 ? GREEN : ORANGE; return c*.08*(n.y*.5 + .5); } return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(1.4, 2.6, 4.6), vec3(.2, .15, 0.0), 2.4, frag); }`,

    /* Red, green and blue lights adding up on the floor. */
    'color-values': SDF + `
vec3 L1 = vec3(-.75, .45, .35), L2 = vec3(.75, .45, .35), L3 = vec3(0.0, .45, -.85);
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0); r = U(r, sdSphere(p - L1, .32), 1.0); r = U(r, sdSphere(p - L2, .32), 2.0); r = U(r, sdSphere(p - L3, .32), 3.0); return r; }
vec3 albedo(float id, vec3 p, vec3 n){ return id < .5 ? vec3(.06) : vec3(.02); }
vec3 pl(vec3 p, vec3 n, vec3 L, vec3 c){ vec3 d = L - p; float r2 = dot(d, d); return c*max(dot(n, d*inversesqrt(r2)), 0.0)/r2; }
vec3 emit(float id, vec3 p, vec3 n){
  if (id < .5) return vec3(.55)*(pl(p, n, L1, vec3(1.0, .02, .01)) + pl(p, n, L2, vec3(.02, 1.0, .03)) + pl(p, n, L3, vec3(.02, .06, 1.0)))*1.4;
  if (id < 1.5) return vec3(3.0, .08, .04); if (id < 2.5) return vec3(.08, 3.0, .1); return vec3(.08, .2, 3.0); }
vec3 render(vec2 frag){ vec3 c = scene(vec3(.0, 2.6, 3.8), vec3(0.0, .1, -.1), 2.4, frag); return c*.6; }`,

    /* A ray passing through a sphere and a box, entry and exit points lit. */
    'rays-math': SDF + `
vec3 RA = vec3(-3.4, .45, .95), RB = vec3(2.8, .85, -.7);
vec4 SPH = vec4(.55, .7, .0, .7);
vec3 BC = vec3(-1.45, .48, .55);
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  r = U(r, sdSphere(p - SPH.xyz, SPH.w), 1.0);
  mat3 RBX = rY(.45); r = U(r, sdBox((p - BC)*RBX, vec3(.45)) - .02, 2.0);
  r = U(r, sdCapsule(p, RA, RB, .016), 3.0);
  vec3 d = normalize(RB - RA); vec2 h = sphIntersect(RA, d, SPH);
  if (h.x > 0.0){ r = U(r, sdSphere(p - (RA + d*h.x), .085), 4.0); r = U(r, sdSphere(p - (RA + d*h.y), .085), 4.0); }
  vec3 bn; float tb = boxIntersect((RA - BC)*RBX, d*RBX, vec3(.47), bn);
  if (tb > 0.0) r = U(r, sdSphere(p - (RA + d*tb), .085), 4.0);
  return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; if (id < 1.5) return BLUE*.55; if (id < 2.5) return vec3(.5); return vec3(.02); }
vec3 emit(float id, vec3 p, vec3 n){ if (id > 2.5 && id < 3.5) return ORANGE*4.0; if (id > 3.5) return vec3(4.0, 2.4, .9); return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(.3, 2.2, 5.0), vec3(-.3, .55, 0.0), 2.4, frag); }`
  });
  /* ---------- second wave: depth, transparency, clouds, parallax and the lighting units ---------- */
  Object.assign(SCENES, {
    /* Lit still life on the left, its linear depth on the right. */
    'depth-effects': SDF + `
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  r = U(r, sdSphere(p - vec3(-.9, .55, .4), .55), 1.0);
  r = U(r, sdBox((p - vec3(.5, .45, -.6))*rY(.6), vec3(.45)) - .02, 2.0);
  r = U(r, sdSphere(p - vec3(1.4, .3, .9), .3), 3.0);
  r = U(r, sdBox(p - vec3(-.2, .9, -2.4), vec3(1.6, .9, .25)), 2.0); return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; if (id < 1.5) return ORANGE*.75; if (id < 2.5) return vec3(.55); return BLUE*.7; }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){
  vec3 ro = vec3(.6, 1.8, 4.6); vec2 uv = screenUV(frag); mat3 cam = lookAt(ro, vec3(-.1, .4, -.4)); vec3 f = normalize(vec3(uv, 2.5)); vec3 rd = cam*f;
  vec2 h = march(ro, rd);
  if (frag.x < uRes.x*.55) return h.x < 0.0 ? studio(rd) : shadeHit(ro, rd, h);
  float z = h.x < 0.0 ? 30.0 : h.x*f.z; float d = clamp((z - 2.5)/6.5, 0.0, 1.0);
  vec3 c = vec3(pow(1.0 - d, 1.6))*.55 + vec3(.004);
  float edge = smoothstep(1.5, 0.0, abs(frag.x - uRes.x*.55)); return mix(c, vec3(.5, .25, .05), edge); }`,

    /* Three tinted glass spheres over a floor, blended back to front. */
    transparency: SDF + `
vec2 map(vec3 p){ return vec2(p.y, 0.0); }
vec3 albedo(float id, vec3 p, vec3 n){ vec2 g = floor(p.xz*2.0); return mix(vec3(.05), vec3(.11), mod(g.x + g.y, 2.0)); }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec4 S0 = vec4(-.75, .7, .1, .62), S1 = vec4(.1, .75, -.45, .62), S2 = vec4(.65, .62, .45, .55);
vec3 glass(vec3 rd, vec3 n, vec3 tint){ float fr = .04 + .96*pow(1.0 - max(dot(-rd, n), 0.0), 5.0); return tint*(.25 + .75*max(dot(n, KEY), 0.0)) + vec3(1.0)*fr*.8 + vec3(1.6)*pow(max(dot(reflect(rd, n), KEY), 0.0), 60.0); }
vec3 render(vec2 frag){
  vec3 ro = vec3(.2, 1.7, 4.4); vec2 uv = screenUV(frag); mat3 cam = lookAt(ro, vec3(0.0, .55, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.5));
  vec2 h = march(ro, rd); vec3 c = h.x < 0.0 ? studio(rd) : shadeHit(ro, rd, h); float tb = h.x < 0.0 ? 1e9 : h.x;
  vec4 S[3]; S[0] = S0; S[1] = S1; S[2] = S2; vec3 T[3]; T[0] = vec3(1.0, .25, .1); T[1] = vec3(.15, .45, 1.0); T[2] = vec3(.2, .9, .35);
  float ts[3]; for (int i = 0; i < 3; i++){ vec2 q = sphIntersect(ro, rd, S[i]); ts[i] = (q.x > 0.0 && q.x < tb) ? q.x : -1.0; }
  for (int k = 0; k < 3; k++){ // draw the farthest remaining sphere first
    float best = -1.0; int bi = -1;
    for (int i = 0; i < 3; i++) if (ts[i] > best){ best = ts[i]; bi = i; }
    if (bi < 0) break;
    for (int i = 0; i < 3; i++) if (i == bi){ vec3 n = normalize(ro + rd*ts[i] - S[i].xyz); c = mix(c, glass(rd, n, T[i]), .5); ts[i] = -1.0; }
  }
  return c; }`,

    /* A layer of raymarched cumulus seen from the ground, sun to the side. */
    'cloud-march': `
vec3 SUN = normalize(vec3(.75, .32, -.55));
float dens(vec3 p){ float h = (p.y - 6.0)/5.0; if (h < 0.0 || h > 1.0) return 0.0;
  float prof = smoothstep(0.0, .15, h)*(1.0 - smoothstep(.45, 1.0, h));
  float n = fbm(p*.11 + vec3(0.0, 0.0, 3.0)); return clamp((n*prof - .4)*4.5, 0.0, 1.0); }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, 1.0, 0.0); mat3 cam = lookAt(ro, vec3(0.0, 5.5, -10.0)); vec3 rd = cam*normalize(vec3(uv, 1.6));
  vec3 sky = mix(vec3(.32, .45, .7), vec3(.06, .14, .38), clamp(rd.y*1.2, 0.0, 1.0)) + vec3(4.0, 3.2, 2.2)*pow(max(dot(rd, SUN), 0.0), 600.0) + vec3(.4, .3, .2)*pow(max(dot(rd, SUN), 0.0), 8.0);
  if (rd.y < .02) return mix(vec3(.03, .035, .03), vec3(.25, .3, .4), exp(rd.y*40.0));
  float t0 = (6.0 - ro.y)/rd.y, t1 = (11.0 - ro.y)/rd.y; t1 = min(t1, t0 + 40.0);
  float dt = (t1 - t0)/40.0, T = 1.0; vec3 L = vec3(0.0); float t = t0 + dt*hash12(frag);
  for (int i = 0; i < 40; i++){
    vec3 p = ro + rd*t; float d = dens(p);
    if (d > .001){ float ds = dens(p + SUN*.8) + dens(p + SUN*2.0); float Ts = exp(-ds*1.6);
      float ph = mix(.6, 2.2, pow(max(dot(rd, SUN), 0.0), 4.0));
      vec3 lit = vec3(2.6, 2.4, 2.1)*Ts*ph*(1.0 - exp(-d*2.0)) + vec3(.35, .42, .55);
      L += T*d*dt*.9*lit; T *= exp(-d*dt*.9); if (T < .02) break; }
    t += dt; }
  return sky*T + L; }`,

    /* A brick height field, traced per pixel, lit at a grazing angle. */
    parallax: `
vec3 LD = normalize(vec3(-.8, .45, .3));
float bh(vec2 p){ vec2 q = p*vec2(2.0, 4.0); q.x += .5*step(1.0, mod(q.y, 2.0)); vec2 f = fract(q); vec2 e = min(f, 1.0 - f)*vec2(1.0, 2.0);
  float m = smoothstep(.0, .06, min(e.x*.5, e.y*.25)); float rough = hash12(floor(q)*1.7)*.03 + noise3(vec3(p*9.0, 1.0))*.025; return .08*m + rough*m; }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, 1.0, 2.2); mat3 cam = lookAt(ro, vec3(0.0, 0.0, -1.2)); vec3 rd = cam*normalize(vec3(uv, 2.0));
  if (rd.y > -.01) return studio(rd);
  float t = (.12 - ro.y)/rd.y, tEnd = (0.0 - ro.y)/rd.y, dt = (tEnd - t)/64.0; vec3 p = ro + rd*t;
  for (int i = 0; i < 64; i++){ p = ro + rd*t; if (p.y <= bh(p.xz)) break; t += dt; }
  vec2 e = vec2(.004, 0.0); vec3 n = normalize(vec3(bh(p.xz - e.xy) - bh(p.xz + e.xy), 2.0*e.x, bh(p.xz - e.yx) - bh(p.xz + e.yx)));
  float sh = 1.0; vec3 q = p + n*.002; for (int i = 1; i < 24; i++){ vec3 s = q + LD*(.01 + float(i)*.012); if (s.y < bh(s.xz) - .004) { sh = 0.0; break; } }
  vec2 g = p.xz*vec2(2.0, 4.0); g.x += .5*step(1.0, mod(g.y, 2.0)); float hv = hash12(floor(g));
  vec3 alb = p.y < .04 ? vec3(.22, .21, .2) : mix(vec3(.42, .16, .09), vec3(.55, .25, .14), hv);
  vec3 c = alb*(vec3(2.4, 2.1, 1.8)*max(dot(n, LD), 0.0)*sh + vec3(.08, .09, .11));
  return mix(c, studio(rd), smoothstep(3.0, 7.0, length(p.xz - ro.xz))); }`,

    /* Roughness from 0 to 1, gold above, red plastic below, GGX under a key light and a studio environment. */
    'pbr-brdf': `
vec3 K = normalize(vec3(-.6, .7, .5));
float Dg(float noh, float a){ float a2 = a*a; float d = noh*noh*(a2 - 1.0) + 1.0; return a2/(PI*d*d); }
vec3 env(vec3 r, float rough){ vec3 c = studio(r)*3.0 + vec3(.6, .65, .75)*smoothstep(.2, 1.0, r.y)*(1.0 - rough*.6); c += vec3(3.0)*smoothstep(.97 - rough*.4, 1.0, dot(r, normalize(vec3(.5, .55, .7))))*(1.0 - rough*.7); return c; }
vec3 shadeBall(vec3 ro, vec3 rd, vec3 n, float rough, float metal, vec3 base){
  vec3 v = -rd, l = K, h = normalize(l + v); float nol = max(dot(n, l), 0.0), nov = max(dot(n, v), 1e-3), noh = max(dot(n, h), 0.0), voh = max(dot(v, h), 0.0);
  float a = max(rough*rough, .002); vec3 f0 = mix(vec3(.04), base, metal); vec3 F = f0 + (1.0 - f0)*pow(1.0 - voh, 5.0);
  float k = (rough + 1.0)*(rough + 1.0)/8.0; float G = (nol/(nol*(1.0 - k) + k))*(nov/(nov*(1.0 - k) + k));
  vec3 spec = Dg(noh, a)*F*G/(4.0*nol*nov + 1e-3); vec3 kd = (1.0 - F)*(1.0 - metal);
  vec3 c = (kd*base/PI + spec)*vec3(3.2, 3.0, 2.8)*nol;
  vec3 Fe = f0 + (max(vec3(1.0 - rough), f0) - f0)*pow(1.0 - nov, 5.0);
  c += env(reflect(rd, n), rough)*Fe*.35 + kd*base*mix(vec3(.04), vec3(.12, .14, .18), n.y*.5 + .5);
  return c; }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, 1.1, 6.2); mat3 cam = lookAt(ro, vec3(0.0, .95, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.6));
  float tb = 1e9; vec3 col = vec3(0.0); bool hit = false;
  for (int row = 0; row < 2; row++) for (int i = 0; i < 6; i++){
    vec4 s = vec4(-2.5 + float(i), row == 0 ? 1.45 : .42, 0.0, .4); vec2 q = sphIntersect(ro, rd, s);
    if (q.x > 0.0 && q.x < tb){ tb = q.x; hit = true; vec3 n = normalize(ro + rd*q.x - s.xyz); float rough = .04 + float(i)/5.0*.92;
      col = row == 0 ? shadeBall(ro, rd, n, rough, 1.0, vec3(1.0, .76, .33)) : shadeBall(ro, rd, n, rough, 0.0, vec3(.7, .05, .04)); } }
  if (hit) return col;
  if (rd.y < 0.0){ float t = -ro.y/rd.y; vec3 p = ro + rd*t; float sh = 1.0;
    for (int row = 0; row < 2; row++) for (int i = 0; i < 6; i++){ vec4 s = vec4(-2.5 + float(i), row == 0 ? 1.45 : .42, 0.0, .4); sh = min(sh, sphSoftShadow(p, K, s, 4.0)); }
    vec3 c = vec3(.035)*(vec3(2.6)*max(K.y, 0.0)*sh + vec3(.12)); return mix(c, studio(rd), smoothstep(3.5, 9.0, length(p.xz))); }
  return studio(rd); }`,

    /* Low sun, pillars, long shadows. */
    'shadow-maps': '#define KEYDIR vec3(-.85, .32, .28)\n' + SDF + `
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  for (int i = 0; i < 4; i++){ float fi = float(i); r = U(r, sdBox(p - vec3(-1.8 + fi*1.1, .55 + .25*mod(fi, 2.0), -.4 + .35*mod(fi, 3.0)), vec3(.16, .55 + .25*mod(fi, 2.0), .16)) - .01, 1.0 + fi); }
  r = U(r, sdSphere(p - vec3(1.2, .35, 1.0), .35), 6.0); return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return vec3(.32); if (id < 5.5) return vec3(.6); return ORANGE*.8; }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(.8, 3.0, 5.2), vec3(.4, .2, 0.0), 2.4, frag); }`,

    /* An open room with coloured side walls bleeding onto white surfaces. */
    'baked-gi': '#define KEYDIR vec3(-.45, .75, .5)\n' + SDF + `
vec2 map(vec3 p){ vec2 r = vec2(1e9, 0.0);
  r = U(r, p.y, 0.0);
  r = U(r, sdBox(p - vec3(0.0, 3.05, -.6), vec3(1.8, .05, 1.3)), 1.0);
  r = U(r, sdBox(p - vec3(-1.7, 1.5, -.6), vec3(.1, 1.5, 1.3)), 2.0); r = U(r, sdBox(p - vec3(1.7, 1.5, -.6), vec3(.1, 1.5, 1.3)), 3.0);
  r = U(r, sdBox(p - vec3(0.0, 1.5, -1.9), vec3(1.8, 1.5, .1)), 1.0);
  r = U(r, sdBox((p - vec3(-.55, .55, -.6))*rY(.35), vec3(.42, .55, .42)) - .01, 4.0);
  r = U(r, sdSphere(p - vec3(.65, .45, .2), .45), 4.0); return r; }
vec3 RW = vec3(.6, .07, .04), GW = vec3(.08, .42, .1);
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5 && (abs(p.x) > 1.8 || p.z > .7)) return vec3(.05); if (id > 1.5 && id < 2.5) return RW; if (id > 2.5 && id < 3.5) return GW; return vec3(.5); }
vec3 emit(float id, vec3 p, vec3 n){ vec3 a = albedo(id, p, n);
  vec3 bleed = RW*exp(-(p.x + 1.6)*1.4)*max(-n.x*.5 + .5, 0.0) + GW*exp(-(1.6 - p.x)*1.4)*max(n.x*.5 + .5, 0.0) + vec3(.55, .5, .45)*exp(-p.y*.9)*max(n.y, 0.0)*.25;
  return a*bleed*.9 + a*vec3(.06); }
vec3 render(vec2 frag){ vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, 1.45, 4.3); mat3 cam = lookAt(ro, vec3(0.0, 1.2, 0.0)); vec3 rd = cam*normalize(vec3(uv, 1.9));
  vec2 h = march(ro, rd); if (h.x < 0.0) return studio(rd); vec3 p = ro + rd*h.x, n = calcN(p), a = albedo(h.y, p, n);
  float sh = softSh(p + n*.01, KEY), oc = calcAO(p, n);
  return (a*vec3(1.5, 1.38, 1.2)*max(dot(n, KEY), 0.0)*sh + emit(h.y, p, n)*oc)*mix(1.0, .5, smoothstep(.6, 2.0, p.z)); }`,

    /* A spot cone in haze and a warm point light on a dark floor. */
    'light-types': `
vec3 SP = vec3(-.7, 2.6, -.2), SD = normalize(vec3(.15, -1.0, .05)); vec3 PP = vec3(1.25, .35, .6);
float cone(vec3 p){ vec3 l = normalize(p - SP); float c = dot(l, SD); return pow(clamp((c - cos(.42))/(cos(.3) - cos(.42)), 0.0, 1.0), 2.0); }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, 1.5, 4.8); mat3 cam = lookAt(ro, vec3(0.0, .9, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.3));
  float tf = rd.y < 0.0 ? -ro.y/rd.y : 30.0; vec3 c = vec3(0.0);
  if (rd.y < 0.0){ vec3 p = ro + rd*tf; vec3 n = vec3(0, 1, 0);
    vec3 ls = SP - p; float ds = dot(ls, ls); vec3 spot = vec3(1.0, .93, .82)*14.0*cone(p)*max(dot(n, normalize(ls)), 0.0)/(ds + 1.0);
    vec3 lp = PP - p; float dp = dot(lp, lp); vec3 pt = vec3(1.0, .55, .22)*2.2*max(dot(n, normalize(lp)), 0.0)/(dp + .05);
    c = vec3(.08)*(spot + pt) + vec3(.002); c = mix(c, studio(rd)*.5, smoothstep(4.0, 9.0, length(p.xz))); }
  else c = studio(rd)*.5;
  float dt = min(tf, 8.0)/40.0, t = dt*hash12(frag); vec3 fog = vec3(0.0);
  for (int i = 0; i < 40; i++){ vec3 p = ro + rd*t; vec3 ls = SP - p; fog += vec3(1.0, .93, .82)*cone(p)/(dot(ls, ls) + .5)*dt; t += dt; }
  c += fog*.32;
  vec2 q = sphIntersect(ro, rd, vec4(PP, .1)); if (q.x > 0.0 && q.x < tf) c = vec3(6.0, 3.2, 1.3);
  vec3 lp = PP - ro; float b = dot(lp, rd); float d2 = dot(lp, lp) - b*b; c += vec3(1.0, .55, .22)*.012/max(d2, .0004)*step(0.0, b);
  return c; }`
  });
  /* ---------- third wave: characters and mapping ---------- */
  Object.assign(SCENES, {
    /* A bust lit from the side: left half with wrapped, red-bleeding diffuse and light through the ears, right half plain Lambert. */
    skin: '#define KEYDIR vec3(.8, .45, .35)\n' + SDF + `
float smin(float a, float b, float k){ float h = clamp(.5 + .5*(b - a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0 - h); }
float sdEll(vec3 p, vec3 r){ float k0 = length(p/r), k1 = length(p/(r*r)); return k0*(k0 - 1.0)/k1; }
float bust(vec3 p){ vec3 q = p - vec3(0.0, 1.55, 0.0), e = vec3(abs(q.x), q.yz);
  float d = sdEll(q, vec3(.5, .6, .56));
  d = smin(d, sdEll(q - vec3(0.0, -.36, .15), vec3(.34, .33, .37)), .18);
  d = smin(d, sdCapsule(q, vec3(0.0, .04, .5), vec3(0.0, -.17, .63), .065), .06);
  d = -smin(-d, sdSphere(e - vec3(.17, .07, .56), .085), .05); d = min(d, sdSphere(e - vec3(.17, .07, .47), .07));
  d = smin(d, sdEll(e - vec3(.5, -.06, -.04), vec3(.045, .16, .1)), .035);
  d = smin(d, sdCapsule(p, vec3(0.0, .5, -.05), vec3(0.0, 1.15, -.02), .22), .12);
  d = smin(d, sdEll(p - vec3(0.0, .28, -.1), vec3(.95, .32, .42)), .2); return d; }
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0); r = U(r, bust(p), 1.0); return r; }
vec3 albedo(float id, vec3 p, vec3 n){ return id < .5 ? FLOOR : vec3(.5, .26, .19); }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){
  vec3 ro = vec3(-1.8, 1.8, 3.4); vec2 uv = screenUV(frag); mat3 cam = lookAt(ro, vec3(-.05, 1.25, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.5));
  vec2 h = march(ro, rd); if (h.x < 0.0) return studio(rd);
  float split = uRes.x*.5; vec3 edge = vec3(.5, .25, .05)*smoothstep(1.5, 0.0, abs(frag.x - split));
  if (h.y < .5) return shadeHit(ro, rd, h) + edge;
  vec3 p = ro + rd*h.x, n = calcN(p), v = -rd, alb = vec3(.5, .26, .19);
  float nl = dot(n, KEY), sh = softSh(p + n*.01, KEY), oc = calcAO(p, n);
  vec3 dif;
  if (frag.x < split){ vec3 w = vec3(.6, .25, .14); dif = clamp((vec3(nl) + w)/(1.0 + w), 0.0, 1.0)*pow(vec3(sh), vec3(.3, .75, 1.0));
    float th = 0.0; for (int i = 1; i < 6; i++) th += max(-map(p - n*(.04*float(i))).x, 0.0);
    dif += exp(-th*vec3(6.0, 22.0, 35.0))*max(-nl, 0.0)*vec3(1.4, .3, .15); }
  else dif = vec3(max(nl, 0.0)*sh);
  vec3 hh = normalize(KEY + v); float nh = max(dot(n, hh), 0.0), fr = .028 + .972*pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 c = alb*(dif*vec3(1.7, 1.55, 1.4) + mix(vec3(.03, .03, .04), vec3(.1, .11, .14), n.y*.5 + .5)*oc);
  c += vec3(2.0)*(pow(nh, 90.0)*.3 + pow(nh, 14.0)*.06)*fr*4.0*sh*step(0.0, nl);
  return c + edge; }`,

    /* A ball of hair: strands run down from the crown, Kajiya–Kay diffuse and two shifted highlight bands. */
    hair: `
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, 1.35, 4.0); mat3 cam = lookAt(ro, vec3(0.0, .05, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.6));
  vec2 q = sphIntersect(ro, rd, vec4(0.0, 0.0, 0.0, 1.0));
  if (q.x < 0.0){ vec3 c = studio(rd); if (rd.y < 0.0){ float t = (-1.0 - ro.y)/rd.y; vec3 p = ro + rd*t; c = mix(vec3(.03)*(.25 + .75*smoothstep(.6, 1.6, length(p.xz))), c, smoothstep(3.0, 7.0, length(p.xz))); } return c; }
  vec3 p = ro + rd*q.x, n = normalize(p);
  vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(0.0, 0.0, 1e-4)); vec3 T = cross(n, east);
  float az = atan(n.z, n.x), pol = acos(clamp(n.y, -1.0, 1.0));
  float s1 = noise3(vec3(az*70.0, pol*2.5, 0.0)), s2 = noise3(vec3(az*230.0, pol*7.0, 3.0));
  vec3 L = normalize(vec3(-.4, .45, .8)), V = -rd, H = normalize(L + V);
  float shift = (s1 - .5)*.16;
  vec3 TR = normalize(T + n*(.1 + shift)), TT = normalize(T + n*(-.25 + shift));
  float a = dot(TR, H), b = dot(TT, H), c0 = dot(T, L);
  float spR = pow(sqrt(max(0.0, 1.0 - a*a)), 260.0), spT = pow(sqrt(max(0.0, 1.0 - b*b)), 45.0), kd = sqrt(max(0.0, 1.0 - c0*c0));
  vec3 base = mix(vec3(.025, .011, .005), vec3(.16, .065, .025), smoothstep(.1, 1.7, pol))*(.55 + .9*s2);
  float nl = clamp(dot(n, L)*.6 + .4, 0.0, 1.0);
  vec3 c = base*(kd*nl*1.4 + .08) + vec3(1.0, .85, .7)*spR*nl*.45 + base*4.0*spT*nl;
  return c*mix(.55, 1.05, s1)*smoothstep(.02, .25, pol); }`,

    /* Two draped forms: red velvet with Charlie sheen and blue satin with anisotropic GGX, key light plus a rim light. */
    cloth: '#define KEYDIR vec3(-.55, .6, .6)\n' + SDF + `
float drape(vec3 q){ float a = atan(q.z, q.x), y = clamp((.7 - q.y)/.7, 0.0, 1.0);
  float r = .412 + .27*y*y + .03*y*sin(a*9.0 + q.y*3.0);
  float skirt = max(max(length(q.xz) - r, -q.y), q.y - .7)*.6;
  return min(skirt, sdSphere(q - vec3(0.0, .7, 0.0), .42)); }
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0); r = U(r, drape(p - vec3(-1.0, 0.0, 0.0)), 1.0); r = U(r, drape(p - vec3(1.0, 0.0, 0.0)), 2.0); return r; }
vec3 albedo(float id, vec3 p, vec3 n){ return FLOOR; }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, 1.55, 4.6); mat3 cam = lookAt(ro, vec3(0.0, .5, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.5));
  vec2 h = march(ro, rd); if (h.x < 0.0) return studio(rd); if (h.y < .5) return shadeHit(ro, rd, h);
  vec3 p = ro + rd*h.x, n = calcN(p), v = -rd; float sh = softSh(p + n*.01, KEY), oc = calcAO(p, n), nv = max(dot(n, v), 1e-3);
  vec3 base = h.y < 1.5 ? vec3(.16, .006, .02) : vec3(.03, .07, .32);
  vec3 c = base*mix(vec3(.04, .04, .05), vec3(.14, .15, .19), n.y*.5 + .5)*oc;
  for (int k = 0; k < 2; k++){
    vec3 l = k == 0 ? KEY : normalize(vec3(.6, .45, -.9)); vec3 lc = k == 0 ? vec3(2.4, 2.25, 2.05)*sh : vec3(1.0, 1.1, 1.4);
    float nl = max(dot(n, l), 0.0); vec3 hh = normalize(l + v); float nh = max(dot(n, hh), 0.0);
    if (h.y < 1.5){
      float inv = 1.0/.22, s2 = max(1.0 - nh*nh, 0.0); float D = (2.0 + inv)*pow(s2, inv*.5)/(2.0*PI); float Vc = 1.0/(4.0*(nl + nv - nl*nv) + 1e-3);
      float w = clamp((dot(n, l) + .5)/2.25, 0.0, 1.0);
      c += lc*(base/PI*w*clamp(vec3(.5, .1, .15) + dot(n, l), 0.0, 1.0)*1.5 + vec3(1.0, .45, .5)*D*Vc*nl*2.2);
    } else {
      vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-4)), B = cross(n, T);
      float ax = .07, ay = .38, th = dot(T, hh)/ax, bh = dot(B, hh)/ay, dd = th*th + bh*bh + nh*nh; float D = 1.0/(PI*ax*ay*dd*dd);
      float F = .04 + .96*pow(1.0 - max(dot(v, hh), 0.0), 5.0);
      c += lc*(base/PI*nl*2.0 + vec3(.75, .8, 1.0)*D*F*nl/(4.0*nl*nv + .15)*.6);
    }
  }
  return c; }`,

    /* A curtain gathered on a rod: tight pleats at the top open into soft folds at the bottom. */
    'fabric-folds': '#define KEYDIR vec3(-.9, .45, .5)\n' + SDF + `
float hf(vec2 q){ float y = clamp((2.5 - q.y)/2.35, 0.0, 1.0); return (.05 + .1*y)*sin(q.x*8.0 + .5*sin(q.x*1.3 + y*2.0)) + .06*y*y*sin(q.x*2.6 + 1.2); }
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  float h = hf(p.xy), g = (hf(p.xy + vec2(.002, 0.0)) - hf(p.xy - vec2(.002, 0.0)))/.004;
  float d = (abs(p.z - h) - .012)/sqrt(1.0 + g*g)*.8;
  d = max(d, sdBox(p - vec3(0.0, 1.33, 0.0), vec3(1.5, 1.18, .5)));
  r = U(r, d, 1.0);
  r = U(r, sdCapsule(p, vec3(-1.75, 2.58, .02), vec3(1.75, 2.58, .02), .028), 2.0);
  r = U(r, sdSphere(p - vec3(-1.78, 2.58, .02), .06), 2.0); r = U(r, sdSphere(p - vec3(1.78, 2.58, .02), .06), 2.0); return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; if (id < 1.5) return vec3(.55, .2, .06); return vec3(.25); }
vec3 emit(float id, vec3 p, vec3 n){ return id > .5 && id < 1.5 ? vec3(.55, .2, .06)*.05*(1.0 - abs(n.z)) : vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(1.3, 1.6, 4.9), vec3(0.0, 1.3, 0.0), 2.2, frag); }`,

    /* One rounded cube, three ways: planar from above (smeared sides), triplanar (tinted by axis) and a matcap. */
    mapping: SDF + `
vec3 C1 = vec3(-1.45, .55, 0.0), C2 = vec3(0.0, .55, 0.0), C3 = vec3(1.45, .55, 0.0);
float shp(vec3 q){ return sdBox(q, vec3(.34)) - .14; }
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0); mat3 m = rY(.6)*rX(.45);
  r = U(r, shp((p - C1)*m), 1.0); r = U(r, shp((p - C2)*m), 2.0); r = U(r, shp((p - C3)*m), 3.0); return r; }
float chk(vec2 u){ vec2 g = floor(u*4.0); return mod(g.x + g.y, 2.0); }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; mat3 m = rY(.6)*rX(.45);
  if (id < 1.5){ vec3 q = (p - C1)*m; return mix(vec3(.06), ORANGE*.8, chk(q.xz + .5)); }
  if (id < 2.5){ vec3 q = (p - C2)*m, nq = abs(n*m); vec3 w = nq*nq*nq*nq; w /= w.x + w.y + w.z;
    return w.x*mix(vec3(.06), RED*.8, chk(q.zy + .5)) + w.y*mix(vec3(.06), GREEN*.8, chk(q.xz + .5)) + w.z*mix(vec3(.06), ZBLUE*.8, chk(q.xy + .5)); }
  return vec3(0.0); }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 matcap(vec2 m){ float nz = sqrt(max(0.0, 1.0 - dot(m, m))); vec3 nn = vec3(m, nz), l = normalize(vec3(-.5, .6, .62));
  float dif = max(dot(nn, l), 0.0), sp = pow(max(dot(nn, normalize(l + vec3(0.0, 0.0, 1.0))), 0.0), 50.0), rim = pow(1.0 - nz, 3.0);
  return vec3(.55, .22, .16)*(.06 + .9*dif) + vec3(1.2)*sp + rim*vec3(.25, .35, .6); }
vec3 render(vec2 frag){ vec3 ro = vec3(0.0, 1.9, 4.6); vec2 uv = screenUV(frag); mat3 cam = lookAt(ro, vec3(0.0, .45, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.5));
  vec2 h = march(ro, rd); if (h.x < 0.0) return studio(rd);
  if (h.y > 2.5){ vec3 n = calcN(ro + rd*h.x); return matcap(vec2(dot(n, cam[0]), dot(n, cam[1]))); }
  return shadeHit(ro, rd, h); }`
  });
  /* ---------- fourth wave: compute, PBR basics, texturing, texture settings ---------- */
  Object.assign(SCENES, {
    /* Threads as columns in 8 x 8 groups; heights are the values the dispatch computed; overhanging groups in red. */
    'compute-shaders': '#define KEYDIR vec3(-.35, .92, -.2)\n' + SDF + `
const float PITCH = .085, GP = 8.0, GAP = .07;
vec2 cellOf(vec2 xz){ float gs = GP * PITCH + GAP; vec2 g = floor(xz / gs); vec2 l = xz - g * gs; vec2 t = floor(l / PITCH); return g * GP + min(t, vec2(GP - 1.0)); }
float hOf(vec2 c){ return .05 + .35 * fbm(vec3(c * .09, 1.3)); }
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  float gs = GP * PITCH + GAP; vec3 q = p - vec3(-2.6, 0.0, -1.5);
  float dB = sdBox(q - vec3(3.5 * gs, .22, 2.5 * gs), vec3(3.5 * gs + .05, .23, 2.5 * gs + .05));
  if (dB > .02) r = U(r, dB, 1.0);
  else {
    vec2 g = floor(q.xz / gs); vec2 l = q.xz - g * gs; vec2 t = clamp(floor(l / PITCH), 0.0, GP - 1.0);
    vec2 c = g * GP + t; vec2 ctr = g * gs + (t + .5) * PITCH;
    float h = hOf(c); float d = sdBox(vec3(q.x - ctr.x, q.y - h * .5, q.z - ctr.y), vec3(PITCH * .4, h * .5, PITCH * .4));
    d = max(d, -1.0) * .9; r = U(r, min(d, PITCH * .45), (g.x > 5.5 || g.y > 3.5) ? 2.0 : 1.0); }
  return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5 || id > 2.5) return FLOOR; float gs = GP * PITCH + GAP; vec3 q = p - vec3(-2.6, 0.0, -1.5); vec2 g = floor(q.xz / gs);
  vec3 c = mix(BLUE, vec3(.15, .7, .9), fract((g.x * 3.0 + g.y * 5.0) * .37) * .6); return id > 1.5 ? RED * .7 : c * .8; }
vec3 emit(float id, vec3 p, vec3 n){ return (id > .5 && id < 1.5) ? vec3(.02, .05, .09) * step(.5, n.y) : vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(.3, 4.0, 5.0), vec3(.05, .0, .35), 2.3, frag); }`,

    /* Four spheres: rough plastic, polished plastic, rough metal, polished gold. */
    'pbr-basics': `
vec3 K = normalize(vec3(-.6, .7, .5));
float Dg(float noh, float a){ float a2 = a*a; float d = noh*noh*(a2 - 1.0) + 1.0; return a2/(PI*d*d); }
vec3 env(vec3 r, float rough){ vec3 c = studio(r)*3.0 + vec3(.6, .65, .75)*smoothstep(.2, 1.0, r.y)*(1.0 - rough*.6); c += vec3(3.0)*smoothstep(.97 - rough*.4, 1.0, dot(r, normalize(vec3(.5, .55, .7))))*(1.0 - rough*.7); return c; }
vec3 shadeBall(vec3 rd, vec3 n, float rough, float metal, vec3 base){
  vec3 v = -rd, l = K, h = normalize(l + v); float nol = max(dot(n, l), 0.0), nov = max(dot(n, v), 1e-3), noh = max(dot(n, h), 0.0), voh = max(dot(v, h), 0.0);
  float a = max(rough*rough, .002); vec3 f0 = mix(vec3(.04), base, metal); vec3 F = f0 + (1.0 - f0)*pow(1.0 - voh, 5.0);
  float k = (rough + 1.0)*(rough + 1.0)/8.0; float G = (nol/(nol*(1.0 - k) + k))*(nov/(nov*(1.0 - k) + k));
  vec3 spec = Dg(noh, a)*F*G/(4.0*nol*nov + 1e-3); vec3 kd = (1.0 - F)*(1.0 - metal);
  vec3 c = (kd*base/PI + spec)*vec3(3.2, 3.0, 2.8)*nol;
  vec3 Fe = f0 + (max(vec3(1.0 - rough), f0) - f0)*pow(1.0 - nov, 5.0);
  return c + env(reflect(rd, n), rough)*Fe*.35 + kd*base*mix(vec3(.04), vec3(.12, .14, .18), n.y*.5 + .5); }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, 1.0, 5.6); mat3 cam = lookAt(ro, vec3(0.0, .55, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.6));
  float tb = 1e9; vec3 col = vec3(0.0); bool hit = false;
  for (int i = 0; i < 4; i++){ vec4 s = vec4(-1.8 + float(i)*1.2, .52, 0.0, .5); vec2 q = sphIntersect(ro, rd, s);
    if (q.x > 0.0 && q.x < tb){ tb = q.x; hit = true; vec3 n = normalize(ro + rd*q.x - s.xyz);
      col = i == 0 ? shadeBall(rd, n, .75, 0.0, vec3(.5, .06, .04)) : i == 1 ? shadeBall(rd, n, .12, 0.0, vec3(.5, .06, .04)) : i == 2 ? shadeBall(rd, n, .6, 1.0, vec3(.9, .9, .92)) : shadeBall(rd, n, .15, 1.0, vec3(1.0, .78, .38)); } }
  if (hit) return col;
  if (rd.y < 0.0){ float t = -ro.y/rd.y; vec3 p = ro + rd*t; float sh = 1.0;
    for (int i = 0; i < 4; i++){ vec4 s = vec4(-1.8 + float(i)*1.2, .52, 0.0, .5); sh = min(sh, sphSoftShadow(p, K, s, 4.0)); }
    vec3 c = vec3(.035)*(vec3(2.6)*max(K.y, 0.0)*sh + vec3(.12)); return mix(c, studio(rd), smoothstep(3.5, 9.0, length(p.xz))); }
  return studio(rd); }`,

    /* Two crates: UV checker on the left, the finished material on the right. */
    texturing: SDF + `
vec3 C1 = vec3(-1.0, .5, 0.0), C2 = vec3(1.0, .5, 0.0);
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0); mat3 m = rY(.55);
  r = U(r, sdBox((p - C1)*m, vec3(.48)) - .02, 1.0); r = U(r, sdBox((p - C2)*rY(-.45), vec3(.48)) - .02, 2.0); return r; }
vec2 faceUV(vec3 q, vec3 n){ vec3 a = abs(n); return a.x > .5 ? q.zy : a.y > .5 ? q.xz : q.xy; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR;
  if (id < 1.5){ mat3 m = rY(.55); vec3 q = (p - C1)*m, nq = n*m; vec2 uv = faceUV(q, nq)*4.0 + 2.0; vec2 g = floor(uv); float ch = mod(g.x + g.y, 2.0);
    vec3 tint = mix(vec3(.9, .3, .2), vec3(.2, .5, .95), fract((g.x + g.y * 4.0) * .13)); vec2 f = abs(fract(uv) - .5); float line = step(.46, max(f.x, f.y));
    return mix(mix(vec3(.08), tint * .8, ch), vec3(.02), line); }
  mat3 m = rY(-.45); vec3 q = (p - C2)*m, nq = n*m; vec2 uv = faceUV(q, nq); float plank = floor(uv.y * 5.0 + 2.5); float grain = fbm(vec3(uv.x * 3.0, uv.y * 40.0, plank));
  vec3 wood = mix(vec3(.32, .17, .07), vec3(.5, .3, .14), grain) * (.8 + .2 * fract(plank * .37));
  vec3 aq = abs(q); float edge = step(.4, max(min(aq.x, aq.y), max(min(aq.y, aq.z), min(aq.x, aq.z))));
  float gap = smoothstep(.03, .0, abs(fract(uv.y * 5.0 + 2.5) - .5) - .45);
  return mix(wood * (1.0 - .6 * gap), vec3(.25, .26, .28), edge); }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(.0, 1.7, 4.4), vec3(0.0, .45, 0.0), 2.5, frag); }`,

    /* One packed mask and its four channels as tiles. */
    'texture-settings': '#define KEYDIR vec3(-.4, .85, .45)\n' + SDF + `
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  r = U(r, sdBox(p - vec3(-1.75, .06, .1), vec3(.62, .06, .62)) - .01, 1.0);
  for (int i = 0; i < 4; i++){ float fi = float(i); r = U(r, sdBox(p - vec3(-.4 + fi * .78, .05, .1), vec3(.33, .05, .33)) - .01, 2.0 + fi); }
  return r; }
float chan(int i, vec2 uv){
  if (i == 0) return step(.55, fbm(vec3(uv * 2.5, 1.0)));                                  /* metallic: patches */
  if (i == 1) return .35 + .65 * smoothstep(.2, .65, fbm(vec3(uv * 6.0, 4.0)));           /* AO */
  if (i == 2) return step(.0, sin(uv.x * 9.0) * sin(uv.y * 9.0));                          /* detail mask */
  return .25 + .6 * fbm(vec3(uv * 4.0, 7.0)); }                                            /* smoothness */
vec3 albedo(float id, vec3 p, vec3 n){ return id < .5 ? FLOOR : vec3(.03); }
vec3 emit(float id, vec3 p, vec3 n){ if (id < .5 || n.y < .5) return vec3(0.0);
  if (id < 1.5){ vec2 uv = (p.xz - vec2(-1.75, .1)) / 1.24 + .5; return vec3(chan(0, uv), chan(1, uv), chan(2, uv)) * .55; }
  int k = int(id - 1.5); vec2 uv = (p.xz - vec2(-.4 + float(k) * .78, .1)) / .66 + .5; float v = chan(k, uv);
  vec3 tint = k == 0 ? vec3(1.0, .25, .2) : k == 1 ? vec3(.3, 1.0, .35) : k == 2 ? vec3(.3, .5, 1.0) : vec3(.85);
  return v * tint * .5; }
vec3 render(vec2 frag){ return scene(vec3(-.15, 2.5, 2.9), vec3(-.15, .0, .1), 2.25, frag); }`
  });
  Object.assign(SCENES, {
    /* A smooth ramp next to the same ramp stored at a few bits: terraces. */
    'sd-graphs': '#define KEYDIR vec3(-.55, .75, .5)\n' + SDF + `
float wedge(vec3 p){ vec3 q = p - vec3(-1.05, 0.0, 0.0); float b = sdBox(q - vec3(0.0, .3, 0.0), vec3(.75, .3, .55)); return max(b, dot(q - vec3(-.75, 0.0, 0.0), normalize(vec3(-.6, 1.5, 0.0)))) ; }
float stairs(vec3 p){ vec3 q = p - vec3(1.05, 0.0, 0.0); float d = 1e9;
  for (int i = 0; i < 8; i++){ float fi = float(i); float x0 = -.75 + fi * .1875; float h = .075 * (fi + 1.0); d = min(d, sdBox(q - vec3(x0 + .09375, h * .5, 0.0), vec3(.09375, h * .5, .55))); }
  return d; }
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0); r = U(r, wedge(p) * .8, 1.0); r = U(r, stairs(p), 2.0); return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; if (id < 1.5) return vec3(.32, .33, .35); return n.y > .5 ? ORANGE * .75 : vec3(.3, .31, .33); }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(.4, 1.9, 3.9), vec3(0.0, .25, 0.0), 2.3, frag); }`,

    /* Stones merged with Max, half sunk into rippled sand. */
    'sd-blend': '#define KEYDIR vec3(-.6, .7, .4)\n' + SDF + `
float sand(vec3 p){ return p.y - (.04 + .025 * sin(p.x * 9.0 + 2.0 * fbm(vec3(p.xz * 1.3, 2.0))) + .03 * fbm(vec3(p.xz * 4.0, 5.0))); }
float stone(vec3 p, vec3 c, vec3 r){ vec3 q = (p - c) / r; return (length(q) - 1.0) * min(r.x, min(r.y, r.z)); }
float stones(vec3 p){ float d = 1e9;
  d = min(d, stone(p, vec3(-.9, .05, .1), vec3(.55, .3, .45)));
  d = min(d, stone(p, vec3(-.25, .02, -.35), vec3(.42, .26, .38)));
  d = min(d, stone(p, vec3(.45, .04, .2), vec3(.5, .32, .42)));
  d = min(d, stone(p, vec3(1.15, .0, -.25), vec3(.38, .24, .36)));
  d = min(d, stone(p, vec3(.1, -.02, .7), vec3(.34, .2, .3)));
  return d; }
vec2 map(vec3 p){ vec2 r = vec2(sand(p) * .6, 0.0); r = U(r, stones(p), 2.0); return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return vec3(.16, .11, .06) * (.8 + .3 * fbm(vec3(p.xz * 6.0, 1.0)));
  return mix(vec3(.07, .07, .075), vec3(.2, .19, .18), fbm(p * 5.0)); }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(.2, 2.1, 3.3), vec3(0.0, .05, 0.0), 2.2, frag); }`,

    /* Ridges bent by a directional warp, on a tile. */
    'sd-warps': '#define KEYDIR vec3(-.7, .55, .45)\n' + SDF + `
float ridgeH(vec2 xz){ float w = 1.4 * fbm(vec3(xz * .9, 3.0)); float s = sin((xz.x + w) * 11.0); return .09 * smoothstep(.2, .95, s); }
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  float b = sdBox(p - vec3(0.0, .08, 0.0), vec3(1.5, .08, 1.0));
  float top = p.y - .16 - ridgeH(p.xz);
  r = U(r, max(sdBox(p - vec3(0.0, .15, 0.0), vec3(1.5, .15, 1.0)), top * .5), 1.0);
  return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; float h = ridgeH(p.xz) / .09; return mix(vec3(.12, .12, .13), ORANGE * .8, smoothstep(.3, .9, h)); }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(.3, 2.4, 2.9), vec3(0.0, .1, 0.0), 2.2, frag); }`,

    /* Pebbles scattered by a seeded loop: one per cell, jittered, random size. */
    'sd-pixel-fx': '#define KEYDIR vec3(-.5, .8, .35)\n' + SDF + `
const float CELL = .34;
vec3 peb(vec2 c){ float r = .07 + .08 * hash12(c * 1.7 + 3.1); vec2 j = (vec2(hash12(c), hash12(c + 7.3)) - .5) * (CELL - 2.0 * r) ; return vec3(j, r); }
float pebbles(vec3 p){ vec2 c0 = floor(p.xz / CELL); float d = 1e9;
  for (int i = -1; i <= 1; i++) for (int k = -1; k <= 1; k++){ vec2 c = c0 + vec2(float(i), float(k)); if (length(c * CELL + CELL * .5) > 1.9) continue; vec3 q = peb(c);
    vec3 ctr = vec3(c.x * CELL + CELL * .5 + q.x, q.z * .35, c.y * CELL + CELL * .5 + q.y); vec3 e = (p - ctr) / vec3(q.z, q.z * .6, q.z); d = min(d, (length(e) - 1.0) * q.z * .6); }
  return d; }
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0); float b = sdBox(p - vec3(0.0, .1, 0.0), vec3(2.0, .12, 2.0)); r = U(r, b > .05 ? b : pebbles(p), 1.0); return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; vec2 c = floor(p.xz / CELL); float t = hash12(c + 11.0);
  return t > .9 ? ORANGE * .7 : mix(vec3(.06, .06, .065), vec3(.22, .21, .2), t); }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(.0, 2.6, 2.7), vec3(0.0, .0, .1), 2.2, frag); }`,

    /* The same tile at four output sizes: 64, 32, 16 and 8 texels across. */
    'sd-performance': '#define KEYDIR vec3(-.4, .85, .45)\n' + SDF + `
const float HS = .52;
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  for (int i = 0; i < 4; i++){ float fi = float(i); r = U(r, sdBox(p - vec3(-1.86 + fi * 1.24, .05, 0.0), vec3(HS, .05, HS)) - .01, 1.0 + fi); }
  return r; }
float pat(vec2 uv){ return smoothstep(.45, .6, fbm(vec3(uv * 3.0, 2.0))) * .8 + .2 * step(.5, fract(uv.x * 4.0)) * step(.5, fract(uv.y * 4.0)); }
vec3 albedo(float id, vec3 p, vec3 n){ return id < .5 ? FLOOR : vec3(.03); }
vec3 emit(float id, vec3 p, vec3 n){ if (id < .5 || n.y < .5) return vec3(0.0); float fk = floor(id - .5);
  vec2 uv = (p.xz - vec2(-1.86 + fk * 1.24, 0.0)) / (2.0 * HS) + .5; float res = 64.0 / pow(2.0, fk); uv = (floor(uv * res) + .5) / res;
  float v = pat(uv); return mix(vec3(.05, .05, .06), fk < .5 ? ORANGE * .9 : vec3(.75), v) * .6; }
vec3 render(vec2 frag){ return scene(vec3(0.0, 3.1, 2.5), vec3(0.0, .0, .05), 1.75, frag); }`,

    /* One material at three settings of its Wear input. */
    'sd-publish': '#define KEYDIR vec3(-.55, .7, .5)\n' + SDF + `
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0); for (int i = 0; i < 3; i++){ float fi = float(i); r = U(r, sdSphere(p - vec3(-1.25 + fi * 1.25, .5, 0.0), .5), 1.0 + fi); } return r; }
float wearMask(vec3 p, float w){ float n = fbm(p * 3.5) + .25 * fbm(p * 14.0); return smoothstep(.78 - .45 * w, .8 - .45 * w, n); }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; float w = (id - 1.0) * .5; vec3 c = vec3(-1.25 + (id - 1.0) * 1.25, .5, 0.0);
  float m = wearMask(p - c, w); vec3 paint = vec3(.05, .16, .32); vec3 rust = mix(vec3(.25, .08, .02), vec3(.5, .2, .05), fbm(p * 20.0)); return mix(paint, rust, m); }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(0.0, 1.3, 4.6), vec3(0.0, .45, 0.0), 2.6, frag); }`,

    /* A chain of references, one link broken open. */
    'unity-guids': '#define KEYDIR vec3(-.5, .8, .4)\n' + SDF + `
float sdLink(vec3 p, float le, float r1, float r2){ vec3 q = vec3(p.x, max(abs(p.y) - le, 0.0), p.z); return length(vec2(length(q.xy) - r1, q.z)) - r2; }
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  r = U(r, sdBox(p - vec3(-1.75, .25, 0.0), vec3(.25)) - .02, 1.0);
  r = U(r, sdBox(p - vec3(1.75, .25, 0.0), vec3(.25)) - .02, 1.0);
  for (int i = 0; i < 5; i++){ float fi = float(i); vec3 l = p - vec3(-1.2 + fi * .6, .25, 0.0); vec3 q = mod(fi, 2.0) > .5 ? vec3(l.z, l.x, l.y) : vec3(l.y, l.x, l.z);
    float d = sdLink(q, .12, .18, .045); if (i == 3) d = max(d, -sdBox(p - vec3(-1.2 + fi * .6 + .25, .25, 0.0), vec3(.06, .3, .3)));
    r = U(r, d, i == 3 ? 3.0 : 2.0); }
  return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; if (id < 1.5) return vec3(.3, .31, .33); if (id < 2.5) return vec3(.55, .56, .58); return ORANGE * .8; }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(.3, 1.4, 3.4), vec3(0.0, .25, 0.0), 2.3, frag); }`,

    /* One house prefab nested three times; one instance is the red variant. */
    'unity-prefabs': '#define KEYDIR vec3(-.6, .75, .45)\n' + SDF + `
float sdTriPrism(vec3 p, vec2 h){ vec3 q = abs(p); return max(q.z - h.y, max(q.x * .866025 + p.y * .5, -p.y) - h.x * .5); }
float house(vec3 p){ float d = sdBox(p - vec3(0.0, .3, 0.0), vec3(.36, .3, .3));
  d = min(d, sdTriPrism(p - vec3(0.0, .72, 0.0), vec2(.5, .34)) - .01);
  d = max(d, -sdBox(p - vec3(-.14, .24, .3), vec3(.07, .07, .04))); d = max(d, -sdBox(p - vec3(.14, .24, .3), vec3(.07, .07, .04)));
  return d; }
float roof(vec3 p){ return sdTriPrism(p - vec3(0.0, .72, 0.0), vec2(.5, .34)) - .01; }
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  for (int i = 0; i < 3; i++){ float fi = float(i); vec3 q = p - vec3(-1.15 + fi * 1.15, 0.0, -.2 + .25 * mod(fi, 2.0)); r = U(r, house(q), i == 1 ? 2.0 : 1.0); }
  return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; float isRoof = step(.6, p.y) ; vec3 wall = vec3(.3, .29, .28);
  vec3 rf = id > 1.5 ? RED * .8 : vec3(.22, .23, .25); return mix(wall, rf, isRoof); }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(.6, 1.6, 3.6), vec3(0.0, .4, 0.0), 2.4, frag); }`,

    /* Scene layers loaded on top of each other. */
    'unity-scenes': '#define KEYDIR vec3(-.45, .85, .4)\n' + SDF + `
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  r = U(r, sdBox(p - vec3(0.0, .05, 0.0), vec3(1.4, .04, .9)) - .01, 1.0);
  r = U(r, sdBox(p - vec3(.15, .55, -.1), vec3(1.2, .03, .75)) - .01, 2.0);
  r = U(r, sdBox(p - vec3(.3, 1.05, -.2), vec3(1.0, .03, .6)) - .01, 3.0);
  r = U(r, sdBox(p - vec3(-.6, .2, .2), vec3(.12)), 1.0); r = U(r, sdSphere(p - vec3(.7, .22, -.2), .14), 1.0);
  r = U(r, sdBox(p - vec3(-.3, .68, -.3), vec3(.1, .1, .1)), 2.0); r = U(r, sdSphere(p - vec3(.6, .7, .1), .12), 2.0);
  r = U(r, sdCapsule(p - vec3(.1, 1.08, -.2), vec3(-.3, .0, 0.0), vec3(.3, .0, 0.0), .06), 3.0);
  return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; if (id < 1.5) return vec3(.3, .31, .33); if (id < 2.5) return vec3(.45, .46, .48); return ORANGE * .8; }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(1.0, 2.2, 3.6), vec3(.1, .5, -.1), 2.3, frag); }`,

    /* Content packed in bundles; one opened on demand. */
    'unity-addressables': '#define KEYDIR vec3(-.5, .8, .45)\n' + SDF + `
float crate(vec3 p){ return min(sdBox(p, vec3(.26)) , sdBoxFrame(p, vec3(.28), .035)); }
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  for (int i = 0; i < 3; i++) for (int k = 0; k < 2; k++){ float fi = float(i), fk = float(k); vec3 c = vec3(-.85 + fi * .85, .28, -.35 + fk * .75);
    if (i == 1 && k == 1){ float d = max(sdBox(p - c, vec3(.28)), -sdBox(p - c - vec3(0.0, .1, 0.0), vec3(.24, .3, .24))); r = U(r, d, 1.0);
      r = U(r, sdBox(p - c - vec3(0.0, .3, 0.0), vec3(.12)), 3.0); r = U(r, sdBox((p - c - vec3(0.0, .42, -.36)) * rX(-1.0), vec3(.28, .02, .28)), 1.0); }
    else r = U(r, crate(p - c), 1.0 + step(.5, fract((fi + fk * 3.0) * .37)) ); }
  return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; if (id < 1.5) return vec3(.33, .3, .27); if (id < 2.5) return vec3(.42, .4, .37); return ORANGE * .8; }
vec3 emit(float id, vec3 p, vec3 n){ return id > 2.5 ? ORANGE * .35 : vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(.5, 2.0, 3.0), vec3(0.0, .25, .1), 2.3, frag); }`
  });
  /* Surfaces units: analytic spheres, panes and water. Shared shading in SURF. */
  const SURF = `
vec3 KS = normalize(vec3(-.55, .7, .5));
float Dg2(float noh, float a){ float a2 = a*a; float d = noh*noh*(a2 - 1.0) + 1.0; return a2/(PI*d*d); }
vec3 schl(vec3 f0, float mu){ return f0 + (1.0 - f0)*pow(1.0 - mu, 5.0); }
vec3 f82t(vec3 f0, vec3 tint, float mu){ float mb = 1.0/7.0; vec3 sb = schl(f0, mb); return max(schl(f0, mu) - mu*pow(1.0 - mu, 6.0)*(1.0 - tint)*sb/(mb*pow(1.0 - mb, 6.0)), vec3(0.0)); }
float fresD(float ci, float n){ ci = clamp(ci, 0.0, 1.0); float s2 = 1.0 - ci*ci; float t = 1.0 - s2/(n*n); if (t <= 0.0) return 1.0; float ct = sqrt(t); float rs = (ci - n*ct)/(ci + n*ct), rp = (n*ci - ct)/(n*ci + ct); return .5*(rs*rs + rp*rp); }
vec3 envS(vec3 r, float rough){ vec3 c = studio(r)*3.0 + vec3(.5, .55, .65)*smoothstep(.1, 1.0, r.y)*(1.0 - rough*.6);
  c += vec3(3.4)*smoothstep(.965 - rough*.45, 1.0, dot(r, normalize(vec3(.5, .55, .7))))*(1.0 - rough*.7);
  c += vec3(1.5, 1.4, 1.3)*smoothstep(.975 - rough*.45, 1.0, dot(r, normalize(vec3(-.85, .25, .45))))*(1.0 - rough*.7);
  return c; }
vec3 shadeS(vec3 rd, vec3 n, float rough, float metal, vec3 base, vec3 tint){
  vec3 v = -rd, l = KS, h = normalize(l + v); float nol = max(dot(n, l), 0.0), nov = max(dot(n, v), 1e-3), noh = max(dot(n, h), 0.0), voh = max(dot(v, h), 0.0);
  float a = max(rough*rough, .002);
  vec3 F = mix(schl(vec3(.04), voh), f82t(base, tint, voh), metal);
  float k = (rough + 1.0)*(rough + 1.0)/8.0; float G = (nol/(nol*(1.0 - k) + k))*(nov/(nov*(1.0 - k) + k));
  vec3 spec = Dg2(noh, a)*F*G/(4.0*nol*nov + 1e-3); vec3 kd = (1.0 - F)*(1.0 - metal);
  vec3 c = (kd*base/PI + spec)*vec3(3.2, 3.0, 2.8)*nol;
  vec3 Fe = mix(vec3(.04) + (max(vec3(1.0 - rough), vec3(.04)) - .04)*pow(1.0 - nov, 5.0), f82t(base, tint, nov), metal);
  return c + envS(reflect(rd, n), rough)*Fe*mix(.4, .9, metal) + kd*base*mix(vec3(.04), vec3(.12, .14, .18), n.y*.5 + .5); }
vec3 floorS(vec3 p, vec3 rd, float sh){ vec3 c = vec3(.035)*(vec3(2.6)*max(KS.y, 0.0)*sh + vec3(.12)); return mix(c, studio(rd), smoothstep(3.5, 9.0, length(p.xz))); }
mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
`;
  Object.assign(SCENES, {
    /* Three spheres: a diffuse map with light painted in, an albedo, a metal base colour. */
    'pbr-terms': SURF + `
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, 1.0, 5.2); mat3 cam = lookAt(ro, vec3(0.0, .5, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.6));
  vec3 alb = vec3(.55, .22, .08); float tb = 1e9; vec3 col = vec3(0.0); bool hit = false;
  for (int i = 0; i < 3; i++){ vec4 s = vec4(-1.35 + float(i)*1.35, .56, 0.0, .56); vec2 q = sphIntersect(ro, rd, s);
    if (q.x > 0.0 && q.x < tb){ tb = q.x; hit = true; vec3 n = normalize(ro + rd*q.x - s.xyz);
      if (i == 0){ float baked = .22 + .78*max(dot(n, normalize(vec3(.75, .55, .35))), 0.0); float hl = pow(max(dot(n, normalize(vec3(.45, .55, .7))), 0.0), 40.0)*.5;
        col = (alb*baked + hl)*(max(dot(n, KS), 0.0)*2.4 + .12); }
      else if (i == 1) col = shadeS(rd, n, .7, 0.0, alb, vec3(1.0));
      else col = shadeS(rd, n, .22, 1.0, vec3(1.0, .71, .31), vec3(.94, .97, .91)); } }
  if (hit) return col;
  if (rd.y < 0.0){ float t = -ro.y/rd.y; vec3 p = ro + rd*t; float sh = 1.0;
    for (int i = 0; i < 3; i++) sh = min(sh, sphSoftShadow(p, KS, vec4(-1.35 + float(i)*1.35, .56, 0.0, .56), 4.0));
    return floorS(p, rd, sh); }
  return studio(rd); }`,

    /* Gold, copper, brushed aluminium and rusted iron. */
    metals: SURF + `
vec3 brushed(vec3 rd, vec3 n){ vec3 t = normalize(cross(n, vec3(0.0, 1.0, 0.0)) + vec3(1e-4)); vec3 r = reflect(rd, n); vec3 e = vec3(0.0);
  for (int i = 0; i < 9; i++){ float o = (float(i) - 4.0)*.07; e += envS(normalize(r + t*o), .12); } e /= 9.0;
  vec3 base = vec3(.92, .92, .93); float nov = max(dot(n, -rd), 1e-3);
  vec3 c = shadeS(rd, n, .38, 1.0, base, vec3(.96, .97, .98)); return c*.55 + e*f82t(base, vec3(.96, .97, .98), nov)*.45; }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, 1.0, 5.6); mat3 cam = lookAt(ro, vec3(0.0, .52, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.6));
  float tb = 1e9; vec3 col = vec3(0.0); bool hit = false;
  for (int i = 0; i < 4; i++){ vec4 s = vec4(-1.8 + float(i)*1.2, .52, 0.0, .5); vec2 q = sphIntersect(ro, rd, s);
    if (q.x > 0.0 && q.x < tb){ tb = q.x; hit = true; vec3 p = ro + rd*q.x, n = normalize(p - s.xyz);
      if (i == 0) col = shadeS(rd, n, .14, 1.0, vec3(1.0, .71, .31), vec3(.94, .97, .91));
      else if (i == 1) col = shadeS(rd, n, .3, 1.0, vec3(1.0, .65, .53), vec3(.97, .94, .93));
      else if (i == 2) col = brushed(rd, n);
      else { float m = smoothstep(.48, .56, fbm(p*5.0 + 2.0)); col = mix(shadeS(rd, n, .85, 0.0, vec3(.22, .07, .03), vec3(1.0)), shadeS(rd, n, .32, 1.0, vec3(.9, .88, .82), vec3(.93, .95, .95)), m); } } }
  if (hit) return col;
  if (rd.y < 0.0){ float t = -ro.y/rd.y; vec3 p = ro + rd*t; float sh = 1.0;
    for (int i = 0; i < 4; i++) sh = min(sh, sphSoftShadow(p, KS, vec4(-1.8 + float(i)*1.2, .52, 0.0, .5), 4.0));
    return floorS(p, rd, sh); }
  return studio(rd); }`,

    /* A chrome sphere and a red ball on a glossy tiled floor that reflects them. */
    reflections: SURF + `
vec4 S1 = vec4(-.35, .75, 0.0, .75), S2 = vec4(1.25, .38, .7, .38);
vec3 tileCol(vec3 p){ vec2 g = floor(p.xz*1.6); float c = mod(g.x + g.y, 2.0); return mix(vec3(.025), vec3(.07, .072, .08), c); }
float tileGap(vec3 p){ vec2 f = abs(fract(p.xz*1.6) - .5); return smoothstep(.47, .5, max(f.x, f.y)); }
vec3 floorDiffuse(vec3 p){ float sh = min(sphSoftShadow(p, KS, S1, 4.0), sphSoftShadow(p, KS, S2, 4.0)); return tileCol(p)*(1.0 - tileGap(p)*.7)*(vec3(2.6)*max(KS.y, 0.0)*sh + vec3(.15)); }
vec3 ballCol(vec3 ro, vec3 rd, int which, float t){ vec3 p = ro + rd*t;
  if (which == 2) { vec3 n = normalize(p - S2.xyz); return shadeS(rd, n, .3, 0.0, vec3(.6, .05, .04), vec3(1.0)); }
  vec3 n = normalize(p - S1.xyz); vec3 r = reflect(rd, n); vec3 e;
  vec2 q2 = sphIntersect(p, r, S2);
  if (q2.x > 0.0) e = shadeS(r, normalize(p + r*q2.x - S2.xyz), .3, 0.0, vec3(.6, .05, .04), vec3(1.0));
  else if (r.y < 0.0) { float tf = -p.y/r.y; e = floorDiffuse(p + r*tf); }
  else e = envS(r, .03);
  vec3 F = f82t(vec3(.95), vec3(.97), max(dot(n, -rd), 0.0));
  return e*F + shadeS(rd, n, .05, 1.0, vec3(.95), vec3(.97))*.15; }
vec3 trace(vec3 ro, vec3 rd, out float tOut, out int which){ which = 0; tOut = 1e9;
  vec2 a = sphIntersect(ro, rd, S1); if (a.x > 0.0) { tOut = a.x; which = 1; }
  vec2 b = sphIntersect(ro, rd, S2); if (b.x > 0.0 && b.x < tOut) { tOut = b.x; which = 2; }
  return vec3(0.0); }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(.3, 1.25, 5.4); mat3 cam = lookAt(ro, vec3(.2, .45, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.5));
  float t; int w; trace(ro, rd, t, w);
  float tf = rd.y < 0.0 ? -ro.y/rd.y : 1e9;
  if (w > 0 && t < tf) return ballCol(ro, rd, w, t);
  if (rd.y < 0.0){ vec3 p = ro + rd*tf; vec3 n = vec3(0.0, 1.0, 0.0);
    vec3 nn = normalize(n + vec3(noise3(p*9.0) - .5, 0.0, noise3(p*9.0 + 3.0) - .5)*.015);
    vec3 r = reflect(rd, nn); float t2; int w2; trace(p + nn*.001, r, t2, w2);
    vec3 refl = w2 > 0 ? ballCol(p, r, w2, t2) : envS(r, .06);
    float F = fresD(dot(-rd, n), 1.5)*(1.0 - tileGap(p));
    vec3 c = floorDiffuse(p)*(1.0 - F) + refl*mix(F, .35, .25);
    return mix(c, studio(rd), smoothstep(4.0, 10.0, length(p.xz))); }
  return studio(rd); }`,

    /* A solid glass ball, a hollow bulb and a green-edged pane in front of a checker wall. */
    glass: SURF + `
vec3 bg(vec3 ro, vec3 rd){
  float tw = rd.z < 0.0 ? (-2.2 - ro.z)/rd.z : 1e9; float tf = rd.y < 0.0 ? -ro.y/rd.y : 1e9;
  if (tw < tf){ vec3 p = ro + rd*tw; vec2 g = floor(p.xy*2.2); float c = mod(g.x + g.y, 2.0); vec3 a = mix(vec3(.05, .06, .08), vec3(.42, .44, .46), c);
    return a*(1.1 - .35*smoothstep(1.5, 3.5, p.y)); }
  if (tf < 1e8){ vec3 p = ro + rd*tf; vec2 g = floor(p.xz*1.4); float c = mod(g.x + g.y, 2.0); return mix(vec3(.03), vec3(.16, .15, .14), c)*mix(1.0, .2, smoothstep(2.0, 7.0, length(p.xz))); }
  return studio(rd); }
vec3 ball(vec3 ro, vec3 rd, vec4 s, float t){ vec3 p = ro + rd*t, n = normalize(p - s.xyz);
  float F = fresD(dot(-rd, n), 1.5); vec3 refl = envS(reflect(rd, n), .02);
  vec3 r1 = refract(rd, n, 1.0/1.5); vec2 q = sphIntersect(p + r1*.002, r1, s); vec3 p2 = p + r1*(q.y + .002); vec3 n2 = normalize(p2 - s.xyz);
  vec3 r2 = refract(r1, -n2, 1.5); if (dot(r2, r2) < .01) r2 = reflect(r1, -n2);
  vec3 tr = bg(p2, r2)*vec3(.92, .96, .95); return refl*F + tr*(1.0 - F) + shadeS(rd, n, .03, 0.0, vec3(0.0), vec3(1.0))*.6; }
vec3 bulb(vec3 ro, vec3 rd, vec4 s, float t){ vec3 p = ro + rd*t, n = normalize(p - s.xyz);
  float F = fresD(dot(-rd, n), 1.5); vec2 q = sphIntersect(ro, rd, s); vec3 pb = ro + rd*q.y, nb = normalize(pb - s.xyz); float F2 = fresD(dot(rd, nb), 1.5);
  vec3 tr = bg(pb, rd)*(1.0 - F2); return envS(reflect(rd, n), .02)*F + envS(reflect(rd, -nb), .05)*F2*.6 + tr*(1.0 - F) + shadeS(rd, n, .03, 0.0, vec3(0.0), vec3(1.0))*.6; }
vec3 pane(vec3 ro, vec3 rd, out float tHit){ mat3 m = rotY(.75); vec3 c = vec3(1.65, .72, -.2); vec3 lo = (ro - c)*m, ld = rd*m; vec3 nl; vec3 h = vec3(.62, .7, .045);
  float t = boxIntersect(lo, ld, h, nl); tHit = t; if (t < 0.0) return vec3(0.0);
  vec3 dummy; vec3 m2 = 1.0/ld; vec3 k = abs(m2)*h; vec3 t2 = -m2*lo + k; float tF = min(min(t2.x, t2.y), t2.z);
  float L = max(tF - t, 0.0); vec3 T = exp(-vec3(2.2, .32, 1.3)*L*1.6);
  vec3 n = m*nl; float F = fresD(abs(dot(-rd, n)), 1.5); vec3 p = ro + rd*t;
  return envS(reflect(rd, n), .02)*F*1.6 + bg(ro + rd*(tF + .001), rd)*T*(1.0 - F); }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, 1.05, 5.0); mat3 cam = lookAt(ro, vec3(0.0, .6, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.5));
  vec4 sA = vec4(-1.55, .62, .1, .62), sB = vec4(.0, .62, .1, .62);
  float tp; vec3 pc = pane(ro, rd, tp);
  vec2 qa = sphIntersect(ro, rd, sA), qb = sphIntersect(ro, rd, sB);
  float best = 1e9; int w = 0;
  if (qa.x > 0.0) { best = qa.x; w = 1; } if (qb.x > 0.0 && qb.x < best) { best = qb.x; w = 2; } if (tp > 0.0 && tp < best) { best = tp; w = 3; }
  if (w == 1) return ball(ro, rd, sA, best);
  if (w == 2) return bulb(ro, rd, sB, best);
  if (w == 3) return pc;
  return bg(ro, rd); }`,

    /* A frosted, tinted panel in front of a striped wall, with a pillar in front of it. */
    'screen-transparency': SURF + `
vec3 wall(vec2 xy, float blur){ float s = smoothstep(-blur, blur, sin(xy.x*6.0)); vec3 c = mix(vec3(.08, .2, .38), vec3(.62, .48, .2), s);
  float d = length(xy - vec2(.55, .95)); c = mix(c, vec3(.6, .07, .05), smoothstep(.36 + blur*.2, .33 - blur*.2, d)); return c*(1.0 - .3*smoothstep(1.4, 2.6, xy.y)); }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(-.2, 1.0, 4.6); mat3 cam = lookAt(ro, vec3(-.1, .95, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.4));
  vec3 nb; float tpil = boxIntersect(ro - vec3(.55, 1.0, .9), rd, vec3(.16, 1.0, .16), nb);
  float tpan = rd.z < 0.0 ? (0.0 - ro.z)/rd.z : -1.0; vec3 pp = ro + rd*tpan; bool inPanel = tpan > 0.0 && pp.x > -1.75 && pp.x < 1.35 && pp.y > .2 && pp.y < 1.85;
  float twall = (-1.4 - ro.z)/rd.z; float tfl = rd.y < 0.0 ? -ro.y/rd.y : 1e9;
  if (tpil > 0.0){ vec3 p = ro + rd*tpil; return shadeS(rd, nb, .6, 0.0, vec3(.35, .34, .33), vec3(1.0)); }
  vec3 back;
  if (tfl < twall){ vec3 p = ro + rd*tfl; back = vec3(.04)*(vec3(2.4)*KS.y + .15); back = mix(back, studio(rd), smoothstep(3.0, 8.0, length(p.xz))); }
  else { vec3 p = ro + rd*twall; back = wall(p.xy, .02)*1.4; }
  if (!inPanel || tfl < tpan) return back;
  vec2 nn = vec2(noise3(vec3(pp.xy*7.0, 1.0)), noise3(vec3(pp.xy*7.0, 4.0))) - .5;
  vec3 pw = ro + rd*twall; vec3 behind = wall(pw.xy + nn*.12, .9)*1.4;
  float edge = smoothstep(.0, .03, min(min(pp.x + 1.75, 1.35 - pp.x), min(pp.y - .2, 1.85 - pp.y)));
  float F = fresD(abs(rd.z), 1.5);
  vec3 c = behind*vec3(.62, .82, .9) + vec3(.035, .045, .05) + envS(reflect(rd, vec3(0.0, 0.0, 1.0)), .25)*F*.8;
  return mix(vec3(.75, .85, .9)*.9, c, edge); }`,

    /* A shallow shore: sand fading into blue-green depth, foam at the edge, caustics on the bottom. */
    water: SURF + `
vec3 SUN = normalize(vec3(.35, .55, -.75));
vec3 sky(vec3 rd){ float y = max(rd.y, 0.0); vec3 c = mix(vec3(.85, .9, .98)*.85, vec3(.16, .34, .75)*.8, pow(y, .45)); c += vec3(14.0, 12.0, 9.0)*pow(max(dot(rd, SUN), 0.0), 900.0) + vec3(.6, .5, .35)*pow(max(dot(rd, SUN), 0.0), 12.0); return c; }
float shoreZ(float x){ return 1.2 + .35*sin(x*.9) + .15*sin(x*2.3 + 1.0); }
float bed(vec2 xz){ return (xz.y - shoreZ(xz.x))*.2 + .03*sin(xz.x*3.0 + xz.y*2.0); }
vec2 wgrad(vec2 xz){ vec2 g = vec2(0.0); vec2 d[4]; d[0] = vec2(.8, .6); d[1] = vec2(-.4, .9); d[2] = vec2(.95, -.3); d[3] = vec2(.2, 1.0);
  for (int i = 0; i < 4; i++){ float k = 2.0 + float(i)*2.3, a = .012/(1.0 + float(i)*.6); g += d[i]*k*a*cos(dot(d[i], xz)*k + float(i)*1.7); } return g; }
float caustic(vec2 p){ float c = 0.0; for (int i = 0; i < 3; i++){ vec2 q = p*(2.4 + float(i)*1.3) + float(i)*3.1; c += abs(sin(q.x + sin(q.y*1.3))*sin(q.y + sin(q.x*1.1))); } return pow(1.0 - c/3.0, 5.0)*5.0; }
vec3 sand(vec3 p, float lightT){ float n = noise3(p*14.0)*.15 + noise3(p*3.0)*.1; vec3 a = vec3(.62, .52, .36)*(.85 + n); return a*(vec3(1.5, 1.4, 1.25)*max(SUN.y, 0.0)*lightT + vec3(.16, .2, .27)); }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, 1.55, 4.4); mat3 cam = lookAt(ro, vec3(0.0, -.15, -.6)); vec3 rd = cam*normalize(vec3(uv, 2.2));
  float tw = rd.y < 0.0 ? -ro.y/rd.y : 1e9;
  float t = .1, tb = -1.0; for (int i = 0; i < 90; i++){ vec3 p = ro + rd*t; float h = p.y - bed(p.xz); if (h < .002){ tb = t; break; } t += max(h*.5, .01); if (t > 40.0) break; }
  if (tb > 0.0 && tb < tw){ vec3 p = ro + rd*tb; float wet = smoothstep(.12, 0.0, p.y); return sand(p, 1.0)*mix(1.0, .62, wet); }
  if (tw > 1e8) return sky(rd);
  vec3 p = ro + rd*tw; vec2 g = wgrad(p.xz); vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  float F = fresD(dot(-rd, n), 1.333); vec3 refl = sky(reflect(rd, n));
  vec3 r = refract(rd, n, 1.0/1.333); float s = .02, L = 30.0; for (int i = 0; i < 70; i++){ vec3 q = p + r*s; float h = q.y - bed(q.xz); if (h < .002){ L = s; break; } s += max(h*.6, .01); if (s > 30.0) break; }
  vec3 pb = p + r*L; float depth = max(-bed(p.xz), 0.0);
  vec3 a = vec3(.45, .09, .03)*1.6, T = exp(-a*L), Tsun = exp(-a*max(-pb.y, 0.0)/max(SUN.y, .2));
  vec3 bottom = sand(pb, 1.0)*Tsun*(1.0 + caustic(pb.xz)*exp(-max(-pb.y, 0.0)*.8)*.7);
  vec3 scat = vec3(.01, .07, .1);
  vec3 under = bottom*T + scat*(1.0 - T);
  vec3 c = mix(under, refl, F);
  float foam = smoothstep(.06, .0, depth)*smoothstep(.35, .6, noise3(vec3(p.xz*9.0, 2.0)) + .3*smoothstep(.04, .0, depth));
  c = mix(c, vec3(1.9, 1.95, 2.0)*max(SUN.y, 0.0) + .3, foam*.85);
  return mix(c, sky(rd)*.9, smoothstep(14.0, 40.0, tw))*.85; }`
  });
  Object.assign(SCENES, {
    /* Sphere tracing: a smooth blob and a torus, with one ray's steps drawn as shrinking spheres. */
    'ray-marching': SURF + `
float smin(float a, float b, float k){ float h = clamp(.5 + .5*(b - a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0 - h); }
vec3 TC = vec3(1.25, .65, -.25);
float sdTor(vec3 p){ vec3 q = p - TC; q = rotY(.35)*q; vec2 t = vec2(length(q.xy) - .48, q.z); return length(t) - .17; }
float sdBlob(vec3 p){ return smin(length(p - vec3(-.95, .55, -.3)) - .55, length(p - vec3(-.25, .3, -.65)) - .3, .3); }
float map(vec3 p){ return min(min(sdBlob(p), sdTor(p)), p.y); }
vec3 nrm(vec3 p){ vec2 e = vec2(.001, 0.0); return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx))); }
float shad(vec3 ro, vec3 rd){ float r = 1.0, t = .02; for (int i = 0; i < 40; i++){ float h = min(sdBlob(ro + rd*t), sdTor(ro + rd*t)); r = min(r, 8.0*h/t); t += clamp(h, .02, .3); if (h < .001 || t > 6.0) break; } return clamp(r, 0.0, 1.0); }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(-.1, 1.35, 5.0); mat3 cam = lookAt(ro, vec3(.05, .5, -.2)); vec3 rd = cam*normalize(vec3(uv, 2.7));
  float t = 0.0, ts = 1e9; for (int i = 0; i < 110; i++){ float d = map(ro + rd*t); if (d < .0005*t){ ts = t; break; } t += d; if (t > 30.0) break; }
  vec3 col = studio(rd);
  if (ts < 1e8){ vec3 p = ro + rd*ts, n = nrm(p);
    if (p.y < min(sdBlob(p), sdTor(p))){ float sh = shad(p + n*.002, KS); col = floorS(p, rd, sh); }
    else { float sh = shad(p + n*.004, KS); bool tor = sdTor(p) < sdBlob(p);
      col = tor ? shadeS(rd, n, .22, 1.0, vec3(.92, .93, .95), vec3(.96)) : shadeS(rd, n, .45, 0.0, vec3(.5, .14, .04), vec3(1.0));
      col *= mix(.35, 1.0, sh); } }
  vec3 A = vec3(-3.2, .62, 1.1); vec3 D = normalize(TC + vec3(0.0, .47, 0.0) - A);
  vec3 G = vec3(.16, .62, .1);
  float tr = 0.0; vec3 add = vec3(0.0);
  for (int i = 0; i < 26; i++){ vec3 p = A + D*tr; float d = map(p);
    vec2 q = sphIntersect(ro, rd, vec4(p, max(d, .02)));
    if (q.x > 0.0 && q.x < ts){ vec3 n = normalize(ro + rd*q.x - p); float rim = pow(1.0 - abs(dot(n, rd)), 3.0); add += G*(.025 + rim*.4); }
    vec2 c = sphIntersect(ro, rd, vec4(p, .028)); if (c.x > 0.0 && c.x < ts) add += G*2.0;
    if (d < .002) break; tr += d; }
  vec3 B = A + D*tr; vec3 w = ro - A; float b = dot(rd, D), dd = dot(rd, w), e = dot(D, w), den = 1.0 - b*b;
  float sc = (b*e - dd)/den, tc = clamp((e - b*dd)/den, 0.0, tr); sc = dot(A + D*tc - ro, rd);
  float dist = length(ro + rd*sc - (A + D*tc)); if (sc < ts + .01) add += G*.9*exp(-dist*dist*9000.0) + G*.12*exp(-dist*90.0);
  return col + add; }`,

    /* Parallax occlusion on one flat quad: cobblestones with depth, the quad's silhouette still flat. */
    fpom: SURF + `
vec2 h22(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))))*43758.5453); }
vec3 vor(vec2 x){ vec2 n = floor(x), f = fract(x); float f1 = 8.0, f2 = 8.0; vec2 id = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){ vec2 g = vec2(float(i), float(j)); vec2 o = .5 + .38*(h22(n + g) - .5)*2.0; vec2 r = g + o - f; float d = dot(r, r);
    if (d < f1){ f2 = f1; f1 = d; id = n + g; } else if (d < f2) f2 = d; }
  return vec3(sqrt(f2) - sqrt(f1), id); }
float HT(vec2 xz){ vec3 v = vor(xz*2.4); float s = smoothstep(0.0, .32, v.x); return pow(s, .55)*(.82 + .18*h22(v.yz).x) + .04*noise3(vec3(xz*14.0, 1.0)); }
const float DEPTH = .14;
bool inPatch(vec2 xz){ return abs(xz.x) < 2.6 && xz.y > -2.6 && xz.y < 1.35; }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(.4, 1.45, 3.5); mat3 cam = lookAt(ro, vec3(-.1, 0.0, -.55)); vec3 rd = cam*normalize(vec3(uv, 2.35));
  if (rd.y >= 0.0) return studio(rd);
  float t0 = -ro.y/rd.y; vec3 p0 = ro + rd*t0;
  if (!inPatch(p0.xz)){ vec3 c = floorS(p0, rd, 1.0); vec2 e = abs(p0.xz - vec2(0.0, -.625)) - vec2(2.6, 1.975); float edge = length(max(e, 0.0)); return c + vec3(.16, .6, .1)*.25*exp(-edge*60.0); }
  float lt = 0.0, lh = 1.0, ph = 0.0; vec3 p = p0; float tPrev = 0.0;
  float tMax = DEPTH/max(-rd.y, .05); float hit = tMax;
  for (int i = 0; i < 40; i++){ float tt = tMax*float(i)/39.0; vec3 q = p0 + rd*tt; float surf = -DEPTH*(1.0 - HT(q.xz)); if (q.y < surf){ float a = tPrev, b = tt;
      for (int k = 0; k < 5; k++){ float m = .5*(a + b); vec3 qm = p0 + rd*m; if (qm.y < -DEPTH*(1.0 - HT(qm.xz))) b = m; else a = m; } hit = .5*(a + b); break; } tPrev = tt; }
  vec3 ph3 = p0 + rd*hit; vec2 xz = ph3.xz; float h = HT(xz); vec2 e = vec2(.004, 0.0);
  vec3 n = normalize(vec3(-(HT(xz + e.xy) - HT(xz - e.xy))*DEPTH/(2.0*e.x), 1.0, -(HT(xz + e.yx) - HT(xz - e.yx))*DEPTH/(2.0*e.x)));
  vec3 v = vor(xz*2.4); float tone = h22(v.yz).y;
  vec3 stone = mix(vec3(.16, .15, .13), vec3(.32, .29, .25), tone)*(.8 + .4*fbm(vec3(xz*9.0, 2.0)));
  vec3 alb = mix(vec3(.05, .045, .035), stone, smoothstep(.05, .35, h));
  float sh = 1.0; for (int i = 1; i < 10; i++){ vec3 q = ph3 + KS*float(i)*.012; float s = -DEPTH*(1.0 - HT(q.xz)); sh = min(sh, clamp((q.y - s)*60.0 + .1, 0.0, 1.0)); }
  vec3 c = shadeS(rd, n, mix(.85, .5, h), 0.0, alb, vec3(1.0))*mix(.25, 1.0, sh)*mix(.45, 1.0, h);
  return mix(c, studio(rd), smoothstep(4.0, 9.0, length(ph3.xz))); }`,

    /* One grey iris mask under four picked tints; above each, the raw pick, below, what the clamp lets through. */
    'color-tint': `
const vec3 WY = vec3(.2126, .7152, .0722);
vec3 plaus(vec3 c){ float y = max(dot(c, WY), 1e-5); vec3 h = c/y; float y2 = clamp(y, .006, .32); float sm = mix(.88, .55, smoothstep(.03, .30, y2));
  float mx = max(h.r, max(h.g, h.b)), mn = min(h.r, min(h.g, h.b)); if ((mx - mn)/mx > sm){ float k = sm/((mx - mn) - sm*(mx - 1.0)); h = mix(vec3(1.0), h, k); } return h*y2; }
float irisMask(vec2 q, float seed){ float r = length(q), a = atan(q.y, q.x);
  float fib = fbm(vec3(a*7.0, r*2.2, seed))*.6 + .55*noise3(vec3(a*38.0, r*3.0, seed + 4.0));
  float col = exp(-pow((r - .42)*9.0, 2.0))*.5;
  float crypt = smoothstep(.62, .78, fbm(vec3(q*6.0, seed + 9.0)))*smoothstep(.36, .5, r)*.55;
  float g = .16 + .2*fib + col*.25 - crypt*.18; g *= mix(1.0, .25, smoothstep(.82, 1.0, r));
  return g; }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 c = vec3(.006, .0065, .008)*(1.0 - .25*length(uv));
  vec3 picks[4]; picks[0] = vec3(.01, 1.0, .06); picks[1] = vec3(.02, .22, 1.0); picks[2] = vec3(.12, .03, .004); picks[3] = vec3(.3, .16, .01);
  for (int i = 0; i < 4; i++){ vec2 cen = vec2(-1.86 + float(i)*1.24, -.06); vec2 q = (uv - cen)/.5; float r = length(q);
    vec3 tint = plaus(picks[i]);
    if (r < 1.0){ float pr = .3; float g = irisMask(q, float(i)*3.7 + 1.0)/.214; vec3 ir = tint*g; ir *= smoothstep(pr, pr + .03, r);
      ir *= .55 + .55*clamp(dot(normalize(vec3(q, .9)), normalize(vec3(-.4, .6, .7))), 0.0, 1.0);
      float hl = exp(-dot(q - vec2(-.32, .34), q - vec2(-.32, .34))*55.0)*2.5; c = ir*1.4 + vec3(hl); }
    c = mix(c, vec3(.0), smoothstep(.98, 1.02, r)*smoothstep(1.12, 1.03, r)*.6);
    vec2 s = uv - (cen + vec2(0.0, .74)); if (abs(s.x) < .3 && abs(s.y) < .07) c = picks[i]*.7;
    s = uv - (cen + vec2(0.0, -.74)); if (abs(s.x) < .3 && abs(s.y) < .07) c = tint*1.4; }
  return c; }`,

    /* An eye in close-up: refraction at the cornea, then a short march to a coned iris with a collarette. */
    eyes: SURF + `
const float RL = .48, ZL = .877, RC = .65, IOR = 1.336;
const float ZI = .835, CONE = .05, COLL = .012, PUP = .3;
float zc(){ return ZL - sqrt(RC*RC - RL*RL); }
float prof(float r){ if (r < PUP) return -1.0; float s = clamp((1.0 - r)/(1.0 - PUP), 0.0, 1.0); float rc = mix(PUP, 1.0, .35); return CONE*s*s*(3.0 - 2.0*s) + COLL*exp(-pow((r - rc)*12.0, 2.0)); }
vec3 irisCol(vec2 q){ float r = length(q), a = atan(q.y, q.x);
  float fib = fbm(vec3(a*7.0, r*2.4, 3.0))*.6 + .55*noise3(vec3(a*40.0, r*3.0, 7.0));
  float crypt = smoothstep(.6, .78, fbm(vec3(q*7.0, 11.0)))*smoothstep(.4, .55, r);
  vec3 outer = vec3(.06, .13, .15), inner = vec3(.22, .12, .035);
  vec3 c = mix(inner, outer, smoothstep(.38, .62, r))*(.55 + .75*fib)*(1.0 - crypt*.5);
  c *= mix(1.0, .18, smoothstep(.84, 1.0, r)); return c; }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, .12, 3.0); mat3 cam = lookAt(ro, vec3(.0, .02, 0.0)); vec3 rdW = cam*normalize(vec3(uv, 2.6));
  mat3 E = rotY(-.5)*mat3(1, 0, 0, 0, cos(.1), -sin(.1), 0, sin(.1), cos(.1));
  vec3 o = ro*E, rd = rdW*E; vec3 KE = KS*E;
  vec2 hs = sphIntersect(o, rd, vec4(0.0, 0.0, 0.0, 1.0)); vec2 hc = sphIntersect(o, rd, vec4(0.0, 0.0, zc(), RC));
  float ts = (hs.x > 0.0 && (o + rd*hs.x).z < ZL) ? hs.x : 1e9; float tcn = (hc.x > 0.0 && (o + rd*hc.x).z > ZL) ? hc.x : 1e9;
  if (min(ts, tcn) > 1e8) return studio(rdW);
  if (ts < tcn){ vec3 p = o + rd*ts, n = normalize(p);
    float v = smoothstep(.55, .9, fbm(p*9.0))*smoothstep(.55, -.3, p.z); vec3 alb = mix(vec3(.74, .7, .66), vec3(.55, .14, .1), v*.45);
    alb *= mix(.55, 1.0, smoothstep(ZL - .02, ZL - .18, p.z));
    vec3 c = shadeS(rd, n, .32, 0.0, alb, vec3(1.0)); float wrap = max((dot(n, KE) + .4)/1.4, 0.0); c += alb*vec3(.5, .18, .12)*wrap*.25;
    return c; }
  vec3 p = o + rd*tcn, n = normalize(p - vec3(0.0, 0.0, zc()));
  vec3 r = refract(rd, n, 1.0/IOR); float F = fresD(dot(-rd, n), IOR);
  float t0 = 0.0, tEnd = (ZI - .01 - p.z)/r.z; vec3 ir = vec3(.0); float tp = 0.0, dp = 1.0; bool hit = false;
  for (int i = 0; i < 24; i++){ float t = tEnd*float(i + 1)/24.0; vec3 q = p + r*t; float h = prof(length(q.xy)/RL); float d = q.z - (ZI + h);
    if (h < 0.0){ t = tEnd; d = -1.0; }
    if (d < 0.0){ float tt = h < 0.0 ? t : tp + (t - tp)*dp/(dp - d); vec3 qh = p + r*tt; vec2 iq = qh.xy/RL;
      if (length(iq) < PUP) ir = vec3(.002); else { float rr = length(iq); float e = .01; float dh = (prof(rr + e) - prof(rr - e))/(2.0*e)/RL;
        vec3 nI = normalize(vec3(-normalize(iq)*dh, 1.0)); float cav = .5 + .5*smoothstep(-.01, .03, prof(rr));
        ir = irisCol(iq)*(max(dot(nI, KE), 0.0)*2.6 + .12)*cav; }
      hit = true; break; }
    tp = t; dp = d; }
  vec3 c = ir*(1.0 - F) + envS(reflect(rd, n), .01)*F*1.4;
  c += vec3(8.0)*pow(max(dot(reflect(rd, n), KE), 0.0), 900.0);
  return c; }`
  });
  /* Foliage units: a small procedural tree as capsules and leaf clusters, grass shells, cards. Shared code in FOL. */
  const FOL = SURF + `
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0); return length(pa - ba*h) - r; }
vec3 BARK = vec3(.12, .075, .045), LEAF = vec3(.045, .11, .018), LEAF2 = vec3(.10, .16, .03);
// x: distance, y: level (0 trunk, 1 branch, 2 twig, 3 leaves). detail: 0 = trunk only + crown blob, 1 = branches + clusters, 2 = full
vec2 tree(vec3 p, float seed, float leaves, float detail){
  vec2 r = vec2(sdCap(p, vec3(0.0), vec3(0.0, 2.4, 0.0), 0.15 - p.y*.02), 0.0);
  if (detail < 0.5){ float c = length((p - vec3(0.0, 2.9, 0.0))*vec3(1.0, 1.25, 1.0)) - 1.45; if (leaves > .5 && c < r.x) r = vec2(c, 3.0); return r; }
  if (length(p - vec3(0.0, 2.5, 0.0)) > 3.6) return vec2(min(r.x, length(p - vec3(0.0, 2.5, 0.0)) - 3.3), r.y);
  for (int i = 0; i < 6; i++){
    float fi = float(i), a = fi*2.39996 + seed;
    vec3 b0 = vec3(0.0, 1.15 + fi*.24, 0.0);
    vec3 d = normalize(vec3(cos(a), .7 + .12*fi, sin(a)));
    vec3 b1 = b0 + d*(1.55 - fi*.13);
    float db = sdCap(p, b0, b1, .075 - fi*.007); if (db < r.x) r = vec2(db, 1.0);
    for (int j = 0; j < 3; j++){
      float fj = float(j);
      if (detail < 1.5 && j > 0) break;
      vec3 c0 = mix(b0, b1, .45 + .25*fj); float a2 = a + (fj - 1.0)*1.2;
      vec3 c1 = c0 + normalize(vec3(cos(a2), .95, sin(a2)))*(.62 - .1*fj);
      if (detail > 1.5){ float dc = sdCap(p, c0, c1, .03); if (dc < r.x) r = vec2(dc, 2.0); }
      if (leaves > .5){ vec3 lc = detail > 1.5 ? c1 : b1; float rad = detail > 1.5 ? .46 : .78; float dl = length(p - lc) - rad;
        if (dl < .25) dl += (noise3(p*5.0 + seed) - .5)*.32 + (noise3(p*11.0) - .5)*.12; if (dl < r.x) r = vec2(dl*.8, 3.0); }
    }
  }
  return r;
}
vec3 treeNormal(vec3 p, float seed, float leaves, float detail){ vec2 e = vec2(.004, 0.0);
  return normalize(vec3(tree(p + e.xyy, seed, leaves, detail).x - tree(p - e.xyy, seed, leaves, detail).x,
                        tree(p + e.yxy, seed, leaves, detail).x - tree(p - e.yxy, seed, leaves, detail).x,
                        tree(p + e.yyx, seed, leaves, detail).x - tree(p - e.yyx, seed, leaves, detail).x)); }
vec3 foliageShade(vec3 rd, vec3 n, vec3 p, vec3 c, float lvl, float sh){
  if (lvl > 2.5){ vec3 alb = mix(LEAF, LEAF2, noise3(p*3.0)); float wrap = max((dot(n, KS) + .5)/1.5, 0.0); float back = pow(max(dot(rd, KS), 0.0), 4.0);
    float ao = clamp(length(p - c)/1.9, .25, 1.0);
    return alb*(vec3(1.9, 1.8, 1.6)*wrap*sh + vec3(.14, .17, .22)*ao) + vec3(.22, .32, .03)*back*sh; }
  vec3 alb = lvl < .5 ? BARK : (lvl < 1.5 ? BARK*1.15 : BARK*1.3);
  return shadeS(rd, n, .8, 0.0, alb, vec3(1.0))*mix(.35, 1.0, sh); }
`;
  Object.assign(SCENES, {
    /* A procedurally grown tree, branch levels tinted from trunk to twig. */
    'foliage-trees': FOL + `
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(1.2, 2.2, 6.6); mat3 cam = lookAt(ro, vec3(.15, 2.35, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.1));
  float t = 0.0, hit = -1.0; vec2 h;
  for (int i = 0; i < 110; i++){ vec3 p = ro + rd*t; h = tree(p, 0.0, 1.0, 2.0); if (h.x < .002*t){ hit = t; break; } t += h.x; if (t > 18.0) break; }
  vec3 col;
  float tf = rd.y < 0.0 ? -ro.y/rd.y : 1e9;
  if (hit > 0.0 && hit < tf){ vec3 p = ro + rd*hit, n = treeNormal(p, 0.0, 1.0, 2.0);
    float sh = 1.0, s = .05; for (int k = 0; k < 24; k++){ float d = tree(p + KS*s, 0.0, 1.0, 2.0).x; sh = min(sh, 6.0*d/s); s += clamp(d, .05, .4); if (sh < .02 || s > 6.0) break; } sh = clamp(sh, 0.0, 1.0);
    vec3 tint = h.y < .5 ? vec3(1.0) : (h.y < 1.5 ? vec3(1.3, .9, .55) : (h.y < 2.5 ? vec3(1.5, 1.25, .45) : vec3(1.0)));
    col = foliageShade(rd, n, p, vec3(0.0, 2.6, 0.0), h.y, sh)*tint; }
  else if (tf < 1e8){ vec3 p = ro + rd*tf; float sh = 1.0, s = .05 + .05*hash12(frag); for (int k = 0; k < 36; k++){ float d = tree(p + KS*s, 0.0, 1.0, 2.0).x; sh = min(sh, 4.0*d/s); s += clamp(d, .04, .4); if (sh < .02 || s > 7.0) break; }
    float g = noise3(vec3(p.xz*9.0, 1.0)); vec3 grass = mix(vec3(.025, .05, .015), vec3(.05, .09, .025), g);
    col = mix(grass*(vec3(2.4)*max(KS.y, 0.0)*clamp(sh, 0.0, 1.0) + vec3(.15)), studio(rd), smoothstep(4.0, 11.0, length(p.xz))); }
  else col = studio(rd);
  return col; }`,

    /* The same tree without leaves, branch levels coloured, a glowing marker at every pivot. */
    'foliage-vertex-data': FOL + `
float pivots(vec3 p){ float d = 1e9; for (int i = 0; i < 6; i++){ float fi = float(i), a = fi*2.39996; vec3 b0 = vec3(0.0, 1.15 + fi*.24, 0.0); vec3 dd = normalize(vec3(cos(a), .7 + .12*fi, sin(a))); vec3 b1 = b0 + dd*(1.55 - fi*.13);
  d = min(d, length(p - b0) - .09); for (int j = 0; j < 3; j++){ float fj = float(j); d = min(d, length(p - mix(b0, b1, .45 + .25*fj)) - .055); } } return d; }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(-1.2, 2.7, 5.0); mat3 cam = lookAt(ro, vec3(.2, 2.25, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.0));
  float t = 0.0, hit = -1.0; vec2 h; float glow = 0.0;
  for (int i = 0; i < 110; i++){ vec3 p = ro + rd*t; h = tree(p, 0.0, 0.0, 2.0); float pv = pivots(p); glow += .02/(.01 + pv*pv*60.0);
    if (pv < h.x){ h = vec2(pv, 5.0); } if (h.x < .002*t){ hit = t; break; } t += h.x; if (t > 16.0) break; }
  vec3 col = studio(rd);
  float tf = rd.y < 0.0 ? -ro.y/rd.y : 1e9;
  if (tf < 1e8 && (hit < 0.0 || tf < hit)){ vec3 p = ro + rd*tf; col = floorS(p, rd, 1.0); }
  if (hit > 0.0 && hit < tf){ vec3 p = ro + rd*hit, n = treeNormal(p, 0.0, 0.0, 2.0);
    vec3 lc = h.y < .5 ? vec3(.22, .22, .24) : (h.y < 1.5 ? vec3(.03, .14, .42) : (h.y < 2.5 ? vec3(.07, .30, .03) : vec3(1.0)));
    col = h.y > 4.5 ? vec3(3.0, 1.2, .25) : shadeS(rd, n, .45, 0.0, lc, vec3(1.0)); }
  return col + vec3(1.2, .45, .1)*glow*.05; }`,

    /* Grass shells bending under a gust that travels from left to right. */
    'foliage-wind': FOL + `
float gustAt(vec2 xz){ return .1 + .9*smoothstep(.3, .75, noise3(vec3(xz.x*.7 - 1.3, xz.y*.25, 2.0))); }
float blades(vec3 p, float t, out float hgtOut, out float gOut){
  const float C = .075; vec2 base = floor(p.xz/C); float d = 1e9; hgtOut = 0.0; gOut = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 cell = base + vec2(float(i), float(j));
    vec2 jit = vec2(hash12(cell), hash12(cell + 5.3)) - .5;
    vec3 b = vec3((cell.x + .5 + jit.x*.8)*C, 0.0, (cell.y + .5 + jit.y*.8)*C);
    float hgt = .22 + .3*hash12(cell + 9.1), g = gustAt(b.xz);
    vec3 bend = vec3(1.0, 0.0, .2)*g*hgt*1.1;
    vec3 m = b + vec3(0.0, hgt*.55, 0.0) + bend*.25, tip = b + vec3(0.0, hgt*(1.0 - .45*g), 0.0) + bend;
    float r = .0032 + t*.0011;
    float dd = min(sdCap(p, b, m, r*1.4), sdCap(p, m, tip, r*.7));
    if (dd < d){ d = dd; hgtOut = clamp(p.y/hgt, 0.0, 1.0); gOut = g; } }
  return d; }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, .85, 3.0); mat3 cam = lookAt(ro, vec3(0.0, .1, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.1));
  if (rd.y >= 0.0) return studio(rd);
  float tTop = (.56 - ro.y)/rd.y, tG = -ro.y/rd.y; float t = max(tTop, 0.0); float h = 0.0, g = 0.0; bool hit = false;
  for (int i = 0; i < 140; i++){ vec3 p = ro + rd*t; if (t > tG) break; float d = blades(p, t, h, g); if (d < .0008 + t*.0008){ hit = true; break; } t += max(d*.9, .002); }
  vec3 gp = ro + rd*tG;
  vec3 ground = vec3(.018, .03, .01)*(.6 + .4*noise3(vec3(gp.xz*8.0, 1.0)));
  vec3 col = ground;
  if (hit){ vec3 p = ro + rd*t; float ao = .25 + .75*h;
    float v = hash12(floor(p.xz/.075)); vec3 c = mix(vec3(.02, .045, .01), mix(vec3(.07, .15, .02), vec3(.13, .16, .03), v), h)*(.7 + .5*v);
    col = c*(vec3(1.4, 1.3, 1.15)*(.35 + .65*h)*(1.0 + .9*g*h) + vec3(.05, .07, .09))*ao; }
  return mix(col, studio(rd), smoothstep(6.0, 16.0, t)); }`,

    /* A young tree mid-fall, earlier positions as faint ghosts along the arc. */
    'foliage-animation': FOL + `
mat3 rotZ(float a){ float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
vec2 fallen(vec3 p, float ang){ return tree(rotZ(ang)*(p - vec3(-1.8, 0.0, 0.0)), 1.3, 1.0, 1.0); }
float march(vec3 ro, vec3 rd, float ang, out vec2 hh){ float t = 0.0; for (int i = 0; i < 80; i++){ vec3 p = ro + rd*t; hh = fallen(p, ang); if (hh.x < .003*t) return t; t += hh.x; if (t > 20.0) break; } return -1.0; }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(.6, 2.2, 9.5); mat3 cam = lookAt(ro, vec3(.6, 1.9, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.3));
  vec3 col = studio(rd); float tf = rd.y < 0.0 ? -ro.y/rd.y : 1e9;
  if (tf < 1e8){ vec3 p = ro + rd*tf; col = floorS(p, rd, 1.0 - .6*exp(-pow(length(p.xz - vec2(1.2, 0.0)), 2.0)*.25)); }
  vec2 hh; float th = 1e9;
  float t = march(ro, rd, -.95, hh);
  if (t > 0.0 && t < tf){ vec3 p = ro + rd*t; vec2 e = vec2(.004, 0.0); vec3 n = normalize(vec3(fallen(p + e.xyy, -.95).x - fallen(p - e.xyy, -.95).x, fallen(p + e.yxy, -.95).x - fallen(p - e.yxy, -.95).x, fallen(p + e.yyx, -.95).x - fallen(p - e.yyx, -.95).x));
    col = foliageShade(rd, n, p, vec3(0.0, 2.6, 0.0), hh.y, 1.0); th = t; }
  for (int g = 0; g < 3; g++){ float ang = -.18 - float(g)*.26; vec2 hg; float tg = march(ro, rd, ang, hg);
    if (tg > 0.0 && tg < min(th, tf)) col = mix(col, vec3(.16, .6, .1)*(.35 + .1*float(g)), .22 + .06*float(g)); }
  return col; }`,

    /* A backlit bush: leaves glow where the sun shines through, shading as one soft volume. */
    'foliage-shading': FOL + `
vec3 SUNB = normalize(vec3(.35, .45, -1.0));
float bush(vec3 p){ float d = 1e9; for (int i = 0; i < 7; i++){ float fi = float(i), a = fi*2.39996; vec3 c = vec3(cos(a)*.8*sqrt(fi/7.0), .9 + .35*sin(fi*1.7), sin(a)*.6*sqrt(fi/7.0)); d = min(d, length(p - c) - (.75 - fi*.04)); }
  d = min(d, length((p - vec3(0.0, 1.0, 0.0))*vec3(.85, 1.1, .9)) - 1.05);
  if (d < .3) d += (noise3(p*6.0) - .5)*.38 + (noise3(p*15.0) - .5)*.14; return d*.75; }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, 1.25, 5.2); mat3 cam = lookAt(ro, vec3(0.0, 1.0, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.4));
  vec3 bg = studio(rd) + vec3(1.6, 1.2, .6)*pow(max(dot(rd, SUNB), 0.0), 40.0)*.6 + vec3(.03, .025, .012)*pow(max(dot(rd, SUNB), 0.0), 3.0);
  float t = 0.0, hit = -1.0;
  for (int i = 0; i < 90; i++){ vec3 p = ro + rd*t; float d = bush(p); if (d < .002*t){ hit = t; break; } t += d; if (t > 12.0) break; }
  float tf = rd.y < 0.0 ? -ro.y/rd.y : 1e9;
  if (hit > 0.0 && hit < tf){ vec3 p = ro + rd*hit; vec2 e = vec2(.005, 0.0);
    vec3 n = normalize(vec3(bush(p + e.xyy) - bush(p - e.xyy), bush(p + e.yxy) - bush(p - e.yxy), bush(p + e.yyx) - bush(p - e.yyx)));
    vec3 ns = normalize(p - vec3(0.0, 1.0, 0.0)); vec3 nn = normalize(mix(n, ns, .7));
    float depth = clamp(1.2 - length((p - vec3(0.0, 1.0, 0.0))*vec3(.9, 1.0, .9)), 0.0, 1.0);
    vec3 alb = mix(LEAF, LEAF2, noise3(p*4.0));
    float front = max((dot(nn, SUNB) + .4)/1.4, 0.0);
    float edge = pow(1.0 - abs(dot(nn, -rd)), 2.0);
    float back = pow(clamp(dot(rd, SUNB), 0.0, 1.0), 3.0);
    float thin = smoothstep(.0, .9, 1.0 - depth)*(.25 + .75*edge)*(.6 + .8*noise3(p*9.0));
    vec3 trans = vec3(.30, .42, .04)*back*thin*1.6;
    return alb*(vec3(1.4, 1.3, 1.1)*front*.6 + vec3(.08, .1, .13)*(1.0 - depth*.7)) + trans; }
  if (tf < 1e8){ vec3 p = ro + rd*tf; float sh = 1.0 - .75*exp(-dot(p.xz - vec2(-.4, .9), p.xz - vec2(-.4, .9))*.7); return mix(vec3(.02, .025, .015)*(1.0 + 2.0*sh*max(SUNB.y, 0.0)), bg, smoothstep(3.0, 9.0, length(p.xz))); }
  return bg; }`,

    /* Leaf cards as a debug split: lit foliage on the left, overdraw heat on the right. */
    'foliage-cards': FOL + `
float leafMask(vec2 q, float s){ float a = 0.0; for (int i = 0; i < 5; i++){ float fi = float(i) + s; vec2 c = vec2(hash12(vec2(fi, 1.0)), hash12(vec2(fi, 2.0)))*1.2 - .6; float ang = hash12(vec2(fi, 3.0))*6.28;
  vec2 d = mat2(cos(ang), -sin(ang), sin(ang), cos(ang))*(q - c); float l = length(d*vec2(1.0, 2.3)); a = max(a, smoothstep(.36, .32, l)); } return a; }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, 1.6, 5.0); mat3 cam = lookAt(ro, vec3(0.0, 1.6, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.2));
  bool heat = frag.x > uRes.x*.5;
  float best = 1e9; vec3 bn = vec3(0.0); float layers = 0.0, passed = 0.0; vec3 bp = vec3(0.0);
  for (int i = 0; i < 64; i++){
    float fi = float(i); vec3 c = vec3(hash12(vec2(fi, 4.0)) - .5, hash12(vec2(fi, 5.0)) - .5, hash12(vec2(fi, 6.0)) - .5)*vec3(3.2, 2.2, 2.2) + vec3(0.0, 1.6, 0.0);
    if (length((c - vec3(0.0, 1.6, 0.0))*vec3(.7, 1.0, .9)) > 1.25) continue;
    float a1 = hash12(vec2(fi, 7.0))*6.28, a2 = (hash12(vec2(fi, 8.0)) - .5)*2.2;
    vec3 n = normalize(vec3(cos(a1)*cos(a2), sin(a2), sin(a1)*cos(a2)));
    vec3 u = normalize(cross(n, vec3(0.0, 1.0, .01))), v = cross(n, u);
    float dn = dot(rd, n); if (abs(dn) < 1e-3) continue;
    float t = dot(c - ro, n)/dn; if (t < 0.0) continue;
    vec3 p = ro + rd*t; vec2 q = vec2(dot(p - c, u), dot(p - c, v))/.55;
    if (abs(q.x) > 1.0 || abs(q.y) > 1.0) continue;
    layers += 1.0; float m = leafMask(q, fi*7.0);
    if (m > .5){ passed += 1.0; if (t < best){ best = t; bn = dn > 0.0 ? -n : n; bp = p; } }
  }
  if (heat){ vec3 hc = mix(vec3(.02, .03, .08), vec3(.1, .35, .9), smoothstep(0.0, 3.0, layers)); hc = mix(hc, vec3(1.0, .75, .1), smoothstep(3.0, 7.0, layers)); hc = mix(hc, vec3(1.4, .2, .1), smoothstep(7.0, 12.0, layers));
    vec3 c = layers > 0.0 ? hc*1.2 : studio(rd); if (abs(frag.x - uRes.x*.5) < 2.0) c = vec3(.6); return c; }
  if (best < 1e8){ vec3 ns = normalize(bp - vec3(0.0, 1.6, 0.0)); vec3 nn = normalize(mix(bn, ns, .7));
    vec3 alb = mix(LEAF, LEAF2, hash12(floor(bp.xy*9.0))); return alb*(vec3(2.6, 2.4, 2.1)*max((dot(nn, KS) + .4)/1.4, 0.0) + vec3(.12, .15, .2)); }
  return studio(rd); }`,

    /* One tree at four LODs side by side, from full branches to a single impostor card. */
    'foliage-lods': FOL + `
vec2 scene(vec3 p){ vec2 r = vec2(1e9, 0.0);
  vec2 a = tree(p - vec3(-6.0, 0.0, 0.0), 0.0, 1.0, 2.0); if (a.x < r.x) r = a;
  vec2 b = tree(p - vec3(-2.0, 0.0, 0.0), 0.0, 1.0, 1.0); if (b.x < r.x) r = b;
  vec2 c = tree(p - vec3(2.0, 0.0, 0.0), 0.0, 1.0, 0.0); if (c.x < r.x) r = c;
  vec3 q = p - vec3(6.0, 2.2, 0.0); float card = max(abs(q.z) - .02, max(abs(q.x) - 1.7, abs(q.y) - 2.2)); if (card < r.x) r = vec2(card, 9.0);
  return r; }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, 2.8, 12.5); mat3 cam = lookAt(ro, vec3(0.0, 2.3, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.05));
  float t = 0.0, hit = -1.0; vec2 h;
  for (int i = 0; i < 120; i++){ vec3 p = ro + rd*t; h = scene(p); if (h.x < .002*t){ hit = t; break; } t += h.x; if (t > 40.0) break; }
  float tf = rd.y < 0.0 ? -ro.y/rd.y : 1e9; vec3 col = studio(rd);
  if (tf < 1e8){ vec3 p = ro + rd*tf; col = floorS(p, rd, 1.0); }
  if (hit > 0.0 && hit < tf){ vec3 p = ro + rd*hit; vec2 e = vec2(.004, 0.0);
    vec3 n = normalize(vec3(scene(p + e.xyy).x - scene(p - e.xyy).x, scene(p + e.yxy).x - scene(p - e.yxy).x, scene(p + e.yyx).x - scene(p - e.yyx).x));
    if (h.y > 8.5){ vec3 q = p - vec3(6.0, 2.2, 0.0); vec2 c = q.xy; float crown = length((c - vec2(0.0, .5))*vec2(1.0, 1.15)) - 1.5 + (noise3(vec3(c*3.0, 1.0)) - .5)*.4; float trunk = max(abs(c.x) - .13, c.y + 0.3);
      if (min(crown, trunk) > 0.0 && q.y > -2.19) return col; vec3 pc = vec3(c.x, 0.0, sqrt(max(0.0, 1.0 - dot(c - vec2(0.0, .5), c - vec2(0.0, .5))/2.4)));
      return crown < 0.0 ? mix(LEAF, LEAF2, noise3(vec3(c*4.0, 2.0)))*(vec3(1.8)*max((dot(normalize(vec3(c - vec2(0.0, .5), .9)), KS) + .4)/1.4, 0.0) + .12) : BARK*1.2; }
    col = foliageShade(rd, n, p, vec3(floor((p.x + 8.0)/4.0)*4.0 - 6.0, 2.6, 0.0), h.y, 1.0); }
  return col; }`,

    /* A forest from above, each instance tinted by the batch it belongs to. */
    'foliage-instancing': FOL + `
vec3 batchCol(float k){ if (k < .25) return vec3(.05, .13, .025); if (k < .5) return vec3(.025, .08, .11); if (k < .75) return vec3(.13, .11, .02); return vec3(.11, .04, .07); }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, 26.0, 22.0); mat3 cam = lookAt(ro, vec3(0.0, 0.0, -2.0)); vec3 rd = cam*normalize(vec3(uv, 2.0));
  float tg = -ro.y/rd.y; vec3 pg = ro + rd*tg;
  float best = tg; vec3 bn = vec3(0.0, 1.0, 0.0); float bk = -1.0; vec3 bc = vec3(0.0);
  vec2 base = floor(pg.xz/2.2);
  for (int j = -3; j <= 3; j++) for (int i = -3; i <= 3; i++){
    vec2 cell = base + vec2(float(i), float(j)); float occ = hash12(cell*1.31 + 2.0); if (occ < .18) continue;
    vec2 jit = vec2(hash12(cell), hash12(cell + 4.1)) - .5; float r = .8 + .45*hash12(cell + 9.3);
    vec3 c = vec3((cell.x + .5 + jit.x*.7)*2.2, 1.6 + r*.6, (cell.y + .5 + jit.y*.7)*2.2);
    vec2 q = sphIntersect(ro, rd, vec4(c, r)); if (q.x > 0.0 && q.x < best){ best = q.x; vec3 p = ro + rd*q.x; bn = normalize(p - c); bk = hash12(cell + 17.0); bc = c; } }
  vec3 col;
  if (bk >= 0.0){ vec3 p = ro + rd*best; vec3 n = normalize(bn + (vec3(noise3(p*4.0), noise3(p*4.0 + 3.0), noise3(p*4.0 + 6.0)) - .5)*.9);
    vec3 alb = mix(vec3(dot(batchCol(bk), vec3(.33))), batchCol(bk), .7)*(.75 + .4*noise3(p*6.0))*.7; float wrap = max((dot(n, KS) + .4)/1.4, 0.0);
    col = alb*(vec3(2.0, 1.9, 1.7)*wrap + vec3(.12, .14, .18)*(.5 + .5*n.y)); }
  else { float sh = 1.0; vec2 b2 = floor(pg.xz/2.2); for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){ vec2 cell = b2 + vec2(float(i), float(j)); if (hash12(cell*1.31 + 2.0) < .18) continue;
      vec2 jit = vec2(hash12(cell), hash12(cell + 4.1)) - .5; float r = .8 + .45*hash12(cell + 9.3); vec3 c = vec3((cell.x + .5 + jit.x*.7)*2.2, 1.6 + r*.6, (cell.y + .5 + jit.y*.7)*2.2); sh = min(sh, sphSoftShadow(pg, KS, vec4(c, r), 4.0)); }
    col = vec3(.03, .04, .02)*(vec3(2.4)*max(KS.y, 0.0)*sh + vec3(.2)); }
  return mix(col, studio(rd), smoothstep(30.0, 60.0, length(pg.xz))); }`
  });
  /* Performance & optimization units */
  Object.assign(SCENES, {
    /* Three wall modules seen from behind: faces that touch a wall or a neighbour, never visible in game, are red. */
    'mesh-optimization': '#define KEYDIR vec3(-.45, .8, -.55)\n' + SDF + `
vec3 HB = vec3(.5, .62, .14);
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  for (int i = 0; i < 3; i++){ float fi = float(i); r = U(r, sdBox(p - vec3(-1.3 + fi*1.3, .62, 0.0), HB), 1.0 + fi); }
  return r; }
vec3 albedo(float id, vec3 p, vec3 n){
  if (id < .5){ float line = smoothstep(.025, 0.0, abs(p.z - .2))*step(abs(p.x), 2.0); return FLOOR + vec3(.18)*line; }
  float fi = id - 1.0; vec3 q = p - vec3(-1.3 + fi*1.3, .62, 0.0);
  vec3 a = abs(q) - HB + .014; float edges = step(0.0, a.x) + step(0.0, a.y) + step(0.0, a.z);
  bool hidden = n.z > .5 || (n.x > .5 && fi < 1.5) || (n.x < -.5 && fi > .5) || n.y < -.5;
  vec3 base = hidden ? RED*.42 : vec3(.16, .165, .175);
  return mix(base, vec3(.5), step(1.5, edges)*.6); }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(-2.2, 2.3, -3.4), vec3(.1, .5, 0.0), 2.5, frag); }`,

    /* Two crates under a grazing light: hard edges on the left, one rounded chamfer on the right. */
    'bevels-normals': '#define KEYDIR vec3(-.75, .42, .5)\n' + SDF + `
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  r = U(r, sdBox((p - vec3(-1.05, .5, 0.0))*rY(.62), vec3(.5)), 1.0);
  r = U(r, sdBox((p - vec3(1.05, .5, 0.0))*rY(-.62), vec3(.41)) - .09, 2.0);
  return r; }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; return vec3(.1, .105, .115); }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(0.0, 1.55, 4.3), vec3(0.0, .45, 0.0), 2.45, frag); }`,

    /* Two UV squares as panels: a tight pack and a wasteful one. */
    'uv-cost': '#define KEYDIR vec3(-.4, .85, .5)\n' + SDF + `
vec3 PA = vec3(-1.05, .03, 0.0), PB = vec3(1.05, .03, 0.0);
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  r = U(r, sdBox(p - PA, vec3(.9, .03, .9)), 1.0);
  r = U(r, sdBox(p - PB, vec3(.9, .03, .9)), 2.0);
  return r; }
float isl(vec2 q, vec4 b){ return step(b.x, q.x)*step(q.x, b.z)*step(b.y, q.y)*step(q.y, b.w); }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR; if (n.y < .5) return vec3(.04);
  vec2 q = (p - (id < 1.5 ? PA : PB)).xz/1.8 + .5; float m = 0.0;
  if (id < 1.5){ m += isl(q, vec4(.03, .03, .62, .55)); m += isl(q, vec4(.65, .03, .97, .55)); m += isl(q, vec4(.03, .58, .45, .97)); m += isl(q, vec4(.48, .58, .97, .77)); m += isl(q, vec4(.48, .8, .97, .97)); }
  else { m += isl(q, vec4(.08, .1, .34, .36)); m += isl(q, vec4(.5, .18, .68, .4)); m += isl(q, vec4(.2, .55, .42, .7)); m += isl(q, vec4(.62, .6, .86, .9)); }
  vec2 c = floor(q*16.0); float ch = mod(c.x + c.y, 2.0);
  return m > .5 ? mix(vec3(.03, .1, .025), vec3(.2, .21, .2), ch) : vec3(.012); }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(0.0, 3.0, 2.5), vec3(0.0, .0, -.1), 2.35, frag); }`,

    /* One pebble texture on a floor: plain tiling on the left, hex tiling on the right. */
    'texture-bombing': `
vec3 KEY = normalize(vec3(-.4, .7, .3));
vec2 h22(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))))*43758.5453); }
vec3 pebbles(vec2 uv){
  vec2 g = uv*5.0, i = floor(g), f = fract(g); float best = 9.0, second = 9.0; vec2 bid = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 o = vec2(float(x), float(y)), c = mod(i + o, 5.0);
    vec2 pt = o + .2 + .6*h22(c) - f; float d = length(pt*vec2(1.0, 1.0 + .4*h22(c + 3.0).x));
    if (d < best){ second = best; best = d; bid = c; } else if (d < second) second = d; }
  float r = .4 + .12*h22(bid + 7.0).x;
  vec3 col = mix(vec3(.1, .085, .065), vec3(.26, .23, .19), h22(bid + 1.0).x);
  if (bid.x == 2.0 && bid.y == 3.0) col = vec3(.32, .05, .025);
  float peb = smoothstep(.02, .1, second - best)*smoothstep(r + .05, r - .05, best);
  return mix(vec3(.09, .075, .055), col*(.8 + .4*(1.0 - best/r)), peb); }
vec2 hexUV(vec2 uv, vec2 v){
  vec2 c = vec2(v.x + .5*v.y, .8660254*v.y)/3.4641016;
  float a = mod(abs(v.x*v.y) + abs(v.x + v.y) + PI, 2.0*PI); if (a > PI) a -= 2.0*PI; a *= .35;
  float cs = cos(a), sn = sin(a); vec2 d = uv - c;
  return vec2(d.x*cs + d.y*sn, -d.x*sn + d.y*cs) + c + h22(v); }
vec3 hexTile(vec2 uv){
  vec2 st = uv*3.4641016, sk = vec2(st.x - .57735027*st.y, 1.15470054*st.y), b = floor(sk);
  vec3 t = vec3(fract(sk), 0.0); t.z = 1.0 - t.x - t.y; float s = step(0.0, -t.z), s2 = 2.0*s - 1.0;
  vec3 w = vec3(-t.z*s2, s - t.y*s2, s - t.x*s2);
  vec3 c1 = pebbles(hexUV(uv, b + vec2(s))), c2 = pebbles(hexUV(uv, b + vec2(s, 1.0 - s))), c3 = pebbles(hexUV(uv, b + vec2(1.0 - s, s)));
  vec3 L = vec3(dot(c1, vec3(.299, .587, .114)), dot(c2, vec3(.299, .587, .114)), dot(c3, vec3(.299, .587, .114)));
  vec3 W = mix(vec3(1.0), L, .6)*pow(w, vec3(7.0)); W /= W.x + W.y + W.z;
  return W.x*c1 + W.y*c2 + W.z*c3; }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(0.0, 2.3, 1.0); mat3 cam = lookAt(ro, vec3(0.0, 0.0, -3.0)); vec3 rd = cam*normalize(vec3(uv, 1.7));
  if (rd.y > -.01) return studio(rd);
  float t = -ro.y/rd.y; vec3 p = ro + rd*t; vec2 tuv = p.xz/1.1;
  bool right = frag.x > uRes.x*.5;
  vec3 alb = right ? hexTile(tuv) : pebbles(tuv);
  vec3 c = alb*(vec3(1.7, 1.58, 1.42)*max(KEY.y, 0.0) + vec3(.08, .09, .11));
  c = mix(c, studio(rd), smoothstep(5.0, 14.0, t));
  if (abs(frag.x - uRes.x*.5) < 1.5) c = vec3(.45);
  return c; }`,

    /* Props textured three ways: their own textures, one atlas sheet, and the slices of a texture array. */
    'atlas-array': '#define KEYDIR vec3(-.5, .8, .5)\n' + SDF + `
vec2 map(vec3 p){ vec2 r = vec2(p.y, 0.0);
  r = U(r, sdBox(p - vec3(-2.35, .26, .15), vec3(.25)) - .01, 1.0);
  r = U(r, sdBox((p - vec3(-1.72, .2, -.25))*rY(.5), vec3(.2)) - .01, 2.0);
  r = U(r, sdSphere(p - vec3(-1.95, .22, .62), .22), 3.0);
  r = U(r, sdBox(p - vec3(0.0, .78, -.35), vec3(.72, .72, .02)), 4.0);
  for (int i = 0; i < 4; i++){ float fi = float(i); r = U(r, sdBox(p - vec3(1.75 + fi*.1, .55, -.55 + fi*.22), vec3(.42, .42, .015)), 5.0 + fi); }
  return r; }
vec3 pat(float k, vec2 q){
  if (k < .5) return mix(BLUE*.15, BLUE*.5, step(.5, fract(q.x*4.0)));
  if (k < 1.5){ vec2 c = floor(q*4.0); return mix(ORANGE*.15, ORANGE*.5, mod(c.x + c.y, 2.0)); }
  if (k < 2.5) return mix(GREEN*.12, GREEN*.5, step(length(fract(q*4.0) - .5), .3));
  return mix(RED*.15, RED*.5, step(.5, fract(q.y*4.0 + .25*sin(q.x*12.0)))); }
vec3 albedo(float id, vec3 p, vec3 n){ if (id < .5) return FLOOR;
  if (id < 3.5) return pat(id - 1.0, p.xy*1.5 + p.z);
  if (id < 4.5){ vec2 q = (p.xy - vec2(0.0, .78))/1.44 + .5; vec2 k = floor(q*2.0); vec2 f = fract(q*2.0);
    if (n.z < .5) return vec3(.05); float line = step(.47, abs(f.x - .5)) + step(.47, abs(f.y - .5));
    return mix(pat(k.x + 2.0*k.y, f), vec3(.02), min(line, 1.0)); }
  if (n.z < .5) return pat(id - 5.0, vec2(.3)) ;
  vec2 q = (p.xy - vec2(1.75 + (id - 5.0)*.1, .55))/.84 + .5; return pat(id - 5.0, q); }
vec3 emit(float id, vec3 p, vec3 n){ return vec3(0.0); }
vec3 render(vec2 frag){ return scene(vec3(.0, 1.45, 4.3), vec3(.0, .5, 0.0), 2.4, frag); }`,

    /* A temple wall from layers: tiling stone, height-blended moss and dirt, and a decal band along the top. */
    'layered-tiling': `
vec3 KEY = normalize(vec3(-.75, .38, .55));
float bricks(vec2 p, out vec2 id){ vec2 s = vec2(.6, .3); float row = floor(p.y/s.y); vec2 q = p; q.x += mod(row, 2.0)*.3;
  id = floor(q/s); vec2 f = fract(q/s)*s; vec2 d = min(f, s - f); return min(d.x, d.y); }
float hgt(vec2 p){ vec2 id; float e = bricks(p, id); return smoothstep(0.0, .035, e)*(.75 + .25*hash12(id)) + (noise3(vec3(p*9.0, 1.0)) - .5)*.16; }
vec3 render(vec2 frag){
  vec2 uv = screenUV(frag); vec3 ro = vec3(.9, 1.3, 3.1); mat3 cam = lookAt(ro, vec3(-.5, 1.2, 0.0)); vec3 rd = cam*normalize(vec3(uv, 2.0));
  float tw = rd.z < 0.0 ? -ro.z/rd.z : 1e9, tf = rd.y < 0.0 ? -ro.y/rd.y : 1e9;
  vec3 col = studio(rd);
  if (tw < tf){ vec3 p = ro + rd*tw; vec2 w = p.xy; if (w.y > 2.6) return col;
    float h = hgt(w); vec2 e = vec2(.004, 0.0);
    vec3 n = normalize(vec3(-(hgt(w + e.xy) - hgt(w - e.xy))*5.0, -(hgt(w + e.yx) - hgt(w - e.yx))*5.0, 1.0));
    vec2 id; bricks(w, id);
    vec3 stone = mix(vec3(.13, .115, .095), vec3(.22, .195, .16), hash12(id))*(.8 + .4*noise3(vec3(w*4.0, 3.0)));
    float mask = fbm(vec3(w*vec2(.8, 1.1) + vec2(4.1, 1.7), 2.0)) + smoothstep(1.3, 2.5, w.y)*.3;
    float wM = smoothstep(-.08, .08, (mask - .6)*3.4 - h*.8);
    float dirt = clamp(((1.0 - h)*.6 + (1.0 - smoothstep(0.0, .75, w.y)) + fbm(vec3(w*2.0, 5.0))*.4 - 1.05)/.15, 0.0, 1.0);
    vec3 alb = mix(stone, vec3(.035, .075, .015), wM); alb = mix(alb, vec3(.05, .038, .026), dirt*.85);
    alb *= 1.0 - .65*smoothstep(.07, 0.0, abs(w.y - 2.45))*(.6 + .4*noise3(vec3(w*12.0, 7.0)));
    col = alb*(vec3(1.6, 1.46, 1.3)*max(dot(n, KEY), 0.0) + vec3(.07, .08, .1)*(.6 + .4*h));
    col = mix(col, studio(rd), smoothstep(5.5, 10.0, tw)); }
  else if (tf < 1e8){ vec3 p = ro + rd*tf; col = vec3(.03, .027, .022)*(2.0*KEY.y + .3)*(.55 + .45*smoothstep(0.0, .6, p.z)); col = mix(col, studio(rd), smoothstep(3.0, 8.0, length(p.xz))); }
  return col; }`
  });
  const NAMES = Object.keys(SCENES);

  let gl = null, glc = null, buf = null; const progs = {};
  function ctx() {
    if (gl !== null) return gl;
    try {
      glc = document.createElement('canvas');
      gl = glc.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false }) || false;
    } catch (e) { gl = false; }
    if (gl) { buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); }
    return gl;
  }
  function program(name) {
    if (progs[name] !== undefined) return progs[name];
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error('render ' + name + ':', gl.getShaderInfoLog(s)); return null; } return s; };
    const vs = sh(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }');
    const fs = sh(gl.FRAGMENT_SHADER, PRELUDE + SCENES[name]);
    if (!vs || !fs) { progs[name] = null; return null; }
    const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error('render link ' + name, gl.getProgramInfoLog(p)); progs[name] = null; return null; }
    progs[name] = p; return p;
  }
  function fallback(canvas) {
    const c = canvas.getContext('2d'), g = c.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#1c1e22'); g.addColorStop(1, '#0b0c0e'); c.fillStyle = g; c.fillRect(0, 0, canvas.width, canvas.height);
  }
  function size(canvas) {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = Math.round((r.width || +canvas.getAttribute('width') || 640) * dpr), h = Math.round((r.height || +canvas.getAttribute('height') || 400) * dpr);
    const cap = 1600 / Math.max(w, h); if (cap < 1) { w = Math.round(w * cap); h = Math.round(h * cap); }
    return [Math.max(2, w), Math.max(2, h)];
  }
  /* draw(canvas, name): renders straight into the canvas' own pixel size */
  function draw(canvas, name) {
    const [w, h] = size(canvas); canvas.width = w; canvas.height = h;
    const g = ctx(); const p = g && SCENES[name] ? program(name) : null;
    if (!p) { fallback(canvas); return false; }
    glc.width = w; glc.height = h; g.viewport(0, 0, w, h); g.useProgram(p);
    const loc = g.getAttribLocation(p, 'p'); g.bindBuffer(g.ARRAY_BUFFER, buf); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
    g.uniform2f(g.getUniformLocation(p, 'uRes'), w, h); g.uniform1f(g.getUniformLocation(p, 'uAA'), w * h > 1.4e6 ? 1 : 2);
    g.drawArrays(g.TRIANGLES, 0, 3);
    canvas.getContext('2d').drawImage(glc, 0, 0);
    canvas.dataset.rendered = name;
    return true;
  }
  /* drawAll(root): renders every [data-render] canvas, one per animation frame so the page stays responsive */
  function drawAll(root) {
    const list = [...(root || document).querySelectorAll('canvas[data-render]')].filter(c => !c.dataset.rendered);
    list.forEach(fallback);
    let i = 0;
    const next = () => { if (i >= list.length) return; const c = list[i++]; try { draw(c, c.dataset.render); } catch (e) { console.error(e); } requestAnimationFrame(next); };
    requestAnimationFrame(next);
  }
  let rt = null;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { document.querySelectorAll('canvas[data-render]').forEach(c => { const [w, h] = size(c); if (Math.abs(w - c.width) > 40) { delete c.dataset.rendered; } }); drawAll(); }, 400); });
  window.AtlasRender = { draw, drawAll, scenes: NAMES };
})();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.AtlasRender.drawAll()); else window.AtlasRender.drawAll();
