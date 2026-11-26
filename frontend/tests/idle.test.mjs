import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createIdleTimer } from '../src/js/idle.js';

function setup(opts = {}) {
  mock.timers.enable({ apis: ['setInterval'] });
  let clock = 0;
  const target = new EventTarget();
  const log = [];
  const timer = createIdleTimer({
    timeoutMs: 10000, warnMs: 3000, tickMs: 1000, target, now: () => clock,
    onWarn: (s) => log.push(['warn', s]), onActive: () => log.push(['active']),
    onTimeout: () => log.push(['timeout']), ...opts
  });
  const advance = (ms) => { for (let i = 0; i < ms / 1000; i++) { clock += 1000; mock.timers.tick(1000); } };
  const jump = (ms) => { clock += ms; mock.timers.tick(1000); };   // clock leaps (sleep) before one tick
  return { timer, target, log, advance, jump, done: () => { timer.stop(); mock.timers.reset(); } };
}

test('times out after inactivity', () => {
  const { timer, log, advance, done } = setup();
  timer.start();
  advance(9000);
  assert.ok(!log.some(([k]) => k === 'timeout'));
  advance(1000);
  assert.deepEqual(log.at(-1), ['timeout']);
  done();
});

test('warns before timing out', () => {
  const { timer, log, advance, done } = setup();
  timer.start();
  advance(7000);
  assert.deepEqual(log, [['warn', 3]]);
  done();
});

test('activity resets the timer and cancels the warning', () => {
  const { timer, target, log, advance, done } = setup();
  timer.start();
  advance(8000);
  target.dispatchEvent(new Event('keydown'));
  assert.deepEqual(log.at(-1), ['active']);
  advance(8000);
  assert.ok(!log.some(([k]) => k === 'timeout'));
  advance(2000);
  assert.deepEqual(log.at(-1), ['timeout']);
  done();
});

test('logs out on the next tick even if the clock jumped (device slept)', () => {
  const { timer, log, advance, jump, done } = setup();
  timer.start();
  advance(1000);
  jump(60 * 60 * 1000);
  assert.deepEqual(log.at(-1), ['timeout']);
  done();
});

test('stop() removes listeners and stops ticking', () => {
  const { timer, target, log, advance, done } = setup();
  timer.start();
  timer.stop();
  advance(20000);
  target.dispatchEvent(new Event('keydown'));
  assert.equal(log.length, 0);
  done();
});