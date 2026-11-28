# StepStack

> Using small steps to improve your tech stack.

StepStack is an adaptive, exercise-driven digital skills app that meets learners at their starting point (typing and computer
basics, Excel and office skills, or software development) and explains concepts in their home South African language.
It is built as an offline-first PWA with a grading, translation and verified-portfolio backend.

**Theme:** Digital Inclusion & Access · **Category:** EdTech & Workforce Employability

## Repository layout

```
.
├── frontend/   Offline-first PWA (vanilla HTML/CSS/JS, esbuild production bundling)
├── backend/    Fastify + TypeScript API: grading, translation, portfolios. See backend/README.md
├── docs/       Business proposal, lean canvas and campaign documents
└── .github/workflows/ci.yml   CI for both projects
```

The projects have separate dependencies and run processes. The frontend is an offline-first PWA; when the backend is running it also uses the public grading, translation, and portfolio-verification API endpoints.

## Quick start

### Frontend only (offline features)

Requires Node.js 22+ and Python 3. From PowerShell:

```powershell
Set-Location frontend
npm ci
npm run ci
python -m http.server 8080
```

Open <http://localhost:8080>. Keep the server running; `file://` will not work. Grading and translation need the backend below; the app can still be explored offline.

### Full app (frontend + API)

Also requires Docker Desktop and an Anthropic API key for translation. In a **second** PowerShell terminal:

```powershell
Set-Location backend
Copy-Item .env.example .env
```

Generate secrets (copy the four output values into `.env`; do not commit that file):

```powershell
node -e "const c=require('crypto'); console.log('PORTFOLIO_SIGNING_KEY='+c.randomBytes(48).toString('base64')); console.log('INTERNAL_API_KEY='+c.randomBytes(32).toString('hex')); console.log('POSTGRES_PASSWORD='+c.randomBytes(24).toString('hex')); console.log('REDIS_PASSWORD='+c.randomBytes(24).toString('hex'))"
```

In `.env`, set `DATABASE_URL` to `postgres://skills:<POSTGRES_PASSWORD>@localhost:5432/skills`, `REDIS_URL` to `redis://:<REDIS_PASSWORD>@localhost:6379`, add your `ANTHROPIC_API_KEY`, and set `PUBLIC_BASE_URL=http://localhost:3000` and `FRONTEND_BASE_URL=http://localhost:8080`. Keep the default `CORS_ORIGIN`, which already allows the frontend on port 8080.

Then start the API and databases:

```powershell
docker compose up -d postgres redis
npm ci
npm run migrate
npm run dev
```

In the first PowerShell terminal, start the frontend if it is not already running:

```powershell
Set-Location frontend
python -m http.server 8080
```

Open <http://localhost:8080>. Stop the frontend and API with `Ctrl+C`; stop the database containers with `docker compose down` from `backend\`.

## Continuous integration

GitHub Actions runs two jobs on every push to `main` and every pull request:

- **frontend:** syntax, guardrails (no third-party libraries, HTML injection or unencrypted storage), PWA/offline
  cache check, unit and end-to-end tests, bundle-size budget
- **backend:** typecheck and the test suite

## Contributing

- Reference the issue number in commit messages, for example `feat(pwa): ... (#3)`.
- Frontend rules (encrypted storage only, `textContent` only, size budget) are in `frontend/README.md` and enforced by CI.
- Never commit `.env` files or secrets. The backend refuses to start without its required secrets.

## License

No license has been chosen yet. Add a `LICENSE` file before accepting outside contributions.
