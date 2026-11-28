import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gradeExercise, translateText, verifyPortfolio, frontendToBackendExercise
} from '../src/js/grading.js';
import { TYPING_STAGES } from '../src/js/typing-game.js';

test('frontend exercise IDs map only to matching server-side graders', () => {
  assert.equal(frontendToBackendExercise('excel', 'w1').exerciseId, 'sum-basic');
  assert.equal(frontendToBackendExercise('python', 'd1').exerciseId, 'sum-even');
  assert.equal(frontendToBackendExercise('excel', 'w2'), undefined);
  assert.equal(TYPING_STAGES.length, 10);
  TYPING_STAGES.forEach((stage, index) => {
    assert.equal(
      frontendToBackendExercise('typing', stage.id).exerciseId,
      `typing-foundation-${String(index + 1).padStart(2, '0')}`
    );
  });
});

test('grading and translation use public endpoints without internal credentials', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const result = calls.length === 1
      ? { passed: true, feedback: 'Correct' }
      : { translation: 'Kopisha le fomula.', language: 'zu' };
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const graded = await gradeExercise('excel', 'w1', '=SUM(B1:B5)', 5000);
    assert.equal(graded.passed, true);
    assert.match(calls[0].url, /\/v1\/grade\/excel$/);
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      exerciseId: 'sum-basic', formulas: { B6: '=SUM(B1:B5)' }
    });

    const translation = await translateText('Copy this formula.', 'zu');
    assert.equal(translation.translation, 'Kopisha le fomula.');
    assert.match(calls[1].url, /\/v1\/translate$/);
    assert.deepEqual(JSON.parse(calls[1].options.body), {
      text: 'Copy this formula.', targetLang: 'zu', kind: 'learner'
    });
    for (const { options: request } of calls) {
      assert.deepEqual(Object.keys(request.headers).sort(), ['Content-Type']);
      assert.equal(JSON.stringify(request).includes('x-internal-key'), false);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('portfolio verification uses the public token route', async () => {
  const originalFetch = globalThis.fetch;
  let url = '';
  globalThis.fetch = async (requestUrl) => {
    url = String(requestUrl);
    return new Response(JSON.stringify({ verified: true, displayName: 'Verified learner' }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  };
  try {
    const result = await verifyPortfolio('v1.public.signature');
    assert.equal(result.verified, true);
    assert.match(url, /\/v1\/verify\/v1\.public\.signature$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
