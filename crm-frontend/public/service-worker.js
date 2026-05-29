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

// Bump these whenever a deploy might have shipped broken cached assets
// (e.g., the obfuscator regression on 2026-05-29). The activate handler
// below deletes any cache NOT on this allowlist, so old versions get
// wiped automatically on next SW install.
const STATIC_CACHE = 'lm-static-v2';
const HTML_CACHE = 'lm-html-v2';

self.addEventListener('install', () => {
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

  // Static assets — cache-first, but only for asset categories that are
  // safe to serve from cache without the browser re-validating MIME or
  // module-script metadata. JS / CSS go through stale-while-revalidate
  // instead (return cached immediately, fetch a fresh copy in the
  // background) so a new deploy is picked up on the next page load
  // without breaking the current one.
  const isFontOrImage = /\.(?:woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|ico|webp)$/i.test(url.pathname);
  const isScriptOrStyle = /\.(?:js|css)$/i.test(url.pathname);

  if (isFontOrImage) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        if (fresh && fresh.status === 200 && fresh.type === 'basic') {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(request, fresh.clone());
        }
        return fresh;
      })()
    );
    return;
  }

  if (isScriptOrStyle) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        // Always refresh in the background so the next visit gets the
        // latest deploy. Return cached if we have it, otherwise wait.
        const networkPromise = fetch(request)
          .then((fresh) => {
            if (fresh && fresh.status === 200 && fresh.type === 'basic') {
              cache.put(request, fresh.clone());
            }
            return fresh;
          })
          .catch(() => cached);
        return cached || networkPromise;
      })()
    );
  }
});
