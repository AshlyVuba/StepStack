// Runs sw.js in a sandbox with an in-memory Cache API and a controllable network.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const BASE = 'https://example.test/StepStack/';
const code = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const abs = (u) => new URL(typeof u === 'string' ? u : u.url, BASE + 'sw.js').href;

function makeEnv() {
  const stores = new Map();
  const files = new Map();       // url -> body, served by the fake network
  let online = true;
  const handlers = {};
  const fetchLog = [];
  const fakeCache = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      addAll: async (urls) => { for (const u of urls) { const r = await fakeFetch(u); if (!r.ok) throw new Error('addAll ' + u); m.set(abs(u), r); } },
      put: async (req, res) => { m.set(abs(req), res); },
      match: async (req) => { const h = abs(req).split('?')[0]; const r = m.get(h) || m.get(abs(req)); return r ? r.clone() : undefined; }
    };
  };
  const fakeFetch = async (req) => {
    const url = abs(req); fetchLog.push(url);
    if (!online) throw new TypeError('Failed to fetch');
    const body = files.get(url.split('?')[0]);
    return body === undefined ? new Response('nope', { status: 404 }) : new Response(body, { status: 200 });
  };
  const ctx = {
    self: { location: new URL(BASE + 'sw.js'), clients: { claim: async () => {} }, addEventListener: (n, f) => { handlers[n] = f; } },
    caches: { open: async (n) => fakeCache(n), keys: async () => [...stores.keys()], delete: async (n) => stores.delete(n) },
    fetch: fakeFetch, URL, Response, Promise
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  const shell = vm.runInContext('SHELL', ctx);
  shell.forEach((u) => files.set(abs(u), 'content of ' + u));
  files.set(abs('./'), '<html>shell</html>'); files.set(abs('./index.html'), '<html>shell</html>');
  const run = async (name, extra) => { let p; await handlers[name]({ waitUntil: (x) => { p = x; }, ...extra }); await p; };
  const request = async (url, init = {}) => {
    let out;
    await handlers.fetch({
      request: { url: abs(url), method: init.method || 'GET', mode: init.mode || 'cors' },
      waitUntil: () => {},
      respondWith: (p) => { out = p; }
    });
    return out;
  };
  return { stores, files, setOnline: (v) => { online = v; }, run, request, shell, handlers, fetchLog };
}

test('install pre-caches the whole app shell', async () => {
  const env = makeEnv();
  await env.run('install');
  const cached = [...env.stores.get('stepstack-shell-v2').keys()];
  assert.equal(cached.length, env.shell.length);
  assert.ok(cached.includes(abs('./src/js/workspace.js')));
});

test('OFFLINE: page, scripts and lazy exercise module all load from cache', async () => {
  const env = makeEnv();
  await env.run('install');
  env.setOnline(false);
  for (const u of ['./', './index.html', './src/js/main.js', './src/js/workspace.js', './src/css/app.css', './manifest.webmanifest']) {
    const res = await env.request(u);
    assert.ok(res, u);
    assert.equal((await res).status, 200, u);
  }
});

test('OFFLINE: navigating to the start URL with a query string still works', async () => {
  const env = makeEnv();
  await env.run('install');
  env.setOnline(false);
  const res = await env.request('./?utm=1', { mode: 'navigate' });
  assert.equal((await res).status, 200);
});

test('OFFLINE: unknown page navigation falls back to the app shell', async () => {
  const env = makeEnv();
  await env.run('install');
  env.setOnline(false);
  const res = await (await env.request('./some/deep/link', { mode: 'navigate' }));
  assert.match(await res.text(), /shell/);
});

test('uncached non-navigation request is left to the network: never intercepted, never cached', async () => {
  const env = makeEnv();
  await env.run('install');
  const cachedBefore = env.stores.get('stepstack-shell-v2').size;
  env.setOnline(false);
  // The service worker does not call respondWith(), so the browser's own fetch runs and fails offline.
  assert.equal(await env.request('./unknown.json'), undefined);
  env.setOnline(true);
  env.files.set(abs('./unknown.json'), '{"secret":"api response"}');
  assert.equal(await env.request('./unknown.json'), undefined);
  assert.equal(env.stores.get('stepstack-shell-v2').size, cachedBefore); // nothing outside the shell is stored
});

test('cache is refreshed in the background when online (updates arrive)', async () => {
  const env = makeEnv();
  await env.run('install');
  env.files.set(abs('./src/js/main.js'), 'NEW VERSION');
  const first = await (await env.request('./src/js/main.js')).text();
  assert.match(first, /content of/);             // served instantly from cache
  await new Promise((r) => setTimeout(r, 20));    // background refresh completes
  const second = await (await env.request('./src/js/main.js')).text();
  assert.equal(second, 'NEW VERSION');
});

test('ignores non-GET and cross-origin requests', async () => {
  const env = makeEnv();
  await env.run('install');
  assert.equal(await env.request('./api', { method: 'POST' }), undefined);
  let handled = false;
  await env.handlers.fetch({ request: { url: 'https://other.test/x.js', method: 'GET' }, respondWith: () => { handled = true; } });
  assert.equal(handled, false);
});

test('activate deletes old StepStack caches only', async () => {
  const env = makeEnv();
  env.stores.set('stepstack-shell-v1', new Map());
  env.stores.set('someone-elses-cache', new Map());
  await env.run('install');
  await env.run('activate');
  assert.ok(!env.stores.has('stepstack-shell-v1'));
  assert.ok(env.stores.has('someone-elses-cache'));
  assert.ok(env.stores.has('stepstack-shell-v2'));
});