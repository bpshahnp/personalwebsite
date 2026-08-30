/* ============================================
   auth-widget.js — compact account icon + dropdown
   used in the header on every page (replaces the old
   full-width "Hi, name (Logout)" button).
   Requires markup:
     <div class="auth-widget">
       <button class="auth-icon-btn" id="authIconBtn">👤</button>
       <div class="auth-dropdown" id="authDropdown" hidden></div>
     </div>
   ============================================ */

const authIconBtn = document.getElementById("authIconBtn");
const authDropdown = document.getElementById("authDropdown");

function renderAuthDropdown(user) {
  if (user) {
    authDropdown.innerHTML = `
      <p class="auth-email">${escapeHtmlAuth(user.email)}</p>
      <a href="leaderboard.html" class="btn btn-outline btn-sm" style="width:100%;text-align:center;display:block;margin-bottom:8px">View Leaderboard</a>
      <button class="btn btn-outline btn-sm" id="authSignOutBtn" style="width:100%">Logout</button>
    `;
    document.getElementById("authSignOutBtn").addEventListener("click", () => {
      auth.signOut();
      authDropdown.hidden = true;
    });
  } else {
    authDropdown.innerHTML = `
      <form id="authForm" class="auth-form">
        <input type="email" id="authEmail" placeholder="Email" required autocomplete="email" />
        <input type="password" id="authPassword" placeholder="Password" required minlength="6" autocomplete="current-password" />
        <button type="submit" class="btn btn-primary btn-sm" id="authSubmitBtn" style="width:100%">Login</button>
        <p class="auth-alt"><a href="#" id="authToggleMode">Need an account? Sign up</a></p>
        <p class="auth-status" id="authFormStatus"></p>
      </form>
    `;
    let isSignup = false;
    document.getElementById("authToggleMode").addEventListener("click", (e) => {
      e.preventDefault();
      isSignup = !isSignup;
      document.getElementById("authSubmitBtn").textContent = isSignup ? "Sign Up" : "Login";
      e.target.textContent = isSignup ? "Have an account? Login" : "Need an account? Sign up";
    });
    document.getElementById("authForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("authEmail").value;
      const password = document.getElementById("authPassword").value;
      const status = document.getElementById("authFormStatus");
      const action = isSignup
        ? auth.createUserWithEmailAndPassword(email, password)
        : auth.signInWithEmailAndPassword(email, password);
      action
        .then(() => (authDropdown.hidden = true))
        .catch((err) => (status.textContent = err.message));
    });
  }
}

auth.onAuthStateChanged((user) => {
  authIconBtn.textContent = user ? user.email[0].toUpperCase() : "👤";
  authIconBtn.classList.toggle("signed-in", !!user);
  renderAuthDropdown(user);
  document.dispatchEvent(new CustomEvent("authchange", { detail: { user } }));
});

authIconBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  authDropdown.hidden = !authDropdown.hidden;
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".auth-widget")) authDropdown.hidden = true;
});

function escapeHtmlAuth(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
