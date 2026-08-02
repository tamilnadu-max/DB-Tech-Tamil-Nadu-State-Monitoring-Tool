/**
 * service-worker.js — caches the static app shell so the dashboard still
 * opens (with the last-known data from localStorage) when offline.
 * It never caches the Apps Script API response itself — live data always
 * comes from the network.
 */
const CACHE_NAME = "dbtech-shell-v3";
const SHELL_FILES = [
  "index.html","dashboard.html","center.html","batch.html","student.html","mark-attendance.html",
  "css/style.css",
  "js/config.js","js/icons.js","js/auth.js","js/utils.js","js/api.js","js/charts.js","js/layout.js",
  "js/dashboard.js","js/center.js","js/batch.js","js/student.js","js/mark-attendance.js",
  "assets/logo.png","manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Never intercept the Apps Script API — always go to network for live data.
  if(url.hostname.includes("script.google.com")) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
