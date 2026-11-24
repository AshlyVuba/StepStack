# StepStack

> Using small steps to improve your tech stack.

StepStack is an adaptive, exercise-driven digital skills app built to close the gap between basic digital access and real-world employability. It meets learners at their exact starting point (typing and computer basics, Excel and office skills, or software development) and is designed to explain concepts in their home South African language.

**Theme:** Digital Inclusion & Access · **Category:** EdTech & Workforce Employability · **Platform:** Web / lightweight PWA

## Status

Early development (hackathon prototype). Currently built:

- [x] **Adaptive onboarding & persona track selector** (Issue #1)

Planned, per the project proposal: the Small-to-Large exercise engine (micro-drills, guided challenges, capstones), the AI South African language translator, offline-capable PWA support, and verifiable skill portfolios.

## Onboarding flow

A learner picks, in three taps:

1. **Starting tier:** Digital basics, Excel & office skills, or Coding & tech stacks
2. **Current level:** Just starting, Some experience, or Confident
3. **Preferred language:** English, isiZulu, isiXhosa, Afrikaans, Sesotho, Setswana, Sepedi, Xitsonga, Tshivenda, siSwati, or isiNdebele

Choices are saved as they are made, so a reload resumes where the learner left off. Once finished, a reload shows a "Welcome back" summary with an option to change the setup. When onboarding completes, the app dispatches a `stepstack:onboarded` event on `document` with the learner profile in `event.detail`, which later features can listen for.

> The onboarding screen itself is currently English-only. Interface translation will come with the AI translator work.

## Design principles

StepStack targets entry-level smartphones and low-bandwidth connections, so:

- **Vanilla HTML, CSS and JavaScript only.** No third-party UI libraries or frameworks, and no build step.
- **Tiny initial payload.** The budget is 15 KB gzipped for HTML + CSS + JS (currently about 3.8 KB).
- **Accessible by default.** Native radio inputs, 48px tap targets, visible keyboard focus, dark mode and reduced-motion support.
- **Resilient storage.** If localStorage is blocked, the app falls back to in-memory storage for the session.

## Project structure

```
.
├── index.html                    # Page shell: onboarding form + welcome-back screen
├── package.json                  # Check scripts (no dependencies)
├── src/
│   ├── css/onboarding.css        # Styles
│   └── js/
│       ├── config.js             # Tiers, levels and languages
│       ├── storage.js            # Profile persistence (localStorage + fallback)
│       └── onboarding.js         # Step logic, saving, resuming
├── scripts/
│   ├── check-bundle-size.js      # Enforces the gzip size budget
│   └── check-guardrails.js       # Blocks external resources and third-party code
└── .github/workflows/ci.yml      # GitHub Actions CI
```

## Running locally

The app uses ES modules, which browsers block when a page is opened directly from disk (`file://`), so serve the folder with any static server:

```bash
# Option 1: Python
python3 -m http.server 8000

# Option 2: Node
npx serve .
```

Then open http://localhost:8000.

## Checks

Requires Node 20 or newer. There is nothing to install.

```bash
npm run ci                # run everything below
npm run check:syntax      # every JS file in src/js parses
npm run check:guardrails  # no external scripts/styles, third-party imports or runtime dependencies
npm run check:size        # initial payload stays under 15 KB gzipped
```

The same checks run automatically in GitHub Actions on every push to `main` and on every pull request.

## Contributing

- Keep to the design principles above. CI fails if a change adds external resources, package imports, runtime dependencies, or pushes the payload over budget.
- If you add a new JS, CSS or HTML file to the initial payload, add it to the file lists in `scripts/check-bundle-size.js` and `scripts/check-guardrails.js`.
- Reference the issue number in your commit message, for example `feat(onboarding): ... (#1)`.

## License

No license has been chosen yet. Add a `LICENSE` file before accepting outside contributions.