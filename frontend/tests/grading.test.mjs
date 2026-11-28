import test from 'node:test';
import assert from 'node:assert/strict';
import { grade, normalise } from '../src/js/grading.js';

test('normalise handles case, whitespace and smart quotes', () => {
  assert.equal(normalise(' Print( \u201cHello\u201d ) '), 'print("hello")');
});

test('local fallback accepts the mapped spreadsheet formula', () => {
  const formula = { patterns: ['^=sum\\(b1:b5\\)$'] };
  assert.ok(grade(formula, '=SUM(B1:B5)'));
  assert.ok(!grade(formula, '=SUM(B1:B4)'));
});

test('local fallback checks a code answer against its exercise rule', () => {
  const python = { patterns: ['^defsum_even\\(numbers\\):.*sum\\(.*%2.*$'] };
  assert.ok(grade(python, 'def sum_even(numbers): return sum(n for n in numbers if n % 2 == 0)'));
  assert.ok(!grade(python, 'def sum_even(numbers): return sum(numbers)'));
});

test('open-ended answers require the configured minimum length', () => {
  const exercise = { minLength: 20 };
  assert.ok(!grade(exercise, 'too short'));
  assert.ok(grade(exercise, 'a'.repeat(20)));
});
