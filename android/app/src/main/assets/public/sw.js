const CACHE_NAME = 'kho-cache-v50';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './kiemke.js',
  './cx1.js',
  './cx5.js',
  './btp.js',
  './tonkho.js',
  './Fast.mp3',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/@zxing/library@0.19.1/umd/index.min.js'
];

// ── Lắng nghe lệnh Skip Waiting từ trang chính ────────────────
self.addEventListener('message', event => {
  if (event.data && (event.data.action === 'skipWaiting' || event.data === 'skipWaiting')) {
    self.skipWaiting();
  }
});

self.addEventListener('install', event => {
  self.skipWaiting(); // Kích hoạt ngay phiên bản mới vừa tải
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of urlsToCache) {
        try {
          const req = new Request(url, { cache: 'no-store' });
          const res = await fetch(req);
          if (res.ok) await cache.put(req, res);
        } catch (e) {}
      }
    })
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

  // Stale-While-Revalidate cho các file ứng dụng: Load tức thì từ Cache, ngầm tải bản mới
  if (laFileAppShell(url)) {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then(cachedRes => {
        const fetchPromise = fetch(req, { cache: 'no-store' }).then(networkRes => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          }
          return networkRes;
        }).catch(() => {
          // Bỏ qua lỗi mạng khi update ngầm
        });
        
        return cachedRes || fetchPromise;
      })
    );
  } else {
    // Cache-First cho tài nguyên tĩnh (ảnh, mp3, cdn)
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then(res => res || fetch(req))
    );
  }
});