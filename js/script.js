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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
