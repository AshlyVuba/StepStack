// Offline event queue. Events (like "stage completed") are stored encrypted in
// IndexedDB and drained when a sync sender is registered and the device is online.
// No server exists yet: a later sync feature calls setSender(fn).
import * as vault from './vault.js';

let sender = null;

export const enqueue = (type, payload) =>
  vault.queueAdd({ type, payload, at: new Date().toISOString() });

export const pending = () => vault.queueList();

export const setSender = (fn) => { sender = fn; };

// Sends queued events oldest-first; stops at the first failure and keeps the rest.
export async function flush() {
  if (!sender || !vault.isUnlocked()) return 0;
  let sent = 0;
  for (const item of await pending()) {
    try {
      await sender(item);
      await vault.queueRemove(item.id);
      sent += 1;
    } catch (e) {
      break;
    }
  }
  return sent;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flush().catch(() => {}); });
}