/* ============================================
   leaderboard.js — renders the "scores" collection,
   ranked by AVERAGE percentage across all of a user's
   quiz attempts (not just their best one). Also shows
   the signed-in visitor their own rank even if they're
   outside the top 50.
   One document per user (doc id = uid). See js/mcq.js
   for how scores/averages get written.
   ============================================ */

const leaderboardTable = document.getElementById("leaderboardTable");
const yourRankCard = document.getElementById("yourRankCard");

let topRankedUids = new Set();

db.collection("scores")
  .orderBy("averagePercentage", "desc")
  .orderBy("attempts", "desc")
  .limit(50)
  .onSnapshot(
    (snapshot) => {
      // header row is always first child — keep it, replace the rest
      const headerRow = leaderboardTable.querySelector(".header-row");
      leaderboardTable.innerHTML = "";
      leaderboardTable.appendChild(headerRow);
      topRankedUids = new Set();

      if (snapshot.empty) {
        const p = document.createElement("p");
        p.className = "updates-loading";
        p.style.padding = "20px";
        p.textContent = "No scores yet — be the first to take a quiz on the MCQ Hub!";
        leaderboardTable.appendChild(p);
      } else {
        let rank = 0;
        snapshot.forEach((doc) => {
          rank++;
          topRankedUids.add(doc.id);
          const s = doc.data();
          const row = document.createElement("div");
          row.className = "leaderboard-row";
          if (auth.currentUser && doc.id === auth.currentUser.uid) row.classList.add("is-you");
          const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
          const attempts = s.attempts || 0;
          row.innerHTML = `
            <span class="leaderboard-rank">${medal}</span>
            <span>
              <span class="leaderboard-name">${escapeHtml(s.name || "Anonymous")}</span><br/>
              <span class="leaderboard-meta">${attempts} attempt${attempts === 1 ? "" : "s"} · best ${Math.round(s.bestPercentage || 0)}%</span>
            </span>
            <span class="leaderboard-score">${Math.round(s.averagePercentage || 0)}% avg<br/><span class="leaderboard-meta">${s.lastCategory ? escapeHtml(s.lastCategory) : "Mixed"}</span></span>
          `;
          leaderboardTable.appendChild(row);
        });
      }

      updateYourRank();
    },
    (err) => {
      leaderboardTable.innerHTML = `<p class="updates-loading" style="padding:20px">Could not load leaderboard (${err.message}).</p>`;
    }
  );

// Re-check when the signed-in user changes (login/logout while on this page).
document.addEventListener("authchange", updateYourRank);

function updateYourRank() {
  const user = auth.currentUser;
  if (!user) {
    yourRankCard.hidden = true;
    return;
  }

  // Already visible (and highlighted) in the top-50 list above — no need
  // for a separate card.
  if (topRankedUids.has(user.uid)) {
    yourRankCard.hidden = true;
    return;
  }

  db.collection("scores")
    .doc(user.uid)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        yourRankCard.hidden = false;
        yourRankCard.innerHTML = `<p>You haven't taken a quiz yet — <a href="mcq.html">take one now</a> to get on the board!</p>`;
        return;
      }
      const data = doc.data();
      const avg = data.averagePercentage || 0;

      return db
        .collection("scores")
        .where("averagePercentage", ">", avg)
        .count()
        .get()
        .then((countSnap) => {
          const rank = countSnap.data().count + 1;
          const attempts = data.attempts || 0;
          yourRankCard.hidden = false;
          yourRankCard.innerHTML = `
            <span class="leaderboard-rank">#${rank}</span>
            <span>
              <span class="leaderboard-name">${escapeHtml(data.name || "You")}</span><br/>
              <span class="leaderboard-meta">${attempts} attempt${attempts === 1 ? "" : "s"} · best ${Math.round(data.bestPercentage || 0)}%</span>
            </span>
            <span class="leaderboard-score">${Math.round(avg)}% avg</span>
          `;
        });
    })
    .catch(() => {
      // Count aggregation unsupported/blocked — fail quietly, the main
      // leaderboard still works fine without this extra card.
      yourRankCard.hidden = true;
    });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
