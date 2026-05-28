/* eslint-disable no-restricted-globals */
// Lead Matrix service worker.
//
// Caching strategy:
//   - Static assets (JS / CSS / fonts / images): cache-first, fall back to
//     network. These have content-hashed filenames from CRA's build so a
//     stale cache hit is impossible across deploys.
//   - Navigation requests (HTML): network-first, fall back to cache. This
//     way new deploys go live immediately when online, but the app still
//     loads offline from the last cached HTML.
//   - API requests (/api/*): NEVER cached. The CRM is read/write and stale
//     responses would mislead the operator. SW lets these pass through.

const STATIC_CACHE = 'lm-static-v1';
const HTML_CACHE = 'lm-html-v1';

self.addEventListener('install', (event) => {
  // Activate the new SW immediately on next page load instead of waiting
  // for all tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop any caches that aren't on the current allowlist.
      const allowed = new Set([STATIC_CACHE, HTML_CACHE]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !allowed.has(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // only GET is cacheable

  const url = new URL(request.url);

  // Skip cross-origin and API calls — let those hit the network normally.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // HTML navigation requests — network-first.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(HTML_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await caches.match(request);
          if (cached) return cached;
          throw err;
        }
      })()
    );
    return;
  }

  // Static assets — cache-first.
  if (
    /\.(?:js|css|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|ico|webp)$/i.test(
      url.pathname
    )
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        // Only cache successful, basic-origin responses.
        if (fresh && fresh.status === 200 && fresh.type === 'basic') {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(request, fresh.clone());
        }
        return fresh;
      })()
    );
  }
});
