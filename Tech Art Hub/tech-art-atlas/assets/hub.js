/* Tech Art Atlas — hub: featured mosaic, learning paths, filters and the catalogue. Images come from renders.js.
   Counts come from assets/index.js (written by tools/build.py). Nothing about the reader is stored except the
   theme and engine choice. */
(function () {
  'use strict';
  const CATS = window.ATLAS_CATEGORIES, UNITS = window.ATLAS_UNITS, PATHS = window.ATLAS_PATHS || [];
  const IDX = (window.ATLAS_INDEX && window.ATLAS_INDEX.units) || {};
  const catOf = id => CATS.find(c => c.id === id);
  const unit = slug => UNITS.find(u => u.slug === slug);
  function get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const render = () => { if (window.AtlasRender) window.AtlasRender.drawAll(); };
  const stat = (u, k) => { const x = IDX[u.slug]; if (!x) return 0; return k === 'chapters' ? (Array.isArray(x.chapters) ? x.chapters.length : x.chapters || 0) : (x.stats && x.stats[k]) || 0; };

  /* ---------- featured mosaic ---------- */
  const featured = (window.ATLAS_FEATURED || ['interior-mapping', 'cloud-march', 'pbr-brdf', 'light-types', 'parallax']).map(unit).filter(Boolean).slice(0, 5);
  document.getElementById('mosaic').innerHTML = featured.map(u => `<a href="${u.path}" aria-label="${esc(u.title)}"><canvas data-render="${u.slug}" aria-hidden="true"></canvas><span>${esc(u.title)}</span></a>`).join('');

  /* ---------- counts ---------- */
  const total = k => UNITS.reduce((a, u) => a + stat(u, k), 0);
  document.getElementById('counts').innerHTML = [[UNITS.length, 'units'], [total('chapters'), 'chapters'], [total('fx'), 'live formulas'], [total('labs'), 'labs']].map(([n, l]) => `<span><b>${n}</b>${l}</span>`).join('');

  /* ---------- learning paths ---------- */
  const pathsEl = document.getElementById('paths');
  if (pathsEl && PATHS.length) {
    pathsEl.innerHTML = `<div class="group-head"><h2>Where to start</h2><p>Suggested orders. Every unit also links back to the lessons it builds on, so you can start anywhere and fill gaps as you go.</p></div>
      <div class="paths">${PATHS.map(p => `<div class="path"><h3>${esc(p.name)}</h3><ol>${p.units.map(unit).filter(Boolean).map(u => `<li><a href="${u.path}" style="--c:var(--${catOf(u.cat).color})"><i></i>${esc(u.title)}</a></li>`).join('')}</ol></div>`).join('')}</div>`;
  }

  /* ---------- filters and catalogue ---------- */
  let cat = 'all', q = '';
  const chips = document.getElementById('chips');
  chips.innerHTML = [`<button type="button" class="chip" data-c="all" aria-pressed="true">All units</button>`].concat(CATS.map(c => `<button type="button" class="chip" data-c="${c.id}" aria-pressed="false" style="--c:var(--${c.color})"><i></i>${esc(c.name)}</button>`)).join('');
  chips.addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; cat = b.dataset.c; [...chips.children].forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); draw(); });
  const qEl = document.getElementById('q'); qEl.addEventListener('input', () => { q = qEl.value.trim().toLowerCase(); draw(); });
  const eng = document.getElementById('engine'); eng.value = get('atlas:engine', 'hdrp'); eng.addEventListener('change', () => { set('atlas:engine', eng.value); draw(); });
  const ENGINE_NAME = { hdrp: 'Unity HDRP', urp: 'Unity URP', unreal: 'Unreal' };

  function match(u) {
    if (cat !== 'all' && u.cat !== cat) return false;
    if (!q) return true;
    const ch = IDX[u.slug] && Array.isArray(IDX[u.slug].chapters) ? IDX[u.slug].chapters.map(c => c.title).join(' ') : '';
    return [u.title, u.topic, u.summary, ch, ...(u.tags || [])].join(' ').toLowerCase().includes(q);
  }
  function card(u) {
    const c = catOf(u.cat), en = ENGINE_NAME[eng.value];
    const has = u.engines.includes(en);
    return `<a class="card-u" href="${u.path}" style="--c:var(--${c.color})">
      <div class="shot"><canvas data-render="${u.slug}" aria-hidden="true"></canvas><span class="badge"><i></i>${esc(u.level)}</span></div>
      <div class="body">
        <span class="cat">${esc(c.name)} · ${esc(u.topic)}</span>
        <h3>${esc(u.title)}</h3>
        <p>${esc(u.summary)}</p>
        <div class="stats"><span><b>${stat(u, 'chapters')}</b> chapters</span><span><b>${stat(u, 'fx')}</b> live formulas</span><span>about <b>${u.minutes}</b> min</span></div>
        <div class="eng">${u.engines.length === 3 ? '<span class="pill good">Unity HDRP · URP · Unreal</span>' : u.engines.map(e => `<span class="pill${e === en ? ' good' : ''}">${esc(e)}</span>`).join('') + (!has && u.transfers ? `<span class="pill">maths applies to ${esc(en)}</span>` : '')}</div>
      </div></a>`;
  }
  function group(c, us) {
    return `<section class="group" aria-label="${esc(c ? c.name : 'Units')}"${c ? ` style="--c:var(--${c.color})"` : ''}>
      <div class="group-head"><h2${c ? '' : ' class="all"'}>${c ? esc(c.name) : 'Matching units'}</h2>${c ? `<p>${esc(c.blurb)}</p>` : ''}<span class="count">${us.length} unit${us.length > 1 ? 's' : ''}</span></div>
      <div class="cards">${us.map(card).join('')}</div></section>`;
  }
  // keep rendered images across filter changes: reuse canvases by slug
  const cache = {};
  function draw() {
    document.querySelectorAll('#catalogue canvas[data-rendered]').forEach(cv => { cache[cv.dataset.render] = cv; });
    const main = document.getElementById('catalogue');
    const us = UNITS.filter(match);
    if (!us.length) main.innerHTML = `<p class="empty">No unit matches “${esc(q)}”. Try a broader word like shader, light or texture.</p>`;
    else if (q) main.innerHTML = group(cat === 'all' ? null : catOf(cat), us);
    else main.innerHTML = CATS.filter(c => cat === 'all' || c.id === cat).map(c => { const g = us.filter(u => u.cat === c.id); return g.length ? group(c, g) : ''; }).join('');
    main.querySelectorAll('canvas[data-render]').forEach(cv => { const old = cache[cv.dataset.render]; if (old) cv.replaceWith(old); });
    render();
  }
  draw();
})();
