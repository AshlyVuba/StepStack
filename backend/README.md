# Skills Backend

One Fastify/TypeScript service, three modules. Node >= 22.

| Module | Endpoints |
|---|---|
| Portfolio | `POST /v1/capstones/complete` (internal key; body may include `aliasConsent: true` to publish `displayName`), `GET /v1/verify/:token` (public), `POST /v1/portfolios/:id/revoke` (internal key) |
| Translation | `POST /v1/translate` `{text, targetLang: zu\|xh\|st\|tn\|af, kind: lesson\|learner}`. `lesson` (cached 30 days) needs the `x-internal-key` header; anonymous callers use `learner` (never cached). 30 requests/min/IP |
| Grading | `POST /v1/grade/typing`, `/v1/grade/excel`, `/v1/grade/python` |

## Run
```bash
Copy-Item .env.example .env  # fill in the required secrets (openssl rand -base64 48)
docker compose up -d postgres redis
npm install
npm run migrate
npm run dev
npm test                    # includes tests using real Pyodide sandboxes
```

### Deployment security settings
- `POSTGRES_PASSWORD` and `REDIS_PASSWORD` are required by `docker-compose.yml`; both data stores listen on `127.0.0.1` only.
- `TRUST_PROXY_HOPS` (default `0`): set to the number of reverse proxies in front of the API, otherwise `X-Forwarded-For` is ignored.
- `CORS_ORIGIN`: comma-separated exact browser origins (no wildcards or paths). `FRONTEND_BASE_URL` is where `/p/:token` redirects; `PUBLIC_BASE_URL` is the API origin used to issue portfolio links.
- When frontend and API are hosted on different origins, allow the API origin in `frontend/index.html`'s `connect-src` as well as `CORS_ORIGIN`; do not widen the CSP to arbitrary hosts.
- Browser clients may use public grading, learner translation and verification endpoints only. Do not expose `INTERNAL_API_KEY`; CORS deliberately does not allow the `X-Internal-Key` header.
- `PORTFOLIO_TTL_DAYS` (default `365`): public links stop verifying after this long (`410 expired`).
- `GRADING_PYTHON_ENABLED=false`: kill switch for the Python grader (`503`).
- Python submissions run in single-use Pyodide processes with empty environments, Node `fetch`/WebSocket/XHR disabled, no Python-to-JavaScript bridge in the exposed builtins, and network/process modules rejected by the AST gate. This is defense in depth, not an OS-level sandbox; retain container memory/CPU limits and move grading to a dedicated no-network service for hostile multi-tenant deployment.

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
migrations/001_init.sql            immutable, checksum-verified under a PostgreSQL advisory lock
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

For production, run the API in a container with `cap_drop: ALL`, read-only FS and memory/pids
limits (see docker-compose.yml), and ideally move the grader into its own `network_mode: none` service. If the pool is drained
by a burst, a request waits for a worker to boot (~1.5-2 s), so size `GRADER_POOL_SIZE` for peak concurrency. Typing time is
client-reported; for high-stakes use, have the server issue the start timestamp.

## Next steps
Auth for learner-facing endpoints (the LMS session), audit logging,
a Postgres tier for translations if Redis eviction is a concern, and more exercises in `exercises/`.