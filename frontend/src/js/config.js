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
export const translateEndpoint = `${API_BASE}/v1/translate`;
export const packEndpoint = (lang) => `${API_BASE}/v1/lesson-packs/${encodeURIComponent(lang)}`;
export const verifyEndpoint = (token) => `${API_BASE}/v1/verify/${encodeURIComponent(token)}`;
export const SUPPORTED_LANGUAGES = ['en', 'zu', 'xh', 'af', 'nso', 'tn', 'st', 'ts', 'ss', 've', 'nr'];

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
    description: 'Budget in Rand, calculate loan interest and practise safe offline SARS eFiling.',
    lessons: ['Household budget (ZAR)', 'Loan interest & repayment', 'SARS eFiling: Registration', 'SARS eFiling: IRP5 & ITR12', 'Banking basics', 'Understanding payslips', 'Financial planning']
  }
};

// Only these exercises have matching server-side grader definitions.
export const EXERCISE_MAP = {
  typing: {},
  excel: {
    w1: { exerciseId: 'sum-basic', answerCell: 'B6' },
    fin1: { exerciseId: 'household-budget', answerCells: ['B8', 'B9'] },
    fin2: { exerciseId: 'loan-interest', answerCells: ['B5', 'B6'] }
  },
  form: {
    fin3: { exerciseId: 'sars-registration' },
    fin4: { exerciseId: 'sars-irp5-itr12' }
  },
  python: {
    d1: { exerciseId: 'sum-even' },
    d2: { exerciseId: 'count-words' }
  }
};
