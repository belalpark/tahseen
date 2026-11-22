/* تحصين — offline cache. Pages, code and texts: network first (so updates show at once), cache when offline.
   Fonts and icons: cache first. Audio streams from the network and is never cached here. */
const CACHE = 'tahseen-v6';
const STATE = 'tahseen-state';   // written by the app: time of the last counted reading
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
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== STATE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
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

/* ---------- reminders (Web Push, sent every 6 hours by the tahseen-push Cloudflare Worker) ---------- */
const plural = (n, one, two, few, many) => n === 1 ? one : n === 2 ? two : (n >= 3 && n <= 10) ? n + ' ' + few : n + ' ' + many;
function ago(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return 'منذ ' + plural(Math.max(m, 1), 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة');
  const h = Math.floor(m / 60);
  if (h < 24) return 'منذ ' + plural(h, 'ساعة', 'ساعتين', 'ساعات', 'ساعة');
  const d = Math.floor(h / 24);
  return 'منذ ' + plural(d, 'يوم', 'يومين', 'أيام', 'يوماً');
}
const readState = () => caches.open(STATE).then(c => c.match('state.json')).then(r => r ? r.json() : {}).catch(() => ({}));
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }
  e.waitUntil(readState().then(st => {
    const last = st.lastRead || 0, since = Date.now() - last;
    let body;
    if (!last) body = 'لم تُسجَّل قراءة محتسبة بعد. اضغط لبدء الرقية.';
    else if (since < 6 * 3600 * 1000) body = 'آخر قراءة محتسبة ' + ago(since) + ' — بارك الله فيك.';
    else body = 'آخر قراءة محتسبة ' + ago(since) + '. اضغط لبدء الرقية.';
    return self.registration.showNotification(d.title || 'هل قرأت التحصين؟', {
      body: d.body || body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
      tag: 'tahseen-remind', renotify: true, lang: 'ar', dir: 'rtl', data: { url: d.url || './' }
    });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const w = list.find(c => c.url.startsWith(self.registration.scope));
    return w ? w.focus() : self.clients.openWindow(url);
  }));
});
// the browser renewed the subscription: subscribe again with the server's key and tell the server
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(readState().then(async st => {
    if (!st.api) return;
    const key = (await (await fetch(st.api + '/key')).json()).publicKey;
    const raw = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((key.length + 3) % 4)), c => c.charCodeAt(0));
    const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
    await fetch(st.api + '/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), device: 'renewed' }) });
  }).catch(() => {}));
});
