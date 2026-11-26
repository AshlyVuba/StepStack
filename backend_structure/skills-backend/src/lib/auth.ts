import { timingSafeEqual, createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

function safeEqual(a: string, b: string): boolean {
  // hash first so lengths are equal and comparison is constant-time
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Guard for service-to-service endpoints (called by the LMS, not by browsers). */
export function internalAuth(expectedKey: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const provided = req.headers["x-internal-key"];
    if (typeof provided !== "string" || !safeEqual(provided, expectedKey)) {
      return reply.code(401).send({ error: "unauthorized" });
    }
  };
}
