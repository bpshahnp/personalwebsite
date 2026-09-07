/* ============================================
   script.js — home page behavior + Firebase wiring
   (mobile nav drawer + dropdown-toggle now live in
   js/nav-drawer.js, shared across all pages)
   ============================================ */

document.getElementById("year").textContent = new Date().getFullYear();

/* ---------- Search (filters hub cards by keyword) ----------
   Works from both the desktop search box and the mobile one —
   nav-drawer.js mirrors typing from the mobile box into this one.
------------------------------------------------------------- */
const searchInput = document.getElementById("searchInput");

function filterHubCards() {
  const query = searchInput.value.trim().toLowerCase();
  document.querySelectorAll(".hub-card").forEach((card) => {
    const text = card.textContent.toLowerCase();
    card.style.display = query === "" || text.includes(query) ? "" : "none";
  });
}

document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  filterHubCards();
});
searchInput.addEventListener("input", filterHubCards);

/* ---------- Latest Updates — live from Firestore ----------
   Firestore collection: "updates"
   Each document: { title: string, date: string (or Timestamp), order: number }
   This is what keeps "Latest Updates" in sync across every device:
   whoever edits the "updates" collection (e.g. from the Firebase
   console, or an admin page you build later) — every visitor's
   browser sees the change immediately.
------------------------------------------------------------- */
const updatesList = document.getElementById("updatesList");

db.collection("updates")
  .orderBy("order", "desc")
  .limit(6)
  .onSnapshot(
    (snapshot) => {
      if (snapshot.empty) {
        updatesList.innerHTML = `<li class="updates-loading">No updates yet — add one in the Firestore "updates" collection.</li>`;
        return;
      }
      updatesList.innerHTML = "";
      snapshot.forEach((doc) => {
        const data = doc.data();
        const li = document.createElement("li");
        li.innerHTML = `<span>${escapeHtml(data.title || "Untitled update")}</span>
                         <span class="update-date">${escapeHtml(data.date || "")}</span>`;
        updatesList.appendChild(li);
      });
    },
    (err) => {
      updatesList.innerHTML = `<li class="updates-loading">Could not load updates (${err.message}). Check your Firebase config.</li>`;
    }
  );

/* ---------- Live Hero Stats from Firestore ----------
   Automatically updates MCQ Question count, Python Program count,
   and Curriculum Class Range whenever questions/programs are added or deleted.
------------------------------------------------------------- */
const statMcqCount = document.getElementById("statMcqCount");
const statPythonCount = document.getElementById("statPythonCount");
const statClassRange = document.getElementById("statClassRange");

if (typeof db !== "undefined") {
  if (statMcqCount || statClassRange) {
    db.collection("questions").onSnapshot(
      (snapshot) => {
        const total = snapshot.size;
        if (total > 0 && statMcqCount) {
          statMcqCount.textContent = `${total}+`;
        }

        if (statClassRange) {
          const classesSet = new Set();
          snapshot.forEach((doc) => {
            const data = doc.data();
            const digits = String(data.classLevel ?? data.class ?? "").match(/\d+/);
            const cls = digits ? parseInt(digits[0], 10) : 10;
            classesSet.add(cls);
          });

          if (classesSet.size > 0) {
            const sorted = Array.from(classesSet).sort((a, b) => a - b);
            if (sorted.length === 1) {
              statClassRange.textContent = `Class ${sorted[0]}`;
            } else {
              statClassRange.textContent = `Classes ${sorted[0]}–${sorted[sorted.length - 1]}`;
            }
          }
        }
      },
      (err) => console.error("Error fetching questions stats:", err)
    );
  }

  if (statPythonCount) {
    db.collection("pythonPrograms").onSnapshot(
      (snapshot) => {
        const total = snapshot.size;
        if (total > 0) {
          statPythonCount.textContent = `${total}+`;
        }
      },
      (err) => console.error("Error fetching python programs stats:", err)
    );
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
