/* ============================================
   admin.js — sign-in gate + add/update/delete
   for "questions" and "updates" Firestore collections.
   ============================================ */

/* Class levels used by the MCQ Hub. A question with no recognisable class
   is treated as Class 10 — the original question bank predates classes, so
   untagged questions are Class 10 by definition. This mirrors
   normalizeClass() in js/mcq.js; keep the two in step. */
const CLASS_LEVELS = ["8", "9", "10"];
const DEFAULT_CLASS = "10";


function normalizeSubject(q) {
  if (q && q.subject && String(q.subject).trim()) return String(q.subject).trim();
  const cat = String((q && q.category) || "").toLowerCase();
  if (cat.includes("science") && !cat.includes("computer")) return "Science";
  if (cat.includes("math") || cat.includes("algebra") || cat.includes("geometry") || cat.includes("arithmetic")) return "Mathematics";
  if (cat.includes("english") || cat.includes("grammar") || cat.includes("vocab")) return "English";
  if (cat.includes("gk") || cat.includes("general knowledge") || cat.includes("nepal") || cat.includes("history")) return "General Knowledge";
  return "Computer Science";
}

function normalizeClass(value) {
  const digits = String(value ?? "").match(/\d+/);
  const found = digits ? digits[0] : "";
  return CLASS_LEVELS.includes(found) ? found : DEFAULT_CLASS;
}

const signInGate = document.getElementById("signInGate");
const notAuthorized = document.getElementById("notAuthorized");
const dashboard = document.getElementById("dashboard");
const signOutBtns = document.querySelectorAll("#signOutBtn, #signOutBtnMobile");
const notAuthorizedEmail = document.getElementById("notAuthorizedEmail");
const switchAdminAccountBtn = document.getElementById("switchAdminAccountBtn");
const adminGoogleSignInBtn = document.getElementById("adminGoogleSignInBtn");
const adminForgotPassLink = document.getElementById("adminForgotPassLink");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminEmailInput = document.getElementById("adminEmail");
const adminPasswordInput = document.getElementById("adminPassword");
const adminLoginStatus = document.getElementById("adminLoginStatus");
const adminEmailSubmitBtn = document.getElementById("adminEmailSubmitBtn");

let adminInitialized = false;

function isUserAdmin(email) {
  if (!email) return false;
  const normalized = String(email).trim().toLowerCase();
  return ADMIN_EMAILS.some((e) => String(e).trim().toLowerCase() === normalized);
}

/* ---------- Auth gate ---------- */
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    adminInitialized = false;
    show(signInGate);
    hide(notAuthorized, dashboard);
    hideModeratorOuter();
    signOutBtns.forEach((b) => (b.hidden = true));
    return;
  }
  signOutBtns.forEach((b) => (b.hidden = false));
  if (isUserAdmin(user.email)) {
    show(dashboard);
    hide(signInGate, notAuthorized);
    hideModeratorOuter();
    if (!adminInitialized) {
      adminInitialized = true;
      initQuestionsAdmin();
      initPythonAdmin();
      initResourcesAdmin();
      initMessagesAdmin();
      initUpdatesAdmin();
      initLiveQuizAdmin();
      initPremiumQuizAdmin();
      initModeratorsAdmin();
    }
  } else {
    // Check if this user is a moderator
    try {
      const modSnap = await db.collection("moderators").doc(user.uid).get();
      if (modSnap.exists) {
        const modData = modSnap.data();
        const perms = modData.permissions || {};
        // Show the moderator outer panel (not the owner dashboard)
        hide(signInGate, notAuthorized, dashboard);
        showModeratorOuter(user, modData.displayName || user.displayName || user.email, perms);
        if (!adminInitialized) {
          adminInitialized = true;
          initModeratorDashboard(user, perms);
        }
      } else {
        show(notAuthorized);
        if (notAuthorizedEmail) {
          notAuthorizedEmail.textContent = user.email || "Unknown account";
        }
        hide(signInGate, dashboard);
        hideModeratorOuter();
      }
    } catch (err) {
      console.error("Moderator check error:", err);
      show(notAuthorized);
      if (notAuthorizedEmail) {
        notAuthorizedEmail.textContent = user.email || "Unknown account";
      }
      hide(signInGate, dashboard);
      hideModeratorOuter();
    }
  }
});

/* Google Sign-in for Admin */
if (adminGoogleSignInBtn) {
  adminGoogleSignInBtn.addEventListener("click", async () => {
    if (adminLoginStatus) {
      adminLoginStatus.textContent = "Connecting to Google…";
      adminLoginStatus.style.color = "var(--mist, #64748b)";
    }
    try {
      if (typeof window.signInWithGoogle === "function") {
        await window.signInWithGoogle();
      } else {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await auth.signInWithPopup(provider);
      }
    } catch (err) {
      console.error("Google sign-in error:", err);
      if (adminLoginStatus) {
        adminLoginStatus.textContent = err.message || "Failed to sign in with Google.";
        adminLoginStatus.style.color = "crimson";
      }
    }
  });
}

/* Forgot Password Link */
if (adminForgotPassLink) {
  adminForgotPassLink.addEventListener("click", async (e) => {
    e.preventDefault();
    const currentEmail = (adminEmailInput ? adminEmailInput.value.trim() : "") || "bholashroff345@gmail.com";
    const emailToReset = prompt("Enter the admin email address to send a password reset link:", currentEmail);
    if (!emailToReset || !emailToReset.trim()) return;

    try {
      if (adminLoginStatus) {
        adminLoginStatus.textContent = "Sending password reset email…";
        adminLoginStatus.style.color = "var(--mist, #64748b)";
      }
      await auth.sendPasswordResetEmail(emailToReset.trim());
      alert(`Password reset link sent to ${emailToReset.trim()}. Please check your inbox or spam folder.`);
      if (adminLoginStatus) {
        adminLoginStatus.textContent = "Password reset email sent! Check your inbox.";
        adminLoginStatus.style.color = "#10b981";
      }
    } catch (err) {
      console.error("Password reset error:", err);
      if (adminLoginStatus) {
        adminLoginStatus.textContent = "Could not send reset email: " + err.message;
        adminLoginStatus.style.color = "crimson";
      }
    }
  });
}

/* Email & Password login */
if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = adminEmailInput ? adminEmailInput.value.trim() : "";
    const password = adminPasswordInput ? adminPasswordInput.value : "";
    if (adminEmailSubmitBtn) {
      adminEmailSubmitBtn.disabled = true;
      adminEmailSubmitBtn.textContent = "Signing in…";
    }
    if (adminLoginStatus) {
      adminLoginStatus.textContent = "";
    }
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      console.error("Admin login error:", err);
      if (adminLoginStatus) {
        let msg = err.message;
        if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
          msg = "Invalid email or password. If you originally signed up with Google, click 'Sign in with Google' above.";
        }
        adminLoginStatus.textContent = msg;
        adminLoginStatus.style.color = "crimson";
      }
    } finally {
      if (adminEmailSubmitBtn) {
        adminEmailSubmitBtn.disabled = false;
        adminEmailSubmitBtn.textContent = "Sign in with Email";
      }
    }
  });
}

/* Switch Account button on Not Authorized screen */
if (switchAdminAccountBtn) {
  switchAdminAccountBtn.addEventListener("click", () => auth.signOut());
}

signOutBtns.forEach((b) => b.addEventListener("click", () => auth.signOut()));

function show(...els) { els.forEach((el) => (el.hidden = false)); }
function hide(...els) { els.forEach((el) => (el.hidden = true)); }

/* ---------- Tabs ---------- */
const ALL_TABS = ["questions", "python", "resources", "messages", "updates", "livequiz", "premiumquiz", "moderators"];

function switchToTab(tabName) {
  document.querySelectorAll(".admin-tab").forEach((b) => b.classList.remove("active"));
  const btn = document.querySelector(`.admin-tab[data-tab="${tabName}"]`);
  if (btn) btn.classList.add("active");

  ALL_TABS.forEach((t) => {
    const panel = document.getElementById("tab-" + t);
    if (panel) panel.hidden = t !== tabName;
  });

  // The Moderators content lives outside #dashboard in its own outer div.
  const modOuter = document.getElementById("tab-moderators-outer");
  if (modOuter) {
    modOuter.hidden = tabName !== "moderators";
  }
}


document.querySelectorAll(".admin-tab").forEach((tabBtn) => {
  tabBtn.addEventListener("click", () => {
    switchToTab(tabBtn.dataset.tab);
  });
});


/* ============================================
   QUESTIONS — add / edit / delete
   ============================================ */
let questionsUnsub = null;

/* ============================================
   IMPORT UTILITIES — shared CSV/JSON parsing +
   file download helpers, used by both the Questions
   and Python Programs bulk-import sections.
   ============================================ */

// Minimal RFC4180-ish CSV parser (handles quoted fields with commas/newlines).
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

function downloadTextFile(filename, content, mimeType) {
  const dataUri = "data:" + (mimeType || "text/plain") + ";charset=utf-8," + encodeURIComponent(content);
  const a = document.createElement("a");
  a.href = dataUri;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Reads either the chosen file (if any) or the pasted textarea content.
function readImportInput(fileInput, textarea) {
  return new Promise((resolve, reject) => {
    if (fileInput.files && fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = () => resolve({ text: reader.result, name: fileInput.files[0].name });
      reader.onerror = () => reject(new Error("Could not read the selected file."));
      reader.readAsText(fileInput.files[0]);
    } else if (textarea.value.trim()) {
      resolve({ text: textarea.value, name: "" });
    } else {
      reject(new Error("Choose a file or paste content first."));
    }
  });
}

function looksLikeJson(text) {
  const t = text.trim();
  return t.startsWith("[") || t.startsWith("{");
}

// Parses question rows from either JSON or CSV text into the payload
// shape used by the "questions" collection.
function parseQuestionsInput(text) {
  if (looksLikeJson(text)) {
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : [data];
    return arr.map((q, i) => {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`Row ${i + 1}: needs "question" and exactly 4 "options".`);
      }
      return {
        question: String(q.question).trim(),
        options: q.options.map((o) => String(o).trim()),
        correctIndex: Number(q.correctIndex) || 0,
        explanation: q.explanation ? String(q.explanation).trim() : "",
        subject: q.subject ? String(q.subject).trim() : normalizeSubject(q),
        category: q.category ? String(q.category).trim() : "General",
        classLevel: normalizeClass(q.classLevel ?? q.class),
      };
    });
  }

  // CSV path
  const rows = parseCSV(text);
  if (!rows.length) throw new Error("No rows found in CSV.");
  let startIdx = 0;
  if (/question/i.test(rows[0][0] || "")) startIdx = 1; // skip header row
  const results = [];
  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] || !r[0].trim()) continue;
    // `class` is the last column and optional, so CSVs exported before
    // classes existed still import cleanly (they all become Class 10).
    let question, a, b, c, d, correct, explanation, subject, category, classLevel;
    if (r.length >= 10) {
      [question, a, b, c, d, correct, explanation, subject, category, classLevel] = r;
    } else {
      [question, a, b, c, d, correct, explanation, category, classLevel] = r;
      subject = "Computer Science";
    }
    if (!a || !b || !c || !d) {
      throw new Error(`Row ${i + 1}: needs question + 4 options (columns 2-5).`);
    }
    let correctIndex = 0;
    const cRaw = (correct || "").trim().toUpperCase();
    if (["A", "B", "C", "D"].includes(cRaw)) correctIndex = "ABCD".indexOf(cRaw);
    else if (["1", "2", "3", "4"].includes(cRaw)) correctIndex = Number(cRaw) - 1;
    else if (["0", "1", "2", "3"].includes(cRaw)) correctIndex = Number(cRaw);

    results.push({
      question: question.trim(),
      options: [a.trim(), b.trim(), c.trim(), d.trim()],
      correctIndex,
      explanation: (explanation || "").trim(),
      subject: (subject || "Computer Science").trim(),
      category: (category || "General").trim(),
      classLevel: normalizeClass(classLevel),
    });
  }
  if (!results.length) throw new Error("No valid question rows found.");
  return results;
}

// Parses program entries from JSON text into the "pythonPrograms" shape.
function parseProgramsInput(text) {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : [data];
  return arr.map((p, i) => {
    if (!p.title || !p.code) {
      throw new Error(`Entry ${i + 1}: needs at least "title" and "code".`);
    }
    return {
      title: String(p.title).trim(),
      category: p.category ? String(p.category).trim() : "",
      description: p.description ? String(p.description).trim() : "",
      code: String(p.code),
    };
  });
}

function initQuestionsAdmin() {
  if (questionsUnsub) return; // already listening
  const form = document.getElementById("questionForm");
  const listEl = document.getElementById("questionsAdminList");
  const submitBtn = document.getElementById("questionSubmitBtn");
  const cancelBtn = document.getElementById("cancelQuestionEdit");
  const idField = document.getElementById("questionId");
  const classFilter = document.getElementById("questionClassFilter");
  const subjectFilter = document.getElementById("questionSubjectFilter");
  const countLabel = document.getElementById("questionCountLabel");
  const qSubjectSelect = document.getElementById("qSubject");
  const qCustomSubjectWrap = document.getElementById("qCustomSubjectWrap");
  const qCustomSubjectInput = document.getElementById("qCustomSubject");

  let allQuestions = []; // latest snapshot, newest first, class already normalised

  classFilter.addEventListener("change", renderQuestionList);
  if (subjectFilter) subjectFilter.addEventListener("change", renderQuestionList);
  if (qSubjectSelect) {
    qSubjectSelect.addEventListener("change", () => {
      if (qCustomSubjectWrap) {
        qCustomSubjectWrap.style.display = qSubjectSelect.value === "Other" ? "block" : "none";
      }
    });
  }

  questionsUnsub = db.collection("questions").orderBy("order", "desc").onSnapshot(
    (snapshot) => {
      allQuestions = snapshot.docs.map((doc) => {
        const data = doc.data();
        return { id: doc.id, ...data, subject: normalizeSubject(data), classLevel: normalizeClass(data.classLevel ?? data.class) };
      });
      renderQuestionList();
    },
    (err) => {
      listEl.innerHTML = `<p class="updates-loading">Could not load questions (${err.message}).</p>`;
    }
  );

  function renderQuestionList() {
    const filterClass = classFilter.value;
    const filterSubject = subjectFilter ? subjectFilter.value : "All";
    const visible = allQuestions.filter((q) => {
      const matchClass = filterClass === "All" || q.classLevel === filterClass;
      const matchSubject = filterSubject === "All" || (q.subject || normalizeSubject(q)) === filterSubject;
      return matchClass && matchSubject;
    });

    const perClass = CLASS_LEVELS.map(
      (lvl) => `Class ${lvl}: ${allQuestions.filter((q) => q.classLevel === lvl).length}`
    ).join(" · ");
    countLabel.textContent = allQuestions.length
      ? `${allQuestions.length} total — ${perClass}`
      : "";

    if (!visible.length) {
      listEl.innerHTML = `<p class="updates-loading">${
        allQuestions.length
          ? "No questions match the selected filters — add one above."
          : "No questions yet — add one above."
      }</p>`;
      return;
    }

    listEl.innerHTML = "";
    visible.forEach((q) => {
      const subj = q.subject || normalizeSubject(q);
      const row = document.createElement("div");
      row.className = "admin-row";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(q.question || "")}</strong>
          <span class="admin-tag">Class ${escapeHtml(q.classLevel)}</span>
          <span class="admin-tag" style="background:#e0f2fe; color:#0369a1; font-weight:600;">${escapeHtml(subj)}</span>
          ${q.category ? `<span class="admin-tag">${escapeHtml(q.category)}</span>` : ""}
        </div>
        <div class="admin-row-actions">
          <button class="btn btn-outline btn-sm" data-action="edit">Edit</button>
          <button class="btn btn-outline btn-sm btn-danger" data-action="delete">Delete</button>
        </div>
      `;
      row.querySelector('[data-action="edit"]').addEventListener("click", () => startEdit(q));
      row.querySelector('[data-action="delete"]').addEventListener("click", () => {
        if (confirm("Delete this question?")) db.collection("questions").doc(q.id).delete();
      });
      listEl.appendChild(row);
    });
  }

  function startEdit(q) {
    idField.value = q.id;
    document.getElementById("qText").value = q.question || "";
    document.getElementById("opt0").value = (q.options || [])[0] || "";
    document.getElementById("opt1").value = (q.options || [])[1] || "";
    document.getElementById("opt2").value = (q.options || [])[2] || "";
    document.getElementById("opt3").value = (q.options || [])[3] || "";
    document.getElementById("correctIndex").value = q.correctIndex ?? 0;
    document.getElementById("qExplanation").value = q.explanation || "";
    document.getElementById("qCategory").value = q.category || "";
    document.getElementById("qClass").value = q.classLevel;
    const subj = q.subject || normalizeSubject(q);
    if (qSubjectSelect) {
      const std = ["Computer Science", "Science", "Mathematics", "English", "General Knowledge"];
      if (std.includes(subj)) {
        qSubjectSelect.value = subj;
        if (qCustomSubjectWrap) qCustomSubjectWrap.style.display = "none";
      } else {
        qSubjectSelect.value = "Other";
        if (qCustomSubjectWrap) qCustomSubjectWrap.style.display = "block";
        if (qCustomSubjectInput) qCustomSubjectInput.value = subj;
      }
    }
    submitBtn.textContent = "Save changes";
    cancelBtn.hidden = false;
    form.scrollIntoView({ behavior: "smooth" });
  }

  cancelBtn.addEventListener("click", () => resetQuestionForm());

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let chosenSubject = "Computer Science";
    if (qSubjectSelect) {
      if (qSubjectSelect.value === "Other" && qCustomSubjectInput && qCustomSubjectInput.value.trim()) {
        chosenSubject = qCustomSubjectInput.value.trim();
      } else {
        chosenSubject = qSubjectSelect.value;
      }
    }

    const payload = {
      question: document.getElementById("qText").value.trim(),
      options: [
        document.getElementById("opt0").value.trim(),
        document.getElementById("opt1").value.trim(),
        document.getElementById("opt2").value.trim(),
        document.getElementById("opt3").value.trim(),
      ],
      correctIndex: Number(document.getElementById("correctIndex").value),
      explanation: document.getElementById("qExplanation").value.trim(),
      subject: chosenSubject,
      category: document.getElementById("qCategory").value.trim() || "General",
      classLevel: normalizeClass(document.getElementById("qClass").value),
    };

    const editingId = idField.value;
    const savePromise = editingId
      ? db.collection("questions").doc(editingId).update(payload)
      : db.collection("questions").add({ ...payload, order: Date.now() });

    savePromise.then(() => resetQuestionForm()).catch((err) => alert(err.message));
  });

  function resetQuestionForm() {
    form.reset();
    idField.value = "";
    document.getElementById("qClass").value = DEFAULT_CLASS;
    if (qSubjectSelect) qSubjectSelect.value = "Computer Science";
    if (qCustomSubjectWrap) qCustomSubjectWrap.style.display = "none";
    if (qCustomSubjectInput) qCustomSubjectInput.value = "";
    submitBtn.textContent = "Add question";
    cancelBtn.hidden = true;
  }

  /* ---- Bulk import ---- */
  const importFile = document.getElementById("questionImportFile");
  const importText = document.getElementById("questionImportText");
  const importBtn = document.getElementById("questionImportBtn");
  const importStatus = document.getElementById("questionImportStatus");

  importBtn.addEventListener("click", () => {
    importStatus.style.color = "";
    importStatus.textContent = "Reading…";
    readImportInput(importFile, importText)
      .then(({ text }) => {
        const parsed = parseQuestionsInput(text);
        importStatus.textContent = `Importing ${parsed.length} question(s)…`;
        const baseOrder = Date.now();
        const batch = db.batch();
        parsed.forEach((q, i) => {
          const ref = db.collection("questions").doc();
          batch.set(ref, { ...q, order: baseOrder + i });
        });
        return batch.commit().then(() => parsed.length);
      })
      .then((count) => {
        importStatus.style.color = "green";
        importStatus.textContent = `Imported ${count} question(s) successfully.`;
        importFile.value = "";
        importText.value = "";
      })
      .catch((err) => {
        importStatus.style.color = "crimson";
        importStatus.textContent = err.message;
      });
  });

  document.getElementById("downloadQuestionCsvTemplate").addEventListener("click", (e) => {
    e.preventDefault();
    const csv =
      "question,option_a,option_b,option_c,option_d,correct,explanation,subject,category,class\n" +
      '"What does len() return for a list?","Its length","Its type","Its memory address","Nothing",A,"len() returns the number of items in a list.","Computer Science","Python Basics",10\n' +
      '"What is the chemical formula of water?","CO2","H2O","NaCl","O2",B,"Water is composed of two hydrogen atoms and one oxygen atom.","Science","Chemistry",9\n' +
      '"What is the sum of angles in a triangle?","90°","180°","270°","360°",B,"The interior angles of a triangle always add up to 180°.","Mathematics","Geometry",8\n';
    downloadTextFile("questions-template.csv", csv, "text/csv");
  });

  document.getElementById("downloadQuestionJsonTemplate").addEventListener("click", (e) => {
    e.preventDefault();
    const json = JSON.stringify(
      [
        {
          question: "What does len() return for a list?",
          options: ["Its length", "Its type", "Its memory address", "Nothing"],
          correctIndex: 0,
          explanation: "len() returns the number of items in a list.",
          category: "Python Basics",
          classLevel: "10",
        },
        {
          question: "Which symbol starts a comment in Python?",
          options: ["//", "#", "/*", "--"],
          correctIndex: 1,
          explanation: "Python comments begin with #.",
          category: "Python Basics",
          classLevel: "8",
        },
      ],
      null,
      2
    );
    downloadTextFile("questions-template.json", json, "application/json");
  });
}

/* ============================================
   PYTHON PROGRAMS — add / edit / delete
   ============================================ */
let pythonUnsub = null;

function initPythonAdmin() {
  if (pythonUnsub) return;
  const form = document.getElementById("pythonForm");
  const listEl = document.getElementById("pythonAdminList");
  const submitBtn = document.getElementById("pythonSubmitBtn");
  const cancelBtn = document.getElementById("cancelPythonEdit");
  const idField = document.getElementById("pyId");

  pythonUnsub = db.collection("pythonPrograms").orderBy("order", "desc").onSnapshot(
    (snapshot) => {
      if (snapshot.empty) {
        listEl.innerHTML = `<p class="updates-loading">No programs yet — add one above.</p>`;
        return;
      }
      listEl.innerHTML = "";
      snapshot.forEach((doc) => {
        const p = doc.data();
        const row = document.createElement("div");
        row.className = "admin-row";
        row.innerHTML = `
          <div>
            <strong>${escapeHtml(p.title || "")}</strong>
            ${p.category ? `<span class="admin-tag">${escapeHtml(p.category)}</span>` : ""}
          </div>
          <div class="admin-row-actions">
            <button class="btn btn-outline btn-sm" data-action="edit">Edit</button>
            <button class="btn btn-outline btn-sm btn-danger" data-action="delete">Delete</button>
          </div>
        `;
        row.querySelector('[data-action="edit"]').addEventListener("click", () => {
          idField.value = doc.id;
          document.getElementById("pyTitle").value = p.title || "";
          document.getElementById("pyCategory").value = p.category || "";
          document.getElementById("pyOrder").value = p.order ?? 1;
          document.getElementById("pyDescription").value = p.description || "";
          document.getElementById("pyCode").value = p.code || "";
          submitBtn.textContent = "Save changes";
          cancelBtn.hidden = false;
          form.scrollIntoView({ behavior: "smooth" });
        });
        row.querySelector('[data-action="delete"]').addEventListener("click", () => {
          if (confirm("Delete this program?")) db.collection("pythonPrograms").doc(doc.id).delete();
        });
        listEl.appendChild(row);
      });
    },
    (err) => {
      listEl.innerHTML = `<p class="updates-loading">Could not load programs (${err.message}).</p>`;
    }
  );

  cancelBtn.addEventListener("click", () => resetPythonForm());

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById("pyTitle").value.trim(),
      category: document.getElementById("pyCategory").value.trim(),
      description: document.getElementById("pyDescription").value.trim(),
      code: document.getElementById("pyCode").value,
      order: Number(document.getElementById("pyOrder").value),
    };
    const editingId = idField.value;
    const savePromise = editingId
      ? db.collection("pythonPrograms").doc(editingId).update(payload)
      : db.collection("pythonPrograms").add(payload);

    savePromise.then(() => resetPythonForm()).catch((err) => alert(err.message));
  });

  function resetPythonForm() {
    form.reset();
    idField.value = "";
    document.getElementById("pyOrder").value = 1;
    submitBtn.textContent = "Add program";
    cancelBtn.hidden = true;
  }

  /* ---- Bulk import ---- */
  const importFile = document.getElementById("pythonImportFile");
  const importText = document.getElementById("pythonImportText");
  const importBtn = document.getElementById("pythonImportBtn");
  const importStatus = document.getElementById("pythonImportStatus");

  importBtn.addEventListener("click", () => {
    importStatus.style.color = "";
    importStatus.textContent = "Reading…";
    readImportInput(importFile, importText)
      .then(({ text }) => {
        const parsed = parseProgramsInput(text);
        importStatus.textContent = `Importing ${parsed.length} program(s)…`;
        const baseOrder = Date.now();
        const batch = db.batch();
        parsed.forEach((p, i) => {
          const ref = db.collection("pythonPrograms").doc();
          batch.set(ref, { ...p, order: baseOrder + i });
        });
        return batch.commit().then(() => parsed.length);
      })
      .then((count) => {
        importStatus.style.color = "green";
        importStatus.textContent = `Imported ${count} program(s) successfully.`;
        importFile.value = "";
        importText.value = "";
      })
      .catch((err) => {
        importStatus.style.color = "crimson";
        importStatus.textContent = err.message;
      });
  });

  document.getElementById("downloadPythonJsonTemplate").addEventListener("click", (e) => {
    e.preventDefault();
    const json = JSON.stringify(
      [
        {
          title: "Sum of a list",
          category: "Loops",
          description: "Adds up all numbers in a list using a for loop.",
          code: "numbers = [1, 2, 3, 4, 5]\ntotal = 0\nfor n in numbers:\n    total += n\nprint(total)",
        },
      ],
      null,
      2
    );
    downloadTextFile("python-programs-template.json", json, "application/json");
  });
}

/* ============================================
   UPDATES — add / edit / delete
   ============================================ */
let updatesUnsub = null;

/* ============================================
   RESOURCES — add / edit / delete
   (title, file type, description, Google Drive link)
   ============================================ */
let resourcesUnsub = null;

function initResourcesAdmin() {
  if (resourcesUnsub) return;
  const form = document.getElementById("resourceForm");
  const listEl = document.getElementById("resourcesAdminList");
  const submitBtn = document.getElementById("resourceSubmitBtn");
  const cancelBtn = document.getElementById("cancelResourceEdit");
  const idField = document.getElementById("resId");

  resourcesUnsub = db.collection("resources").orderBy("order", "desc").onSnapshot(
    (snapshot) => {
      if (snapshot.empty) {
        listEl.innerHTML = `<p class="updates-loading">No resources yet — add one above.</p>`;
        return;
      }
      listEl.innerHTML = "";
      snapshot.forEach((doc) => {
        const r = doc.data();
        const row = document.createElement("div");
        row.className = "admin-row";
        row.innerHTML = `
          <div>
            <strong>${escapeHtml(r.title || "")}</strong>
            <span class="admin-tag">${escapeHtml(r.fileType || "")}${r.category ? " · " + escapeHtml(r.category) : ""}</span>
          </div>
          <div class="admin-row-actions">
            <button class="btn btn-outline btn-sm" data-action="edit">Edit</button>
            <button class="btn btn-outline btn-sm btn-danger" data-action="delete">Delete</button>
          </div>
        `;
        row.querySelector('[data-action="edit"]').addEventListener("click", () => {
          idField.value = doc.id;
          document.getElementById("resTitle").value = r.title || "";
          document.getElementById("resFileType").value = r.fileType || "PPT";
          document.getElementById("resCategory").value = r.category || "";
          document.getElementById("resDescription").value = r.description || "";
          document.getElementById("resDriveUrl").value = r.driveUrl || "";
          document.getElementById("resOrder").value = r.order ?? 1;
          submitBtn.textContent = "Save changes";
          cancelBtn.hidden = false;
          form.scrollIntoView({ behavior: "smooth" });
        });
        row.querySelector('[data-action="delete"]').addEventListener("click", () => {
          if (confirm("Delete this resource?")) db.collection("resources").doc(doc.id).delete();
        });
        listEl.appendChild(row);
      });
    },
    (err) => {
      listEl.innerHTML = `<p class="updates-loading">Could not load resources (${err.message}).</p>`;
    }
  );

  cancelBtn.addEventListener("click", () => resetResourceForm());

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById("resTitle").value.trim(),
      fileType: document.getElementById("resFileType").value,
      category: document.getElementById("resCategory").value.trim(),
      description: document.getElementById("resDescription").value.trim(),
      driveUrl: document.getElementById("resDriveUrl").value.trim(),
      order: Number(document.getElementById("resOrder").value),
    };
    const editingId = idField.value;
    const savePromise = editingId
      ? db.collection("resources").doc(editingId).update(payload)
      : db.collection("resources").add(payload);

    savePromise.then(() => resetResourceForm()).catch((err) => alert(err.message));
  });

  function resetResourceForm() {
    form.reset();
    idField.value = "";
    document.getElementById("resOrder").value = 1;
    submitBtn.textContent = "Add resource";
    cancelBtn.hidden = true;
  }
}

/* ============================================
   MESSAGES — read-only inbox + delete
   (contact form submissions; no admin write/edit,
   visitors create these, admin can only view/delete)
   ============================================ */
let messagesUnsub = null;

function initMessagesAdmin() {
  if (messagesUnsub) return;
  const listEl = document.getElementById("messagesAdminList");

  messagesUnsub = db.collection("messages").orderBy("createdAt", "desc").onSnapshot(
    (snapshot) => {
      if (snapshot.empty) {
        listEl.innerHTML = `<p class="updates-loading">No messages yet.</p>`;
        return;
      }
      listEl.innerHTML = "";
      snapshot.forEach((doc) => {
        const m = doc.data();
        const when = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate().toLocaleString() : "";
        const row = document.createElement("div");
        row.className = "admin-row";
        row.style.alignItems = "flex-start";
        row.innerHTML = `
          <div>
            <strong>${escapeHtml(m.subject || "(no subject)")}</strong>
            <span class="admin-tag">${escapeHtml(when)}</span>
            <p style="margin:6px 0 4px;font-size:0.9rem;color:var(--ink)">${escapeHtml(m.message || "")}</p>
            <p style="margin:0;font-size:0.82rem;color:var(--mist)">
              From: ${escapeHtml(m.name || "")} — <a href="mailto:${escapeHtml(m.email || "")}">${escapeHtml(m.email || "")}</a>
            </p>
          </div>
          <div class="admin-row-actions">
            <button class="btn btn-outline btn-sm btn-danger" data-action="delete">Delete</button>
          </div>
        `;
        row.querySelector('[data-action="delete"]').addEventListener("click", () => {
          if (confirm("Delete this message?")) db.collection("messages").doc(doc.id).delete();
        });
        listEl.appendChild(row);
      });
    },
    (err) => {
      listEl.innerHTML = `<p class="updates-loading">Could not load messages (${err.message}).</p>`;
    }
  );
}

function initUpdatesAdmin() {
  if (updatesUnsub) return;
  const form = document.getElementById("updateForm");
  const listEl = document.getElementById("updatesAdminList");
  const submitBtn = document.getElementById("updateSubmitBtn");
  const cancelBtn = document.getElementById("cancelUpdateEdit");
  const idField = document.getElementById("updateId");

  updatesUnsub = db.collection("updates").orderBy("order", "desc").onSnapshot(
    (snapshot) => {
      if (snapshot.empty) {
        listEl.innerHTML = `<p class="updates-loading">No updates yet — add one above.</p>`;
        return;
      }
      listEl.innerHTML = "";
      snapshot.forEach((doc) => {
        const u = doc.data();
        const row = document.createElement("div");
        row.className = "admin-row";
        row.innerHTML = `
          <div><strong>${escapeHtml(u.title || "")}</strong> <span class="admin-tag">${escapeHtml(u.date || "")}</span></div>
          <div class="admin-row-actions">
            <button class="btn btn-outline btn-sm" data-action="edit">Edit</button>
            <button class="btn btn-outline btn-sm btn-danger" data-action="delete">Delete</button>
          </div>
        `;
        row.querySelector('[data-action="edit"]').addEventListener("click", () => {
          idField.value = doc.id;
          document.getElementById("uTitle").value = u.title || "";
          document.getElementById("uDate").value = u.date || "";
          document.getElementById("uOrder").value = u.order ?? 1;
          submitBtn.textContent = "Save changes";
          cancelBtn.hidden = false;
          form.scrollIntoView({ behavior: "smooth" });
        });
        row.querySelector('[data-action="delete"]').addEventListener("click", () => {
          if (confirm("Delete this update?")) db.collection("updates").doc(doc.id).delete();
        });
        listEl.appendChild(row);
      });
    },
    (err) => {
      listEl.innerHTML = `<p class="updates-loading">Could not load updates (${err.message}).</p>`;
    }
  );

  cancelBtn.addEventListener("click", () => resetUpdateForm());

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById("uTitle").value.trim(),
      date: document.getElementById("uDate").value.trim(),
      order: Number(document.getElementById("uOrder").value),
    };
    const editingId = idField.value;
    const savePromise = editingId
      ? db.collection("updates").doc(editingId).update(payload)
      : db.collection("updates").add(payload);

    savePromise.then(() => resetUpdateForm()).catch((err) => alert(err.message));
  });

  function resetUpdateForm() {
    form.reset();
    idField.value = "";
    document.getElementById("uOrder").value = 1;
    submitBtn.textContent = "Add update";
    cancelBtn.hidden = true;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ============================================
   LIVE QUIZ SCHEDULE ADMIN
   ============================================ */
function initLiveQuizAdmin() {
  const daySelect = document.getElementById("adminLiveDaySelect");
  const weekInput = document.getElementById("adminLiveWeekInput");
  const customJson = document.getElementById("adminLiveCustomJson");
  const saveBtn = document.getElementById("saveLiveDayQuestionsBtn");
  const clearBtn = document.getElementById("clearLiveDayQuestionsBtn");
  const statusEl = document.getElementById("adminLiveStatus");

  if (!daySelect || !weekInput || !saveBtn) return;

  function getISOWeekKey() {
    const d = new Date();
    const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNr = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNr);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
    const pad = (n) => String(n).padStart(2, "0");
    return `${target.getUTCFullYear()}-W${pad(weekNo)}`;
  }

  const d = new Date();
  const currentDayNr = d.getUTCDay() || 7;
  daySelect.value = String(currentDayNr);
  weekInput.value = getISOWeekKey();

  async function loadSelectedDayQuestions() {
    statusEl.textContent = "Checking schedule…";
    statusEl.style.color = "var(--mist)";
    const week = weekInput.value.trim();
    const day = daySelect.value;
    const docId = `${week}_day_${day}`;

    try {
      const snap = await db.collection("liveQuizQuestions").doc(docId).get();
      if (snap.exists && Array.isArray(snap.data().questions) && snap.data().questions.length > 0) {
        customJson.value = JSON.stringify(snap.data().questions, null, 2);
        statusEl.textContent = `Custom questions active for ${week} Day ${day} (${snap.data().questions.length} questions).`;
        statusEl.style.color = "var(--orange)";
      } else {
        customJson.value = "";
        statusEl.textContent = `Automated smart selection is active for ${week} Day ${day}.`;
        statusEl.style.color = "var(--mist)";
      }
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.style.color = "crimson";
    }
  }

  daySelect.addEventListener("change", loadSelectedDayQuestions);
  weekInput.addEventListener("change", loadSelectedDayQuestions);
  loadSelectedDayQuestions();

  saveBtn.addEventListener("click", async () => {
    const week = weekInput.value.trim();
    const day = daySelect.value;
    const docId = `${week}_day_${day}`;
    const raw = customJson.value.trim();

    if (!raw) {
      statusEl.textContent = "Please enter JSON array of questions, or click Reset.";
      statusEl.style.color = "crimson";
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Questions must be a non-empty JSON array.");
      }

      statusEl.textContent = "Saving questions…";
      await db.collection("liveQuizQuestions").doc(docId).set({
        weekKey: week,
        dayIndex: Number(day),
        questions: parsed,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      statusEl.textContent = `Saved ${parsed.length} custom questions for ${week} Day ${day}!`;
      statusEl.style.color = "#10b981";
    } catch (err) {
      statusEl.textContent = `JSON Error: ${err.message}`;
      statusEl.style.color = "crimson";
    }
  });

  clearBtn.addEventListener("click", async () => {
    const week = weekInput.value.trim();
    const day = daySelect.value;
    const docId = `${week}_day_${day}`;

    if (!confirm(`Reset ${week} Day ${day} back to automated daily question selection?`)) return;

    try {
      statusEl.textContent = "Resetting…";
      await db.collection("liveQuizQuestions").doc(docId).delete();
      customJson.value = "";
      statusEl.textContent = `Reset successful! ${week} Day ${day} will now use automated smart question selection.`;
      statusEl.style.color = "#10b981";
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.style.color = "crimson";
    }
  });
}

/* ============================================
   PREMIUM QUIZ ADMIN
   Manages: siteSettings/config (minScore),
            premiumQuizContent/{slug} (category meta + questions array)
   ============================================ */
function initPremiumQuizAdmin() {
  const minScoreInput   = document.getElementById("premiumMinScore");
  const saveMinScoreBtn = document.getElementById("savePremiumMinScoreBtn");
  const settingsStatus  = document.getElementById("premiumSettingsStatus");

  // Load current premium min score setting
  if (minScoreInput) {
    db.collection("siteSettings").doc("liveQuiz").get().then((doc) => {
      if (doc.exists && doc.data().premiumMinScore != null) {
        minScoreInput.value = doc.data().premiumMinScore;
      }
    }).catch((err) => console.warn("Could not load premiumMinScore:", err));
  }

  if (saveMinScoreBtn && minScoreInput) {
    saveMinScoreBtn.addEventListener("click", async () => {
      const val = parseInt(minScoreInput.value, 10);
      if (isNaN(val) || val < 1) {
        if (settingsStatus) {
          settingsStatus.textContent = "Please enter a valid positive number.";
          settingsStatus.style.color = "crimson";
        }
        return;
      }
      saveMinScoreBtn.disabled = true;
      if (settingsStatus) {
        settingsStatus.textContent = "Saving threshold…";
        settingsStatus.style.color = "var(--mist)";
      }
      try {
        await db.collection("siteSettings").doc("liveQuiz").set({
          premiumMinScore: val,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        if (settingsStatus) {
          settingsStatus.textContent = "Minimum score threshold saved successfully!";
          settingsStatus.style.color = "#10b981";
        }
      } catch (err) {
        if (settingsStatus) {
          settingsStatus.textContent = "Error saving threshold: " + err.message;
          settingsStatus.style.color = "crimson";
        }
      } finally {
        saveMinScoreBtn.disabled = false;
      }
    });
  }

  // Payment Verification Requests DOM
  const reqListEl         = document.getElementById("premiumRequestsList");
  const reqFilterBtns     = document.querySelectorAll(".req-filter-btn");
  const manualGrantEmail  = document.getElementById("manualGrantEmail");
  const manualGrantBtn    = document.getElementById("manualGrantBtn");
  const manualRevokeBtn   = document.getElementById("manualRevokeBtn");
  const manualGrantStatus = document.getElementById("manualGrantStatus");

  // Receipt Modal DOM
  const receiptModal      = document.getElementById("receiptPreviewModal");
  const modalReceiptImg   = document.getElementById("modalReceiptImg");
  const closeReceiptBtn   = document.getElementById("closeReceiptModalBtn");

  if (closeReceiptBtn && receiptModal) {
    closeReceiptBtn.addEventListener("click", () => {
      receiptModal.style.display = "none";
      receiptModal.hidden = true;
    });
    receiptModal.addEventListener("click", e => {
      if (e.target === receiptModal) {
        receiptModal.style.display = "none";
        receiptModal.hidden = true;
      }
    });
  }

  function openReceiptModal(imgSrc) {
    if (!receiptModal || !modalReceiptImg) return;
    modalReceiptImg.src = imgSrc;
    receiptModal.hidden = false;
    receiptModal.style.display = "flex";
  }

  // ---- Payment Verification Requests Live Subscription ----
  let allRequests = [];
  let currentRequestFilter = "all";

  if (reqFilterBtns.length > 0) {
    reqFilterBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        reqFilterBtns.forEach(b => {
          b.classList.remove("btn-primary");
          b.classList.add("btn-outline");
        });
        btn.classList.remove("btn-outline");
        btn.classList.add("btn-primary");
        currentRequestFilter = btn.dataset.status || "all";
        renderPaymentRequests();
      });
    });
  }

  function subscribePaymentRequests() {
    if (!reqListEl) return;
    db.collection("premiumRequests")
      .orderBy("createdAt", "desc")
      .onSnapshot(snap => {
        allRequests = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
        renderPaymentRequests();
      }, err => {
        console.error("Error loading payment requests:", err);
        reqListEl.innerHTML = `<p class="updates-loading">Error loading requests: ${err.message}</p>`;
      });
  }

  function renderPaymentRequests() {
    if (!reqListEl) return;
    const filtered = allRequests.filter(r => {
      if (currentRequestFilter === "all") return true;
      return r.status === currentRequestFilter;
    });

    if (filtered.length === 0) {
      reqListEl.innerHTML = `<p class="updates-loading">No ${currentRequestFilter === "all" ? "" : currentRequestFilter} requests found.</p>`;
      return;
    }

    reqListEl.innerHTML = "";
    filtered.forEach(req => {
      const card = document.createElement("div");
      card.className = "admin-row";
      card.style.cssText = "display:flex; justify-content:space-between; align-items:flex-start; gap:14px; padding:14px; border:1px solid var(--border, var(--line)); border-radius:10px; margin-bottom:10px;";

      const statusColor = req.status === "approved" ? "#10b981" : (req.status === "rejected" ? "#ef4444" : "#f59e0b");
      const statusBorder = req.status === "approved" ? "#10b981" : (req.status === "rejected" ? "#ef4444" : "#f59e0b");
      const formattedDate = req.createdAt && req.createdAt.toDate ? req.createdAt.toDate().toLocaleString() : "Recently";

      card.innerHTML = `
        <div style="flex:1;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
            <strong>${escapeHtml(req.userName || "User")}</strong>
            <span class="admin-tag">${escapeHtml(req.userEmail || "")}</span>
            <span class="admin-tag" style="border:1.5px solid ${statusBorder}; color:${statusColor}; font-weight:700; text-transform:uppercase; background:transparent;">${escapeHtml(req.status || "pending")}</span>
          </div>

          <div style="font-size:0.86rem; color:var(--text, var(--ink)); line-height:1.6;">
            <div><strong>Method:</strong> ${escapeHtml(req.paymentMethod || "eSewa")} · <strong>Amount:</strong> NPR ${escapeHtml(String(req.amountNpr || 200))} · <strong>Ref Code:</strong> <code style="background:var(--cream, #f1f5f9); border:1px solid var(--line); padding:2px 6px; border-radius:4px; font-weight:700; color:var(--ink);">${escapeHtml(req.referenceCode || "-")}</code></div>
            <div><strong>Phone:</strong> ${escapeHtml(req.userPhone || "Not provided")} · <strong>Submitted:</strong> ${formattedDate}</div>
            ${req.remarks ? `<div><strong>Remarks:</strong> <em>${escapeHtml(req.remarks)}</em></div>` : ""}
          </div>
        </div>

        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px; flex-shrink:0;">
          ${req.screenshotUrl ? `
            <button type="button" class="btn btn-outline btn-sm view-receipt-btn" style="font-size:0.78rem; padding:4px 8px;">
              View Screenshot
            </button>
          ` : `<span style="font-size:0.75rem; color:#94a3b8;">No Image</span>`}

          <div style="display:flex; gap:6px;">
            ${req.status !== "approved" ? `
              <button type="button" class="btn btn-primary btn-sm approve-req-btn" style="padding:4px 10px; font-size:0.8rem; background:#10b981; border-color:#10b981;">
                Approve
              </button>
            ` : ""}
            ${req.status !== "rejected" ? `
              <button type="button" class="btn btn-outline btn-sm btn-danger reject-req-btn" style="padding:4px 10px; font-size:0.8rem;">
                Reject
              </button>
            ` : ""}
          </div>
        </div>
      `;

      if (req.screenshotUrl) {
        card.querySelector(".view-receipt-btn").addEventListener("click", () => {
          openReceiptModal(req.screenshotUrl);
        });
      }

      const approveBtn = card.querySelector(".approve-req-btn");
      if (approveBtn) {
        approveBtn.addEventListener("click", async () => {
          if (!confirm(`Approve payment for ${req.userEmail}? This will grant them instant premium access.`)) return;
          approveBtn.disabled = true;
          approveBtn.textContent = "Approving…";
          try {
            // 1. Update request status
            await db.collection("premiumRequests").doc(req.id).update({
              status: "approved",
              approvedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 2. Grant credits or unlimited access based on payment package
            if (req.userId) {
              const amt = Number(req.amountNpr || 0);
              let creditsToAdd = 0;
              let isUnlimitedYear = false;

              if (amt >= 500) {
                isUnlimitedYear = true;
                creditsToAdd = 100;
              } else if (amt >= 100) {
                creditsToAdd = 30;
              } else if (amt >= 50) {
                creditsToAdd = 12;
              } else if (amt >= 15) {
                creditsToAdd = 3;
              } else {
                creditsToAdd = Math.max(3, Math.round(amt / 5) * 3);
              }

              const userUpdates = {
                credits: firebase.firestore.FieldValue.increment(creditsToAdd),
                premiumApprovedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              };

              if (isUnlimitedYear) {
                const oneYearLater = new Date();
                oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
                userUpdates.hasPremiumAccess = true;
                userUpdates.unlimitedUntil = firebase.firestore.Timestamp.fromDate(oneYearLater);
              }

              await db.collection("users").doc(req.userId).set(userUpdates, { merge: true });
            }
            alert(`Payment approved! Granted to ${req.userEmail}.`);
          } catch (err) {
            alert("Error approving request: " + err.message);
          }
        });
      }

      const rejectBtn = card.querySelector(".reject-req-btn");
      if (rejectBtn) {
        rejectBtn.addEventListener("click", async () => {
          if (!confirm(`Reject payment request for ${req.userEmail}?`)) return;
          rejectBtn.disabled = true;
          rejectBtn.textContent = "Rejecting…";
          try {
            await db.collection("premiumRequests").doc(req.id).update({
              status: "rejected",
              rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (req.userId) {
              await db.collection("users").doc(req.userId).set({
                hasPremiumAccess: false,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
            }
          } catch (err) {
            alert("Error rejecting request: " + err.message);
          }
        });
      }

      reqListEl.appendChild(card);
    });
  }

  // ---- Manual Access Override by Email ----
  if (manualGrantBtn && manualGrantEmail) {
    manualGrantBtn.addEventListener("click", async () => {
      const email = manualGrantEmail.value.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        manualGrantStatus.textContent = "Please enter a valid email address.";
        manualGrantStatus.style.color = "crimson";
        return;
      }
      manualGrantBtn.disabled = true;
      manualGrantStatus.textContent = "Searching user and granting access…";
      manualGrantStatus.style.color = "#475569";

      try {
        const snap = await db.collection("users").where("email", "==", email).limit(1).get();
        if (snap.empty) {
          manualGrantStatus.textContent = `No account found registered with email "${email}". The user must register first.`;
          manualGrantStatus.style.color = "crimson";
        } else {
          const userDoc = snap.docs[0];
          await userDoc.ref.set({
            hasPremiumAccess: true,
            credits: firebase.firestore.FieldValue.increment(25),
            premiumApprovedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          manualGrantStatus.textContent = `Success! Premium access granted to ${email}.`;
          manualGrantStatus.style.color = "#10b981";
          manualGrantEmail.value = "";
        }
      } catch (err) {
        manualGrantStatus.textContent = "Error: " + err.message;
        manualGrantStatus.style.color = "crimson";
      } finally {
        manualGrantBtn.disabled = false;
      }
    });
  }

  if (manualRevokeBtn && manualGrantEmail) {
    manualRevokeBtn.addEventListener("click", async () => {
      const email = manualGrantEmail.value.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        manualGrantStatus.textContent = "Please enter a valid email address.";
        manualGrantStatus.style.color = "crimson";
        return;
      }
      manualRevokeBtn.disabled = true;
      manualGrantStatus.textContent = "Revoking access…";
      manualGrantStatus.style.color = "#475569";

      try {
        const snap = await db.collection("users").where("email", "==", email).limit(1).get();
        if (snap.empty) {
          manualGrantStatus.textContent = `No account found with email "${email}".`;
          manualGrantStatus.style.color = "crimson";
        } else {
          const userDoc = snap.docs[0];
          await userDoc.ref.set({
            hasPremiumAccess: false,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          manualGrantStatus.textContent = `Premium access revoked for ${email}.`;
          manualGrantStatus.style.color = "#10b981";
          manualGrantEmail.value = "";
        }
      } catch (err) {
        manualGrantStatus.textContent = "Error: " + err.message;
        manualGrantStatus.style.color = "crimson";
      } finally {
        manualRevokeBtn.disabled = false;
      }
    });
  }

  subscribePaymentRequests();

  // ---- Category Manager DOM refs ----
  const catNameInput    = document.getElementById("premiumCatName");
  const catSlugInput    = document.getElementById("premiumCatSlug");
  const catLevelSelect  = document.getElementById("premiumCatLevelSelect");
  const customCatWrap   = document.getElementById("customCatLevelWrap");
  const customCatInput  = document.getElementById("premiumCustomCatLevel");
  const catFilterByLevel= document.getElementById("adminCatFilterByLevel");
  const cancelEditCatBtn= document.getElementById("cancelEditCatBtn");
  const catFormHeader   = document.getElementById("catFormHeader");
  const catImageInput   = document.getElementById("premiumCatImage");
  const catCreditsInput = document.getElementById("premiumCatCredits");
  const catOrderInput   = document.getElementById("premiumCatOrder");
  const catDescInput    = document.getElementById("premiumCatDesc");
  const addCatBtn       = document.getElementById("addPremiumCategoryBtn");
  const catStatus       = document.getElementById("premiumCatStatus");
  const catListEl       = document.getElementById("premiumCatList");
  const qCatSelect      = document.getElementById("premiumQCategorySelect");
  const qListEl         = document.getElementById("premiumQList");

  // Category Configuration DOM refs
  const categoryTagsWrap  = document.getElementById("adminCategoryTagsWrap");
  const newCatInput       = document.getElementById("newCatLevelInput");
  const addCatLevelBtn    = document.getElementById("addNewCatLevelBtn");
  const resetCatLevelsBtn = document.getElementById("resetDefaultCatLevelsBtn");
  const catLevelStatus    = document.getElementById("adminCatLevelStatus");

  // Default Standard Categories / Levels
  const DEFAULT_PREMIUM_LEVELS = ["Beginners Level", "Intermediate Level", "Higher Level", "Loksewa"];
  let activeCategoryLevels = [...DEFAULT_PREMIUM_LEVELS];
  let editingCatId = null;

  function getQuizLevel(cat) {
    if (cat && cat.category && String(cat.category).trim()) return String(cat.category).trim();
    if (cat && cat.level && String(cat.level).trim()) return String(cat.level).trim();
    const name = (cat && cat.name ? cat.name : "").toLowerCase();
    if (name.includes("beginner")) return "Beginners Level";
    if (name.includes("intermediate")) return "Intermediate Level";
    if (name.includes("higher") || name.includes("advanced")) return "Higher Level";
    if (name.includes("loksewa") || name.includes("lok sewa")) return "Loksewa";
    return "Beginners Level";
  }

  /* ---------- Category / Level Config Manager ---------- */
  function subscribeCategoryLevels() {
    db.collection("siteSettings").doc("premiumCategories")
      .onSnapshot(doc => {
        if (doc.exists && Array.isArray(doc.data().list) && doc.data().list.length > 0) {
          activeCategoryLevels = doc.data().list.filter(Boolean);
        } else {
          activeCategoryLevels = [...DEFAULT_PREMIUM_LEVELS];
        }
        renderCategoryTags();
        syncCatLevelSelect();
        renderCategoryList();
      }, err => {
        console.warn("Could not load premiumCategories:", err);
        activeCategoryLevels = [...DEFAULT_PREMIUM_LEVELS];
        renderCategoryTags();
        syncCatLevelSelect();
        renderCategoryList();
      });
  }

  function renderCategoryTags() {
    if (!categoryTagsWrap) return;
    categoryTagsWrap.innerHTML = "";
    activeCategoryLevels.forEach((levelName) => {
      const tag = document.createElement("span");
      tag.className = "admin-tag";
      tag.style.cssText = "display:inline-flex; align-items:center; gap:8px; padding:6px 14px; font-size:0.86rem; border-radius:9999px; background:#eff6ff; color:#1d4ed8; font-weight:600; border:1px solid #bfdbfe;";
      tag.innerHTML = `
        <span>${escapeHtml(levelName)}</span>
        <button type="button" title="Remove ${escapeHtml(levelName)}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.1rem; line-height:1; padding:0 2px; font-weight:700; display:inline-flex; align-items:center;">&times;</button>
      `;
      tag.querySelector("button").addEventListener("click", async () => {
        if (activeCategoryLevels.length <= 1) {
          alert("You must keep at least one category level.");
          return;
        }
        if (confirm(`Remove category level "${levelName}"? Existing quizzes with this category will still retain their assigned level.`)) {
          const updated = activeCategoryLevels.filter(l => l !== levelName);
          await saveCategoryLevelsToFirestore(updated);
        }
      });
      categoryTagsWrap.appendChild(tag);
    });
  }

  async function saveCategoryLevelsToFirestore(newList) {
    try {
      if (catLevelStatus) {
        catLevelStatus.textContent = "Updating categories…";
        catLevelStatus.style.color = "var(--mist)";
      }
      await db.collection("siteSettings").doc("premiumCategories").set({
        list: newList,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      if (catLevelStatus) {
        catLevelStatus.textContent = "Categories updated successfully.";
        catLevelStatus.style.color = "#10b981";
        setTimeout(() => { if (catLevelStatus) catLevelStatus.textContent = ""; }, 3000);
      }
    } catch (err) {
      if (catLevelStatus) {
        catLevelStatus.textContent = err.message;
        catLevelStatus.style.color = "crimson";
      }
    }
  }

  if (addCatLevelBtn && newCatInput) {
    addCatLevelBtn.addEventListener("click", async () => {
      const val = newCatInput.value.trim();
      if (!val) {
        alert("Please enter a category name.");
        return;
      }
      if (activeCategoryLevels.some(l => l.toLowerCase() === val.toLowerCase())) {
        alert("This category already exists.");
        return;
      }
      const updated = [...activeCategoryLevels, val];
      await saveCategoryLevelsToFirestore(updated);
      newCatInput.value = "";
    });
    newCatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addCatLevelBtn.click();
      }
    });
  }

  if (resetCatLevelsBtn) {
    resetCatLevelsBtn.addEventListener("click", async () => {
      if (confirm("Reset categories to standard defaults (Beginners Level, Intermediate Level, Higher Level, Loksewa)?")) {
        await saveCategoryLevelsToFirestore([...DEFAULT_PREMIUM_LEVELS]);
      }
    });
  }

  function syncCatLevelSelect(selectedVal) {
    if (catLevelSelect) {
      const prev = selectedVal || catLevelSelect.value;
      catLevelSelect.innerHTML = "";
      activeCategoryLevels.forEach(lvl => {
        const opt = document.createElement("option");
        opt.value = lvl;
        opt.textContent = lvl;
        catLevelSelect.appendChild(opt);
      });
      const customOpt = document.createElement("option");
      customOpt.value = "__custom__";
      customOpt.textContent = "+ Type new custom category…";
      catLevelSelect.appendChild(customOpt);

      if (prev && activeCategoryLevels.includes(prev)) {
        catLevelSelect.value = prev;
      } else if (prev && prev !== "__custom__") {
        const extOpt = document.createElement("option");
        extOpt.value = prev;
        extOpt.textContent = prev;
        catLevelSelect.insertBefore(extOpt, customOpt);
        catLevelSelect.value = prev;
      } else {
        catLevelSelect.value = activeCategoryLevels[0] || "Beginners Level";
      }

      if (customCatWrap) {
        customCatWrap.style.display = catLevelSelect.value === "__custom__" ? "block" : "none";
      }
    }

    if (catFilterByLevel) {
      const prevFilter = catFilterByLevel.value || "all";
      catFilterByLevel.innerHTML = `<option value="all">All Levels</option>`;
      activeCategoryLevels.forEach(lvl => {
        const opt = document.createElement("option");
        opt.value = lvl;
        opt.textContent = lvl;
        catFilterByLevel.appendChild(opt);
      });
      catFilterByLevel.value = prevFilter;
    }
  }

  if (catLevelSelect) {
    catLevelSelect.addEventListener("change", () => {
      if (customCatWrap) {
        const isCustom = catLevelSelect.value === "__custom__";
        customCatWrap.style.display = isCustom ? "block" : "none";
        if (isCustom && customCatInput) {
          customCatInput.focus();
        }
      }
    });
  }

  if (catFilterByLevel) {
    catFilterByLevel.addEventListener("change", () => {
      renderCategoryList();
    });
  }

  function resetCategoryForm() {
    editingCatId = null;
    if (catNameInput) catNameInput.value = "";
    if (catSlugInput) {
      catSlugInput.value = "";
      catSlugInput.disabled = false;
    }
    if (catImageInput) catImageInput.value = "";
    if (catCreditsInput) catCreditsInput.value = "3";
    if (catOrderInput) catOrderInput.value = "99";
    if (catDescInput) catDescInput.value = "";
    if (customCatInput) customCatInput.value = "";
    if (customCatWrap) customCatWrap.style.display = "none";
    if (catLevelSelect) catLevelSelect.value = activeCategoryLevels[0] || "Beginners Level";
    if (addCatBtn) addCatBtn.textContent = "Save / Add Quiz";
    if (cancelEditCatBtn) cancelEditCatBtn.style.display = "none";
    if (catFormHeader) catFormHeader.textContent = "Premium Quizzes";
  }

  if (cancelEditCatBtn) {
    cancelEditCatBtn.addEventListener("click", resetCategoryForm);
  }

  // Subscribe immediately to category levels
  subscribeCategoryLevels();

  // ---- Question Manager DOM refs ----
  const qForm       = document.getElementById("premiumQuestionForm");
  const qIdField    = document.getElementById("premiumQId");
  const qTextField  = document.getElementById("premiumQText");
  const qOpts       = [
    document.getElementById("premiumOpt0"),
    document.getElementById("premiumOpt1"),
    document.getElementById("premiumOpt2"),
    document.getElementById("premiumOpt3")
  ];
  const qCorrectSel = document.getElementById("premiumCorrectIndex");
  const qExplField  = document.getElementById("premiumQExplanation");
  const qSubmitBtn  = document.getElementById("premiumQSubmitBtn");
  const cancelQBtn  = document.getElementById("cancelPremiumQEdit");
  const qStatus     = document.getElementById("premiumQStatus");

  // ---- Auto-generate slug from name ----
  if (catNameInput && catSlugInput) {
    catNameInput.addEventListener("input", () => {
      if (!editingCatId) {
        catSlugInput.value = catNameInput.value
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      }
    });
  }

  // ---- Category CRUD ----
  let categoryDocs = []; // [{id, name, category, imageUrl, description, credits, questions}] live list

  function subscribeCategories() {
    if (!catListEl) return;
    db.collection("premiumQuizContent")
      .onSnapshot(snap => {
        categoryDocs = snap.docs.map(d => ({
          id: d.id,
          name: d.data().name || d.id,
          category: getQuizLevel(d.data()),
          imageUrl: d.data().imageUrl || "",
          description: d.data().description || "",
          credits: d.data().credits ?? 3,
          displayOrder: d.data().displayOrder ?? 99,
          questions: d.data().questions || []
        })).sort((a, b) => {
          const od = (a.displayOrder ?? 99) - (b.displayOrder ?? 99);
          return od !== 0 ? od : (a.name || "").localeCompare(b.name || "");
        });
        renderCategoryList();
        syncCategorySelect();
      }, err => {
        console.error("Error subscribing to categories:", err);
        catListEl.innerHTML = `<p class="updates-loading">Error: ${err.message}</p>`;
      });
  }

  // Subscribe immediately to categories
  subscribeCategories();

  function renderCategoryList() {
    if (!catListEl) return;
    const filterLevel = catFilterByLevel ? catFilterByLevel.value : "all";
    const filteredDocs = filterLevel === "all"
      ? categoryDocs
      : categoryDocs.filter(c => (c.category || getQuizLevel(c)) === filterLevel);

    if (categoryDocs.length === 0) {
      catListEl.innerHTML = `<p class="updates-loading">No quizzes yet. Add one above.</p>`;
      return;
    }
    if (filteredDocs.length === 0) {
      catListEl.innerHTML = `<p class="updates-loading">No quizzes in level "${escapeHtml(filterLevel)}".</p>`;
      return;
    }

    catListEl.innerHTML = "";
    filteredDocs.forEach(cat => {
      const catLvl = cat.category || getQuizLevel(cat);
      const row = document.createElement("div");
      row.className = "admin-row";
      row.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 14px; border:1px solid var(--border); border-radius:8px; margin-bottom:8px;";
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; min-width:0;">
          ${cat.imageUrl ? `<img src="${escapeHtml(cat.imageUrl)}" alt="${escapeHtml(cat.name)}" style="width:48px; height:48px; object-fit:cover; border-radius:6px; border:1px solid var(--border); flex-shrink:0;" onerror="this.style.display='none'" />` : `<div style="width:48px; height:48px; background:var(--border); border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:700; color:var(--mist); flex-shrink:0;">QUIZ</div>`}
          <div style="min-width:0;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <strong>${escapeHtml(cat.name)}</strong>
              <span class="admin-tag" style="background:#eff6ff; color:#1d4ed8; font-weight:600; border:1px solid #bfdbfe;">${escapeHtml(catLvl)}</span>
              <span class="admin-tag">${escapeHtml(cat.id)}</span>
              <span class="admin-tag" style="background:#fef3c7; color:#92400e;">${cat.credits} Credits</span>
              <span class="admin-tag" style="background:#f1f5f9; color:#475569;">${(cat.questions || []).length} Qs</span>
              <span class="admin-tag" style="background:#f0fdf4; color:#166534; font-weight:700;" title="Display order position">#${cat.displayOrder ?? 99}</span>
            </div>
            <p style="margin:4px 0 0; font-size:0.85rem; color:var(--mist); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(cat.description || "No description provided.")}</p>
          </div>
        </div>
        <div class="admin-row-actions" style="display:flex; gap:6px; flex-shrink:0;">
          <button class="btn btn-outline btn-sm" data-edit-cat="${escapeHtml(cat.id)}">Edit</button>
          <button class="btn btn-outline btn-sm btn-danger" data-del="${escapeHtml(cat.id)}">Delete</button>
        </div>
      `;

      row.querySelector("[data-edit-cat]").addEventListener("click", () => {
        editingCatId = cat.id;
        if (catNameInput) catNameInput.value = cat.name;
        if (catSlugInput) {
          catSlugInput.value = cat.id;
          catSlugInput.disabled = true; // Lock slug when editing to preserve questions
        }
        if (catImageInput) catImageInput.value = cat.imageUrl || "";
        if (catCreditsInput) catCreditsInput.value = cat.credits ?? 3;
        if (catOrderInput) catOrderInput.value = cat.displayOrder ?? 99;
        if (catDescInput) catDescInput.value = cat.description || "";
        
        syncCatLevelSelect(catLvl);
        if (catLevelSelect) catLevelSelect.value = catLvl;
        if (customCatWrap) customCatWrap.style.display = "none";

        if (addCatBtn) addCatBtn.textContent = "Save Changes to Quiz";
        if (cancelEditCatBtn) cancelEditCatBtn.style.display = "inline-block";
        if (catFormHeader) catFormHeader.textContent = `Edit Quiz: "${cat.name}"`;
        if (catNameInput) catNameInput.scrollIntoView({ behavior: "smooth" });
      });

      row.querySelector("[data-del]").addEventListener("click", () => {
        if (confirm(`Delete quiz "${cat.name}" and ALL its questions? This cannot be undone.`)) {
          db.collection("premiumQuizContent").doc(cat.id).delete()
            .catch(err => alert(err.message));
        }
      });
      catListEl.appendChild(row);
    });
  }

  function syncCategorySelect() {
    if (!qCatSelect) return;
    const prev = qCatSelect.value;
    qCatSelect.innerHTML = `<option value="">-- Select a category --</option>`;
    categoryDocs.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      const lvl = cat.category || getQuizLevel(cat);
      opt.textContent = `${cat.name} [${lvl}] (${(cat.questions || []).length} questions)`;
      qCatSelect.appendChild(opt);
    });
    if (prev && categoryDocs.find(c => c.id === prev)) {
      qCatSelect.value = prev;
    }
  }

  if (addCatBtn && catNameInput && catSlugInput) {
    addCatBtn.addEventListener("click", async () => {
      const name = catNameInput.value.trim();
      const slug = catSlugInput.value.trim();
      const imageUrl = catImageInput ? catImageInput.value.trim() : "";
      const credits = catCreditsInput ? parseInt(catCreditsInput.value, 10) : 3;
      const displayOrder = catOrderInput ? (parseInt(catOrderInput.value, 10) || 99) : 99;
      const desc = catDescInput ? catDescInput.value.trim() : "";

      let categoryLevel = catLevelSelect ? catLevelSelect.value : "Beginners Level";
      if (categoryLevel === "__custom__") {
        categoryLevel = customCatInput ? customCatInput.value.trim() : "";
        if (!categoryLevel) {
          alert("Please type a name for the custom category.");
          if (customCatInput) customCatInput.focus();
          return;
        }
        // Save to activeCategoryLevels if not present
        if (!activeCategoryLevels.some(l => l.toLowerCase() === categoryLevel.toLowerCase())) {
          activeCategoryLevels.push(categoryLevel);
          saveCategoryLevelsToFirestore(activeCategoryLevels);
        }
      }

      if (!name || !slug) {
        if (catStatus) {
          catStatus.textContent = "Both title and slug are required.";
          catStatus.style.color = "crimson";
        }
        return;
      }
      if (!/^[a-z0-9-]+$/.test(slug)) {
        if (catStatus) {
          catStatus.textContent = "Slug must be lowercase letters, digits, and hyphens only.";
          catStatus.style.color = "crimson";
        }
        return;
      }
      try {
        if (catStatus) {
          catStatus.textContent = "Saving quiz…";
          catStatus.style.color = "var(--mist)";
        }
        await db.collection("premiumQuizContent").doc(slug).set({
          name: name,
          category: categoryLevel,
          imageUrl: imageUrl,
          description: desc,
          credits: isNaN(credits) || credits < 1 ? 3 : credits,
          displayOrder: isNaN(displayOrder) || displayOrder < 1 ? 99 : displayOrder,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        resetCategoryForm();

        if (catStatus) {
          catStatus.textContent = `Quiz "${name}" (${categoryLevel}) saved successfully.`;
          catStatus.style.color = "#10b981";
          setTimeout(() => { if (catStatus) catStatus.textContent = ""; }, 4000);
        }
      } catch (err) {
        if (catStatus) {
          catStatus.textContent = err.message;
          catStatus.style.color = "crimson";
        }
      }
    });
  }

  // ---- Question CRUD (stored as array inside category doc) ----
  let currentCatQuestions = [];
  let currentCatId = "";
  let questionUnsub = null;

  if (qCatSelect) {
    qCatSelect.addEventListener("change", () => {
      currentCatId = qCatSelect.value;
      resetQForm();
      if (!currentCatId) {
        if (qListEl) qListEl.innerHTML = `<p class="updates-loading">Select a category to view its questions.</p>`;
        return;
      }
      loadCatQuestions(currentCatId);
    });
  }

  function loadCatQuestions(catId) {
    if (questionUnsub) questionUnsub();
    if (qListEl) qListEl.innerHTML = `<p class="updates-loading">Loading questions…</p>`;
    questionUnsub = db.collection("premiumQuizContent").doc(catId)
      .onSnapshot(snap => {
        currentCatQuestions = snap.exists ? (snap.data().questions || []) : [];
        renderQList();
      }, err => {
        if (qListEl) qListEl.innerHTML = `<p class="updates-loading">Error: ${err.message}</p>`;
      });
  }

  function renderQList() {
    if (!qListEl) return;
    if (currentCatQuestions.length === 0) {
      qListEl.innerHTML = `<p class="updates-loading">No questions yet for this category. Add one above.</p>`;
      return;
    }
    qListEl.innerHTML = "";
    currentCatQuestions.forEach((q, idx) => {
      const row = document.createElement("div");
      row.className = "admin-row";
      const optLetters = ["A", "B", "C", "D"];
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(q.question || "")}</strong>
          <span class="admin-tag">Correct: ${optLetters[q.correctIndex] || "?"}</span>
        </div>
        <div class="admin-row-actions">
          <button class="btn btn-outline btn-sm" data-action="edit" data-idx="${idx}">Edit</button>
          <button class="btn btn-outline btn-sm btn-danger" data-action="delete" data-idx="${idx}">Delete</button>
        </div>
      `;
      row.querySelector("[data-action='edit']").addEventListener("click", () => {
        const q2 = currentCatQuestions[idx];
        if (qIdField) qIdField.value = String(idx);
        if (qTextField) qTextField.value = q2.question || "";
        (q2.options || []).forEach((o, i) => { if (qOpts[i]) qOpts[i].value = o; });
        if (qCorrectSel) qCorrectSel.value = String(q2.correctIndex ?? 0);
        if (qExplField) qExplField.value = q2.explanation || "";
        if (qSubmitBtn) qSubmitBtn.textContent = "Save changes";
        if (cancelQBtn) cancelQBtn.hidden = false;
        if (qForm) qForm.scrollIntoView({ behavior: "smooth" });
      });
      row.querySelector("[data-action='delete']").addEventListener("click", async () => {
        if (!confirm("Delete this question?")) return;
        const updated = [...currentCatQuestions];
        updated.splice(idx, 1);
        try {
          await db.collection("premiumQuizContent").doc(currentCatId).update({ questions: updated });
        } catch (err) { alert(err.message); }
      });
      qListEl.appendChild(row);
    });
  }

  if (qForm) {
    qForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentCatId) {
        if (qStatus) {
          qStatus.textContent = "Select a category first.";
          qStatus.style.color = "crimson";
        }
        return;
      }
      const qPayload = {
        question:     qTextField ? qTextField.value.trim() : "",
        options:      qOpts.map(o => o ? o.value.trim() : ""),
        correctIndex: qCorrectSel ? Number(qCorrectSel.value) : 0,
        explanation:  qExplField ? qExplField.value.trim() : "",
      };
      const editingIdx = (qIdField && qIdField.value !== "") ? parseInt(qIdField.value, 10) : -1;
      const updated = [...currentCatQuestions];

      if (editingIdx >= 0 && editingIdx < updated.length) {
        updated[editingIdx] = qPayload;
      } else {
        updated.push(qPayload);
      }

      try {
        if (qStatus) {
          qStatus.textContent = "Saving…";
          qStatus.style.color = "var(--mist)";
        }
        await db.collection("premiumQuizContent").doc(currentCatId).update({ questions: updated });
        if (qStatus) {
          qStatus.textContent = editingIdx >= 0 ? "Question updated successfully." : "Question added successfully.";
          qStatus.style.color = "#10b981";
        }
        resetQForm();
      } catch (err) {
        if (qStatus) {
          qStatus.textContent = err.message;
          qStatus.style.color = "crimson";
        }
      }
    });
  }

  if (cancelQBtn) {
    cancelQBtn.addEventListener("click", resetQForm);
  }

  function resetQForm() {
    if (qForm) qForm.reset();
    if (qIdField) qIdField.value = "";
    if (qSubmitBtn) qSubmitBtn.textContent = "Add Question";
    if (cancelQBtn) cancelQBtn.hidden = true;
    if (qStatus) qStatus.textContent = "";
  }

  /* ---- Bulk Import for Premium Questions ---- */
  const premImportFile   = document.getElementById("premiumQImportFile");
  const premImportText   = document.getElementById("premiumQImportText");
  const premImportBtn    = document.getElementById("premiumQImportBtn");
  const premImportStatus = document.getElementById("premiumQImportStatus");
  const downloadPremCsv  = document.getElementById("downloadPremiumQCsvTemplate");
  const downloadPremJson = document.getElementById("downloadPremiumQJsonTemplate");

  function parsePremiumQuestionsInput(text) {
    if (looksLikeJson(text)) {
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : [data];
      return arr.map((q, i) => {
        if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
          throw new Error(`Row ${i + 1}: needs "question" and exactly 4 "options".`);
        }
        let correctIdx = 0;
        if (typeof q.correctIndex === "number") {
          correctIdx = q.correctIndex;
        } else if (typeof q.correct === "string") {
          const cRaw = q.correct.trim().toUpperCase();
          if (["A", "B", "C", "D"].includes(cRaw)) correctIdx = "ABCD".indexOf(cRaw);
          else if (["0", "1", "2", "3"].includes(cRaw)) correctIdx = Number(cRaw);
          else if (["1", "2", "3", "4"].includes(cRaw)) correctIdx = Number(cRaw) - 1;
        }
        return {
          question:     String(q.question).trim(),
          options:      q.options.map(o => String(o).trim()),
          correctIndex: Math.max(0, Math.min(3, correctIdx)),
          explanation:  q.explanation ? String(q.explanation).trim() : "",
        };
      });
    }

    // CSV path
    const rows = parseCSV(text);
    if (!rows.length) throw new Error("No rows found in CSV.");
    let startIdx = 0;
    if (/question/i.test(rows[0][0] || "")) startIdx = 1; // skip header row
    const results = [];
    for (let i = startIdx; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0] || !r[0].trim()) continue;
      const question = r[0];
      const a = r[1];
      const b = r[2];
      const c = r[3];
      const d = r[4];
      const correct = r[5];
      const explanation = r[6] || "";

      if (!a || !b || !c || !d) {
        throw new Error(`Row ${i + 1}: needs question + 4 options (columns 2-5).`);
      }
      let correctIndex = 0;
      const cRaw = (correct || "").trim().toUpperCase();
      if (["A", "B", "C", "D"].includes(cRaw)) correctIndex = "ABCD".indexOf(cRaw);
      else if (["1", "2", "3", "4"].includes(cRaw)) correctIndex = Number(cRaw) - 1;
      else if (["0", "1", "2", "3"].includes(cRaw)) correctIndex = Number(cRaw);

      results.push({
        question:     question.trim(),
        options:      [a.trim(), b.trim(), c.trim(), d.trim()],
        correctIndex: Math.max(0, Math.min(3, correctIndex)),
        explanation:  (explanation || "").trim(),
      });
    }
    if (!results.length) throw new Error("No valid question rows found.");
    return results;
  }

  if (premImportBtn) {
    premImportBtn.addEventListener("click", async () => {
      if (!currentCatId) {
        if (premImportStatus) {
          premImportStatus.style.color = "crimson";
          premImportStatus.textContent = "Please select a category first from the dropdown above.";
        }
        if (qCatSelect) qCatSelect.focus();
        return;
      }

      if (premImportStatus) {
        premImportStatus.style.color = "var(--mist)";
        premImportStatus.textContent = "Reading file or pasted content…";
      }

      try {
        const { text } = await readImportInput(premImportFile, premImportText);
        const parsed = parsePremiumQuestionsInput(text);

        const modeRadio = document.querySelector('input[name="premiumImportMode"]:checked');
        const mode = modeRadio ? modeRadio.value : "append";

        const selectedCat = categoryDocs.find(c => c.id === currentCatId);
        const catName = selectedCat ? selectedCat.name : currentCatId;

        let finalQuestions = [];
        if (mode === "replace") {
          if (!confirm(`Replace all ${currentCatQuestions.length} existing question(s) in "${catName}" with ${parsed.length} imported question(s)?`)) {
            if (premImportStatus) {
              premImportStatus.style.color = "var(--mist)";
              premImportStatus.textContent = "Import cancelled.";
            }
            return;
          }
          finalQuestions = [...parsed];
        } else {
          finalQuestions = [...currentCatQuestions, ...parsed];
        }

        if (premImportStatus) {
          premImportStatus.textContent = `Saving ${finalQuestions.length} questions to "${catName}"…`;
        }

        await db.collection("premiumQuizContent").doc(currentCatId).set({
          questions: finalQuestions,
          questionCount: finalQuestions.length,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        if (premImportStatus) {
          premImportStatus.style.color = "#10b981";
          premImportStatus.textContent = `Successfully imported ${parsed.length} question(s)! Category now has ${finalQuestions.length} total questions.`;
        }

        if (premImportFile) premImportFile.value = "";
        if (premImportText) premImportText.value = "";
      } catch (err) {
        console.error("Premium questions import error:", err);
        if (premImportStatus) {
          premImportStatus.style.color = "crimson";
          premImportStatus.textContent = err.message || "Failed to import questions.";
        }
      }
    });
  }

  if (downloadPremCsv) {
    downloadPremCsv.addEventListener("click", (e) => {
      e.preventDefault();
      const csv =
        "question,option_a,option_b,option_c,option_d,correct,explanation\n" +
        '"What is the capital of Nepal?","Pokhara","Kathmandu","Lalitpur","Biratnagar",B,"Kathmandu is the constitutional capital and largest city of Nepal."\n' +
        '"Which planet is known as the Red Planet?","Venus","Mars","Jupiter","Saturn",B,"Mars has high iron oxide on its surface giving it a reddish appearance."\n' +
        '"What is the SI unit of electric current?","Volt","Ohm","Ampere","Watt",C,"Electric current is measured in Amperes (A)."\n';
      downloadTextFile("premium-questions-template.csv", csv, "text/csv");
    });
  }

  if (downloadPremJson) {
    downloadPremJson.addEventListener("click", (e) => {
      e.preventDefault();
      const json = JSON.stringify(
        [
          {
            question: "What is the capital of Nepal?",
            options: ["Pokhara", "Kathmandu", "Lalitpur", "Biratnagar"],
            correctIndex: 1,
            explanation: "Kathmandu is the constitutional capital and largest city of Nepal."
          },
          {
            question: "Which planet is known as the Red Planet?",
            options: ["Venus", "Mars", "Jupiter", "Saturn"],
            correctIndex: 1,
            explanation: "Mars has high iron oxide on its surface giving it a reddish appearance."
          },
          {
            question: "What is the SI unit of electric current?",
            options: ["Volt", "Ohm", "Ampere", "Watt"],
            correctIndex: 2,
            explanation: "Electric current is measured in Amperes (A)."
          }
        ],
        null,
        2
      );
      downloadTextFile("premium-questions-template.json", json, "application/json");
    });
  }
}

/* ============================================
   MODERATOR OUTER PANEL HELPERS
   Show/hide the separate moderator section outside #dashboard
   ============================================ */
function hideModeratorOuter() {
  const outer = document.getElementById("tab-moderators-outer");
  if (outer) outer.hidden = true;
}

function showModeratorOuter(user, displayName, perms) {
  const outer = document.getElementById("tab-moderators-outer");
  if (!outer) return;
  outer.hidden = false;
  // Build a lightweight header inside the outer container so moderators
  // see something at the top.  Only add it once.
  if (!outer.dataset.headerAdded) {
    outer.dataset.headerAdded = "1";
    const hdr = document.createElement("div");
    hdr.style.cssText = "padding:20px 0 0; margin-bottom:4px;";
    hdr.innerHTML = `
      <div class="container">
        <h1 class="section-title" style="margin-bottom:4px;">Moderator Panel</h1>
        <p class="quiz-muted" style="margin-bottom:0;">
          Signed in as <strong>${escapeHtml(displayName)}</strong>
          &mdash; you can only manage the sections your permissions allow.
        </p>
      </div>
    `;
    outer.prepend(hdr);
  }
}

/* ============================================
   MODERATOR DASHBOARD — limited view for moderators
   Called instead of the full initX functions.
   ============================================ */
function initModeratorDashboard(user, perms) {
  const mcqPerms = perms.mcq || {};
  const hasMcq = mcqPerms.class8 || mcqPerms.class9 || mcqPerms.class10;

  // Build a simple tab bar inside the moderator outer panel
  const modPanel = document.getElementById("tab-moderators");
  if (!modPanel) return;

  // Clear the default moderator-management content (only owners see that)
  modPanel.innerHTML = "";

  // Build a tab strip
  const tabs = [];
  if (hasMcq)               tabs.push({ key: "questions",   label: "Questions" });
  if (perms.pythonHub)      tabs.push({ key: "python",      label: "Python Programs" });
  if (perms.premiumQuiz)    tabs.push({ key: "premiumquiz", label: "Premium Quiz" });
  if (perms.resources)      tabs.push({ key: "resources",   label: "Resources" });
  if (perms.updates)        tabs.push({ key: "updates",     label: "Latest Updates" });
  if (perms.liveQuiz)       tabs.push({ key: "livequiz",    label: "Live Quiz Schedule" });

  if (tabs.length === 0) {
    modPanel.innerHTML = `<p class="quiz-muted" style="padding:24px 0;">
      No permissions have been assigned to your account yet. Please contact the site owner.
    </p>`;
    return;
  }

  // Create tab buttons
  const tabStrip = document.createElement("div");
  tabStrip.className = "admin-tabs";
  tabStrip.setAttribute("role", "tablist");

  // Create content areas (reuse existing admin tab panels by moving them here)
  const contentWrap = document.createElement("div");

  tabs.forEach((t, idx) => {
    const btn = document.createElement("button");
    btn.className = "admin-tab" + (idx === 0 ? " active" : "");
    btn.type = "button";
    btn.dataset.modTab = t.key;
    btn.textContent = t.label;
    btn.addEventListener("click", () => {
      tabStrip.querySelectorAll(".admin-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      contentWrap.querySelectorAll(".admin-panel").forEach(p => { p.hidden = true; });
      const panel = contentWrap.querySelector(`[data-mod-panel="${t.key}"]`);
      if (panel) panel.hidden = false;
    });
    tabStrip.appendChild(btn);
  });

  modPanel.appendChild(tabStrip);
  modPanel.appendChild(contentWrap);

  // Move (or clone) the relevant existing admin panels into here
  tabs.forEach((t, idx) => {
    // These panels already exist in the DOM (inside #dashboard) — grab references
    const sourcePanel = document.getElementById("tab-" + t.key);
    if (!sourcePanel) return;
    // Clone it so the original DOM structure remains intact for the owner path
    const clone = sourcePanel.cloneNode(true);
    clone.removeAttribute("id");
    clone.dataset.modPanel = t.key;
    clone.hidden = idx !== 0;
    contentWrap.appendChild(clone);
  });

  // Initialise permitted sections
  if (hasMcq) {
    initQuestionsAdmin();
    // Restrict class selector after a short delay (let the DOM settle)
    setTimeout(() => applyMcqClassRestriction(mcqPerms), 300);
  }
  if (perms.pythonHub)   initPythonAdmin();
  if (perms.resources)   initResourcesAdmin();
  if (perms.updates)     initUpdatesAdmin();
  if (perms.liveQuiz)    initLiveQuizAdmin();
  if (perms.premiumQuiz) initPremiumQuizAdmin();
}

/* Locks the MCQ class selector to only the permitted classes for moderators */
function applyMcqClassRestriction(mcqPerms) {
  const classSelect = document.getElementById("qClass");
  const classFilter = document.getElementById("questionClassFilter");
  const allowed = [];
  if (mcqPerms.class8)  allowed.push("8");
  if (mcqPerms.class9)  allowed.push("9");
  if (mcqPerms.class10) allowed.push("10");
  if (!allowed.length)  return;

  [classSelect, classFilter].forEach(sel => {
    if (!sel) return;
    Array.from(sel.options).forEach(opt => {
      if (opt.value !== "All" && !allowed.includes(opt.value)) {
        opt.disabled = true;
        opt.style.color = "#94a3b8";
      }
    });
    // Force value to first allowed option if current not permitted
    if (sel.value !== "All" && !allowed.includes(sel.value)) {
      sel.value = allowed[0];
      sel.dispatchEvent(new Event("change"));
    }
  });
}

/* ============================================
   MODERATORS ADMIN — owner-only section
   Allows the owner to:
   1. Directly CREATE a new moderator account (name, email, password, permissions)
   2. Search and promote existing registered users
   3. Manage, edit, or revoke existing moderators
   ============================================ */
function initModeratorsAdmin() {
  // 1. Create New Moderator Form DOM
  const createModForm       = document.getElementById("createModForm");
  const createModName       = document.getElementById("createModName");
  const createModEmail      = document.getElementById("createModEmail");
  const createModPassword   = document.getElementById("createModPassword");
  const createModSubmitBtn  = document.getElementById("createModSubmitBtn");
  const createModStatus     = document.getElementById("createModStatus");

  const newPermFields = {
    mcqClass8:   document.getElementById("newPermMcqClass8"),
    mcqClass9:   document.getElementById("newPermMcqClass9"),
    mcqClass10:  document.getElementById("newPermMcqClass10"),
    pythonHub:   document.getElementById("newPermPythonHub"),
    premiumQuiz: document.getElementById("newPermPremiumQuiz"),
    resources:   document.getElementById("newPermResources"),
    updates:     document.getElementById("newPermUpdates"),
    liveQuiz:    document.getElementById("newPermLiveQuiz"),
  };

  // 2. Existing User Search & Edit DOM
  const modSearchEmail  = document.getElementById("modSearchEmail");
  const modSearchBtn    = document.getElementById("modSearchBtn");
  const modSearchStatus = document.getElementById("modSearchStatus");
  const modUserCard     = document.getElementById("modUserCard");
  const modUserName     = document.getElementById("modUserName");
  const modUserEmail    = document.getElementById("modUserEmail");
  const modCurrentBadge = document.getElementById("modCurrentBadge");
  const modTargetUid    = document.getElementById("modTargetUid");
  const modSaveBtn      = document.getElementById("modSaveBtn");
  const modRevokeBtn    = document.getElementById("modRevokeBtn");
  const modSaveStatus   = document.getElementById("modSaveStatus");
  const modList         = document.getElementById("modList");

  const permFields = {
    mcqClass8:   document.getElementById("permMcqClass8"),
    mcqClass9:   document.getElementById("permMcqClass9"),
    mcqClass10:  document.getElementById("permMcqClass10"),
    pythonHub:   document.getElementById("permPythonHub"),
    premiumQuiz: document.getElementById("permPremiumQuiz"),
    resources:   document.getElementById("permResources"),
    updates:     document.getElementById("permUpdates"),
    liveQuiz:    document.getElementById("permLiveQuiz"),
  };

  if (!modList) return;

  /* ---------- Live list of current moderators ---------- */
  db.collection("moderators").orderBy("createdAt", "desc").onSnapshot(snap => {
    if (!modList) return;
    if (snap.empty) {
      modList.innerHTML = `<p class="updates-loading">No moderators yet. Create or add one above.</p>`;
      return;
    }
    modList.innerHTML = "";
    snap.forEach(doc => {
      const m = doc.data();
      const perms = m.permissions || {};
      const mcqP  = perms.mcq || {};
      const permLabels = [];
      if (mcqP.class8)       permLabels.push("MCQ Class 8");
      if (mcqP.class9)       permLabels.push("MCQ Class 9");
      if (mcqP.class10)      permLabels.push("MCQ Class 10");
      if (perms.pythonHub)   permLabels.push("Python Hub");
      if (perms.premiumQuiz) permLabels.push("Premium Quiz");
      if (perms.resources)   permLabels.push("Resources");
      if (perms.updates)     permLabels.push("Updates");
      if (perms.liveQuiz)    permLabels.push("Live Quiz");

      const row = document.createElement("div");
      row.className = "admin-row";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(m.displayName || m.email)}</strong>
          <span class="admin-tag" style="margin-left:6px;">${escapeHtml(m.email)}</span>
          <div style="margin-top:6px; display:flex; flex-wrap:wrap; gap:6px;">
            ${permLabels.length
              ? permLabels.map(l => `<span class="mod-badge">${escapeHtml(l)}</span>`).join("")
              : `<span style="font-size:0.82rem; color:var(--mist);">No permissions assigned</span>`}
          </div>
        </div>
        <div class="admin-row-actions">
          <button class="btn btn-outline btn-sm" data-action="edit">Edit</button>
          <button class="btn btn-outline btn-sm btn-danger" data-action="revoke">Revoke</button>
        </div>
      `;

      row.querySelector('[data-action="edit"]').addEventListener("click", () => {
        // Open the details accordion if closed
        const detailsEl = document.querySelector("details.admin-import");
        if (detailsEl) detailsEl.open = true;
        if (modSearchEmail) modSearchEmail.value = m.email || "";
        fillModCard(doc.id, m.displayName || m.email, m.email, m.permissions || {}, true);
      });

      row.querySelector('[data-action="revoke"]').addEventListener("click", async () => {
        if (!confirm(`Revoke moderator access for ${m.email}? They will no longer be able to access the admin panel.`)) return;
        try {
          await db.collection("moderators").doc(doc.id).delete();
          if (modSaveStatus) {
            modSaveStatus.textContent = `Moderator access revoked for ${m.email}.`;
            modSaveStatus.style.color = "#10b981";
          }
          resetModCard();
        } catch (err) {
          alert("Error revoking moderator: " + err.message);
        }
      });

      modList.appendChild(row);
    });
  }, err => {
    console.error("Moderators snapshot error:", err);
    if (modList) {
      let extraTip = "";
      if (err.code === "permission-denied" || (err.message && err.message.toLowerCase().includes("permission"))) {
        extraTip = `<br/><span style="color:var(--mist); font-size:0.85rem; font-weight:normal;">
          Note: Please ensure the updated <code>firestore.rules</code> file is published in your Firebase Console (Firestore Database &rarr; Rules).
        </span>`;
      }
      modList.innerHTML = `<p class="updates-loading" style="color:crimson;">Could not load moderators: ${escapeHtml(err.message)}.${extraTip}</p>`;
    }
  });

  /* ---------- 1. CREATE NEW MODERATOR ACCOUNT DIRECTLY ---------- */
  if (createModSubmitBtn && createModForm) {
    createModSubmitBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const name = createModName ? createModName.value.trim() : "";
      const email = createModEmail ? createModEmail.value.trim().toLowerCase() : "";
      const password = createModPassword ? createModPassword.value : "";

      if (!name) {
        setCreateStatus("Please enter the moderator's full name.", "crimson");
        if (createModName) createModName.focus();
        return;
      }
      if (!email || !email.includes("@")) {
        setCreateStatus("Please enter a valid email address.", "crimson");
        if (createModEmail) createModEmail.focus();
        return;
      }
      if (!password || password.length < 6) {
        setCreateStatus("Password must be at least 6 characters long.", "crimson");
        if (createModPassword) createModPassword.focus();
        return;
      }

      const permissions = {
        mcq: {
          class8:  !!(newPermFields.mcqClass8  && newPermFields.mcqClass8.checked),
          class9:  !!(newPermFields.mcqClass9  && newPermFields.mcqClass9.checked),
          class10: !!(newPermFields.mcqClass10 && newPermFields.mcqClass10.checked),
        },
        pythonHub:   !!(newPermFields.pythonHub   && newPermFields.pythonHub.checked),
        premiumQuiz: !!(newPermFields.premiumQuiz && newPermFields.premiumQuiz.checked),
        resources:   !!(newPermFields.resources   && newPermFields.resources.checked),
        updates:     !!(newPermFields.updates     && newPermFields.updates.checked),
        liveQuiz:    !!(newPermFields.liveQuiz    && newPermFields.liveQuiz.checked),
      };

      const hasAnyPerm = permissions.mcq.class8 || permissions.mcq.class9 || permissions.mcq.class10
        || permissions.pythonHub || permissions.premiumQuiz || permissions.resources
        || permissions.updates || permissions.liveQuiz;

      if (!hasAnyPerm) {
        setCreateStatus("Please check at least one permission to grant.", "crimson");
        return;
      }

      createModSubmitBtn.disabled = true;
      createModSubmitBtn.textContent = "Creating Account…";
      setCreateStatus("Creating new authentication account…", "var(--mist)");

      let tempApp = null;
      try {
        // Use a unique secondary Firebase App instance so the active admin session is not signed out
        const tempAppName = "ModCreator_" + Date.now();
        tempApp = firebase.initializeApp(firebaseConfig, tempAppName);
        const tempAuth = tempApp.auth();

        // 1. Create account in Firebase Auth
        const cred = await tempAuth.createUserWithEmailAndPassword(email, password);
        const newUid = cred.user.uid;

        if (name) {
          await cred.user.updateProfile({ displayName: name });
        }

        // Clean up secondary auth
        await tempAuth.signOut();

        setCreateStatus("Account created! Saving moderator permissions in database…", "var(--mist)");

        // 2. Save user profile in Firestore 'users' collection (via primary admin db connection)
        await db.collection("users").doc(newUid).set({
          email: email,
          displayName: name,
          role: "moderator",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 3. Save permissions in 'moderators' collection
        const currentUser = auth.currentUser;
        await db.collection("moderators").doc(newUid).set({
          email: email,
          displayName: name,
          permissions: permissions,
          grantedBy: currentUser ? currentUser.email : "",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        // Reset form
        createModName.value = "";
        createModEmail.value = "";
        createModPassword.value = "";
        Object.values(newPermFields).forEach(chk => { if (chk) chk.checked = false; });

        setCreateStatus(`Moderator account for "${name}" (${email}) created successfully! They can now log in at this admin page with their credentials.`, "#10b981");
      } catch (err) {
        console.error("Create moderator error:", err);
        let errorMsg = err.message || "Failed to create account.";
        if (err.code === "auth/email-already-in-use") {
          errorMsg = `An account with email "${email}" already exists. You can assign permissions to them using the "Promote / Edit Existing User" section below.`;
        }
        setCreateStatus("Error: " + errorMsg, "crimson");
      } finally {
        if (tempApp) {
          try { await tempApp.delete(); } catch (e) { /* ignore */ }
        }
        createModSubmitBtn.disabled = false;
        createModSubmitBtn.textContent = "Create Moderator Account";
      }
    });
  }

  function setCreateStatus(msg, color) {
    if (createModStatus) {
      createModStatus.textContent = msg;
      createModStatus.style.color = color;
    }
  }

  /* ---------- 2. FIND AND PROMOTE EXISTING USER ---------- */
  if (modSearchBtn) {
    modSearchBtn.addEventListener("click", async () => {
      const email = modSearchEmail ? modSearchEmail.value.trim().toLowerCase() : "";
      if (!email || !email.includes("@")) {
        setModSearchStatus("Please enter a valid email address.", "crimson");
        return;
      }
      modSearchBtn.disabled = true;
      modSearchBtn.textContent = "Searching…";
      setModSearchStatus("Looking up user…", "var(--mist)");
      resetModCard();

      try {
        const userSnap = await db.collection("users").where("email", "==", email).limit(1).get();
        if (userSnap.empty) {
          setModSearchStatus(`No registered account found for "${email}". You can create a new moderator account using the form above.`, "crimson");
          return;
        }
        const userDoc = userSnap.docs[0];
        const uid = userDoc.id;
        const userData = userDoc.data();

        // Check if already a moderator
        const modDoc = await db.collection("moderators").doc(uid).get();
        const existingPerms = modDoc.exists ? (modDoc.data().permissions || {}) : {};
        const isAlreadyMod = modDoc.exists;

        setModSearchStatus("", "");
        fillModCard(uid, userData.displayName || userData.name || email, email, existingPerms, isAlreadyMod);
      } catch (err) {
        setModSearchStatus("Error: " + err.message, "crimson");
      } finally {
        modSearchBtn.disabled = false;
        modSearchBtn.textContent = "Find User";
      }
    });

    if (modSearchEmail) {
      modSearchEmail.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); modSearchBtn.click(); }
      });
    }
  }

  /* ---------- Fill existing user card with data ---------- */
  function fillModCard(uid, name, email, existingPerms, isAlreadyMod) {
    if (!modUserCard) return;
    modTargetUid.value = uid;
    modUserName.textContent = name;
    modUserEmail.textContent = email;

    if (modCurrentBadge) {
      modCurrentBadge.style.display = isAlreadyMod ? "inline-flex" : "none";
    }
    if (modRevokeBtn) {
      modRevokeBtn.style.display = isAlreadyMod ? "inline-flex" : "none";
    }

    const mcqP = existingPerms.mcq || {};
    if (permFields.mcqClass8)   permFields.mcqClass8.checked   = !!mcqP.class8;
    if (permFields.mcqClass9)   permFields.mcqClass9.checked   = !!mcqP.class9;
    if (permFields.mcqClass10)  permFields.mcqClass10.checked  = !!mcqP.class10;
    if (permFields.pythonHub)   permFields.pythonHub.checked   = !!existingPerms.pythonHub;
    if (permFields.premiumQuiz) permFields.premiumQuiz.checked = !!existingPerms.premiumQuiz;
    if (permFields.resources)   permFields.resources.checked   = !!existingPerms.resources;
    if (permFields.updates)     permFields.updates.checked     = !!existingPerms.updates;
    if (permFields.liveQuiz)    permFields.liveQuiz.checked    = !!existingPerms.liveQuiz;

    modUserCard.hidden = false;
    modUserCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function resetModCard() {
    if (modUserCard) modUserCard.hidden = true;
    if (modTargetUid) modTargetUid.value = "";
    Object.values(permFields).forEach(f => { if (f) f.checked = false; });
    if (modSaveStatus) modSaveStatus.textContent = "";
  }

  function setModSearchStatus(msg, color) {
    if (modSearchStatus) {
      modSearchStatus.textContent = msg;
      modSearchStatus.style.color = color;
    }
  }

  /* ---------- Save updated permissions for existing user ---------- */
  if (modSaveBtn) {
    modSaveBtn.addEventListener("click", async () => {
      const uid = modTargetUid ? modTargetUid.value.trim() : "";
      if (!uid) {
        if (modSaveStatus) {
          modSaveStatus.textContent = "No user selected.";
          modSaveStatus.style.color = "crimson";
        }
        return;
      }

      const email = modUserEmail ? modUserEmail.textContent.trim() : "";
      const name  = modUserName  ? modUserName.textContent.trim()  : "";

      const permissions = {
        mcq: {
          class8:  !!(permFields.mcqClass8  && permFields.mcqClass8.checked),
          class9:  !!(permFields.mcqClass9  && permFields.mcqClass9.checked),
          class10: !!(permFields.mcqClass10 && permFields.mcqClass10.checked),
        },
        pythonHub:   !!(permFields.pythonHub   && permFields.pythonHub.checked),
        premiumQuiz: !!(permFields.premiumQuiz && permFields.premiumQuiz.checked),
        resources:   !!(permFields.resources   && permFields.resources.checked),
        updates:     !!(permFields.updates     && permFields.updates.checked),
        liveQuiz:    !!(permFields.liveQuiz    && permFields.liveQuiz.checked),
      };

      const anyPerm = permissions.mcq.class8 || permissions.mcq.class9 || permissions.mcq.class10
        || permissions.pythonHub || permissions.premiumQuiz || permissions.resources
        || permissions.updates || permissions.liveQuiz;

      if (!anyPerm) {
        if (modSaveStatus) {
          modSaveStatus.textContent = "Please select at least one permission before saving.";
          modSaveStatus.style.color = "crimson";
        }
        return;
      }

      modSaveBtn.disabled = true;
      modSaveBtn.textContent = "Saving…";
      if (modSaveStatus) {
        modSaveStatus.textContent = "Saving permissions…";
        modSaveStatus.style.color = "var(--mist)";
      }

      try {
        const currentUser = auth.currentUser;
        await db.collection("moderators").doc(uid).set({
          email: email,
          displayName: name,
          permissions: permissions,
          grantedBy: currentUser ? currentUser.email : "",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        if (modSaveStatus) {
          modSaveStatus.textContent = `Permissions saved successfully for ${email}.`;
          modSaveStatus.style.color = "#10b981";
        }
        if (modCurrentBadge) modCurrentBadge.style.display = "inline-flex";
        if (modRevokeBtn)    modRevokeBtn.style.display    = "inline-flex";
      } catch (err) {
        if (modSaveStatus) {
          modSaveStatus.textContent = "Error saving: " + err.message;
          modSaveStatus.style.color = "crimson";
        }
      } finally {
        modSaveBtn.disabled = false;
        modSaveBtn.textContent = "Save Permissions";
      }
    });
  }

  /* ---------- Revoke moderator access ---------- */
  if (modRevokeBtn) {
    modRevokeBtn.addEventListener("click", async () => {
      const uid   = modTargetUid ? modTargetUid.value.trim() : "";
      const email = modUserEmail ? modUserEmail.textContent.trim() : "";
      if (!uid) return;
      if (!confirm(`Revoke moderator access for ${email}?`)) return;
      try {
        await db.collection("moderators").doc(uid).delete();
        if (modSaveStatus) {
          modSaveStatus.textContent = `Moderator access revoked for ${email}.`;
          modSaveStatus.style.color = "#10b981";
        }
        resetModCard();
        if (modSearchEmail) modSearchEmail.value = "";
      } catch (err) {
        if (modSaveStatus) {
          modSaveStatus.textContent = "Error revoking: " + err.message;
          modSaveStatus.style.color = "crimson";
        }
      }
    });
  }
}

