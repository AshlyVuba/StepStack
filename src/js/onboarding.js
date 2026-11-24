import { TIERS, LEVELS, LANGUAGES } from './config.js';
import { loadProfile, saveProfile, clearProfile } from './storage.js';

const $ = (id) => document.getElementById(id);
const form = $('onboarding');
const welcome = $('welcome');
const steps = [...form.querySelectorAll('fieldset')];
const FIELDS = ['tier', 'level', 'language'];
const find = (list, key, val) => list.find((x) => x[key] === val);

let profile = loadProfile() || {};
let step = 0;

function render(container, name, items, labelOf, hintOf, keyName) {
  const frag = document.createDocumentFragment();
  items.forEach((item) => {
    const value = item[keyName];
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = value;
    input.checked = profile[name] === value;
    const text = document.createElement('span');
    text.textContent = labelOf(item);
    label.append(input, text);
    const hint = hintOf(item);
    if (hint) {
      const small = document.createElement('small');
      small.textContent = hint;
      label.append(small);
    }
    frag.append(label);
  });
  container.replaceChildren(frag);
}

function buildOptions() {
  render($('opts-tier'), 'tier', TIERS, (t) => t.label, (t) => t.hint, 'id');
  render($('opts-level'), 'level', LEVELS, (l) => l.label, (l) => l.hint, 'id');
  render($('opts-lang'), 'language', LANGUAGES, (l) => l.native, () => '', 'code');
}

function show(n) {
  step = n;
  steps.forEach((s, i) => { s.hidden = i !== n; });
  $('progress').value = n + 1;
  $('back').hidden = n === 0;
  $('done').hidden = !(n === steps.length - 1 && profile.language);
  const checked = steps[n].querySelector('input:checked') || steps[n].querySelector('input');
  if (checked) checked.focus({ preventScroll: true });
}

function firstIncomplete() {
  const i = FIELDS.findIndex((f) => !profile[f]);
  return i === -1 ? FIELDS.length - 1 : i;
}

function describe() {
  const tier = find(TIERS, 'id', profile.tier);
  const level = find(LEVELS, 'id', profile.level);
  const lang = find(LANGUAGES, 'code', profile.language);
  return `${tier.label} · ${level.label} · ${lang.native}`;
}

function isComplete() {
  return FIELDS.every((f) => profile[f]) &&
    find(TIERS, 'id', profile.tier) && find(LEVELS, 'id', profile.level) &&
    find(LANGUAGES, 'code', profile.language);
}

function showForm() {
  welcome.hidden = true;
  form.hidden = false;
  buildOptions();
  show(firstIncomplete());
}

function showWelcome() {
  form.hidden = true;
  welcome.hidden = false;
  document.documentElement.lang = profile.language;
  $('summary').textContent = describe();
  $('continue').focus({ preventScroll: true });
}

// Selecting an option saves immediately (survives reloads mid-flow) and
// auto-advances so the whole flow is three taps.
form.addEventListener('change', (e) => {
  const { name, value } = e.target;
  if (!FIELDS.includes(name)) return;
  profile = { ...profile, [name]: value };
  saveProfile(profile);
  if (step < steps.length - 1) show(step + 1);
  else $('done').hidden = false;
});

$('back').addEventListener('click', () => show(Math.max(0, step - 1)));

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!isComplete()) return show(firstIncomplete());
  profile = { ...profile, completedAt: new Date().toISOString() };
  saveProfile(profile);
  showWelcome();
});

$('restart').addEventListener('click', () => { profile = {}; clearProfile(); showForm(); });

// Hands the learner profile to the exercise workspace (workspace.js).
$('continue').addEventListener('click', () => {
  welcome.hidden = true;
  document.dispatchEvent(new CustomEvent('stepstack:onboarded', { detail: profile }));
});

if (profile.completedAt && isComplete()) showWelcome(); else showForm();