// StepStack prototype - beginner-friendly application logic

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const screens = {
  welcome: $("#welcomeScreen"),
  profile: $("#profileScreen"),
  dashboard: $("#dashboardScreen"),
  pathway: $("#pathwayScreen"),
  course: $("#courseScreen")
};

const greetings = {
  en: "Welcome", zu: "Sawubona", xh: "Molo", af: "Welkom",
  st: "Dumela", tn: "Dumela", nso: "Thobela", ts: "Avuxeni",
  ss: "Sawubona", ve: "Ndaa", nr: "Lotjhani"
};

const pathways = {
  foundational: {
    title: "Typing & Computer Basics", emoji: "⌨️", accent: "lime",
    description: "Build confidence through typing, mouse skills and essential computer tasks.",
    lessons: ["Typing foundations", "Mouse and pointer control", "Keyboard shortcuts", "Computer basics", "Files and folders", "Internet and browser navigation", "Digital safety"]
  },
  workplace: {
    title: "Workplace Ready", emoji: "💼", accent: "yellow",
    description: "Develop practical digital skills for jobs, studies and professional life.",
    lessons: ["Microsoft Office basics", "Word essentials", "Excel essentials", "PowerPoint essentials", "Professional email", "Creating a CV", "Online meetings"]
  },
  developer: {
    title: "Developer Mode", emoji: "💻", accent: "purple",
    description: "Learn programming logic and create real projects from scratch.",
    lessons: ["Programming fundamentals", "HTML", "CSS", "JavaScript", "Python", "Coding logic", "Your first project"]
  },
  upskill: {
    title: "Upskill & Training", emoji: "🎓", accent: "coral",
    description: "Explore short courses, certifications and career-focused training.",
    lessons: ["Discover your skills", "Career exploration", "Short courses", "Certification options", "A guided learning plan", "Practice interviews", "Next career step"]
  },
  finance: {
    title: "Financial Literacy", emoji: "💰", accent: "teal",
    description: "Learn to budget, save, understand banking and plan for the future.",
    lessons: ["Understanding money", "Budgeting", "Saving", "Banking basics", "Credit and debt", "Understanding payslips", "Financial planning"]
  }
};

// Preserve support for the original course cards.
const courses = {
  coding: { title: "Code Your First Website", emoji: "👩🏾‍💻", description: "HTML, CSS and the basics of building for the web.", lessons: ["Meet the internet", "Introduction to HTML", "Your first webpage", "CSS styling", "Responsive design"] },
  cyber: { title: "Digital Safety Basics", emoji: "🛡️", description: "Passwords, scams, privacy and protecting yourself online.", lessons: ["Digital footprints", "Strong passwords", "Phishing awareness", "Privacy settings", "Online safety"] },
  data: { title: "Data Detective", emoji: "📈", description: "Discover how to turn information into insights.", lessons: ["What is data?", "Collecting information", "Reading charts", "Finding patterns", "Mini data project"] }
};

let selectedDevice = "personal";
let learnerProfile = null;

function showScreen(screenName) {
  Object.values(screens).forEach((screen) => {
    if (screen) screen.classList.remove("active");
  });
  if (screens[screenName]) screens[screenName].classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function getPersonalProfile() {
  const stored = sessionStorage.getItem("stepstackLearner");
  if (!stored) return null;
  try { return JSON.parse(stored); } catch (error) { return null; }
}

// Device selection
$$('.choice').forEach((button) => {
  button.addEventListener("click", () => {
    $$('.choice').forEach((choice) => choice.classList.remove("selected"));
    button.classList.add("selected");
    selectedDevice = button.dataset.device;
  });
});

$("#letsGoBtn")?.addEventListener("click", () => showScreen("profile"));
$("#backToWelcome")?.addEventListener("click", () => showScreen("welcome"));

// This scoring system uses barriers, goals and education to recommend a pathway.
function recommendPathway(profile) {
  const scores = {
    foundational: 0, workplace: 0, developer: 0, upskill: 0, finance: 0
  };

  const barrierWeights = {
    "first-step": { foundational: 6 },
    "english-friction": { foundational: 4, upskill: 2 },
    "passive-video": { developer: 3, upskill: 3, foundational: 1 },
    "fragmented-tools": { upskill: 4, foundational: 2 }
  };

  profile.barriers.forEach((barrier) => {
    Object.entries(barrierWeights[barrier] || {}).forEach(([path, points]) => {
      scores[path] += points;
    });
  });

  profile.goals.forEach((goal) => {
    if (Object.prototype.hasOwnProperty.call(scores, goal)) scores[goal] += 5;
  });

  if (profile.education === "Currently working") scores.workplace += 4;
  if (profile.education === "Primary school" || profile.education === "High school") scores.foundational += 2;
  if (profile.education === "Skills programme / bootcamp") scores.upskill += 3;
  if (profile.education === "TVET college" || profile.education === "University / higher education") scores.upskill += 2;

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return { primary: ranked[0][0], scores, ranked };
}

function setPersonalisedDashboard(profile) {
  const recommendation = profile.recommendation;
  const primary = pathways[recommendation.primary];

  const greetingElement = $("#greeting");
  if (greetingElement) {
    greetingElement.textContent = `${greetings[profile.language] || "Welcome"}, ${profile.firstName} 👋`;
  }

  $("#recommendationTitle")?.replaceChildren(document.createTextNode(primary.title));
  $("#recommendationDescription")?.replaceChildren(document.createTextNode(primary.description));
  $("#recommendationEmoji")?.replaceChildren(document.createTextNode(primary.emoji));
  const recommendedButton = $("#recommendedPathBtn");
  if (recommendedButton) recommendedButton.dataset.path = recommendation.primary;

  const barrierActivity = {
    "first-step": ["⌨️", "Try a typing warm-up", "Practise mouse, keyboard and typing confidence in short steps."],
    "english-friction": ["🌍", "Explore language-supported learning", "Use a local language selector and accessible beginner explanations."],
    "passive-video": ["✋", "Complete a hands-on activity", "Learn by doing instead of only watching a tutorial."],
    "fragmented-tools": ["🔗", "Follow one guided step", "Complete a focused activity inside StepStack without switching tools."]
  };

  const activity = barrierActivity[profile.barriers[0]];
  if (activity) {
    $("#activityIcon")?.replaceChildren(document.createTextNode(activity[0]));
    $("#activityTitle")?.replaceChildren(document.createTextNode(activity[1]));
    $("#activityDescription")?.replaceChildren(document.createTextNode(activity[2]));
  } else {
    $("#activityIcon")?.replaceChildren(document.createTextNode("🚀"));
    $("#activityTitle")?.replaceChildren(document.createTextNode("Start your first 5-minute step"));
    $("#activityDescription")?.replaceChildren(document.createTextNode("Choose a pathway and complete a short hands-on lesson."));
  }

  renderLearningOptions(profile);
}

function renderLearningOptions(profile) {
  const goalDetails = {
    foundational: { emoji: "⌨️", label: "Typing & Computer Basics", description: "Build confidence with typing, mouse skills and essential computer tasks." },
    workplace: { emoji: "💼", label: "Workplace readiness", description: "Build practical Office, communication and CV skills." },
    developer: { emoji: "💻", label: "Programming & development", description: "Learn coding and create hands-on projects." },
    upskill: { emoji: "🎓", label: "Courses & certifications", description: "Explore career training and recognised learning options." },
    finance: { emoji: "💰", label: "Financial literacy", description: "Learn budgeting, saving, banking and money planning." }
  };

  $("#choiceCount")?.replaceChildren(document.createTextNode(`${profile.goals.length} ${profile.goals.length === 1 ? "goal" : "goals"} selected`));

  const goalContainer = $("#goalCategories");
  if (goalContainer) {
    if (profile.goals.length === 0) {
      goalContainer.innerHTML = `<div class="goal-category empty-category"><span>🌱</span><div><strong>Explore all pathways</strong><small>You did not select a goal yet. You can still browse every learning option.</small></div></div>`;
    } else {
      goalContainer.innerHTML = profile.goals.map((goal) => {
        const detail = goalDetails[goal];
        if (!detail) return "";
        return `<button class="goal-category" type="button" data-path="${goal}">
          <span>${detail.emoji}</span>
          <div><strong>${detail.label}</strong><small>${detail.description}</small></div>
          <b>View →</b>
        </button>`;
      }).join("");

      goalContainer.querySelectorAll(".goal-category[data-path]").forEach((card) => {
        card.addEventListener("click", () => openPathway(card.dataset.path));
      });
    }
  }

  const rankedContainer = $("#rankedPathways");
  if (rankedContainer) {
    rankedContainer.innerHTML = profile.recommendation.ranked.map(([pathKey, score], index) => {
      const path = pathways[pathKey];
      const selectedGoal = profile.goals.includes(pathKey);
      const fitLabel = index === 0 ? "Best match" : selectedGoal ? "Selected goal" : score > 0 ? "Good option" : "Explore";
      const maxScore = Math.max(profile.recommendation.ranked[0][1], 1);
      const fitPercent = Math.round((score / maxScore) * 100);

      return `<button class="ranked-pathway ${index === 0 ? "ranked-primary" : ""}" type="button" data-path="${pathKey}">
        <div class="ranked-main"><span class="ranked-emoji">${path.emoji}</span><div><strong>${path.title}</strong><small>${path.description}</small></div></div>
        <div class="ranked-fit"><span>${fitLabel}</span><strong>${fitPercent}%</strong></div>
        <div class="ranked-progress"><span style="width:${fitPercent}%"></span></div>
      </button>`;
    }).join("");

    rankedContainer.querySelectorAll(".ranked-pathway").forEach((card) => {
      card.addEventListener("click", () => openPathway(card.dataset.path));
    });
  }
}

$("#learnerForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);

  learnerProfile = {
    firstName: formData.get("firstName").trim(),
    surname: formData.get("surname").trim(),
    age: Number(formData.get("age")),
    education: formData.get("education"),
    barriers: formData.getAll("barriers"),
    goals: formData.getAll("goals"),
    device: selectedDevice,
    language: $("#language")?.value || "en",
    streak: 3,
    xp: 120,
    completedLessons: 2
  };

  learnerProfile.recommendation = recommendPathway(learnerProfile);
  sessionStorage.setItem("stepstackLearner", JSON.stringify(learnerProfile));
  setPersonalisedDashboard(learnerProfile);
  showScreen("dashboard");
  showToast(`🌱 ${greetings[learnerProfile.language]}, ${learnerProfile.firstName}! Your learning journey is ready.`);
});

// Restore a saved profile when the page is refreshed.
learnerProfile = getPersonalProfile();
if (learnerProfile) setPersonalisedDashboard(learnerProfile);

// Update the dashboard greeting when the language changes.
$("#language")?.addEventListener("change", (event) => {
  if (!learnerProfile) return;
  learnerProfile.language = event.target.value;
  sessionStorage.setItem("stepstackLearner", JSON.stringify(learnerProfile));
  setPersonalisedDashboard(learnerProfile);
});

function openPathway(pathKey) {
  const pathway = pathways[pathKey];
  if (!pathway) return;

  $("#pathTitle")?.replaceChildren(document.createTextNode(pathway.title));
  $("#pathEmoji")?.replaceChildren(document.createTextNode(pathway.emoji));
  $("#pathDescription")?.replaceChildren(document.createTextNode(pathway.description));
  $("#lessonCount")?.replaceChildren(document.createTextNode(`${pathway.lessons.length} lessons`));

  const lessonList = $("#pathLessonList");
  if (lessonList) {
    lessonList.innerHTML = pathway.lessons.map((lesson, index) => `
      <div class="lesson">
        <div class="lesson-num">${String(index + 1).padStart(2, "0")}</div>
        <div class="lesson-main"><strong>${lesson}</strong><small>Beginner · ${5 + index} minutes</small></div>
        <button class="lesson-play" type="button" aria-label="Open ${lesson}" data-lesson="${lesson}">▶</button>
      </div>
    `).join("");
  }

  $("#pathProgressValue")?.replaceChildren(document.createTextNode("0%"));
  const progressBar = $("#pathProgressBar");
  if (progressBar) progressBar.style.width = "0%";
  showScreen("pathway");
}

$$('.pathway-card').forEach((card) => {
  card.addEventListener("click", () => openPathway(card.dataset.path));
});

$("#recommendedPathBtn")?.addEventListener("click", (event) => openPathway(event.currentTarget.dataset.path));
$("#backFromPathway")?.addEventListener("click", () => showScreen("dashboard"));

$("#pathLessonList")?.addEventListener("click", (event) => {
  const playButton = event.target.closest(".lesson-play");
  if (!playButton) return;
  showToast(`▶ Opening: ${playButton.dataset.lesson}`);
});

$("#startPathLesson")?.addEventListener("click", () => showToast("🚀 Your first learning step is starting!"));
$("#activityBtn")?.addEventListener("click", () => showToast("✋ Hands-on practice opened. Let's learn by doing!"));

// Course navigation - original functionality preserved
function openCourse(courseKey) {
  const course = courses[courseKey];
  if (!course) return;
  $("#courseTitle")?.replaceChildren(document.createTextNode(course.title));
  $("#courseEmoji")?.replaceChildren(document.createTextNode(course.emoji));
  $("#courseDescription")?.replaceChildren(document.createTextNode(course.description));
  const courseList = $("#lessonList");
  if (courseList) {
    courseList.innerHTML = course.lessons.map((lesson, index) => `
      <div class="lesson"><div class="lesson-num">${String(index + 1).padStart(2, "0")}</div>
      <div class="lesson-main"><strong>${lesson}</strong><small>Beginner · ${5 + index} minutes</small></div>
      <button class="lesson-play" type="button" aria-label="Open ${lesson}">▶</button></div>`).join("");
  }
  showScreen("course");
}

$$('.course-card').forEach((card) => card.addEventListener("click", () => openCourse(card.dataset.course)));
$("#backToDashboard")?.addEventListener("click", () => showScreen("dashboard"));
$("#dailyBtn")?.addEventListener("click", () => openPathway(learnerProfile?.recommendation?.primary || "foundational"));
$("#startLesson")?.addEventListener("click", () => showToast("🚀 Your lesson is ready to start!"));
$("#lessonList")?.addEventListener("click", (event) => {
  if (event.target.closest(".lesson-play")) showToast("▶ Lesson opened! Let's learn by doing.");
});

// Bottom navigation keeps the dashboard experience functional.
$$('.nav-btn').forEach((button) => {
  button.addEventListener("click", () => {
    $$('.nav-btn').forEach((nav) => nav.classList.remove("active"));
    button.classList.add("active");

    const messages = {
      home: "⌂ You are at Home",
      learn: "📚 Explore one of the five learning pathways",
      progress: "🏆 2 lessons completed · 120 XP · 3-day streak",
      profile: "👋 Your learner profile is safely stored for this browser session"
    };
    showToast(messages[button.dataset.nav] || "StepStack");
  });
});

// Update XP and lessons display on dashboard
function updateDashboardStats(profile) {
  $("#headerXp")?.replaceChildren(document.createTextNode(`${profile.xp} XP`));
  $("#pointsValue")?.replaceChildren(document.createTextNode(`${profile.xp} XP`));
  $("#lessonsValue")?.replaceChildren(document.createTextNode(`${profile.completedLessons} ${profile.completedLessons === 1 ? "lesson" : "lessons"}`));
}

// Call this function after setting the learner profile
if (learnerProfile) {
  updateDashboardStats(learnerProfile);
}
