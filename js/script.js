/* ============================================
   script.js — site behavior + Firebase wiring
   ============================================ */

document.getElementById("year").textContent = new Date().getFullYear();

/* ---------- Mobile nav toggle ---------- */
const navToggle = document.getElementById("navToggle");
const siteHeader = document.querySelector(".site-header");
navToggle.addEventListener("click", () => {
  siteHeader.classList.toggle("open");
});

/* ---------- "See More Options" dropdown: tap-to-toggle (mobile) ---------- */
document.querySelectorAll(".dropdown-toggle").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    btn.closest(".dropdown").classList.toggle("open");
  });
});

// Collapse the mobile menu after tapping a nav/dropdown link
document.querySelectorAll(".main-nav a").forEach((link) => {
  link.addEventListener("click", () => siteHeader.classList.remove("open"));
});

/* ---------- Search (filters hub cards by keyword) ---------- */
document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  document.querySelectorAll(".hub-card").forEach((card) => {
    const text = card.textContent.toLowerCase();
    card.style.display = query === "" || text.includes(query) ? "" : "none";
  });
});

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
