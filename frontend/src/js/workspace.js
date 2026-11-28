import { PATHWAYS } from './config.js';
import { gradeExercise, translateText } from './grading.js';
import { TYPING_STAGES, canPlayStage, newTypingProgress, normalizeTypingProgress, recordTypingAttempt } from './typing-game.js';

const $ = (id) => document.getElementById(id);
let selectedPath = 'foundational';
let activeExercise = null;
let startedAt = 0;
let savedProgress = null;
let typingProgress = null;
let typingGameActive = false;
let typingStageSelect = null;

const PRACTICE = {
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
  return {
    ...practice,
    prompt: PRACTICE_COPY[pathKey].prompt,
    hint: PRACTICE_COPY[pathKey].hint
  };
}

async function loadProgress() {
  if (savedProgress) return savedProgress;
  const storage = await import('./storage.js');
  savedProgress = await storage.loadProgress() || {};
  return savedProgress;
}

async function openTypingFoundation() {
  const allProgress = await loadProgress();
  typingProgress = normalizeTypingProgress(allProgress.typingFoundation);
  typingGameActive = true;
  const prompt = $('practicePrompt');
  if (!typingStageSelect) {
    const label = document.createElement('label');
    label.htmlFor = 'typingStageSelect';
    label.id = 'typingStageLabel';
    label.textContent = 'Choose an unlocked stage';
    typingStageSelect = document.createElement('select');
    typingStageSelect.id = 'typingStageSelect';
    typingStageSelect.setAttribute('aria-labelledby', label.id);
    prompt.before(label, typingStageSelect);
    typingStageSelect.addEventListener('change', renderTypingStage);
  }
  typingStageSelect.replaceChildren(...TYPING_STAGES.map((stage, index) => {
    const number = index + 1;
    const option = document.createElement('option');
    option.value = String(number);
    option.textContent = `Stage ${number}: ${stage.title}${typingProgress.stages[number]?.passed ? ' · passed' : ''}`;
    option.disabled = !canPlayStage(typingProgress, number);
    return option;
  }));
  typingStageSelect.value = String(typingProgress.unlockedStage);
  $('practiceTitle').textContent = 'Typing Foundation';
  document.querySelector('.practice-panel .eyebrow').textContent = 'TYPING GAME';
  document.querySelector('.practice-panel .eyebrow').hidden = false;
  $('practiceTitle').hidden = false;
  $('practiceHint').hidden = false;
  $('practicePrompt').hidden = false;
  $('practiceAnswer').hidden = false;
  $('practiceAnswer').value = '';
  $('practiceAnswer').placeholder = 'Type the text shown above';
  $('practiceAnswer').spellcheck = false;
  $('gradePractice').hidden = false;
  $('practiceFeedback').hidden = false;
  document.querySelector('.practice-panel label[for="practiceAnswer"]').hidden = false;
  renderTypingStage();
  showScreen('workspaceScreen');
}

function renderTypingStage() {
  const number = Number(typingStageSelect.value);
  const stage = TYPING_STAGES[number - 1];
  const attempts = typingProgress.stages[number]?.attempts || [];
  const best = attempts.reduce((a, b) => a.accuracy >= b.accuracy ? a : b, { accuracy: 0, wpm: 0 });
  $('practiceTitle').textContent = `Stage ${number}: ${stage.title}`;
  $('practicePrompt').textContent = stage.text;
  $('practicePrompt').classList.add('typing-target');
  $('practiceHint').textContent = `${number} of 10 · Pass at ${stage.minAccuracy}% accuracy and ${stage.minWpm} WPM.${attempts.length ? ` ${attempts.length} attempt${attempts.length === 1 ? '' : 's'} · Best ${best.accuracy}% (${best.wpm} WPM).` : ''}`;
  $('practiceAnswer').value = '';
  $('practiceFeedback').textContent = '';
  $('practiceFeedback').dataset.state = '';
  $('gradePractice').textContent = 'Check typing';
  startedAt = Date.now();
}

function closeTypingGame() {
  typingGameActive = false;
  typingProgress = null;
  typingStageSelect?.previousElementSibling?.remove();
  typingStageSelect?.remove();
  typingStageSelect = null;
  $('practicePrompt').classList.remove('typing-target');
}

async function openLesson(pathKey, index) {
  const path = PATHWAYS[pathKey];
  if (!path) return;
  if (pathKey === 'foundational' && index === 0) {
    await openTypingFoundation();
    return;
  }
  closeTypingGame();
  ['practiceTitle', 'practicePrompt', 'practiceHint', 'practiceAnswer', 'gradePractice', 'practiceFeedback']
    .forEach((id) => { if ($(id)) $(id).hidden = false; });
  document.querySelector('.practice-panel .eyebrow').hidden = false;
  document.querySelector('.practice-panel label[for="practiceAnswer"]').hidden = false;
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

export async function openPathway(key) {
  const path = PATHWAYS[key];
  if (!path) return;
  selectedPath = key;
  const progress = key === 'foundational'
    ? normalizeTypingProgress((await loadProgress()).typingFoundation || newTypingProgress()) : null;
  $('pathTitle').textContent = path.title;
  $('pathEmoji').textContent = path.emoji;
  $('pathDescription').textContent = path.description;
  $('lessonCount').textContent = `${path.lessons.length} lessons`;
  const list = $('pathLessonList');
  list.replaceChildren();
  path.lessons.forEach((lesson, index) => {
    const locked = key === 'foundational' && index === 1 && !progress.completed;
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
    time.textContent = index === 0 && key === 'foundational'
      ? `${Object.values(progress.stages).filter((stage) => stage.passed).length}/10 stages passed`
      : locked ? 'Complete all 10 typing stages to unlock' : `Beginner · ${5 + index} minutes`;
    main.append(title, time);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lesson-play';
    button.setAttribute('aria-label', `Open ${lesson}`);
    button.textContent = '▶';
    button.disabled = locked;
    if (locked) button.setAttribute('aria-label', `${lesson}, locked until all 10 typing stages are passed`);
    button.addEventListener('click', () => openLesson(key, index));
    row.append(number, main, button);
    list.append(row);
  });
  if (key === 'foundational') {
    const passed = Object.values(progress.stages).filter((stage) => stage.passed).length;
    const percent = Math.round(passed / TYPING_STAGES.length * 100);
    $('pathProgressValue').textContent = `${passed}/10`;
    $('pathProgressBar').style.width = `${percent}%`;
  }
  $('startPathLesson').textContent = key === 'foundational' && progress.completed
    ? 'Replay Typing Foundation ↻' : key === 'foundational' ? 'Resume Typing Foundation ▶' : 'Start first lesson ▶';
  showScreen('pathwayScreen');
}

export function setDefaultPath(key) {
  if (PATHWAYS[key]) selectedPath = key;
}

async function gradeCurrentAnswer() {
  if (!activeExercise && !typingGameActive) return;
  const button = $('gradePractice');
  button.disabled = true;
  if (typingGameActive) $('practiceFeedback').textContent = '';
  try {
    const elapsed = Math.max(1000, Date.now() - startedAt);
    const stageNumber = Number(typingStageSelect?.value);
    const stage = typingGameActive ? TYPING_STAGES[stageNumber - 1] : null;
    const result = typingGameActive ? await gradeExercise(
      'typing', stage.id, $('practiceAnswer').value, elapsed, stage
    ) : await gradeExercise(
      activeExercise.kind,
      activeExercise.id,
      $('practiceAnswer').value,
      elapsed
    );
    if (typingGameActive) {
      if (!canPlayStage(typingProgress, stageNumber)) throw new Error('stage-locked');
      const attempt = {
        id: `${stage.id}-${Date.now().toString(36)}-${(typingProgress.stages[stageNumber]?.attempts?.length || 0) + 1}`,
        at: new Date().toISOString(), durationMs: elapsed,
        accuracy: result.accuracy || 0, wpm: result.wpm || 0,
        passed: result.passed === true, source: result.source, pending: result.pending === true
      };
      typingProgress = recordTypingAttempt(typingProgress, stageNumber, attempt);
      savedProgress = { ...savedProgress, typingFoundation: typingProgress };
      const storage = await import('./storage.js');
      await storage.saveProgress(savedProgress);
      typingStageSelect.replaceChildren(...TYPING_STAGES.map((item, index) => {
        const number = index + 1;
        const option = document.createElement('option');
        option.value = String(number);
        option.textContent = `Stage ${number}: ${item.title}${typingProgress.stages[number]?.passed ? ' · passed' : ''}`;
        option.disabled = !canPlayStage(typingProgress, number);
        return option;
      }));
      if (attempt.passed && stageNumber < TYPING_STAGES.length) typingStageSelect.value = String(stageNumber + 1);
      renderTypingStage();
      $('practiceFeedback').textContent = attempt.passed
        ? `Stage ${stageNumber} passed: ${attempt.wpm} WPM, ${attempt.accuracy}% accuracy.${attempt.pending ? ' Saved to sync when online.' : ''}`
        : `Not yet: ${attempt.wpm} WPM, ${attempt.accuracy}% accuracy. Try again to meet both targets.`;
      $('practiceFeedback').dataset.state = attempt.passed ? 'ok' : 'bad';
      return;
    }
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
    const practice = PRACTICE[selectedPath];
    openLesson(selectedPath in PRACTICE ? selectedPath : 'foundational', practice?.index ?? 0);
  });
  $('backFromPathway').addEventListener('click', () => showScreen('dashboardScreen'));
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
  savedProgress = null;
  closeTypingGame();
  ['practiceAnswer', 'practiceTitle', 'practicePrompt', 'practiceHint', 'practiceFeedback'].forEach((id) => {
    if ($(id)) {
      if ('value' in $(id)) $(id).value = '';
      else $(id).textContent = '';
      $(id).hidden = false;
    }
  });
}
