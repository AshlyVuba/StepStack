# StepStack

> Using small steps to improve your tech stack.

StepStack is an adaptive, exercise-driven digital skills app built to close the gap between basic digital access and real-world employability. It meets learners at their exact starting point (typing and computer basics, Excel and office skills, or software development) and is designed to explain concepts in their home South African language.

**Theme:** Digital Inclusion & Access · **Category:** EdTech & Workforce Employability · **Platform:** Web / lightweight PWA

## Status

Early development (hackathon prototype). Currently built:

- [x] **Adaptive onboarding & persona track selector** (Issue #1)
- [x] **"Small-to-Large" exercise workspace & language toggle** (Issue #2)
- [x] **Offline-first PWA & shared-device mode** (Issue #3)

Planned, per the project proposal: the full automated grading engine, the AI South African language translator, a sync service for the offline queue, and verifiable skill portfolios.

## Onboarding flow

On first run the learner says whether the device is **their own** or **shared** (see below). Then, in three taps, they pick:

1. **Starting tier:** Digital basics, Excel & office skills, or Coding & tech stacks
2. **Current level:** Just starting, Some experience, or Confident
3. **Preferred language:** English, isiZulu, isiXhosa, Afrikaans, Sesotho, Setswana, Sepedi, Xitsonga, Tshivenda, siSwati, or isiNdebele

Choices are saved as they are made, so a reload resumes where the learner left off. When onboarding completes, the app dispatches a `stepstack:onboarded` event on `document` with the learner profile in `event.detail`.

> The onboarding screens are currently English-only. Interface translation will come with the AI translator work.

## Exercise workspace

After onboarding, the learner lands in a three-stage workspace for their chosen tier:

1. **Stage 1, Micro-drill:** a quick short-answer exercise (a shortcut, a formula, one line of code)
2. **Stage 2, Guided challenge:** a short applied task
3. **Stage 3, Capstone:** an open-ended task, currently accepted once the learner writes at least 20 characters (real capstone assessment is planned)

- **Language toggle:** English, isiZulu and Afrikaans buttons switch the instructions, hints, feedback and labels instantly. Only text changes, so the learner's typed answer, completed stages and place in the sequence are never lost. The toggle starts on the language chosen at onboarding, or English if that language has no content yet.
- **Live progress bar:** it fills as each stage is completed. Stages unlock in order.
- **Safe rendering:** translated text and anything the learner types is only ever written as plain text (never as HTML), and CI blocks `innerHTML` and similar APIs.

> The isiZulu text is a draft and should be reviewed by a native speaker. To add a language, add its code to `UI` and to every exercise's `text` block in `src/js/exercises.js`. The tests fail if anything is missing.

## Offline-first PWA

StepStack works without a connection, and can be installed to the home screen.

- **Service worker (`sw.js`)** pre-caches the whole app, including the exercise content, on first visit. After that the app loads and learners can complete exercises with no network. Cached files are served instantly and refreshed in the background, so updates arrive on the next load.
- **Offline notice:** a banner appears when the device goes offline.
- **Encrypted offline queue:** each completed stage is stored as an encrypted event in IndexedDB. Once a sync service exists, it registers a sender with `setSender()` in `src/js/queue.js`, and queued events are sent when the device is back online. Until then they simply stay queued.
- **Installable:** `manifest.webmanifest` and the icons in `icons/` meet the installability requirements.
- The service worker only touches same-origin GET requests, and never handles learner data.

## Security and shared-device mode

**Learner data is never stored in plaintext.** The profile, progress, typed answers and the offline queue are encrypted with AES-256-GCM (Web Crypto) before they reach IndexedDB. The app never uses `localStorage`, `sessionStorage` or cookies for learner data or session state, and CI enforces this.

The learner chooses a mode on first run:

| | **My own device** | **Shared computer (school, library)** |
|---|---|---|
| Encryption key | Random, non-extractable, kept in IndexedDB | Derived from a passcode (PBKDF2, 600,000 rounds), **held only in memory** |
| Passcode | None | At least 6 characters, chosen by the learner |
| Idle timeout | None | Logs out after **5 minutes** of inactivity, with a warning 30 seconds before |
| Log out button | No | Yes |

When a shared-device session ends (idle timeout or **Log out**), the page and every in-memory copy of the profile, progress and answers are cleared, and the key is dropped. The stored data stays encrypted, so the next person at the computer sees only the passcode screen. Unsent drafts are saved (encrypted) just before logout and come back after unlocking. **Erase data on this device** on the passcode screen deletes everything.

Honest limits: on a *personal* device the key lives in the same browser profile as the data, so this protects against casual inspection and storage dumps, not against someone who can use that browser as the learner. That is why shared computers use a passcode. A forgotten passcode cannot be recovered, because the key is never stored.

If a browser blocks IndexedDB, the app falls back to memory only: nothing is saved, and a warning says so. It never falls back to plaintext storage.

## Design principles

StepStack targets entry-level smartphones and low-bandwidth connections, so:

- **Vanilla HTML, CSS and JavaScript only.** No third-party UI libraries or frameworks, and no build step. Dev dependencies (jsdom, esbuild, fake-indexeddb) are used only by the tests and never shipped.
- **Tiny payload.** Budgets (gzipped): 15 KB for what loads at startup and 25 KB in total. The exercise content loads on demand after onboarding.
- **Accessible by default.** Native radio inputs, 48px tap targets, visible keyboard focus, dark mode and reduced-motion support.

## Project structure

```
.
├── index.html                    # Page shell: setup, unlock, onboarding, workspace
├── sw.js                         # Service worker (offline cache)
├── manifest.webmanifest          # PWA manifest
├── icons/                        # PWA icons (192, 512)
├── package.json                  # Check scripts, dev dependencies only
├── src/
│   ├── css/onboarding.css        # Styles
│   └── js/
│       ├── main.js               # Entry point
│       ├── app.js                # Setup/unlock/logout flow, idle timer wiring
│       ├── vault.js              # Encryption key + all reads/writes of learner data
│       ├── crypto.js             # AES-GCM and PBKDF2 helpers
│       ├── idb.js                # IndexedDB wrapper
│       ├── storage.js            # Profile + progress facade over the vault
│       ├── queue.js              # Encrypted offline event queue
│       ├── idle.js               # Idle timeout timer
│       ├── pwa.js                # Service worker registration, offline notice
│       ├── config.js             # Tiers, levels and languages
│       ├── onboarding.js         # Onboarding step logic
│       ├── exercises.js          # Exercise content and translations (en, zu, af)
│       ├── grading.js            # Pure answer-checking helpers
│       └── workspace.js          # 3-stage workspace, language toggle, progress bar
├── tests/                        # node:test suites (crypto, idle, service worker, app, grading, content)
├── scripts/                      # CI checks (size, guardrails, PWA)
└── .github/workflows/ci.yml      # GitHub Actions CI
```

## Running locally

Service workers and ES modules need a real web server (not `file://`), and service workers need `localhost` or HTTPS:

```bash
python3 -m http.server 8000      # or: npx serve .
```

Then open http://localhost:8000. To try offline mode: load the page once, open DevTools, go to **Application → Service Workers** to confirm it is active, then tick **Offline** in the Network tab and reload.

## Checks

Requires Node 22 or newer. Install the dev dependencies once with `npm ci`.

```bash
npm run ci                # run everything below
npm run check:syntax      # every JS file in src/js parses
npm run check:guardrails  # no external resources, third-party imports, runtime dependencies,
                          # HTML injection, or localStorage/sessionStorage/cookies
npm run check:pwa         # sw.js pre-caches every file; manifest and icons are valid
npm test                  # crypto, idle timeout, service worker offline behaviour, end-to-end app flows
npm run check:size        # startup and total payload stay under budget
```

The same checks run automatically in GitHub Actions on every push to `main` and on every pull request.

## Contributing

- Keep to the design principles above. CI fails if a change adds external resources, package imports, runtime dependencies, or goes over the size budget.
- Learner data goes through `src/js/vault.js` only. Never write it to `localStorage`, `sessionStorage` or cookies.
- Render text with `textContent` only. Never build HTML strings from translations or learner input.
- Add every new client file to the `SHELL` list in `sw.js`, or `npm run check:pwa` fails.
- Reference the issue number in your commit message, for example `feat(pwa): ... (#3)`.

## License

No license has been chosen yet. Add a `LICENSE` file before accepting outside contributions.