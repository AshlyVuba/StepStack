import test from 'node:test';
import assert from 'node:assert/strict';
import { grade, normalise } from '../src/js/grading.js';
import { EXERCISES } from '../src/js/exercises.js';

const byId = Object.fromEntries(Object.values(EXERCISES).flat().map((e) => [e.id, e]));

test('normalise ignores case, spaces and smart quotes', () => {
  assert.equal(normalise(' Print( \u201cHello\u201d ) '), 'print("hello")');
});

const accepted = {
  f1: ['ctrl+c', 'Ctrl + C', 'control+c'],
  f2: ['.docx', ' .DOCX '],
  w1: ['=SUM(A1:A5)', '= sum( a1:a5 )'],
  w2: ['=AVERAGE(B2:B10)'],
  d1: ['print("Hello")', "print('Hello')", 'print(\u201cHello\u201d)'],
  d2: ['for i in range(5):', 'for x in range(5)', 'for i in range(0, 5):']
};
const rejected = {
  f1: ['ctrl+v', ''], f2: ['docx', '.pdf'], w1: ['=SUM(A1:A4)', 'SUM(A1:A5)'],
  w2: ['=AVERAGE(B2:B9)'], d1: ['print(Hello)', 'print("Bye")'], d2: ['for i in range(4):', 'while True:']
};

for (const [id, answers] of Object.entries(accepted)) {
  test(`${id} accepts valid answers`, () => answers.forEach((a) => assert.ok(grade(byId[id], a), a)));
}
for (const [id, answers] of Object.entries(rejected)) {
  test(`${id} rejects wrong answers`, () => answers.forEach((a) => assert.ok(!grade(byId[id], a), a)));
}

test('capstones need at least 20 characters', () => {
  for (const id of ['f3', 'w3', 'd3']) {
    assert.ok(!grade(byId[id], 'too short'));
    assert.ok(grade(byId[id], 'a'.repeat(20)));
  }
});