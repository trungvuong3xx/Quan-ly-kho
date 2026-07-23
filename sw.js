const CACHE_NAME = 'quan-ly-kho-v2026-ton-kho-v29';
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

const APP_SHELL_EXTENSIONS = ['.html', '.js', '.css', '.json'];

function laFileAppShell(url) {
  if (url.origin !== self.location.origin) return false;
  const path = url.pathname;
  if (path.endsWith('/')) return true; // vd '/Quan-ly-kho/'
  return APP_SHELL_EXTENSIONS.some(ext => path.endsWith(ext));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return; // để các lệnh gọi API (POST) đi thẳng ra mạng, SW không đụng vào

  const url = new URL(req.url);

  if (laFileAppShell(url)) {
    // Network-first: luôn thử lấy bản mới nhất trên mạng trước, chỉ dùng cache
    // khi mất mạng. Nhờ vậy sửa index.html/cx5.js/style.css... có hiệu lực ngay
    // lần mở app kế tiếp (có mạng), không cần nhớ bump CACHE_NAME mỗi lần sửa.
    event.respondWith(
      fetch(req).then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }))
    );
  } else {
    // Cache-first cho thư viện CDN ngoài (ít đổi, ưu tiên tốc độ tải)
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then(res => res || fetch(req))
    );
  }
});