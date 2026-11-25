// The vault owns the encryption key and every read/write of learner data.
// Nothing is ever written in plaintext; there is no localStorage fallback.
// If IndexedDB is unavailable the vault works in memory only (nothing persists).
//
// Modes:
//   personal - random non-extractable key kept in IndexedDB; no idle timeout
//   shared   - key derived from a passcode and held ONLY in memory; dropping it
//              (lock) makes the stored data unreadable until the passcode is entered
import * as db from './idb.js';
import { generateKey, deriveKey, randomBytes, encryptJSON, decryptJSON, PBKDF2_ITERATIONS } from './crypto.js';

export const MIN_PASSCODE = 6;

const memory = new Map();       // used only when IndexedDB is unavailable
let persistent = true;
let key = null;
let mode = null;
let chain = Promise.resolve();  // serialises writes so they land in order
let memQueueId = 0;

export const getMode = () => mode;
export const isUnlocked = () => key !== null;
export const isPersistent = () => persistent;

const kvGet = (s, k) => (persistent ? db.get(s, k) : Promise.resolve(memory.get(`${s}:${k}`)));
const kvPut = (s, k, v) => (persistent ? db.put(s, k, v) : Promise.resolve(memory.set(`${s}:${k}`, v)));
const kvDel = (s, k) => (persistent ? db.del(s, k) : Promise.resolve(memory.delete(`${s}:${k}`)));

// Returns 'new' (first run), 'locked' (shared device, passcode needed) or 'ready'.
export async function init() {
  persistent = typeof indexedDB !== 'undefined';
  if (persistent) {
    try { await db.get('meta', 'device'); } catch (e) { persistent = false; }
  }
  key = null;
  const meta = await kvGet('meta', 'device');
  if (!meta) return 'new';
  mode = meta.mode;
  if (mode === 'shared') return 'locked';
  key = (await kvGet('keys', 'device')) || null;
  if (!key) { await kvDel('meta', 'device'); mode = null; return 'new'; }
  return 'ready';
}

export async function setup(newMode, passcode = '') {
  if (newMode === 'shared') {
    if (passcode.length < MIN_PASSCODE) throw new Error('passcode-too-short');
    const salt = randomBytes(16);
    const derived = await deriveKey(passcode, salt);
    const verifier = await encryptJSON(derived, 'ok', 'verifier');
    await kvPut('meta', 'device', { mode: 'shared', salt, iterations: PBKDF2_ITERATIONS, verifier });
    key = derived;
  } else {
    const fresh = await generateKey();
    await kvPut('keys', 'device', fresh);      // key first, so meta never points at a missing key
    await kvPut('meta', 'device', { mode: 'personal' });
    key = fresh;
  }
  mode = newMode;
}

export async function unlock(passcode) {
  const meta = await kvGet('meta', 'device');
  if (!meta || meta.mode !== 'shared') return false;
  try {
    const derived = await deriveKey(passcode, meta.salt, meta.iterations);
    await decryptJSON(derived, meta.verifier, 'verifier');
    key = derived;
    return true;
  } catch (e) {
    return false;
  }
}

// Drops the key after pending writes finish. Stored data stays encrypted.
export async function lock() {
  await chain;
  key = null;
}

export function save(name, value) {
  if (!key) return Promise.reject(new Error('locked'));
  const snapshot = structuredClone(value);     // capture now; later edits must not leak in
  const k = key;
  const p = chain.then(async () => kvPut('data', name, await encryptJSON(k, snapshot, name)));
  chain = p.catch(() => {});
  return p;
}

export async function load(name) {
  if (!key) return null;
  const record = await kvGet('data', name);
  if (!record) return null;
  try { return await decryptJSON(key, record, name); } catch (e) { return null; }
}

export const remove = (name) => kvDel('data', name);

// Erases everything on this device, including the key.
export async function wipe() {
  await chain;
  key = null;
  mode = null;
  memory.clear();
  if (persistent) await db.destroy();
}

// ---- Encrypted offline queue (used by queue.js) ----
export async function queueAdd(item) {
  if (!key) throw new Error('locked');
  const record = await encryptJSON(key, item, 'queue');
  if (persistent) return db.add('queue', record);
  memQueueId += 1;
  memory.set(`queue:${memQueueId}`, record);
  return memQueueId;
}

export async function queueList() {
  if (!key) return [];
  let entries;
  if (persistent) {
    const { keys, vals } = await db.all('queue');
    entries = keys.map((k, i) => [k, vals[i]]);
  } else {
    entries = [...memory].filter(([k]) => k.startsWith('queue:')).map(([k, v]) => [Number(k.slice(6)), v]);
  }
  const out = [];
  for (const [id, record] of entries) {
    try { out.push({ id, ...(await decryptJSON(key, record, 'queue')) }); } catch (e) { /* unreadable: skip */ }
  }
  return out;
}

export const queueRemove = (id) => (persistent ? db.del('queue', id) : Promise.resolve(memory.delete(`queue:${id}`)));