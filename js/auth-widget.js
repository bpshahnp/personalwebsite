/* ============================================================
   auth-widget.js — Professional Authentication & Account System
   - Multi-instance header account widget
   - Professional Sign In & Sign Up Modal with Google & Email
   - Real-time profile & credit balance synchronization
   - Clean SVG iconography without unnecessary emojis
   ============================================================ */

// Clean, professional SVG icons (no emojis)
const ACCOUNT_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';

const GOOGLE_ICON_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" style="flex-shrink:0"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/><path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 11.3 0 14s.7 5.3 1.9 7.7l3.7-2.9z"/><path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/></svg>';

const CHECK_ICON_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="20 6 9 17 4 12"></polyline></svg>';

const SHIELD_ICON_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>';

// Global user profile initialization helper: gives 2 credits by default!
async function initUserProfile(user) {
  if (!user || !db) return null;
  const userRef = db.collection("users").doc(user.uid);
  try {
    const snap = await userRef.get();
    const isGoogle = (user.providerData || []).some(p => p.providerId === "google.com");
    if (!snap.exists) {
      const data = {
        credits: 2, // Default 2 credits on account creation
        email: user.email || "",
        displayName: user.displayName || user.email.split("@")[0] || "Learner",
        googleLinked: isGoogle,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await userRef.set(data, { merge: true });
      return data;
    } else {
      const data = snap.data();
      const updates = {};
      if (isGoogle && !data.googleLinked) {
        updates.googleLinked = true;
      }
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        await userRef.set(updates, { merge: true });
      }
      return Object.assign({}, data, updates);
    }
  } catch (err) {
    console.warn("Could not sync user profile:", err);
    return null;
  }
}
window.initUserProfile = initUserProfile;

// Global Google Sign-In helper
window.signInWithGoogle = function() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return auth.signInWithPopup(provider).then(async res => {
    if (res.user) await initUserProfile(res.user);
    return res;
  });
};

/* ============================================================
   Professional Site Authentication Modal (Sign In / Sign Up)
   ============================================================ */
let siteAuthModalEl = null;

function ensureSiteAuthModal() {
  if (siteAuthModalEl && document.body.contains(siteAuthModalEl)) return siteAuthModalEl;

  const modal = document.createElement("div");
  modal.className = "modal site-auth-modal";
  modal.id = "siteAuthModal";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  modal.innerHTML = `
    <div class="modal-content">
      <button type="button" class="modal-close" id="siteAuthClose" aria-label="Close dialog">&times;</button>
      
      <div class="site-auth-header">
        <h3 id="siteAuthTitle">Welcome Back</h3>
        <p id="siteAuthSubtitle">Sign in to access your quizzes, track your scores, and manage your account.</p>
      </div>

      <div class="site-auth-tabs" role="tablist">
        <button type="button" class="site-auth-tab active" id="siteAuthTabSignin" role="tab" aria-selected="true">Sign In</button>
        <button type="button" class="site-auth-tab" id="siteAuthTabSignup" role="tab" aria-selected="false">Create Account</button>
      </div>

      <!-- Quick Google Access -->
      <button type="button" class="site-auth-google-btn" id="siteAuthGoogleBtn">
        ${GOOGLE_ICON_SVG} <span>Continue with Google</span>
      </button>

      <div class="site-auth-divider">
        <span>or continue with email</span>
      </div>

      <!-- Authentication Form -->
      <form class="site-auth-form" id="siteAuthMainForm">
        <!-- Name field for Sign Up -->
        <div id="siteAuthNameGroup" style="display:none;">
          <label>
            Full Name
            <input type="text" id="siteAuthNameInput" placeholder="John Doe" autocomplete="name" />
          </label>
        </div>

        <div>
          <label>
            Email Address
            <input type="email" id="siteAuthEmailInput" placeholder="you@example.com" required autocomplete="email" />
          </label>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
            <label style="margin:0;">Password</label>
            <a href="#" class="site-auth-forgot-link" id="siteAuthForgotLink">Forgot password?</a>
          </div>
          <input type="password" id="siteAuthPasswordInput" placeholder="At least 6 characters" required minlength="6" autocomplete="current-password" />
        </div>

        <button type="submit" class="site-auth-submit-btn" id="siteAuthSubmitBtn">Sign In</button>
      </form>

      <div class="site-auth-alert error" id="siteAuthAlertError" style="display:none; margin-top:14px;"></div>
      <div class="site-auth-alert success" id="siteAuthAlertSuccess" style="display:none; margin-top:14px;"></div>
    </div>
  `;

  document.body.appendChild(modal);
  siteAuthModalEl = modal;

  const closeBtn      = modal.querySelector("#siteAuthClose");
  const tabSignin     = modal.querySelector("#siteAuthTabSignin");
  const tabSignup     = modal.querySelector("#siteAuthTabSignup");
  const titleEl       = modal.querySelector("#siteAuthTitle");
  const subtitleEl    = modal.querySelector("#siteAuthSubtitle");
  const googleBtn     = modal.querySelector("#siteAuthGoogleBtn");
  const form          = modal.querySelector("#siteAuthMainForm");
  const nameGroup     = modal.querySelector("#siteAuthNameGroup");
  const nameInput     = modal.querySelector("#siteAuthNameInput");
  const emailInput    = modal.querySelector("#siteAuthEmailInput");
  const passwordInput = modal.querySelector("#siteAuthPasswordInput");
  const forgotLink    = modal.querySelector("#siteAuthForgotLink");
  const submitBtn     = modal.querySelector("#siteAuthSubmitBtn");
  const alertError    = modal.querySelector("#siteAuthAlertError");
  const alertSuccess  = modal.querySelector("#siteAuthAlertSuccess");

  let isSignupMode = false;

  function clearAlerts() {
    alertError.textContent = "";
    alertError.style.display = "none";
    alertSuccess.textContent = "";
    alertSuccess.style.display = "none";
  }

  function setMode(signup) {
    isSignupMode = signup;
    clearAlerts();

    tabSignin.classList.toggle("active", !signup);
    tabSignin.setAttribute("aria-selected", !signup);
    tabSignup.classList.toggle("active", signup);
    tabSignup.setAttribute("aria-selected", signup);

    nameGroup.style.display = signup ? "block" : "none";
    nameInput.required = signup;

    forgotLink.style.display = signup ? "none" : "block";
    passwordInput.autocomplete = signup ? "new-password" : "current-password";

    if (signup) {
      titleEl.textContent = "Create Your Account";
      subtitleEl.textContent = "Sign up to participate in weekly tournaments, access premium quizzes, and save your progress.";
      submitBtn.textContent = "Create Account";
    } else {
      titleEl.textContent = "Welcome Back";
      subtitleEl.textContent = "Sign in to access your quizzes, track your scores, and manage your account.";
      submitBtn.textContent = "Sign In";
    }
  }

  tabSignin.addEventListener("click", () => setMode(false));
  tabSignup.addEventListener("click", () => setMode(true));

  closeBtn.addEventListener("click", () => { modal.hidden = true; });
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) modal.hidden = true;
  });

  googleBtn.addEventListener("click", async () => {
    clearAlerts();
    googleBtn.disabled = true;
    try {
      await window.signInWithGoogle();
      modal.hidden = true;
      if (typeof modal._onSuccess === "function") modal._onSuccess();
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        alertError.textContent = err.message || "Failed to sign in with Google.";
        alertError.style.display = "flex";
      }
    } finally {
      googleBtn.disabled = false;
    }
  });

  forgotLink.addEventListener("click", async (e) => {
    e.preventDefault();
    clearAlerts();
    const email = emailInput.value.trim();
    if (!email) {
      alertError.textContent = "Please enter your email address above to receive a password reset link.";
      alertError.style.display = "flex";
      emailInput.focus();
      return;
    }
    try {
      await auth.sendPasswordResetEmail(email);
      alertSuccess.textContent = `Password reset link sent to ${email}. Please check your inbox.`;
      alertSuccess.style.display = "flex";
    } catch (err) {
      alertError.textContent = err.message || "Could not send password reset email.";
      alertError.style.display = "flex";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAlerts();

    const email    = emailInput.value.trim();
    const password = passwordInput.value;
    const name     = nameInput.value.trim();

    submitBtn.disabled = true;
    submitBtn.textContent = "Please wait…";

    try {
      if (isSignupMode) {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        if (name) {
          await cred.user.updateProfile({ displayName: name });
        }
        await initUserProfile(cred.user);
      } else {
        const res = await auth.signInWithEmailAndPassword(email, password);
        if (res.user) await initUserProfile(res.user);
      }

      modal.hidden = true;
      if (typeof modal._onSuccess === "function") modal._onSuccess();
    } catch (err) {
      let msg = err.message;
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        msg = "Incorrect email address or password.";
      } else if (err.code === "auth/user-not-found") {
        msg = "No account found with this email address.";
      } else if (err.code === "auth/email-already-in-use") {
        msg = "An account with this email already exists. Please sign in instead.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password must be at least 6 characters.";
      }
      alertError.textContent = msg;
      alertError.style.display = "flex";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = isSignupMode ? "Create Account" : "Sign In";
    }
  });

  modal._setMode = setMode;
  return modal;
}

window.openAuthModal = function(options = {}) {
  const modal = ensureSiteAuthModal();
  modal._onSuccess = options.onSuccess;
  modal._setMode(options.mode === "signup");
  modal.hidden = false;
};

/* ============================================================
   Account Header Dropdown Renderer
   ============================================================ */
function renderAuthDropdown(dropdown, user) {
  if (user) {
    const displayName = user.displayName || user.email.split("@")[0] || "Learner";
    const initial = (displayName[0] || "U").toUpperCase();

    dropdown.innerHTML = `
      <div class="auth-dropdown-user-header">
        <div class="auth-user-avatar">${escapeHtmlAuth(initial)}</div>
        <div class="auth-user-details">
          <div class="auth-user-name">${escapeHtmlAuth(displayName)}</div>
          <div class="auth-user-email">${escapeHtmlAuth(user.email)}</div>
        </div>
      </div>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; margin-bottom:10px; text-align:center;">
        <span style="font-size:0.75rem; color:#64748b; text-transform:uppercase; font-weight:700; letter-spacing:0.04em;">Credits</span>
        <div style="font-size:1.15rem; font-weight:800; color:#0f172a;">
          <span class="user-credits-val">2</span>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
        <a href="live-quiz.html" class="btn btn-outline btn-sm" style="width:100%; text-align:center; display:block; font-size:0.84rem; font-weight:600;">
          Premium Arena
        </a>
        <button type="button" class="btn btn-outline btn-sm auth-name-btn" style="width:100%; text-align:center; font-size:0.82rem;">
          Edit Display Name
        </button>
      </div>

      <button type="button" class="btn btn-outline btn-sm auth-signout-btn" style="width:100%; color:#dc2626; border-color:#fecaca; font-size:0.82rem;">
        Sign Out
      </button>
    `;

    if (db) {
      db.collection("users").doc(user.uid).onSnapshot(s => {
        if (s.exists) {
          const d = s.data();
          const creditEl = dropdown.querySelector(".user-credits-val");
          if (creditEl && d.credits != null) creditEl.textContent = d.credits;
        }
      });
    }

    dropdown.querySelector(".auth-name-btn").addEventListener("click", () => {
      const newName = prompt("Enter your display name for the leaderboard:", user.displayName || "");
      if (newName && newName.trim() !== "") {
        user.updateProfile({ displayName: newName.trim() }).then(() => {
          auth.updateCurrentUser(user);
          if (db) db.collection("users").doc(user.uid).set({ displayName: newName.trim() }, { merge: true });
        });
      }
    });

    dropdown.querySelector(".auth-signout-btn").addEventListener("click", () => {
      auth.signOut();
      dropdown.hidden = true;
    });
  } else {
    dropdown.innerHTML = `
      <button type="button" class="site-auth-google-btn" style="margin-bottom:10px; font-size:0.86rem; padding:8px 12px;">
        ${GOOGLE_ICON_SVG} <span>Continue with Google</span>
      </button>

      <div style="display:flex; flex-direction:column; gap:8px;">
        <button type="button" class="btn btn-primary btn-sm auth-launch-signin" style="width:100%; font-size:0.86rem; font-weight:600;">
          Sign In
        </button>
        <button type="button" class="btn btn-outline btn-sm auth-launch-signup" style="width:100%; font-size:0.86rem; font-weight:600;">
          Create Free Account
        </button>
      </div>
    `;

    dropdown.querySelector(".site-auth-google-btn").addEventListener("click", () => {
      dropdown.hidden = true;
      window.signInWithGoogle();
    });
    dropdown.querySelector(".auth-launch-signin").addEventListener("click", () => {
      dropdown.hidden = true;
      window.openAuthModal({ mode: "signin" });
    });
    dropdown.querySelector(".auth-launch-signup").addEventListener("click", () => {
      dropdown.hidden = true;
      window.openAuthModal({ mode: "signup" });
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
      const currentUser = auth.currentUser;
      if (!currentUser) {
        window.openAuthModal({ mode: "signin" });
        return;
      }

      widgets.forEach((w) => {
        if (w !== widget) {
          const d = w.querySelector(".auth-dropdown");
          if (d) d.hidden = true;
        }
      });
      dropdown.hidden = !dropdown.hidden;
    });
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".auth-widget")) {
      widgets.forEach((w) => {
        const d = w.querySelector(".auth-dropdown");
        if (d) d.hidden = true;
      });
    }
  });

  auth.onAuthStateChanged((user) => {
    widgets.forEach((widget) => {
      const btn = widget.querySelector(".auth-icon-btn");
      const dropdown = widget.querySelector(".auth-dropdown");
      if (!btn || !dropdown) return;

      btn.textContent = "";
      if (user) {
        const initial = (user.displayName ? user.displayName[0] : user.email[0]).toUpperCase();
        btn.textContent = initial;
      } else {
        btn.innerHTML = ACCOUNT_ICON_SVG;
      }
      btn.classList.toggle("signed-in", !!user);
      renderAuthDropdown(dropdown, user);
    });
    if (user) {
      initUserProfile(user);
    }
    document.dispatchEvent(new CustomEvent("authchange", { detail: { user } }));
  });
}

setupAuthWidgets();

function escapeHtmlAuth(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

/* ============================================================
   MCQ Auth Prompt Modal
   Prompts unauthenticated users when clicking MCQ
   with optional Sign Up / Log In or Continue without login.
   ============================================================ */
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

      <button type="button" class="site-auth-google-btn" id="mcqGoogleBtn" style="margin-bottom:14px;">
        ${GOOGLE_ICON_SVG} <span>Continue with Google</span>
      </button>

      <div class="mcq-modal-divider">
        <span>or</span>
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

  const tabLogin = modal.querySelector("#mcqTabLogin");
  const tabSignup = modal.querySelector("#mcqTabSignup");
  const nameGroup = modal.querySelector("#mcqNameGroup");
  const nameInput = modal.querySelector("#mcqNameInput");
  const passwordInput = modal.querySelector("#mcqPasswordInput");
  const submitBtn = modal.querySelector("#mcqSubmitBtn");
  const statusEl = modal.querySelector("#mcqModalStatus");
  const closeBtn = modal.querySelector("#mcqModalClose");
  const guestBtn = modal.querySelector("#mcqGuestBtn");
  const googleBtn = modal.querySelector("#mcqGoogleBtn");

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

  closeBtn.addEventListener("click", () => { modal.hidden = true; });
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) modal.hidden = true;
  });

  googleBtn.addEventListener("click", async () => {
    try {
      await window.signInWithGoogle();
      modal.hidden = true;
      if (typeof modal._onSuccess === "function") modal._onSuccess();
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        statusEl.textContent = err.message;
      }
    }
  });

  modal._setMode = setMode;
  modal._isSignup = () => isSignupMode;

  return modal;
}

window.openMcqAuthModal = function (options = {}) {
  const modal = ensureMcqModal();
  modal._onSuccess = options.onSuccess;
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

  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);

  const newGuestBtn = guestBtn.cloneNode(true);
  guestBtn.parentNode.replaceChild(newGuestBtn, guestBtn);

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
        window.location.href = options.targetUrl || "../mcq/mcq.html";
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
      .then(async (res) => {
        if (res.user) await initUserProfile(res.user);
        modal.hidden = true;
        if (typeof options.onSuccess === "function") {
          options.onSuccess();
        } else {
          const isMcqPage = window.location.pathname.endsWith("mcq.html") || window.location.pathname.includes("mcq.html");
          if (!isMcqPage) {
            window.location.href = options.targetUrl || "../mcq/mcq.html";
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

  if (auth && auth.currentUser) return;
  if (isMcqGuestMode()) return;

  const currentPath = window.location.pathname;
  if (currentPath.endsWith("mcq.html") || currentPath.includes("/mcq.html")) {
    if (link.classList.contains("active") || link.getAttribute("href") === "../mcq/mcq.html") {
      return;
    }
  }

  e.preventDefault();

  const navDrawer = document.getElementById("navDrawer");
  const drawerOverlay = document.getElementById("drawerOverlay");
  if (navDrawer) navDrawer.classList.remove("open");
  if (drawerOverlay) drawerOverlay.classList.remove("visible");

  const targetHref = link.getAttribute("href") || "../mcq/mcq.html";

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
