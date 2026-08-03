/**
 * service-worker.js — caches the static app shell so the dashboard still
 * opens (with the last-known data from localStorage) when offline.
 * It never caches the Apps Script API response itself — live data always
 * comes from the network.
 */
const CACHE_NAME = "dbtech-shell-v4";
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

// Network-first: always try to fetch the latest version from GitHub Pages
// first, and only fall back to the cached copy if the network request fails
// (i.e. genuinely offline). This is what makes new deployments show up
// immediately instead of needing a hard refresh — the previous cache-first
// strategy kept serving stale pages until a force reload.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if(url.hostname.includes("script.google.com")) return;
  if(event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
