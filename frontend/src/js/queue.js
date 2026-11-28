// Grading and translation requests are encrypted at rest until the API is reachable.
import * as vault from './vault.js';

let sender = null;

export const enqueue = (type, payload) =>
  vault.queueAdd({ type, payload, at: new Date().toISOString() });

export const pending = () => vault.queueList();
export const remove = (id) => vault.queueRemove(id);

export const setSender = (fn) => { sender = fn; };

// Sends queued events oldest-first; stops at the first failure and keeps the rest.
export async function flush() {
  if (!sender || !vault.isUnlocked()) return 0;
  let sent = 0;
  for (const item of await pending()) {
    try {
      const response = await sender(item);
      if (response && response.ok === false) throw new Error('queued request was rejected');
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