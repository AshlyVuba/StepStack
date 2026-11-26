# Technical architecture documentation

`../StepStack_Technical_Architecture.pdf` is the deliverable for ISSUE-301: end-to-end system diagram, data flows,
database schema, low-bandwidth strategy and technology justification for the PWA frontend and the backend.

## Files

| File | What it is |
|---|---|
| `architecture.html` | Editable source of the PDF (self-contained, diagrams inline) |
| `diagrams/system-architecture.svg` | End-to-end architecture diagram (hand-built SVG) |
| `diagrams/flow-*.mmd` | Mermaid sources for the four sequence diagrams (offline stage, grading, translation, portfolio) |
| `diagrams/flow-*.svg` | Rendered versions of the Mermaid diagrams, as embedded in the PDF |

## Keeping it accurate

The document describes only what exists in the code, and marks everything else as backend-only or planned.
Appendix A lists the source files behind each component. When you change any of those files, update the matching
section, then regenerate the PDF.

Update checklist:

1. Re-read the section and the source files listed for it in Appendix A.
2. Edit `architecture.html` (and the diagram in `diagrams/` if the flow changed). Mermaid diagrams can be re-rendered
   with the Mermaid CLI: `npx @mermaid-js/mermaid-cli -i diagrams/flow-grading.mmd -o diagrams/flow-grading.svg`
   (the PDF uses a custom theme, so the look may differ slightly).
3. Open `architecture.html` in Chrome, choose Print, set paper to A4, margins to Default and turn on Background graphics,
   then save as PDF over `../StepStack_Technical_Architecture.pdf`.
4. Update the status labels (IMPLEMENTED, BACKEND ONLY, PLANNED) and Section 11 whenever a gap is closed. The first one
   to remove is "The frontend does not call the backend".
