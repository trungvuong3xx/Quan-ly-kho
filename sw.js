const CACHE_NAME = 'quan-ly-kho-v2026-ton-kho-v20';
const urlsToCache = [
  '/Quan-ly-kho/',
  '/Quan-ly-kho/index.html',
  '/Quan-ly-kho/style.css',
  '/Quan-ly-kho/app.js',
  '/Quan-ly-kho/kiemke.js',
  '/Quan-ly-kho/cx1.js',
  '/Quan-ly-kho/cx5.js',
  '/Quan-ly-kho/tonkho.js',
  '/Quan-ly-kho/manifest.json',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/@zxing/library@0.19.1/umd/index.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Xóa bộ nhớ đệm cũ:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(response => {
      return response || fetch(event.request);
    })
  );
});