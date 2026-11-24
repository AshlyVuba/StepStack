// Persists the learner profile. Works even if localStorage is blocked
// (private mode, full quota) by falling back to memory for the session.
const KEY = 'stepstack:profile:v1';
let memory = null;

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* unavailable or corrupt: fall through */ }
  return memory;
}

export function saveProfile(profile) {
  memory = profile;
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* keep memory copy */ }
}

export function clearProfile() {
  memory = null;
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}