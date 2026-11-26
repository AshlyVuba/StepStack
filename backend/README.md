# Skills Backend

One Fastify/TypeScript service, three modules. Node >= 22.

| Module | Endpoints |
|---|---|
| Portfolio | `POST /v1/capstones/complete` (internal key), `GET /v1/verify/:token` (public), `POST /v1/portfolios/:id/revoke` (internal key) |
| Translation | `POST /v1/translate` `{text, targetLang: zu\|xh\|st\|tn\|af, kind: lesson\|learner}` |
| Grading | `POST /v1/grade/typing`, `/v1/grade/excel`, `/v1/grade/python` |

## Run
```bash
cp .env.example .env        # fill in the required secrets (openssl rand -base64 48)
docker compose up -d postgres redis
npm install && npm run migrate && npm run dev
npm test                    # 31 tests, ~1 min (boots real Pyodide sandboxes)
```

## Layout
```
src/config.ts                      env validation - no secret fallbacks, boot fails if missing/weak
src/app.ts / server.ts             wiring (dependency-injected for tests) / process entry
src/lib/                           internal-key auth, cache interface (Redis + memory)
src/modules/portfolio/             token.ts (HMAC-SHA256), repo.ts (pg + memory), routes.ts
src/modules/translation/           sanitize, protect (code masking), prompt, llm, service (cache), routes
src/modules/grading/               typing.ts, excel.ts (HyperFormula), exercises.ts, routes.ts, sandbox/pool.ts
sandbox/                           runner.mjs + harness.py (Pyodide, runs in a throw-away process)
exercises/{typing,excel,python}/   server-side exercises + expected answers (clients send only an exerciseId)
migrations/001_init.sql
```

## How each DoD item is met
**Portfolio.** Token = `v1.<payload>.<HMAC-SHA256>`; payload is only a random portfolio id + issue time. Key is read from
`PORTFOLIO_SIGNING_KEY` (>=32 chars, no default). `PORTFOLIO_SIGNING_KEY_PREVIOUS` supports rotation. Completing a capstone is
idempotent per (learner, capstone). `/v1/verify` returns skills + optional learner-chosen alias, never learner id/email/legal name;
bad signature and unknown id return identical 404s.

**Translation.** Input is NFC-normalised, control/zero-width/bidi chars stripped, our delimiter and placeholder characters removed,
length enforced (1000 learner / 4000 lesson; rejected, not truncated), then wrapped in `<learner_text>` with a system prompt that
declares it data. Code, backticks, `=FORMULAS(...)`, cell refs and function names are swapped for `⟦n⟧` placeholders before the LLM
sees them and restored after; if the model drops one, it retries once and then returns 502 (nothing cached). Lesson text is cached
in Redis (30 days, key = prompt version + model + language + text hash) with in-process single-flight so concurrent identical
requests make one LLM call. Free-form learner text is never cached.

**Grading.** Typing: Levenshtein accuracy + standard 5-char WPM, plus a >250 WPM plausibility guard. Excel: HyperFormula (pure
calc engine), function allowlist, no cross-sheet refs, multiple data cases per exercise so hard-coded answers fail; pivot logic is
graded as SUMIF-style aggregation. Python: see below.

## Python sandbox - read this before shipping
Layers: (1) AST gate (import allowlist, no dunder/frame/format-string reflection, no eval/exec/open/getattr/type); (2) hand-picked
builtins and allowed modules exposed as public non-module attributes only; (3) Pyodide/WebAssembly in a **single-use Node process
with an empty environment** (no API keys or DB URLs), killed with SIGKILL after `GRADER_TIMEOUT_MS`; (4) a warm pool replaces each
used worker, so typical latency is ~10-400 ms.

Known limits: Pyodide cannot run under Node's `--permission` flag, and the child can still make network calls if user code ever
escaped the AST/builtins layers. For production, run the API in a container with `cap_drop: ALL`, read-only FS and memory/pids
limits (see docker-compose.yml), and ideally move the grader into its own `network_mode: none` service. If the pool is drained
by a burst, a request waits for a worker to boot (~1.5-2 s), so size `GRADER_POOL_SIZE` for peak concurrency. Typing time is
client-reported; for high-stakes use, have the server issue the start timestamp.

## Next steps
Auth for learner-facing endpoints (the LMS session), a public `/p/:token` page that calls `/v1/verify`, audit logging,
a Postgres tier for translations if Redis eviction is a concern, and more exercises in `exercises/`.
