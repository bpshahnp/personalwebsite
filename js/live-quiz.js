/* ============================================
   live-quiz.js — 7-Day Live Quiz Tournament Engine
   with Daily Question Renewal, Weekly Reset,
   Live Countdown Timer, Speed Bonuses, and Leaderboard.
   ============================================ */

(function () {
  const QUESTION_TIME_LIMIT = 25; // seconds per question
  const BASE_POINTS_PER_CORRECT = 100;
  const MAX_SPEED_BONUS = 50;
  const QUIZ_SIZE = 10;
  const SOUND_KEY = "mcqSound";

  // State
  let currentQuestions = [];
  let currentQuestionIndex = 0;
  let correctCount = 0;
  let totalPointsEarned = 0;
  let speedBonusTotal = 0;
  let timerInterval = null;
  let secondsRemaining = QUESTION_TIME_LIMIT;
  let questionAnswered = false;
  let selectedClass = "All";
  let soundOn = localStorage.getItem(SOUND_KEY) !== "off";
  let audioCtx = null;
  let currentWeekKey = "";
  let currentDayIndex = 1; // 1 (Mon) to 7 (Sun)
  let currentDayKey = "";
  let leaderboardDocs = [];
  let activeLeaderboardFilter = "today"; // "today" or "week"

  // DOM Elements
  const liveIntroCard = document.getElementById("liveIntroCard");
  const liveActiveCard = document.getElementById("liveActiveCard");
  const liveResultsCard = document.getElementById("liveResultsCard");
  const startLiveQuizBtn = document.getElementById("startLiveQuizBtn");
  const liveQuizStatusText = document.getElementById("liveQuizStatusText");
  const daysStepper = document.getElementById("daysStepper");
  const liveWeekLabel = document.getElementById("liveWeekLabel");
  const renewalCountdown = document.getElementById("renewalCountdown");
  const todayDayTag = document.getElementById("todayDayTag");
  const liveSoundBtn = document.getElementById("liveSoundBtn");
  const liveClassChips = document.getElementById("liveClassChips");

  // Active Quiz DOM
  const liveQIndex = document.getElementById("liveQIndex");
  const liveRunningPoints = document.getElementById("liveRunningPoints");
  const timerText = document.getElementById("timerText");
  const liveTimerSeconds = document.getElementById("liveTimerSeconds");
  const liveTimerFill = document.getElementById("liveTimerFill");
  const liveQCategory = document.getElementById("liveQCategory");
  const liveQText = document.getElementById("liveQText");
  const liveOptsGrid = document.getElementById("liveOptsGrid");
  const liveFeedbackBar = document.getElementById("liveFeedbackBar");
  const liveFeedbackText = document.getElementById("liveFeedbackText");
  const liveNextBtn = document.getElementById("liveNextBtn");

  // Results DOM
  const resultScore = document.getElementById("resultScore");
  const resultPoints = document.getElementById("resultPoints");
  const resultSpeedBonus = document.getElementById("resultSpeedBonus");
  const resultDayStreak = document.getElementById("resultDayStreak");
  const retakePracticeBtn = document.getElementById("retakePracticeBtn");

  // Leaderboard DOM
  const liveLeaderboardRows = document.getElementById("liveLeaderboardRows");
  const filterTodayBtn = document.getElementById("filterTodayBtn");
  const filterWeekBtn = document.getElementById("filterWeekBtn");

  /* ---------- Date & 7-Day Cycle Calculation ---------- */
  function getISOWeekData(d = new Date()) {
    const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNr = target.getUTCDay() || 7; // 1 = Mon, ..., 7 = Sun
    target.setUTCDate(target.getUTCDate() + 4 - dayNr);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
    const year = target.getUTCFullYear();
    const pad = (n) => String(n).padStart(2, "0");
    return {
      weekKey: `${year}-W${pad(weekNo)}`,
      weekNumber: weekNo,
      year: year,
      dayIndex: dayNr // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
    };
  }

  function initCycleInfo() {
    const data = getISOWeekData();
    currentWeekKey = data.weekKey;
    currentDayIndex = data.dayIndex;
    currentDayKey = `day_${currentDayIndex}`;

    if (liveWeekLabel) liveWeekLabel.textContent = `Week ${data.weekNumber} · ${data.year}`;
    if (todayDayTag) todayDayTag.textContent = `Today: Day ${currentDayIndex} of 7`;

    renderDaysStepper();
    startMidnightCountdown();
  }

  /* ---------- Midnight Countdown Clock ---------- */
  function startMidnightCountdown() {
    function updateClock() {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
      const diffMs = tomorrow - now;

      if (diffMs <= 0) {
        initCycleInfo();
        loadDailyQuestions();
        return;
      }

      const hrs = Math.floor(diffMs / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      const pad = (n) => String(n).padStart(2, "0");

      if (renewalCountdown) {
        renewalCountdown.textContent = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
      }
    }
    updateClock();
    setInterval(updateClock, 1000);
  }

  /* ---------- Render 7-Day Road-Map Stepper ---------- */
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function renderDaysStepper() {
    if (!daysStepper) return;
    daysStepper.innerHTML = "";

    for (let i = 1; i <= 7; i++) {
      const dayCard = document.createElement("div");
      dayCard.className = "day-chip";

      let status = "locked";
      let statusLabel = "Locked";
      let icon = "🔒";

      if (i < currentDayIndex) {
        status = "past";
        statusLabel = "Completed";
        icon = "✓";
        dayCard.classList.add("is-past");
      } else if (i === currentDayIndex) {
        status = "active";
        statusLabel = "Today";
        icon = "⚡";
        dayCard.classList.add("is-today");
      } else {
        dayCard.classList.add("is-locked");
      }

      dayCard.innerHTML = `
        <div class="day-chip-header">
          <span class="day-num">Day ${i}</span>
          <span class="day-icon">${icon}</span>
        </div>
        <div class="day-name">${DAY_NAMES[i - 1]}</div>
        <div class="day-status-pill ${status}">${statusLabel}</div>
      `;

      daysStepper.appendChild(dayCard);
    }
  }

  /* ---------- Sound Synthesis ---------- */
  function getAudioCtx() {
    if (audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { audioCtx = new AC(); } catch (e) { audioCtx = null; }
    return audioCtx;
  }

  function playTone(freq, duration, type = "sine") {
    if (!soundOn) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  function playTick() { playTone(880, 0.05, "triangle"); }
  function playCorrect() { playTone(587.33, 0.08); setTimeout(() => playTone(880, 0.18), 80); }
  function playWrong() { playTone(220, 0.2, "sawtooth"); }

  function updateSoundButton() {
    if (!liveSoundBtn) return;
    liveSoundBtn.textContent = soundOn ? "🔊 Sound on" : "🔇 Sound off";
    liveSoundBtn.setAttribute("aria-pressed", String(soundOn));
  }

  if (liveSoundBtn) {
    updateSoundButton();
    liveSoundBtn.addEventListener("click", () => {
      soundOn = !soundOn;
      localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
      updateSoundButton();
      if (soundOn) playTone(784, 0.1);
    });
  }

  /* ---------- Deterministic Seeded Shuffler ----------
     Guarantees that on a given day/week, all students receive
     the exact same question set in the exact same order! */
  function seededRandom(seed) {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  function stringToSeed(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) + 1;
  }

  function seededShuffle(array, seedStr) {
    const copy = [...array];
    let seed = stringToSeed(seedStr);
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(seed++) * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /* ---------- Question Fetching & Fallback ---------- */
  async function loadDailyQuestions() {
    if (liveQuizStatusText) liveQuizStatusText.textContent = "Loading questions for today…";
    if (startLiveQuizBtn) startLiveQuizBtn.disabled = true;

    try {
      // 1. Check if an admin scheduled custom questions for this day
      const customDocRef = db.collection("liveQuizQuestions").doc(`${currentWeekKey}_${currentDayKey}`);
      const customSnap = await customDocRef.get();

      if (customSnap.exists && Array.isArray(customSnap.data().questions) && customSnap.data().questions.length > 0) {
        currentQuestions = customSnap.data().questions.slice(0, QUIZ_SIZE);
        onQuestionsReady();
        return;
      }

      // 2. Fallback: Pull from main questions pool and deterministically sample
      const poolSnap = await db.collection("questions").get();
      let allQuestions = [];
      poolSnap.forEach((doc) => {
        const data = doc.data();
        if (data.question && Array.isArray(data.options) && data.options.length >= 2) {
          allQuestions.push({ id: doc.id, ...data });
        }
      });

      if (allQuestions.length === 0) {
        if (liveQuizStatusText) liveQuizStatusText.textContent = "No questions found in database.";
        return;
      }

      // Filter by class if selected
      let filtered = allQuestions;
      if (selectedClass !== "All") {
        filtered = allQuestions.filter((q) => {
          const raw = String(q.classLevel ?? q.class ?? "").match(/\d+/);
          const cls = raw ? raw[0] : "10";
          return cls === selectedClass;
        });
        if (filtered.length < QUIZ_SIZE) filtered = allQuestions;
      }

      // Deterministically shuffle with seed = currentWeekKey + currentDayKey + class
      const daySeed = `${currentWeekKey}_${currentDayKey}_class_${selectedClass}`;
      const shuffled = seededShuffle(filtered, daySeed);
      currentQuestions = shuffled.slice(0, Math.min(QUIZ_SIZE, shuffled.length));

      onQuestionsReady();
    } catch (err) {
      console.error("Error loading daily questions:", err);
      if (liveQuizStatusText) liveQuizStatusText.textContent = "Failed to load questions. Please check connection.";
    }
  }

  function onQuestionsReady() {
    if (startLiveQuizBtn) startLiveQuizBtn.disabled = false;
    if (liveQuizStatusText) {
      liveQuizStatusText.textContent = `${currentQuestions.length} live challenge questions ready for Day ${currentDayIndex}!`;
    }
  }

  /* ---------- Class Filter Chips ---------- */
  if (liveClassChips) {
    liveClassChips.addEventListener("click", (e) => {
      const chip = e.target.closest(".class-chip");
      if (!chip) return;
      liveClassChips.querySelectorAll(".class-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      selectedClass = chip.dataset.class;
      loadDailyQuestions();
    });
  }

  /* ---------- Start Quiz Trigger ---------- */
  if (startLiveQuizBtn) {
    startLiveQuizBtn.addEventListener("click", () => {
      const user = auth.currentUser;
      const isGuest = sessionStorage.getItem("mcqGuest") === "true";

      if (!user && !isGuest && typeof window.openMcqAuthModal === "function") {
        window.openMcqAuthModal(() => {
          startLiveQuiz();
        });
        return;
      }

      startLiveQuiz();
    });
  }

  function startLiveQuiz() {
    if (currentQuestions.length === 0) return;

    currentQuestionIndex = 0;
    correctCount = 0;
    totalPointsEarned = 0;
    speedBonusTotal = 0;

    liveIntroCard.hidden = true;
    liveResultsCard.hidden = true;
    liveActiveCard.hidden = false;

    renderQuestion(currentQuestionIndex);
  }

  /* ---------- Render Active Question ---------- */
  function renderQuestion(index) {
    questionAnswered = false;
    liveFeedbackBar.hidden = true;
    liveOptsGrid.innerHTML = "";

    const q = currentQuestions[index];
    if (!q) {
      finishQuiz();
      return;
    }

    liveQIndex.textContent = `Question ${index + 1} of ${currentQuestions.length}`;
    liveRunningPoints.textContent = `${totalPointsEarned} pts`;
    liveQCategory.textContent = q.category || "General Knowledge";
    liveQText.textContent = q.question;

    startQuestionTimer();

    const options = Array.isArray(q.options) ? q.options : [];
    const correctIdx = Number(q.correctIndex ?? 0);

    options.forEach((optText, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mcq-opt";
      btn.innerHTML = `<span class="opt-num">${i + 1}</span> <span>${optText}</span>`;
      btn.addEventListener("click", () => handleAnswer(i, correctIdx, q.explanation));
      liveOptsGrid.appendChild(btn);
    });
  }

  /* ---------- Countdown Timer Engine ---------- */
  function startQuestionTimer() {
    clearInterval(timerInterval);
    secondsRemaining = QUESTION_TIME_LIMIT;
    updateTimerVisuals();

    timerInterval = setInterval(() => {
      secondsRemaining--;
      updateTimerVisuals();

      if (secondsRemaining <= 5 && secondsRemaining > 0) {
        playTick();
      }

      if (secondsRemaining <= 0) {
        clearInterval(timerInterval);
        handleTimeout();
      }
    }, 1000);
  }

  function updateTimerVisuals() {
    if (timerText) timerText.textContent = `${secondsRemaining}s`;

    const pct = Math.max(0, (secondsRemaining / QUESTION_TIME_LIMIT) * 100);
    if (liveTimerFill) {
      liveTimerFill.style.width = `${pct}%`;

      if (secondsRemaining <= 5) {
        liveTimerFill.style.backgroundColor = "var(--q-wrong, #f87171)";
        liveTimerSeconds.classList.add("is-critical");
      } else if (secondsRemaining <= 10) {
        liveTimerFill.style.backgroundColor = "#fbbf24";
        liveTimerSeconds.classList.remove("is-critical");
      } else {
        liveTimerFill.style.backgroundColor = "var(--q-right, #4ade80)";
        liveTimerSeconds.classList.remove("is-critical");
      }
    }
  }

  /* ---------- Handle Answer & Speed Bonus ---------- */
  function handleAnswer(chosenIndex, correctIndex, explanation) {
    if (questionAnswered) return;
    questionAnswered = true;
    clearInterval(timerInterval);

    const isCorrect = chosenIndex === correctIndex;
    const optButtons = liveOptsGrid.querySelectorAll(".mcq-opt");

    optButtons.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === correctIndex) btn.classList.add("is-correct");
      if (idx === chosenIndex && !isCorrect) btn.classList.add("is-wrong");
    });

    if (isCorrect) {
      playCorrect();
      correctCount++;
      const speedBonus = Math.round((secondsRemaining / QUESTION_TIME_LIMIT) * MAX_SPEED_BONUS);
      speedBonusTotal += speedBonus;
      const questionPoints = BASE_POINTS_PER_CORRECT + speedBonus;
      totalPointsEarned += questionPoints;

      liveRunningPoints.textContent = `${totalPointsEarned} pts`;
      showFeedback(`🎉 Correct! +${BASE_POINTS_PER_CORRECT} pts ${speedBonus > 0 ? `(+${speedBonus} speed bonus ⚡)` : ""}`, true, explanation);
    } else {
      playWrong();
      showFeedback(`Incorrect. The correct answer is Option ${correctIndex + 1}.`, false, explanation);
    }
  }

  function handleTimeout() {
    if (questionAnswered) return;
    questionAnswered = true;
    playWrong();

    const q = currentQuestions[currentQuestionIndex];
    const correctIndex = Number(q.correctIndex ?? 0);
    const optButtons = liveOptsGrid.querySelectorAll(".mcq-opt");

    optButtons.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === correctIndex) btn.classList.add("is-correct");
    });

    showFeedback(`⏰ Time's up! The correct answer was Option ${correctIndex + 1}.`, false, q.explanation);
  }

  function showFeedback(msg, isSuccess, explanation) {
    liveFeedbackBar.hidden = false;
    let text = msg;
    if (explanation) {
      text += ` <br/><small class="quiz-muted">${explanation}</small>`;
    }
    liveFeedbackText.innerHTML = text;
    liveFeedbackBar.classList.toggle("is-correct-bar", isSuccess);
    liveFeedbackBar.classList.toggle("is-wrong-bar", !isSuccess);
  }

  if (liveNextBtn) {
    liveNextBtn.addEventListener("click", () => {
      currentQuestionIndex++;
      if (currentQuestionIndex < currentQuestions.length) {
        renderQuestion(currentQuestionIndex);
      } else {
        finishQuiz();
      }
    });
  }

  // Keyboard navigation (Keys 1-4 to answer, Space/Enter to advance)
  window.addEventListener("keydown", (e) => {
    if (liveActiveCard.hidden) return;

    if (!questionAnswered) {
      const keyNum = parseInt(e.key, 10);
      if (keyNum >= 1 && keyNum <= 4) {
        const btn = liveOptsGrid.querySelectorAll(".mcq-opt")[keyNum - 1];
        if (btn && !btn.disabled) btn.click();
      }
    } else if (!liveFeedbackBar.hidden && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      liveNextBtn.click();
    }
  });

  /* ---------- Finish Quiz & Save Results ---------- */
  async function finishQuiz() {
    clearInterval(timerInterval);
    liveActiveCard.hidden = true;
    liveResultsCard.hidden = false;

    resultScore.textContent = `${correctCount}/${currentQuestions.length}`;
    resultPoints.textContent = totalPointsEarned.toLocaleString();
    resultSpeedBonus.textContent = `+${speedBonusTotal}`;
    resultDayStreak.textContent = `Day ${currentDayIndex} of 7`;

    // Save to Firestore if user is authenticated
    const user = auth.currentUser;
    if (user && db) {
      try {
        const scoreDocRef = db.collection("liveQuizScores").doc(`${user.uid}_${currentWeekKey}`);
        await scoreDocRef.set({
          userId: user.uid,
          userName: user.displayName || user.email.split("@")[0] || "Learner",
          userEmail: user.email || "",
          weekKey: currentWeekKey,
          [`days.${currentDayKey}`]: {
            score: correctCount,
            totalQuestions: currentQuestions.length,
            points: totalPointsEarned,
            speedBonus: speedBonusTotal,
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
          },
          lastPlayedDay: currentDayIndex,
          totalPoints: firebase.firestore.FieldValue.increment(totalPointsEarned),
          totalCorrect: firebase.firestore.FieldValue.increment(correctCount),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log("Live quiz score saved successfully!");
      } catch (err) {
        console.error("Error saving live quiz score:", err);
      }
    }
  }

  if (retakePracticeBtn) {
    retakePracticeBtn.addEventListener("click", () => {
      startLiveQuiz();
    });
  }

  /* ---------- Real-Time Weekly Live Leaderboard ---------- */
  function subscribeLeaderboard() {
    if (!db) return;

    db.collection("liveQuizScores")
      .where("weekKey", "==", currentWeekKey)
      .limit(50)
      .onSnapshot(
        (snapshot) => {
          leaderboardDocs = snapshot.docs.map((doc) => doc.data());
          renderLeaderboard();
        },
        (err) => {
          console.error("Error fetching live leaderboard:", err);
          if (liveLeaderboardRows) {
            liveLeaderboardRows.innerHTML = '<p class="updates-loading">Could not load leaderboard.</p>';
          }
        }
      );
  }

  function renderLeaderboard() {
    if (!liveLeaderboardRows) return;

    let items = leaderboardDocs.map((doc) => {
      const dayData = doc.days ? doc.days[currentDayKey] : null;
      const dayPoints = dayData ? Number(dayData.points || 0) : 0;
      const weekPoints = Number(doc.totalPoints || 0);
      const daysCount = doc.days ? Object.keys(doc.days).length : 0;

      return {
        userId: doc.userId,
        name: doc.userName || "Learner",
        dayPoints: dayPoints,
        weekPoints: weekPoints,
        daysPlayed: daysCount
      };
    });

    if (activeLeaderboardFilter === "today") {
      items = items.filter((x) => x.dayPoints > 0).sort((a, b) => b.dayPoints - a.dayPoints);
    } else {
      items.sort((a, b) => b.weekPoints - a.weekPoints);
    }

    if (items.length === 0) {
      liveLeaderboardRows.innerHTML = `
        <div class="leaderboard-empty" style="text-align:center; padding:32px; color:var(--mist);">
          No scores posted yet for ${activeLeaderboardFilter === "today" ? "today" : "this week"}. Be the first to play!
        </div>
      `;
      return;
    }

    const currentUid = auth.currentUser ? auth.currentUser.uid : null;
    let html = "";

    items.forEach((player, idx) => {
      const rank = idx + 1;
      const isMe = currentUid && player.userId === currentUid;
      const pointsToShow = activeLeaderboardFilter === "today" ? player.dayPoints : player.weekPoints;

      let rankMedal = `#${rank}`;
      if (rank === 1) rankMedal = "🥇 1";
      if (rank === 2) rankMedal = "🥈 2";
      if (rank === 3) rankMedal = "🥉 3";

      html += `
        <div class="leaderboard-row ${isMe ? "is-you" : ""}">
          <span class="rank-col"><strong>${rankMedal}</strong></span>
          <span class="name-col">${escapeHtml(player.name)} ${isMe ? '<em class="you-badge">(You)</em>' : ""}</span>
          <span class="days-col">${player.daysPlayed} / 7 days</span>
          <span class="points-col"><strong>${pointsToShow.toLocaleString()}</strong> pts</span>
        </div>
      `;
    });

    liveLeaderboardRows.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[m]);
  }

  if (filterTodayBtn && filterWeekBtn) {
    filterTodayBtn.addEventListener("click", () => {
      filterTodayBtn.classList.add("active");
      filterWeekBtn.classList.remove("active");
      activeLeaderboardFilter = "today";
      renderLeaderboard();
    });

    filterWeekBtn.addEventListener("click", () => {
      filterWeekBtn.classList.add("active");
      filterTodayBtn.classList.remove("active");
      activeLeaderboardFilter = "week";
      renderLeaderboard();
    });
  }

  /* ---------- Initialize on Load ---------- */
  initCycleInfo();
  loadDailyQuestions();
  subscribeLeaderboard();

})();
