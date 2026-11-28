import pg from "pg";
import { Redis } from "ioredis";
import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { MemoryCache, RedisCache } from "./lib/cache.js";
import { PgPortfolioRepo } from "./modules/portfolio/repo.js";
import { LessonPackStore } from "./modules/translation/packs.js";
import { SandboxPool } from "./modules/grading/sandbox/pool.js";

const config = loadConfig(); // throws (and the process exits) if any required secret is missing/weak
const pool = new SandboxPool(config.GRADER_POOL_SIZE, config.GRADER_TIMEOUT_MS);
await pool.start();

// Production runtime serves pre-compiled 11-language static lesson packs — no live LLM inference.
const packStore = new LessonPackStore(config.LESSON_PACKS_DIR);
const cache = config.REDIS_URL ? new RedisCache(new Redis(config.REDIS_URL)) : new MemoryCache();

const app = await buildApp({
  config,
  repo: new PgPortfolioRepo(new pg.Pool({ connectionString: config.DATABASE_URL })),
  cache,
  packStore,
  pool,
});

const stop = async () => { pool.close(); await app.close(); process.exit(0); };
process.on("SIGTERM", stop); process.on("SIGINT", stop);

await app.listen({ port: config.PORT, host: "0.0.0.0" });
