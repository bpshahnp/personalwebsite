/* ============================================
   leaderboard.js — renders the "scores" collection.

   Ranking is by AVERAGE percentage across a user's attempts (not their
   best single attempt), and can be scoped to a class:

   - "All classes" uses the document's top-level totals, which cover every
     attempt the user has made, mixed-class quizzes included.
   - "Class 8/9/10" uses scores.classStats[level], written by js/mcq.js.
     A user only appears on a class board once they've taken a quiz that
     was set to that specific class.

   Sorting happens in the browser rather than through orderBy(), so
   switching class costs no extra reads and needs no per-class composite
   index. That's the right trade at this scale; if the user base ever grows
   past a few hundred, move ranking back to Firestore and add one composite
   index per class.
   ============================================ */

const DISPLAY_LIMIT = 50;  // rows shown per board
const FETCH_LIMIT = 500;   // safety valve on how many score docs we pull

const leaderboardTable = document.getElementById("leaderboardTable");
const yourRankCard = document.getElementById("yourRankCard");
const boardFilter = document.getElementById("boardFilter");
const timeFilter = document.getElementById("timeFilter");

let scoreDocs = [];        // raw { id, ...data } from Firestore
let selectedClass = "All"; // Default to All classes so all players appear immediately
let selectedTime = "day";  // day, week, month, all
let loadError = "";

// Helper to generate bucket keys matching mcq.js
function getBucketKey(time) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  if (time === "day") return `day_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  if (time === "month") return `month_${d.getFullYear()}-${pad(d.getMonth()+1)}`;
  if (time === "week") {
    const d1 = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = d1.getUTCDay() || 7;
    d1.setUTCDate(d1.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d1.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d1 - yearStart) / 86400000) + 1)/7);
    return `week_${d1.getUTCFullYear()}-W${pad(weekNo)}`;
  }
  return "all_time";
}

/* ---------- Filters ---------- */
boardFilter.addEventListener("click", (e) => {
  const chip = e.target.closest(".board-chip");
  if (!chip) return;
  selectedClass = chip.dataset.class;
  boardFilter.querySelectorAll(".board-chip").forEach((c) => c.classList.toggle("active", c === chip));
  render();
});

timeFilter.addEventListener("click", (e) => {
  const chip = e.target.closest(".board-chip");
  if (!chip) return;
  selectedTime = chip.dataset.time;
  timeFilter.querySelectorAll(".board-chip").forEach((c) => c.classList.toggle("active", c === chip));
  render();
});

/* ---------- Live data ---------- */
db.collection("scores")
  .limit(FETCH_LIMIT)
  .onSnapshot(
    (snapshot) => {
      loadError = "";
      scoreDocs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      render();
    },
    (err) => {
      loadError = err.message;
      render();
    }
  );

// Re-render when the signed-in user changes
document.addEventListener("authchange", render);

/* Pull out the points that apply to the selected board + time bucket.
   Returns null when this player has 0 points on this board. */
function statsFor(doc) {
  const bucketKey = getBucketKey(selectedTime);
  const p = doc.points || {};
  
  const classGroup = p[selectedClass] || {};
  const points = classGroup[bucketKey] || 0;
  
  if (points === 0) return null;

  return {
    attempts: doc.attempts || 0, // Fallback to global attempts for ties
    points: points,
    note: selectedClass === "All" ? (doc.lastCategory || "") : `Class ${selectedClass}`,
  };
}

/* Everyone on the current board, highest points first. Ties break on the
   number of attempts (more attempts = more proven), then on name. */
function rankedPlayers() {
  return scoreDocs
    .map((doc) => ({ doc, stats: statsFor(doc) }))
    .filter((row) => row.stats)
    .sort(
      (a, b) =>
        b.stats.points - a.stats.points ||
        b.stats.attempts - a.stats.attempts ||
        (a.doc.name || "").localeCompare(b.doc.name || "")
    );
}

function render() {
  // The header row is a static child of the table — keep it, replace the rest.
  // It also has to stay the FIRST child: the medal colours in style.css hang
  // off .leaderboard-row:nth-child(2)/(3)/(4).
  const headerRow = leaderboardTable.querySelector(".header-row");
  leaderboardTable.innerHTML = "";
  if (headerRow) leaderboardTable.appendChild(headerRow);

  if (loadError) {
    leaderboardTable.appendChild(messageEl(`Could not load leaderboard (${loadError}).`));
    yourRankCard.hidden = true;
    return;
  }

  const ranked = rankedPlayers();

  if (!ranked.length) {
    const classLabel = selectedClass === "All" ? "any class" : `Class ${selectedClass}`;
    leaderboardTable.appendChild(
      messageEl(`No scores yet for ${classLabel} (${selectedTime}) — take a quiz on MCQ Hub or Live Challenge to appear here!`)
    );
    renderYourRank(ranked);
    return;
  }

  const uid = auth.currentUser ? auth.currentUser.uid : null;
  ranked.slice(0, DISPLAY_LIMIT).forEach((row, i) => {
    leaderboardTable.appendChild(playerRow(row, i + 1, row.doc.id === uid));
  });

  renderYourRank(ranked);
}

function playerRow({ doc, stats }, rank, isYou) {
  const row = document.createElement("div");
  row.className = "leaderboard-row";
  if (isYou) row.classList.add("is-you");
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
  
  let freshness = "";
  if (doc.updatedAt) {
    const ms = Date.now() - doc.updatedAt.toMillis();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days === 0) freshness = " · today";
    else if (days === 1) freshness = " · yesterday";
    else freshness = ` · ${days}d ago`;
  }

  row.innerHTML = `
    <span class="leaderboard-rank">${medal}</span>
    <span>
      <span class="leaderboard-name">${escapeHtml(doc.name || "Anonymous")}</span><br/>
      <span class="leaderboard-meta">${stats.attempts} attempt${stats.attempts === 1 ? "" : "s"}${freshness}</span>
    </span>
    <span class="leaderboard-score" style="font-size:1.15rem; font-weight:700">${stats.points} pts</span>
  `;
  return row;
}

/* Your own standing on the current board — shown only when you're signed in
   and not already visible in the rows above. Because the whole board is in
   memory, this rank is exact and needs no count() aggregation. */
function renderYourRank(ranked) {
  const user = auth.currentUser;
  if (!user) {
    yourRankCard.hidden = true;
    return;
  }

  const index = ranked.findIndex((row) => row.doc.id === user.uid);

  // Already highlighted in the table — no need for a duplicate card.
  if (index > -1 && index < DISPLAY_LIMIT) {
    yourRankCard.hidden = true;
    return;
  }

  yourRankCard.hidden = false;

  if (index === -1) {
    yourRankCard.innerHTML = `<p>You haven't earned any Class ${selectedClass} points here yet — <a href="mcq.html">take a quiz</a>!</p>`;
    return;
  }

  const { doc, stats } = ranked[index];
  yourRankCard.innerHTML = `
    <span class="leaderboard-rank">#${index + 1}</span>
    <span>
      <span class="leaderboard-name">${escapeHtml(doc.name || "You")}</span><br/>
      <span class="leaderboard-meta">${stats.attempts} attempt${stats.attempts === 1 ? "" : "s"}</span>
    </span>
    <span class="leaderboard-score" style="font-size:1.15rem; font-weight:700">${stats.points} pts</span>
  `;
}

function messageEl(text) {
  const p = document.createElement("p");
  p.className = "updates-loading";
  p.style.padding = "20px";
  p.textContent = text;
  return p;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
