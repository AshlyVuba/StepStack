//===========================

// 1. SCREEN NAVIGATION

const screens = {
  welcome: document.querySelector("#welcomeScreen"),
  profile: document.querySelector("#profileScreen"),
  dashboard: document.querySelector("#dashboardScreen"),
  course: document.querySelector("#courseScreen")
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function showScreen(screenName) {
  Object.values(screens).forEach(screen => {
    if (screen) screen.classList.remove("active");
  });

  if (screens[screenName]) {
    screens[screenName].classList.add("active");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2400);
}


// ==========================================
// 2. LANGUAGE SUPPORT
// ==========================================

const languageGreetings = {
  en: "Welcome",
  zu: "Sawubona",
  xh: "Molo",
  af: "Welkom",
  st: "Dumela",
  tn: "Dumela",
  nso: "Thobela",
  ts: "Avuxeni",
  ss: "Sawubona",
  ve: "Ndaa",
  nr: "Lotjhani"
};


// ==========================================
// 3. LEARNER PROFILE
// ==========================================

let selectedDevice = "personal";
let learnerProfile = null;

$$(".choice").forEach(button => {
  button.addEventListener("click", () => {

    $$(".choice").forEach(choice => {
      choice.classList.remove("selected");
    });

    button.classList.add("selected");
    selectedDevice = button.dataset.device;
  });
});

$("#letsGoBtn").addEventListener("click", () => {
  showScreen("profile");
});

$("#backToWelcome").addEventListener("click", () => {
  showScreen("welcome");
});


// ==========================================
// 4. FIVE LEARNING PATHWAYS
// ==========================================

const pathways = {

  foundational: {
    title: "Foundational Phase",
    emoji: "🧱",
    description: "Build your digital confidence from the ground up.",
    lessons: [
      "Computer basics",
      "Mouse and keyboard skills",
      "Typing practice",
      "Files and folders",
      "Internet navigation",
      "Email basics",
      "Digital safety"
    ]
  },

  workplace: {
    title: "Workplace Ready",
    emoji: "💼",
    description: "Develop practical digital and professional skills.",
    lessons: [
      "Microsoft Office basics",
      "Professional email etiquette",
      "Word and Excel",
      "Online meetings",
      "CV creation",
      "Job searching",
      "Workplace communication"
    ]
  },

  developer: {
    title: "Developer Mode",
    emoji: "👩🏾‍💻",
    description: "Learn programming and build your own projects.",
    lessons: [
      "Introduction to programming",
      "HTML fundamentals",
      "CSS styling",
      "JavaScript basics",
      "Python fundamentals",
      "Coding logic",
      "Build your first project"
    ]
  },

  upskill: {
    title: "Upskill & Training",
    emoji: "🎓",
    description: "Explore courses, certifications and career opportunities.",
    lessons: [
      "Discover your skills",
      "Explore online courses",
      "Digital certifications",
      "Career development",
      "Technical training",
      "Create a learning plan"
    ]
  },

  finance: {
    title: "Financial Literacy",
    emoji: "💰",
    description: "Learn how to manage money and make informed financial decisions.",
    lessons: [
      "Understanding money",
      "Budgeting",
      "Saving",
      "Banking basics",
      "Credit and debt",
      "Understanding payslips",
      "Financial planning"
    ]
  }

};


// ==========================================
// 5. RECOMMENDATION ENGINE
// ==========================================

function determinePath(profile) {

  const scores = {
    foundational: 0,
    workplace: 0,
    developer: 0,
    upskill: 0,
    finance: 0
  };

  // Learning barriers

  if (profile.barriers.includes("first-step")) {
    scores.foundational += 5;
  }

  if (profile.barriers.includes("english-friction")) {
    scores.foundational += 2;
    scores.upskill += 1;
  }

  if (profile.barriers.includes("passive-video")) {
    scores.developer += 3;
    scores.upskill += 2;
  }

  if (profile.barriers.includes("fragmented-tools")) {
    scores.upskill += 3;
    scores.foundational += 1;
  }

  // Learning goals

  profile.goals.forEach(goal => {
    if (scores[goal] !== undefined) {
      scores[goal] += 5;
    }
  });

  // Education and employment context

  if (profile.education === "Currently working") {
    scores.workplace += 3;
  }

  if (
    profile.education === "Primary school" ||
    profile.education === "High school"
  ) {
    scores.foundational += 1;
  }

  // Find highest-scoring pathway

  const highestScore = Math.max(...Object.values(scores));

  const recommended = Object.keys(scores).filter(path => {
    return scores[path] === highestScore;
  });

  return {
    primary: recommended[0],
    scores: scores,
    alternatives: recommended.slice(1)
  };
}


// ==========================================
// 6. SUBMIT STUDENT PROFILE
// ==========================================

$("#learnerForm").addEventListener("submit", event => {

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

    language: $("#language").value

  };

  // Analyse learner information

  const recommendation = determinePath(learnerProfile);

  learnerProfile.recommendation = recommendation;

  // Save profile for this browser session

  sessionStorage.setItem(
    "stepstackLearner",
    JSON.stringify(learnerProfile)
  );

  // Personalised greeting

  const greeting =
    languageGreetings[learnerProfile.language] || "Welcome";

  $("#greeting").textContent =
    `${greeting}, ${learnerProfile.firstName} 👋`;

  // This prototype does not have a separate recommendation panel yet.
  // Redirect to the dashboard and display the personalised setup as a toast.

  showScreen("dashboard");

  showToast(
    `🌱 ${greeting}, ${learnerProfile.firstName}! Your learning journey is ready.`
  );

});


// ==========================================
// 7. LANGUAGE SELECTOR
// ==========================================

$("#language").addEventListener("change", () => {

  if (!learnerProfile) return;

  learnerProfile.language = $("#language").value;

  sessionStorage.setItem(
    "stepstackLearner",
    JSON.stringify(learnerProfile)
  );

  const greeting =
    languageGreetings[learnerProfile.language] || "Welcome";

  $("#greeting").textContent =
    `${greeting}, ${learnerProfile.firstName} 👋`;

});


// ==========================================
// 8. OPEN LEARNING PATHWAYS
// ==========================================

function openPathway(pathKey) {

  const path = pathways[pathKey];

  if (!path) return;

  $("#pathTitle").textContent = path.title;

  $("#pathEmoji").textContent = path.emoji;

  $("#pathDescription").textContent = path.description;

  $("#pathLessonList").innerHTML =
    path.lessons.map((lesson, index) => `

      <div class="lesson">

        <div class="lesson-num">
          ${String(index + 1).padStart(2, "0")}
        </div>

        <div class="lesson-main">
          <strong>${lesson}</strong>
          <small>Beginner-friendly lesson</small>
        </div>

        <button class="lesson-play" type="button">
          ▶
        </button>

      </div>

    `).join("");

  showScreen("pathway");

}


// Pathway cards

$$(".pathway-card").forEach(card => {

  card.addEventListener("click", () => {

    openPathway(card.dataset.path);

  });

});


// Recommended pathway button

const recommendedPathBtn = $("#recommendedPathBtn");
if (recommendedPathBtn) {
  recommendedPathBtn.addEventListener("click", () => {
    openPathway(recommendedPathBtn.dataset.path);
  });
}


// Back to dashboard

const backFromPathway = $("#backFromPathway");
if (backFromPathway) {
  backFromPathway.addEventListener("click", () => {
    showScreen("dashboard");
  });
}


// ==========================================
// 9. COURSE CATALOGUE
// ==========================================

const courses = {

  coding: {
    title: "Code Your First Website",
    emoji: "💻",
    lessons: [
      "Meet the internet",
      "Introduction to HTML",
      "Your first webpage",
      "CSS styling",
      "Responsive design"
    ]
  },

  cyber: {
    title: "Digital Safety Basics",
    emoji: "🔐",
    lessons: [
      "Digital footprints",
      "Strong passwords",
      "Phishing awareness",
      "Privacy settings",
      "Online safety"
    ]
  },

  data: {
    title: "Data Detective",
    emoji: "📊",
    lessons: [
      "What is data?",
      "Collecting information",
      "Reading charts",
      "Finding patterns",
      "Mini data project"
    ]
  },

  ai: {
    title: "AI Explorer",
    emoji: "🤖",
    lessons: [
      "Introduction to AI",
      "Everyday AI",
      "Writing prompts",
      "AI and creativity",
      "Responsible AI"
    ]
  }

};


function openCourse(courseKey) {

  const course = courses[courseKey];

  if (!course) return;

  $("#courseTitle").textContent = course.title;

  $("#courseEmoji").textContent = course.emoji;

  $("#lessonList").innerHTML =
    course.lessons.map((lesson, index) => `

      <div class="lesson">

        <div class="lesson-num">
          ${String(index + 1).padStart(2, "0")}
        </div>

        <div class="lesson-main">
          <strong>${lesson}</strong>
          <small>Beginner · ${5 + index} minutes</small>
        </div>

        <button class="lesson-play" type="button">
          ▶
        </button>

      </div>

    `).join("");

  showScreen("course");

}


// Course cards

$$(".course-card").forEach(card => {

  card.addEventListener("click", () => {

    openCourse(card.dataset.course);

  });

});

$$(".category").forEach(button => {

  button.addEventListener("click", () => {

    openCourse(button.dataset.course);

  });

});


// ==========================================
// 10. DASHBOARD NAVIGATION
// ==========================================

$("#backToDashboard").addEventListener("click", () => {
  showScreen("dashboard");
});

$("#dailyBtn").addEventListener("click", () => {
  openCourse("coding");
});

$("#viewAllBtn").addEventListener("click", () => {
  showToast("📚 More learning paths coming soon!");
});

$("#startLesson").addEventListener("click", () => {
  showToast("🚀 Let's start learning!");
});


// Lesson interactions

$("#lessonList").addEventListener("click", event => {

  if (event.target.closest(".lesson-play")) {

    showToast("▶ Lesson opened! Let's learn by doing.");

  }

});

const pathLessonList = $("#pathLessonList");
if (pathLessonList) {
  pathLessonList.addEventListener("click", event => {
    if (event.target.closest(".lesson-play")) {
      showToast("▶ Activity opened! Keep practising.");
    }
  });
}


// Bottom navigation

$$(".nav-btn").forEach(button => {

  button.addEventListener("click", () => {

    $$(".nav-btn").forEach(nav => {
      nav.classList.remove("active");
    });

    button.classList.add("active");

    const navName = button.dataset.nav;

    const messages = {

      learn: "📚 Explore your learning paths!",

      progress: "🏆 Your learning progress!",

      profile: "👋 Your learner profile!"

    };

    if (messages[navName]) {
      showToast(messages[navName]);
    }

  });

});
