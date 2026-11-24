import { LANGUAGES } from './config.js';
import { loadProgress, saveProgress } from './storage.js';
import { EXERCISES, UI } from './exercises.js';
import { grade } from './grading.js';

// Security: all learner input and translated text is written with textContent
// or .value only. Never assign HTML strings (enforced by scripts/check-guardrails.js).

const $ = (id) => document.getElementById(id);
const ws = $('workspace');
let s = null;            // { tier, lang, profileLang, stage, done, drafts }
let list = [];
let feedbackKey = '';

const nativeName = (code) => (LANGUAGES.find((l) => l.code === code) || {}).native || code;
const t = (key) => UI[s.lang][key];
const fill = (str, vars) => str.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
const persist = () => saveProgress(s);
const current = () => list[s.stage];
const field = () => (current().minLength ? $('ws-textarea') : $('ws-input'));
const doneCount = () => list.filter((e) => s.done[e.id]).length;
const unlocked = (i) => i === 0 || Boolean(s.done[list[i - 1].id]);

function renderText() {
  document.documentElement.lang = s.lang;
  ws.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $('ws-langs').querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.code === s.lang));
  });
  const ex = current();
  const copy = ex.text[s.lang];
  $('ws-kicker').textContent = t('stages')[s.stage];
  $('ws-title').textContent = copy.title;
  $('ws-body').textContent = copy.body;
  $('ws-hint').textContent = copy.hint;
  $('ws-stages').querySelectorAll('button').forEach((b, i) => {
    b.textContent = fill(t('stageN'), { n: i + 1 });
  });
  $('ws-progress-text').textContent = fill(t('progress'), { n: doneCount(), total: list.length });
  $('ws-feedback').textContent = feedbackKey ? t(feedbackKey) : '';
  $('ws-feedback').dataset.state = feedbackKey === 'incorrect' || feedbackKey === 'empty' ? 'bad' : feedbackKey ? 'ok' : '';
}

function renderState() {
  $('ws-progress').max = list.length;
  $('ws-progress').value = doneCount();
  $('ws-stages').querySelectorAll('button').forEach((b, i) => {
    b.disabled = !unlocked(i);
    b.classList.toggle('done', Boolean(s.done[list[i].id]));
    if (i === s.stage) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
  $('ws-next').hidden = !(s.done[current().id] && s.stage < list.length - 1);
}

function render() { renderText(); renderState(); }

function showStage(i) {
  s.stage = i;
  feedbackKey = s.done[current().id] ? 'correct' : '';
  $('ws-hint').hidden = true;
  const multi = Boolean(current().minLength);
  $('ws-textarea').hidden = !multi;
  $('ws-input').hidden = multi;
  $('ws-answer-label').htmlFor = field().id;
  field().value = s.drafts[current().id] || '';
  persist();
  render();
}

// Switching language only rewrites text. The answer field, drafts and
// completion state are untouched, so no progress is lost mid-exercise.
function setLang(code) {
  if (!UI[code]) return;
  s.lang = code;
  persist();
  render();
}

function check() {
  const value = field().value;
  if (!value.trim()) feedbackKey = 'empty';
  else if (grade(current(), value)) {
    s.done[current().id] = true;
    feedbackKey = doneCount() === list.length ? 'allDone' : 'correct';
  } else feedbackKey = 'incorrect';
  persist();
  render();
}

function buildControls() {
  const langs = $('ws-langs');
  langs.replaceChildren(...Object.keys(UI).map((code) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.code = code;
    b.textContent = nativeName(code);
    b.addEventListener('click', () => setLang(code));
    return b;
  }));
  $('ws-stages').replaceChildren(...list.map((_, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.addEventListener('click', () => { if (unlocked(i)) showStage(i); });
    li.append(b);
    return li;
  }));
}

function start(profile) {
  list = EXERCISES[profile.tier];
  if (!list) return;
  const saved = loadProgress();
  s = saved && saved.tier === profile.tier
    ? saved
    : { tier: profile.tier, lang: profile.language, profileLang: profile.language, stage: 0, done: {}, drafts: {} };
  if (s.profileLang !== profile.language) { s.lang = profile.language; s.profileLang = profile.language; }
  if (!UI[s.lang]) s.lang = 'en';            // chosen language has no content yet
  const firstOpen = list.findIndex((e) => !s.done[e.id]);
  const stage = firstOpen === -1 ? list.length - 1 : Math.min(s.stage || 0, firstOpen);
  $('onboarding').hidden = true;
  $('welcome').hidden = true;
  ws.hidden = false;
  buildControls();
  showStage(stage);
}

$('ws-check').addEventListener('click', check);
$('ws-next').addEventListener('click', () => showStage(s.stage + 1));
$('ws-hint-btn').addEventListener('click', () => { $('ws-hint').hidden = !$('ws-hint').hidden; });
['ws-input', 'ws-textarea'].forEach((id) => $(id).addEventListener('input', (e) => {
  s.drafts[current().id] = e.target.value;
  persist();
}));
$('ws-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } });

document.addEventListener('stepstack:onboarded', (e) => start(e.detail));