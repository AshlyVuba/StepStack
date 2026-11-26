export class InputError extends Error {}

export const LIMITS = { lesson: 4000, learner: 1000 } as const;
export type Kind = keyof typeof LIMITS;

// C0/C1 control chars except \t \n; zero-width + bidi override characters used to hide instructions
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const INVISIBLE = /[​-‏‪-‮⁠-⁩﻿]/g;
// Our own placeholder brackets must never come from the user
const PLACEHOLDER_CHARS = /[⟦⟧]/g;
// Our prompt delimiter, in any casing/spacing, must never come from the user
const DELIMITER = /<\s*\/?\s*learner_text\s*>/gi;

/** Normalise + strip dangerous characters, then enforce the length limit (reject, don't truncate). */
export function sanitize(raw: string, kind: Kind): string {
  let s = raw.normalize("NFC")
    .replace(CONTROL, "")
    .replace(INVISIBLE, "")
    .replace(PLACEHOLDER_CHARS, "")
    .replace(DELIMITER, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!s) throw new InputError("text is empty after sanitisation");
  if (s.length > LIMITS[kind]) throw new InputError(`text exceeds ${LIMITS[kind]} characters`);
  return s;
}
