// Minimal Service Worker
// Purpose: avoid 404 noise and provide a safe base for future PWA/offline work.
// This SW does not cache aggressively; it just takes control quickly.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Default: pass-through fetch (no caching). Keep it simple and safe.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
