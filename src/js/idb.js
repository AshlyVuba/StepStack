// Minimal promise wrapper over IndexedDB. Stores:
//   meta  - device mode and key-derivation settings (no learner data)
//   keys  - the non-extractable key for personal devices
//   data  - encrypted records (profile, progress)
//   queue - encrypted offline events waiting to sync
const DB_NAME = 'stepstack';
const DB_VERSION = 1;
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        ['meta', 'keys', 'data'].forEach((n) => db.createObjectStore(n));
        db.createObjectStore('queue', { autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => resolve(
      out && 'result' in out ? out.result
        : out ? Object.fromEntries(Object.entries(out).map(([k, r]) => [k, r.result])) : undefined
    );
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const get = (store, key) => tx(store, 'readonly', (o) => o.get(key));
export const put = (store, key, value) => tx(store, 'readwrite', (o) => o.put(value, key));
export const add = (store, value) => tx(store, 'readwrite', (o) => o.add(value));
export const del = (store, key) => tx(store, 'readwrite', (o) => o.delete(key));
export const all = (store) => tx(store, 'readonly', (o) => ({ vals: o.getAll(), keys: o.getAllKeys() }));

export async function destroy() {
  if (dbPromise) {
    try { (await dbPromise).close(); } catch (e) { /* already failed */ }
    dbPromise = null;
  }
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}