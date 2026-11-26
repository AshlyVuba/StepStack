// Thin wrapper over the Web Crypto API (AES-GCM). All keys are non-extractable,
// so their raw bytes can never be read back by JavaScript.
const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const PBKDF2_ITERATIONS = 600000;

export const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

// Random key for personal devices (stored in IndexedDB as a non-extractable CryptoKey).
export function generateKey() {
  return subtle().generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// Key derived from a passcode for shared devices. It exists only in memory.
export async function deriveKey(passcode, salt, iterations = PBKDF2_ITERATIONS) {
  const base = await subtle().importKey('raw', enc.encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// `aad` (the record's name) is authenticated but not encrypted, which stops
// one encrypted record being swapped into another's slot.
export async function encryptJSON(key, value, aad) {
  const iv = randomBytes(12);
  const ct = await subtle().encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(JSON.stringify(value))
  );
  return { iv, ct };
}

export async function decryptJSON(key, record, aad) {
  const plain = await subtle().decrypt(
    { name: 'AES-GCM', iv: record.iv, additionalData: enc.encode(aad) }, key, record.ct
  );
  return JSON.parse(dec.decode(plain));
}