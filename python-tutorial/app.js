/* ==========================================================================
   Python Tutorial — Nepal Curriculum Edition (Grades 4-10 & +2)
   Core Application Engine & Interactive Runner
   ========================================================================== */

let currentGradeId = "grade4";
let currentLessonId = null;
let pyodideInstance = null;
let pyodideLoading = false;

// Helpers
const $ = id => document.getElementById(id);

function initApp() {
  renderGradeSelector();
  selectGrade(currentGradeId);
  setupEvents();
  setupSearch();
  // Theme is handled by ../js/nav-drawer.js (shared site script)
}

// Render Grade Selector Chips
function renderGradeSelector() {
  const container = $("gradePills");
  if (!container) return;

  container.innerHTML = TUTORIAL_DATA.grades.map(g => `
    <button class="grade-pill ${g.id === currentGradeId ? 'active' : ''}" 
            data-grade="${g.id}" 
            title="${g.desc}">
      <span class="pill-badge">${g.badge}</span>
      <span class="pill-title">${g.title}</span>
    </button>
  `).join("");

  container.querySelectorAll(".grade-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      const gid = btn.getAttribute("data-grade");
      selectGrade(gid);
    });
  });
}

// Select a Grade Level
function selectGrade(gradeId) {
  currentGradeId = gradeId;
  
  // Update Pills
  document.querySelectorAll(".grade-pill").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-grade") === gradeId);
  });

  const grade = TUTORIAL_DATA.grades.find(g => g.id === gradeId);
  if (!grade) return;

  // Update Hero Meta
  const titleEl = $("currentGradeTitle");
  if (titleEl) titleEl.textContent = `${grade.title} — Python Curriculum`;

  // Render Sidebar Modules
  renderSidebar(grade);

  // Auto select first lesson
  if (grade.modules.length && grade.modules[0].lessons.length) {
    selectLesson(grade.modules[0].lessons[0].id);
  }
}

// Render Sidebar Lessons
function renderSidebar(grade, filterText = "") {
  const listEl = $("sidebarModules");
  if (!listEl) return;

  let totalLessons = 0;
  let html = "";

  grade.modules.forEach(mod => {
    const matchingLessons = mod.lessons.filter(l => {
      if (!filterText) return true;
      const q = filterText.toLowerCase();
      return l.title.toLowerCase().includes(q) || l.desc.toLowerCase().includes(q);
    });

    if (matchingLessons.length > 0) {
      totalLessons += matchingLessons.length;
      html += `
        <div class="sidebar-module">
          <div class="module-title">
            <span>${mod.title}</span>
            <span class="module-count">${matchingLessons.length}</span>
          </div>
          <div class="module-lessons">
            ${matchingLessons.map(l => `
              <button class="lesson-link ${l.id === currentLessonId ? 'active' : ''}" 
                      data-lesson="${l.id}">
                <div class="lesson-link-title">${l.title}</div>
                <div class="lesson-link-desc">${l.desc}</div>
              </button>
            `).join("")}
          </div>
        </div>
      `;
    }
  });

  if (!html) {
    listEl.innerHTML = `
      <div class="no-results">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <p>No lessons matching "${filterText}"</p>
      </div>
    `;
  } else {
    listEl.innerHTML = html;
  }

  $("lessonCountBadge").textContent = `${totalLessons} Lessons`;

  // Attach click listeners to lessons
  listEl.querySelectorAll(".lesson-link").forEach(btn => {
    btn.addEventListener("click", () => {
      const lid = btn.getAttribute("data-lesson");
      selectLesson(lid);
      // On mobile, close sidebar drawer
      closeSidebarMobile();
    });
  });
}

// Select and Display Lesson
function selectLesson(lessonId) {
  currentLessonId = lessonId;

  // Update active state in sidebar
  document.querySelectorAll(".lesson-link").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-lesson") === lessonId);
  });

  // Find lesson data
  let lesson = null;
  let currentMod = null;
  for (const g of TUTORIAL_DATA.grades) {
    for (const m of g.modules) {
      const found = m.lessons.find(l => l.id === lessonId);
      if (found) {
        lesson = found;
        currentMod = m;
        break;
      }
    }
    if (lesson) break;
  }

  if (!lesson) return;

  // Render Lesson Details
  $("lessonModuleTag").textContent = currentMod.title;
  $("lessonHeading").textContent = lesson.title;
  $("lessonBrief").textContent = lesson.desc;
  $("lessonBodyContent").innerHTML = lesson.content;

  // Load Code in Editor
  const editorArea = $("codeEditor");
  editorArea.value = lesson.code.trim();

  // Reset Output
  $("outputTerminal").textContent = lesson.output 
    ? `# Standard Expected Output:\n${lesson.output}`
    : "# Click 'Run Code' or open in Python Hub to execute.";
  
  // Highlight with Prism if loaded
  updateCodeHighlighting();

  // Scroll main content to top
  $("lessonMainArea").scrollTo({ top: 0, behavior: "smooth" });
}

// Copy Code Button
function setupEvents() {
  const copyBtn = $("copyCodeBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const code = $("codeEditor").value;
      navigator.clipboard.writeText(code).then(() => {
        const oldHtml = copyBtn.innerHTML;
        copyBtn.innerHTML = `✓ Copied!`;
        copyBtn.style.borderColor = "var(--orange)";
        setTimeout(() => {
          copyBtn.innerHTML = oldHtml;
          copyBtn.style.borderColor = "";
        }, 2000);
      });
    });
  }

  // Open in Python Hub (full interactive lab)
  const openHubBtn = $("openInHubBtn");
  if (openHubBtn) {
    openHubBtn.addEventListener("click", () => {
      const code = $("codeEditor").value;
      // Store in session storage so python.html can prefill if needed, or open python.html
      sessionStorage.setItem("pyhub_imported_code", code);
      window.open("../python.html", "_blank");
    });
  }

  // Run Code directly on this page
  const runBtn = $("runCodeBtn");
  if (runBtn) {
    runBtn.addEventListener("click", executePythonCode);
  }

  // Clear Output
  const clearBtn = $("clearOutputBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      $("outputTerminal").textContent = "# Output cleared.";
    });
  }

  // Mobile sidebar toggle
  const toggleBtn = $("sidebarToggleBtn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      $("sidebarWrapper").classList.toggle("open");
      $("sidebarOverlay").classList.toggle("active");
    });
  }

  const overlay = $("sidebarOverlay");
  if (overlay) {
    overlay.addEventListener("click", closeSidebarMobile);
  }
}

function closeSidebarMobile() {
  const sb = $("sidebarWrapper");
  const ov = $("sidebarOverlay");
  if (sb) sb.classList.remove("open");
  if (ov) ov.classList.remove("active");
}

// Search Filter in Sidebar
function setupSearch() {
  const searchInput = $("lessonSearchInput");
  if (!searchInput) return;

  searchInput.addEventListener("input", e => {
    const text = e.target.value.trim();
    const grade = TUTORIAL_DATA.grades.find(g => g.id === currentGradeId);
    if (grade) {
      renderSidebar(grade, text);
    }
  });
}

// In-Browser Python Execution with Pyodide
async function executePythonCode() {
  const runBtn = $("runCodeBtn");
  const term = $("outputTerminal");
  const code = $("codeEditor").value;

  term.textContent = "⏳ Initializing Python runtime (first run may take a few seconds)...";
  runBtn.disabled = true;

  try {
    if (!pyodideInstance) {
      if (typeof loadPyodide === "undefined") {
        throw new Error("Pyodide library is loading from CDN. Please check internet connection.");
      }
      pyodideInstance = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
      });
    }

    term.textContent = "⚙️ Executing code...\n";

    // Custom stdout redirection
    pyodideInstance.setStdout({
      batched: (text) => {
        term.textContent += text + "\n";
      }
    });

    // Custom stderr redirection
    pyodideInstance.setStderr({
      batched: (text) => {
        term.textContent += "Traceback/Error: " + text + "\n";
      }
    });

    const result = await pyodideInstance.runPythonAsync(code);
    if (result !== undefined && result !== null) {
      term.textContent += `\n# Return Value: ${result}\n`;
    }
  } catch (err) {
    term.textContent += `\n❌ Python Error:\n${err.message}\n`;
  } finally {
    runBtn.disabled = false;
  }
}

function updateCodeHighlighting() {
  // If Prism is active, we can re-highlight or keep textarea sync
}

// Theme handling (inherits from website)
function setupTheme() {
  const toggle = $("themeToggleBtn");
  const saved = localStorage.getItem("theme");
  if (saved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }

  if (toggle) {
    toggle.addEventListener("click", () => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      const next = isDark ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  }
}

document.addEventListener("DOMContentLoaded", initApp);
