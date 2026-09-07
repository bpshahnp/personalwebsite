/* ============================================
   mcq.js — quiz engine with live scoring.
   Reads the "questions" Firestore collection:
   {
     question: string,
     options: [string, string, string, string],
     correctIndex: number,
     explanation: string,
     category: string,
     classLevel: "8" | "9" | "10",
     order: number
   }

   classLevel is normalised on read: any question saved before
   classes existed (missing or blank classLevel) is treated as
   Class 10, so the original question bank needs no migration.

   Options are shuffled per question, so `correctIndex` is always
   an index into the ORIGINAL options array and never into what the
   learner sees. Every button carries both: data-index (original,
   used for scoring) and data-position (what's on screen, used for
   the 1–4 number keys and the "the answer is 3" feedback line).
   ============================================ */

const CLASS_LEVELS = ["8", "9", "10"];
const DEFAULT_CLASS = "10";
const SOUND_KEY = "mcqSound";

/* Accepts "10", 10, "Class 10", "class-10" → "10".
   Anything unrecognised (including missing/blank) → DEFAULT_CLASS. */
function normalizeClass(value) {
  const digits = String(value ?? "").match(/\d+/);
  const found = digits ? digits[0] : "";
  return CLASS_LEVELS.includes(found) ? found : DEFAULT_CLASS;
}

/* A question's class, however it was stored. */
function questionClass(q) {
  return normalizeClass(q.classLevel ?? q.class);
}

/* Human label for a class picker value. */
function classLabel(value) {
  return value === "All" ? "All classes" : `Class ${value}`;
}

/* One entry per (class, category) pair in the "topics" map on the
   user's score doc. Firestore map keys can't contain a dot, so any
   category with one gets it swapped for an underscore. */
function topicKey(cls, category) {
  return `${cls}::${category}`.replace(/\./g, "_");
}

/* Distinct categories present in a given class ("All" = every class),
   alphabetised — same list refreshCategoryOptions() shows in the
   dropdown, reused here so the progress list always matches it. */
function categoriesInClass(classValue) {
  const pool = questionsInClass(classValue);
  return [...new Set(pool.map((q) => q.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

/* ---------- Elements ---------- */
const quizStart = document.getElementById("quizStart");
const quizPlay = document.getElementById("quizPlay");
const quizResult = document.getElementById("quizResult");

const questionBankStatus = document.getElementById("questionBankStatus");
const classRadios = [...document.querySelectorAll('input[name="quizClass"]')];
const countRadios = [...document.querySelectorAll('input[name="quizCount"]')];
const categorySelect = document.getElementById("categorySelect");
const startQuizBtn = document.getElementById("startQuizBtn");
const topicProgress = document.getElementById("topicProgress");
const topicList = document.getElementById("topicList");
const topicProgressLogin = document.getElementById("topicProgressLogin");
const topicProgressLoginLink = document.getElementById("topicProgressLoginLink");

// Top bar elements
const mcqhubBarActions = document.getElementById("mcqhubBarActions");
const quizScoreTop = document.getElementById("quizScoreTop");
const railToggle = document.getElementById("railToggle");
const overlay = document.getElementById("overlay");

// Rail elements
const mcqRail = document.getElementById("mcqRail");
const railTitle = document.getElementById("railTitle");
const mcqRailList = document.getElementById("mcqRailList");
const mcqRailFooter = document.getElementById("mcqRailFooter");
const railProgressText = document.getElementById("railProgressText");
const railProgressFill = document.getElementById("railProgressFill");

/* ---------- Rail as a drawer (small screens) ---------- */
function openRail() {
  mcqRail.classList.add("open");
  overlay.classList.add("visible");
  railToggle.setAttribute("aria-expanded", "true");
}
function closeRail() {
  mcqRail.classList.remove("open");
  overlay.classList.remove("visible");
  railToggle.setAttribute("aria-expanded", "false");
}
railToggle.addEventListener("click", () =>
  mcqRail.classList.contains("open") ? closeRail() : openRail()
);
overlay.addEventListener("click", closeRail);

const quizQuestionClass = document.getElementById("quizQuestionClass");
const quizQuestionCategory = document.getElementById("quizQuestionCategory");
const quizQuestionText = document.getElementById("quizQuestionText");
const quizOptions = document.getElementById("quizOptions");
const answerReport = document.getElementById("answerReport");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");

const leaveQuizBtns = [...document.querySelectorAll("#leaveQuizBtn, #leaveQuizBtnTop")];
const leaveConfirm = document.getElementById("leaveConfirm");
const leaveConfirmBtn = document.getElementById("leaveConfirmBtn");
const leaveCancelBtn = document.getElementById("leaveCancelBtn");
const soundToggles = [...document.querySelectorAll(".js-sound-toggle")];

const finalScoreText = document.getElementById("finalScoreText");
// finalScoreFill removed — the score ring handles result display
const elapsedText = document.getElementById("elapsedText");
const reviewList = document.getElementById("reviewList");
const reviewEmpty = document.getElementById("reviewEmpty");
const wrongOnlyToggle = document.getElementById("wrongOnlyToggle");
const wrongOnlyLabel = document.getElementById("wrongOnlyLabel");
const retryQuizBtn = document.getElementById("retryQuizBtn");
const leaderboardStatus = document.getElementById("leaderboardStatus");

// Score ring elements
const scoreRingEl = document.getElementById("scoreRing");
const ringValue   = document.getElementById("ringValue");
const ringPct     = document.getElementById("ringPct");
const ringFraction= document.getElementById("ringFraction");
const gradeMsg    = document.getElementById("gradeMsg");

/* ---------- State ---------- */
let questionBank = [];
let quizQuestions = [];
let currentIndex = 0;
let score = 0;
let answered = false;
let userAnswers = []; // { question, options, correctIndex, chosenIndex, explanation }
let displayOrder = []; // original option indices, in the order now on screen
let startedAt = 0;
let activeClass = DEFAULT_CLASS; // class this attempt was set up for ("All" = mixed)
let activeCategory = "All";

/* ---------- Sound preference ----------
   Remembered between visits. localStorage throws in a few situations
   (private browsing, a page opened straight off the file system), and a
   muted quiz is not worth a broken page, so both ends are wrapped. */
let soundOn = readSoundPref();

function readSoundPref() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch (err) {
    return true;
  }
}

function writeSoundPref(on) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch (err) {
    /* Preference just won't survive the visit. */
  }
}

/* Icons are built node by node rather than as an HTML string: an <svg>
   assigned through innerHTML needs the SVG namespace to be inferred,
   and createElementNS is the version that always works. */
const SVG_NS = "http://www.w3.org/2000/svg";
const SPEAKER_PATH = "M4 9v6h3l5 4V5L7 9H4z";
const WAVE_PATH = "M16.5 8.6a4.8 4.8 0 0 1 0 6.8";
const MUTE_PATH = "M17 9.5l4.5 5M21.5 9.5l-4.5 5";

function svgIcon(paths) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "15");
  svg.setAttribute("height", "15");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  paths.forEach((d) => {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  });
  return svg;
}

/* The toggle appears twice — on the setup card and in the quiz strip —
   so one render keeps both in step. */
function renderSoundToggles() {
  soundToggles.forEach((btn) => {
    btn.innerHTML = "";
    btn.appendChild(svgIcon(soundOn ? [SPEAKER_PATH, WAVE_PATH] : [SPEAKER_PATH, MUTE_PATH]));
    const label = document.createElement("span");
    label.className = "sound-label";
    label.textContent = soundOn ? "Sound on" : "Sound off";
    btn.appendChild(label);
    btn.setAttribute("aria-pressed", soundOn ? "true" : "false");
    btn.title = soundOn ? "Mute the answer sounds" : "Turn the answer sounds back on";
    btn.classList.toggle("is-off", !soundOn);
  });
}

soundToggles.forEach((btn) => {
  btn.addEventListener("click", () => {
    soundOn = !soundOn;
    writeSoundPref(soundOn);
    renderSoundToggles();
    // A short blip proves the sound actually works, which a silent
    // toggle can't. Nothing plays when switching off, obviously.
    if (soundOn) playNote({ freq: 784, dur: 0.12, type: "triangle", gain: 0.1 });
  });
});

renderSoundToggles();

/* ---------- Sound effects ----------
   Synthesized, so there are no audio files to host. Safari and iOS hand
   back a context stuck in "suspended" until a user gesture resumes it —
   without the resume() below the quiz is silent on every iPhone. */
let audioCtx = null;

function getAudioCtx() {
  if (audioCtx) return audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    audioCtx = new AC();
  } catch (err) {
    audioCtx = null;
  }
  return audioCtx;
}

function primeAudio() {
  const ctx = getAudioCtx();
  if (ctx && ctx.state === "suspended" && ctx.resume) ctx.resume();
  return ctx;
}

/* One note. `to` glides the pitch, `cutoff` puts a lowpass in front of the
   output — that filter is what turns a raw tone into something soft rather
   than buzzy. Gain never reaches 0 because exponential ramps can't. */
function playNote(opts) {
  if (!soundOn) return;
  const ctx = primeAudio();
  if (!ctx) return;

  const start = ctx.currentTime + (opts.delay || 0);
  const dur = opts.dur || 0.2;
  const peak = opts.gain || 0.13;

  const osc = ctx.createOscillator();
  osc.type = opts.type || "sine";
  osc.frequency.setValueAtTime(opts.freq, start);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, start + dur * 0.9);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  osc.connect(gain);
  let tail = gain;
  if (opts.cutoff && ctx.createBiquadFilter) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(opts.cutoff, start);
    gain.connect(filter);
    tail = filter;
  }
  tail.connect(ctx.destination);

  osc.start(start);
  osc.stop(start + dur + 0.05);
}

/* Warm rising fifth — D5 then A5, triangle waves with the top end filtered off. */
function playCorrectSound() {
  playNote({ freq: 587.33, dur: 0.17, type: "triangle", gain: 0.12, cutoff: 2400 });
  playNote({ freq: 880, dur: 0.34, type: "triangle", gain: 0.1, delay: 0.11, cutoff: 2400 });
}

/* Soft low thud: a sine dropping in pitch under a heavy lowpass. Not a buzz —
   getting an answer wrong shouldn't feel like setting off an alarm. */
function playIncorrectSound() {
  playNote({ freq: 196, to: 110, dur: 0.28, type: "sine", gain: 0.16, cutoff: 480 });
}

/* Four rising notes at the end of the attempt. */
function playFinishSound() {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    playNote({
      freq,
      dur: i === 3 ? 0.42 : 0.18,
      type: "triangle",
      gain: 0.1,
      delay: i * 0.1,
      cutoff: 3000,
    });
  });
}

/* ---------- Load question bank once ---------- */
db.collection("questions")
  .get()
  .then((snapshot) => {
    // Stamp a normalised classLevel on every question up front, so the rest
    // of the engine never has to think about legacy/blank values.
    questionBank = snapshot.docs.map((doc) => {
      const data = doc.data();
      return { id: doc.id, ...data, classLevel: questionClass(data) };
    });
    if (!questionBank.length) {
      questionBankStatus.textContent = "No questions yet — add some from the Admin Panel.";
      return;
    }
    refreshClassOptions();
    refreshCategoryOptions();
    refreshStatus();
  })
  .catch((err) => {
    questionBankStatus.textContent = `Could not load questions (${err.message}).`;
  });

/* Value of the checked radio in a group. */
function pickedValue(radios, fallback) {
  const hit = radios.find((r) => r.checked);
  return hit ? hit.value : fallback;
}

function selectedClass() {
  return pickedValue(classRadios, DEFAULT_CLASS);
}

/* Questions in a given class ("All" = every class). */
function questionsInClass(classValue) {
  return classValue === "All"
    ? questionBank
    : questionBank.filter((q) => q.classLevel === classValue);
}

/* The pool the Start button would actually use right now.
   Always a fresh array — the caller shuffles it in place. */
function currentPool() {
  const category = categorySelect.value;
  const pool = questionsInClass(selectedClass());
  return category === "All" ? [...pool] : pool.filter((q) => q.category === category);
}

/* Class picker: each choice carries its own question count, so an empty
   class is visible before you pick it — and unpickable, rather than
   letting someone select Class 9 and find nothing there. */
function refreshClassOptions() {
  classRadios.forEach((radio) => {
    const count = questionsInClass(radio.value).length;
    const chip = document.querySelector(`.pick-count[data-count-for="${radio.value}"]`);
    if (chip) chip.textContent = String(count);
    radio.disabled = radio.value !== "All" && count === 0;
    radio.setAttribute(
      "aria-label",
      `${classLabel(radio.value)}, ${count} question${count === 1 ? "" : "s"}`
    );
  });

  // Never open on a class that has nothing in it.
  const checked = classRadios.find((r) => r.checked);
  if (!checked || checked.disabled) {
    const fallback = classRadios.find((r) => !r.disabled);
    if (fallback) fallback.checked = true;
  }
}

/* Category dropdown, scoped to the classes currently in play — picking
   Class 8 shouldn't offer a category that only exists in Class 10. */
function refreshCategoryOptions() {
  const previous = categorySelect.value;
  const categories = categoriesInClass(selectedClass());

  categorySelect.innerHTML = [
    `<option value="All">All categories</option>`,
    ...categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`),
  ].join("");

  categorySelect.value = categories.includes(previous) ? previous : "All";
  categorySelect.disabled = categories.length === 0;

  renderTopicProgress();
}

/* ---------- Topic progress ----------
   Shows, per category in the selected class, whether the signed-in
   learner has never attempted it, attempted it but missed something,
   or nailed every question on their best attempt. Purely a read of
   the "topics" map already being written in saveScoreToLeaderboard —
   no extra collection, no extra writes. */
let myTopics = null; // null = not loaded yet (logged out, or still loading)
let myTopicsUnsub = null;

function watchMyTopics(user) {
  if (myTopicsUnsub) {
    myTopicsUnsub();
    myTopicsUnsub = null;
  }
  if (!user) {
    myTopics = null;
    renderTopicProgress();
    return;
  }
  myTopicsUnsub = db
    .collection("scores")
    .doc(user.uid)
    .onSnapshot(
      (doc) => {
        myTopics = (doc.exists && doc.data().topics) || {};
        renderTopicProgress();
      },
      () => {
        myTopics = {};
        renderTopicProgress();
      }
    );
}

document.addEventListener("authchange", (e) => watchMyTopics(e.detail.user));

if (topicProgressLoginLink) {
  topicProgressLoginLink.addEventListener("click", (e) => {
    e.preventDefault();
    if (typeof window.openMcqAuthModal === "function") {
      window.openMcqAuthModal();
    } else {
      const btn = document.getElementById("authIconBtn") || document.getElementById("authIconBtnMobile");
      if (btn) btn.click();
    }
  });
}

function renderTopicProgress() {
  if (!topicProgress) return;

  if (myTopics === null) {
    topicProgress.hidden = true;
    topicProgressLogin.hidden = false;
    return;
  }
  topicProgressLogin.hidden = true;

  const cls = selectedClass();
  const classesToShow = cls === "All" ? CLASS_LEVELS : [cls];
  const rows = [];
  classesToShow.forEach((c) => {
    categoriesInClass(c).forEach((category) => {
      const entry = myTopics[topicKey(c, category)];
      rows.push({
        label: cls === "All" ? `Class ${c}: ${category}` : category,
        entry,
      });
    });
  });

  if (!rows.length) {
    topicProgress.hidden = true;
    return;
  }
  topicProgress.hidden = false;

  topicList.innerHTML = rows
    .map(({ label, entry }) => {
      const status = !entry ? "new" : entry.bestPercentage >= 100 ? "complete" : "attempted";
      const icon = status === "complete" ? "✓" : status === "attempted" ? "!" : "";
      const meta = entry ? `${Math.round(entry.bestPercentage)}% best` : "";
      return `
        <div class="topic-row is-${status}">
          <span class="topic-icon" aria-hidden="true">${icon}</span>
          <span class="topic-name">${escapeHtml(label)}</span>
          <span class="topic-meta">${meta}</span>
        </div>
      `;
    })
    .join("");
}

/* Status line under the heading + Start button availability. */
function refreshStatus() {
  const available = currentPool().length;
  const chosen = selectedClass();
  const label = chosen === "All" ? "across all classes" : `in Class ${chosen}`;

  if (!available) {
    questionBankStatus.textContent = `No questions ${label} yet${
      categorySelect.value === "All" ? "" : ` for “${categorySelect.value}”`
    } — add some from the Admin Panel.`;
  } else {
    questionBankStatus.textContent = `${available} question${available === 1 ? "" : "s"} available ${label}.`;
  }
  startQuizBtn.disabled = available === 0;
}

classRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    refreshCategoryOptions();
    refreshStatus();
  });
});
categorySelect.addEventListener("change", refreshStatus);

/* ---------- Start quiz ---------- */
function startQuizEngine() {
  // Snapshot what this attempt is for, so the score write later can't be
  // thrown off by the setup screen changing.
  activeClass = selectedClass();
  activeCategory = categorySelect.value;

  const pool = currentPool();
  if (!pool.length) {
    refreshStatus();
    return;
  }
  shuffle(pool);

  const countValue = pickedValue(countRadios, "10");
  const count = countValue === "all" ? pool.length : Math.min(Number(countValue), pool.length);
  quizQuestions = pool.slice(0, count);

  currentIndex = 0;
  score = 0;
  userAnswers = [];
  startedAt = Date.now();
  leaderboardStatus.textContent = "";
  hideLeaveConfirm();

  // Populate the rail with a numbered list of questions
  buildRailItems();

  // Switch rail to quiz question checklist
  if (topicProgress) topicProgress.hidden = true;
  if (railTitle) railTitle.textContent = "Quiz Progress";
  mcqRailList.hidden = false;

  // Show the rail toggle (mobile) and footer progress bar
  railToggle.hidden = false;
  mcqRailFooter.hidden = false;
  mcqhubBarActions.hidden = false;

  quizStart.hidden = true;
  quizResult.hidden = true;
  quizPlay.hidden = false;
  renderQuestion();
}

startQuizBtn.addEventListener("click", () => {
  // The click is the user gesture Safari waits for before it will let a
  // page make any sound at all, so the context gets woken up here.
  primeAudio();

  const isGuest = typeof window.isMcqGuestMode === "function" && window.isMcqGuestMode();
  if (!auth.currentUser && !isGuest && typeof window.openMcqAuthModal === "function") {
    window.openMcqAuthModal({
      title: "Save Your Progress",
      subtitle: "Sign up or log in to record your scores on the Leaderboard and track completed topics, or continue as a guest.",
      onSuccess: () => {
        startQuizEngine();
      },
      onGuest: () => {
        startQuizEngine();
      }
    });
    return;
  }

  startQuizEngine();
});

/* ---------- Rail: question list ----------
   Builds a numbered list of questions in the left sidebar when a quiz starts,
   mirroring the way Python Hub shows a program list in its rail. */
function buildRailItems() {
  mcqRailList.innerHTML = "";
  quizQuestions.forEach((q, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rail-item is-unanswered";
    btn.dataset.index = idx;

    const num = document.createElement("span");
    num.className = "rail-item-num";
    num.textContent = String(idx + 1);

    const text = document.createElement("span");
    text.className = "rail-item-label";
    // Truncate long questions to keep rail tidy
    text.textContent = (q.question || "").length > 42
      ? (q.question || "").slice(0, 42) + "…"
      : (q.question || "");

    const statusIcon = document.createElement("span");
    statusIcon.className = "rail-item-status";
    statusIcon.setAttribute("aria-hidden", "true");

    btn.appendChild(num);
    btn.appendChild(text);
    btn.appendChild(statusIcon);

    // Clicking a rail item does nothing during a quiz (read-only progress view),
    // but closes the drawer on mobile so the question is visible.
    btn.addEventListener("click", () => closeRail());

    mcqRailList.appendChild(btn);
  });
}

/* Moves the .active class to the rail button at the given index. */
function highlightRailItem(index) {
  [...mcqRailList.querySelectorAll(".rail-item")].forEach((btn, i) => {
    btn.classList.toggle("active", i === index);
  });
}

/* Marks a rail item as correct or incorrect after it's been answered. */
function updateRailItem(index, correct) {
  const btn = mcqRailList.querySelectorAll(".rail-item")[index];
  if (!btn) return;
  btn.classList.remove("is-unanswered");
  btn.classList.add(correct ? "is-correct" : "is-incorrect");

  // Draw a tiny tick or cross inside the status dot
  const statusEl = btn.querySelector(".rail-item-status");
  if (statusEl) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 10 10");
    svg.setAttribute("width", "10");
    svg.setAttribute("height", "10");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG_NS, "path");
    if (correct) {
      path.setAttribute("d", "M1.5 5l2.5 2.5 4.5-4.5");
    } else {
      path.setAttribute("d", "M2 2l6 6M8 2l-6 6");
    }
    svg.appendChild(path);
    statusEl.innerHTML = "";
    statusEl.appendChild(svg);
  }
}

/* ---------- Play ---------- */
function renderQuestion() {
  answered = false;
  const q = quizQuestions[currentIndex];
  const total = quizQuestions.length;

  const progressText = `Question ${currentIndex + 1} of ${total}`;
  const scoreText = currentIndex ? `${score} of ${currentIndex} right` : "";
  const pct = Math.round(((currentIndex + 1) / total) * 100);

  // Left rail progress bar and text
  if (railProgressText) railProgressText.textContent = progressText;
  if (railProgressFill) railProgressFill.style.width = `${pct}%`;

  // Top bar score
  if (quizScoreTop) quizScoreTop.textContent = scoreText;

  // Highlight the active question in the rail
  highlightRailItem(currentIndex);

  if (q.classLevel) {
    quizQuestionClass.textContent = `Class ${q.classLevel}`;
    quizQuestionClass.hidden = false;
  } else {
    quizQuestionClass.hidden = true;
  }

  if (q.category) {
    quizQuestionCategory.textContent = q.category;
    quizQuestionCategory.hidden = false;
  } else {
    quizQuestionCategory.hidden = true;
  }

  quizQuestionText.textContent = q.question || "";
  answerReport.innerHTML = "";
  nextQuestionBtn.hidden = true;
  nextQuestionBtn.textContent = currentIndex === total - 1 ? "See results" : "Next question";
  hideLeaveConfirm();

  // Fresh order every time the question is shown, so a repeat attempt can't
  // be answered from memory of where the right one sat.
  const options = q.options || [];
  displayOrder = shuffle(options.map((_, i) => i));
  quizOptions.innerHTML = "";
  displayOrder.forEach((originalIndex, position) => {
    quizOptions.appendChild(buildOption(options[originalIndex], originalIndex, position));
  });
}

function buildOption(text, originalIndex, position) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mcq-option";
  btn.dataset.index = originalIndex;
  btn.dataset.position = position;

  const key = document.createElement("span");
  key.className = "opt-key";
  key.textContent = String(position + 1);

  const label = document.createElement("span");
  label.className = "opt-text";
  label.textContent = text;

  // Filled by CSS with a tick or a cross once the answer is in, so the
  // result never rests on colour alone.
  const mark = document.createElement("span");
  mark.className = "opt-mark";
  mark.setAttribute("aria-hidden", "true");

  btn.appendChild(key);
  btn.appendChild(label);
  btn.appendChild(mark);
  btn.addEventListener("click", () => selectAnswer(originalIndex));
  return btn;
}

function selectAnswer(chosenIndex) {
  if (answered || quizPlay.hidden) return;
  answered = true;

  const q = quizQuestions[currentIndex];
  const correct = chosenIndex === q.correctIndex;
  if (correct) score++;

  [...quizOptions.children].forEach((btn) => {
    const i = Number(btn.dataset.index);
    btn.disabled = true;
    if (i === q.correctIndex) btn.classList.add("correct");
    else if (i === chosenIndex) btn.classList.add("incorrect");
    else btn.classList.add("faded");
  });

  if (correct) playCorrectSound();
  else playIncorrectSound();

  // Position, not the stored index — the number quoted has to match the
  // number chip the learner can actually see on the row.
  reportAnswer(correct, displayOrder.indexOf(q.correctIndex) + 1, q.options, q);

  const liveScore = `${score} of ${currentIndex + 1} right`;
  if (quizScoreTop) quizScoreTop.textContent = liveScore;
  nextQuestionBtn.hidden = false;

  // Mark rail item as correct or incorrect
  updateRailItem(currentIndex, correct);

  userAnswers.push({
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    chosenIndex,
    explanation: q.explanation,
  });
}


/* The verdict and the explanation go into one live region, together, so a
   screen reader announces the result once instead of twice. */
function reportAnswer(correct, correctPosition, options, q) {
  answerReport.innerHTML = "";

  const verdict = document.createElement("p");
  verdict.className = `answer-verdict ${correct ? "is-right" : "is-wrong"}`;
  const answerText = (options || [])[q.correctIndex];
  verdict.textContent = correct
    ? "Correct."
    : `Not quite — the answer is ${correctPosition}${answerText ? `, ${answerText}` : ""}.`;
  answerReport.appendChild(verdict);

  if (q.explanation) {
    const note = document.createElement("p");
    note.className = "mcq-explanation";
    note.textContent = q.explanation;
    answerReport.appendChild(note);
  }
}

function goNext() {
  if (quizPlay.hidden || !answered) return;
  currentIndex++;
  if (currentIndex >= quizQuestions.length) showResults();
  else renderQuestion();
}

nextQuestionBtn.addEventListener("click", goNext);

/* ---------- Keyboard: 1–4 answers, Enter moves on ----------
   Bound to the document so it works without hunting for focus first, and
   inert everywhere except a quiz in progress. */
document.addEventListener("keydown", (e) => {
  if (quizPlay.hidden || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;

  if (e.key === "Escape") {
    if (!leaveConfirm.hidden) hideLeaveConfirm();
    return;
  }

  const tag = e.target && e.target.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

  if (e.key === "Enter") {
    // A focused button already turns Enter into a click; stepping in here
    // as well would advance two questions at once.
    if (e.target === nextQuestionBtn) return;
    if (!nextQuestionBtn.hidden) {
      e.preventDefault();
      goNext();
    }
    return;
  }

  if (answered) return;
  const position = Number(e.key);
  if (!Number.isInteger(position) || position < 1 || position > 4) return;
  const btn = quizOptions.querySelector(`.mcq-option[data-position="${position - 1}"]`);
  if (!btn) return;
  e.preventDefault();
  btn.click();
});

/* ---------- Leaving mid-quiz ---------- */
function hideLeaveConfirm() {
  leaveConfirm.hidden = true;
}

leaveQuizBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    leaveConfirm.hidden = false;
    leaveCancelBtn.focus();
  });
});

leaveCancelBtn.addEventListener("click", () => {
  hideLeaveConfirm();
  // Focus the first available leave button (typically the top one)
  const visibleLeaveBtn = leaveQuizBtns.find(b => b.offsetWidth > 0);
  if (visibleLeaveBtn) visibleLeaveBtn.focus();
});

leaveConfirmBtn.addEventListener("click", () => {
  hideLeaveConfirm();
  quizQuestions = [];
  userAnswers = [];
  currentIndex = 0;
  score = 0;
  answered = false;
  quizPlay.hidden = true;
  quizResult.hidden = true;
  quizStart.hidden = false;
  mcqhubBarActions.hidden = true;
  mcqRailFooter.hidden = true;
  if (railProgressFill) railProgressFill.style.width = "0%";
  if (railProgressText) railProgressText.textContent = "";
  if (railTitle) railTitle.textContent = "Topic Progress";
  mcqRailList.hidden = true;
  mcqRailList.innerHTML = '<p class="rail-empty" id="railEmptyState">Start a quiz to see your progress here.</p>';
  renderTopicProgress();
  refreshStatus();
});

/* ---------- Results ---------- */
function showResults() {
  const elapsed = Date.now() - startedAt;
  quizPlay.hidden = true;
  quizResult.hidden = false;

  const total = quizQuestions.length;
  const pct = total ? Math.round((score / total) * 100) : 0;
  finalScoreText.textContent = `You scored ${score} / ${total} (${pct}%)`;
  // Score is shown by the ring — no separate fill bar needed
  elapsedText.textContent = `Finished in ${formatDuration(elapsed)}. Timing is just for you — the leaderboard ranks on score.`;

  // ---- Score ring ----
  // Circumference of r=50 circle: 2π×50 ≈ 314.16
  const CIRCUMFERENCE = 314;
  const offset = CIRCUMFERENCE * (1 - pct / 100);
  // Small delay so the CSS transition fires after the card becomes visible
  setTimeout(() => {
    ringValue.style.strokeDashoffset = String(offset);
  }, 60);
  ringPct.textContent = `${pct}%`;
  ringFraction.textContent = `${score} / ${total}`;

  // Colour band: green ≥ 70%, red < 40%, orange in between
  scoreRingEl.classList.remove("band-high", "band-low");
  if (pct >= 70) scoreRingEl.classList.add("band-high");
  else if (pct < 40) scoreRingEl.classList.add("band-low");

  // ---- Grade message ----
  let grade;
  if (pct === 100)       grade = "🏆 Perfect score — outstanding!";
  else if (pct >= 90)    grade = "🌟 Excellent work!";
  else if (pct >= 70)    grade = "👍 Great job — keep it up!";
  else if (pct >= 50)    grade = "📚 Good effort — review the ones you missed.";
  else if (pct >= 30)    grade = "💪 Keep practising — you'll get there!";
  else                   grade = "🔁 Don't give up — try again!";
  gradeMsg.textContent = grade;

  playFinishSound();
  saveScoreToLeaderboard(score, total, pct);

  const missed = userAnswers.filter((a) => a.chosenIndex !== a.correctIndex).length;
  wrongOnlyToggle.checked = false;
  wrongOnlyToggle.disabled = missed === 0;
  wrongOnlyLabel.textContent =
    missed === 0
      ? "Only the ones I missed (none)"
      : missed === 1
        ? "Only the one I missed"
        : `Only the ${missed} I missed`;

  renderReview();
}

/* Numbering stays with the attempt, so filtering down to the misses still
   shows "3." and "7." rather than renumbering them 1 and 2. */
function renderReview() {
  const wrongOnly = wrongOnlyToggle.checked;
  reviewList.innerHTML = "";
  let shown = 0;

  userAnswers.forEach((a, idx) => {
    const isCorrect = a.chosenIndex === a.correctIndex;
    if (wrongOnly && isCorrect) return;
    shown++;

    const item = document.createElement("div");
    item.className = "review-item";
    item.innerHTML = `
      <p class="review-question">${idx + 1}. ${escapeHtml(a.question)}
        <span class="review-tag ${isCorrect ? "review-correct" : "review-incorrect"}">${isCorrect ? "Correct" : "Missed"}</span>
      </p>
      <p class="review-answer">Your answer: <strong>${escapeHtml(a.options[a.chosenIndex] ?? "—")}</strong></p>
      ${!isCorrect ? `<p class="review-answer">Correct answer: <strong>${escapeHtml(a.options[a.correctIndex] ?? "—")}</strong></p>` : ""}
      ${a.explanation ? `<p class="mcq-explanation">${escapeHtml(a.explanation)}</p>` : ""}
    `;
    reviewList.appendChild(item);
  });

  reviewEmpty.hidden = shown > 0;
}

wrongOnlyToggle.addEventListener("change", renderReview);

retryQuizBtn.addEventListener("click", () => {
  quizResult.hidden = true;
  quizStart.hidden = false;
  // Reset rail to idle state
  mcqhubBarActions.hidden = true;
  mcqRailFooter.hidden = true;
  if (railProgressFill) railProgressFill.style.width = "0%";
  if (railProgressText) railProgressText.textContent = "";
  if (railTitle) railTitle.textContent = "Topic Progress";
  mcqRailList.hidden = true;
  mcqRailList.innerHTML = '<p class="rail-empty" id="railEmptyState">Start a quiz to see your progress here.</p>';
  renderTopicProgress();
  refreshStatus();
});

function getTimeBuckets() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const day = `day_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const month = `month_${d.getFullYear()}-${pad(d.getMonth()+1)}`;
  
  // ISO Week
  const d1 = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = d1.getUTCDay() || 7;
  d1.setUTCDate(d1.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d1.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d1 - yearStart) / 86400000) + 1)/7);
  const week = `week_${d1.getUTCFullYear()}-W${pad(weekNo)}`;

  return { day, week, month, all: "all_time" };
}

/* ---------- Save score to the leaderboard ----------
   One document per signed-in user (doc id = uid). We track cumulative
   POINTS (1 point = 1 correct answer) inside time buckets:
   Daily, Weekly, Monthly, All-time.
------------------------------------------------------------------ */
function saveScoreToLeaderboard(rawScore, total, pct) {
  const user = auth.currentUser;
  if (!user) {
    leaderboardStatus.innerHTML = `Log in (top-right 👤) to save this score to the <a href="leaderboard.html">Leaderboard</a>.`;
    return;
  }

  const cls = activeClass;
  const category = activeCategory;
  const scoreRef = db.collection("scores").doc(user.uid);

  db.runTransaction((tx) => {
    return tx.get(scoreRef).then((doc) => {
      const prev = doc.exists ? doc.data() : {};
      const buckets = getTimeBuckets();
      const points = prev.points || {};

      // Initialize groups if missing
      if (!points["All"]) points["All"] = {};
      if (cls !== "All" && !points[cls]) points[cls] = {};

      // 1. Add points to "All classes" (Overall)
      points["All"][buckets.day] = (points["All"][buckets.day] || 0) + rawScore;
      points["All"][buckets.week] = (points["All"][buckets.week] || 0) + rawScore;
      points["All"][buckets.month] = (points["All"][buckets.month] || 0) + rawScore;
      points["All"][buckets.all] = (points["All"][buckets.all] || 0) + rawScore;

      // 2. Add points to specific Class board (if not mixed)
      if (cls !== "All") {
        points[cls][buckets.day] = (points[cls][buckets.day] || 0) + rawScore;
        points[cls][buckets.week] = (points[cls][buckets.week] || 0) + rawScore;
        points[cls][buckets.month] = (points[cls][buckets.month] || 0) + rawScore;
        points[cls][buckets.all] = (points[cls][buckets.all] || 0) + rawScore;
      }

      // 3. Per-topic completion — only meaningful when a specific class
      // AND category were picked. "All categories" mixes topics together
      // in one attempt, so there's nothing single to mark complete.
      const topics = prev.topics || {};
      if (cls !== "All" && category !== "All") {
        const key = topicKey(cls, category);
        const existing = topics[key] || { attempts: 0, bestPercentage: 0 };
        topics[key] = {
          category,
          classLevel: cls,
          attempts: existing.attempts + 1,
          bestPercentage: Math.max(existing.bestPercentage, pct),
          lastPercentage: pct,
          lastAttemptAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
      }

      const attempts = (prev.attempts || 0) + 1;

      tx.set(scoreRef, {
        name: user.displayName || user.email.split("@")[0],
        email: user.email,
        attempts: attempts,
        points: points,
        topics: topics,
        lastCategory: category === "All" ? "" : category,
        lastClass: cls === "All" ? "" : cls,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }); // Merge keeps backward compatibility with old data fields just in case

      return { earned: rawScore, newTotal: points["All"][buckets.all] };
    });
  })
    .then(({ earned, newTotal }) => {
      leaderboardStatus.innerHTML = `Saved! You earned <strong>${earned} points</strong>. All-time total: ${newTotal}. Check the <a href="leaderboard.html">Leaderboard</a>.`;
    })
    .catch((err) => {
      leaderboardStatus.textContent = `Could not save score (${err.message}).`;
    });
}

/* ---------- Utilities ---------- */
/* Shuffles in place and hands the array back, so it can be used inline. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (!mins) return `${rest} second${rest === 1 ? "" : "s"}`;
  if (!rest) return `${mins} minute${mins === 1 ? "" : "s"}`;
  return `${mins} minute${mins === 1 ? "" : "s"} ${rest} second${rest === 1 ? "" : "s"}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
