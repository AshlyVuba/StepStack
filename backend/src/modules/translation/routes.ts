import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { IntegrityError, type TranslationService } from "./service.js";
import { InputError } from "./sanitize.js";

const body = z.object({
  text: z.string().min(1).max(5000), // hard transport limit; tighter per-kind limits in sanitize()
  targetLang: z.enum(["zu", "xh", "st", "tn", "af"]),
  kind: z.enum(["lesson", "learner"]).default("learner"),
});

export function translationRoutes(app: FastifyInstance, svc: TranslationService) {
  app.post("/v1/translate", { bodyLimit: 16 * 1024 }, async (req, reply) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
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
