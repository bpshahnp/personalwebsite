/* =========================================================================
   CATEGORY REGISTRY
   To add a new category: create questions/<name>.json (an array of
   {question, options, answerIndex} objects) and add one line below.
   ========================================================================= */
const CATEGORY_FILES = {
  "General": "questions/general.json",
  "Science": "questions/science.json",
  "Nepal": "questions/nepal.json",
  "Tech": "questions/tech.json"
};

const PLAYERS_COLLECTION = "players";

/* ---------------- State ---------------- */
let QUESTIONS = [];
let questionsReady = false;
let latestLeaderboard = [];
let unsubscribeLeaderboard = null;
let unsubscribeMe = null;

let state = {
  currentUser: null,   // doc id (lowercased name)
  category: "All",
  count: 10,
  pool: [],
  index: 0,
  score: 0,
  answers: [],
  locked: false,
  muted: false
};

/* =========================================================================
   FIRESTORE — shared, cross-device leaderboard
   Requires firebase-config.js (loaded before this file) to define a
   global `db` (firebase.firestore() instance).
   ========================================================================= */
function accountKey(name){
  return name.trim().toLowerCase();
}

function playersRef(){
  return db.collection(PLAYERS_COLLECTION);
}

async function getOrCreateAccount(displayName){
  const key = accountKey(displayName);
  const ref = playersRef().doc(key);
  const snap = await ref.get();
  if(!snap.exists){
    await ref.set({
      name: key, // Stored in lowercase to match playerId and satisfy security rules
      gamesPlayed: 0,
      totalCorrect: 0,
      totalQuestions: 0,
      bestPercent: 0,
      lastPercent: null,
      lastPlayedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  return key;
}

async function recordResult(key, correct, total){
  const ref = playersRef().doc(key);
  const pct = Math.round((correct / total) * 100);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {
      name: key, gamesPlayed: 0, totalCorrect: 0, totalQuestions: 0, bestPercent: 0
    };
    const updated = {
      ...data,
      gamesPlayed: data.gamesPlayed + 1,
      totalCorrect: data.totalCorrect + correct,
      totalQuestions: data.totalQuestions + total,
      lastPercent: pct,
      bestPercent: Math.max(data.bestPercent, pct),
      lastPlayedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    tx.set(ref, updated);
    return updated;
  });
}

async function computeRank(key){
  const snap = await playersRef()
    .orderBy('bestPercent', 'desc')
    .orderBy('gamesPlayed', 'desc')
    .get();
  const rows = snap.docs.map(d => ({ key: d.id, ...d.data() }));
  const rank = rows.findIndex(r => r.key === key) + 1;
  return { rank, total: rows.length, rows };
}

function subscribeLeaderboard(){
  if(unsubscribeLeaderboard) return;
  unsubscribeLeaderboard = playersRef()
    .orderBy('bestPercent', 'desc')
    .orderBy('gamesPlayed', 'desc')
    .limit(50)
    .onSnapshot(
      snap => {
        latestLeaderboard = snap.docs.map(d => ({ key: d.id, ...d.data() }));
        renderLeaderboard();
      },
      err => {
        console.error(err);
        document.getElementById('leaderboard').innerHTML =
          `<div class="lb-empty">Couldn't load the live leaderboard right now.</div>`;
      }
    );
}

function subscribeMe(key){
  if(unsubscribeMe) unsubscribeMe();
  unsubscribeMe = playersRef().doc(key).onSnapshot(snap => {
    if(snap.exists){
      const data = snap.data();
      whoBadge.textContent = data.name;
      renderMyStats(data);
    }
  });
}

/* ---------------- Screen switching ---------------- */
const screens = ["name-screen", "dashboard-screen", "setup-screen", "quiz-screen", "result-screen"];
function showScreen(id){
  screens.forEach(s => document.getElementById(s).classList.toggle('hidden', s !== id));
}

/* ---------------- Name screen ---------------- */
const nameForm = document.getElementById('nameForm');
const nameInput = document.getElementById('nameInput');
const nameSubmitBtn = document.getElementById('nameSubmitBtn');
const whoBadge = document.getElementById('whoBadge');
const connectionError = document.getElementById('connectionError');

nameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if(!name) return;

  connectionError.classList.add('hidden');
  nameSubmitBtn.disabled = true;
  nameSubmitBtn.textContent = 'Connecting…';

  try{
    state.currentUser = await getOrCreateAccount(name);
    subscribeLeaderboard();
    subscribeMe(state.currentUser);
    await enterDashboard();
  } catch(err){
    console.error(err);
    connectionError.classList.remove('hidden');
  } finally {
    nameSubmitBtn.disabled = false;
    nameSubmitBtn.textContent = 'Continue';
  }
});

document.getElementById('switchUserBtn').addEventListener('click', () => {
  state.currentUser = null;
  if(unsubscribeMe){ unsubscribeMe(); unsubscribeMe = null; }
  nameInput.value = '';
  whoBadge.classList.add('hidden');
  showScreen('name-screen');
  nameInput.focus();
});

/* ---------------- Dashboard / leaderboard ---------------- */
async function enterDashboard(){
  const snap = await playersRef().doc(state.currentUser).get();
  const me = snap.data();
  whoBadge.textContent = me.name;
  whoBadge.classList.remove('hidden');
  document.getElementById('dashboardGreeting').textContent = `Welcome, ${me.name}`;
  renderMyStats(me);
  renderLeaderboard();
  showScreen('dashboard-screen');
}

function renderMyStats(me){
  const avg = me.totalQuestions > 0 ? Math.round((me.totalCorrect / me.totalQuestions) * 100) : 0;
  const box = document.getElementById('myStats');
  box.innerHTML = `
    <div class="stat-box"><div class="stat-num">${me.gamesPlayed}</div><div class="stat-label">Quizzes</div></div>
    <div class="stat-box"><div class="stat-num">${me.bestPercent}%</div><div class="stat-label">Best score</div></div>
    <div class="stat-box"><div class="stat-num">${avg}%</div><div class="stat-label">Average</div></div>
  `;
}

function renderLeaderboard(){
  const rows = latestLeaderboard;
  const el = document.getElementById('leaderboard');
  if(rows.length === 0){
    el.innerHTML = `<div class="lb-empty">No quizzes played yet — be the first.</div>`;
    return;
  }
  el.innerHTML = '';
  rows.forEach((r, i) => {
    const rank = i + 1;
    const isMe = r.key === state.currentUser;
    const row = document.createElement('div');
    row.className = 'lb-row' + (isMe ? ' me' : '');
    row.innerHTML = `
      <span class="lb-rank ${rank === 1 ? 'lead' : ''}">${rank === 1 ? '★' : rank}</span>
      <span class="lb-name">${escapeHtml(r.name)}${isMe ? '<span class="lb-you-tag">You</span>' : ''}</span>
      <span class="lb-score">${r.bestPercent}%</span>
      <span class="lb-games">${r.gamesPlayed} played</span>
    `;
    el.appendChild(row);
  });
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById('newQuizBtn').addEventListener('click', () => {
  showScreen('setup-screen');
  if(questionsReady) document.getElementById('startBtn').disabled = false;
});
document.getElementById('backToDashboardBtn').addEventListener('click', enterDashboard);
document.getElementById('toDashboardBtn').addEventListener('click', enterDashboard);

/* ---------------- Load question banks ---------------- */
async function loadQuestions(){
  const entries = Object.entries(CATEGORY_FILES);
  const results = await Promise.all(
    entries.map(([category, path]) =>
      fetch(path)
        .then(res => {
          if(!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
          return res.json();
        })
        .then(items => items.map(q => ({ ...q, category })))
        .catch(err => {
          console.error(err);
          return [];
        })
    )
  );
  QUESTIONS = results.flat();

  if(QUESTIONS.length === 0){
    document.getElementById('setupSubtitle').textContent =
      "Couldn't load any questions. If you're opening this file directly, serve it through a local web server instead (browsers block loading local JSON via file://).";
    return;
  }

  questionsReady = true;
  document.getElementById('setupSubtitle').textContent =
    "Pick a category and how many questions you want, then start. You'll get instant feedback after every answer.";
  buildCategoryPills();
  populateCountOptions();
  if(!document.getElementById('setup-screen').classList.contains('hidden')){
    document.getElementById('startBtn').disabled = false;
  }
}

/* ---------------- Sound (Web Audio, no external files) ---------------- */
let audioCtx = null;
function getCtx(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function tone(freq, start, duration, type='sine', gain=0.18){
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g); g.connect(ctx.destination);
  osc.start(start);
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.stop(start + duration);
}
function playCorrectSound(){
  if(state.muted) return;
  const ctx = getCtx();
  const now = ctx.currentTime;
  tone(523.25, now, 0.14, 'sine');
  tone(783.99, now + 0.1, 0.22, 'sine');
}
function playIncorrectSound(){
  if(state.muted) return;
  const ctx = getCtx();
  const now = ctx.currentTime;
  tone(200, now, 0.16, 'sawtooth', 0.12);
  tone(150, now + 0.09, 0.22, 'sawtooth', 0.12);
}

/* ---------------- Setup screen ---------------- */
const categoryPills = document.getElementById('categoryPills');
const countSelect = document.getElementById('countSelect');

function buildCategoryPills(){
  const categories = ["All", ...new Set(QUESTIONS.map(q => q.category))];
  categoryPills.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'pill' + (cat === state.category ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      state.category = cat;
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      populateCountOptions();
    });
    categoryPills.appendChild(btn);
  });
}

function availableCount(){
  return state.category === "All" ? QUESTIONS.length : QUESTIONS.filter(q => q.category === state.category).length;
}

function populateCountOptions(){
  const max = availableCount();
  countSelect.innerHTML = '';
  const options = [5, 10, 15, 20].filter(n => n <= max);
  if(!options.includes(max)) options.push(max);
  options.sort((a,b) => a-b);
  options.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n + (n === max ? ` (all ${max})` : ` questions`);
    countSelect.appendChild(opt);
  });
  state.count = Number(countSelect.value || options[options.length-1]);
}
countSelect.addEventListener('change', () => state.count = Number(countSelect.value));

document.getElementById('muteBtn').addEventListener('click', (e) => {
  state.muted = !state.muted;
  e.target.textContent = state.muted ? '🔇' : '🔊';
});

document.getElementById('startBtn').addEventListener('click', startQuiz);

/* ---------------- Quiz flow ---------------- */
function shuffle(arr){
  const a = [...arr];
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startQuiz(){
  const source = state.category === "All" ? QUESTIONS : QUESTIONS.filter(q => q.category === state.category);
  state.pool = shuffle(source).slice(0, state.count);
  state.index = 0;
  state.score = 0;
  state.answers = [];

  showScreen('quiz-screen');
  renderQuestion();
}

function renderQuestion(){
  state.locked = false;
  const q = state.pool[state.index];
  document.getElementById('qCounter').textContent = `Question ${state.index + 1} of ${state.pool.length}`;
  document.getElementById('scoreBadge').textContent = `Score: ${state.score}`;
  document.getElementById('progressFill').style.width = `${(state.index / state.pool.length) * 100}%`;
  document.getElementById('questionText').textContent = q.question;

  const feedback = document.getElementById('feedback');
  feedback.className = 'feedback';
  feedback.textContent = '';

  document.getElementById('nextBtn').classList.add('hidden');

  const list = document.getElementById('optionsList');
  list.innerHTML = '';
  const letters = ['A','B','C','D','E','F'];
  q.options.forEach((optText, i) => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.innerHTML = `<span class="bubble">${letters[i]}</span><span>${optText}</span>`;
    btn.addEventListener('click', () => selectAnswer(i, btn));
    btn.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectAnswer(i, btn); }
    });
    list.appendChild(btn);
  });
}

function selectAnswer(i, btnEl){
  if(state.locked) return;
  state.locked = true;
  const q = state.pool[state.index];
  const isRight = i === q.answerIndex;
  const allBtns = document.querySelectorAll('#optionsList .option');

  allBtns.forEach((b, idx) => {
    b.classList.add('locked');
    if(idx === q.answerIndex) b.classList.add('correct');
    if(idx === i && !isRight) b.classList.add('incorrect');
    if(idx === i) b.classList.add('selected');
  });

  const feedback = document.getElementById('feedback');
  feedback.classList.add('show');
  if(isRight){
    feedback.classList.add('correct');
    feedback.textContent = '✓ Correct!';
    state.score++;
    playCorrectSound();
  } else {
    feedback.classList.add('incorrect');
    feedback.textContent = `✗ Not quite — the correct answer is "${q.options[q.answerIndex]}".`;
    playIncorrectSound();
  }

  document.getElementById('scoreBadge').textContent = `Score: ${state.score}`;
  state.answers.push({
    question: q.question,
    chosen: q.options[i],
    correct: q.options[q.answerIndex],
    isRight
  });

  document.getElementById('nextBtn').classList.remove('hidden');
}

document.getElementById('nextBtn').addEventListener('click', () => {
  state.index++;
  if(state.index < state.pool.length){
    renderQuestion();
  } else {
    showResults();
  }
});

/* keyboard shortcuts: 1-4 to answer, Enter to advance */
document.addEventListener('keydown', (e) => {
  const quizVisible = !document.getElementById('quiz-screen').classList.contains('hidden');
  if(!quizVisible) return;
  if(['1','2','3','4'].includes(e.key)){
    const idx = Number(e.key) - 1;
    const opts = document.querySelectorAll('#optionsList .option');
    if(opts[idx]) selectAnswer(idx, opts[idx]);
  } else if(e.key === 'Enter'){
    const nextBtn = document.getElementById('nextBtn');
    if(!nextBtn.classList.contains('hidden')) nextBtn.click();
  }
});

/* ---------------- Results ---------------- */
async function showResults(){
  const total = state.pool.length;

  showScreen('result-screen');
  document.getElementById('reviewList').classList.add('hidden');
  document.getElementById('reviewToggleBtn').textContent = 'Review answers';
  document.getElementById('resultScore').textContent = `${state.score}/${total}`;
  document.getElementById('rankNote').textContent = 'Saving your score…';

  const pct = Math.round((state.score / total) * 100);
  let tag = "Keep practicing — you'll get there.";
  if(pct === 100) tag = 'Perfect score! Outstanding.';
  else if(pct >= 80) tag = 'Excellent work!';
  else if(pct >= 60) tag = 'Good job — solid grasp.';
  else if(pct >= 40) tag = 'Not bad — a bit more practice will help.';
  document.getElementById('resultTag').textContent = `${tag} (${pct}%)`;

  const rankNote = document.getElementById('rankNote');
  try{
    const updated = await recordResult(state.currentUser, state.score, total);
    const { rank, total: totalPlayers, rows } = await computeRank(state.currentUser);

    if(totalPlayers <= 1){
      rankNote.textContent = "You're the first score on the board.";
    } else if(rank === 1){
      rankNote.innerHTML = `You're <strong>leading</strong> the board with a best of ${updated.bestPercent}%.`;
    } else {
      const leader = rows[0];
      rankNote.innerHTML = `Ranked <strong>#${rank}</strong> of ${totalPlayers} — ${escapeHtml(leader.name)} leads with ${leader.bestPercent}%.`;
    }
  } catch(err){
    console.error(err);
    rankNote.textContent = "Your score couldn't be saved to the live leaderboard — check your connection.";
  }

  const reviewList = document.getElementById('reviewList');
  reviewList.innerHTML = '';
  state.answers.forEach((a, i) => {
    const div = document.createElement('div');
    div.className = 'review-item';
    div.innerHTML = `
      <div class="review-q"><span class="tick ${a.isRight ? 'ok' : 'bad'}">${a.isRight ? '✓' : '✗'}</span> ${i+1}. ${a.question}</div>
      <div class="review-a">Your answer: ${a.chosen}</div>
      ${!a.isRight ? `<div class="review-a">Correct answer: ${a.correct}</div>` : ''}
    `;
    reviewList.appendChild(div);
  });
}

document.getElementById('reviewToggleBtn').addEventListener('click', () => {
  const reviewList = document.getElementById('reviewList');
  const isHidden = reviewList.classList.contains('hidden');
  reviewList.classList.toggle('hidden');
  document.getElementById('reviewToggleBtn').textContent = isHidden ? 'Hide review' : 'Review answers';
});

document.getElementById('restartBtn').addEventListener('click', () => {
  showScreen('setup-screen');
});

/* ---------------- Boot ---------------- */
loadQuestions();
showScreen('name-screen');
