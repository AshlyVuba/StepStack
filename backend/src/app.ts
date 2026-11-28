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
  // "Trust the first N proxy hops" written as a function: current Fastify typings reject a bare number,
  // and the function form behaves identically. 0 hops = never trust X-Forwarded-For.
  const hops = d.config.TRUST_PROXY_HOPS;
  const trustProxy = hops > 0 ? (_address: string, hop: number) => hop < hops : false;
  const app = Fastify({ logger: process.env.NODE_ENV !== "test", bodyLimit: 64 * 1024, trustProxy, routerOptions: { maxParamLength: 512 } });
  const allowedOrigins = new Set(d.config.CORS_ORIGIN.split(",").map((v) => v.trim()).filter(Boolean));
  app.addHook("onRequest", async (req, reply) => {
    if (req.headers.origin && allowedOrigins.has(req.headers.origin))
      reply.header("Access-Control-Allow-Origin", req.headers.origin);
    reply.header("Vary", "Origin");
  });
  app.options("/*", async (req, reply) => {
    reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.headers.origin && allowedOrigins.has(req.headers.origin))
      reply.header("Access-Control-Allow-Headers", "Content-Type");
    return reply.code(204).send();
  });
  await app.register(helmet);
  await app.register(rateLimit, { max: d.globalRatePerMin ?? 120, timeWindow: "1 minute" });

  app.get("/healthz", async () => ({ ok: true }));
  app.get("/p/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const target = new URL(d.config.FRONTEND_BASE_URL);
    target.searchParams.set("portfolio", token);
    return reply.code(302).redirect(target.toString());
  });

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