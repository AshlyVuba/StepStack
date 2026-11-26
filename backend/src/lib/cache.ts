import { Redis } from "ioredis";

export interface Cache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export class RedisCache implements Cache {
  constructor(private redis: Redis) {}
  get(key: string) { return this.redis.get(key); }
  async set(key: string, value: string, ttl: number) { await this.redis.set(key, value, "EX", ttl); }
}

/** Used in tests / local dev without Redis. */
export class MemoryCache implements Cache {
  private m = new Map<string, { v: string; exp: number }>();
  async get(key: string) {
    const e = this.m.get(key);
    if (!e) return null;
    if (e.exp < Date.now()) { this.m.delete(key); return null; }
    return e.v;
  }
  async set(key: string, value: string, ttl: number) { this.m.set(key, { v: value, exp: Date.now() + ttl * 1000 }); }
}
