/**
 * Replaces code / Excel syntax with opaque placeholders (⟦0⟧, ⟦1⟧ ...) BEFORE the text goes to the LLM,
 * and restores them afterwards. The model never sees (and so can never mangle) the code.
 * `restore` also reports whether every placeholder survived, so we can detect a bad translation.
 */
const EXCEL_FUNCS = [
  "SUM", "SUMIF", "SUMIFS", "AVERAGE", "COUNT", "COUNTA", "COUNTIF", "COUNTIFS", "MIN", "MAX", "IF", "IFS",
  "VLOOKUP", "HLOOKUP", "XLOOKUP", "INDEX", "MATCH", "CONCATENATE", "CONCAT", "LEFT", "RIGHT", "MID", "LEN",
  "TRIM", "ROUND", "TODAY", "NOW", "AND", "OR", "NOT", "PIVOTTABLE", "PIVOT",
];

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

  // balanced Excel formulas: =SUM(A1:A5), =VLOOKUP(...)
  let out = "";
  for (let i = 0; i < s.length; ) {
    if (s[i] === "=") {
      const end = matchFormula(s, i);
      if (end > 0) { out += hold(s.slice(i, end)); i = end; continue; }
    }
    out += s[i++];
  }
  s = out;

  // ranges / cell refs (A1, $B$2, A1:B10) and bare function names in prose (VLOOKUP)
  s = s.replace(/\b\$?[A-Z]{1,3}\$?\d{1,7}(?::\$?[A-Z]{1,3}\$?\d{1,7})?\b/g, hold);
  s = s.replace(new RegExp(`\\b(?:${EXCEL_FUNCS.join("|")})\\b(?=\\s*\\()`, "g"), hold);
  s = s.replace(/\b(?:VLOOKUP|HLOOKUP|XLOOKUP|SUMIFS?|COUNTIFS?|PivotTable)\b/g, hold);
  return { text: s, slots };
}

export function restore(text: string, slots: string[]): { text: string; intact: boolean } {
  const seen = new Set<number>();
  const restored = text.replace(/⟦\s*(\d+)\s*⟧/g, (m, n) => {
    const idx = Number(n);
    if (idx < slots.length) { seen.add(idx); return slots[idx]!; }
    return m;
  });
  const intact = seen.size === slots.length && !/⟦|⟧/.test(restored);
  return { text: restored, intact };
}
