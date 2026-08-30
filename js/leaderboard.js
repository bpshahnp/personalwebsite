/* ============================================
   leaderboard.js — renders the "scores" collection,
   ranked by best percentage (then raw score).
   One document per user (doc id = uid), holding their
   personal-best quiz result. See js/mcq.js for how
   scores get written.
   ============================================ */

const leaderboardTable = document.getElementById("leaderboardTable");

db.collection("scores")
  .orderBy("percentage", "desc")
  .orderBy("score", "desc")
  .limit(50)
  .onSnapshot(
    (snapshot) => {
      // header row is always first child — keep it, replace the rest
      const headerRow = leaderboardTable.querySelector(".header-row");
      leaderboardTable.innerHTML = "";
      leaderboardTable.appendChild(headerRow);

      if (snapshot.empty) {
        const p = document.createElement("p");
        p.className = "updates-loading";
        p.style.padding = "20px";
        p.textContent = "No scores yet — be the first to take a quiz on the MCQ Hub!";
        leaderboardTable.appendChild(p);
        return;
      }

      let rank = 0;
      snapshot.forEach((doc) => {
        rank++;
        const s = doc.data();
        const row = document.createElement("div");
        row.className = "leaderboard-row";
        const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
        row.innerHTML = `
          <span class="leaderboard-rank">${medal}</span>
          <span>
            <span class="leaderboard-name">${escapeHtml(s.name || "Anonymous")}</span><br/>
            <span class="leaderboard-meta">${s.category ? escapeHtml(s.category) : "Mixed"} quiz</span>
          </span>
          <span class="leaderboard-score">${s.score} / ${s.total}<br/><span class="leaderboard-meta">${Math.round(s.percentage)}%</span></span>
        `;
        leaderboardTable.appendChild(row);
      });
    },
    (err) => {
      leaderboardTable.innerHTML = `<p class="updates-loading" style="padding:20px">Could not load leaderboard (${err.message}).</p>`;
    }
  );

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
