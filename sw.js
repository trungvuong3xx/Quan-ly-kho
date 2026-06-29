const CACHE = "kho-v1";
const FILES = [
  "/Quan-ly-kho/",
  "/Quan-ly-kho/index.html",
  "/Quan-ly-kho/app.js",
  "/Quan-ly-kho/style.css",
  "/Quan-ly-kho/cx1.js",
  "/Quan-ly-kho/kiemke.js",
  "/Quan-ly-kho/manifest.json",
  "/Quan-ly-kho/icon-192.png",
  "/Quan-ly-kho/icon-512.png"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE).map(k => caches.delete(k))
  )));
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
