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

let scoreDocs = [];        // raw { id, ...data } from Firestore
let selectedClass = "All";
let loadError = "";

/* ---------- Class filter chips ---------- */
boardFilter.addEventListener("click", (e) => {
  const chip = e.target.closest(".board-chip");
  if (!chip) return;
  selectedClass = chip.dataset.class;
  boardFilter
    .querySelectorAll(".board-chip")
    .forEach((c) => c.classList.toggle("active", c === chip));
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

// Re-render when the signed-in user changes, so the "you" highlight and the
// your-rank card follow login/logout without a page refresh.
document.addEventListener("authchange", render);

/* Pull out the stats that apply to the selected board.
   Returns null when this player has nothing on this board. */
function statsFor(doc) {
  if (selectedClass === "All") {
    const attempts = doc.attempts || 0;
    if (!attempts) return null;
    return {
      attempts,
      average: doc.averagePercentage || 0,
      best: doc.bestPercentage || 0,
      note: doc.lastCategory || "",
    };
  }

  const c = (doc.classStats || {})[selectedClass];
  const attempts = c && c.attempts ? c.attempts : 0;
  if (!attempts) return null;
  return {
    attempts,
    average: c.averagePercentage || 0,
    best: c.bestPercentage || 0,
    note: `Class ${selectedClass}`,
  };
}

/* Everyone on the current board, best average first. Ties break on the
   number of attempts (more attempts = more proven), then on name so the
   order stays stable between renders. */
function rankedPlayers() {
  return scoreDocs
    .map((doc) => ({ doc, stats: statsFor(doc) }))
    .filter((row) => row.stats)
    .sort(
      (a, b) =>
        b.stats.average - a.stats.average ||
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
    leaderboardTable.appendChild(
      messageEl(
        selectedClass === "All"
          ? "No scores yet — be the first to take a quiz on the MCQ Hub!"
          : `No Class ${selectedClass} scores yet — take a Class ${selectedClass} quiz on the MCQ Hub to open this board.`
      )
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
  row.innerHTML = `
    <span class="leaderboard-rank">${medal}</span>
    <span>
      <span class="leaderboard-name">${escapeHtml(doc.name || "Anonymous")}</span><br/>
      <span class="leaderboard-meta">${stats.attempts} attempt${stats.attempts === 1 ? "" : "s"} · best ${Math.round(stats.best)}%</span>
    </span>
    <span class="leaderboard-score">${Math.round(stats.average)}% avg<br/><span class="leaderboard-meta">${escapeHtml(stats.note || "Mixed")}</span></span>
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
    yourRankCard.innerHTML =
      selectedClass === "All"
        ? `<p>You haven't taken a quiz yet — <a href="mcq.html">take one now</a> to get on the board!</p>`
        : `<p>You haven't taken a Class ${selectedClass} quiz yet — <a href="mcq.html">take one now</a> to appear on this board.</p>`;
    return;
  }

  const { doc, stats } = ranked[index];
  yourRankCard.innerHTML = `
    <span class="leaderboard-rank">#${index + 1}</span>
    <span>
      <span class="leaderboard-name">${escapeHtml(doc.name || "You")}</span><br/>
      <span class="leaderboard-meta">${stats.attempts} attempt${stats.attempts === 1 ? "" : "s"} · best ${Math.round(stats.best)}%</span>
    </span>
    <span class="leaderboard-score">${Math.round(stats.average)}% avg</span>
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
