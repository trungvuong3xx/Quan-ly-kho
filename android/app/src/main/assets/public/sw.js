// Nếu đang chạy trong ứng dụng APK Capacitor (protocol capacitor: hoặc native Android):
// Chỉ hủy Service Worker nếu đang trong môi trường APK đóng gói
const laCapacitorNative = self.location.protocol === 'capacitor:' || 
  (self.location.hostname === 'localhost' && !self.location.port && !self.location.search.includes('pwa_test'));

if (laCapacitorNative) {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', event => {
    event.waitUntil(
      self.registration.unregister()
        .then(() => self.clients.claim())
    );
  });
} else {
  // Logic Service Worker dành riêng cho Web PWA (GitHub Pages)
  const CACHE_NAME = 'kho-cache-v164';
  const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './scanner-core.js',
  './quetqr.js',
  './kiemke.js',
  './cx1.js',
  './cx5.js',
  './btp.js',
  './tonkho.js',
  './tp.js',
  './Fast.mp3',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png',
  './lib/tabler-icons.min.css',
  './lib/fonts/tabler-icons.woff2',
  './lib/qrcode.min.js',
  './lib/zxing.min.js',
  './lib/xlsx.full.min.js'
];

// ── Lắng nghe lệnh Skip Waiting từ trang chính ────────────────
self.addEventListener('message', event => {
  if (event.data && (event.data.action === 'skipWaiting' || event.data === 'skipWaiting')) {
    self.skipWaiting();
  }
});

// Install a complete app shell before offering an update; never activate a partial release.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const responses = await Promise.all(urlsToCache.map(async url => {
      const request = new Request(url, { cache: 'no-store' });
      const response = await fetch(request);
      if (!response.ok) throw new Error('Không tải được ' + url);
      return [request, response];
    }));
    await Promise.all(responses.map(([request, response]) => cache.put(request, response)));
  })());
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

const APP_SHELL_EXTENSIONS = ['.html', '.js', '.css', '.json'];

function laFileAppShell(url) {
  if (url.origin !== self.location.origin) return false;
  const path = url.pathname;
  if (path.endsWith('/') || path === '') return true;
  return APP_SHELL_EXTENSIONS.some(ext => path.endsWith(ext));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // A worker serves one complete release. Updates wait for the user's saved-session reload.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try { return await fetch(req); }
    catch (error) { return new Response('Không có tài nguyên offline. Kết nối mạng và thử lại.', { status: 503 }); }
  })());
});
}
