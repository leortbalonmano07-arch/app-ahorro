// Guarda la app para que abra al instante y funcione sin conexión.
const CACHE = 'ahorro-v4';
const FILES = [
  './', 'index.html', 'css/styles.css', 'js/app.js', 'js/parser.js', 'js/categories.js', 'js/store.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/apple-touch-icon.png', 'icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Primero la red (para recibir mejoras), y si no hay conexión, la copia guardada.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
