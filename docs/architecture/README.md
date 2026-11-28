# Technical architecture documentation

`../StepStack_Technical_Architecture.pdf` is the deliverable for ISSUE-301: end-to-end system diagram, data flows,
database schema, low-bandwidth strategy and technology justification for the offline-first PWA frontend and the backend.

## Architecture Summary (Current)

- **11-Language Static Offline Lesson Packs (No Live Runtime LLM Inference):** `backend/scripts/build-lesson-packs.ts` compiles master lessons from `data/exercises.json` through `sanitize.ts` and `protect.ts` (syntax-lock for Excel formulas and Python code) into versioned JSON packs for all 11 official South African languages (`en`, `zu`, `xh`, `af`, `nso`, `tn`, `st`, `ts`, `ss`, `ve`, `nr`). Packs are served statically (`frontend/packs/*.json` and `GET /v1/lesson-packs/:lang`), cached by `frontend/sw.js` (`stepstack-packs-v1`), and persisted in IndexedDB (`packs` store in `frontend/src/js/idb.js`) for 100% offline use with zero live CPU/GPU inference per student click.
- **Deterministic Grading + Cryptographic Signing on Sync:** Spreadsheets (including ZAR Household Budgeting and Microloan Interest), typing, Python exercises, and Safe Offline SARS eFiling form-validation simulations (`sars-registration`, `sars-irp5-itr12`) grade deterministically on the client offline and re-verify on the server upon sync (HyperFormula, single-use Pyodide WebAssembly sandbox, structured form grader), backed by HMAC-SHA-256 signed verifiable portfolios.

## Files

| File | What it is |
|---|---|
| `architecture.html` | Editable source of the PDF (self-contained, diagrams inline) |
| `diagrams/system-architecture.svg` | End-to-end architecture diagram (hand-built SVG) |
| `diagrams/flow-*.mmd` | Mermaid sources for the four sequence diagrams (offline stage, grading, static lesson-pack translation, portfolio) |
| `diagrams/flow-*.svg` | Rendered versions of the Mermaid diagrams, as embedded in the PDF |

## Keeping it accurate

The document describes only what exists in the code, and marks everything else as backend-only or planned.
Appendix A lists the source files behind each component. When you change any of those files, update the matching
section, then regenerate the PDF.

Update checklist:

1. Re-read the section and the source files listed for it in Appendix A.
2. Edit `architecture.html` (and the diagram in `diagrams/` if the flow changed). Mermaid diagrams can be re-rendered
   with the Mermaid CLI: `npx @mermaid-js/mermaid-cli -i diagrams/flow-translation.mmd -o diagrams/flow-translation.svg`.
3. Open `architecture.html` in Chrome, choose Print, set paper to A4, margins to Default and turn on Background graphics,
   then save as PDF over `../StepStack_Technical_Architecture.pdf`.
4. Update the status labels (IMPLEMENTED, BACKEND ONLY, PLANNED) and Section 11 whenever a gap is closed.
