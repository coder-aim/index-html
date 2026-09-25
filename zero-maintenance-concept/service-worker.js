/*
 * CoderAIM zero-maintenance-concept — Service Worker
 * ===================================================
 *
 * WHY offline.html IS SEPARATE FROM zero-maintenance-404-concept.html
 * ---------------------------------------------------------------------
 * These two pages handle two completely different failure modes and must
 * never be merged:
 *
 *   - zero-maintenance-404-concept.html is served by the HOSTING layer
 *     (Apache/Nginx/Netlify/etc. — see the deployment note inside that file)
 *     when the visitor's browser DID successfully reach the server, but the
 *     specific URL requested doesn't exist. That's a normal HTTP 404 and
 *     this service worker never touches it — see the fetch handler below,
 *     where any response that actually comes back from the network (404
 *     included) is returned to the browser untouched.
 *
 *   - offline.html is served by THIS service worker, entirely from the
 *     browser's local cache, when the network request fails outright
 *     (no connection at all). The server is never reached, so it never gets
 *     a chance to return a 404 or anything else.
 *
 * HOW THIS SERVICE WORKER WORKS
 * ---------------------------------------------------------------------
 * 1. install  — precaches ONLY what offline.html itself needs to render
 *    (the page, the logo, the favicon). Nothing else is bulk-cached.
 * 2. activate — deletes any cache left over from a previous version of this
 *    file, then takes control of already-open tabs immediately.
 * 3. fetch    — for page navigations (clicking a link / typing a URL):
 *      - try the network first
 *      - if the network responds (any status, including 404) → return that
 *        response as-is, AND opportunistically save a copy of it in the
 *        runtime cache so this exact page can still be shown offline later
 *        if the visitor comes back to it without a connection
 *      - if the network fetch fails outright (offline) → serve the
 *        previously-cached copy of that page if we have one, otherwise fall
 *        back to offline.html
 *    For everything else (images, etc.) it's cache-first with a network
 *    fallback, and nothing new gets force-cached beyond what's already in
 *    the runtime cache from earlier visits.
 *
 * WHAT'S CACHED
 * ---------------------------------------------------------------------
 * - PRECACHE (fixed, set on install): offline.html + the logo + favicon it
 *   needs. This is deliberately small — see PRECACHE_ASSETS below.
 * - RUNTIME (grows opportunistically): a copy of each page the visitor has
 *   actually loaded successfully while online, so previously-visited pages
 *   can still work offline. This is NOT the whole site — only what's
 *   actually been visited.
 *
 * HOW TO UPDATE THE CACHE WHEN ASSETS CHANGE
 * ---------------------------------------------------------------------
 * Bump CACHE_VERSION below (e.g. 'v1' -> 'v2'). On the next visit, the new
 * service worker installs, re-precaches PRECACHE_ASSETS fresh, and the old
 * versioned caches are deleted automatically in the `activate` handler.
 * Editing this file's contents also triggers the browser to check for an
 * update automatically — bumping the version just guarantees a clean cache.
 */

const CACHE_VERSION = "v2";
const PRECACHE = "coderaim-zero-precache-" + CACHE_VERSION;
const RUNTIME = "coderaim-zero-runtime-" + CACHE_VERSION;

const OFFLINE_URL = "offline.html";

// Intentionally minimal — only what offline.html needs to render correctly
// with zero network access. Do NOT add the whole site here.
const PRECACHE_ASSETS = [
  OFFLINE_URL,
  "../assets/images/logo/logo-mark-transparent.png",
  "../favicon.ico"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then(function (cache) {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(function () {
        // Activate this version immediately rather than waiting for all
        // tabs running the old service worker to close.
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== PRECACHE && key !== RUNTIME;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (event) {
  var request = event.request;

  // Only ever intercept GET requests. POSTs (Web3Forms submissions, etc.)
  // go straight to the network, untouched, exactly like normal.
  if (request.method !== "GET") {
    return;
  }

  // Page navigations (the address bar, clicking a link, a form GET, etc.)
  // `destination === "document"` is checked too as a fallback for the rare
  // browser/trigger combinations that don't set mode:"navigate" reliably.
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          // The network answered — even a 404 counts as "online" here, so
          // it's returned exactly as the server sent it. Existing 404
          // handling is completely unaffected by this service worker.
          //
          // Saving the copy in RUNTIME is itself async and must be kept
          // alive with event.waitUntil() — otherwise the service worker can
          // be torn down the instant this response is returned, killing the
          // cache write before it finishes and leaving RUNTIME empty.
          var responseCopy = response.clone();
          event.waitUntil(
            caches.open(RUNTIME).then(function (cache) {
              return cache.put(request, responseCopy);
            })
          );
          return response;
        })
        .catch(function () {
          // The network request failed outright — no connection at all.
          // Prefer a previously-visited copy of this exact page; if we've
          // never visited it, fall back to the offline page.
          return caches.match(request).then(function (cachedPage) {
            return cachedPage || caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // Non-navigation requests (images, etc.): serve from cache when we
  // already have it (fast + works offline for previously-loaded assets),
  // otherwise go to the network. Nothing is force-cached here.
  event.respondWith(
    caches.match(request).then(function (cachedAsset) {
      return (
        cachedAsset ||
        fetch(request).catch(function () {
          // No cached copy and no network — let it fail naturally rather
          // than silently masking a missing asset.
        })
      );
    })
  );
});
