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
    const displayName = user.displayName || user.email;
    dropdown.innerHTML = `
      <p class="auth-email">${escapeHtmlAuth(displayName)}</p>
      <button class="btn btn-outline btn-sm auth-name-btn" style="width:100%;text-align:center;display:block;margin-bottom:8px">Change Name</button>
      <a href="leaderboard.html" class="btn btn-outline btn-sm" style="width:100%;text-align:center;display:block;margin-bottom:8px">View Leaderboard</a>
      <button class="btn btn-outline btn-sm auth-signout-btn" style="width:100%">Logout</button>
    `;
    dropdown.querySelector(".auth-name-btn").addEventListener("click", () => {
      const newName = prompt("Enter your display name (this will appear on the leaderboard):", user.displayName || "");
      if (newName && newName.trim() !== "") {
        user.updateProfile({ displayName: newName.trim() }).then(() => {
          // Force a quick refresh of the UI by re-triggering the state
          auth.updateCurrentUser(user);
        });
      }
    });
    dropdown.querySelector(".auth-signout-btn").addEventListener("click", () => {
      auth.signOut();
      dropdown.hidden = true;
    });
  } else {
    dropdown.innerHTML = `
      <form class="auth-form">
        <input type="text" class="auth-name-input" placeholder="Display Name" style="display:none; width:100%; margin-bottom:8px; padding:8px; border:1px solid var(--border); border-radius:4px" />
        <input type="email" class="auth-email-input" placeholder="Email" required autocomplete="email" style="width:100%; margin-bottom:8px; padding:8px; border:1px solid var(--border); border-radius:4px" />
        <input type="password" class="auth-password-input" placeholder="Password" required minlength="6" autocomplete="current-password" style="width:100%; margin-bottom:8px; padding:8px; border:1px solid var(--border); border-radius:4px" />
        <button type="submit" class="btn btn-primary btn-sm auth-submit-btn" style="width:100%">Login</button>
        <p class="auth-alt"><a href="#" class="auth-toggle-mode">Need an account? Sign up</a></p>
        <p class="auth-status"></p>
      </form>
    `;
    let isSignup = false;
    const submitBtn = dropdown.querySelector(".auth-submit-btn");
    const toggleLink = dropdown.querySelector(".auth-toggle-mode");
    const nameInput = dropdown.querySelector(".auth-name-input");
    toggleLink.addEventListener("click", (e) => {
      e.preventDefault();
      isSignup = !isSignup;
      nameInput.style.display = isSignup ? "block" : "none";
      if (isSignup) nameInput.required = true;
      else nameInput.required = false;
      submitBtn.textContent = isSignup ? "Sign Up" : "Login";
      toggleLink.textContent = isSignup ? "Have an account? Login" : "Need an account? Sign up";
    });
    dropdown.querySelector(".auth-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const email = dropdown.querySelector(".auth-email-input").value;
      const password = dropdown.querySelector(".auth-password-input").value;
      const name = nameInput.value;
      const status = dropdown.querySelector(".auth-status");
      
      const action = isSignup
        ? auth.createUserWithEmailAndPassword(email, password).then(cred => {
            if (name.trim() !== "") {
              return cred.user.updateProfile({ displayName: name.trim() }).then(() => cred);
            }
            return cred;
          })
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

/* ============================================
   MCQ Auth Prompt Modal
   Prompts unauthenticated users when clicking MCQ
   with optional Sign Up / Log In or Continue without login.
   ============================================ */

function isMcqGuestMode() {
  try {
    return sessionStorage.getItem("mcq_guest_mode") === "true";
  } catch (e) {
    return false;
  }
}

function setMcqGuestMode() {
  try {
    sessionStorage.setItem("mcq_guest_mode", "true");
  } catch (e) {}
}

window.isMcqGuestMode = isMcqGuestMode;
window.setMcqGuestMode = setMcqGuestMode;

let mcqModalEl = null;

function ensureMcqModal() {
  if (mcqModalEl && document.body.contains(mcqModalEl)) return mcqModalEl;

  const modal = document.createElement("div");
  modal.className = "modal mcq-auth-modal";
  modal.id = "mcqAuthModal";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "mcqModalTitle");

  modal.innerHTML = `
    <div class="modal-content">
      <button type="button" class="modal-close" id="mcqModalClose" aria-label="Close dialog">&times;</button>
      
      <div class="mcq-modal-header">
        <div class="mcq-modal-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        </div>
        <h3 id="mcqModalTitle">Save Your Progress</h3>
        <p class="mcq-modal-subtitle" id="mcqModalSubtitle">Log in or create a free account to save your score to the leaderboard and track your progress, or continue as a guest.</p>
      </div>

      <div class="mcq-modal-tabs" role="tablist">
        <button type="button" class="mcq-modal-tab active" id="mcqTabLogin" role="tab" aria-selected="true">Log In</button>
        <button type="button" class="mcq-modal-tab" id="mcqTabSignup" role="tab" aria-selected="false">Sign Up</button>
      </div>

      <form class="mcq-modal-form" id="mcqAuthForm">
        <div class="mcq-name-group" id="mcqNameGroup" style="display: none; margin-bottom: 12px;">
          <label>
            Display Name
            <input type="text" id="mcqNameInput" placeholder="Your name (shown on leaderboard)" autocomplete="name" />
          </label>
        </div>

        <div style="margin-bottom: 12px;">
          <label>
            Email address
            <input type="email" id="mcqEmailInput" placeholder="you@example.com" required autocomplete="email" />
          </label>
        </div>

        <div style="margin-bottom: 14px;">
          <label>
            Password
            <input type="password" id="mcqPasswordInput" placeholder="At least 6 characters" required minlength="6" autocomplete="current-password" />
          </label>
        </div>

        <button type="submit" class="btn btn-primary btn-block" id="mcqSubmitBtn" style="width: 100%;">Log In &amp; Continue</button>
        <p class="mcq-modal-status" id="mcqModalStatus" style="color: crimson;"></p>
      </form>

      <div class="mcq-modal-divider">
        <span>or</span>
      </div>

      <button type="button" class="mcq-guest-btn" id="mcqGuestBtn">
        Continue without login &rarr;
      </button>
    </div>
  `;

  document.body.appendChild(modal);
  mcqModalEl = modal;

  // Setup tab toggles
  const tabLogin = modal.querySelector("#mcqTabLogin");
  const tabSignup = modal.querySelector("#mcqTabSignup");
  const nameGroup = modal.querySelector("#mcqNameGroup");
  const nameInput = modal.querySelector("#mcqNameInput");
  const passwordInput = modal.querySelector("#mcqPasswordInput");
  const submitBtn = modal.querySelector("#mcqSubmitBtn");
  const statusEl = modal.querySelector("#mcqModalStatus");
  const closeBtn = modal.querySelector("#mcqModalClose");
  const guestBtn = modal.querySelector("#mcqGuestBtn");

  let isSignupMode = false;

  function setMode(signup) {
    isSignupMode = signup;
    tabLogin.classList.toggle("active", !signup);
    tabLogin.setAttribute("aria-selected", !signup);
    tabSignup.classList.toggle("active", signup);
    tabSignup.setAttribute("aria-selected", signup);

    nameGroup.style.display = signup ? "block" : "none";
    nameInput.required = signup;
    passwordInput.autocomplete = signup ? "new-password" : "current-password";
    submitBtn.textContent = signup ? "Sign Up & Continue" : "Log In & Continue";
    statusEl.textContent = "";
  }

  tabLogin.addEventListener("click", () => setMode(false));
  tabSignup.addEventListener("click", () => setMode(true));

  closeBtn.addEventListener("click", () => {
    modal.hidden = true;
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.hidden = true;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) {
      modal.hidden = true;
    }
  });

  modal._setMode = setMode;
  modal._isSignup = () => isSignupMode;

  return modal;
}

window.openMcqAuthModal = function (options = {}) {
  const modal = ensureMcqModal();
  const titleEl = modal.querySelector("#mcqModalTitle");
  const subtitleEl = modal.querySelector("#mcqModalSubtitle");
  const guestBtn = modal.querySelector("#mcqGuestBtn");
  const form = modal.querySelector("#mcqAuthForm");
  const emailInput = modal.querySelector("#mcqEmailInput");
  const passwordInput = modal.querySelector("#mcqPasswordInput");
  const nameInput = modal.querySelector("#mcqNameInput");
  const submitBtn = modal.querySelector("#mcqSubmitBtn");
  const statusEl = modal.querySelector("#mcqModalStatus");

  if (options.title) titleEl.textContent = options.title;
  if (options.subtitle) subtitleEl.textContent = options.subtitle;

  statusEl.textContent = "";
  emailInput.value = "";
  passwordInput.value = "";
  nameInput.value = "";
  submitBtn.disabled = false;
  modal._setMode(false);

  // Clear previous event listeners by cloning form and guestBtn
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);

  const newGuestBtn = guestBtn.cloneNode(true);
  guestBtn.parentNode.replaceChild(newGuestBtn, guestBtn);

  // Re-fetch cloned references
  const freshEmail = newForm.querySelector("#mcqEmailInput");
  const freshPassword = newForm.querySelector("#mcqPasswordInput");
  const freshName = newForm.querySelector("#mcqNameInput");
  const freshSubmitBtn = newForm.querySelector("#mcqSubmitBtn");
  const freshStatus = newForm.querySelector("#mcqModalStatus");

  newGuestBtn.addEventListener("click", () => {
    setMcqGuestMode();
    modal.hidden = true;
    if (typeof options.onGuest === "function") {
      options.onGuest();
    } else {
      const isMcqPage = window.location.pathname.endsWith("mcq.html") || window.location.pathname.includes("mcq.html");
      if (!isMcqPage) {
        window.location.href = options.targetUrl || "mcq.html";
      }
    }
  });

  newForm.addEventListener("submit", (e) => {
    e.preventDefault();
    freshStatus.textContent = "";
    freshSubmitBtn.disabled = true;
    freshSubmitBtn.textContent = "Please wait…";

    const email = freshEmail.value.trim();
    const password = freshPassword.value;
    const name = freshName.value.trim();
    const isSignup = modal._isSignup();

    const authPromise = isSignup
      ? auth.createUserWithEmailAndPassword(email, password).then((cred) => {
          if (name !== "") {
            return cred.user.updateProfile({ displayName: name }).then(() => cred);
          }
          return cred;
        })
      : auth.signInWithEmailAndPassword(email, password);

    authPromise
      .then(() => {
        modal.hidden = true;
        if (typeof options.onSuccess === "function") {
          options.onSuccess();
        } else {
          const isMcqPage = window.location.pathname.endsWith("mcq.html") || window.location.pathname.includes("mcq.html");
          if (!isMcqPage) {
            window.location.href = options.targetUrl || "mcq.html";
          }
        }
      })
      .catch((err) => {
        freshStatus.textContent = err.message;
        freshSubmitBtn.disabled = false;
        freshSubmitBtn.textContent = isSignup ? "Sign Up & Continue" : "Log In & Continue";
      });
  });

  modal.hidden = false;
  setTimeout(() => freshEmail.focus(), 50);
};

// Global click interception for MCQ links across all pages
document.addEventListener("click", (e) => {
  const link = e.target.closest('a[href*="mcq.html"], a[href="mcq.html"]');
  if (!link) return;

  // If already authenticated, allow normal navigation
  if (auth && auth.currentUser) return;

  // If guest mode was already selected in this session, allow normal navigation
  if (isMcqGuestMode()) return;

  // If already on mcq.html and clicking the active link
  const currentPath = window.location.pathname;
  if (currentPath.endsWith("mcq.html") || currentPath.includes("/mcq.html")) {
    if (link.classList.contains("active") || link.getAttribute("href") === "mcq.html") {
      return;
    }
  }

  e.preventDefault();

  // Close mobile drawer if open
  const navDrawer = document.getElementById("navDrawer");
  const drawerOverlay = document.getElementById("drawerOverlay");
  if (navDrawer) navDrawer.classList.remove("open");
  if (drawerOverlay) drawerOverlay.classList.remove("visible");

  const targetHref = link.getAttribute("href") || "mcq.html";

  window.openMcqAuthModal({
    title: "MCQ Quiz Hub",
    subtitle: "Sign up or log in to track your scores on the Leaderboard and save topic progress, or continue as a guest.",
    onSuccess: () => {
      window.location.href = targetHref;
    },
    onGuest: () => {
      window.location.href = targetHref;
    }
  });
});

