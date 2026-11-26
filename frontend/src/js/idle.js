// Idle timer for shared devices. Any user activity resets it. It compares
// timestamps on each tick (instead of trusting one long timeout), so a laptop
// that slept or a throttled background tab still logs out on time.
const ACTIVITY = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'mousemove'];

export function createIdleTimer({
  timeoutMs, warnMs = 0, onWarn = () => {}, onActive = () => {}, onTimeout,
  target, now = () => Date.now(), tickMs = 1000
}) {
  let last = now();
  let warned = false;
  let timer = null;
  const opts = { passive: true, capture: true };

  const mark = () => {
    last = now();
    if (warned) { warned = false; onActive(); }
  };

  const tick = () => {
    const idleFor = now() - last;
    if (idleFor >= timeoutMs) {
      stop();
      onTimeout();
    } else if (warnMs && !warned && idleFor >= timeoutMs - warnMs) {
      warned = true;
      onWarn(Math.ceil((timeoutMs - idleFor) / 1000));
    }
  };

  function start() {
    last = now();
    warned = false;
    ACTIVITY.forEach((e) => target.addEventListener(e, mark, opts));
    timer = setInterval(tick, tickMs);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    ACTIVITY.forEach((e) => target.removeEventListener(e, mark, opts));
  }

  return { start, stop, reset: mark };
}