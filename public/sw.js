// ── InstaDown Service Worker ─────────────────────────────────
// IMPORTANT: /api/* requests are NEVER cached — always go to network
// Only the shell UI (HTML/CSS/fonts) is cached for offline support

const CACHE_NAME = "instadown-v1";

// Only these static assets get cached
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json"
];

// ── Install: cache static shell ──────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately — don't wait for old SW to die
  self.skipWaiting();
});

// ── Activate: delete old caches ──────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: smart routing ─────────────────────────────────────
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // 🚫 NEVER cache or intercept API calls — always hit network
  if (url.pathname.startsWith("/api/")) {
    return; // Let browser handle it normally
  }

  // 🚫 Never cache cross-origin requests (CDN images, fonts loading etc.)
  if (url.origin !== self.location.origin) {
    return;
  }

  // ✅ For same-origin non-API requests: network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache fresh copy of the shell
        if (response.ok && event.request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback — serve from cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // If nothing cached, return the index for navigation requests
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
      })
  );
});
