import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreTyping } from '../src/js/grading.js';
import {
  TYPING_STAGES, canPlayStage, newTypingProgress, recordTypingAttempt
} from '../src/js/typing-game.js';

test('typing foundation has ten progressively harder stages and locks future stages', () => {
  const progress = newTypingProgress();
  assert.equal(TYPING_STAGES.length, 10);
  assert.equal(canPlayStage(progress, 1), true);
  assert.equal(canPlayStage(progress, 2), false);
  assert.throws(() => recordTypingAttempt(progress, 2, { passed: true, wpm: 100, accuracy: 100 }), /stage-locked/);
});

test('accuracy, WPM, failed attempts, stage unlocking, completion, and replay use pass thresholds', () => {
  let progress = newTypingProgress();
  const first = TYPING_STAGES[0];
  const tooSlow = scoreTyping(first.text, first.text, 60000, first.minWpm, first.minAccuracy);
  assert.equal(tooSlow.accuracy, 100);
  assert.equal(tooSlow.passed, false);
  progress = recordTypingAttempt(progress, 1, { ...tooSlow, source: 'offline' });
  assert.equal(progress.unlockedStage, 1);
  assert.equal(progress.stages[1].passed, false);

  for (let stageNumber = 1; stageNumber <= 10; stageNumber++) {
    const stage = TYPING_STAGES[stageNumber - 1];
    const score = scoreTyping(stage.text, stage.text, 10000, stage.minWpm, stage.minAccuracy);
    assert.equal(score.passed, true);
    progress = recordTypingAttempt(progress, stageNumber, { ...score, source: 'server' });
    assert.equal(progress.stages[stageNumber].passed, true);
  }
  assert.equal(progress.unlockedStage, 10);
  assert.equal(progress.completed, true);
  assert.equal(canPlayStage(progress, 1), true);
  assert.equal(progress.stages[1].attempts.length, 2);
  assert.equal(progress.stages[1].attempts[0].passed, false);
  assert.equal(progress.stages[1].attempts[1].passed, true);
});

test('typing score uses backend-compatible case-sensitive accuracy and rejects implausible speed', () => {
  const stage = TYPING_STAGES[5];
  const wrongCase = scoreTyping(stage.text, stage.text.toLowerCase(), 10000, stage.minWpm, stage.minAccuracy);
  assert.ok(wrongCase.accuracy < 100);
  assert.equal(wrongCase.passed, true);
  const inaccurate = scoreTyping(stage.text, 'x'.repeat(stage.text.length), 10000, stage.minWpm, stage.minAccuracy);
  assert.equal(inaccurate.passed, false);
  const pasted = scoreTyping(stage.text, stage.text, 1000, stage.minWpm, stage.minAccuracy);
  assert.equal(pasted.passed, false);
  assert.ok(pasted.wpm > 250);
});
