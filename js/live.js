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
  let userWeeklyDays = {}; // Map of "day1", "day2", etc. taken by the current user

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
  const alreadyPlayedPanel = document.getElementById("alreadyPlayedPanel");
  const alreadyPlayedScoreEl = document.getElementById("alreadyPlayedScore");
  const alreadyPlayedCountdownEl = document.getElementById("alreadyPlayedCountdown");

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

      const dayKey = `day${i}`;
      const dayRecord = userWeeklyDays ? userWeeklyDays[dayKey] : null;
      const hasPlayed = Boolean(dayRecord);

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
          if (hasPlayed) {
            status = "completed";
            statusLabel = "Completed";
            icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
            dayCard.classList.add("is-past", "is-completed");
          } else {
            status = "missed";
            statusLabel = "Missed";
            icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            dayCard.classList.add("is-past", "is-missed");
          }
        } else if (i === currentDayIndex) {
          dayCard.classList.add("is-today");
          if (hasPlayed) {
            status = "completed";
            statusLabel = "Completed";
            icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
            dayCard.classList.add("is-completed");
          } else {
            status = "active";
            statusLabel = "Today";
            icon = "●";
          }
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

    // On mobile, scroll the active "Today" day into center view inside the stepper container only
    setTimeout(() => {
      const todayEl = daysStepper.querySelector(".is-today");
      if (todayEl && daysStepper && daysStepper.scrollWidth > daysStepper.clientWidth) {
        const targetScroll = todayEl.offsetLeft - (daysStepper.clientWidth - todayEl.clientWidth) / 2;
        daysStepper.scrollTo({ left: Math.max(0, targetScroll), behavior: "smooth" });
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

      // Deterministically shuffle — seed includes user UID so each player gets unique order
      const currentUser = (typeof auth !== "undefined" && auth) ? auth.currentUser : null;
      const userKey = currentUser
        ? currentUser.uid
        : (sessionStorage.getItem("guestSessionId") || (() => {
            const id = Math.random().toString(36).slice(2);
            sessionStorage.setItem("guestSessionId", id);
            return id;
          })());
      const daySeed = `${userKey}_${currentWeekKey}_${currentDayKey}_class_${selectedClass}`;
      const shuffled = seededShuffle(filtered, daySeed);
      currentQuestions = shuffled.slice(0, Math.min(QUIZ_SIZE, shuffled.length));

      onQuestionsReady();
    } catch (err) {
      console.error("Error loading daily questions:", err);
      if (liveQuizStatusText) liveQuizStatusText.textContent = "Failed to load questions. Please check connection.";
    }
  }

  /* ---------- Already-Played Gate & Week Days Tracker ---------- */
  async function checkAlreadyPlayedToday(user) {
    if (!user || typeof db === "undefined" || !db) {
      userWeeklyDays = {};
      renderDaysStepper();
      return null;
    }
    try {
      const docRef = db.collection("liveQuizScores").doc(`${user.uid}_${currentWeekKey}`);
      const snap = await docRef.get();
      if (snap.exists) {
        userWeeklyDays = snap.data().days || {};
        renderDaysStepper();
        return userWeeklyDays[currentDayKey] || null; // returns day record or null
      } else {
        userWeeklyDays = {};
        renderDaysStepper();
      }
    } catch (e) {
      console.warn("checkAlreadyPlayedToday error:", e);
      userWeeklyDays = {};
      renderDaysStepper();
    }
    return null;
  }

  let alreadyPlayedCountdownTimer = null;

  function showAlreadyPlayedUI(dayRecord) {
    // Hide start button & status, show already-played panel
    if (startLiveQuizBtn) {
      startLiveQuizBtn.disabled = true;
      startLiveQuizBtn.hidden = true;
    }
    if (liveQuizStatusText) liveQuizStatusText.hidden = true;
    if (alreadyPlayedPanel) alreadyPlayedPanel.hidden = false;

    // Show today's score
    if (alreadyPlayedScoreEl && dayRecord) {
      const pts = dayRecord.points ?? dayRecord.score ?? 0;
      const correct = dayRecord.correct ?? dayRecord.score ?? "—";
      alreadyPlayedScoreEl.textContent = `You scored ${pts} pts (${correct}/${QUIZ_SIZE} correct) today!`;
    }

    // Countdown to midnight (next day reset)
    function updateCountdown() {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0); // next midnight
      const diff = tomorrow - now;
      if (diff <= 0) {
        if (alreadyPlayedCountdownEl) alreadyPlayedCountdownEl.textContent = "Refreshing…";
        clearInterval(alreadyPlayedCountdownTimer);
        location.reload();
        return;
      }
      const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      if (alreadyPlayedCountdownEl) alreadyPlayedCountdownEl.textContent = `${h}:${m}:${s}`;
    }
    updateCountdown();
    clearInterval(alreadyPlayedCountdownTimer);
    alreadyPlayedCountdownTimer = setInterval(updateCountdown, 1000);
  }

  function resetStartUI() {
    // Restore normal start button state (called when user logs out or switches account)
    if (startLiveQuizBtn) {
      startLiveQuizBtn.hidden = false;
    }
    if (liveQuizStatusText) liveQuizStatusText.hidden = false;
    if (alreadyPlayedPanel) alreadyPlayedPanel.hidden = true;
    clearInterval(alreadyPlayedCountdownTimer);
    userWeeklyDays = {};
    renderDaysStepper();
  }

  async function onQuestionsReady() {
    const isComingSoon = isBeforeTournamentLaunch();
    if (isComingSoon) {
      if (startLiveQuizBtn) {
        startLiveQuizBtn.disabled = true;
        startLiveQuizBtn.hidden = false;
        startLiveQuizBtn.textContent = "Tournament Starts This Monday (Day 1)";
        startLiveQuizBtn.style.opacity = "0.75";
        startLiveQuizBtn.style.cursor = "not-allowed";
      }
      if (startWarmupBtn) {
        startWarmupBtn.hidden = false;
      }
      if (liveQuizStatusText) {
        liveQuizStatusText.hidden = false;
        liveQuizStatusText.innerHTML = `<strong>The 7-Day Challenge officially starts on Monday, Sep 14.</strong> Try an unranked warm-up quiz above to test your speed!`;
      }
      if (alreadyPlayedPanel) alreadyPlayedPanel.hidden = true;
      return;
    }

    // Check if logged-in user already played today
    const user = (typeof auth !== "undefined" && auth) ? auth.currentUser : null;
    if (user) {
      const dayRecord = await checkAlreadyPlayedToday(user);
      if (dayRecord) {
        showAlreadyPlayedUI(dayRecord);
        return;
      }
    }

    // Normal ready state — show Start button
    resetStartUI();
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
     PREMIUM ACCESS & TOURNAMENT WINNER RECOGNITION
     ============================================================ */
  const premiumBanner = document.getElementById("premiumAccessBanner");
  let pMinScore = 50;

  // Load min score from Firestore
  if (typeof db !== "undefined" && db) {
    db.collection("siteSettings").doc("config").get()
      .then(s => {
        if (s.exists && s.data().minScoreForPremium != null) {
          pMinScore = Number(s.data().minScoreForPremium);
        }
      })
      .catch(() => {});
  }

  async function checkWeeklyWinner(user) {
    if (!user || isPracticeMode) return;
    const ranked = leaderboardDocs
      .map(d => ({ uid: d.userId, pts: Number(d.totalPoints || 0) }))
      .filter(x => x.pts > 0)
      .sort((a, b) => b.pts - a.pts);
    if (!ranked.length || ranked[0].pts < pMinScore) return;
    const top = ranked[0].pts;
    if (!ranked.some(x => x.uid === user.uid && x.pts === top)) return;

    const docId = user.uid + "_" + currentWeekKey;
    try {
      const ex = await db.collection("premiumUnlocks").doc(docId).get();
      if (!ex.exists) {
        await db.collection("premiumUnlocks").doc(docId).set({
          userId: user.uid,
          userName: user.displayName || (user.email ? user.email.split("@")[0] : "Champion"),
          weekKey: currentWeekKey,
          weekPoints: top,
          unlockedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (e) {
      console.warn("premiumUnlocks write:", e);
    }

    if (premiumBanner) premiumBanner.hidden = false;
  }

  async function checkPremiumAccess(user) {
    if (!user) {
      if (premiumBanner) premiumBanner.hidden = true;
      return;
    }
    try {
      const s = await db.collection("premiumUnlocks").doc(user.uid + "_" + currentWeekKey).get();
      if (s.exists) {
        if (premiumBanner) premiumBanner.hidden = false;
      } else {
        if (premiumBanner) premiumBanner.hidden = true;
      }
    } catch (e) {
      if (premiumBanner) premiumBanner.hidden = true;
    }
  }

  // Auth state listener: check already-played gate + premium access on login/logout
  if (typeof auth !== "undefined" && auth) {
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        await checkPremiumAccess(user);
        // Re-run the already-played check now that we know who the user is
        await onQuestionsReady();
      } else {
        if (premiumBanner) premiumBanner.hidden = true;
        // Logged out — reset to normal start UI (guest can still attempt)
        resetStartUI();
        await onQuestionsReady();
      }
    });
  }

  // Winner check: triggered when score is saved to tournament leaderboard
  document.addEventListener("premiumCheckReady", async () => {
    if (typeof auth !== "undefined" && auth) {
      const user = auth.currentUser;
      if (user) await checkWeeklyWinner(user);
    }
  });

})();
