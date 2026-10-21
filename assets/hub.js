/* Tech Art Atlas — hub: a browse page with a filter sidebar (categories, learning paths, level, engine),
   a search box, a sort menu and a grid of unit thumbnails rendered by renders.js.
   The current filter lives in the URL (?c=, ?path=, ?level=, ?q=, ?sort=) so views can be linked.
   Nothing about the reader is stored except the theme and engine choice. */
(function () {
  'use strict';
  const CATS = window.ATLAS_CATEGORIES, UNITS = window.ATLAS_UNITS, PATHS = window.ATLAS_PATHS || [];
  const IDX = (window.ATLAS_INDEX && window.ATLAS_INDEX.units) || {};
  const LEVELS = ['Start here', 'Foundations', 'Beginner', 'Intermediate', 'Advanced'];
  const catOf = id => CATS.find(c => c.id === id);
  const unit = slug => UNITS.find(u => u.slug === slug);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  const stat = (u, k) => { const x = IDX[u.slug]; if (!x) return 0; return k === 'chapters' ? (Array.isArray(x.chapters) ? x.chapters.length : x.chapters || 0) : (x.stats && x.stats[k]) || 0; };
  const order = UNITS.slice().sort((a, b) => CATS.findIndex(c => c.id === a.cat) - CATS.findIndex(c => c.id === b.cat));   // category order, then catalogue order

  /* ---------- state from the URL ---------- */
  const P = new URLSearchParams(location.search);
  const st = { cat: P.get('c') || 'all', path: P.has('path') ? Math.max(0, Math.min(PATHS.length - 1, (+P.get('path') || 1) - 1)) : null, level: P.get('level') || 'all', q: (P.get('q') || '').trim(), sort: P.get('sort') || 'rec' };
  if (st.path !== null) st.cat = 'all';
  if (st.path !== null || st.level !== 'all') document.getElementById('side').classList.add('open');
  function syncURL() {
    const u = new URLSearchParams();
    if (st.cat !== 'all') u.set('c', st.cat);
    if (st.path !== null) u.set('path', st.path + 1);
    if (st.level !== 'all') u.set('level', st.level);
    if (st.q) u.set('q', st.q);
    if (st.sort !== 'rec') u.set('sort', st.sort);
    const s = u.toString();
    try { history.replaceState(null, '', s ? '?' + s : location.pathname); } catch (e) {}
  }

  /* ---------- sidebar ---------- */
  const side = document.getElementById('side');
  const levelsUsed = LEVELS.filter(l => UNITS.some(u => u.level === l));
  function sidebar() {
    const item = (attrs, label, n, on) => `<button type="button" class="sn-item" ${attrs} aria-pressed="${on}">${esc(label)}<span>${n}</span></button>`;
    side.innerHTML = `
      <div class="sn-group"><div class="sn-h">Categories</div><div class="sn-list">
        ${item('data-c="all"', 'All units', UNITS.length, st.cat === 'all' && st.path === null)}
        ${CATS.map(c => item(`data-c="${c.id}"`, c.name, UNITS.filter(u => u.cat === c.id).length, st.cat === c.id)).join('')}
      </div><button type="button" class="sn-toggle" aria-expanded="${side.classList.contains('open')}">Paths, level and engine</button></div>
      <div class="sn-group extra"><div class="sn-h">Learning paths</div><div class="sn-list">
        ${PATHS.map((p, i) => item(`data-p="${i}"`, p.name, p.units.length, st.path === i)).join('')}
      </div></div>
      <div class="sn-group extra"><div class="sn-h">Level</div><div class="sn-list">
        ${item('data-l="all"', 'Any level', UNITS.length, st.level === 'all')}
        ${levelsUsed.map(l => item(`data-l="${esc(l)}"`, l, UNITS.filter(u => u.level === l).length, st.level === l)).join('')}
      </div></div>
      <div class="sn-group extra"><div class="sn-h"><label for="engine">Engine notes</label></div>
        <select class="sel" id="engine"><option value="hdrp">Unity HDRP</option><option value="urp">Unity URP</option><option value="unreal">Unreal Engine</option></select>
      </div>`;
    const eng = document.getElementById('engine');
    eng.value = get('atlas:engine', 'hdrp');
    eng.addEventListener('change', () => set('atlas:engine', eng.value));
  }
  side.addEventListener('click', e => {
    const t = e.target.closest('.sn-toggle'); if (t) { side.classList.toggle('open'); t.setAttribute('aria-expanded', side.classList.contains('open')); return; }
    const b = e.target.closest('.sn-item'); if (!b) return;
    if (b.dataset.c) { st.cat = b.dataset.c; st.path = null; }
    else if (b.dataset.p !== undefined) { st.path = +b.dataset.p; st.cat = 'all'; }
    else if (b.dataset.l) st.level = b.dataset.l;
    if (st.path === null && st.sort === 'path') st.sort = 'rec';
    update(true);
  });

  /* ---------- toolbar ---------- */
  const qEl = document.getElementById('q'), sortEl = document.getElementById('sort');
  qEl.value = st.q;
  qEl.addEventListener('input', () => { st.q = qEl.value.trim(); update(false); });
  const SORTS = [['rec', 'Recommended'], ['name', 'Name'], ['short', 'Shortest first'], ['long', 'Longest first'], ['fx', 'Most live formulas']];
  function sortOptions() {
    const opts = (st.path !== null ? [['path', 'Path order']] : []).concat(SORTS);
    if (!opts.some(o => o[0] === st.sort)) st.sort = opts[0][0];
    if (st.path !== null && st.sort === 'rec') st.sort = 'path';
    sortEl.innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    sortEl.value = st.sort;
  }
  sortEl.addEventListener('change', () => { st.sort = sortEl.value; update(false); });

  /* ---------- filtering and sorting ---------- */
  function matches(u) {
    if (st.cat !== 'all' && u.cat !== st.cat) return false;
    if (st.level !== 'all' && u.level !== st.level) return false;
    if (!st.q) return true;
    const ch = IDX[u.slug] && Array.isArray(IDX[u.slug].chapters) ? IDX[u.slug].chapters.map(c => c.title).join(' ') : '';
    const hay = [u.title, u.topic, u.summary, ch, ...(u.tags || [])].join(' ').toLowerCase();
    return st.q.toLowerCase().split(/\s+/).every(w => hay.includes(w));
  }
  function list() {
    let us = st.path !== null ? PATHS[st.path].units.map(unit).filter(Boolean) : order.slice();
    us = us.filter(matches);
    const by = { name: (a, b) => a.title.localeCompare(b.title), short: (a, b) => a.minutes - b.minutes, long: (a, b) => b.minutes - a.minutes, fx: (a, b) => stat(b, 'fx') - stat(a, 'fx') }[st.sort];
    return by ? us.slice().sort(by) : us;
  }

  /* ---------- grid ---------- */
  const grid = document.getElementById('grid');
  const cache = {};   // keep rendered thumbnails across filter changes
  function tile(u, i) {
    const c = catOf(u.cat);
    const eng = u.engines.length < 3 ? ' · ' + esc(u.engines.join(', ')) : '';
    const n = st.path !== null && st.sort === 'path' ? `<span class="no">${PATHS[st.path].units.indexOf(u.slug) + 1}</span>` : '';
    return `<a class="tile" href="${u.path}">
      <div class="thumb"><canvas data-render="${u.slug}" aria-hidden="true"></canvas>${n}<div class="info">${esc(u.summary)}</div></div>
      <div class="t-title">${esc(u.title)}</div>
      <div class="t-meta">${esc(c ? c.name : '')} · ${stat(u, 'chapters')} chapters · ${u.minutes} min${eng}</div>
    </a>`;
  }
  function head(n) {
    const t = document.getElementById('b-title'), cnt = document.getElementById('b-count'), d = document.getElementById('b-desc');
    if (st.path !== null) { const p = PATHS[st.path]; t.textContent = p.name; d.textContent = 'A suggested order. Each unit also links back to the lessons it builds on, so you can start anywhere and fill gaps as you go.'; }
    else if (st.cat !== 'all') { const c = catOf(st.cat); t.textContent = c.name; d.textContent = c.blurb; }
    else {
      t.textContent = 'All units';
      const tot = k => UNITS.reduce((a, u) => a + stat(u, k), 0);
      d.textContent = `Free, interactive lessons on how real-time graphics work, from what a pixel shader is to character shading, procedural materials in Substance Designer and keeping a Unity project in order. ${tot('chapters')} chapters, ${tot('fx')} live formulas, ${tot('labs')} labs.`;
    }
    cnt.textContent = `${n} unit${n === 1 ? '' : 's'}` + (st.level !== 'all' ? ` · ${st.level}` : '');
  }
  const navLinks = document.querySelectorAll('.hubtop nav a');
  function update(scrollTop) {
    sidebar(); sortOptions(); syncURL();
    navLinks.forEach((a, i) => { if (i < 2) { if ((i === 1) === (st.path !== null)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); } });
    grid.querySelectorAll('canvas[data-rendered]').forEach(cv => { cache[cv.dataset.render] = cv; });
    const us = list();
    head(us.length);
    grid.innerHTML = us.length ? us.map(tile).join('') : `<p class="empty">No unit matches “${esc(st.q)}”. Try a broader word like shader, light or texture.</p>`;
    grid.querySelectorAll('canvas[data-render]').forEach(cv => { const old = cache[cv.dataset.render]; if (old) cv.replaceWith(old); });
    if (window.AtlasRender) window.AtlasRender.drawAll(grid);
    if (scrollTop && window.scrollY > 200) window.scrollTo({ top: 0 });
  }
  update(false);
})();
