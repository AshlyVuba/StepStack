// Pure grading helpers. No DOM access, so they are unit-testable in Node.

// Lowercase, strip whitespace, and treat smart/single quotes as double quotes
// (mobile keyboards often insert curly quotes).
export function normalise(value) {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[\u201c\u201d\u2018\u2019']/g, '"');
}

// Short-answer exercises carry `patterns` (regex source strings, matched against
// the normalised answer). Open-ended capstones carry `minLength` instead.
export function grade(exercise, value) {
  if (exercise.minLength) return String(value).trim().length >= exercise.minLength;
  const answer = normalise(value);
  return exercise.patterns.some((p) => new RegExp(p, 'i').test(answer));
}