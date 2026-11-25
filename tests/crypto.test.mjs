import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKey, deriveKey, randomBytes, encryptJSON, decryptJSON } from '../src/js/crypto.js';

test('round-trips JSON and never stores plaintext', async () => {
  const key = await generateKey();
  const rec = await encryptJSON(key, { name: 'Thandi', tier: 'workplace' }, 'profile');
  assert.ok(!Buffer.from(rec.ct).includes('Thandi'));
  assert.deepEqual(await decryptJSON(key, rec, 'profile'), { name: 'Thandi', tier: 'workplace' });
});

test('keys are non-extractable', async () => {
  const key = await generateKey();
  assert.equal(key.extractable, false);
  await assert.rejects(() => crypto.subtle.exportKey('raw', key));
});

test('a record cannot be moved into another slot (AAD binding)', async () => {
  const key = await generateKey();
  const rec = await encryptJSON(key, { a: 1 }, 'profile');
  await assert.rejects(() => decryptJSON(key, rec, 'progress'));
});

test('tampered ciphertext is rejected', async () => {
  const key = await generateKey();
  const rec = await encryptJSON(key, { a: 1 }, 'x');
  const bad = new Uint8Array(rec.ct); bad[0] ^= 1;
  await assert.rejects(() => decryptJSON(key, { iv: rec.iv, ct: bad.buffer }, 'x'));
});

test('passcode key: right passcode decrypts, wrong one fails', async () => {
  const salt = randomBytes(16);
  const k1 = await deriveKey('correct horse', salt, 1000);
  const rec = await encryptJSON(k1, 'secret', 'verifier');
  assert.equal(await decryptJSON(await deriveKey('correct horse', salt, 1000), rec, 'verifier'), 'secret');
  await assert.rejects(async () => decryptJSON(await deriveKey('wrong passcode', salt, 1000), rec, 'verifier'));
});

test('each encryption uses a fresh IV', async () => {
  const key = await generateKey();
  const a = await encryptJSON(key, 1, 'x');
  const b = await encryptJSON(key, 1, 'x');
  assert.notDeepEqual(a.iv, b.iv);
});