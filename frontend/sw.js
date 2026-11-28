// StepStack service worker: makes the app and 11-language static lesson packs work 100% offline.
// - Pre-caches the app shell on install.
// - Caches pre-translated static lesson packs (/packs/*.json) on demand for offline use.
// - Serves from cache first and refreshes in the background.
// - Only same-origin GET requests are handled. Learner data never passes through here:
//   it lives encrypted in IndexedDB, not in any cache.
// scripts/check-pwa.js verifies SHELL lists every file the app needs.
const CACHE = 'stepstack-shell-v2';
const PACK_CACHE = 'stepstack-packs-v1';
const SHELL = [
  './',
  './index.html',
  './src/css/app.css',
  './dist/js/chunks/chunk-B7VGN6ER.js',
  './dist/js/chunks/chunk-PWPRRCMX.js',
  './dist/js/chunks/chunk-X4DINKPH.js',
  './dist/js/chunks/chunk-YNKVNFMX.js',
  './dist/js/chunks/chunk-ZSRPMLYA.js',
  './dist/js/chunks/config-UORLRHKN.js',
  './dist/js/chunks/grading-MX7FPOJQ.js',
  './dist/js/chunks/idle-7I2XLQNI.js',
  './dist/js/chunks/onboarding-EKINMCTJ.js',
  './dist/js/chunks/queue-TAPL6EWD.js',
  './dist/js/chunks/storage-NMSMZZOY.js',
  './dist/js/chunks/vault-TGLAVJYA.js',
  './dist/js/chunks/workspace-GBOTIBGY.js',
  './dist/js/main.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Only app shell files and static 11-language lesson packs are ever cached.
const SHELL_PATHS = new Set(SHELL.map((p) => new URL(p, self.location).pathname));
const PACK_PATH_RE = /(?:^|\/)packs\/(?:manifest|en|zu|xh|af|nso|tn|st|ts|ss|ve|nr)\.json$/;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n.startsWith('stepstack-') && n !== CACHE && n !== PACK_CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (SHELL_PATHS.has(url.pathname)) { event.respondWith(respond(event, req, CACHE)); return; }
  if (PACK_PATH_RE.test(url.pathname)) { event.respondWith(respond(event, req, PACK_CACHE)); return; }
  if (req.mode === 'navigate') { event.respondWith(navigateOrShell(req)); return; }
  // not part of the app shell or static lesson packs: do not intercept, do not cache
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

async function respond(event, req, cacheName) {
  const cache = await caches.open(cacheName);
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
      const shell = await (await caches.open(CACHE)).match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}
