// Offline support: app shell (stale-while-revalidate) + encrypted audio (cache-first).
const VERSION = "0449472bed";
const SHELL = "tkn26-shell-" + VERSION;
const AUDIO = "tkn26-audio-v1";
const FONTS = "tkn26-fonts-v1";
const SHELL_FILES = ["./", "index.html", "manifest.webmanifest", "data.bin", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith("tkn26-shell-") && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(cacheName, req) {
  const c = await caches.open(cacheName);
  const hit = await c.match(req, { ignoreVary: true });
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok || r.type === "opaque") c.put(req, r.clone()).catch(() => {});
  return r;
}

async function staleWhileRevalidate(req) {
  const c = await caches.open(SHELL);
  const hit = await c.match(req, { ignoreSearch: true });
  const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()).catch(() => {}); return r; });
  if (hit) { net.catch(() => {}); return hit; }
  return net.catch(async () => (await c.match("index.html")) || Response.error());
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.includes("/audio/")) { e.respondWith(cacheFirst(AUDIO, req)); return; }
    if (req.mode === "navigate") { e.respondWith(staleWhileRevalidate(new Request("index.html"))); return; }
    e.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(cacheFirst(FONTS, req).catch(() => Response.error()));
  }
});
