/* Tech Art Atlas — offline cache. Pages: network first, cached copy when offline.
   Versioned assets (?v=hash, written by tools/build.py), key art and fonts: cache first, they never change in place.
   Anything else from this site: served from cache, refreshed in the background. */
const CACHE = 'atlas-v3';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

async function put(cache, req, res) {
  if (!res || !res.ok || res.type === 'opaque') return;
  const url = new URL(req.url);
  if (url.searchParams.has('v')) {                    // drop older versions of the same file
    for (const k of await cache.keys()) { const u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) cache.delete(k); }
  }
  await cache.put(req, res);
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const immutable = url.searchParams.has('v') || /\/assets\/(keyart|fonts)\//.test(url.pathname);
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      try { const res = await fetch(req); put(cache, req, res.clone()); return res; }
      catch (_) { return (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true })) || Response.error(); }
    }
    const hit = await cache.match(req);
    if (hit && immutable) return hit;
    const net = fetch(req).then(res => { put(cache, req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })());
});
