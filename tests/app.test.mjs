// End-to-end tests of the real index.html + app code in jsdom, using an
// in-memory IndexedDB. Covers shared-device mode, the idle timeout, encrypted
// storage and the offline queue. (Service worker behaviour: tests/sw.test.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import * as esbuild from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(join(root, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const built = await esbuild.build({
  stdin: {
    contents: "export * from './src/js/app.js'; export * as queue from './src/js/queue.js'; export * as vault from './src/js/vault.js';",
    resolveDir: root
  },
  bundle: true, format: 'esm', write: false
});
const file = join(mkdtempSync(join(tmpdir(), 'stepstack-')), 'bundle.mjs');
writeFileSync(file, built.outputFiles[0].text);

let n = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(cond, label, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (cond()) return; await sleep(10); }
  assert.fail('timed out waiting for: ' + label);
}

// Fresh page + fresh module instance. Pass `idb` to simulate reopening the same browser.
async function boot(options = {}, idb = new IDBFactory()) {
  const dom = new JSDOM(html, { url: 'http://localhost/' });
  const w = dom.window;
  Object.assign(globalThis, { window: w, document: w.document, CustomEvent: w.CustomEvent, confirm: () => true });
  globalThis.indexedDB = idb;
  const app = await import(pathToFileURL(file).href + '?' + n++);
  await app.startApp(options);
  const d = w.document;
  const $ = (id) => d.getElementById(id);
  const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
  const pick = (name, val) => { const i = d.querySelector(`input[name=${name}][value=${val}]`); i.checked = true; fire(i, 'change'); };
  const submit = (id) => $(id).dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  return { w, d, $, fire, pick, submit, app, idb };
}

async function onboard(env, lang = 'zu') {
  env.pick('tier', 'workplace'); env.pick('level', 'beginner'); env.pick('language', lang);
  env.submit('onboarding');
  await until(() => !env.$('welcome').hidden, 'welcome screen');
  env.$('continue').click();
  await until(() => !env.$('workspace').hidden && env.$('ws-title').textContent, 'workspace');
}

async function rawStore(idb, store) {
  const db = await new Promise((res, rej) => { const r = idb.open('stepstack'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return new Promise((res) => { const q = db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => res(q.result); });
}
const bytesOf = (rec) => Buffer.from(rec.ct);

test('first run asks whose device this is', async () => {
  const env = await boot();
  assert.ok(!env.$('setup').hidden);
  assert.ok(env.$('onboarding').hidden && env.$('workspace').hidden);
});

test('personal device: workspace still works (language toggle keeps draft, progress bar, lock order)', async () => {
  const env = await boot();
  env.submit('setup-form');
  await until(() => !env.$('onboarding').hidden, 'onboarding');
  assert.ok(env.$('logout').hidden, 'no logout button on a personal device');
  await onboard(env);
  assert.equal(env.$('ws-title').textContent, 'Hlanganisa nge-SUM');
  env.$('ws-input').value = '=SUM(A1:'; env.fire(env.$('ws-input'), 'input');
  env.d.querySelector('#ws-langs button[data-code=af]').click();
  assert.equal(env.$('ws-title').textContent, 'Tel op met SUM');
  assert.equal(env.$('ws-input').value, '=SUM(A1:');
  assert.ok(env.d.querySelectorAll('#ws-stages button')[1].disabled, 'stage 2 locked');
  env.$('ws-input').value = '=SUM(A1:A5)'; env.$('ws-check').click();
  assert.equal(env.$('ws-progress').value, 1);
  assert.equal(env.$('ws-progress-text').textContent, 'Vordering: 1/3');
  env.$('ws-next').click();
  env.$('ws-input').value = '=AVERAGE(B2:B10)'; env.$('ws-check').click();
  env.$('ws-next').click();
  assert.ok(!env.$('ws-textarea').hidden);
  env.$('ws-textarea').value = 'Income, expenses and savings.'; env.$('ws-check').click();
  assert.equal(env.$('ws-progress').value, 3);
});

test('personal device: data is restored after reopening the browser, and is encrypted at rest', async () => {
  const env = await boot();
  env.submit('setup-form');
  await until(() => !env.$('onboarding').hidden, 'onboarding');
  await onboard(env);
  env.$('ws-input').value = '=SUM(A1:A5)'; env.$('ws-check').click();
  await sleep(100);

  // nothing readable on disk
  for (const store of ['data', 'queue']) {
    const recs = await rawStore(env.idb, store);
    assert.ok(recs.length > 0, store + ' has records');
    recs.forEach((r) => ['workplace', 'beginner', 'SUM', 'stage-complete'].forEach((word) =>
      assert.ok(!bytesOf(r).includes(word), `${store} must not contain plaintext "${word}"`)));
  }
  assert.equal(env.w.localStorage.length, 0, 'localStorage is empty');
  assert.equal(env.w.sessionStorage.length, 0, 'sessionStorage is empty');
  assert.equal(env.d.cookie, '', 'no cookies');

  const again = await boot({}, env.idb);                      // reopen same browser profile
  await until(() => !again.$('welcome').hidden, 'welcome back');
  assert.match(again.$('summary').textContent, /Excel & office skills/);
  again.$('continue').click();
  await until(() => !again.$('workspace').hidden && again.$('ws-title').textContent, 'workspace');
  assert.equal(again.$('ws-progress').value, 1, 'completed stage restored');
});

test('shared device: setup needs a passcode of at least 6 characters', async () => {
  const env = await boot();
  env.pick('device', 'shared');
  assert.ok(!env.$('setup-pass').hidden, 'passcode field appears');
  env.$('setup-passcode').value = '123';
  env.submit('setup-form');
  await sleep(50);
  assert.match(env.$('setup-msg').textContent, /at least 6/);
  assert.ok(!env.$('setup').hidden, 'still on setup');
});

test('shared device: IDLE TIMEOUT clears session state, then passcode restores it', async () => {
  const env = await boot({ idleMs: 700, warnMs: 300, tickMs: 25 });
  env.pick('device', 'shared');
  env.$('setup-passcode').value = 'open sesame';
  env.submit('setup-form');
  await until(() => !env.$('onboarding').hidden, 'onboarding');
  assert.ok(!env.$('logout').hidden, 'logout button visible on shared device');
  await onboard(env);
  env.$('ws-input').value = '=SUM(A1:A5)'; env.$('ws-check').click();
  env.$('ws-next').click();
  env.$('ws-input').value = '=AVERAGE(B2'; env.fire(env.$('ws-input'), 'input');   // unsent draft

  // activity keeps the session alive
  await sleep(400); env.fire(env.d, 'keydown');
  await sleep(400); env.fire(env.d, 'pointerdown');
  assert.ok(!env.$('workspace').hidden, 'still signed in while active');

  // then go idle: warning appears, then logout
  await until(() => !env.$('idle-warning').hidden, 'idle warning');
  await until(() => !env.$('unlock').hidden, 'locked after inactivity');

  assert.match(env.$('unlock-msg').textContent, /inactivity/);
  assert.ok(env.$('workspace').hidden && env.$('welcome').hidden && env.$('onboarding').hidden);
  assert.equal(env.$('ws-title').textContent, '', 'exercise text cleared');
  assert.equal(env.$('ws-input').value, '', 'answer field cleared');
  assert.equal(env.$('ws-textarea').value, '', 'textarea cleared');
  assert.equal(env.$('summary').textContent, '', 'profile summary cleared');
  assert.equal(env.$('ws-stages').children.length, 0);
  assert.ok(!env.app.vault.isUnlocked(), 'encryption key dropped from memory');
  assert.deepEqual(await env.app.queue.pending(), [], 'queue unreadable while locked');
  assert.ok(env.$('idle-warning').hidden && env.$('logout').hidden);

  // wrong passcode
  env.$('unlock-pass').value = 'not it';
  env.submit('unlock-form');
  await until(() => /not right/.test(env.$('unlock-msg').textContent), 'wrong passcode message');
  assert.ok(!env.app.vault.isUnlocked());
  assert.ok(env.$('welcome').hidden && env.$('workspace').hidden);

  // right passcode: progress AND the unsent draft are back
  env.$('unlock-pass').value = 'open sesame';
  env.submit('unlock-form');
  await until(() => !env.$('welcome').hidden, 'welcome after unlock');
  env.$('continue').click();
  await until(() => !env.$('workspace').hidden && env.$('ws-title').textContent, 'workspace');
  assert.equal(env.$('ws-progress').value, 1);
  assert.equal(env.$('ws-input').value, '=AVERAGE(B2', 'draft saved before logout');
  assert.equal(env.w.localStorage.length, 0);
});

test('shared device: manual logout locks immediately; nothing readable without the passcode', async () => {
  const env = await boot();
  env.pick('device', 'shared');
  env.$('setup-passcode').value = 'open sesame';
  env.submit('setup-form');
  await until(() => !env.$('onboarding').hidden, 'onboarding');
  await onboard(env);
  env.$('logout').click();
  await until(() => !env.$('unlock').hidden, 'unlock screen');
  assert.match(env.$('unlock-msg').textContent, /logged out/);

  // the page is reopened on the same shared computer by the next person
  const next = await boot({}, env.idb);
  assert.ok(!next.$('unlock').hidden, 'next person sees only the passcode screen');
  assert.ok(next.$('workspace').hidden && next.$('welcome').hidden);
  assert.equal(next.$('summary').textContent, '');
});

test('erase data on this device wipes everything and returns to setup', async () => {
  const env = await boot();
  env.pick('device', 'shared');
  env.$('setup-passcode').value = 'open sesame';
  env.submit('setup-form');
  await until(() => !env.$('onboarding').hidden, 'onboarding');
  await onboard(env);
  env.$('logout').click();
  await until(() => !env.$('unlock').hidden, 'unlock screen');
  env.$('unlock-erase').click();
  await until(() => !env.$('setup').hidden, 'setup after erase');
  const fresh = await boot({}, env.idb);
  assert.ok(!fresh.$('setup').hidden, 'treated as a brand-new device');
});

test('completed stages are queued encrypted for later sync, and flush when a sender exists', async () => {
  const env = await boot();
  env.submit('setup-form');
  await until(() => !env.$('onboarding').hidden, 'onboarding');
  await onboard(env);
  env.$('ws-input').value = '=SUM(A1:A5)'; env.$('ws-check').click();
  env.$('ws-check').click();                                   // re-checking must not enqueue twice
  await sleep(100);
  const items = await env.app.queue.pending();
  assert.equal(items.length, 1);
  assert.equal(items[0].type, 'stage-complete');
  assert.equal(items[0].payload.exercise, 'w1');

  const sent = [];
  env.app.queue.setSender(async (item) => { sent.push(item.payload.exercise); });
  assert.equal(await env.app.queue.flush(), 1);
  assert.deepEqual(sent, ['w1']);
  assert.deepEqual(await env.app.queue.pending(), []);
});

test('queue keeps events when the sender fails (still offline)', async () => {
  const env = await boot();
  env.submit('setup-form');
  await until(() => !env.$('onboarding').hidden, 'onboarding');
  await env.app.queue.enqueue('a', {}); await env.app.queue.enqueue('b', {});
  env.app.queue.setSender(async () => { throw new Error('offline'); });
  assert.equal(await env.app.queue.flush(), 0);
  assert.equal((await env.app.queue.pending()).length, 2);
});

test('legacy plaintext localStorage data from earlier prototypes is deleted on startup', async () => {
  const dom = new JSDOM(html, { url: 'http://localhost/' });
  dom.window.localStorage.setItem('stepstack:profile:v1', '{"tier":"workplace"}');
  dom.window.localStorage.setItem('stepstack:progress:v1', '{"drafts":{}}');
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, CustomEvent: dom.window.CustomEvent, localStorage: dom.window.localStorage });
  globalThis.indexedDB = new IDBFactory();
  const app = await import(pathToFileURL(file).href + '?' + n++);
  await app.startApp();
  dom.window.document.getElementById('setup-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => !dom.window.document.getElementById('onboarding').hidden, 'onboarding');
  assert.equal(dom.window.localStorage.length, 0);
  delete globalThis.localStorage;
});