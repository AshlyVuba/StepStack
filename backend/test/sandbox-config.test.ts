import { describe, it, expect } from "vitest";
import { makeApp } from "./helpers.js";
import { sandboxSpawnOptions } from "../src/modules/grading/sandbox/pool.js";

describe("sandbox process configuration", () => {
  it("starts grader processes with an empty environment, even if the parent holds secrets", () => {
    process.env.STEPSTACK_TEST_SECRET = "must-not-leak";
    try {
      const o = sandboxSpawnOptions();
      expect(o.env).toEqual({});
      expect(JSON.stringify(o)).not.toContain("must-not-leak");
      expect(o.stdio).toEqual(["pipe", "pipe", "ignore"]);
    } finally { delete process.env.STEPSTACK_TEST_SECRET; }
  });
});

describe("python grading kill switch", () => {
  it("returns 503 without touching the sandbox when GRADING_PYTHON_ENABLED=false", async () => {
    let calls = 0;
    const pool = { run: async () => { calls++; return { status: "ok", tests: [] }; }, close() {} } as any;
    const { app } = await makeApp({ pool, env: { GRADING_PYTHON_ENABLED: "false" } });
    const r = await app.inject({ method: "POST", url: "/v1/grade/python", payload: { exerciseId: "sum-even", code: "def f(): pass" } });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ error: "python_grading_disabled" });
    expect(calls).toBe(0);
  });
});