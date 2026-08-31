/* ============================================
   mcq.js — quiz engine with live scoring.
   Reads the "questions" Firestore collection:
   {
     question: string,
     options: [string, string, string, string],
     correctIndex: number,
     explanation: string,
     category: string,
     order: number
   }
   ============================================ */

const quizStart = document.getElementById("quizStart");
const quizPlay = document.getElementById("quizPlay");
const quizResult = document.getElementById("quizResult");

const questionBankStatus = document.getElementById("questionBankStatus");
const categorySelect = document.getElementById("categorySelect");
const countSelect = document.getElementById("countSelect");
const startQuizBtn = document.getElementById("startQuizBtn");

const quizProgress = document.getElementById("quizProgress");
const quizScore = document.getElementById("quizScore");
const quizProgressFill = document.getElementById("quizProgressFill");
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
    questionBank = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (!questionBank.length) {
      questionBankStatus.textContent = "No questions yet — add some from the Admin Panel.";
      return;
    }
    const categories = ["All", ...new Set(questionBank.map((q) => q.category).filter(Boolean))];
    categorySelect.innerHTML = categories
      .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
      .join("");
    questionBankStatus.textContent = `${questionBank.length} question${questionBank.length === 1 ? "" : "s"} available.`;
    startQuizBtn.disabled = false;
  })
  .catch((err) => {
    questionBankStatus.textContent = `Could not load questions (${err.message}).`;
  });

/* ---------- Start quiz ---------- */
startQuizBtn.addEventListener("click", () => {
  const category = categorySelect.value;
  const countValue = countSelect.value;

  let pool = category === "All" ? [...questionBank] : questionBank.filter((q) => q.category === category);
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

/* ---------- Save personal-best score to the leaderboard ----------
   One document per signed-in user (doc id = uid). Only overwrites
   if this attempt beats their previous best percentage.
------------------------------------------------------------------ */
const leaderboardStatus = document.getElementById("leaderboardStatus");

function saveScoreToLeaderboard(rawScore, total, pct) {
  const user = auth.currentUser;
  if (!user) {
    leaderboardStatus.innerHTML = `Log in (top-right 👤) to save this score to the <a href="leaderboard.html">Leaderboard</a>.`;
    return;
  }

  const category = categorySelect.value;
  const scoreRef = db.collection("scores").doc(user.uid);

  scoreRef
    .get()
    .then((doc) => {
      const isNewBest = !doc.exists || pct > doc.data().percentage || (pct === doc.data().percentage && total > doc.data().total);
      if (!isNewBest) {
        leaderboardStatus.innerHTML = `That's below your personal best. Check the <a href="leaderboard.html">Leaderboard</a>.`;
        return;
      }
      return scoreRef
        .set({
          name: user.email.split("@")[0],
          email: user.email,
          score: rawScore,
          total,
          percentage: pct,
          category: category === "All" ? "" : category,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
        .then(() => {
          leaderboardStatus.innerHTML = `New personal best saved! Check the <a href="leaderboard.html">Leaderboard</a>.`;
        });
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
