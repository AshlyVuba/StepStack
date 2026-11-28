import test from 'node:test';
import assert from 'node:assert/strict';
import { FORM_RULES, grade, gradeForm, normalise, parseRand } from '../src/js/grading.js';

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

test('parseRand parses South African Rand formatted numbers', () => {
  assert.equal(parseRand('R180 000'), 180000);
  assert.equal(parseRand('R 14,500'), 14500);
  assert.equal(parseRand(18000), 18000);
  assert.ok(Number.isNaN(parseRand('not-a-number')));
});

test('Financial Literacy: Household Budget and Loan Interest formula drills', () => {
  const budget = { patterns: ['^=sum\\(b3:b7\\)$'] };
  assert.ok(grade(budget, '=SUM(B3:B7)'));
  assert.ok(!grade(budget, '=SUM(B2:B7)'));

  const interest = { patterns: ['^=b2\\*b3\\*b4$'] };
  assert.ok(grade(interest, '=B2 * B3 * B4'));
  assert.ok(!grade(interest, '=B2+B3+B4'));
});

test('Financial Literacy: Safe Offline SARS eFiling Registration form validation', () => {
  const reg = FORM_RULES.fin3;
  const pass = gradeForm(reg, {
    taxReferenceNumber: '0123456789',
    idNumber: '9901015009087',
    taxpayerType: 'Individual',
    passwordSafety: 'never-share'
  });
  assert.equal(pass.passed, true);
  assert.equal(pass.simulationOnly, true);
  assert.equal(grade(reg, {
    taxReferenceNumber: '55555',
    idNumber: '123',
    taxpayerType: 'Trust',
    passwordSafety: 'post-online'
  }), false);
});

test('Financial Literacy: Safe Offline SARS eFiling IRP5 & ITR12 validation', () => {
  const irp5 = FORM_RULES.fin4;
  const pass = gradeForm(irp5, {
    taxYear: 2026,
    code3601: 'R180 000',
    code4102: 'R 14,500',
    code4005: 18000,
    declarationConfirmed: true
  });
  assert.equal(pass.passed, true);
  assert.equal(pass.simulationOnly, true);

  const fail = gradeForm(irp5, {
    taxYear: 2026,
    code3601: 'R150 000',
    code4102: 'R14 500',
    code4005: 'R18 000',
    declarationConfirmed: false
  });
  assert.equal(fail.passed, false);
  assert.equal(fail.fields.find((f) => f.id === 'code3601').passed, false);
  assert.equal(fail.fields.find((f) => f.id === 'declarationConfirmed').passed, false);
});
