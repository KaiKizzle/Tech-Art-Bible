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
