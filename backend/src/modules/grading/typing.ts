import type { TypingExercise } from "./exercises.js";

export interface TypingResult { passed: boolean; wpm: number; accuracy: number; feedback: string }

/** Levenshtein distance with a rolling row. Inputs are capped (2000 chars) by the route. */
function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!; prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

export function gradeTyping(ex: TypingExercise, typed: string, durationMs: number): TypingResult {
  const target = ex.text;
  const dist = editDistance(target, typed);
  const accuracy = Math.max(0, Math.round((1 - dist / Math.max(target.length, typed.length)) * 1000) / 10);
  const correctChars = Math.max(0, target.length - dist);
  const minutes = durationMs / 60000;
  const wpm = Math.round((correctChars / 5 / minutes) * 10) / 10; // standard: 5 chars = 1 word

  // Plausibility guard: nobody sustains >250 WPM; flags paste / scripted input
  if (wpm > 250) return { passed: false, wpm, accuracy, feedback: "That speed looks automated. Please type the text yourself." };

  const speedOk = wpm >= ex.minWpm, accOk = accuracy >= ex.minAccuracy;
  const feedback = speedOk && accOk
    ? `Pass! ${wpm} WPM at ${accuracy}% accuracy.`
    : `Not yet: ${wpm} WPM (need ${ex.minWpm}) at ${accuracy}% accuracy (need ${ex.minAccuracy}%).`;
  return { passed: speedOk && accOk, wpm, accuracy, feedback };
}
