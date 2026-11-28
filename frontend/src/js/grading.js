// Local grading remains available offline; supported exercises also use the server grader.
import { API_BASE, EXERCISE_MAP, verifyEndpoint } from './config.js';
import { enqueue } from './queue.js';

export function normalise(value) {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[\u201c\u201d\u2018\u2019']/g, '"');
}

export function grade(exercise, value) {
  if (exercise.minLength) return String(value).trim().length >= exercise.minLength;
  return exercise.patterns.some((pattern) => new RegExp(pattern, 'i').test(normalise(value)));
}

export const frontendToBackendExercise = (kind, frontendId) =>
  EXERCISE_MAP[kind]?.[frontendId] ||
  (kind === 'typing' && /^typing-foundation-\d{2}$/.test(frontendId) ? { exerciseId: frontendId } : undefined);

class RetryableRequestError extends Error {}

async function postJson(path, body) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    throw new RetryableRequestError('offline');
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new RetryableRequestError(error instanceof Error ? error.message : 'network unavailable');
  }
  if (response.status === 429 || response.status >= 500)
    throw new RetryableRequestError(`server returned ${response.status}`);
  if (!response.ok) throw new Error(`request failed (${response.status})`);
  return response.json();
}

const requestFor = (kind, mapping, answer, durationMs) => {
  if (kind === 'typing') return {
    path: '/v1/grade/typing',
    body: { exerciseId: mapping.exerciseId, typed: answer, durationMs }
  };
  if (kind === 'excel') return {
    path: '/v1/grade/excel',
    body: { exerciseId: mapping.exerciseId, formulas: { [mapping.answerCell]: answer } }
  };
  return { path: '/v1/grade/python', body: { exerciseId: mapping.exerciseId, code: answer } };
};

export function scoreTyping(target, typed, durationMs, minWpm, minAccuracy) {
  const expected = target || '';
  const actual = String(typed);
  const previous = Array.from({ length: actual.length + 1 }, (_, index) => index);
  for (let i = 1; i <= expected.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= actual.length; j++) {
      const old = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (expected[i - 1] === actual[j - 1] ? 0 : 1));
      diagonal = old;
    }
  }
  const distance = previous[actual.length];
  const accuracy = Math.max(0, Math.round((1 - distance / Math.max(expected.length, actual.length)) * 1000) / 10);
  const wpm = Math.round((Math.max(0, expected.length - distance) / 5 / (durationMs / 60000)) * 10) / 10;
  return {
    passed: accuracy >= minAccuracy && wpm >= minWpm && wpm <= 250,
    accuracy,
    wpm,
    feedback: `Pass targets: ${minWpm} WPM and ${minAccuracy}% accuracy.`
  };
}

function offlineTypingResult(mapping, typed, durationMs) {
  return scoreTyping(
    mapping.target || mapping.text,
    typed,
    durationMs,
    mapping.minWpm || 20,
    mapping.minAccuracy || 95
  );
}

export async function gradeExercise(kind, frontendId, answer, durationMs = 0, exercise = null) {
  const mapping = frontendToBackendExercise(kind, frontendId);
  if (!mapping) return { passed: exercise ? grade(exercise, answer) : false, source: 'local' };

  const request = requestFor(kind, mapping, answer, durationMs);
  try {
    return { ...(await postJson(request.path, request.body)), source: 'server' };
  } catch (error) {
    if (!(error instanceof RetryableRequestError)) throw error;
    await enqueue('grade', request);
    const typing = kind === 'typing'
      ? offlineTypingResult({ ...mapping, ...exercise }, answer, durationMs)
      : kind === 'excel'
        ? normalise(answer) === '=sum(b1:b5)'
        : /def\s+sum_even\s*\(\s*numbers\s*\)\s*:/i.test(answer) && /%|mod/i.test(answer);
    return {
      passed: typeof typing === 'object' ? typing.passed : typing,
      source: 'offline',
      pending: true,
      ...(typeof typing === 'object' ? { wpm: typing.wpm, accuracy: typing.accuracy } : {}),
      feedback: typeof typing === 'object'
        ? `${typing.feedback} ${typing.passed ? 'Saved for server verification when online.' : 'Saved; try again to meet the targets.'}`
        : typing
          ? 'Saved for server verification when you are back online.'
          : 'Saved. Connect to the internet to verify your answer.'
    };
  }
}

export async function translateText(text, targetLang, kind = 'learner') {
  const body = { text, targetLang, kind };
  try {
    return await postJson('/v1/translate', body);
  } catch (error) {
    if (!(error instanceof RetryableRequestError)) throw error;
    await enqueue('translate', { path: '/v1/translate', body });
    return { translation: text, language: targetLang, queued: true };
  }
}

export async function verifyPortfolio(token) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
  const response = await fetch(verifyEndpoint(token));
  if (response.status === 404 || response.status === 410) return { verified: false };
  if (!response.ok) throw new Error(`portfolio-verification-failed:${response.status}`);
  return response.json();
}
