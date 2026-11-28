// StepStack service worker: makes the app load and work offline.
// - Pre-caches the app shell on install.
// - Serves from cache first and refreshes the cache in the background, so
//   updates arrive on the next load without bumping a version number.
// - Only same-origin GET requests are handled. Learner data never passes
//   through here: it lives encrypted in IndexedDB, not in any cache.
// scripts/check-pwa.js verifies SHELL lists every file the app needs.
const CACHE = 'stepstack-shell-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './src/css/app.css',
  './src/js/app.js',
  './src/js/config.js',
  './src/js/crypto.js',
  './src/js/grading.js',
  './src/js/idb.js',
  './src/js/idle.js',
  './src/js/main.js',
  './src/js/onboarding.js',
  './src/js/pwa.js',
  './src/js/queue.js',
  './src/js/storage.js',
  './src/js/vault.js',
  './src/js/workspace.js'
];

// Only these URLs are ever cached. Anything else (for example API responses once the app talks to a
// backend on the same origin) is left to the network and is never stored.
const SHELL_PATHS = new Set(SHELL.map((p) => new URL(p, self.location).pathname));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n.startsWith('stepstack-') && n !== CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (SHELL_PATHS.has(url.pathname)) { event.respondWith(respond(event, req)); return; }
  if (req.mode === 'navigate') { event.respondWith(navigateOrShell(req)); return; }
  // not part of the app shell: do not intercept, do not cache
});

// Page navigations to unknown URLs: network first, never cached; fall back to the app shell when offline.
async function navigateOrShell(req) {
  try {
    return await fetch(req);
  } catch (err) {
    const shell = await (await caches.open(CACHE)).match('./index.html');
    if (shell) return shell;
    throw err;
  }
}

async function respond(event, req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });
  const network = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  if (cached) {
    event.waitUntil(network.catch(() => {}));   // refresh in the background
    return cached;
  }
  try {
    return await network;
  } catch (err) {
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}