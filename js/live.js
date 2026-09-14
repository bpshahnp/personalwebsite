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
  let selectedClass = "All"; // Always mixed — no class filter in Live Quiz
  let soundOn = localStorage.getItem(SOUND_KEY) !== "off";
  let audioCtx = null;
  let currentWeekKey = "";
  let currentDayIndex = 1; // 1 (Mon) to 7 (Sun)
  let currentDayKey = "";
  let leaderboardDocs = [];
  let activeLeaderboardFilter = "today"; // "today" or "week"
  let isPracticeMode = false;

  // DOM Elements
  const liveIntroCard = document.getElementById("liveIntroCard");
  const liveActiveCard = document.getElementById("liveActiveCard");
  const liveResultsCard = document.getElementById("liveResultsCard");
  const startLiveQuizBtn = document.getElementById("startLiveQuizBtn");
  const startWarmupBtn = document.getElementById("startWarmupBtn");
  const liveQuizStatusText = document.getElementById("liveQuizStatusText");
  const daysStepper = document.getElementById("daysStepper");
  const liveWeekLabel = document.getElementById("liveWeekLabel");
  const renewalCountdown = document.getElementById("renewalCountdown");
  const todayDayTag = document.getElementById("todayDayTag");
  const liveSoundBtn = document.getElementById("liveSoundBtn");

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
  const resultSubline = document.getElementById("resultSubline");
  const retakePracticeBtn = document.getElementById("retakePracticeBtn");

  // Leaderboard DOM
  const liveLeaderboardRows = document.getElementById("liveLeaderboardRows");
  const filterTodayBtn = document.getElementById("filterTodayBtn");
  const filterWeekBtn = document.getElementById("filterWeekBtn");

  // Class filter chips (optional element — not present in Live Quiz, so may be null)
  const liveClassChips = document.getElementById("liveClassChips");

  /* ---------- Date & 7-Day Cycle Calculation ---------- */
  // The 7-Day tournament runs strictly Monday (Day 1) to Sunday (Day 7).
  // Official Launch: Monday, September 14, 2026 00:00:00 local time.
  const TOURNAMENT_LAUNCH_DATE = new Date(2026, 8, 14, 0, 0, 0); // Sep 14, 2026

  function isBeforeTournamentLaunch() {
    return new Date() < TOURNAMENT_LAUNCH_DATE;
  }

  function getTournamentWeekData(d = new Date()) {
    // 1 = Monday (Day 1) through 7 = Sunday (Day 7)
    const localDay = d.getDay();
    const dayNr = localDay === 0 ? 7 : localDay;

    // ISO week number calculation based on the current Thursday
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    target.setDate(target.getDate() + 4 - dayNr);
    const yearStart = new Date(target.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
    const year = target.getFullYear();
    const pad = (n) => String(n).padStart(2, "0");

    return {
      weekKey: `${year}-W${pad(weekNo)}`,
      weekNumber: weekNo,
      year: year,
      dayIndex: dayNr // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
    };
  }

  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function initCycleInfo() {
    const isComingSoon = isBeforeTournamentLaunch();
    const data = getTournamentWeekData(isComingSoon ? TOURNAMENT_LAUNCH_DATE : new Date());
    currentWeekKey = data.weekKey;
    currentDayIndex = isComingSoon ? 1 : data.dayIndex;
    currentDayKey = `day_${currentDayIndex}`;

    const renewalLabelEl = document.querySelector(".renewal-label");
    const livePillEl = document.querySelector(".live-pill");
    const todayTitleEl = document.getElementById("todayTitle");

    if (isComingSoon) {
      if (livePillEl) {
        livePillEl.innerHTML = `<span class="live-dot" style="background:#fbbf24"></span> COMING SOON`;
      }
      if (liveWeekLabel) {
        liveWeekLabel.textContent = `Starts Mon, Sep 14`;
      }
      if (todayDayTag) {
        todayDayTag.textContent = `Day 1 Starts This Monday`;
      }
      if (todayTitleEl) {
        todayTitleEl.textContent = `7-Day Live Tournament Coming Soon`;
      }
      if (renewalLabelEl) {
        renewalLabelEl.textContent = `Tournament kicks off in:`;
      }
    } else {
      if (livePillEl) {
        livePillEl.innerHTML = `<span class="live-dot"></span> LIVE WEEKLY CHALLENGE`;
      }
      if (liveWeekLabel) {
        liveWeekLabel.textContent = `Week ${data.weekNumber} · ${data.year}`;
      }
      if (todayDayTag) {
        todayDayTag.textContent = `Today: Day ${currentDayIndex} of 7 (${DAY_NAMES[currentDayIndex - 1]})`;
      }
      if (todayTitleEl) {
        todayTitleEl.textContent = `Today's Timed Challenge`;
      }
      if (renewalLabelEl) {
        renewalLabelEl.textContent = currentDayIndex === 7 ? `Weekly tournament ends in:` : `Next day's questions unlock in:`;
      }
    }

    renderDaysStepper();
    startCountdownClock();
  }

  /* ---------- Countdown Clock (Launch Countdown OR Daily Reset) ---------- */
  function startCountdownClock() {
    function updateClock() {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");

      if (isBeforeTournamentLaunch()) {
        const diffMs = TOURNAMENT_LAUNCH_DATE - now;
        if (diffMs <= 0) {
          initCycleInfo();
          loadDailyQuestions();
          return;
        }

        const days = Math.floor(diffMs / 86400000);
        const hrs = Math.floor((diffMs % 86400000) / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);

        if (renewalCountdown) {
          renewalCountdown.textContent = `${days}d ${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
        }
      } else {
        // Active tournament: counts down to next day's midnight
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

        if (renewalCountdown) {
          renewalCountdown.textContent = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
        }
      }
    }

    updateClock();
    setInterval(updateClock, 1000);
  }

  /* ---------- Render 7-Day Road-Map Stepper ---------- */
  function renderDaysStepper() {
    if (!daysStepper) return;
    daysStepper.innerHTML = "";
    const isComingSoon = isBeforeTournamentLaunch();

    for (let i = 1; i <= 7; i++) {
      const dayCard = document.createElement("div");
      dayCard.className = "day-chip";

      let status = "locked";
      let statusLabel = "Locked";
      let icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

      if (isComingSoon) {
        if (i === 1) {
          status = "active";
          statusLabel = "Starts Mon";
          icon = "●";
          dayCard.classList.add("is-today");
        } else {
          status = "locked";
          statusLabel = "Locked";
          icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
          dayCard.classList.add("is-locked");
        }
      } else {
        if (i < currentDayIndex) {
          status = "past";
          statusLabel = "Completed";
          icon = "✓";
          dayCard.classList.add("is-past");
        } else if (i === currentDayIndex) {
          status = "active";
          statusLabel = "Today";
          icon = "●";
          dayCard.classList.add("is-today");
        } else {
          status = "locked";
          statusLabel = "Locked";
          icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
          dayCard.classList.add("is-locked");
        }
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

    // On mobile, automatically scroll the active "Today" day into center view
    setTimeout(() => {
      const todayEl = daysStepper.querySelector(".is-today");
      if (todayEl && window.innerWidth <= 600) {
        todayEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }, 100);
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
    liveSoundBtn.textContent = soundOn ? "Sound: On" : "Sound: Off";
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
    const isComingSoon = isBeforeTournamentLaunch();
    if (isComingSoon) {
      if (startLiveQuizBtn) {
        startLiveQuizBtn.disabled = true;
        startLiveQuizBtn.textContent = "Tournament Starts This Monday (Day 1)";
        startLiveQuizBtn.style.opacity = "0.75";
        startLiveQuizBtn.style.cursor = "not-allowed";
      }
      if (startWarmupBtn) {
        startWarmupBtn.hidden = false;
      }
      if (liveQuizStatusText) {
        liveQuizStatusText.innerHTML = `<strong>The 7-Day Challenge officially starts on Monday, Sep 14.</strong> Try an unranked warm-up quiz above to test your speed!`;
      }
    } else {
      if (startLiveQuizBtn) {
        startLiveQuizBtn.disabled = false;
        startLiveQuizBtn.textContent = `Start Day ${currentDayIndex} Live Quiz →`;
        startLiveQuizBtn.style.opacity = "";
        startLiveQuizBtn.style.cursor = "pointer";
      }
      if (startWarmupBtn) {
        startWarmupBtn.hidden = true;
      }
      if (liveQuizStatusText) {
        liveQuizStatusText.textContent = `${currentQuestions.length} live challenge questions ready for Day ${currentDayIndex} (${DAY_NAMES[currentDayIndex - 1]})!`;
      }
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
      if (isBeforeTournamentLaunch()) return;
      startLiveQuiz(false);
    });
  }

  // startWarmupBtn is now an <a href="mcq.html"> link — no JS handler needed.


  function startLiveQuiz(practice = false) {
    if (currentQuestions.length === 0) return;

    isPracticeMode = practice || isBeforeTournamentLaunch();
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
      showFeedback(`Correct! +${BASE_POINTS_PER_CORRECT} pts ${speedBonus > 0 ? `(+${speedBonus} speed bonus)` : ""}`, true, explanation);
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
    if (!liveActiveCard || liveActiveCard.hidden) return;

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

  // Helper to compute time buckets for the main leaderboard
  function getTimeBuckets() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const day = `day_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const month = `month_${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const d1 = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = d1.getUTCDay() || 7;
    d1.setUTCDate(d1.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d1.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d1 - yearStart) / 86400000) + 1) / 7);
    const week = `week_${d1.getUTCFullYear()}-W${pad(weekNo)}`;
    return { day, week, month, all: "all_time" };
  }

  /* ---------- Save Score to Firestore ---------- */
  async function saveScoreToDatabase(user, pointsEarned, correctCnt, speedBonus) {
    if (!user || !db) return false;

    try {
      // 1. Save to liveQuizScores for the 7-Day Live Tournament leaderboard
      const scoreDocRef = db.collection("liveQuizScores").doc(`${user.uid}_${currentWeekKey}`);
      let prevDayPoints = 0;
      let prevDayCorrect = 0;

      try {
        const existingDoc = await scoreDocRef.get();
        if (existingDoc.exists) {
          const d = existingDoc.data();
          const prevDay = d.days ? d.days[currentDayKey] : (d[`days.${currentDayKey}`] || null);
          if (prevDay) {
            prevDayPoints = Number(prevDay.points || 0);
            prevDayCorrect = Number(prevDay.score || 0);
          }
        }
      } catch (readErr) {
        console.warn("Could not read previous day score:", readErr);
      }

      // Only add point difference if replaying today's challenge
      const deltaPoints = Math.max(0, pointsEarned - prevDayPoints);
      const deltaCorrect = Math.max(0, correctCnt - prevDayCorrect);

      await scoreDocRef.set({
        userId: user.uid,
        userName: user.displayName || user.email.split("@")[0] || "Learner",
        userEmail: user.email || "",
        weekKey: currentWeekKey,
        days: {
          [currentDayKey]: {
            score: Math.max(correctCnt, prevDayCorrect),
            totalQuestions: currentQuestions.length || QUIZ_SIZE,
            points: Math.max(pointsEarned, prevDayPoints),
            speedBonus: speedBonus,
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
          }
        },
        lastPlayedDay: currentDayIndex,
        totalPoints: firebase.firestore.FieldValue.increment(deltaPoints),
        totalCorrect: firebase.firestore.FieldValue.increment(deltaCorrect),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // 2. Also save to main 'scores' collection so leaderboard.html updates!
      try {
        const mainScoreRef = db.collection("scores").doc(user.uid);
        const buckets = getTimeBuckets();
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(mainScoreRef);
          const prev = doc.exists ? doc.data() : {};
          const points = prev.points || {};
          if (!points["All"]) points["All"] = {};

          points["All"][buckets.day] = (points["All"][buckets.day] || 0) + deltaPoints;
          points["All"][buckets.week] = (points["All"][buckets.week] || 0) + deltaPoints;
          points["All"][buckets.month] = (points["All"][buckets.month] || 0) + deltaPoints;
          points["All"][buckets.all] = (points["All"][buckets.all] || 0) + deltaPoints;

          const attempts = (prev.attempts || 0) + 1;
          tx.set(mainScoreRef, {
            name: user.displayName || user.email.split("@")[0] || "Learner",
            email: user.email || "",
            lastCategory: "Live Tournament",
            lastScore: pointsEarned,
            attempts: attempts,
            points: points,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        });
      } catch (mainErr) {
        console.warn("Could not sync with main leaderboard:", mainErr);
      }

      console.log("Live tournament and main leaderboard scores saved successfully!");
      return true;
    } catch (err) {
      console.error("Error saving live quiz score:", err);
      return false;
    }
  }

  /* ---------- Finish Quiz & Save Results ---------- */
  async function finishQuiz() {
    clearInterval(timerInterval);
    liveActiveCard.hidden = true;
    liveResultsCard.hidden = false;

    const resultHeadline = document.getElementById("resultHeadline");
    resultScore.textContent = `${correctCount}/${currentQuestions.length}`;
    resultPoints.textContent = totalPointsEarned.toLocaleString();
    resultSpeedBonus.textContent = `+${speedBonusTotal}`;

    if (isPracticeMode) {
      if (resultHeadline) resultHeadline.textContent = "Warm-up Practice Complete!";
      resultDayStreak.textContent = "Practice Round";
      if (resultSubline) {
        resultSubline.innerHTML = `Great warm-up! You scored <strong>${totalPointsEarned} pts</strong> (${correctCount}/${currentQuestions.length} correct). The official 7-Day Tournament kicks off <strong>this Monday (Day 1)</strong>!`;
      }
      return; // Do not submit practice scores to tournament leaderboard
    }

    if (resultHeadline) resultHeadline.textContent = "Day Challenge Complete!";
    resultDayStreak.textContent = `Day ${currentDayIndex} of 7`;

    const user = auth.currentUser;
    if (user) {
      if (resultSubline) {
        resultSubline.innerHTML = `Saving your score of <strong>${totalPointsEarned} pts</strong> to the leaderboard…`;
      }
      const saved = await saveScoreToDatabase(user, totalPointsEarned, correctCount, speedBonusTotal);
      if (saved && resultSubline) {
        resultSubline.innerHTML = `Great effort! Your score of <strong>${totalPointsEarned} pts</strong> has been added to the leaderboard.`;
        document.dispatchEvent(new CustomEvent("premiumCheckReady"));
      } else if (!saved && resultSubline) {
        resultSubline.innerHTML = `Score calculated, but could not sync with leaderboard. Check your network or permissions.`;
      }
    } else {
      // Guest user — store score temporarily and show login callout
      try {
        sessionStorage.setItem("pendingLiveScore", JSON.stringify({
          points: totalPointsEarned,
          correct: correctCount,
          bonus: speedBonusTotal,
          weekKey: currentWeekKey,
          dayKey: currentDayKey,
          timestamp: Date.now()
        }));
      } catch (e) {}

      if (resultSubline) {
        resultSubline.innerHTML = `<strong>Playing as Guest:</strong> <a href="#" id="resultLoginLink" style="color:var(--orange);font-weight:700;text-decoration:underline;">Sign in or create a free account</a> to save your <strong>${totalPointsEarned} pts</strong> to the Leaderboard!`;
        const link = document.getElementById("resultLoginLink");
        if (link) {
          link.addEventListener("click", (e) => {
            e.preventDefault();
            if (typeof window.openAuthModal === "function") {
              window.openAuthModal({ mode: "signin" });
            } else {
              const btn = document.getElementById("authIconBtn");
              if (btn) btn.click();
            }
          });
        }
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
      // Support both nested map doc.days.day_X and legacy dotted keys doc["days.day_X"]
      let dayData = null;
      if (doc.days && doc.days[currentDayKey]) {
        dayData = doc.days[currentDayKey];
      } else if (doc[`days.${currentDayKey}`]) {
        dayData = doc[`days.${currentDayKey}`];
      }

      const dayPoints = dayData ? Number(dayData.points || 0) : 0;
      const weekPoints = Number(doc.totalPoints || 0);

      let daysCount = 0;
      if (doc.days && typeof doc.days === "object") {
        daysCount = Object.keys(doc.days).length;
      } else {
        daysCount = Object.keys(doc).filter((k) => k.startsWith("days.day_")).length;
      }

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
      items = items.filter((x) => x.weekPoints > 0).sort((a, b) => b.weekPoints - a.weekPoints);
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

      const rankMedal = `#${rank}`;

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

  // Listen for auth state changes (login / logout)
  document.addEventListener("authchange", async (e) => {
    const user = e.detail ? e.detail.user : auth.currentUser;
    renderLeaderboard();

    // If guest just logged in and had a pending score from this session, save it immediately!
    const pendingRaw = sessionStorage.getItem("pendingLiveScore");
    if (user && pendingRaw) {
      try {
        const pending = JSON.parse(pendingRaw);
        sessionStorage.removeItem("pendingLiveScore");
        if (resultSubline) {
          resultSubline.innerHTML = `Saving pending score of <strong>${pending.points} pts</strong> for <strong>${user.displayName || user.email}</strong>…`;
        }
        const saved = await saveScoreToDatabase(user, pending.points, pending.correct, pending.bonus);
        if (saved && resultSubline) {
          resultSubline.innerHTML = `Score of <strong>${pending.points} pts</strong> saved to the leaderboard as <strong>${user.displayName || user.email}</strong>!`;
          document.dispatchEvent(new CustomEvent("premiumCheckReady"));
        }
      } catch (err) {
        console.error("Error auto-saving pending score on login:", err);
      }
    }
  });

  /* ---------- Initialize on Load ---------- */
  initCycleInfo();
  loadDailyQuestions();
  subscribeLeaderboard();

  /* ============================================================
     PREMIUM QUIZ ENGINE — CREDITS, PAYMENTS & ARENA DASHBOARD
     ============================================================ */

  // DOM Elements - Arena Modal
  const premiumModalOverlay       = document.getElementById("premiumModalOverlay");
  const closePremiumModalBtn      = document.getElementById("closePremiumModalBtn");
  const openPremiumModalBtn       = document.getElementById("openPremiumModalBtn");
  const openPremiumArenaBtn       = document.getElementById("openPremiumArenaBtn");
  const openBuyCreditsFromArenaBtn= document.getElementById("openBuyCreditsFromArenaBtn");
  const premiumCategoryCardsGrid  = document.getElementById("premiumCategoryCardsGrid");
  const premiumArenaTitle         = document.getElementById("premiumArenaTitle");
  const premiumArenaSubtitle      = document.getElementById("premiumArenaSubtitle");
  const premiumBanner             = document.getElementById("premiumAccessBanner");

  // DOM Elements - Buy Credits Modal
  const buyCreditsModal           = document.getElementById("buyCreditsModal");
  const closeBuyCreditsModalBtn   = document.getElementById("closeBuyCreditsModalBtn");
  const googleStatusText          = document.getElementById("googleStatusText");
  const buyModalGoogleBtn         = document.getElementById("buyModalGoogleBtn");
  const phoneStatusText           = document.getElementById("phoneStatusText");
  const userPhoneInput            = document.getElementById("userPhoneInput");
  const savePhoneBtn              = document.getElementById("savePhoneBtn");
  const selectedPackAmountText    = document.getElementById("selectedPackAmountText");
  const payWithKhaltiBtn          = document.getElementById("payWithKhaltiBtn");
  const payWithEsewaBtn           = document.getElementById("payWithEsewaBtn");
  const paymentActionStatus       = document.getElementById("paymentActionStatus");

  // DOM Elements - Active Quiz & Results
  const premiumActiveCard         = document.getElementById("premiumActiveCard");
  const premiumResultsCard        = document.getElementById("premiumResultsCard");
  const premiumQIndex             = document.getElementById("premiumQIndex");
  const premiumRunningPts         = document.getElementById("premiumRunningPoints");
  const premiumTimerTxt           = document.getElementById("premiumTimerText");
  const premiumTimerFill          = document.getElementById("premiumTimerFill");
  const premiumTimerSec           = document.getElementById("premiumTimerSeconds");
  const premiumQCat               = document.getElementById("premiumQCategory");
  const premiumQTxt               = document.getElementById("premiumQText");
  const premiumOptsGrid           = document.getElementById("premiumOptsGrid");
  const premiumFbBar              = document.getElementById("premiumFeedbackBar");
  const premiumFbText             = document.getElementById("premiumFeedbackText");
  const premiumNextBtn            = document.getElementById("premiumNextBtn");
  const premiumResSub             = document.getElementById("premiumResultSubline");
  const premiumResScore           = document.getElementById("premiumResultScore");
  const premiumResPts             = document.getElementById("premiumResultPoints");
  const premiumResBonus           = document.getElementById("premiumResultBonus");
  const premiumResCat             = document.getElementById("premiumResultCat");
  const premiumBackModal          = document.getElementById("premiumBackToModalBtn");
  const premiumBackIntro          = document.getElementById("premiumBackToIntroBtn");

  // State
  let userCredits        = 2; // Default 2 credits
  let isWeeklyChampion   = false;
  let currentUserProfile = null;
  let pCategories        = [];
  let pQuestions         = [];
  let pQIdx              = 0;
  let pCorrect           = 0;
  let pPts               = 0;
  let pSpeedBon          = 0;
  let pAnswered          = false;
  let pTimer             = null;
  let pSecs              = QUESTION_TIME_LIMIT;
  let pCatName           = "";
  let pMinScore          = 50;

  // Selected Credit Package (Default 5 credits for NPR 50)
  let selectedPackCredits = 5;
  let selectedPackAmount  = 50;

  // Payment Gateway Config (Loaded from siteSettings/payment)
  let paymentConfig = {
    khaltiSecretKey:   "",   // Khalti live_secret_key from admin panel
    esewaMerchantCode: "EPAYTEST",
    esewaSecretKey:    "8gBm/:&EnhH.1/q", // eSewa test secret; replace in admin panel for production
    nprPerCredit:      10
  };

  // Load min score & payment settings from Firestore
  db.collection("siteSettings").doc("config").get()
    .then(s => { if (s.exists && s.data().minScoreForPremium != null) pMinScore = Number(s.data().minScoreForPremium); })
    .catch(() => {});

  db.collection("siteSettings").doc("payment").get()
    .then(s => {
      if (s.exists) {
        const d = s.data();
        if (d.khaltiSecretKey)   paymentConfig.khaltiSecretKey   = d.khaltiSecretKey;
        if (d.esewaMerchantCode) paymentConfig.esewaMerchantCode = d.esewaMerchantCode;
        if (d.esewaSecretKey)    paymentConfig.esewaSecretKey    = d.esewaSecretKey;
        if (d.nprPerCredit)      paymentConfig.nprPerCredit      = d.nprPerCredit;
      }
    }).catch(() => {});

  /* ---------- User Credits & Profile Realtime Sync ---------- */
  function syncUserCredits(user) {
    if (!user || !db) {
      updateCreditBadges(2);
      return;
    }
    db.collection("users").doc(user.uid).onSnapshot(snap => {
      if (snap.exists) {
        currentUserProfile = snap.data();
        userCredits = currentUserProfile.credits != null ? Number(currentUserProfile.credits) : 2;
      } else {
        userCredits = 2;
      }
      updateCreditBadges(userCredits);
      updateSecurityBoxUI();
      if (pCategories.length) renderCategoryCards();
    }, err => {
      console.warn("Credit sync error:", err);
    });
  }

  function updateCreditBadges(val) {
    document.querySelectorAll(".user-credits-val").forEach(el => {
      el.textContent = val;
    });
  }

  /* ---------- Winner Detection ---------- */
  async function checkWeeklyWinner(user) {
    if (!user || isPracticeMode) return;
    const ranked = leaderboardDocs
      .map(d => ({ uid: d.userId, pts: Number(d.totalPoints || 0) }))
      .filter(x => x.pts > 0).sort((a, b) => b.pts - a.pts);
    if (!ranked.length || ranked[0].pts < pMinScore) return;
    const top = ranked[0].pts;
    if (!ranked.some(x => x.uid === user.uid && x.pts === top)) return;

    isWeeklyChampion = true;
    const docId = `${user.uid}_${currentWeekKey}`;
    try {
      const ex = await db.collection("premiumUnlocks").doc(docId).get();
      if (!ex.exists) {
        await db.collection("premiumUnlocks").doc(docId).set({
          userId: user.uid,
          userName: user.displayName || user.email.split("@")[0] || "Champion",
          weekKey: currentWeekKey, weekPoints: top,
          unlockedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (e) { console.warn("premiumUnlocks write:", e); }

    if (premiumBanner) premiumBanner.hidden = false;
    await loadCategories();
    showArenaModal(true);
  }

  async function checkPremiumAccess(user) {
    if (!user) return;
    try {
      const s = await db.collection("premiumUnlocks").doc(`${user.uid}_${currentWeekKey}`).get();
      if (s.exists) {
        isWeeklyChampion = true;
        if (premiumBanner) premiumBanner.hidden = false;
      } else {
        isWeeklyChampion = false;
      }
    } catch (e) {}
  }

  /* ---------- Load & Render Category Cards Dashboard ---------- */
  async function loadCategories() {
    try {
      const s = await db.collection("premiumQuizContent").orderBy("name").get();
      pCategories = s.docs.map(d => ({
        id: d.id,
        name: d.data().name || d.id,
        imageUrl: d.data().imageUrl || "",
        description: d.data().description || "",
        credits: Number(d.data().credits ?? 3),
        questions: d.data().questions || []
      }));
      renderCategoryCards();
    } catch (e) {
      if (premiumCategoryCardsGrid) {
        premiumCategoryCardsGrid.innerHTML = `<p style="color:#ef4444; grid-column:1/-1;">Could not load categories: ${e.message}</p>`;
      }
    }
  }

  function renderCategoryCards() {
    if (!premiumCategoryCardsGrid) return;
    if (!pCategories.length) {
      premiumCategoryCardsGrid.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:32px; color:#94a3b8;">
          <p style="font-size:1.1rem; margin:0 0 6px;">No premium categories published yet.</p>
          <p style="font-size:0.85rem; margin:0;">Check back soon or explore the 7-day tournament!</p>
        </div>
      `;
      return;
    }

    const defaultGradients = [
      "linear-gradient(135deg,#1e293b 0%,#334155 100%)",
      "linear-gradient(135deg,#064e3b 0%,#047857 100%)",
      "linear-gradient(135deg,#78350f 0%,#b45309 100%)",
      "linear-gradient(135deg,#312e81 0%,#4338ca 100%)"
    ];

    premiumCategoryCardsGrid.innerHTML = "";

    pCategories.forEach((cat, idx) => {
      const cost = cat.credits || 3;
      const hasEnough = isWeeklyChampion || userCredits >= cost;
      const gradient = defaultGradients[idx % defaultGradients.length];

      let btnLabel = isWeeklyChampion
        ? `Start Quiz (Free Access)`
        : hasEnough
          ? `Start Quiz (${cost} Credits)`
          : `Need ${cost} Credits (Get More)`;

      let btnStyle = hasEnough
        ? "background:#f59e0b; border-color:#f59e0b; color:#fff;"
        : "background:#fff; border:1px solid #f59e0b; color:#d97706;";

      const card = document.createElement("div");
      card.className = "premium-cat-card";
      card.style.cssText = `
        border:1px solid #e2e8f0; border-radius:18px; overflow:hidden;
        background:#ffffff; box-shadow:0 4px 16px rgba(0,0,0,0.06);
        display:flex; flex-direction:column; transition:transform 0.2s, box-shadow 0.2s;
      `;

      card.innerHTML = `
        <div style="height:140px; background:${gradient}; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center;">
          ${cat.imageUrl ? `<img src="${escapeHtml(cat.imageUrl)}" alt="${escapeHtml(cat.name)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'" />` : `<div style="width:52px; height:52px; border-radius:12px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; color:#fff;"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>`}
          <span style="position:absolute; top:12px; right:12px; background:rgba(0,0,0,0.7); color:#fef08a; font-weight:700; font-size:0.8rem; padding:4px 10px; border-radius:999px; backdrop-filter:blur(4px); display:inline-flex; align-items:center; gap:4px;">
            ${cost} Credits
          </span>
          <span style="position:absolute; bottom:10px; left:12px; background:rgba(0,0,0,0.6); color:#fff; font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:6px; backdrop-filter:blur(4px);">
            ${(cat.questions || []).length} Questions
          </span>
        </div>

        <div style="padding:16px 18px 20px; display:flex; flex-direction:column; flex:1;">
          <h3 style="margin:0 0 6px; font-size:1.15rem; color:#0f172a; font-weight:700;">${escapeHtml(cat.name)}</h3>
          <p style="margin:0 0 16px; font-size:0.85rem; color:#64748b; flex:1; line-height:1.45;">
            ${escapeHtml(cat.description || "Comprehensive timed questions on competitive exams and current events.")}
          </p>

          <button type="button" class="btn btn-primary start-cat-quiz-btn" style="width:100%; font-weight:700; padding:10px 14px; border-radius:10px; ${btnStyle}">
            ${btnLabel}
          </button>
        </div>
      `;

      // Card hover effect
      card.addEventListener("mouseenter", () => { card.style.transform = "translateY(-4px)"; card.style.boxShadow = "0 10px 24px rgba(0,0,0,0.12)"; });
      card.addEventListener("mouseleave", () => { card.style.transform = "none"; card.style.boxShadow = "0 4px 16px rgba(0,0,0,0.06)"; });

      // Card action click
      card.querySelector(".start-cat-quiz-btn").addEventListener("click", () => {
        handleCategorySelect(cat);
      });

      premiumCategoryCardsGrid.appendChild(card);
    });
  }

  /* ---------- Handle Category Selection (Free vs Credits) ---------- */
  async function handleCategorySelect(cat) {
    const user = auth.currentUser;
    if (!user) {
      if (typeof window.openMcqAuthModal === "function") {
        window.openMcqAuthModal({
          title: "Log in to Play Premium Quiz",
          subtitle: "Connect your Google account to access your 2 free credits and start this premium quiz.",
          onSuccess: () => handleCategorySelect(cat)
        });
      } else {
        alert("Please log in or connect your Google account to play!");
      }
      return;
    }

    // 1. Weekly champion has free unlimited access
    if (isWeeklyChampion) {
      startPQuiz(cat.id, cat.name);
      return;
    }

    const cost = cat.credits || 3;

    // 2. Check if user has enough credits
    if (userCredits < cost) {
      openBuyCreditsModal(`You need ${cost} credits to play "${cat.name}". Your balance is ${userCredits} credits.`);
      return;
    }

    // 3. Check security requirement: Google and Phone
    const verified = await ensureSecurityRequirements(user);
    if (!verified) return;

    // 4. Confirm deduction of credits
    const confirmed = confirm(
      `Start "${cat.name}" quiz for ${cost} credits?\n\nYour current balance: ${userCredits} credits\nBalance after: ${userCredits - cost} credits`
    );
    if (!confirmed) return;

    // Deduct credits in Firestore
    try {
      await db.collection("users").doc(user.uid).update({
        credits: firebase.firestore.FieldValue.increment(-cost),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      userCredits = Math.max(0, userCredits - cost);
      updateCreditBadges(userCredits);
      startPQuiz(cat.id, cat.name);
    } catch (err) {
      alert("Could not deduct credits: " + err.message);
    }
  }

  /* ---------- Security Check Helper (Google + Phone) ---------- */
  async function ensureSecurityRequirements(user) {
    const isGoogle = (user.providerData || []).some(p => p.providerId === "google.com") || (currentUserProfile && currentUserProfile.googleLinked);
    const hasPhone = currentUserProfile && currentUserProfile.phoneVerified && currentUserProfile.phoneNumber;

    if (!isGoogle || !hasPhone) {
      openBuyCreditsModal("For security, please connect your Google account and verify your phone number.");
      return false;
    }
    return true;
  }

  /* ---------- Arena Modal Open / Close ---------- */
  function showArenaModal(asChampion = false) {
    if (!premiumModalOverlay) return;
    if (asChampion) {
      if (premiumArenaTitle) premiumArenaTitle.textContent = "Champion's Premium Arena";
      if (premiumArenaSubtitle) premiumArenaSubtitle.textContent = "Congratulations on taking #1 this week! Enjoy Free Unlimited Access to all categories.";
    } else {
      if (premiumArenaTitle) premiumArenaTitle.textContent = "Premium Quiz Arena";
      if (premiumArenaSubtitle) premiumArenaSubtitle.textContent = "Play exclusive competitive exam categories with credits, or enjoy Free Access as this week's champion!";
    }
    loadCategories();
    premiumModalOverlay.hidden = false;
    premiumModalOverlay.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function hideArenaModal() {
    if (!premiumModalOverlay) return;
    premiumModalOverlay.hidden = true;
    premiumModalOverlay.style.display = "";
    document.body.style.overflow = "";
  }

  if (closePremiumModalBtn) closePremiumModalBtn.addEventListener("click", hideArenaModal);
  if (premiumModalOverlay) {
    premiumModalOverlay.addEventListener("click", e => {
      if (e.target === premiumModalOverlay) hideArenaModal();
    });
  }

  if (openPremiumModalBtn) openPremiumModalBtn.addEventListener("click", () => showArenaModal(isWeeklyChampion));
  if (openPremiumArenaBtn) openPremiumArenaBtn.addEventListener("click", () => showArenaModal(false));

  /* ---------- Buy Credits Modal Logic ---------- */
  function openBuyCreditsModal(noticeMsg = "") {
    if (!buyCreditsModal) return;
    if (paymentActionStatus) {
      paymentActionStatus.textContent = noticeMsg || "";
      paymentActionStatus.style.color = noticeMsg ? "#ea580c" : "";
    }
    updateSecurityBoxUI();
    buyCreditsModal.hidden = false;
    buyCreditsModal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function hideBuyCreditsModal() {
    if (!buyCreditsModal) return;
    buyCreditsModal.hidden = true;
    buyCreditsModal.style.display = "";
    if (premiumModalOverlay && !premiumModalOverlay.hidden) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }

  if (closeBuyCreditsModalBtn) closeBuyCreditsModalBtn.addEventListener("click", hideBuyCreditsModal);
  if (buyCreditsModal) {
    buyCreditsModal.addEventListener("click", e => {
      if (e.target === buyCreditsModal) hideBuyCreditsModal();
    });
  }
  if (openBuyCreditsFromArenaBtn) openBuyCreditsFromArenaBtn.addEventListener("click", () => openBuyCreditsModal());

  // Phone OTP elements in Buy Credits Modal
  const phoneOtpRow         = document.getElementById("phoneOtpRow");
  const phoneOtpCodeInput   = document.getElementById("phoneOtpCodeInput");
  const verifyPhoneCodeBtn  = document.getElementById("verifyPhoneCodeBtn");
  const cancelPhoneOtpBtn   = document.getElementById("cancelPhoneOtpBtn");
  const phoneOtpStatus      = document.getElementById("phoneOtpStatus");
  const phoneInputControls  = document.getElementById("phoneInputControls");
  let pendingVerificationPhone = "";

  // Update Security Box in Buy Credits Modal
  function updateSecurityBoxUI() {
    const user = auth.currentUser;
    if (!user) {
      if (googleStatusText) googleStatusText.innerHTML = "Google Account: <strong style='color:#ef4444'>Not signed in</strong>";
      if (buyModalGoogleBtn) { buyModalGoogleBtn.style.display = "block"; buyModalGoogleBtn.textContent = "Sign in with Google"; }
      if (phoneStatusText) phoneStatusText.innerHTML = "Phone Number: <span style='color:#94a3b8'>Sign in first</span>";
      if (userPhoneInput) userPhoneInput.disabled = true;
      if (savePhoneBtn) savePhoneBtn.disabled = true;
      if (phoneOtpRow) phoneOtpRow.style.display = "none";
      if (phoneInputControls) phoneInputControls.style.display = "flex";
      return;
    }

    const isGoogle = (user.providerData || []).some(p => p.providerId === "google.com") || (currentUserProfile && currentUserProfile.googleLinked);
    if (isGoogle) {
      if (googleStatusText) googleStatusText.innerHTML = `Google Account: <strong style='color:#10b981'>Connected (${escapeHtml(user.email)})</strong>`;
      if (buyModalGoogleBtn) buyModalGoogleBtn.style.display = "none";
    } else {
      if (googleStatusText) googleStatusText.innerHTML = "Google Account: <strong style='color:#ea580c'>Required for security</strong>";
      if (buyModalGoogleBtn) { buyModalGoogleBtn.style.display = "block"; buyModalGoogleBtn.textContent = "Connect Google"; }
    }

    if (userPhoneInput) userPhoneInput.disabled = false;
    if (savePhoneBtn) savePhoneBtn.disabled = false;

    const isPhoneVerified = currentUserProfile && currentUserProfile.phoneVerified && currentUserProfile.phoneNumber;
    if (isPhoneVerified) {
      if (phoneStatusText) phoneStatusText.innerHTML = `Phone Number: <strong style='color:#10b981'>Verified (${escapeHtml(currentUserProfile.phoneNumber)})</strong>`;
      if (phoneInputControls) phoneInputControls.style.display = "none";
      if (phoneOtpRow) phoneOtpRow.style.display = "none";
    } else {
      if (currentUserProfile && currentUserProfile.phoneNumber) {
        if (phoneStatusText) phoneStatusText.innerHTML = `Phone Number: <strong style='color:#ea580c'>Verification required (${escapeHtml(currentUserProfile.phoneNumber)})</strong>`;
        if (userPhoneInput) userPhoneInput.value = currentUserProfile.phoneNumber.replace("+977", "").trim();
      } else {
        if (phoneStatusText) phoneStatusText.innerHTML = "Phone Number: <strong style='color:#ea580c'>Verification required</strong>";
      }
      if (phoneInputControls) phoneInputControls.style.display = "flex";
    }
  }

  if (buyModalGoogleBtn) {
    buyModalGoogleBtn.addEventListener("click", async () => {
      try {
        if (typeof window.signInWithGoogle === "function") {
          await window.signInWithGoogle();
          updateSecurityBoxUI();
          if (paymentActionStatus) {
            paymentActionStatus.textContent = "Google account connected successfully.";
            paymentActionStatus.style.color = "#10b981";
          }
        }
      } catch (err) {
        if (paymentActionStatus) paymentActionStatus.textContent = err.message;
      }
    });
  }

  // Send Phone SMS Verification Code
  if (savePhoneBtn) {
    savePhoneBtn.addEventListener("click", async () => {
      const user = auth.currentUser;
      if (!user) { alert("Please sign in first!"); return; }
      const raw = userPhoneInput ? userPhoneInput.value.trim().replace(/\s+/g, "") : "";
      if (!/^\d{10}$/.test(raw)) {
        alert("Please enter a valid 10-digit mobile number (e.g. 98XXXXXXXX).");
        return;
      }

      pendingVerificationPhone = raw.startsWith("+") ? raw : "+977" + raw;
      savePhoneBtn.disabled = true;
      savePhoneBtn.textContent = "Sending…";
      if (paymentActionStatus) paymentActionStatus.textContent = "";

      try {
        if (typeof window.sendPhoneVerificationCode === "function") {
          await window.sendPhoneVerificationCode(pendingVerificationPhone);
        }
        if (phoneOtpRow) phoneOtpRow.style.display = "block";
        if (phoneInputControls) phoneInputControls.style.display = "none";
        if (phoneOtpStatus) {
          phoneOtpStatus.textContent = `Verification code sent to ${pendingVerificationPhone}`;
          phoneOtpStatus.style.color = "#2563eb";
        }
        if (phoneOtpCodeInput) {
          phoneOtpCodeInput.value = "";
          phoneOtpCodeInput.focus();
        }
      } catch (err) {
        alert("Could not send verification code: " + err.message);
      } finally {
        savePhoneBtn.disabled = false;
        savePhoneBtn.textContent = "Send Code";
      }
    });
  }

  // Confirm Phone SMS Verification Code
  if (verifyPhoneCodeBtn) {
    verifyPhoneCodeBtn.addEventListener("click", async () => {
      const code = phoneOtpCodeInput ? phoneOtpCodeInput.value.trim() : "";
      if (!/^\d{6}$/.test(code)) {
        if (phoneOtpStatus) {
          phoneOtpStatus.textContent = "Please enter the 6-digit code received via SMS.";
          phoneOtpStatus.style.color = "#dc2626";
        }
        return;
      }

      verifyPhoneCodeBtn.disabled = true;
      verifyPhoneCodeBtn.textContent = "Verifying…";

      try {
        if (typeof window.confirmPhoneVerificationCode === "function") {
          await window.confirmPhoneVerificationCode(code, pendingVerificationPhone);
        } else {
          const user = auth.currentUser;
          if (user) {
            await db.collection("users").doc(user.uid).set({
              phoneNumber: pendingVerificationPhone,
              phoneVerified: true,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          }
        }

        if (currentUserProfile) {
          currentUserProfile.phoneNumber = pendingVerificationPhone;
          currentUserProfile.phoneVerified = true;
        }

        updateSecurityBoxUI();
        if (paymentActionStatus) {
          paymentActionStatus.textContent = "Phone number verified successfully.";
          paymentActionStatus.style.color = "#10b981";
        }
      } catch (err) {
        if (phoneOtpStatus) {
          phoneOtpStatus.textContent = err.message || "Invalid verification code. Please try again.";
          phoneOtpStatus.style.color = "#dc2626";
        }
      } finally {
        verifyPhoneCodeBtn.disabled = false;
        verifyPhoneCodeBtn.textContent = "Verify Code";
      }
    });
  }

  if (cancelPhoneOtpBtn) {
    cancelPhoneOtpBtn.addEventListener("click", () => {
      if (phoneOtpRow) phoneOtpRow.style.display = "none";
      if (phoneInputControls) phoneInputControls.style.display = "flex";
      if (phoneOtpStatus) phoneOtpStatus.textContent = "";
    });
  }


  // Credit Pack Selection Handler
  document.querySelectorAll(".credit-pack-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".credit-pack-card").forEach(c => {
        c.classList.remove("active");
        c.style.borderColor = "#e2e8f0";
        c.style.background = "#fff";
      });
      card.classList.add("active");
      card.style.borderColor = "#f59e0b";
      card.style.background = "#fffbeb";

      selectedPackCredits = Number(card.dataset.credits || 5);
      selectedPackAmount  = Number(card.dataset.amount || 50);
      if (selectedPackAmountText) selectedPackAmountText.textContent = `NPR ${selectedPackAmount}`;
    });
  });

  /* ---------- Payment Handlers: Khalti & eSewa ---------- */
  async function handlePaymentSuccess(gateway, amountNpr, creditsAdded, refId) {
    const user = auth.currentUser;
    if (!user) return;

    try {
      if (paymentActionStatus) {
        paymentActionStatus.textContent = "Payment confirmed! Adding credits to your account…";
        paymentActionStatus.style.color = "#10b981";
      }

      // 1. Increment credits in users collection
      await db.collection("users").doc(user.uid).set({
        credits: firebase.firestore.FieldValue.increment(creditsAdded),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // 2. Record payment transaction log
      await db.collection("payments").add({
        userId: user.uid,
        userEmail: user.email || "",
        gateway: gateway,
        amountNpr: amountNpr,
        creditsPurchased: creditsAdded,
        referenceId: String(refId || Date.now()),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      userCredits += creditsAdded;
      updateCreditBadges(userCredits);

      alert(`Payment Successful via ${gateway}!\n\n${creditsAdded} credits have been added to your account.\nNew Balance: ${userCredits} Credits`);
      hideBuyCreditsModal();
    } catch (err) {
      console.error("Payment post-processing error:", err);
      alert("Credits were paid but saving failed: " + err.message);
    }
  }


  // ---------------------------------------------------------------------------
  // 1. KHALTI PAYMENT — Khalti ePayment API v2 (New Web Checkout)
  // ---------------------------------------------------------------------------
  if (payWithKhaltiBtn) {
    payWithKhaltiBtn.addEventListener("click", async () => {
      const user = auth.currentUser;
      if (!user) {
        openBuyCreditsModal("Please log in or connect Google first.");
        return;
      }
      const verified = await ensureSecurityRequirements(user);
      if (!verified) return;

      if (!paymentConfig.khaltiSecretKey) {
        paymentActionStatus.textContent = "Khalti is not configured yet. Please contact the site admin.";
        paymentActionStatus.style.color = "crimson";
        return;
      }

      paymentActionStatus.textContent = "Connecting to Khalti — please wait…";
      paymentActionStatus.style.color = "#475569";
      payWithKhaltiBtn.disabled = true;

      try {
        const txId = `KH-${user.uid.slice(0, 6)}-${Date.now()}`;
        const returnUrl = `${window.location.origin}${window.location.pathname}?payment=khalti&status=success&amt=${selectedPackAmount}&credits=${selectedPackCredits}&tx=${txId}`;

        // Khalti ePayment v2 — initiate payment (live: a.khalti.com, test: dev.khalti.com)
        const KHALTI_INITIATE_URL = "https://a.khalti.com/api/v2/epayment/initiate/";

        const resp = await fetch(KHALTI_INITIATE_URL, {
          method: "POST",
          headers: {
            "Authorization": `key ${paymentConfig.khaltiSecretKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            return_url: returnUrl,
            website_url: window.location.origin,
            amount: selectedPackAmount * 100, // Paisa
            purchase_order_id: txId,
            purchase_order_name: `${selectedPackCredits} Premium Quiz Credits`,
            customer_info: {
              name: user.displayName || user.email,
              email: user.email
            }
          })
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.detail || errData.error_key || `HTTP ${resp.status}`);
        }

        const data = await resp.json();
        if (data.payment_url) {
          // Redirect to Khalti hosted checkout page
          window.location.href = data.payment_url;
        } else {
          throw new Error("No payment_url in Khalti response.");
        }

      } catch (err) {
        payWithKhaltiBtn.disabled = false;
        paymentActionStatus.textContent = "Khalti error: " + err.message;
        paymentActionStatus.style.color = "crimson";
        console.error("Khalti initiation error:", err);
      }
    });
  }

  // Handle Khalti return callback (Khalti redirects back with pidx + status)
  (function checkKhaltiCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("payment") === "khalti" && urlParams.get("status") === "success") {
      const amt     = Number(urlParams.get("amt")     || 50);
      const credits = Number(urlParams.get("credits") || 5);
      const tx      = urlParams.get("tx") || urlParams.get("pidx") || "";

      auth.onAuthStateChanged(async user => {
        if (user && tx) {
          try {
            const existing = await db.collection("payments").where("referenceId", "==", String(tx)).get();
            if (existing.empty) {
              await handlePaymentSuccess("Khalti", amt, credits, tx);
            }
          } catch (e) {
            console.warn("Khalti callback credit error:", e);
          }
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      });
    }
  })();

  // ---------------------------------------------------------------------------
  // 2. eSEWA PAYMENT — eSewa ePay v2 (epay.esewa.com.np) with HMAC-SHA256
  // ---------------------------------------------------------------------------

  /**
   * Generate HMAC-SHA256 base64 signature using CryptoJS.
   * Signature message: "total_amount=X,transaction_uuid=Y,product_code=Z"
   */
  function generateEsewaSignature(totalAmount, transactionUuid, productCode, secretKey) {
    const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
    const hash = CryptoJS.HmacSHA256(message, secretKey);
    return CryptoJS.enc.Base64.stringify(hash);
  }

  if (payWithEsewaBtn) {
    payWithEsewaBtn.addEventListener("click", async () => {
      const user = auth.currentUser;
      if (!user) {
        openBuyCreditsModal("Please log in or connect Google first.");
        return;
      }
      const verified = await ensureSecurityRequirements(user);
      if (!verified) return;

      if (typeof CryptoJS === "undefined") {
        paymentActionStatus.textContent = "Encryption library not loaded. Refresh the page and try again.";
        paymentActionStatus.style.color = "crimson";
        return;
      }

      paymentActionStatus.textContent = "Redirecting to eSewa payment portal…";
      paymentActionStatus.style.color = "#475569";

      // eSewa v2 requires alphanumeric + hyphen only in transaction_uuid
      const txId       = `ES-${user.uid.slice(0, 5)}-${Date.now()}`;
      const successUrl = `${window.location.origin}${window.location.pathname}?payment=esewa&status=success&amt=${selectedPackAmount}&credits=${selectedPackCredits}&tx=${txId}`;
      const failureUrl = `${window.location.origin}${window.location.pathname}?payment=esewa&status=fail`;

      const merchantCode = paymentConfig.esewaMerchantCode || "EPAYTEST";
      const secretKey    = paymentConfig.esewaSecretKey    || "8gBm/:&EnhH.1/q";
      const totalAmount  = selectedPackAmount;

      // Build HMAC-SHA256 signature
      const signature = generateEsewaSignature(totalAmount, txId, merchantCode, secretKey);

      // Build and submit eSewa v2 form
      const form = document.createElement("form");
      form.method = "POST";
      // Production URL; for testing use: https://rc-epay.esewa.com.np/api/epay/main/v2/form
      form.action = "https://epay.esewa.com.np/api/epay/main/v2/form";

      const params = {
        amount:                   totalAmount,
        tax_amount:               0,
        total_amount:             totalAmount,
        transaction_uuid:         txId,
        product_code:             merchantCode,
        product_service_charge:   0,
        product_delivery_charge:  0,
        success_url:              successUrl,
        failure_url:              failureUrl,
        signed_field_names:       "total_amount,transaction_uuid,product_code",
        signature:                signature
      };

      for (const key in params) {
        const input   = document.createElement("input");
        input.type    = "hidden";
        input.name    = key;
        input.value   = params[key];
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
    });
  }

  // Handle return redirect from eSewa v2 callback
  // eSewa v2 encodes the entire response JSON as Base64 in the `data` query param
  (function checkEsewaCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("payment") === "esewa") {
      if (urlParams.get("status") === "success") {
        const amt     = Number(urlParams.get("amt")     || 50);
        const credits = Number(urlParams.get("credits") || 5);
        // Try to get transaction ID from our custom param, or from eSewa's Base64 data
        let tx = urlParams.get("tx") || "";
        const esewaData = urlParams.get("data");
        if (!tx && esewaData) {
          try {
            const decoded = JSON.parse(atob(esewaData));
            tx = decoded.transaction_uuid || decoded.transaction_code || tx;
          } catch (e) { /* ignore decode errors */ }
        }

        auth.onAuthStateChanged(async user => {
          if (user && tx) {
            try {
              const existing = await db.collection("payments").where("referenceId", "==", String(tx)).get();
              if (existing.empty) {
                await handlePaymentSuccess("eSewa", amt, credits, tx);
              }
            } catch (e) {
              console.warn("eSewa payment verification error:", e);
            }
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        });
      } else {
        alert("eSewa payment was cancelled or failed. No credits were added.");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  })();


  /* ---------- Start Premium Quiz Session ---------- */
  async function startPQuiz(catId, catName) {
    hideArenaModal();
    hideBuyCreditsModal();

    pCatName = catName;
    pQIdx = 0;
    pCorrect = 0;
    pPts = 0;
    pSpeedBon = 0;

    if (liveIntroCard) liveIntroCard.hidden = true;
    if (liveActiveCard) liveActiveCard.hidden = true;
    if (liveResultsCard) liveResultsCard.hidden = true;
    if (premiumResultsCard) premiumResultsCard.hidden = true;
    if (premiumActiveCard) premiumActiveCard.hidden = false;

    try {
      const s = await db.collection("premiumQuizContent").doc(catId).get();
      pQuestions = s.exists ? (s.data().questions || []) : [];
    } catch (e) { pQuestions = []; }

    if (!pQuestions.length) {
      alert("No questions available in this category yet. Check back later!");
      returnPToIntro();
      return;
    }
    renderPQ();
  }

  /* ---------- Render Premium Question ---------- */
  function renderPQ() {
    pAnswered = false;
    if (premiumFbBar) premiumFbBar.hidden = true;
    if (premiumOptsGrid) premiumOptsGrid.innerHTML = "";
    const q = pQuestions[pQIdx];
    if (!q) { finishPQuiz(); return; }

    if (premiumQIndex) premiumQIndex.textContent = `Question ${pQIdx + 1} of ${pQuestions.length}`;
    if (premiumRunningPts) premiumRunningPts.textContent = `${pPts} pts`;
    if (premiumQCat) premiumQCat.textContent = pCatName;
    if (premiumQTxt) premiumQTxt.textContent = q.question;

    startPTimer();

    const opts = Array.isArray(q.options) ? q.options : [];
    const ci = Number(q.correctIndex ?? 0);
    opts.forEach((txt, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mcq-opt";
      b.innerHTML = `<span class="opt-num">${i + 1}</span> <span>${escapeHtml(txt)}</span>`;
      b.addEventListener("click", () => handlePAns(i, ci, q.explanation));
      premiumOptsGrid.appendChild(b);
    });
  }

  function startPTimer() {
    clearInterval(pTimer);
    pSecs = QUESTION_TIME_LIMIT;
    updatePTimerViz();
    pTimer = setInterval(() => {
      pSecs--;
      updatePTimerViz();
      if (pSecs <= 5 && pSecs > 0) playTick();
      if (pSecs <= 0) { clearInterval(pTimer); pTimeout(); }
    }, 1000);
  }

  function updatePTimerViz() {
    if (premiumTimerTxt) premiumTimerTxt.textContent = `${pSecs}s`;
    const pct = Math.max(0, (pSecs / QUESTION_TIME_LIMIT) * 100);
    if (premiumTimerFill) {
      premiumTimerFill.style.width = `${pct}%`;
      premiumTimerFill.style.background = pSecs <= 5 ? "var(--q-wrong,#f87171)" : pSecs <= 10 ? "#fbbf24" : "#f59e0b";
    }
    if (premiumTimerSec) premiumTimerSec.classList.toggle("is-critical", pSecs <= 5);
  }

  function handlePAns(chosen, correct, expl) {
    if (pAnswered) return;
    pAnswered = true;
    clearInterval(pTimer);

    const ok = chosen === correct;
    premiumOptsGrid.querySelectorAll(".mcq-opt").forEach((b, i) => {
      b.disabled = true;
      if (i === correct) b.classList.add("is-correct");
      if (i === chosen && !ok) b.classList.add("is-wrong");
    });

    if (ok) {
      playCorrect();
      pCorrect++;
      const sp = Math.round((pSecs / QUESTION_TIME_LIMIT) * MAX_SPEED_BONUS);
      pSpeedBon += sp;
      pPts += BASE_POINTS_PER_CORRECT + sp;
      if (premiumRunningPts) premiumRunningPts.textContent = `${pPts} pts`;
      showPFb(`Correct! +${BASE_POINTS_PER_CORRECT} pts${sp > 0 ? ` (+${sp} speed bonus)` : ""}`, true, expl);
    } else {
      playWrong();
      showPFb(`Incorrect. Correct answer: Option ${correct + 1}.`, false, expl);
    }
  }

  function pTimeout() {
    if (pAnswered) return;
    pAnswered = true;
    playWrong();
    const q = pQuestions[pQIdx];
    const c = Number(q.correctIndex ?? 0);
    premiumOptsGrid.querySelectorAll(".mcq-opt").forEach((b, i) => {
      b.disabled = true;
      if (i === c) b.classList.add("is-correct");
    });
    showPFb(`Time's up! Correct answer: Option ${c + 1}.`, false, q.explanation);
  }

  function showPFb(msg, ok, expl) {
    if (!premiumFbBar) return;
    premiumFbBar.hidden = false;
    premiumFbText.innerHTML = msg + (expl ? ` <br/><small class="quiz-muted">${expl}</small>` : "");
    premiumFbBar.classList.toggle("is-correct-bar", ok);
    premiumFbBar.classList.toggle("is-wrong-bar", !ok);
  }

  if (premiumNextBtn) {
    premiumNextBtn.addEventListener("click", () => {
      pQIdx++;
      pQIdx < pQuestions.length ? renderPQ() : finishPQuiz();
    });
  }

  /* ---------- Finish Premium Quiz ---------- */
  function finishPQuiz() {
    clearInterval(pTimer);
    if (premiumActiveCard) premiumActiveCard.hidden = true;
    if (premiumResultsCard) premiumResultsCard.hidden = false;
    if (premiumResScore) premiumResScore.textContent = `${pCorrect}/${pQuestions.length}`;
    if (premiumResPts) premiumResPts.textContent = pPts.toLocaleString();
    if (premiumResBonus) premiumResBonus.textContent = `+${pSpeedBon}`;
    if (premiumResCat) premiumResCat.textContent = pCatName;
    if (premiumResSub) {
      premiumResSub.innerHTML = `You scored <strong>${pPts} pts</strong> (${pCorrect}/${pQuestions.length} correct) in <strong>${escapeHtml(pCatName)}</strong>!`;
    }
  }

  function returnPToIntro() {
    clearInterval(pTimer);
    if (premiumActiveCard) premiumActiveCard.hidden = true;
    if (premiumResultsCard) premiumResultsCard.hidden = true;
    if (liveIntroCard) liveIntroCard.hidden = false;
  }

  if (premiumBackModal) {
    premiumBackModal.addEventListener("click", () => {
      if (premiumResultsCard) premiumResultsCard.hidden = true;
      showArenaModal(isWeeklyChampion);
    });
  }
  if (premiumBackIntro) premiumBackIntro.addEventListener("click", returnPToIntro);

  // Keyboard navigation
  window.addEventListener("keydown", (e) => {
    if (!premiumActiveCard || premiumActiveCard.hidden) return;
    if (!pAnswered) {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) {
        const b = premiumOptsGrid.querySelectorAll(".mcq-opt")[n - 1];
        if (b && !b.disabled) b.click();
      }
    } else if (premiumFbBar && !premiumFbBar.hidden && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      if (premiumNextBtn) premiumNextBtn.click();
    }
  });

  // Auth state listener: check premium access and sync credits
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      syncUserCredits(user);
      await checkPremiumAccess(user);
    } else {
      userCredits = 2;
      isWeeklyChampion = false;
      updateCreditBadges(2);
      if (premiumBanner) premiumBanner.hidden = true;
    }
  });

  // Winner check: triggered when score is saved to tournament leaderboard
  document.addEventListener("premiumCheckReady", async () => {
    const user = auth.currentUser;
    if (user) await checkWeeklyWinner(user);
  });

})();
