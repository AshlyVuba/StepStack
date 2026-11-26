// Async facade over the encrypted vault. Learner data (profile, progress,
// drafts) is never written to localStorage, sessionStorage or cookies.
import * as vault from './vault.js';

const ok = (p) => p.then(() => true, () => false);

export const loadProfile = () => vault.load('profile');
export const saveProfile = (profile) => ok(vault.save('profile', profile));
export const clearProfile = () => ok(vault.remove('profile'));
export const loadProgress = () => vault.load('progress');
export const saveProgress = (progress) => ok(vault.save('progress', progress));

// Earlier prototypes kept plaintext data in localStorage. Delete it on startup.
export function removeLegacyData() {
  try {
    localStorage.removeItem('stepstack:profile:v1');
    localStorage.removeItem('stepstack:progress:v1');
  } catch (e) { /* storage unavailable: nothing to remove */ }
}