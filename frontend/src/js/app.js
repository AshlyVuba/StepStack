import { get as getDeviceMeta } from './idb.js';
import { initPwa } from './pwa.js';
import { API_BASE } from './config.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['welcomeScreen', 'profileScreen', 'dashboardScreen', 'courseScreen', 'pathwayScreen', 'workspaceScreen', 'unlockScreen'];
const DEFAULT_IDLE = { idleMs: 5 * 60 * 1000, warnMs: 30 * 1000, tickMs: 1000 };

let options = DEFAULT_IDLE;
let selectedDevice = 'personal';
let learnerProfile = null;
let vault = null;
let storage = null;
let onboarding = null;
let workspace = null;
let idle = null;

function showToast(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function showScreen(id) {
  SCREENS.forEach((screen) => $(screen)?.classList.toggle('active', screen === id));
}

async function loadVault() {
  if (!vault) vault = await import('./vault.js');
  return vault;
}

async function loadStorage() {
  if (!storage) storage = await import('./storage.js');
  return storage;
}

async function loadOnboarding() {
  if (!onboarding) onboarding = await import('./onboarding.js');
  return onboarding;
}

async function loadWorkspace() {
  if (!workspace) {
    workspace = await import('./workspace.js');
    workspace.bindWorkspace({ notify: showToast });
  }
  return workspace;
}

function setPersistenceNotice(persistent) {
  $('persist-warning').hidden = persistent;
}

async function configureQueue() {
  const queue = await import('./queue.js');
  const pending = await queue.pending();
  const legacy = pending.filter((item) => item.type === 'stage-complete');
  for (const item of legacy) await queue.remove(item.id);
  if (legacy.length) showToast('An older unsynced activity note was removed; new graded work will sync normally.');
  queue.setSender(async (item) => {
    if (!['grade', 'translate'].includes(item.type)) throw new Error('Unsupported queued request');
    const { path, body } = item.payload;
    if (!['/v1/grade/typing', '/v1/grade/excel', '/v1/grade/python', '/v1/translate'].includes(path))
      throw new Error('Unsupported queued endpoint');
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Queued request failed (${response.status})`);
    return response;
  });
  if (navigator.onLine !== false) await queue.flush();
}

async function showDashboard(profile) {
  learnerProfile = {
    ...profile,
    barriers: Array.isArray(profile.barriers) ? profile.barriers : [],
    goals: Array.isArray(profile.goals) ? profile.goals : []
  };
  selectedDevice = learnerProfile.device || 'personal';
  const module = await loadOnboarding();
  const practice = await loadWorkspace();
  practice.setDefaultPath(learnerProfile.recommendation?.primary || 'foundational');
  module.renderDashboard(learnerProfile, (key) => workspace.openPathway(key));
  $('logout').hidden = selectedDevice !== 'shared';
  showScreen('dashboardScreen');
  setPersistenceNotice(vault?.isPersistent() ?? typeof indexedDB !== 'undefined');
  await configureQueue();
  if (selectedDevice === 'shared') await startIdleTimer();
}

async function openProfile() {
  const module = await loadOnboarding();
  if (!openProfile.bound) {
    module.bindOnboarding({
      getDevice: () => selectedDevice,
      onSubmit: submitProfile,
      onLanguageChange: updateLanguage
    });
    openProfile.bound = true;
  }
  showScreen('profileScreen');
}

async function submitProfile(profile, passcode) {
  if (selectedDevice === 'shared' && passcode.length < 6) {
    showToast('Choose a passcode of at least 6 characters.');
    return;
  }
  try {
    const secureStore = await loadVault();
    const status = await secureStore.init();
    if (status === 'new') await secureStore.setup(selectedDevice, passcode);
    else if (status === 'locked') {
      showToast('Unlock this device before changing the learner profile.');
      showUnlock('Enter your passcode to continue.');
      return;
    }
    const profileStorage = await loadStorage();
    await profileStorage.saveProfile(profile);
    await showDashboard(profile);
    showToast(`Your learning journey is ready, ${profile.firstName}.`);
  } catch (error) {
    showToast('Secure profile storage could not be saved. Your information has not been submitted.');
  }
}

async function updateLanguage(language) {
  if (!learnerProfile) return;
  learnerProfile.language = language;
  try {
    const profileStorage = await loadStorage();
    await profileStorage.saveProfile(learnerProfile);
    const module = await loadOnboarding();
    module.renderDashboard(learnerProfile, (key) => workspace?.openPathway(key));
    if (workspace) await workspace.translateCurrent(language);
  } catch (error) {
    showToast('Your language preference could not be saved.');
  }
}

async function showStoredProfile() {
  const secureStore = await loadVault();
  await secureStore.init();
  const profileStorage = await loadStorage();
  const profile = await profileStorage.loadProfile();
  if (profile && typeof profile.firstName === 'string') {
    await showDashboard(profile);
    return;
  }
  setPersistenceNotice(secureStore.isPersistent());
  await openProfile();
}

async function startIdleTimer() {
  if (idle) return;
  const { createIdleTimer } = await import('./idle.js');
  idle = createIdleTimer({
    timeoutMs: options.idleMs,
    warnMs: options.warnMs,
    tickMs: options.tickMs,
    target: document,
    onWarn: () => { $('idle-warning').hidden = false; },
    onActive: () => { $('idle-warning').hidden = true; },
    onTimeout: () => lock('idle')
  });
  idle.start();
}

function clearSensitiveUi() {
  learnerProfile = null;
  $('greeting').textContent = 'Welcome, learner';
  $('recommendationTitle').textContent = '';
  $('recommendationDescription').textContent = '';
  $('recommendationEmoji').textContent = '';
  $('goalCategories').replaceChildren();
  $('rankedPathways').replaceChildren();
  $('firstName').value = '';
  $('surname').value = '';
  $('age').value = '';
  $('prototypeSharedPasscode').value = '';
  $('learnerForm').querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = false; });
  workspace?.clearWorkspace();
  onboarding?.clearProfileView?.();
}

function showUnlock(message = 'Enter your passcode to continue.') {
  clearSensitiveUi();
  $('unlockMessage').textContent = message;
  $('unlockPass').value = '';
  $('logout').hidden = true;
  $('idle-warning').hidden = true;
  showScreen('unlockScreen');
}

async function lock(reason) {
  if (idle) { idle.stop(); idle = null; }
  if (workspace) await workspace.clearWorkspace();
  const secureStore = await loadVault();
  await secureStore.lock();
  showUnlock(reason === 'idle' ? 'You were logged out because of inactivity.' : 'You are logged out.');
}

async function verifyPortfolioFromUrl() {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('portfolio') || url.hash.match(/^#\/?p\/(.+)$/)?.[1];
  if (!token) return;
  if (token.length > 512 || !/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    showToast('This portfolio link is invalid.');
    return;
  }
  try {
    const { verifyPortfolio } = await import('./grading.js');
    const result = await verifyPortfolio(token);
    showToast(result.verified ? `Verified portfolio: ${result.displayName || 'Verified learner'}` : 'Portfolio not found or no longer valid.');
  } catch (error) {
    showToast('Portfolio verification is unavailable offline.');
  }
}

document.querySelectorAll('.choice').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.choice').forEach((choice) => choice.classList.remove('selected'));
    button.classList.add('selected');
    selectedDevice = button.dataset.device;
    const field = $('prototypeSharedPass');
    field.hidden = selectedDevice !== 'shared';
    $('prototypeSharedPasscode').required = selectedDevice === 'shared';
  });
});

$('letsGoBtn').addEventListener('click', openProfile);
$('backToWelcome').addEventListener('click', () => showScreen('welcomeScreen'));
$('logout').addEventListener('click', () => lock('manual'));

$('unlockForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const secureStore = await loadVault();
    const ok = await secureStore.unlock($('unlockPass').value);
    $('unlockPass').value = '';
    if (!ok) {
      $('unlockMessage').textContent = 'That passcode is not right. Try again.';
      return;
    }
    const profileStorage = await loadStorage();
    const profile = await profileStorage.loadProfile();
    if (profile && typeof profile.firstName === 'string') await showDashboard(profile);
    else await openProfile();
  } catch (error) {
    showToast('Secure storage could not be opened.');
  }
});

$('unlockErase').addEventListener('click', async () => {
  if (!confirm('Erase all StepStack data on this device?')) return;
  try {
    const secureStore = await loadVault();
    await secureStore.wipe();
    vault = null;
    selectedDevice = 'personal';
    showScreen('welcomeScreen');
  } catch (error) {
    showToast('Device data could not be erased.');
  }
});

export async function startApp(runtimeOptions = {}) {
  options = { ...DEFAULT_IDLE, ...runtimeOptions };
  initPwa();
  try {
    window.localStorage.removeItem('stepstack:profile:v1');
    window.localStorage.removeItem('stepstack:progress:v1');
  } catch (error) {
    console.warn('StepStack could not remove old plaintext browser data:', error);
  }
  try {
    const meta = await getDeviceMeta('meta', 'device');
    if (!meta) {
      setPersistenceNotice(typeof indexedDB !== 'undefined');
      showScreen('welcomeScreen');
    } else if (meta.mode === 'shared') {
      await loadVault();
      showUnlock();
    } else {
      await showStoredProfile();
    }
  } catch (error) {
    setPersistenceNotice(false);
    showScreen('welcomeScreen');
  }
  await verifyPortfolioFromUrl();
}
