// Async facade over the encrypted vault. Learner data (profile, progress,
// drafts) is never written to localStorage, sessionStorage or cookies.
import * as vault from './vault.js';

export const loadProfile = () => vault.load('profile');
export const saveProfile = (profile) => vault.save('profile', profile);
export const loadProgress = () => vault.load('progress');
export const saveProgress = (progress) => vault.save('progress', progress);