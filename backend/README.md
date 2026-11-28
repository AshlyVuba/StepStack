# Skills Backend

One lightweight Fastify/TypeScript service, three modules. Node >= 22. **Zero live local CPU/GPU LLM inference at runtime.**

| Module | Endpoints |
|---|---|
| Portfolio | `POST /v1/capstones/complete` (internal key; optional `aliasConsent: true`), `GET /v1/verify/:token` (public), `POST /v1/portfolios/:id/revoke` (internal key) |
| Static Lesson Packs & Translation | `GET /v1/lesson-packs` (11-language manifest), `GET /v1/lesson-packs/:lang` (`en\|zu\|xh\|af\|nso\|tn\|st\|ts\|ss\|ve\|nr`, cacheable JSON bundle with ETag), `POST /v1/translate` (resolves from pre-compiled packs; returns `503 live_inference_disabled` when no build LLM is attached) |
| Deterministic Grading | `POST /v1/grade/typing`, `POST /v1/grade/excel` (incl. ZAR Household Budget & Microloan Interest), `POST /v1/grade/form` (safe offline SARS eFiling Registration & IRP5/ITR12 simulations), `POST /v1/grade/python` (Pyodide sandbox) |

## Run
```bash
Copy-Item .env.example .env  # fill in PORTFOLIO_SIGNING_KEY, INTERNAL_API_KEY, DATABASE_URL
docker compose up -d postgres
npm ci
npm run build:packs          # deterministic offline pack build (or add -- --live with ANTHROPIC_API_KEY)
npm run migrate
npm run dev
npm test                     # Vitest suite (packs, Excel/Finance, SARS eFiling, Pyodide sandbox, portfolios)
```

### Deployment security settings
- `POSTGRES_PASSWORD` is required by `docker-compose.yml`; PostgreSQL listens on `127.0.0.1` only. No heavy LLM/GPU inference container is provisioned (`api` runs with `mem_limit: 512m`, read-only FS, `cap_drop: [ALL]`).
- `ANTHROPIC_API_KEY` is **build-time only** (for `npm run build:packs -- --live`) and is never required to boot or serve the production API. `REDIS_URL` is also optional (falls back to in-memory cache).
- `TRUST_PROXY_HOPS` (default `0`): set to the number of reverse proxies in front of the API, otherwise `X-Forwarded-For` is ignored.
- `CORS_ORIGIN`: comma-separated exact browser origins (no wildcards or paths). `FRONTEND_BASE_URL` is where `/p/:token` redirects; `PUBLIC_BASE_URL` is the API origin used to issue portfolio links.
- Browser clients use public static lesson packs, grading, and verification endpoints only. Never expose `INTERNAL_API_KEY`; CORS deliberately disallows `X-Internal-Key`.
- `PORTFOLIO_TTL_DAYS` (default `365`): public links stop verifying after this long (`410 expired`).
- `GRADING_PYTHON_ENABLED=false`: kill switch for the Python grader (`503`).

## Layout
```
src/config.ts                            env validation - no secret fallbacks; no live LLM key required at runtime
src/app.ts / server.ts                   wiring (dependency-injected for tests) / process entry
src/lib/                                 internal-key auth, cache interface (optional Redis + memory)
src/modules/portfolio/                   token.ts (HMAC-SHA256), repo.ts (pg + memory), routes.ts
src/modules/translation/                 sanitize, protect (syntax-lock), prompt (11 SA languages), packs, llm (build-time), service, routes
src/modules/grading/                     typing.ts, excel.ts (HyperFormula), form.ts (SARS eFiling), exercises.ts, routes.ts, sandbox/pool.ts
scripts/build-lesson-packs.ts            CLI compiling data/exercises.json into verified 11-language JSON packs
lesson-packs/                            Pre-compiled versioned 11-language static JSON bundles + manifest.json
sandbox/                                 runner.mjs + harness.py (Pyodide, runs in a throw-away process)
exercises/{typing,excel,form,python}/    Server-side exercises + expected answers (clients send only exerciseId)
migrations/001_init.sql                  immutable, checksum-verified under a PostgreSQL advisory lock
```

## How each module works

**Pre-Translated 11-Language Lesson Packs.** All 11 official South African languages (`en`, `zu`, `xh`, `af`, `nso`, `tn`, `st`, `ts`, `ss`, `ve`, `nr`) are compiled ahead of time by `scripts/build-lesson-packs.ts` from `data/exercises.json`. Every string passes through `sanitize()` (NFC normalization, invisible/control/delimiter stripping, strict length caps) and `protect()`/`restore()` + `verifySyntaxLock()` so Excel formulas (`=SUM(A1:A5)`, `=SUM(B3:B7)`, `=B2*B3*B4`), cell references, and Python keywords are guaranteed verbatim. At runtime, the API serves static cached bundles (`GET /v1/lesson-packs/:lang`) with zero live LLM inference; `frontend/sw.js` and `frontend/src/js/idb.js` store them locally for 100% offline use.

**Deterministic Grading & Financial Literacy.**
- **Typing:** Levenshtein accuracy + 5-char WPM with >250 WPM plausibility guard.
- **Excel & Financial Literacy:** HyperFormula (pure calc engine, no `eval`, no I/O) with function allowlists, required-function checks, no cross-sheet refs, and multi-case ZAR datasets (`household-budget`, `loan-interest`, `sum-basic`, `vlookup-price`, `pivot-sales-by-region`) so hard-coded answers fail.
- **Safe Offline SARS eFiling Simulation (`POST /v1/grade/form`):** Pure deterministic form-validation grader covering `sars-registration` (10-digit training tax reference number, 13-digit SA ID format, taxpayer type, password/OTP safety) and `sars-irp5-itr12` (SARS source codes `3601`, `4102`, `4005`, Rand currency parsing, declaration check). Marked `simulationOnly: true` and never touches a live government portal.
- **Python Sandbox:** AST gate + restricted builtins + single-use Pyodide/WebAssembly process with empty `env`, SIGKILL timeout (`GRADER_TIMEOUT_MS`), and warm worker pool.

**Portfolio Verification.** Token = `v1.<payload>.<HMAC-SHA256>` signed on server sync. Payload holds only an opaque random portfolio id + issue time (zero learner PII). Supports key rotation (`PORTFOLIO_SIGNING_KEY_PREVIOUS`), idempotent issuing per `(learner, capstone)`, expiry (`410`), revocation (`410`), and identical `404` responses for bad signature vs unknown id.
