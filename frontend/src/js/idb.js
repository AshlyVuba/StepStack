const DB_NAME = 'stepstack';
const DB_VERSION = 2;
let dbp = null;

function open() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        ['meta', 'keys', 'data', 'packs'].forEach((n) => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); });
        if (!d.objectStoreNames.contains('queue')) d.createObjectStore('queue', { autoIncrement: true });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
}

async function tx(s, m, fn) {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction(s, m);
    const out = fn(t.objectStore(s));
    t.oncomplete = () => res(out && 'result' in out ? out.result : out ? Object.fromEntries(Object.entries(out).map(([k, r]) => [k, r.result])) : undefined);
    t.onerror = t.onabort = () => rej(t.error);
  });
}

export const get = (s, k) => tx(s, 'readonly', (o) => o.get(k));
export const put = (s, k, v) => tx(s, 'readwrite', (o) => o.put(v, k));
export const add = (s, v) => tx(s, 'readwrite', (o) => o.add(v));
export const del = (s, k) => tx(s, 'readwrite', (o) => o.delete(k));
export const all = (s) => tx(s, 'readonly', (o) => ({ vals: o.getAll(), keys: o.getAllKeys() }));
export async function destroy() {
  if (dbp) { try { (await dbp).close(); } catch (e) {} dbp = null; }
  await new Promise((res, rej) => { const r = indexedDB.deleteDatabase(DB_NAME); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
}
