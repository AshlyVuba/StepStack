import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { IntegrityError, type TranslationService } from "./service.js";
import { InputError } from "./sanitize.js";
import { hasInternalKey } from "../../lib/auth.js";

const body = z.object({
  text: z.string().min(1).max(5000), // hard transport limit; tighter per-kind limits in sanitize()
  targetLang: z.enum(["zu", "xh", "st", "tn", "af"]),
  kind: z.enum(["lesson", "learner"]).default("learner"),
});

export interface TranslationRouteOptions {
  /** key that authorises caching of curriculum ("lesson") text; held by the LMS / curriculum job */
  internalKey: string;
  /** per-IP translate requests per minute */
  ratePerMin: number;
}

export function translationRoutes(app: FastifyInstance, svc: TranslationService, opts: TranslationRouteOptions) {
  app.post("/v1/translate", {
    bodyLimit: 16 * 1024,
    config: { rateLimit: { max: opts.ratePerMin, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    // Lesson text is cached for 30 days, so only trusted callers may submit it. Anonymous callers
    // can still translate their own text ("learner"), which is never cached.
    if (parsed.data.kind === "lesson" && !hasInternalKey(req.headers["x-internal-key"], opts.internalKey)) {
      return reply.code(401).send({ error: "lesson_requires_internal_key" });
    }
    try {
      const r = await svc.translate(parsed.data.text, parsed.data.targetLang, parsed.data.kind);
      return r;
    } catch (e) {
      if (e instanceof InputError) return reply.code(422).send({ error: e.message });
      if (e instanceof IntegrityError) return reply.code(502).send({ error: "translation_failed" });
      req.log.error(e);
      return reply.code(502).send({ error: "upstream_error" });
    }
  });
}