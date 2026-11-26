// Single-use sandbox process. Started by SandboxPool with an EMPTY environment (no secrets), killed on timeout.
// Protocol (newline-delimited JSON on stdio): -> {"ready":true}   <- {"code","fn","tests"}   -> harness JSON
import { loadPyodide } from "pyodide";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const py = await loadPyodide({ stdout() {}, stderr() {} }); // swallow Python output so stdio stays a clean protocol
py.runPython(readFileSync(new URL("./harness.py", import.meta.url), "utf8"));
const run = py.globals.get("run_submission");

process.stdout.write(JSON.stringify({ ready: true }) + "\n");

const rl = createInterface({ input: process.stdin });
rl.once("line", (line) => {
  const req = JSON.parse(line);
  const out = run(req.code, req.fn, JSON.stringify(req.tests));
  process.stdout.write(out + "\n", () => process.exit(0)); // one submission per process, then die
});
