import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { gradeTyping } from "./typing.js";
import { gradeExcel } from "./excel.js";
import type { ExerciseStore } from "./exercises.js";
import type { SandboxPool } from "./sandbox/pool.js";

const typingBody = z.object({
  exerciseId: z.string().max(100),
  typed: z.string().max(2000),
  durationMs: z.number().int().min(1000).max(30 * 60 * 1000),
});
const excelBody = z.object({
  exerciseId: z.string().max(100),
  formulas: z.record(z.string().regex(/^[A-Z]{1,2}[0-9]{1,4}$/), z.string().max(300)).refine((o) => Object.keys(o).length <= 20),
});
const pythonBody = z.object({ exerciseId: z.string().max(100), code: z.string().min(1).max(10_000) });

export function gradingRoutes(app: FastifyInstance, store: ExerciseStore, pool: SandboxPool, pythonRatePerMin: number) {
  app.post("/v1/grade/typing", { bodyLimit: 16 * 1024 }, async (req, reply) => {
    const b = typingBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "invalid_request" });
    const ex = store.typing.get(b.data.exerciseId);
    if (!ex) return reply.code(404).send({ error: "unknown_exercise" });
    return gradeTyping(ex, b.data.typed, b.data.durationMs);
  });

  app.post("/v1/grade/excel", { bodyLimit: 16 * 1024 }, async (req, reply) => {
    const b = excelBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "invalid_request" });
    const ex = store.excel.get(b.data.exerciseId);
    if (!ex) return reply.code(404).send({ error: "unknown_exercise" });
    return gradeExcel(ex, b.data.formulas);
  });

  app.post("/v1/grade/python", { bodyLimit: 32 * 1024, config: { rateLimit: { max: pythonRatePerMin, timeWindow: "1 minute" } } }, async (req, reply) => {
    const b = pythonBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "invalid_request" });
    const ex = store.python.get(b.data.exerciseId);
    if (!ex) return reply.code(404).send({ error: "unknown_exercise" });

    const t0 = performance.now();
    const r = await pool.run({ code: b.data.code, fn: ex.functionName, tests: ex.tests });
    const durationMs = Math.round(performance.now() - t0);

    if (r.status === "busy") return reply.code(503).send({ error: r.message });
    if (r.status !== "ok") return { passed: false, status: r.status, feedback: r.message, tests: [], durationMs };
    const passed = r.tests.every((t) => t.passed);
    return {
      passed, status: "ok", durationMs,
      feedback: passed ? "Pass! All tests passed." : "Not yet - some tests failed.",
      tests: r.tests,
    };
  });
}
