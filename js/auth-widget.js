/* ============================================
   auth-widget.js — compact account icon + dropdown.
   Supports MULTIPLE instances on one page (e.g. one in
   the desktop header, one inside the mobile nav drawer)
   — all instances share the same Firebase auth state.

   Each instance needs this markup, wrapped in .auth-widget:
     <div class="auth-widget">
       <button class="auth-icon-btn">👤</button>
       <div class="auth-dropdown" hidden></div>
     </div>
   ============================================ */

const ACCOUNT_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';

function renderAuthDropdown(dropdown, user) {
  if (user) {
    dropdown.innerHTML = `
      <p class="auth-email">${escapeHtmlAuth(user.email)}</p>
      <a href="leaderboard.html" class="btn btn-outline btn-sm" style="width:100%;text-align:center;display:block;margin-bottom:8px">View Leaderboard</a>
      <button class="btn btn-outline btn-sm auth-signout-btn" style="width:100%">Logout</button>
    `;
    dropdown.querySelector(".auth-signout-btn").addEventListener("click", () => {
      auth.signOut();
      dropdown.hidden = true;
    });
  } else {
    dropdown.innerHTML = `
      <form class="auth-form">
        <input type="email" class="auth-email-input" placeholder="Email" required autocomplete="email" />
        <input type="password" class="auth-password-input" placeholder="Password" required minlength="6" autocomplete="current-password" />
        <button type="submit" class="btn btn-primary btn-sm auth-submit-btn" style="width:100%">Login</button>
        <p class="auth-alt"><a href="#" class="auth-toggle-mode">Need an account? Sign up</a></p>
        <p class="auth-status"></p>
      </form>
    `;
    let isSignup = false;
    const submitBtn = dropdown.querySelector(".auth-submit-btn");
    const toggleLink = dropdown.querySelector(".auth-toggle-mode");
    toggleLink.addEventListener("click", (e) => {
      e.preventDefault();
      isSignup = !isSignup;
      submitBtn.textContent = isSignup ? "Sign Up" : "Login";
      toggleLink.textContent = isSignup ? "Have an account? Login" : "Need an account? Sign up";
    });
    dropdown.querySelector(".auth-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const email = dropdown.querySelector(".auth-email-input").value;
      const password = dropdown.querySelector(".auth-password-input").value;
      const status = dropdown.querySelector(".auth-status");
      const action = isSignup
        ? auth.createUserWithEmailAndPassword(email, password)
        : auth.signInWithEmailAndPassword(email, password);
      action
        .then(() => (dropdown.hidden = true))
        .catch((err) => (status.textContent = err.message));
    });
  }
}

function setupAuthWidgets() {
  const widgets = document.querySelectorAll(".auth-widget");

  widgets.forEach((widget) => {
    const btn = widget.querySelector(".auth-icon-btn");
    const dropdown = widget.querySelector(".auth-dropdown");
    if (!btn || !dropdown) return;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      widgets.forEach((w) => {
        if (w !== widget) w.querySelector(".auth-dropdown").hidden = true;
      });
      dropdown.hidden = !dropdown.hidden;
    });
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".auth-widget")) {
      widgets.forEach((w) => (w.querySelector(".auth-dropdown").hidden = true));
    }
  });

  auth.onAuthStateChanged((user) => {
    widgets.forEach((widget) => {
      const btn = widget.querySelector(".auth-icon-btn");
      const dropdown = widget.querySelector(".auth-dropdown");
      if (!btn || !dropdown) return;
      btn.textContent = "";
      if (user) {
        btn.textContent = user.email[0].toUpperCase();
      } else {
        btn.innerHTML = ACCOUNT_ICON_SVG;
      }
      btn.classList.toggle("signed-in", !!user);
      renderAuthDropdown(dropdown, user);
    });
    document.dispatchEvent(new CustomEvent("authchange", { detail: { user } }));
  });
}

setupAuthWidgets();

function escapeHtmlAuth(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
