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
        category: q.category ? String(q.category).trim() : "",
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
    const [question, a, b, c, d, correct, explanation, category] = r;
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
      category: (category || "").trim(),
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
      "question,option_a,option_b,option_c,option_d,correct,explanation,category\n" +
      '"What does len() return for a list?","Its length","Its type","Its memory address","Nothing",A,"len() returns the number of items in a list.","Python Basics"\n' +
      '"Which keyword defines a function in Python?","func","define","def","function",C,"Functions are defined with the def keyword.","Python Basics"\n';
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
