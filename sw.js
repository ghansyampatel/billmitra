/* BillMitra service worker — app files offline cache. Version बदलें तो नया code phones पर पहुँचता है. */
const CACHE = 'billmitra-v1.0.0';
const FILES = ['./', './index.html', './manifest.json', './css/app.css',
  './js/gst.js', './js/db.js', './js/xlsx.js', './js/qr.js', './js/i18n.js', './js/print.js', './js/reports.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// पहले network (नया code), न मिले तो cache (offline)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
