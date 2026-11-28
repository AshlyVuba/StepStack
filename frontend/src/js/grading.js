// Deterministic offline grading, 10-stage typing scorer, static 11-language lesson packs, and server sync.
import { API_BASE, EXERCISE_MAP, SUPPORTED_LANGUAGES, packEndpoint, verifyEndpoint } from './config.js';
import { get as idbGet, put as idbPut } from './idb.js';
import { enqueue } from './queue.js';

export function normalise(value) {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[\u201c\u201d\u2018\u2019']/g, '"');
}

export function parseRand(value) {
  if (typeof value === 'number') return value;
  const cleaned = String(value ?? '').trim().replace(/^r\s*/i, '').replace(/[\s,]+/g, '');
  return cleaned ? Number(cleaned) : Number.NaN;
}

const rule = (id, type, extra) => ({ id, type, required: true, ...extra });
export const FORM_RULES = {
  fin3: {
    fields: [
      rule('taxReferenceNumber', 'string', { pattern: '^[01239]\\d{9}$' }),
      rule('idNumber', 'string', { pattern: '^\\d{13}$' }),
      rule('taxpayerType', 'enum', { options: ['Individual', 'Company', 'Trust'], expected: 'Individual' }),
      rule('passwordSafety', 'enum', { options: ['never-share', 'share-with-agent', 'post-online'], expected: 'never-share' })
    ]
  },
  fin4: {
    fields: [
      rule('taxYear', 'number', { expected: 2026 }),
      rule('code3601', 'number', { expected: 180000 }),
      rule('code4102', 'number', { expected: 14500 }),
      rule('code4005', 'number', { expected: 18000 }),
      rule('declarationConfirmed', 'boolean', { expected: true })
    ]
  }
};

const EXCEL_OFFLINE = {
  w1: { B6: '^=sum\\(b1:b5\\)$' },
  fin1: { B8: '^=sum\\(b3:b7\\)$', B9: '^=b2-(b8|sum\\(b3:b7\\))$' },
  fin2: { B5: '^=(b2\\*b3\\*b4|round\\(b2\\*b3\\*b4,2\\))$', B6: '^=(b2\\+b5|b2\\*\\(1\\+b3\\*b4\\))$' }
};

export function gradeForm(exercise, submission = {}) {
  const fields = (exercise.fields || []).map((f) => {
    const val = submission[f.id];
    if (val == null || (typeof val === 'string' && !val.trim())) return { id: f.id, passed: !f.required };
    if (f.type === 'boolean') {
      const b = typeof val === 'boolean' ? val : /^true$/i.test(String(val).trim());
      return { id: f.id, passed: f.expected === undefined || b === f.expected };
    }
    if (f.type === 'number') {
      const n = parseRand(val);
      return { id: f.id, passed: Number.isFinite(n) && (f.expected === undefined || Math.abs(n - f.expected) < 1e-6) };
    }
    const s = String(val).trim();
    if (f.type === 'enum') {
      return { id: f.id, passed: (!f.options || f.options.includes(s)) && (f.expected === undefined || s === f.expected) };
    }
    const compact = s.replace(/\s+/g, '');
    return {
      id: f.id,
      passed: (!f.pattern || new RegExp(f.pattern).test(compact)) && (f.expected === undefined || compact === f.expected)
    };
  });
  const passed = fields.every((item) => item.passed);
  return {
    passed,
    simulationOnly: true,
    fields,
    feedback: passed ? 'Pass! All simulated form fields are valid.' : 'Check the highlighted form fields.'
  };
}

export function grade(exercise, value) {
  if (exercise.fields) return gradeForm(exercise, value).passed;
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
    body: {
      exerciseId: mapping.exerciseId,
      formulas: typeof answer === 'object' && answer ? answer : { [mapping.answerCell]: answer }
    }
  };
  if (kind === 'form') return {
    path: '/v1/grade/form',
    body: { exerciseId: mapping.exerciseId, fields: answer }
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
  if (!mapping) {
    if (exercise?.fields) return { ...gradeForm(exercise, answer), source: 'local' };
    return { passed: exercise ? grade(exercise, answer) : false, source: 'local' };
  }

  const request = requestFor(kind, mapping, answer, durationMs);
  try {
    return { ...(await postJson(request.path, request.body)), source: 'server' };
  } catch (error) {
    if (!(error instanceof RetryableRequestError)) throw error;
    await enqueue('grade', request);
    if (kind === 'form') {
      return { ...gradeForm(FORM_RULES[frontendId] || exercise || {}, answer), source: 'offline', pending: true };
    }
    const typing = kind === 'typing'
      ? offlineTypingResult({ ...mapping, ...exercise }, answer, durationMs)
      : kind === 'excel'
        ? Object.entries(EXCEL_OFFLINE[frontendId] || EXCEL_OFFLINE.w1).every(([cell, pattern]) =>
            new RegExp(pattern, 'i').test(normalise(typeof answer === 'object' && answer ? answer[cell] || '' : answer)))
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

export async function loadLessonPack(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) throw new Error('unsupported-language');
  try {
    if (typeof indexedDB !== 'undefined') {
      const stored = await idbGet('packs', lang);
      if (stored?.lessons) return stored;
    }
  } catch (error) { /* fall through to static pack fetch */ }
  for (const url of [`./packs/${lang}.json`, packEndpoint(lang)]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const pack = await res.json();
      if (pack?.lessons && typeof indexedDB !== 'undefined') {
        try { await idbPut('packs', lang, pack); } catch (error) { /* ignore storage quota */ }
      }
      return pack;
    } catch (error) { /* try next source */ }
  }
  return null;
}

export async function translateText(text, targetLang, kind = 'learner') {
  if (kind === 'lesson' && SUPPORTED_LANGUAGES.includes(targetLang)) {
    const pack = await loadLessonPack(targetLang);
    const hit = pack && Object.values(pack.lessons).find((l) => l.body === text || l.title === text);
    if (hit) return { translation: hit.body, language: targetLang, cached: true, source: 'pack' };
  }
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

export { API_BASE };
