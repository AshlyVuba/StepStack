import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { MemoryCache } from "../src/lib/cache.js";
import { MemoryPortfolioRepo } from "../src/modules/portfolio/repo.js";
import { SandboxPool } from "../src/modules/grading/sandbox/pool.js";
import type { Llm } from "../src/modules/translation/llm.js";

export const TEST_ENV = {
  PORTFOLIO_SIGNING_KEY: "test-signing-key-0123456789-0123456789-abcdef",
  INTERNAL_API_KEY: "test-internal-key-0123456789",
  ANTHROPIC_API_KEY: "x", DATABASE_URL: "postgres://x:x@localhost/x", REDIS_URL: "redis://localhost:6379",
};

export class FakeLlm implements Llm {
  calls = 0; lastUser = "";
  constructor(private impl: (system: string, user: string) => string = (_s, u) => u.replace(/<\/?learner_text>\n?/g, "").trim()) {}
  async complete(system: string, user: string) { this.calls++; this.lastUser = user; return this.impl(system, user); }
}

export async function makeApp(opts: { llm?: Llm; pool?: SandboxPool } = {}) {
  const config = loadConfig({ ...TEST_ENV } as NodeJS.ProcessEnv);
  const llm = opts.llm ?? new FakeLlm();
  const pool = opts.pool ?? ({ run: async () => ({ status: "error", message: "n/a" }), close() {} } as unknown as SandboxPool);
  const app = await buildApp({ config, repo: new MemoryPortfolioRepo(), cache: new MemoryCache(), llm, pool, pythonRatePerMin: 10_000 });
  return { app, config, llm };
}
