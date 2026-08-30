/* ============================================
   admin.js — sign-in gate + add/update/delete
   for "questions" and "updates" Firestore collections.
   ============================================ */

const signInGate = document.getElementById("signInGate");
const notAuthorized = document.getElementById("notAuthorized");
const dashboard = document.getElementById("dashboard");
const signOutBtn = document.getElementById("signOutBtn");

/* ---------- Auth gate ---------- */
auth.onAuthStateChanged((user) => {
  if (!user) {
    show(signInGate);
    hide(notAuthorized, dashboard);
    signOutBtn.hidden = true;
    return;
  }
  signOutBtn.hidden = false;
  if (ADMIN_EMAILS.includes(user.email)) {
    show(dashboard);
    hide(signInGate, notAuthorized);
    initQuestionsAdmin();
    initPythonAdmin();
    initUpdatesAdmin();
  } else {
    show(notAuthorized);
    hide(signInGate, dashboard);
  }
});

document.getElementById("adminLoginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("adminEmail").value;
  const password = document.getElementById("adminPassword").value;
  const status = document.getElementById("adminLoginStatus");
  auth
    .signInWithEmailAndPassword(email, password)
    .catch((err) => {
      status.textContent = err.message;
      status.style.color = "crimson";
    });
});

signOutBtn.addEventListener("click", () => auth.signOut());

function show(...els) { els.forEach((el) => (el.hidden = false)); }
function hide(...els) { els.forEach((el) => (el.hidden = true)); }

/* ---------- Tabs ---------- */
document.querySelectorAll(".admin-tab").forEach((tabBtn) => {
  tabBtn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((b) => b.classList.remove("active"));
    tabBtn.classList.add("active");
    document.getElementById("tab-questions").hidden = tabBtn.dataset.tab !== "questions";
    document.getElementById("tab-python").hidden = tabBtn.dataset.tab !== "python";
    document.getElementById("tab-updates").hidden = tabBtn.dataset.tab !== "updates";
  });
});

/* ============================================
   QUESTIONS — add / edit / delete
   ============================================ */
let questionsUnsub = null;

function initQuestionsAdmin() {
  if (questionsUnsub) return; // already listening
  const form = document.getElementById("questionForm");
  const listEl = document.getElementById("questionsAdminList");
  const submitBtn = document.getElementById("questionSubmitBtn");
  const cancelBtn = document.getElementById("cancelQuestionEdit");
  const idField = document.getElementById("questionId");

  questionsUnsub = db.collection("questions").orderBy("order", "desc").onSnapshot(
    (snapshot) => {
      if (snapshot.empty) {
        listEl.innerHTML = `<p class="updates-loading">No questions yet — add one above.</p>`;
        return;
      }
      listEl.innerHTML = "";
      snapshot.forEach((doc) => {
        const q = doc.data();
        const row = document.createElement("div");
        row.className = "admin-row";
        row.innerHTML = `
          <div>
            <strong>${escapeHtml(q.question || "")}</strong>
            ${q.category ? `<span class="admin-tag">${escapeHtml(q.category)}</span>` : ""}
          </div>
          <div class="admin-row-actions">
            <button class="btn btn-outline btn-sm" data-action="edit">Edit</button>
            <button class="btn btn-outline btn-sm btn-danger" data-action="delete">Delete</button>
          </div>
        `;
        row.querySelector('[data-action="edit"]').addEventListener("click", () => {
          idField.value = doc.id;
          document.getElementById("qText").value = q.question || "";
          document.getElementById("opt0").value = (q.options || [])[0] || "";
          document.getElementById("opt1").value = (q.options || [])[1] || "";
          document.getElementById("opt2").value = (q.options || [])[2] || "";
          document.getElementById("opt3").value = (q.options || [])[3] || "";
          document.getElementById("correctIndex").value = q.correctIndex ?? 0;
          document.getElementById("qExplanation").value = q.explanation || "";
          document.getElementById("qCategory").value = q.category || "";
          submitBtn.textContent = "Save changes";
          cancelBtn.hidden = false;
          form.scrollIntoView({ behavior: "smooth" });
        });
        row.querySelector('[data-action="delete"]').addEventListener("click", () => {
          if (confirm("Delete this question?")) db.collection("questions").doc(doc.id).delete();
        });
        listEl.appendChild(row);
      });
    },
    (err) => {
      listEl.innerHTML = `<p class="updates-loading">Could not load questions (${err.message}).</p>`;
    }
  );

  cancelBtn.addEventListener("click", () => resetQuestionForm());

  form.addEventListener("submit", (e) => {
    e.preventDefault();
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
      category: document.getElementById("qCategory").value.trim(),
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
    submitBtn.textContent = "Add question";
    cancelBtn.hidden = true;
  }
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
}

/* ============================================
   UPDATES — add / edit / delete
   ============================================ */
let updatesUnsub = null;

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
