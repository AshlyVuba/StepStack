import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, UI } from '../src/js/exercises.js';
import { TIERS } from '../src/js/config.js';

const langs = Object.keys(UI);

test('English plus at least two South African languages are available', () => {
  assert.ok(langs.includes('en'));
  assert.ok(langs.filter((l) => l !== 'en').length >= 2);
});

test('every onboarding tier has exactly three stages', () => {
  TIERS.forEach((t) => assert.equal(EXERCISES[t.id]?.length, 3, t.id));
});

test('every exercise has complete text in every language', () => {
  for (const ex of Object.values(EXERCISES).flat()) {
    assert.ok(ex.patterns || ex.minLength, `${ex.id} needs a grading rule`);
    for (const l of langs) {
      for (const k of ['title', 'body', 'hint']) {
        assert.ok(ex.text[l]?.[k]?.trim(), `${ex.id}.${l}.${k} missing`);
      }
    }
  }
});

test('UI strings match across languages', () => {
  const keys = Object.keys(UI.en).sort();
  langs.forEach((l) => assert.deepEqual(Object.keys(UI[l]).sort(), keys, l));
  langs.forEach((l) => assert.equal(UI[l].stages.length, 3, l));
});

test('only the stage number and progress placeholders are used', () => {
  langs.forEach((l) => {
    assert.ok(UI[l].progress.includes('{n}') && UI[l].progress.includes('{total}'));
    assert.ok(UI[l].stageN.includes('{n}'));
  });
});