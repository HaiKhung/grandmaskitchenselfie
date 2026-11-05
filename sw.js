const CACHE = 'grandmas-kitchen-v1';
const SHELL = [
  './',
  'index.html',
  'style.css',
  'script.js',
  'manifest.json',
  'assets/images/vn-hat.webp',
  'assets/images/logo.webp',
  'assets/images/banh-khot.webp',
  'assets/icons/icon-192.png',
  'models/tiny_face_detector/tiny_face_detector_model-weights_manifest.json',
  'models/tiny_face_detector/tiny_face_detector_model-shard1'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so updates show up), cache as the offline fallback.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
