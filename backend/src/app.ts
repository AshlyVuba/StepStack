import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { Config } from "./config.js";
import type { Cache } from "./lib/cache.js";
import type { PortfolioRepo } from "./modules/portfolio/repo.js";
import type { Llm } from "./modules/translation/llm.js";
import type { SandboxPool } from "./modules/grading/sandbox/pool.js";
import { ExerciseStore } from "./modules/grading/exercises.js";
import { portfolioRoutes } from "./modules/portfolio/routes.js";
import { TranslationService } from "./modules/translation/service.js";
import { translationRoutes } from "./modules/translation/routes.js";
import { gradingRoutes } from "./modules/grading/routes.js";

export interface Deps {
  config: Config; repo: PortfolioRepo; cache: Cache; llm: Llm; pool: SandboxPool;
  /** per-IP python grading submissions per minute (default 20) */
  pythonRatePerMin?: number;
  /** per-IP translate requests per minute (default 30) */
  translateRatePerMin?: number;
  /** per-IP requests per minute across the whole API (default 120) */
  globalRatePerMin?: number;
}

/** Dependency-injected so tests can swap in memory repos, a fake LLM, etc. */
export async function buildApp(d: Deps) {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test", bodyLimit: 64 * 1024, trustProxy: d.config.TRUST_PROXY_HOPS > 0 ? d.config.TRUST_PROXY_HOPS : false, routerOptions: { maxParamLength: 512 } });
  await app.register(helmet);
  await app.register(rateLimit, { max: d.globalRatePerMin ?? 120, timeWindow: "1 minute" });

  app.get("/healthz", async () => ({ ok: true }));

  portfolioRoutes(app, {
    repo: d.repo, signingKey: d.config.PORTFOLIO_SIGNING_KEY, previousKey: d.config.PORTFOLIO_SIGNING_KEY_PREVIOUS,
    internalKey: d.config.INTERNAL_API_KEY, publicBaseUrl: d.config.PUBLIC_BASE_URL,
    ttlDays: d.config.PORTFOLIO_TTL_DAYS,
  });
  translationRoutes(app, new TranslationService(d.llm, d.cache, d.config.TRANSLATION_MODEL), {
    internalKey: d.config.INTERNAL_API_KEY, ratePerMin: d.translateRatePerMin ?? 30,
  });
  gradingRoutes(app, new ExerciseStore(), d.pool, d.pythonRatePerMin ?? 20, d.config.GRADING_PYTHON_ENABLED);
  return app;
}