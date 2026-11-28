const stageData = [
  ['Home row keys', 'asdf jkl; asdf jkl;', 5, 90],
  ['Home row patterns', 'sad lad; ask a flask', 6, 90],
  ['Top row keys', 'qwerty uiop qwerty', 8, 90],
  ['Bottom row keys', 'zxcv bnm, zxcv bnm.', 10, 90],
  ['Short words', 'the cat can type', 12, 92],
  ['Everyday sentence', 'I like to learn new skills.', 15, 92],
  ['Build a sentence', 'A keyboard helps me share my ideas.', 17, 92],
  ['Digital words', 'computer keyboard mouse screen', 18, 95],
  ['Computer task', 'Save your file, then open a new tab.', 20, 95],
  ['Final combined check', 'Type, check, and save your digital work with care.', 22, 95]
];

export const TYPING_STAGES = stageData.map(([title, text, minWpm, minAccuracy], i) => ({
  id: `typing-foundation-${String(i + 1).padStart(2, '0')}`, title, text, minWpm, minAccuracy
}));

export function newTypingProgress() {
  return { unlockedStage: 1, completed: false, stages: {} };
}

export function normalizeTypingProgress(progress) {
  const stages = progress?.stages && typeof progress.stages === 'object' ? progress.stages : {};
  return {
    unlockedStage: Math.max(1, Math.min(10, Number(progress?.unlockedStage) || 1)),
    completed: progress?.completed === true && stages[10]?.passed === true,
    stages
  };
}

export function canPlayStage(progress, number) {
  return Number.isInteger(number) && number > 0 && number <= progress.unlockedStage && number <= 10;
}

export function recordTypingAttempt(progress, number, attempt) {
  if (!canPlayStage(progress, number)) throw new Error('stage-locked');
  const stage = TYPING_STAGES[number - 1];
  const old = progress.stages[number] || { attempts: [], passed: false };
  const passed = attempt.passed && attempt.accuracy >= stage.minAccuracy && attempt.wpm >= stage.minWpm && attempt.wpm <= 250;
  const stages = {
    ...progress.stages,
    [number]: { attempts: [...(old.attempts || []), { ...attempt, passed }], passed: old.passed || passed }
  };
  return {
    unlockedStage: Math.max(progress.unlockedStage, passed ? Math.min(number + 1, 10) : number),
    completed: stages[10]?.passed === true,
    stages
  };
}
