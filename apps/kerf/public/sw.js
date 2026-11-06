// Kerfvault Shopper Service Worker
// Version: kerfvault-shopper-v1
// Purpose: Caches App Shell and /pay route for 100% offline payment generation in airplane mode.

const CACHE_NAME = "kerfvault-shopper-v1";

// Core routes and assets needed for offline app shell and voucher generation
const PRECACHE_ASSETS = [
  "/",
  "/pay",
  "/settings",
  "/manifest.json",
  "/icon.svg",
];

// Install Event: Precaches the essential app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          // Precache what is possible; some routes may be dynamic in dev
          console.warn("[SW] Partial precache warning:", err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Cleans up older caches and claims active clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event: Handles offline navigation, static chunk caching, and network fallbacks
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle HTTP/HTTPS GET requests
  if (request.method !== "GET" || !request.url.startsWith("http")) {
    return;
  }

  const url = new URL(request.url);

  // Exclude external RPC, Horizon, and demo faucets from offline service worker caching
  if (
    url.hostname.includes("stellar.org") ||
    url.hostname.includes("friendbot") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Strategy 1: HTML Navigation Requests (Page loads in airplane mode)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // In airplane mode / offline: Match request from cache
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // If accessing /pay or another route, fallback to /pay or root shell
          if (url.pathname.startsWith("/pay")) {
            const payCached = await caches.match("/pay");
            if (payCached) return payCached;
          }
          const rootCached = await caches.match("/");
          if (rootCached) return rootCached;

          return new Response(
            "<!DOCTYPE html><html><body><h1>Kerfvault Offline</h1><p>You are offline. Return to <a href='/pay'>Pay Screen</a></p></body></html>",
            { headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // Strategy 2: Next.js Static Assets & JS Chunks (/_next/static/*)
  if (url.pathname.startsWith("/_next/static/") || url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Stale-while-revalidate: return cached, update in background if online
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse);
                });
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        // Not in cache, fetch from network and store in cache
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Strategy 3: Other static files (icons, manifest)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse)
      );
    })
  );
});

