import type { FormExercise, FormFieldRule } from "./exercises.js";

export interface FormFieldResult {
  id: string;
  label: string;
  passed: boolean;
  message: string;
}

export interface FormResult {
  passed: boolean;
  simulationOnly: boolean;
  feedback: string;
  fields: FormFieldResult[];
}

/** Parses South African Rand formatted numbers such as "R180 000", "R 14,500.00", or 14500. */
export function parseRandNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const cleaned = value.trim().replace(/^r\s*/i, "").replace(/[\s,]+/g, "");
  if (!cleaned) return Number.NaN;
  return Number(cleaned);
}

function checkField(rule: FormFieldRule, raw: unknown): FormFieldResult {
  const fail = (message: string): FormFieldResult => ({ id: rule.id, label: rule.label, passed: false, message });
  const ok = (): FormFieldResult => ({ id: rule.id, label: rule.label, passed: true, message: "Valid" });

  const missing = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
  if (missing) {
    return rule.required ? fail(`Required. ${rule.hint}`) : ok();
  }

  if (rule.type === "boolean") {
    const boolVal = typeof raw === "boolean" ? raw : String(raw).trim().toLowerCase() === "true";
    if (rule.expected !== undefined && boolVal !== rule.expected) {
      return fail(rule.hint);
    }
    return ok();
  }

  if (rule.type === "number") {
    const num = parseRandNumber(raw);
    if (!Number.isFinite(num)) return fail(`Enter a valid number. ${rule.hint}`);
    if (rule.min !== undefined && num < rule.min) return fail(`Must be at least ${rule.min}. ${rule.hint}`);
    if (rule.max !== undefined && num > rule.max) return fail(`Must be at most ${rule.max}. ${rule.hint}`);
    if (rule.expected !== undefined && Math.abs(num - Number(rule.expected)) > 1e-6) {
      return fail(`Does not match expected value. ${rule.hint}`);
    }
    return ok();
  }

  const str = String(raw).trim();
  if (rule.type === "enum") {
    if (rule.options && !rule.options.includes(str)) {
      return fail(`Choose one of: ${rule.options.join(", ")}.`);
    }
    if (rule.expected !== undefined && str !== String(rule.expected)) {
      return fail(rule.hint);
    }
    return ok();
  }

  // type === "string"
  const compact = str.replace(/\s+/g, "");
  if (rule.pattern && !new RegExp(rule.pattern).test(compact)) {
    return fail(rule.hint);
  }
  if (rule.expected !== undefined && compact !== String(rule.expected)) {
    return fail(rule.hint);
  }
  return ok();
}

/**
 * Deterministic structured form grader for offline Financial Literacy & SARS eFiling simulations.
 * Zero external API calls; never contacts any government portal.
 */
export function gradeForm(
  ex: FormExercise,
  submission: Record<string, string | number | boolean>,
): FormResult {
  const fields = ex.fields.map((rule) => checkField(rule, submission[rule.id]));
  const passed = fields.every((f) => f.passed);
  return {
    passed,
    simulationOnly: true,
    feedback: passed
      ? "Pass! All simulated form fields are valid."
      : "Not yet - check the highlighted form fields and try again.",
    fields,
  };
}
