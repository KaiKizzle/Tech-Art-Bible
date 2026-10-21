/* Tech Art Atlas — shared unit runtime.

   Page conventions (see units/_template/index.html):
     <body data-unit="slug">
     <section class="chapter" id="length" data-title="Length" data-builds="vectors#add gpu-basics#pixels"> … </section>
       data-ref on a section lists it under "Reference" in the rail.
     <a class="x" href="../vectors/index.html#length">length</a>   cross-link with a hover preview
     <div class="fx" data-fx="name"></div> + Atlas.fx('name', spec)  live formula
     <details class="check"> … <script type="application/json">[[q,[opts],right,why]]</script></details>
     <div class="needs" data-needs="vectors gpu-basics"></div>   "before this unit" cards
     <div class="next" data-next="rays-math ray-sphere"></div>     "where to go next" cards
     <script type="application/json" id="glossary-data">{"key":["Term","Definition","optional link"]}</script>

   Nothing is tracked. Only the theme and the engine choice are remembered in this browser. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const slug = document.body.dataset.unit || 'unit';
  const store = {
    get(k, d) { try { const v = localStorage.getItem('atlas:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('atlas:' + k, JSON.stringify(v)); } catch (e) {} }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const me = document.currentScript && document.currentScript.src;
  const ROOT = me ? new URL('../', me).href : '../../';

  /* ---------- theme: dark by default, light on request ---------- */
  function applyTheme(t) {
    if (t === 'light') document.documentElement.dataset.theme = 'light'; else delete document.documentElement.dataset.theme;
    $$('[data-theme-toggle]').forEach(b => { b.textContent = t === 'light' ? 'Dark theme' : 'Light theme'; });
  }
  let theme = store.get('theme', 'dark') === 'light' ? 'light' : 'dark';
  applyTheme(theme);
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-theme-toggle]'); if (!b) return;
    theme = theme === 'light' ? 'dark' : 'light'; store.set('theme', theme); applyTheme(theme);
  });

  /* ---------- drawing helpers ---------- */
  const redrawers = new Set();
  function col(name) { return getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim() || '#888'; }
  function redrawAll() { redrawers.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }
  new MutationObserver(redrawAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* fig(canvas, draw): draw(ctx, W, H) in fixed logical units taken from the canvas' width/height attributes.
     The backing store is W×H × devicePixelRatio and never depends on the canvas' on-screen size, so it cannot grow. */
  function fig(canvas, draw) {
    const W = +(canvas.dataset.w || canvas.getAttribute('width')), H = +(canvas.dataset.h || canvas.getAttribute('height'));
    canvas.dataset.w = W; canvas.dataset.h = H;
    canvas.style.aspectRatio = W + ' / ' + H;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    const api = { w: W, h: H, ctx, canvas, draw() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); draw(ctx, W, H); } };
    redrawers.add(api.draw); api.draw();
    return api;
  }
  /* pointer(canvas, W, H, cb): cb({x, y}, 'down'|'move'|'hover'|'up', event) in logical canvas units */
  function pointer(canvas, W, H, cb) {
    let down = false;
    const at = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
    canvas.addEventListener('pointerdown', e => { down = true; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} cb(at(e), 'down', e); });
    canvas.addEventListener('pointermove', e => cb(at(e), down ? 'move' : 'hover', e));
    const up = e => { if (down) { down = false; cb(at(e), 'up', e); } };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  }
  function range(id, fmtf, cb) {
    const el = document.getElementById(id), out = document.getElementById(id + '-o');
    const f = () => { const v = +el.value; if (out) out.textContent = fmtf ? fmtf(v) : v; if (cb) cb(v); };
    el.addEventListener('input', f);
    if (out) out.textContent = fmtf ? fmtf(+el.value) : el.value;
    return { get v() { return +el.value; }, set(v) { el.value = v; f(); }, el };
  }
  function seg(el, cb) {
    if (typeof el === 'string') el = document.getElementById(el);
    const btns = $$('button', el);
    let v = (btns.find(b => b.getAttribute('aria-pressed') === 'true') || btns[0]).dataset.v;
    btns.forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v ? 'true' : 'false'));
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      btns.forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      v = b.dataset.v; if (cb) cb(v);
    });
    return { get v() { return v; } };
  }
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  function fmt(x, d = 2) { if (!isFinite(x)) return x > 0 ? '∞' : x < 0 ? '−∞' : '—'; return (x < 0 ? '−' : '') + Math.abs(x).toFixed(d); }
  /* num(x): readable number with about 3 significant digits, thin-space thousands, real minus sign */
  function num(x, sig = 3) {
    if (x === null || x === undefined || Number.isNaN(x)) return '—';
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    const a = Math.abs(x); let s;
    if (a === 0) s = '0';
    else if (a >= 1e9 || a < 1e-3) s = a.toExponential(sig - 1).replace('e+', '·10^').replace('e-', '·10^−');
    else { const d = Math.max(0, sig - 1 - Math.floor(Math.log10(a))); s = a >= 1e4 ? String(Math.round(a)) : a.toFixed(Math.min(d, 6)); if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, ''); s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ').replace(/(\.\d*?) (?=\d)/g, '$1'); }
    s = s.replace(/\^(−?\d+)/, (m, p) => '^' + p).replace(/·10\^(−?)(\d+)/, (m, sgn, p) => '·10' + (sgn ? '⁻' : '') + p.split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]).join(''));
    return (x < 0 ? '−' : '') + s;
  }
  /* short(x): compact axis label, e.g. 1.5k, 2M, 0.25 */
  function short(x) {
    const a = Math.abs(x); if (a === 0) return '0';
    const u = [[1e12, 1e12, 'T'], [1e9, 1e9, 'G'], [1e6, 1e6, 'M'], [1e4, 1e3, 'k']];
    for (const [k, d, n] of u) if (a >= k) return num(x / d, 3) + n;
    return num(x, 3);
  }
  const pn = (x, sig) => (x < 0 ? '(' + num(x, sig) + ')' : num(x, sig));
  function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function alpha(hex, a) { if (!hex.startsWith('#')) return hex; const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
  const reduceMotion = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

  /* ---------- the site index (units, chapters, backlinks) ---------- */
  const INDEX = window.ATLAS_INDEX || { units: {}, backlinks: {} };
  const CATS = window.ATLAS_CATEGORIES || [];
  const UNITS = window.ATLAS_UNITS || [];
  function unitMeta(s) { return UNITS.find(u => u.slug === s) || (INDEX.units[s] ? { slug: s, title: INDEX.units[s].title, cat: INDEX.units[s].cat } : null); }
  function chapterMeta(s, id) { const u = INDEX.units[s]; return u ? (u.chapters || []).find(c => c.id === id) : null; }
  function hrefFor(s, id) { return ROOT + 'units/' + s + '/index.html' + (id ? '#' + id : ''); }
  function parseRef(ref) { const [s, id] = ref.split('#'); return { s, id }; }
  function parseHref(href) { const m = /units\/([^/]+)\/(?:index\.html)?(?:#([\w-]+))?$/.exec(href) || /^\.\.\/([^/]+)\/(?:index\.html)?(?:#([\w-]+))?$/.exec(href); return m ? { s: m[1], id: m[2] } : null; }
  function label(s, id) {
    const u = unitMeta(s), c = id ? chapterMeta(s, id) : null;
    return { unit: u ? u.title : s, chapter: c ? c.title : (id || ''), summary: c ? c.summary : (u && u.summary) || '', cat: u ? u.cat : '' };
  }

  /* ---------- rail, breadcrumb, chapter chips ---------- */
  function rail() {
    const secs = $$('.chapter[data-title]');
    const list = $('#rail-list'), sel = $('#topnav-select');
    let n = 0, html = '', opts = '', refStarted = false;
    secs.forEach(s => {
      const ref = s.hasAttribute('data-ref');
      if (!ref) n++;
      const num = $('.head .num', s);
      if (num && !num.textContent.trim()) num.textContent = ref ? 'Reference' : 'Chapter ' + n;
      if (ref && !refStarted) { html += '<li class="sep">Reference</li>'; refStarted = true; }
      html += `<li><a class="ch" href="#${s.id}" data-id="${s.id}"><span class="n">${ref ? '·' : n}</span><span>${s.dataset.title}</span></a></li>`;
      opts += `<option value="${s.id}">${ref ? '' : n + '. '}${esc(s.dataset.title)}</option>`;
    });
    if (list) list.innerHTML = html;
    if (sel) { sel.innerHTML = opts; sel.addEventListener('change', () => { const t = document.getElementById(sel.value); if (t) t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); }); }
    const crumbLast = $('#crumb-chapter');
    let last = null;
    function current() {
      let cur = null;
      for (const s of secs) if (s.getBoundingClientRect().top < window.innerHeight * 0.3) cur = s;
      if (cur === last) return; last = cur;
      $$('a.ch', list || document).forEach(a => a.classList.toggle('current', !!cur && a.dataset.id === cur.id));
      if (sel && cur && sel.value !== cur.id) sel.value = cur.id;
      if (crumbLast) crumbLast.textContent = cur ? cur.dataset.title : '';
    }
    addEventListener('scroll', current, { passive: true }); current();
  }
  function crumbs() {
    const el = $('.crumbs'); if (!el) return;
    const u = unitMeta(slug), c = u ? CATS.find(x => x.id === u.cat) : null;
    el.innerHTML = `<a href="${ROOT}index.html">Tech Art Atlas</a><span>/</span>` + (c ? `<a href="${ROOT}index.html#cat-${c.id}">${esc(c.name)}</a><span>/</span>` : '') +
      `<a href="#top">${esc(u ? u.title : document.title.split(' · ')[0])}</a><span>/</span><b id="crumb-chapter"></b>`;
  }
  function chip(s, id, cls) {
    const l = label(s, id);
    return `<a class="xchip ${cls || ''}" href="${hrefFor(s, id)}" data-xs="${s}" data-xid="${id || ''}"><span>${esc(l.unit)}</span>${id ? `<b>${esc(l.chapter)}</b>` : ''}</a>`;
  }
  function chapterChips() {
    $$('.chapter[data-title]').forEach(sec => {
      const head = $('.head', sec); if (!head) return;
      const builds = (sec.dataset.builds || '').split(/\s+/).filter(Boolean).map(parseRef);
      const used = (INDEX.backlinks[slug + '#' + sec.id] || []).filter(b => b[0] !== slug);
      if (!builds.length && !used.length) return;
      const row = document.createElement('div'); row.className = 'links-row';
      row.innerHTML = (builds.length ? `<div class="lr"><span class="lr-k">Builds on</span>${builds.map(b => chip(b.s, b.id)).join('')}</div>` : '') +
        (used.length ? `<div class="lr"><span class="lr-k">Used in</span>${used.slice(0, 6).map(b => chip(b[0], b[1], 'used')).join('')}</div>` : '');
      head.after(row);
    });
  }
  function needsNext() {
    $$('[data-needs],[data-next]').forEach(el => {
      const list = (el.dataset.needs || el.dataset.next).split(/\s+/).filter(Boolean).map(parseRef);
      const title = el.dataset.needs !== undefined ? (el.dataset.title || 'Before this unit') : (el.dataset.title || 'Where to go next');
      const intro = el.dataset.intro || (el.dataset.needs !== undefined ? 'This unit assumes the ideas below. If one is new to you, open it first; each is short.' : '');
      el.innerHTML = `<h3>${esc(title)}</h3>${intro ? `<p class="cap">${esc(intro)}</p>` : ''}<div class="cards-mini">${list.map(r => {
        const l = label(r.s, r.id), u = unitMeta(r.s), c = u ? CATS.find(x => x.id === u.cat) : null;
        return `<a class="mini" href="${hrefFor(r.s, r.id)}" style="--c:var(--${c ? c.color : 'muted'})"><span class="k">${esc(c ? c.name : '')}</span><b>${esc(r.id ? l.chapter : l.unit)}</b><span>${esc(r.id ? l.unit : (u && u.summary) || '')}</span></a>`;
      }).join('')}</div>`;
    });
  }

  /* ---------- cross-link previews ---------- */
  let pop = null, popFor = null, hideT = null;
  function closePop() { if (pop) { pop.remove(); pop = null; popFor = null; } }
  function placePop(anchor) {
    const r = anchor.getBoundingClientRect(), pw = pop.offsetWidth;
    let x = r.left + scrollX; x = Math.min(x, scrollX + document.documentElement.clientWidth - pw - 16); x = Math.max(scrollX + 16, x);
    pop.style.left = x + 'px'; pop.style.top = (r.bottom + scrollY + 8) + 'px';
  }
  function showX(a) {
    let s, id;
    if (a.dataset.xs) { s = a.dataset.xs; id = a.dataset.xid; } else { const p = parseHref(a.getAttribute('href')); if (!p) return; s = p.s; id = p.id; }
    const l = label(s, id); if (popFor === a) return;
    closePop(); popFor = a;
    pop = document.createElement('div'); pop.className = 'pop xpop'; pop.setAttribute('role', 'tooltip');
    pop.innerHTML = `<span class="k">${esc(l.unit)}</span><b>${esc(id ? l.chapter : l.unit)}</b>${l.summary ? `<p>${esc(l.summary)}</p>` : ''}<span class="go">${s === slug ? 'Jump to this chapter' : 'Open lesson'} →</span>`;
    document.body.appendChild(pop); placePop(a);
  }
  function xlinks() {
    document.addEventListener('pointerover', e => {
      if (e.pointerType === 'touch') return;
      const a = e.target.closest('a.x, a.xchip'); if (!a) return;
      clearTimeout(hideT); showX(a);
    });
    document.addEventListener('pointerout', e => {
      const a = e.target.closest('a.x, a.xchip'); if (!a || !pop || pop.classList.contains('gpop')) return;
      hideT = setTimeout(closePop, 120);
    });
    document.addEventListener('focusin', e => { const a = e.target.closest('a.x, a.xchip'); if (a) showX(a); });
    document.addEventListener('focusout', e => { if (e.target.closest('a.x, a.xchip')) closePop(); });
  }

  /* ---------- glossary ---------- */
  function glossary() {
    const el = $('#glossary-data'); if (!el) return;
    let G = {}; try { G = JSON.parse(el.textContent); } catch (e) { console.error('glossary json', e); return; }
    const list = $('#glossary-list'), q = $('#glossary-search');
    const keys = Object.keys(G).sort((a, b) => G[a][0].localeCompare(G[b][0]));
    const more = k => G[k][2] ? ` <a class="x" href="${G[k][2]}">Learn more</a>` : '';
    function render(f = '') {
      f = f.trim().toLowerCase();
      const ks = keys.filter(k => !f || (G[k][0] + ' ' + G[k][1]).toLowerCase().includes(f));
      if (list) list.innerHTML = ks.map(k => `<div id="g-${k}"><dt>${G[k][0]}</dt><dd>${G[k][1]}${more(k)}</dd></div>`).join('') || '<p class="cap">No term matches that filter.</p>';
      const c = $('#glossary-count'); if (c) c.textContent = `${ks.length} of ${keys.length} terms`;
    }
    render(); if (q) q.addEventListener('input', () => render(q.value));
    document.addEventListener('click', e => {
      const b = e.target.closest('.term');
      if (!b) { if (pop && pop.classList.contains('gpop') && !e.target.closest('.pop')) closePop(); return; }
      const k = b.dataset.term, d = G[k]; if (!d) { console.warn('missing term', k); return; }
      closePop();
      pop = document.createElement('div'); pop.className = 'pop gpop'; pop.setAttribute('role', 'dialog'); popFor = b;
      pop.innerHTML = `<b>${d[0]}</b>${d[1]}<span class="go">${d[2] ? `<a class="x" href="${d[2]}">Learn more →</a> · ` : ''}<a href="#g-${k}">Glossary</a></span>`;
      document.body.appendChild(pop); placePop(b);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
  }

  /* ---------- optional checks between chapters (nothing is scored or saved) ---------- */
  function checks() {
    $$('details.check').forEach(det => {
      const data = $('script[type="application/json"]', det); if (!data) return;
      let Q = []; try { Q = JSON.parse(data.textContent); } catch (e) { console.error('check json', e); return; }
      const sum = $('summary', det);
      if (sum && !sum.innerHTML.trim()) sum.innerHTML = `<b>Check your understanding</b><span>optional · ${Q.length} question${Q.length > 1 ? 's' : ''}</span>`;
      const body = document.createElement('div'); body.className = 'check-body'; det.appendChild(body);
      body.innerHTML = Q.map(([q, opts], i) => `<div class="q" data-i="${i}"><div class="qt">${q}</div><div class="opts">${opts.map((o, j) => `<button type="button" data-j="${j}">${o}</button>`).join('')}</div><div class="ex" hidden></div></div>`).join('');
      body.addEventListener('click', e => {
        const b = e.target.closest('button[data-j]'); if (!b) return;
        const qd = b.closest('.q'), [, , right, why] = Q[+qd.dataset.i], j = +b.dataset.j;
        $$('button', qd).forEach(x => x.classList.remove('right', 'wrong'));
        b.classList.add(j === right ? 'right' : 'wrong');
        if (j !== right) $$('button', qd)[right].classList.add('right', 'reveal');
        const ex = $('.ex', qd); ex.hidden = false; ex.innerHTML = `<b>${j === right ? 'Yes.' : 'Not quite.'}</b> ${why}`;
      });
    });
  }


  /* ---------- implementation files: tabs, highlighting, copy ----------
     <div class="files"><div class="file" data-name="X.hlsl" data-lang="hlsl"><pre class="code">…escaped code…</pre></div>…</div> */
  const KW = {
    hlsl: 'return if else for while do break continue struct cbuffer in out inout const static uniform groupshared discard clip true false register numthreads unroll loop branch flatten',
    cs: 'using namespace class struct enum interface public private protected internal static readonly const void return if else for foreach while do break continue new var override virtual abstract sealed partial this base null true false in out ref is as get set typeof switch case default try catch finally throw yield',
    cpp: 'return if else for while struct const static void auto true false',
    py: 'import from for in if elif else def return and or not True False None isinstance with as class pass try except',
    sh: 'if then else elif fi for do done in while case esac exit echo set local return function',
    yaml: 'true false',
    txt: ''
  };
  const TY = {
    hlsl: /^(?:float|half|int|uint|bool|min16float|double)(?:[1-4](?:x[1-4])?)?$|^(?:void|Texture2D|Texture3D|Texture2DArray|TextureCube|RWTexture2D|RWTexture3D|RWTexture2DArray|StructuredBuffer|RWStructuredBuffer|AppendStructuredBuffer|ConsumeStructuredBuffer|ByteAddressBuffer|RWByteAddressBuffer|SamplerState|SamplerComparisonState|TEXTURE2D|SAMPLER|UnityTexture2D|UnitySamplerState)$/,
    cs: /^(?:float|int|uint|bool|byte|string|double|long|object)$|^[A-Z][A-Za-z0-9]*$/
  };
  function highlight(code, lang) {
    const kw = new Set((KW[lang] || KW.hlsl).split(' ')), ty = TY[lang] || TY.hlsl;
    const hashC = lang === 'py' || lang === 'sh' || lang === 'yaml';
    if (lang === 'txt') return esc(code);
    const re = hashC ? /(#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(\$\(?[A-Za-z_]+\)?)|(\b\d+(?:\.\d+)?(?:[eE][-+]?\d+)?\b|\.\d+\b)|([A-Za-z_][A-Za-z0-9_]*)/g
                     : /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*")|(#\s*[a-z]+)|(\b\d+(?:\.\d+)?(?:[eE][-+]?\d+)?[fFuU]?\b|\.\d+[fF]?\b)|([A-Za-z_][A-Za-z0-9_]*)/g;
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index)); last = re.lastIndex;
      const [t, c, st, pp, n, id] = m;
      if (c) out += `<span class="c">${esc(c)}</span>`;
      else if (st) out += `<span class="s">${esc(st)}</span>`;
      else if (pp) out += `<span class="k">${esc(pp)}</span>`;
      else if (n) out += `<span class="n">${esc(n)}</span>`;
      else if (kw.has(id)) out += `<span class="k">${id}</span>`;
      else if (ty.test(id) && !(lang === 'cs' && /^[A-Z]/.test(id) && code[re.lastIndex] === '(')) out += `<span class="t">${id}</span>`;
      else out += esc(id);
    }
    return out + esc(code.slice(last));
  }
  function files() {
    $$('.files').forEach(box => {
      const fs = $$('.file', box); if (!fs.length) return;
      fs.forEach(f => { const pre = $('pre', f); const raw = pre.textContent; f._raw = raw; pre.innerHTML = highlight(raw, f.dataset.lang); });
      const bar = document.createElement('div'); bar.className = 'files-bar';
      bar.innerHTML = '<div class="files-tabs" role="tablist">' + fs.map((f, i) => `<button type="button" role="tab" data-i="${i}">${esc(f.dataset.name)}</button>`).join('') + '</div><button type="button" class="files-copy">Copy</button>';
      box.prepend(bar);
      let cur = 0;
      const show = i => { cur = i; fs.forEach((f, k) => { f.hidden = k !== i; }); $$('.files-tabs button', bar).forEach((b, k) => b.setAttribute('aria-selected', k === i ? 'true' : 'false')); };
      bar.addEventListener('click', e => {
        const t = e.target.closest('.files-tabs button'); if (t) { show(+t.dataset.i); return; }
        const c = e.target.closest('.files-copy'); if (!c) return;
        const txt = fs[cur]._raw, done = () => { c.textContent = 'Copied'; setTimeout(() => { c.textContent = 'Copy'; }, 1400); };
        try { navigator.clipboard.writeText(txt).then(done, () => { fallbackCopy(txt); done(); }); } catch (_) { fallbackCopy(txt); done(); }
      });
      show(0);
    });
    $$('pre.code[data-lang]').forEach(pre => { if (!pre.closest('.files')) pre.innerHTML = highlight(pre.textContent, pre.dataset.lang); });
  }
  function fallbackCopy(t) { const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (_) {} a.remove(); }
  /* ---------- engine notes ---------- */
  const ENGINES = { hdrp: 'Unity HDRP', urp: 'Unity URP', unreal: 'Unreal Engine', any: 'Any engine' };
  function engines() {
    let pick = store.get('engine', 'hdrp');
    const boxes = $$('.engines');
    boxes.forEach(box => {
      const panes = $$('.eng', box);
      const tabs = document.createElement('div'); tabs.className = 'tabs'; tabs.setAttribute('role', 'group');
      tabs.innerHTML = '<span>' + (box.dataset.label || 'In your engine') + '</span>' + panes.map(p => `<button type="button" data-e="${p.dataset.engine}">${ENGINES[p.dataset.engine] || p.dataset.engine}</button>`).join('');
      box.prepend(tabs);
    });
    function show() {
      boxes.forEach(box => {
        const panes = $$('.eng', box), has = panes.some(p => p.dataset.engine === pick), want = has ? pick : panes[0].dataset.engine;
        panes.forEach(p => { p.hidden = p.dataset.engine !== want; });
        $$('.tabs button', box).forEach(b => b.setAttribute('aria-pressed', b.dataset.e === want ? 'true' : 'false'));
      });
    }
    document.addEventListener('click', e => { const b = e.target.closest('.engines .tabs button'); if (!b) return; pick = b.dataset.e; store.set('engine', pick); show(); });
    show();
  }

  /* ---------- live formulas ----------
     Atlas.fx(name, spec) fills <div class="fx" data-fx="name">. Every formula on the site uses it.
     spec = {
       title, expr: 'E = {I} · cos {th} / {d}²'  ({key} = a variable chip; HTML allowed),
       vars: { key: { sym, name, unit, min, max, value, step, log, values:[…], labels:[…], fmt, angle, const } },
       out:  { sym, name, unit, f(v), fmt }  or an array of outputs,
       sub(v)  optional custom substituted line (HTML); default substitutes values into expr,
       steps(v) optional [[label, value], …] intermediate results,
       plot: { x: 'd', y: [min, max], logY, zero, height } or false,
       draw(ctx, W, H, v, A) optional picture; drag(p, kind, v) → { key: value } to drag in the picture,
       size: [W, H] of each canvas, note: text under the widget
     } */
  const FX = {}, fxPalette = ['ray', 'accent', 'ax-y', 'ax-x', 'ax-z', 'cat-perf'];
  function fxDefine(name, spec) { FX[name] = spec; const el = document.querySelector(`.fx[data-fx="${name}"]`); if (el && !el.dataset.ready) fxBuild(el, spec); }
  function fxBuild(root, spec) {
    root.dataset.ready = '1';
    const keys = Object.keys(spec.vars || {});
    const vars = spec.vars || {};
    const outs = spec.out ? (Array.isArray(spec.out) ? spec.out : [spec.out]) : [];
    keys.forEach(k => { if (vars[k].derived) vars[k].const = true; });
    const live = keys.filter(k => !vars[k].const);
    keys.forEach((k, i) => { if (!vars[k].color) vars[k].color = fxPalette[i % fxPalette.length]; });
    const v = {}; keys.forEach(k => { const d = vars[k]; v[k] = d.values ? d.values[d.index != null ? d.index : 0] : d.value; });
    let xKey = spec.plot && spec.plot.x || live[0];
    const id = 'fx-' + (root.dataset.fx || Math.random().toString(36).slice(2));
    const symOf = k => vars[k].sym || k;
    const fmtVar = k => { const d = vars[k], x = v[k]; if (d.fmt) return d.fmt(x); if (d.labels) return d.labels[d.values.indexOf(x)]; return num(x) + (d.unit && d.unitInline !== false && (d.unit === '°' || d.unit === '%') ? d.unit : ''); };
    const fmtOut = (o, x) => o.fmt ? o.fmt(x, v) : num(x);
    const evalOut = (o, vv) => { try { return o.f(vv); } catch (e) { return NaN; } };
    const exprHTML = spec.expr.replace(/\{(\w+)\}/g, (m, k) => vars[k] ? `<button type="button" class="fv${vars[k].const ? ' const' : ''}" data-k="${k}" style="--v:var(--${vars[k].color})" title="${esc(vars[k].name || k)}">${symOf(k)}</button>` : m);
    const exprWrapped = exprHTML.split(/(?:,|;)\s{2,}/).map(part => `<span class="fx-part">${part}</span>`).join('<span class="fx-sep">,</span> ');
    const hasDraw = typeof spec.draw === 'function', hasPlot = spec.plot !== false && outs.length && live.length;
    const [CW, CH] = spec.size || [440, 280];
    root.innerHTML = `
      <div class="fx-head"><span class="fx-title">${spec.title || ''}</span>${hasPlot ? '<span class="fx-hint">Click a coloured symbol to graph against it</span>' : ''}</div>
      <div class="fx-expr">${exprWrapped}</div>
      <div class="fx-sub" aria-live="polite"></div>
      ${spec.steps ? '<div class="fx-steps"></div>' : ''}
      ${hasDraw || hasPlot ? `<div class="fx-body${hasDraw && hasPlot ? ' two' : ''}">${hasDraw ? `<canvas class="fx-draw" width="${CW}" height="${CH}" aria-label="Picture of ${esc(spec.title || 'the formula')}"></canvas>` : ''}${hasPlot ? `<canvas class="fx-plot" width="${hasDraw ? CW : CW * 2}" height="${(spec.plot && spec.plot.height) || CH}" aria-label="Graph of ${esc(spec.title || 'the formula')}"></canvas>` : ''}</div>` : ''}
      <div class="fx-vars">${keys.map(k => { const d = vars[k]; const n = d.values ? d.values.length - 1 : null;
        const sl = d.const ? `<span class="fx-const">${d.derived ? 'computed from the sliders above' : 'constant'}</span>` : `<input type="range" id="${id}-${k}" min="${d.values ? 0 : d.log ? Math.log(d.min) : d.min}" max="${d.values ? n : d.log ? Math.log(d.max) : d.max}" step="${d.values ? 1 : d.log ? 'any' : (d.step || (d.max - d.min) / 200)}" value="${d.values ? (d.index || 0) : d.log ? Math.log(v[k]) : v[k]}" aria-label="${esc(d.name || k)}">`;
        return `<label class="fx-var" data-k="${k}" style="--v:var(--${d.color})"><span class="fv-s">${symOf(k)}</span><span class="fv-n">${d.name || ''}${d.unit && d.unit !== '°' ? ` <i>${d.unit}</i>` : ''}</span>${sl}<output></output></label>`; }).join('')}</div>
      ${hasPlot || spec.animate ? `<div class="fx-ctl">${hasPlot ? `<button type="button" class="btn fx-play">Animate <span class="fx-pk"></span></button>` : ''}${spec.note ? `<span class="cap">${spec.note}</span>` : ''}</div>` : (spec.note ? `<p class="cap">${spec.note}</p>` : '')}`;
    const sub = $('.fx-sub', root), stepsEl = $('.fx-steps', root);
    const A = { col, alpha, num, short, fmt, clamp, lerp, v, vars, outs, evalOut, arrow, dot, label: lbl, grid: (ctx, W, H, o) => grid2d(ctx, W, H, o) };
    let drawFig = null, plotFig = null, pmap = null;
    if (hasDraw) {
      const c = $('.fx-draw', root);
      drawFig = fig(c, (ctx, W, H) => spec.draw(ctx, W, H, v, A));
      if (spec.drag) pointer(c, drawFig.w, drawFig.h, (p, kind) => { if (kind === 'hover') return; const upd = spec.drag(p, kind, v); if (upd) { stop(); Object.assign(v, upd); syncSliders(); refresh(); } });
    }
    if (hasPlot) {
      const c = $('.fx-plot', root);
      plotFig = fig(c, (ctx, W, H) => plot(ctx, W, H));
      pointer(c, plotFig.w, plotFig.h, (p, kind) => { if (kind === 'hover' || kind === 'up' || !pmap) return; const d = vars[xKey]; let x = pmap.inv(p.x); if (d.values) { let bi = 0; d.values.forEach((val, i) => { if (Math.abs(val - x) < Math.abs(d.values[bi] - x)) bi = i; }); x = d.values[bi]; } else x = clamp(d.step ? Math.round(x / d.step) * d.step : x, d.min, d.max); stop(); v[xKey] = x; syncSliders(); refresh(); });
    }
    function niceTicks(a, b, n = 5) {
      const span = b - a; if (!(span > 0)) return [a];
      const step0 = span / n, p = Math.pow(10, Math.floor(Math.log10(step0))), m = step0 / p, step = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
      const t = []; for (let x = Math.ceil(a / step) * step; x <= b + step * 1e-6; x += step) t.push(Math.abs(x) < step * 1e-9 ? 0 : x); return t;
    }
    function logTicks(a, b) { const t = []; for (let e = Math.floor(Math.log10(a)); e <= Math.ceil(Math.log10(b)); e++) { const x = Math.pow(10, e); if (x >= a * 0.999 && x <= b * 1.001) t.push(x); } return t.length >= 2 ? t : niceTicks(a, b); }
    function plot(ctx, W, H) {
      const d = vars[xKey], P = spec.plot || {};
      const ink = col('ink'), muted = col('muted'), line = col('line');
      const R = W - 14, T = 16, B = H - 38; let L = 54;
      const xs = d.values ? d.values.slice() : [];
      const lx = !!d.log, x0 = d.values ? Math.min(...d.values) : d.min, x1 = d.values ? Math.max(...d.values) : d.max;
      const xt = x => lx ? Math.log(x) : x, X = x => L + (xt(x) - xt(x0)) / (xt(x1) - xt(x0)) * (R - L);
      if (!d.values) for (let i = 0; i <= 240; i++) xs.push(lx ? Math.exp(Math.log(x0) + (Math.log(x1) - Math.log(x0)) * i / 240) : x0 + (x1 - x0) * i / 240);
      const series = outs.map(o => xs.map(x => { const vv = Object.assign({}, v, { [xKey]: x }); return evalOut(o, vv); }));
      let y0, y1; const ly = !!P.logY;
      if (P.y) [y0, y1] = P.y; else {
        const all = series.flat().filter(y => isFinite(y) && (!ly || y > 0));
        y0 = all.length ? Math.min(...all) : 0; y1 = all.length ? Math.max(...all) : 1;
        if (P.zero !== false && !ly) { y0 = Math.min(0, y0); y1 = Math.max(0, y1); }
        if (y1 - y0 < 1e-9) { y1 = y0 + 1; }
        if (!ly) { const pad = (y1 - y0) * 0.08; y1 += pad; if (y0 < 0) y0 -= pad; }
      }
      const yT = ly ? logTicks(y0, y1) : niceTicks(y0, y1, 4);
      ctx.font = '11px "JetBrains Mono Variable","JetBrains Mono",monospace';
      L = Math.max(40, 12 + Math.max(...yT.map(t => ctx.measureText(short(t)).width)));
      const yt = y => ly ? Math.log(y) : y, Y = y => B - (yt(y) - yt(y0)) / (yt(y1) - yt(y0)) * (B - T);
      pmap = { inv: px => { const t = clamp((px - L) / (R - L), 0, 1); return lx ? Math.exp(Math.log(x0) + t * (Math.log(x1) - Math.log(x0))) : x0 + t * (x1 - x0); } };
      ctx.font = '11px "JetBrains Mono Variable","JetBrains Mono",monospace'; ctx.textBaseline = 'middle';
      const xT = d.values ? d.values.slice().sort((a, b) => a - b) : lx ? logTicks(x0, x1) : niceTicks(x0, x1, 6);
      let lastR = -1e9;
      xT.forEach(t => { const x = X(t); ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, B); ctx.stroke();
        const lab = d.values && d.labels ? (d.labels[d.values.indexOf(t)] || short(t)) : short(t), w = ctx.measureText(lab).width;
        if (x - w / 2 < lastR + 6) return; lastR = x + w / 2;
        ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.fillText(lab, x, B + 13); });
      yT.forEach(t => { const y = Y(t); ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke(); ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.fillText(short(t), L - 6, y); });
      if (!ly && y0 < 0 && y1 > 0) { ctx.strokeStyle = muted; ctx.beginPath(); ctx.moveTo(L, Y(0)); ctx.lineTo(R, Y(0)); ctx.stroke(); }
      ctx.fillStyle = col(d.color); ctx.textAlign = 'center'; ctx.font = '600 12px "Source Sans 3 Variable","Source Sans 3",sans-serif';
      ctx.fillText(`${strip(symOf(xKey))}  ${d.name || ''}${d.unit ? ' (' + d.unit + ')' : ''}${lx ? ', log scale' : ''}`, (L + R) / 2, H - 9);
      ctx.save(); ctx.beginPath(); ctx.rect(L, T - 2, R - L, B - T + 4); ctx.clip();
      series.forEach((s, oi) => {
        const o = outs[oi], c = col(o.color || (oi ? fxPalette[(oi + 1) % fxPalette.length] : 'ink'));
        ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.setLineDash(o.dash || []); ctx.beginPath(); let pen = false;
        s.forEach((y, i) => { const ok = isFinite(y) && (!ly || y > 0); if (!ok) { pen = false; return; } const px = X(xs[i]), py = Y(y); if (d.values) { if (!pen) ctx.moveTo(px, py); else ctx.lineTo(px, py); } else { pen ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } pen = true; });
        ctx.stroke(); ctx.setLineDash([]);
        if (d.values) s.forEach((y, i) => { if (isFinite(y)) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(X(xs[i]), Y(y), 2.5, 0, 7); ctx.fill(); } });
      });
      ctx.restore();
      // current value marker
      const cx = X(v[xKey]);
      ctx.strokeStyle = col(d.color); ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(cx, T); ctx.lineTo(cx, B); ctx.stroke(); ctx.setLineDash([]);
      const tags = [];
      outs.forEach((o, oi) => { const y = evalOut(o, v); if (!isFinite(y) || (ly && y <= 0)) return; const py = clamp(Y(y), T, B), c = col(o.color || (oi ? fxPalette[(oi + 1) % fxPalette.length] : 'ink'));
        ctx.fillStyle = col('bg'); ctx.beginPath(); ctx.arc(cx, py, 6, 0, 7); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, py, 4.5, 0, 7); ctx.fill();
        tags.push({ txt: `${strip(o.sym)} = ${fmtOut(o, y)}${o.unit ? ' ' + o.unit : ''}`, y: py - 12, c }); });
      tags.sort((a, b) => a.y - b.y);
      for (let i = 1; i < tags.length; i++) if (tags[i].y - tags[i - 1].y < 18) tags[i].y = tags[i - 1].y + 18;
      ctx.font = '600 12px "JetBrains Mono Variable","JetBrains Mono",monospace';
      tags.forEach(g => { const tw = ctx.measureText(g.txt).width, tx = cx + 10 + tw > R ? cx - 10 - tw : cx + 10, ty = clamp(g.y, T + 8, B - 8);
        ctx.fillStyle = alpha(col('bg'), 0.88); ctx.fillRect(tx - 4, ty - 9, tw + 8, 18); ctx.fillStyle = g.c; ctx.textAlign = 'left'; ctx.fillText(g.txt, tx, ty); });
      ctx.fillStyle = muted; ctx.textAlign = 'left'; ctx.font = '600 12px "Source Sans 3 Variable","Source Sans 3",sans-serif';
      ctx.fillText(outs.map(o => `${strip(o.sym)}${o.unit ? ' (' + o.unit + ')' : ''}`).join(', ') + (ly ? ', log scale' : ''), L + 4, T + 2);
    }
    function strip(h) { return String(h).replace(/<sub>(.*?)<\/sub>/g, '$1').replace(/<sup>2<\/sup>/g, '²').replace(/<[^>]+>/g, ''); }
    function arrow(ctx, x0, y0, x1, y1, c, w = 2.5, head = 9) {
      const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0); if (L < 1) return;
      ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * head * 0.8, y1 - Math.sin(a) * head * 0.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a - 0.4) * head, y1 - Math.sin(a - 0.4) * head); ctx.lineTo(x1 - Math.cos(a + 0.4) * head, y1 - Math.sin(a + 0.4) * head); ctx.closePath(); ctx.fill();
    }
    function dot(ctx, x, y, c, r = 5) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
    function lbl(ctx, text, x, y, c, align = 'left', bold) { ctx.font = (bold ? '600 ' : '') + '12px "Source Sans 3 Variable","Source Sans 3",sans-serif'; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = c; ctx.fillText(text, x, y); }
    function syncSliders() {
      keys.forEach(k => { const d = vars[k], inp = document.getElementById(`${id}-${k}`); if (!inp) return; inp.value = d.values ? d.values.indexOf(v[k]) : d.log ? Math.log(v[k]) : v[k]; });
    }
    function refresh() {
      keys.forEach(k => { if (vars[k].derived) v[k] = vars[k].derived(v); });
      keys.forEach(k => { const o = $(`.fx-var[data-k="${k}"] output`, root); if (o) o.textContent = fmtVar(k) + (vars[k].unit && !['°', '%'].includes(vars[k].unit) ? ' ' + vars[k].unit : ''); });
      if (spec.sub) sub.innerHTML = spec.sub(v, num);
      else {
        const eq = spec.expr.indexOf('='), left = eq < 0 ? '' : spec.expr.slice(0, eq + 1) + ' ', rhs = eq < 0 ? spec.expr : spec.expr.slice(eq + 1);
        const filled = rhs.replace(/\{(\w+)\}/g, (m, k) => vars[k] ? `<span class="sv" style="--v:var(--${vars[k].color})">${v[k] < 0 ? '(' + fmtVar(k) + ')' : fmtVar(k)}</span>` : m);
        const o = outs[0]; const y = o ? evalOut(o, v) : NaN;
        sub.innerHTML = `${left.replace(/\{(\w+)\}/g, (m, k) => vars[k] ? symOf(k) : m)}${filled}${o ? ` = <b>${fmtOut(o, y)}${o.unit ? ' ' + o.unit : ''}</b>` : ''}`;
      }
      if (stepsEl) stepsEl.innerHTML = spec.steps(v, num).map(([a, b]) => `<span><i>${a}</i> = ${b}</span>`).join('');
      if (drawFig) drawFig.draw(); if (plotFig) plotFig.draw();
      $$('.fv', root).forEach(b => b.classList.toggle('on', b.dataset.k === xKey));
      $$('.fx-var', root).forEach(r => r.classList.toggle('on', r.dataset.k === xKey));
      const pk = $('.fx-pk', root); if (pk) pk.innerHTML = symOf(xKey);
    }
    keys.forEach(k => {
      const inp = document.getElementById(`${id}-${k}`); if (!inp) return;
      inp.addEventListener('input', () => { stop(); const d = vars[k]; v[k] = d.values ? d.values[+inp.value] : d.log ? Math.exp(+inp.value) : +inp.value; refresh(); });
    });
    root.addEventListener('click', e => { const b = e.target.closest('.fv'); if (!b || vars[b.dataset.k].const || !hasPlot) return; xKey = b.dataset.k; refresh(); });
    root.addEventListener('pointerover', e => { const b = e.target.closest('.fv,.fx-var'); $$('.fx-var,.fv', root).forEach(r => r.classList.toggle('hl', !!b && r.dataset.k === b.dataset.k)); });
    root.addEventListener('pointerleave', () => $$('.hl', root).forEach(r => r.classList.remove('hl')));
    // animation: sweep the graphed variable back and forth
    let raf = 0, t0 = 0, base = null;
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; const b = $('.fx-play', root); if (b) b.classList.remove('primary'); } }
    function tick(t) {
      const d = vars[xKey], ph = 0.5 - 0.5 * Math.cos((t - t0) / 1000 * Math.PI / 2.2);
      if (d.values) v[xKey] = d.values[Math.round(ph * (d.values.length - 1))];
      else v[xKey] = d.log ? Math.exp(Math.log(d.min) + ph * (Math.log(d.max) - Math.log(d.min))) : d.min + ph * (d.max - d.min);
      syncSliders(); refresh(); raf = requestAnimationFrame(tick);
    }
    const play = $('.fx-play', root);
    if (play) play.addEventListener('click', () => { if (raf) { stop(); return; } play.classList.add('primary'); t0 = performance.now(); raf = requestAnimationFrame(tick); });
    new IntersectionObserver(es => { if (!es[0].isIntersecting) stop(); }).observe(root);
    refresh();
    root.fx = { v, refresh, set(k, x) { v[k] = x; syncSliders(); refresh(); } };
  }

  /* grid2d(ctx, W, H, opt): draws a 2D coordinate grid. opt = { cx, cy (origin in px), s (px per unit), step }.
     Returns { X(x), Y(y), inv(px, py) → [x, y] }. y points up. */
  function grid2d(ctx, W, H, o = {}) {
    const s = o.s || 40, cx = o.cx != null ? o.cx : W / 2, cy = o.cy != null ? o.cy : H / 2, st = o.step || 1;
    const X = x => cx + x * s, Y = y => cy - y * s;
    ctx.lineWidth = 1;
    for (let x = Math.ceil(-cx / s / st) * st; X(x) <= W; x += st) { ctx.strokeStyle = alpha(col('line'), x === 0 ? 1 : 0.55); ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), H); ctx.stroke(); }
    for (let y = Math.ceil(-(H - cy) / s / st) * st; Y(y) >= 0; y += st) { ctx.strokeStyle = alpha(col('line'), y === 0 ? 1 : 0.55); ctx.beginPath(); ctx.moveTo(0, Y(y)); ctx.lineTo(W, Y(y)); ctx.stroke(); }
    if (o.axes !== false) {
      ctx.strokeStyle = alpha(col('muted'), 0.9); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
      ctx.fillStyle = col('muted'); ctx.font = '600 12px "Source Sans 3 Variable",sans-serif'; ctx.textBaseline = 'middle';
      ctx.textAlign = 'right'; ctx.fillText(o.xl || 'x', W - 6, cy - 10); ctx.textAlign = 'left'; ctx.fillText(o.yl || 'y', cx + 6, 10);
    }
    return { X, Y, s, inv: (px, py) => [(px - cx) / s, (cy - py) / s] };
  }
  function arrowG(ctx, x0, y0, x1, y1, c, w = 2.5, head = 10) {
    const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0); if (L < 1) return;
    ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * head * 0.8, y1 - Math.sin(a) * head * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a - 0.4) * head, y1 - Math.sin(a - 0.4) * head); ctx.lineTo(x1 - Math.cos(a + 0.4) * head, y1 - Math.sin(a + 0.4) * head); ctx.closePath(); ctx.fill();
  }
  function text(ctx, t, x, y, c, align = 'left', bold) { ctx.font = (bold ? '600 ' : '') + '13px "Source Sans 3 Variable","Source Sans 3",sans-serif'; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = c; ctx.fillText(t, x, y); }

  window.Atlas = { $, $$, fig, pointer, range, seg, col, alpha, clamp, lerp, fmt, num, pn, short, esc, store, redraw: redrawAll, onRedraw: f => redrawers.add(f), fx: fxDefine, href: hrefFor, reduceMotion, grid2d, arrow: arrowG, text };

  function boot() {
    crumbs(); rail(); chapterChips(); needsNext(); xlinks(); glossary(); checks(); engines(); files();
    $$('.fx[data-fx]').forEach(el => { const s = FX[el.dataset.fx]; if (s && !el.dataset.ready) fxBuild(el, s); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
