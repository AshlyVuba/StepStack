import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { MemoryCache } from "../src/lib/cache.js";
import { MemoryPortfolioRepo } from "../src/modules/portfolio/repo.js";
import { SandboxPool } from "../src/modules/grading/sandbox/pool.js";
import type { Llm } from "../src/modules/translation/llm.js";
import type { LessonPackStore } from "../src/modules/translation/packs.js";

/** Production runtime needs NO ANTHROPIC_API_KEY or live LLM inference server. */
export const TEST_ENV = {
  PORTFOLIO_SIGNING_KEY: "test-signing-key-0123456789-0123456789-abcdef",
  INTERNAL_API_KEY: "test-internal-key-0123456789",
  DATABASE_URL: "postgres://x:x@localhost/x",
};

export class FakeLlm implements Llm {
  calls = 0; lastUser = "";
  constructor(private impl: (system: string, user: string) => string = (_s, u) => u.replace(/<\/?learner_text>\n?/g, "").trim()) {}
  async complete(system: string, user: string) { this.calls++; this.lastUser = user; return this.impl(system, user); }
}

export async function makeApp(opts: {
  llm?: Llm; packStore?: LessonPackStore; pool?: SandboxPool;
  globalRatePerMin?: number; translateRatePerMin?: number; env?: Record<string, string>;
} = {}) {
  const config = loadConfig({ ...TEST_ENV, ...(opts.env ?? {}) } as NodeJS.ProcessEnv);
  const pool = opts.pool ?? ({ run: async () => ({ status: "error", message: "n/a" }), close() {} } as unknown as SandboxPool);
  const repo = new MemoryPortfolioRepo();
  const app = await buildApp({
    config, repo, cache: new MemoryCache(), llm: opts.llm, packStore: opts.packStore, pool,
    pythonRatePerMin: 10_000,
    globalRatePerMin: opts.globalRatePerMin ?? 10_000,
    translateRatePerMin: opts.translateRatePerMin ?? 10_000,
  });
  return { app, config, llm: opts.llm, repo };
}
