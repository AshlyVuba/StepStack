import { PATHWAYS } from './config.js';

const $ = (id) => document.getElementById(id);
const GREETINGS = { en: 'Welcome', zu: 'Sawubona', xh: 'Molo', af: 'Welkom', st: 'Dumela', tn: 'Dumela', nso: 'Thobela', ts: 'Avuxeni', ss: 'Sawubona', ve: 'Ndaa', nr: 'Lotjhani' };
const WEIGHTS = { 'first-step': { foundational: 6 }, 'english-friction': { foundational: 4, upskill: 2 }, 'passive-video': { developer: 3, upskill: 3, foundational: 1 }, 'fragmented-tools': { upskill: 4, foundational: 2 } };
const ACTIVITIES = {
  'first-step': ['⌨️', 'Try a typing warm-up', 'Build speed with a short hands-on activity.'],
  'english-friction': ['🌍', 'Explore language-supported learning', 'Switch between all 11 official SA language packs offline.'],
  'passive-video': ['✋', 'Complete a hands-on activity', 'Practise by doing instead of only watching.'],
  'fragmented-tools': ['🔗', 'Follow one guided step', 'Complete a focused activity inside StepStack.']
};

export function recommend(p) {
  const s = Object.fromEntries(Object.keys(PATHWAYS).map((k) => [k, 0]));
  (p.barriers || []).forEach((b) => Object.entries(WEIGHTS[b] || {}).forEach(([k, n]) => { s[k] += n; }));
  (p.goals || []).forEach((g) => { if (Object.hasOwn(s, g)) s[g] += 5; });
  if (p.education === 'Currently working') s.workplace += 4;
  if (['Primary school', 'High school'].includes(p.education)) s.foundational += 2;
  if (p.education === 'Skills programme / bootcamp') s.upskill += 3;
  const ranked = Object.entries(s).sort((a, b) => b[1] - a[1]);
  return { primary: ranked[0][0], ranked };
}

export function renderDashboard(p, onOpen) {
  const rec = p.recommendation || recommend(p); p.recommendation = rec;
  const primary = PATHWAYS[rec.primary] || PATHWAYS.foundational;
  $('greeting').textContent = `${GREETINGS[p.language] || 'Welcome'}, ${p.firstName} 👋`;
  $('recommendationTitle').textContent = primary.title;
  $('recommendationDescription').textContent = primary.description;
  $('recommendationEmoji').textContent = primary.emoji;
  $('recommendedPathBtn').dataset.path = rec.primary;
  $('choiceCount').textContent = `${p.goals.length} ${p.goals.length === 1 ? 'goal' : 'goals'} selected`;

  const goals = $('goalCategories'); goals.replaceChildren();
  if (!p.goals.length) {
    const empty = document.createElement('p'); empty.className = 'muted'; empty.textContent = 'Explore all five pathways below.'; goals.append(empty);
  } else p.goals.forEach((g) => {
    const path = PATHWAYS[g]; if (!path) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'goal-category'; b.dataset.path = g;
    b.append(document.createTextNode(`${path.emoji} ${path.title}`));
    b.addEventListener('click', () => onOpen(g)); goals.append(b);
  });

  const ranked = $('rankedPathways'); ranked.replaceChildren();
  rec.ranked.forEach(([k, score], i) => {
    const path = PATHWAYS[k]; if (!path) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = `ranked-pathway${i === 0 ? ' ranked-primary' : ''}`; b.dataset.path = k;
    b.append(document.createTextNode(`${path.emoji} ${path.title} · ${score}`));
    b.addEventListener('click', () => onOpen(k)); ranked.append(b);
  });
  $('headerXp').textContent = $('pointsValue').textContent = `${p.xp || 0} XP`;
  $('lessonsValue').textContent = `${p.completedLessons || 0} ${p.completedLessons === 1 ? 'lesson' : 'lessons'}`;

  const [icon, title, desc] = ACTIVITIES[p.barriers[0]] || ['🚀', 'Start your first 5-minute step', 'Choose a pathway and complete a hands-on lesson.'];
  $('activityIcon').textContent = icon; $('activityTitle').textContent = title; $('activityDescription').textContent = desc;
}

export function bindOnboarding({ onSubmit, onLanguageChange, getDevice }) {
  $('learnerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new window.FormData(e.currentTarget);
    const profile = {
      firstName: String(d.get('firstName') || '').trim(), surname: String(d.get('surname') || '').trim(),
      age: Number(d.get('age')), education: String(d.get('education') || ''),
      barriers: d.getAll('barriers').map(String), goals: d.getAll('goals').map(String),
      device: getDevice(), language: $('language').value || 'en', xp: 120, completedLessons: 0, streak: 0
    };
    profile.recommendation = recommend(profile);
    await onSubmit(profile, $('prototypeSharedPasscode').value);
  });
  $('language').addEventListener('change', (e) => onLanguageChange(e.currentTarget.value));
}

export function clearProfileView() {
  $('choiceCount').textContent = '0 goals selected';
  ['activityIcon', 'activityTitle', 'activityDescription', 'headerXp', 'pointsValue', 'lessonsValue'].forEach((id) => { $(id).textContent = ''; });
}
