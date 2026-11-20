/* تحصين — offline cache. Pages, code and texts: network first (so updates show at once), cache when offline.
   Fonts and icons: cache first. Audio streams from the network and is never cached here. */
const CACHE = 'tahseen-v3';
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'data/ruqyah.json', 'manifest.webmanifest',
  'fonts/UthmanicHafs-v-3.0.ttf', 'fonts/amiri-700.woff2', 'fonts/amiri-latin-700.woff2',
  'fonts/ruqaa-700.woff2', 'fonts/ruqaa-latin-700.woff2',
  'icons/logo-mark.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const put = (req, res) => { if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return res; };
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== self.location.origin) return;
  if (/\/(fonts|icons)\//.test(u.pathname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => put(req, res))));
    return;
  }
  const key = req.mode === 'navigate' ? new URL('./', self.location).href : req;
  e.respondWith(
    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(res => put(key, res))
      .catch(() => caches.match(key, { ignoreSearch: true }))
  );
});
