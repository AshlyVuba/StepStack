// API URLs are public configuration; internal service credentials never belong here.
const configuredApi = typeof document !== 'undefined'
  ? document.querySelector('meta[name="stepstack-api"]')?.content?.trim()
  : '';
const localHost = ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname);
const defaultApi = globalThis.location?.origin && !globalThis.location.origin.startsWith('file:')
  ? localHost ? 'http://localhost:3000' : globalThis.location.origin
  : 'http://localhost:3000';
const apiUrl = new URL(configuredApi || defaultApi, globalThis.location?.href || 'http://localhost/');
if (!['http:', 'https:'].includes(apiUrl.protocol) || apiUrl.username || apiUrl.password)
  throw new Error('API base URL must use HTTP or HTTPS without credentials');
export const API_BASE = apiUrl.href.replace(/\/$/, '');
export const verifyEndpoint = (token) => `${API_BASE}/v1/verify/${encodeURIComponent(token)}`;

export const PATHWAYS = {
  foundational: {
    title: 'Typing & Computer Basics', emoji: '⌨️',
    description: 'Build confidence through typing, mouse skills and essential computer tasks.',
    lessons: ['Typing Foundation', 'Mouse and pointer control', 'Keyboard shortcuts', 'Computer basics', 'Files and folders', 'Internet and browser navigation', 'Digital safety']
  },
  workplace: {
    title: 'Workplace Ready', emoji: '💼',
    description: 'Develop practical digital skills for jobs, studies and professional life.',
    lessons: ['Microsoft Office basics', 'Word essentials', 'Excel essentials', 'PowerPoint essentials', 'Professional email', 'Creating a CV', 'Online meetings']
  },
  developer: {
    title: 'Developer Mode', emoji: '💻',
    description: 'Learn programming logic and create real projects from scratch.',
    lessons: ['Programming fundamentals', 'HTML', 'CSS', 'JavaScript', 'Python', 'Coding logic', 'Your first project']
  },
  upskill: {
    title: 'Upskill & Training', emoji: '🎓',
    description: 'Explore short courses, certifications and career-focused training.',
    lessons: ['Discover your skills', 'Career exploration', 'Short courses', 'Certification options', 'A guided learning plan', 'Practice interviews', 'Next career step']
  },
  finance: {
    title: 'Financial Literacy', emoji: '💰',
    description: 'Learn to budget, save, understand banking and plan for the future.',
    lessons: ['Understanding money', 'Budgeting', 'Saving', 'Banking basics', 'Credit and debt', 'Understanding payslips', 'Financial planning']
  }
};

// Only these exercises have matching server-side grader definitions.
export const EXERCISE_MAP = {
  typing: {},
  excel: { w1: { exerciseId: 'sum-basic', answerCell: 'B6' } },
  python: {
    d1: { exerciseId: 'sum-even' },
    d2: { exerciseId: 'count-words' }
  }
};
