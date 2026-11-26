import { HyperFormula } from "hyperformula";
import type { ExcelExercise } from "./exercises.js";

export interface ExcelResult {
  passed: boolean; feedback: string;
  cells: { cell: string; passed: boolean; message: string }[];
}

const MAX_FORMULA_LEN = 300;

function functionsUsed(formula: string): string[] {
  return [...formula.matchAll(/([A-Za-z][A-Za-z0-9.]*)\s*\(/g)].map((m) => m[1]!.toUpperCase());
}

/**
 * Formulas are evaluated by HyperFormula (a pure spreadsheet calculation engine - no eval(),
 * no I/O). We additionally allowlist functions and block cross-sheet / external references.
 * Each exercise has several data cases so hard-coded answers fail.
 */
export function gradeExcel(ex: ExcelExercise, formulas: Record<string, string>): ExcelResult {
  const cells: ExcelResult["cells"] = [];
  const fail = (cell: string, message: string) => cells.push({ cell, passed: false, message });

  // 1. static checks (per answer cell)
  const clean: Record<string, string> = {};
  for (const cell of ex.answerCells) {
    const f = formulas[cell]?.trim();
    if (!f) { fail(cell, "No formula entered."); continue; }
    if (!f.startsWith("=")) { fail(cell, "Start with = so Excel treats it as a formula."); continue; }
    if (f.length > MAX_FORMULA_LEN) { fail(cell, "Formula is too long."); continue; }
    if (/[!'\[\]{}]/.test(f)) { fail(cell, "Use only cells on this sheet."); continue; }
    const used = functionsUsed(f);
    const bad = used.find((u) => !ex.allowedFunctions.includes(u));
    if (bad) { fail(cell, `${bad} isn't needed for this exercise.`); continue; }
    const missing = ex.requiredFunctions.filter((r) => !used.includes(r));
    if (missing.length && ex.answerCells.length === 1) { fail(cell, `Use ${missing.join(", ")} in your formula.`); continue; }
    // Excel accepts bare TRUE/FALSE; HyperFormula wants TRUE()/FALSE()
    clean[cell] = f.replace(/\b(TRUE|FALSE)\b(?!\s*\()/gi, (m) => m.toUpperCase() + "()");
  }

  // 2. evaluate against every data case
  const stillOk = new Set(Object.keys(clean));
  const messages = new Map<string, string>();
  for (const [ci, c] of ex.cases.entries()) {
    const hf = HyperFormula.buildEmpty({ licenseKey: "gpl-v3" });
    try {
      const sheetName = hf.addSheet("Sheet1");
      const sheet = hf.getSheetId(sheetName)!;
      const addr = (a: string) => hf.simpleCellAddressFromString(a, sheet)!;
      for (const [a, v] of Object.entries(c.cells)) hf.setCellContents(addr(a), v);
      for (const [a, f] of Object.entries(clean)) hf.setCellContents(addr(a), f);
      for (const a of stillOk) {
        const got = hf.getCellValue(addr(a));
        const want = c.expected[a];
        const ok = typeof want === "number" && typeof got === "number"
          ? Math.abs(got - want) < 1e-9 : got === want;
        if (!ok) {
          stillOk.delete(a);
          messages.set(a, typeof got === "object" && got !== null
            ? "Your formula returned an error."
            : ci === 0 ? `Expected ${want} but your formula gave ${got}.`
                       : "Your formula works on the example but not when the data changes. Avoid typing numbers directly.");
        }
      }
    } finally { hf.destroy(); }
  }

  for (const cell of ex.answerCells) {
    if (cells.some((c) => c.cell === cell)) continue;
    cells.push({ cell, passed: stillOk.has(cell), message: stillOk.has(cell) ? "Correct" : messages.get(cell) ?? "Incorrect" });
  }
  const passed = cells.every((c) => c.passed);
  return { passed, cells, feedback: passed ? "Pass! All formulas are correct." : "Not yet - see the notes on each cell." };
}
