# StepStack

> Using small steps to improve your tech stack.

StepStack is an adaptive, exercise-driven digital skills app that meets learners at their starting point (typing and computer
basics, Excel and office skills, or software development) and explains concepts in their home South African language.
It is built as an offline-first PWA with a grading, translation and verified-portfolio backend.

**Theme:** Digital Inclusion & Access · **Category:** EdTech & Workforce Employability

## Repository layout

```
.
├── frontend/   Offline-first PWA (vanilla HTML/CSS/JS, no build step). See frontend/README.md
├── backend/    Fastify + TypeScript API: grading, translation, portfolios. See backend/README.md
├── docs/       Business proposal, lean canvas and campaign documents
└── .github/workflows/ci.yml   CI for both projects
```

The two projects are independent: each has its own `package.json`, dependencies, tests and README. The frontend does not
call the backend yet (see "Next steps" in each README).

## Quick start

```bash
# Frontend (static files; needs a real web server, not file://)
cd frontend && npm ci && npm run ci      # run all checks
python3 -m http.server 8000              # then open http://localhost:8000

# Backend
cd backend && cp .env.example .env       # fill in the required secrets
docker compose up -d postgres redis
npm install && npm run migrate && npm run dev
```

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
