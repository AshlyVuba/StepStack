import { PATHWAYS } from './config.js';

const $ = (id) => document.getElementById(id);
const GREETINGS = {
  en: 'Welcome', zu: 'Sawubona', xh: 'Molo', af: 'Welkom',
  st: 'Dumela', tn: 'Dumela', nso: 'Thobela', ts: 'Avuxeni',
  ss: 'Sawubona', ve: 'Ndaa', nr: 'Lotjhani'
};

const BARRIER_WEIGHTS = {
  'first-step': { foundational: 6 },
  'english-friction': { foundational: 4, upskill: 2 },
  'passive-video': { developer: 3, upskill: 3, foundational: 1 },
  'fragmented-tools': { upskill: 4, foundational: 2 }
};

export function recommend(profile) {
  const scores = Object.fromEntries(Object.keys(PATHWAYS).map((key) => [key, 0]));
  (profile.barriers || []).forEach((barrier) => {
    Object.entries(BARRIER_WEIGHTS[barrier] || {}).forEach(([key, points]) => { scores[key] += points; });
  });
  (profile.goals || []).forEach((goal) => { if (Object.hasOwn(scores, goal)) scores[goal] += 5; });
  if (profile.education === 'Currently working') scores.workplace += 4;
  if (['Primary school', 'High school'].includes(profile.education)) scores.foundational += 2;
  if (profile.education === 'Skills programme / bootcamp') scores.upskill += 3;
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return { primary: ranked[0][0], ranked };
}

function appendGoal(container, goal, onOpen) {
  const path = PATHWAYS[goal];
  if (!path) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'goal-category';
  button.dataset.path = goal;
  button.append(document.createTextNode(`${path.emoji} ${path.title}`));
  button.addEventListener('click', () => onOpen(goal));
  container.append(button);
}

export function renderDashboard(profile, onOpenPathway) {
  const recommendation = profile.recommendation || recommend(profile);
  profile.recommendation = recommendation;
  const primary = PATHWAYS[recommendation.primary] || PATHWAYS.foundational;
  $('greeting').textContent = `${GREETINGS[profile.language] || 'Welcome'}, ${profile.firstName} 👋`;
  $('recommendationTitle').textContent = primary.title;
  $('recommendationDescription').textContent = primary.description;
  $('recommendationEmoji').textContent = primary.emoji;
  $('recommendedPathBtn').dataset.path = recommendation.primary;
  $('choiceCount').textContent = `${profile.goals.length} ${profile.goals.length === 1 ? 'goal' : 'goals'} selected`;

  const goals = $('goalCategories');
  goals.replaceChildren();
  if (!profile.goals.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Explore all five pathways below.';
    goals.append(empty);
  } else profile.goals.forEach((goal) => appendGoal(goals, goal, onOpenPathway));

  const ranked = $('rankedPathways');
  ranked.replaceChildren();
  recommendation.ranked.forEach(([key, score], index) => {
    const path = PATHWAYS[key];
    if (!path) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `ranked-pathway${index === 0 ? ' ranked-primary' : ''}`;
    button.dataset.path = key;
    button.append(document.createTextNode(`${path.emoji} ${path.title} · ${score}`));
    button.addEventListener('click', () => onOpenPathway(key));
    ranked.append(button);
  });
  $('headerXp').textContent = `${profile.xp || 0} XP`;
  $('pointsValue').textContent = `${profile.xp || 0} XP`;
  $('lessonsValue').textContent = `${profile.completedLessons || 0} ${profile.completedLessons === 1 ? 'lesson' : 'lessons'}`;

  const activity = {
    'first-step': ['⌨️', 'Try a typing warm-up', 'Build speed and confidence with a short hands-on activity.'],
    'english-friction': ['🌍', 'Explore language-supported learning', 'Choose one of the supported South African languages.'],
    'passive-video': ['✋', 'Complete a hands-on activity', 'Learn by doing instead of only watching a tutorial.'],
    'fragmented-tools': ['🔗', 'Follow one guided step', 'Complete a focused activity inside StepStack.']
  }[profile.barriers[0]] || ['🚀', 'Start your first 5-minute step', 'Choose a pathway and complete a short hands-on lesson.'];
  $('activityIcon').textContent = activity[0];
  $('activityTitle').textContent = activity[1];
  $('activityDescription').textContent = activity[2];
}

export function bindOnboarding({ onSubmit, onLanguageChange, getDevice }) {
  $('learnerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new window.FormData(event.currentTarget);
    const profile = {
      firstName: String(data.get('firstName') || '').trim(),
      surname: String(data.get('surname') || '').trim(),
      age: Number(data.get('age')),
      education: String(data.get('education') || ''),
      barriers: data.getAll('barriers').map(String),
      goals: data.getAll('goals').map(String),
      device: getDevice(),
      language: $('language').value || 'en',
      xp: 120,
      completedLessons: 0,
      streak: 0
    };
    profile.recommendation = recommend(profile);
    await onSubmit(profile, $('prototypeSharedPasscode').value);
  });

  $('language').addEventListener('change', (event) => onLanguageChange(event.currentTarget.value));
}

export function clearProfileView() {
  $('choiceCount').textContent = '0 goals selected';
  $('activityIcon').textContent = '';
  $('activityTitle').textContent = '';
  $('activityDescription').textContent = '';
  $('headerXp').textContent = '';
  $('pointsValue').textContent = '';
  $('lessonsValue').textContent = '';
}
