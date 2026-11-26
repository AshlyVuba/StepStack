import pg from "pg";
import { Redis } from "ioredis";
import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { RedisCache } from "./lib/cache.js";
import { PgPortfolioRepo } from "./modules/portfolio/repo.js";
import { AnthropicLlm } from "./modules/translation/llm.js";
import { SandboxPool } from "./modules/grading/sandbox/pool.js";

const config = loadConfig(); // throws (and the process exits) if any required secret is missing/weak
const pool = new SandboxPool(config.GRADER_POOL_SIZE, config.GRADER_TIMEOUT_MS);
await pool.start();

const app = await buildApp({
  config,
  repo: new PgPortfolioRepo(new pg.Pool({ connectionString: config.DATABASE_URL })),
  cache: new RedisCache(new Redis(config.REDIS_URL)),
  llm: new AnthropicLlm(config.ANTHROPIC_API_KEY, config.TRANSLATION_MODEL),
  pool,
});

const stop = async () => { pool.close(); await app.close(); process.exit(0); };
process.on("SIGTERM", stop); process.on("SIGINT", stop);

await app.listen({ port: config.PORT, host: "0.0.0.0" });
