/*
 * Service worker: simpan fail app supaya boleh dibuka tanpa internet,
 * dan cuba muat naik foto yang tertunggak di latar belakang (Android/Chrome).
 *
 * PENTING: Setiap kali anda mengubah fail app, naikkan nombor VERSION di bawah
 * (contoh v1 -> v2) supaya telefon pengguna mendapat versi baharu.
 */
const VERSION = "v1";
const CACHE = "mappasti2026-" + VERSION;

const APP_FILES = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "queue.js",
  "config.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "icons/logo-pasti.png",
  "frames/ungu-potret.png",
  "frames/ungu-landskap.png",
  "frames/biru-potret.png",
  "frames/biru-landskap.png",
  "frames/thumbs/ungu-potret.png",
  "frames/thumbs/ungu-landskap.png",
  "frames/thumbs/biru-potret.png",
  "frames/thumbs/biru-landskap.png"
];

try { importScripts("config.js", "queue.js"); } catch (e) { /* muat naik latar belakang tidak tersedia */ }

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(APP_FILES.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("mappasti2026-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req) {
  return fetch(req).then((res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("index.html")));
}

function cacheFirst(req) {
  return caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  }));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;                       // muat naik (POST) tidak disentuh
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // Google dll. tidak disentuh
  // Halaman & tetapan: cuba internet dahulu (supaya kemas kini cepat sampai)
  if (req.mode === "navigate" || url.pathname.endsWith("/config.js") || url.pathname.endsWith("/index.html")) {
    event.respondWith(networkFirst(req));
    return;
  }
  event.respondWith(cacheFirst(req));
});

// Muat naik di latar belakang bila internet kembali (Chrome/Android)
self.addEventListener("sync", (event) => {
  if (event.tag !== "upload-photos" || !self.PhotoQueue) return;
  event.waitUntil(
    self.PhotoQueue.processAll((type) => {
      if (type === "ok") {
        self.clients.matchAll().then((cs) => cs.forEach((c) => c.postMessage({ type: "uploaded" })));
      }
    }).then(() => self.PhotoQueue.count()).then((n) => {
      if (n > 0) throw new Error("masih ada foto menunggu"); // pelayar akan cuba lagi kemudian
    })
  );
});
