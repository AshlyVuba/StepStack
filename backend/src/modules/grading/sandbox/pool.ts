import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";

export interface SandboxRequest { code: string; fn: string; tests: { args: unknown[]; expected: unknown; hidden?: boolean }[] }
export type SandboxResult =
  | { status: "ok"; tests: { passed: boolean; message: string }[] }
  | { status: "rejected" | "error"; message: string }
  | { status: "timeout" | "crashed" | "busy"; message: string };

interface Worker { proc: ChildProcess; buf: string; ready: boolean; onLine?: (l: string) => void; dead: boolean }

const MAX_OUTPUT = 256 * 1024;
const MAX_QUEUE = 20;

/**
 * Pool of warm, SINGLE-USE Pyodide processes.
 *  - every process starts with an empty env (no API keys / DB URLs reachable even if code escaped)
 *  - a process grades exactly one submission and is then discarded (no state leaks between learners)
 *  - the parent SIGKILLs the process when the time box expires (infinite loops, ReDoS, huge allocations)
 *  - a replacement is spawned immediately, so latency stays low
 */
export class SandboxPool {
  private ready: Worker[] = [];
  private starting = 0;
  private waiters: ((w: Worker) => void)[] = [];
  private closed = false;
  private failures = 0;
  private runner = resolve(process.cwd(), "sandbox/runner.mjs");

  constructor(private size: number, private timeoutMs: number) {}

  async start(): Promise<void> {
    for (let i = 0; i < this.size; i++) this.spawnWorker();
    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error("sandbox pool failed to warm up")), 20_000);
      const check = () => { if (this.ready.length >= 1) { clearTimeout(t); res(); } else setTimeout(check, 50); };
      check();
    });
  }

  close() {
    this.closed = true;
    for (const w of this.ready) w.proc.kill("SIGKILL");
    this.ready = [];
  }

  private spawnWorker() {
    if (this.closed || this.ready.length + this.starting >= this.size) return;
    this.starting++;
    const proc = spawn(process.execPath, ["--max-old-space-size=256", this.runner], {
      stdio: ["pipe", "pipe", "ignore"],
      env: {}, // NO inherited secrets
    });
    const w: Worker = { proc, buf: "", ready: false, dead: false };
    let counted = true;
    const uncount = () => { if (counted) { counted = false; this.starting--; } };

    proc.stdout!.setEncoding("utf8");
    proc.stdout!.on("data", (chunk: string) => {
      w.buf += chunk;
      if (w.buf.length > MAX_OUTPUT) { proc.kill("SIGKILL"); return; }
      let i: number;
      while ((i = w.buf.indexOf("\n")) >= 0) {
        const line = w.buf.slice(0, i); w.buf = w.buf.slice(i + 1);
        if (!w.ready) {
          if (line.includes('"ready"')) {
            w.ready = true; uncount(); this.failures = 0;
            const waiter = this.waiters.shift();
            if (waiter) waiter(w); else this.ready.push(w);
          }
        } else w.onLine?.(line);
      }
    });
    proc.stdin!.on("error", () => {});
    proc.on("exit", () => {
      w.dead = true; uncount();
      this.ready = this.ready.filter((x) => x !== w);
      if (!w.ready) this.failures++;
      // back off if workers keep dying during boot (avoid a hot respawn loop)
      setTimeout(() => this.spawnWorker(), Math.min(this.failures * 500, 5000));
    });
  }

  private acquire(): Promise<Worker | null> {
    const w = this.ready.shift();
    if (w) return Promise.resolve(w);
    if (this.waiters.length >= MAX_QUEUE) return Promise.resolve(null);
    return new Promise((res) => this.waiters.push(res));
  }

  async run(req: SandboxRequest): Promise<SandboxResult> {
    const w = await this.acquire();
    if (!w) return { status: "busy", message: "Grader is busy, try again in a moment." };
    this.spawnWorker(); // replace the one we took

    return new Promise<SandboxResult>((resolveResult) => {
      let done = false;
      const finish = (r: SandboxResult) => {
        if (done) return; done = true; clearTimeout(timer);
        w.proc.kill("SIGKILL"); resolveResult(r);
      };
      const timer = setTimeout(
        () => finish({ status: "timeout", message: "Time limit exceeded - check for an infinite loop or very slow code." }),
        this.timeoutMs);
      w.onLine = (line) => {
        try { finish(JSON.parse(line) as SandboxResult); }
        catch { finish({ status: "crashed", message: "Grader returned an invalid response." }); }
      };
      w.proc.on("exit", () => finish({ status: "crashed", message: "Your code crashed the grader (too much memory?)." }));
      w.proc.stdin!.write(JSON.stringify(req) + "\n");
    });
  }
}
