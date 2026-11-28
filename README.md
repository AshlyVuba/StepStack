# StepStack

> Using small steps to improve your tech stack.

StepStack is an adaptive, exercise-driven digital and financial skills platform built for South African learners. It meets learners at their starting point (Typing & Computer Basics including a 10-stage offline Typing Foundation game, Workplace Ready / Excel, Developer Mode / Python, Upskill & Training, and Financial Literacy including Rand household budgeting and safe offline SARS eFiling simulations) and delivers pre-translated, syntax-verified offline lesson packs across all 11 official South African languages (`en`, `zu`, `xh`, `af`, `nso`, `tn`, `st`, `ts`, `ss`, `ve`, `nr`).

**Theme:** Digital Inclusion & Access · **Category:** EdTech & Workforce Employability

## Core Architecture Highlights

- **Pre-Translated 11-Language Offline Lesson Packs (Zero Live Runtime LLM Inference):** Production never runs a heavy local CPU/GPU LLM inference server per learner click. Master lessons from `data/exercises.json` are compiled ahead of time via `npm run build:packs` through a syntax-lock layer (`protect.ts` + `sanitize.ts`) that guarantees Excel formulas (e.g. `=SUM(A1:A5)`, `=B2*B3*B4`) and Python keywords are never altered. Versioned static JSON bundles are served from `frontend/packs/` and `GET /v1/lesson-packs/:lang`, cached by `frontend/sw.js` and stored locally in IndexedDB (`frontend/src/js/idb.js`) for 100% offline use.
- **Deterministic Offline Grading + Cryptographic Signing on Sync:** Learners get instant deterministic client-side feedback on the 10-stage offline Typing Foundation game, spreadsheets (household budgeting & loan interest in ZAR), Python exercises, and safe offline SARS eFiling form-validation drills (tax registration, IRP5 codes, ITR12 basics — zero connection to live government portals). When back online, encrypted queued submissions sync to the backend for deterministic server-side grading (HyperFormula, single-use Pyodide WebAssembly sandbox, structured SARS form grader) and HMAC-SHA-256 signed portfolio verification.
- **Shared-Device Privacy & Lightweight PWA:** Vanilla ES modules with `esbuild` production bundling, zero third-party runtime dependencies, AES-256-GCM encrypted IndexedDB vault, 5-minute shared-device idle logout, and strict CI bundle budgets (<15 KB gzipped initial, <25 KB total).

## Repository layout

```
.
├── data/exercises.json        Master curriculum catalogue (Foundational, Workplace, Developer, Financial Literacy)
├── frontend/                  Offline-first PWA (vanilla HTML/CSS/JS, esbuild production bundling, static 11-language packs in frontend/packs/)
├── backend/                   Fastify + TypeScript API: static lesson packs, deterministic grading, signed portfolios
├── docs/                      Architecture diagrams, business proposal, lean canvas and campaign documents
└── .github/workflows/ci.yml   CI for both projects
```

## Quick start

### Frontend only (100% offline features)

Requires Node.js 22+ and Python 3. From PowerShell:

```powershell
Set-Location frontend
npm ci
npm run ci
python -m http.server 8080
```

Open <http://localhost:8080>. Keep the server running; `file://` will not work. Pre-translated 11-language lesson packs, the 10-stage Typing Foundation game, encrypted progress storage, and deterministic practice grading work 100% offline.

### Full app (frontend + API)

Requires Docker Desktop (for PostgreSQL). **No live LLM server or `ANTHROPIC_API_KEY` is required to run production.** In a **second** PowerShell terminal:

```powershell
Set-Location backend
Copy-Item .env.example .env
```

Generate secrets (copy the output values into `.env`; do not commit that file):

```powershell
node -e "const c=require('crypto'); console.log('PORTFOLIO_SIGNING_KEY='+c.randomBytes(48).toString('base64')); console.log('INTERNAL_API_KEY='+c.randomBytes(32).toString('hex')); console.log('POSTGRES_PASSWORD='+c.randomBytes(24).toString('hex'))"
```

In `.env`, set `DATABASE_URL` to `postgres://skills:<POSTGRES_PASSWORD>@localhost:5432/skills`, `PUBLIC_BASE_URL=http://localhost:3000`, and `FRONTEND_BASE_URL=http://localhost:8080`. Keep the default `CORS_ORIGIN`, which already allows the frontend on port 8080.

Then start PostgreSQL and the API:

```powershell
docker compose up -d postgres
npm ci
npm run build:packs
npm run migrate
npm run dev
```

*(Optional build-time regeneration with Claude: set `ANTHROPIC_API_KEY` and run `npm run build:packs -- --live`. Without an API key, `npm run build:packs` runs in deterministic fallback mode for CI.)*

## Continuous integration

GitHub Actions runs two jobs on every push to `main` and every pull request:

- **frontend:** `esbuild` bundle, syntax, guardrails (no third-party libraries, HTML injection or unencrypted storage), PWA/offline cache check, unit and end-to-end tests, bundle-size budget (<15 KB initial / <25 KB total gzipped)
- **backend:** typecheck and the Vitest suite (static 11-language lesson packs, syntax-lock checks, 10-stage Typing Foundation, Excel/Budgeting/Loan Interest, SARS eFiling form validation, Pyodide sandbox, signed portfolios)

## Contributing

- Reference the issue number in commit messages, for example `feat(pwa): ... (#3)`.
- Frontend rules (encrypted storage only, `textContent` only, size budget) are enforced by CI.
- Never commit `.env` files or secrets. The backend refuses to start without its required secrets.

## License

No license has been chosen yet. Add a `LICENSE` file before accepting outside contributions.
