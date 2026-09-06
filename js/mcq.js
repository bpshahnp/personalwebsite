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
   ============================================ */

const CLASS_LEVELS = ["8", "9", "10"];
const DEFAULT_CLASS = "10";

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

const quizStart = document.getElementById("quizStart");
const quizPlay = document.getElementById("quizPlay");
const quizResult = document.getElementById("quizResult");

const questionBankStatus = document.getElementById("questionBankStatus");
const classSelect = document.getElementById("classSelect");
const categorySelect = document.getElementById("categorySelect");
const countSelect = document.getElementById("countSelect");
const startQuizBtn = document.getElementById("startQuizBtn");

const quizProgress = document.getElementById("quizProgress");
const quizScore = document.getElementById("quizScore");
const quizProgressFill = document.getElementById("quizProgressFill");
const quizQuestionClass = document.getElementById("quizQuestionClass");
const quizQuestionCategory = document.getElementById("quizQuestionCategory");
const quizQuestionText = document.getElementById("quizQuestionText");
const quizOptions = document.getElementById("quizOptions");
const quizExplanation = document.getElementById("quizExplanation");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");

const finalScoreText = document.getElementById("finalScoreText");
const finalScoreFill = document.getElementById("finalScoreFill");
const reviewList = document.getElementById("reviewList");
const retryQuizBtn = document.getElementById("retryQuizBtn");

let questionBank = [];
let quizQuestions = [];
let currentIndex = 0;
let score = 0;
let activeClass = DEFAULT_CLASS;   // class this attempt was set up for ("All" = mixed)
let activeCategory = "All";

/* ---------- Sound effects (no audio files needed — synthesized tones) ---------- */
let audioCtx;
function getAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  return audioCtx;
}

function playTone(freq, duration, type, delay) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || "sine";
  osc.frequency.value = freq;
  const startAt = ctx.currentTime + (delay || 0);
  gain.gain.setValueAtTime(0.001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

function playCorrectSound() {
  // short, bright two-note "ding-ding" rising tone
  playTone(660, 0.12, "sine", 0);
  playTone(880, 0.16, "sine", 0.1);
}

function playIncorrectSound() {
  // short low buzz
  playTone(180, 0.22, "sawtooth", 0);
}
let answered = false;
let userAnswers = []; // { question, options, correctIndex, chosenIndex }

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
  const pool = questionsInClass(classSelect.value);
  return category === "All" ? [...pool] : pool.filter((q) => q.category === category);
}

/* Class dropdown, annotated with how many questions each class holds so an
   empty class is obvious before you pick it. */
function refreshClassOptions() {
  const preferred = classSelect.value || DEFAULT_CLASS;
  const opts = [`<option value="All">All classes (${questionBank.length})</option>`];
  CLASS_LEVELS.forEach((level) => {
    const count = questionsInClass(level).length;
    opts.push(`<option value="${level}">Class ${level} (${count})</option>`);
  });
  classSelect.innerHTML = opts.join("");

  // Keep the current choice if it has questions; otherwise fall back to a
  // class that does, so the page never opens on an empty selection.
  const hasPreferred = questionsInClass(preferred).length > 0;
  classSelect.value = hasPreferred ? preferred : "All";
}

/* Category dropdown, scoped to the classes currently in play — picking
   Class 8 shouldn't offer a category that only exists in Class 10. */
function refreshCategoryOptions() {
  const previous = categorySelect.value;
  const pool = questionsInClass(classSelect.value);
  const categories = [...new Set(pool.map((q) => q.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

  categorySelect.innerHTML = [
    `<option value="All">All categories</option>`,
    ...categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`),
  ].join("");

  categorySelect.value = categories.includes(previous) ? previous : "All";
  categorySelect.disabled = categories.length === 0;
}

/* Status line under the heading + Start button availability. */
function refreshStatus() {
  const available = currentPool().length;
  const label = classSelect.value === "All" ? "across all classes" : `in Class ${classSelect.value}`;

  if (!available) {
    questionBankStatus.textContent = `No questions ${label} yet${
      categorySelect.value === "All" ? "" : ` for “${categorySelect.value}”`
    } — add some from the Admin Panel.`;
  } else {
    questionBankStatus.textContent = `${available} question${available === 1 ? "" : "s"} available ${label}.`;
  }
  startQuizBtn.disabled = available === 0;
}

classSelect.addEventListener("change", () => {
  refreshCategoryOptions();
  refreshStatus();
});
categorySelect.addEventListener("change", refreshStatus);

/* ---------- Start quiz ---------- */
startQuizBtn.addEventListener("click", () => {
  const countValue = countSelect.value;

  // Snapshot what this attempt is for, so the score write later can't be
  // thrown off by the dropdowns changing.
  activeClass = classSelect.value;
  activeCategory = categorySelect.value;

  const pool = currentPool();
  if (!pool.length) {
    refreshStatus();
    return;
  }
  shuffle(pool);

  const count = countValue === "all" ? pool.length : Math.min(Number(countValue), pool.length);
  quizQuestions = pool.slice(0, count);

  currentIndex = 0;
  score = 0;
  userAnswers = [];
  leaderboardStatus.textContent = "";

  quizStart.hidden = true;
  quizResult.hidden = true;
  quizPlay.hidden = false;
  renderQuestion();
});

function renderQuestion() {
  answered = false;
  const q = quizQuestions[currentIndex];

  quizProgress.textContent = `Question ${currentIndex + 1} of ${quizQuestions.length}`;
  quizScore.textContent = `Score: ${score} / ${currentIndex}`;
  quizProgressFill.style.width = `${(currentIndex / quizQuestions.length) * 100}%`;

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
  quizExplanation.hidden = true;
  nextQuestionBtn.hidden = true;
  nextQuestionBtn.textContent =
    currentIndex === quizQuestions.length - 1 ? "See Results →" : "Next Question →";

  quizOptions.innerHTML = "";
  (q.options || []).forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "mcq-option";
    btn.textContent = opt;
    btn.dataset.index = i;
    btn.addEventListener("click", () => selectAnswer(i, btn));
    quizOptions.appendChild(btn);
  });
}

function selectAnswer(chosenIndex, btnEl) {
  if (answered) return;
  answered = true;
  const q = quizQuestions[currentIndex];
  const correct = chosenIndex === q.correctIndex;
  if (correct) score++;

  if (correct) playCorrectSound();
  else playIncorrectSound();

  [...quizOptions.children].forEach((b) => {
    const i = Number(b.dataset.index);
    if (i === q.correctIndex) b.classList.add("correct");
    else if (i === chosenIndex) b.classList.add("incorrect");
  });

  if (q.explanation) {
    quizExplanation.textContent = q.explanation;
    quizExplanation.hidden = false;
  }

  quizScore.textContent = `Score: ${score} / ${currentIndex + 1}`;
  nextQuestionBtn.hidden = false;

  userAnswers.push({
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    chosenIndex,
    explanation: q.explanation,
  });
}

nextQuestionBtn.addEventListener("click", () => {
  currentIndex++;
  if (currentIndex >= quizQuestions.length) {
    showResults();
  } else {
    renderQuestion();
  }
});

function showResults() {
  quizPlay.hidden = true;
  quizResult.hidden = false;

  const total = quizQuestions.length;
  const pct = total ? Math.round((score / total) * 100) : 0;
  finalScoreText.textContent = `You scored ${score} / ${total} (${pct}%)`;
  finalScoreFill.style.width = `${pct}%`;

  saveScoreToLeaderboard(score, total, pct);

  reviewList.innerHTML = "";
  userAnswers.forEach((a, idx) => {
    const isCorrect = a.chosenIndex === a.correctIndex;
    const item = document.createElement("div");
    item.className = "review-item";
    item.innerHTML = `
      <p class="review-question">${idx + 1}. ${escapeHtml(a.question)}
        <span class="review-tag ${isCorrect ? "review-correct" : "review-incorrect"}">${isCorrect ? "Correct" : "Incorrect"}</span>
      </p>
      <p class="review-answer">Your answer: <strong>${escapeHtml(a.options[a.chosenIndex] ?? "—")}</strong></p>
      ${!isCorrect ? `<p class="review-answer">Correct answer: <strong>${escapeHtml(a.options[a.correctIndex] ?? "—")}</strong></p>` : ""}
      ${a.explanation ? `<p class="mcq-explanation">${escapeHtml(a.explanation)}</p>` : ""}
    `;
    reviewList.appendChild(item);
  });
}

retryQuizBtn.addEventListener("click", () => {
  quizResult.hidden = true;
  quizStart.hidden = false;
});

/* ---------- Save score to the leaderboard ----------
   One document per signed-in user (doc id = uid), tracking their
   AVERAGE percentage across every quiz they've taken (not just their
   best attempt) — that's what the leaderboard ranks by. We also keep
   their best single attempt for display alongside the average.

   The same figures are tracked per class under `classStats`, keyed by
   class level ("8" / "9" / "10"), which is what the leaderboard's class
   filter ranks by. A quiz taken with Class = "All classes" is a mixed
   bag, so it counts towards the overall board only and is deliberately
   left out of every per-class average.
------------------------------------------------------------------ */
const leaderboardStatus = document.getElementById("leaderboardStatus");

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
      const attempts = (prev.attempts || 0) + 1;
      const percentageSum = (prev.percentageSum || 0) + pct;
      const averagePercentage = percentageSum / attempts;
      const isNewBest = pct >= (prev.bestPercentage || 0);

      // Per-class running totals. Untouched classes carry over as-is.
      const classStats = { ...(prev.classStats || {}) };
      if (cls !== "All") {
        const prevC = classStats[cls] || {};
        const cAttempts = (prevC.attempts || 0) + 1;
        const cSum = (prevC.percentageSum || 0) + pct;
        const cIsNewBest = pct >= (prevC.bestPercentage || 0);
        classStats[cls] = {
          attempts: cAttempts,
          percentageSum: cSum,
          averagePercentage: cSum / cAttempts,
          bestPercentage: cIsNewBest ? pct : prevC.bestPercentage || 0,
          bestScore: cIsNewBest ? rawScore : prevC.bestScore || 0,
          bestTotal: cIsNewBest ? total : prevC.bestTotal || 0,
        };
      }

      tx.set(scoreRef, {
        name: user.email.split("@")[0],
        email: user.email,
        attempts,
        percentageSum,
        averagePercentage,
        bestPercentage: isNewBest ? pct : prev.bestPercentage || 0,
        bestScore: isNewBest ? rawScore : prev.bestScore || 0,
        bestTotal: isNewBest ? total : prev.bestTotal || 0,
        lastPercentage: pct,
        lastCategory: category === "All" ? "" : category,
        lastClass: cls === "All" ? "" : cls,
        classStats,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      return {
        attempts,
        averagePercentage,
        classAverage: cls === "All" ? null : classStats[cls].averagePercentage,
      };
    });
  })
    .then(({ attempts, averagePercentage, classAverage }) => {
      const overall = `your overall average is now ${Math.round(averagePercentage)}% across ${attempts} attempt${attempts === 1 ? "" : "s"}`;
      const perClass =
        classAverage === null
          ? ` Mixed-class quizzes only count towards the overall board.`
          : ` Your Class ${cls} average is ${Math.round(classAverage)}%.`;
      leaderboardStatus.innerHTML = `Saved — ${overall}.${perClass} Check the <a href="leaderboard.html">Leaderboard</a>.`;
    })
    .catch((err) => {
      leaderboardStatus.textContent = `Could not save score (${err.message}).`;
    });
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
