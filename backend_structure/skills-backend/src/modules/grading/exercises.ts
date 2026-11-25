import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Exercises (and their expected answers) live on the server only; clients send just an exerciseId. */
export interface TypingExercise { id: string; text: string; minWpm: number; minAccuracy: number }
export interface ExcelExercise {
  id: string; title: string;
  answerCells: string[];
  allowedFunctions: string[];
  requiredFunctions: string[];
  /** Several data sets: a hard-coded answer can only match one of them. */
  cases: { cells: Record<string, string | number>; expected: Record<string, string | number> }[];
}
export interface PythonExercise {
  id: string; title: string; functionName: string;
  tests: { args: unknown[]; expected: unknown; hidden?: boolean }[];
}

function loadDir<T extends { id: string }>(dir: string): Map<string, T> {
  const base = resolve(process.cwd(), "exercises", dir);
  const m = new Map<string, T>();
  for (const f of readdirSync(base).filter((f) => f.endsWith(".json"))) {
    const e = JSON.parse(readFileSync(join(base, f), "utf8")) as T;
    m.set(e.id, e);
  }
  return m;
}

export class ExerciseStore {
  typing = loadDir<TypingExercise>("typing");
  excel = loadDir<ExcelExercise>("excel");
  python = loadDir<PythonExercise>("python");
}
