import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { internalAuth } from "../../lib/auth.js";
import { newPortfolioId, signToken, verifyToken } from "./token.js";
import type { PortfolioRepo } from "./repo.js";

export interface PortfolioDeps {
  repo: PortfolioRepo;
  signingKey: string;
  previousKey?: string;
  internalKey: string;
  publicBaseUrl: string;
}

const completeBody = z.object({
  learnerId: z.string().uuid(),
  capstoneId: z.string().min(1).max(100),
  // Optional public alias chosen by the learner. NOT their legal name / email.
  displayName: z.string().trim().min(1).max(60).optional(),
  skills: z.array(z.object({
    skill: z.string().min(1).max(100),
    level: z.enum(["foundation", "intermediate", "advanced"]),
    evidence: z.string().max(300).optional(),
  })).min(1).max(30),
});

export function portfolioRoutes(app: FastifyInstance, deps: PortfolioDeps) {
  const keys = [deps.signingKey, deps.previousKey].filter((k): k is string => !!k);

  /** Called by the LMS when a Stage 3 capstone is completed. Idempotent per (learner, capstone). */
  app.post("/v1/capstones/complete", { preHandler: internalAuth(deps.internalKey) }, async (req, reply) => {
    const body = completeBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request", details: body.error.issues });

    const row = await deps.repo.create({
      id: newPortfolioId(),
      learnerId: body.data.learnerId,
      capstoneId: body.data.capstoneId,
      displayName: body.data.displayName ?? null,
      skills: body.data.skills,
    });
    // Always re-derive the token from the stored row so repeats return the same link.
    const token = signToken({ pid: row.id, iat: Math.floor(row.issuedAt.getTime() / 1000) }, deps.signingKey);
    return reply.code(201).send({
      portfolioUrl: `${deps.publicBaseUrl}/p/${token}`,
      verifyUrl: `${deps.publicBaseUrl}/v1/verify/${token}`,
    });
  });

  /** Revoke a portfolio (e.g. integrity issue). */
  app.post("/v1/portfolios/:id/revoke", { preHandler: internalAuth(deps.internalKey) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = await deps.repo.revoke(id);
    return reply.code(ok ? 200 : 404).send({ revoked: ok });
  });

  /** Public, unauthenticated verification. Returns NO learner id / email / legal name. */
  app.get("/v1/verify/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const v = verifyToken(token, keys);
    // Same response for bad signature and unknown id -> no oracle for probing ids
    const invalid = () => reply.code(404).send({ verified: false });
    if (!v.ok) return invalid();
    const row = await deps.repo.findById(v.payload.pid);
    if (!row) return invalid();
    if (row.revokedAt) return reply.code(410).send({ verified: false, reason: "revoked" });
    return {
      verified: true,
      displayName: row.displayName ?? "Verified learner",
      capstoneId: row.capstoneId,
      issuedAt: row.issuedAt.toISOString(),
      skills: row.skills,
    };
  });
}
