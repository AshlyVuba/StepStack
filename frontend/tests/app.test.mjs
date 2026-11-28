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
    contents: "export * from './src/js/app.js'; export * as queue from './src/js/queue.js'; export * as vault from './src/js/vault.js'; export * as grading from './src/js/grading.js';",
    resolveDir: root
  },
  bundle: true, format: 'esm', write: false
});
const bundle = join(mkdtempSync(join(tmpdir(), 'stepstack-')), 'bundle.mjs');
writeFileSync(bundle, built.outputFiles[0].text);

let instance = 0;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate, label, timeoutMs = 3000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (predicate()) return;
    await pause(10);
  }
  assert.fail(`Timed out waiting for ${label}`);
}

async function boot(options = {}, indexedDB = new IDBFactory()) {
  const dom = new JSDOM(html, { url: 'http://localhost/' });
  const { window } = dom;
  Object.assign(globalThis, {
    window, document: window.document, CustomEvent: window.CustomEvent,
    confirm: () => true, indexedDB
  });
  const app = await import(`${pathToFileURL(bundle).href}?run=${instance++}`);
  await app.startApp(options);
  const $ = (id) => window.document.getElementById(id);
  return { dom, window, $, app, indexedDB };
}

async function createProfile(env, { device = 'personal', passcode = '' } = {}) {
  if (device === 'shared') env.window.document.querySelector('[data-device="shared"]').click();
  env.$('letsGoBtn').click();
  await until(() => env.$('profileScreen').classList.contains('active'), 'profile screen');
  env.$('firstName').value = 'Thandi';
  env.$('surname').value = 'Mokoena';
  env.$('age').value = '19';
  env.$('education').value = 'High school';
  env.$('prototypeSharedPasscode').value = passcode;
  env.window.document.querySelector('input[name="goals"][value="workplace"]').checked = true;
  env.$('learnerForm').dispatchEvent(new env.window.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => env.$('dashboardScreen').classList.contains('active'), 'dashboard');
}

async function allRecords(indexedDB, store) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('stepstack');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

test('prototype onboarding stores profiles encrypted and restores the dashboard', async () => {
  const env = await boot();
  assert.ok(env.$('welcomeScreen').classList.contains('active'));
  await createProfile(env);

  assert.match(env.$('greeting').textContent, /Thandi/);
  assert.equal(env.$('recommendationTitle').textContent, 'Workplace Ready');
  assert.equal(env.window.localStorage.length, 0);
  assert.equal(env.window.sessionStorage.length, 0);
  assert.equal(env.window.document.cookie, '');
  const records = await allRecords(env.indexedDB, 'data');
  assert.ok(records.length);
  assert.ok(!JSON.stringify(records).includes('Thandi'));

  const restored = await boot({}, env.indexedDB);
  assert.ok(restored.$('dashboardScreen').classList.contains('active'));
  assert.match(restored.$('greeting').textContent, /Thandi/);
});

test('shared-device profiles require a passcode and clear sensitive UI after idle lock', async () => {
  const env = await boot({ idleMs: 260, warnMs: 100, tickMs: 20 });
  env.window.document.querySelector('[data-device="shared"]').click();
  env.$('letsGoBtn').click();
  await until(() => env.$('profileScreen').classList.contains('active'), 'profile screen');
  assert.equal(env.$('prototypeSharedPasscode').required, true);

  env.$('firstName').value = 'Thandi';
  env.$('surname').value = 'Mokoena';
  env.$('age').value = '19';
  env.$('education').value = 'High school';
  env.$('prototypeSharedPasscode').value = 'open sesame';
  env.$('learnerForm').dispatchEvent(new env.window.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => env.$('dashboardScreen').classList.contains('active'), 'dashboard');
  await until(() => env.$('unlockScreen').classList.contains('active'), 'idle lock', 2000);
  assert.equal(env.$('greeting').textContent, 'Welcome, learner');

  env.$('unlockPass').value = 'wrong passcode';
  env.$('unlockForm').dispatchEvent(new env.window.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => /not right/.test(env.$('unlockMessage').textContent), 'wrong passcode message');
  env.$('unlockPass').value = 'open sesame';
  env.$('unlockForm').dispatchEvent(new env.window.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => env.$('dashboardScreen').classList.contains('active'), 'unlock dashboard');
  assert.match(env.$('greeting').textContent, /Thandi/);
});

test('completed offline grading requests are encrypted and retried through the API queue', async () => {
  const env = await boot();
  await createProfile(env);
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  try {
    const result = await env.app.grading.gradeExercise('excel', 'w1', '=SUM(B1:B5)', 5000, {
      patterns: ['^=sum\\(b1:b5\\)$']
    });
    assert.equal(result.passed, true);
    assert.equal(result.source, 'offline');
    const items = await env.app.queue.pending();
    assert.equal(items.length, 1);
    assert.equal(items[0].payload.path, '/v1/grade/excel');
    assert.ok(!JSON.stringify(await allRecords(env.indexedDB, 'queue')).includes('SUM'));

    const sent = [];
    env.app.queue.setSender(async (item) => { sent.push(item.payload.body); return { ok: true }; });
    assert.equal(await env.app.queue.flush(), 1);
    assert.deepEqual(sent[0], { exerciseId: 'sum-basic', formulas: { B6: '=SUM(B1:B5)' } });
  } finally {
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator);
    else delete globalThis.navigator;
  }
});
