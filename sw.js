/* تحصين — offline cache for the app shell and texts (audio streams from the network) */
const CACHE = 'tahseen-v1';
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'data/ruqyah.json', 'manifest.webmanifest',
  'fonts/UthmanicHafs-v-3.0.ttf', 'fonts/amiri-700.woff2', 'fonts/amiri-latin-700.woff2',
  'fonts/ruqaa-700.woff2', 'fonts/ruqaa-latin-700.woff2',
  'icons/logo-mark.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;   // audio etc. → network
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
