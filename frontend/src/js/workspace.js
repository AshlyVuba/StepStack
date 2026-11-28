import { PATHWAYS, EXERCISE_MAP } from './config.js';
import { gradeExercise, translateText } from './grading.js';

const $ = (id) => document.getElementById(id);
let selectedPath = 'foundational';
let activeExercise = null;
let startedAt = 0;

const PRACTICE = {
  foundational: { index: 0, kind: 'typing', id: 'typing-warmup' },
  workplace: { index: 2, kind: 'excel', id: 'w1' },
  developer: { index: 4, kind: 'python', id: 'd1' }
};
const PRACTICE_COPY = {
  workplace: {
    prompt: 'Enter the formula in cell B6 to total the sales in B1:B5.',
    hint: 'Use SUM over B1:B5. Example shape: =SUM(B1:B5)'
  },
  developer: {
    prompt: 'Write sum_even(numbers) to return the sum of all even numbers in a list.',
    hint: 'Use a loop or a sum expression; empty lists should return 0.'
  }
};

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.toggle('active', screen.id === id);
  });
}

function localExercise(pathKey) {
  const practice = PRACTICE[pathKey];
  if (!practice) return null;
  if (practice.kind === 'typing') {
    const target = EXERCISE_MAP.typing[practice.id].target;
    return {
      ...practice,
      prompt: `Type this sentence as quickly and accurately as you can:\n${target}`,
      hint: 'Use your own keyboard; pasting is not counted by the server.'
    };
  }
  return {
    ...practice,
    prompt: PRACTICE_COPY[pathKey].prompt,
    hint: PRACTICE_COPY[pathKey].hint
  };
}

function openLesson(pathKey, index) {
  const path = PATHWAYS[pathKey];
  if (!path) return;
  const practice = PRACTICE[pathKey];
  if (!practice || practice.index !== index) {
    $('practiceTitle').textContent = path.lessons[index];
    $('practicePrompt').textContent = 'This lesson is part of the learning path. Interactive practice for it is coming soon.';
    $('practiceHint').textContent = '';
    $('practiceAnswer').hidden = true;
    $('gradePractice').hidden = true;
    $('practiceFeedback').textContent = '';
    showScreen('workspaceScreen');
    activeExercise = null;
    return;
  }
  activeExercise = localExercise(pathKey);
  $('practiceTitle').textContent = path.lessons[index];
  $('practicePrompt').textContent = activeExercise.prompt;
  $('practiceHint').textContent = activeExercise.hint;
  $('practiceAnswer').hidden = false;
  $('practiceAnswer').value = '';
  $('practiceAnswer').placeholder = activeExercise.kind === 'python' ? 'Write your code here' : 'Enter your answer';
  $('gradePractice').hidden = false;
  $('practiceFeedback').textContent = '';
  startedAt = Date.now();
  showScreen('workspaceScreen');
}

export function openPathway(key) {
  const path = PATHWAYS[key];
  if (!path) return;
  selectedPath = key;
  $('pathTitle').textContent = path.title;
  $('pathEmoji').textContent = path.emoji;
  $('pathDescription').textContent = path.description;
  $('lessonCount').textContent = `${path.lessons.length} lessons`;
  const list = $('pathLessonList');
  list.replaceChildren();
  path.lessons.forEach((lesson, index) => {
    const row = document.createElement('div');
    row.className = 'lesson';
    const number = document.createElement('div');
    number.className = 'lesson-num';
    number.textContent = String(index + 1).padStart(2, '0');
    const main = document.createElement('div');
    main.className = 'lesson-main';
    const title = document.createElement('strong');
    title.textContent = lesson;
    const time = document.createElement('small');
    time.textContent = `Beginner · ${5 + index} minutes`;
    main.append(title, time);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lesson-play';
    button.setAttribute('aria-label', `Open ${lesson}`);
    button.textContent = '▶';
    button.addEventListener('click', () => openLesson(key, index));
    row.append(number, main, button);
    list.append(row);
  });
  showScreen('pathwayScreen');
}

export function setDefaultPath(key) {
  if (PATHWAYS[key]) selectedPath = key;
}

async function gradeCurrentAnswer() {
  if (!activeExercise) return;
  const button = $('gradePractice');
  button.disabled = true;
  try {
    const elapsed = Math.max(1000, Date.now() - startedAt);
    const result = await gradeExercise(
      activeExercise.kind,
      activeExercise.id,
      $('practiceAnswer').value,
      elapsed
    );
    $('practiceFeedback').textContent = result.feedback || (
      result.passed ? 'Correct! Well done.' : result.source === 'server' ? 'Not quite. Try again.' : 'Not quite. Try again.'
    );
    $('practiceFeedback').dataset.state = result.passed ? 'ok' : 'bad';
  } catch (error) {
    $('practiceFeedback').textContent = 'Your answer could not be checked. Please try again.';
    $('practiceFeedback').dataset.state = 'bad';
  } finally {
    button.disabled = false;
  }
}

export async function translateCurrent(language) {
  if (!activeExercise || !['zu', 'xh', 'st', 'tn', 'af'].includes(language)) return;
  try {
    const translated = await translateText(activeExercise.prompt, language);
    if (!translated.queued) $('practicePrompt').textContent = translated.translation;
  } catch (error) {
    $('practiceFeedback').textContent = 'Translation is unavailable right now; the original lesson is still available.';
  }
}

export function bindWorkspace({ notify }) {
  document.querySelectorAll('.pathway-card').forEach((button) => {
    button.addEventListener('click', () => openPathway(button.dataset.path));
  });
  document.querySelectorAll('.goal-category, .ranked-pathway').forEach((button) => {
    button.addEventListener('click', () => openPathway(button.dataset.path));
  });
  $('recommendedPathBtn').addEventListener('click', (event) => openPathway(event.currentTarget.dataset.path));
  $('dailyBtn').addEventListener('click', () => openPathway(selectedPath));
  $('startPathLesson').addEventListener('click', () => {
    const practice = PRACTICE[selectedPath];
    openLesson(selectedPath, practice ? practice.index : 0);
  });
  $('activityBtn').addEventListener('click', () => {
    const practice = PRACTICE[selectedPath] || PRACTICE.foundational;
    openLesson(selectedPath in PRACTICE ? selectedPath : 'foundational', practice.index);
  });
  $('backFromPathway').addEventListener('click', () => showScreen('dashboardScreen'));
  $('backToDashboard').addEventListener('click', () => showScreen('dashboardScreen'));
  $('backToPathway').addEventListener('click', () => openPathway(selectedPath));
  $('gradePractice').addEventListener('click', gradeCurrentAnswer);
  $('viewAllBtn').addEventListener('click', () => notify('Choose any pathway below to explore its lessons.'));
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach((nav) => nav.classList.remove('active'));
      button.classList.add('active');
      notify(`StepStack: ${button.dataset.nav}`);
    });
  });
}

export function clearWorkspace() {
  activeExercise = null;
  $('practiceAnswer').value = '';
  $('practiceTitle').textContent = '';
  $('practicePrompt').textContent = '';
  $('practiceHint').textContent = '';
  $('practiceFeedback').textContent = '';
  $('practiceFeedback').dataset.state = '';
}
