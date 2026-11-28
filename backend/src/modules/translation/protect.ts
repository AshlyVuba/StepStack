/**
 * Replaces code / Excel syntax with opaque placeholders (⟦0⟧, ⟦1⟧ ...) BEFORE the text goes to a
 * build-time translator, and restores them afterwards. The translator never sees (and so can never
 * mangle) formulas, cell references, or Python code.
 * `restore` reports whether every placeholder survived, and `verifySyntaxLock` verifies compiled
 * lesson packs keep all protected syntax tokens intact.
 */
const EXCEL_FUNCS = [
  "SUM", "SUMIF", "SUMIFS", "AVERAGE", "COUNT", "COUNTA", "COUNTIF", "COUNTIFS", "MIN", "MAX", "IF", "IFS",
  "VLOOKUP", "HLOOKUP", "XLOOKUP", "INDEX", "MATCH", "CONCATENATE", "CONCAT", "LEFT", "RIGHT", "MID", "LEN",
  "TRIM", "ROUND", "TODAY", "NOW", "AND", "OR", "NOT", "PIVOTTABLE", "PIVOT",
  "PMT", "PV", "FV", "RATE", "NPER",
];

/** Python keywords / built-in syntax patterns preserved verbatim in coding lessons. */
const PYTHON_SYNTAX = /\b(?:def\s+[A-Za-z_]\w*\s*\([^)]*\)\s*:|for\s+[A-Za-z_]\w*\s+in\s+range\([^)]*\)\s*:|print\([^)\n]*\))/g;

export interface Protected { text: string; slots: string[] }

/** Find a balanced =FUNC(...) expression starting at `start` (which points at '='). */
function matchFormula(s: string, start: number): number {
  const m = /^=\s*[A-Za-z][A-Za-z0-9._]*\(/.exec(s.slice(start));
  if (!m) return -1;
  let depth = 0;
  for (let i = start + m[0].length - 1; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) return i + 1; }
    else if (c === "\n") return -1;
  }
  return -1;
}

export function protect(input: string): Protected {
  const slots: string[] = [];
  const hold = (m: string) => { slots.push(m); return `⟦${slots.length - 1}⟧`; };

  let s = input;
  s = s.replace(/```[\s\S]*?```/g, hold);                 // fenced code
  s = s.replace(/`[^`\n]+`/g, hold);                      // inline code

  // balanced Excel formulas: =SUM(A1:A5), =VLOOKUP(...), =PMT(...)
  let out = "";
  for (let i = 0; i < s.length; ) {
    if (s[i] === "=") {
      const end = matchFormula(s, i);
      if (end > 0) { out += hold(s.slice(i, end)); i = end; continue; }
    }
    out += s[i++];
  }
  s = out;

  // Python inline statements in prose (e.g. "for i in range(...):", "print(...)")
  s = s.replace(PYTHON_SYNTAX, hold);

  // ranges / cell refs (A1, $B$2, A1:B10) and bare function names in prose (VLOOKUP, SUM, PMT)
  s = s.replace(/\b\$?[A-Z]{1,3}\$?\d{1,7}(?::\$?[A-Z]{1,3}\$?\d{1,7})?\b/g, hold);
  s = s.replace(new RegExp(`\\b(?:${EXCEL_FUNCS.join("|")})\\b(?=\\s*\\()`, "g"), hold);
  s = s.replace(/\b(?:VLOOKUP|HLOOKUP|XLOOKUP|SUMIFS?|COUNTIFS?|PivotTable|SUM|AVERAGE|PMT|ROUND)\b/g, hold);
  return { text: s, slots };
}

export function restore(text: string, slots: string[]): { text: string; intact: boolean } {
  const seen = new Array(slots.length).fill(0);
  const restored = text.replace(/⟦\s*(\d+)\s*⟧/g, (m, n) => {
    const idx = Number(n);
    if (idx < slots.length) { seen[idx] += 1; return slots[idx]!; }
    return m;
  });
  const intact = seen.every((count) => count === 1) && !/⟦|⟧/.test(restored);
  return { text: restored, intact };
}

export interface SyntaxLockCheck {
  ok: boolean;
  missing: string[];
  protectedTokens: string[];
}

/**
 * Verifies that every syntax-locked token (Excel formulas, cell refs, code blocks, Python syntax)
 * extracted from the English master string survived verbatim in the translated string, and that
 * no unexpanded placeholder markers remain.
 */
export function verifySyntaxLock(source: string, translated: string): SyntaxLockCheck {
  const { slots } = protect(source);
  const missing: string[] = [];
  for (const token of slots) {
    // Allow localised placeholder words inside example shapes like =SUM(first:last) only if the formula prefix survives
    if (translated.includes(token)) continue;
    const shapeMatch = /^(=[A-Z]+\()[^)]+(\))$/i.exec(token);
    if (shapeMatch && !/\d/.test(token)) {
      const prefix = shapeMatch[1]!;
      if (translated.includes(prefix)) continue;
    }
    missing.push(token);
  }
  const hasStrayPlaceholders = /⟦|⟧/.test(translated);
  if (hasStrayPlaceholders) missing.push("UNRESTORED_PLACEHOLDER");
  return { ok: missing.length === 0, missing, protectedTokens: slots };
}
