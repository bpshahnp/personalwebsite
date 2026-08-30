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

/* ---------- Search (filters hub cards by keyword) ---------- */
document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  document.querySelectorAll(".hub-card").forEach((card) => {
    const text = card.textContent.toLowerCase();
    card.style.display = query === "" || text.includes(query) ? "" : "none";
  });
});

/* ---------- Login modal ---------- */
const loginModal = document.getElementById("loginModal");
const loginBtn = document.getElementById("loginBtn");
const modalClose = document.getElementById("modalClose");
const authStatus = document.getElementById("authStatus");
let isSignupMode = false;

loginBtn.addEventListener("click", () => (loginModal.hidden = false));
modalClose.addEventListener("click", () => (loginModal.hidden = true));
loginModal.addEventListener("click", (e) => {
  if (e.target === loginModal) loginModal.hidden = true;
});

document.getElementById("signupLink").addEventListener("click", (e) => {
  e.preventDefault();
  isSignupMode = !isSignupMode;
  document.querySelector("#loginForm button[type=submit]").textContent = isSignupMode
    ? "Sign Up"
    : "Login";
  e.target.textContent = isSignupMode ? "Have an account? Login" : "Sign up instead";
});

document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;

  const action = isSignupMode
    ? auth.createUserWithEmailAndPassword(email, password)
    : auth.signInWithEmailAndPassword(email, password);

  action
    .then((cred) => {
      authStatus.textContent = `Welcome, ${cred.user.email}`;
      authStatus.style.color = "green";
      setTimeout(() => (loginModal.hidden = true), 900);
    })
    .catch((err) => {
      authStatus.textContent = err.message;
      authStatus.style.color = "crimson";
    });
});

// Reflect logged-in state on the header button
auth.onAuthStateChanged((user) => {
  loginBtn.textContent = user ? `Hi, ${user.email.split("@")[0]} (Logout)` : "Login / Sign Up";
});
loginBtn.addEventListener("click", () => {
  if (auth.currentUser) auth.signOut();
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
