/* Tech Art Atlas — hub. A browse page in the style of an asset library:
   an icon rail, a search pill, filter dropdowns (type, software, topic, level, sort), a featured banner,
   learning-path cards and rows of unit tiles. Tiles show the software badge, a topic colour and UNIT / WORKFLOW.
   The current view lives in the URL (?q= &type= &sw= &c= &level= &sort= &path= &view=paths) so views can be linked.
   Pictures come from assets/img/ by file name (listed in assets/index.js by tools/build.py); placeholders otherwise. */
(function () {
  'use strict';
  const CATS = window.ATLAS_CATEGORIES, UNITS = window.ATLAS_UNITS, PATHS = window.ATLAS_PATHS || [];
  const SW = window.ATLAS_SOFTWARE || {}, FEAT = window.ATLAS_FEATURED;
  const IDX = (window.ATLAS_INDEX && window.ATLAS_INDEX.units) || {};
  const IMG = (window.ATLAS_INDEX && window.ATLAS_INDEX.images) || { units: {}, paths: {}, software: {} };
  const LEVELS = ['Start here', 'Foundations', 'Beginner', 'Intermediate', 'Advanced'];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const catOf = id => CATS.find(c => c.id === id) || { name: '', tone: '#888' };
  const unit = slug => UNITS.find(u => u.slug === slug);
  const pathOf = id => PATHS.find(p => p.id === id) || (/^\d+$/.test(id || '') ? PATHS[+id - 1] : null);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const date = d => { const [y, m, dd] = d.split('-'); return `${MONTHS[+m - 1]} ${+dd}, ${y}`; };
  const icon = slug => window.ATLAS_ICON ? window.ATLAS_ICON(slug) : '';
  const chapters = u => { const x = IDX[u.slug]; return x ? (Array.isArray(x.chapters) ? x.chapters.length : x.chapters || 0) : 0; };
  const stat = (u, k) => { const x = IDX[u.slug]; return x && x.stats ? x.stats[k] || 0 : 0; };
  function get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------- state ---------- */
  const P = new URLSearchParams(location.search);
  const st = { q: (P.get('q') || '').trim(), type: P.get('type') || '', sw: P.get('sw') || '', c: P.get('c') || '', level: P.get('level') || '', sort: P.get('sort') || 'new', path: P.get('path') || '', view: P.get('view') || '' };
  function syncURL() {
    const u = new URLSearchParams();
    ['q', 'type', 'sw', 'c', 'level', 'path', 'view'].forEach(k => { if (st[k]) u.set(k, st[k]); });
    if (st.sort !== 'new') u.set('sort', st.sort);
    const s = u.toString();
    try { history.replaceState(null, '', s ? '?' + s : location.pathname); } catch (e) {}
  }
  const filtered = () => st.q || st.type || st.sw || st.c || st.level;

  /* ---------- filter bar ---------- */
  const bar = document.getElementById('filters');
  const opt = (v, l, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`;
  function filters() {
    const used = LEVELS.filter(l => UNITS.some(u => u.level === l));
    const sws = Object.keys(SW).filter(k => UNITS.some(u => u.software.includes(k)));
    bar.innerHTML = `
      <label class="dd"><span class="sr">Type</span><select data-k="type">${opt('', 'All types', st.type)}${opt('unit', 'Learning units', st.type)}${opt('workflow', 'Workflows', st.type)}</select></label>
      <label class="dd"><span class="sr">Software</span><select data-k="sw">${opt('', 'All software', st.sw)}${sws.map(k => opt(k, SW[k], st.sw)).join('')}</select></label>
      <label class="dd"><span class="sr">Topic</span><select data-k="c">${opt('', 'All topics', st.c)}${CATS.map(c => opt(c.id, c.name, st.c)).join('')}</select></label>
      <label class="dd"><span class="sr">Level</span><select data-k="level">${opt('', 'All levels', st.level)}${used.map(l => opt(l, l, st.level)).join('')}</select></label>
      <label class="dd"><span class="sr">Sort</span><select data-k="sort">${opt('new', 'Newest first', st.sort)}${opt('rec', 'Topic order', st.sort)}${opt('name', 'Name', st.sort)}${opt('short', 'Shortest first', st.sort)}${opt('long', 'Longest first', st.sort)}</select></label>
      <label class="dd eng" title="Which engine's notes unit pages open with"><span>Notes for</span><select id="engine">${opt('hdrp', 'Unity HDRP', '')}${opt('urp', 'Unity URP', '')}${opt('unreal', 'Unreal Engine', '')}</select></label>`;
    const eng = document.getElementById('engine'); eng.value = get('atlas:engine', 'hdrp');
    eng.addEventListener('change', () => set('atlas:engine', eng.value));
    $$('select[data-k]', bar).forEach(s => s.closest('.dd').classList.toggle('on', !!s.value && s.dataset.k !== 'sort'));
  }
  bar.addEventListener('change', e => { const s = e.target.closest('select[data-k]'); if (!s) return; st[s.dataset.k] = s.value; if (s.dataset.k !== 'sort') { st.path = ''; st.view = ''; } update(true); });
  const qEl = document.getElementById('q');
  qEl.value = st.q;
  qEl.addEventListener('input', () => { st.q = qEl.value.trim(); st.path = ''; st.view = ''; update(false); });
  function $$(sel, root) { return [...(root || document).querySelectorAll(sel)]; }

  /* ---------- pieces ---------- */
  function swChips(u) {
    return `<span class="sws">${u.software.map(k => IMG.software[k] ? `<span class="sw img" title="${esc(SW[k] || k)}"><img src="${IMG.software[k]}" alt="${esc(SW[k] || k)}"></span>` : `<span class="sw" title="${esc(SW[k] || k)}">${{ any: 'ANY', unity: 'UNITY', unreal: 'UE', sd: 'SD', blender: 'BLENDER' }[k] || esc(k.toUpperCase())}</span>`).join('')}</span>`;
  }
  const placeholder = (slug, tone, big) => `<div class="ph${big ? ' big' : ''}" style="--tc:${tone}">${icon(slug)}</div>`;
  function picture(u, kind) {
    const f = IMG.units[u.slug] && (IMG.units[u.slug][kind] || (kind === 'tile' ? null : IMG.units[u.slug].tile));
    return f ? `<img src="${f}" alt="" loading="lazy" decoding="async">` : placeholder(u.slug, catOf(u.cat).tone);
  }
  function tile(u, n, noTopic) {
    const c = catOf(u.cat);
    return `<a class="tile" href="${u.path}" style="--tc:${c.tone}">
      <div class="thumb">${picture(u, 'tile')}${swChips(u)}<span class="kind ${u.type}">${u.type === 'workflow' ? 'Workflow' : 'Unit'}</span>${n ? `<span class="no">${n}</span>` : ''}<i class="tbar"></i>
        <div class="info">${esc(u.summary)}</div></div>
      <div class="t-title">${esc(u.title)}</div>
      <div class="t-meta"><i class="dot"></i><span>${noTopic ? '' : esc(c.name) + ' · '}${esc(u.level)} · ${u.minutes} min</span></div>
    </a>`;
  }
  const grid = (list, numbered, noTopic) => `<div class="grid">${list.map((u, i) => tile(u, numbered ? i + 1 : 0, noTopic)).join('')}</div>`;
  function pathTone(p) { const n = {}; p.units.map(unit).filter(Boolean).forEach(u => { n[u.cat] = (n[u.cat] || 0) + 1; }); const top = Object.keys(n).sort((a, b) => n[b] - n[a])[0]; return catOf(top).tone; }
  function collage(p, count) { return `<div class="collage">${p.units.slice(0, count).map(s => `<span>${icon(s)}</span>`).join('')}</div>`; }
  function pathCard(p) {
    const f = IMG.paths[p.id], us = p.units.map(unit).filter(Boolean), min = us.reduce((a, u) => a + u.minutes, 0);
    return `<a class="pcard" href="index.html?path=${encodeURIComponent(p.id)}" style="--tc:${pathTone(p)}">
      ${f ? `<img src="${f}" alt="" loading="lazy">` : `<div class="ph wide" style="--tc:${pathTone(p)}">${collage(p, 4)}</div>`}
      <div class="pc-text"><span class="pc-meta">${us.length} units · ${Math.round(min / 60 * 2) / 2} h</span><span class="pc-title">${esc(p.name)}</span></div></a>`;
  }
  function hero() {
    if (!FEAT) return '';
    let link, img, tone, art, title = FEAT.title, sub = FEAT.subtitle;
    if (FEAT.kind === 'path') { const p = pathOf(FEAT.id); if (!p) return ''; link = `index.html?path=${encodeURIComponent(p.id)}`; img = IMG.paths[p.id]; tone = pathTone(p); art = collage(p, 6); title = title || p.name; }
    else { const u = unit(FEAT.id); if (!u) return ''; link = u.path; img = IMG.units[u.slug] && (IMG.units[u.slug].hero || IMG.units[u.slug].tile); tone = catOf(u.cat).tone; art = `<div class="collage one"><span>${icon(u.slug)}</span></div>`; title = title || u.title; sub = sub || u.summary; }
    return `<section class="hero" style="--tc:${tone}">
      ${img ? `<img class="hero-img" src="${img}" alt="">` : `<div class="ph hero-ph" style="--tc:${tone}">${art}</div>`}
      <div class="hero-text">${FEAT.date ? `<span class="hero-date">${date(FEAT.date)}</span>` : ''}<h1 class="poster">${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}<a class="pill big" href="${link}">${esc(FEAT.button || 'Open')}</a></div>
    </section>`;
  }
  const section = (title, body, extra, tone) => `<section class="hrow"${tone ? ` style="--tc:${tone}"` : ''}><div class="hrow-head"><h2 class="poster-s">${tone ? '<i class="dot"></i>' : ''}${esc(title)}</h2>${extra || ''}</div>${body}</section>`;

  /* ---------- filtering and sorting ---------- */
  function matches(u) {
    if (st.type && u.type !== st.type) return false;
    if (st.sw && !u.software.includes(st.sw)) return false;
    if (st.c && u.cat !== st.c) return false;
    if (st.level && u.level !== st.level) return false;
    if (!st.q) return true;
    const ch = IDX[u.slug] && Array.isArray(IDX[u.slug].chapters) ? IDX[u.slug].chapters.map(c => c.title).join(' ') : '';
    const hay = [u.title, u.topic, u.summary, ch, catOf(u.cat).name, ...(u.tags || [])].join(' ').toLowerCase();
    return st.q.toLowerCase().split(/\s+/).every(w => hay.includes(w));
  }
  const catIndex = u => CATS.findIndex(c => c.id === u.cat);
  function sorted(list) {
    const by = { new: (a, b) => b.added.localeCompare(a.added) || catIndex(a) - catIndex(b), rec: (a, b) => catIndex(a) - catIndex(b), name: (a, b) => a.title.localeCompare(b.title), short: (a, b) => a.minutes - b.minutes, long: (a, b) => b.minutes - a.minutes }[st.sort];
    return by ? list.slice().sort(by) : list.slice();
  }

  /* ---------- views ---------- */
  const view = document.getElementById('top');
  function render() {
    let html = '';
    const p = st.path ? pathOf(st.path) : null;
    if (p) {
      const us = p.units.map(unit).filter(Boolean), min = us.reduce((a, u) => a + u.minutes, 0);
      html = `<section class="pathhead" style="--tc:${pathTone(p)}">${IMG.paths[p.id] ? `<img src="${IMG.paths[p.id]}" alt="">` : `<div class="ph wide" style="--tc:${pathTone(p)}">${collage(p, 6)}</div>`}
        <div class="pc-text"><span class="pc-meta">Learning path · ${us.length} units · about ${Math.round(min / 60 * 2) / 2} h</span><h1 class="poster">${esc(p.name)}</h1><p>A suggested order. Each unit links back to what it builds on, so you can start anywhere and fill gaps as you go.</p></div></section>`
        + grid(us, true);
    } else if (st.view === 'paths') {
      html = section('Learning paths', `<div class="pgrid">${PATHS.map(pathCard).join('')}</div>`);
    } else if (filtered()) {
      const list = sorted(UNITS.filter(matches)), c = st.c ? catOf(st.c) : null;
      const title = c ? c.name : st.type === 'workflow' ? 'Workflows' : st.q ? 'Search results' : 'Units';
      html = `<div class="listhead"${c ? ` style="--tc:${c.tone}"` : ''}><h1 class="poster">${c ? '<i class="dot"></i>' : ''}${esc(title)}</h1><span class="count">${list.length} ${list.length === 1 ? 'result' : 'results'}</span>${c ? `<p>${esc(c.blurb)}</p>` : ''}</div>`
        + (list.length ? grid(list, false, !!c) : `<p class="empty">${st.type === 'workflow' ? 'Workflows are on their way: step-by-step production recipes that combine several units. Until then, the learning units cover the techniques.' : `Nothing matches${st.q ? ` “${esc(st.q)}”` : ''}. Try a broader word like shader, light, metal or texture, or clear a filter.`}</p>`);
    } else {
      const fresh = UNITS.slice().sort((a, b) => b.added.localeCompare(a.added)).slice(0, 6);
      const recentPaths = PATHS.slice().reverse().filter(x => !FEAT || FEAT.kind !== 'path' || x.id !== FEAT.id).slice(0, 3);
      html = hero()
        + `<div class="pgrid three">${recentPaths.map(pathCard).join('')}</div>`
        + section('New units', grid(fresh), `<a class="more" href="index.html?sort=new&type=unit">View all</a>`)
        + CATS.map(c => { const us = UNITS.filter(u => u.cat === c.id); return us.length ? section(c.name, grid(us.slice().sort((a, b) => b.added.localeCompare(a.added)), false, true), `<a class="more" href="index.html?c=${c.id}">${us.length} units</a>`, c.tone) : ''; }).join('');
    }
    view.innerHTML = html;
  }
  function navState() {
    const cur = st.path || st.view === 'paths' ? 'paths' : st.type === 'workflow' ? 'workflows' : st.type === 'unit' ? 'units' : filtered() ? '' : 'home';
    $$('.iconrail [data-nav]').forEach(a => { if (a.dataset.nav === cur) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    qEl.placeholder = `Search ${UNITS.length} units`;
  }
  function update(scrollTop) {
    filters(); syncURL(); render(); navState();
    if (scrollTop && window.scrollY > 200) window.scrollTo({ top: 0 });
  }
  update(false);
})();
