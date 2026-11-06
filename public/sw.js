// 최소 서비스워커 (설계 §11 — workbox 대신 수작업). 정적 자산만 캐시하고,
// 페이지·API는 항상 네트워크 우선(콘텐츠 실시간 반영, 로그인 상태 보호).
const CACHE = "hm-static-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg") {
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; })));
  }
});
