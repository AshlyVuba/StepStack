import * as vault from './vault.js';
import { removeLegacyData } from './storage.js';
import { startOnboarding, clearOnboarding } from './onboarding.js';
import { flushWorkspace, clearWorkspace } from './workspace.js';
import { createIdleTimer } from './idle.js';
import { initPwa } from './pwa.js';
import './queue.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['setup', 'unlock', 'onboarding', 'welcome', 'workspace'];
const IDLE_MS = 5 * 60 * 1000;
const WARN_MS = 30 * 1000;

let idle = null;
let config = { idleMs: IDLE_MS, warnMs: WARN_MS, tickMs: 1000 };

const hideScreens = () => SCREENS.forEach((id) => { $(id).hidden = true; });
const hideWarning = () => { $('idle-warning').hidden = true; };

function showSetup() {
  hideScreens();
  $('setup-msg').textContent = '';
  $('setup').hidden = false;
  $('persist-warning').hidden = vault.isPersistent();
  document.querySelector('#setup-form input[name=device]:checked').focus();
}

function showUnlock(message = '') {
  hideScreens();
  $('unlock-msg').textContent = message;
  $('unlock').hidden = false;
  $('unlock-pass').focus();
}

async function enterSession() {
  removeLegacyData();
  hideScreens();
  const shared = vault.getMode() === 'shared';
  $('logout').hidden = !shared;
  $('persist-warning').hidden = vault.isPersistent();
  await startOnboarding();
  if (shared) {
    idle = createIdleTimer({
      timeoutMs: config.idleMs,
      warnMs: config.warnMs,
      tickMs: config.tickMs,
      target: document,
      onWarn: () => { $('idle-warning').hidden = false; },
      onActive: hideWarning,
      onTimeout: () => lock('idle')
    });
    idle.start();
  }
}

// Logs out: clears everything held in memory and the page, then drops the key.
// Stored data stays encrypted and unreadable until the passcode is entered.
async function lock(reason) {
  if (idle) { idle.stop(); idle = null; }
  hideWarning();
  flushWorkspace();            // save the learner's latest answer before the key goes
  clearWorkspace();
  clearOnboarding();
  $('logout').hidden = true;
  await vault.lock();
  showUnlock(reason === 'idle' ? 'You were logged out because of inactivity.' : 'You are logged out.');
}

$('setup-form').addEventListener('change', () => {
  $('setup-pass').hidden = $('setup-form').elements.device.value !== 'shared';
});

$('setup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const mode = $('setup-form').elements.device.value;
  const passcode = $('setup-passcode').value;
  if (mode === 'shared' && passcode.length < vault.MIN_PASSCODE) {
    $('setup-msg').textContent = `Choose a passcode of at least ${vault.MIN_PASSCODE} characters.`;
    return;
  }
  try {
    await vault.setup(mode, passcode);
  } catch (err) {
    $('setup-msg').textContent = 'Secure storage could not be set up on this device.';
    return;
  }
  $('setup-passcode').value = '';
  await enterSession();
});

$('unlock-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = $('unlock-form').querySelector('button[type=submit]');
  button.disabled = true;
  $('unlock-msg').textContent = 'Unlocking…';
  const ok = await vault.unlock($('unlock-pass').value);
  $('unlock-pass').value = '';
  button.disabled = false;
  if (!ok) {
    $('unlock-msg').textContent = 'That passcode is not right. Try again.';
    $('unlock-pass').focus();
    return;
  }
  await enterSession();
});

$('unlock-erase').addEventListener('click', async () => {
  if (!confirm('Erase all StepStack data on this device? This cannot be undone.')) return;
  await vault.wipe();
  showSetup();
});

$('logout').addEventListener('click', () => lock('manual'));

export async function startApp(options = {}) {
  config = { ...config, ...options };
  initPwa();
  const status = await vault.init();
  if (status === 'new') showSetup();
  else if (status === 'locked') showUnlock();
  else await enterSession();
}