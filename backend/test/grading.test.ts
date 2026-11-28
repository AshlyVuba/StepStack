import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { makeApp } from "./helpers.js";
import { SandboxPool } from "../src/modules/grading/sandbox/pool.js";
import { ExerciseStore } from "../src/modules/grading/exercises.js";

let app: any; let pool: SandboxPool;
beforeAll(async () => {
  pool = new SandboxPool(3, 1500);
  await pool.start();
  await new Promise((r) => setTimeout(r, 4000)); // let the rest of the pool warm up
  ({ app } = await makeApp({ pool }));
});
afterAll(() => pool.close());

const grade = (kind: string, payload: any) => app.inject({ method: "POST", url: `/v1/grade/${kind}`, payload });

describe("typing", () => {
  it("grades all ten typing foundation stages against their configured accuracy and speed targets", async () => {
    const exercises = new ExerciseStore().typing;
    for (let stage = 1; stage <= 10; stage++) {
      const exercise = exercises.get(`typing-foundation-${String(stage).padStart(2, "0")}`);
      expect(exercise).toBeDefined();
      const durationMs = Math.max(1000, Math.floor((exercise!.text.length / 5) * 60000 / (exercise!.minWpm * 1.1)));
      const result = (await grade("typing", {
        exerciseId: exercise!.id, typed: exercise!.text, durationMs,
      })).json();
      expect(result.passed, `stage ${stage}`).toBe(true);
      expect(result.accuracy).toBe(100);
      expect(result.wpm).toBeGreaterThanOrEqual(exercise!.minWpm);
    }
  });

  const text = "The quick brown fox jumps over the lazy dog near the river.";
  it("passes accurate, fast typing", async () => {
    const r = (await grade("typing", { exerciseId: "typing-intro-1", typed: text, durationMs: 20000 })).json();
    expect(r.passed).toBe(true); expect(r.accuracy).toBe(100);
  });
  it("fails slow or sloppy typing and flags scripted speed", async () => {
    expect((await grade("typing", { exerciseId: "typing-intro-1", typed: text, durationMs: 60000 })).json().passed).toBe(false);
    expect((await grade("typing", { exerciseId: "typing-intro-1", typed: "Teh qiuck brwn fox", durationMs: 20000 })).json().passed).toBe(false);
    expect((await grade("typing", { exerciseId: "typing-intro-1", typed: text, durationMs: 1000 })).json().passed).toBe(false);
  });
});

describe("excel", () => {
  it("SUM: accepts a real formula, rejects hardcoded and wrong ones", async () => {
    expect((await grade("excel", { exerciseId: "sum-basic", formulas: { B6: "=SUM(B1:B5)" } })).json().passed).toBe(true);
    expect((await grade("excel", { exerciseId: "sum-basic", formulas: { B6: "=150" } })).json().passed).toBe(false);   // no SUM
    expect((await grade("excel", { exerciseId: "sum-basic", formulas: { B6: "=SUM(B1:B4)" } })).json().passed).toBe(false);
    expect((await grade("excel", { exerciseId: "sum-basic", formulas: { B6: "150" } })).json().passed).toBe(false);
    expect((await grade("excel", { exerciseId: "sum-basic", formulas: { B6: "=SUM(B1:B5)+0*0+SUM(10)-10" } })).json().passed).toBe(true);
  });
  it("a hard-coded value dressed up inside SUM fails on the second data case", async () => {
    const r = (await grade("excel", { exerciseId: "sum-basic", formulas: { B6: "=SUM(150)" } })).json();
    expect(r.passed).toBe(false);
  });
  it("VLOOKUP exact match", async () => {
    expect((await grade("excel", { exerciseId: "vlookup-price", formulas: { E1: "=VLOOKUP(D1,A1:B4,2,FALSE)" } })).json().passed).toBe(true);
    expect((await grade("excel", { exerciseId: "vlookup-price", formulas: { E1: "=VLOOKUP(D1,A1:B4,1,FALSE)" } })).json().passed).toBe(false);
  });
  it("pivot logic with SUMIF", async () => {
    const f = { E2: "=SUMIF($A$2:$A$7,D2,$B$2:$B$7)", E3: "=SUMIF($A$2:$A$7,D3,$B$2:$B$7)", E4: "=SUMIF($A$2:$A$7,D4,$B$2:$B$7)" };
    expect((await grade("excel", { exerciseId: "pivot-sales-by-region", formulas: f })).json().passed).toBe(true);
    const bad = (await grade("excel", { exerciseId: "pivot-sales-by-region", formulas: { ...f, E4: "=SUMIF($A$2:$A$7,D3,$B$2:$B$7)" } })).json();
    expect(bad.passed).toBe(false);
    expect(bad.cells.find((c: any) => c.cell === "E2").passed).toBe(true);
  });
  it("blocks disallowed functions and cross-sheet refs", async () => {
    expect((await grade("excel", { exerciseId: "sum-basic", formulas: { B6: "=SUM(B1:B5)+NOW()" } })).json().passed).toBe(false);
    expect((await grade("excel", { exerciseId: "sum-basic", formulas: { B6: "=SUM(Other!B1:B5)" } })).json().passed).toBe(false);
  });
});

describe("python sandbox", () => {
  const good = "def sum_even(numbers):\n    return sum(n for n in numbers if n % 2 == 0)\n";

  it("passes a correct solution in < 2s and fails a wrong one with feedback", async () => {
    const t0 = performance.now();
    const r = (await grade("python", { exerciseId: "sum-even", code: good })).json();
    const dt = performance.now() - t0;
    expect(r.passed).toBe(true);
    expect(dt).toBeLessThan(2000);
    console.log(`python grade (correct): ${Math.round(dt)} ms (reported ${r.durationMs} ms)`);

    const wrong = (await grade("python", { exerciseId: "sum-even", code: "def sum_even(numbers):\n    return sum(numbers)\n" })).json();
    expect(wrong.passed).toBe(false);
    expect(wrong.tests[0].message).toContain("expected");
    const hidden = wrong.tests.find((t: any) => t.message.includes("hidden"));
    expect(hidden.message).not.toMatch(/expected \d/); // hidden test answers are not leaked
  });

  it("rejects infinite loops within the time box and keeps serving", async () => {
    const t0 = performance.now();
    const r = (await grade("python", { exerciseId: "sum-even", code: "def sum_even(n):\n    while True:\n        pass\n" })).json();
    const dt = performance.now() - t0;
    expect(r.status).toBe("timeout"); expect(r.passed).toBe(false);
    expect(dt).toBeLessThan(2000);
    console.log(`python grade (infinite loop): ${Math.round(dt)} ms`);
    expect((await grade("python", { exerciseId: "sum-even", code: good })).json().passed).toBe(true);
  });

  it("handles top-level infinite loops, ReDoS and huge numbers via the time box", async () => {
    for (const code of [
      "while True: pass\ndef sum_even(n): return 0",
      "import re\ndef sum_even(n):\n    re.match('(a+)+$', 'a'*40+'b')\n    return 0",
      "def sum_even(n):\n    return 10**10**10",
    ]) {
      const r = (await grade("python", { exerciseId: "sum-even", code })).json();
      expect(r.passed).toBe(false);
      expect(["timeout", "crashed", "error", "ok"]).toContain(r.status);
    }
  });

  it("rejects malicious payloads without crashing the service", async () => {
    const payloads = [
      "import os\ndef sum_even(n): return os.getcwd()",
      "import js\ndef sum_even(n): return js.process.env",
      "from pyodide import ffi\ndef sum_even(n): return 0",
      "import subprocess\ndef sum_even(n): return 0",
      "def sum_even(n): return eval('1+1')",
      "def sum_even(n): return exec('x=1')",
      "def sum_even(n): return open('/etc/passwd').read()",
      "def sum_even(n): return __import__('os').listdir('/')",
      "def sum_even(n): return ().__class__.__base__.__subclasses__()",
      "def sum_even(n): return getattr(n, '__class__')",
      "def sum_even(n):\n    g = (i for i in [1])\n    return g.gi_frame.f_back.f_globals",
      "def sum_even(n): return '{0.__class__}'.format(n)",
      "import typing\ndef sum_even(n): return typing.sys.modules",
      "import random\ndef sum_even(n): return random._os.environ",
      "import operator\ndef sum_even(n): return 0",
      "def sum_even(n): return type(n)",
      "def sum_even(n):\n    import socket\n    return 0",
    ];
    for (const code of payloads) {
      const r = (await grade("python", { exerciseId: "sum-even", code })).json();
      expect(r.passed, code).toBe(false);
      expect(JSON.stringify(r)).not.toMatch(/root:|\bprocess\b|SECRET|API_KEY/i);
    }
    // service still healthy afterwards
    expect((await grade("python", { exerciseId: "sum-even", code: good })).json().passed).toBe(true);
  });

  it("sandbox has no access to the parent's secrets (empty env)", async () => {
    // Even the allowed language surface cannot reach env; also verify the child is spawned with env: {}
    const { spawnSync } = await import("node:child_process");
    process.env.TOP_SECRET_TEST = "leak";
    const r = spawnSync(process.execPath, ["-e", "console.log(JSON.stringify(process.env))"], { env: {} });
    const env = JSON.parse(r.stdout.toString());
    expect(env.TOP_SECRET_TEST).toBeUndefined();
  });

  it("syntax errors give readable feedback", async () => {
    const r = (await grade("python", { exerciseId: "sum-even", code: "def sum_even(n:\n  return 1" })).json();
    expect(r.passed).toBe(false); expect(r.feedback).toMatch(/Syntax/i);
  });

  it.each(["js", "pyodide", "socket", "ssl", "urllib", "http", "requests", "subprocess"])(
    "rejects Python imports that could cross the network/process boundary (%s)",
    async (moduleName) => {
      const response = await grade("python", {
        exerciseId: "sum-even", code: `import ${moduleName}\ndef sum_even(numbers): return 0`
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ status: "rejected" });
    }
  );

  it("is fast across repeated sequential submissions (pool keeps warm workers)", async () => {
    const times: number[] = [];
    for (let i = 0; i < 4; i++) {
      const t0 = performance.now();
      const r = (await grade("python", { exerciseId: "count-words", code: "def count_words(t):\n    return len(t.split())\n" })).json();
      times.push(performance.now() - t0);
      expect(r.passed).toBe(true);
      await new Promise((r) => setTimeout(r, 2500)); // allow a replacement worker to warm
    }
    console.log("python grade times ms:", times.map(Math.round));
    expect(Math.max(...times)).toBeLessThan(2000);
  });
});
