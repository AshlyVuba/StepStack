import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

/**
 * Token format:  v1.<base64url(payload JSON)>.<base64url(HMAC-SHA256(key, "v1." + payloadB64))>
 * The payload carries ONLY an opaque portfolio id + issue time. No learner data lives in the token.
 * Keys are passed in by the caller (read from env in config.ts) - never defaulted here.
 */
export interface TokenPayload { pid: string; iat: number }

const VERSION = "v1";
const b64u = (b: Buffer) => b.toString("base64url");

export function newPortfolioId(): string {
  return b64u(randomBytes(16)); // 128 bits, unguessable
}

function mac(key: string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

export function signToken(payload: TokenPayload, key: string): string {
  if (!key || key.length < 32) throw new Error("signing key missing or too short");
  const body = b64u(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64u(mac(key, `${VERSION}.${body}`));
  return `${VERSION}.${body}.${sig}`;
}

export type VerifyResult = { ok: true; payload: TokenPayload } | { ok: false };

/** Tries current key then (optional) previous key to support rotation. Constant-time compare. */
export function verifyToken(token: string, keys: string[]): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION || token.length > 512) return { ok: false };
  const [, body, sig] = parts as [string, string, string];
  let sigBuf: Buffer;
  try { sigBuf = Buffer.from(sig, "base64url"); } catch { return { ok: false }; }

  let matched = false;
  for (const key of keys) {
    if (!key) continue;
    const expected = mac(key, `${VERSION}.${body}`);
    if (expected.length === sigBuf.length && timingSafeEqual(expected, sigBuf)) matched = true;
  }
  if (!matched) return { ok: false };

  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof p?.pid !== "string" || typeof p?.iat !== "number") return { ok: false };
    return { ok: true, payload: { pid: p.pid, iat: p.iat } };
  } catch { return { ok: false }; }
}
