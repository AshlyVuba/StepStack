import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { IntegrityError, LiveInferenceDisabledError, type TranslationService } from "./service.js";
import { InputError } from "./sanitize.js";
import { hasInternalKey } from "../../lib/auth.js";
import { isLangCode } from "./prompt.js";

const langEnum = z.enum(["en", "zu", "xh", "af", "nso", "tn", "st", "ts", "ss", "ve", "nr"]);

const body = z.object({
  text: z.string().min(1).max(5000), // hard transport limit; tighter per-kind limits in sanitize()
  targetLang: langEnum,
  kind: z.enum(["lesson", "learner"]).default("learner"),
});

export interface TranslationRouteOptions {
  /** key that authorises caching of curriculum ("lesson") text; held by the curriculum build job */
  internalKey: string;
  /** per-IP translate requests per minute */
  ratePerMin: number;
}

export function translationRoutes(app: FastifyInstance, svc: TranslationService, opts: TranslationRouteOptions) {
  /** Public manifest of pre-compiled, syntax-verified 11-language offline lesson packs. */
  app.get("/v1/lesson-packs", async (_req, reply) => {
    const manifest = svc.getManifest();
    if (!manifest) return reply.code(404).send({ error: "lesson_packs_unavailable" });
    reply.header("Cache-Control", "public, max-age=3600");
    return manifest;
  });

  /** Public static bundle for a single South African official language (cacheable offline). */
  app.get("/v1/lesson-packs/:lang", async (req, reply) => {
    const { lang } = req.params as { lang: string };
    if (!isLangCode(lang)) return reply.code(400).send({ error: "unsupported_language" });
    const pack = svc.getPack(lang);
    if (!pack) return reply.code(404).send({ error: "pack_not_found" });
    reply.header("Cache-Control", "public, max-age=86400");
    reply.header("ETag", `"${pack.contentHash}"`);
    return pack;
  });

  /**
   * Resolves pre-translated lesson strings from static packs with zero live LLM inference.
   * When an uncompiled string is sent at runtime without a build-time LLM, returns 503.
   */
  app.post("/v1/translate", {
    bodyLimit: 16 * 1024,
    config: { rateLimit: { max: opts.ratePerMin, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    if (parsed.data.kind === "lesson" && !hasInternalKey(req.headers["x-internal-key"], opts.internalKey)) {
      return reply.code(401).send({ error: "lesson_requires_internal_key" });
    }
    try {
      return await svc.translate(parsed.data.text, parsed.data.targetLang, parsed.data.kind);
    } catch (e) {
      if (e instanceof InputError) return reply.code(422).send({ error: e.message });
      if (e instanceof LiveInferenceDisabledError) return reply.code(503).send({ error: "live_inference_disabled" });
      if (e instanceof IntegrityError) return reply.code(502).send({ error: "translation_failed" });
      req.log.error(e);
      return reply.code(502).send({ error: "upstream_error" });
    }
  });
}
